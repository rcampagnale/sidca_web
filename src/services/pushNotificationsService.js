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

export const enviarNotificacionPushPrueba = ({ token, title, body }) =>
  pedir("/api/push/test", {
    method: "POST",
    body: JSON.stringify({
      token: token.trim(),
      title: title.trim(),
      body: body.trim(),
      data: { type: "admin_push_test" },
    }),
  });
