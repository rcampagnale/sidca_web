import { normalizeSearchText, textValue } from "./titularizacionNormalizer";

/**
 * Pesos deliberadamente explícitos para el cruce Etapa 2.
 * Los tres campos fuertes pesan 75% y los complementarios 25%.
 */
export const MATCH_WEIGHTS = {
  establecimiento: 0.3,
  horas: 0.2,
  cargo: 0.25,
  materia: 0.1,
  nivel: 0.075,
  cursoAnio: 0.075,
};

export const MATCH_THRESHOLDS = {
  posible: 0.45,
  confirmada: 0.8,
  margenAmbiguedad: 0.1,
  margenCompetencia: 0.08,
};

const STRONG_FIELDS = ["establecimiento", "horas", "cargo"];
const MATCH_FIELDS = Object.keys(MATCH_WEIGHTS);

const comparableText = (value) =>
  normalizeSearchText(value)
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const comparableHours = (value) => {
  const normalized = textValue(value).replace(",", ".").trim();
  const numbers = normalized.match(/\d+(?:\.\d+)?/g);
  return numbers ? numbers.join(" ") : comparableText(value);
};

const fieldSimilarity = (left, right, field) => {
  const leftValue = field === "horas" ? comparableHours(left) : comparableText(left);
  const rightValue = field === "horas" ? comparableHours(right) : comparableText(right);

  if (!leftValue || !rightValue) return 0;
  if (leftValue === rightValue) return 1;
  if (leftValue.includes(rightValue) || rightValue.includes(leftValue)) return 0.86;

  const leftTokens = new Set(leftValue.split(" ").filter(Boolean));
  const rightTokens = new Set(rightValue.split(" ").filter(Boolean));
  const intersection = [...leftTokens].filter((token) => rightTokens.has(token)).length;
  const union = new Set([...leftTokens, ...rightTokens]).size;

  return union && intersection ? 0.7 * (intersection / union) : 0;
};

export const compareSituations = (solicitud = {}, presentada = {}) => {
  let denominator = 0;
  let score = 0;
  let strongMatches = 0;
  const razones = [];
  const diferencias = [];

  MATCH_FIELDS.forEach((field) => {
    const left = textValue(solicitud[field]);
    const right = textValue(presentada[field]);
    const hasData = Boolean(left || right);
    if (!hasData) return;

    const similarity = fieldSimilarity(left, right, field);
    denominator += MATCH_WEIGHTS[field];
    score += similarity * MATCH_WEIGHTS[field];

    if (similarity >= 0.85) {
      razones.push(`${field}: coincide`);
      if (STRONG_FIELDS.includes(field)) strongMatches += 1;
    } else if (similarity >= 0.6) {
      razones.push(`${field}: coincide parcialmente`);
    } else {
      diferencias.push(`${field}: "${left || "—"}" ≠ "${right || "—"}"`);
    }
  });

  const normalizedScore = denominator ? score / denominator : 0;

  return {
    matchScore: Number(normalizedScore.toFixed(4)),
    razones,
    diferencias,
    strongMatches,
  };
};

const sortCandidates = (candidates) =>
  [...candidates].sort((a, b) => b.matchScore - a.matchScore);

const candidateIsConfirmable = (candidate, runnerUp, bestForRow) => {
  const margin = runnerUp ? candidate.matchScore - runnerUp.matchScore : 1;
  const rowMargin = bestForRow ? candidate.matchScore - bestForRow.matchScore : 1;

  return (
    candidate.matchScore >= MATCH_THRESHOLDS.confirmada &&
    candidate.strongMatches >= 2 &&
    margin >= MATCH_THRESHOLDS.margenAmbiguedad &&
    rowMargin >= MATCH_THRESHOLDS.margenAmbiguedad
  );
};

/**
 * Cruza sólo situaciones del mismo DNI y reserva cada fila/situación una vez.
 * Las candidatas ambiguas no se fuerzan: se devuelven como revisión.
 */
export const matchSituationsOneToOne = (situaciones = [], filas = []) => {
  const candidatesBySituation = new Map();
  const candidatesByRow = new Map();

  situaciones.forEach((situacion) => candidatesBySituation.set(situacion.id, []));
  filas.forEach((fila) => candidatesByRow.set(fila.recordKey, []));

  situaciones.forEach((situacion) => {
    filas.forEach((fila) => {
      const comparison = compareSituations(situacion, fila.valuesNormalized);
      if (comparison.matchScore < MATCH_THRESHOLDS.posible) return;

      const candidate = {
        situacionId: situacion.id,
        recordKey: fila.recordKey,
        ...comparison,
      };

      candidatesBySituation.get(situacion.id).push(candidate);
      candidatesByRow.get(fila.recordKey).push(candidate);
    });
  });

  candidatesBySituation.forEach((candidates, key) => {
    candidatesBySituation.set(key, sortCandidates(candidates));
  });
  candidatesByRow.forEach((candidates, key) => {
    candidatesByRow.set(key, sortCandidates(candidates));
  });

  const assignments = new Map();
  const usedRows = new Set();
  const remainingSituations = sortCandidates(
    [...candidatesBySituation.entries()]
      .map(([situacionId, candidates]) =>
        candidates[0] ? { situacionId, ...candidates[0] } : null
      )
      .filter(Boolean)
  );

  remainingSituations.forEach((best) => {
    if (assignments.has(best.situacionId) || usedRows.has(best.recordKey)) return;

    const candidates = candidatesBySituation.get(best.situacionId) || [];
    const runnerUp = candidates[1];
    const bestForRow = candidatesByRow.get(best.recordKey)?.[1];

    if (candidateIsConfirmable(best, runnerUp, bestForRow)) {
      assignments.set(best.situacionId, {
        ...best,
        matchStatus: "confirmada",
      });
      usedRows.add(best.recordKey);
    }
  });

  remainingSituations.forEach((best) => {
    if (assignments.has(best.situacionId) || usedRows.has(best.recordKey)) return;

    const rowCandidates = candidatesByRow.get(best.recordKey) || [];
    const competitor = rowCandidates.find((candidate) => candidate.situacionId !== best.situacionId);
    const hasCloseCompetition =
      competitor &&
      Math.abs(best.matchScore - competitor.matchScore) <= MATCH_THRESHOLDS.margenCompetencia;

    if (hasCloseCompetition) return;

    assignments.set(best.situacionId, {
      ...best,
      matchStatus: "posible",
    });
    usedRows.add(best.recordKey);
  });

  const situationResults = situaciones.map((situacion) => {
    const assignment = assignments.get(situacion.id);
    const candidates = candidatesBySituation.get(situacion.id) || [];
    const best = candidates[0] || null;

    if (assignment) {
      return {
        situacion,
        ...assignment,
        tipoInconsistencia: assignment.matchStatus === "confirmada" ? "" : "revision",
      };
    }

    if (best) {
      return {
        situacion,
        recordKey: null,
        matchStatus: "revision",
        matchScore: best.matchScore,
        razones: best.razones,
        diferencias: best.diferencias,
        tipoInconsistencia: "revision",
      };
    }

    return {
      situacion,
      recordKey: null,
      matchStatus: null,
      matchScore: null,
      razones: [],
      diferencias: [],
      tipoInconsistencia: "omision_sidca",
    };
  });

  const usedSituationIds = new Set(assignments.keys());
  const rowResults = filas.map((fila) => {
    const assignment = [...assignments.values()].find(
      (item) => item.recordKey === fila.recordKey
    );
    const rowCandidates = candidatesByRow.get(fila.recordKey) || [];

    if (assignment) {
      return {
        fila,
        matchStatus: assignment.matchStatus,
        matchScore: assignment.matchScore,
        razones: assignment.razones,
        diferencias: assignment.diferencias,
        situacionIdVinculada: assignment.situacionId,
        tipoInconsistencia: assignment.matchStatus === "confirmada" ? "" : "revision",
      };
    }

    const linkedCandidate = rowCandidates.find((candidate) =>
      usedSituationIds.has(candidate.situacionId)
    );
    const reviewCandidate = linkedCandidate || rowCandidates[0];

    return {
      fila,
      matchStatus: reviewCandidate ? "revision" : null,
      matchScore: reviewCandidate?.matchScore || null,
      razones: reviewCandidate?.razones || [],
      diferencias: reviewCandidate?.diferencias || [],
      situacionIdVinculada: null,
      tipoInconsistencia: reviewCandidate ? "revision" : "presentada_sin_solicitud_vinculada",
    };
  });

  return { situationResults, rowResults };
};
