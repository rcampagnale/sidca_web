import { auth } from "../firebase/firebase-config";
import { getAdminIdToken } from "../utils/adminSession";

const API_BACKEND_ROOT_URL = String(
  process.env.REACT_APP_CERTIFICADOS_API_BASE_URL || ""
)
  .trim()
  .replace(/\/+$/, "")
  .replace(/\/api\/certificados$/, "");

const MENSAJES_POR_ESTADO = {
  400: "Los datos enviados no son válidos.",
  401: "Tu sesión expiró. Iniciá sesión nuevamente.",
  403: "No tenés autorización para enviar notificaciones.",
  404: "No se encontró el servicio de notificaciones.",
  409: "La notificación no pudo procesarse.",
  500: "No se pudo enviar la notificación.",
};

const pedir = async (ruta, opciones = {}, permitirReintento = true) => {
  if (!API_BACKEND_ROOT_URL) {
    throw new Error(
      "Falta configurar REACT_APP_CERTIFICADOS_API_BASE_URL en el archivo .env."
    );
  }

  const token = await getAdminIdToken(auth, {
    forzarRefresco: !permitirReintento,
  });

  let respuesta;
  try {
    respuesta = await fetch(`${API_BACKEND_ROOT_URL}${ruta}`, {
      ...opciones,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
        ...(opciones.headers || {}),
      },
    });
  } catch (error) {
    throw Object.assign(new Error("No se pudo conectar con el servidor."), {
      status: 0,
    });
  }

  const datos = await respuesta.json().catch(() => null);
  if (respuesta.ok) return datos;

  if (respuesta.status === 401 && permitirReintento) {
    return pedir(ruta, opciones, false);
  }

  throw Object.assign(
    new Error(
      datos?.error ||
        MENSAJES_POR_ESTADO[respuesta.status] ||
        "No se pudo enviar la notificación."
    ),
    { status: respuesta.status, datos }
  );
};

export const enviarNotificacionPushPrueba = ({ token, title, body, data }) =>
  pedir("/api/push/test", {
    method: "POST",
    body: JSON.stringify({
      token: token.trim(),
      title: title.trim(),
      body: body.trim(),
      ...(data ? { data } : {}),
    }),
  });

export const enviarNotificacionPushMasiva = ({ title, body, data }) =>
  pedir("/api/push/broadcast", {
    method: "POST",
    body: JSON.stringify({
      title: title.trim(),
      body: body.trim(),
      data,
    }),
  });

export const crearNotificacionProgramada = ({ title, body, data, programadaParaIso, tipoOrigen, origenId = null }) =>
  pedir("/api/push/scheduled", {
    method: "POST",
    body: JSON.stringify({ title, body, data, programadaParaIso, tipoOrigen, origenId }),
  });

export const listarNotificacionesProgramadas = ({ estado } = {}) =>
  pedir(`/api/push/scheduled${estado ? `?estado=${encodeURIComponent(estado)}` : ""}`);

export const editarNotificacionProgramada = (id, cambios) =>
  pedir(`/api/push/scheduled/${encodeURIComponent(id)}`, {
    method: "PATCH",
    body: JSON.stringify(cambios),
  });

export const cancelarNotificacionProgramada = (id) =>
  pedir(`/api/push/scheduled/${encodeURIComponent(id)}/cancel`, { method: "POST", body: "{}" });

export const enviarNotificacionProgramadaAhora = (id) =>
  pedir(`/api/push/scheduled/${encodeURIComponent(id)}/send-now`, { method: "POST", body: "{}" });

export const enviarModalInformativoPrueba = ({
  token,
  titulo,
  descripcion,
  imagen = '',
  link = '',
  newsId = '',
}) => {
  return pedir("/api/push/test", {
    method: "POST",
    body: JSON.stringify({
      token: token.trim(),
      title: "SiDCa - Tu Sindicato",
      body: "Tenemos una nueva información para vos.",
      data: {
        type: "news_modal",
        titulo: titulo.trim(),
        descripcion: descripcion.trim(),
        imagen: imagen.trim(),
        link: link.trim(),
        newsId,
      },
    }),
  });
};
