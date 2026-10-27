import { isValidDni, normalizeDni, normalizeSearchText, textValue } from "./titularizacionNormalizer";
import { readTitularizacionPdf } from "./titularizacionPdfService";

const SOURCE_TYPE = "RESOLUCION";
const STAGE = "resolucion";
const ASSERTION = "titularizada";

const FIELD_ALIASES = {
  dni: ["dni", "documento", "documentoidentidad"],
  apellidoNombre: ["apellidoynombre", "apellidonombres", "apellidonombre", "docente"],
  apellido: ["apellido"],
  nombre: ["nombre", "nombres"],
  idPlaza: ["idplaza", "plaza", "numeroplaza", "nroplaza"],
  cargo: ["cargo", "funcion"],
  horas: ["horas", "horascatedra", "hs"],
  materia: ["materia", "espacio", "espaciocurricular"],
  establecimiento: ["establecimiento", "escuela"],
  organismo: ["organismo", "organismoestablecimiento"],
  nivel: ["nivel"],
  departamento: ["departamento"],
  cursoAnio: ["cursoanio", "cursoano", "anio", "ano", "aniolectivo"],
  division: ["division", "div"],
};

const cleanHeader = (value) => normalizeSearchText(value).replace(/[^a-z0-9]+/g, "");

const fieldForHeader = (header) => {
  const normalized = cleanHeader(header);
  return Object.entries(FIELD_ALIASES).find(([, aliases]) => aliases.includes(normalized))?.[0] || null;
};

const splitDelimitedLine = (line) => {
  const delimiter = line.includes("|") ? "|" : line.includes("\t") ? "\t" : line.includes(";") ? ";" : null;
  if (!delimiter) return null;
  return line.split(delimiter).map((cell) => cell.trim());
};

const resolutionNumberFor = (text) =>
  text.match(/RESGE[-\s]?\d{4}[-\s]?\d+[-\s]?E[-\s]?[A-Z-]+/i)?.[0]
    ?.replace(/\s+/g, "-") ||
  text.match(/RESOLUCI[ÓO]N[^\n]{0,40}/i)?.[0]?.trim() ||
  "";

const dateFor = (text) => text.match(/\b\d{1,2}[/-]\d{1,2}[/-]\d{2,4}\b/)?.[0] || "";

const anexoFor = (text) => text.match(/ANEXO\s*(?:N[º°O.]?\s*)?([IVXLCDM]+|\d+)/i)?.[1] || "";

const idPlazaFor = (value) => {
  const original = textValue(value).trim();
  const idPlaza = original.match(/\d{3,}/)?.[0] || "";
  return { idPlaza, idPlazaOriginal: original };
};

const namePartsFor = (apellidoNombre, apellido, nombre) => {
  const separateApellido = textValue(apellido).trim();
  const separateNombre = textValue(nombre).trim();
  if (separateApellido || separateNombre) {
    return { apellido: separateApellido, nombre: separateNombre };
  }
  const combined = textValue(apellidoNombre).trim();
  if (!combined) return { apellido: "", nombre: "" };
  if (combined.includes(",")) {
    const [lastName, ...rest] = combined.split(",");
    return { apellido: lastName.trim(), nombre: rest.join(",").trim() };
  }
  const [first, ...rest] = combined.split(/\s+/);
  return { apellido: first || "", nombre: rest.join(" ") };
};

const valueFromCells = (cells, headers, field) => {
  const index = headers.findIndex((header) => fieldForHeader(header) === field);
  return index >= 0 ? cells[index] || "" : "";
};

const fieldOriginFor = (cells, headers, field) => {
  const index = headers.findIndex((header) => fieldForHeader(header) === field);
  return {
    source: index >= 0 ? "header-cell" : "none",
    header: index >= 0 ? headers[index] : null,
    columnIndex: index >= 0 ? index : null,
    rawValue: index >= 0 ? cells[index] || "" : "",
  };
};

const numericCandidatesFor = (value) => [
  ...String(value || "").matchAll(/\b\d{7,8}\b/g),
].map((match) => match[0]);

const dniAnalysisFor = ({ cells, headers, textOriginal }) => {
  const dniHeaderIndex = headers.findIndex((header) => fieldForHeader(header) === "dni");
  const headerValue = dniHeaderIndex >= 0 ? String(cells[dniHeaderIndex] || "").trim() : "";
  const headerDigits = normalizeDni(headerValue);
  const uniqueCandidates = [...new Set(numericCandidatesFor(textOriginal))];
  const leadingZeros = (value) => /^0/.test(String(value || ""));

  if (dniHeaderIndex >= 0 && headerValue) {
    if (isValidDni(headerDigits)) {
      return {
        dni: headerDigits,
        dniCandidate: headerValue,
        dniCandidates: [headerValue],
        dniConfidence: "high",
        diagnostic: {
          status: "confiable",
          accepted: true,
          context: "columna_dni",
          reason: "valor_extraido_de_columna_dni",
          digits: headerDigits.length,
          leadingZeros: leadingZeros(headerValue),
        },
      };
    }
    return {
      dni: "",
      dniCandidate: headerValue,
      dniCandidates: [headerValue],
      dniConfidence: "low",
      diagnostic: {
        status: "sospechoso",
        accepted: false,
        context: "columna_dni",
        reason: "valor_en_columna_dni_no_valido",
        digits: headerDigits.length,
        leadingZeros: leadingZeros(headerValue),
      },
    };
  }

  const explicitMatch = String(textOriginal || "").match(
    /\b(?:DNI|DOCUMENTO(?:\s+DE\s+IDENTIDAD)?|N[ÚU]MERO\s+DE\s+DOCUMENTO)\b\s*[:#-]?\s*([0-9][0-9 .-]{6,})/i
  );
  const explicitValue = explicitMatch?.[1] || "";
  const explicitDigits = normalizeDni(explicitValue);
  if (explicitValue && isValidDni(explicitDigits)) {
    return {
      dni: explicitDigits,
      dniCandidate: explicitValue.trim(),
      dniCandidates: [explicitValue.trim()],
      dniConfidence: "medium",
      diagnostic: {
        status: "confiable",
        accepted: true,
        context: "etiqueta_dni",
        reason: "valor_cercano_a_etiqueta_dni",
        digits: explicitDigits.length,
        leadingZeros: leadingZeros(explicitValue),
      },
    };
  }

  if (uniqueCandidates.length === 1) {
    const candidate = uniqueCandidates[0];
    return {
      dni: "",
      dniCandidate: candidate,
      dniCandidates: uniqueCandidates,
      dniConfidence: "low",
      diagnostic: {
        status: "sospechoso",
        accepted: false,
        context: "numero_sin_contexto_dni",
        reason: "numero_de_7_8_digitos_sin_columna_ni_etiqueta_dni",
        digits: candidate.length,
        leadingZeros: leadingZeros(candidate),
      },
    };
  }

  if (uniqueCandidates.length > 1) {
    return {
      dni: "",
      dniCandidate: "",
      dniCandidates: uniqueCandidates,
      dniConfidence: "low",
      diagnostic: {
        status: "sospechoso",
        accepted: false,
        context: "multiples_numeros_candidatos",
        reason: "hay_mas_de_un_numero_de_7_8_digitos_y_no_hay_contexto_dni",
        digits: null,
        leadingZeros: uniqueCandidates.some(leadingZeros),
      },
    };
  }

  return {
    dni: "",
    dniCandidate: "",
    dniCandidates: [],
    dniConfidence: "none",
    diagnostic: {
      status: "ausente",
      accepted: false,
      context: "sin_candidato",
      reason: "no_se_detecto_numero_candidato",
      digits: null,
      leadingZeros: false,
    },
  };
};

const auditClassificationFor = ({ dniAnalysis, apellido, nombre, idPlaza, cargo }) => {
  if (dniAnalysis.dniConfidence === "low" && dniAnalysis.dniCandidate) return "DNI SOSPECHOSO";
  if (dniAnalysis.dniConfidence === "none") return "SIN DNI";
  const hasName = Boolean(textValue(apellido).trim() || textValue(nombre).trim());
  const hasCargo = Boolean(textValue(cargo).trim());
  const hasPlaza = Boolean(textValue(idPlaza).trim());
  if (hasName && hasCargo && hasPlaza) return "COMPLETO";
  if (!hasName && !hasCargo && !hasPlaza) return "SOLO DNI";
  return "PARCIAL";
};

const tokensFor = (text) => String(text || "").trim().split(/\s+/).filter(Boolean);

const recordFor = ({ cells, headers, textOriginal, fileName, pageNumber, anexo, rowIndex, lineNumber, resolutionNumber, resolutionDate }) => {
  const rawRecord = {
    cells,
    headers,
    textOriginal,
    tokensOriginales: tokensFor(textOriginal),
    lineNumber,
  };
  const dniAnalysis = dniAnalysisFor({ cells, headers, textOriginal });
  const dniOriginal = dniAnalysis.dniCandidate || "";
  const dni = dniAnalysis.dni;
  const idPlazaRaw = valueFromCells(cells, headers, "idPlaza") || textOriginal.match(/(?:ID\s*PLAZA|PLAZA)\s*[:#-]?\s*(\d+)/i)?.[1] || "";
  const plaza = idPlazaFor(idPlazaRaw);
  const name = namePartsFor(
    valueFromCells(cells, headers, "apellidoNombre"),
    valueFromCells(cells, headers, "apellido"),
    valueFromCells(cells, headers, "nombre")
  );
  const fields = {
    dni,
    apellido: name.apellido,
    nombre: name.nombre,
    idPlaza: plaza.idPlaza,
    cargo: valueFromCells(cells, headers, "cargo"),
    horas: valueFromCells(cells, headers, "horas"),
    materia: valueFromCells(cells, headers, "materia"),
    establecimiento: valueFromCells(cells, headers, "establecimiento"),
    organismo: valueFromCells(cells, headers, "organismo"),
    nivel: valueFromCells(cells, headers, "nivel"),
    departamento: valueFromCells(cells, headers, "departamento"),
    cursoAnio: valueFromCells(cells, headers, "cursoAnio"),
    division: valueFromCells(cells, headers, "division"),
  };
  const fieldOrigins = {
    dni: dniAnalysis.diagnostic,
    idPlaza: { ...fieldOriginFor(cells, headers, "idPlaza"), rawValue: idPlazaRaw },
    apellidoNombre: fieldOriginFor(cells, headers, "apellidoNombre"),
    cargo: fieldOriginFor(cells, headers, "cargo"),
  };
  return {
    recordKey: `${fileName}::pagina_${pageNumber}::fila_${rowIndex}`,
    workspaceSourceId: null,
    sourceType: SOURCE_TYPE,
    stage: STAGE,
    afirma: ASSERTION,
    fileName,
    resolucionNumero: resolutionNumber,
    resolucionFecha: resolutionDate,
    anexo,
    pageNumber,
    rowIndex,
    sourceSheetName: `Página ${pageNumber}`,
    sourceSheetIndex: pageNumber - 1,
    sourceRowNumber: rowIndex + 1,
    dniOriginal,
    idPlazaOriginal: plaza.idPlazaOriginal,
    ...fields,
    externalIds: plaza.idPlaza ? { ministryPlazaId: plaza.idPlaza } : {},
    rawRecord,
    valoresOriginales: rawRecord,
    textOriginal,
    rawText: textOriginal,
    tokensOriginales: tokensFor(textOriginal),
    lineNumber,
    dniCandidate: dniAnalysis.dniCandidate,
    dniCandidates: dniAnalysis.dniCandidates,
    dniConfidence: dniAnalysis.dniConfidence,
    dniDiagnostic: dniAnalysis.diagnostic,
    pdfRecordStatus: auditClassificationFor({
      dniAnalysis,
      apellido: name.apellido,
      nombre: name.nombre,
      idPlaza: plaza.idPlaza,
      cargo: fields.cargo,
    }),
    valoresNormalizados: {
      ...fields,
      dni,
    },
    provenance: {
      fileName,
      pageNumber,
      anexo,
      rowIndex,
      lineNumber,
      fieldOrigins,
    },
    evidence: {
      etapa: STAGE,
      afirma: ASSERTION,
      sourceId: null,
      workspaceSourceId: null,
      dni,
      idPlaza: plaza.idPlaza,
      resolucionNumero: resolutionNumber,
      resolucionFecha: resolutionDate,
      pageNumber,
      anexo,
      valoresOriginales: rawRecord,
      dniCandidate: dniAnalysis.dniCandidate,
      dniConfidence: dniAnalysis.dniConfidence,
      dniDiagnostic: dniAnalysis.diagnostic,
      provenance: {
        fileName,
        pageNumber,
        anexo,
        rowIndex,
        lineNumber,
        fieldOrigins,
      },
    },
  };
};

const rowsFromPage = ({ page, fileName, resolutionNumber, resolutionDate }) => {
  const lines = String(page.text || "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  const headerIndex = lines.findIndex((line) => {
    const normalized = cleanHeader(line);
    return !/\b\d{7,8}\b/.test(line) &&
      normalized.includes("dni") &&
      (normalized.includes("idplaza") || normalized.includes("plaza"));
  });
  const headerCells = headerIndex >= 0 ? splitDelimitedLine(lines[headerIndex]) : null;
  const headers = headerCells || [];
  const candidateStart = headerIndex >= 0 ? headerIndex + 1 : 0;
  const candidateLines = lines.slice(candidateStart);
  const rows = [];
  candidateLines.forEach((line, index) => {
    if (/^(RESGE|RESOLUCI[ÓO]N|ANEXO|MINISTERIO|P[ÁA]GINA)\b/i.test(line)) return;
    const cells = splitDelimitedLine(line);
    const hasNumberCandidate = /\b\d{7,8}\b/.test(line);
    const hasPlaza = /(?:ID\s*PLAZA|PLAZA)\s*[:#-]?\s*\d{3,}/i.test(line) || Boolean(cells?.some((cell) => /^\d{3,}$/.test(cell)));
    if (!hasNumberCandidate && !hasPlaza) return;
    const rowHeaders = cells && headers.length ? headers : [];
    rows.push(recordFor({
      cells: cells || [line],
      headers: rowHeaders,
      textOriginal: line,
      fileName,
      pageNumber: page.pageNumber,
      anexo: anexoFor(page.text),
      rowIndex: index + 1,
      lineNumber: candidateStart + index + 1,
      resolutionNumber,
      resolutionDate,
    }));
  });
  return rows;
};

export const parseTitularizacionResolutionPdfPages = ({ pages = [], fileName = "resolucion.pdf" } = {}) => {
  const firstText = pages.map((page) => page.text || "").join(" ");
  const resolutionNumber = resolutionNumberFor(firstText);
  const resolutionDate = dateFor(firstText);
  const parsedPages = pages.map((page) => ({
    ...page,
    anexo: anexoFor(page.text),
    rows: rowsFromPage({ page, fileName, resolutionNumber, resolutionDate }),
  }));
  const rows = parsedPages.flatMap((page) => page.rows);
  const reliableRows = rows.filter((row) => row.dniConfidence === "high" || row.dniConfidence === "medium");
  const rowsWithName = rows.filter((row) => Boolean(textValue(row.apellido).trim() || textValue(row.nombre).trim()));
  const rowsWithCargo = rows.filter((row) => Boolean(textValue(row.cargo).trim()));
  const rowsWithPlaza = rows.filter((row) => Boolean(textValue(row.idPlaza).trim()));
  return {
    fileName,
    sourceType: SOURCE_TYPE,
    stage: STAGE,
    afirma: ASSERTION,
    coverage: "unknown",
    resolutionNumber,
    resolutionDate,
    pages: parsedPages,
    rows,
    pageCount: pages.length,
    textPages: pages.filter((page) => page.hasText).length,
    emptyPages: pages.filter((page) => !page.hasText).map((page) => page.pageNumber),
    possibleScanned: pages.some((page) => !page.hasText),
    summary: {
      pageCount: pages.length,
      textPages: pages.filter((page) => page.hasText).length,
      emptyPages: pages.filter((page) => !page.hasText).map((page) => page.pageNumber),
      possibleScanned: pages.some((page) => !page.hasText),
      registrosResolucion: rows.length,
      dniValidos: rows.filter((row) => isValidDni(row.dni)).length,
      personas: new Set(rows.filter((row) => isValidDni(row.dni)).map((row) => row.dni)).size,
      registrosDniConfiables: reliableRows.length,
      registrosDniSospechosos: rows.filter((row) => row.dniConfidence === "low").length,
      registrosSinDni: rows.filter((row) => row.dniConfidence === "none").length,
      registrosConNombre: rowsWithName.length,
      registrosConCargo: rowsWithCargo.length,
      registrosConIdPlaza: rowsWithPlaza.length,
      registrosCompletos: rows.filter((row) => row.pdfRecordStatus === "COMPLETO").length,
      registrosParciales: rows.filter((row) => row.pdfRecordStatus === "PARCIAL").length,
      dniUnicosConfiables: new Set(reliableRows.map((row) => row.dni).filter(isValidDni)).size,
    },
  };
};

export const prepareTitularizacionResolutionPdf = async (file, onProgress) => {
  const pdf = await readTitularizacionPdf(file, onProgress);
  const parsed = parseTitularizacionResolutionPdfPages({ pages: pdf.pages, fileName: file?.name });
  const sheets = parsed.pages.map((page) => ({
    sheetIndex: page.pageNumber - 1,
    sheetName: `Página ${page.pageNumber}`,
    pageNumber: page.pageNumber,
    filas: page.rows.map((row) => row.rawRecord),
    rows: page.rows,
    rowCount: page.rows.length,
    status: page.hasText ? "PDF_TEXT" : "PDF_SIN_TEXTO",
    selectable: true,
  }));
  return {
    file,
    fileName: file?.name || parsed.fileName,
    documentKind: "pdf",
    parserMode: "resolution-pdf",
    sourceType: parsed.sourceType,
    stage: parsed.stage,
    afirma: parsed.afirma,
    coverage: parsed.coverage,
    parsed: { columnas: [], encabezadosDuplicados: [] },
    sheets,
    sheetNames: sheets.map((sheet) => sheet.sheetName),
    selectedSheetIndexes: sheets.map((sheet) => sheet.sheetIndex),
    compatibleSheetIndexes: sheets.map((sheet) => sheet.sheetIndex),
    rows: parsed.rows,
    summary: parsed.summary,
    resolutionNumber: parsed.resolutionNumber,
    resolutionDate: parsed.resolutionDate,
    pdfMetadata: {
      pageCount: parsed.pageCount,
      textPages: parsed.textPages,
      emptyPages: parsed.emptyPages,
      possibleScanned: parsed.possibleScanned,
    },
    validation: {
      valid: true,
      errors: [],
      warnings: parsed.possibleScanned
        ? parsed.emptyPages.map((pageNumber) => `Página ${pageNumber} sin texto digital. Puede requerir OCR.`)
        : [],
    },
    structureValid: true,
  };
};
