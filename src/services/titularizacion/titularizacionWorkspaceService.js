import {
  buildVisiblePersonName,
  isValidDni,
  normalizeDni,
  normalizeSearchText,
  textValue,
} from "./titularizacionNormalizer";
import { mergePersonIdentity } from "./titularizacionIdentityService";
import { SOURCE_COVERAGE } from "./titularizacionSourceModel";
import { extractResolutionNumber } from "./titularizacionResolutionNumber";

export const WORKSPACE_SOURCE_TYPES = Object.freeze({
  PRESENTACION_SIDCA: "PRESENTACION_SIDCA",
  PRESENTACION_SIDCA_COMPLEMENTARIA: "PRESENTACION_SIDCA_COMPLEMENTARIA",
  MINISTERIO_APTOS: "MINISTERIO_APTOS",
  MINISTERIO_NO_APTOS: "MINISTERIO_NO_APTOS",
  MINISTERIO_OBSERVADOS: "MINISTERIO_OBSERVADOS",
  MINISTERIO_REZAGADOS: "MINISTERIO_REZAGADOS",
  MINISTERIO_OMITIDOS: "MINISTERIO_OMITIDOS",
  RESOLUCION: "RESOLUCION",
  OTRA: "OTRA",
});

export const WORKSPACE_SOURCE_TYPE_LABELS = Object.freeze({
  [WORKSPACE_SOURCE_TYPES.PRESENTACION_SIDCA]: "Presentación SIDCA",
  [WORKSPACE_SOURCE_TYPES.PRESENTACION_SIDCA_COMPLEMENTARIA]: "Presentación SIDCA complementaria",
  [WORKSPACE_SOURCE_TYPES.MINISTERIO_APTOS]: "Ministerio · Aptos",
  [WORKSPACE_SOURCE_TYPES.MINISTERIO_NO_APTOS]: "Ministerio · No aptos",
  [WORKSPACE_SOURCE_TYPES.MINISTERIO_OBSERVADOS]: "Ministerio · Observados",
  [WORKSPACE_SOURCE_TYPES.MINISTERIO_REZAGADOS]: "Ministerio · Rezagados",
  [WORKSPACE_SOURCE_TYPES.MINISTERIO_OMITIDOS]: "Ministerio · Omitidos",
  [WORKSPACE_SOURCE_TYPES.RESOLUCION]: "Resolución",
  [WORKSPACE_SOURCE_TYPES.OTRA]: "Otra fuente administrativa",
});

export const WORKSPACE_SOURCE_TYPE_SEMANTICS = Object.freeze({
  [WORKSPACE_SOURCE_TYPES.PRESENTACION_SIDCA]: { stage: "sidca", afirma: "presentada_sidca" },
  [WORKSPACE_SOURCE_TYPES.PRESENTACION_SIDCA_COMPLEMENTARIA]: { stage: "sidca", afirma: "presentada_sidca_complementaria" },
  [WORKSPACE_SOURCE_TYPES.MINISTERIO_APTOS]: { stage: "ministerio", afirma: "apta" },
  [WORKSPACE_SOURCE_TYPES.MINISTERIO_NO_APTOS]: { stage: "ministerio", afirma: "no_apta" },
  [WORKSPACE_SOURCE_TYPES.MINISTERIO_OBSERVADOS]: { stage: "ministerio", afirma: "observada" },
  [WORKSPACE_SOURCE_TYPES.MINISTERIO_REZAGADOS]: { stage: "ministerio", afirma: "rezagada" },
  [WORKSPACE_SOURCE_TYPES.MINISTERIO_OMITIDOS]: { stage: "ministerio", afirma: "omitida" },
  [WORKSPACE_SOURCE_TYPES.RESOLUCION]: { stage: "resolucion", afirma: "titularizada" },
  [WORKSPACE_SOURCE_TYPES.OTRA]: { stage: "otra", afirma: null },
});

export const WORKSPACE_SOURCE_TYPE_OPTIONS = Object.freeze(
  Object.values(WORKSPACE_SOURCE_TYPES).map((value) => ({
    value,
    label: WORKSPACE_SOURCE_TYPE_LABELS[value],
  }))
);

export const WORKSPACE_PRESENTATION_SOURCE_TYPES = Object.freeze([
  WORKSPACE_SOURCE_TYPES.PRESENTACION_SIDCA,
  WORKSPACE_SOURCE_TYPES.PRESENTACION_SIDCA_COMPLEMENTARIA,
]);

export const WORKSPACE_EXTERNAL_EVIDENCE_SOURCE_TYPES = Object.freeze([
  WORKSPACE_SOURCE_TYPES.RESOLUCION,
  WORKSPACE_SOURCE_TYPES.MINISTERIO_APTOS,
  WORKSPACE_SOURCE_TYPES.MINISTERIO_NO_APTOS,
  WORKSPACE_SOURCE_TYPES.MINISTERIO_OBSERVADOS,
  WORKSPACE_SOURCE_TYPES.MINISTERIO_REZAGADOS,
  WORKSPACE_SOURCE_TYPES.MINISTERIO_OMITIDOS,
]);

const emptyMetrics = () => ({
  fuentesCargadas: 0,
  fuentesActivas: 0,
  archivos: 0,
  hojasActivas: 0,
  personasUnicas: 0,
  personasProceso: 0,
  personasSoloMinisterio: 0,
  personasSoloPresentacionSidca: 0,
  registrosTotales: 0,
  registrosAdministrativosTotales: 0,
  situacionesInterpretadas: 0,
  situacionesEstructuradas: 0,
  personasProcesoConEvidenciaResolucion: 0,
  personasConEvidenciaResolucion177: 0,
  personasConEvidenciaResolucion222: 0,
  personasConEvidenciaEnAmbasResoluciones: 0,
  personasExternasDetectadasResoluciones: 0,
  personasExternasDetectadasMinisteriales: 0,
  personasExternas: 0,
  registrosRevision: 0,
  porTipo: Object.fromEntries(
    Object.values(WORKSPACE_SOURCE_TYPES).map((sourceType) => [sourceType, {
      fuentes: 0,
      registros: 0,
      registrosAdministrativos: 0,
      situaciones: 0,
      personas: 0,
    }])
  ),
});

export const createTitularizacionWorkspace = () => ({
  sources: [],
  activeSourceIds: [],
  persons: [],
  externalPersons: [],
  reviewRecords: [],
  metrics: emptyMetrics(),
});

const sourceIdBase = (fileName = "fuente") => {
  const normalized = normalizeSearchText(fileName)
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  return `workspace-${normalized || "fuente"}`;
};

const uniqueSourceId = (fileName, existingIds = []) => {
  const used = new Set(existingIds);
  const base = sourceIdBase(fileName);
  let candidate = base;
  let suffix = 2;
  while (used.has(candidate)) {
    candidate = `${base}-${suffix}`;
    suffix += 1;
  }
  return candidate;
};

const allSheetsFor = (prepared = {}) => prepared.sheets || [];

const selectedSheetsFor = (prepared = {}) => {
  const selectedIndexes = prepared.selectedSheetIndexes || [];
  return allSheetsFor(prepared).filter((sheet) => selectedIndexes.includes(sheet.sheetIndex));
};

const sourceSemanticsFor = ({ sourceType, stage, afirma }) => {
  const defaults = WORKSPACE_SOURCE_TYPE_SEMANTICS[sourceType] || WORKSPACE_SOURCE_TYPE_SEMANTICS[WORKSPACE_SOURCE_TYPES.OTRA];
  return {
    stage: stage !== undefined ? stage : defaults.stage,
    afirma: afirma !== undefined ? afirma : defaults.afirma,
  };
};

const isExternalEvidenceSourceType = (sourceType) =>
  WORKSPACE_EXTERNAL_EVIDENCE_SOURCE_TYPES.includes(sourceType);

const dniForRecord = (record = {}) => normalizeDni(
  record.dni ||
  record.valoresNormalizados?.dni ||
  record.valuesNormalized?.dni
);

const processDniSetFor = (processPersonByDni) => {
  if (processPersonByDni instanceof Map) {
    return new Set(
      [...processPersonByDni.entries()]
        .flatMap(([key, person]) => [key, person?.dni])
        .map((dni) => normalizeDni(dni))
        .filter((dni) => isValidDni(dni))
    );
  }
  if (Array.isArray(processPersonByDni)) {
    return new Set(
      processPersonByDni
        .map((person) => (typeof person === "string" ? person : person?.dni))
        .map((dni) => normalizeDni(dni))
        .filter((dni) => isValidDni(dni))
    );
  }
  if (processPersonByDni && typeof processPersonByDni === "object") {
    return new Set(
      Object.keys(processPersonByDni)
        .map((dni) => normalizeDni(dni))
        .filter((dni) => isValidDni(dni))
    );
  }
  return new Set();
};

export const partitionExternalEvidenceByProcessUniverse = ({
  records = [],
  processPersonByDni,
} = {}) => {
  const processDnis = processDniSetFor(processPersonByDni);
  const linkedRecords = [];
  const externalRecords = [];
  const linkedDnis = new Set();
  const externalDnis = new Set();

  records.forEach((record) => {
    const dni = dniForRecord(record);
    if (isValidDni(dni) && processDnis.has(dni)) {
      linkedRecords.push(record);
      linkedDnis.add(dni);
    } else {
      externalRecords.push(record);
      if (isValidDni(dni)) externalDnis.add(dni);
    }
  });

  return {
    linkedRecords,
    externalRecords,
    linkedPersonDnis: [...linkedDnis].sort(),
    externalPersonDnis: [...externalDnis].sort(),
  };
};

const rawRecordsFor = ({ prepared = {}, workspaceSourceId, sourceType, stage, afirma, fileName }) =>
  allSheetsFor(prepared).flatMap((sheet) =>
    (sheet.filas || []).map((rawRecord, index) => {
      const rowNumber = index + (sheet.indiceEncabezados || 0) + 2;
      return {
        workspaceSourceId,
        sourceType,
        stage,
        afirma,
        fileName,
        sheetName: sheet.sheetName || sheet.hoja || `Hoja ${sheet.sheetIndex + 1}`,
        sheetIndex: sheet.sheetIndex,
        rowNumber,
        blockIndex: null,
        raw: rawRecord,
        rawRecord,
        valoresOriginales: rawRecord,
      };
    })
  );

const rowForRawRecord = (rawRecords, row) => {
  const sheetName = row.sourceSheetName || row.hoja || null;
  const sheetIndex = row.sourceSheetIndex ?? row.sheetIndex ?? null;
  const rowNumber = row.sourceRowNumber || row.numeroFila || null;
  return rawRecords.find((rawRecord) =>
    (sheetIndex == null || rawRecord.sheetIndex === sheetIndex) &&
    (sheetName == null || rawRecord.sheetName === sheetName) &&
    (rowNumber == null || rawRecord.rowNumber === rowNumber)
  ) || null;
};

const allPreparedRowsFor = (prepared = {}) => {
  const rowsFromSheets = allSheetsFor(prepared).flatMap((sheet) =>
    (sheet.rows || []).map((row) => ({
      ...row,
      sourceSheetName: row.sourceSheetName || row.hoja || sheet.sheetName || sheet.hoja,
      sourceSheetIndex: row.sourceSheetIndex ?? row.sheetIndex ?? sheet.sheetIndex,
      sourceRowNumber: row.sourceRowNumber || row.numeroFila,
    }))
  );
  return rowsFromSheets.length ? rowsFromSheets : prepared.rows || [];
};

const preparedRowIsStructured = (prepared = {}, row = {}) =>
  Boolean(row.situacion) || prepared.parserMode === "resolution-pdf";

const workspaceRowsFor = ({ prepared = {}, workspaceSourceId, sourceType, stage, afirma, fileName, rawRecords, onlySituations = false }) =>
  allPreparedRowsFor(prepared)
    .filter((row) => !onlySituations || preparedRowIsStructured(prepared, row))
    .map((row, index) => {
    const sourceSheetName = row.sourceSheetName || row.hoja || prepared.sheets?.[0]?.sheetName || "Hoja 1";
    const sourceSheetIndex = row.sourceSheetIndex ?? row.sheetIndex ?? prepared.selectedSheetIndexes?.[0] ?? 0;
    const sourceRowNumber = row.sourceRowNumber || row.numeroFila || index + 2;
    const blockIndex = row.sourceBlockIndex ?? row.indiceBloqueOriginal ?? null;
    const raw = rowForRawRecord(rawRecords, row);
    const structured = preparedRowIsStructured(prepared, row);
    return {
      ...row,
      situacion: structured ? (row.situacion || row) : row.situacion,
      recordKey: `${workspaceSourceId}::${row.recordKey || `fila_${sourceRowNumber}_${index}`}`,
      workspaceSourceId,
      sourceType,
      stage,
      afirma,
      fileName,
      sourceSheetName,
      sourceSheetIndex,
      sourceRowNumber,
      blockIndex,
      rawRecord: row.rawRecord || raw?.rawRecord || row.valoresOriginales || null,
      evidence: row.evidence
        ? {
          ...row.evidence,
          sourceId: workspaceSourceId,
          workspaceSourceId,
          etapa: stage,
          afirma,
          provenance: {
            ...(row.evidence.provenance || {}),
            workspaceSourceId,
            sourceType,
            stage,
            afirma,
          },
        }
        : undefined,
      provenance: {
        ...(row.provenance || {}),
        workspaceSourceId,
        sourceType,
        stage,
        afirma,
        fileName,
        sheetName: sourceSheetName,
        sheetIndex: sourceSheetIndex,
        rowNumber: sourceRowNumber,
        blockIndex,
        pageNumber: row.pageNumber || sourceSheetIndex + 1,
        anexo: row.anexo || null,
        rowIndex: row.rowIndex || null,
      },
    };
    });

const administrativeRecordsFor = (args = {}) => workspaceRowsFor({ ...args, onlySituations: false })
  .filter((row) => !row.situacion);

const interpretedRowsFor = (args = {}) => workspaceRowsFor({ ...args, onlySituations: true });

const sourcePeopleFromRows = (rows = []) => {
  const people = new Map();
  rows.forEach((row) => {
    const values = row.valoresNormalizados || row.valuesNormalized || {};
    const dni = normalizeDni(row.dni || values.dni);
    const key = isValidDni(dni) ? `dni:${dni}` : `revision:${row.recordKey}`;
    const current = people.get(key) || {
      id: dni || key,
      dni,
      apellido: values.apellido || row.apellido || "",
      nombre: values.nombre || row.nombre || "",
      departamento: values.departamento || row.departamento || "",
      situaciones: [],
      recordKeys: [],
    };
    current.recordKeys.push(row.recordKey);
    if (row.situacion) current.situaciones.push(row.situacion);
    if (!current.apellido) current.apellido = values.apellido || row.apellido || "";
    if (!current.nombre) current.nombre = values.nombre || row.nombre || "";
    if (!current.departamento) current.departamento = values.departamento || row.departamento || "";
    people.set(key, current);
  });
  return [...people.values()];
};

export const createTitularizacionWorkspaceSource = ({
  prepared,
  sourceType = WORKSPACE_SOURCE_TYPES.PRESENTACION_SIDCA,
  stage,
  afirma,
  displayName = "",
  fileName = prepared?.file?.name || "fuente.xlsx",
  coverage = SOURCE_COVERAGE.UNKNOWN,
  scope = {},
  fileHash = prepared?.fileHash || null,
  workspaceSourceId,
  existingSourceIds = [],
} = {}) => {
  const id = workspaceSourceId || uniqueSourceId(fileName, existingSourceIds);
  const semantics = sourceSemanticsFor({ sourceType, stage, afirma });
  const rawRecords = rawRecordsFor({ prepared, workspaceSourceId: id, sourceType, ...semantics, fileName });
  const administrativeRecords = administrativeRecordsFor({
    prepared,
    workspaceSourceId: id,
    sourceType,
    ...semantics,
    fileName,
    rawRecords,
  });
  const interpretedSituations = interpretedRowsFor({
    prepared,
    workspaceSourceId: id,
    sourceType,
    ...semantics,
    fileName,
    rawRecords,
  });
  const people = sourcePeopleFromRows([...administrativeRecords, ...interpretedSituations]);
  const selectedSheets = selectedSheetsFor(prepared);

  const source = {
    workspaceSourceId: id,
    sourceType,
    ...semantics,
    displayName: displayName || fileName,
    fileName,
    fileHash,
    documentKind: prepared?.documentKind || (prepared?.parserMode === "resolution-pdf" ? "pdf" : "excel"),
    pdfMetadata: prepared?.pdfMetadata || null,
    resolutionNumber: prepared?.resolutionNumber || null,
    resolutionDate: prepared?.resolutionDate || null,
    workbookMetadata: {
      sheetNames: prepared?.sheetNames || prepared?.workbook?.sheetNames || [],
      sheetCount: prepared?.sheets?.length || 0,
      parserMode: prepared?.parserMode || "unknown",
      structureValid: prepared?.structureValid !== false,
    },
    sheets: prepared?.sheets || [],
    selectedSheets: selectedSheets.map((sheet) => ({
      sheetIndex: sheet.sheetIndex,
      sheetName: sheet.sheetName || sheet.hoja || `Hoja ${sheet.sheetIndex + 1}`,
      rowCount: sheet.rowCount || sheet.filas?.length || 0,
      status: sheet.status,
    })),
    selectedSheetIndexes: prepared?.selectedSheetIndexes || [],
    enabled: true,
    coverage,
    scope,
    rawRecords,
    administrativeRecords,
    interpretedSituations,
    persons: people,
    diagnostics: {
      ...prepared?.summary,
      registros: rawRecords.length,
      registrosAdministrativos: administrativeRecords.length,
      situacionesInterpretadas: interpretedSituations.length,
      personas: people.filter((person) => isValidDni(person.dni)).length,
      personasDetectadas: people.length,
      personasRevision: people.filter((person) => !isValidDni(person.dni)).length,
      hojasSeleccionadas: selectedSheets.length,
      warnings: prepared?.validation?.warnings || [],
      errors: prepared?.validation?.errors || [],
    },
  };
  return {
    ...source,
    metrics: sourceMetricsFor(source, true),
  };
};

const sourceIsActive = (workspace, source) =>
  source.enabled !== false && workspace.activeSourceIds.includes(source.workspaceSourceId);

const selectedSheetIndexesForSource = (source = {}) => (
  Array.isArray(source.selectedSheetIndexes)
    ? source.selectedSheetIndexes
    : (source.selectedSheets || []).map((sheet) => sheet.sheetIndex)
);

const activeRawRecordsFor = (source = {}) => {
  const selectedIndexes = new Set(selectedSheetIndexesForSource(source));
  return (source.rawRecords || []).filter((record) => selectedIndexes.has(record.sheetIndex));
};

const activeAdministrativeRecordsFor = (source = {}) => {
  const selectedIndexes = new Set(selectedSheetIndexesForSource(source));
  return (source.administrativeRecords || []).filter((record) => selectedIndexes.has(record.sourceSheetIndex));
};

const activeInterpretedSituationsFor = (source = {}) => {
  const selectedIndexes = new Set(selectedSheetIndexesForSource(source));
  return (source.interpretedSituations || []).filter((record) => selectedIndexes.has(record.sourceSheetIndex));
};

const sourceEvidenceRecordsFor = (source = {}, activeOnly = false) => [
  ...(activeOnly ? activeAdministrativeRecordsFor(source) : (source.administrativeRecords || [])),
  ...(activeOnly ? activeInterpretedSituationsFor(source) : (source.interpretedSituations || [])),
];

const sourceEvidencePartitionFor = (source = {}, processPersonByDni, activeOnly = false) =>
  partitionExternalEvidenceByProcessUniverse({
    records: sourceEvidenceRecordsFor(source, activeOnly),
    processPersonByDni,
  });

const sourceMetricsFor = (source = {}, enabled = true, processPersonByDni) => {
  const activeRawRecords = enabled ? activeRawRecordsFor(source) : [];
  const activeAdministrativeRecords = enabled ? activeAdministrativeRecordsFor(source) : [];
  const activeSituations = enabled ? activeInterpretedSituationsFor(source) : [];
  const activePeople = sourcePeopleFromRows([...activeAdministrativeRecords, ...activeSituations]);
  const evidencePartition = sourceEvidencePartitionFor(source, processPersonByDni);
  const activeEvidencePartition = sourceEvidencePartitionFor(source, processPersonByDni, enabled);
  return {
    personasDetectadas: (source.persons || []).length,
    personasValidasDetectadas: (source.persons || []).filter((person) => isValidDni(person.dni)).length,
    personasActivas: activePeople.filter((person) => isValidDni(person.dni)).length,
    registrosOriginales: (source.rawRecords || []).length,
    registrosActivos: activeRawRecords.length,
    registrosAdministrativos: (source.administrativeRecords || []).length,
    registrosAdministrativosActivos: activeAdministrativeRecords.length,
    situacionesInterpretadas: (source.interpretedSituations || []).length,
    situacionesEstructuradas: (source.interpretedSituations || []).length,
    situacionesActivas: activeSituations.length,
    situacionesEstructuradasActivas: activeSituations.length,
    personasSidcaEncontradas: evidencePartition.linkedPersonDnis.length,
    registrosSidca: evidencePartition.linkedRecords.length,
    personasExternasFuente: evidencePartition.externalPersonDnis.length,
    registrosExternos: evidencePartition.externalRecords.length,
    personasSidcaActivas: activeEvidencePartition.linkedPersonDnis.length,
    registrosSidcaActivos: activeEvidencePartition.linkedRecords.length,
    personasExternasFuenteActivas: activeEvidencePartition.externalPersonDnis.length,
    registrosExternosActivos: activeEvidencePartition.externalRecords.length,
    hojasSeleccionadas: (source.selectedSheets || []).length,
  };
};

const sourceMetadata = (source) => ({
  workspaceSourceId: source.workspaceSourceId,
  sourceType: source.sourceType,
  stage: source.stage,
  afirma: source.afirma,
  displayName: source.displayName,
  fileName: source.fileName,
  fileHash: source.fileHash || null,
  documentKind: source.documentKind,
  resolutionNumber: source.resolutionNumber,
  resolutionDate: source.resolutionDate,
});

const personRecordFor = (record, source) => ({
  ...record,
  ...sourceMetadata(source),
  rawRecord: record.rawRecord || record.valoresOriginales || null,
});

const addUniqueSource = (sources, source) => {
  const key = source.workspaceSourceId;
  if (sources.some((item) => item.workspaceSourceId === key)) return sources;
  return [...sources, sourceMetadata(source)];
};

const addRecordToPerson = (person, record, source) => {
  const next = { ...person };
  next.registros = [...(person.registros || []), personRecordFor(record, source)];
  next.fuentesWorkspace = addUniqueSource(person.fuentesWorkspace || [], source);
  next.situacionesWorkspace = [
    ...(person.situacionesWorkspace || []),
    ...(record.situacion ? [personRecordFor(record, source)] : []),
  ];
  next.nombreCompleto = buildVisiblePersonName(next);
  next.searchable = normalizeSearchText([
    next.dni,
    next.apellido,
    next.nombre,
    next.nombreCompleto,
    ...(next.fuentesWorkspace || []).map((item) => item.fileName),
  ].filter(Boolean).join(" "));
  return next;
};

const basePerson = (person) => ({
  ...person,
  dni: normalizeDni(person.dni),
  nombreCompleto: buildVisiblePersonName(person),
  registros: [],
  fuentesWorkspace: [],
  situacionesWorkspace: [],
  searchable: normalizeSearchText([
    person.dni,
    person.apellido,
    person.nombre,
    person.nombreCompleto,
  ].filter(Boolean).join(" ")),
});

const externalPersonFromRecord = (record, source) => ({
  id: normalizeDni(record.dni) || `revision:${record.recordKey}`,
  dni: normalizeDni(record.dni),
  apellido: record.apellido || record.valoresNormalizados?.apellido || "",
  nombre: record.nombre || record.valoresNormalizados?.nombre || "",
  nombreCompleto: buildVisiblePersonName({
    apellido: record.apellido || record.valoresNormalizados?.apellido,
    nombre: record.nombre || record.valoresNormalizados?.nombre,
    nombreCompleto: record.valoresNormalizados?.apellidoNombre,
  }),
  esExterna: true,
  estado: record.situacion ? "PRESENTADA_SIN_ANTECEDENTE" : "REGISTRO_ADMINISTRATIVO_SIN_SITUACION",
  registros: [personRecordFor(record, source)],
  fuentesWorkspace: [sourceMetadata(source)],
  situacionesWorkspace: record.situacion ? [personRecordFor(record, source)] : [],
});

const mergeExternalRecord = (person, record, source) => ({
  ...person,
  registros: [...person.registros, personRecordFor(record, source)],
  fuentesWorkspace: addUniqueSource(person.fuentesWorkspace, source),
  situacionesWorkspace: [
    ...person.situacionesWorkspace,
    ...(record.situacion ? [personRecordFor(record, source)] : []),
  ],
});

const mergeCoverage = (sources) => {
  if (!sources.length) return SOURCE_COVERAGE.UNKNOWN;
  if (sources.every((source) => source.coverage === SOURCE_COVERAGE.COMPLETE)) return SOURCE_COVERAGE.COMPLETE;
  if (sources.some((source) => source.coverage === SOURCE_COVERAGE.PARTIAL)) return SOURCE_COVERAGE.PARTIAL;
  return SOURCE_COVERAGE.UNKNOWN;
};

const mergeScopes = (sources) => {
  const scopeKeys = [
    "niveles",
    "departamentos",
    "tiposCargo",
    "modalidades",
    "establecimientos",
  ];
  const merged = {};
  scopeKeys.forEach((key) => {
    const values = sources.flatMap((source) => Array.isArray(source.scope?.[key]) ? source.scope[key] : []);
    merged[key] = values.length ? [...new Set(values)] : null;
  });
  const periods = sources
    .map((source) => source.scope?.periodo)
    .filter((period) => period && period.desde && period.hasta);
  merged.periodo = periods.length === 1
    ? periods[0]
    : periods.length > 1 && periods.every((period) => period.desde === periods[0].desde && period.hasta === periods[0].hasta)
      ? periods[0]
      : null;
  return merged;
};

const resolutionKeyFor = (source = {}) => extractResolutionNumber(
  source.resolutionNumber,
  source.fileName,
  source.displayName
);

const evidenceDnisForSources = (sources = [], keyPredicate = () => true, field = "linkedPersonDnis") =>
  new Set(
    sources
      .filter(keyPredicate)
      .flatMap((source) => source.evidencePartition?.[field] || [])
  );

const recalculateMetrics = (workspace, activeSources, persons, externalPersons, reviewRecords) => {
  const metrics = emptyMetrics();
  metrics.fuentesCargadas = workspace.sources.length;
  metrics.fuentesActivas = activeSources.length;
  metrics.archivos = new Set(activeSources.map((source) => source.fileName)).size;
  metrics.hojasActivas = activeSources.reduce((total, source) => total + source.selectedSheets.length, 0);
  metrics.personasUnicas = persons.length;
  metrics.personasProceso = persons.length;
  metrics.personasSoloMinisterio = persons.filter((person) => {
    const types = (person.fuentesWorkspace || []).map((source) => source.sourceType);
    return types.some((type) => type?.startsWith("MINISTERIO")) &&
      !types.some((type) => WORKSPACE_PRESENTATION_SOURCE_TYPES.includes(type));
  }).length;
  metrics.personasSoloPresentacionSidca = persons.filter((person) => {
    const types = (person.fuentesWorkspace || []).map((source) => source.sourceType);
    return types.some((type) => WORKSPACE_PRESENTATION_SOURCE_TYPES.includes(type)) &&
      !types.some((type) => type?.startsWith("MINISTERIO"));
  }).length;
  metrics.registrosTotales = activeSources.reduce(
    (total, source) => total + sourceMetricsFor(source, true).registrosActivos,
    0
  );
  metrics.registrosAdministrativosTotales = activeSources.reduce(
    (total, source) => total + sourceMetricsFor(source, true).registrosAdministrativosActivos,
    0
  );
  metrics.situacionesInterpretadas = activeSources.reduce(
    (total, source) => total + sourceMetricsFor(source, true).situacionesActivas,
    0
  );
  metrics.situacionesEstructuradas = metrics.situacionesInterpretadas;
  const resolutionSources = activeSources.filter((source) => source.sourceType === WORKSPACE_SOURCE_TYPES.RESOLUCION);
  const ministerialSources = activeSources.filter((source) => source.stage === "ministerio");
  const resolutionDnis = evidenceDnisForSources(resolutionSources);
  const resolutionExternalDnis = evidenceDnisForSources(resolutionSources, () => true, "externalPersonDnis");
  const ministerialExternalDnis = evidenceDnisForSources(ministerialSources, () => true, "externalPersonDnis");
  const resolution177 = evidenceDnisForSources(
    resolutionSources,
    (source) => resolutionKeyFor(source) === "177"
  );
  const resolution222 = evidenceDnisForSources(
    resolutionSources,
    (source) => resolutionKeyFor(source) === "222"
  );
  metrics.personasProcesoConEvidenciaResolucion = resolutionDnis.size;
  metrics.personasConEvidenciaResolucion177 = resolution177.size;
  metrics.personasConEvidenciaResolucion222 = resolution222.size;
  metrics.personasConEvidenciaEnAmbasResoluciones = [...resolution177]
    .filter((dni) => resolution222.has(dni)).length;
  metrics.personasExternasDetectadasResoluciones = resolutionExternalDnis.size;
  metrics.personasExternasDetectadasMinisteriales = ministerialExternalDnis.size;
  metrics.personasExternas = externalPersons.length;
  metrics.registrosRevision = reviewRecords.length;
  activeSources.forEach((source) => {
    const typeMetrics = metrics.porTipo[source.sourceType] || {
      fuentes: 0,
      registros: 0,
      registrosAdministrativos: 0,
      situaciones: 0,
      personas: 0,
    };
    typeMetrics.fuentes += 1;
    const sourceMetrics = sourceMetricsFor(source, true);
    typeMetrics.registros += sourceMetrics.registrosActivos;
    typeMetrics.registrosAdministrativos += sourceMetrics.registrosAdministrativosActivos;
    typeMetrics.situaciones += sourceMetrics.situacionesActivas;
    typeMetrics.personas += sourceMetrics.personasActivas;
    metrics.porTipo[source.sourceType] = typeMetrics;
  });
  return metrics;
};

export const rebuildTitularizacionWorkspace = (
  workspace = createTitularizacionWorkspace(),
  { basePeople } = {}
) => {
  const hasProcessUniverse = Array.isArray(basePeople);
  const processPersonByDni = new Map(
    (hasProcessUniverse ? basePeople : [])
      .map((person) => [normalizeDni(person.dni), person])
      .filter(([dni]) => isValidDni(dni))
  );
  const sources = workspace.sources.map((source) => {
    const evidencePartition = sourceEvidencePartitionFor(source, processPersonByDni);
    return {
      ...source,
      evidencePartition,
      linkedEvidenceRecords: evidencePartition.linkedRecords,
      externalEvidenceRecords: evidencePartition.externalRecords,
      metrics: sourceMetricsFor(source, sourceIsActive(workspace, source), processPersonByDni),
    };
  });
  const workspaceWithSourceMetrics = { ...workspace, sources };
  const activeSources = sources.filter((source) => sourceIsActive(workspaceWithSourceMetrics, source));
  const peopleByDni = new Map();
  const externalByKey = new Map();

  (hasProcessUniverse ? basePeople : activeSources
    .filter((source) => !isExternalEvidenceSourceType(source.sourceType))
    .flatMap((source) => sourcePeopleFromRows([
    ...activeAdministrativeRecordsFor(source),
    ...activeInterpretedSituationsFor(source),
    ])))
    .filter((person) => isValidDni(person.dni))
    .forEach((person) => {
      const dni = normalizeDni(person.dni);
      if (!peopleByDni.has(dni)) peopleByDni.set(dni, basePerson(person));
      else peopleByDni.set(dni, mergePersonIdentity(peopleByDni.get(dni), person));
    });

  const reviewRecords = [];
  activeSources.forEach((source) => {
    const isExternalEvidence = isExternalEvidenceSourceType(source.sourceType);
    [
      ...activeAdministrativeRecordsFor(source),
      ...activeInterpretedSituationsFor(source),
    ].forEach((record) => {
      const dni = normalizeDni(record.dni || record.valoresNormalizados?.dni);
      if (!isValidDni(dni)) {
        if (!isExternalEvidence) reviewRecords.push(personRecordFor(record, source));
        return;
      }
      if (peopleByDni.has(dni)) {
        const current = peopleByDni.get(dni);
        const candidate = {
          sourceType: source.sourceType,
          dni,
          apellido: record.apellido || record.valoresNormalizados?.apellido,
          nombre: record.nombre || record.valoresNormalizados?.nombre,
          departamento: record.departamento || record.valoresNormalizados?.departamento,
        };
        const merged = mergePersonIdentity(current, candidate);
        peopleByDni.set(dni, addRecordToPerson(merged, record, source));
        return;
      }
      if (hasProcessUniverse && !isExternalEvidence) {
        const key = `dni:${dni}`;
        const current = externalByKey.get(key);
        externalByKey.set(key, current
          ? mergeExternalRecord(current, record, source)
          : externalPersonFromRecord(record, source));
      } else if (!hasProcessUniverse && !isExternalEvidence) {
        const current = peopleByDni.get(dni);
        if (current) peopleByDni.set(dni, addRecordToPerson(current, record, source));
        else peopleByDni.set(dni, externalPersonFromRecord(record, source));
      }
    });
  });

  const persons = [...peopleByDni.values()].map((person) => ({
    ...person,
    fuentesCount: person.fuentesWorkspace.length,
    registrosCount: person.registros.length,
    situacionesEstructuradasCount:
      (person.situaciones || []).length + person.situacionesWorkspace.length,
    nombreCompleto: buildVisiblePersonName(person),
  }));
  const externalPersons = [...externalByKey.values()].map((person) => ({
    ...person,
    fuentesCount: person.fuentesWorkspace.length,
    registrosCount: person.registros.length,
    situacionesEstructuradasCount: person.situacionesWorkspace.length,
  }));

  return {
    ...workspaceWithSourceMetrics,
    persons,
    externalPersons,
    reviewRecords,
    metrics: recalculateMetrics(workspace, activeSources, persons, externalPersons, reviewRecords),
  };
};

export const findTitularizacionWorkspaceDuplicate = (
  workspace = createTitularizacionWorkspace(),
  source = {}
) => {
  const fileHash = source.fileHash;
  if (!fileHash) return null;
  return workspace.sources.find((item) => item.fileHash && item.fileHash === fileHash) || null;
};

export const addTitularizacionWorkspaceSource = (
  workspace = createTitularizacionWorkspace(),
  source,
  options = {}
) => {
  if (findTitularizacionWorkspaceDuplicate(workspace, source)) return workspace;
  const id = source.workspaceSourceId &&
    !workspace.sources.some((item) => item.workspaceSourceId === source.workspaceSourceId)
    ? source.workspaceSourceId
    : uniqueSourceId(source.fileName, workspace.sources.map((item) => item.workspaceSourceId));
  const sourceWithId = { ...source, workspaceSourceId: id };
  return rebuildTitularizacionWorkspace(
    {
      ...workspace,
      sources: [...workspace.sources, sourceWithId],
      activeSourceIds: [...new Set([...workspace.activeSourceIds, id])],
    },
    options
  );
};

export const setTitularizacionWorkspaceSourceEnabled = (
  workspace = createTitularizacionWorkspace(),
  workspaceSourceId,
  enabled,
  options = {}
) => rebuildTitularizacionWorkspace(
  {
    ...workspace,
    sources: workspace.sources.map((source) =>
      source.workspaceSourceId === workspaceSourceId ? { ...source, enabled } : source
    ),
    activeSourceIds: enabled
      ? [...new Set([...workspace.activeSourceIds, workspaceSourceId])]
      : workspace.activeSourceIds.filter((id) => id !== workspaceSourceId),
  },
  options
);

export const removeTitularizacionWorkspaceSource = (
  workspace = createTitularizacionWorkspace(),
  workspaceSourceId,
  options = {}
) => rebuildTitularizacionWorkspace(
  {
    ...workspace,
    sources: workspace.sources.filter((source) => source.workspaceSourceId !== workspaceSourceId),
    activeSourceIds: workspace.activeSourceIds.filter((id) => id !== workspaceSourceId),
  },
  options
);

export const updateTitularizacionWorkspaceSource = (
  workspace = createTitularizacionWorkspace(),
  workspaceSourceId,
  changes = {},
  options = {}
) => {
  const sources = workspace.sources.map((source) => {
    if (source.workspaceSourceId !== workspaceSourceId) return source;
    const sourceTypeChanged = changes.sourceType !== undefined && changes.sourceType !== source.sourceType;
    const nextSemantics = sourceSemanticsFor({
      sourceType: changes.sourceType || source.sourceType,
      stage: changes.stage !== undefined ? changes.stage : sourceTypeChanged ? undefined : source.stage,
      afirma: changes.afirma !== undefined ? changes.afirma : sourceTypeChanged ? undefined : source.afirma,
    });
    const next = { ...source, ...changes, ...nextSemantics };
    return {
      ...next,
      rawRecords: (source.rawRecords || []).map((record) => ({
        ...record,
        sourceType: next.sourceType,
        stage: next.stage,
        afirma: next.afirma,
        fileName: next.fileName,
      })),
      administrativeRecords: (source.administrativeRecords || []).map((record) => ({
        ...record,
        sourceType: next.sourceType,
        stage: next.stage,
        afirma: next.afirma,
        fileName: next.fileName,
        provenance: {
          ...(record.provenance || {}),
          sourceType: next.sourceType,
          stage: next.stage,
          afirma: next.afirma,
          fileName: next.fileName,
        },
      })),
      interpretedSituations: (source.interpretedSituations || []).map((record) => ({
        ...record,
        sourceType: next.sourceType,
        stage: next.stage,
        afirma: next.afirma,
        fileName: next.fileName,
        displayName: next.displayName,
        provenance: {
          ...(record.provenance || {}),
          sourceType: next.sourceType,
          stage: next.stage,
          afirma: next.afirma,
          fileName: next.fileName,
        },
      })),
    };
  });
  return rebuildTitularizacionWorkspace({ ...workspace, sources }, options);
};

export const getActiveTitularizacionWorkspaceSources = (workspace = createTitularizacionWorkspace()) =>
  workspace.sources.filter((source) => sourceIsActive(workspace, source));

export const getTitularizacionWorkspacePreviewRows = (workspace = createTitularizacionWorkspace()) =>
  getActiveTitularizacionWorkspaceSources(workspace)
    .filter((source) => WORKSPACE_PRESENTATION_SOURCE_TYPES.includes(source.sourceType))
    .flatMap((source) => activeInterpretedSituationsFor(source));

export const getTitularizacionWorkspacePreviewConfig = (workspace = createTitularizacionWorkspace()) => {
  const sources = getActiveTitularizacionWorkspaceSources(workspace)
    .filter((source) => WORKSPACE_PRESENTATION_SOURCE_TYPES.includes(source.sourceType));
  return {
    sourceIds: sources.map((source) => source.workspaceSourceId),
    sourceTypes: [...new Set(sources.map((source) => source.sourceType))],
    coverage: mergeCoverage(sources),
    scope: mergeScopes(sources),
    fileName: sources.length === 1
      ? sources[0].fileName
      : `Workspace multifuente (${sources.length} presentaciones)`,
  };
};

export const searchTitularizacionWorkspacePeople = (
  workspace = createTitularizacionWorkspace(),
  term = ""
) => {
  const normalizedTerm = normalizeSearchText(term);
  if (!normalizedTerm) return workspace.persons;
  return workspace.persons.filter((person) => {
    const recordText = (person.registros || [])
      .map((record) => [record.dni, record.apellido, record.nombre, record.fileName, record.sheetName].join(" "))
      .join(" ");
    return normalizeSearchText([
      person.dni,
      person.apellido,
      person.nombre,
      person.nombreCompleto,
      recordText,
    ].filter(Boolean).join(" ")).includes(normalizedTerm);
  });
};

export const workspaceSourceTypeLabel = (sourceType) =>
  WORKSPACE_SOURCE_TYPE_LABELS[sourceType] || textValue(sourceType) || "Otra fuente";
