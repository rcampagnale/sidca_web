import { auth } from "../firebase/firebase-config";
import { validatorAuth } from "../firebase/firebaseCertificadosValidator";
import { getAdminIdToken } from "../utils/adminSession";

const API_BASE_URL = String(
  process.env.REACT_APP_CERTIFICADOS_API_BASE_URL || ""
)
  .trim()
  .replace(/\/+$/, "");

const obtenerToken = async (origenSesion) => {
  if (origenSesion === "validador") {
    if (!validatorAuth.currentUser) {
      throw new Error("La sesión del validador no está disponible.");
    }
    return validatorAuth.currentUser.getIdToken(true);
  }

  return getAdminIdToken(auth, { forzarRefresco: false });
};

const pedir = async (ruta, origenSesion) => {
  if (!API_BASE_URL) {
    throw new Error(
      "Falta configurar REACT_APP_CERTIFICADOS_API_BASE_URL en el archivo .env."
    );
  }

  let response;
  try {
    response = await fetch(`${API_BASE_URL}${ruta}`, {
      headers: { Authorization: `Bearer ${await obtenerToken(origenSesion)}` },
    });
  } catch (error) {
    throw new Error("No se pudo conectar con el servidor de certificados.");
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

