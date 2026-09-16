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
  403: "No tenés autorización para resolver reafiliaciones.",
  404: "No se encontró la solicitud o el usuario histórico.",
  409: "La solicitud está en conflicto.",
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
    throw new Error(
      "No se pudo conectar con el servidor de certificados. Revisá tu conexión."
    );
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
        "No se pudo completar la operación."
    ),
    { status: respuesta.status, datos }
  );
};

export const aprobarReafiliacion = async (dni) =>
  pedir(`/api/reafiliaciones/${encodeURIComponent(dni)}/aprobar`, {
    method: "POST",
  });

export const rechazarReafiliacion = async (dni, observacion) =>
  pedir(`/api/reafiliaciones/${encodeURIComponent(dni)}/rechazar`, {
    method: "POST",
    body: JSON.stringify({ observacion }),
  });
