import { matchSituationsOneToOne } from "./titularizacionMatcher";
import {
  buildMinisterialCrossPreview,
} from "./titularizacionMinisterialCrossService";
import {
  WORKSPACE_SOURCE_TYPES,
  addTitularizacionWorkspaceSource,
  createTitularizacionWorkspace,
  createTitularizacionWorkspaceSource,
  getTitularizacionWorkspacePreviewRows,
} from "./titularizacionWorkspaceService";
import { parseTitularizacionResolutionPdfPages } from "./titularizacionResolucionPdfParser";

const resolutionPage = ({ number = 1, resolution = "RESGE-2026-222-E-CAT-MET", rows = [] } = {}) => ({
  pageNumber: number,
  hasText: true,
  text: [
    resolution,
    "ANEXO II",
    "DNI|APELLIDO|NOMBRE|ID PLAZA|CARGO|HORAS|MATERIA|ESTABLECIMIENTO|NIVEL|DEPARTAMENTO|AÑO|DIVISIÓN",
    ...rows.map((row) => [
      row.dni,
      row.apellido || "PEREZ",
      row.nombre || "ANA",
      row.idPlaza || "",
      row.cargo || "Profesor",
      row.horas || "4",
      row.materia || "Matemática",
      row.establecimiento || "Escuela 91",
      row.nivel || "Secundario",
      row.departamento || "Capital",
      row.cursoAnio || "3",
      row.division || "A",
    ].join("|")),
  ].join("\n"),
});

const preparedFrom = (parsed) => ({
  file: { name: `${parsed.fileName}` },
  documentKind: "pdf",
  parserMode: "resolution-pdf",
  sourceType: parsed.sourceType,
  stage: parsed.stage,
  afirma: parsed.afirma,
  coverage: parsed.coverage,
  resolutionNumber: parsed.resolutionNumber,
  resolutionDate: parsed.resolutionDate,
  pdfMetadata: {
    pageCount: parsed.pageCount,
    textPages: parsed.textPages,
    emptyPages: parsed.emptyPages,
    possibleScanned: parsed.possibleScanned,
  },
  sheets: parsed.pages.map((page) => ({
    sheetIndex: page.pageNumber - 1,
    sheetName: `Página ${page.pageNumber}`,
    pageNumber: page.pageNumber,
    filas: page.rows.map((row) => row.rawRecord),
    rows: page.rows,
    rowCount: page.rows.length,
  })),
  selectedSheetIndexes: parsed.pages.map((page) => page.pageNumber - 1),
  sheetNames: parsed.pages.map((page) => `Página ${page.pageNumber}`),
  rows: parsed.rows,
  summary: parsed.summary,
  validation: { valid: true, errors: [], warnings: [] },
  structureValid: true,
});

test("extrae DNI, ID Plaza, resolución, anexo y página desde una fila", () => {
  const parsed = parseTitularizacionResolutionPdfPages({
    fileName: "RESGE-2026-222-E-CAT-MET.pdf",
    pages: [resolutionPage({ rows: [{ dni: "29837689", idPlaza: "905723" }] })],
  });
  const row = parsed.rows[0];

  expect(row).toMatchObject({
    sourceType: WORKSPACE_SOURCE_TYPES.RESOLUCION,
    stage: "resolucion",
    afirma: "titularizada",
    dni: "29837689",
    dniOriginal: "29837689",
    idPlaza: "905723",
    idPlazaOriginal: "905723",
    resolucionNumero: "RESGE-2026-222-E-CAT-MET",
    anexo: "II",
    pageNumber: 1,
    rowIndex: 1,
    sourceSheetIndex: 0,
    externalIds: { ministryPlazaId: "905723" },
  });
  expect(row.rawRecord.textOriginal).toContain("29837689");
  expect(row.provenance).toMatchObject({
    fileName: "RESGE-2026-222-E-CAT-MET.pdf",
    pageNumber: 1,
    anexo: "II",
    rowIndex: 1,
  });
  expect(row.evidence).toMatchObject({
    etapa: "resolucion",
    afirma: "titularizada",
    idPlaza: "905723",
  });
  expect(parsed.coverage).toBe("unknown");
});

test("un DNI con tres ID Plaza conserva una persona y tres registros", () => {
  const parsed = parseTitularizacionResolutionPdfPages({
    fileName: "RESGE-2026-222-E-CAT-MET.pdf",
    pages: [resolutionPage({ rows: [
      { dni: "29837689", idPlaza: "905723" },
      { dni: "29837689", idPlaza: "905724" },
      { dni: "29837689", idPlaza: "905725" },
    ] })],
  });
  const source = createTitularizacionWorkspaceSource({
    prepared: preparedFrom(parsed),
    sourceType: WORKSPACE_SOURCE_TYPES.RESOLUCION,
    fileName: "RESGE-2026-222-E-CAT-MET.pdf",
  });
  const workspace = addTitularizacionWorkspaceSource(createTitularizacionWorkspace(), source, {
    basePeople: [{ dni: "29837689", apellido: "PEREZ", nombre: "ANA" }],
  });

  expect(workspace.persons).toHaveLength(1);
  expect(workspace.persons[0].registros).toHaveLength(3);
  expect(workspace.persons[0].registros.map((record) => record.idPlaza)).toEqual([
    "905723",
    "905724",
    "905725",
  ]);
  expect(workspace.metrics.porTipo.RESOLUCION).toMatchObject({
    personas: 1,
    registros: 3,
    situaciones: 3,
  });
});

test("un DNI que sólo aparece en el PDF queda separado como persona externa", () => {
  const parsed = parseTitularizacionResolutionPdfPages({
    fileName: "RESGE-2026-222-E-CAT-MET.pdf",
    pages: [resolutionPage({ rows: [{ dni: "29837689", idPlaza: "905723" }] })],
  });
  const source = createTitularizacionWorkspaceSource({
    prepared: preparedFrom(parsed),
    sourceType: WORKSPACE_SOURCE_TYPES.RESOLUCION,
    fileName: "RESGE-2026-222-E-CAT-MET.pdf",
  });
  const workspace = addTitularizacionWorkspaceSource(createTitularizacionWorkspace(), source, {
    basePeople: [{ dni: "30111222", apellido: "Ramos", nombre: "Sofía" }],
  });

  expect(workspace.persons.map((person) => person.dni)).toEqual(["30111222"]);
  expect(workspace.externalPersons).toHaveLength(0);
  expect(workspace.sources[0].metrics).toMatchObject({
    personasExternasFuente: 1,
    registrosExternos: 1,
  });
});

test("la selección de páginas del PDF limita registros activos sin perder los originales", () => {
  const parsed = parseTitularizacionResolutionPdfPages({
    fileName: "RESGE-2026-222-E-CAT-MET.pdf",
    pages: [
      resolutionPage({ number: 1, rows: [{ dni: "29837689", idPlaza: "905723" }] }),
      resolutionPage({ number: 2, rows: [{ dni: "29837689", idPlaza: "905724" }] }),
    ],
  });
  const prepared = { ...preparedFrom(parsed), selectedSheetIndexes: [1] };
  const source = createTitularizacionWorkspaceSource({
    prepared,
    sourceType: WORKSPACE_SOURCE_TYPES.RESOLUCION,
    fileName: "RESGE-2026-222-E-CAT-MET.pdf",
  });
  const workspace = addTitularizacionWorkspaceSource(createTitularizacionWorkspace(), source, {
    basePeople: [{ dni: "29837689", apellido: "PEREZ", nombre: "ANA" }],
  });

  expect(source.rawRecords).toHaveLength(2);
  expect(source.interpretedSituations).toHaveLength(2);
  expect(workspace.metrics.registrosTotales).toBe(1);
  expect(workspace.persons[0].registros.map((record) => record.idPlaza)).toEqual(["905724"]);
});

test("una página sin texto se informa como posible escaneada y no genera filas", () => {
  const parsed = parseTitularizacionResolutionPdfPages({
    fileName: "RESGE-2026-177-E-CAT-MET.pdf",
    pages: [{ pageNumber: 4, hasText: false, text: "" }],
  });
  expect(parsed).toMatchObject({
    possibleScanned: true,
    emptyPages: [4],
    rows: [],
    coverage: "unknown",
  });
});

test("agregar una resolución no ejecuta Matcher ni cambia el preview SIDCA", () => {
  const sidcaParsed = parseTitularizacionResolutionPdfPages({
    fileName: "presentacion.xlsx",
    pages: [resolutionPage({ resolution: "NO ES RESOLUCION", rows: [{ dni: "29837689", idPlaza: "" }] })],
  });
  const sidcaSource = createTitularizacionWorkspaceSource({
    prepared: {
      ...preparedFrom(sidcaParsed),
      documentKind: "excel",
      parserMode: "wide",
      sourceType: WORKSPACE_SOURCE_TYPES.PRESENTACION_SIDCA,
      stage: "sidca",
      afirma: "presentada_sidca",
    },
    sourceType: WORKSPACE_SOURCE_TYPES.PRESENTACION_SIDCA,
    fileName: "presentacion.xlsx",
  });
  const resolutionParsed = parseTitularizacionResolutionPdfPages({
    fileName: "RESGE-2026-222-E-CAT-MET.pdf",
    pages: [resolutionPage({ rows: [{ dni: "29837689", idPlaza: "905723" }] })],
  });
  const resolutionSource = createTitularizacionWorkspaceSource({
    prepared: preparedFrom(resolutionParsed),
    sourceType: WORKSPACE_SOURCE_TYPES.RESOLUCION,
    fileName: "RESGE-2026-222-E-CAT-MET.pdf",
  });
  let workspace = addTitularizacionWorkspaceSource(createTitularizacionWorkspace(), sidcaSource);
  const previewBefore = getTitularizacionWorkspacePreviewRows(workspace);
  workspace = addTitularizacionWorkspaceSource(workspace, resolutionSource);
  const previewAfter = getTitularizacionWorkspacePreviewRows(workspace);

  expect(previewAfter).toEqual(previewBefore);
  expect(workspace.persons[0].registros).toHaveLength(2);
  expect(workspace.persons[0].registros.filter((record) => record.sourceType === WORKSPACE_SOURCE_TYPES.RESOLUCION)).toHaveLength(1);
});

test("las resoluciones son acumulativas: ausencia en 177 no deriva estado negativo", () => {
  const parsed177 = parseTitularizacionResolutionPdfPages({
    fileName: "RESGE-2026-177-E-CAT-MET.pdf",
    pages: [resolutionPage({ resolution: "RESGE-2026-177-E-CAT-MET", rows: [{ dni: "29837689", idPlaza: "905700" }] })],
  });
  const parsed222 = parseTitularizacionResolutionPdfPages({
    fileName: "RESGE-2026-222-E-CAT-MET.pdf",
    pages: [resolutionPage({ resolution: "RESGE-2026-222-E-CAT-MET", rows: [{ dni: "29837689", idPlaza: "905723" }] })],
  });
  const source177 = createTitularizacionWorkspaceSource({ prepared: preparedFrom(parsed177), sourceType: WORKSPACE_SOURCE_TYPES.RESOLUCION, fileName: "RESGE-2026-177-E-CAT-MET.pdf" });
  const source222 = createTitularizacionWorkspaceSource({ prepared: preparedFrom(parsed222), sourceType: WORKSPACE_SOURCE_TYPES.RESOLUCION, fileName: "RESGE-2026-222-E-CAT-MET.pdf" });
  let workspace = addTitularizacionWorkspaceSource(createTitularizacionWorkspace(), source177, {
    basePeople: [{ dni: "29837689", apellido: "PEREZ", nombre: "ANA" }],
  });
  workspace = addTitularizacionWorkspaceSource(workspace, source222, {
    basePeople: [{ dni: "29837689", apellido: "PEREZ", nombre: "ANA" }],
  });

  expect(workspace.persons).toHaveLength(1);
  expect(workspace.persons[0].registros).toHaveLength(2);
  expect(workspace.persons[0].registros.every((record) => record.afirma === "titularizada")).toBe(true);
  expect(workspace.persons[0].registros.some((record) => record.estado === "NO_TITULARIZADA")).toBe(false);
});

test("ID Plaza ausente en solicitud y presentación no altera la comparación SIDCA", () => {
  const result = matchSituationsOneToOne(
    [{ id: "s1", establecimiento: "Escuela 91", cargo: "Profesor", horas: "4", materia: "Matemática", nivel: "Secundario", cursoAnio: "3" }],
    [{ recordKey: "fila-1", valuesNormalized: { establecimiento: "Escuela 91", cargo: "Profesor", horas: "4", materia: "Matemática", nivel: "Secundario", cursoAnio: "3" } }]
  );
  expect(result.situationResults[0].matchStatus).toBe("confirmada");
});

test("un número administrativo de 8 dígitos sin contexto DNI queda sospechoso", () => {
  const parsed = parseTitularizacionResolutionPdfPages({
    fileName: "RESGE-2026-177-E-CAT-MET.pdf",
    pages: [{
      pageNumber: 1,
      hasText: true,
      text: "RESGE-2026-177-E-CAT-MET\n01888828 905723 Profesor",
    }],
  });
  const row = parsed.rows[0];

  expect(row.dni).toBe("");
  expect(row.dniCandidate).toBe("01888828");
  expect(row.dniConfidence).toBe("low");
  expect(row.dniDiagnostic).toMatchObject({
    status: "sospechoso",
    accepted: false,
    context: "numero_sin_contexto_dni",
  });
  expect(row.pdfRecordStatus).toBe("DNI SOSPECHOSO");
  expect(parsed.summary).toMatchObject({
    registrosDniConfiables: 0,
    registrosDniSospechosos: 1,
    dniUnicosConfiables: 0,
  });
});

test("un DNI PDF sospechoso no llega al cruce ministerial como DNI confirmado", () => {
  const parsed = parseTitularizacionResolutionPdfPages({
    fileName: "RESGE-2026-177-E-CAT-MET.pdf",
    pages: [{
      pageNumber: 1,
      hasText: true,
      text: "RESGE-2026-177-E-CAT-MET\n01888828 905723 Profesor",
    }],
  });
  const source = createTitularizacionWorkspaceSource({
    prepared: preparedFrom(parsed),
    sourceType: WORKSPACE_SOURCE_TYPES.RESOLUCION,
    fileName: "RESGE-2026-177-E-CAT-MET.pdf",
  });
  const workspace = addTitularizacionWorkspaceSource(createTitularizacionWorkspace(), source, {
    basePeople: [{ dni: "01888828", apellido: "PEREZ", nombre: "ANA", situaciones: [] }],
  });
  const preview = buildMinisterialCrossPreview({
    workspace,
    basePeople: [{ dni: "01888828", apellido: "PEREZ", nombre: "ANA", situaciones: [] }],
  });

  expect(preview.people[0].resolutions).toHaveLength(0);
  expect(preview.externalEvidence).toHaveLength(1);
});

test("la etiqueta DNI conserva ceros iniciales y entrega diagnóstico de origen", () => {
  const parsed = parseTitularizacionResolutionPdfPages({
    fileName: "RESGE-2026-177-E-CAT-MET.pdf",
    pages: [{
      pageNumber: 3,
      hasText: true,
      text: "RESGE-2026-177-E-CAT-MET\nDNI: 01888828 ID PLAZA: 905723",
    }],
  });
  const row = parsed.rows[0];

  expect(row.dni).toBe("01888828");
  expect(row.dniConfidence).toBe("medium");
  expect(row.dniDiagnostic).toMatchObject({ status: "confiable", context: "etiqueta_dni" });
  expect(row.rawText).toContain("01888828");
  expect(row.tokensOriginales).toEqual(["DNI:", "01888828", "ID", "PLAZA:", "905723"]);
  expect(row.provenance).toMatchObject({ pageNumber: 3, lineNumber: 2 });
});

test("las métricas de auditoría del PDF distinguen completos, parciales y campos", () => {
  const parsed = parseTitularizacionResolutionPdfPages({
    fileName: "RESGE-2026-222-E-CAT-MET.pdf",
    pages: [resolutionPage({ rows: [
      { dni: "29837689", idPlaza: "905723" },
      { dni: "29837690", idPlaza: "" },
    ] })],
  });

  expect(parsed.summary).toMatchObject({
    registrosResolucion: 2,
    registrosDniConfiables: 2,
    registrosConNombre: 2,
    registrosConCargo: 2,
    registrosConIdPlaza: 1,
    registrosCompletos: 1,
    registrosParciales: 1,
    dniUnicosConfiables: 2,
  });
});
