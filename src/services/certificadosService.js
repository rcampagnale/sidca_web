// src/services/certificadosService.js
//
// Único punto de acceso del frontend al módulo administrativo de
// certificados de sidca-chatbot-backend.
//
// Centraliza:
//   - la base URL (variable de entorno, nunca hardcodeada en las pantallas);
//   - la obtención del Firebase ID Token vigente;
//   - el header Authorization: Bearer;
//   - la traducción de errores HTTP a mensajes utilizables por la UI.
//
// IMPORTANTE: el token se pide siempre a Firebase con getIdToken(), que lo
// renueva solo cuando está por vencer. No se usa sessionStorage.accessToken
// como fuente permanente porque puede quedar vencido.
//
// Toda la lógica de sesión (esperar la inicialización de Firebase, comprobar
// que siga siendo admin, comprobar el vencimiento por inactividad y obtener
// el token) vive en utils/adminSession.js. Acá no se duplica nada: se llama a
// getAdminIdToken() y listo. Así cualquier operación protegida del módulo usa
// exactamente el mismo camino.

import { auth } from "../firebase/firebase-config";
import { getAdminIdToken } from "../utils/adminSession";

const API_BASE_URL = String(
  process.env.REACT_APP_CERTIFICADOS_API_BASE_URL || ""
)
  .trim()
  .replace(/\/+$/, "");

/** Token vigente del administrador. forzarRefresco pide uno nuevo. */
const obtenerIdToken = (forzarRefresco = false) =>
  getAdminIdToken(auth, { forzarRefresco });

/**
 * Mensajes por defecto cuando el backend no envía uno propio.
 */
const MENSAJES_POR_ESTADO = {
  400: "Los datos enviados no son válidos.",
  401: "Tu sesión expiró. Iniciá sesión nuevamente.",
  403: "No tenés autorización administrativa sobre certificados SIDCA.",
  404: "No se encontró el recurso solicitado.",
  409: "El recurso ya existe o está en conflicto.",
};

/**
 * Ejecuta un pedido autenticado contra el módulo de certificados.
 *
 * Ante un 401 reintenta una sola vez con el token refrescado: cubre el caso
 * del token vencido justo entre la lectura y el envío.
 */
const pedir = async (ruta, opciones = {}, permitirReintento = true) => {
  if (!API_BASE_URL) {
    throw new Error(
      "Falta configurar REACT_APP_CERTIFICADOS_API_BASE_URL en el archivo .env."
    );
  }

  const token = await obtenerIdToken(!permitirReintento);

  let respuesta;

  try {
    respuesta = await fetch(`${API_BASE_URL}${ruta}`, {
      ...opciones,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
        ...(opciones.headers || {}),
      },
    });
  } catch (error) {
    throw new Error(
      "No se pudo conectar con el servidor de certificados. Revisá tu conexión."
    );
  }

  // El backend responde JSON en todos sus casos previstos; si llega otra cosa
  // (por ejemplo una página de error de la infraestructura) no se rompe.
  let datos = null;
  try {
    datos = await respuesta.json();
  } catch (error) {
    datos = null;
  }

  if (respuesta.ok) return datos;

  if (respuesta.status === 401 && permitirReintento) {
    return pedir(ruta, opciones, false);
  }

  throw Object.assign(
    new Error(
      datos?.error ||
        MENSAJES_POR_ESTADO[respuesta.status] ||
        "No se pudo completar la operación."
    ),
    { status: respuesta.status, datos }
  );
};

/**
 * Lee la configuración de certificado de un curso.
 *
 * Devuelve null cuando todavía no existe (404 controlado del backend), para
 * que la pantalla pueda abrir un formulario nuevo sin tratarlo como error.
 */
export const obtenerConfiguracionCertificado = async (cursoId) => {
  try {
    const datos = await pedir(
      `/admin/configuracion/${encodeURIComponent(cursoId)}`,
      { method: "GET" }
    );
    return datos?.configuracion || null;
  } catch (error) {
    if (error.status === 404) return null;
    throw error;
  }
};

/**
 * Crea o actualiza la configuración de certificado del curso.
 *
 * Sólo se envían los campos documentales y las firmas: cursoTitulo,
 * estadoConfiguracion y la auditoría los resuelve el backend a partir del
 * curso real y del token verificado.
 */
export const guardarConfiguracionCertificado = async (cursoId, datos) => {
  const cuerpo = {
    titulo: String(datos?.titulo || "").trim(),
    resolucion: String(datos?.resolucion || "").trim(),
    cargaHoraria: String(datos?.cargaHoraria || "").trim(),
    dias: String(datos?.dias || "").trim(),
    fecha: String(datos?.fecha || "").trim(),
    modalidad: String(datos?.modalidad || "").trim(),

    // Determina la plantilla institucional. Se envía el valor semántico, no
    // el nombre del PNG: el asset es un detalle del frontend.
    institucionCertificado:
      datos?.institucionCertificado === "itm" ? "itm" : "sidca",

    // Autoridades en TEXTO, hasta cuatro renglones. Nada de imagenUrl,
    // imagenPublicId, proveedor ni plantillas: el modelo de firmas con imagen
    // quedó fuera del flujo.
    autoridades: (Array.isArray(datos?.autoridades) ? datos.autoridades : [])
      .slice(0, 2)
      .map((autoridad, indice) => ({
        nombre: String(autoridad?.nombre || "").trim(),
        cargo: String(autoridad?.cargo || "").trim(),
        organismo: String(autoridad?.organismo || "").trim(),
        referencia: String(autoridad?.referencia || "").trim(),
        orden: indice + 1,
      })),
  };

  const respuesta = await pedir(
    `/admin/configuracion/${encodeURIComponent(cursoId)}`,
    {
      method: "PUT",
      body: JSON.stringify(cuerpo),
    }
  );

  return respuesta?.configuracion || null;
};

/**
 * Lista las capacitaciones que YA tienen configuración de certificado.
 *
 * Es la fuente de la pestaña Emitir. No devuelve la colección "cursos" ni los
 * documentos históricos de "certificados": el backend filtra por la presencia
 * de cursoId, que sólo escribe el módulo nuevo.
 */
export const obtenerConfiguracionesCertificado = async () => {
  const datos = await pedir("/admin/configuraciones", { method: "GET" });

  return Array.isArray(datos?.configuraciones) ? datos.configuraciones : [];
};

/**
 * Lee los aprobados reales de una capacitación.
 *
 * La fuente es el importador de Excel existente: las aprobaciones viven en
 * usuarios/{usuarioDocId}/cursos con { aprobo: true, curso: "cursos/{id}" }.
 * El backend resuelve el usuario padre, normaliza el DNI y deduplica; el
 * frontend no envía DNI ni decide quién está aprobado.
 *
 * Un 404 acá significa que el CURSO no existe. "Sin aprobados" es un 200 con
 * participantes vacío, no un error.
 */
export const obtenerAprobadosCurso = async (cursoId) => {
  const datos = await pedir(`/admin/aprobados/${encodeURIComponent(cursoId)}`, {
    method: "GET",
  });

  return {
    curso: datos?.curso || null,
    resumen: datos?.resumen || {
      documentosAprobacion: 0,
      aprobados: 0,
      identificados: 0,
      sinUsuario: 0,
      datosIncompletos: 0,
      duplicados: 0,
    },
    participantes: Array.isArray(datos?.participantes)
      ? datos.participantes.map((participante) => ({
          ...participante,
          certificadoEmitido: participante?.certificadoEmitido === true,
        }))
      : [],
    // Apartados de la emisión. Conservan su aprobación y se recuperan con
    // reincluirUsuarioEmision().
    participantesExcluidos: Array.isArray(datos?.participantesExcluidos)
      ? datos.participantesExcluidos.map((participante) => ({
          ...participante,
          certificadoEmitido: participante?.certificadoEmitido === true,
        }))
      : [],
  };
};

/**
 * Aparta a un participante de la emisión de certificados.
 *
 * NO borra al usuario, ni su aprobación, ni ningún registro académico: el
 * backend sólo agrega el usuarioDocId a certificados/{cursoId}.usuariosExcluidos.
 * Es reversible con reincluirUsuarioEmision().
 */
export const excluirUsuarioEmision = async (cursoId, usuarioDocId) => {
  const datos = await pedir(
    `/admin/emision/${encodeURIComponent(cursoId)}/excluir-usuario`,
    {
      method: "PUT",
      body: JSON.stringify({ usuarioDocId }),
    }
  );

  return Array.isArray(datos?.usuariosExcluidos) ? datos.usuariosExcluidos : [];
};

/** Reincorpora a un participante apartado. */
export const reincluirUsuarioEmision = async (cursoId, usuarioDocId) => {
  const datos = await pedir(
    `/admin/emision/${encodeURIComponent(cursoId)}/reincluir-usuario`,
    {
      method: "PUT",
      body: JSON.stringify({ usuarioDocId }),
    }
  );

  return Array.isArray(datos?.usuariosExcluidos) ? datos.usuariosExcluidos : [];
};

/**
 * Busca el certificado VIGENTE ya emitido para un participante y curso.
 *
 * Devuelve la emisión completa (token, urlValidacion y los snapshots) o null
 * si todavía no fue emitido. El 404 del backend no es un error: es la
 * respuesta normal para alguien sin emitir, así que se traduce a null y la
 * pantalla lo trata como "disponible para emitir".
 *
 * Es la que permite que el QR siga apareciendo después de recargar la página:
 * el estado en memoria se pierde, pero la emisión sigue en Firestore.
 */
export const obtenerEmisionVigenteCertificado = async (
  cursoId,
  usuarioDocId
) => {
  try {
    const datos = await pedir(
      `/admin/emision/${encodeURIComponent(cursoId)}/usuario/${encodeURIComponent(
        usuarioDocId
      )}`,
      { method: "GET" }
    );

    return datos?.emision || null;
  } catch (error) {
    if (error?.status === 404) return null;
    throw error;
  }
};

export const obtenerCertificadosEmitidosCurso = async (cursoId) => {
  const datos = await pedir(
    `/admin/emision/${encodeURIComponent(cursoId)}/emitidos`,
    { method: "GET" }
  );
  return Array.isArray(datos?.emisiones) ? datos.emisiones : [];
};

/**
 * Emite el certificado de UN participante.
 *
 * Lo único que viaja es usuarioDocId: a quién emitir. El backend vuelve a
 * verificar todo por su cuenta —aprobación real, exclusiones, existencia del
 * usuario, datos completos, doble emisión— y arma el snapshot con los datos
 * que él mismo lee de Firestore. Nada de lo que muestra esta pantalla llega
 * al documento emitido.
 *
 * Devuelve el objeto `emision` con certificadoId, token y urlValidacion.
 * Todavía no se usan para nada visual: el QR y el PDF vienen después.
 */
export const emitirCertificado = async (cursoId, usuarioDocId) => {
  const datos = await pedir(
    `/admin/emision/${encodeURIComponent(cursoId)}/emitir`,
    {
      method: "POST",
      body: JSON.stringify({
        usuarioDocId: String(usuarioDocId || "").trim(),
      }),
    }
  );

  return datos?.emision || null;
};

/**
 * Emite de una sola vez a todos los aprobados elegibles que todavía no tienen
 * certificado vigente.
 *
 * NO viaja ninguna lista de participantes: sólo el cursoId, en la URL. Quién
 * corresponde emitir lo decide el backend releyendo el padrón, no lo que esta
 * pantalla tenga cargado. Manda por el mismo `pedir()` que el resto, así que
 * usa el Firebase ID Token administrativo de siempre; no hay una segunda
 * autenticación.
 *
 * NO genera el PDF masivo: eso es `iniciarPdfMasivo`, que sólo lee lo ya
 * emitido.
 *
 * Devuelve el resumen: emitidos, yaEmitidos, candidatos, omitidos y errores.
 * Nunca tokens ni URLs de validación.
 */
export const emitirCertificadosMasivamente = async (cursoId) => {
  const datos = await pedir(
    `/admin/emision/${encodeURIComponent(cursoId)}/emitir-masivo`,
    { method: "POST" }
  );

  return {
    emitidos: Number(datos?.emitidos || 0),
    yaEmitidos: Number(datos?.yaEmitidos || 0),
    candidatos: Number(datos?.candidatos || 0),
    totalAprobados: Number(datos?.totalAprobados || 0),
    omitidos: {
      apartados: Number(datos?.omitidos?.apartados || 0),
      datosIncompletos: Number(datos?.omitidos?.datosIncompletos || 0),
      sinUsuario: Number(datos?.omitidos?.sinUsuario || 0),
    },
    errores: Array.isArray(datos?.errores) ? datos.errores : [],
  };
};

/**
 * Comprueba la autenticidad y la vigencia de un certificado emitido.
 *
 * Es SÓLO LECTURA: el backend no toca Firestore, únicamente lee el emitido y
 * responde qué encontró.
 *
 * Del QR viajan nada más que los dos datos que identifican el documento; la
 * URL completa no se envía. Quien decide si el certificado es auténtico es el
 * backend, nunca el formato del código escaneado.
 *
 * Devuelve el objeto `validacion` con `valido`, `estado`, `participante`,
 * `certificado` y `emitidoEn`. Un 404 —código inexistente— se propaga como
 * error con `status: 404` para que la pantalla lo distinga de un certificado
 * real que fue anulado.
 */
export const validarCertificadoQR = async (cursoId, token) => {
  const datos = await pedir(
    `/validar/${encodeURIComponent(cursoId)}/${encodeURIComponent(token)}`,
    { method: "GET" }
  );

  return datos?.validacion ? { ...datos.validacion, verificacion: datos.verificacion || null } : null;
};

export const obtenerValidadoresCertificados = async () => {
  const datos = await pedir("/admin/validadores", { method: "GET" });
  return Array.isArray(datos?.validadores) ? datos.validadores : [];
};

export const buscarUsuariosValidadores = async (busqueda) => {
  const datos = await pedir(`/admin/validadores/buscar?q=${encodeURIComponent(busqueda)}`, { method: "GET" });
  return Array.isArray(datos?.usuarios) ? datos.usuarios : [];
};

export const obtenerAccesoValidadorCertificados = async (usuarioDocId) => {
  const datos = await pedir(`/admin/validadores/${encodeURIComponent(usuarioDocId)}/acceso`, { method: "GET" });
  return datos?.acceso || datos;
};

export const autorizarValidadorCertificados = async (usuarioDocId, body = {}) => {
  const datos = await pedir(`/admin/validadores/${encodeURIComponent(usuarioDocId)}`, { method: "PUT", body: JSON.stringify(body) });
  return datos?.usuario || datos;
};

export const quitarValidadorCertificados = async (usuarioDocId) => {
  const datos = await pedir(`/admin/validadores/${encodeURIComponent(usuarioDocId)}`, { method: "DELETE" });
  return datos;
};

export const listarRegistroInscriptosAdmin = async (cursoId) => {
  const datos = await pedir(`/admin/registro-inscriptos/${encodeURIComponent(cursoId)}`, { method: "GET" });
  return Array.isArray(datos?.archivos) ? datos.archivos : [];
};

export const listarRegistroInscriptosGlobalAdmin = async () => {
  const datos = await pedir("/registro-inscriptos", { method: "GET" });
  return Array.isArray(datos?.cursos) ? datos.cursos : [];
};

export const subirPlanillasRegistroInscriptos = async (cursoId, archivos) => {
  if (!Array.isArray(archivos) || !archivos.length || archivos.length > 10) throw new Error("Seleccioná entre 1 y 10 planillas.");
  const token = await obtenerIdToken();
  const form = new FormData();
  archivos.forEach((archivo) => form.append("archivos", archivo));
  const response = await fetch(`${API_BASE_URL}/admin/registro-inscriptos/${encodeURIComponent(cursoId)}`, { method: "POST", headers: { Authorization: `Bearer ${token}` }, body: form });
  const datos = await response.json().catch(() => null);
  if (!response.ok) throw Object.assign(new Error(datos?.error || "No se pudieron subir las planillas."), { status: response.status });
  return Array.isArray(datos?.archivos) ? datos.archivos : [];
};

export const eliminarPlanillaRegistroInscriptos = async (cursoId, archivoId) => {
  const datos = await pedir(`/admin/registro-inscriptos/${encodeURIComponent(cursoId)}/${encodeURIComponent(archivoId)}`, { method: "DELETE" });
  return datos;
};

export const descargarPlanillaRegistroInscriptosAdmin = async (cursoId, archivo) => {
  const token = await obtenerIdToken();
  const response = await fetch(`${API_BASE_URL}/registro-inscriptos/${encodeURIComponent(cursoId)}/${encodeURIComponent(archivo.archivoId)}/descargar`, { headers: { Authorization: `Bearer ${token}` } });
  if (!response.ok) { const data = await response.json().catch(() => null); throw new Error(data?.error || "No se pudo descargar la planilla."); }
  const blob = await response.blob(); const url = URL.createObjectURL(blob); const anchor = document.createElement("a"); anchor.href = url; anchor.download = archivo.nombreOriginal || "planilla.xlsx"; document.body.appendChild(anchor); anchor.click(); anchor.remove(); URL.revokeObjectURL(url);
};

/** Registra la auditoría de una validación realizada por un administrador. */
export const registrarValidacionCertificado = async (cursoId, token) => {
  const datos = await pedir(`/validar/${encodeURIComponent(cursoId)}/${encodeURIComponent(token)}/registrar`, {
    method: "POST",
  });
  return datos?.registro || datos;
};

/**
 * Elimina la configuración de certificado de un curso.
 *
 * Borra únicamente el documento certificados/{cursoId}. El curso académico,
 * los usuarios y sus aprobaciones quedan intactos: el backend no los toca.
 *
 * Efecto: el curso desaparece de Emitir y vuelve a aparecer en Configurar
 * como curso sin configurar, listo para configurarse de nuevo.
 */
export const eliminarConfiguracionCertificado = async (cursoId) => {
  const datos = await pedir(
    `/admin/configuracion/${encodeURIComponent(cursoId)}`,
    { method: "DELETE" }
  );

  return datos?.eliminado === true;
};

/**
 * Aparta la capacitación completa de la emisión sin borrar nada.
 *
 * Sin uso desde que "Quitar curso de emisión" elimina la configuración.
 * Se conserva por si hace falta ocultar sin perder los datos.
 */
export const ocultarCursoEmision = async (cursoId) => {
  const datos = await pedir(
    `/admin/emision/${encodeURIComponent(cursoId)}/ocultar`,
    { method: "PUT" }
  );

  return datos?.ocultarEnEmitir === true;
};

/** Reincorpora la capacitación a la emisión. */
export const mostrarCursoEmision = async (cursoId) => {
  const datos = await pedir(
    `/admin/emision/${encodeURIComponent(cursoId)}/mostrar`,
    { method: "PUT" }
  );

  return datos?.ocultarEnEmitir === false;
};

/**
 * Comprobación de permisos administrativos. Útil para avisar al operador
 * antes de que intente guardar.
 */
export const verificarAdministradorCertificados = async () => {
  const datos = await pedir("/admin/health", { method: "GET" });
  return Boolean(datos?.administrador);
};

export const iniciarPdfMasivo = async (cursoId) => (await pedir(`/admin/pdf-masivo/${encodeURIComponent(cursoId)}/iniciar`, { method: "POST" }))?.trabajo || null;
export const obtenerEstadoPdfMasivo = async (cursoId, jobId) => (await pedir(`/admin/pdf-masivo/${encodeURIComponent(cursoId)}/${encodeURIComponent(jobId)}`, { method: "GET" }))?.trabajo || null;
export const obtenerPdfMasivoActual = async (cursoId) => (await pedir(`/admin/pdf-masivo/${encodeURIComponent(cursoId)}/actual`, { method: "GET" }))?.trabajo || null;
/**
 * Descarga el PDF ya generado.
 *
 * No usa `pedir()` porque la respuesta es binaria, pero manda el mismo ID
 * Token administrativo.
 *
 * El mensaje sale del backend cuando lo hay. Antes cualquier respuesta que no
 * fuera 200 —401, 403, 409, 500, 502— se traducía a "el PDF todavía no está
 * disponible", que en la mitad de los casos era falso y ocultaba la causa real
 * durante la depuración.
 */
export const descargarPdfMasivo = async (cursoId, jobId) => {
  const token = await obtenerIdToken();
  const response = await fetch(
    `${API_BASE_URL}/admin/pdf-masivo/${encodeURIComponent(cursoId)}/${encodeURIComponent(jobId)}/descargar`,
    { headers: { Authorization: `Bearer ${token}` } }
  );

  if (!response.ok) {
    const detalle = await response.json().catch(() => null);

    throw new Error(
      detalle?.error ||
        (response.status === 409
          ? "El PDF masivo todavía no está disponible."
          : `No se pudo descargar el PDF (error ${response.status}).`)
    );
  }

  return response.blob();
};

// ============================================================
// DESCARGA POR SEGMENTOS GEOGRÁFICOS
//
// La definición de los segmentos NO vive acá: la entrega el backend en
// /segmentos. Duplicar el mapa de departamentos en el frontend garantizaría
// que un día las dos copias dejen de coincidir.
// ============================================================

/** Los ocho segmentos con sus contadores. Siempre vienen los ocho. */
export const obtenerSegmentosPdf = async (cursoId) =>
  (
    await pedir(
      `/admin/pdf-segmentado/${encodeURIComponent(cursoId)}/segmentos`,
      { method: "GET" }
    )
  )?.segmentos || [];

export const iniciarPdfSegmento = async (cursoId, segmentoId) =>
  (
    await pedir(
      `/admin/pdf-segmentado/${encodeURIComponent(
        cursoId
      )}/${encodeURIComponent(segmentoId)}/iniciar`,
      { method: "POST" }
    )
  )?.trabajo || null;

export const obtenerEstadoPdfSegmento = async (cursoId, segmentoId, jobId) =>
  (
    await pedir(
      `/admin/pdf-segmentado/${encodeURIComponent(
        cursoId
      )}/${encodeURIComponent(segmentoId)}/${encodeURIComponent(jobId)}`,
      { method: "GET" }
    )
  )?.trabajo || null;

export const obtenerPdfSegmentoActual = async (cursoId, segmentoId) =>
  (
    await pedir(
      `/admin/pdf-segmentado/${encodeURIComponent(
        cursoId
      )}/${encodeURIComponent(segmentoId)}/actual`,
      { method: "GET" }
    )
  )?.trabajo || null;

/** Filas ya resueltas de la planilla de control. El Excel se arma en el navegador. */
export const obtenerDatosExcelSegmento = async (cursoId, segmentoId) =>
  pedir(
    `/admin/pdf-segmentado/${encodeURIComponent(cursoId)}/${encodeURIComponent(
      segmentoId
    )}/excel`,
    { method: "GET" }
  );

/** Igual que descargarPdfMasivo: binario, mismo ID Token, mismo trato de errores. */
export const descargarPdfSegmento = async (cursoId, segmentoId, jobId) => {
  const token = await obtenerIdToken();
  const response = await fetch(
    `${API_BASE_URL}/admin/pdf-segmentado/${encodeURIComponent(
      cursoId
    )}/${encodeURIComponent(segmentoId)}/${encodeURIComponent(
      jobId
    )}/descargar`,
    { headers: { Authorization: `Bearer ${token}` } }
  );

  if (!response.ok) {
    const detalle = await response.json().catch(() => null);

    throw new Error(
      detalle?.error ||
        (response.status === 409
          ? "El PDF de este segmento todavía no está disponible."
          : `No se pudo descargar el PDF (error ${response.status}).`)
    );
  }

  return response.blob();
};
