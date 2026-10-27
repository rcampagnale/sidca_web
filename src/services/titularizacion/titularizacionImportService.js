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
  TITULARIZACION_EVIDENCES_COLLECTION,
  TITULARIZACION_IMPORTED_RECORDS_COLLECTION,
  TITULARIZACION_PERSISTENCE_ENABLED,
  TITULARIZACION_PROCESS_ID,
  TITULARIZACION_ROOT_COLLECTION,
  commitTitularizacionOperations,
  getTitularizacionProcess,
  loadPersistedTitularizacionData,
} from "./titularizacionProcessService";
import {
  createEvidenceId,
  deriveSituationSummary,
} from "./titularizacionModel";
import { matchSituationsOneToOne } from "./titularizacionMatcher";
import { SOURCE_COVERAGE } from "./titularizacionSourceModel";
import {
  leerEstructuraWorkbook,
  normalizarNombreColumna,
  obtenerValorCampoFila,
} from "../excelFormularioService";
import {
  detectWideTitularizacionSchema,
  parseWideTitularizacionRows,
} from "./titularizacionWideExcelParser";

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
  const situations = rows.length;
  return {
    filasDetectadas: rows.length,
    filasExcel: rows.length,
    dniDetectados: dnis.length,
    dniValidos: validDnis.length,
    dniInvalidos: dnis.filter((row) => !isValidDni(row.dni)).length,
    dniUnicos: new Set(validDnis.map((row) => row.dni)).size,
    personas: new Set(validDnis.map((row) => row.dni)).size,
    situacionesEstimadas: situations,
    situacionesExtraidas: situations,
    bloquesVaciosDescartados: 0,
    bloquesReconocidos: 0,
    columnasReconocidas: 0,
  };
};

const compactHeader = (column = {}) =>
  normalizarNombreColumna(column.sourceHeader || column.label || "")
    .replace(/[^a-zA-Z0-9]/g, "")
    .toLowerCase();

const isDirectDniHeader = (column) => {
  const header = compactHeader(column);
  return header === "dni" ||
    (header.startsWith("dni") && !header.includes("clave") && !header.includes("cruce"));
};

const isDocumentHeader = (column) => {
  const header = compactHeader(column);
  return header === "documento" ||
    header.startsWith("documento") ||
    header === "nrodni" ||
    header === "numerodedocumento" ||
    header === "numerodocumento";
};

const isDniCrossKeyHeader = (column) => {
  const header = compactHeader(column);
  return header.includes("dni") && (header.includes("clave") || header.includes("cruce"));
};

const resolveDniColumns = (columns = []) => {
  const direct = columns.find(isDirectDniHeader);
  const document = columns.find(isDocumentHeader);
  const crossKey = columns.find(isDniCrossKeyHeader);
  return {
    primary: direct || document || crossKey || null,
    direct,
    document,
    crossKey,
  };
};

const schemaWithDniColumn = (schema, columns) => {
  const dniColumns = resolveDniColumns(schema.columns || columns);
  return {
    ...schema,
    detectedDniColumn: dniColumns.primary,
    personColumns: {
      ...schema.personColumns,
      dni: dniColumns.primary || schema.personColumns.dni || null,
      claveCruceDni: dniColumns.crossKey || null,
    },
  };
};

const semanticFieldsFor = (schema = {}) => [
  ...Object.entries(schema.personColumns || {})
    .filter(([, column]) => Boolean(column))
    .map(([field]) => field),
  ...((schema.blocks || []).flatMap((block) => Object.entries(block.fields || [])
    .filter(([, column]) => Boolean(column))
    .map(([field]) => field))),
].filter((field, index, fields) => fields.indexOf(field) === index);

const administrativeRowsFor = (sheet, schema) => {
  const mapping = {
    dni: schema.personColumns.dni?.key || "",
    apellido: schema.personColumns.apellido?.key || "",
    nombre: schema.personColumns.nombre?.key || "",
    departamento: schema.personColumns.departamento?.key || "",
  };
  return normalizeSidcaRows({
    filas: sheet.filas || [],
    columnas: sheet.columnas || [],
    mapping,
    indiceEncabezados: sheet.indiceEncabezados || 0,
  }).map((row) => ({
    ...row,
    recordKey: `hoja_${sheet.sheetIndex}_fila_${row.numeroFila}`,
    sourceSheetName: sheet.sheetName || sheet.hoja || "Hoja 1",
    sourceSheetIndex: sheet.sheetIndex || 0,
    sourceRowNumber: row.numeroFila,
    rawRecord: row.valoresOriginales,
    provenance: {
      sheetName: sheet.sheetName || sheet.hoja || "Hoja 1",
      sheetIndex: sheet.sheetIndex || 0,
      rowNumber: row.numeroFila,
    },
    valoresNormalizados: {
      ...Object.fromEntries((sheet.columnas || []).map((column) => [
        column.key,
        textValue(row.valoresOriginales?.[column.key]),
      ])),
      ...row.valoresNormalizados,
    },
  }));
};

const summaryForRows = (rows = [], { situations = [], schema = {} } = {}) => {
  const summary = summarizeSidcaRows(rows);
  return {
    ...summary,
    situacionesEstimadas: situations.length,
    situacionesExtraidas: situations.length,
    situacionesValidas: situations.filter((row) => row.situacion?.semanticValidation?.valid !== false).length,
    situacionesConWarnings: situations.filter((row) => row.situacion?.semanticValidation?.warnings?.length).length,
    situacionesInvalidas: situations.filter((row) => row.situacion?.semanticValidation?.valid === false).length,
    bloquesReconocidos: schema.blocks?.length || 0,
    columnasReconocidas: schema.recognizedColumnCount || 0,
    columnasMapeadas: schema.recognizedColumnCount || 0,
    camposSemanticosDisponibles: semanticFieldsFor(schema),
  };
};

const sheetError = (message) => ({ valid: false, errors: [message], warnings: [] });

export const analyzeSidcaSheet = (sheet = {}) => {
  const hasRows = Number.isFinite(sheet.rowCount) ? sheet.rowCount > 0 : Boolean(sheet.filas?.length);
  if (!sheet.columnas?.length) {
    return {
      ...sheet,
      status: "NO_COMPATIBLE",
      selectable: false,
      parserMode: "none",
      validation: sheetError("No se detectaron encabezados utilizables."),
      summary: summarizeSidcaRows([]),
    };
  }

  const detectedSchema = detectWideTitularizacionSchema(sheet.columnas, {
    sheetName: sheet.sheetName || sheet.hoja || "Hoja 1",
    sheetIndex: sheet.sheetIndex || 0,
  });
  const wideSchema = schemaWithDniColumn(detectedSchema, sheet.columnas);
  const administrativeRows = administrativeRowsFor(sheet, wideSchema);
  const validDniCount = administrativeRows.filter((row) => isValidDni(row.dni)).length;
  if (!hasRows || !wideSchema.personColumns.dni || validDniCount === 0) {
    return {
      ...sheet,
      wideSchema,
      rows: administrativeRows,
      status: "NO_COMPATIBLE",
      selectable: false,
      parserMode: "none",
      validation: sheetError(
        !hasRows
          ? "No hay registros físicos para analizar."
          : !wideSchema.personColumns.dni
            ? "No se encontró una columna DNI utilizable."
            : "No se encontraron DNI válidos en los registros."
      ),
      summary: summaryForRows(administrativeRows, { schema: wideSchema }),
    };
  }

  const wideParsed = parseWideTitularizacionRows({
    ...sheet,
    schema: wideSchema,
    sourceSheetName: sheet.sheetName || sheet.hoja || "Hoja 1",
    sourceSheetIndex: sheet.sheetIndex || 0,
  });
  const semanticErrors = wideParsed.summary.erroresSemanticos || [];
  const semanticWarnings = wideParsed.summary.warningsSemanticos || [];
  const structured = wideSchema.blocks.length > 0 && wideSchema.missingCoreFields.length === 0;
  const rows = structured ? wideParsed.rows : administrativeRows;
  const summary = structured
    ? {
      ...wideParsed.summary,
      camposSemanticosDisponibles: semanticFieldsFor(wideSchema),
    }
    : summaryForRows(rows, { schema: wideSchema });
  return {
    ...sheet,
    wideSchema,
    wideParsed: {
      ...wideParsed,
      rows,
      summary,
    },
    rows,
    status: structured ? "COMPATIBLE_ESTRUCTURADA" : "COMPATIBLE_PARCIAL",
    selectable: true,
    parserMode: "wide",
    validation: {
      valid: true,
      errors: [],
      warnings: [
        ...(structured ? semanticErrors : ["Hoja importable con estructura parcial; no se fabrican situaciones completas."]),
        ...semanticWarnings,
      ],
    },
    summary,
  };
};

const mergePeople = (peopleByKey, person, sheetIndex) => {
  const personKey = person.dniValido
    ? `dni_${person.dni}`
    : `revision_${sheetIndex}_${person.filasExcel?.[0] || peopleByKey.size}`;
  if (!peopleByKey.has(personKey)) {
    peopleByKey.set(personKey, {
      ...person,
      situaciones: [],
      filasExcel: [],
      hojasOrigen: [],
    });
  }
  const target = peopleByKey.get(personKey);
  target.situaciones.push(...(person.situaciones || []));
  target.filasExcel.push(...(person.filasExcel || []));
  (person.hojasOrigen || []).forEach((origin) => {
    if (!target.hojasOrigen.some((item) => item.sheetIndex === origin.sheetIndex)) {
      target.hojasOrigen.push(origin);
    }
  });
};

export const consolidateSidcaSheets = (sheetAnalyses = [], selectedSheetIndexes = []) => {
  const selected = sheetAnalyses.filter((sheet) => selectedSheetIndexes.includes(sheet.sheetIndex));
  const rows = selected.flatMap((sheet) => sheet.rows || []);
  const situationRows = rows.filter((row) => row.situacion);
  const peopleByKey = new Map();
  selected.forEach((sheet) => {
    (sheet.wideParsed?.personas || []).forEach((person) => mergePeople(peopleByKey, person, sheet.sheetIndex));
  });
  const personas = [...peopleByKey.values()].map((person) => ({
    ...person,
    situacionesCount: person.situaciones.length,
  }));
  const validRows = rows.filter((row) => isValidDni(row.dni));
  const semanticInvalid = situationRows.filter((row) => !row.situacion?.semanticValidation?.valid);
  const semanticWarnings = situationRows.filter((row) => row.situacion?.semanticValidation?.warnings?.length);
  return {
    rows,
    personas,
    summary: {
      filasDetectadas: selected.reduce((sum, sheet) => sum + (sheet.summary?.filasDetectadas || 0), 0),
      filasExcel: selected.reduce((sum, sheet) => sum + (sheet.summary?.filasExcel || 0), 0),
      dniDetectados: selected.reduce((sum, sheet) => sum + (sheet.summary?.dniDetectados || 0), 0),
      dniValidos: selected.reduce((sum, sheet) => sum + (sheet.summary?.dniValidos || 0), 0),
      dniInvalidos: selected.reduce((sum, sheet) => sum + (sheet.summary?.dniInvalidos || 0), 0),
      dniUnicos: new Set(validRows.map((row) => row.dni)).size,
      personas: personas.filter((person) => person.dniValido).length,
      situacionesExtraidas: situationRows.length,
      situacionesEstimadas: situationRows.length,
      situacionesValidas: situationRows.length - semanticInvalid.length,
      situacionesConWarnings: semanticWarnings.length,
      situacionesInvalidas: semanticInvalid.length,
      bloquesVaciosDescartados: selected.reduce((sum, sheet) => sum + (sheet.summary?.bloquesVaciosDescartados || 0), 0),
      bloquesReconocidos: selected.reduce((sum, sheet) => sum + (sheet.summary?.bloquesReconocidos || 0), 0),
      columnasReconocidas: selected.reduce((sum, sheet) => sum + (sheet.summary?.columnasReconocidas || 0), 0),
      columnasMapeadas: selected.reduce((sum, sheet) => sum + (sheet.summary?.columnasMapeadas || 0), 0),
      hojasTotales: sheetAnalyses.length,
      hojasSeleccionadas: selected.length,
      erroresSemanticos: [...new Set(semanticInvalid.flatMap((row) => row.situacion.semanticValidation.errors))],
      warningsSemanticos: [...new Set(semanticWarnings.flatMap((row) => row.situacion.semanticValidation.warnings))],
    },
  };
};

export const selectPreparedSidcaSheets = (prepared, selectedSheetIndexes = []) => {
  if (!prepared?.sheets) return prepared;
  const selected = selectedSheetIndexes.filter((index) =>
    prepared.sheets.some((sheet) => sheet.sheetIndex === index && sheet.selectable)
  );
  const consolidated = consolidateSidcaSheets(prepared.sheets, selected);
  const errors = prepared.sheets
    .filter((sheet) => selected.includes(sheet.sheetIndex))
    .flatMap((sheet) => sheet.validation?.errors || []);
  const selectionErrors = selected.length ? errors : ["Seleccioná al menos una hoja compatible antes del preview."];
  return {
    ...prepared,
    selectedSheetIndexes: selected,
    rows: consolidated.rows,
    summary: consolidated.summary,
    wideParsed: consolidated,
    validation: {
      valid: selected.length > 0 && errors.length === 0,
      errors: selectionErrors,
      warnings: prepared.sheets
        .filter((sheet) => selected.includes(sheet.sheetIndex))
        .flatMap((sheet) => sheet.validation?.warnings || []),
    },
    structureValid: selected.length > 0 && errors.length === 0,
  };
};

export const prepareSidcaPresentation = async (file, mappingOverride = null) => {
  const workbook = await leerEstructuraWorkbook(file);
  const analyzedSheets = workbook.hojas.map((sheet) => ({
    ...analyzeSidcaSheet(sheet),
    coverage: SOURCE_COVERAGE.UNKNOWN,
    scope: null,
  }));
  const hasWideSheet = analyzedSheets.some((sheet) => sheet.parserMode === "wide");
  const sheets = analyzedSheets;
  const compatibleSheetIndexes = sheets
    .filter((sheet) => sheet.selectable)
    .map((sheet) => sheet.sheetIndex);
  const selectedSheetIndexes = compatibleSheetIndexes;
  const primary = sheets.find((sheet) => sheet.sheetIndex === selectedSheetIndexes[0]) || sheets[0];

  if (hasWideSheet) {
    const wideSheets = sheets.filter((sheet) => sheet.parserMode === "wide");
    const consolidated = consolidateSidcaSheets(sheets, selectedSheetIndexes);
    const wideSchema = primary?.wideSchema || wideSheets[0]?.wideSchema || detectWideTitularizacionSchema([]);
    const automaticMapping = {
      dni: wideSchema.personColumns.dni?.key || "",
      apellido: wideSchema.personColumns.apellido?.key || "",
      nombre: wideSchema.personColumns.nombre?.key || "",
      departamento: wideSchema.personColumns.departamento?.key || "",
    };
    const prepared = {
      file,
      parsed: primary || {},
      workbook,
      sheets,
      sheetNames: workbook.sheetNames,
      selectedSheetIndexes,
      compatibleSheetIndexes,
      automaticMapping,
      mapping: mappingOverride || automaticMapping,
      validation: {
        valid: selectedSheetIndexes.length > 0 && sheets
          .filter((sheet) => selectedSheetIndexes.includes(sheet.sheetIndex))
          .every((sheet) => sheet.validation.valid),
        errors: selectedSheetIndexes.length === 0
          ? ["Seleccioná al menos una hoja compatible antes del preview."]
          : sheets
          .filter((sheet) => selectedSheetIndexes.includes(sheet.sheetIndex))
          .flatMap((sheet) => sheet.validation.errors),
        warnings: sheets
          .filter((sheet) => selectedSheetIndexes.includes(sheet.sheetIndex))
          .flatMap((sheet) => sheet.validation.warnings),
      },
      rows: consolidated.rows,
      summary: consolidated.summary,
      wideSchema,
      wideSchemas: Object.fromEntries(wideSheets.map((sheet) => [sheet.sheetIndex, sheet.wideSchema])),
      wideParsed: consolidated,
      parserMode: "wide",
      structureValid: selectedSheetIndexes.length > 0 && sheets
        .filter((sheet) => selectedSheetIndexes.includes(sheet.sheetIndex))
        .every((sheet) => sheet.validation.valid),
    };
    return prepared;
  }

  const parsed = primary || {};
  const automaticMapping = autoMapSidcaColumns(parsed.columnas || []);
  const mapping = mappingOverride || automaticMapping;
  const validation = validateSidcaMapping(mapping, parsed.columnas || []);
  const rows = validation.valid ? normalizeSidcaRows({ ...parsed, mapping }) : [];
  return {
    file,
    parsed,
    workbook,
    sheets,
    sheetNames: workbook.sheetNames,
    selectedSheetIndexes: primary?.selectable ? [primary.sheetIndex] : [],
    compatibleSheetIndexes: sheets.filter((sheet) => sheet.selectable).map((sheet) => sheet.sheetIndex),
    automaticMapping,
    mapping,
    validation: { ...validation, warnings: [] },
    rows,
    summary: summarizeSidcaRows(rows),
    wideSchema: primary?.wideSchema || null,
    wideParsed: null,
    parserMode: "manual",
    structureValid: validation.valid,
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
  matchStatus: result.matchStatus ?? null,
  matchScore: result.matchScore ?? null,
  razones: result.razones || [],
  diferencias: result.diferencias || [],
  situacionIdVinculada: result.situacionIdVinculada || null,
  tipoInconsistencia: result.tipoInconsistencia || "",
  createdAt: serverTimestamp(),
  updatedAt: serverTimestamp(),
});

const buildPresentationEvidence = ({ result, situation, row, sourceId, importId, importedUser }) => {
  const tipo = result.tipoInconsistencia && result.matchStatus !== "confirmada"
    ? "revision"
    : "presentacion_sidca";
  const registroId = row?.recordKey || "sin_registro";
  const evidenceId = createEvidenceId({
    sourceId,
    importId,
    registroId,
    tipo,
  });
  return {
    evidenceId,
    data: {
      procesoId: TITULARIZACION_PROCESS_ID,
      situacionId: situation.id,
      dni: normalizeDni(situation.dni),
      tipo,
      sourceId,
      importId,
      registroId,
      numeroFila: row?.numeroFila ?? null,
      matchStatus: result.matchStatus ?? null,
      matchScore: result.matchScore ?? null,
      razones: result.razones || [],
      diferencias: result.diferencias || [],
      tipoInconsistencia: result.tipoInconsistencia || "",
      origen: "automatico",
      decididoPor: importedUser,
      createdAt: serverTimestamp(),
    },
  };
};

const metricsAfterImport = (persisted, situationSummaries, extraReviewCount) => {
  const presentadasSidca = persisted.situations.filter(
    (situacion) => situationSummaries.get(situacion.id)?.presentadaSidca || situacion.presentadoSidca
  ).length;
  const requiresReview = persisted.situations.filter(
    (situacion) => situationSummaries.get(situacion.id)?.requiereRevision || situacion.estadoResumen?.requiereRevision
  ).length;
  return {
    personas: persisted.personas.length,
    situaciones: persisted.metrics.situaciones,
    presentadasSidca,
    pendientesSidca: persisted.metrics.situaciones - presentadasSidca,
    requierenRevision:
      requiresReview +
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
  if (!TITULARIZACION_PERSISTENCE_ENABLED) {
    throw new Error("La importación está bloqueada hasta completar la auditoría de seguridad.");
  }
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
        ref: doc(collection(importRef, TITULARIZACION_IMPORTED_RECORDS_COLLECTION), recordId),
        data: buildRecordData({
          row,
          sourceId,
          importId,
          result: rowResultsByKey.get(row.recordKey),
        }),
      });
    });

    const situationSummaries = new Map();
    situationResultsById.forEach((result) => {
      const situation = result.situacion;
      const row = result.recordKey ? rowByKey.get(result.recordKey) : null;
      const evidence = buildPresentationEvidence({
        result,
        situation,
        row,
        sourceId,
        importId,
        importedUser,
      });
      const evidenceForSummary = {
        ...evidence.data,
        createdAt: null,
      };
      const summaryForSituation = deriveSituationSummary([
        ...(situation.evidencias || []),
        evidenceForSummary,
      ]);
      situationSummaries.set(situation.id, summaryForSituation);

      const personRef = doc(collection(processRef(), "personas"), situation.dni);
      const situationRef = doc(
        collection(personRef, "situaciones"),
        situation.id
      );
      operations.push({
        ref: doc(
          collection(situationRef, TITULARIZACION_EVIDENCES_COLLECTION),
          evidence.evidenceId
        ),
        data: evidence.data,
      });
      operations.push({
        ref: situationRef,
        data: {
          estadoResumen: {
            ...summaryForSituation,
            ultimaEvidenciaAt: serverTimestamp(),
          },
          updatedAt: serverTimestamp(),
        },
      });
    });

    const nextMetrics = metricsAfterImport(persisted, situationSummaries, review);
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
