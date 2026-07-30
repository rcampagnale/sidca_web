// src/services/cargaMasivaExpedientesService.js
//
// Cruce de los registros extraídos del PDF contra Firestore y finalización
// masiva de expedientes de sueldo.
//
// ── Cómo se busca (spec 7) ────────────────────────────────────────────────
// El orden es obligatorio y no se cambia:
//   1) Se ubica al docente por DNI  → registros/{dni}
//   2) Se leen SUS expedientes      → registros/{dni}/expedientes
//   3) Se busca el número normalizado dentro de esos expedientes
//   4) Se exige UNA sola coincidencia
//
// El apellido y nombre del PDF nunca identifica: solo se compara para advertir
// posibles inconsistencias de carga.

import {
  collection,
  doc,
  getDoc,
  getDocs,
  serverTimestamp,
  setDoc,
  writeBatch,
} from "firebase/firestore";

import { db } from "../firebase/firebase-config";
import {
  expedientesCoinciden,
  getExpedienteComparable,
  claveIdempotenciaFinalizacion,
  esDependenciaLiquidacionHaberes,
  nombresProbablementeIguales,
  normalizeDocumento,
} from "../utils/expedientesNormalizacion";
import {
  generarMensajeExpedienteFinalizado,
  construirPayloadFinalizacion,
  construirMovimientoFinalizacion,
  datosEdicionSinCambios,
  normalizarTelefonoWhatsapp,
  obtenerMesCobroSiguiente,
} from "../utils/expedienteFinalizacion";

/* ══════════════════════════════════════════════
 * Resultados posibles de la verificación (spec 7)
 * ══════════════════════════════════════════════ */

export const RESULTADO = {
  LISTO: "LISTO_PARA_FINALIZAR",
  YA_FINALIZADO: "YA_FINALIZADO",
  DOCENTE_NO_ENCONTRADO: "DOCENTE_NO_ENCONTRADO",
  EXPEDIENTE_NO_ENCONTRADO: "EXPEDIENTE_NO_ENCONTRADO",
  EXPEDIENTE_AMBIGUO: "EXPEDIENTE_AMBIGUO",
  DATOS_INVALIDOS: "DATOS_INVALIDOS",
};

export const RESULTADO_LABEL = {
  [RESULTADO.LISTO]: "Listo para finalizar",
  [RESULTADO.YA_FINALIZADO]: "Ya finalizado",
  [RESULTADO.DOCENTE_NO_ENCONTRADO]: "Docente no encontrado",
  [RESULTADO.EXPEDIENTE_NO_ENCONTRADO]: "Expediente no encontrado",
  [RESULTADO.EXPEDIENTE_AMBIGUO]: "Expediente ambiguo",
  [RESULTADO.DATOS_INVALIDOS]: "Datos inválidos",
};

// Severidad para el color de la fila en la tabla de verificación.
export const RESULTADO_SEVERIDAD = {
  [RESULTADO.LISTO]: "ok",
  [RESULTADO.YA_FINALIZADO]: "info",
  [RESULTADO.DOCENTE_NO_ENCONTRADO]: "error",
  [RESULTADO.EXPEDIENTE_NO_ENCONTRADO]: "error",
  [RESULTADO.EXPEDIENTE_AMBIGUO]: "error",
  [RESULTADO.DATOS_INVALIDOS]: "error",
};

export const ADVERTENCIA = {
  NOMBRE_DIFERENTE: "NOMBRE_DIFERENTE",
  SIN_TELEFONO: "SIN_TELEFONO",
  DUPLICADO_AGRUPADO: "DUPLICADO_AGRUPADO",
  DEPENDENCIA_NO_LIQUIDACION: "DEPENDENCIA_NO_LIQUIDACION",
  ESTADO_SUELDO_INACTIVO: "ESTADO_SUELDO_INACTIVO",
};

export const ADVERTENCIA_LABEL = {
  [ADVERTENCIA.NOMBRE_DIFERENTE]: "Nombre diferente",
  [ADVERTENCIA.SIN_TELEFONO]: "Sin teléfono",
  [ADVERTENCIA.DUPLICADO_AGRUPADO]: "Duplicado agrupado",
  [ADVERTENCIA.DEPENDENCIA_NO_LIQUIDACION]: "Dependencia no es Liquidación de Haberes",
  [ADVERTENCIA.ESTADO_SUELDO_INACTIVO]: "Estado de sueldo inactivo",
};

/* ══════════════════════════════════════════════
 * Estados del mensaje de WhatsApp (spec 15)
 * ══════════════════════════════════════════════ */

export const ESTADO_MENSAJE = {
  PENDIENTE: "PENDIENTE",
  ABIERTO: "ABIERTO_EN_WHATSAPP",
  ENVIADO: "ENVIADO",
  OMITIDO: "OMITIDO",
  SIN_TELEFONO: "SIN_TELEFONO",
};

/* ══════════════════════════════════════════════
 * Límites de lote (spec 12)
 * ══════════════════════════════════════════════ */

// Cada expediente finalizado genera 3 escrituras:
//   1) update del expediente
//   2) addDoc del movimiento (historial)
//   3) set del item de la carga masiva (incluye el mensaje de WhatsApp)
const ESCRITURAS_POR_EXPEDIENTE = 3;
const MAX_ESCRITURAS_POR_BATCH = 450; // margen sobre el límite real de 500
export const EXPEDIENTES_POR_LOTE = Math.floor(
  MAX_ESCRITURAS_POR_BATCH / ESCRITURAS_POR_EXPEDIENTE
); // = 150

const COL_CARGAS = "cargas_masivas_expedientes";

/* ══════════════════════════════════════════════
 * Referencias
 * ══════════════════════════════════════════════ */

const refExpedientesDeDni = (dni) =>
  collection(db, "expedientes", "sueldo", "registros", dni, "expedientes");

const refExpediente = (dni, expedienteId) =>
  doc(db, "expedientes", "sueldo", "registros", dni, "expedientes", expedienteId);

const refMovimientos = (dni, expedienteId) =>
  collection(
    db,
    "expedientes",
    "sueldo",
    "registros",
    dni,
    "expedientes",
    expedienteId,
    "movimientos"
  );

const refCarga = (batchId) => doc(db, COL_CARGAS, batchId);
const refItemsCarga = (batchId) => collection(db, COL_CARGAS, batchId, "items");

/* ══════════════════════════════════════════════
 * VERIFICACIÓN
 * ══════════════════════════════════════════════ */

/**
 * Cruza los registros del PDF contra Firestore.
 *
 * @param {object} p
 * @param {Array} p.registros Registros ya deduplicados (agruparFilasPdf).
 * @param {Array} p.invalidas Filas que el parser no pudo interpretar.
 * @param {(progreso:{actual:number,total:number}) => void} [p.onProgreso]
 */
export const verificarRegistros = async ({
  registros = [],
  invalidas = [],
  onProgreso,
}) => {
  const resultados = [];

  // Un docente puede tener varias filas en el PDF: se cachean sus expedientes
  // para no volver a leer Firestore por cada fila.
  const cacheExpedientesPorDni = new Map();

  const leerExpedientesDeDni = async (dni) => {
    if (cacheExpedientesPorDni.has(dni)) {
      return cacheExpedientesPorDni.get(dni);
    }
    let lista = [];
    try {
      const snap = await getDocs(refExpedientesDeDni(dni));
      lista = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    } catch (error) {
      console.error(
        `[cargaMasiva] Error leyendo expedientes del DNI ${dni}:`,
        error
      );
      lista = [];
    }
    cacheExpedientesPorDni.set(dni, lista);
    return lista;
  };

  // ── Filas que el parser marcó como no interpretables ──
  invalidas.forEach((fila, idx) => {
    resultados.push({
      key: `invalida-${idx}`,
      ...fila,
      resultado: RESULTADO.DATOS_INVALIDOS,
      advertencias: [],
      observacion: fila.motivoInvalido || "No se pudo leer DNI o expediente.",
      expedienteEncontrado: null,
      procesar: false,
      puedeProcesar: false,
    });
  });

  // ── Registros válidos ──
  for (let i = 0; i < registros.length; i += 1) {
    const registro = registros[i];
    const dni = normalizeDocumento(registro.dni);
    const claveExpedientePdf = getExpedienteComparable(registro.expedientePdf);

    const advertencias = [];
    if ((registro.filasAgrupadas || 1) > 1) {
      advertencias.push(ADVERTENCIA.DUPLICADO_AGRUPADO);
    }

    const base = {
      key: `${dni}|${claveExpedientePdf}`,
      ...registro,
      dni,
      expedientePdfNormalizado: claveExpedientePdf,
      expedienteEncontrado: null,
      advertencias,
    };

    if (!dni || !claveExpedientePdf) {
      resultados.push({
        ...base,
        resultado: RESULTADO.DATOS_INVALIDOS,
        observacion: !dni
          ? "CUIL/DNI inválido."
          : "Número de expediente inválido.",
        procesar: false,
        puedeProcesar: false,
      });
      onProgreso?.({ actual: i + 1, total: registros.length });
      continue;
    }

    // 1) y 2) Docente + sus expedientes
    const expedientesDelDni = await leerExpedientesDeDni(dni);

    if (expedientesDelDni.length === 0) {
      resultados.push({
        ...base,
        resultado: RESULTADO.DOCENTE_NO_ENCONTRADO,
        observacion: `No hay expedientes cargados para el DNI ${dni}.`,
        procesar: false,
        puedeProcesar: false,
      });
      onProgreso?.({ actual: i + 1, total: registros.length });
      continue;
    }

    // 3) Buscar el expediente por número normalizado
    const coincidencias = expedientesDelDni.filter((exp) =>
      expedientesCoinciden(exp.expediente, registro.expedientePdf)
    );

    // 4) Exigir una sola coincidencia
    if (coincidencias.length === 0) {
      resultados.push({
        ...base,
        resultado: RESULTADO.EXPEDIENTE_NO_ENCONTRADO,
        observacion: `El docente existe pero no tiene el expediente ${claveExpedientePdf}. Cargados: ${expedientesDelDni
          .map((e) => e.expediente || e.id)
          .join(", ")}.`,
        procesar: false,
        puedeProcesar: false,
      });
      onProgreso?.({ actual: i + 1, total: registros.length });
      continue;
    }

    if (coincidencias.length > 1) {
      resultados.push({
        ...base,
        resultado: RESULTADO.EXPEDIENTE_AMBIGUO,
        observacion: `Hay ${coincidencias.length} expedientes que coinciden con ${claveExpedientePdf}. Resolvelo manualmente.`,
        procesar: false,
        puedeProcesar: false,
      });
      onProgreso?.({ actual: i + 1, total: registros.length });
      continue;
    }

    const encontrado = coincidencias[0];

    // Ya finalizado → no se vuelve a tocar (idempotencia, spec 18)
    if (encontrado.finalizado) {
      resultados.push({
        ...base,
        expedienteEncontrado: encontrado,
        resultado: RESULTADO.YA_FINALIZADO,
        observacion: "El expediente ya estaba finalizado. No se modifica.",
        procesar: false,
        puedeProcesar: false,
      });
      onProgreso?.({ actual: i + 1, total: registros.length });
      continue;
    }

    // ── Advertencias (no bloquean: el admin decide) ──
    if (
      !nombresProbablementeIguales(
        registro.apellidoNombrePdf,
        encontrado.apellidoNombre
      )
    ) {
      advertencias.push(ADVERTENCIA.NOMBRE_DIFERENTE);
    }

    if (!esDependenciaLiquidacionHaberes(encontrado.dependencia)) {
      advertencias.push(ADVERTENCIA.DEPENDENCIA_NO_LIQUIDACION);
    }

    if (String(encontrado.estadoSueldo || "").toUpperCase() !== "ACTIVO") {
      advertencias.push(ADVERTENCIA.ESTADO_SUELDO_INACTIVO);
    }

    const telefono = encontrado.telefono || "";
    if (!normalizarTelefonoWhatsapp(telefono)) {
      advertencias.push(ADVERTENCIA.SIN_TELEFONO);
    }

    resultados.push({
      ...base,
      expedienteEncontrado: encontrado,
      advertencias,
      resultado: RESULTADO.LISTO,
      observacion:
        advertencias.length > 0
          ? advertencias.map((a) => ADVERTENCIA_LABEL[a]).join(" · ")
          : "",
      // Viene tildado por defecto; el admin puede destildarlo (spec 9).
      procesar: true,
      puedeProcesar: true,
    });

    onProgreso?.({ actual: i + 1, total: registros.length });
  }

  return { resultados, resumen: resumirVerificacion(resultados) };
};

export const resumirVerificacion = (resultados = []) => {
  const contar = (fn) => resultados.filter(fn).length;
  const tieneAdv = (adv) => (r) => (r.advertencias || []).includes(adv);

  return {
    total: resultados.length,
    listos: contar((r) => r.resultado === RESULTADO.LISTO),
    yaFinalizados: contar((r) => r.resultado === RESULTADO.YA_FINALIZADO),
    docentesNoEncontrados: contar(
      (r) => r.resultado === RESULTADO.DOCENTE_NO_ENCONTRADO
    ),
    expedientesNoEncontrados: contar(
      (r) => r.resultado === RESULTADO.EXPEDIENTE_NO_ENCONTRADO
    ),
    ambiguos: contar((r) => r.resultado === RESULTADO.EXPEDIENTE_AMBIGUO),
    datosInvalidos: contar((r) => r.resultado === RESULTADO.DATOS_INVALIDOS),
    dependenciaNoValida: contar(
      tieneAdv(ADVERTENCIA.DEPENDENCIA_NO_LIQUIDACION)
    ),
    estadoInactivo: contar(tieneAdv(ADVERTENCIA.ESTADO_SUELDO_INACTIVO)),
    nombreDiferente: contar(tieneAdv(ADVERTENCIA.NOMBRE_DIFERENTE)),
    sinTelefono: contar(tieneAdv(ADVERTENCIA.SIN_TELEFONO)),
    duplicadosAgrupados: contar(tieneAdv(ADVERTENCIA.DUPLICADO_AGRUPADO)),
    conAdvertencias: contar((r) => (r.advertencias || []).length > 0),
    seleccionados: contar((r) => r.procesar && r.puedeProcesar),
  };
};

/* ══════════════════════════════════════════════
 * FINALIZACIÓN MASIVA
 * ══════════════════════════════════════════════ */

/**
 * Finaliza en lotes los expedientes seleccionados.
 *
 * Antes de escribir cada expediente lo vuelve a leer desde Firestore, para no
 * pisar registros que hayan cambiado después de la verificación (spec 10).
 *
 * @returns {Promise<{finalizados:Array, omitidos:Array, errores:Array, batchId:string}>}
 */
export const finalizarExpedientesMasivo = async ({
  seleccionados = [],
  haberMes,
  usuarioMovimiento,
  modoUsuario = "",
  nombreArchivo,
  totalPaginasPdf = 0,
  totalFilasPdf = 0,
  totalRegistrosUnicos = 0,
  onProgreso,
}) => {
  const batchId = `carga-${Date.now()}`;
  const cobroMes = obtenerMesCobroSiguiente(haberMes);

  const finalizados = [];
  const omitidos = [];
  const errores = [];

  // ── Documento de cabecera de la carga (spec 13) ──
  await setDoc(refCarga(batchId), {
    tipo: "finalizacion_expedientes_pdf",
    nombreArchivo: nombreArchivo || "",
    fechaInicio: serverTimestamp(),
    // La carga la puede hacer un admin o un delegado con permiso de cambiar
    // estado, así que los campos son neutrales y se guarda el modo aparte.
    usuarioUid: usuarioMovimiento?.usuarioUid || "",
    usuarioNombre: usuarioMovimiento?.usuarioNombre || "",
    usuarioDni: usuarioMovimiento?.usuarioDni || "",
    modoUsuario: modoUsuario || "",
    totalPaginas: totalPaginasPdf,
    totalFilasPdf,
    totalRegistrosUnicos,
    totalSeleccionados: seleccionados.length,
    haberFinalizacionMes: haberMes || "",
    cobroFinalizacionMes: cobroMes || "",
    estado: "procesando",
  });

  // ── Lotes ──
  const lotes = [];
  for (let i = 0; i < seleccionados.length; i += EXPEDIENTES_POR_LOTE) {
    lotes.push(seleccionados.slice(i, i + EXPEDIENTES_POR_LOTE));
  }

  for (let indiceLote = 0; indiceLote < lotes.length; indiceLote += 1) {
    const lote = lotes[indiceLote];
    const batch = writeBatch(db);
    const enEsteBatch = [];

    for (const registro of lote) {
      const dni = registro.dni;
      const expedienteId = registro.expedienteEncontrado?.id;

      if (!dni || !expedienteId) {
        omitidos.push({
          ...registro,
          motivo: "Faltan DNI o id del expediente.",
        });
        continue;
      }

      try {
        // Relectura inmediata antes de escribir (spec 10)
        const snap = await getDoc(refExpediente(dni, expedienteId));

        if (!snap.exists()) {
          omitidos.push({
            ...registro,
            motivo: "El expediente ya no existe en la base.",
          });
          continue;
        }

        const actual = { id: snap.id, ...snap.data() };

        // Idempotencia: si alguien lo finalizó mientras verificábamos, se salta
        if (actual.finalizado) {
          omitidos.push({
            ...registro,
            motivo: "Ya estaba finalizado al momento de escribir.",
          });
          continue;
        }

        // La carga masiva NO modifica dependencia/estado/estadoSueldo
        const datosEdicion = datosEdicionSinCambios(actual);

        const mensaje = generarMensajeExpedienteFinalizado({
          afiliado: actual.apellidoNombre,
          expediente: actual.expediente,
          haberMes,
          cobroMes,
          estado: actual.estado,
          observacion: actual.observacionActual || "",
        });

        const telefono = actual.telefono || registro.expedienteEncontrado?.telefono || "";

        const metaOrigen = {
          origen: "carga_masiva_pdf",
          batchId,
          nombreArchivo: nombreArchivo || "",
          paginaPdf: registro.pagina || null,
          expedientePdfNormalizado: registro.expedientePdfNormalizado || "",
        };

        // 1) Expediente
        batch.update(
          refExpediente(dni, expedienteId),
          construirPayloadFinalizacion({
            datosEdicion,
            mensajeFinalizacion: mensaje,
            telefonoDestino: telefono,
            haberFinalizacionMes: haberMes || "",
            cobroFinalizacionMes: cobroMes || "",
            usuarioMovimiento,
            extra: metaOrigen,
          })
        );

        // 2) Historial (se agrega, nunca reemplaza los movimientos previos)
        batch.set(
          doc(refMovimientos(dni, expedienteId)),
          construirMovimientoFinalizacion({
            mensajeFinalizacion: mensaje,
            expedienteActual: actual,
            datosEdicion,
            usuarioMovimiento,
            extra: metaOrigen,
          })
        );

        // 3) Item de la carga (incluye el mensaje pendiente de WhatsApp).
        // El id es determinístico: si se recarga el mismo PDF en otra carga,
        // el item de ESA carga se sobrescribe en vez de duplicarse.
        const claveIdem = claveIdempotenciaFinalizacion(
          dni,
          registro.expedientePdfNormalizado
        );
        const itemId = claveIdem || `${dni}-${expedienteId}`;

        const telefonoNormalizado = normalizarTelefonoWhatsapp(telefono);

        batch.set(doc(refItemsCarga(batchId), itemId), {
          ...metaOrigen,
          claveIdempotencia: claveIdem,
          dni,
          expedienteId,
          expediente: actual.expediente || "",
          apellidoNombre: actual.apellidoNombre || "",
          apellidoNombrePdf: registro.apellidoNombrePdf || "",
          cuilPdf: registro.cuilPdf || "",
          dependencia: actual.dependencia || "",
          estadoSueldo: actual.estadoSueldo || "",
          estado: actual.estado || "",
          advertencias: registro.advertencias || [],
          filasAgrupadas: registro.filasAgrupadas || 1,
          idsCargo: registro.idsCargo || [],
          idsPlaza: registro.idsPlaza || [],
          resultado: "finalizado",
          telefono,
          telefonoNormalizado,
          mensajeWhatsapp: mensaje,
          estadoMensaje: telefonoNormalizado
            ? ESTADO_MENSAJE.PENDIENTE
            : ESTADO_MENSAJE.SIN_TELEFONO,
          creadoEn: serverTimestamp(),
        });

        enEsteBatch.push({
          ...registro,
          expedienteId,
          apellidoNombre: actual.apellidoNombre || registro.apellidoNombrePdf,
          expediente: actual.expediente || "",
          telefono,
          telefonoNormalizado,
          mensajeWhatsapp: mensaje,
          estadoMensaje: telefonoNormalizado
            ? ESTADO_MENSAJE.PENDIENTE
            : ESTADO_MENSAJE.SIN_TELEFONO,
          itemId,
        });
      } catch (error) {
        console.error("[cargaMasiva] Error preparando expediente:", error);
        errores.push({
          ...registro,
          motivo: error?.message || "Error al preparar la escritura.",
        });
      }
    }

    // ── Commit del lote ──
    if (enEsteBatch.length > 0) {
      try {
        await batch.commit();
        finalizados.push(...enEsteBatch);
      } catch (error) {
        // El lote no se marca como completado: se registran sus expedientes
        // como error y se sigue con los lotes siguientes (spec 12).
        console.error(
          `[cargaMasiva] Error al confirmar el lote ${indiceLote + 1}:`,
          error
        );
        enEsteBatch.forEach((item) => {
          errores.push({
            ...item,
            motivo: `Falló el lote ${indiceLote + 1}: ${
              error?.message || "error de escritura"
            }`,
          });
        });
      }
    }

    onProgreso?.({
      loteActual: indiceLote + 1,
      totalLotes: lotes.length,
      procesados: finalizados.length,
      total: seleccionados.length,
      errores: errores.length,
    });
  }

  // ── Cierre del documento de la carga ──
  const estadoFinal =
    errores.length === 0
      ? "completado"
      : finalizados.length > 0
      ? "completado_con_errores"
      : "error";

  try {
    await setDoc(
      refCarga(batchId),
      {
        fechaFin: serverTimestamp(),
        totalFinalizados: finalizados.length,
        totalOmitidos: omitidos.length,
        totalErrores: errores.length,
        estado: estadoFinal,
      },
      { merge: true }
    );
  } catch (error) {
    console.error("[cargaMasiva] No se pudo cerrar el registro de carga:", error);
  }

  return { finalizados, omitidos, errores, batchId, estadoFinal };
};

/* ══════════════════════════════════════════════
 * Estado de los mensajes de WhatsApp
 * ══════════════════════════════════════════════ */

/**
 * Persiste el estado del mensaje (abierto / enviado / omitido) en el item de la
 * carga, para que quede registro de qué se comunicó.
 */
export const actualizarEstadoMensaje = async ({
  batchId,
  itemId,
  estadoMensaje,
  mensajeWhatsapp,
}) => {
  if (!batchId || !itemId) return;
  try {
    await setDoc(
      doc(refItemsCarga(batchId), itemId),
      {
        estadoMensaje,
        ...(mensajeWhatsapp ? { mensajeWhatsapp } : {}),
        estadoMensajeActualizadoEn: serverTimestamp(),
      },
      { merge: true }
    );
  } catch (error) {
    // No es crítico: el envío es manual y el estado es informativo.
    console.error("[cargaMasiva] No se pudo actualizar el estado del mensaje:", error);
  }
};

const cargaMasivaExpedientesService = {
  verificarRegistros,
  resumirVerificacion,
  finalizarExpedientesMasivo,
  actualizarEstadoMensaje,
  RESULTADO,
  RESULTADO_LABEL,
  RESULTADO_SEVERIDAD,
  ADVERTENCIA,
  ADVERTENCIA_LABEL,
  ESTADO_MENSAJE,
  EXPEDIENTES_POR_LOTE,
};

export default cargaMasivaExpedientesService;
