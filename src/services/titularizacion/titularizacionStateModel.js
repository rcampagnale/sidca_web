import { normalizeSearchText } from "./titularizacionNormalizer";

export const STATE_ALGORITHM_VERSION = 1;

export const STATE_STAGES = Object.freeze({
  SOLICITUD: "solicitud",
  SIDCA: "sidca",
  MINISTERIO: "ministerio",
  RESOLUCION: "resolucion",
});

export const EVIDENCE_ASSERTIONS = Object.freeze({
  SOLICITUD_DECLARADA: "declarada",
  SIDCA_PRESENTADA: "presentada",
  MINISTERIO_APTA: "apta",
  MINISTERIO_NO_APTA: "no_apta",
  MINISTERIO_OBSERVADA: "observada",
  MINISTERIO_OMITIDA: "omitida",
  MINISTERIO_REZAGADA: "rezagada",
  RESOLUCION_TITULARIZADA: "titularizada",
  MATCH_CONFIRMADO: "match_confirmado",
  MATCH_RECHAZADO: "match_rechazado",
  REVOCACION: "revocacion",
});

export const SOLICITUD_STATES = Object.freeze({
  DECLARADA: "DECLARADA",
  NO_DECLARADA: "NO_DECLARADA",
  SIN_DATO: "SIN_DATO",
});

export const SIDCA_STATES = Object.freeze({
  PRESENTADA: "PRESENTADA",
  POSIBLE_OMISION: "POSIBLE_OMISION",
  SIN_DATO: "SIN_DATO",
  REVISION: "REVISION",
  PRESENTADA_SIN_SOLICITUD: "PRESENTADA_SIN_SOLICITUD",
});

export const MINISTERIO_STATES = Object.freeze({
  APTA: "APTA",
  NO_APTA: "NO_APTA",
  OBSERVADA: "OBSERVADA",
  OMITIDA: "OMITIDA",
  REZAGADA: "REZAGADA",
  POSIBLE_OMISION: "POSIBLE_OMISION",
  SIN_DATO: "SIN_DATO",
  REVISION: "REVISION",
});

export const RESOLUCION_STATES = Object.freeze({
  TITULARIZADA: "TITULARIZADA",
  PENDIENTE: "PENDIENTE",
  SIN_DATO: "SIN_DATO",
});

export const SITUATION_LABELS = Object.freeze({
  DECLARADA: "DECLARADA",
  PRESENTADA_SIDCA: "PRESENTADA_SIDCA",
  POSIBLE_OMISION_SIDCA: "POSIBLE_OMISION_SIDCA",
  REQUIERE_REVISION: "REQUIERE_REVISION",
  PRESENTADA_SIN_SOLICITUD: "PRESENTADA_SIN_SOLICITUD",
  APTA: "APTA",
  NO_APTA: "NO_APTA",
  OBSERVADA: "OBSERVADA",
  OMITIDA: "OMITIDA",
  REZAGADA: "REZAGADA",
  POSIBLE_OMISION_MINISTERIO: "POSIBLE_OMISION_MINISTERIO",
  APTA_PENDIENTE_RESOLUCION: "APTA_PENDIENTE_RESOLUCION",
  TITULARIZADA: "TITULARIZADA",
  CONTRADICTORIA: "CONTRADICTORIA",
  SIN_DATO: "SIN_DATO",
});

export const PERSON_LABELS = Object.freeze({
  SIN_SITUACION_ESTRUCTURADA: "SIN_SITUACION_ESTRUCTURADA",
  TITULARIZACION_COMPLETA: "TITULARIZACION_COMPLETA",
  TITULARIZACION_PARCIAL: "TITULARIZACION_PARCIAL",
  NO_TITULARIZADA: "NO_TITULARIZADA",
  CON_OMISIONES: "CON_OMISIONES",
  REQUIERE_REVISION: "REQUIERE_REVISION",
  EN_TRAMITE: "EN_TRAMITE",
});

const MATCH_REVIEW_STATUSES = new Set([
  "revision",
  "revision_agrupamiento",
  "revision_desagregacion",
]);

const ADMINISTRATIVE_ASSERTIONS = new Set([
  EVIDENCE_ASSERTIONS.MINISTERIO_APTA,
  EVIDENCE_ASSERTIONS.MINISTERIO_NO_APTA,
  EVIDENCE_ASSERTIONS.MINISTERIO_OBSERVADA,
  EVIDENCE_ASSERTIONS.MINISTERIO_OMITIDA,
  EVIDENCE_ASSERTIONS.MINISTERIO_REZAGADA,
]);

const assertionOf = (evidence = {}) =>
  normalizeSearchText(evidence.afirma || evidence.assertion || evidence.accion || "")
    .replace(/\s+/g, "_");

const stageOf = (evidence = {}) =>
  normalizeSearchText(evidence.etapa || evidence.stage || "");

const evidenceIdOf = (evidence = {}) =>
  evidence.id ?? evidence.evidenceId ?? evidence.evidenciaId ?? null;

const isManualEvidence = (evidence = {}) =>
  normalizeSearchText(
    evidence.origen || evidence.sourceType || evidence.decisionOrigin || ""
  ) === "manual" || evidence.manual === true;

const isRevocation = (evidence = {}) =>
  assertionOf(evidence) === EVIDENCE_ASSERTIONS.REVOCACION;

const isMeaningfulId = (id) => id !== null && id !== undefined && id !== "";

const idKey = (id) => String(id ?? "");

const uniqueSortedIds = (ids = []) =>
  [...new Set(ids.filter(isMeaningfulId).map(idKey))].sort((left, right) =>
    left.localeCompare(right, "es")
  );

const versionOf = (value) => {
  const version = Number(value);
  return Number.isFinite(version) ? version : 0;
};

const createdAtKey = (value) => {
  if (value === null || value === undefined) return "";
  if (typeof value === "string") return value;
  if (value instanceof Date) return value.toISOString();
  if (typeof value.toISOString === "function") return value.toISOString();
  if (typeof value.toMillis === "function") return String(value.toMillis());
  if (typeof value.seconds === "number") return String(value.seconds);
  return String(value);
};

const evidenceComparator = (left = {}, right = {}) => {
  const manualDifference = Number(isManualEvidence(right)) - Number(isManualEvidence(left));
  if (manualDifference) return manualDifference;

  const sourceVersionDifference =
    versionOf(right.sourceVersion) - versionOf(left.sourceVersion);
  if (sourceVersionDifference) return sourceVersionDifference;

  const evidenceVersionDifference = versionOf(right.version) - versionOf(left.version);
  if (evidenceVersionDifference) return evidenceVersionDifference;

  const dateDifference = createdAtKey(left.createdAt).localeCompare(
    createdAtKey(right.createdAt),
    "es"
  );
  if (dateDifference) return dateDifference;

  return idKey(evidenceIdOf(left)).localeCompare(idKey(evidenceIdOf(right)), "es");
};

const sourceConfigMap = (context = {}) => {
  const configuredSources = [
    ...(Array.isArray(context.sources) ? context.sources : []),
    ...(Array.isArray(context.activeSources) ? context.activeSources : []),
  ];
  return new Map(
    configuredSources
      .filter((source) => isMeaningfulId(source?.sourceId))
      .map((source) => [idKey(source.sourceId), source])
  );
};

const sourceIdsFrom = (context = {}, key) => {
  const values = context[key];
  if (!Array.isArray(values)) return new Set();
  return new Set(values.map((value) => idKey(value?.sourceId ?? value)));
};

const sourceIsEffective = (evidence = {}, context = {}) => {
  if (evidence.sourceVigente === false) return false;
  const sourceId = evidence.sourceId;
  const activeSourceIds = sourceIdsFrom(context, "activeSourceIds");
  const supersededSourceIds = sourceIdsFrom(context, "supersededSourceIds");
  if (isMeaningfulId(sourceId) && activeSourceIds.has(idKey(sourceId))) return true;
  if (isMeaningfulId(sourceId) && supersededSourceIds.has(idKey(sourceId))) return false;

  const configuredSource = evidence.source || sourceConfigMap(context).get(idKey(sourceId));
  if (configuredSource && configuredSource.vigente === false) return false;
  return true;
};

export const filterEffectiveEvidences = (evidences = [], context = {}) =>
  (Array.isArray(evidences) ? evidences : [])
    .filter((evidence) => evidence && evidence.vigente !== false)
    .filter((evidence) => sourceIsEffective(evidence, context))
    .slice()
    .sort(evidenceComparator);

const revocationTargetOf = (evidence = {}) =>
  evidence.revocaEvidenceId ?? evidence.revokesEvidenceId ?? evidence.revokedEvidenceId;

export const resolveRevokedEvidences = (evidences = []) => {
  const normalized = (Array.isArray(evidences) ? evidences : []).filter(Boolean).slice();
  const byId = new Map(
    normalized
      .filter((evidence) => isMeaningfulId(evidenceIdOf(evidence)))
      .map((evidence) => [idKey(evidenceIdOf(evidence)), evidence])
  );
  const revokedIds = new Set();
  let changed = true;

  while (changed) {
    changed = false;
    for (const revocation of normalized
      .filter((evidence) => evidence.vigente !== false && isRevocation(evidence))
      .filter((evidence) => !revokedIds.has(idKey(evidenceIdOf(evidence))))) {
      const targetId = revocationTargetOf(revocation);
      if (!isMeaningfulId(targetId)) continue;
      const target = byId.get(idKey(targetId));
      if (target && isRevocation(target) && revokedIds.has(idKey(targetId))) continue;
      if (!revokedIds.has(idKey(targetId))) {
        revokedIds.add(idKey(targetId));
        changed = true;
      }
    }
  }

  const revokedEvidenceIds = uniqueSortedIds([...revokedIds]);
  return {
    evidences: normalized.filter(
      (evidence) => !revokedIds.has(idKey(evidenceIdOf(evidence)))
    ),
    revokedEvidenceIds,
  };
};

const matchResultFor = (evaluation = {}) =>
  evaluation.matchResult || evaluation.match || evaluation.result || evaluation;

const matchStatusFor = (evaluation = {}) => {
  const matchResult = matchResultFor(evaluation);
  return normalizeSearchText(
    matchResult?.matchStatus || matchResult?.status || evaluation.matchStatus || ""
  ).replace(/\s+/g, "_");
};

const absenceStatusFor = (evaluation = {}) => {
  const absence =
    evaluation.absenceEvaluation || evaluation.absence || evaluation.sourceAbsence || evaluation;
  const value = typeof absence === "string"
    ? absence
    : absence?.status || absence?.classification || absence?.resultado || "";
  return normalizeSearchText(value).replace(/\s+/g, "_");
};

const stageEvidence = (evidences, stage) =>
  evidences.filter((evidence) => stageOf(evidence) === stage && !isRevocation(evidence));

const evidenceIds = (evidences = []) =>
  uniqueSortedIds(evidences.map(evidenceIdOf));

const manualMatchDecisions = (evidences = []) =>
  evidences
    .filter((evidence) => isManualEvidence(evidence))
    .filter((evidence) => {
      const assertion = assertionOf(evidence);
      return (
        assertion === EVIDENCE_ASSERTIONS.MATCH_CONFIRMADO ||
        assertion === EVIDENCE_ASSERTIONS.MATCH_RECHAZADO
      );
    })
    .slice()
    .sort(evidenceComparator);

const buildBlock = ({ tipo, motivo, etapa, evidences = [], detalles = null }) => ({
  tipo,
  motivo,
  etapa,
  evidenceIds: evidenceIds(evidences),
  detalles,
});

const stageState = (value, evidences = []) => ({
  value,
  evidenceIds: evidenceIds(evidences),
});

const deriveSolicitud = (evidences, context = {}) => {
  const candidates = stageEvidence(evidences, STATE_STAGES.SOLICITUD).filter(
    (evidence) => assertionOf(evidence) === EVIDENCE_ASSERTIONS.SOLICITUD_DECLARADA
  );
  if (candidates.length) return stageState(SOLICITUD_STATES.DECLARADA, candidates);

  if (
    context.solicitudExternaSinVinculo === true ||
    context.externalWithoutRequest === true ||
    context.sinSolicitudVinculada === true
  ) {
    return stageState(SOLICITUD_STATES.NO_DECLARADA);
  }

  return stageState(SOLICITUD_STATES.SIN_DATO);
};

const deriveSidca = (evidences, stageEvaluation = {}, solicitud, context = {}) => {
  const candidates = stageEvidence(evidences, STATE_STAGES.SIDCA);
  const presented = candidates.filter(
    (evidence) => assertionOf(evidence) === EVIDENCE_ASSERTIONS.SIDCA_PRESENTADA
  );
  const manualDecisions = manualMatchDecisions(candidates);
  const manualConfirmed = manualDecisions.some(
    (evidence) => assertionOf(evidence) === EVIDENCE_ASSERTIONS.MATCH_CONFIRMADO
  );
  const manualRejected = manualDecisions.some(
    (evidence) => assertionOf(evidence) === EVIDENCE_ASSERTIONS.MATCH_RECHAZADO
  );
  const matchStatus = matchStatusFor(stageEvaluation);
  const stageIds = [
    ...candidates,
    ...(Array.isArray(stageEvaluation.evidences) ? stageEvaluation.evidences : []),
  ];

  if (manualRejected || (MATCH_REVIEW_STATUSES.has(matchStatus) && !manualConfirmed)) {
    return {
      state: stageState(SIDCA_STATES.REVISION, stageIds),
      block: buildBlock({
        tipo: "revision",
        motivo: manualRejected
          ? "match_rechazado_manualmente"
          : "match_sidca_requiere_revision",
        etapa: STATE_STAGES.SIDCA,
        evidences: stageIds,
        detalles: { matchStatus: matchStatus || null },
      }),
      manualDecisions,
    };
  }

  const presentedWithoutRequest =
    stageEvaluation.presentadaSinSolicitud === true ||
    stageEvaluation.sinSolicitudVinculada === true ||
    presented.some(
      (evidence) =>
        evidence.presentadaSinSolicitud === true || evidence.sinSolicitudVinculada === true
    ) ||
    (presented.length > 0 && solicitud.value !== SOLICITUD_STATES.DECLARADA);

  if (presentedWithoutRequest) {
    return {
      state: stageState(SIDCA_STATES.PRESENTADA_SIN_SOLICITUD, presented),
      block: buildBlock({
        tipo: "revision",
        motivo: "presentada_sidca_sin_solicitud_vinculada",
        etapa: STATE_STAGES.SIDCA,
        evidences: presented,
      }),
      manualDecisions,
    };
  }

  if (presented.length || matchStatus === "confirmada") {
    return {
      state: stageState(SIDCA_STATES.PRESENTADA, presented),
      block: null,
      manualDecisions,
    };
  }

  const absenceStatus = absenceStatusFor(stageEvaluation);
  if (absenceStatus === "possible_omission") {
    return {
      state: stageState(SIDCA_STATES.POSIBLE_OMISION),
      block: null,
      manualDecisions,
    };
  }

  return {
    state: stageState(SIDCA_STATES.SIN_DATO),
    block: null,
    manualDecisions,
  };
};

const deriveMinisterio = (evidences, stageEvaluation = {}) => {
  const candidates = stageEvidence(evidences, STATE_STAGES.MINISTERIO).filter((evidence) =>
    ADMINISTRATIVE_ASSERTIONS.has(assertionOf(evidence))
  );
  const assertions = new Set(candidates.map(assertionOf));
  const hasConflict =
    assertions.has(EVIDENCE_ASSERTIONS.MINISTERIO_APTA) &&
    assertions.has(EVIDENCE_ASSERTIONS.MINISTERIO_NO_APTA);

  if (hasConflict) {
    return {
      state: stageState(MINISTERIO_STATES.REVISION, candidates),
      contradiction: buildBlock({
        tipo: "contradiccion",
        motivo: "evidencias_ministeriales_incompatibles",
        etapa: STATE_STAGES.MINISTERIO,
        evidences: candidates,
        detalles: {
          afirmaciones: [...assertions].sort((left, right) => left.localeCompare(right, "es")),
        },
      }),
    };
  }

  if (assertions.has(EVIDENCE_ASSERTIONS.MINISTERIO_APTA)) {
    return { state: stageState(MINISTERIO_STATES.APTA, candidates), contradiction: null };
  }
  if (assertions.has(EVIDENCE_ASSERTIONS.MINISTERIO_NO_APTA)) {
    return {
      state: stageState(MINISTERIO_STATES.NO_APTA, candidates),
      contradiction: null,
    };
  }
  if (assertions.has(EVIDENCE_ASSERTIONS.MINISTERIO_OBSERVADA)) {
    return {
      state: stageState(MINISTERIO_STATES.OBSERVADA, candidates),
      contradiction: null,
    };
  }
  if (assertions.has(EVIDENCE_ASSERTIONS.MINISTERIO_OMITIDA)) {
    return {
      state: stageState(MINISTERIO_STATES.OMITIDA, candidates),
      contradiction: null,
    };
  }
  if (assertions.has(EVIDENCE_ASSERTIONS.MINISTERIO_REZAGADA)) {
    return {
      state: stageState(MINISTERIO_STATES.REZAGADA, candidates),
      contradiction: null,
    };
  }

  const absenceStatus = absenceStatusFor(stageEvaluation);
  if (absenceStatus === "possible_omission") {
    return {
      state: stageState(MINISTERIO_STATES.POSIBLE_OMISION),
      contradiction: null,
    };
  }

  return {
    state: stageState(MINISTERIO_STATES.SIN_DATO),
    contradiction: null,
  };
};

const deriveResolucion = (evidences, ministerio) => {
  const candidates = stageEvidence(evidences, STATE_STAGES.RESOLUCION).filter(
    (evidence) => assertionOf(evidence) === EVIDENCE_ASSERTIONS.RESOLUCION_TITULARIZADA
  );
  if (candidates.length) {
    return {
      state: stageState(RESOLUCION_STATES.TITULARIZADA, candidates),
      contradiction:
        ministerio.value === MINISTERIO_STATES.NO_APTA
          ? buildBlock({
              tipo: "contradiccion",
              motivo: "ministerio_no_apta_y_resolucion_titularizada",
              etapa: STATE_STAGES.RESOLUCION,
              evidences: candidates,
              detalles: { ministerio: ministerio.value },
            })
          : null,
    };
  }

  if (ministerio.value === MINISTERIO_STATES.APTA) {
    return {
      state: stageState(RESOLUCION_STATES.PENDIENTE),
      contradiction: null,
    };
  }

  return {
    state: stageState(RESOLUCION_STATES.SIN_DATO),
    contradiction: null,
  };
};

const normalizeInput = (input = {}, contextArgument = {}) => {
  if (Array.isArray(input)) {
    return {
      evidences: input,
      stageEvaluations: contextArgument?.stageEvaluations || {},
      context: contextArgument || {},
    };
  }

  return {
    evidences: Array.isArray(input.evidences) ? input.evidences : [],
    stageEvaluations: input.stageEvaluations || {},
    context: input.context || contextArgument || {},
  };
};

const manualDecisionContradiction = (manualDecisions) => {
  const hasConfirmed = manualDecisions.some(
    (evidence) => assertionOf(evidence) === EVIDENCE_ASSERTIONS.MATCH_CONFIRMADO
  );
  const hasRejected = manualDecisions.some(
    (evidence) => assertionOf(evidence) === EVIDENCE_ASSERTIONS.MATCH_RECHAZADO
  );
  if (!hasConfirmed || !hasRejected) return null;

  return buildBlock({
    tipo: "contradiccion",
    motivo: "decisiones_manuales_de_match_incompatibles",
    etapa: STATE_STAGES.SIDCA,
    evidences: manualDecisions,
    detalles: { afirmaciones: ["match_confirmado", "match_rechazado"] },
  });
};

export const deriveSituationLabel = (state = {}) => {
  if (state.bloqueo?.tipo === "contradiccion") return SITUATION_LABELS.CONTRADICTORIA;
  // La etiqueta específica conserva la causa visible; el bloqueo sigue
  // indicando que requiere revisión humana.
  if (state.sidca === SIDCA_STATES.PRESENTADA_SIN_SOLICITUD) {
    return SITUATION_LABELS.PRESENTADA_SIN_SOLICITUD;
  }
  if (state.bloqueo) return SITUATION_LABELS.REQUIERE_REVISION;

  if (state.resolucion === RESOLUCION_STATES.TITULARIZADA) {
    return SITUATION_LABELS.TITULARIZADA;
  }
  if (state.ministerio === MINISTERIO_STATES.NO_APTA) return SITUATION_LABELS.NO_APTA;
  if (state.ministerio === MINISTERIO_STATES.OBSERVADA) return SITUATION_LABELS.OBSERVADA;
  if (state.ministerio === MINISTERIO_STATES.OMITIDA) return SITUATION_LABELS.OMITIDA;
  if (state.ministerio === MINISTERIO_STATES.REZAGADA) return SITUATION_LABELS.REZAGADA;
  if (state.ministerio === MINISTERIO_STATES.APTA) {
    return SITUATION_LABELS.APTA_PENDIENTE_RESOLUCION;
  }
  if (state.ministerio === MINISTERIO_STATES.POSIBLE_OMISION) {
    return SITUATION_LABELS.POSIBLE_OMISION_MINISTERIO;
  }
  if (state.sidca === SIDCA_STATES.POSIBLE_OMISION) {
    return SITUATION_LABELS.POSIBLE_OMISION_SIDCA;
  }
  if (state.sidca === SIDCA_STATES.PRESENTADA) return SITUATION_LABELS.PRESENTADA_SIDCA;
  if (state.solicitud === SOLICITUD_STATES.DECLARADA) return SITUATION_LABELS.DECLARADA;
  return SITUATION_LABELS.SIN_DATO;
};

export const deriveSituationState = (input = {}, contextArgument = {}) => {
  const { evidences: inputEvidences, stageEvaluations, context } = normalizeInput(
    input,
    contextArgument
  );
  const evidences = inputEvidences.filter(Boolean).slice();
  const revoked = resolveRevokedEvidences(evidences);
  const effectiveEvidences = filterEffectiveEvidences(revoked.evidences, context);
  const solicitud = deriveSolicitud(effectiveEvidences, context);
  const sidca = deriveSidca(
    effectiveEvidences,
    stageEvaluations[STATE_STAGES.SIDCA] || {},
    solicitud,
    context
  );
  const ministerio = deriveMinisterio(
    effectiveEvidences,
    stageEvaluations[STATE_STAGES.MINISTERIO] || {}
  );
  const resolucion = deriveResolucion(effectiveEvidences, ministerio.state);
  const manualContradiction = manualDecisionContradiction(sidca.manualDecisions);
  const contradictions = [
    ministerio.contradiction,
    resolucion.contradiction,
    manualContradiction,
  ].filter(Boolean);

  if (
    sidca.state.value === SIDCA_STATES.POSIBLE_OMISION &&
    ministerio.state.value === MINISTERIO_STATES.APTA
  ) {
    contradictions.push(
      buildBlock({
        tipo: "contradiccion",
        motivo: "posible_omision_sidca_y_ministerio_apta",
        etapa: STATE_STAGES.MINISTERIO,
        evidences: [
          ...effectiveEvidences.filter(
            (evidence) => stageOf(evidence) === STATE_STAGES.MINISTERIO
          ),
        ],
        detalles: {
          sidca: sidca.state.value,
          ministerio: ministerio.state.value,
        },
      })
    );
  }

  const bloqueo = contradictions.length
    ? {
        tipo: "contradiccion",
        motivo: contradictions[0].motivo,
        etapa: contradictions[0].etapa,
        evidenceIds: uniqueSortedIds(
          contradictions.flatMap((contradiction) => contradiction.evidenceIds || [])
        ),
        detalles: contradictions.map((contradiction) => ({
          motivo: contradiction.motivo,
          etapa: contradiction.etapa,
          detalles: contradiction.detalles,
        })),
      }
    : sidca.block;

  const result = {
    solicitud: solicitud.value,
    sidca: sidca.state.value,
    ministerio: ministerio.state.value,
    resolucion: resolucion.state.value,
    bloqueo,
    etiqueta: null,
    evidenciaEfectivaIds: evidenceIds(effectiveEvidences),
    evidenciaIgnoradaIds: uniqueSortedIds(
      evidences
        .map(evidenceIdOf)
        .filter((id) => isMeaningfulId(id))
        .filter(
          (id) =>
            !effectiveEvidences.some((evidence) => idKey(evidenceIdOf(evidence)) === idKey(id)) &&
            !revoked.revokedEvidenceIds.includes(idKey(id))
        )
    ),
    evidenciaRevocadaIds: revoked.revokedEvidenceIds,
    version: STATE_ALGORITHM_VERSION,
  };
  result.etiqueta = deriveSituationLabel(result);
  return result;
};

const eventTypeOf = (event = {}) =>
  normalizeSearchText(event.tipo || event.eventType || event.evento || "")
    .replace(/\s+/g, "_");

export const derivePersonSummary = (situationStates = [], personEvents = []) => {
  const states = Array.isArray(situationStates) ? situationStates : [];
  const events = Array.isArray(personEvents) ? personEvents : [];
  const totalSituaciones = states.length;
  const titularizadas = states.filter(
    (state) => state.resolucion === RESOLUCION_STATES.TITULARIZADA
  ).length;
  const aptas = states.filter((state) => state.ministerio === MINISTERIO_STATES.APTA).length;
  const noAptas = states.filter(
    (state) => state.ministerio === MINISTERIO_STATES.NO_APTA
  ).length;
  const observadas = states.filter(
    (state) => state.ministerio === MINISTERIO_STATES.OBSERVADA
  ).length;
  const omitidasSidca = states.filter(
    (state) => state.sidca === SIDCA_STATES.POSIBLE_OMISION
  ).length;
  const omitidasMinisterio = states.filter(
    (state) => state.ministerio === MINISTERIO_STATES.POSIBLE_OMISION
  ).length;
  const contradictorias = states.filter(
    (state) =>
      state.bloqueo?.tipo === "contradiccion" ||
      state.etiqueta === SITUATION_LABELS.CONTRADICTORIA
  ).length;
  const enRevision = states.filter(
    (state) =>
      state.bloqueo?.tipo === "revision" ||
      state.etiqueta === SITUATION_LABELS.REQUIERE_REVISION
  ).length;
  const sinDato = states.filter(
    (state) =>
      state.etiqueta === SITUATION_LABELS.SIN_DATO ||
      (state.solicitud === SOLICITUD_STATES.SIN_DATO &&
        state.sidca === SIDCA_STATES.SIN_DATO &&
        state.ministerio === MINISTERIO_STATES.SIN_DATO &&
        state.resolucion === RESOLUCION_STATES.SIN_DATO)
  ).length;

  const eventos = {
    reclamo: 0,
    reapertura: 0,
    renunciaCondicional: 0,
    otros: 0,
  };
  events.forEach((event) => {
    const type = eventTypeOf(event);
    if (type === "reclamo") eventos.reclamo += 1;
    else if (type === "reapertura" || type === "reapertura_de_gestion") eventos.reapertura += 1;
    else if (type === "renuncia_condicional") eventos.renunciaCondicional += 1;
    else eventos.otros += 1;
  });

  let etiqueta = PERSON_LABELS.EN_TRAMITE;
  if (contradictorias > 0 || enRevision > 0) {
    etiqueta = PERSON_LABELS.REQUIERE_REVISION;
  } else if (totalSituaciones === 0) {
    etiqueta = PERSON_LABELS.SIN_SITUACION_ESTRUCTURADA;
  } else if (titularizadas === totalSituaciones) {
    etiqueta = PERSON_LABELS.TITULARIZACION_COMPLETA;
  } else if (titularizadas > 0 && titularizadas < totalSituaciones) {
    etiqueta = PERSON_LABELS.TITULARIZACION_PARCIAL;
  } else if (titularizadas === 0 && noAptas === totalSituaciones) {
    etiqueta = PERSON_LABELS.NO_TITULARIZADA;
  } else if (omitidasSidca + omitidasMinisterio > 0) {
    etiqueta = PERSON_LABELS.CON_OMISIONES;
  }

  return {
    totalSituaciones,
    titularizadas,
    aptas,
    noAptas,
    observadas,
    omitidasSidca,
    omitidasMinisterio,
    enRevision,
    contradictorias,
    sinDato,
    eventos,
    etiqueta,
    version: STATE_ALGORITHM_VERSION,
  };
};
