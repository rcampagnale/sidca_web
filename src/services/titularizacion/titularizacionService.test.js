import {
  buildTitularizacionMetricsForPeople,
  mergeTitularizacionSourceResults,
} from "./titularizacionService";

const source = (sourceId, personas) => ({
  sourceId,
  formularioId: sourceId,
  rol:
    sourceId === "reclamo"
      ? "reclamo"
      : sourceId === "reapertura"
        ? "reapertura"
        : sourceId === "Bdd"
          ? "otra_solicitud"
          : "solicitud_inicial",
  sourceScope: sourceId === "YHe" ? "situation" : "person",
  esSolicitudEstructurada: sourceId === "YHe",
  formulario: { id: sourceId, titulo: sourceId },
  respuestas: personas.map((persona) => ({ id: `${sourceId}-${persona.dni}` })),
  personas,
  metrics: {},
});

const person = (dni, sourceId, situations = 0, invalid = false, overrides = {}) => ({
  id: dni,
  dni,
  apellido: "",
  nombre: "",
  situaciones: Array.from({ length: situations }, (_, index) => ({
    id: `${sourceId}-${dni}-${index + 1}`,
    fingerprint: `${dni}|situacion-${index + 1}`,
    cargo: "cargo",
    horas: "1",
    materia: "materia",
    establecimiento: "establecimiento",
    nivel: "nivel",
    modalidad: "modalidad",
    cursoAnio: "1",
    sourceRefs: [{
      sourceId,
      formularioId: sourceId,
      rol: "solicitud_inicial",
      respuestaId: `${sourceId}-${dni}`,
      indiceRegistro: index + 1,
    }],
  })),
  sourceRefs: [{
    sourceId,
    formularioId: sourceId,
    rol: sourceId === "reclamo" ? "reclamo" : "solicitud_inicial",
    respuestaId: `${sourceId}-${dni}`,
    indiceRegistro: situations ? 1 : null,
  }],
  fuentes: [{ sourceId, formularioId: sourceId, rol: sourceId === "reclamo" ? "reclamo" : "solicitud_inicial" }],
  respuestaIds: [`${sourceId}-${dni}`],
  razonesRevision: invalid ? ["DNI ausente o inválido"] : [],
  sinSituacionEstructurada: situations === 0,
  ...overrides,
});

const initialPeople = () => {
  const people = [];
  for (let index = 0; index < 1090; index += 1) {
    const situations = index < 650 ? 3 : index < 790 ? 2 : 1;
    people.push(person(String(10000000 + index), "YHe", situations));
  }
  people.push(person("123456789", "YHe", 1, true));
  return people;
};

const mergedMetrics = (sourceResults) => {
  const merged = mergeTitularizacionSourceResults(sourceResults);
  return buildTitularizacionMetricsForPeople(
    merged.personas,
    sourceResults.flatMap((sourceResult) => sourceResult.respuestas),
    merged.situacionesDeduplicadas
  );
};

test("A: conserva 1090 personas válidas, 2530 situaciones y un DNI inválido", () => {
  const metrics = mergedMetrics([source("YHe", initialPeople())]);

  expect(metrics.personas).toBe(1090);
  expect(metrics.situacionesCanonicas).toBe(2530);
  expect(metrics.personasRevision).toBe(1);
  expect(metrics.situacionesRevision).toBe(1);
});

test("B: reclamo agrega 87 personas sin situación sin alterar las 2530 canónicas", () => {
  const reclamos = Array.from({ length: 87 }, (_, index) =>
    person(String(20000000 + index), "reclamo", 0)
  );
  const metrics = mergedMetrics([
    source("YHe", initialPeople()),
    source("reclamo", reclamos),
  ]);

  expect(metrics.personas).toBe(1177);
  expect(metrics.situacionesCanonicas).toBe(2530);
  expect(metrics.personasSinSituacionEstructurada).toBe(87);
});

test("C: reapertura suma 205 personas sin situación, sin duplicar situaciones", () => {
  const reclamos = Array.from({ length: 87 }, (_, index) =>
    person(String(20000000 + index), "reclamo", 0)
  );
  const reaperturas = Array.from({ length: 205 }, (_, index) =>
    person(String(30000000 + index), "reapertura", 0)
  );
  const metrics = mergedMetrics([
    source("YHe", initialPeople()),
    source("reclamo", reclamos),
    source("reapertura", reaperturas),
  ]);

  expect(metrics.personas).toBe(1382);
  expect(metrics.situacionesCanonicas).toBe(2530);
  expect(metrics.personasSinSituacionEstructurada).toBe(292);
});

test("D: una actuación sin situación queda como persona y evento, no como situación", () => {
  const reclamo = person("29837689", "reclamo", 0);
  const merged = mergeTitularizacionSourceResults([source("reclamo", [reclamo])]);

  expect(merged.personas).toHaveLength(1);
  expect(merged.personas[0].situaciones).toHaveLength(0);
  expect(merged.personas[0].sourceRefs[0].rol).toBe("reclamo");
});

test("E: Bdd aporta una persona sin fabricar una situación estructurada", () => {
  const merged = mergeTitularizacionSourceResults([
    source("Bdd", [
      person("38225054", "Bdd", 0, false, {
        apellido: "Ramos",
        nombre: "Sofía Inés",
      }),
    ]),
  ]);

  expect(merged.personas).toHaveLength(1);
  expect(merged.personas[0].tieneSolicitudEstructurada).toBe(false);
  expect(merged.personas[0].situaciones).toHaveLength(0);
  expect(merged.personas[0].eventos).toHaveLength(1);
});

test("F: YHe + Bdd consolida una sola persona por DNI y conserva fuentes", () => {
  const merged = mergeTitularizacionSourceResults([
    source("YHe", [person("38225054", "YHe", 1)]),
    source("Bdd", [
      person("38225054", "Bdd", 0, false, { nombre: "Sofía Inés" }),
    ]),
  ]);

  expect(merged.personas).toHaveLength(1);
  expect(merged.personas[0].situaciones).toHaveLength(1);
  expect(merged.personas[0].fuentesPersona).toHaveLength(2);
  expect(merged.personas[0].tieneSolicitudEstructurada).toBe(true);
});

test("G: un valor personal vacío no pisa el valor útil de otra fuente", () => {
  const merged = mergeTitularizacionSourceResults([
    source("YHe", [person("30111222", "YHe", 0, false, { nombre: "Sofía Inés" })]),
    source("Bdd", [person("30111222", "Bdd", 0, false, { nombre: "" })]),
  ]);

  expect(merged.personas[0].nombre).toBe("Sofía Inés");
});

test("H: mismo nombre con DNI diferente conserva dos personas", () => {
  const merged = mergeTitularizacionSourceResults([
    source("Bdd", [
      person("30111222", "Bdd", 0, false, { nombre: "Alex" }),
      person("30111223", "Bdd", 0, false, { nombre: "Alex" }),
    ]),
  ]);

  expect(merged.personas.map((item) => item.dni).sort()).toEqual(["30111222", "30111223"]);
});

test("I: reclamo y reapertura se conservan como eventos de una persona", () => {
  const merged = mergeTitularizacionSourceResults([
    source("reclamo", [person("30111222", "reclamo", 0)]),
    source("reapertura", [person("30111222", "reapertura", 0)]),
  ]);

  expect(merged.personas).toHaveLength(1);
  expect(merged.personas[0].situaciones).toHaveLength(0);
  expect(merged.personas[0].eventos).toHaveLength(2);
});
