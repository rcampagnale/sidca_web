import {
  describeWideHeaders,
  deriveNivelFromBlock,
  detectWideTitularizacionSchema,
  parseHoraOCargo,
  parseWideTitularizacionRow,
  parseWideTitularizacionRows,
  validateExtractedSituationSemantics,
} from "./titularizacionWideExcelParser";

const blockHeaders = (number) => {
  const suffix = number === 1 ? "" : ` ${number}`;
  return [
    `Nombre de la escuela${suffix}`,
    `Nivel Educativo${suffix}`,
    `Nombre del cargo a titularizar${suffix}`,
    `Hora y/o Cargo a titularizar${suffix}`,
    `Materia${suffix}`,
    `Curso/Año${suffix}`,
    `Modalidad${suffix}`,
    `Desea agregar otro cargo u horas${suffix}`,
  ];
};

const headersFor = (blocks = 1) => [
  "Apellido",
  "Nombre (completos)",
  "D.N.I N°",
  "Departamento",
  ...Array.from({ length: blocks }, (_, index) => blockHeaders(index + 1)).flat(),
];

const schemaFor = (blocks = 1) => {
  const columns = headersFor(blocks).map((label, index) => ({
    key: `col_${index}`,
    label,
    sourceHeader: label,
    index,
  }));
  return detectWideTitularizacionSchema(columns);
};

const rowFor = (blocks = 1, overrides = {}) => {
  const row = Array(headersFor(blocks).length).fill("");
  row[0] = "Apellido";
  row[1] = "Nombre";
  row[2] = "29837689";
  row[3] = "Capital";
  for (let block = 1; block <= blocks; block += 1) {
    const offset = 4 + (block - 1) * 8;
    row[offset] = `Escuela ${block}`;
    row[offset + 1] = "Secundario";
    row[offset + 2] = `Cargo ${block}`;
    row[offset + 3] = String(block);
    row[offset + 4] = `Materia ${block}`;
    row[offset + 5] = `${block}° A`;
    row[offset + 6] = "Común";
  }
  return Object.assign(row, overrides);
};

const columnsForLabels = (labels, context = {}) => labels.map((label, index) => ({
  key: `col_${index}`,
  label,
  sourceHeader: label,
  index,
  ...context,
}));

const wideLabelsWithColumnCount = (columnCount) => [
  ...headersFor(1),
  ...Array.from({ length: Math.max(0, columnCount - headersFor(1).length) }, (_, index) => `Auxiliar ${index + 1}`),
];

test("1. una fila con un bloque produce una situación", () => {
  const schema = schemaFor(1);
  const parsed = parseWideTitularizacionRow(rowFor(1), schema, { numeroFila: 2 });

  expect(parsed.situaciones).toHaveLength(1);
  expect(parsed.situaciones[0]).toMatchObject({
    indiceBloqueOriginal: 1,
    cargo: "Cargo 1",
    horas: "1",
    materia: "Materia 1",
    cursoAnio: "1° A",
  });
});

test("2. una fila con tres bloques produce tres situaciones", () => {
  const parsed = parseWideTitularizacionRow(rowFor(3), schemaFor(3));

  expect(parsed.situaciones).toHaveLength(3);
  expect(parsed.situaciones.map((item) => item.indiceBloqueOriginal)).toEqual([1, 2, 3]);
});

test("3. un segundo bloque completamente vacío no crea situación", () => {
  const row = rowFor(2);
  row.splice(12, 8, ...Array(8).fill(""));

  const parsed = parseWideTitularizacionRow(row, schemaFor(2));

  expect(parsed.situaciones).toHaveLength(1);
});

test("4. horas igual a 0 conserva la situación y el valor", () => {
  const row = rowFor(1);
  row[7] = "0";

  const parsed = parseWideTitularizacionRow(row, schemaFor(1));

  expect(parsed.situaciones[0].horas).toBe("0");
  [
    ["6", { tipo: "horas", horas: "6" }],
    ["06", { tipo: "horas", horas: "06" }],
    ["6 hs", { tipo: "horas", horas: "6 hs" }],
    ["6 horas", { tipo: "horas", horas: "6 horas" }],
    ["MAESTRO DE GRADO", { tipo: "cargo", horas: null, cargoAlternativo: "MAESTRO DE GRADO" }],
    ["PROFESOR", { tipo: "cargo", horas: null, cargoAlternativo: "PROFESOR" }],
    ["12 y 8", { tipo: "ambiguo", horas: null, cargoAlternativo: null }],
    ["12+8", { tipo: "ambiguo", horas: null, cargoAlternativo: null }],
    ["5 hs - 1° año I", { tipo: "ambiguo", horas: null, cargoAlternativo: null }],
    ["", { tipo: "vacio", horas: null, cargoAlternativo: null }],
  ].forEach(([value, expected]) => {
    expect(parseHoraOCargo(value)).toMatchObject({ raw: value, ...expected });
  });
});

test("5. materia SIN DATOS conserva la situación y el valor", () => {
  const row = rowFor(1);
  row[8] = "SIN DATOS";

  const parsed = parseWideTitularizacionRow(row, schemaFor(1));

  expect(parsed.situaciones[0].materia).toBe("SIN DATOS");
});

test("6. encabezados repetidos conservan ocurrencia e índice", () => {
  const columns = describeWideHeaders(["Nivel Educativo", "Nivel Educativo", "Nivel Educativo"]);

  expect(columns.map((column) => column.normalizedHeader)).toEqual([
    "nivelEducativo",
    "nivelEducativo",
    "nivelEducativo",
  ]);
  expect(columns.map((column) => column.occurrence)).toEqual([1, 2, 3]);
  expect(columns.map((column) => column.index)).toEqual([0, 1, 2]);
});

test("7. dos personas nunca mezclan sus situaciones", () => {
  const schema = schemaFor(1);
  const first = rowFor(1);
  const second = rowFor(1);
  second[0] = "Otro apellido";
  second[1] = "Otra persona";
  second[2] = "31906891";
  second[4] = "Otra escuela";

  const parsed = parseWideTitularizacionRows({
    filas: [first, second],
    columnas: headersFor(1).map((label, index) => ({ key: `col_${index}`, label, sourceHeader: label, index })),
    schema,
  });

  expect(parsed.personas).toHaveLength(2);
  expect(parsed.personas[0].situaciones[0].establecimiento).toBe("Escuela 1");
  expect(parsed.personas[1].situaciones[0].establecimiento).toBe("Otra escuela");
});

test("8. DNI inválido queda separado de personas canónicas", () => {
  const row = rowFor(1);
  row[2] = "123456789";
  const parsed = parseWideTitularizacionRows({
    filas: [row],
    columnas: headersFor(1).map((label, index) => ({ key: `col_${index}`, label, sourceHeader: label, index })),
    schema: schemaFor(1),
  });

  expect(parsed.summary.dniInvalidos).toBe(1);
  expect(parsed.summary.personas).toBe(0);
  expect(parsed.personas[0].dniValido).toBe(false);
  expect(parsed.rows[0].dni).toBe("123456789");
});

test("9. control de agregar otro cargo sin bloque siguiente no crea situación ficticia", () => {
  const row = rowFor(2);
  row.splice(12, 8, ...Array(8).fill(""));
  row[19] = "Sí";

  const parsed = parseWideTitularizacionRow(row, schemaFor(2));

  expect(parsed.situaciones).toHaveLength(1);
});

test("10. se conserva el orden original de tres bloques", () => {
  const parsed = parseWideTitularizacionRow(rowFor(3), schemaFor(3));

  expect(parsed.situaciones.map((item) => item.indiceBloqueOriginal)).toEqual([1, 2, 3]);
  expect(parsed.situaciones.map((item) => item.sourceColumns.cargo)).toEqual([6, 14, 22]);
});

test("11. un bloque parcial con cargo y establecimiento sí crea situación", () => {
  const row = Array(headersFor(1).length).fill("");
  row[0] = "Apellido";
  row[1] = "Nombre";
  row[2] = "29837689";
  row[4] = "Escuela";
  row[6] = "Cargo";
  row[7] = "MAESTRO DE GRADO";

  const parsed = parseWideTitularizacionRow(row, schemaFor(1));

  expect(parsed.situaciones).toHaveLength(1);
  expect(parsed.situaciones[0]).toMatchObject({
    establecimiento: "Escuela",
    cargo: "Cargo",
    horas: "",
    horaOCargoTipo: "cargo",
    cargoAlternativo: "MAESTRO DE GRADO",
  });
});

test("12. un bloque que sólo tiene control o checkbox no crea situación", () => {
  const row = Array(headersFor(1).length).fill("");
  row[0] = "Apellido";
  row[1] = "Nombre";
  row[2] = "29837689";
  row[11] = "Sí";

  const parsed = parseWideTitularizacionRow(row, schemaFor(1));

  expect(parsed.situaciones).toHaveLength(0);
});

test("fixture real: detecta estructura multibloque y no pisa los encabezados", () => {
  const schema = schemaFor(3);

  expect(schema.detected).toBe(true);
  expect(schema.confidence).toBe("high");
  expect(schema.blocks).toHaveLength(3);
  expect(schema.maxSituationsPerRow).toBe(3);
  expect(schema.unmappedConcepts).toEqual([]);
});

test("13. columnas auxiliares insertadas no rompen el mapeo semántico", () => {
  const labels = [
    "Apellido",
    "Nombre",
    "D.N.I N°",
    "Departamento",
    "Nombre de la escuela",
    "Auxiliar agregado",
    "Nivel Educativo",
    "Nombre del cargo a titularizar",
    "Hora y/o Cargo a titularizar",
    "Desea agregar otro cargo u horas",
  ];
  const columns = columnsForLabels(labels);
  const row = Array(labels.length).fill("");
  row[0] = "Apellido";
  row[1] = "Nombre";
  row[2] = "29837689";
  row[3] = "Capital";
  row[4] = "Escuela";
  row[6] = "SECUNDARIO";
  row[7] = "Profesor";
  row[8] = "4 hs";

  const schema = detectWideTitularizacionSchema(columns, { sheetName: "SECUNDARIO", sheetIndex: 1 });
  const parsed = parseWideTitularizacionRow(row, schema, {
    numeroFila: 125,
    sourceSheetName: "SECUNDARIO",
    sourceSheetIndex: 1,
  });

  expect(parsed.situaciones[0]).toMatchObject({
    cargo: "Profesor",
    horas: "4 hs",
    nivel: "SECUNDARIO",
    sourceSheetName: "SECUNDARIO",
    sourceRowNumber: 125,
    sourceBlockIndex: 1,
  });
  expect(parsed.situaciones[0].fieldSources.nivel).toMatchObject({ header: "Nivel Educativo" });
});

test("14. la descripción libre nunca se convierte en nivel ni horas", () => {
  const labels = [
    "Apellido", "Nombre", "DNI", "Nombre de la escuela", "Nivel Educativo",
    "Nombre del cargo a titularizar", "Hora y/o Cargo a titularizar",
    "Breve explicación de su situación de revista", "Control",
  ];
  const row = ["Apellido", "Nombre", "29837689", "Escuela", "SECUNDARIO", "Profesor", "", "1° 3° HISTORIA / 3 HORAS / SANTA MARÍA", ""];
  const schema = detectWideTitularizacionSchema(columnsForLabels(labels));
  const parsed = parseWideTitularizacionRow(row, schema);
  const situation = parsed.situaciones[0];

  expect(situation.nivel).toBe("SECUNDARIO");
  expect(situation.horas).toBe("");
  expect(situation.materia).toBe("");
  expect(situation.cursoAnio).toBe("");
  expect(situation.detalleSituacionRaw).toContain("1° 3° HISTORIA");
  expect(situation.fieldSources.nivel.normalizedHeader).toBe("nivelEducativo");
});

test("15. deriveNivelFromBlock prioriza nivelEducativo y sólo usa headers de nivel", () => {
  const schema = schemaFor(1);
  const block = schema.blocks[0];
  const row = rowFor(1);
  row[5] = "SECUNDARIO";
  row[8] = "1° 3° HISTORIA / 3 HORAS / SANTA MARÍA";

  const derived = deriveNivelFromBlock(block, row);

  expect(derived.value).toBe("SECUNDARIO");
  expect(derived.source.normalizedHeader).toBe("nivelEducativo");
});

test("16. un cargo libre en Hora/Cargo queda fuera de horas y no pisa Cargo específico", () => {
  const row = rowFor(1);
  row[6] = "Profesor de Matemática";
  row[7] = "Maestra de Grado Jornada Extendida";
  const parsed = parseWideTitularizacionRow(row, schemaFor(1));

  expect(parsed.situaciones[0]).toMatchObject({
    cargo: "Profesor de Matemática",
    horas: "",
    horaOCargoTipo: "cargo",
    cargoAlternativo: "Maestra de Grado Jornada Extendida",
  });
});

test("17. el texto libre conserva raw sin poblar campos canónicos", () => {
  const labels = [
    "Apellido", "Nombre", "DNI", "Nombre de la escuela", "Nivel Educativo",
    "Nombre del cargo a titularizar", "Hora y/o Cargo a titularizar",
    "Descripción de la situación", "Control",
  ];
  const row = ["Apellido", "Nombre", "29837689", "Escuela", "", "", "", "5° año I - Historia - 4 hs", ""];
  const parsed = parseWideTitularizacionRow(row, detectWideTitularizacionSchema(columnsForLabels(labels)));
  const situation = parsed.situaciones[0];

  expect(situation.detalleSituacionRaw).toBe("5° año I - Historia - 4 hs");
  expect(situation.nivel).toBe("");
  expect(situation.materia).toBe("");
  expect(situation.cursoAnio).toBe("");
  expect(situation.horas).toBe("");
});

test("18. un schema de 148 columnas se detecta por headers y bloques", () => {
  const labels = wideLabelsWithColumnCount(148);
  const schema = detectWideTitularizacionSchema(columnsForLabels(labels), { sheetName: "A", sheetIndex: 0 });

  expect(schema.columns).toHaveLength(148);
  expect(schema.detected).toBe(true);
  expect(schema.blocks).toHaveLength(1);
});

test("19. un schema de 153 columnas se detecta igual aunque agregue auxiliares", () => {
  const labels = wideLabelsWithColumnCount(153);
  const schema = detectWideTitularizacionSchema(columnsForLabels(labels), { sheetName: "B", sheetIndex: 1 });

  expect(schema.columns).toHaveLength(153);
  expect(schema.detected).toBe(true);
  expect(schema.blocks).toHaveLength(1);
  expect(schema.columns[152]).toMatchObject({ sheetName: "B", sheetIndex: 1, columnIndex: 152 });
});

test("20. fieldSources nivel sólo apunta a un header permitido", () => {
  const parsed = parseWideTitularizacionRow(rowFor(1), schemaFor(1), { sourceSheetName: "PRIMARIO" });
  const source = parsed.situaciones[0].fieldSources.nivel;

  expect(source).toBeTruthy();
  expect(["nivelEducativo", "nivelPrimario", "nivelSecundario", "nivelTecnico"]).toContain(source.normalizedHeader);
});

test("21. una situación con source incompatible es inválida", () => {
  const validation = validateExtractedSituationSemantics({
    sourceSheetName: "HOJA",
    sourceBlockIndex: 1,
    nivel: "SECUNDARIO",
    fieldSources: {
      nivel: { normalizedHeader: "breveExplicacionDeSuSituacion" },
    },
  });

  expect(validation.valid).toBe(false);
  expect(validation.errors).toContain("nivel obtenido desde un encabezado incompatible.");
});
