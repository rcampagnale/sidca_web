import {
  WORKSPACE_SOURCE_TYPES,
  addTitularizacionWorkspaceSource,
  createTitularizacionWorkspace,
  createTitularizacionWorkspaceSource,
  findTitularizacionWorkspaceDuplicate,
  getTitularizacionWorkspacePreviewRows,
  partitionExternalEvidenceByProcessUniverse,
  rebuildTitularizacionWorkspace,
  removeTitularizacionWorkspaceSource,
  searchTitularizacionWorkspacePeople,
  setTitularizacionWorkspaceSourceEnabled,
} from "./titularizacionWorkspaceService";

const preparedFor = (sheetName, rows) => ({
  file: { name: `${sheetName}.xlsx` },
  parserMode: "wide",
  structureValid: true,
  sheetNames: [sheetName],
  selectedSheetIndexes: [0],
  sheets: [{
    sheetName,
    sheetIndex: 0,
    rowCount: rows.length,
    filas: rows.map((row) => row.raw),
    status: "SCHEMA_VALID",
  }],
  rows: rows.map((row, index) => ({
    recordKey: `fila_${index + 2}`,
    numeroFila: index + 2,
    sourceSheetName: sheetName,
    sourceSheetIndex: 0,
    sourceRowNumber: index + 2,
    sourceBlockIndex: row.blockIndex || 1,
    dni: row.dni,
    apellido: row.apellido,
    nombre: row.nombre,
    valoresOriginales: row.raw,
    valoresNormalizados: {
      dni: row.dni,
      apellido: row.apellido,
      nombre: row.nombre,
      departamento: row.departamento || "Capital",
      cargo: row.cargo || "Profesor",
      horas: row.horas || "4",
    },
    situacion: {
      id: `situacion_${index + 1}`,
      establecimiento: row.establecimiento || "Escuela",
      cargo: row.cargo || "Profesor",
      horas: row.horas || "4",
    },
  })),
  summary: { filasDetectadas: rows.length, situacionesExtraidas: rows.length },
});

const sourceFor = (fileName, sourceType = WORKSPACE_SOURCE_TYPES.PRESENTACION_SIDCA, rows = [], fileHash = null) =>
  createTitularizacionWorkspaceSource({
    prepared: preparedFor(fileName.replace(/\.xlsx$/u, ""), rows),
    workspaceSourceId: fileName.replace(/\.xlsx$/u, "").toLowerCase(),
    fileName,
    sourceType,
    fileHash,
  });

const partialPreparedFor = (sheetName, rows, fileHash = null) => {
  const preparedRows = rows.map((row, index) => ({
    recordKey: `admin_${index + 2}`,
    numeroFila: index + 2,
    sourceSheetName: sheetName,
    sourceSheetIndex: 0,
    sourceRowNumber: index + 2,
    dni: row.dni,
    apellido: row.apellido,
    nombre: row.nombre,
    valoresOriginales: row.raw,
    valoresNormalizados: {
      dni: row.dni,
      apellido: row.apellido,
      nombre: row.nombre,
      departamento: row.departamento || "Capital",
    },
  }));
  return {
    file: { name: `${sheetName}.xlsx` },
    fileHash,
    parserMode: "wide",
    structureValid: true,
    sheetNames: [sheetName],
    selectedSheetIndexes: [0],
    sheets: [{
      sheetName,
      sheetIndex: 0,
      rowCount: rows.length,
      filas: rows.map((row) => row.raw),
      rows: preparedRows.slice(),
      status: "COMPATIBLE_PARCIAL",
    }],
    rows: preparedRows,
    summary: { filasDetectadas: rows.length, situacionesExtraidas: 0 },
  };
};

const partialSourceFor = (fileName, rows, sourceType = WORKSPACE_SOURCE_TYPES.MINISTERIO_OMITIDOS, fileHash = null) =>
  createTitularizacionWorkspaceSource({
    prepared: partialPreparedFor(fileName.replace(/\.xlsx$/u, ""), rows, fileHash),
    workspaceSourceId: fileName.replace(/\.xlsx$/u, "").toLowerCase(),
    fileName,
    sourceType,
    fileHash,
  });

const rowFor = (dni, overrides = {}) => ({
  dni,
  apellido: "Ramos",
  nombre: "Sofía Inés",
  raw: { DNI: dni, ...overrides },
  ...overrides,
});

test("1. workspace vacío tiene cero fuentes", () => {
  const workspace = createTitularizacionWorkspace();
  expect(workspace.sources).toHaveLength(0);
  expect(workspace.metrics.fuentesCargadas).toBe(0);
});

test("2. agregar archivo A crea una fuente activa", () => {
  const source = sourceFor("A.xlsx", undefined, [rowFor("30111222")]);
  const workspace = addTitularizacionWorkspaceSource(createTitularizacionWorkspace(), source);
  expect(workspace.sources).toHaveLength(1);
  expect(workspace.activeSourceIds).toEqual(["a"]);
});

test("3. agregar archivo B conserva A", () => {
  const first = sourceFor("A.xlsx", undefined, [rowFor("30111222")]);
  const second = sourceFor("B.xlsx", undefined, [rowFor("30111223")]);
  let workspace = addTitularizacionWorkspaceSource(createTitularizacionWorkspace(), first);
  workspace = addTitularizacionWorkspaceSource(workspace, second);
  expect(workspace.sources.map((source) => source.fileName)).toEqual(["A.xlsx", "B.xlsx"]);
});

test("4. el mismo DNI en A y B queda como una sola persona", () => {
  const first = sourceFor("A.xlsx", undefined, [rowFor("30111222")]);
  const second = sourceFor("B.xlsx", undefined, [rowFor("30111222")]);
  let workspace = addTitularizacionWorkspaceSource(createTitularizacionWorkspace(), first);
  workspace = addTitularizacionWorkspaceSource(workspace, second);
  expect(workspace.persons).toHaveLength(1);
  expect(workspace.persons[0].dni).toBe("30111222");
});

test("5. conserva los registros de A y B", () => {
  const first = sourceFor("A.xlsx", undefined, [rowFor("30111222")]);
  const second = sourceFor("B.xlsx", undefined, [rowFor("30111222", { horas: "6" })]);
  let workspace = addTitularizacionWorkspaceSource(createTitularizacionWorkspace(), first);
  workspace = addTitularizacionWorkspaceSource(workspace, second);
  expect(workspace.persons[0].registros).toHaveLength(2);
  expect(new Set(workspace.persons[0].registros.map((record) => record.fileName))).toEqual(
    new Set(["A.xlsx", "B.xlsx"])
  );
});

test("6. desactivar A la conserva pero la excluye del consolidado activo", () => {
  const first = sourceFor("A.xlsx", undefined, [rowFor("30111222")]);
  const second = sourceFor("B.xlsx", undefined, [rowFor("30111223")]);
  let workspace = addTitularizacionWorkspaceSource(createTitularizacionWorkspace(), first);
  workspace = addTitularizacionWorkspaceSource(workspace, second);
  workspace = setTitularizacionWorkspaceSourceEnabled(workspace, "a", false);
  expect(workspace.sources).toHaveLength(2);
  expect(workspace.activeSourceIds).toEqual(["b"]);
  expect(workspace.persons.map((person) => person.dni)).toEqual(["30111223"]);
});

test("7. reactivar A vuelve a incorporarla", () => {
  const source = sourceFor("A.xlsx", undefined, [rowFor("30111222")]);
  let workspace = addTitularizacionWorkspaceSource(createTitularizacionWorkspace(), source);
  workspace = setTitularizacionWorkspaceSourceEnabled(workspace, "a", false);
  workspace = setTitularizacionWorkspaceSourceEnabled(workspace, "a", true);
  expect(workspace.activeSourceIds).toEqual(["a"]);
  expect(workspace.persons[0].registros[0].fileName).toBe("A.xlsx");
});

test("8. quitar B elimina sólo B", () => {
  const first = sourceFor("A.xlsx", undefined, [rowFor("30111222")]);
  const second = sourceFor("B.xlsx", undefined, [rowFor("30111223")]);
  let workspace = addTitularizacionWorkspaceSource(createTitularizacionWorkspace(), first);
  workspace = addTitularizacionWorkspaceSource(workspace, second);
  workspace = removeTitularizacionWorkspaceSource(workspace, "b");
  expect(workspace.sources.map((source) => source.workspaceSourceId)).toEqual(["a"]);
  expect(workspace.persons.map((person) => person.dni)).toEqual(["30111222"]);
});

test("9. las hojas y filas conservan provenance", () => {
  const prepared = preparedFor("SECUNDARIO", [rowFor("30111222")]);
  const secondPrepared = preparedFor("PRIMARIO", [rowFor("30111223")]);
  prepared.sheets.push(secondPrepared.sheets[0]);
  prepared.sheetNames.push("PRIMARIO");
  prepared.selectedSheetIndexes = [0, 1];
  prepared.rows.push(...secondPrepared.rows.map((row) => ({ ...row, sourceSheetIndex: 1 })));
  const source = createTitularizacionWorkspaceSource({
    prepared,
    workspaceSourceId: "fuente-multihoja",
    fileName: "multi.xlsx",
  });
  expect(source.rawRecords[0]).toMatchObject({
    workspaceSourceId: "fuente-multihoja",
    fileName: "multi.xlsx",
    sheetName: "SECUNDARIO",
    sheetIndex: 0,
    rowNumber: 2,
  });
  expect(source.interpretedSituations[0].provenance).toMatchObject({
    workspaceSourceId: "fuente-multihoja",
    sourceType: WORKSPACE_SOURCE_TYPES.PRESENTACION_SIDCA,
    fileName: "multi.xlsx",
    sheetName: "SECUNDARIO",
    rowNumber: 2,
    blockIndex: 1,
  });
  expect(source.rawRecords).toHaveLength(2);
  expect(new Set(source.rawRecords.map((record) => record.sheetName))).toEqual(
    new Set(["SECUNDARIO", "PRIMARIO"])
  );
});

test("10. fuentes de tipos distintos no se mezclan semánticamente", () => {
  const sidca = sourceFor("sidca.xlsx", WORKSPACE_SOURCE_TYPES.PRESENTACION_SIDCA, [rowFor("30111222")]);
  const aptos = sourceFor("aptos.xlsx", WORKSPACE_SOURCE_TYPES.MINISTERIO_APTOS, [rowFor("30111222")]);
  let workspace = addTitularizacionWorkspaceSource(createTitularizacionWorkspace(), sidca);
  workspace = addTitularizacionWorkspaceSource(workspace, aptos);
  expect(workspace.persons[0].fuentesWorkspace.map((source) => source.sourceType)).toEqual([
    WORKSPACE_SOURCE_TYPES.PRESENTACION_SIDCA,
    WORKSPACE_SOURCE_TYPES.MINISTERIO_APTOS,
  ]);
  expect(getTitularizacionWorkspacePreviewRows(workspace)).toHaveLength(1);
});

test("11. dos PRESENTACION_SIDCA entran al preview", () => {
  const first = sourceFor("A.xlsx", WORKSPACE_SOURCE_TYPES.PRESENTACION_SIDCA, [rowFor("30111222")]);
  const second = sourceFor("B.xlsx", WORKSPACE_SOURCE_TYPES.PRESENTACION_SIDCA, [rowFor("30111222")]);
  let workspace = addTitularizacionWorkspaceSource(createTitularizacionWorkspace(), first);
  workspace = addTitularizacionWorkspaceSource(workspace, second);
  expect(getTitularizacionWorkspacePreviewRows(workspace)).toHaveLength(2);
});

test("12. Ministerio Aptos no entra en el preview SIDCA", () => {
  const sidca = sourceFor("A.xlsx", WORKSPACE_SOURCE_TYPES.PRESENTACION_SIDCA, [rowFor("30111222")]);
  const aptos = sourceFor("B.xlsx", WORKSPACE_SOURCE_TYPES.MINISTERIO_APTOS, [rowFor("30111222")]);
  let workspace = addTitularizacionWorkspaceSource(createTitularizacionWorkspace(), sidca);
  workspace = addTitularizacionWorkspaceSource(workspace, aptos);
  expect(getTitularizacionWorkspacePreviewRows(workspace)).toHaveLength(1);
  expect(getTitularizacionWorkspacePreviewRows(workspace)[0].sourceType).toBe(
    WORKSPACE_SOURCE_TYPES.PRESENTACION_SIDCA
  );
});

test("13. agregar fuentes no ejecuta ningún cruce", () => {
  const source = sourceFor("A.xlsx", undefined, [rowFor("30111222")]);
  const workspace = addTitularizacionWorkspaceSource(createTitularizacionWorkspace(), source);
  expect(workspace.preview).toBeUndefined();
  expect(workspace.metrics.situacionesInterpretadas).toBe(1);
});

test("14. búsqueda consolidada por DNI encuentra todos sus registros", () => {
  const source = sourceFor("A.xlsx", undefined, [rowFor("30111222")]);
  let workspace = addTitularizacionWorkspaceSource(createTitularizacionWorkspace(), source);
  workspace = rebuildTitularizacionWorkspace(workspace);
  const results = searchTitularizacionWorkspacePeople(workspace, "30111222");
  expect(results).toHaveLength(1);
  expect(results[0].registros).toHaveLength(1);
});

test("15. NO_AFILIADO del universo se conserva aunque aparezca en varios Excel", () => {
  const first = sourceFor("A.xlsx", undefined, [rowFor("30111222")]);
  const second = sourceFor("B.xlsx", undefined, [rowFor("30111222")]);
  let workspace = addTitularizacionWorkspaceSource(createTitularizacionWorkspace(), first, {
    basePeople: [{ dni: "30111222", apellido: "Ramos", nombre: "Sofía", afiliadoSidca: false, estadoAfiliacion: "NO_AFILIADO" }],
  });
  workspace = addTitularizacionWorkspaceSource(workspace, second, {
    basePeople: [{ dni: "30111222", apellido: "Ramos", nombre: "Sofía", afiliadoSidca: false, estadoAfiliacion: "NO_AFILIADO" }],
  });
  expect(workspace.persons[0].afiliadoSidca).toBe(false);
  expect(workspace.persons[0].estadoAfiliacion).toBe("NO_AFILIADO");
});

test("16. el padrón/base no agrega una persona ajena al universo", () => {
  const source = sourceFor("externa.xlsx", undefined, [rowFor("99999999")]);
  const workspace = addTitularizacionWorkspaceSource(createTitularizacionWorkspace(), source, {
    basePeople: [{ dni: "30111222", apellido: "Ramos", nombre: "Sofía" }],
  });
  expect(workspace.persons.map((person) => person.dni)).toEqual(["30111222"]);
  expect(workspace.externalPersons.map((person) => person.dni)).toEqual(["99999999"]);
});

test("17. persona externa queda separada para revisión", () => {
  const source = sourceFor("externa.xlsx", undefined, [rowFor("99999999")]);
  const workspace = addTitularizacionWorkspaceSource(createTitularizacionWorkspace(), source, {
    basePeople: [{ dni: "30111222", apellido: "Ramos", nombre: "Sofía" }],
  });
  expect(workspace.externalPersons[0]).toMatchObject({
    dni: "99999999",
    esExterna: true,
    estado: "PRESENTADA_SIN_ANTECEDENTE",
  });
});

test("18. rawRecords permanece después de consolidar", () => {
  const source = sourceFor("A.xlsx", undefined, [rowFor("30111222", { Original: "conservar" })]);
  let workspace = addTitularizacionWorkspaceSource(createTitularizacionWorkspace(), source);
  workspace = setTitularizacionWorkspaceSourceEnabled(workspace, "a", false);
  workspace = setTitularizacionWorkspaceSourceEnabled(workspace, "a", true);
  expect(workspace.sources[0].rawRecords[0].rawRecord.Original).toBe("conservar");
});

test("19. el tipo real explícito prevalece aunque el nombre del archivo sea de rezagados", () => {
  const source = sourceFor(
    "LISTA DEFINITIVA DE REZAGADOS.xlsx",
    WORKSPACE_SOURCE_TYPES.PRESENTACION_SIDCA_COMPLEMENTARIA,
    [rowFor("30111222")]
  );
  expect(source.sourceType).toBe(WORKSPACE_SOURCE_TYPES.PRESENTACION_SIDCA_COMPLEMENTARIA);
  expect(source.interpretedSituations[0].sourceType).toBe(WORKSPACE_SOURCE_TYPES.PRESENTACION_SIDCA_COMPLEMENTARIA);
});

test("20. una devolución del Ministerio conserva su tipo explícito con el mismo filename", () => {
  const source = sourceFor(
    "LISTA DEFINITIVA DE REZAGADOS.xlsx",
    WORKSPACE_SOURCE_TYPES.MINISTERIO_REZAGADOS,
    [rowFor("30111222")]
  );
  expect(source.sourceType).toBe(WORKSPACE_SOURCE_TYPES.MINISTERIO_REZAGADOS);
  expect(source.rawRecords[0].sourceType).toBe(WORKSPACE_SOURCE_TYPES.MINISTERIO_REZAGADOS);
});

test("21. una fuente cargada con cero hojas conserva datos detectados pero no datos activos", () => {
  const prepared = preparedFor("APTOS", [rowFor("30111222")]);
  const second = preparedFor("APTOS_2", [rowFor("30111223")]);
  prepared.sheets.push({ ...second.sheets[0], sheetIndex: 1, sheetName: "APTOS_2" });
  prepared.sheetNames.push("APTOS_2");
  prepared.rows.push({ ...second.rows[0], sourceSheetIndex: 1, sourceSheetName: "APTOS_2", recordKey: "fila_3" });
  prepared.selectedSheetIndexes = [];
  const source = createTitularizacionWorkspaceSource({
    prepared,
    sourceType: WORKSPACE_SOURCE_TYPES.MINISTERIO_APTOS,
    fileName: "aptos.xlsx",
  });
  const workspace = addTitularizacionWorkspaceSource(createTitularizacionWorkspace(), source);
  expect(source.rawRecords).toHaveLength(2);
  expect(source.persons).toHaveLength(2);
  expect(source.metrics).toMatchObject({
    personasDetectadas: 2,
    personasActivas: 0,
    registrosOriginales: 2,
    registrosActivos: 0,
    situacionesInterpretadas: 2,
    situacionesActivas: 0,
  });
  expect(workspace.metrics.registrosTotales).toBe(0);
  expect(workspace.metrics.situacionesInterpretadas).toBe(0);
  expect(workspace.persons).toHaveLength(0);
});

test("22. activar una hoja participa sólo con sus registros y situaciones", () => {
  const prepared = preparedFor("APTOS", [rowFor("30111222")]);
  const second = preparedFor("APTOS_2", [rowFor("30111223")]);
  prepared.sheets.push({ ...second.sheets[0], sheetIndex: 1, sheetName: "APTOS_2" });
  prepared.sheetNames.push("APTOS_2");
  prepared.rows.push({ ...second.rows[0], sourceSheetIndex: 1, sourceSheetName: "APTOS_2", recordKey: "fila_3" });
  prepared.selectedSheetIndexes = [1];
  const source = createTitularizacionWorkspaceSource({
    prepared,
    sourceType: WORKSPACE_SOURCE_TYPES.MINISTERIO_APTOS,
    fileName: "aptos.xlsx",
  });
  const workspace = addTitularizacionWorkspaceSource(createTitularizacionWorkspace(), source);
  expect(workspace.metrics.hojasActivas).toBe(1);
  expect(workspace.metrics.registrosTotales).toBe(1);
  expect(workspace.metrics.situacionesInterpretadas).toBe(1);
  expect(workspace.persons).toHaveLength(0);
  expect(workspace.externalPersons).toHaveLength(0);
});

test("23. hojas activas suma las hojas seleccionadas de fuentes habilitadas", () => {
  const first = sourceFor("A.xlsx", WORKSPACE_SOURCE_TYPES.PRESENTACION_SIDCA, [rowFor("30111222")]);
  const secondPrepared = preparedFor("B", [rowFor("30111223")]);
  const thirdPrepared = preparedFor("C", [rowFor("30111224")]);
  secondPrepared.sheets.push({ ...thirdPrepared.sheets[0], sheetIndex: 1, sheetName: "C" });
  secondPrepared.sheetNames.push("C");
  secondPrepared.rows.push({ ...thirdPrepared.rows[0], sourceSheetIndex: 1, sourceSheetName: "C", recordKey: "fila_3" });
  secondPrepared.selectedSheetIndexes = [0, 1];
  const second = createTitularizacionWorkspaceSource({
    prepared: secondPrepared,
    workspaceSourceId: "b",
    sourceType: WORKSPACE_SOURCE_TYPES.MINISTERIO_APTOS,
    fileName: "B.xlsx",
  });
  let workspace = addTitularizacionWorkspaceSource(createTitularizacionWorkspace(), first);
  workspace = addTitularizacionWorkspaceSource(workspace, second);
  expect(workspace.metrics.hojasActivas).toBe(3);
});

test("24. desactivar y reactivar una fuente respeta sus hojas seleccionadas", () => {
  const source = sourceFor("A.xlsx", WORKSPACE_SOURCE_TYPES.MINISTERIO_APTOS, [rowFor("30111222")]);
  let workspace = addTitularizacionWorkspaceSource(createTitularizacionWorkspace(), source);
  workspace = setTitularizacionWorkspaceSourceEnabled(workspace, "a", false);
  expect(workspace.metrics.hojasActivas).toBe(0);
  expect(workspace.metrics.registrosTotales).toBe(0);
  expect(workspace.sources[0].metrics.registrosOriginales).toBe(1);
  workspace = setTitularizacionWorkspaceSourceEnabled(workspace, "a", true);
  expect(workspace.metrics.hojasActivas).toBe(1);
  expect(workspace.metrics.registrosTotales).toBe(1);
});

test("25. Aptos y No Aptos exponen etapa y afirmación administrativas", () => {
  const aptos = sourceFor("aptos.xlsx", WORKSPACE_SOURCE_TYPES.MINISTERIO_APTOS, [rowFor("30111222")]);
  const noAptos = sourceFor("no-aptos.xlsx", WORKSPACE_SOURCE_TYPES.MINISTERIO_NO_APTOS, [rowFor("30111223")]);
  expect(aptos).toMatchObject({ stage: "ministerio", afirma: "apta" });
  expect(noAptos).toMatchObject({ stage: "ministerio", afirma: "no_apta" });
  expect(aptos.interpretedSituations[0]).toMatchObject({ stage: "ministerio", afirma: "apta" });
});

test("26. OMITIDOS es un tipo explícito y no se convierte en REZAGADOS", () => {
  const omitted = sourceFor(
    "1 - OMITIDOS - TITULARIZACIÓN DEFINITIVO.xlsx",
    WORKSPACE_SOURCE_TYPES.MINISTERIO_OMITIDOS,
    [rowFor("30111222")]
  );
  expect(omitted.sourceType).toBe(WORKSPACE_SOURCE_TYPES.MINISTERIO_OMITIDOS);
  expect(omitted.sourceType).not.toBe(WORKSPACE_SOURCE_TYPES.MINISTERIO_REZAGADOS);
  expect(omitted.afirma).toBe("omitida");
});

test("27. una persona externa permanece separada al aparecer en varias fuentes externas", () => {
  const first = sourceFor("ministerio-a.xlsx", WORKSPACE_SOURCE_TYPES.MINISTERIO_APTOS, [rowFor("99999999")]);
  const second = sourceFor("ministerio-b.xlsx", WORKSPACE_SOURCE_TYPES.MINISTERIO_NO_APTOS, [rowFor("99999999")]);
  const basePeople = [{ dni: "30111222", apellido: "Ramos", nombre: "Sofía" }];
  let workspace = addTitularizacionWorkspaceSource(createTitularizacionWorkspace(), first, { basePeople });
  workspace = addTitularizacionWorkspaceSource(workspace, second, { basePeople });
  expect(workspace.externalPersons).toHaveLength(0);
  expect(workspace.persons.map((person) => person.dni)).toEqual(["30111222"]);
  expect(workspace.sources[0].metrics.personasExternasFuente).toBe(1);
  expect(workspace.sources[1].metrics.personasExternasFuente).toBe(1);
});

test("28. una fuente parcial conserva 100 raw/admin y aporta cero situaciones", () => {
  const rows = Array.from({ length: 100 }, (_, index) => rowFor(String(30000000 + index)));
  const source = partialSourceFor("reclamo.xlsx", rows);
  const workspace = addTitularizacionWorkspaceSource(createTitularizacionWorkspace(), source, {
    basePeople: [{ dni: "30111222", apellido: "Ramos", nombre: "Sofía Inés" }],
  });

  expect(source.rawRecords).toHaveLength(100);
  expect(source.administrativeRecords).toHaveLength(100);
  expect(source.interpretedSituations).toHaveLength(0);
  expect(source.metrics).toMatchObject({
    registrosOriginales: 100,
    registrosAdministrativos: 100,
    situacionesEstructuradas: 0,
  });
  expect(workspace.metrics.registrosTotales).toBe(100);
  expect(workspace.metrics.registrosAdministrativosTotales).toBe(100);
  expect(workspace.metrics.situacionesEstructuradas).toBe(0);
  expect(getTitularizacionWorkspacePreviewRows(workspace)).toHaveLength(0);
});

test("29. sólo las situaciones explícitas llegan al preview SIDCA", () => {
  const structured = sourceFor(
    "presentacion.xlsx",
    WORKSPACE_SOURCE_TYPES.PRESENTACION_SIDCA,
    Array.from({ length: 20 }, (_, index) => rowFor(String(30100000 + index)))
  );
  const partial = partialSourceFor(
    "omitidos.xlsx",
    Array.from({ length: 100 }, (_, index) => rowFor(String(30200000 + index)))
  );
  let workspace = addTitularizacionWorkspaceSource(createTitularizacionWorkspace(), structured);
  workspace = addTitularizacionWorkspaceSource(workspace, partial);

  expect(getTitularizacionWorkspacePreviewRows(workspace)).toHaveLength(20);
  expect(workspace.metrics.situacionesEstructuradas).toBe(20);
  expect(workspace.metrics.registrosAdministrativosTotales).toBe(100);
});

test("30. el mismo DNI en dos hojas parciales es una persona y dos rawRecords", () => {
  const prepared = partialPreparedFor("omitidos", [rowFor("30111222")]);
  const secondPrepared = partialPreparedFor("docentes", [rowFor("30111222")]);
  prepared.sheets.push({
    ...secondPrepared.sheets[0],
    sheetIndex: 1,
    sheetName: "docentes",
    rows: secondPrepared.sheets[0].rows.map((row) => ({
      ...row,
      sourceSheetIndex: 1,
      sourceSheetName: "docentes",
    })),
  });
  prepared.rows.push(...secondPrepared.rows.map((row) => ({
    ...row,
    sourceSheetIndex: 1,
    sourceSheetName: "docentes",
  })));
  prepared.sheetNames.push("docentes");
  prepared.selectedSheetIndexes = [0, 1];
  const source = createTitularizacionWorkspaceSource({
    prepared: {
      ...prepared,
      file: { name: "omitidos.xlsx" },
    },
    workspaceSourceId: "omitidos",
    fileName: "omitidos.xlsx",
    sourceType: WORKSPACE_SOURCE_TYPES.MINISTERIO_OMITIDOS,
  });
  expect(source.administrativeRecords).toHaveLength(2);
  const workspace = addTitularizacionWorkspaceSource(createTitularizacionWorkspace(), source, {
    basePeople: [{ dni: "30111222", apellido: "Ramos", nombre: "Sofía Inés" }],
  });

  expect(workspace.persons.filter((person) => person.dni === "30111222")).toHaveLength(1);
  expect(workspace.persons[0].registros).toHaveLength(2);
  expect(workspace.persons[0].situacionesEstructuradasCount).toBe(0);
  expect(workspace.sources[0].administrativeRecords).toHaveLength(2);
});

test("31. agregar un archivo con el mismo fileHash no duplica la fuente ni sus métricas", () => {
  const first = partialSourceFor("omitidos.xlsx", [rowFor("30111222")], WORKSPACE_SOURCE_TYPES.MINISTERIO_OMITIDOS, "hash-omitidos");
  const second = partialSourceFor("otro-nombre.xlsx", [rowFor("30111223")], WORKSPACE_SOURCE_TYPES.MINISTERIO_OMITIDOS, "hash-omitidos");
  let workspace = addTitularizacionWorkspaceSource(createTitularizacionWorkspace(), first);
  workspace = addTitularizacionWorkspaceSource(workspace, second);

  expect(findTitularizacionWorkspaceDuplicate(workspace, second).workspaceSourceId).toBe(first.workspaceSourceId);
  expect(workspace.sources).toHaveLength(1);
  expect(workspace.metrics.registrosTotales).toBe(1);
});

test("32. el mismo filename sin fileHash no bloquea otra fuente", () => {
  const first = partialSourceFor("omitidos.xlsx", [rowFor("30111222")]);
  const second = partialSourceFor("omitidos.xlsx", [rowFor("30111223")]);
  let workspace = addTitularizacionWorkspaceSource(createTitularizacionWorkspace(), first);
  workspace = addTitularizacionWorkspaceSource(workspace, second);

  expect(workspace.sources).toHaveLength(2);
});

test("33. Reclamo parcial conserva 296 registros y cero situaciones estructuradas", () => {
  const source = partialSourceFor(
    "reclamo.xlsx",
    Array.from({ length: 296 }, (_, index) => rowFor(String(30300000 + index))),
    WORKSPACE_SOURCE_TYPES.OTRA
  );
  const workspace = addTitularizacionWorkspaceSource(createTitularizacionWorkspace(), source);

  expect(workspace.sources[0].rawRecords).toHaveLength(296);
  expect(workspace.sources[0].administrativeRecords).toHaveLength(296);
  expect(workspace.sources[0].interpretedSituations).toHaveLength(0);
  expect(getTitularizacionWorkspacePreviewRows(workspace)).toHaveLength(0);
});

test("34. rawRecord y provenance administrativos permanecen intactos", () => {
  const rawRecord = { DNI: "30111222", Estado: "omitido", Hoja: "Todos los omitidos" };
  const source = partialSourceFor("omitidos.xlsx", [{ ...rowFor("30111222"), raw: rawRecord }]);
  const workspace = addTitularizacionWorkspaceSource(createTitularizacionWorkspace(), source, {
    basePeople: [{ dni: "30111222", apellido: "Ramos", nombre: "Sofía Inés" }],
  });
  const record = workspace.persons[0].registros[0];

  expect(record.rawRecord).toEqual(rawRecord);
  expect(record.provenance).toMatchObject({
    fileName: "omitidos.xlsx",
    sheetName: "omitidos",
    rowNumber: 2,
  });
  expect(record.situacion).toBeUndefined();
});

test("35. agregar una fuente parcial no altera una situación estructurada existente", () => {
  const structured = sourceFor(
    "presentacion.xlsx",
    WORKSPACE_SOURCE_TYPES.PRESENTACION_SIDCA,
    [rowFor("30111222", { similarityScore: 0.95, fieldCoverage: 0.8 })]
  );
  const before = structured.interpretedSituations[0].situacion;
  let workspace = addTitularizacionWorkspaceSource(createTitularizacionWorkspace(), structured);
  workspace = addTitularizacionWorkspaceSource(
    workspace,
    partialSourceFor("omitidos.xlsx", [rowFor("30111222")])
  );

  expect(workspace.sources[0].interpretedSituations[0].situacion).toEqual(before);
  expect(getTitularizacionWorkspacePreviewRows(workspace)).toHaveLength(1);
});

test("36. la partición pura separa evidencia vinculada y externa por DNI exacto", () => {
  const records = [
    { dni: "30111222", idPlaza: "A" },
    { dni: "30111223", idPlaza: "B" },
    { dni: "30111224", idPlaza: "C" },
    { dni: "30111225", idPlaza: "D" },
  ];
  const result = partitionExternalEvidenceByProcessUniverse({
    records,
    processPersonByDni: [{ dni: "30111222" }, { dni: "30111223" }],
  });

  expect(result.linkedRecords).toHaveLength(2);
  expect(result.externalRecords).toHaveLength(2);
  expect(result.linkedPersonDnis).toEqual(["30111222", "30111223"]);
  expect(result.externalPersonDnis).toEqual(["30111224", "30111225"]);
});

test("37. una resolución no crea personas del proceso ni externalPersons generales", () => {
  const source = sourceFor(
    "RESGE-2026-177-E-CAT-MET.pdf",
    WORKSPACE_SOURCE_TYPES.RESOLUCION,
    [rowFor("30111222"), rowFor("99999999")]
  );
  const workspace = addTitularizacionWorkspaceSource(createTitularizacionWorkspace(), source, {
    basePeople: [{ dni: "30111222", apellido: "Ramos", nombre: "Sofía" }],
  });

  expect(workspace.metrics.personasProceso).toBe(1);
  expect(workspace.persons.map((person) => person.dni)).toEqual(["30111222"]);
  expect(workspace.externalPersons).toHaveLength(0);
  expect(workspace.sources[0].rawRecords).toHaveLength(2);
  expect(workspace.sources[0].metrics).toMatchObject({
    personasSidcaEncontradas: 1,
    registrosSidca: 1,
    personasExternasFuente: 1,
    registrosExternos: 1,
  });
});

test("38. dos resoluciones acumulativas conservan dos evidencias para una persona", () => {
  const basePeople = [
    { dni: "30111222", apellido: "Ramos", nombre: "Sofía" },
    { dni: "30111223", apellido: "Pérez", nombre: "Ana" },
  ];
  const first = sourceFor(
    "RESGE-2026-177-E-CAT-MET.pdf",
    WORKSPACE_SOURCE_TYPES.RESOLUCION,
    [rowFor("30111222"), rowFor("99999999")]
  );
  const second = sourceFor(
    "RESGE-2026-222-E-CAT-MET.pdf",
    WORKSPACE_SOURCE_TYPES.RESOLUCION,
    [rowFor("30111222"), rowFor("30111223"), rowFor("99999999")]
  );
  let workspace = addTitularizacionWorkspaceSource(createTitularizacionWorkspace(), first, { basePeople });
  workspace = addTitularizacionWorkspaceSource(workspace, second, { basePeople });

  expect(workspace.metrics.personasProceso).toBe(2);
  expect(workspace.metrics.personasProcesoConEvidenciaResolucion).toBe(2);
  expect(workspace.metrics.personasConEvidenciaResolucion177).toBe(1);
  expect(workspace.metrics.personasConEvidenciaResolucion222).toBe(2);
  expect(workspace.metrics.personasConEvidenciaEnAmbasResoluciones).toBe(1);
  expect(workspace.metrics.personasExternasDetectadasResoluciones).toBe(1);
  expect(workspace.externalPersons).toHaveLength(0);
  expect(workspace.persons.find((person) => person.dni === "30111222").registros).toHaveLength(2);
});

test("39. una fuente ministerial sólo vincula DNI del universo y conserva externos", () => {
  const source = sourceFor(
    "APTOS.xlsx",
    WORKSPACE_SOURCE_TYPES.MINISTERIO_APTOS,
    [rowFor("30111222"), rowFor("99999999")]
  );
  const workspace = addTitularizacionWorkspaceSource(createTitularizacionWorkspace(), source, {
    basePeople: [{ dni: "30111222", apellido: "Ramos", nombre: "Sofía" }],
  });

  expect(workspace.persons.map((person) => person.dni)).toEqual(["30111222"]);
  expect(workspace.externalPersons).toHaveLength(0);
  expect(workspace.sources[0].metrics.registrosSidca).toBe(1);
  expect(workspace.sources[0].metrics.registrosExternos).toBe(1);
});

test("41. agregar resolución no altera el preview ni sus scores SIDCA", () => {
  const sidca = sourceFor(
    "presentacion.xlsx",
    WORKSPACE_SOURCE_TYPES.PRESENTACION_SIDCA,
    [rowFor("30111222")]
  );
  sidca.interpretedSituations[0].situacion.similarityScore = 0.91;
  sidca.interpretedSituations[0].situacion.fieldCoverage = 0.8;
  const resolution = sourceFor(
    "RESGE-2026-177-E-CAT-MET.pdf",
    WORKSPACE_SOURCE_TYPES.RESOLUCION,
    [rowFor("30111222")]
  );
  const basePeople = [{ dni: "30111222", apellido: "Ramos", nombre: "Sofía" }];
  let workspace = addTitularizacionWorkspaceSource(createTitularizacionWorkspace(), sidca, { basePeople });
  const before = getTitularizacionWorkspacePreviewRows(workspace).map((row) => ({
    recordKey: row.recordKey,
    similarityScore: row.situacion.similarityScore,
    fieldCoverage: row.situacion.fieldCoverage,
  }));
  workspace = addTitularizacionWorkspaceSource(workspace, resolution, { basePeople });
  const after = getTitularizacionWorkspacePreviewRows(workspace).map((row) => ({
    recordKey: row.recordKey,
    similarityScore: row.situacion.similarityScore,
    fieldCoverage: row.situacion.fieldCoverage,
  }));

  expect(after).toEqual(before);
});

test("40. el orden de las resoluciones no cambia la partición ni las métricas", () => {
  const basePeople = [{ dni: "30111222" }, { dni: "30111223" }];
  const first = sourceFor("RESGE-2026-177-E-CAT-MET.pdf", WORKSPACE_SOURCE_TYPES.RESOLUCION, [rowFor("30111222"), rowFor("99999999")]);
  const second = sourceFor("RESGE-2026-222-E-CAT-MET.pdf", WORKSPACE_SOURCE_TYPES.RESOLUCION, [rowFor("30111222"), rowFor("30111223")]);
  let forward = addTitularizacionWorkspaceSource(createTitularizacionWorkspace(), first, { basePeople });
  forward = addTitularizacionWorkspaceSource(forward, second, { basePeople });
  let reverse = addTitularizacionWorkspaceSource(createTitularizacionWorkspace(), second, { basePeople });
  reverse = addTitularizacionWorkspaceSource(reverse, first, { basePeople });

  expect(reverse.metrics.personasProceso).toBe(forward.metrics.personasProceso);
  expect(reverse.metrics.personasProcesoConEvidenciaResolucion).toBe(forward.metrics.personasProcesoConEvidenciaResolucion);
  expect(reverse.metrics.personasExternasDetectadasResoluciones).toBe(forward.metrics.personasExternasDetectadasResoluciones);
  expect([...reverse.persons].map((person) => person.dni).sort()).toEqual(
    [...forward.persons].map((person) => person.dni).sort()
  );
});
