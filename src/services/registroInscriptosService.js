import { validatorAuth } from "../firebase/firebaseCertificadosValidator";

const API_BASE_URL = String(process.env.REACT_APP_CERTIFICADOS_API_BASE_URL || "").trim().replace(/\/+$/, "");

const tokenValidador = async () => {
  if (!validatorAuth.currentUser) throw new Error("La sesión del validador no está disponible.");
  return validatorAuth.currentUser.getIdToken(true);
};

export const listarRegistroInscriptosValidador = async () => {
  const response = await fetch(`${API_BASE_URL}/registro-inscriptos`, { headers: { Authorization: `Bearer ${await tokenValidador()}` } });
  const data = await response.json().catch(() => null);
  if (!response.ok) throw Object.assign(new Error(data?.error || "No se pudieron cargar las planillas."), { status: response.status });
  return Array.isArray(data?.cursos) ? data.cursos : [];
};

export const descargarPlanillaRegistroInscriptos = async (cursoId, archivo) => {
  const response = await fetch(`${API_BASE_URL}/registro-inscriptos/${encodeURIComponent(cursoId)}/${encodeURIComponent(archivo.archivoId)}/descargar`, { headers: { Authorization: `Bearer ${await tokenValidador()}` } });
  if (!response.ok) {
    const data = await response.json().catch(() => null);
    throw Object.assign(new Error(data?.error || "No se pudo descargar la planilla."), { status: response.status });
  }
  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = archivo.nombreOriginal || "planilla.xlsx";
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
};
