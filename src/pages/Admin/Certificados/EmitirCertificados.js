// src/pages/Admin/Certificados/EmitirCertificados.js
//
// Pestaña EMITIR.
//
// Flujo:
//   1. Elegir entre los certificados YA CONFIGURADOS.
//   2. GET configuración -> datos documentales para el preview.
//   3. GET aprobados      -> lista real, resuelta por el backend.
//   4. Buscar, previsualizar y EMITIR el certificado de un participante.
//
// La fuente NO es la colección "cursos": eso es lo que usa Configurar, cuya
// finalidad es justamente elegir qué curso configurar. Emitir sólo puede
// trabajar sobre capacitaciones que ya tienen certificado configurado, así
// que parte de "certificados" filtrado por el backend. Los documentos
// históricos de esa colección (sin cursoId) quedan fuera.
//
//   CONFIGURAR -> cursos
//   EMITIR     -> certificados configurados
//   EMITIDOS   -> certificados con emitidos (etapa futura)
//
// Los aprobados NO se cargan a mano: salen del importador de Excel existente
// (usuarios/{usuarioDocId}/cursos con aprobo:true). El frontend no envía DNI
// ni decide quién está aprobado; sólo muestra lo que responde el backend
// autenticado.
//
// La EMISIÓN ya es real: POST /admin/emision/:cursoId/emitir registra el
// certificado en Firestore a través del backend, que vuelve a verificar todo
// por su cuenta (aprobación, exclusión, datos, doble emisión) y arma el
// snapshot con lo que él mismo lee. El frontend sólo envía usuarioDocId.
// Todavía NO se genera PDF ni QR gráfico: eso llega en la etapa siguiente.

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Dialog } from "primereact/dialog";
import { ProgressBar } from "primereact/progressbar";

import {
  eliminarConfiguracionCertificado,
  emitirCertificado,
  emitirCertificadosMasivamente,
  excluirUsuarioEmision,
  obtenerAprobadosCurso,
  obtenerConfiguracionCertificado,
  obtenerConfiguracionesCertificado,
  obtenerEmisionVigenteCertificado,
  iniciarPdfMasivo,
  obtenerEstadoPdfMasivo,
  obtenerPdfMasivoActual,
  descargarPdfMasivo as descargarPdfMasivoArchivo,
  obtenerSegmentosPdf,
  iniciarPdfSegmento,
  obtenerEstadoPdfSegmento,
  obtenerPdfSegmentoActual,
  descargarPdfSegmento as descargarPdfSegmentoArchivo,
  obtenerDatosExcelSegmento,
  obtenerFirmaMinisterio,
  obtenerFirmaMinisterioEmitida,
  reiniciarEmisionesCurso,
  reincluirUsuarioEmision,
} from "../../../services/certificadosService";
import CertificadoPreview from "./components/CertificadoPreview";
import SelectorConfiguracion from "./SelectorConfiguracion";
import { validarConfiguracionMinisterio } from "./utils/ministerioCertificado";
import styles from "./CertificadosAdmin.module.css";
import emitir from "./EmitirCertificados.module.css";
// La descarga MASIVA ya no se arma en el navegador: la resuelve el Cloud Run
// Job. Estos helpers siguen en uso para la descarga INDIVIDUAL, que captura el
// preview en pantalla y no pasa por el Job.
import {
  agregarCanvasAPdf,
  capturarCertificado,
  crearPdfA4Horizontal,
  sanitizarNombreArchivo,
} from "./utils/certificadoPdf";

const DIACRITICOS = new RegExp("[\\u0300-\\u036f]", "g");

const normalizar = (valor) =>
  String(valor || "")
    .normalize("NFD")
    .replace(DIACRITICOS, "")
    .trim()
    .toLowerCase();

const claveEmision = (cursoId, usuarioDocId) => {
  const curso = String(cursoId || "").trim();
  const usuario = String(usuarioDocId || "").trim();
  if (!curso || !usuario) return "";
  return `${curso}::${usuario}`;
};

const prepararFirmantesMinisterio = async ({
  certificado,
  resolverImagen,
  estricto = false,
}) => {
  const objectUrls = [];
  const firmantes = Array.isArray(certificado?.firmantesMinisterio)
    ? certificado.firmantesMinisterio
        .filter((firmante) => firmante?.activo !== false)
        .sort((a, b) => Number(a?.orden || 0) - Number(b?.orden || 0))
    : [];

  try {
    const enriquecidos = await Promise.all(
      firmantes.map(async (firmante) => {
        const nombre = String(firmante?.nombre || "Firmante").trim();
        const tieneReferencia =
          String(firmante?.imagenStoragePath || "").trim() &&
          Number(firmante?.imagenVersion || 0) > 0;

        if (!tieneReferencia) {
          if (estricto) {
            throw new Error(
              `No se encontró la firma histórica de ${nombre}. El PDF no fue generado.`
            );
          }
          return { ...firmante, imagenUrl: "" };
        }

        try {
          const blob = await resolverImagen(firmante);
          const imagenUrl = URL.createObjectURL(blob);
          objectUrls.push(imagenUrl);
          return { ...firmante, imagenUrl };
        } catch (_) {
          if (estricto) {
            throw new Error(
              `No se pudo cargar la firma de ${nombre}. El PDF no fue generado.`
            );
          }
          return { ...firmante, imagenUrl: "" };
        }
      })
    );

    return {
      firmantes: enriquecidos,
      firmas: Object.fromEntries(
        enriquecidos
          .filter((firmante) => firmante.imagenUrl)
          .map((firmante) => [firmante.id, firmante.imagenUrl])
      ),
      objectUrls,
    };
  } catch (error) {
    objectUrls.forEach((url) => URL.revokeObjectURL(url));
    throw error;
  }
};

const esperarRenderCertificado = async () => {
  if (typeof window === "undefined" || typeof window.requestAnimationFrame !== "function") {
    await Promise.resolve();
    return;
  }

  await new Promise((resolve) => window.requestAnimationFrame(resolve));
  await new Promise((resolve) => window.requestAnimationFrame(resolve));
};

/** Sólo para mostrar. El DNI almacenado no se modifica. */
/**
 * DNI tal como se muestra en esta pantalla: sólo dígitos, sin separadores.
 *
 * Acá se busca y se copia el número para pegarlo en otros sistemas, y los
 * puntos estorban en las dos cosas. El DNI almacenado no se toca: esto es
 * presentación.
 */
const mostrarDni = (dni) => {
  const limpio = String(dni || "").replace(/\D/g, "");
  return limpio || "—";
};

const ETIQUETA_ESTADO = {
  aprobado: "Aprobado",
  sin_usuario: "Sin usuario asociado",
  datos_incompletos: "Datos incompletos",
};

const CLASE_ESTADO = {
  aprobado: emitir.estadoAprobado,
  sin_usuario: emitir.estadoSinUsuario,
  datos_incompletos: emitir.estadoIncompleto,
};

const RESUMEN_VACIO = {
  documentosAprobacion: 0,
  aprobados: 0,
  disponibles: 0,
  identificados: 0,
  sinUsuario: 0,
  datosIncompletos: 0,
  duplicados: 0,
  excluidos: 0,
};

/* ============================================================
   PDF MASIVO — estado del trabajo
   ============================================================ */

/** Cada cuánto se pregunta por el trabajo. Dos segundos, no doscientos ms. */
const PDF_POLLING_MS = 2000;

/**
 * ¿El trabajo sigue corriendo?
 *
 * Se aceptan también los estados del vocabulario anterior para que un trabajo
 * que quedó en vuelo no se muestre como colgado.
 */
const pdfEnCurso = (trabajo) =>
  ["pendiente", "procesando", "preparando", "generando", "finalizando"].includes(
    String(trabajo?.estado || "")
  );

const pdfCompletado = (trabajo) =>
  ["completado", "listo"].includes(String(trabajo?.estado || ""));

const pdfConError = (trabajo) => String(trabajo?.estado || "") === "error";

/** Milisegundos a mm:ss (o h:mm:ss si pasa de la hora). */
const formatearDuracion = (ms) => {
  const total = Math.max(0, Math.round(Number(ms || 0) / 1000));
  const horas = Math.floor(total / 3600);
  const minutos = Math.floor((total % 3600) / 60);
  const segundos = total % 60;
  const dosDigitos = (valor) => String(valor).padStart(2, "0");

  return horas > 0
    ? `${horas}:${dosDigitos(minutos)}:${dosDigitos(segundos)}`
    : `${dosDigitos(minutos)}:${dosDigitos(segundos)}`;
};

/** Marca de tiempo a "13:21 hs". Devuelve vacío si el backend no la mandó. */
const formatearHora = (valor) => {
  if (!valor) return "";
  const fecha = new Date(valor);
  if (Number.isNaN(fecha.getTime())) return "";
  return `${String(fecha.getHours()).padStart(2, "0")}:${String(
    fecha.getMinutes()
  ).padStart(2, "0")} hs`;
};

/* ============================================================
   CONDICIÓN SINDICAL
   ============================================================ */

/**
 * ¿Puede emitirse o descargarse el certificado de este participante?
 *
 * Lo decide el backend, que resuelve la condición contra el padrón con la
 * misma regla que Admin → Adherentes → Estado. Acá sólo se lee el resultado:
 * esto es interfaz, no autorización. El backend vuelve a comprobarlo antes de
 * escribir, así que deshabilitar el botón es una cortesía, no la barrera.
 *
 * Ante la ausencia del dato se asume NO habilitado: es más seguro bloquear de
 * más y que el administrador pregunte, que habilitar por un campo que no llegó.
 */
const afiliacionHabilitada = (participante) =>
  participante?.afiliacion?.habilitadoCertificado === true;

/**
 * Peso de un participante en el orden de la lista. Menor va primero.
 *
 *   0 — Adherente no habilitado: es el único que requiere una gestión antes
 *       de poder certificar, así que encabeza.
 *   1 — Adherente habilitado.
 *   2 — Cotizante.
 *   3 — No verificado, sin usuario asociado y cualquier caso restante: van al
 *       final porque no hay nada que hacer con ellos desde acá.
 *
 * Se mira el modelo estructurado, nunca la etiqueta visible: comparar contra
 * el texto "Adherente · No habilitado" ataría el orden a una cadena de la
 * interfaz, que puede cambiar por razones de redacción. La condición sigue
 * decidiéndola el backend; acá sólo se lee para ordenar.
 */
const prioridadAfiliacion = (participante) => {
  const tipo = participante?.afiliacion?.tipo;
  const habilitado = participante?.afiliacion?.habilitadoCertificado === true;

  if (tipo === "adherente") return habilitado ? 1 : 0;
  if (tipo === "cotizante") return 2;

  return 3;
};

/** Clase del chip según el tipo y el estado. */
const CLASE_AFILIACION = {
  cotizante: emitir.afiliacionOk,
  adherenteHabilitado: emitir.afiliacionOk,
  adherenteBloqueado: emitir.afiliacionBloqueada,
  no_verificada: emitir.afiliacionNeutra,
};

const claseAfiliacion = (afiliacion) => {
  if (!afiliacion) return emitir.afiliacionNeutra;
  if (afiliacion.tipo === "cotizante") return CLASE_AFILIACION.cotizante;
  if (afiliacion.tipo === "adherente") {
    return afiliacion.habilitadoCertificado
      ? CLASE_AFILIACION.adherenteHabilitado
      : CLASE_AFILIACION.adherenteBloqueado;
  }
  return CLASE_AFILIACION.no_verificada;
};

/** Chip de la columna Afiliado. La etiqueta viene armada del backend. */
const ChipAfiliacion = ({ afiliacion }) => (
  <span
    className={`${emitir.afiliacion} ${claseAfiliacion(afiliacion)}`}
    title={afiliacion?.motivoBloqueo || undefined}
  >
    {afiliacion?.etiqueta || "No verificado"}
  </span>
);

/**
 * Un registro es gestionable sólo si su usuario existe realmente.
 *
 * Los "sin usuario asociado" son aprobaciones cuyo documento de usuario ya
 * no existe: no se pueden previsualizar (no hay nombre ni DNI que imprimir)
 * y no tiene sentido apartarlos de la emisión, porque ya son no emitibles.
 */
const esGestionable = (participante) =>
  Boolean(participante?.usuarioDocId) && participante?.estado !== "sin_usuario";

const MOTIVO_NO_GESTIONABLE =
  "No se puede gestionar la emisión porque este registro no está asociado a un usuario.";

/**
 * Para EMITIR el criterio es más estricto que para previsualizar.
 *
 * Un registro con datos incompletos se puede mirar, pero no se puede emitir:
 * saldría un certificado oficial sin DNI o sin nombre. El backend lo rechaza
 * igual con 409; acá se evita el viaje y se explica el motivo.
 */
const esEmitible = (participante) =>
  Boolean(participante?.usuarioDocId) && participante?.estado === "aprobado";

const MOTIVO_DATOS_INCOMPLETOS =
  "No se puede emitir porque los datos del participante están incompletos.";

const MOTIVO_YA_EMITIDO =
  "Este participante ya tiene un certificado emitido. La anulación se gestionará desde Emitidos.";

const EmitirCertificados = ({ notificar }) => {
  const [configuraciones, setConfiguraciones] = useState([]);
  const [cargandoLista, setCargandoLista] = useState(true);
  const [errorLista, setErrorLista] = useState("");
  const [busquedaCurso, setBusquedaCurso] = useState("");

  const [curso, setCurso] = useState(null);
  const [modalEmitirVisible, setModalEmitirVisible] = useState(false);
  const [configuracion, setConfiguracion] = useState(null);
  const [sinConfiguracion, setSinConfiguracion] = useState(false);

  const [resumen, setResumen] = useState(RESUMEN_VACIO);
  const [participantes, setParticipantes] = useState([]);

  // Apartados de la emisión. Conservan su aprobación: se listan aparte para
  // poder recuperarlos, no para emitirles.
  const [participantesExcluidos, setParticipantesExcluidos] = useState([]);

  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState("");
  const [busqueda, setBusqueda] = useState("");

  const [participantePreview, setParticipantePreview] = useState(null);

  // Fila del listado que se abrió: aporta resolución y estado al encabezado
  // del modal sin esperar a que llegue la configuración completa.
  const [seleccion, setSeleccion] = useState(null);

  const [quitandoUsuario, setQuitandoUsuario] = useState("");
  const [recuperandoUsuario, setRecuperandoUsuario] = useState("");
  const [quitandoCurso, setQuitandoCurso] = useState(false);
  const [reiniciandoEmisiones, setReiniciandoEmisiones] = useState(false);
  const [dialogoReinicioVisible, setDialogoReinicioVisible] = useState(false);

  // Emisión en curso. Sirve para el estado del botón y para que un doble
  // click no dispare dos POST.
  const [emitiendoUsuario, setEmitiendoUsuario] = useState("");
  const [consultandoEmisionUsuario, setConsultandoEmisionUsuario] =
    useState("");

  /**
   * Emisiones conocidas en esta pantalla: usuarioDocId -> emisión completa.
   *
   * Un Map y no un Set porque el QR necesita la urlValidacion, y más adelante
   * el PDF necesitará el token y el snapshot. Tener la clave alcanza para
   * saber que está emitido, así que no hace falta un segundo estado.
   *
   * Se llena por dos vías: la respuesta del POST al emitir y una acción
   * explícita que necesita mostrar un emitido histórico. La autoridad sigue
   * siendo el backend.
   */
  const [emisionesSesion, setEmisionesSesion] = useState(() => new Map());
  const [descargandoUsuario, setDescargandoUsuario] = useState("");
  const [descargandoMasivo, setDescargandoMasivo] = useState(false);
  const [firmasMinisterioPreview, setFirmasMinisterioPreview] = useState({});
  const [recargaFirmasPreview, setRecargaFirmasPreview] = useState(0);
  const preparandoPdfRef = useRef(false);

  // PDF masivo. El trabajo vive en Firestore, no en esta pestaña: por eso se
  // guarda el documento completo del trabajo y no un progreso local. El texto
  // del botón y el del diálogo salen de ahí.
  const [trabajoPdf, setTrabajoPdf] = useState(null);
  const [dialogoPdfVisible, setDialogoPdfVisible] = useState(false);
  const [bajandoArchivoPdf, setBajandoArchivoPdf] = useState(false);

  // Descarga por segmentos geográficos.
  //
  // Los ocho segmentos y sus contadores los define el BACKEND: acá no hay
  // ninguna lista de departamentos. `trabajosSegmento` guarda el documento del
  // trabajo de cada segmento —igual que trabajoPdf, pero uno por segmento—,
  // porque la generación vive en el servidor y tiene que sobrevivir a un F5.
  const [dialogoSegmentosVisible, setDialogoSegmentosVisible] = useState(false);
  const [segmentos, setSegmentos] = useState([]);
  const [cargandoSegmentos, setCargandoSegmentos] = useState(false);
  const [errorSegmentos, setErrorSegmentos] = useState("");
  const [trabajosSegmento, setTrabajosSegmento] = useState(() => ({}));
  const [segmentoIniciando, setSegmentoIniciando] = useState("");
  const [segmentoBajando, setSegmentoBajando] = useState("");
  const [segmentoExcel, setSegmentoExcel] = useState("");

  // Emisión masiva. Crea certificados oficiales; no tiene nada que ver con la
  // descarga masiva, que sólo lee lo que ya está emitido.
  const [emitiendoMasivo, setEmitiendoMasivo] = useState(false);
  const [confirmarEmisionMasivaVisible, setConfirmarEmisionMasivaVisible] =
    useState(false);
  const [resultadoEmisionMasiva, setResultadoEmisionMasiva] = useState(null);

  // El preview empieza siempre con la configuración actual. Sólo se completa
  // con un snapshot después de una emisión real o al abrir un emitido histórico
  // desde una acción que explícitamente lo necesita.
  const [emisionPreview, setEmisionPreview] = useState(null);
  const certificadoPreview =
    emisionPreview
      ? emisionPreview.certificado
      : configuracion;
  const esMinisterioPreview =
    certificadoPreview?.institucionCertificado === "ministerio";
  const validacionMinisterioPreview = useMemo(
    () =>
      esMinisterioPreview
        ? validarConfiguracionMinisterio({
            certificado: certificadoPreview,
            participante: emisionPreview?.participante || participantePreview,
          })
        : null,
    [
      esMinisterioPreview,
      certificadoPreview,
      emisionPreview?.participante,
      participantePreview,
    ]
  );

  useEffect(() => {
    let activo = true;
    const urls = [];
    const cargarFirmas = async () => {
      if (preparandoPdfRef.current) return;
      if (!esMinisterioPreview || !curso?.id || !participantePreview?.usuarioDocId) {
        setFirmasMinisterioPreview({});
        return;
      }

      const usuarioDocId =
        emisionPreview?.participante?.usuarioDocId ||
        participantePreview.usuarioDocId;
      const preparado = await prepararFirmantesMinisterio({
        certificado: certificadoPreview,
        resolverImagen: (firmante) =>
          emisionPreview
            ? obtenerFirmaMinisterioEmitida(curso.id, usuarioDocId, firmante.id)
            : obtenerFirmaMinisterio(curso.id, firmante.id),
      });
      if (activo) {
        urls.push(...preparado.objectUrls);
        setFirmasMinisterioPreview(preparado.firmas);
      } else {
        preparado.objectUrls.forEach((url) => URL.revokeObjectURL(url));
      }
    };

    cargarFirmas().catch(() => {
      if (activo) setFirmasMinisterioPreview({});
    });
    return () => {
      activo = false;
      urls.forEach((url) => URL.revokeObjectURL(url));
    };
  }, [
    esMinisterioPreview,
    curso?.id,
    participantePreview?.usuarioDocId,
    certificadoPreview,
    emisionPreview,
    recargaFirmasPreview,
  ]);

  const recordarEmision = useCallback((cursoId, usuarioDocId, emision) => {
    const clave = claveEmision(cursoId, usuarioDocId);
    if (!clave) return;
    setEmisionesSesion((previas) => {
      const siguiente = new Map(previas);
      siguiente.set(clave, emision || null);
      return siguiente;
    });
  }, []);

  /**
   * ¿Este participante tiene certificado emitido?
   *
   * Ojo con la semántica del Map: una clave presente con valor null significa
   * "ya consultamos y NO está emitido". Por eso se mira el valor y no has().
   */
  const estaEmitido = useCallback(
    (participante) => {
      if (participante?.certificadoEmitido === true) return true;
      const clave = claveEmision(curso?.id, participante?.usuarioDocId);
      return clave ? Boolean(emisionesSesion.get(clave)) : false;
    },
    [curso?.id, emisionesSesion]
  );

  // Lista de certificados configurados. Se pide una sola vez al abrir la
  // pestaña; el filtrado del selector es en memoria.
  useEffect(() => {
    let activo = true;

    const cargar = async () => {
      try {
        const lista = await obtenerConfiguracionesCertificado();
        if (!activo) return;
        setConfiguraciones(lista);
        setErrorLista("");
      } catch (e) {
        if (!activo) return;
        setErrorLista(
          e?.message || "No se pudieron cargar los certificados configurados."
        );
      } finally {
        if (activo) setCargandoLista(false);
      }
    };

    cargar();

    return () => {
      activo = false;
    };
  }, []);

  const limpiar = useCallback(() => {
    setConfiguracion(null);
    setSinConfiguracion(false);
    setResumen(RESUMEN_VACIO);
    setParticipantes([]);
    setParticipantesExcluidos([]);
    setBusqueda("");
    setError("");
    setConsultandoEmisionUsuario("");
  }, []);

  /**
   * Vuelve a pedir los aprobados y reemplaza resumen y listas con lo que
   * responde el backend.
   *
   * Se usa después de apartar o recuperar a alguien. Recalcular los contadores
   * a mano sería frágil: son seis valores relacionados entre sí —aprobados,
   * disponibles, identificados, datosIncompletos, sinUsuario, excluidos— y
   * cualquier ajuste parcial los desincroniza. El backend es la única fuente
   * que los deja coherentes.
   */
  const recargarAprobados = useCallback(async () => {
    if (!curso) return;

    const datos = await obtenerAprobadosCurso(curso.id);

    setResumen(datos.resumen || RESUMEN_VACIO);
    setParticipantes(datos.participantes || []);
    setParticipantesExcluidos(datos.participantesExcluidos || []);
  }, [curso]);

  /**
   * Configuración y aprobados se piden en paralelo: son independientes y así
   * la pantalla no espera dos viajes encadenados.
   *
   * Se vuelve a pedir la configuración completa aunque el listado ya traiga
   * algunos campos: el selector sólo recibe los livianos y el preview
   * necesita cargaHoraria, dias y fecha.
   */
  const seleccionarCurso = useCallback(
    async (configuracionElegida) => {
      const cursoElegido = {
        id: configuracionElegida.cursoId,
        titulo:
          configuracionElegida.cursoTitulo || configuracionElegida.titulo || "",
        cursoId: configuracionElegida.cursoId,
      };

      setCurso(cursoElegido);
      setSeleccion(configuracionElegida);
      limpiar();
      // Se abre de inmediato y muestra el estado de carga adentro.
      setModalEmitirVisible(true);
      setCargando(true);

      const [resConfig, resAprobados] = await Promise.allSettled([
        obtenerConfiguracionCertificado(cursoElegido.id),
        obtenerAprobadosCurso(cursoElegido.id),
      ]);

      if (resConfig.status === "fulfilled") {
        setConfiguracion(resConfig.value);
        setSinConfiguracion(!resConfig.value);
      } else {
        setSinConfiguracion(true);
        notificar?.(
          "error",
          "No se pudo consultar la configuración",
          resConfig.reason?.message || "Error inesperado."
        );
      }

      if (resAprobados.status === "fulfilled") {
        setResumen(resAprobados.value.resumen || RESUMEN_VACIO);
        setParticipantes(resAprobados.value.participantes || []);
        setParticipantesExcluidos(
          resAprobados.value.participantesExcluidos || []
        );
      } else {
        const fallo = resAprobados.reason;

        // 404 acá es "el curso no existe", no "no hay aprobados": sin
        // aprobados el backend responde 200 con lista vacía.
        setError(fallo?.message || "No se pudieron cargar los aprobados.");
        notificar?.(
          "error",
          "No se pudieron cargar los aprobados",
          fallo?.message || "Error inesperado."
        );
      }

      setCargando(false);
    },
    [limpiar, notificar]
  );

  /**
   * Filtrado y orden de la lista visible.
   *
   * El filtrado es en memoria: no se vuelve a consultar el backend por cada
   * tecla. El DNI se compara dígito contra dígito en los DOS lados, así que
   * buscar 32628508 encuentra al participante aunque el dato almacenado
   * tuviera puntos.
   *
   * Orden por condición de afiliación —ver prioridadAfiliacion—: adherentes
   * no habilitados, adherentes habilitados, cotizantes y por último los que no
   * se pudieron verificar. Dentro de cada grupo, alfabético por apellido y
   * nombre. El orden se mantiene también con el buscador activo.
   *
   * Se copia antes de ordenar: `participantes` es estado de React y .sort()
   * ordena en el lugar, así que ordenarlo directamente lo mutaría.
   */
  const visibles = useMemo(() => {
    const termino = normalizar(busqueda);
    const soloDigitos = termino.replace(/\D/g, "");

    const filtrados = !termino
      ? participantes
      : participantes.filter((participante) => {
          if (normalizar(participante.apellidoNombre).includes(termino)) {
            return true;
          }

          const dniParticipante = String(participante.dni || "").replace(
            /\D/g,
            ""
          );

          return Boolean(soloDigitos) && dniParticipante.includes(soloDigitos);
        });

    return [...filtrados].sort((a, b) => {
      const prioridadA = prioridadAfiliacion(a);
      const prioridadB = prioridadAfiliacion(b);

      if (prioridadA !== prioridadB) return prioridadA - prioridadB;

      return String(a.apellidoNombre || "").localeCompare(
        String(b.apellidoNombre || ""),
        "es",
        { sensitivity: "base" }
      );
    });
  }, [participantes, busqueda]);

  /**
   * Reparto por condición sindical, para los indicadores de arriba.
   *
   * Se cuenta sobre `participantes`, NO sobre `visibles`: los indicadores
   * resumen el curso, no la búsqueda. Si se calcularan sobre la lista filtrada,
   * escribir un DNI en el buscador los dejaría casi todos en cero y el
   * administrador perdería de vista cuánta gente tiene pendiente de revisar.
   *
   * Tampoco entran los apartados: ya tienen su propio indicador (Excluidos) y
   * están fuera del flujo de emisión, así que sumarlos acá haría que los
   * números no cerraran contra la tabla.
   *
   * Los "no verificado" y los "sin usuario asociado" no suman a ninguno de los
   * tres: aparecen en la tabla, pero no son ni adherentes ni cotizantes.
   */
  const resumenAfiliacion = useMemo(
    () =>
      participantes.reduce(
        (acumulado, participante) => {
          const tipo = participante?.afiliacion?.tipo;
          const habilitado =
            participante?.afiliacion?.habilitadoCertificado === true;

          if (tipo === "adherente") {
            if (habilitado) acumulado.adherentesHabilitados += 1;
            else acumulado.adherentesNoHabilitados += 1;
          } else if (tipo === "cotizante") {
            acumulado.cotizantes += 1;
          }

          return acumulado;
        },
        {
          adherentesNoHabilitados: 0,
          adherentesHabilitados: 0,
          cotizantes: 0,
        }
      ),
    [participantes]
  );

  /**
   * Participantes a los que la emisión masiva les crearía un certificado.
   *
   * La autoridad es `estaEmitido`, que combina la marca vigente del backend
   * con la emisión completa que esta pantalla acaba de registrar o consultar.
   * Así el contador reacciona inmediatamente a una emisión individual y sigue
   * reconociendo emisiones hechas por otro administrador tras recargar.
   *
   * Los apartados no se cuentan porque ni siquiera están en `participantes`:
   * viven en `participantesExcluidos`.
   *
   * Es una estimación para el botón y la confirmación. Quién se emite de
   * verdad lo decide el backend releyendo el padrón.
   */
  const participantesPendientesEmision = useMemo(
    () =>
      participantes.filter(
        (participante) =>
          participante?.estado === "aprobado" &&
          Boolean(participante?.usuarioDocId) &&
          !estaEmitido(participante)
      ),
    [participantes, estaEmitido]
  );

  const cantidadPendientesEmision = participantesPendientesEmision.length;

  const cantidadYaEmitidos = useMemo(
    () =>
      participantes.filter(
        (participante) => estaEmitido(participante)
      ).length,
    [participantes, estaEmitido]
  );

  // La descarga segmentada sólo lee emisiones vigentes existentes. Puede
  // convivir con participantes pendientes, pero no con una operación que
  // esté creando o eliminando esas mismas emisiones.
  const hayCertificadosEmitidos = cantidadYaEmitidos > 0;
  const operacionIncompatibleSegmentos =
    cargando ||
    emitiendoMasivo ||
    Boolean(emitiendoUsuario) ||
    reiniciandoEmisiones ||
    quitandoCurso ||
    descargandoMasivo;

  const textoBotonEmisionMasiva = emitiendoMasivo
    ? "Emitiendo certificados…"
    : cantidadPendientesEmision === 0
    ? "Certificados emitidos"
    : cantidadPendientesEmision === 1
    ? "Emitir 1 certificado"
    : `Emitir ${cantidadPendientesEmision} certificados`;

  /**
   * Cierra el modal de Emitir y vuelve al listado.
   *
   * No se limpian configuraciones ni busquedaCurso: el listado y el texto del
   * buscador principal quedan como estaban. Sí se cierra el preview, para que
   * reabrir no arrastre un participante de la selección anterior.
   */
  const cerrarModalEmitir = useCallback(() => {
    setModalEmitirVisible(false);
    setParticipantePreview(null);
  }, []);

  const puedePrevisualizar = Boolean(configuracion);

  /**
   * Abre una simulación con la configuración actual del curso.
   *
   * Preview es completamente no destructivo: no consulta emisiones ni carga
   * snapshots históricos. Sólo una emisión real puede completar este preview
   * con el snapshot que devolvió el POST.
   */
  const abrirPreview = useCallback(
    async (participante) => {
      if (!puedePrevisualizar) {
        notificar?.(
          "warn",
          "Falta la configuración",
          "Configurá el certificado de esta capacitación antes de previsualizar."
        );
        return;
      }

      if (consultandoEmisionUsuario) return;

      const emisionLocal = emisionesSesion.get(
        claveEmision(curso?.id, participante?.usuarioDocId)
      );

      if (emisionLocal) {
        setEmisionPreview(emisionLocal);
        setParticipantePreview(participante);
        return;
      }

      if (participante?.certificadoEmitido !== true) {
        setEmisionPreview(null);
        setParticipantePreview(participante);
        return;
      }

      // Después de un refresh la fila conserva sólo la marca de emisión. Se
      // obtiene una vez la emisión vigente y se incorpora al mismo Map que
      // usa la fila, el PDF y el preview posterior.
      setConsultandoEmisionUsuario(participante.usuarioDocId);
      try {
        const emision = await obtenerEmisionVigenteCertificado(
          curso.id,
          participante.usuarioDocId
        );

        if (!emision) {
          recordarEmision(curso.id, participante.usuarioDocId, null);
          throw new Error(
            "No se encontró la emisión vigente de este participante. Actualizá la lista antes de continuar."
          );
        }

        recordarEmision(curso.id, participante.usuarioDocId, emision);
        setEmisionPreview(emision);
        setParticipantePreview(participante);
      } catch (error) {
        notificar?.(
          "error",
          "No se pudo abrir el certificado emitido",
          error?.message || "No se pudo consultar la emisión vigente."
        );
      } finally {
        setConsultandoEmisionUsuario("");
      }
    },
    [
      puedePrevisualizar,
      consultandoEmisionUsuario,
      emisionesSesion,
      curso,
      recordarEmision,
      notificar,
    ]
  );

  const descargarPdfIndividual = useCallback(async (participante) => {
    if (!curso || !estaEmitido(participante) || descargandoUsuario) return;
    setDescargandoUsuario(participante.usuarioDocId);
    const objectUrls = [];
    let esMinisterio = false;
    try {
      let emision = emisionesSesion.get(claveEmision(curso.id, participante.usuarioDocId));
      if (!emision) {
        emision = await obtenerEmisionVigenteCertificado(curso.id, participante.usuarioDocId);
        recordarEmision(curso.id, participante.usuarioDocId, emision);
      }

      esMinisterio = emision?.certificado?.institucionCertificado === "ministerio";
      let emisionParaRender = emision;
      if (esMinisterio) {
        const preparado = await prepararFirmantesMinisterio({
          certificado: emision.certificado,
          estricto: true,
          resolverImagen: (firmante) =>
            obtenerFirmaMinisterioEmitida(
              curso.id,
              emision.participante?.usuarioDocId || participante.usuarioDocId,
              firmante.id
            ),
        });
        objectUrls.push(...preparado.objectUrls);
        emisionParaRender = {
          ...emision,
          certificado: {
            ...emision.certificado,
            firmantesMinisterio: preparado.firmantes,
          },
        };
        preparandoPdfRef.current = true;
        setFirmasMinisterioPreview(preparado.firmas);
      }

      setEmisionPreview(emisionParaRender);
      setParticipantePreview(participante);
      await esperarRenderCertificado();
      const elemento = document.querySelector('[data-certificado-preview="true"]');
      if (!elemento) throw new Error("No se encontró el lienzo del certificado.");
      const canvas = await capturarCertificado(elemento, {
        scale:
          emision?.certificado?.institucionCertificado === "ministerio" ? 3 : 2,
      });
      const pdf = crearPdfA4Horizontal();
      agregarCanvasAPdf(pdf, canvas, true);
      pdf.save(`Certificado - ${sanitizarNombreArchivo(emision?.participante?.apellidoNombre || participante.apellidoNombre)} - ${sanitizarNombreArchivo(emision?.participante?.dni || participante.dni)}.pdf`);
    } catch (error) {
      notificar?.("error", "No se pudo generar el PDF", error?.message || "Error inesperado.");
    } finally {
      objectUrls.forEach((url) => URL.revokeObjectURL(url));
      preparandoPdfRef.current = false;
      if (esMinisterio) setRecargaFirmasPreview((valor) => valor + 1);
      setDescargandoUsuario("");
    }
  }, [curso, emisionesSesion, descargandoUsuario, estaEmitido, recordarEmision, notificar]);

  /**
   * Descarga el archivo ya generado y lo entrega al navegador.
   *
   * El objeto de Storage nunca se nombra desde acá: el backend lo lee del
   * documento del trabajo. Lo único que viaja es cursoId y jobId.
   */
  const bajarArchivoPdf = useCallback(
    async (trabajo) => {
      if (!curso?.id || !trabajo?.jobId) return;

      const blob = await descargarPdfMasivoArchivo(curso.id, trabajo.jobId);
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");

      anchor.href = url;
      anchor.download =
        trabajo.nombreArchivo ||
        `Certificados - ${sanitizarNombreArchivo(curso.titulo)}.pdf`;
      anchor.click();

      URL.revokeObjectURL(url);
    },
    [curso]
  );

  /**
   * Lanza la generación. No espera acá: sólo deja el trabajo registrado y
   * abre el diálogo. El seguimiento lo hace el efecto de polling, que
   * sobrevive a que este handler termine.
   *
   * Pulsar de nuevo con un trabajo en curso no duplica nada: el backend
   * devuelve el que ya está corriendo.
   */
  const descargarPdfMasivo = useCallback(async () => {
    if (!curso?.id || descargandoMasivo) return;

    setDescargandoMasivo(true);

    try {
      const trabajo = await iniciarPdfMasivo(curso.id);

      if (!trabajo?.jobId) {
        throw new Error("No se pudo iniciar la generación del PDF.");
      }

      setTrabajoPdf(trabajo);
      setDialogoPdfVisible(true);
    } catch (error) {
      setDescargandoMasivo(false);
      notificar?.(
        "error",
        "No se pudo iniciar la descarga masiva",
        error?.message || "Error inesperado."
      );
    }
  }, [curso, descargandoMasivo, notificar]);

  /**
   * Recuperación: al abrir un curso se pregunta si tiene un trabajo vigente.
   *
   * La generación no vive en la pestaña. Si el administrador recargó, cerró el
   * navegador o perdió la conexión, al volver encuentra el progreso donde
   * estaba, o el PDF terminado listo para bajar.
   */
  useEffect(() => {
    if (!curso?.id) {
      setTrabajoPdf(null);
      setDialogoPdfVisible(false);
      return undefined;
    }

    let activo = true;

    obtenerPdfMasivoActual(curso.id)
      .then((trabajo) => {
        if (!activo || !trabajo) return;

        setTrabajoPdf(trabajo);

        if (pdfEnCurso(trabajo)) {
          setDescargandoMasivo(true);
          setDialogoPdfVisible(true);
        }
      })
      // Silencioso a propósito: no poder consultar un trabajo previo no es
      // motivo para molestar al administrador que recién entra al curso.
      .catch(() => undefined);

    return () => {
      activo = false;
    };
  }, [curso?.id]);

  /**
   * Polling del trabajo en curso.
   *
   * Vive en un efecto y no dentro del handler: así el seguimiento no depende
   * de que una función siga viva, se limpia solo al desmontar y no puede
   * dejar dos temporizadores encadenados. Se detiene en cuanto el trabajo
   * termina, falla o el componente se va.
   */
  useEffect(() => {
    const jobId = trabajoPdf?.jobId;

    if (!curso?.id || !jobId || !pdfEnCurso(trabajoPdf)) return undefined;

    let activo = true;
    let temporizador = null;

    const consultar = async () => {
      try {
        const actualizado = await obtenerEstadoPdfMasivo(curso.id, jobId);
        if (!activo) return;

        if (actualizado) setTrabajoPdf(actualizado);

        // Reprograma sólo si sigue en curso: nada de intervalos que corren
        // por su cuenta después de terminar.
        if (activo && pdfEnCurso(actualizado)) {
          temporizador = setTimeout(consultar, PDF_POLLING_MS);
        } else if (activo) {
          setDescargandoMasivo(false);
        }
      } catch (e) {
        if (!activo) return;
        // Un fallo puntual de red no cancela el seguimiento: se reintenta.
        temporizador = setTimeout(consultar, PDF_POLLING_MS);
      }
    };

    temporizador = setTimeout(consultar, PDF_POLLING_MS);

    return () => {
      activo = false;
      if (temporizador) clearTimeout(temporizador);
    };
  }, [curso?.id, trabajoPdf]);

  /** Descarga el PDF terminado desde el diálogo. */
  const bajarPdfTerminado = useCallback(async () => {
    if (!trabajoPdf || bajandoArchivoPdf) return;

    setBajandoArchivoPdf(true);

    try {
      await bajarArchivoPdf(trabajoPdf);
      setDialogoPdfVisible(false);
    } catch (error) {
      notificar?.(
        "error",
        "No se pudo descargar el PDF",
        error?.message || "Error inesperado."
      );
    } finally {
      setBajandoArchivoPdf(false);
    }
  }, [trabajoPdf, bajandoArchivoPdf, bajarArchivoPdf, notificar]);

  /**
   * Reintento tras un fallo. Crea un trabajo NUEVO: el que falló queda como
   * está, con su mensaje, en lugar de sobrescribirse.
   */
  const reintentarPdfMasivo = useCallback(async () => {
    setTrabajoPdf(null);
    setDescargandoMasivo(false);
    await descargarPdfMasivo();
  }, [descargarPdfMasivo]);

  // ==========================================================
  // DESCARGA POR SEGMENTOS GEOGRÁFICOS
  // ==========================================================

  /**
   * Trae los ocho segmentos con sus contadores.
   *
   * Siempre son ocho, incluso los que están en cero: un segmento que
   * desapareciera de la lista se leería como "no existe" y no como "vacío".
   */
  const cargarSegmentos = useCallback(async () => {
    if (!curso?.id) return;

    setCargandoSegmentos(true);
    setErrorSegmentos("");

    try {
      const lista = await obtenerSegmentosPdf(curso.id);
      setSegmentos(Array.isArray(lista) ? lista : []);

      // Trabajo vigente de cada segmento. Se piden en paralelo y el mapa se
      // arma de una sola vez: así al reabrir el diálogo aparecen los PDF que
      // ya estaban listos y los que siguen generándose.
      const trabajos = await Promise.all(
        (lista || []).map(async (segmento) => {
          try {
            return [
              segmento.id,
              await obtenerPdfSegmentoActual(curso.id, segmento.id),
            ];
          } catch {
            return [segmento.id, null];
          }
        })
      );

      setTrabajosSegmento(Object.fromEntries(trabajos.filter(([, t]) => t)));
    } catch (e) {
      setErrorSegmentos(e?.message || "No se pudieron cargar los segmentos.");
    } finally {
      setCargandoSegmentos(false);
    }
  }, [curso?.id]);

  const abrirDialogoSegmentos = useCallback(() => {
    setDialogoSegmentosVisible(true);
    cargarSegmentos();
  }, [cargarSegmentos]);

  /**
   * Lanza la generación de UN segmento.
   *
   * Nunca se generan los ocho juntos: cada PDF sale de un clic explícito. Ocho
   * ejecuciones simultáneas del Job serían ocho veces el trabajo y, sobre
   * todo, nadie las pidió.
   */
  const generarPdfSegmento = useCallback(
    async (segmentoId) => {
      if (!curso?.id || segmentoIniciando) return;

      setSegmentoIniciando(segmentoId);

      try {
        const trabajo = await iniciarPdfSegmento(curso.id, segmentoId);

        if (!trabajo?.jobId) {
          throw new Error("No se pudo iniciar la generación del PDF.");
        }

        setTrabajosSegmento((previos) => ({
          ...previos,
          [segmentoId]: trabajo,
        }));
      } catch (e) {
        notificar?.(
          "error",
          "No se pudo iniciar la generación",
          e?.message || "Error inesperado."
        );
      } finally {
        setSegmentoIniciando("");
      }
    },
    [curso?.id, segmentoIniciando, notificar]
  );

  const bajarPdfSegmento = useCallback(
    async (segmentoId) => {
      const trabajo = trabajosSegmento[segmentoId];
      if (!curso?.id || !trabajo?.jobId || segmentoBajando) return;

      setSegmentoBajando(segmentoId);

      try {
        const blob = await descargarPdfSegmentoArchivo(
          curso.id,
          segmentoId,
          trabajo.jobId
        );
        const url = URL.createObjectURL(blob);
        const anchor = document.createElement("a");

        anchor.href = url;
        anchor.download =
          trabajo.nombreArchivo || `Certificados_${segmentoId}.pdf`;
        anchor.click();

        URL.revokeObjectURL(url);
      } catch (e) {
        notificar?.(
          "error",
          "No se pudo descargar el PDF",
          e?.message || "Error inesperado."
        );
      } finally {
        setSegmentoBajando("");
      }
    },
    [curso?.id, trabajosSegmento, segmentoBajando, notificar]
  );

  /**
   * Planilla de control del segmento.
   *
   * Incluye a TODOS los identificados del segmento —cotizantes, adherentes
   * habilitados y adherentes NO habilitados—, así que normalmente tiene más
   * filas que páginas tiene el PDF. Eso es justamente el punto: sirve para ver
   * quién quedó afuera y por qué.
   *
   * El backend entrega las filas ya resueltas y ordenadas; acá sólo se vuelcan
   * a una hoja. El DNI va como TEXTO explícito porque Excel, librado a su
   * criterio, convierte los números largos a notación científica.
   */
  const descargarExcelSegmento = useCallback(
    async (segmento) => {
      if (!curso?.id || segmentoExcel) return;

      setSegmentoExcel(segmento.id);

      try {
        const datos = await obtenerDatosExcelSegmento(curso.id, segmento.id);
        const filas = Array.isArray(datos?.filas) ? datos.filas : [];

        if (!filas.length) {
          notificar?.(
            "advertencia",
            "Sin participantes",
            "Este segmento no tiene participantes identificados."
          );
          return;
        }

        const XLSX = await import("xlsx");

        const hoja = XLSX.utils.json_to_sheet(
          filas.map((fila) => ({
            "Apellido y nombre": fila.apellidoNombre,
            DNI: fila.dni,
            Adherente: fila.adherente,
            EstadoAfiliado: fila.estadoAfiliado,
            Departamento: fila.departamento,
          })),
          {
            header: [
              "Apellido y nombre",
              "DNI",
              "Adherente",
              "EstadoAfiliado",
              "Departamento",
            ],
          }
        );

        // Columna B como texto, celda por celda. json_to_sheet ya la tipa como
        // cadena, pero se fuerza igual: si un día llegara un DNI numérico, la
        // planilla seguiría mostrando los ocho dígitos completos.
        filas.forEach((fila, indice) => {
          const celda = hoja[XLSX.utils.encode_cell({ c: 1, r: indice + 1 })];
          if (celda) {
            celda.t = "s";
            celda.v = String(fila.dni || "");
            celda.z = "@";
          }
        });

        hoja["!cols"] = [
          { wch: 38 },
          { wch: 14 },
          { wch: 12 },
          { wch: 20 },
          { wch: 30 },
        ];

        const libro = XLSX.utils.book_new();
        const nombreSegmento = String(
          datos?.segmentoNombre || segmento.nombre || ""
        );

        // Excel no admite nombres de hoja de más de 31 caracteres.
        XLSX.utils.book_append_sheet(libro, hoja, nombreSegmento.slice(0, 31));

        XLSX.writeFile(
          libro,
          `Control_Certificados_${sanitizarNombreArchivo(
            nombreSegmento
          ).replace(/\s+/g, "_")}.xlsx`
        );
      } catch (e) {
        notificar?.(
          "error",
          "No se pudo generar la planilla",
          e?.message || "Error inesperado."
        );
      } finally {
        setSegmentoExcel("");
      }
    },
    [curso?.id, segmentoExcel, notificar]
  );

  /**
   * Polling de los segmentos que están generándose.
   *
   * Un solo temporizador para todos: cada vuelta consulta sólo los que siguen
   * en curso y se apaga cuando no queda ninguno. Mismo criterio que el polling
   * del PDF masivo —vive en un efecto y se limpia al desmontar—, pero sin
   * encadenar un temporizador por tarjeta.
   */
  useEffect(() => {
    const enCurso = Object.entries(trabajosSegmento)
      .filter(([, trabajo]) => pdfEnCurso(trabajo))
      .map(([segmentoId, trabajo]) => [segmentoId, trabajo.jobId]);

    if (!curso?.id || !dialogoSegmentosVisible || !enCurso.length) {
      return undefined;
    }

    let activo = true;
    let temporizador = null;

    const consultar = async () => {
      try {
        const actualizados = await Promise.all(
          enCurso.map(async ([segmentoId, jobId]) => {
            try {
              return [
                segmentoId,
                await obtenerEstadoPdfSegmento(curso.id, segmentoId, jobId),
              ];
            } catch {
              return [segmentoId, null];
            }
          })
        );

        if (!activo) return;

        setTrabajosSegmento((previos) => {
          const siguiente = { ...previos };
          actualizados.forEach(([segmentoId, trabajo]) => {
            if (trabajo) siguiente[segmentoId] = trabajo;
          });
          return siguiente;
        });
      } finally {
        // Se reprograma pase lo que pase: un fallo puntual de red no cancela
        // el seguimiento. El efecto vuelve a evaluarse con los trabajos ya
        // actualizados y se apaga solo cuando ninguno sigue en curso.
        if (activo) temporizador = setTimeout(consultar, PDF_POLLING_MS);
      }
    };

    temporizador = setTimeout(consultar, PDF_POLLING_MS);

    return () => {
      activo = false;
      if (temporizador) clearTimeout(temporizador);
    };
  }, [curso?.id, dialogoSegmentosVisible, trabajosSegmento]);

  /**
   * Emite el certificado del participante.
   *
   * Registra la emisión REAL en Firestore a través del backend. Todavía no
   * genera PDF ni QR gráfico: eso llega en la etapa siguiente.
   *
   * Las comprobaciones de acá son de UX —evitan viajes inútiles y explican el
   * motivo—. La seguridad real está en el backend, que vuelve a verificar
   * aprobación, exclusiones, datos y doble emisión por su cuenta.
   */
  const emitirParticipante = useCallback(
    async (participante) => {
      if (!curso || !configuracion || !participante) return;
      if (!esEmitible(participante)) return;
      if (estaEmitido(participante)) return;
      const clave = claveEmision(curso.id, participante.usuarioDocId);
      if (clave && emisionesSesion.get(clave)) return;
      if (emitiendoUsuario) return;
      const confirmado = window.confirm(
        `¿Emitir el certificado de "${participante.apellidoNombre}"?\n\n` +
          `DNI: ${mostrarDni(participante.dni)}\n\n` +
          "Esta acción registrará un certificado oficial SIDCA para esta capacitación.\n\n" +
          "Todavía no se generará el PDF ni la descarga; en esta etapa se registrará " +
          "la emisión y su código de validación.\n\n¿Continuar?"
      );

      if (!confirmado) return;

      setEmitiendoUsuario(participante.usuarioDocId);

      try {
        const emision = await emitirCertificado(
          curso.id,
          participante.usuarioDocId
        );

        if (!emision?.certificadoId || !emision?.token || !emision?.urlValidacion) {
          throw new Error(
            "El servidor no devolvió los datos de la emisión. Verificá en Emitidos antes de reintentar."
          );
        }

        // Se guarda la emisión COMPLETA, no sólo la marca: el QR necesita
        // urlValidacion y así aparece de inmediato, sin un GET extra.
        recordarEmision(curso.id, participante.usuarioDocId, emision);
        setEmisionPreview(emision);

        notificar?.(
          "success",
          "Certificado emitido",
          `El certificado de ${participante.apellidoNombre} fue registrado correctamente.`
        );
      } catch (e) {
        // Un 409 indica que no hubo una nueva emisión. El preview debe seguir
        // mostrando la configuración actual, sin cargar el snapshot histórico.
        notificar?.(
          "error",
          "No se pudo emitir el certificado",
          e?.message || "Error inesperado."
        );
      } finally {
        setEmitiendoUsuario("");
      }
    },
    [
      curso,
      configuracion,
      emisionesSesion,
      emitiendoUsuario,
      estaEmitido,
      recordarEmision,
      notificar,
    ]
  );

  /**
   * Aparta a un participante de la emisión.
   *
   * NO elimina al usuario ni su aprobación: el backend sólo agrega su
   * usuarioDocId a certificados/{cursoId}.usuariosExcluidos.
   *
   * Al terminar se recargan los aprobados en lugar de ajustar la lista y los
   * contadores a mano. Antes se hacía así, pero ahora la persona tiene que
   * aparecer en el bloque de apartados, y reconstruir las dos listas más los
   * seis contadores en memoria es exactamente donde se cuelan las
   * inconsistencias.
   */
  const quitarParticipante = useCallback(
    async (participante) => {
      if (!curso) return;

      // Defensa: los registros sin usuario ya son no emitibles y no tiene
      // sentido apartarlos. La UI no ofrece el botón, esto cubre el resto.
      if (!esGestionable(participante)) {
        notificar?.("warn", "Registro no gestionable", MOTIVO_NO_GESTIONABLE);
        return;
      }

      const confirmado = window.confirm(
        `¿Quitar a ${participante.apellidoNombre || "este participante"} de la emisión de certificados?\n\n` +
          "No se elimina el usuario, ni su aprobación, ni ningún dato académico. " +
          "Solamente deja de aparecer para emitir certificados de esta capacitación, y se puede revertir."
      );

      if (!confirmado) return;

      setQuitandoUsuario(participante.usuarioDocId);

      try {
        await excluirUsuarioEmision(curso.id, participante.usuarioDocId);

        // Si estaba abierto su preview, se cierra.
        setParticipantePreview((previo) =>
          previo?.usuarioDocId === participante.usuarioDocId ? null : previo
        );

        await recargarAprobados();

        notificar?.(
          "success",
          "Participante quitado de la emisión",
          "Su aprobación y sus datos siguen intactos. Podés recuperarlo desde el bloque de apartados."
        );
      } catch (e) {
        notificar?.(
          "error",
          "No se pudo quitar el participante",
          e?.message || "Error inesperado."
        );
      } finally {
        setQuitandoUsuario("");
      }
    },
    [curso, recargarAprobados, notificar]
  );

  /**
   * Recupera a un participante apartado para que vuelva a estar disponible.
   *
   * Es la inversa exacta de apartarlo: el backend sólo saca su usuarioDocId de
   * certificados/{cursoId}.usuariosExcluidos. No restaura nada — la aprobación
   * nunca se borró — ni crea ni anula certificados emitidos.
   *
   * Se permite también para registros sin usuario asociado: la acción sólo
   * revierte la exclusión, y seguirán sin poder emitirse por su estado.
   */
  const recuperarParticipante = useCallback(
    async (participante) => {
      if (!curso || !participante?.usuarioDocId) return;
      if (recuperandoUsuario) return;

      const confirmado = window.confirm(
        `¿Recuperar a "${participante.apellidoNombre || "este participante"}" para la emisión de certificados?\n\n` +
          "Su aprobación nunca fue eliminada. Volverá a estar disponible para emitir este certificado."
      );

      if (!confirmado) return;

      setRecuperandoUsuario(participante.usuarioDocId);

      try {
        await reincluirUsuarioEmision(curso.id, participante.usuarioDocId);

        await recargarAprobados();

        notificar?.(
          "success",
          "Participante recuperado",
          "Volvió a estar disponible para la emisión de certificados. Su aprobación se mantuvo intacta."
        );
      } catch (e) {
        notificar?.(
          "error",
          "No se pudo recuperar el participante",
          e?.message || "Error inesperado."
        );
      } finally {
        setRecuperandoUsuario("");
      }
    },
    [curso, recuperandoUsuario, recargarAprobados, notificar]
  );

  /**
   * Emite certificados oficiales para todos los pendientes del curso.
   *
   * No manda la lista de participantes: sólo el cursoId. El backend reconstruye
   * el padrón y decide a quién emitir, así que lo que esta pantalla tenga
   * cargado —o desactualizado— no puede provocar una emisión indebida.
   *
   * No genera PDF. Eso es la descarga masiva, que sólo lee lo ya emitido.
   */
  const emitirMasivamente = useCallback(async () => {
    if (!curso?.id || emitiendoMasivo) return;

    setEmitiendoMasivo(true);

    try {
      const resultado = await emitirCertificadosMasivamente(curso.id);

      setResultadoEmisionMasiva(resultado);
      setConfirmarEmisionMasivaVisible(false);

      // La verdad la tiene el backend: se recarga en vez de marcar a mano
      // certificadoEmitido, que dejaría la pantalla creyendo cosas que quizá
      // no ocurrieron. Después de esto los recién emitidos ya vienen con
      // certificadoEmitido en true, sin necesidad de recargar la página.
      await recargarAprobados();

      if (resultado.errores.length) {
        notificar?.(
          "warn",
          "Emisión masiva con errores",
          `Se emitieron ${resultado.emitidos} certificados y ${resultado.errores.length} no pudieron emitirse.`
        );
      } else if (resultado.emitidos === 0) {
        notificar?.(
          "info",
          "No había certificados pendientes",
          "Todos los participantes elegibles ya tenían su certificado emitido."
        );
      } else {
        notificar?.(
          "success",
          "Emisión masiva completada",
          `Se emitieron ${resultado.emitidos} certificados.`
        );
      }
    } catch (e) {
      notificar?.(
        "error",
        "No se pudo completar la emisión masiva",
        e?.message || "Error inesperado."
      );
    } finally {
      setEmitiendoMasivo(false);
    }
  }, [curso, emitiendoMasivo, recargarAprobados, notificar]);

  /**
   * Elimina la configuración de certificado del curso.
   *
   * Borra únicamente certificados/{cursoId}. El curso académico, los usuarios
   * y sus aprobaciones NO se tocan: el curso sigue disponible en Configurar,
   * ahora como curso sin configurar.
   *
   * Es una acción destructiva y no reversible: se pierden los datos
   * documentales cargados (título, resolución, carga horaria, firmas…).
   */
  const quitarCurso = useCallback(async () => {
    if (!curso) return;

    const confirmado = window.confirm(
      "Se eliminará la configuración de este certificado.\n\n" +
        "El curso, sus participantes y sus aprobaciones no serán eliminados. " +
        "Podrás volver a configurar el certificado desde la pestaña Configurar.\n\n" +
        `¿Eliminar la configuración de "${curso.titulo}"?`
    );

    if (!confirmado) return;

    setQuitandoCurso(true);

    try {
      await eliminarConfiguracionCertificado(curso.id);

      setConfiguraciones((previas) =>
        previas.filter((c) => c.cursoId !== curso.id)
      );

      setModalEmitirVisible(false);
      setParticipantePreview(null);

      notificar?.(
        "success",
        "Configuración de certificado eliminada",
        "El curso, sus participantes y sus aprobaciones siguen intactos."
      );
    } catch (e) {
      notificar?.(
        "error",
        "No se pudo eliminar la configuración",
        e?.message || "Error inesperado."
      );
    } finally {
      setQuitandoCurso(false);
    }
  }, [curso, notificar]);

  /**
   * Reinicia sólo las emisiones y artefactos derivados del curso actual.
   * La configuración y las aprobaciones se conservan; el backend devuelve la
   * cantidad real eliminada y luego se vuelve a cargar el padrón.
   */
  const reiniciarEmisiones = useCallback(async () => {
    if (!curso?.id || reiniciandoEmisiones) return;

    setReiniciandoEmisiones(true);

    try {
      const resultado = await reiniciarEmisionesCurso(curso.id);

      setDialogoReinicioVisible(false);
      setParticipantePreview(null);
      setEmisionPreview(null);
      setFirmasMinisterioPreview({});
      setEmisionesSesion((previas) => {
        const siguiente = new Map(previas);
        const prefijo = `${curso.id}::`;
        Array.from(siguiente.keys())
          .filter((clave) => String(clave).startsWith(prefijo))
          .forEach((clave) => siguiente.delete(clave));
        return siguiente;
      });

      await recargarAprobados();

      notificar?.(
        "success",
        "Emisiones eliminadas",
        `Se eliminaron ${resultado.emisionesEliminadas} certificados emitidos. Ya podés generar nuevos certificados con la configuración actual.`
      );
    } catch (e) {
      notificar?.(
        "error",
        "No se pudieron eliminar las emisiones",
        e?.message || "Error inesperado."
      );
    } finally {
      setReiniciandoEmisiones(false);
    }
  }, [curso, reiniciandoEmisiones, recargarAprobados, notificar]);

  return (
    <>
      <section className={styles.bloque}>
        <div className={styles.bloqueHeader}>
          <h2 className={styles.bloqueTitulo}>
            Seleccioná el certificado configurado
          </h2>
        </div>

        {cargandoLista ? (
          <p className={styles.estadoTexto}>
            Cargando certificados configurados…
          </p>
        ) : errorLista ? (
          <p className={styles.mensajeError}>{errorLista}</p>
        ) : (
          <SelectorConfiguracion
            configuraciones={configuraciones}
            configuracionSeleccionada={curso}
            onSeleccionar={seleccionarCurso}
            deshabilitado={cargando}
            busqueda={busquedaCurso}
            onBuscar={setBusquedaCurso}
          />
        )}
      </section>

      <Dialog
        visible={modalEmitirVisible}
        onHide={cerrarModalEmitir}
        modal
        blockScroll
        draggable={false}
        dismissableMask={false}
        className={styles.modal}
        style={{ width: "min(1200px, 96vw)" }}
        contentClassName={styles.modalContenido}
        breakpoints={{ "768px": "96vw" }}
        header={
          <div className={styles.modalHeader}>
            <span className={styles.modalTitulo}>Emitir certificados</span>
            <span className={styles.modalSubtitulo}>
              {curso?.titulo || "Sin título"}
            </span>
            <span className={styles.modalMeta}>
              {(seleccion?.resolucion || configuracion?.resolucion) && (
                <>Resolución: {seleccion?.resolucion || configuracion?.resolucion} · </>
              )}
              Estado:{" "}
              <strong>
                {configuracion?.estadoConfiguracion ||
                  seleccion?.estadoConfiguracion ||
                  "borrador"}
              </strong>
            </span>
          </div>
        }
        footer={
          <div className={styles.modalPie}>
            <p className={styles.notaGuardado}>
              Podés emitir certificados individualmente o de forma masiva y
              descargar en PDF los certificados que ya fueron emitidos.
            </p>

            {/* Acción primaria. No emite al pulsarlo: abre la confirmación. */}
            <button
              type="button"
              className={styles.botonPrimario}
              onClick={() => setConfirmarEmisionMasivaVisible(true)}
              disabled={
                emitiendoMasivo || cargando || cantidadPendientesEmision === 0
              }
              title="Crea los certificados oficiales de los participantes aprobados que todavía no tienen uno. No genera el PDF."
            >
              {textoBotonEmisionMasiva}
            </button>

            {/* Reemplaza a la descarga masiva diaria. Un PDF con mil
                certificados no se puede repartir; ocho por región, sí. */}
            <button
              type="button"
              className={styles.botonSecundario}
              onClick={abrirDialogoSegmentos}
              disabled={
                !hayCertificadosEmitidos || operacionIncompatibleSegmentos
              }
              title={
                !hayCertificadosEmitidos
                  ? "Todavía no hay certificados emitidos para descargar por segmentos."
                  : "Genera y descarga los certificados ya emitidos, agrupados por departamento. No emite a nadie."
              }
            >
              Descarga por segmentos
            </button>

            <button
              className={emitir.botonQuitarCurso}
              onClick={quitarCurso}
              disabled={quitandoCurso || cargando}
              title="Elimina la configuración del certificado. El curso, los participantes y sus aprobaciones no se tocan."
            >
              {quitandoCurso ? "Eliminando…" : "Quitar curso de emisión"}
            </button>

            <button
              type="button"
              className={emitir.botonReiniciarEmisiones}
              onClick={() => setDialogoReinicioVisible(true)}
              disabled={
                reiniciandoEmisiones ||
                quitandoCurso ||
                cargando ||
                emitiendoMasivo ||
                Boolean(emitiendoUsuario) ||
                Boolean(descargandoUsuario) ||
                descargandoMasivo
              }
              title="Elimina los certificados emitidos de este curso, pero conserva su configuración y participantes."
            >
              Eliminar certificados emitidos
            </button>

            <button
              type="button"
              className={styles.botonSecundario}
              onClick={cerrarModalEmitir}
            >
              Cerrar
            </button>
          </div>
        }
      >
        {cargando && <p className={styles.estadoTexto}>Consultando…</p>}

        {!cargando && sinConfiguracion && (
          <p className={emitir.avisoBloqueante}>
            Este curso todavía no tiene configuración de certificado.
            Completala en la pestaña <strong>Configurar</strong> para poder
            previsualizar.
          </p>
        )}

        {error && <p className={styles.mensajeError}>{error}</p>}

        {!cargando && !error && (
          <>
            <div className={emitir.indicadores}>
            <div className={emitir.indicador}>
              <span className={emitir.indicadorNumero}>{resumen.aprobados}</span>
              <span className={emitir.indicadorEtiqueta}>Aprobados</span>
            </div>
            <div className={emitir.indicador}>
              <span className={emitir.indicadorNumero}>
                {resumen.identificados}
              </span>
              <span className={emitir.indicadorEtiqueta}>Identificados</span>
            </div>
            <div className={emitir.indicador}>
              <span className={emitir.indicadorNumero}>
                {resumen.sinUsuario}
              </span>
              <span className={emitir.indicadorEtiqueta}>Sin usuario</span>
            </div>
            <div className={emitir.indicador}>
              <span className={emitir.indicadorNumero}>
                {resumen.excluidos}
              </span>
              <span className={emitir.indicadorEtiqueta}>Excluidos</span>
            </div>
          </div>

          {/* Segunda fila: reparto por condición sindical.
              Va en su propia grilla y no dentro de la anterior: con siete
              tarjetas en un grid de cuatro columnas, la segunda fila quedaría
              de 4 + 3 y desbalanceada. */}
          <div className={emitir.indicadoresAfiliacion}>
            {/* El más importante para operar: son los que hay que revisar
                antes de emitir. Se distingue con un acento, no con una alerta:
                mismo tamaño que las demás. */}
            <div
              className={`${emitir.indicador} ${emitir.indicadorNoHabilitado}`}
            >
              <span className={emitir.indicadorNumero}>
                {resumenAfiliacion.adherentesNoHabilitados}
              </span>
              <span className={emitir.indicadorEtiqueta}>
                Adherentes no habilitados
              </span>
            </div>

            <div
              className={`${emitir.indicador} ${emitir.indicadorHabilitado}`}
            >
              <span className={emitir.indicadorNumero}>
                {resumenAfiliacion.adherentesHabilitados}
              </span>
              <span className={emitir.indicadorEtiqueta}>
                Adherentes habilitados
              </span>
            </div>

            <div
              className={`${emitir.indicador} ${emitir.indicadorCotizante}`}
            >
              <span className={emitir.indicadorNumero}>
                {resumenAfiliacion.cotizantes}
              </span>
              <span className={emitir.indicadorEtiqueta}>Cotizantes</span>
            </div>
          </div>

          <p className={emitir.notaIndicadores}>
            <strong>Aprobados</strong> es el total de aprobaciones académicas
            del curso y no cambia al quitar participantes de la emisión.
            Quitar a alguien sólo lo aparta de esta pantalla: su aprobación
            queda intacta.
          </p>

          {resumen.duplicados > 0 && (
            <p className={emitir.advertencia}>
              Se encontraron {resumen.documentosAprobacion} registros de
              aprobación para {resumen.aprobados}{" "}
              {resumen.aprobados === 1 ? "persona" : "personas"}. Cada persona
              aparece una sola vez en la lista.
            </p>
          )}

          {resumen.truncado && (
            <p className={emitir.advertencia}>
              Se alcanzó el máximo de registros consultados. Puede haber
              aprobados sin mostrar.
            </p>
          )}

          {resumen.excluidos > 0 && (
            <p className={emitir.advertencia}>
              {resumen.excluidos}{" "}
              {resumen.excluidos === 1
                ? "participante fue apartado"
                : "participantes fueron apartados"}{" "}
              de la emisión de esta capacitación. Su aprobación y sus datos
              siguen intactos.
            </p>
          )}

          {/* Sin aprobados y "todos apartados" son situaciones distintas: la
              primera es que no se cargó el Excel, la segunda que alguien los
              quitó de la emisión. Decir lo primero cuando pasa lo segundo
              mandaría a buscar el problema al lugar equivocado. */}
          {participantes.length === 0 ? (
            <p className={styles.estadoTexto}>
              {resumen.aprobados === 0
                ? "Esta capacitación todavía no tiene aprobados cargados."
                : "No hay participantes disponibles para emitir. Todos los aprobados están apartados de la emisión."}
            </p>
          ) : (
            <>
              <label className={styles.campo}>
                <span className={styles.campoLabel}>Buscar participante</span>
                <input
                  type="search"
                  className={styles.input}
                  value={busqueda}
                  onChange={(e) => setBusqueda(e.target.value)}
                  placeholder="Apellido, nombre o DNI…"
                />
              </label>

              <p className={styles.ayuda}>
                {visibles.length} de {participantes.length}{" "}
                {participantes.length === 1 ? "participante" : "participantes"}.
              </p>

              {visibles.length === 0 ? (
                <p className={styles.estadoTexto}>
                  Ningún participante coincide con la búsqueda.
                </p>
              ) : (
                <>
                  {/* Escritorio: tabla. Móvil: tarjetas. Se alternan por CSS. */}
                  <div className={emitir.tablaWrap}>
                    <table className={emitir.tabla}>
                      <thead>
                        <tr>
                          <th>Apellido y nombre</th>
                          <th>DNI</th>
                          <th>Estado</th>
                          <th>Afiliado</th>
                          <th>Acciones</th>
                        </tr>
                      </thead>
                      <tbody>
                        {visibles.map((participante) => (
                          <tr key={participante.usuarioDocId}>
                            <td className={emitir.celdaNombre}>
                              {participante.apellidoNombre || "—"}
                            </td>
                            <td>{mostrarDni(participante.dni)}</td>
                            <td>
                              <span
                                className={`${emitir.estado} ${
                                  CLASE_ESTADO[participante.estado] || ""
                                }`}
                              >
                                {ETIQUETA_ESTADO[participante.estado] ||
                                  participante.estado}
                              </span>
                            </td>
                            <td>
                              <ChipAfiliacion afiliacion={participante.afiliacion} />
                            </td>
                            <td>
                              {esGestionable(participante) ? (
                                <div className={emitir.acciones}>
                                  <button
                                    type="button"
                                    className={emitir.botonPreview}
                                    onClick={() => abrirPreview(participante)}
                                    disabled={!puedePrevisualizar}
                                    title={
                                      puedePrevisualizar
                                        ? "Ver vista previa"
                                        : "Configurá el certificado primero"
                                    }
                                  >
                                    Preview certificado
                                  </button>

                                  <button
                                    type="button"
                                    className={emitir.botonPreview}
                                    onClick={() => descargarPdfIndividual(participante)}
                                    disabled={
                                      !estaEmitido(participante) ||
                                      !afiliacionHabilitada(participante) ||
                                      descargandoUsuario === participante.usuarioDocId
                                    }
                                    title={
                                      estaEmitido(participante) &&
                                      !afiliacionHabilitada(participante)
                                        ? participante.afiliacion?.motivoBloqueo ||
                                          "No habilitado para descargar certificados."
                                        : undefined
                                    }
                                  >
                                    {descargandoUsuario === participante.usuarioDocId ? "Descargando…" : "Descargar PDF"}
                                  </button>

                                  <button
                                    type="button"
                                    className={emitir.botonQuitar}
                                    onClick={() =>
                                      quitarParticipante(participante)
                                    }
                                    disabled={
                                      quitandoUsuario ===
                                        participante.usuarioDocId ||
                                      estaEmitido(participante)
                                    }
                                    title={
                                      estaEmitido(participante)
                                        ? MOTIVO_YA_EMITIDO
                                        : "Deja de aparecer para emitir. No borra al usuario ni su aprobación."
                                    }
                                  >
                                    {quitandoUsuario ===
                                    participante.usuarioDocId
                                      ? "Quitando…"
                                      : "Quitar de emisión"}
                                  </button>
                                </div>
                              ) : (
                                <span
                                  className={emitir.sinAcciones}
                                  title={MOTIVO_NO_GESTIONABLE}
                                >
                                  No gestionable
                                </span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <ul className={emitir.tarjetas}>
                    {visibles.map((participante) => (
                      <li
                        key={participante.usuarioDocId}
                        className={emitir.tarjeta}
                      >
                        <span className={emitir.tarjetaNombre}>
                          {participante.apellidoNombre || "—"}
                        </span>

                        <span className={emitir.tarjetaDato}>
                          DNI: {mostrarDni(participante.dni)}
                        </span>

                        <span
                          className={`${emitir.estado} ${
                            CLASE_ESTADO[participante.estado] || ""
                          }`}
                        >
                          {ETIQUETA_ESTADO[participante.estado] ||
                            participante.estado}
                        </span>

                        <ChipAfiliacion afiliacion={participante.afiliacion} />

                        {/* El motivo se explica en texto, no sólo con el botón
                            apagado: si no, no hay forma de saber por qué. */}
                        {!afiliacionHabilitada(participante) && (
                          <span className={emitir.tarjetaAviso}>
                            {participante.afiliacion?.motivoBloqueo ||
                              "No habilitado para emitir certificados."}
                          </span>
                        )}

                        {esGestionable(participante) ? (
                          <div className={emitir.acciones}>
                            <button
                              type="button"
                              className={emitir.botonPreview}
                              onClick={() => abrirPreview(participante)}
                              disabled={!puedePrevisualizar}
                            >
                              Preview certificado
                            </button>

                            <button
                              type="button"
                              className={emitir.botonPreview}
                              onClick={() => descargarPdfIndividual(participante)}
                              disabled={
                                !estaEmitido(participante) ||
                                !afiliacionHabilitada(participante) ||
                                descargandoUsuario === participante.usuarioDocId
                              }
                              title={
                                estaEmitido(participante) &&
                                !afiliacionHabilitada(participante)
                                  ? participante.afiliacion?.motivoBloqueo ||
                                    "No habilitado para descargar certificados."
                                  : undefined
                              }
                            >
                              {descargandoUsuario === participante.usuarioDocId ? "Descargando…" : "Descargar PDF"}
                            </button>

                            <button
                              type="button"
                              className={emitir.botonQuitar}
                              onClick={() => quitarParticipante(participante)}
                              disabled={
                                quitandoUsuario === participante.usuarioDocId ||
                                estaEmitido(participante)
                              }
                              title={
                                estaEmitido(participante)
                                  ? MOTIVO_YA_EMITIDO
                                  : undefined
                              }
                            >
                              {quitandoUsuario === participante.usuarioDocId
                                ? "Quitando…"
                                : "Quitar de emisión"}
                            </button>
                          </div>
                        ) : (
                          <p className={emitir.sinAccionesTarjeta}>
                            {MOTIVO_NO_GESTIONABLE}
                          </p>
                        )}
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </>
          )}

          {/* ---- Apartados de la emisión ----
              Bloque separado a propósito: no son candidatos a emitir, son
              personas cuya aprobación sigue vigente y que pueden reincorporarse.
              Mezclarlos con los disponibles invitaría a intentar emitirles. */}
          {participantesExcluidos.length > 0 && (
            <section className={emitir.bloqueApartados}>
              <h3 className={emitir.apartadosTitulo}>
                Participantes apartados de la emisión
              </h3>

              <p className={emitir.apartadosTexto}>
                Estos participantes conservan su aprobación. Podés recuperarlos
                para que vuelvan a estar disponibles para emitir.
              </p>

              <div className={emitir.tablaWrap}>
                <table className={emitir.tabla}>
                  <thead>
                    <tr>
                      <th>Apellido y nombre</th>
                      <th>DNI</th>
                      <th>Estado</th>
                      <th>Acción</th>
                    </tr>
                  </thead>
                  <tbody>
                    {participantesExcluidos.map((participante) => (
                      <tr key={participante.usuarioDocId}>
                        <td className={emitir.celdaNombre}>
                          {participante.apellidoNombre || "—"}
                        </td>
                        <td>{mostrarDni(participante.dni)}</td>
                        <td>
                          <span
                            className={`${emitir.estado} ${emitir.estadoApartado}`}
                          >
                            {ETIQUETA_ESTADO[participante.estado] ||
                              participante.estado}
                          </span>
                        </td>
                        <td>
                          <button
                            type="button"
                            className={emitir.botonRecuperar}
                            onClick={() => recuperarParticipante(participante)}
                            disabled={
                              recuperandoUsuario === participante.usuarioDocId
                            }
                            title="Vuelve a estar disponible para emitir. Su aprobación nunca se eliminó."
                          >
                            {recuperandoUsuario === participante.usuarioDocId
                              ? "Recuperando…"
                              : "Recuperar para emisión"}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <ul className={emitir.tarjetas}>
                {participantesExcluidos.map((participante) => (
                  <li key={participante.usuarioDocId} className={emitir.tarjeta}>
                    <span className={emitir.tarjetaNombre}>
                      {participante.apellidoNombre || "—"}
                    </span>

                    <span className={emitir.tarjetaDato}>
                      DNI: {mostrarDni(participante.dni)}
                    </span>

                    <span className={`${emitir.estado} ${emitir.estadoApartado}`}>
                      {ETIQUETA_ESTADO[participante.estado] ||
                        participante.estado}
                    </span>

                    <button
                      type="button"
                      className={emitir.botonRecuperar}
                      onClick={() => recuperarParticipante(participante)}
                      disabled={
                        recuperandoUsuario === participante.usuarioDocId
                      }
                    >
                      {recuperandoUsuario === participante.usuarioDocId
                        ? "Recuperando…"
                        : "Recuperar para emisión"}
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          )}
          </>
        )}
      </Dialog>

      <CertificadoPreview
        abierto={Boolean(participantePreview)}
        participante={participantePreview}
        configuracion={configuracion}
        /* La condición de afiliación SE SUMA a las que ya existían: datos
           incompletos, ya emitido, configuración y pedido en curso siguen
           valiendo igual. El preview en sí no se bloquea —mirar no es
           emitir—, sólo el botón que crea el certificado. */
        puedeEmitir={
          esEmitible(participantePreview) &&
          afiliacionHabilitada(participantePreview) &&
          !consultandoEmisionUsuario &&
          (validacionMinisterioPreview?.valid !== false)
        }
        motivoNoEmitir={
          participantePreview?.estado === "datos_incompletos"
            ? MOTIVO_DATOS_INCOMPLETOS
            : !afiliacionHabilitada(participantePreview)
            ? participantePreview?.afiliacion?.motivoBloqueo ||
              "No se pudo verificar la condición de afiliación."
            : validacionMinisterioPreview?.errores?.[0] || ""
        }
        emitiendo={emitiendoUsuario === participantePreview?.usuarioDocId}
        emitido={Boolean(emisionPreview) || estaEmitido(participantePreview)}
        consultandoEmision={Boolean(consultandoEmisionUsuario)}
        emision={emisionPreview}
        firmas={firmasMinisterioPreview}
        onEmitir={() => emitirParticipante(participantePreview)}
        onCerrar={() => setParticipantePreview(null)}
      />

      {/* Descarga por segmentos geográficos.

          Ocho tarjetas, un PDF por clic. Nunca se generan todas juntas: cada
          generación es una ejecución del Job, y ocho simultáneas serían ocho
          veces el trabajo sin que nadie las haya pedido. */}
      <Dialog
        visible={dialogoSegmentosVisible}
        onHide={() => setDialogoSegmentosVisible(false)}
        modal
        blockScroll
        draggable={false}
        className={emitir.dialogoSegmentos}
        breakpoints={{ "1024px": "96vw", "768px": "96vw" }}
        header="Descarga de certificados por segmentos"
        footer={
          <div className={emitir.pieConfirmacion}>
            <button
              type="button"
              className={styles.botonSecundario}
              onClick={() => setDialogoSegmentosVisible(false)}
            >
              Cerrar
            </button>

            <button
              type="button"
              className={styles.botonSecundario}
              onClick={cargarSegmentos}
              disabled={cargandoSegmentos}
            >
              {cargandoSegmentos ? "Actualizando…" : "Actualizar"}
            </button>
          </div>
        }
      >
        <p className={emitir.segmentosSubtitulo}>
          Generá y descargá los certificados agrupados por departamento.
        </p>

        {errorSegmentos ? (
          <p className={styles.mensajeError}>{errorSegmentos}</p>
        ) : cargandoSegmentos && !segmentos.length ? (
          <p className={styles.notaGuardado}>Cargando segmentos…</p>
        ) : (
          <div className={emitir.segmentosGrilla}>
            {segmentos.map((segmento) => {
              const trabajo = trabajosSegmento[segmento.id] || null;
              const enCurso = pdfEnCurso(trabajo);
              const listo = pdfCompletado(trabajo);
              const fallo = pdfConError(trabajo);

              // Un segmento sin certificados descargables no tiene PDF que
              // generar. La planilla, en cambio, sigue teniendo sentido: es
              // justamente donde se ve por qué no hay ninguno.
              const sinCertificados =
                Number(segmento.certificadosDescargables || 0) === 0;

              const iniciando = segmentoIniciando === segmento.id;

              return (
                <article key={segmento.id} className={emitir.segmentoTarjeta}>
                  <header className={emitir.segmentoEncabezado}>
                    <h4 className={emitir.segmentoNombre}>{segmento.nombre}</h4>

                    <p className={emitir.segmentoDepartamentos}>
                      {segmento.departamentos?.length
                        ? segmento.departamentos.join(" · ")
                        : "Departamento sin cargar o no reconocido"}
                    </p>
                  </header>

                  <dl className={emitir.segmentoCifras}>
                    <div>
                      <dt>Participantes</dt>
                      <dd>{Number(segmento.participantes || 0)}</dd>
                    </div>

                    <div>
                      <dt>Certificados descargables</dt>
                      <dd>{Number(segmento.certificadosDescargables || 0)}</dd>
                    </div>

                    <div>
                      <dt>Adherentes no habilitados</dt>
                      <dd className={emitir.segmentoCifraAviso}>
                        {Number(segmento.adherentesNoHabilitados || 0)}
                      </dd>
                    </div>
                  </dl>

                  {fallo && (
                    <p className={emitir.segmentoError}>
                      {trabajo?.error ||
                        "La generación falló. Podés volver a intentarla."}
                    </p>
                  )}

                  {enCurso && (
                    <div
                      className={emitir.barraProgreso}
                      role="progressbar"
                      aria-valuenow={Number(trabajo?.porcentaje || 0)}
                      aria-valuemin={0}
                      aria-valuemax={100}
                    >
                      <span
                        className={emitir.barraProgresoRelleno}
                        style={{ width: `${Number(trabajo?.porcentaje || 0)}%` }}
                      />
                    </div>
                  )}

                  <div className={emitir.segmentoAcciones}>
                    {listo ? (
                      <>
                        <button
                          type="button"
                          className={styles.botonPrimario}
                          onClick={() => bajarPdfSegmento(segmento.id)}
                          disabled={segmentoBajando === segmento.id}
                        >
                          {segmentoBajando === segmento.id
                            ? "Descargando…"
                            : "Descargar PDF"}
                        </button>

                        {/* Regenerar existe porque el conjunto de emitidos
                            cambia: un PDF de ayer ya no lo representa. */}
                        <button
                          type="button"
                          className={styles.botonSecundario}
                          onClick={() => generarPdfSegmento(segmento.id)}
                          disabled={iniciando || sinCertificados}
                        >
                          {iniciando ? "Iniciando…" : "Regenerar"}
                        </button>
                      </>
                    ) : (
                      <button
                        type="button"
                        className={styles.botonPrimario}
                        onClick={() => generarPdfSegmento(segmento.id)}
                        disabled={enCurso || iniciando || sinCertificados}
                        title={
                          sinCertificados
                            ? "No hay certificados emitidos y habilitados en este segmento."
                            : undefined
                        }
                      >
                        {enCurso
                          ? `Generando ${Number(
                              trabajo?.procesados || 0
                            )} de ${Number(trabajo?.total || 0)} — ${Number(
                              trabajo?.porcentaje || 0
                            )} %`
                          : sinCertificados
                          ? "Sin certificados disponibles"
                          : fallo
                          ? "Reintentar PDF"
                          : "Generar PDF"}
                      </button>
                    )}

                    <button
                      type="button"
                      className={styles.botonSecundario}
                      onClick={() => descargarExcelSegmento(segmento)}
                      disabled={
                        segmentoExcel === segmento.id ||
                        Number(segmento.participantes || 0) === 0
                      }
                      title="Planilla de control: incluye también a los adherentes no habilitados, que no salen en el PDF."
                    >
                      {segmentoExcel === segmento.id
                        ? "Generando…"
                        : "Descargar Excel"}
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </Dialog>

      {/* Progreso del PDF masivo. Los tiempos los calcula el Job y viajan en
          el documento del trabajo: acá no se inventa ninguna estimación. */}
      <Dialog
        visible={dialogoPdfVisible}
        onHide={() => setDialogoPdfVisible(false)}
        modal
        blockScroll
        draggable={false}
        style={{ width: "min(520px, 94vw)" }}
        breakpoints={{ "768px": "96vw" }}
        header={
          pdfConError(trabajoPdf)
            ? "No se pudo generar el PDF masivo"
            : pdfCompletado(trabajoPdf)
            ? "PDF masivo listo"
            : "Generando PDF masivo"
        }
        footer={
          <div className={emitir.pieConfirmacion}>
            <button
              type="button"
              className={styles.botonSecundario}
              onClick={() => setDialogoPdfVisible(false)}
            >
              {pdfEnCurso(trabajoPdf) ? "Seguir en segundo plano" : "Cerrar"}
            </button>

            {pdfConError(trabajoPdf) && (
              <button
                type="button"
                className={styles.botonPrimario}
                onClick={reintentarPdfMasivo}
              >
                Reintentar
              </button>
            )}

            {pdfCompletado(trabajoPdf) && (
              <button
                type="button"
                className={styles.botonPrimario}
                onClick={bajarPdfTerminado}
                disabled={bajandoArchivoPdf}
              >
                {bajandoArchivoPdf ? "Descargando…" : "Descargar PDF"}
              </button>
            )}
          </div>
        }
      >
        {pdfConError(trabajoPdf) ? (
          <p className={styles.mensajeError}>
            {trabajoPdf?.error ||
              "La generación falló. Podés reintentarla; se creará un trabajo nuevo."}
          </p>
        ) : (
          <>
            <div
              className={emitir.barraProgreso}
              role="progressbar"
              aria-valuenow={Number(trabajoPdf?.porcentaje || 0)}
              aria-valuemin={0}
              aria-valuemax={100}
            >
              <span
                className={emitir.barraProgresoRelleno}
                style={{ width: `${Number(trabajoPdf?.porcentaje || 0)}%` }}
              />
            </div>

            <p className={emitir.progresoCifras}>
              <strong>{Number(trabajoPdf?.porcentaje || 0)} %</strong>
              <span>
                {Number(trabajoPdf?.procesados || 0)} de{" "}
                {Number(trabajoPdf?.total || 0)} certificados
              </span>
            </p>

            <dl className={emitir.resumenConfirmacion}>
              <div>
                <dt>Tiempo transcurrido</dt>
                <dd>{formatearDuracion(trabajoPdf?.transcurridoMs)}</dd>
              </div>

              {/* El Job no informa tiempo restante hasta tener muestra
                  suficiente; hasta entonces no se muestra la fila. */}
              {trabajoPdf?.restanteEstimadoMs !== null &&
                trabajoPdf?.restanteEstimadoMs !== undefined && (
                  <div>
                    <dt>Tiempo restante aproximado</dt>
                    <dd>{formatearDuracion(trabajoPdf.restanteEstimadoMs)}</dd>
                  </div>
                )}

              {formatearHora(trabajoPdf?.finalizacionEstimada) && (
                <div>
                  <dt>Finalización estimada</dt>
                  <dd>{formatearHora(trabajoPdf.finalizacionEstimada)}</dd>
                </div>
              )}
            </dl>

            {pdfEnCurso(trabajoPdf) && (
              <p className={styles.notaGuardado}>
                Podés cerrar esta ventana: la generación sigue en el servidor y
                al volver al curso vas a encontrar el progreso donde está.
              </p>
            )}
          </>
        )}
      </Dialog>

      {/* Confirmación. La emisión crea documentos irreversibles, así que nunca
          se dispara con un solo clic. */}
      <Dialog
        visible={confirmarEmisionMasivaVisible}
        onHide={() => {
          if (emitiendoMasivo) return;
          setConfirmarEmisionMasivaVisible(false);
        }}
        modal
        blockScroll
        closeOnEscape={!emitiendoMasivo}
        dismissableMask={false}
        draggable={false}
        style={{ width: "min(520px, 94vw)" }}
        breakpoints={{ "768px": "96vw" }}
        header="Confirmar emisión masiva"
        footer={
          <div className={emitir.pieConfirmacion}>
            <button
              type="button"
              className={styles.botonSecundario}
              onClick={() => setConfirmarEmisionMasivaVisible(false)}
              disabled={emitiendoMasivo}
            >
              Cancelar
            </button>
            <button
              type="button"
              className={styles.botonPrimario}
              onClick={emitirMasivamente}
              disabled={emitiendoMasivo || cantidadPendientesEmision === 0}
            >
              {textoBotonEmisionMasiva}
            </button>
          </div>
        }
      >
        <dl className={emitir.resumenConfirmacion}>
          <div>
            <dt>Curso</dt>
            <dd>{curso?.titulo || "Sin título"}</dd>
          </div>
          <div>
            <dt>Pendientes de emitir</dt>
            <dd>{cantidadPendientesEmision}</dd>
          </div>
          <div>
            <dt>Ya emitidos</dt>
            <dd>{cantidadYaEmitidos}</dd>
          </div>
        </dl>

        <p className={styles.notaGuardado}>
          Se emitirán certificados oficiales para todos los participantes
          aprobados y elegibles que todavía no tengan una emisión vigente. Cada
          certificado tendrá su propio código de validación.
        </p>

        {emitiendoMasivo && (
          <div className={emitir.operationProgress} role="status" aria-live="polite">
            <div className={emitir.operationProgressHeader}>
              <span>Emitiendo certificados...</span>
              <strong>Procesando solicitud</strong>
            </div>
            <ProgressBar
              mode="indeterminate"
              className={emitir.operationProgressBar}
            />
            <small>No cierres esta ventana hasta finalizar el proceso.</small>
          </div>
        )}
      </Dialog>

      <Dialog
        visible={dialogoReinicioVisible}
        onHide={() => {
          if (!reiniciandoEmisiones) setDialogoReinicioVisible(false);
        }}
        modal
        blockScroll
        closeOnEscape={!reiniciandoEmisiones}
        dismissableMask={false}
        draggable={false}
        style={{ width: "min(560px, 94vw)" }}
        breakpoints={{ "768px": "96vw" }}
        header="Eliminar certificados emitidos"
        footer={
          <div className={emitir.pieConfirmacion}>
            <button
              type="button"
              className={styles.botonSecundario}
              onClick={() => setDialogoReinicioVisible(false)}
              disabled={reiniciandoEmisiones}
            >
              Cancelar
            </button>
            <button
              type="button"
              className={emitir.botonReiniciarConfirmacion}
              onClick={reiniciarEmisiones}
              disabled={reiniciandoEmisiones}
            >
              {reiniciandoEmisiones ? "Eliminando…" : "Eliminar y reiniciar"}
            </button>
          </div>
        }
      >
        <p className={styles.notaGuardado}>
          Esta acción eliminará los certificados emitidos de esta capacitación
          y permitirá generarlos nuevamente con la configuración actual.
        </p>
        <p className={styles.notaGuardado}>
          Los códigos QR y tokens de los certificados eliminados dejarán de ser
          válidos. La configuración del certificado, firmantes y participantes
          no será eliminada.
        </p>

        {reiniciandoEmisiones && (
          <div className={emitir.operationProgress} role="status" aria-live="polite">
            <div className={emitir.operationProgressHeader}>
              <span>Eliminando certificados emitidos...</span>
            </div>
            <ProgressBar
              mode="indeterminate"
              className={emitir.operationProgressBar}
            />
            <small>Esto puede demorar unos segundos.</small>
          </div>
        )}

        <dl className={emitir.resumenConfirmacion}>
          <div>
            <dt>Curso</dt>
            <dd>{curso?.titulo || "Sin título"}</dd>
          </div>
          <div>
            <dt>Cantidad de certificados emitidos</dt>
            <dd>{cantidadYaEmitidos}</dd>
          </div>
        </dl>
      </Dialog>

      {/* Resumen posterior. Se muestra siempre, incluso sin errores, para que
          quede claro qué pasó con cada grupo. */}
      <Dialog
        visible={Boolean(resultadoEmisionMasiva)}
        onHide={() => setResultadoEmisionMasiva(null)}
        modal
        blockScroll
        draggable={false}
        style={{ width: "min(560px, 94vw)" }}
        breakpoints={{ "768px": "96vw" }}
        header="Emisión masiva completada"
        footer={
          <div className={emitir.pieConfirmacion}>
            <button
              type="button"
              className={styles.botonSecundario}
              onClick={() => setResultadoEmisionMasiva(null)}
            >
              Cerrar
            </button>
          </div>
        }
      >
        {resultadoEmisionMasiva && (
          <>
            <dl className={emitir.resumenConfirmacion}>
              <div>
                <dt>Emitidos ahora</dt>
                <dd>{resultadoEmisionMasiva.emitidos}</dd>
              </div>
              <div>
                <dt>Ya emitidos previamente</dt>
                <dd>{resultadoEmisionMasiva.yaEmitidos}</dd>
              </div>
              <div>
                <dt>Omitidos</dt>
                <dd>
                  {resultadoEmisionMasiva.omitidos.apartados +
                    resultadoEmisionMasiva.omitidos.datosIncompletos +
                    resultadoEmisionMasiva.omitidos.sinUsuario}
                </dd>
              </div>
              <div>
                <dt>Errores</dt>
                <dd>{resultadoEmisionMasiva.errores.length}</dd>
              </div>
            </dl>

            {resultadoEmisionMasiva.errores.length > 0 && (
              <section className={emitir.erroresMasiva}>
                <h3 className={emitir.erroresMasivaTitulo}>
                  No se pudieron emitir
                </h3>
                <ul className={emitir.erroresMasivaLista}>
                  {resultadoEmisionMasiva.errores.map((fallo) => (
                    <li key={fallo.usuarioDocId}>
                      <strong>
                        {fallo.apellidoNombre || fallo.usuarioDocId}
                      </strong>
                      <span>{fallo.mensaje}</span>
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </>
        )}
      </Dialog>
    </>
  );
};

export default EmitirCertificados;
