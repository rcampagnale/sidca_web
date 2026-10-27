import {
  buildTitularizacionPreview,
  createPreviewSource,
  PREVIEW_RESULT_LABELS,
} from "./titularizacionPreviewService";

const situation = (id, overrides = {}) => ({
  id,
  establecimiento: "Escuela 91",
  cargo: "Profesor",
  horas: "3",
  materia: "Matemática",
  nivel: "Secundario",
  modalidad: "Común",
  cursoAnio: "3° A",
  formularioId: "YHe6DibXG17hi9uST4oG",
  ...overrides,
});

const person = (dni, situaciones, overrides = {}) => ({
  id: dni,
  dni,
  apellido: "Docente",
  nombre: dni,
  situaciones,
  ...overrides,
});

const row = (recordKey, overrides = {}) => ({
  recordKey,
  numeroFila: Number(recordKey.replace(/\D/g, "")) || 2,
  dni: overrides.dni || "29837689",
  valoresNormalizados: {
    dni: "29837689",
    establecimiento: "Escuela 91",
    cargo: "Profesor",
    horas: "3",
    materia: "Matemática",
    nivel: "Secundario",
    modalidad: "Común",
    cursoAnio: "3° A",
    ...overrides,
  },
});

const source = (coverage = "complete") =>
  createPreviewSource({ coverage, fileName: "presentacion.xlsx" });

const previewFor = ({ situations, rows, coverage = "complete", dni = "29837689" }) =>
  buildTitularizacionPreview({
    solicitudData: { personas: [person(dni, situations)] },
    rows,
    source: source(coverage),
  });

test("pipeline 1: match exacto completo produce PRESENTADA SIDCA", () => {
  const preview = previewFor({
    situations: [situation("sol-1")],
    rows: [row("fila-1")],
  });

  expect(preview.metrics.presentadasSidca).toBe(1);
  expect(preview.personas[0].situationResults[0].adminResult).toBe(
    PREVIEW_RESULT_LABELS.PRESENTADA
  );
});

test("pipeline 2: match exacto con cobertura insuficiente queda en revisión", () => {
  const preview = previewFor({
    situations: [situation("sol-1")],
    rows: [row("fila-1", { horas: "", materia: "", nivel: "", modalidad: "", cursoAnio: "" })],
  });

  expect(preview.metrics.requierenRevision).toBe(1);
  expect(preview.personas[0].situationResults[0].adminResult).toBe(
    PREVIEW_RESULT_LABELS.REVISION
  );
});

test("pipeline 3: sin match con fuente complete y en scope produce omisión", () => {
  const preview = previewFor({
    situations: [situation("sol-1")],
    rows: [row("fila-1", { establecimiento: "Otra escuela", cargo: "Otro cargo", horas: "20" })],
  });

  expect(preview.metrics.posiblesOmisionesSidca).toBe(1);
  expect(preview.personas[0].situationResults[0].adminResult).toBe(
    PREVIEW_RESULT_LABELS.POSIBLE_OMISION
  );
});

test.each(["partial", "unknown"])(
  "pipeline 4/5: sin match con fuente %s nunca produce omisión",
  (coverage) => {
    const preview = previewFor({
      coverage,
      situations: [situation("sol-1")],
      rows: [row("fila-1", { establecimiento: "Otra escuela", cargo: "Otro cargo", horas: "20", materia: "Otra materia", nivel: "Otro nivel", cursoAnio: "Otro curso" })],
    });

    expect(preview.metrics.posiblesOmisionesSidca).toBe(0);
    expect(preview.metrics.sinDatoSuficiente).toBe(1);
    expect(preview.personas[0].situationResults[0].adminResult).toBe(
      PREVIEW_RESULT_LABELS.SIN_DATO
    );
  }
);

test("pipeline 6: fila SIDCA sin solicitud compatible queda separada", () => {
  const preview = previewFor({
    situations: [situation("sol-1")],
    rows: [row("fila-1", { dni: "99999999", establecimiento: "Otra escuela", cargo: "Otro cargo", horas: "20", materia: "Otra materia", nivel: "Otro nivel", cursoAnio: "Otro curso" })],
  });

  expect(preview.metrics.presentadasSinSolicitud).toBe(1);
  expect(preview.presentedWithoutRequest[0].row.recordKey).toBe("fila-1");
});

test("pipeline 7: ambigüedad queda en revisión", () => {
  const preview = previewFor({
    situations: [situation("sol-1"), situation("sol-2")],
    rows: [row("fila-1")],
  });

  expect(preview.metrics.requierenRevision).toBeGreaterThan(0);
  expect(preview.personas[0].situationResults.every((item) =>
    item.adminResult !== PREVIEW_RESULT_LABELS.PRESENTADA
  )).toBe(true);
});

test("pipeline 8: 20 contra 12 + 8 produce revisión de agrupamiento", () => {
  const preview = previewFor({
    situations: [situation("sol-20", { horas: "20" })],
    rows: [row("fila-12", { horas: "12" }), row("fila-8", { horas: "8" })],
  });

  expect(preview.metrics.agrupamientosARevisar).toBe(1);
  expect(preview.personas[0].situationResults[0].result.cardinality).toBe("1:N");
  expect(preview.personas[0].situationResults[0].adminResult).toBe(
    PREVIEW_RESULT_LABELS.REVISION
  );
});

test("pipeline 9: 12 + 8 contra 20 produce revisión de desagregación", () => {
  const preview = previewFor({
    situations: [situation("sol-12", { horas: "12" }), situation("sol-8", { horas: "8" })],
    rows: [row("fila-20", { horas: "20" })],
  });

  expect(preview.metrics.desagregacionesARevisar).toBe(2);
  expect(preview.personas[0].situationResults.every((item) => item.result.cardinality === "N:1")).toBe(true);
  expect(preview.personas[0].situationResults.every((item) =>
    item.adminResult === PREVIEW_RESULT_LABELS.REVISION
  )).toBe(true);
});

test("pipeline 10: una persona con 2 presentadas y 1 omisión conserva resumen coherente", () => {
  const preview = previewFor({
    situations: [
      situation("sol-1"),
      situation("sol-2", { horas: "6" }),
      situation("sol-3", { establecimiento: "Otra escuela", cargo: "Otro cargo", horas: "20" }),
    ],
    rows: [row("fila-1"), row("fila-2", { horas: "6" })],
  });

  const [result] = preview.personas;
  expect(result.presentadas).toBe(2);
  expect(result.posiblesOmisiones).toBe(1);
  expect(result.estadoPersona).toBe("CON_OMISIONES");
});

test("las decisiones manuales del preview no escriben ni cambian el modelo base", () => {
  const preview = previewFor({
    situations: [situation("sol-1")],
    rows: [row("fila-1", { establecimiento: "Otra escuela" })],
  });
  const withDecision = buildTitularizacionPreview({
    solicitudData: { personas: [person("29837689", [situation("sol-1")])] },
    rows: [row("fila-1", { establecimiento: "Otra escuela" })],
    source: source("complete"),
    manualDecisions: {
      situations: { "sol-1": { type: "confirm", recordKey: "fila-1" } },
      rows: {},
    },
  });

  expect(preview.previewOnly).toBe(true);
  expect(withDecision.personas[0].situationResults[0].result.manualDecision.type).toBe("confirm");
  expect(withDecision.personas[0].situationResults[0].adminResult).toBe(
    PREVIEW_RESULT_LABELS.PRESENTADA
  );
});

test("clasifica Bdd + Presentación SIDCA como PRESENTADA SIN SOLICITUD ESTRUCTURADA", () => {
  const preview = buildTitularizacionPreview({
    solicitudData: {
      personas: [
        person("38225054", [], {
          apellido: "Ramos",
          nombre: "Sofía Inés",
          tieneSolicitudEstructurada: false,
          fuentesPersona: [{ formularioTitulo: "Consulta carga/documentación" }],
        }),
      ],
    },
    rows: [row("fila-38225054", { dni: "38225054" })],
    source: source("complete"),
  });

  expect(preview.metrics.personasProceso).toBe(1);
  expect(preview.metrics.personasSinSolicitudEstructurada).toBe(1);
  expect(preview.presentedWithoutRequest).toHaveLength(1);
  expect(preview.presentedWithoutRequest[0].classification).toBe(
    PREVIEW_RESULT_LABELS.PRESENTADA_SIN_SOLICITUD
  );
  expect(preview.presentedWithoutRequest[0].nombreCompleto).toBe("Ramos Sofía Inés");
});

test("clasifica una persona YHe sin situación compatible", () => {
  const preview = buildTitularizacionPreview({
    solicitudData: {
      personas: [
        person("30111222", [], { tieneSolicitudEstructurada: true }),
      ],
    },
    rows: [row("fila-yhe", { dni: "30111222" })],
    source: source("complete"),
  });

  expect(preview.presentedWithoutRequest[0].classification).toBe(
    PREVIEW_RESULT_LABELS.PRESENTADA_SIN_SITUACION_COMPATIBLE
  );
});

test("clasifica una presentación sin fuente válida como PRESENTADA SIN ANTECEDENTE", () => {
  const preview = previewFor({
    situations: [],
    rows: [row("fila-sin-antecedente", { dni: "99999999" })],
  });

  expect(preview.presentedWithoutRequest[0].classification).toBe(
    PREVIEW_RESULT_LABELS.PRESENTADA_SIN_ANTECEDENTE
  );
  expect(preview.metrics.presentadasSinAntecedente).toBe(1);
});

test("agrupa tres registros SIDCA por DNI y conserva sus filas", () => {
  const preview = previewFor({
    situations: [],
    rows: [
      row("fila-1", { dni: "29671381" }),
      row("fila-2", { dni: "29671381" }),
      row("fila-3", { dni: "29671381" }),
    ],
    dni: "29671381",
  });

  expect(preview.presentedWithoutRequest).toHaveLength(1);
  expect(preview.presentedWithoutRequest[0].recordCount).toBe(3);
  expect(preview.presentedWithoutRequest[0].records.map((item) => item.row.recordKey)).toEqual([
    "fila-1",
    "fila-2",
    "fila-3",
  ]);
});

test("fixture 38225054 queda registrada en el proceso sin situación YHe", () => {
  const preview = buildTitularizacionPreview({
    solicitudData: {
      personas: [
        person("38225054", [], {
          apellido: "Ramos",
          nombre: "Sofía Inés",
          departamento: "VALLE VIEJO",
          tieneSolicitudEstructurada: false,
          fuentesPersona: [{ formularioTitulo: "Consulta de carga de datos y documentación" }],
        }),
      ],
    },
    rows: [row("fila-994", { dni: "38225054" })],
    source: source("complete"),
  });

  const [presentada] = preview.presentedWithoutRequest;
  expect(presentada.dni).toBe("38225054");
  expect(presentada.antecedenteEnTitularizacion).toBe(true);
  expect(presentada.solicitudEstructurada).toBe(false);
  expect(presentada.classification).toBe(PREVIEW_RESULT_LABELS.PRESENTADA_SIN_SOLICITUD);
  expect(presentada.recordCount).toBe(1);
});
