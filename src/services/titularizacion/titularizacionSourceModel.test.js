import {
  SOURCE_ABSENCE_STATUS,
  SOURCE_COVERAGE,
  SOURCE_SCOPE,
  SOURCE_STAGE,
  TITULARIZACION_SOURCE_SUGGESTIONS,
  canInferAbsenceFromSource,
  classifySituationAgainstSource,
  createSourceDefinition,
  evaluateSourceAbsence,
  isSituationInSourceScope,
  resolveActiveSources,
  validateSourceDefinition,
} from "./titularizacionSourceModel";

const situationSource = (overrides = {}) =>
  createSourceDefinition({
    sourceId: "aptos",
    nombre: "Aptos",
    stage: SOURCE_STAGE.MINISTERIO,
    sourceScope: SOURCE_SCOPE.SITUATION,
    ...overrides,
  });

describe("titularizacionSourceModel", () => {
  test("1. coverage unknown sin evidencia produce no_data", () => {
    expect(
      evaluateSourceAbsence({
        source: situationSource(),
        situation: { nivel: "Secundario" },
      })
    ).toBe(SOURCE_ABSENCE_STATUS.NO_DATA);
  });

  test("2. coverage partial sin evidencia produce no_data", () => {
    expect(
      evaluateSourceAbsence({
        source: situationSource({ coverage: SOURCE_COVERAGE.PARTIAL }),
        situation: { nivel: "Secundario" },
      })
    ).toBe(SOURCE_ABSENCE_STATUS.NO_DATA);
  });

  test("3. complete sin restricciones permite possible_omission", () => {
    const source = situationSource({
      coverage: SOURCE_COVERAGE.COMPLETE,
      scope: {
        niveles: null,
        departamentos: null,
      },
    });
    expect(evaluateSourceAbsence({ source, situation: { nivel: "Primario" } })).toBe(
      SOURCE_ABSENCE_STATUS.POSSIBLE_OMISSION
    );
  });

  test("4. complete con nivel Secundario incluye situación Secundario", () => {
    const source = situationSource({
      coverage: SOURCE_COVERAGE.COMPLETE,
      scope: { niveles: ["SECUNDARIO"] },
    });
    expect(
      isSituationInSourceScope({ nivel: "secundário" }, source).inScope
    ).toBe(true);
    expect(evaluateSourceAbsence({ source, situation: { nivel: "Secundario" } })).toBe(
      SOURCE_ABSENCE_STATUS.POSSIBLE_OMISSION
    );
  });

  test("5. complete con nivel Secundario excluye Primario", () => {
    const source = situationSource({
      coverage: SOURCE_COVERAGE.COMPLETE,
      scope: { niveles: ["Secundario"] },
    });
    expect(evaluateSourceAbsence({ source, situation: { nivel: "Primario" } })).toBe(
      SOURCE_ABSENCE_STATUS.OUT_OF_SCOPE
    );
  });

  test("6. nivel vacío produce unknown_scope, nunca omisión", () => {
    const source = situationSource({
      coverage: SOURCE_COVERAGE.COMPLETE,
      scope: { niveles: ["Secundario"] },
    });
    expect(evaluateSourceAbsence({ source, situation: { nivel: "" } })).toBe(
      SOURCE_ABSENCE_STATUS.UNKNOWN_SCOPE
    );
    expect(canInferAbsenceFromSource(source, { nivel: "" }).canInfer).toBe(false);
  });

  test("7. nivel Secundario y departamento Capital deben coincidir ambos", () => {
    const source = situationSource({
      coverage: SOURCE_COVERAGE.COMPLETE,
      scope: {
        niveles: ["Secundario"],
        departamentos: ["Capital"],
      },
    });
    expect(
      evaluateSourceAbsence({
        source,
        situation: { nivel: "Secundario", departamento: "Capital" },
      })
    ).toBe(SOURCE_ABSENCE_STATUS.POSSIBLE_OMISSION);
  });

  test("8. nivel coincide pero departamento distinto queda fuera de scope", () => {
    const source = situationSource({
      coverage: SOURCE_COVERAGE.COMPLETE,
      scope: {
        niveles: ["Secundario"],
        departamentos: ["Capital"],
      },
    });
    expect(
      evaluateSourceAbsence({
        source,
        situation: { nivel: "Secundario", departamento: "Valle Viejo" },
      })
    ).toBe(SOURCE_ABSENCE_STATUS.OUT_OF_SCOPE);
  });

  test("9. nivel desconocido y departamento coincidente produce unknown_scope", () => {
    const source = situationSource({
      coverage: SOURCE_COVERAGE.COMPLETE,
      scope: {
        niveles: ["Secundario"],
        departamentos: ["Capital"],
      },
    });
    expect(
      evaluateSourceAbsence({
        source,
        situation: { nivel: "", departamento: "Capital" },
      })
    ).toBe(SOURCE_ABSENCE_STATUS.UNKNOWN_SCOPE);
  });

  test("10. evidencia encontrada siempre es present y un match se clasifica matched", () => {
    const source = situationSource({ coverage: SOURCE_COVERAGE.UNKNOWN });
    expect(
      evaluateSourceAbsence({ source, situation: {}, evidenceFound: true })
    ).toBe(SOURCE_ABSENCE_STATUS.PRESENT);
    expect(
      classifySituationAgainstSource({
        source,
        situation: {},
        matchResult: { matchStatus: "confirmada" },
      })
    ).toBe("matched");
  });

  test("11. fuente no vigente no permite inferir omisión", () => {
    const source = situationSource({
      coverage: SOURCE_COVERAGE.COMPLETE,
      vigente: false,
      scope: { niveles: ["Secundario"] },
    });
    expect(canInferAbsenceFromSource(source, { nivel: "Secundario" }).canInfer).toBe(
      false
    );
    expect(evaluateSourceAbsence({ source, situation: { nivel: "Secundario" } })).toBe(
      SOURCE_ABSENCE_STATUS.NO_DATA
    );
  });

  test("12. una versión vigente que supersede v1 resuelve v2 y conserva v1 para auditoría", () => {
    const v1 = situationSource({
      sourceId: "ministerio-v1",
      version: 1,
      vigente: false,
    });
    const v2 = situationSource({
      sourceId: "ministerio-v2",
      version: 2,
      supersedes: "ministerio-v1",
      vigente: true,
    });
    expect(resolveActiveSources([v1, v2]).map((source) => source.sourceId)).toEqual([
      "ministerio-v2",
    ]);
    expect(v1.version).toBe(1);
  });

  test("13. la vigencia explícita prevalece sobre fechas iguales y no se usa última fecha gana", () => {
    const v1 = situationSource({
      sourceId: "ministerio-v1",
      version: 1,
      vigente: false,
      sourceDate: "2026-01-01",
    });
    const v2 = situationSource({
      sourceId: "ministerio-v2",
      version: 2,
      supersedes: "ministerio-v1",
      vigente: true,
      sourceDate: "2026-01-01",
    });
    expect(resolveActiveSources([v1, v2]).map((source) => source.sourceId)).toEqual([
      "ministerio-v2",
    ]);
  });

  test("14. una fuente nueva nace con coverage unknown", () => {
    expect(
      createSourceDefinition({
        sourceId: "nueva",
        stage: SOURCE_STAGE.SOLICITUD,
        sourceScope: SOURCE_SCOPE.SITUATION,
      }).coverage
    ).toBe(SOURCE_COVERAGE.UNKNOWN);
  });

  test("15. null no restringe y un array vacío es error de validación", () => {
    const unrestricted = situationSource({ scope: { niveles: null } });
    expect(isSituationInSourceScope({ nivel: "Primario" }, unrestricted).inScope).toBe(
      true
    );

    const invalid = situationSource({ scope: { niveles: [] } });
    expect(validateSourceDefinition(invalid).valid).toBe(false);
    expect(validateSourceDefinition(invalid).errors).toContain(
      "niveles_no_puede_ser_array_vacio"
    );
  });

  test("16. periodo desde mayor que hasta es inválido", () => {
    const result = validateSourceDefinition(
      situationSource({
        scope: {
          periodo: { desde: "2026-12-31", hasta: "2026-01-01" },
        },
      })
    );
    expect(result.valid).toBe(false);
    expect(result.errors).toContain("periodo_desde_mayor_que_hasta");
  });

  test("17. una fuente PERSON no participa en ausencia de situación", () => {
    const source = createSourceDefinition({
      sourceId: "reclamo",
      stage: SOURCE_STAGE.SOLICITUD,
      sourceScope: SOURCE_SCOPE.PERSON,
      coverage: SOURCE_COVERAGE.COMPLETE,
    });
    expect(canInferAbsenceFromSource(source, { nivel: "Secundario" }).canInfer).toBe(
      false
    );
    expect(evaluateSourceAbsence({ source, situation: { nivel: "Secundario" } })).toBe(
      SOURCE_ABSENCE_STATUS.NO_DATA
    );
  });

  test("18. una fuente SITUATION sí puede evaluarse", () => {
    const source = situationSource({
      coverage: SOURCE_COVERAGE.COMPLETE,
      scope: { niveles: ["Secundario"] },
    });
    const result = canInferAbsenceFromSource(source, { nivel: "Secundario" });
    expect(result.canInfer).toBe(true);
    expect(result.scopeEvaluation.inScope).toBe(true);
  });

  test("19. MIXED se evalúa explícitamente como fuente capaz de situaciones", () => {
    const source = situationSource({
      sourceScope: SOURCE_SCOPE.MIXED,
      coverage: SOURCE_COVERAGE.COMPLETE,
      scope: { niveles: ["Secundario"] },
    });
    expect(isSituationInSourceScope({ nivel: "Secundario" }, source).inScope).toBe(
      true
    );
    expect(evaluateSourceAbsence({ source, situation: { nivel: "Secundario" } })).toBe(
      SOURCE_ABSENCE_STATUS.POSSIBLE_OMISSION
    );
  });

  test("20. complete sin restricciones es válida con warning y sugerencias conocidas quedan unknown", () => {
    const result = validateSourceDefinition(
      situationSource({
        coverage: SOURCE_COVERAGE.COMPLETE,
        scope: {
          niveles: null,
          departamentos: null,
          tiposCargo: null,
          modalidades: null,
          establecimientos: null,
          periodo: null,
        },
      })
    );
    expect(result.valid).toBe(true);
    expect(result.warnings).toEqual(
      expect.arrayContaining([
        "complete_sin_coverageDeclaredBy",
        "complete_sin_sourceDate",
        "complete_sin_restricciones_de_scope",
      ])
    );
    expect(TITULARIZACION_SOURCE_SUGGESTIONS).toHaveLength(4);
    expect(
      TITULARIZACION_SOURCE_SUGGESTIONS.every(
        (source) => source.coverage === SOURCE_COVERAGE.UNKNOWN
      )
    ).toBe(true);
    expect(
      TITULARIZACION_SOURCE_SUGGESTIONS.some(
        (source) => source.nombre === "Sorteo El Gordo"
      )
    ).toBe(false);
  });
});
