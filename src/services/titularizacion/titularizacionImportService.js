import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  where,
} from "firebase/firestore";
import { getDownloadURL, ref, uploadBytes } from "firebase/storage";

import { auth, db, storage } from "../../firebase/firebase-config";
import {
  isValidDni,
  normalizeDni,
  textValue,
} from "./titularizacionNormalizer";
import {
  TITULARIZACION_IMPORTS_COLLECTION,
  TITULARIZACION_BATCH_SIZE,
  TITULARIZACION_PROCESS_ID,
  TITULARIZACION_ROOT_COLLECTION,
  commitTitularizacionOperations,
  getTitularizacionProcess,
  loadPersistedTitularizacionData,
} from "./titularizacionProcessService";
import { matchSituationsOneToOne } from "./titularizacionMatcher";
import {
  leerEstructuraExcel,
  normalizarNombreColumna,
  obtenerValorCampoFila,
} from "../excelFormularioService";

export const SIDCA_IMPORT_FIELDS = [
  { key: "dni", label: "DNI", required: true, aliases: ["dni", "documento", "documento nacional", "nro dni", "numero dni"] },
  { key: "apellido", label: "Apellido", aliases: ["apellido", "apellidos"] },
  { key: "nombre", label: "Nombre", aliases: ["nombre", "nombres"] },
  { key: "apellidoNombre", label: "Apellido y nombre", aliases: ["apellido y nombre", "apellidonombre", "nombre completo", "agente"] },
  { key: "cargo", label: "Cargo", aliases: ["cargo", "cargo docente", "puesto"] },
  { key: "materia", label: "Materia", aliases: ["materia", "espacio curricular", "asignatura"] },
  { key: "horas", label: "Horas", aliases: ["horas", "hs", "hs catedra", "horas catedra", "cantidad horas"] },
  { key: "cursoAnio", label: "Curso/Año", aliases: ["curso", "año", "ano", "año secc", "ano secc", "curso año", "curso ano"] },
  { key: "establecimiento", label: "Establecimiento", aliases: ["establecimiento", "escuela", "institucion", "institución", "organismo"] },
  { key: "nivel", label: "Nivel", aliases: ["nivel", "nivel educativo"] },
  { key: "modalidad", label: "Modalidad", aliases: ["modalidad"] },
  { key: "departamento", label: "Departamento", aliases: ["departamento", "depto", "dpto", "delegacion", "delegación"] },
];

const processRef = () => doc(db, TITULARIZACION_ROOT_COLLECTION, TITULARIZACION_PROCESS_ID);
const importsCollection = () => collection(processRef(), TITULARIZACION_IMPORTS_COLLECTION);

const aliasesFor = (field) =>
  [field.key, field.label, ...(field.aliases || [])].map(normalizarNombreColumna);

const findAutomaticColumn = (field, columns) => {
  const aliases = aliasesFor(field);
  return columns.find((column) => aliases.includes(normalizarNombreColumna(column.label))) || null;
};

export const autoMapSidcaColumns = (columns = []) => {
  const used = new Set();
  return SIDCA_IMPORT_FIELDS.reduce((mapping, field) => {
    const column = findAutomaticColumn(field, columns.filter((item) => !used.has(item.key)));
    mapping[field.key] = column?.key || "";
    if (column) used.add(column.key);
    return mapping;
  }, {});
};

export const validateSidcaMapping = (mapping = {}, columns = []) => {
  const errors = [];
  const assigned = new Map();

  SIDCA_IMPORT_FIELDS.forEach((field) => {
    const columnKey = mapping[field.key];
    if (field.required && !columnKey) {
      errors.push(`El campo obligatorio "${field.label}" debe estar mapeado.`);
    }
    if (!columnKey) return;
    if (!columns.some((column) => column.key === columnKey)) {
      errors.push(`La columna asignada a "${field.label}" ya no existe.`);
    }
    if (assigned.has(columnKey)) {
      errors.push(
        `La columna "${assigned.get(columnKey)}" está asignada a más de un campo interno.`
      );
    } else {
      assigned.set(columnKey, field.label);
    }
  });

  return { valid: errors.length === 0, errors };
};

const mappingColumn = (mapping, fieldKey, columns) =>
  columns.find((column) => column.key === mapping[fieldKey]) || null;

export const normalizeSidcaRows = ({ filas = [], columnas = [], mapping = {}, indiceEncabezados = 0 }) =>
  filas.map((fila, index) => {
    const valoresOriginales = { ...fila };
    const valoresNormalizados = {};

    SIDCA_IMPORT_FIELDS.forEach((field) => {
      const column = mappingColumn(mapping, field.key, columnas);
      const value = column ? textValue(obtenerValorCampoFila(fila, column)) : "";
      valoresNormalizados[field.key] = field.key === "dni" ? normalizeDni(value) : value;
    });

    return {
      recordKey: `fila_${index + indiceEncabezados + 2}`,
      numeroFila: index + indiceEncabezados + 2,
      dni: valoresNormalizados.dni,
      valoresOriginales,
      valoresNormalizados,
    };
  });

export const summarizeSidcaRows = (rows = []) => {
  const dnis = rows.filter((row) => row.dni);
  const validDnis = dnis.filter((row) => isValidDni(row.dni));
  return {
    filasDetectadas: rows.length,
    dniDetectados: dnis.length,
    dniValidos: validDnis.length,
    dniInvalidos: dnis.filter((row) => !isValidDni(row.dni)).length,
    dniUnicos: new Set(validDnis.map((row) => row.dni)).size,
    personas: new Set(validDnis.map((row) => row.dni)).size,
    situacionesEstimadas: rows.length,
  };
};

export const prepareSidcaPresentation = async (file, mappingOverride = null) => {
  const parsed = await leerEstructuraExcel(file);
  const automaticMapping = autoMapSidcaColumns(parsed.columnas);
  const mapping = mappingOverride || automaticMapping;
  const validation = validateSidcaMapping(mapping, parsed.columnas);
  const rows = validation.valid
    ? normalizeSidcaRows({ ...parsed, mapping })
    : [];

  return {
    file,
    parsed,
    automaticMapping,
    mapping,
    validation,
    rows,
    summary: summarizeSidcaRows(rows),
  };
};

const bytesToHex = (bytes) =>
  Array.from(bytes)
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");

export const calculateFileHash = async (file) => {
  const buffer = await file.arrayBuffer();
  const cryptoApi = window.crypto;
  if (cryptoApi?.subtle) {
    const digest = await cryptoApi.subtle.digest("SHA-256", buffer);
    return bytesToHex(new Uint8Array(digest));
  }
  return `${file.name}:${file.size}:${file.lastModified || 0}`;
};

const safeFileName = (name) => {
  const cleaned = String(name || "presentacion_sidca.xlsx")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9._-]/g, "_");
  return cleaned || "presentacion_sidca.xlsx";
};

const importedBy = () => auth.currentUser?.uid || auth.currentUser?.email || null;

const sourceRefFor = (sourceId) =>
  doc(
    collection(processRef(), "fuentes"),
    sourceId
  );

const buildRecordData = ({ row, sourceId, importId, result }) => ({
  procesoId: TITULARIZACION_PROCESS_ID,
  numeroFila: row.numeroFila,
  dni: row.dni,
  valoresOriginales: row.valoresOriginales,
  valoresNormalizados: row.valoresNormalizados,
  sourceId,
  importId,
  matchStatus: result.matchStatus || null,
  matchScore: result.matchScore || null,
  razones: result.razones || [],
  diferencias: result.diferencias || [],
  situacionIdVinculada: result.situacionIdVinculada || null,
  tipoInconsistencia: result.tipoInconsistencia || "",
  createdAt: serverTimestamp(),
  updatedAt: serverTimestamp(),
});

const importSourceRefKey = (sourceRef = {}) =>
  [sourceRef.sourceId, sourceRef.importId, sourceRef.registroId, sourceRef.numeroFila]
    .map((value) => String(value || ""))
    .join("|");

const mergeImportSourceRefs = (existingRefs = [], nextRef = null) => {
  const refs = [...(Array.isArray(existingRefs) ? existingRefs : [])];
  if (nextRef) refs.push(nextRef);
  const seen = new Set();
  return refs.filter((sourceRef) => {
    const key = importSourceRefKey(sourceRef);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};

const updateSituationData = ({ result, situation, sourceId, importId, rowByKey }) => {
  const alreadyConfirmed =
    situation?.presentadoSidca === true || situation?.estado === "presentada_sidca";
  if (alreadyConfirmed && result.matchStatus !== "confirmada") {
    return { updatedAt: serverTimestamp() };
  }

  const row = result.recordKey ? rowByKey.get(result.recordKey) : null;
  const sourceRef = row
    ? {
        sourceId,
        importId,
        registroId: row.recordKey,
        numeroFila: row.numeroFila,
      }
    : null;
  const status = result.matchStatus === "confirmada" ? "presentada_sidca" : result.matchStatus ? "requiere_revision" : "no_encontrada";

  return {
    presentadoSidca: result.matchStatus === "confirmada",
    estado: status,
    matchStatus: result.matchStatus || null,
    matchScore: result.matchScore || null,
    tipoInconsistencia: result.tipoInconsistencia || "",
    razonesMatch: result.razones || [],
    diferenciasMatch: result.diferencias || [],
    sourceRefs: mergeImportSourceRefs(situation?.sourceRefs, sourceRef),
    updatedAt: serverTimestamp(),
  };
};

const metricsAfterImport = (persisted, situationUpdates, extraReviewCount) => {
  const situations = persisted.situations.map((situacion) => ({
    ...situacion,
    ...(situationUpdates.get(situacion.id) || {}),
  }));
  const presentadasSidca = situations.filter((situacion) => situacion.presentadoSidca).length;
  return {
    personas: persisted.personas.length,
    situaciones: persisted.metrics.situaciones,
    presentadasSidca,
    pendientesSidca: persisted.metrics.situaciones - presentadasSidca,
    requierenRevision:
      situations.filter((situacion) => situacion.estado === "requiere_revision").length +
      (persisted.reviewSituations?.length || 0) +
      extraReviewCount,
    casosRevision: persisted.metrics.casosRevision || 0,
    unaSituacion: persisted.metrics.unaSituacion,
    multiplesSituaciones: persisted.metrics.multiplesSituaciones,
  };
};

export const importSidcaPresentation = async ({
  file,
  rows,
  mapping,
  summary,
  onProgress,
}) => {
  const process = await getTitularizacionProcess();
  if (!process || process.estado !== "activo") {
    throw new Error("Primero debe inicializar el proceso Titularización 2026.");
  }
  if (!rows.length) throw new Error("No hay filas normalizadas para importar.");

  const fileHash = await calculateFileHash(file);
  const previous = await getDocs(
    query(importsCollection(), where("fileHash", "==", fileHash))
  );
  if (previous.docs.some((snapshot) => snapshot.data()?.estado === "completada")) {
    const error = new Error("Este archivo ya fue importado en el proceso 2026.");
    error.code = "ALREADY_IMPORTED";
    throw error;
  }

  const previousAttempt = previous.docs.find((snapshot) => {
    const estado = snapshot.data()?.estado;
    return estado === "procesando" || estado === "error";
  });

  const persisted = await loadPersistedTitularizacionData();
  if (!persisted) throw new Error("No se pudo leer el proceso inicializado.");

  const importId = previousAttempt?.id || `import_${fileHash}`;
  const sourceId = previousAttempt?.data()?.sourceId || `presentacion_sidca_${fileHash.slice(0, 24)}`;
  const storagePath = `titularizacion/${TITULARIZACION_PROCESS_ID}/fuentes/${sourceId}/${safeFileName(file.name)}`;
  const importRef = doc(importsCollection(), importId);
  const sourceRef = sourceRefFor(sourceId);
  const existingSourceSnapshot = await getDoc(sourceRef);
  const existingSource = existingSourceSnapshot.exists() ? existingSourceSnapshot.data() : null;
  let fileUrl = existingSource?.archivoOriginalUrl || "";
  if (!fileUrl) {
    const storageRef = ref(storage, storagePath);
    const uploaded = await uploadBytes(storageRef, file, {
      contentType: file.type || "application/octet-stream",
    });
    fileUrl = await getDownloadURL(uploaded.ref);
  }
  const importedUser = importedBy();

  const rowByKey = new Map(rows.map((row) => [row.recordKey, row]));
  const situationsByDni = new Map();
  persisted.personas.forEach((persona) => situationsByDni.set(persona.dni, persona.situaciones));

  const rowsByDni = new Map();
  rows.forEach((row) => {
    if (!rowsByDni.has(row.dni)) rowsByDni.set(row.dni, []);
    rowsByDni.get(row.dni).push(row);
  });

  const situationResultsById = new Map();
  const rowResultsByKey = new Map();
  rowsByDni.forEach((dniRows, dni) => {
    const situations = isValidDni(dni) ? situationsByDni.get(dni) || [] : [];
    const matched = matchSituationsOneToOne(situations, dniRows);
    matched.situationResults.forEach((result) => situationResultsById.set(result.situacion.id, result));
    matched.rowResults.forEach((result) => rowResultsByKey.set(result.fila.recordKey, result));
  });

  persisted.situations.forEach((situacion) => {
    if (situationResultsById.has(situacion.id)) return;
    const matched = matchSituationsOneToOne(
      [situacion],
      rowsByDni.get(situacion.dni) || []
    );
    const result = matched.situationResults[0];
    situationResultsById.set(situacion.id, result);
    matched.rowResults.forEach((rowResult) => {
      if (!rowResultsByKey.has(rowResult.fila.recordKey)) rowResultsByKey.set(rowResult.fila.recordKey, rowResult);
    });
  });

  rows.forEach((row) => {
    if (rowResultsByKey.has(row.recordKey)) return;
    rowResultsByKey.set(row.recordKey, {
      fila: row,
      matchStatus: null,
      matchScore: null,
      razones: [],
      diferencias: [],
      situacionIdVinculada: null,
      tipoInconsistencia: "presentada_sin_solicitud_vinculada",
    });
  });

  const situationUpdates = new Map();
  situationResultsById.forEach((result, situationId) => {
    situationUpdates.set(situationId, updateSituationData({ result, situation: result.situacion, sourceId, importId, rowByKey }));
  });

  const rowResults = rows.map((row) => rowResultsByKey.get(row.recordKey));
  const confirmed = rowResults.filter((result) => result.matchStatus === "confirmada").length;
  const possible = rowResults.filter((result) => result.matchStatus === "posible").length;
  const review = rowResults.filter((result) => result.matchStatus === "revision" || result.tipoInconsistencia === "presentada_sin_solicitud_vinculada").length;
  const omitted = [...situationResultsById.values()].filter((result) => result.tipoInconsistencia === "omision_sidca").length;

  const initialOperations = [
    {
      ref: importRef,
      data: {
        procesoId: TITULARIZACION_PROCESS_ID,
        sourceId,
        tipo: "presentacion_sidca",
        archivo: file.name,
        mapping,
        cantidadFilas: rows.length,
        fileHash,
        estado: "procesando",
        importedBy: importedUser,
        ...(previousAttempt ? {} : { createdAt: serverTimestamp() }),
        updatedAt: serverTimestamp(),
      },
    },
    {
      ref: sourceRef,
      data: {
        procesoId: TITULARIZACION_PROCESS_ID,
        sourceId,
        tipo: "presentacion_sidca",
        nombre: file.name,
        sourceFile: file.name,
        sourceDate: file.lastModified ? new Date(file.lastModified) : null,
        fileHash,
        importedAt: serverTimestamp(),
        importedBy: importedUser,
        cantidadRegistros: rows.length,
        estado: "importada",
        mapping,
        archivoOriginalNombre: file.name,
        archivoOriginalPath: storagePath,
        archivoOriginalUrl: fileUrl,
        size: file.size,
        contentType: file.type || "application/octet-stream",
        ...(existingSource ? {} : { createdAt: serverTimestamp() }),
        updatedAt: serverTimestamp(),
      },
    },
  ];

  try {
    await commitTitularizacionOperations(initialOperations, (progress) => {
      onProgress?.({ phase: "registrando", ...progress });
    });

    const operations = [];
    rows.forEach((row) => {
      const recordId = row.recordKey;
      operations.push({
        ref: doc(collection(importRef, "registros"), recordId),
        data: buildRecordData({
          row,
          sourceId,
          importId,
          result: rowResults.find((item) => item.fila.recordKey === row.recordKey),
        }),
      });
    });

    persisted.personas.forEach((persona) => {
      persona.situaciones.forEach((situacion) => {
        const result = situationResultsById.get(situacion.id);
        if (!result) return;
        operations.push({
          ref: doc(
            collection(
              doc(collection(processRef(), "personas"), persona.dni),
              "situaciones"
            ),
            situacion.id
          ),
          data: updateSituationData({ result, situation: situacion, sourceId, importId, rowByKey }),
        });
      });
    });

    const nextMetrics = metricsAfterImport(persisted, situationUpdates, review);
    operations.push({
      ref: processRef(),
      data: {
        ...nextMetrics,
        ultimaImportacionId: importId,
        updatedAt: serverTimestamp(),
      },
    });
    operations.push({
      ref: importRef,
      data: {
        estado: "completada",
        updatedAt: serverTimestamp(),
        registrosImportados: rows.length,
        dniDetectados: summary.dniDetectados,
        personasEncontradas: new Set(rows.filter((row) => persisted.personas.some((persona) => persona.dni === row.dni)).map((row) => row.dni)).size,
        coincidenciasConfirmadas: confirmed,
        coincidenciasPosibles: possible,
        sinCoincidencia: omitted,
        requierenRevision: review + omitted,
        errores: [],
      },
    });

    const totalOperations = operations.length;
    await commitTitularizacionOperations(operations, (progress) => {
      onProgress?.({ phase: "persistiendo", totalOperations, ...progress });
    });

    return {
      importId,
      sourceId,
      fileHash,
      storagePath,
      metrics: {
        registrosImportados: rows.length,
        dniDetectados: summary.dniDetectados,
        coincidenciasConfirmadas: confirmed,
        coincidenciasPosibles: possible,
        sinCoincidencia: omitted,
        requierenRevision: review + omitted,
      },
      batchCount: 1 + Math.ceil(totalOperations / TITULARIZACION_BATCH_SIZE),
    };
  } catch (error) {
    try {
      await commitTitularizacionOperations([
        {
          ref: importRef,
          data: {
            estado: "error",
            errorMessage: error.message || "Error durante la importación",
            updatedAt: serverTimestamp(),
          },
        },
      ]);
    } catch (updateError) {
      console.error("No se pudo registrar el error de importación:", updateError);
    }
    throw error;
  }
};
