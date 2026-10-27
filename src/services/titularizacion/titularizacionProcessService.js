import {
  collection,
  collectionGroup,
  doc,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  where,
  writeBatch,
} from "firebase/firestore";

import { db } from "../../firebase/firebase-config";
import {
  buildVisiblePersonName,
  isValidDni,
  normalizeDni,
  normalizeSearchText,
  textValue,
} from "./titularizacionNormalizer";
import {
  buildSituationOriginKey,
  createDeterministicId,
  createEvidenceId,
  createEventId,
  createSituationIdFromOrigin,
  deriveSituationSummary,
  eventTypeForSourceRole,
  materializeSituationWorkflow,
} from "./titularizacionModel";
import {
  DEFAULT_TITULARIZACION_SOURCE_CONFIGS,
  loadTitularizacionData,
  loadTitularizacionSources,
} from "./titularizacionService";
import {
  TITULARIZACION_BATCH_SIZE,
  TITULARIZACION_EVIDENCES_COLLECTION,
  TITULARIZACION_EVENTS_COLLECTION,
  TITULARIZACION_IMPORTED_RECORDS_COLLECTION,
  TITULARIZACION_IMPORTS_COLLECTION,
  TITULARIZACION_OBSERVATIONS_COLLECTION,
  TITULARIZACION_PEOPLE_COLLECTION,
  TITULARIZACION_PERSISTENCE_ENABLED,
  TITULARIZACION_PROCESS_ID,
  TITULARIZACION_PROCESS_PATH,
  TITULARIZACION_ROOT_COLLECTION,
  TITULARIZACION_REVIEWS_COLLECTION,
  TITULARIZACION_SCHEMA_VERSION,
  TITULARIZACION_SITUATIONS_COLLECTION,
  TITULARIZACION_SOURCES_COLLECTION,
} from "./titularizacionFirestoreModel";

export {
  TITULARIZACION_BATCH_SIZE,
  TITULARIZACION_EVIDENCES_COLLECTION,
  TITULARIZACION_EVENTS_COLLECTION,
  TITULARIZACION_IMPORTED_RECORDS_COLLECTION,
  TITULARIZACION_IMPORTS_COLLECTION,
  TITULARIZACION_OBSERVATIONS_COLLECTION,
  TITULARIZACION_PEOPLE_COLLECTION,
  TITULARIZACION_PERSISTENCE_ENABLED,
  TITULARIZACION_PROCESS_ID,
  TITULARIZACION_PROCESS_PATH,
  TITULARIZACION_ROOT_COLLECTION,
  TITULARIZACION_REVIEWS_COLLECTION,
  TITULARIZACION_SCHEMA_VERSION,
  TITULARIZACION_SITUATIONS_COLLECTION,
  TITULARIZACION_SOURCES_COLLECTION,
};

const processRef = () => doc(db, TITULARIZACION_ROOT_COLLECTION, TITULARIZACION_PROCESS_ID);
const peopleCollection = () => collection(processRef(), TITULARIZACION_PEOPLE_COLLECTION);
const sourcesCollection = () => collection(processRef(), TITULARIZACION_SOURCES_COLLECTION);

const firestoreSafe = (value) => {
  if (Array.isArray(value)) return value.map(firestoreSafe);
  if (!value || typeof value !== "object") return value;
  if (value instanceof Date) return value;
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) return value;
  return Object.entries(value).reduce((result, [key, nestedValue]) => {
    if (nestedValue !== undefined) result[key] = firestoreSafe(nestedValue);
    return result;
  }, {});
};

const safeId = (value, fallback = "registro") =>
  String(value || fallback)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9_-]/g, "_")
    .slice(0, 120);

export const createSituationId = (sourceId, respuestaId, indiceRegistroOriginal) =>
  createSituationIdFromOrigin({
    sourceId,
    respuestaId,
    indiceRegistroOriginal,
  });

const buildSourceId = (formularioId) => safeId(`formulario_${formularioId}`);

const toPersonSearchable = (persona) =>
  normalizeSearchText(
    [persona.dni, persona.apellido, persona.nombre, persona.departamento]
      .filter(Boolean)
      .join(" ")
  );

const buildSourcePayload = (formulario, sourceConfig, metrics, respuestas) => ({
  procesoId: TITULARIZACION_PROCESS_ID,
  sourceType: "solicitud_afiliado",
  tipo: "solicitud_afiliado",
  rol: sourceConfig.rol,
  nombre: formulario.titulo || "TITULARIZACIÓN DOCENTE 2026",
  origenTecnico: "oficina_gestion_respuestas",
  formularioId: formulario.id,
  formularioTitulo: formulario.titulo || formulario.id,
  sourceId: sourceConfig.sourceId,
  respuestas: Array.isArray(respuestas) ? respuestas.length : Number(respuestas || 0),
  cantidadRegistros: Array.isArray(respuestas) ? respuestas.length : Number(respuestas || 0),
  personasIdentificadas: metrics.personas,
  personasRevision: metrics.personasRevision,
  cantidadSituaciones: metrics.situacionesCanonicas,
  situaciones: metrics.situacionesCanonicas,
  registrosDescartados: metrics.registrosDescartados || 0,
});

const buildProcessPayload = (formulario, metrics, sourceConfigs, fuentes, casosRevision) => {
  const formularioFuenteIds = sourceConfigs.map((sourceConfig) => sourceConfig.formularioId);
  const fuenteSolicitudIds = sourceConfigs.map((sourceConfig) => sourceConfig.sourceId);
  const fuentesHabilitadas = sourceConfigs.map((sourceConfig) => ({
    sourceId: sourceConfig.sourceId,
    formularioId: sourceConfig.formularioId,
    rol: sourceConfig.rol,
    habilitada: true,
  }));

  return {
    nombre: "Titularización Docente 2026",
    anio: 2026,
    estado: "activo",
    procesoId: TITULARIZACION_PROCESS_ID,
    formularioFuenteIds,
    fuenteSolicitudIds,
    fuentesHabilitadas,
    fuentes: fuentes.map(({ sourceId, formularioId, rol }) => ({
      sourceId,
      formularioId,
      rol,
    })),
    formularioFuenteId: formularioFuenteIds[0] || formulario.id,
    fuenteSolicitudId: fuenteSolicitudIds[0] || buildSourceId(formulario.id),
    respuestasFuente: metrics.respuestas || 0,
    personasPersistidas: metrics.personas,
    situacionesPersistidas: metrics.situacionesCanonicas || metrics.situaciones,
    situacionesRevision: metrics.situacionesRevision || 0,
    personasSinSituacionEstructurada: metrics.personasSinSituacionEstructurada || 0,
    casosRevision,
  };
};

const orderedSourceRefs = (situacion = {}) =>
  [...(Array.isArray(situacion.sourceRefs) ? situacion.sourceRefs : [])].sort((left, right) =>
    buildSituationOriginKey({
      sourceId: left.sourceId || left.formularioId,
      respuestaId: left.respuestaId,
      indiceRegistroOriginal: left.indiceRegistro,
    }).localeCompare(
      buildSituationOriginKey({
        sourceId: right.sourceId || right.formularioId,
        respuestaId: right.respuestaId,
        indiceRegistroOriginal: right.indiceRegistro,
      })
    )
  );

const primarySituationRef = (situacion, sourceId) => {
  const sourceRefs = orderedSourceRefs(situacion);
  return sourceRefs[0] || {
    sourceId,
    respuestaId: situacion.origenRespuestaId || "",
    formularioId: situacion.formularioId || "",
    indiceRegistro: 1,
    origen: situacion.origen || "solicitud_afiliado",
  };
};

const situationBaseData = ({ persona, situacion, existingSituation }) => ({
  dni: normalizeDni(persona.dni),
  cargo: textValue(situacion.cargo),
  horas: textValue(situacion.horas),
  materia: textValue(situacion.materia),
  establecimiento: textValue(situacion.establecimiento),
  nivel: textValue(situacion.nivel),
  modalidad: textValue(situacion.modalidad),
  cursoAnio: textValue(situacion.cursoAnio),
  fingerprint: situacion.fingerprint || situacion.signature || "",
  procesoId: TITULARIZACION_PROCESS_ID,
  estadoResumen: existingSituation?.estadoResumen || deriveSituationSummary([]),
  valoresOriginales: firestoreSafe(situacion.valorOriginal || {}),
});

const newSituationData = (args) => ({
  ...situationBaseData(args),
  estadoResumen: {
    ...deriveSituationSummary([]),
    ultimaEvidenciaAt: serverTimestamp(),
  },
  createdAt: serverTimestamp(),
  updatedAt: serverTimestamp(),
});

const existingSituationSyncData = (args) => ({
  ...situationBaseData(args),
  // El resumen y las evidencias son workflow; la sincronización inicial no los reemplaza.
  estadoResumen: args.existingSituation?.estadoResumen || deriveSituationSummary([]),
  updatedAt: serverTimestamp(),
});

const buildSolicitudEvidence = ({ persona, situacion, sourceRef }) => ({
  procesoId: TITULARIZACION_PROCESS_ID,
  situacionId: "",
  dni: normalizeDni(persona.dni),
  tipo: "solicitud",
  sourceId: sourceRef.sourceId || sourceRef.formularioId || "",
  formularioId: sourceRef.formularioId || "",
  formularioTitulo: sourceRef.formularioTitulo || "",
  rolFuente: sourceRef.rol || "solicitud_inicial",
  respuestaId: sourceRef.respuestaId || "",
  indiceRegistro: sourceRef.indiceRegistro ?? null,
  registroId: `${sourceRef.respuestaId || "respuesta"}_${sourceRef.indiceRegistro ?? ""}`,
  matchStatus: null,
  matchScore: null,
  razones: [],
  diferencias: [],
  origen: "automatico",
  valoresOriginales: firestoreSafe(situacion.valorOriginal || {}),
  createdAt: serverTimestamp(),
});

const buildOperationsFromSource = (
  sourceData,
  existingState = {},
  existingProcess = null
) => {
  const {
    formulario,
    personas,
    respuestas,
    metrics,
    sourceConfigs = [],
    fuentes = [],
  } = sourceData;
  const operations = [];
  const reviewCases = personas.filter((persona) => !isValidDni(persona.dni));
  const canonicalSituationIds = new Set();

  operations.push({
    ref: processRef(),
    data: {
      ...buildProcessPayload(
        formulario,
        { ...metrics, respuestas: respuestas.length },
        sourceConfigs,
        fuentes,
        reviewCases.length
      ),
      ...(existingProcess ? {} : { createdAt: serverTimestamp() }),
      updatedAt: serverTimestamp(),
    },
  });

  fuentes.forEach((fuente) => {
    operations.push({
      ref: doc(sourcesCollection(), fuente.sourceId),
      data: {
        ...buildSourcePayload(
          fuente.formulario,
          fuente,
          fuente.metrics || metrics,
          fuente.respuestas
        ),
        sourceId: fuente.sourceId,
        ...(existingState.sources?.has(fuente.sourceId)
          ? {}
          : { createdAt: serverTimestamp() }),
        updatedAt: serverTimestamp(),
      },
    });
  });

  personas.filter((persona) => isValidDni(persona.dni)).forEach((persona) => {
    const dni = normalizeDni(persona.dni);
    const personRef = doc(peopleCollection(), dni);
    const existingPerson = existingState.persons?.get(dni);
    const existingSituationIds = existingState.situationIdsByDni?.get(dni) || new Set();
    const sourceIds = new Set(existingPerson?.sourceIds || []);
    const formularioIds = new Set(existingPerson?.formularioIds || []);
    const respuestaIds = [
      ...(Array.isArray(existingPerson?.respuestaIds) ? existingPerson.respuestaIds : []),
      ...(persona.respuestaIds || []),
    ];
    (persona.fuentes || []).forEach((fuente) => {
      sourceIds.add(fuente.sourceId);
      formularioIds.add(fuente.formularioId);
    });

    const situationEntries = persona.situaciones.map((situacion) => {
      const sourceRef = primarySituationRef(
        situacion,
        persona.fuentes?.[0]?.sourceId || sourceConfigs[0]?.sourceId || ""
      );
      const situationId = createSituationId(
        sourceRef.sourceId || sourceRef.formularioId,
        sourceRef.respuestaId || situacion.origenRespuestaId || "",
        sourceRef.indiceRegistro ?? 1
      );
      return { situacion, sourceRef, situationId };
    });
    const situationIds = new Set(situationEntries.map(({ situationId }) => situationId));
    situationEntries.forEach(({ situationId }) => canonicalSituationIds.add(`${dni}/${situationId}`));
    const existingSituationCount = existingSituationIds.size;
    const hasAnySituation = existingSituationCount > 0 || situationIds.size > 0;

    operations.push({
      ref: personRef,
      data: {
        dni,
        apellido: textValue(persona.apellido),
        nombre: textValue(persona.nombre),
        nombreCompleto: textValue(persona.nombreCompleto),
        departamento: textValue(persona.departamento),
        email: textValue(persona.email),
        telefono: textValue(persona.telefono),
        procesoId: TITULARIZACION_PROCESS_ID,
        cantidadSituaciones: existingSituationCount +
          [...situationIds].filter((id) => !existingSituationIds.has(id)).length,
        respuestaIds: [...new Set(respuestaIds)],
        sourceId: [...sourceIds][0] || "",
        sourceIds: [...sourceIds].filter(Boolean),
        formularioIds: [...formularioIds].filter(Boolean),
        sinSituacionEstructurada: !hasAnySituation,
        searchable: toPersonSearchable(persona),
        ...(existingPerson
          ? {}
          : {
              estadoGeneral: persona.razonesRevision?.length
                ? "requiere_revision"
                : !hasAnySituation
                  ? "sin_situacion_estructurada"
                  : "pendiente",
              razonesRevision: persona.razonesRevision || [],
              createdAt: serverTimestamp(),
            }),
        updatedAt: serverTimestamp(),
      },
    });

    situationEntries.forEach(({ situacion, sourceRef, situationId }) => {
      const existingSituation = existingState.situations?.get(`${dni}/${situationId}`);
      const situationRef = doc(
        personRef,
        TITULARIZACION_SITUATIONS_COLLECTION,
        situationId
      );
      operations.push({
        ref: situationRef,
        data: existingSituation
          ? existingSituationSyncData({ persona, situacion, existingSituation })
          : newSituationData({ persona, situacion }),
      });

      const sourceRefs = orderedSourceRefs(situacion);
      (sourceRefs.length ? sourceRefs : [sourceRef]).forEach((ref) => {
        const evidenceBase = buildSolicitudEvidence({ persona, situacion, sourceRef: ref });
        const evidenceId = createEvidenceId({
          sourceId: evidenceBase.sourceId,
          importId: "",
          registroId: evidenceBase.registroId,
          tipo: evidenceBase.tipo,
        });
        operations.push({
          ref: doc(
            collection(situationRef, TITULARIZACION_EVIDENCES_COLLECTION),
            evidenceId
          ),
          data: {
            ...evidenceBase,
            situacionId: situationId,
            evidenceId,
          },
        });
      });
    });

    const situationSourceIds = new Set(
      situationEntries.flatMap(({ situacion }) =>
        (situacion.sourceRefs || []).map((sourceRef) => sourceRef.sourceId || sourceRef.formularioId)
      )
    );
    (persona.sourceRefs || [])
      .filter((sourceRef) => sourceRef.indiceRegistro == null && sourceRef.respuestaId)
      .filter((sourceRef) => !situationSourceIds.has(sourceRef.sourceId || sourceRef.formularioId))
      .forEach((sourceRef) => {
        const tipo = eventTypeForSourceRole(sourceRef.rol);
        const eventId = createEventId({
          sourceId: sourceRef.sourceId || sourceRef.formularioId,
          formularioId: sourceRef.formularioId,
          respuestaId: sourceRef.respuestaId,
          tipo,
        });
        operations.push({
          ref: doc(collection(personRef, TITULARIZACION_EVENTS_COLLECTION), eventId),
          data: {
            tipo,
            sourceId: sourceRef.sourceId || sourceRef.formularioId || "",
            formularioId: sourceRef.formularioId || "",
            respuestaId: sourceRef.respuestaId,
            rolFuente: sourceRef.rol || "otra_solicitud",
            valoresOriginales: firestoreSafe(persona.datosPersonaOriginales || {}),
            procesoId: TITULARIZACION_PROCESS_ID,
            ...(existingState.events?.has(`${dni}/${eventId}`)
              ? {}
              : { createdAt: serverTimestamp() }),
            updatedAt: serverTimestamp(),
          },
        });
      });
  });

  reviewCases.forEach((persona) => {
    const reviewSourceId = persona.sourceRefs?.[0]?.sourceId || sourceConfigs[0]?.sourceId || "fuente";
    const reviewRefKey = [reviewSourceId, persona.respuestaIds?.[0] || persona.id].join("|");
    const reviewId = createDeterministicId("revision", reviewRefKey);
    const reviewRef = doc(processRef(), TITULARIZACION_REVIEWS_COLLECTION, reviewId);
    const existingReview = existingState.reviews?.get(reviewId);
    operations.push({
      ref: reviewRef,
      data: {
        procesoId: TITULARIZACION_PROCESS_ID,
        tipo: "caso_revision_sin_dni_valido",
        ...(existingReview ? {} : { estado: "abierta", createdAt: serverTimestamp() }),
        motivo: persona.razonesRevision?.join(" · ") || "DNI ausente o inválido",
        dniOriginal: textValue(persona.dni),
        apellido: textValue(persona.apellido),
        nombre: textValue(persona.nombre),
        nombreCompleto: textValue(persona.nombreCompleto),
        respuestaIds: persona.respuestaIds || [],
        sourceId: reviewSourceId,
        sourceRefs: persona.sourceRefs || [],
        cantidadSituaciones: persona.situaciones.length,
        situaciones: firestoreSafe(persona.situaciones || []),
        updatedAt: serverTimestamp(),
      },
    });
  });

  return { operations, reviewCases, canonicalSituationIds };
};

export const commitTitularizacionOperations = async (
  operations = [],
  onProgress = () => {}
) => {
  if (!TITULARIZACION_PERSISTENCE_ENABLED) {
    throw new Error("Persistencia Titularización deshabilitada hasta completar la auditoría de seguridad.");
  }
  const totalBatches = Math.max(1, Math.ceil(operations.length / TITULARIZACION_BATCH_SIZE));
  let completedBatches = 0;

  for (let index = 0; index < operations.length; index += TITULARIZACION_BATCH_SIZE) {
    const batch = writeBatch(db);
    operations
      .slice(index, index + TITULARIZACION_BATCH_SIZE)
      .forEach(({ ref, data }) => batch.set(ref, firestoreSafe(data), { merge: true }));
    await batch.commit();
    completedBatches += 1;
    onProgress({
      completedBatches,
      totalBatches,
      percent: Math.round((completedBatches / totalBatches) * 100),
    });
  }
};

export const getTitularizacionProcess = async () => {
  const snapshot = await getDoc(processRef());
  return snapshot.exists() ? { id: snapshot.id, ...snapshot.data() } : null;
};

const loadExistingProcessState = async () => {
  const [
    peopleSnapshot,
    situationsSnapshot,
    evidencesSnapshot,
    eventsSnapshot,
    sourcesSnapshot,
    reviewsSnapshot,
    observationsSnapshot,
  ] = await Promise.all([
    getDocs(peopleCollection()),
    getDocs(query(collectionGroup(db, TITULARIZACION_SITUATIONS_COLLECTION), where("procesoId", "==", TITULARIZACION_PROCESS_ID))),
    getDocs(query(collectionGroup(db, TITULARIZACION_EVIDENCES_COLLECTION), where("procesoId", "==", TITULARIZACION_PROCESS_ID))),
    getDocs(query(collectionGroup(db, TITULARIZACION_EVENTS_COLLECTION), where("procesoId", "==", TITULARIZACION_PROCESS_ID))),
    getDocs(sourcesCollection()),
    getDocs(collection(processRef(), TITULARIZACION_REVIEWS_COLLECTION)),
    getDocs(collection(processRef(), TITULARIZACION_OBSERVATIONS_COLLECTION)),
  ]);

  const state = {
    persons: new Map(),
    situations: new Map(),
    situationIdsByDni: new Map(),
    evidences: new Map(),
    events: new Map(),
    sources: new Map(),
    reviews: new Map(),
    observations: new Map(),
  };

  peopleSnapshot.docs.forEach((snapshot) => {
    state.persons.set(snapshot.id, snapshot.data() || {});
  });
  observationsSnapshot.docs.forEach((snapshot) => {
    state.observations.set(snapshot.id, snapshot.data() || {});
  });
  reviewsSnapshot.docs.forEach((snapshot) => {
    state.reviews.set(snapshot.id, snapshot.data() || {});
  });
  sourcesSnapshot.docs.forEach((snapshot) => {
    state.sources.set(snapshot.id, snapshot.data() || {});
  });
  situationsSnapshot.docs.forEach((snapshot) => {
    const path = snapshot.ref.path.split("/");
    if (path[2] === TITULARIZACION_PEOPLE_COLLECTION) {
      state.situations.set(`${path[3]}/${snapshot.id}`, snapshot.data() || {});
      if (!state.situationIdsByDni.has(path[3])) state.situationIdsByDni.set(path[3], new Set());
      state.situationIdsByDni.get(path[3]).add(snapshot.id);
    }
  });
  evidencesSnapshot.docs.forEach((snapshot) => {
    const path = snapshot.ref.path.split("/");
    state.evidences.set(`${path[3]}/${path[5]}/${snapshot.id}`, snapshot.data() || {});
  });
  eventsSnapshot.docs.forEach((snapshot) => {
    const path = snapshot.ref.path.split("/");
    state.events.set(`${path[3]}/${snapshot.id}`, snapshot.data() || {});
  });

  return state;
};

const mergeSourceConfigurations = (existingProcess, sourceConfigs = []) => {
  const previous = existingProcess?.fuentesHabilitadas || existingProcess?.fuentes || [];
  const bySourceId = new Map();
  [...previous, ...sourceConfigs].forEach((source) => {
    const sourceId = source.sourceId || source.formularioId;
    if (!sourceId) return;
    bySourceId.set(sourceId, {
      sourceId,
      formularioId: source.formularioId,
      rol: source.rol || "otra_solicitud",
      habilitada: source.habilitada !== false,
    });
  });
  return [...bySourceId.values()];
};

export const initializeTitularizacionProcess = async (onProgress, sourceConfigs) => {
  if (!TITULARIZACION_PERSISTENCE_ENABLED) {
    throw new Error("La inicialización está bloqueada hasta completar la auditoría de seguridad.");
  }
  const existing = await getTitularizacionProcess();
  const sourceData = await loadTitularizacionData({ sourceConfigs });
  const existingState = await loadExistingProcessState();
  const { operations, reviewCases } = buildOperationsFromSource(
    sourceData,
    existingState,
    existing
  );
  let batchCount = 0;

  await commitTitularizacionOperations(operations, (progress) => {
    batchCount = progress.totalBatches;
    onProgress?.({ phase: "persistiendo", ...progress });
  });

  const fuentesHabilitadas = mergeSourceConfigurations(existing, sourceData.sourceConfigs);
  const finalPayload = {
    nombre: "Titularización Docente 2026",
    anio: 2026,
    estado: "activo",
    procesoId: TITULARIZACION_PROCESS_ID,
    formularioFuenteIds: fuentesHabilitadas.map((sourceConfig) => sourceConfig.formularioId),
    fuenteSolicitudIds: fuentesHabilitadas.map((sourceConfig) => sourceConfig.sourceId),
    fuentesHabilitadas,
    fuentes: fuentesHabilitadas.map(({ sourceId, formularioId, rol }) => ({
      sourceId,
      formularioId,
      rol,
    })),
    formularioFuenteId: fuentesHabilitadas[0]?.formularioId || sourceData.formulario.id,
    fuenteSolicitudId: fuentesHabilitadas[0]?.sourceId || "",
    respuestasFuente: Math.max(existing?.respuestasFuente || 0, sourceData.respuestas.length),
    personasPersistidas: Math.max(existing?.personasPersistidas || 0, sourceData.metrics.personas),
    situacionesPersistidas: Math.max(
      existing?.situacionesPersistidas || 0,
      sourceData.metrics.situacionesCanonicas || sourceData.metrics.situaciones
    ),
    situacionesRevision: sourceData.metrics.situacionesRevision || 0,
    personasSinSituacionEstructurada: Math.max(
      existing?.personasSinSituacionEstructurada || 0,
      sourceData.metrics.personasSinSituacionEstructurada || 0
    ),
    casosRevision: Math.max(existing?.casosRevision || 0, reviewCases.length),
    ...(existing?.initializedAt ? {} : { initializedAt: serverTimestamp() }),
    updatedAt: serverTimestamp(),
  };
  await commitTitularizacionOperations([{ ref: processRef(), data: finalPayload }], () => {});

  return {
    alreadyInitialized: false,
    synchronized: Boolean(existing),
    process: { ...finalPayload, estado: "activo" },
    personasPersistidas: finalPayload.personasPersistidas,
    situacionesPersistidas: finalPayload.situacionesPersistidas,
    casosRevision: finalPayload.casosRevision,
    batchCount: batchCount + 1,
  };
};

const toPersistedPerson = (snapshot, situacionesByDni, eventosByDni = new Map()) => {
  const data = snapshot.data() || {};
  const situaciones = situacionesByDni.get(snapshot.id) || [];
  const nombreCompleto = buildVisiblePersonName(data);

  return {
    id: snapshot.id,
    ...data,
    dni: normalizeDni(data.dni || snapshot.id),
    nombreCompleto,
    situaciones,
    situacionesCount: situaciones.length,
    eventos: eventosByDni.get(snapshot.id) || [],
    razonesRevision: Array.isArray(data.razonesRevision) ? data.razonesRevision : [],
    estadoInicial:
      data.estadoGeneral === "requiere_revision"
        ? "REQUIERE REVISIÓN"
        : data.sinSituacionEstructurada
          ? "SIN SITUACIÓN ESTRUCTURADA"
          : "SOLICITUD REGISTRADA",
    searchable: data.searchable || toPersonSearchable({ ...data, nombreCompleto }),
  };
};

export const loadPersistedTitularizacionData = async () => {
  const process = await getTitularizacionProcess();
  if (!process || process.estado !== "activo") return null;

  const [
    peopleSnapshot,
    situationsSnapshot,
    evidencesSnapshot,
    eventsSnapshot,
    reviewsSnapshot,
    observationsSnapshot,
    sourcesSnapshot,
  ] = await Promise.all([
    getDocs(peopleCollection()),
    getDocs(query(collectionGroup(db, TITULARIZACION_SITUATIONS_COLLECTION), where("procesoId", "==", TITULARIZACION_PROCESS_ID))),
    getDocs(query(collectionGroup(db, TITULARIZACION_EVIDENCES_COLLECTION), where("procesoId", "==", TITULARIZACION_PROCESS_ID))),
    getDocs(query(collectionGroup(db, TITULARIZACION_EVENTS_COLLECTION), where("procesoId", "==", TITULARIZACION_PROCESS_ID))),
    getDocs(collection(processRef(), TITULARIZACION_REVIEWS_COLLECTION)),
    getDocs(collection(processRef(), TITULARIZACION_OBSERVATIONS_COLLECTION)),
    getDocs(sourcesCollection()),
  ]);

  const evidenciasBySituation = new Map();
  evidencesSnapshot.docs.forEach((snapshot) => {
    const path = snapshot.ref.path.split("/");
    if (path[2] !== TITULARIZACION_PEOPLE_COLLECTION) return;
    const key = `${path[3]}/${path[5]}`;
    if (!evidenciasBySituation.has(key)) evidenciasBySituation.set(key, []);
    evidenciasBySituation.get(key).push({ id: snapshot.id, ...snapshot.data() });
  });

  const situacionesByDni = new Map();
  situationsSnapshot.docs.forEach((snapshot) => {
    const path = snapshot.ref.path.split("/");
    if (path[2] !== TITULARIZACION_PEOPLE_COLLECTION) return;
    const dni = path[3];
    const base = { id: snapshot.id, ...snapshot.data() };
    const legacyEvidence = base.matchStatus || base.presentadoSidca
      ? [{
          tipo: "presentacion_sidca",
          matchStatus: base.matchStatus ?? null,
          matchScore: base.matchScore ?? null,
          razones: base.razonesMatch || [],
          diferencias: base.diferenciasMatch || [],
          createdAt: base.updatedAt || base.createdAt || null,
        }]
      : [];
    const evidencias = evidenciasBySituation.get(`${dni}/${snapshot.id}`) || legacyEvidence;
    const situation = materializeSituationWorkflow(base, evidencias);
    if (!situacionesByDni.has(dni)) situacionesByDni.set(dni, []);
    situacionesByDni.get(dni).push(situation);
  });

  const eventosByDni = new Map();
  eventsSnapshot.docs.forEach((snapshot) => {
    const path = snapshot.ref.path.split("/");
    if (path[2] !== TITULARIZACION_PEOPLE_COLLECTION) return;
    const dni = path[3];
    if (!eventosByDni.has(dni)) eventosByDni.set(dni, []);
    eventosByDni.get(dni).push({ id: snapshot.id, ...snapshot.data() });
  });

  const personas = peopleSnapshot.docs
    .map((snapshot) => toPersistedPerson(snapshot, situacionesByDni, eventosByDni))
    .filter((persona) => isValidDni(persona.dni));
  const situaciones = personas.flatMap((persona) => persona.situaciones);
  const presentadas = situaciones.filter((situacion) => situacion.presentadoSidca).length;
  const requierenRevisionCanonicas = situaciones.filter(
    (situacion) => situacion.estadoResumen?.requiereRevision
  ).length;
  const reviewRows = reviewsSnapshot.docs.flatMap((snapshot) => {
    const review = snapshot.data() || {};
    return (review.situaciones || []).map((situacion, index) => ({
      ...situacion,
      id: `${snapshot.id}_${situacion.id || index + 1}`,
      dni: review.dniOriginal || situacion.dni || "",
      apellido: review.apellido || "",
      nombre: review.nombre || "",
      nombreCompleto: buildVisiblePersonName(review),
      presentadoSidca: false,
      estado: "requiere_revision",
      tipoInconsistencia: "revision",
      formularioSolicitud: true,
      esSituacionCanonica: false,
    }));
  });

  const metrics = {
    personas: personas.length,
    situaciones: situaciones.length + reviewRows.length,
    presentadasSidca: presentadas,
    pendientesSidca: situaciones.length + reviewRows.length - presentadas,
    requierenRevision: requierenRevisionCanonicas + reviewRows.length + (process.registrosRevision || 0),
    casosRevision: reviewsSnapshot.size,
    personasSinSituacionEstructurada: personas.filter(
      (persona) => persona.sinSituacionEstructurada
    ).length,
    unaSituacion: personas.filter((persona) => persona.situaciones.length === 1).length,
    multiplesSituaciones: personas.filter((persona) => persona.situaciones.length > 1).length,
  };

  const formularioIds = process.formularioFuenteIds || [process.formularioFuenteId].filter(Boolean);
  const sourceIds = process.fuenteSolicitudIds || [process.fuenteSolicitudId].filter(Boolean);
  const fuentes = sourcesSnapshot.docs.map((snapshot) => ({
    id: snapshot.id,
    ...snapshot.data(),
  }));
  const sourceConfigs = (process.fuentesHabilitadas || process.fuentes || fuentes).map((fuente, index) => ({
    formularioId: fuente.formularioId || formularioIds[index],
    sourceId: fuente.sourceId || sourceIds[index],
    rol: fuente.rol || "otra_solicitud",
  })).filter((sourceConfig) => sourceConfig.formularioId);
  const formulario = {
    id: formularioIds[0] || process.formularioFuenteId,
    titulo: process.nombre || "TITULARIZACIÓN DOCENTE 2026",
  };

  return {
    initialized: true,
    process,
    formulario,
    formularios: fuentes.map((fuente) => ({
      id: fuente.formularioId,
      titulo: fuente.nombre || fuente.formularioTitulo || fuente.formularioId,
      tipoFormulario: fuente.tipoFormulario,
    })),
    sourceConfigs,
    fuentes,
    respuestas: { length: process.respuestasFuente || 0 },
    personas,
    situations: situaciones,
    reviewSituations: reviewRows,
    observations: observationsSnapshot.docs.map((snapshot) => ({ id: snapshot.id, ...snapshot.data() })),
    casosRevision: reviewsSnapshot.docs.map((snapshot) => ({ id: snapshot.id, ...snapshot.data() })),
    metrics,
  };
};

export const loadTitularizacionDashboard = async (options = {}) => {
  const persisted = await loadPersistedTitularizacionData();
  if (persisted && options.previewSources) {
    const sourceData = await loadTitularizacionData(options);
    return {
      ...sourceData,
      initialized: true,
      process: persisted.process,
      casosRevision: sourceData.personas.filter((persona) => !isValidDni(persona.dni)),
    };
  }
  if (persisted) {
    const formularios = await loadTitularizacionSources();
    return {
      ...persisted,
      formularios,
      formulariosRelacionados: formularios,
    };
  }

  const sourceConfigs = Array.isArray(options.sourceConfigs) && options.sourceConfigs.length
    ? options.sourceConfigs
    : DEFAULT_TITULARIZACION_SOURCE_CONFIGS;
  const sourceData = await loadTitularizacionData({ ...options, sourceConfigs });
  return {
    ...sourceData,
    initialized: false,
    casosRevision: sourceData.personas.filter((persona) => !isValidDni(persona.dni)),
  };
};

export const loadTitularizacionPendingData = async () => {
  const persisted = await loadPersistedTitularizacionData();
  if (!persisted) return null;

  const recordsSnapshot = await getDocs(
    query(
      collectionGroup(db, TITULARIZACION_IMPORTED_RECORDS_COLLECTION),
      where("procesoId", "==", TITULARIZACION_PROCESS_ID)
    )
  );
  const peopleByDni = new Map(persisted.personas.map((persona) => [persona.dni, persona]));
  const rows = persisted.situations.map((situacion) => {
    const persona = peopleByDni.get(situacion.dni) || {};
    return {
      id: situacion.id,
      ...situacion,
      apellido: persona.apellido || "",
      nombre: persona.nombre || "",
      nombreCompleto: persona.nombreCompleto || "",
      esSituacionCanonica: true,
    };
  });

  (persisted.reviewSituations || []).forEach((situacion) => {
    rows.push({
      ...situacion,
      id: `revision_${situacion.id}`,
      esSituacionCanonica: false,
      presentadoSidca: false,
      estado: "requiere_revision",
      tipoInconsistencia: "revision",
    });
  });

  recordsSnapshot.docs.forEach((snapshot) => {
    const record = snapshot.data() || {};
    if (record.situacionIdVinculada) return;
    rows.push({
      id: `registro_${snapshot.id}`,
      dni: normalizeDni(record.dni),
      apellido: record.valoresNormalizados?.apellido || "",
      nombre: record.valoresNormalizados?.nombre || "",
      nombreCompleto: buildVisiblePersonName({
        apellido: record.valoresNormalizados?.apellido,
        nombre: record.valoresNormalizados?.nombre,
        nombreCompleto: record.valoresNormalizados?.apellidoNombre,
      }),
      cargo: record.valoresNormalizados?.cargo || "",
      materia: record.valoresNormalizados?.materia || "",
      horas: record.valoresNormalizados?.horas || "",
      cursoAnio: record.valoresNormalizados?.cursoAnio || "",
      establecimiento: record.valoresNormalizados?.establecimiento || "",
      nivel: record.valoresNormalizados?.nivel || "",
      modalidad: record.valoresNormalizados?.modalidad || "",
      departamento: record.valoresNormalizados?.departamento || "",
      presentadoSidca: true,
      estado: "requiere_revision",
      matchStatus: record.matchStatus || "revision",
      matchScore: record.matchScore ?? null,
      tipoInconsistencia: "presentada_sin_solicitud_vinculada",
      sourceRefs: [
        {
          sourceId: record.sourceId,
          importId: record.importId,
          registroId: snapshot.id,
          numeroFila: record.numeroFila,
        },
      ],
      esSituacionCanonica: false,
    });
  });

  return { ...persisted, rows };
};
