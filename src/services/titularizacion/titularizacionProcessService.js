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
  isValidDni,
  normalizeDni,
  normalizeSearchText,
  textValue,
} from "./titularizacionNormalizer";
import { loadTitularizacionData } from "./titularizacionService";

export const TITULARIZACION_ROOT_COLLECTION = "titularizacion";
export const TITULARIZACION_PROCESS_ID = "proceso_2026";
export const TITULARIZACION_PROCESS_PATH = `${TITULARIZACION_ROOT_COLLECTION}/${TITULARIZACION_PROCESS_ID}`;
export const TITULARIZACION_PEOPLE_COLLECTION = "personas";
export const TITULARIZACION_SOURCES_COLLECTION = "fuentes";
export const TITULARIZACION_IMPORTS_COLLECTION = "importaciones";
export const TITULARIZACION_OBSERVATIONS_COLLECTION = "observaciones";
export const TITULARIZACION_SITUATIONS_COLLECTION = "situaciones";
export const TITULARIZACION_BATCH_SIZE = 400;

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

export const createSituationId = (respuestaId, index) =>
  safeId(`solicitud_${respuestaId || "respuesta"}_${Number(index) + 1}`);

const sourceIndexFromSituation = (situacion, fallbackIndex) => {
  const match = String(situacion?.id || "").match(/-(\d+)$/);
  return match ? Math.max(0, Number(match[1]) - 1) : fallbackIndex;
};

const buildSourceId = (formularioId) => safeId(`formulario_${formularioId}`);

const toPersonSearchable = (persona) =>
  normalizeSearchText(
    [persona.dni, persona.apellido, persona.nombre, persona.departamento]
      .filter(Boolean)
      .join(" ")
  );

const buildSourcePayload = (formulario, metrics, respuestas) => ({
  procesoId: TITULARIZACION_PROCESS_ID,
  sourceType: "solicitud_afiliado",
  tipo: "solicitud_afiliado",
  nombre: formulario.titulo || "TITULARIZACIÓN DOCENTE 2026",
  origenTecnico: "oficina_gestion_respuestas",
  formularioId: formulario.id,
  cantidadRegistros: respuestas.length,
  personasIdentificadas: metrics.personas,
  cantidadSituaciones: metrics.situaciones,
});

const buildProcessPayload = (formulario, metrics, sourceId, casosRevision) => ({
  nombre: "Titularización Docente 2026",
  anio: 2026,
  estado: "inicializando",
  procesoId: TITULARIZACION_PROCESS_ID,
  formularioFuenteId: formulario.id,
  fuenteSolicitudId: sourceId,
  respuestasFuente: metrics.respuestas || 0,
  personasPersistidas: metrics.personas,
  situacionesPersistidas: metrics.situaciones,
  casosRevision,
});

const sourceRefKey = (sourceRef = {}) =>
  [
    sourceRef.sourceType,
    sourceRef.sourceId,
    sourceRef.respuestaId,
    sourceRef.indiceRegistro,
    sourceRef.importId,
    sourceRef.registroId,
  ]
    .map((value) => String(value || ""))
    .join("|");

const mergeSourceRefs = (existingRefs = [], nextRefs = []) => {
  const result = [];
  const seen = new Set();
  [...(Array.isArray(existingRefs) ? existingRefs : []), ...(Array.isArray(nextRefs) ? nextRefs : [])].forEach((sourceRef) => {
    const key = sourceRefKey(sourceRef);
    if (seen.has(key)) return;
    seen.add(key);
    result.push(sourceRef);
  });
  return result;
};

const situationBaseData = ({ persona, situacion, sourceId, sourceIndex, existingSituation }) => ({
  dni: persona.dni,
  cargo: textValue(situacion.cargo),
  horas: textValue(situacion.horas),
  materia: textValue(situacion.materia),
  establecimiento: textValue(situacion.establecimiento),
  nivel: textValue(situacion.nivel),
  modalidad: textValue(situacion.modalidad),
  cursoAnio: textValue(situacion.cursoAnio),
  formularioSolicitud: true,
  sourceRefs: mergeSourceRefs(existingSituation?.sourceRefs, [
    {
      sourceType: "solicitud_afiliado",
      sourceId,
      respuestaId: situacion.origenRespuestaId || "",
      formularioId: situacion.formularioId || "",
      indiceRegistro: sourceIndex + 1,
    },
  ]),
  valoresOriginales: firestoreSafe(situacion.valorOriginal || {}),
  respuestaId: situacion.origenRespuestaId || "",
  formularioId: situacion.formularioId || "",
  indiceRegistro: sourceIndex + 1,
  procesoId: TITULARIZACION_PROCESS_ID,
});

const newSituationData = (args) => ({
  ...situationBaseData(args),
  presentadoSidca: false,
  estado: "declarada",
  matchStatus: null,
  matchScore: null,
  tipoInconsistencia: "",
  createdAt: serverTimestamp(),
  updatedAt: serverTimestamp(),
});

const existingSituationSyncData = (args) => ({
  ...situationBaseData(args),
  updatedAt: serverTimestamp(),
});

const buildOperationsFromSource = (sourceData, existingState = {}) => {
  const { formulario, personas, respuestas, metrics } = sourceData;
  const sourceId = buildSourceId(formulario.id);
  const operations = [];
  const reviewCases = personas.filter((persona) => !isValidDni(persona.dni));

  operations.push({
    ref: processRef(),
    data: {
      ...buildProcessPayload(formulario, { ...metrics, respuestas: respuestas.length }, sourceId, reviewCases.length),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    },
  });

  operations.push({
    ref: doc(sourcesCollection(), sourceId),
    data: {
      ...buildSourcePayload(formulario, metrics, respuestas),
      sourceId,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    },
  });

  personas.filter((persona) => isValidDni(persona.dni)).forEach((persona) => {
    const dni = normalizeDni(persona.dni);
    const personRef = doc(peopleCollection(), dni);
    const existingPerson = existingState.persons?.get(dni);
    const personaRequiereRevision =
      persona.estadoInicial === "REQUIERE REVISIÓN" || persona.situaciones.length === 0;
    const respuestaIds = [
      ...(Array.isArray(existingPerson?.respuestaIds) ? existingPerson.respuestaIds : []),
      ...(persona.respuestaIds || []),
    ];
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
        cantidadSituaciones: persona.situaciones.length,
        respuestaIds: [...new Set(respuestaIds)],
        sourceId,
        searchable: toPersonSearchable(persona),
        ...(existingPerson
          ? {}
          : {
              estadoGeneral: personaRequiereRevision ? "requiere_revision" : "pendiente",
              razonesRevision: persona.razonesRevision || [],
              createdAt: serverTimestamp(),
            }),
        updatedAt: serverTimestamp(),
      },
    });

    persona.situaciones.forEach((situacion, index) => {
      const sourceIndex = sourceIndexFromSituation(situacion, index);
      const situationId = createSituationId(situacion.origenRespuestaId, sourceIndex);
      const existingSituation = existingState.situations?.get(`${dni}/${situationId}`);
      operations.push({
        ref: doc(personRef, TITULARIZACION_SITUATIONS_COLLECTION, situationId),
        data: existingSituation
          ? existingSituationSyncData({ persona, situacion, sourceId, sourceIndex, existingSituation })
          : newSituationData({ persona, situacion, sourceId, sourceIndex }),
      });
    });
  });

  reviewCases.forEach((persona) => {
    const reviewId = safeId(`revision_${persona.id}`);
    const observationRef = doc(
      processRef(),
      TITULARIZACION_OBSERVATIONS_COLLECTION,
      reviewId
    );

    const existingObservation = existingState.observations?.get(reviewId);
    operations.push({
      ref: observationRef,
      data: {
        procesoId: TITULARIZACION_PROCESS_ID,
        tipo: "caso_revision_sin_dni_valido",
        ...(existingObservation ? {} : { estado: "requiere_revision", createdAt: serverTimestamp() }),
        motivo: persona.razonesRevision?.join(" · ") || "DNI ausente o inválido",
        dniOriginal: textValue(persona.dni),
        apellido: textValue(persona.apellido),
        nombre: textValue(persona.nombre),
        nombreCompleto: textValue(persona.nombreCompleto),
        respuestaIds: persona.respuestaIds || [],
        sourceId,
        cantidadSituaciones: persona.situaciones.length,
        updatedAt: serverTimestamp(),
      },
    });

    persona.situaciones.forEach((situacion, index) => {
      const sourceIndex = sourceIndexFromSituation(situacion, index);
      const situationId = createSituationId(situacion.origenRespuestaId, sourceIndex);
      const existingSituation = existingState.situations?.get(`${reviewId}/${situationId}`);
      operations.push({
        ref: doc(
          observationRef,
          TITULARIZACION_SITUATIONS_COLLECTION,
          situationId
        ),
        data: existingSituation
          ? existingSituationSyncData({ persona, situacion, sourceId, sourceIndex, existingSituation })
          : {
              ...newSituationData({ persona, situacion, sourceId, sourceIndex }),
              tipoInconsistencia: "revision",
              estado: "requiere_revision",
            },
      });
    });
  });

  return { operations, sourceId, reviewCases };
};

export const commitTitularizacionOperations = async (
  operations = [],
  onProgress = () => {}
) => {
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
  const [peopleSnapshot, situationsSnapshot, observationsSnapshot] = await Promise.all([
    getDocs(peopleCollection()),
    getDocs(query(collectionGroup(db, TITULARIZACION_SITUATIONS_COLLECTION), where("procesoId", "==", TITULARIZACION_PROCESS_ID))),
    getDocs(collection(processRef(), TITULARIZACION_OBSERVATIONS_COLLECTION)),
  ]);

  const state = {
    persons: new Map(),
    situations: new Map(),
    observations: new Map(),
  };

  peopleSnapshot.docs.forEach((snapshot) => {
    state.persons.set(snapshot.id, snapshot.data() || {});
  });
  observationsSnapshot.docs.forEach((snapshot) => {
    state.observations.set(snapshot.id, snapshot.data() || {});
  });
  situationsSnapshot.docs.forEach((snapshot) => {
    const path = snapshot.ref.path.split("/");
    if (path[2] === TITULARIZACION_PEOPLE_COLLECTION) {
      state.situations.set(`${path[3]}/${snapshot.id}`, snapshot.data() || {});
    }
    if (path[2] === TITULARIZACION_OBSERVATIONS_COLLECTION) {
      state.situations.set(`${path[3]}/${snapshot.id}`, snapshot.data() || {});
    }
  });

  return state;
};

export const initializeTitularizacionProcess = async (onProgress) => {
  const existing = await getTitularizacionProcess();
  if (existing?.estado === "activo" && existing?.personasPersistidas) {
    return { alreadyInitialized: true, process: existing, batchCount: 0 };
  }

  const sourceData = await loadTitularizacionData();
  const existingState = await loadExistingProcessState();
  const { operations, sourceId, reviewCases } = buildOperationsFromSource(sourceData, existingState);
  let batchCount = 0;

  await commitTitularizacionOperations(operations, (progress) => {
    batchCount = progress.totalBatches;
    onProgress?.({ phase: "persistiendo", ...progress });
  });

  const finalPayload = {
    nombre: "Titularización Docente 2026",
    anio: 2026,
    estado: "activo",
    procesoId: TITULARIZACION_PROCESS_ID,
    formularioFuenteId: sourceData.formulario.id,
    fuenteSolicitudId: sourceId,
    respuestasFuente: sourceData.respuestas.length,
    personasPersistidas: sourceData.metrics.personas,
    situacionesPersistidas: sourceData.metrics.situaciones,
    casosRevision: reviewCases.length,
    initializedAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };
  await commitTitularizacionOperations([{ ref: processRef(), data: finalPayload }], () => {});

  return {
    alreadyInitialized: false,
    process: { ...finalPayload, estado: "activo" },
    personasPersistidas: sourceData.metrics.personas,
    situacionesPersistidas: sourceData.metrics.situaciones,
    casosRevision: reviewCases.length,
    batchCount: batchCount + 1,
  };
};

const toPersistedPerson = (snapshot, situacionesByDni) => {
  const data = snapshot.data() || {};
  const situaciones = situacionesByDni.get(snapshot.id) || [];
  const nombreCompleto = data.nombreCompleto || [data.apellido, data.nombre].filter(Boolean).join(" ");

  return {
    id: snapshot.id,
    ...data,
    dni: normalizeDni(data.dni || snapshot.id),
    nombreCompleto,
    situaciones,
    situacionesCount: situaciones.length,
    razonesRevision: Array.isArray(data.razonesRevision) ? data.razonesRevision : [],
    estadoInicial: data.estadoGeneral === "requiere_revision" ? "REQUIERE REVISIÓN" : "SOLICITUD REGISTRADA",
    searchable: data.searchable || toPersonSearchable({ ...data, nombreCompleto }),
  };
};

export const loadPersistedTitularizacionData = async () => {
  const process = await getTitularizacionProcess();
  if (!process || process.estado !== "activo") return null;

  const [peopleSnapshot, situationsSnapshot, observationsSnapshot] = await Promise.all([
    getDocs(peopleCollection()),
    getDocs(query(collectionGroup(db, TITULARIZACION_SITUATIONS_COLLECTION), where("procesoId", "==", TITULARIZACION_PROCESS_ID))),
    getDocs(collection(processRef(), TITULARIZACION_OBSERVATIONS_COLLECTION)),
  ]);

  const situacionesByDni = new Map();
  const situacionesRevision = [];
  situationsSnapshot.docs.forEach((snapshot) => {
    const path = snapshot.ref.path.split("/");
    if (path[2] === TITULARIZACION_OBSERVATIONS_COLLECTION) {
      situacionesRevision.push({ id: snapshot.id, ...snapshot.data(), observacionId: path[3] });
      return;
    }
    if (path[2] !== TITULARIZACION_PEOPLE_COLLECTION) return;
    const dni = path[3];
    if (!situacionesByDni.has(dni)) situacionesByDni.set(dni, []);
    situacionesByDni.get(dni).push({ id: snapshot.id, ...snapshot.data() });
  });

  const personas = peopleSnapshot.docs
    .map((snapshot) => toPersistedPerson(snapshot, situacionesByDni))
    .filter((persona) => isValidDni(persona.dni));
  const situaciones = personas.flatMap((persona) => persona.situaciones);
  const presentadas = situaciones.filter((situacion) => situacion.presentadoSidca).length;
  const requierenRevisionCanonicas = situaciones.filter(
    (situacion) => situacion.estado === "requiere_revision" || situacion.tipoInconsistencia === "revision"
  ).length;
  const reviewRows = situacionesRevision.map((situacion) => {
    const observation = observationsSnapshot.docs.find((snapshot) => snapshot.id === situacion.observacionId)?.data() || {};
    return {
      ...situacion,
      apellido: observation.apellido || "",
      nombre: observation.nombre || "",
      nombreCompleto: observation.nombreCompleto || [observation.apellido, observation.nombre].filter(Boolean).join(" "),
      presentadoSidca: false,
      estado: "requiere_revision",
      tipoInconsistencia: "revision",
      formularioSolicitud: true,
      esSituacionCanonica: false,
    };
  });

  const metrics = {
    personas: personas.length,
    situaciones: situaciones.length + reviewRows.length,
    presentadasSidca: presentadas,
    pendientesSidca: situaciones.length + reviewRows.length - presentadas,
    requierenRevision: requierenRevisionCanonicas + reviewRows.length + (process.registrosRevision || 0),
    casosRevision: observationsSnapshot.size,
    unaSituacion: personas.filter((persona) => persona.situaciones.length === 1).length,
    multiplesSituaciones: personas.filter((persona) => persona.situaciones.length > 1).length,
  };

  const formulario = {
    id: process.formularioFuenteId,
    titulo: process.nombre || "TITULARIZACIÓN DOCENTE 2026",
  };

  return {
    initialized: true,
    process,
    formulario,
    respuestas: { length: process.respuestasFuente || 0 },
    personas,
    situations: situaciones,
    reviewSituations: reviewRows,
    observations: observationsSnapshot.docs.map((snapshot) => ({ id: snapshot.id, ...snapshot.data() })),
    casosRevision: observationsSnapshot.docs.map((snapshot) => ({ id: snapshot.id, ...snapshot.data() })),
    metrics,
  };
};

export const loadTitularizacionDashboard = async () => {
  const persisted = await loadPersistedTitularizacionData();
  if (persisted) return persisted;

  const sourceData = await loadTitularizacionData();
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
      collectionGroup(db, "registros"),
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
      nombreCompleto:
        record.valoresNormalizados?.apellidoNombre ||
        [record.valoresNormalizados?.apellido, record.valoresNormalizados?.nombre]
          .filter(Boolean)
          .join(" "),
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
      matchScore: record.matchScore || null,
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
