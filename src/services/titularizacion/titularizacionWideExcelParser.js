import {
  isValidDni,
  normalizeDni,
  normalizeSearchText,
  textValue,
} from "./titularizacionNormalizer";

const AUXILIARY_FIELDS = new Set(["adjunto", "autorizacion"]);

const FIELD_MATCHERS = Object.freeze({
  establecimiento: (header) =>
    header.includes("nombreDeLaEscuela") ||
    header.startsWith("establecimiento") ||
    header.startsWith("escuela") ||
    header.startsWith("organismo"),
  nivel: (header) => header.startsWith("nivelEducativo"),
  nivelPrimario: (header) => header.startsWith("nivelPrimario"),
  jornada: (header) => header.startsWith("tipoDeJornada"),
  nivelSecundario: (header) => header.startsWith("nivelSecundario"),
  nivelTecnico: (header) =>
    header.startsWith("educacionTecnicoProfesional") || header.startsWith("nivelTecnico"),
  otrasModalidades: (header) => header.startsWith("otrasModalidades"),
  modalidad: (header) => header.startsWith("modalidad") && !header.startsWith("modalidades"),
  turno: (header) => header.startsWith("turno"),
  cargo: (header) =>
    (header.includes("nombreDelCargo") && header.includes("Titularizar")) ||
    (header.includes("cargo") && header.includes("Titularizar") && !header.includes("hora")),
  horas: (header) =>
    (header.includes("hora") && header.includes("Cargo") && header.includes("Titularizar")) ||
    header.startsWith("horasTitularizar") ||
    header.startsWith("cantidadHoras"),
  materia: (header) =>
    header.startsWith("materia") || header.startsWith("espacioCurricular"),
  cursoAnio: (header) =>
    header.startsWith("curso") || header.startsWith("cursoAnio") || header.startsWith("anoSecc"),
  situacionRevista: (header) => header.startsWith("situacionDeRevista"),
  titulo: (header) => header.startsWith("tituloHabilitante"),
  antiguedadDocencia: (header) => header.startsWith("antiguedadEnLaDocencia"),
  antiguedadCargo: (header) => header.startsWith("antiguedadEnElCargo"),
  explicacion: (header) =>
    header.startsWith("breveExplicacion") ||
    header.startsWith("descripcionSituacion") ||
    header.startsWith("descripcionDeLaSituacion") ||
    header.startsWith("detalleSituacion"),
  adjunto: (header) => header.startsWith("adjuntarDocumentacion"),
  autorizacion: (header) => header.startsWith("autorizacionPara"),
});

const PERSON_MATCHERS = Object.freeze({
  dni: (header, rawHeader) =>
    header === "dni" || header.startsWith("dni") || /^d[.\s]*n[.\s]*i/i.test(rawHeader),
  apellido: (header) => header.startsWith("apellido"),
  nombre: (header) =>
    header.startsWith("nombre") &&
    !header.includes("escuela") &&
    !header.includes("cargo"),
  departamento: (header) => header.startsWith("departamento"),
  telefono: (header) => header.includes("telefono"),
});

const text = (value) => textValue(value).trim();

const SIMPLE_HOURS_PATTERN = /^\d+(?:[.,]\d+)?$/u;
const HOURS_WITH_UNIT_PATTERN = /^\d+(?:[.,]\d+)?\s*(?:h|hs|hora|horas)(?:\s+c[áa]tedra)?$/iu;
const AMBIGUOUS_HOURS_PATTERN = /\d+\s*(?:y|\+|\/)\s*\d+/iu;

/** Clasifica de forma conservadora el campo real "Hora y/o Cargo a Titularizar". */
export const parseHoraOCargo = (value) => {
  const raw = text(value);
  if (!isWideCellMeaningful(raw)) {
    return { raw: "", tipo: "vacio", horas: null, cargoAlternativo: null };
  }

  if (SIMPLE_HOURS_PATTERN.test(raw) || HOURS_WITH_UNIT_PATTERN.test(raw)) {
    return { raw, tipo: "horas", horas: raw, cargoAlternativo: null };
  }

  if (AMBIGUOUS_HOURS_PATTERN.test(raw)) {
    return { raw, tipo: "ambiguo", horas: null, cargoAlternativo: null };
  }

  if (/[a-záéíóúüñ]/iu.test(raw) && !/\d/u.test(raw)) {
    return { raw, tipo: "cargo", horas: null, cargoAlternativo: raw };
  }

  return { raw, tipo: "ambiguo", horas: null, cargoAlternativo: null };
};

export const isWideCellMeaningful = (value) => {
  const normalized = text(value);
  if (!normalized) return false;
  return !/^[-\u2012\u2013\u2014\u2212]+$/.test(normalized);
};

const camelizeHeader = (value) => {
  const withoutOccurrence = String(value || "")
    .replace(/\s+\d+\s*$/u, "")
    .trim();
  const words = normalizeSearchText(withoutOccurrence)
    .split(/[^a-z0-9]+/u)
    .filter(Boolean);
  const compact = words.join("");

  if (compact === "dnin" || compact.startsWith("dni")) return "dni";
  if (!words.length) return "columna";

  return words
    .map((word, index) =>
      index === 0 ? word : `${word.charAt(0).toUpperCase()}${word.slice(1)}`
    )
    .join("");
};

const columnRawHeader = (column, index) => {
  if (typeof column === "string") return column.trim();
  return String(column?.sourceHeader || column?.label || `Columna ${index + 1}`).trim();
};

const excelColumn = (index) => {
  let value = index + 1;
  let result = "";
  while (value > 0) {
    const remainder = (value - 1) % 26;
    result = String.fromCharCode(65 + remainder) + result;
    value = Math.floor((value - 1) / 26);
  }
  return result;
};

export const describeWideHeaders = (
  columns = [],
  { sheetName = "Hoja 1", sheetIndex = 0 } = {}
) => {
  const occurrences = new Map();

  return columns.map((column, position) => {
    const index = Number.isInteger(column?.index) ? column.index : position;
    const rawHeader = columnRawHeader(column, position);
    const normalizedHeader = camelizeHeader(rawHeader);
    const occurrence = (occurrences.get(normalizedHeader) || 0) + 1;
    occurrences.set(normalizedHeader, occurrence);

    return {
      sheetName,
      sheetIndex,
      index,
      columnIndex: index,
      excelColumn: excelColumn(index),
      key: column?.key || String(index),
      label: column?.label || rawHeader,
      sourceHeader: column?.sourceHeader || rawHeader,
      rawHeader,
      normalizedHeader,
      occurrence,
    };
  });
};

const matches = (descriptor, matcher) =>
  Boolean(descriptor && matcher(descriptor.normalizedHeader, descriptor.rawHeader));

const firstMatching = (columns, matcher, start = 0, end = Number.MAX_SAFE_INTEGER) =>
  columns.find(
    (column) => column.index >= start && column.index < end && matches(column, matcher)
  ) || null;

const findPersonColumns = (columns) =>
  Object.fromEntries(
    Object.entries(PERSON_MATCHERS).map(([field, matcher]) => [
      field,
      firstMatching(columns, matcher),
    ])
  );

const findSituationBlocks = (columns) => {
  const anchors = columns.filter((column) => matches(column, FIELD_MATCHERS.establecimiento));

  return anchors.map((anchor, index) => {
    const nextAnchor = anchors[index + 1];
    const nextIndex = nextAnchor?.index ?? columns[columns.length - 1]?.index + 1 ?? anchor.index + 1;
    const control = firstMatching(
      columns,
      (header) => header.startsWith("deseaAgregarOtroCargo"),
      anchor.index + 1,
      nextIndex
    );
    const endIndex = control?.index ?? nextIndex;
    const fields = Object.fromEntries(
      Object.entries(FIELD_MATCHERS).map(([field, matcher]) => [
        field,
        firstMatching(columns, matcher, anchor.index, endIndex),
      ])
    );
    const substantiveKeys = Object.keys(fields).filter(
      (field) => !AUXILIARY_FIELDS.has(field)
    );
    const sourceColumnIndexes = Object.values(fields)
      .filter(Boolean)
      .map((column) => column.index);

    return {
      indiceBloqueOriginal: index + 1,
      startIndex: anchor.index,
      endIndex,
      startColumn: excelColumn(anchor.index),
      endColumn: excelColumn(Math.max(anchor.index, endIndex - 1)),
      controlColumn: control?.excelColumn || null,
      control,
      fields,
      substantiveKeys,
      sourceColumnIndexes,
    };
  });
};

export const detectWideTitularizacionSchema = (
  columns = [],
  { sheetName = "Hoja 1", sheetIndex = 0 } = {}
) => {
  const describedColumns = describeWideHeaders(columns, { sheetName, sheetIndex });
  const personColumns = findPersonColumns(describedColumns);
  const blocks = findSituationBlocks(describedColumns).map((block) => ({
    ...block,
    sheetName,
    sheetIndex,
  }));
  const recognizedColumns = new Set(
    [
      ...Object.values(personColumns),
      ...blocks.flatMap((block) => Object.values(block.fields)),
      ...describedColumns.filter((column) =>
        column.normalizedHeader.startsWith("deseaAgregarOtroCargo")
      ),
    ]
      .filter(Boolean)
      .map((column) => column.index)
  );
  const missingCoreFields = blocks.flatMap((block) =>
    ["establecimiento", "nivel", "cargo", "horas"]
      .filter((field) => !block.fields[field])
      .map((field) => `bloque${block.indiceBloqueOriginal}.${field}`)
  );
  const detected = Boolean(personColumns.dni && blocks.length);

  return {
    sheetName,
    sheetIndex,
    detected,
    confidence: detected && missingCoreFields.length === 0 ? "high" : "review",
    requiresReview: !detected || missingCoreFields.length > 0,
    columns: describedColumns,
    personColumns,
    blocks,
    recognizedColumnIndexes: [...recognizedColumns],
    recognizedColumnCount: recognizedColumns.size,
    missingCoreFields,
    unmappedConcepts: ["materia", "cursoAnio"].filter(
      (concept) => !blocks.some((block) => block.fields[concept])
    ),
    maxSituationsPerRow: blocks.length,
  };
};

const readColumnValue = (row, column) => {
  if (!column || !row) return "";
  if (Array.isArray(row)) return row[column.index] ?? "";

  const candidates = [column.key, column.sourceHeader, column.label].filter(Boolean);
  for (const candidate of candidates) {
    if (Object.prototype.hasOwnProperty.call(row, candidate)) return row[candidate];
  }
  return "";
};

const displayValue = (row, column) => text(readColumnValue(row, column));

const valueOrHeaderForMarker = (row, column) => {
  const value = displayValue(row, column);
  if (!isWideCellMeaningful(value)) return "";

  if (/^(x|si|s[ií]|true|verdadero|yes|1)$/iu.test(value)) {
    return column.normalizedHeader || column.rawHeader;
  }
  return value;
};

const sourceDescriptor = (column) => {
  if (!column) return null;
  return {
    sheetName: column.sheetName || null,
    sheetIndex: column.sheetIndex ?? null,
    columnIndex: column.columnIndex ?? column.index ?? null,
    excelColumn: column.excelColumn || null,
    header: column.rawHeader || column.sourceHeader || column.label || null,
    rawHeader: column.rawHeader || column.sourceHeader || column.label || null,
    normalizedHeader: column.normalizedHeader || null,
    occurrence: column.occurrence ?? null,
  };
};

const sourceValue = (row, column) => ({
  value: valueOrHeaderForMarker(row, column),
  source: sourceDescriptor(column),
});

/** Deriva nivel únicamente desde las columnas semánticas de nivel del bloque. */
export const deriveNivelFromBlock = (block, row = {}) => {
  const candidates = [
    block.fields?.nivel,
    block.fields?.nivelPrimario,
    block.fields?.nivelSecundario,
    block.fields?.nivelTecnico,
    block.fields?.otrasModalidades,
  ].filter(Boolean);
  const values = candidates
    .map((column) => sourceValue(row, column))
    .filter(({ value }) => isWideCellMeaningful(value));
  const uniqueValues = [...new Set(values.map(({ value }) => value).filter(Boolean))];
  return {
    value: uniqueValues.join(" / "),
    source: values[0]?.source || null,
    sources: values.map(({ source }) => source).filter(Boolean),
  };
};

const sourceHeaderMatches = (source, patterns) =>
  Boolean(source?.normalizedHeader && patterns.some((pattern) => pattern.test(source.normalizedHeader)));

/** Valida la semántica y trazabilidad de una situación ya extraída. */
export const validateExtractedSituationSemantics = (situation = {}) => {
  const errors = [];
  const warnings = [];
  const fieldSources = situation.fieldSources || {};

  if (!situation.sourceSheetName) errors.push("sourceSheetName ausente.");
  if (!Number.isInteger(situation.sourceBlockIndex) || situation.sourceBlockIndex < 1) {
    errors.push("sourceBlockIndex inválido.");
  }

  if (fieldSources.nivel && !sourceHeaderMatches(fieldSources.nivel, [
    /^nivelEducativo/u,
    /^nivelPrimario/u,
    /^nivelSecundario/u,
    /^nivelTecnico/u,
    /^educacionTecnicoProfesional/u,
    /^otrasModalidades/u,
  ])) {
    errors.push("nivel obtenido desde un encabezado incompatible.");
  }
  if (fieldSources.cargo && !sourceHeaderMatches(fieldSources.cargo, [
    /nombreDelCargo/u,
    /^cargo(?!.*hora)/u,
  ])) {
    errors.push("cargo obtenido desde un encabezado incompatible.");
  }
  if (fieldSources.establecimiento && !sourceHeaderMatches(fieldSources.establecimiento, [
    /nombreDeLaEscuela/u,
    /^establecimiento/u,
    /^escuela/u,
    /^organismo/u,
  ])) {
    errors.push("establecimiento obtenido desde un encabezado incompatible.");
  }
  if (fieldSources.modalidad && !sourceHeaderMatches(fieldSources.modalidad, [/^modalidad/u])) {
    errors.push("modalidad obtenida desde un encabezado incompatible.");
  }
  if (fieldSources.materia && !sourceHeaderMatches(fieldSources.materia, [
    /^materia/u,
    /^espacioCurricular/u,
  ])) {
    errors.push("materia obtenida desde un encabezado incompatible.");
  }
  if (fieldSources.cursoAnio && !sourceHeaderMatches(fieldSources.cursoAnio, [
    /^curso/u,
    /^anoSecc/u,
  ])) {
    errors.push("curso/año obtenido desde un encabezado incompatible.");
  }

  if (situation.horaOCargoTipo === "cargo" && situation.horas) {
    errors.push("un texto clasificado como cargo fue almacenado en horas.");
  }
  if (situation.horaOCargoTipo === "ambiguo") {
    warnings.push("hora/cargo ambiguo conservado como raw.");
  }
  if (!situation.materia) warnings.push("materia no disponible.");
  if (!situation.cursoAnio) warnings.push("curso/año no disponible.");
  if (!situation.modalidad) warnings.push("modalidad desconocida.");

  return { valid: errors.length === 0, errors, warnings };
};

const normalizedSituationValues = (row, block) => {
  const field = (name) => block.fields[name];
  const nivel = deriveNivelFromBlock(block, row);
  const cargoPrincipal = displayValue(row, field("cargo"));
  const horaOCargo = parseHoraOCargo(displayValue(row, field("horas")));
  const detalleSituacionRaw = displayValue(row, field("explicacion"));
  const fieldSources = {
    cargo: sourceDescriptor(field("cargo")),
    horas: sourceDescriptor(field("horas")),
    establecimiento: sourceDescriptor(field("establecimiento")),
    nivel: nivel.source,
    modalidad: sourceDescriptor(field("modalidad")),
    materia: sourceDescriptor(field("materia")),
    cursoAnio: sourceDescriptor(field("cursoAnio")),
  };

  return {
    establecimiento: displayValue(row, field("establecimiento")),
    cargo: cargoPrincipal,
    horas: horaOCargo.horas || "",
    horaOCargoRaw: horaOCargo.raw,
    horaOCargoTipo: horaOCargo.tipo,
    cargoAlternativo: horaOCargo.cargoAlternativo,
    materia: displayValue(row, field("materia")),
    nivel: nivel.value,
    nivelSourceColumn: nivel.source?.columnIndex ?? null,
    nivelSourceHeader: nivel.source?.header || null,
    modalidad: valueOrHeaderForMarker(row, field("modalidad")) || "",
    cursoAnio: displayValue(row, field("cursoAnio")),
    turno: displayValue(row, field("turno")),
    situacionRevista: displayValue(row, field("situacionRevista")),
    tituloHabilitante: displayValue(row, field("titulo")),
    antiguedadDocencia: displayValue(row, field("antiguedadDocencia")),
    antiguedadCargo: displayValue(row, field("antiguedadCargo")),
    explicacion: displayValue(row, field("explicacion")),
    detalleSituacionRaw,
    fieldSources,
  };
};

const hasSubstantiveContent = (row, block) =>
  block.substantiveKeys.some((field) =>
    isWideCellMeaningful(readColumnValue(row, block.fields[field]))
  );

export const parseWideTitularizacionRow = (
  row,
  schema,
  {
    numeroFila = 1,
    recordKey = `fila_${numeroFila}`,
    sourceSheetName = schema?.sheetName || "Hoja 1",
    sourceSheetIndex = schema?.sheetIndex ?? 0,
  } = {}
) => {
  const person = schema.personColumns;
  const dni = normalizeDni(readColumnValue(row, person.dni));
  const situaciones = schema.blocks
    .filter((block) => hasSubstantiveContent(row, block))
    .map((block) => {
      const valoresNormalizados = normalizedSituationValues(row, block);
      const sourceColumns = Object.fromEntries(
        Object.entries(block.fields).map(([field, column]) => [field, column?.index ?? null])
      );

      const situation = {
        indiceBloqueOriginal: block.indiceBloqueOriginal,
        sourceSheetName,
        sourceSheetIndex,
        sourceRowNumber: numeroFila,
        sourceBlockIndex: block.indiceBloqueOriginal,
        ...valoresNormalizados,
        sourceColumnIndexes: block.sourceColumnIndexes,
        sourceColumns,
        controlColumn: block.controlColumn,
      };
      return {
        ...situation,
        semanticValidation: validateExtractedSituationSemantics(situation),
      };
    });

  return {
    recordKey,
    numeroFila,
    sourceSheetName,
    sourceSheetIndex,
    dni,
    apellido: displayValue(row, person.apellido),
    nombre: displayValue(row, person.nombre),
    departamento: displayValue(row, person.departamento),
    situaciones,
    dniValido: isValidDni(dni),
    requiereRevisionDni: !isValidDni(dni),
  };
};

const personKeyFor = (parsedRow) =>
  parsedRow.dniValido ? `dni_${parsedRow.dni}` : `revision_${parsedRow.numeroFila}`;

export const parseWideTitularizacionRows = ({
  filas = [],
  columnas = [],
  indiceEncabezados = 0,
  sourceSheetName,
  sourceSheetIndex,
  recordKeyPrefix = "",
  schema = detectWideTitularizacionSchema(columnas),
} = {}) => {
  const sheetName = sourceSheetName || schema.sheetName || "Hoja 1";
  const sheetIndex = sourceSheetIndex ?? schema.sheetIndex ?? 0;
  const prefix = recordKeyPrefix || (
    sheetIndex === 0 && sheetName === "Hoja 1"
      ? ""
      : `hoja_${sheetIndex}_${normalizeSearchText(sheetName).replace(/\s+/g, "_")}_`
  );
  const parsedRows = filas.map((row, index) =>
    parseWideTitularizacionRow(row, schema, {
      numeroFila: index + indiceEncabezados + 2,
      recordKey: `${prefix}fila_${index + indiceEncabezados + 2}`,
      sourceSheetName: sheetName,
      sourceSheetIndex: sheetIndex,
    })
  );
  const normalizedRows = [];
  const peopleByKey = new Map();

  parsedRows.forEach((parsedRow) => {
    const personKey = personKeyFor(parsedRow);
    if (!peopleByKey.has(personKey)) {
      peopleByKey.set(personKey, {
        dni: parsedRow.dni,
        apellido: parsedRow.apellido,
        nombre: parsedRow.nombre,
        departamento: parsedRow.departamento,
        dniValido: parsedRow.dniValido,
        situaciones: [],
        filasExcel: [],
        hojasOrigen: [],
      });
    }
    const person = peopleByKey.get(personKey);
    person.filasExcel.push(parsedRow.numeroFila);
    if (!person.hojasOrigen.some((item) => item.sheetIndex === parsedRow.sourceSheetIndex)) {
      person.hojasOrigen.push({
        sheetName: parsedRow.sourceSheetName,
        sheetIndex: parsedRow.sourceSheetIndex,
      });
    }

    parsedRow.situaciones.forEach((situacion) => {
      const recordKey = `${parsedRow.recordKey}_bloque_${situacion.indiceBloqueOriginal}`;
      const valoresNormalizados = {
        dni: parsedRow.dni,
        apellido: parsedRow.apellido,
        nombre: parsedRow.nombre,
        departamento: parsedRow.departamento,
        ...situacion,
      };
      const normalizedRow = {
        recordKey,
        numeroFila: parsedRow.numeroFila,
        sourceSheetName: parsedRow.sourceSheetName,
        sourceSheetIndex: parsedRow.sourceSheetIndex,
        sourceRowNumber: parsedRow.numeroFila,
        dni: parsedRow.dni,
        apellido: parsedRow.apellido,
        nombre: parsedRow.nombre,
        indiceBloqueOriginal: situacion.indiceBloqueOriginal,
        situacion: { ...situacion },
        valoresOriginales: { ...rowForValues(parsedRow, situacion) },
        valoresNormalizados,
        valuesNormalized: valoresNormalizados,
      };
      normalizedRows.push(normalizedRow);
      person.situaciones.push({
        ...situacion,
        recordKey,
        numeroFila: parsedRow.numeroFila,
      });
    });
  });

  const personas = [...peopleByKey.values()].map((person) => ({
    ...person,
    situacionesCount: person.situaciones.length,
  }));
  const rowsWithDni = parsedRows.filter((row) => row.dni);
  const validRows = parsedRows.filter((row) => row.dniValido);
  const situationsCount = normalizedRows.length;
  const semanticValidations = normalizedRows.map((row) =>
    row.situacion.semanticValidation || validateExtractedSituationSemantics(row.situacion)
  );
  const semanticErrors = semanticValidations.flatMap((validation) => validation.errors);
  const semanticWarnings = semanticValidations.flatMap((validation) => validation.warnings);

  return {
    schema,
    parsedRows,
    rows: normalizedRows,
    personas,
    summary: {
      filasDetectadas: parsedRows.length,
      filasExcel: parsedRows.length,
      dniDetectados: rowsWithDni.length,
      dniValidos: validRows.length,
      dniInvalidos: rowsWithDni.filter((row) => !row.dniValido).length,
      dniUnicos: new Set(validRows.map((row) => row.dni)).size,
      personas: new Set(validRows.map((row) => row.dni)).size,
      situacionesExtraidas: situationsCount,
      situacionesEstimadas: situationsCount,
      situacionesValidas: semanticValidations.filter((validation) => validation.valid).length,
      situacionesConWarnings: semanticValidations.filter((validation) => validation.warnings.length > 0).length,
      situacionesInvalidas: semanticValidations.filter((validation) => !validation.valid).length,
      erroresSemanticos: [...new Set(semanticErrors)],
      warningsSemanticos: [...new Set(semanticWarnings)],
      bloquesVaciosDescartados:
        parsedRows.length * schema.blocks.length - situationsCount,
      bloquesReconocidos: schema.blocks.length,
      columnasReconocidas: schema.recognizedColumnCount,
      columnasMapeadas: schema.recognizedColumnCount,
    },
  };
};

const rowForValues = (parsedRow, situation) => ({
  dni: parsedRow.dni,
  apellido: parsedRow.apellido,
  nombre: parsedRow.nombre,
  departamento: parsedRow.departamento,
  ...situation,
});
