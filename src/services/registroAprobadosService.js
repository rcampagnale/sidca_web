import { auth } from "../firebase/firebase-config";
import { validatorAuth } from "../firebase/firebaseCertificadosValidator";
import { getAdminIdToken } from "../utils/adminSession";

const API_BASE_URL = String(
  process.env.REACT_APP_CERTIFICADOS_API_BASE_URL || ""
)
  .trim()
  .replace(/\/+$/, "");

/**
 * Token de la sesión activa.
 *
 * forzarRefresco sólo se pide true desde el reintento ante un 401 (ver
 * pedir()): en el camino normal ambos orígenes usan el token en caché del
 * SDK, que sólo viaja a la red cuando está vencido de verdad.
 */
const obtenerToken = async (origenSesion, forzarRefresco = false) => {
  if (origenSesion === "validador") {
    if (!validatorAuth.currentUser) {
      throw new Error("La sesión del validador no está disponible.");
    }
    return validatorAuth.currentUser.getIdToken(forzarRefresco);
  }

  return getAdminIdToken(auth, { forzarRefresco });
};

/**
 * Ante un 401 reintenta UNA sola vez con el token refrescado: cubre el token
 * vencido entre la lectura y el envío. Sin bucles, el segundo intento ya no
 * reintenta.
 */
const pedir = async (ruta, origenSesion, permitirReintento = true) => {
  if (!API_BASE_URL) {
    throw new Error(
      "Falta configurar REACT_APP_CERTIFICADOS_API_BASE_URL en el archivo .env."
    );
  }

  let response;
  try {
    response = await fetch(`${API_BASE_URL}${ruta}`, {
      headers: {
        Authorization: `Bearer ${await obtenerToken(origenSesion, !permitirReintento)}`,
      },
    });
  } catch (error) {
    throw new Error("No se pudo conectar con el servidor de certificados.");
  }

  if (response.status === 401 && permitirReintento) {
    return pedir(ruta, origenSesion, false);
  }

  const data = await response.json().catch(() => null);
  if (!response.ok) {
    throw Object.assign(
      new Error(data?.error || "No se pudo cargar el registro de aprobados."),
      { status: response.status, data }
    );
  }
  return data;
};

export const listarRegistroAprobados = async (origenSesion) => {
  const data = await pedir("/registro-aprobados", origenSesion);
  return Array.isArray(data?.cursos) ? data.cursos : [];
};

export const obtenerRegistroAprobadosCurso = async (cursoId, origenSesion) => {
  const data = await pedir(
    `/registro-aprobados/${encodeURIComponent(cursoId)}`,
    origenSesion
  );
  return {
    curso: data?.curso || null,
    cantidad: Number(data?.cantidad) || 0,
    aprobados: Array.isArray(data?.aprobados) ? data.aprobados : [],
  };
};

