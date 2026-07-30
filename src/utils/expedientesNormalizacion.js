// src/utils/expedientesNormalizacion.js
//
// Normalización de expedientes, CUIL/DNI y dependencias para poder cruzar los
// datos de los PDF oficiales con lo que está cargado en Firestore.
//
// El problema que resuelve: un mismo expediente puede estar escrito de formas
// muy distintas según el origen.
//
//   En el PDF oficial:   "EX-2025-01872607- -CAT-DPRHED#MTPRH"
//                        (a veces cortado en dos líneas)
//   En Firestore:        "1872607/25"  o  "01872607/2025"  o  "1872607-25"
//
// Todas esas variantes tienen que reducirse a la MISMA clave comparable.

/* ══════════════════════════════════════════════
 * Helpers de texto
 * ══════════════════════════════════════════════ */

export const quitarAcentos = (valor) =>
  String(valor || "")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "");

export const limpiarTextoPlano = (valor) =>
  String(valor || "").trim().replace(/\s+/g, " ");

/* ══════════════════════════════════════════════
 * DOCUMENTO: CUIL → DNI
 * ══════════════════════════════════════════════ */

// Deja solo los dígitos. Nunca convierte a Number (se perderían ceros iniciales
// y los DNI de 7 dígitos quedarían mal).
export const normalizeCuil = (valor) => String(valor || "").replace(/\D/g, "");

// 27-39997511-0 → 39997511  (saca prefijo de género y dígito verificador)
// Solo aplica cuando hay exactamente 11 dígitos, que es el largo de un CUIL.
export const cuilToDni = (valor) => {
  const digitos = normalizeCuil(valor);
  if (digitos.length !== 11) return "";
  return digitos.slice(2, 10);
};

export const normalizeDni = (valor) => String(valor || "").replace(/\D/g, "");

// Acepta indistintamente CUIL o DNI y devuelve siempre el DNI como string.
// Devuelve "" si no llega a un DNI plausible (7 u 8 dígitos).
export const normalizeDocumento = (valor) => {
  const digitos = normalizeCuil(valor);
  if (!digitos) return "";

  // CUIL completo → extraer los 8 centrales
  if (digitos.length === 11) {
    const dni = cuilToDni(digitos);
    return dni.length >= 7 ? dni.replace(/^0+/, "") || dni : "";
  }

  // Ya venía como DNI
  if (digitos.length >= 7 && digitos.length <= 8) return digitos;

  // Algunos PDF traen el DNI con ceros a la izquierda
  const sinCeros = digitos.replace(/^0+/, "");
  if (sinCeros.length >= 7 && sinCeros.length <= 8) return sinCeros;

  return "";
};

export const documentoEsValido = (valor) => {
  const dni = normalizeDocumento(valor);
  return dni.length >= 7 && dni.length <= 8;
};

/* ══════════════════════════════════════════════
 * EXPEDIENTES
 * ══════════════════════════════════════════════ */

// Limpieza base: mayúsculas, sin saltos de línea, sin caracteres raros y sin
// los " - - " que deja el PDF cuando el campo viene vacío en el medio.
export const normalizeExpediente = (valor) =>
  quitarAcentos(String(valor || ""))
    .toUpperCase()
    .replace(/[\r\n]+/g, " ") // el PDF corta el expediente en varias líneas
    .replace(/[^A-Z0-9/#\-. ]/g, " ") // deja solo lo que puede formar parte del número
    .replace(/\s*-\s*/g, "-") // "01872607- -CAT" → "01872607--CAT"
    .replace(/-{2,}/g, "-") // "01872607--CAT" → "01872607-CAT"
    .replace(/\s+/g, " ")
    .trim();

// Busca un expediente dentro de un texto suelto (una fila del PDF, por ejemplo).
// Reconoce el formato GDE ("EX-2025-01872607-...") y el formato corto
// ("1872607/25", "01872607/2025", "1872607-25").
export const extraerExpedienteDesdeTexto = (texto) => {
  const limpio = normalizeExpediente(texto);
  if (!limpio) return "";

  // Formato GDE: EX-AAAA-NNNNNNNN(-resto opcional)
  const gde = limpio.match(/\bEX-(\d{4})-(\d{4,10})\b[^\s]*/);
  if (gde) {
    // Devolvemos el match completo (incluye -CAT-DPRHED#MTPRH si estaba)
    return gde[0];
  }

  // Formato corto: NNNNNNN/AA o NNNNNNN/AAAA o NNNNNNN-AA
  const corto = limpio.match(/\b(\d{3,10})\s*[/-]\s*(\d{2}|\d{4})\b/);
  if (corto) return `${corto[1]}/${corto[2]}`;

  return "";
};

// Normaliza un año de 2 o 4 dígitos a 2 dígitos ("2025" → "25", "25" → "25").
const anioCorto = (anio) => {
  const txt = String(anio || "").replace(/\D/g, "");
  if (txt.length === 4) return txt.slice(2);
  if (txt.length === 2) return txt;
  return "";
};

// CLAVE COMPARABLE. Es la pieza central del cruce: reduce cualquier variante a
// "numero/AA", sin ceros a la izquierda en el número.
//
//   "EX-2025-01872607-CAT-DPRHED#MTPRH" → "1872607/25"
//   "EX-2025-01872607"                  → "1872607/25"
//   "01872607/2025"                     → "1872607/25"
//   "1872607/25"                        → "1872607/25"
//   "1872607-25"                        → "1872607/25"
//
// Devuelve "" cuando no puede determinar número + año (no se debe comparar).
export const getExpedienteComparable = (valor) => {
  const limpio = normalizeExpediente(valor);
  if (!limpio) return "";

  // 1) Formato GDE: el año va primero y el número después
  const gde = limpio.match(/EX-(\d{4})-(\d{4,10})/);
  if (gde) {
    const anio = anioCorto(gde[1]);
    const numero = gde[2].replace(/^0+/, "") || gde[2];
    if (anio && numero) return `${numero}/${anio}`;
  }

  // 2) Formato corto: el número va primero y el año después
  const corto = limpio.match(/(\d{3,10})\s*[/-]\s*(\d{2}|\d{4})(?!\d)/);
  if (corto) {
    const numero = corto[1].replace(/^0+/, "") || corto[1];
    const anio = anioCorto(corto[2]);
    if (anio && numero) return `${numero}/${anio}`;
  }

  return "";
};

// Comparación estricta: solo devuelve true si AMBOS lados producen una clave
// válida y las claves son idénticas. Nunca usa includes() ni coincidencias
// parciales, para no finalizar el expediente equivocado.
export const expedientesCoinciden = (a, b) => {
  const claveA = getExpedienteComparable(a);
  const claveB = getExpedienteComparable(b);
  if (!claveA || !claveB) return false;
  return claveA === claveB;
};

export const expedienteEsValido = (valor) => !!getExpedienteComparable(valor);

/* ══════════════════════════════════════════════
 * DEPENDENCIA (Liquidación de Haberes)
 * ══════════════════════════════════════════════ */

export const normalizeDependencia = (valor) =>
  quitarAcentos(String(valor || ""))
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();

// Acepta las variantes reales que aparecen cargadas:
//   "Liquidación de haberes", "LIQUIDACION DE HABERES",
//   "Subsecretaría de Liquidación de Haberes"
export const esDependenciaLiquidacionHaberes = (valor) => {
  const limpio = normalizeDependencia(valor);
  if (!limpio) return false;
  return limpio.includes("liquidacion") && limpio.includes("haber");
};

/* ══════════════════════════════════════════════
 * CLAVES DE AGRUPACIÓN / IDEMPOTENCIA
 * ══════════════════════════════════════════════ */

// Un mismo docente + expediente puede venir repetido en el PDF (varios cargos,
// horas cátedra o plazas). Esta clave agrupa esas filas en un solo registro.
//   "39997511|1872607/25"
export const claveRegistroPdf = (documento, expediente) => {
  const dni = normalizeDocumento(documento);
  const exp = getExpedienteComparable(expediente);
  if (!dni || !exp) return "";
  return `${dni}|${exp}`;
};

// Clave determinística para no volver a finalizar lo mismo si se recarga el
// mismo PDF. Se guarda en el item de la carga masiva.
//   "39997511_1872607-25_finalizado"
export const claveIdempotenciaFinalizacion = (documento, expediente) => {
  const dni = normalizeDocumento(documento);
  const exp = getExpedienteComparable(expediente);
  if (!dni || !exp) return "";
  return `${dni}_${exp.replace("/", "-")}_finalizado`;
};

/* ══════════════════════════════════════════════
 * COMPARACIÓN DE NOMBRES (solo para advertir)
 * ══════════════════════════════════════════════ */

// Reduce un nombre a un conjunto de palabras comparables, para detectar que
// "PEREZ, Juan Carlos" y "Perez Juan" son probablemente la misma persona
// aunque no sean idénticos. Nunca se usa para identificar: solo para advertir.
const tokensNombre = (valor) =>
  quitarAcentos(String(valor || ""))
    .toUpperCase()
    .replace(/[^A-Z\s]/g, " ")
    .split(/\s+/)
    .filter((t) => t.length > 2);

export const nombresProbablementeIguales = (a, b) => {
  const ta = tokensNombre(a);
  const tb = tokensNombre(b);
  if (ta.length === 0 || tb.length === 0) return true; // sin datos, no advertimos

  const setB = new Set(tb);
  const comunes = ta.filter((t) => setB.has(t)).length;
  // Con 2 palabras en común (típicamente apellido + un nombre) lo damos por
  // coincidente; si solo hay 1 token en total, alcanza con ese.
  const minimo = Math.min(2, Math.min(ta.length, tb.length));
  return comunes >= minimo;
};
