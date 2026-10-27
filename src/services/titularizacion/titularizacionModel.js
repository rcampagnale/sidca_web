export const TITULARIZACION_MATCH_REVIEW_STATUSES = ["posible", "revision"];

const fnv1a = (value) => {
  let hash = 2166136261;
  String(value || "").split("").forEach((character) => {
    hash ^= character.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  });
  return (hash >>> 0).toString(36);
};

const timestampRank = (value) => {
  if (!value) return 0;
  if (typeof value.toMillis === "function") return value.toMillis();
  if (value instanceof Date) return value.getTime();
  if (typeof value === "number") return value;
  if (typeof value.seconds === "number") return value.seconds * 1000;
  return 0;
};

const evidenceRank = (evidence = {}) =>
  Math.max(
    timestampRank(evidence.decididoEn),
    timestampRank(evidence.createdAt),
    timestampRank(evidence.updatedAt)
  );

const isConfirmedEvidence = (evidence = {}) =>
  evidence.matchStatus === "confirmada" || evidence.estadoActual === "presentada_sidca";

const isReviewEvidence = (evidence = {}) =>
  TITULARIZACION_MATCH_REVIEW_STATUSES.includes(evidence.matchStatus) ||
  evidence.tipo === "revision" ||
  evidence.tipoInconsistencia === "revision";

export const hashTitularizacionValue = (value) => fnv1a(value);

export const createDeterministicId = (prefix, value) =>
  `${prefix}_${hashTitularizacionValue(value)}`;

export const buildSituationOriginKey = ({
  sourceId = "",
  respuestaId = "",
  indiceRegistroOriginal = "",
} = {}) =>
  [sourceId, respuestaId, indiceRegistroOriginal]
    .map((value) => String(value ?? ""))
    .join("|");

export const createSituationIdFromOrigin = (origin = {}) =>
  createDeterministicId(
    "situacion",
    buildSituationOriginKey(origin)
  );

export const createEvidenceId = ({
  sourceId = "",
  importId = "",
  registroId = "",
  tipo = "",
} = {}) =>
  createDeterministicId(
    "evidencia",
    [sourceId, importId, registroId, tipo].map((value) => String(value ?? "")).join("|")
  );

export const createEventId = ({
  sourceId = "",
  formularioId = "",
  respuestaId = "",
  tipo = "",
} = {}) =>
  createDeterministicId(
    "evento",
    [sourceId, formularioId, respuestaId, tipo].map((value) => String(value ?? "")).join("|")
  );

export const eventTypeForSourceRole = (role = "") => {
  if (role === "reclamo") return "reclamo";
  if (role === "reapertura") return "reapertura";
  if (role === "otra_solicitud") return "otra_actuacion_administrativa";
  return "solicitud_sin_situacion";
};

export const deriveSituationSummary = (evidencias = []) => {
  const normalized = Array.isArray(evidencias) ? evidencias.filter(Boolean) : [];
  const confirmed = normalized.some(isConfirmedEvidence);
  const requiresReview = normalized.some(isReviewEvidence);
  const latest = [...normalized].sort((left, right) => evidenceRank(left) - evidenceRank(right)).pop();
  const maxVersion = normalized.reduce(
    (version, evidence) => Math.max(version, Number(evidence.version) || 0),
    0
  );

  return {
    presentadaSidca: confirmed,
    requiereRevision: requiresReview,
    estadoActual: confirmed
      ? "presentada_sidca"
      : requiresReview
        ? "requiere_revision"
        : "declarada",
    ultimaEvidenciaAt: latest?.decididoEn || latest?.createdAt || null,
    version: Math.max(1, maxVersion || normalized.length || 1),
  };
};

export const evidenceToSourceRef = (evidence = {}) => ({
  sourceId: evidence.sourceId || "",
  formularioId: evidence.formularioId || "",
  formularioTitulo: evidence.formularioTitulo || "",
  rol: evidence.rolFuente || evidence.rol || "",
  respuestaId: evidence.respuestaId || "",
  indiceRegistro: evidence.indiceRegistro ?? null,
  importId: evidence.importId || "",
  registroId: evidence.registroId || "",
  numeroFila: evidence.numeroFila ?? null,
  origen: evidence.origen || "automatico",
});

export const materializeSituationWorkflow = (situation = {}, evidencias = []) => {
  const estadoResumen = evidencias.length
    ? deriveSituationSummary(evidencias)
    : {
        ...deriveSituationSummary([]),
        ...(situation.estadoResumen || {}),
      };
  const orderedEvidence = [...(Array.isArray(evidencias) ? evidencias : [])].sort(
    (left, right) => evidenceRank(left) - evidenceRank(right)
  );
  const latest = orderedEvidence[orderedEvidence.length - 1] || {};
  const sourceRefs = orderedEvidence.map(evidenceToSourceRef);

  return {
    ...situation,
    estadoResumen,
    presentadoSidca: estadoResumen.presentadaSidca,
    estado: estadoResumen.estadoActual,
    matchStatus: latest.matchStatus ?? null,
    matchScore: latest.matchScore ?? null,
    razonesMatch: latest.razones || [],
    diferenciasMatch: latest.diferencias || [],
    sourceRefs,
    evidencias,
  };
};
