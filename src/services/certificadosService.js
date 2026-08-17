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
    { status: respuesta.status }
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
    firmas: (Array.isArray(datos?.firmas) ? datos.firmas : []).map(
      (firma, indice) => ({
        nombre: String(firma?.nombre || "").trim(),
        cargo: String(firma?.cargo || "").trim(),
        imagenUrl: String(firma?.imagenUrl || "").trim(),
        imagenPublicId: String(firma?.imagenPublicId || "").trim(),
        proveedor: String(firma?.proveedor || "cloudinary").trim(),
        orden: Number.isInteger(firma?.orden) ? firma.orden : indice + 1,
      })
    ),
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
      ? datos.participantes
      : [],
    // Apartados de la emisión. Conservan su aprobación y se recuperan con
    // reincluirUsuarioEmision().
    participantesExcluidos: Array.isArray(datos?.participantesExcluidos)
      ? datos.participantesExcluidos
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
