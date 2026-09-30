// src/components/afiliados/utils/shared.js

const TIME_ZONE_SIDCA = "America/Argentina/Buenos_Aires";

const pad2 = (value) => String(value).padStart(2, "0");

const fechaValida = (year, month, day) => {
  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) return false;
  if (year < 1 || month < 1 || month > 12 || day < 1) return false;
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return day <= daysInMonth;
};

const parseHoraSidca = (value) => {
  const texto = String(value || "")
    .trim()
    .toLowerCase()
    .replace(/\./g, "")
    .replace(/\s+/g, " ");
  if (!texto) return { hour: 0, minute: 0, second: 0 };

  const match = texto.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(am|pm|a m|p m)?$/i);
  if (!match) return null;

  let hour = Number(match[1]);
  const minute = Number(match[2]);
  const second = Number(match[3] || 0);
  const meridiem = match[4]?.replace(" ", "").toLowerCase();
  if (minute > 59 || second > 59) return null;

  if (meridiem) {
    if (hour < 1 || hour > 12) return null;
    if (meridiem === "pm" && hour < 12) hour += 12;
    if (meridiem === "am" && hour === 12) hour = 0;
  } else if (hour > 23) {
    return null;
  }

  return { hour, minute, second };
};

const partesFechaArgentina = (date) => {
  const parts = new Intl.DateTimeFormat("es-AR", {
    timeZone: TIME_ZONE_SIDCA,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map(({ type, value }) => [type, value]));
  return {
    year: Number(values.year),
    month: Number(values.month),
    day: Number(values.day),
    hour: Number(values.hour),
    minute: Number(values.minute),
    second: Number(values.second),
    timestamp: date.getTime(),
  };
};

/**
 * Interpreta fechas nuevas y legacy sin permitir que Date normalice meses o
 * dias invalidos silenciosamente. Los valores ambiguos usan DD/MM/YYYY.
 */
export const parseFechaHoraSidca = (value) => {
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : partesFechaArgentina(value);
  }
  if (typeof value === "number") {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : partesFechaArgentina(date);
  }
  if (!value || typeof value !== "string") return null;

  const texto = value.trim().replace(/\u00a0/g, " ");
  if (!texto) return null;

  // ISO con zona: se conserva el instante y se muestra en horario argentino.
  if (/^\d{4}-\d{2}-\d{2}T.*(?:Z|[+-]\d{2}:?\d{2})$/i.test(texto)) {
    const date = new Date(texto);
    return Number.isNaN(date.getTime()) ? null : partesFechaArgentina(date);
  }

  const isoMatch = texto.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})(?:[T\s]+(.+))?$/);
  const slashMatch = texto.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})(?:[T\s]+(.+))?$/);
  let year;
  let month;
  let day;
  let horaTexto;

  if (isoMatch) {
    year = Number(isoMatch[1]);
    month = Number(isoMatch[2]);
    day = Number(isoMatch[3]);
    horaTexto = isoMatch[4];
  } else if (slashMatch) {
    const first = Number(slashMatch[1]);
    const second = Number(slashMatch[2]);
    year = Number(slashMatch[3]);
    if (year < 100) year += 2000;
    if (first > 12) {
      day = first;
      month = second;
    } else if (second > 12) {
      month = first;
      day = second;
    } else {
      day = first;
      month = second;
    }
    horaTexto = slashMatch[4];
  } else {
    return null;
  }

  if (!fechaValida(year, month, day)) return null;
  const hora = parseHoraSidca(horaTexto);
  if (!hora) return null;

  return {
    year,
    month,
    day,
    ...hora,
    timestamp: Date.UTC(year, month - 1, day, hora.hour, hora.minute, hora.second),
  };
};

/** Separa y normaliza una fecha a { fecha: "DD/MM/YYYY", hora: "HH:mm" }. */
export const splitFechaHora = (fechaStr) => {
  const parsed = parseFechaHoraSidca(fechaStr);
  if (!parsed) return { fecha: "", hora: "" };
  return {
    fecha: `${pad2(parsed.day)}/${pad2(parsed.month)}/${parsed.year}`,
    hora: `${pad2(parsed.hour)}:${pad2(parsed.minute)}`,
  };
};

/** Genera DD/MM/YYYY HH:mm en horario argentino para nuevos registros. */
export const formatFechaHoraSidca = (date = new Date()) => {
  const parsed = parseFechaHoraSidca(date);
  if (!parsed) return "";
  return `${pad2(parsed.day)}/${pad2(parsed.month)}/${parsed.year} ${pad2(parsed.hour)}:${pad2(parsed.minute)}`;
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

/** Convierte cualquier fecha SIDCA a timestamp (para ordenar). */
export const toTimestamp = (s) => {
  return parseFechaHoraSidca(s)?.timestamp || 0;
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

    // 🆕 Campos de votación
    mesaNro: clean(d.mesaNro) || clean(d.mesa) || "",
    lugarVotacion: clean(d.lugarVotacion) || "",

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
