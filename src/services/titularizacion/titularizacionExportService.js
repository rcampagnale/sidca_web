import * as XLSX from "xlsx";

const argentinaDate = (date = new Date()) => {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Argentina/Buenos_Aires",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date).reduce((result, part) => {
    result[part.type] = part.value;
    return result;
  }, {});
  return `${parts.year}-${parts.month}-${parts.day}`;
};

const value = (row, key) => row?.[key] || "";

export const buildTitularizacionExportRows = (rows = []) =>
  rows.map((row) => ({
    Apellido: value(row, "apellido"),
    Nombre: value(row, "nombre"),
    DNI: value(row, "dni"),
    Cargo: value(row, "cargo"),
    Materia: value(row, "materia"),
    Horas: value(row, "horas"),
    "Curso/Año": value(row, "cursoAnio"),
    Establecimiento: value(row, "establecimiento"),
    Nivel: value(row, "nivel"),
    Modalidad: value(row, "modalidad"),
    Departamento: value(row, "departamento"),
    "Formulario solicitud": row.formularioSolicitud ? "Sí" : "",
    "Presentado SIDCA": row.presentadoSidca ? "Sí" : "No",
    "Estado Ministerio": "",
    Apto: "",
    "No Apto": "",
    Observado: "",
    Resolución: "",
    "Situación actual": value(row, "estado"),
    "Tipo de inconsistencia": value(row, "tipoInconsistencia"),
    Observación: "",
  }));

export const exportTitularizacionPendientes = (rows = []) => {
  const workbook = XLSX.utils.book_new();
  const sheet = XLSX.utils.json_to_sheet(buildTitularizacionExportRows(rows));
  XLSX.utils.book_append_sheet(workbook, sheet, "Pendientes");
  const fileName = `Titularizacion_Pendientes_SIDCA_${argentinaDate()}.xlsx`;
  XLSX.writeFile(workbook, fileName);
  return { fileName, rows: rows.length };
};

