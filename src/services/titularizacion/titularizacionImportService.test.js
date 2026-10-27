import * as XLSX from "xlsx";

import {
  analyzeSidcaSheet,
  prepareSidcaPresentation,
  selectPreparedSidcaSheets,
} from "./titularizacionImportService";

const baseHeaders = [
  "Apellido",
  "Nombre",
  "DNI",
  "Departamento",
  "Nombre de la escuela",
  "Nivel Educativo",
  "Nombre del cargo a titularizar",
  "Hora y/o Cargo a titularizar",
  "Desea agregar otro cargo u horas",
];

const rowFor = (dni, overrides = {}) => {
  const row = ["Apellido", "Nombre", dni, "Capital", "Escuela", "SECUNDARIO", "Profesor", "4 hs", ""];
  Object.entries(overrides).forEach(([index, value]) => { row[Number(index)] = value; });
  return row;
};

const makeFile = (sheets) => {
  const workbook = XLSX.utils.book_new();
  sheets.forEach(({ name, rows }) => {
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet(rows), name);
  });
  const buffer = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });
  return { name: "presentacion.xlsx", arrayBuffer: async () => buffer };
};

const sheet = (name, rows = [rowFor("29837689")]) => ({ name, rows: [baseHeaders, ...rows] });

test("22. workbook de una hoja conserva el flujo wide y metadata de origen", async () => {
  const prepared = await prepareSidcaPresentation(makeFile([sheet("PRIMARIO")]));

  expect(prepared.sheets).toHaveLength(1);
  expect(prepared.selectedSheetIndexes).toEqual([0]);
  expect(prepared.structureValid).toBe(true);
  expect(prepared.rows[0]).toMatchObject({ sourceSheetName: "PRIMARIO", sourceSheetIndex: 0, sourceRowNumber: 2 });
  expect(prepared.rows[0].situacion.fieldSources.nivel.normalizedHeader).toBe("nivelEducativo");
});

test("23. dos hojas con el mismo schema consolidan personas sin duplicarlas", async () => {
  const prepared = await prepareSidcaPresentation(makeFile([
    sheet("PRIMARIO", [rowFor("29837689")]),
    sheet("SECUNDARIO", [rowFor("29837689", { 4: "Otra escuela" })]),
  ]));

  expect(prepared.sheets.every((item) => item.status === "COMPATIBLE_ESTRUCTURADA")).toBe(true);
  expect(prepared.summary.personas).toBe(1);
  expect(prepared.summary.situacionesExtraidas).toBe(2);
  expect(prepared.wideParsed.personas[0].situaciones).toHaveLength(2);
  expect(new Set(prepared.rows.map((row) => row.recordKey)).size).toBe(2);
});

test("24. hojas con schemas distintos se analizan por separado", async () => {
  const secondHeaders = [
    "Apellido", "Nombre", "DNI", "Departamento", "Nombre de la escuela", "Auxiliar nuevo",
    "Nivel Educativo", "Nombre del cargo a titularizar", "Hora y/o Cargo a titularizar",
  ];
  const secondRow = ["Apellido", "Nombre", "29837689", "Capital", "Escuela", "aux", "PRIMARIO", "Maestro", "6 hs"];
  const prepared = await prepareSidcaPresentation(makeFile([
    sheet("A"),
    { name: "B", rows: [secondHeaders, secondRow] },
  ]));

  expect(Object.keys(prepared.wideSchemas)).toHaveLength(2);
  expect(prepared.sheets[0].wideSchema.columns[4].rawHeader).toBe("Nombre de la escuela");
  expect(prepared.sheets[1].wideSchema.columns[5].rawHeader).toBe("Auxiliar nuevo");
  expect(prepared.rows[1].situacion.nivel).toBe("PRIMARIO");
});

test("25. las hojas vacías o sin DNI no se seleccionan automáticamente", async () => {
  const prepared = await prepareSidcaPresentation(makeFile([
    sheet("VALIDA"),
    { name: "VACIA", rows: [] },
    { name: "TECNICA", rows: [["Nombre", "Valor"], ["x", "y"]] },
  ]));

  expect(prepared.sheets.map((item) => item.status)).toEqual([
    "COMPATIBLE_ESTRUCTURADA",
    "NO_COMPATIBLE",
    "NO_COMPATIBLE",
  ]);
  expect(prepared.selectedSheetIndexes).toEqual([0]);
  expect(prepared.sheets[1].validation.errors[0]).toBe("No se detectaron encabezados utilizables.");
  expect(prepared.sheets[2].validation.errors[0]).toBe("No se encontró una columna DNI utilizable.");
});

test("26. una situación equivalente en dos hojas no se deduplica", async () => {
  const prepared = await prepareSidcaPresentation(makeFile([
    sheet("A"),
    sheet("B"),
  ]));

  expect(prepared.rows).toHaveLength(2);
  expect(new Set(prepared.rows.map((row) => row.sourceSheetName))).toEqual(new Set(["A", "B"]));
});

test("27. seleccionar una de tres hojas limita el preview consolidado", async () => {
  const prepared = await prepareSidcaPresentation(makeFile([
    sheet("A"),
    sheet("B", [rowFor("31906891")]),
    sheet("C", [rowFor("32569039")]),
  ]));
  const selected = selectPreparedSidcaSheets(prepared, [1]);

  expect(selected.selectedSheetIndexes).toEqual([1]);
  expect(selected.summary.hojasSeleccionadas).toBe(1);
  expect(selected.summary.personas).toBe(1);
  expect(selected.rows.every((row) => row.sourceSheetIndex === 1)).toBe(true);
});

test("28. una hoja con estructura incompleta queda como compatible parcial", () => {
  const analysis = analyzeSidcaSheet({
    sheetName: "INCOMPLETA",
    sheetIndex: 0,
    rowCount: 1,
    columnCount: 3,
    columnas: [
      { key: "dni", label: "DNI", sourceHeader: "DNI", index: 0 },
      { key: "nombre", label: "Nombre", sourceHeader: "Nombre", index: 1 },
      { key: "escuela", label: "Nombre de la escuela", sourceHeader: "Nombre de la escuela", index: 2 },
    ],
    filas: [{ dni: "29837689", nombre: "Nombre", escuela: "Escuela" }],
  });

  expect(analysis.status).toBe("COMPATIBLE_PARCIAL");
  expect(analysis.selectable).toBe(true);
  expect(analysis.validation.valid).toBe(true);
  expect(analysis.summary).toMatchObject({ dniValidos: 1, personas: 1, situacionesExtraidas: 0 });
});

test("29. schemas de 148 y 153 columnas conviven en el mismo workbook", async () => {
  const headers153 = [
    ...baseHeaders,
    ...Array.from({ length: 153 - baseHeaders.length }, (_, index) => `Auxiliar ${index + 1}`),
  ];
  const row153 = [...rowFor("29837689"), ...Array(153 - baseHeaders.length).fill("")];
  const prepared = await prepareSidcaPresentation(makeFile([
    sheet("VERSION_148"),
    { name: "VERSION_153", rows: [headers153, row153] },
  ]));

  expect(prepared.sheets[0].wideSchema.columns).toHaveLength(baseHeaders.length);
  expect(prepared.sheets[1].wideSchema.columns).toHaveLength(153);
  expect(prepared.summary.situacionesExtraidas).toBe(2);
  expect(prepared.structureValid).toBe(true);
});

const partialHeadersFor = (count) => [
  "Apellido",
  "Nombre",
  "DNI",
  "Departamento",
  ...Array.from({ length: Math.max(0, count - 4) }, (_, index) => `Auxiliar ${index + 1}`),
];

const partialRowsFor = (count, dni = "29837689") => [
  partialHeadersFor(count),
  ["PEREZ", "ANA", dni, "Capital", ...Array(Math.max(0, count - 4)).fill("")],
];

test("30. una hoja de cuatro columnas con DNI es importable como parcial", () => {
  const analysis = analyzeSidcaSheet({
    sheetName: "CUATRO_COLUMNAS",
    sheetIndex: 0,
    rowCount: 1,
    columnCount: 4,
    indiceEncabezados: 0,
    columnas: ["Apellido", "Nombre", "DNI", "Departamento"].map((label, index) => ({
      key: label.toLowerCase(), label, sourceHeader: label, index,
    })),
    filas: [{ apellido: "PEREZ", nombre: "ANA", dni: "29837689", departamento: "Capital" }],
  });

  expect(analysis).toMatchObject({
    status: "COMPATIBLE_PARCIAL",
    selectable: true,
    summary: { dniDetectados: 1, dniValidos: 1, personas: 1, situacionesExtraidas: 0 },
  });
});

test("31. hojas de 18 y 19 columnas con DNI son importables", async () => {
  const prepared = await prepareSidcaPresentation(makeFile([
    { name: "DIECIOCHO", rows: partialRowsFor(18) },
    { name: "DIECINUEVE", rows: partialRowsFor(19, "30111222") },
  ]));

  expect(prepared.sheets.map((sheet) => sheet.status)).toEqual([
    "COMPATIBLE_PARCIAL",
    "COMPATIBLE_PARCIAL",
  ]);
  expect(prepared.selectedSheetIndexes).toEqual([0, 1]);
  expect(prepared.sheets.every((sheet) => sheet.summary.dniValidos === 1)).toBe(true);
});

test("32. DNI y Clave de cruce DNI usan DNI como columna principal", () => {
  const headers = ["Apellido", "Nombre", "DNI", "Clave de cruce DNI", "Categoría"];
  const analysis = analyzeSidcaSheet({
    sheetName: "CON_CLAVE",
    sheetIndex: 0,
    rowCount: 1,
    columnCount: headers.length,
    indiceEncabezados: 0,
    columnas: headers.map((label, index) => ({
      key: label.toLowerCase().replace(/\s+/g, "_"), label, sourceHeader: label, index,
    })),
    filas: [{ apellido: "PEREZ", nombre: "ANA", dni: "29837689", clave_de_cruce_dni: "29837689", categoria: "A" }],
  });

  expect(analysis.wideSchema.personColumns.dni.rawHeader).toBe("DNI");
  expect(analysis.wideSchema.personColumns.claveCruceDni.rawHeader).toBe("Clave de cruce DNI");
  expect(analysis.summary.personas).toBe(1);
  expect(analysis.rows).toHaveLength(1);
});

test("33. la hoja parcial conserva rawRecord y no fabrica situación", () => {
  const analysis = analyzeSidcaSheet({
    sheetName: "ADMINISTRATIVA",
    sheetIndex: 2,
    rowCount: 1,
    columnCount: 5,
    indiceEncabezados: 0,
    columnas: ["Apellido", "Nombre", "DNI", "Categoría", "Escuela/s"].map((label, index) => ({
      key: label.toLowerCase().replace(/[^a-z]+/g, "_"), label, sourceHeader: label, index,
    })),
    filas: [{ apellido: "PEREZ", nombre: "ANA", dni: "29837689", categoria: "A", escuela_s: "Escuela 91" }],
  });

  expect(analysis.rows[0].rawRecord).toMatchObject({ dni: "29837689", categoria: "A" });
  expect(analysis.rows[0].provenance).toMatchObject({ sheetName: "ADMINISTRATIVA", sheetIndex: 2, rowNumber: 2 });
  expect(analysis.rows[0].situacion).toBeUndefined();
  expect(analysis.summary.situacionesExtraidas).toBe(0);
});

test("34. seleccionar compatibles incluye parcial y estructurada, no NO_COMPATIBLE", async () => {
  const prepared = await prepareSidcaPresentation(makeFile([
    sheet("ESTRUCTURADA"),
    { name: "PARCIAL", rows: partialRowsFor(5, "30111222") },
    { name: "SIN_DNI", rows: [["Nombre", "Categoría"], ["ANA", "A"]] },
  ]));

  expect(prepared.sheets.map((item) => item.status)).toEqual([
    "COMPATIBLE_ESTRUCTURADA",
    "COMPATIBLE_PARCIAL",
    "NO_COMPATIBLE",
  ]);
  expect(prepared.compatibleSheetIndexes).toEqual([0, 1]);
  expect(prepared.selectedSheetIndexes).toEqual([0, 1]);
});

test("35. todas las hojas se analizan y una hoja parcial no informa cero DNI válidos", async () => {
  const prepared = await prepareSidcaPresentation(makeFile([
    { name: "TODOS", rows: partialRowsFor(5) },
    { name: "DOCENTES", rows: partialRowsFor(18, "30111222") },
    { name: "SIN_DNI", rows: [["Nombre", "Categoría"], ["ANA", "A"]] },
  ]));

  expect(prepared.sheets).toHaveLength(3);
  expect(prepared.sheets[0].summary.dniValidos).toBe(1);
  expect(prepared.sheets[1].summary.dniValidos).toBe(1);
  expect(prepared.sheets[0].status).toBe("COMPATIBLE_PARCIAL");
  expect(prepared.sheets[1].status).toBe("COMPATIBLE_PARCIAL");
  expect(prepared.sheets[2].status).toBe("NO_COMPATIBLE");
});
