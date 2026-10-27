import { normalizeSearchText, textValue } from "./titularizacionNormalizer";

/** Pesos vigentes del cruce Etapa 2. No se redistribuyen en Matcher V2. */
export const MATCH_WEIGHTS = {
  establecimiento: 0.3,
  horas: 0.2,
  cargo: 0.25,
  materia: 0.1,
  nivel: 0.075,
  cursoAnio: 0.075,
};

export const TOTAL_WEIGHT = Object.values(MATCH_WEIGHTS).reduce(
  (total, weight) => total + weight,
  0
).toFixed(4) * 1;

export const AUTO_CONFIRM_MIN_COVERAGE = 0.7;

export const MATCH_THRESHOLDS = {
  posible: 0.45,
  confirmada: 0.8,
  margenAmbiguedad: 0.1,
  margenCompetencia: 0.08,
};

export const STRONG_FIELDS = ["establecimiento", "horas", "cargo"];
export const MATCH_FIELDS = Object.keys(MATCH_WEIGHTS);

const comparableText = (value) =>
  normalizeSearchText(value)
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

/** Convierte sólo horas inequívocamente simples; no suma texto compuesto. */
export const parseHours = (value) => {
  const raw = textValue(value).trim();
  if (!raw) return { raw, simpleNumeric: false, value: null };

  const normalized = raw.replace(",", ".");
  const simpleMatch = normalized.match(/^\s*(\d+(?:\.\d+)?)\s*(?:hs?|horas?)?\s*$/i);
  if (!simpleMatch) return { raw, simpleNumeric: false, value: null };

  const numericValue = Number(simpleMatch[1]);
  return {
    raw,
    simpleNumeric: Number.isFinite(numericValue),
    value: Number.isFinite(numericValue) ? numericValue : null,
  };
};

const comparableHours = (value) => {
  const parsed = parseHours(value);
  return parsed.simpleNumeric ? String(parsed.value) : comparableText(value);
};

const comparableValue = (value, field) =>
  field === "horas" ? comparableHours(value) : comparableText(value);

const fieldSimilarity = (left, right, field) => {
  const leftValue = comparableValue(left, field);
  const rightValue = comparableValue(right, field);

  if (!leftValue || !rightValue) return 0;
  if (leftValue === rightValue) return 1;
  if (leftValue.includes(rightValue) || rightValue.includes(leftValue)) return 0.86;

  const leftTokens = new Set(leftValue.split(" ").filter(Boolean));
  const rightTokens = new Set(rightValue.split(" ").filter(Boolean));
  const intersection = [...leftTokens].filter((token) => rightTokens.has(token)).length;
  const union = new Set([...leftTokens, ...rightTokens]).size;

  return union && intersection ? 0.7 * (intersection / union) : 0;
};

const hasComparableData = (value, field) => Boolean(comparableValue(value, field));
const unique = (values) => [...new Set(values.filter(Boolean))];

const addReason = (reasons, reason) => {
  if (reason && !reasons.includes(reason)) reasons.push(reason);
};

/**
 * similarityScore = Σ(similitudCampo × pesoCampo) / comparableWeight.
 * fieldCoverage = comparableWeight / TOTAL_WEIGHT.
 * Un campo cuenta como comparable sólo si tiene datos en ambos lados.
 */
export const compareSituations = (solicitud = {}, presentada = {}) => {
  let comparableWeight = 0;
  let weightedSimilarity = 0;
  let strongMatches = 0;
  const matchedFields = [];
  const differentFields = [];
  const missingFields = [];
  const razones = [];
  const diferencias = [];

  MATCH_FIELDS.forEach((field) => {
    const left = textValue(solicitud[field]);
    const right = textValue(presentada[field]);
    const leftHasData = hasComparableData(left, field);
    const rightHasData = hasComparableData(right, field);

    if (!leftHasData || !rightHasData) {
      missingFields.push(field);
      return;
    }

    comparableWeight += MATCH_WEIGHTS[field];
    const similarity = fieldSimilarity(left, right, field);
    weightedSimilarity += similarity * MATCH_WEIGHTS[field];

    if (similarity >= 0.85) {
      matchedFields.push(field);
      razones.push(field + ": coincide");
      if (STRONG_FIELDS.includes(field)) strongMatches += 1;
    } else if (similarity >= 0.6) {
      razones.push(field + ": coincide parcialmente");
    } else {
      differentFields.push(field);
      diferencias.push(
        field + ': "' + (left || "—") + '" ≠ "' + (right || "—") + '"'
      );
    }
  });

  const similarityScore = comparableWeight
    ? Number((weightedSimilarity / comparableWeight).toFixed(4))
    : 0;
  const fieldCoverage = Number((comparableWeight / TOTAL_WEIGHT).toFixed(4));

  if (fieldCoverage < AUTO_CONFIRM_MIN_COVERAGE) {
    addReason(razones, "cobertura_insuficiente");
  }

  return {
    similarityScore,
    matchScore: similarityScore,
    fieldCoverage,
    comparableWeight: Number(comparableWeight.toFixed(4)),
    matchedFields,
    differentFields,
    missingFields,
    strongMatches,
    strongMatchedFields: matchedFields.filter((field) => STRONG_FIELDS.includes(field)),
    razones,
    diferencias,
  };
};

const candidateQuality = (candidate) =>
  candidate.similarityScore >= MATCH_THRESHOLDS.confirmada &&
  candidate.fieldCoverage >= AUTO_CONFIRM_MIN_COVERAGE &&
  candidate.strongMatches >= 2;

const candidateSort = (left, right) => {
  const leftAuto = left.autoConfirmEligible ? 1 : 0;
  const rightAuto = right.autoConfirmEligible ? 1 : 0;
  if (leftAuto !== rightAuto) return rightAuto - leftAuto;

  // Una fila rica no queda detrás de otra de score alto pero cobertura pobre.
  const leftQuality = left.confidenceFactors
    ? Number(left.confidenceFactors.scoreOk && left.confidenceFactors.coverageOk && left.confidenceFactors.strongFieldsOk)
    : 0;
  const rightQuality = right.confidenceFactors
    ? Number(right.confidenceFactors.scoreOk && right.confidenceFactors.coverageOk && right.confidenceFactors.strongFieldsOk)
    : 0;
  if (leftQuality !== rightQuality) return rightQuality - leftQuality;

  if (right.similarityScore !== left.similarityScore) {
    return right.similarityScore - left.similarityScore;
  }
  if (right.fieldCoverage !== left.fieldCoverage) {
    return right.fieldCoverage - left.fieldCoverage;
  }
  if (right.strongMatches !== left.strongMatches) {
    return right.strongMatches - left.strongMatches;
  }

  return (String(left.situacionId) + "|" + String(left.recordKey)).localeCompare(
    String(right.situacionId) + "|" + String(right.recordKey)
  );
};

const sortCandidates = (candidates) => [...candidates].sort(candidateSort);

/** El margen nunca reemplaza al discriminador de campos. */
export const evaluateDiscriminator = ({
  targetSituation = {},
  competingSituations = [],
  sourceRow = {},
} = {}) => {
  const competitors = (Array.isArray(competingSituations) ? competingSituations : [])
    .filter((situation) => situation && situation.id !== targetSituation.id);
  const competingSituationIds = competitors.map((situation) => situation.id).filter(Boolean);
  const required = competitors.length > 0;

  if (!required) {
    return {
      required: false,
      satisfied: true,
      distinguishingFields: [],
      decisiveFields: [],
      competingSituationIds,
      reasons: [],
    };
  }

  const distinguishingFields = MATCH_FIELDS.filter((field) => {
    const targetValue = comparableValue(targetSituation[field], field);
    if (!targetValue) return false;
    return competitors.some(
      (competitor) => {
        const competitorValue = comparableValue(competitor[field], field);
        return competitorValue && competitorValue !== targetValue;
      }
    );
  });

  const decisiveFields = distinguishingFields.filter((field) => {
    if (!hasComparableData(sourceRow[field], field)) return false;
    if (fieldSimilarity(targetSituation[field], sourceRow[field], field) < 0.85) return false;
    const populatedCompetitors = competitors.filter((competitor) =>
      hasComparableData(competitor[field], field)
    );
    return populatedCompetitors.length > 0 && populatedCompetitors.every(
      (competitor) => fieldSimilarity(competitor[field], sourceRow[field], field) < 0.85
    );
  });

  return {
    required: true,
    satisfied: decisiveFields.length > 0,
    distinguishingFields,
    decisiveFields,
    competingSituationIds,
    reasons: decisiveFields.length ? [] : ["sin_discriminador_suficiente"],
  };
};

const compatibleForGrouping = (left, right) =>
  fieldSimilarity(left?.establecimiento, right?.establecimiento, "establecimiento") >= 0.85 &&
  fieldSimilarity(left?.cargo, right?.cargo, "cargo") >= 0.85;

const combinationValues = (items, size, start = 0, current = [], result = []) => {
  if (current.length === size) {
    result.push([...current]);
    return result;
  }
  for (let index = start; index <= items.length - (size - current.length); index += 1) {
    current.push(items[index]);
    combinationValues(items, size, index + 1, current, result);
    current.pop();
  }
  return result;
};

const exactHoursSum = (items) => {
  const parsed = items.map((item) => parseHours(item));
  if (parsed.some((value) => !value.simpleNumeric)) return null;
  return parsed.reduce((total, value) => total + value.value, 0);
};

const exactGroupingSuggestion = (targetSituation, filas, occupiedRows) => {
  const targetHours = parseHours(targetSituation.horas);
  if (!targetHours.simpleNumeric) return null;

  const compatibleRows = filas
    .filter((fila) => !occupiedRows.has(fila.recordKey))
    .filter((fila) => compatibleForGrouping(targetSituation, fila.valuesNormalized))
    .filter((fila) => parseHours(fila.valuesNormalized?.horas).simpleNumeric)
    .sort((left, right) => String(left.recordKey).localeCompare(String(right.recordKey)))
    .slice(0, 12);

  for (const size of [2, 3]) {
    const combinations = combinationValues(compatibleRows, size);
    const match = combinations.find(
      (combination) =>
        exactHoursSum(combination.map((fila) => fila.valuesNormalized?.horas)) === targetHours.value
    );
    if (match) {
      return {
        cardinality: "1:N",
        candidateRows: match.map((fila) => fila.recordKey),
        reasons: ["posible_desagregacion_de_horas"],
      };
    }
  }
  return null;
};

const exactDesegregationSuggestion = (filas, situaciones, occupiedSituations) => {
  const suggestions = new Map();

  filas.forEach((fila) => {
    const rowHours = parseHours(fila.valuesNormalized?.horas);
    if (!rowHours.simpleNumeric) return;

    const compatibleSituations = situaciones
      .filter((situacion) => !occupiedSituations.has(situacion.id))
      .filter((situacion) => compatibleForGrouping(situacion, fila.valuesNormalized))
      .filter((situacion) => parseHours(situacion.horas).simpleNumeric)
      .sort((left, right) => String(left.id).localeCompare(String(right.id)))
      .slice(0, 12);

    for (const size of [2, 3]) {
      const combinations = combinationValues(compatibleSituations, size);
      const match = combinations.find(
        (combination) =>
          exactHoursSum(combination.map((situacion) => situacion.horas)) === rowHours.value
      );
      if (match) {
        suggestions.set(fila.recordKey, {
          cardinality: "N:1",
          candidateSituationIds: match.map((situacion) => situacion.id),
          reasons: ["posible_desagregacion_de_horas"],
        });
        return;
      }
    }
  });

  return suggestions;
};

const candidateReasons = (candidate, factors, cardinality) => {
  const reasons = [...candidate.razones];
  if (!factors.coverageOk) addReason(reasons, "cobertura_insuficiente");
  if (!factors.ambiguityOk) addReason(reasons, "ambiguedad");
  if (!factors.competitionOk) addReason(reasons, "competencia");
  if (!factors.discriminatorOk) addReason(reasons, "sin_discriminador_suficiente");
  if (!factors.cardinalityOk) addReason(reasons, "cardinalidad_no_1_1");
  if (cardinality && cardinality !== "1:1") {
    addReason(reasons, "cardinalidad_" + cardinality);
  }
  return reasons;
};

const emptyResultForSituation = (situacion) => ({
  situacion,
  situacionId: situacion.id,
  recordKey: null,
  sourceRowId: null,
  matchStatus: null,
  matchScore: null,
  similarityScore: null,
  fieldCoverage: 0,
  matchedFields: [],
  differentFields: [],
  missingFields: MATCH_FIELDS,
  strongMatches: 0,
  strongMatchedFields: [],
  ambiguityMargin: null,
  competitionMargin: null,
  discriminator: {
    required: false,
    satisfied: true,
    distinguishingFields: [],
    decisiveFields: [],
    competingSituationIds: [],
    reasons: [],
  },
  autoConfirmEligible: false,
  confidenceFactors: {
    scoreOk: false,
    coverageOk: false,
    strongFieldsOk: false,
    ambiguityOk: true,
    competitionOk: true,
    discriminatorOk: true,
    cardinalityOk: false,
  },
  razones: [],
  diferencias: [],
  candidateRows: [],
  cardinality: null,
  tipoInconsistencia: "omision_sidca",
});

const resultFromCandidate = (candidate, matchStatus, tipoInconsistencia = "revision") => ({
  ...candidate,
  matchStatus,
  tipoInconsistencia,
});

/**
 * Asignación global uno-a-uno. Ranking: auto-confirmable, calidad mínima
 * score/cobertura/strong, similarityScore, fieldCoverage, strongMatches e IDs.
 */
export const matchSituationsOneToOne = (situaciones = [], filas = [], context = {}) => {
  const matchingContext = {
    totalSituationsForPerson: context.totalSituationsForPerson ?? situaciones.length,
    totalComparableRows: context.totalComparableRows ?? filas.length,
    confirmedAssignments: context.confirmedAssignments ?? 0,
    unresolvedSituations: context.unresolvedSituations ?? situaciones.length,
    unresolvedRows: context.unresolvedRows ?? filas.length,
  };
  const situationById = new Map(situaciones.map((situacion) => [situacion.id, situacion]));
  const rowByKey = new Map(filas.map((fila) => [fila.recordKey, fila]));
  const candidatesBySituation = new Map();
  const candidatesByRow = new Map();

  situaciones.forEach((situacion) => candidatesBySituation.set(situacion.id, []));
  filas.forEach((fila) => candidatesByRow.set(fila.recordKey, []));

  situaciones.forEach((situacion) => {
    filas.forEach((fila) => {
      const comparison = compareSituations(situacion, fila.valuesNormalized || {});
      if (comparison.similarityScore < MATCH_THRESHOLDS.posible) return;

      const candidate = {
        situacionId: situacion.id,
        recordKey: fila.recordKey,
        sourceRowId: fila.recordKey,
        ...comparison,
      };
      candidatesBySituation.get(situacion.id).push(candidate);
      candidatesByRow.get(fila.recordKey).push(candidate);
    });
  });

  candidatesBySituation.forEach((candidates, key) => {
    candidatesBySituation.set(key, candidates.sort((left, right) =>
      right.similarityScore - left.similarityScore ||
      right.fieldCoverage - left.fieldCoverage ||
      String(left.recordKey).localeCompare(String(right.recordKey))
    ));
  });
  candidatesByRow.forEach((candidates, key) => {
    candidatesByRow.set(key, candidates.sort((left, right) =>
      right.similarityScore - left.similarityScore ||
      right.fieldCoverage - left.fieldCoverage ||
      String(left.situacionId).localeCompare(String(right.situacionId))
    ));
  });

  const qualifiedBySituation = new Map();
  const qualifiedByRow = new Map();
  candidatesBySituation.forEach((candidates, situationId) => {
    qualifiedBySituation.set(situationId, candidates.filter(candidateQuality));
  });
  candidatesByRow.forEach((candidates, recordKey) => {
    qualifiedByRow.set(recordKey, candidates.filter(candidateQuality));
  });

  const candidateObjects = [];
  candidatesBySituation.forEach((candidates, situationId) => {
    const situation = situationById.get(situationId);
    candidates.forEach((candidate) => {
      const reasonableCompeting = situaciones.filter((item) => item.id !== situationId);
      const discriminator = evaluateDiscriminator({
        targetSituation: situation,
        competingSituations: reasonableCompeting,
        sourceRow: rowByKey.get(candidate.recordKey)?.valuesNormalized || {},
      });
      const qualifiedSituationCandidates = qualifiedBySituation.get(situationId) || [];
      const qualifiedRowCandidates = qualifiedByRow.get(candidate.recordKey) || [];
      const situationRunnerUp = qualifiedSituationCandidates.find(
        (item) => item.recordKey !== candidate.recordKey
      );
      const rowRunnerUp = qualifiedRowCandidates.find(
        (item) => item.situacionId !== situationId
      );
      const ambiguityMargin = situationRunnerUp
        ? Number((candidate.similarityScore - situationRunnerUp.similarityScore).toFixed(4))
        : null;
      const competitionMargin = rowRunnerUp
        ? Number((candidate.similarityScore - rowRunnerUp.similarityScore).toFixed(4))
        : null;
      const confidenceFactors = {
        scoreOk: candidate.similarityScore >= MATCH_THRESHOLDS.confirmada,
        coverageOk: candidate.fieldCoverage >= AUTO_CONFIRM_MIN_COVERAGE,
        strongFieldsOk: candidate.strongMatches >= 2,
        ambiguityOk:
          !situationRunnerUp || ambiguityMargin >= MATCH_THRESHOLDS.margenAmbiguedad,
        competitionOk:
          !rowRunnerUp || competitionMargin >= MATCH_THRESHOLDS.margenCompetencia,
        discriminatorOk: discriminator.satisfied,
        cardinalityOk: false,
        setContext: matchingContext,
      };
      const preCardinalityEligible =
        confidenceFactors.scoreOk &&
        confidenceFactors.coverageOk &&
        confidenceFactors.strongFieldsOk &&
        confidenceFactors.ambiguityOk &&
        confidenceFactors.competitionOk &&
        confidenceFactors.discriminatorOk;

      candidateObjects.push({
        ...candidate,
        discriminator,
        ambiguityMargin,
        competitionMargin,
        confidenceFactors,
        preCardinalityEligible,
        razones: candidateReasons(candidate, confidenceFactors, null),
        diferencias: candidate.diferencias,
      });
    });
  });

  const preEligibleBySituation = new Map();
  const preEligibleByRow = new Map();
  candidateObjects.forEach((candidate) => {
    if (!candidate.preCardinalityEligible) return;
    if (!preEligibleBySituation.has(candidate.situacionId)) preEligibleBySituation.set(candidate.situacionId, []);
    if (!preEligibleByRow.has(candidate.recordKey)) preEligibleByRow.set(candidate.recordKey, []);
    preEligibleBySituation.get(candidate.situacionId).push(candidate);
    preEligibleByRow.get(candidate.recordKey).push(candidate);
  });

  const groupingSuggestions = new Map();
  const occupiedRowsForGrouping = new Set();
  situaciones.forEach((situacion) => {
    if ((preEligibleBySituation.get(situacion.id) || []).length > 0) return;
    const suggestion = exactGroupingSuggestion(situacion, filas, occupiedRowsForGrouping);
    if (!suggestion) return;
    groupingSuggestions.set(situacion.id, suggestion);
    suggestion.candidateRows.forEach((recordKey) => occupiedRowsForGrouping.add(recordKey));
  });

  const desegregationSuggestions = exactDesegregationSuggestion(
    filas,
    situaciones,
    new Set([...groupingSuggestions.keys()])
  );

  const assignments = new Map();
  const usedRows = new Set();
  const rankedCandidates = sortCandidates(candidateObjects);

  rankedCandidates.forEach((candidate) => {
    const situationGrouping = groupingSuggestions.get(candidate.situacionId);
    const rowDesegregation = desegregationSuggestions.get(candidate.recordKey);
    const preSituationCandidates = preEligibleBySituation.get(candidate.situacionId) || [];
    const preRowCandidates = preEligibleByRow.get(candidate.recordKey) || [];
    const cardinality = situationGrouping
      ? "1:N"
      : rowDesegregation
        ? "N:1"
        : preSituationCandidates.length === 1 && preRowCandidates.length === 1
          ? "1:1"
          : preSituationCandidates.length > 1
            ? "1:N"
            : preRowCandidates.length > 1
              ? "N:1"
              : "1:1";

    candidate.cardinality = cardinality;
    candidate.confidenceFactors.cardinalityOk = cardinality === "1:1";
    candidate.razones = candidateReasons(candidate, candidate.confidenceFactors, cardinality);
    candidate.autoConfirmEligible =
      candidate.preCardinalityEligible && candidate.confidenceFactors.cardinalityOk;

    if (
      candidate.autoConfirmEligible &&
      !situationGrouping &&
      !rowDesegregation &&
      !usedRows.has(candidate.recordKey)
    ) {
      assignments.set(candidate.situacionId, candidate);
      usedRows.add(candidate.recordKey);
    }
  });

  const bestCandidateForSituation = (situationId) =>
    sortCandidates(candidateObjects.filter((candidate) => candidate.situacionId === situationId))[0] || null;
  const bestCandidateForRow = (recordKey) =>
    sortCandidates(candidateObjects.filter((candidate) => candidate.recordKey === recordKey))[0] || null;

  const situationResults = situaciones.map((situacion) => {
    const assignment = assignments.get(situacion.id);
    const grouping = groupingSuggestions.get(situacion.id);
    const best = bestCandidateForSituation(situacion.id);

    if (assignment) {
      return resultFromCandidate(
        { ...assignment, situacion },
        "confirmada",
        ""
      );
    }

    if (grouping) {
      const groupingCandidate = best || {
        ...compareSituations(situacion, {}),
        situacionId: situacion.id,
      };
      return {
        ...groupingCandidate,
        situacion,
        situacionId: situacion.id,
        recordKey: null,
        sourceRowId: null,
        matchStatus: "revision",
        candidateRows: grouping.candidateRows,
        cardinality: "1:N",
        autoConfirmEligible: false,
        razones: unique([...(groupingCandidate.razones || []), ...grouping.reasons]),
        tipoInconsistencia: "revision_agrupamiento",
      };
    }

    if (best) {
      const rowDesegregation = desegregationSuggestions.get(best.recordKey);
      if (rowDesegregation) {
        return {
          ...best,
          situacion,
          recordKey: null,
          sourceRowId: null,
          matchStatus: "revision",
          candidateRows: [best.recordKey],
          cardinality: "N:1",
          autoConfirmEligible: false,
          razones: unique([...(best.razones || []), ...rowDesegregation.reasons]),
          tipoInconsistencia: "revision_desagregacion",
        };
      }

      return {
        ...best,
        situacion,
        recordKey: null,
        sourceRowId: null,
        matchStatus: "revision",
        autoConfirmEligible: false,
        tipoInconsistencia: "revision",
      };
    }

    return emptyResultForSituation(situacion);
  });

  const usedSituationIds = new Set(assignments.keys());
  const rowResults = filas.map((fila) => {
    const assignment = [...assignments.values()].find(
      (item) => item.recordKey === fila.recordKey
    );
    const groupingSituation = [...groupingSuggestions.entries()].find(([, suggestion]) =>
      suggestion.candidateRows.includes(fila.recordKey)
    );
    const desegregation = desegregationSuggestions.get(fila.recordKey);
    const best = bestCandidateForRow(fila.recordKey);
    const rowCandidates = candidateObjects.filter((candidate) => candidate.recordKey === fila.recordKey);

    if (assignment) {
      return {
        fila,
        ...assignment,
        situacionIdVinculada: assignment.situacionId,
        matchStatus: "confirmada",
        tipoInconsistencia: "",
        candidateRows: [assignment.recordKey],
      };
    }

    if (groupingSituation) {
      const [situacionId, suggestion] = groupingSituation;
      return {
        fila,
        ...(best || {}),
        matchStatus: "revision",
        situacionId: null,
        situacionIdVinculada: null,
        candidateRows: suggestion.candidateRows,
        cardinality: "1:N",
        razones: unique([...(best?.razones || []), ...suggestion.reasons]),
        tipoInconsistencia: "revision_agrupamiento",
        grupoSituacionId: situacionId,
      };
    }

    if (desegregation) {
      return {
        fila,
        ...(best || {}),
        matchStatus: "revision",
        situacionId: null,
        situacionIdVinculada: null,
        candidateRows: desegregation.candidateSituationIds,
        cardinality: "N:1",
        razones: unique([...(best?.razones || []), ...desegregation.reasons]),
        tipoInconsistencia: "revision_desagregacion",
      };
    }

    const linkedCandidate = rowCandidates.find((candidate) => usedSituationIds.has(candidate.situacionId));
    const reviewCandidate = linkedCandidate || best;
    if (reviewCandidate) {
      return {
        fila,
        ...reviewCandidate,
        matchStatus: "revision",
        situacionIdVinculada: null,
        autoConfirmEligible: false,
        razones: unique([...(reviewCandidate.razones || []), "fila_reutilizada"]),
        tipoInconsistencia: "revision",
      };
    }

    return {
      fila,
      matchStatus: null,
      matchScore: null,
      similarityScore: null,
      fieldCoverage: 0,
      matchedFields: [],
      differentFields: [],
      missingFields: MATCH_FIELDS,
      strongMatches: 0,
      strongMatchedFields: [],
      razones: [],
      diferencias: [],
      candidateRows: [],
      situacionId: null,
      situacionIdVinculada: null,
      sourceRowId: fila.recordKey,
      cardinality: null,
      autoConfirmEligible: false,
      tipoInconsistencia: "presentada_sin_solicitud_vinculada",
    };
  });

  return {
    situationResults,
    rowResults,
    matchingContext: {
      ...matchingContext,
      confirmedAssignments: assignments.size,
      unresolvedSituations: situaciones.length - assignments.size,
      unresolvedRows: filas.length - usedRows.size,
    },
  };
};
