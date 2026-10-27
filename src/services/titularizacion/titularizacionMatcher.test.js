import {
  AUTO_CONFIRM_MIN_COVERAGE,
  MATCH_WEIGHTS,
  TOTAL_WEIGHT,
  compareSituations,
  matchSituationsOneToOne,
  parseHours,
} from "./titularizacionMatcher";

const completeSituation = (overrides = {}) => ({
  id: "situacion-1",
  establecimiento: "Escuela 91",
  cargo: "Profesor",
  horas: "3 hs",
  materia: "Matemática",
  nivel: "Secundario",
  cursoAnio: "3° A",
  ...overrides,
});

const row = (recordKey, values) => ({
  recordKey,
  valuesNormalized: values,
});

const exactRow = (recordKey = "fila-1", overrides = {}) =>
  row(recordKey, {
    establecimiento: "Escuela 91",
    cargo: "Profesor",
    horas: "3",
    materia: "Matemática",
    nivel: "Secundario",
    cursoAnio: "3° A",
    ...overrides,
  });

test("1. exacto completo: confirma con cobertura total", () => {
  const result = matchSituationsOneToOne(
    [completeSituation()],
    [exactRow()]
  );
  const situationResult = result.situationResults[0];

  expect(situationResult.similarityScore).toBe(1);
  expect(situationResult.matchScore).toBe(1);
  expect(situationResult.fieldCoverage).toBe(1);
  expect(situationResult.autoConfirmEligible).toBe(true);
  expect(situationResult.matchStatus).toBe("confirmada");
  expect(situationResult.cardinality).toBe("1:1");
});

test("2. exacto pobre: score 1 pero cobertura insuficiente", () => {
  const comparison = compareSituations(completeSituation(), {
    establecimiento: "Escuela 91",
    cargo: "Profesor",
  });
  const result = matchSituationsOneToOne(
    [completeSituation()],
    [row("fila-pobre", { establecimiento: "Escuela 91", cargo: "Profesor" })]
  );

  expect(comparison.similarityScore).toBe(1);
  expect(comparison.fieldCoverage).toBeCloseTo(0.55, 4);
  expect(result.situationResults[0].autoConfirmEligible).toBe(false);
  expect(result.situationResults[0].matchStatus).toBe("revision");
  expect(result.situationResults[0].razones).toContain("cobertura_insuficiente");
});

test("3. una fila rica supera a una fila pobre aunque la pobre tenga score 1", () => {
  const result = matchSituationsOneToOne(
    [completeSituation()],
    [
      exactRow("fila-rica", { materia: "Matematicas" }),
      row("fila-pobre", { establecimiento: "Escuela 91", cargo: "Profesor" }),
    ]
  );

  expect(result.situationResults[0].matchStatus).toBe("confirmada");
  expect(result.situationResults[0].recordKey).toBe("fila-rica");
  expect(result.rowResults.find((item) => item.fila.recordKey === "fila-pobre").matchStatus)
    .toBe("revision");
});

test("4. dos situaciones iguales salvo horas: el discriminador confirma sólo A", () => {
  const result = matchSituationsOneToOne(
    [
      completeSituation({ id: "situacion-A", horas: "3" }),
      completeSituation({ id: "situacion-B", horas: "6" }),
    ],
    [exactRow("fila-3", { horas: "3" })]
  );
  const situationA = result.situationResults.find((item) => item.situacionId === "situacion-A");
  const situationB = result.situationResults.find((item) => item.situacionId === "situacion-B");

  expect(situationA.matchStatus).toBe("confirmada");
  expect(situationA.discriminator.decidingFields || situationA.discriminator.decisiveFields)
    .toContain("horas");
  expect(situationB.matchStatus).toBe("revision");
  expect(situationB.discriminator.satisfied).toBe(false);
});

test("5. sin horas no hay discriminador suficiente", () => {
  const result = matchSituationsOneToOne(
    [
      completeSituation({ id: "situacion-A", horas: "3" }),
      completeSituation({ id: "situacion-B", horas: "6" }),
    ],
    [row("fila-sin-horas", { establecimiento: "Escuela 91", cargo: "Profesor" })]
  );

  expect(result.situationResults.every((item) => item.matchStatus !== "confirmada")).toBe(true);
  expect(result.situationResults.some((item) => item.razones.includes("sin_discriminador_suficiente"))).toBe(true);
});

test("6. una sola situación no requiere discriminador", () => {
  const result = matchSituationsOneToOne(
    [completeSituation()],
    [exactRow()]
  );
  const discriminator = result.situationResults[0].discriminator;

  expect(discriminator.required).toBe(false);
  expect(discriminator.satisfied).toBe(true);
});

test("7. 20 contra 12 + 8 propone revisión 1:N sin confirmar", () => {
  const result = matchSituationsOneToOne(
    [completeSituation({ horas: "20", id: "situacion-20" })],
    [
      exactRow("fila-12", { horas: "12" }),
      exactRow("fila-8", { horas: "8" }),
    ]
  );
  const situationResult = result.situationResults[0];

  expect(situationResult.matchStatus).toBe("revision");
  expect(situationResult.tipoInconsistencia).toBe("revision_agrupamiento");
  expect(situationResult.cardinality).toBe("1:N");
  expect(situationResult.candidateRows).toEqual(["fila-12", "fila-8"]);
  expect(result.rowResults.every((item) => item.matchStatus !== "confirmada")).toBe(true);
});

test("8. 12 + 8 contra 20 propone revisión N:1 sin confirmar", () => {
  const result = matchSituationsOneToOne(
    [
      completeSituation({ id: "situacion-12", horas: "12" }),
      completeSituation({ id: "situacion-8", horas: "8" }),
    ],
    [exactRow("fila-20", { horas: "20" })]
  );

  expect(result.situationResults.every((item) => item.tipoInconsistencia === "revision_desagregacion")).toBe(true);
  expect(result.situationResults.every((item) => item.matchStatus !== "confirmada")).toBe(true);
  expect(result.rowResults[0].tipoInconsistencia).toBe("revision_desagregacion");
  expect(result.rowResults[0].cardinality).toBe("N:1");
});

test("9. el parser no suma texto complejo", () => {
  expect(parseHours("3")).toMatchObject({ simpleNumeric: true, value: 3 });
  expect(parseHours(3)).toMatchObject({ simpleNumeric: true, value: 3 });
  expect(parseHours("03")).toMatchObject({ simpleNumeric: true, value: 3 });
  expect(parseHours("3 hs")).toMatchObject({ simpleNumeric: true, value: 3 });
  expect(parseHours("3 horas")).toMatchObject({ simpleNumeric: true, value: 3 });
  expect(parseHours("12 y 8")).toMatchObject({ simpleNumeric: false, value: null });
  expect(parseHours("12+8")).toMatchObject({ simpleNumeric: false, value: null });
  expect(parseHours("12/8")).toMatchObject({ simpleNumeric: false, value: null });
});

test("10. una fila no se reutiliza para dos confirmaciones", () => {
  const result = matchSituationsOneToOne(
    [
      completeSituation({ id: "situacion-A" }),
      completeSituation({ id: "situacion-B" }),
    ],
    [exactRow("fila-unica")]
  );

  expect(result.rowResults.filter((item) => item.matchStatus === "confirmada")).toHaveLength(0);
  expect(result.situationResults.filter((item) => item.matchStatus === "confirmada")).toHaveLength(0);
});

test("11. score cero se conserva como cero y no como null", () => {
  const comparison = compareSituations(completeSituation(), {
    establecimiento: "Edificio X",
    cargo: "Administrativo",
    horas: "99",
    materia: "Otra materia",
    nivel: "Primario",
    cursoAnio: "7° B",
  });

  expect(comparison.similarityScore).toBe(0);
  expect(comparison.matchScore).toBe(0);
  expect(comparison.matchScore).not.toBeNull();
});

test("12. misma entrada produce salida determinista", () => {
  const situaciones = [
    completeSituation({ id: "situacion-A" }),
    completeSituation({ id: "situacion-B", horas: "6" }),
  ];
  const filas = [exactRow("fila-1"), exactRow("fila-2", { horas: "6" })];

  const first = matchSituationsOneToOne(situaciones, filas);
  const second = matchSituationsOneToOne(situaciones, filas);

  expect(first).toEqual(second);
});

test("regresión: conserva pesos, total y cobertura inicial", () => {
  expect(MATCH_WEIGHTS).toEqual({
    establecimiento: 0.3,
    horas: 0.2,
    cargo: 0.25,
    materia: 0.1,
    nivel: 0.075,
    cursoAnio: 0.075,
  });
  expect(TOTAL_WEIGHT).toBe(1);
  expect(AUTO_CONFIRM_MIN_COVERAGE).toBe(0.7);
});
