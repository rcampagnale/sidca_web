import { isValidDni, normalizeDni } from "./titularizacionNormalizer";
import { STATE_ALGORITHM_VERSION } from "./titularizacionStateModel";
import { validateSourceDefinition } from "./titularizacionSourceModel";

export { STATE_ALGORITHM_VERSION };

export const TITULARIZACION_SCHEMA_VERSION = 1;
export const TITULARIZACION_PERSISTENCE_ENABLED = false;
export const TITULARIZACION_BATCH_SIZE = 400;

export const TITULARIZACION_ROOT_COLLECTION = "titularizacion";
export const TITULARIZACION_PROCESS_ID = "proceso_2026";
export const TITULARIZACION_PROCESS_PATH = `${TITULARIZACION_ROOT_COLLECTION}/${TITULARIZACION_PROCESS_ID}`;
export const TITULARIZACION_PEOPLE_COLLECTION = "personas";
export const TITULARIZACION_SOURCES_COLLECTION = "fuentes";
export const TITULARIZACION_IMPORTS_COLLECTION = "importaciones";
export const TITULARIZACION_IMPORTED_RECORDS_COLLECTION = "registros_importados";
export const TITULARIZACION_EVIDENCES_COLLECTION = "evidencias";
export const TITULARIZACION_EVENTS_COLLECTION = "eventos";
export const TITULARIZACION_REVIEWS_COLLECTION = "revisiones";
export const TITULARIZACION_OBSERVATIONS_COLLECTION = "observaciones";
export const TITULARIZACION_SITUATIONS_COLLECTION = "situaciones";

export const TITULARIZACION_COLLECTION_NAMES = Object.freeze({
  root: TITULARIZACION_ROOT_COLLECTION,
  people: TITULARIZACION_PEOPLE_COLLECTION,
  sources: TITULARIZACION_SOURCES_COLLECTION,
  imports: TITULARIZACION_IMPORTS_COLLECTION,
  importedRecords: TITULARIZACION_IMPORTED_RECORDS_COLLECTION,
  evidences: TITULARIZACION_EVIDENCES_COLLECTION,
  events: TITULARIZACION_EVENTS_COLLECTION,
  reviews: TITULARIZACION_REVIEWS_COLLECTION,
  observations: TITULARIZACION_OBSERVATIONS_COLLECTION,
  situations: TITULARIZACION_SITUATIONS_COLLECTION,
});

export const TITULARIZACION_PROCESS_STATES = Object.freeze([
  "configuracion",
  "activo",
  "cerrado",
]);

export const TITULARIZACION_IMPORT_STATES = Object.freeze([
  "processing",
  "completed",
  "failed",
]);

export const TITULARIZACION_COUNTER_FIELDS = Object.freeze([
  "personas",
  "situaciones",
  "sinSituacionEstructurada",
  "titularizadas",
  "enRevision",
  "posiblesOmisionesSidca",
  "posiblesOmisionesMinisterio",
  "noAptas",
  "observadas",
  "enTramite",
]);

export const EMPTY_TITULARIZACION_COUNTERS = Object.freeze(
  Object.fromEntries(TITULARIZACION_COUNTER_FIELDS.map((field) => [field, 0]))
);

const path = (...segments) => segments.map((segment) => String(segment)).join("/");

export const titularizacionProcessPath = (procesoId = TITULARIZACION_PROCESS_ID) =>
  path(TITULARIZACION_ROOT_COLLECTION, procesoId);

export const titularizacionPersonPath = (
  dni,
  procesoId = TITULARIZACION_PROCESS_ID
) => path(titularizacionProcessPath(procesoId), TITULARIZACION_PEOPLE_COLLECTION, dni);

export const titularizacionSituationPath = (
  dni,
  situacionId,
  procesoId = TITULARIZACION_PROCESS_ID
) => path(titularizacionPersonPath(dni, procesoId), TITULARIZACION_SITUATIONS_COLLECTION, situacionId);

export const titularizacionEvidencePath = (
  dni,
  situacionId,
  evidenceId,
  procesoId = TITULARIZACION_PROCESS_ID
) => path(titularizacionSituationPath(dni, situacionId, procesoId), TITULARIZACION_EVIDENCES_COLLECTION, evidenceId);

export const titularizacionPersonEventsCollectionPath = (
  dni,
  procesoId = TITULARIZACION_PROCESS_ID
) => path(titularizacionPersonPath(dni, procesoId), TITULARIZACION_EVENTS_COLLECTION);

export const titularizacionEventPath = (
  dni,
  eventId,
  procesoId = TITULARIZACION_PROCESS_ID
) => path(titularizacionPersonEventsCollectionPath(dni, procesoId), eventId);

export const titularizacionSourcePath = (
  sourceId,
  procesoId = TITULARIZACION_PROCESS_ID
) => path(titularizacionProcessPath(procesoId), TITULARIZACION_SOURCES_COLLECTION, sourceId);

export const titularizacionImportPath = (
  importId,
  procesoId = TITULARIZACION_PROCESS_ID
) => path(titularizacionProcessPath(procesoId), TITULARIZACION_IMPORTS_COLLECTION, importId);

export const titularizacionImportedRecordPath = (
  importId,
  registroId,
  procesoId = TITULARIZACION_PROCESS_ID
) => path(titularizacionImportPath(importId, procesoId), TITULARIZACION_IMPORTED_RECORDS_COLLECTION, registroId);

export const titularizacionObservationPath = (
  observacionId,
  procesoId = TITULARIZACION_PROCESS_ID
) => path(titularizacionProcessPath(procesoId), TITULARIZACION_OBSERVATIONS_COLLECTION, observacionId);

export const titularizacionReviewPath = (
  revisionId,
  procesoId = TITULARIZACION_PROCESS_ID
) => path(titularizacionProcessPath(procesoId), TITULARIZACION_REVIEWS_COLLECTION, revisionId);

const isPlainObject = (value) => {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
};

export const removeUndefined = (value) => {
  if (Array.isArray(value)) return value.filter((item) => item !== undefined).map(removeUndefined);
  if (!isPlainObject(value)) return value;
  return Object.fromEntries(
    Object.entries(value)
      .filter(([, nestedValue]) => nestedValue !== undefined)
      .map(([key, nestedValue]) => [key, removeUndefined(nestedValue)])
  );
};

const valueOr = (source, key, fallback) =>
  source[key] === undefined ? fallback : source[key];

export const serializeProcessForFirestore = (process = {}) =>
  removeUndefined({
    procesoId: valueOr(process, "procesoId", TITULARIZACION_PROCESS_ID),
    nombre: process.nombre,
    schemaVersion: valueOr(process, "schemaVersion", TITULARIZACION_SCHEMA_VERSION),
    stateAlgorithmVersion: valueOr(
      process,
      "stateAlgorithmVersion",
      STATE_ALGORITHM_VERSION
    ),
    estadoProceso: valueOr(process, "estadoProceso", "configuracion"),
    fuentesHabilitadas: valueOr(process, "fuentesHabilitadas", []),
    contadores: valueOr(process, "contadores", { ...EMPTY_TITULARIZACION_COUNTERS }),
    createdAt: process.createdAt,
    updatedAt: process.updatedAt,
  });

export const serializePersonForFirestore = (person = {}) => {
  const resumen = person.resumen;
  const cantidadSituaciones =
    person.cantidadSituaciones ?? resumen?.totalSituaciones ?? 0;
  return removeUndefined({
    procesoId: person.procesoId,
    dni: person.dni,
    apellido: person.apellido,
    nombre: person.nombre,
    nombreCompleto: person.nombreCompleto,
    departamento: person.departamento,
    email: person.email,
    telefono: person.telefono,
    cantidadSituaciones,
    resumen,
    createdAt: person.createdAt,
    updatedAt: person.updatedAt,
  });
};

export const serializeSituationForFirestore = (situation = {}) =>
  removeUndefined({
    procesoId: situation.procesoId,
    dni: situation.dni,
    situacionId: situation.situacionId ?? situation.id,
    cargo: situation.cargo,
    horas: situation.horas,
    materia: situation.materia,
    establecimiento: situation.establecimiento,
    nivel: situation.nivel,
    modalidad: situation.modalidad,
    cursoAnio: situation.cursoAnio,
    fingerprintCore: situation.fingerprintCore,
    fingerprintFull: situation.fingerprintFull,
    origen: situation.origen,
    estadoResumen: situation.estadoResumen,
    createdAt: situation.createdAt,
    updatedAt: situation.updatedAt,
  });

export const serializeEvidenceForFirestore = (evidence = {}) => {
  const similarityScore = evidence.similarityScore ?? evidence.matchScore;
  return removeUndefined({
    procesoId: evidence.procesoId,
    dni: evidence.dni,
    situacionId: evidence.situacionId,
    evidenceId: evidence.evidenceId ?? evidence.id,
    etapa: evidence.etapa,
    afirma: evidence.afirma,
    sourceId: evidence.sourceId,
    sourceVersion: evidence.sourceVersion,
    formularioId: evidence.formularioId,
    respuestaId: evidence.respuestaId,
    importId: evidence.importId,
    registroId: evidence.registroId,
    numeroFila: evidence.numeroFila,
    origen: evidence.origen,
    similarityScore,
    fieldCoverage: evidence.fieldCoverage,
    strongMatches: evidence.strongMatches,
    razones: evidence.razones,
    diferencias: evidence.diferencias,
    cardinality: evidence.cardinality,
    decision: evidence.decision,
    decididoPor: evidence.decididoPor,
    decididoEn: evidence.decididoEn,
    revocaEvidenceId: evidence.revocaEvidenceId,
    createdAt: evidence.createdAt,
  });
};

export const serializeEventForFirestore = (event = {}) =>
  removeUndefined({
    procesoId: event.procesoId,
    dni: event.dni,
    eventId: event.eventId ?? event.id,
    tipo: event.tipo,
    sourceId: event.sourceId,
    formularioId: event.formularioId,
    respuestaId: event.respuestaId,
    importId: event.importId,
    registroId: event.registroId,
    rolFuente: event.rolFuente,
    createdAt: event.createdAt,
  });

export const serializeSourceForFirestore = (source = {}) =>
  removeUndefined({
    sourceId: source.sourceId,
    nombre: source.nombre,
    stage: source.stage,
    sourceScope: source.sourceScope,
    coverage: source.coverage,
    scope: source.scope,
    version: source.version,
    supersedes: source.supersedes,
    vigente: source.vigente,
    sourceDate: source.sourceDate,
    coverageDeclaredBy: source.coverageDeclaredBy,
    coverageDeclaredAt: source.coverageDeclaredAt,
    formularioId: source.formularioId,
    archivo: source.archivo,
    metadata: source.metadata,
    createdAt: source.createdAt,
    updatedAt: source.updatedAt,
  });

export const serializeImportForFirestore = (importDocument = {}) =>
  removeUndefined({
    procesoId: importDocument.procesoId,
    importId: importDocument.importId ?? importDocument.id,
    sourceId: importDocument.sourceId,
    fileName: importDocument.fileName,
    fileHash: importDocument.fileHash,
    mapping: importDocument.mapping,
    estado: importDocument.estado,
    totalRegistros: importDocument.totalRegistros,
    procesados: importDocument.procesados,
    vinculados: importDocument.vinculados,
    revision: importDocument.revision,
    noVinculados: importDocument.noVinculados,
    error: importDocument.error,
    startedAt: importDocument.startedAt,
    completedAt: importDocument.completedAt,
    importedBy: importDocument.importedBy,
  });

export const serializeImportedRecordForFirestore = (record = {}) =>
  removeUndefined({
    procesoId: record.procesoId,
    importId: record.importId,
    sourceId: record.sourceId,
    registroId: record.registroId ?? record.id,
    numeroFila: record.numeroFila,
    valoresOriginales: record.valoresOriginales,
    valoresNormalizados: record.valoresNormalizados,
    resultadoMatching: record.resultadoMatching,
    situacionIdVinculada: record.situacionIdVinculada,
    createdAt: record.createdAt,
  });

export const serializeObservationForFirestore = (observation = {}) =>
  removeUndefined({
    procesoId: observation.procesoId,
    dni: observation.dni,
    situacionId: observation.situacionId,
    observacionId: observation.observacionId ?? observation.id,
    texto: observation.texto,
    autorUid: observation.autorUid,
    autorNombre: observation.autorNombre,
    createdAt: observation.createdAt,
  });

const fnv1a = (value) => {
  let hash = 2166136261;
  String(value).split("").forEach((character) => {
    hash ^= character.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  });
  return (hash >>> 0).toString(36);
};

const hashParts = (parts) => fnv1a(parts.map((part) => String(part ?? "")).join("|"));

export const createAutomaticEvidenceId = ({
  sourceId = "",
  importId = "",
  registroId = "",
  etapa = "",
  afirma = "",
  situacionId = "",
} = {}) =>
  `evidencia_${hashParts([sourceId, importId, registroId, etapa, afirma, situacionId])}`;

export const createHumanDecisionId = ({ decisionId, ...parts } = {}) =>
  decisionId || `decision_${hashParts(Object.entries(parts).sort().flat())}`;

export const deriveProcessCounters = (personSummaries = []) => {
  const summaries = Array.isArray(personSummaries) ? personSummaries : [];
  const counters = { ...EMPTY_TITULARIZACION_COUNTERS, personas: summaries.length };
  summaries.forEach((person) => {
    const summary = person?.resumen || person || {};
    const total = Number(summary.totalSituaciones ?? person?.cantidadSituaciones ?? 0) || 0;
    counters.situaciones += total;
    counters.titularizadas += Number(summary.titularizadas) || 0;
    counters.enRevision += Number(summary.enRevision) || 0;
    counters.posiblesOmisionesSidca += Number(summary.omitidasSidca) || 0;
    counters.posiblesOmisionesMinisterio += Number(summary.omitidasMinisterio) || 0;
    counters.noAptas += Number(summary.noAptas) || 0;
    counters.observadas += Number(summary.observadas) || 0;
    if (total === 0) counters.sinSituacionEstructurada += 1;
    if (summary.etiqueta === "EN_TRAMITE") counters.enTramite += 1;
  });
  return counters;
};

const validationResult = (errors = [], warnings = []) => ({
  valid: errors.length === 0,
  errors,
  warnings,
});

const requireFields = (document, fields, errors) => {
  fields.forEach((field) => {
    if (document[field] === undefined || document[field] === null || document[field] === "") {
      errors.push(`${field}_requerido`);
    }
  });
};

export const validatePersonDocument = (person = {}, { documentId } = {}) => {
  const errors = [];
  const warnings = [];
  requireFields(person, ["procesoId", "dni"], errors);
  if (documentId !== undefined && normalizeDni(person.dni) !== normalizeDni(documentId)) {
    errors.push("dni_no_coincide_con_id_padre");
  }
  if (person.dni && !isValidDni(person.dni)) warnings.push("dni_invalido_para_persona_canonica");
  if (person.resumen === undefined) warnings.push("resumen_ausente");
  return validationResult(errors, warnings);
};

export const validateSituationDocument = (
  situation = {},
  { parentDni, parentProcessId } = {}
) => {
  const errors = [];
  const warnings = [];
  requireFields(situation, ["procesoId", "dni", "situacionId"], errors);
  if (parentDni !== undefined && normalizeDni(situation.dni) !== normalizeDni(parentDni)) {
    errors.push("dni_no_coincide_con_persona_padre");
  }
  if (parentProcessId !== undefined && situation.procesoId !== parentProcessId) {
    errors.push("procesoId_no_coincide_con_proceso_padre");
  }
  if (situation.fingerprintCore === undefined || situation.fingerprintFull === undefined) {
    warnings.push("fingerprints_incompletos");
  }
  return validationResult(errors, warnings);
};

export const validateEvidenceDocument = (
  evidence = {},
  { parentDni, parentSituationId } = {}
) => {
  const errors = [];
  const warnings = [];
  requireFields(evidence, ["procesoId", "dni", "situacionId", "evidenceId", "etapa", "afirma"], errors);
  if (parentDni !== undefined && normalizeDni(evidence.dni) !== normalizeDni(parentDni)) {
    errors.push("dni_no_coincide_con_persona_padre");
  }
  if (parentSituationId !== undefined && evidence.situacionId !== parentSituationId) {
    errors.push("situacionId_no_coincide_con_padre");
  }
  if (evidence.origen === "automatico" && !evidence.sourceId) {
    errors.push("sourceId_requerido_para_evidencia_automatica");
  }
  if (evidence.origen === "automatico" && !evidence.respuestaId && !evidence.importId) {
    warnings.push("procedencia_automatica_incompleta");
  }
  return validationResult(errors, warnings);
};

export const validateEventDocument = (event = {}, { parentDni, parentProcessId } = {}) => {
  const errors = [];
  const warnings = [];
  requireFields(event, ["procesoId", "dni", "eventId", "tipo"], errors);
  if (event.situacionId !== undefined) errors.push("evento_no_debe_tener_situacionId");
  if (parentDni !== undefined && normalizeDni(event.dni) !== normalizeDni(parentDni)) {
    errors.push("dni_no_coincide_con_persona_padre");
  }
  if (parentProcessId !== undefined && event.procesoId !== parentProcessId) {
    errors.push("procesoId_no_coincide_con_proceso_padre");
  }
  return validationResult(errors, warnings);
};

export const validateImportDocument = (importDocument = {}) => {
  const errors = [];
  const warnings = [];
  requireFields(
    importDocument,
    ["procesoId", "importId", "sourceId", "fileName", "fileHash", "estado"],
    errors
  );
  if (importDocument.estado && !TITULARIZACION_IMPORT_STATES.includes(importDocument.estado)) {
    errors.push("estado_importacion_invalido");
  }
  return validationResult(errors, warnings);
};

export const validateObservationDocument = (observation = {}) => {
  const errors = [];
  const warnings = [];
  requireFields(observation, ["procesoId", "observacionId", "texto"], errors);
  return validationResult(errors, warnings);
};

export const validateSourceDocument = (source = {}) => {
  const modelValidation = validateSourceDefinition(source);
  const errors = [...modelValidation.errors];
  const warnings = [...modelValidation.warnings];
  requireFields(source, ["sourceId", "stage", "sourceScope", "coverage", "version"], errors);
  return validationResult(errors, warnings);
};

export const TITULARIZACION_QUERY_PLAN = Object.freeze({
  dashboard: {
    type: "document",
    pathTemplate: `${TITULARIZACION_PROCESS_PATH}`,
    reads: ["contadores"],
  },
  peoplePage: {
    type: "collection",
    pathTemplate: `${TITULARIZACION_PROCESS_PATH}/${TITULARIZACION_PEOPLE_COLLECTION}`,
    orderBy: ["apellido", "nombreCompleto"],
    limit: 50,
    directDniLookup: true,
  },
  personDetail: {
    type: "document_and_subcollection",
    reads: ["persona", "situaciones"],
    evidence: "on_demand_per_situation",
    collectionGroup: false,
  },
  reviewQueue: {
    type: "collectionGroup",
    collectionGroup: TITULARIZACION_SITUATIONS_COLLECTION,
    filters: [
      ["procesoId", "==", TITULARIZACION_PROCESS_ID],
      ["estadoResumen.requiereRevision", "==", true],
    ],
    paginated: true,
  },
  omissionQueue: {
    type: "collectionGroup",
    collectionGroup: TITULARIZACION_SITUATIONS_COLLECTION,
    filters: [["procesoId", "==", TITULARIZACION_PROCESS_ID]],
    clientLabelFilter: "estadoResumen.etiqueta",
    indexAdded: false,
  },
  situationEvidence: {
    type: "subcollection",
    reads: "evidencias",
    collectionGroup: false,
  },
  importDetail: {
    type: "document_and_subcollection",
    reads: ["importacion", "registros_importados"],
    collectionGroup: false,
  },
});

export const TITULARIZACION_INDEX_PLAN = Object.freeze([
  {
    type: "fieldOverride",
    collectionGroup: TITULARIZACION_SITUATIONS_COLLECTION,
    fieldPath: "procesoId",
    queryScope: "COLLECTION_GROUP",
    reason: "loadPersistedTitularizacionData y cola de revisión filtran por procesoId",
  },
  {
    type: "fieldOverride",
    collectionGroup: TITULARIZACION_EVIDENCES_COLLECTION,
    fieldPath: "procesoId",
    queryScope: "COLLECTION_GROUP",
    reason: "loadPersistedTitularizacionData filtra evidencias por procesoId",
  },
  {
    type: "fieldOverride",
    collectionGroup: TITULARIZACION_EVENTS_COLLECTION,
    fieldPath: "procesoId",
    queryScope: "COLLECTION_GROUP",
    reason: "loadPersistedTitularizacionData filtra eventos por procesoId",
  },
  {
    type: "fieldOverride",
    collectionGroup: TITULARIZACION_IMPORTED_RECORDS_COLLECTION,
    fieldPath: "procesoId",
    queryScope: "COLLECTION_GROUP",
    reason: "loadTitularizacionPendingData filtra registros por procesoId",
  },
  {
    type: "composite",
    collectionGroup: TITULARIZACION_SITUATIONS_COLLECTION,
    queryScope: "COLLECTION_GROUP",
    fields: [
      { fieldPath: "procesoId", order: "ASCENDING" },
      { fieldPath: "estadoResumen.requiereRevision", order: "ASCENDING" },
    ],
    reason: "cola paginada de situaciones que requieren revisión",
  },
]);
