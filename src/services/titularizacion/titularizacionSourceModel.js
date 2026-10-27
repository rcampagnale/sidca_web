import { normalizeSearchText, textValue } from "./titularizacionNormalizer";

export const SOURCE_COVERAGE = Object.freeze({
  UNKNOWN: "unknown",
  PARTIAL: "partial",
  COMPLETE: "complete",
});

export const SOURCE_SCOPE = Object.freeze({
  PERSON: "person",
  SITUATION: "situation",
  MIXED: "mixed",
});

export const SOURCE_STAGE = Object.freeze({
  SOLICITUD: "solicitud",
  SIDCA: "sidca",
  MINISTERIO: "ministerio",
  RESOLUCION: "resolucion",
});

export const SOURCE_ABSENCE_STATUS = Object.freeze({
  PRESENT: "present",
  POSSIBLE_OMISSION: "possible_omission",
  NO_DATA: "no_data",
  OUT_OF_SCOPE: "out_of_scope",
  UNKNOWN_SCOPE: "unknown_scope",
});

export const SOURCE_MATCH_CLASSIFICATION = Object.freeze({
  MATCHED: "matched",
  REVIEW: "review",
});

const SCOPE_DIMENSIONS = [
  {
    scopeKey: "niveles",
    situationKeys: ["nivel"],
    label: "nivel",
  },
  {
    scopeKey: "departamentos",
    situationKeys: ["departamento"],
    label: "departamento",
  },
  {
    scopeKey: "tiposCargo",
    situationKeys: ["tipoCargo", "cargo"],
    label: "tipoCargo",
  },
  {
    scopeKey: "modalidades",
    situationKeys: ["modalidad"],
    label: "modalidad",
  },
  {
    scopeKey: "establecimientos",
    situationKeys: ["establecimiento"],
    label: "establecimiento",
  },
];

const SCOPE_KEYS = [...SCOPE_DIMENSIONS.map(({ scopeKey }) => scopeKey), "periodo"];

const emptyScope = () =>
  Object.fromEntries(SCOPE_KEYS.map((key) => [key, null]));

const hasValue = (value) => {
  const normalized = normalizeSearchText(textValue(value));
  return Boolean(normalized) && normalized !== "—";
};

const normalizedValue = (value) => normalizeSearchText(textValue(value));

const valueForSituationDimension = (situation = {}, keys = []) => {
  const key = keys.find((candidate) => hasValue(situation?.[candidate]));
  return key ? situation[key] : "";
};

const normalizeAllowedValues = (values = []) =>
  values.map(normalizedValue).filter(Boolean);

const dateValue = (value) => {
  if (value === null || value === undefined || value === "") return null;
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value.getTime();
  }
  if (typeof value?.toDate === "function") {
    const converted = value.toDate();
    return converted instanceof Date && !Number.isNaN(converted.getTime())
      ? converted.getTime()
      : null;
  }
  if (typeof value === "object" && typeof value.seconds === "number") {
    return value.seconds * 1000;
  }
  const parsed = new Date(value).getTime();
  return Number.isNaN(parsed) ? null : parsed;
};

const periodParts = (period) => {
  if (!period || typeof period !== "object" || Array.isArray(period)) {
    return null;
  }

  const desde = dateValue(period.desde);
  const hasta = dateValue(period.hasta);
  if (desde === null || hasta === null) return null;

  return { desde, hasta };
};

const scopeHasRestrictions = (scope = {}) =>
  SCOPE_KEYS.some((key) => scope[key] !== null && scope[key] !== undefined);

const sourceScopeIsSituationCapable = (sourceScope) =>
  sourceScope === SOURCE_SCOPE.SITUATION || sourceScope === SOURCE_SCOPE.MIXED;

export const createSourceDefinition = (input = {}) => {
  const incomingScope = input.scope && typeof input.scope === "object"
    ? input.scope
    : {};

  return {
    sourceId: input.sourceId ?? null,
    nombre: input.nombre ?? "",
    stage: input.stage ?? null,
    sourceScope: input.sourceScope ?? null,
    // Unknown is the only safe default. Complete requires an explicit decision.
    coverage: input.coverage ?? SOURCE_COVERAGE.UNKNOWN,
    scope: Object.fromEntries(
      SCOPE_KEYS.map((key) => [key, incomingScope[key] ?? null])
    ),
    version: input.version ?? 1,
    supersedes: input.supersedes ?? null,
    vigente: input.vigente ?? true,
    sourceDate: input.sourceDate ?? null,
    coverageDeclaredBy: input.coverageDeclaredBy ?? null,
    coverageDeclaredAt: input.coverageDeclaredAt ?? null,
    metadata: input.metadata ?? null,
  };
};

export const isSituationInSourceScope = (situation = {}, source = {}) => {
  const evaluation = {
    inScope: null,
    evaluatedDimensions: [],
    excludedBy: [],
    unknownDimensions: [],
    reasons: [],
  };

  if (source.sourceScope === SOURCE_SCOPE.PERSON) {
    evaluation.reasons.push("fuente_de_personas_no_evalua_situaciones");
    evaluation.unknownDimensions.push("sourceScope");
    return evaluation;
  }

  if (!sourceScopeIsSituationCapable(source.sourceScope)) {
    evaluation.reasons.push("sourceScope_no_configurado_para_situaciones");
    evaluation.unknownDimensions.push("sourceScope");
    return evaluation;
  }

  const scope = source.scope && typeof source.scope === "object"
    ? source.scope
    : emptyScope();
  let hasUnknown = false;
  let hasExclusion = false;
  let hasRestriction = false;

  SCOPE_DIMENSIONS.forEach(({ scopeKey, situationKeys, label }) => {
    const allowed = scope[scopeKey];
    if (allowed === null || allowed === undefined) return;

    hasRestriction = true;
    if (!Array.isArray(allowed) || allowed.length === 0) {
      hasUnknown = true;
      evaluation.unknownDimensions.push(scopeKey);
      evaluation.reasons.push(`${scopeKey}_no_configurado_validamente`);
      return;
    }

    const situationValue = valueForSituationDimension(situation, situationKeys);
    if (!hasValue(situationValue)) {
      hasUnknown = true;
      evaluation.unknownDimensions.push(label);
      evaluation.reasons.push(`situacion_sin_${label}`);
      return;
    }

    const normalizedSituation = normalizedValue(situationValue);
    const normalizedAllowed = normalizeAllowedValues(allowed);
    if (normalizedAllowed.includes(normalizedSituation)) {
      evaluation.evaluatedDimensions.push(label);
      evaluation.reasons.push(`${label}_dentro_del_scope`);
      return;
    }

    hasExclusion = true;
    evaluation.excludedBy.push(label);
    evaluation.reasons.push(`${label}_fuera_del_scope`);
  });

  const configuredPeriod = scope.periodo;
  if (configuredPeriod !== null && configuredPeriod !== undefined) {
    hasRestriction = true;
    const sourcePeriod = periodParts(configuredPeriod);
    const situationPeriod = periodParts(
      situation.periodo || {
        desde: situation.periodoDesde,
        hasta: situation.periodoHasta,
      }
    );

    if (!sourcePeriod || !situationPeriod) {
      hasUnknown = true;
      evaluation.unknownDimensions.push("periodo");
      evaluation.reasons.push("periodo_no_determinable");
    } else if (
      situationPeriod.hasta < sourcePeriod.desde ||
      situationPeriod.desde > sourcePeriod.hasta
    ) {
      hasExclusion = true;
      evaluation.excludedBy.push("periodo");
      evaluation.reasons.push("periodo_fuera_del_scope");
    } else if (
      situationPeriod.desde >= sourcePeriod.desde &&
      situationPeriod.hasta <= sourcePeriod.hasta
    ) {
      evaluation.evaluatedDimensions.push("periodo");
      evaluation.reasons.push("periodo_dentro_del_scope");
    } else {
      hasUnknown = true;
      evaluation.unknownDimensions.push("periodo");
      evaluation.reasons.push("periodo_parcialmente_superpuesto");
    }
  }

  if (hasExclusion) {
    evaluation.inScope = false;
  } else if (hasUnknown) {
    evaluation.inScope = null;
  } else {
    evaluation.inScope = true;
    if (!hasRestriction) evaluation.reasons.push("scope_sin_restricciones");
  }

  return evaluation;
};

export const canInferAbsenceFromSource = (source = {}, situation = {}) => {
  const scopeEvaluation = isSituationInSourceScope(situation, source);

  if (source.sourceScope === SOURCE_SCOPE.PERSON) {
    return {
      canInfer: false,
      reason: "source_scope_person_no_aplica_a_situaciones",
      scopeEvaluation,
    };
  }

  if (source.coverage !== SOURCE_COVERAGE.COMPLETE) {
    return {
      canInfer: false,
      reason: "coverage_no_es_complete",
      scopeEvaluation,
    };
  }

  if (source.vigente === false) {
    return {
      canInfer: false,
      reason: "fuente_no_vigente",
      scopeEvaluation,
    };
  }

  if (scopeEvaluation.inScope !== true) {
    return {
      canInfer: false,
      reason:
        scopeEvaluation.inScope === false
          ? "situacion_fuera_del_scope"
          : "scope_no_determinable",
      scopeEvaluation,
    };
  }

  return {
    canInfer: true,
    reason: "fuente_complete_vigente_y_situacion_en_scope",
    scopeEvaluation,
  };
};

export const evaluateSourceAbsence = ({
  source = {},
  situation = {},
  evidenceFound = false,
} = {}) => {
  if (evidenceFound) return SOURCE_ABSENCE_STATUS.PRESENT;

  if (source.sourceScope === SOURCE_SCOPE.PERSON) {
    return SOURCE_ABSENCE_STATUS.NO_DATA;
  }

  if (source.coverage !== SOURCE_COVERAGE.COMPLETE || source.vigente === false) {
    return SOURCE_ABSENCE_STATUS.NO_DATA;
  }

  const scopeEvaluation = isSituationInSourceScope(situation, source);
  if (scopeEvaluation.inScope === false) {
    return SOURCE_ABSENCE_STATUS.OUT_OF_SCOPE;
  }
  if (scopeEvaluation.inScope !== true) {
    return SOURCE_ABSENCE_STATUS.UNKNOWN_SCOPE;
  }

  return SOURCE_ABSENCE_STATUS.POSSIBLE_OMISSION;
};

const supersededIdsFor = (source, sourceById, visited = new Set()) => {
  const ids = Array.isArray(source.supersedes)
    ? source.supersedes
    : source.supersedes
      ? [source.supersedes]
      : [];
  const superseded = new Set();

  ids.forEach((id) => {
    const sourceId = String(id);
    if (visited.has(sourceId)) return;
    visited.add(sourceId);
    superseded.add(sourceId);
    const parent = sourceById.get(sourceId);
    if (parent) {
      supersededIdsFor(parent, sourceById, visited).forEach((ancestorId) =>
        superseded.add(ancestorId)
      );
    }
  });

  return superseded;
};

export const resolveActiveSources = (sources = []) => {
  const normalizedSources = Array.isArray(sources)
    ? sources.filter(Boolean)
    : [];
  const sourceById = new Map(
    normalizedSources
      .filter((source) => source.sourceId !== null && source.sourceId !== undefined)
      .map((source) => [String(source.sourceId), source])
  );
  const supersededIds = new Set();

  normalizedSources
    .filter((source) => source.vigente !== false)
    .forEach((source) => {
      supersededIdsFor(source, sourceById).forEach((sourceId) =>
        supersededIds.add(sourceId)
      );
    });

  return normalizedSources.filter(
    (source) =>
      source.vigente !== false &&
      !supersededIds.has(String(source.sourceId))
  );
};

export const validateSourceDefinition = (source = {}) => {
  const errors = [];
  const warnings = [];
  const validCoverage = Object.values(SOURCE_COVERAGE).includes(source.coverage);
  const validSourceScope = Object.values(SOURCE_SCOPE).includes(source.sourceScope);
  const validStage = Object.values(SOURCE_STAGE).includes(source.stage);

  if (!validCoverage) errors.push("coverage_invalido");
  if (!validSourceScope) errors.push("sourceScope_invalido");
  if (!validStage) errors.push("stage_invalido");
  if (!Number.isInteger(source.version) || source.version < 1) {
    errors.push("version_debe_ser_entero_mayor_o_igual_a_1");
  }

  const scope = source.scope === undefined || source.scope === null
    ? emptyScope()
    : source.scope;
  if (!scope || typeof scope !== "object" || Array.isArray(scope)) {
    errors.push("scope_invalido");
  } else {
    SCOPE_KEYS.forEach((key) => {
      const value = scope[key];
      if (key === "periodo") return;
      if (value !== null && value !== undefined && !Array.isArray(value)) {
        errors.push(`${key}_debe_ser_null_o_array`);
      } else if (Array.isArray(value) && value.length === 0) {
        errors.push(`${key}_no_puede_ser_array_vacio`);
      }
    });

    if (scope.periodo !== null && scope.periodo !== undefined) {
      const period = periodParts(scope.periodo);
      if (!period) {
        errors.push("periodo_invalido");
      } else if (period.desde > period.hasta) {
        errors.push("periodo_desde_mayor_que_hasta");
      }
    }
  }

  if (source.coverage === SOURCE_COVERAGE.COMPLETE) {
    if (!hasValue(source.coverageDeclaredBy)) {
      warnings.push("complete_sin_coverageDeclaredBy");
    }
    if (!source.sourceDate) warnings.push("complete_sin_sourceDate");
    if (validSourceScope && sourceScopeIsSituationCapable(source.sourceScope)) {
      const safeScope = scope && typeof scope === "object" && !Array.isArray(scope)
        ? scope
        : emptyScope();
      if (!scopeHasRestrictions(safeScope)) {
        warnings.push("complete_sin_restricciones_de_scope");
      }
    }
  }

  return { valid: errors.length === 0, errors, warnings };
};

export const classifySituationAgainstSource = ({
  situation = {},
  source = {},
  matchResult = null,
} = {}) => {
  const matchStatus = matchResult?.matchStatus || matchResult?.status;
  if (matchStatus === "confirmada") {
    return SOURCE_MATCH_CLASSIFICATION.MATCHED;
  }
  if (
    matchStatus === "revision" ||
    matchStatus === "posible" ||
    matchResult?.tipo === "revision" ||
    matchResult?.tipoInconsistencia === "revision"
  ) {
    return SOURCE_MATCH_CLASSIFICATION.REVIEW;
  }

  return evaluateSourceAbsence({
    source,
    situation,
    evidenceFound: false,
  });
};

const knownSourceSuggestions = [
  {
    formularioId: "YHe6DibXG17hi9uST4oG",
    nombre: "TITULARIZACIÓN DOCENTE 2026",
    stage: SOURCE_STAGE.SOLICITUD,
    sourceScope: SOURCE_SCOPE.SITUATION,
  },
  {
    formularioId: "UBJWIrQgQjN1Mh95ains",
    nombre: "Reclamos – Primer Dictamen",
    stage: SOURCE_STAGE.SOLICITUD,
    sourceScope: SOURCE_SCOPE.PERSON,
  },
  {
    formularioId: "eVgdKqU0Ntavd2TmxbRE",
    nombre: "Reapertura de gestión",
    stage: SOURCE_STAGE.SOLICITUD,
    sourceScope: SOURCE_SCOPE.PERSON,
  },
  {
    formularioId: "dVAOz4oRe3EDFFwkKlzn",
    nombre: "Renuncia Condicional",
    stage: SOURCE_STAGE.SOLICITUD,
    sourceScope: SOURCE_SCOPE.PERSON,
  },
];

export const TITULARIZACION_SOURCE_SUGGESTIONS = Object.freeze(
  knownSourceSuggestions.map((suggestion) =>
    Object.freeze({
      ...createSourceDefinition({
        sourceId: suggestion.formularioId,
        nombre: suggestion.nombre,
        stage: suggestion.stage,
        sourceScope: suggestion.sourceScope,
      }),
      formularioId: suggestion.formularioId,
    })
  )
);

export const getTitularizacionSourceSuggestion = (formularioId) => {
  const suggestion = TITULARIZACION_SOURCE_SUGGESTIONS.find(
    (source) => source.formularioId === formularioId
  );
  if (!suggestion) return null;
  return {
    ...suggestion,
    scope: { ...suggestion.scope },
  };
};
