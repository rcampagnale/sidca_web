// src/components/afiliados/utils/shared.js

/** Separa "dd/mm/yyyy hh:mm:ss" en { fecha, hora } */
export const splitFechaHora = (fechaStr) => {
  if (!fechaStr || typeof fechaStr !== "string") return { fecha: "", hora: "" };
  const [f, h] = fechaStr.trim().split(" ");
  return { fecha: f || "", hora: h || "" };
};

export const clean = (v) => (typeof v === "string" ? v.trim() : v);

/** Deriva descuento en string ("si"/"no"/"") desde campos variados */
export const getDescuentoValue = (d) => {
  if (typeof d?.descuento === "string") return d.descuento.trim().toLowerCase();
  if (typeof d?.cotizante === "boolean") return d.cotizante ? "si" : "no";
  if (typeof d?.cotizante === "string")
    return d.cotizante.trim().toLowerCase();
  return "";
};

/** "si"/true -> "Sí" ; "no"/false -> "No" */
export const toSiNo = (v) => {
  if (typeof v === "string") {
    const s = v.trim().toLowerCase();
    if (s === "si" || s === "sí" || s === "true") return "Sí";
    if (s === "no" || s === "false") return "No";
  }
  if (typeof v === "boolean") return v ? "Sí" : "No";
  return "";
};

/** Normaliza entrada de descuento a "si" | "no" | "" */
export const normalizeDescuentoInput = (val) => {
  const s = (val ?? "").toString().trim().toLowerCase();
  if (["si", "sí", "true", "1"].includes(s)) return "si";
  if (["no", "false", "0"].includes(s)) return "no";
  return "";
};

/** Convierte "dd/mm/yyyy hh:mm:ss" a timestamp (para ordenar) */
export const toTimestamp = (s) => {
  if (!s || typeof s !== "string") return 0;
  const raw = s.trim().replace(/-/g, "/");
  const [dmy, hms = "00:00:00"] = raw.split(" ");
  if (!dmy) return 0;
  const [d, m, y] = dmy.split("/").map((n) => parseInt(n, 10));
  const parts = hms.split(":").map((n) => parseInt(n, 10) || 0);
  const [hh = 0, mm = 0, ss = 0] = parts;
  const dt = new Date(y, (m || 1) - 1, d || 1, hh, mm, ss);
  return isNaN(dt.getTime()) ? 0 : dt.getTime();
};

/** Normaliza strings para búsqueda: minúsculas + sin tildes */
export const norm = (s) =>
  (s ?? "")
    .toString()
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "");

/**
 * Normaliza un documento de "nuevoAfiliado" a fila de tabla.
 * Aplana campos comunes, setea defaults y prepara valores usados en UI.
 */
export const toRow = (d) => {
  const { fecha: f, hora: h } = splitFechaHora(d.fecha);
  return {
    id: d.id,
    fecha: f,
    hora: h,
    nombre: clean(d.nombre) || "",
    apellido: clean(d.apellido) || "",
    dni: clean(d.dni) || "",
    nroAfiliacion: Number(d.nroAfiliacion ?? 1),
    departamento: clean(d.departamento) || "",
    establecimientos: clean(d.establecimientos) || "",
    celular: clean(d.celular) || "",
    email: clean(d.email) || clean(d["correo electrónico"]) || "",
    tituloGrado: clean(d.tituloGrado) || "",
    cod: d.cod ?? "",
    descuento: getDescuentoValue(d),
    observaciones: clean(d.observaciones) || "",
    activo: typeof d.activo === "boolean" ? d.activo : true,
    // compat: muchos datasets usan "adherente" o infieren desde "activo"
    adherente: (d.adherente ?? d.activo) === true,
  };
};

/** Crea opciones únicas de departamentos (para Dropdown) desde un array de filas */
export function departamentosOptionsFrom(rows) {
  const map = new Map();
  rows.forEach((r) => {
    const val = (r.departamento || "").toString().trim();
    const key = norm(val);
    if (val && key && !map.has(key)) map.set(key, val);
  });
  return Array.from(map.values())
    .sort((a, b) => a.localeCompare(b))
    .map((v) => ({ label: v, value: v }));
}
