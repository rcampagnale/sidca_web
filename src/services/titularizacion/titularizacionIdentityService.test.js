import {
  AFILIACION_ESTADOS_TITULARIZACION,
  AFILIACION_SOURCES_TITULARIZACION,
  buildAuxiliaryIdentityIndex,
  enrichTitularizacionPeople,
  mergePersonIdentity,
  resolveTitularizacionAffiliation,
} from "./titularizacionIdentityService";
import { buildVisiblePersonName } from "./titularizacionNormalizer";

const processPerson = (dni, overrides = {}) => ({
  id: dni,
  dni,
  apellido: "",
  nombre: "",
  nombreCompleto: "",
  departamento: "",
  contacto: "",
  email: "",
  situaciones: [],
  fuentesPersona: [],
  searchable: dni,
  ...overrides,
});

const indexFor = ({ usuarios = [], nuevoAfiliado = [] } = {}) =>
  buildAuxiliaryIdentityIndex({ usuarios, nuevoAfiliado });

test("1. persona del proceso en usuarios queda AFILIADO", () => {
  const result = resolveTitularizacionAffiliation(
    indexFor({ usuarios: [{ dni: "30111222" }] }),
    "30111222"
  );
  expect(result).toEqual({
    afiliadoSidca: true,
    estadoAfiliacion: AFILIACION_ESTADOS_TITULARIZACION.AFILIADO,
    afiliacionSource: AFILIACION_SOURCES_TITULARIZACION.USUARIOS,
  });
});

test("2. persona del proceso en nuevoAfiliado queda AFILIADO", () => {
  const result = resolveTitularizacionAffiliation(
    indexFor({ nuevoAfiliado: [{ dni: "30111222" }] }),
    "30111222"
  );
  expect(result.afiliadoSidca).toBe(true);
  expect(result.afiliacionSource).toBe("nuevoAfiliado");
});

test("3. presencia en ambas colecciones conserva origen ambos", () => {
  const result = resolveTitularizacionAffiliation(
    indexFor({ usuarios: [{ dni: "30111222" }], nuevoAfiliado: [{ dni: "30111222" }] }),
    "30111222"
  );
  expect(result.afiliacionSource).toBe("usuarios+nuevoAfiliado");
});

test("4. persona del proceso ausente del padrón queda NO_AFILIADO", () => {
  const result = resolveTitularizacionAffiliation(indexFor(), "30111222");
  expect(result).toEqual({
    afiliadoSidca: false,
    estadoAfiliacion: AFILIACION_ESTADOS_TITULARIZACION.NO_AFILIADO,
    afiliacionSource: "no_encontrado",
  });
});

test("5. un DNI que sólo está en el padrón no crea una persona", () => {
  const result = enrichTitularizacionPeople(
    [processPerson("30111222")],
    { auxiliaryIndex: indexFor({ usuarios: [{ dni: "99999999", nombre: "Ajeno" }] }) }
  );
  expect(result.people).toHaveLength(1);
  expect(result.people[0].dni).toBe("30111222");
});

test("6. persona sólo en Reclamo completa su nombre desde usuarios", () => {
  const result = enrichTitularizacionPeople(
    [processPerson("30111222", { fuentesPersona: [{ formularioId: "reclamo" }] })],
    { auxiliaryIndex: indexFor({ usuarios: [{ dni: "30111222", nombre: "María" }] }) }
  );
  expect(result.people[0].nombre).toBe("María");
  expect(result.people[0].identitySources.some((item) => item.sourceType === "usuarios")).toBe(true);
});

test("7. nombre válido YHe no es pisado por nombre vacío Bdd", () => {
  const merged = mergePersonIdentity(
    processPerson("30111222", { nombre: "Sofía Inés" }),
    { sourceType: "Bdd", nombre: "" }
  );
  expect(merged.nombre).toBe("Sofía Inés");
});

test("8. una identidad de Excel completa un nombre ausente", () => {
  const result = enrichTitularizacionPeople(
    [processPerson("30111222")],
    { auxiliaryIndex: indexFor() }
  );
  const withExcel = mergePersonIdentity(result.people[0], {
    sourceType: "Excel workspace",
    apellido: "Ramos",
    nombre: "Sofía Inés",
  });
  expect(withExcel.nombreCompleto).toBe("Ramos Sofía Inés");
});

test("9. nombres distintos preservan conflicto y el valor más completo para display", () => {
  const merged = mergePersonIdentity(
    processPerson("30111222", { nombre: "Sofía I." }),
    { sourceType: "usuarios", nombre: "Sofía Inés" }
  );
  expect(merged.nombre).toBe("Sofía Inés");
  expect(merged.identityConflicts[0].field).toBe("nombre");
  expect(merged.identityConflicts[0].values).toHaveLength(2);
});

test("10. una persona sin situación conserva identidad enriquecida", () => {
  const result = enrichTitularizacionPeople(
    [processPerson("30111222")],
    { auxiliaryIndex: indexFor({ usuarios: [{ dni: "30111222", apellido: "Ramos", nombre: "Sofía" }] }) }
  );
  expect(result.people[0].situaciones).toHaveLength(0);
  expect(result.people[0].apellido).toBe("Ramos");
  expect(result.people[0].nombre).toBe("Sofía");
});

test("11. NO_AFILIADO conserva situaciones existentes", () => {
  const situaciones = [{ id: "sit-1", cargo: "Profesor" }];
  const result = enrichTitularizacionPeople(
    [processPerson("30111222", { situaciones })],
    { auxiliaryIndex: indexFor() }
  );
  expect(result.people[0].afiliadoSidca).toBe(false);
  expect(result.people[0].situaciones).toEqual(situaciones);
});

test("12. afiliación es metadata y no cambia campos de situación", () => {
  const situation = { id: "sit-1", cargo: "Profesor", matchStatus: "confirmada" };
  const result = enrichTitularizacionPeople(
    [processPerson("30111222", { situaciones: [situation] })],
    { auxiliaryIndex: indexFor({ usuarios: [{ dni: "30111222" }] }) }
  );
  expect(result.people[0].situaciones[0]).toEqual(situation);
});

test("13. búsqueda usa la identidad enriquecida", () => {
  const result = enrichTitularizacionPeople(
    [processPerson("30111222")],
    { auxiliaryIndex: indexFor({ usuarios: [{ dni: "30111222", apellido: "Ramos", nombre: "Sofía" }] }) }
  );
  expect(result.people[0].searchable).toContain("ramos");
  expect(result.people[0].searchable).toContain("sofia");
});

test("14. el padrón no altera la cantidad de personas del proceso", () => {
  const people = [processPerson("30111222"), processPerson("30111223")];
  const result = enrichTitularizacionPeople(
    people,
    { auxiliaryIndex: indexFor({ usuarios: [{ dni: "30111222" }, { dni: "99999999" }] }) }
  );
  expect(result.diagnostics.cantidadAntes).toBe(2);
  expect(result.diagnostics.cantidadDespues).toBe(2);
});

test("15. no duplica un apellido repetido al inicio del nombre", () => {
  expect(buildVisiblePersonName({
    apellido: "SEGOBIA",
    nombre: "Segobia, Celmira Elena",
  })).toBe("SEGOBIA Celmira Elena");
});

test("16. evita duplicar PACHADO y elimina la coma sólo en la presentación", () => {
  expect(buildVisiblePersonName({
    apellido: "PACHADO",
    nombre: "Pachado, Julio Alberto",
  })).toBe("PACHADO Julio Alberto");
});

test("17. conserva apellido y nombre separados cuando no hay repetición", () => {
  expect(buildVisiblePersonName({
    apellido: "RAMOS",
    nombre: "Sofía Inés",
  })).toBe("RAMOS Sofía Inés");
});

test("18. usa el nombre completo cuando falta el apellido", () => {
  expect(buildVisiblePersonName({
    nombreCompleto: "Celmira Elena",
  })).toBe("Celmira Elena");
});

test("19. conserva el apellido cuando falta el nombre", () => {
  expect(buildVisiblePersonName({ apellido: "PACHADO", nombreCompleto: "PACHADO" }))
    .toBe("PACHADO");
});

test("20. compara sin acentos, mayúsculas ni puntuación y no hace fuzzy matching", () => {
  expect(buildVisiblePersonName({
    apellido: "GÓMEZ",
    nombre: "gomez, Ana",
  })).toBe("GÓMEZ Ana");
  expect(buildVisiblePersonName({
    apellido: "GÓMEZ",
    nombre: "Gómezana, Ana",
  })).toBe("GÓMEZ Gómezana Ana");
});

test("21. el helper visible no modifica procedencia ni conflictos", () => {
  const person = processPerson("30111222", {
    apellido: "SEGOBIA",
    nombre: "Segobia, Celmira Elena",
    identitySources: [{ sourceType: "YHe", fields: ["apellido", "nombre"] }],
    identityConflicts: [{
      field: "nombre",
      values: [{ value: "Celmira", source: "YHe" }],
    }],
  });
  const identitySources = JSON.parse(JSON.stringify(person.identitySources));
  const identityConflicts = JSON.parse(JSON.stringify(person.identityConflicts));

  expect(buildVisiblePersonName(person)).toBe("SEGOBIA Celmira Elena");
  expect(person.identitySources).toEqual(identitySources);
  expect(person.identityConflicts).toEqual(identityConflicts);
});
