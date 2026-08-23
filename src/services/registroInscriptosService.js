import { validatorAuth } from "../firebase/firebaseCertificadosValidator";

const API_BASE_URL = String(process.env.REACT_APP_CERTIFICADOS_API_BASE_URL || "").trim().replace(/\/+$/, "");

/**
 * Token del validador.
 *
 * getIdToken(false) usa el token en caché del SDK de Firebase y sólo hace un
 * viaje de red cuando está vencido de verdad. Antes se pedía SIEMPRE con
 * getIdToken(true) — refresco forzado, un round-trip a los servidores de
 * Google en cada request, incluso con un token todavía válido por horas.
 *
 * El refresco forzado sigue existiendo, pero sólo como reintento ante un 401
 * real (ver pedirJson/pedirBinario).
 */
const tokenValidador = async (forzarRefresco = false) => {
  if (!validatorAuth.currentUser) throw new Error("La sesión del validador no está disponible.");
  return validatorAuth.currentUser.getIdToken(forzarRefresco);
};

/**
 * GET autenticado que devuelve JSON. Ante un 401 reintenta UNA sola vez con
 * el token refrescado: cubre el token vencido entre la lectura y el envío,
 * sin bucles.
 */
const pedirJson = async (ruta, permitirReintento = true) => {
  const token = await tokenValidador(!permitirReintento);
  const response = await fetch(`${API_BASE_URL}${ruta}`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (response.status === 401 && permitirReintento) {
    return pedirJson(ruta, false);
  }

  const data = await response.json().catch(() => null);
  if (!response.ok) {
    throw Object.assign(new Error(data?.error || "No se pudieron cargar las planillas."), { status: response.status });
  }
  return data;
};

/**
 * Igual que pedirJson, pero para una respuesta binaria (el archivo).
 *
 * El backend transmite el Excel por stream, lo que reduce su memoria y puede
 * iniciar el transporte antes. El navegador construye el Blob completo antes
 * de activar la descarga visible; para planillas pequeñas se conserva este
 * flujo autenticado y simple.
 */
const pedirBinario = async (ruta, permitirReintento = true) => {
  const token = await tokenValidador(!permitirReintento);
  const response = await fetch(`${API_BASE_URL}${ruta}`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (response.status === 401 && permitirReintento) {
    return pedirBinario(ruta, false);
  }

  if (!response.ok) {
    const data = await response.json().catch(() => null);
    throw Object.assign(new Error(data?.error || "No se pudo descargar la planilla."), { status: response.status });
  }
  return response.blob();
};

/**
 * Lista las planillas activas.
 *
 * `forzar` pide al backend que salte su caché de 45s (?forzar=true): lo usa
 * el botón "Actualizar", que debe traer el estado real, no el cacheado.
 */
export const listarRegistroInscriptosValidador = async (forzar = false) => {
  const data = await pedirJson(`/registro-inscriptos${forzar ? "?forzar=true" : ""}`);
  return Array.isArray(data?.cursos) ? data.cursos : [];
};

export const descargarPlanillaRegistroInscriptos = async (cursoId, archivo) => {
  const blob = await pedirBinario(
    `/registro-inscriptos/${encodeURIComponent(cursoId)}/${encodeURIComponent(archivo.archivoId)}/descargar`
  );
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = archivo.nombreOriginal || "planilla.xlsx";
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
};
