import { normalizeDni, normalizeSearchText, textValue } from "./titularizacionNormalizer";

const MINISTRY_FIELDS = [
  ["cargo", "cargo"],
  ["establecimiento", "establecimiento"],
  ["organismo", "organismo"],
  ["materia", "materia"],
  ["horas", "horas"],
  ["nivel", "nivel"],
  ["cursoAnio", "cursoAnio"],
  ["division", "division"],
];

const normalized = (value) => normalizeSearchText(textValue(value));
const idPlazaFor = (record = {}) => textValue(record.idPlaza || record.externalIds?.ministryPlazaId).replace(/\s+/g, "").trim();

const semanticComparison = (ministryRecord, resolutionRecord) => {
  const comparisons = MINISTRY_FIELDS
    .map(([key, label]) => ({
      field: label,
      ministry: normalized(ministryRecord[key]),
      resolution: normalized(resolutionRecord[key]),
    }))
    .filter((item) => item.ministry && item.resolution);
  const matches = comparisons.filter((item) => item.ministry === item.resolution);
  return {
    comparedFields: comparisons.length,
    matchingFields: matches.length,
    fields: comparisons,
  };
};

/**
 * Vincula evidencia ministerial sólo entre registros del mismo DNI.
 * Nunca participa del Matcher Solicitud YHe ↔ Presentación SIDCA.
 */
export const matchMinistryEvidenceToResolution = ({ ministryRecord = {}, resolutionRecord = {} } = {}) => {
  const ministryDni = normalizeDni(ministryRecord.dni);
  const resolutionDni = normalizeDni(resolutionRecord.dni);
  if (!ministryDni || ministryDni !== resolutionDni) {
    return {
      matched: false,
      requiresReview: false,
      status: "NO_MATCH",
      reason: "dni_distinto_o_ausente",
      ministryDni,
      resolutionDni,
    };
  }

  const ministryIdPlaza = idPlazaFor(ministryRecord);
  const resolutionIdPlaza = idPlazaFor(resolutionRecord);
  if (ministryIdPlaza && resolutionIdPlaza) {
    if (ministryIdPlaza === resolutionIdPlaza) {
      return {
        matched: true,
        requiresReview: false,
        status: "EXACT_MINISTRY_LINK",
        reason: "dni_e_id_plaza_exactos",
        ministryDni,
        resolutionDni,
        idPlaza: resolutionIdPlaza,
      };
    }
    return {
      matched: false,
      requiresReview: true,
      status: "REVIEW",
      reason: "dni_igual_id_plaza_distinto",
      ministryDni,
      resolutionDni,
      ministryIdPlaza,
      resolutionIdPlaza,
      comparison: semanticComparison(ministryRecord, resolutionRecord),
    };
  }

  const comparison = semanticComparison(ministryRecord, resolutionRecord);
  const allComparedFieldsMatch = comparison.comparedFields > 0 &&
    comparison.matchingFields === comparison.comparedFields;
  return {
    matched: false,
    requiresReview: true,
    status: allComparedFieldsMatch ? "SEMANTIC_CANDIDATE" : "REVIEW",
    reason: ministryIdPlaza || resolutionIdPlaza
      ? "falta_id_plaza_en_una_fuente"
      : "sin_id_plaza_en_las_fuentes",
    ministryDni,
    resolutionDni,
    ministryIdPlaza,
    resolutionIdPlaza,
    comparison,
  };
};
