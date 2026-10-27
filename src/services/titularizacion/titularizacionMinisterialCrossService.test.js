import {
  buildMinisterialAuditTrail,
  buildMinisterialCrossPreview,
  MINISTERIAL_PERSON_FILTERS,
  ministerialPersonMatchesFilter,
} from "./titularizacionMinisterialCrossService";
import { MINISTERIO_STATES } from "./titularizacionStateModel";
import { WORKSPACE_SOURCE_TYPES } from "./titularizacionWorkspaceService";

const fields = (overrides = {}) => ({
  establecimiento: "Escuela A",
  cargo: "Profesor",
  horas: "6",
  materia: "Matemática",
  nivel: "Primario",
  cursoAnio: "1",
  modalidad: "Común",
  ...overrides,
});

const situation = (id, overrides = {}) => ({
  id,
  formularioSolicitud: true,
  ...fields(),
  ...overrides,
});

const person = (dni = "12345678", situations = [situation("sit-1")]) => ({
  dni,
  apellido: "Pérez",
  nombre: "Ana",
  situaciones: situations,
});

const evidenceRecord = (dni, overrides = {}) => ({
  recordKey: overrides.recordKey || `record-${dni}`,
  sourceSheetIndex: 0,
  dni,
  valoresNormalizados: fields({ dni, ...(overrides.valoresNormalizados || {}) }),
  ...overrides,
});

const source = ({
  id,
  sourceType,
  records,
  fileName = `${sourceType}.xlsx`,
  resolutionNumber = null,
}) => ({
  workspaceSourceId: id,
  sourceType,
  stage: sourceType === WORKSPACE_SOURCE_TYPES.RESOLUCION ? "resolucion" : "ministerio",
  afirma: sourceType === WORKSPACE_SOURCE_TYPES.RESOLUCION ? "titularizada" : undefined,
  fileName,
  resolutionNumber,
  enabled: true,
  selectedSheetIndexes: [0],
  selectedSheets: [{ sheetIndex: 0, sheetName: "Hoja 1" }],
  rawRecords: records,
  administrativeRecords: records,
  interpretedSituations: [],
});

const workspace = (...sources) => ({
  sources,
  activeSourceIds: sources.map((item) => item.workspaceSourceId),
});

const resolution = (dni, overrides = {}) => evidenceRecord(dni, {
  recordKey: overrides.recordKey || "resolution-record",
  ...overrides,
});

describe("titularizacionMinisterialCrossService", () => {
  test("una resolución claramente coincidente titulariza una situación", () => {
    const preview = buildMinisterialCrossPreview({
      basePeople: [person()],
      workspace: workspace(source({
        id: "res-222",
        sourceType: WORKSPACE_SOURCE_TYPES.RESOLUCION,
        resolutionNumber: "RES 222",
        records: [resolution("12345678")],
      })),
    });

    expect(preview.people[0].situationResults[0].label).toBe("TITULARIZADA");
    expect(preview.metrics.titularizadasConfirmadas).toBe(1);
  });

  test("R1-A regresión: 20 horas contra 12 + 8 se conserva como agrupamiento", () => {
    const situations = [situation("sit-20", fields({ horas: "20" }))];
    const preview = buildMinisterialCrossPreview({
      basePeople: [person("12345678", situations)],
      workspace: workspace(source({
        id: "res-agrupamiento",
        sourceType: WORKSPACE_SOURCE_TYPES.RESOLUCION,
        records: [
          resolution("12345678", { recordKey: "fila-12", valoresNormalizados: fields({ horas: "12" }) }),
          resolution("12345678", { recordKey: "fila-8", valoresNormalizados: fields({ horas: "8" }) }),
        ],
      })),
    });

    expect(preview.people[0].reviewEvidence).toHaveLength(2);
    expect(preview.people[0].reviewEvidence.every(
      (evidence) => evidence.match?.tipoInconsistencia === "revision_agrupamiento"
    )).toBe(true);
    expect(preview.people[0].situationResults[0].titularizada).toBe(false);
  });

  test("R1-C regresión: dos evidencias no auto-confirman dos veces la misma situación", () => {
    const preview = buildMinisterialCrossPreview({
      basePeople: [person()],
      workspace: workspace(source({
        id: "res-repetida",
        sourceType: WORKSPACE_SOURCE_TYPES.RESOLUCION,
        records: [
          resolution("12345678", { recordKey: "fila-1" }),
          resolution("12345678", { recordKey: "fila-2" }),
        ],
      })),
    });

    expect(preview.people[0].situationResults.filter((item) => item.titularizada)).toHaveLength(0);
    expect(preview.people[0].reviewEvidence).toHaveLength(2);
  });

  test("R1-B: una evidencia compatible con dos situaciones queda en revisión N:1", () => {
    const situations = [
      situation("sit-12", fields({ horas: "12" })),
      situation("sit-8", fields({ horas: "8" })),
    ];
    const preview = buildMinisterialCrossPreview({
      basePeople: [person("12345678", situations)],
      workspace: workspace(source({
        id: "res-desagregacion",
        sourceType: WORKSPACE_SOURCE_TYPES.RESOLUCION,
        records: [resolution("12345678", {
          recordKey: "fila-20",
          valoresNormalizados: fields({ horas: "20" }),
        })],
      })),
    });

    expect(preview.people[0].reviewEvidence).toHaveLength(1);
    expect(preview.people[0].reviewEvidence[0].match?.tipoInconsistencia)
      .toBe("revision_desagregacion");
    expect(preview.people[0].situationResults.every((item) => !item.titularizada)).toBe(true);
  });

  test("R2 regresión: una competidora pobre no permite auto-confirmar la situación rica", () => {
    const situations = [
      situation("sit-A", fields({ materia: "Lengua", cursoAnio: "2 B" })),
      situation("sit-B", {
        id: "sit-B",
        formularioSolicitud: true,
        establecimiento: "",
        cargo: "",
        horas: "",
        materia: "",
        nivel: "",
        cursoAnio: "",
      }),
    ];
    const preview = buildMinisterialCrossPreview({
      basePeople: [person("12345678", situations)],
      workspace: workspace(source({
        id: "res-ambigua",
        sourceType: WORKSPACE_SOURCE_TYPES.RESOLUCION,
        records: [resolution("12345678", {
          recordKey: "fila-ambigua",
          valoresNormalizados: fields({ materia: "Matemática", cursoAnio: "1" }),
        })],
      })),
    });

    expect(preview.people[0].situationResults.find((item) => item.situationId === "sit-A").titularizada)
      .toBe(false);
    expect(preview.people[0].reviewEvidence).toHaveLength(1);
  });

  test("con tres situaciones sólo vincula la resolución al cargo compatible", () => {
    const situations = [
      situation("a", fields()),
      situation("b", fields({ establecimiento: "Escuela B", horas: "4" })),
      situation("c", fields({ establecimiento: "Escuela C", horas: "3" })),
    ];
    const preview = buildMinisterialCrossPreview({
      basePeople: [person("12345678", situations)],
      workspace: workspace(source({
        id: "res-177",
        sourceType: WORKSPACE_SOURCE_TYPES.RESOLUCION,
        records: [resolution("12345678", { valoresNormalizados: fields() })],
      })),
    });

    expect(preview.people[0].situationResults.map((item) => item.titularizada)).toEqual([true, false, false]);
  });

  test("R2-A: dos situaciones y dos evidencias claramente distintas se confirman", () => {
    const situations = [
      situation("sit-A", fields({ establecimiento: "Escuela A", horas: "6" })),
      situation("sit-B", fields({ establecimiento: "Escuela B", horas: "4" })),
    ];
    const preview = buildMinisterialCrossPreview({
      basePeople: [person("12345678", situations)],
      workspace: workspace(source({
        id: "res-dos-cargos",
        sourceType: WORKSPACE_SOURCE_TYPES.RESOLUCION,
        records: [
          resolution("12345678", { recordKey: "fila-A", valoresNormalizados: fields({ establecimiento: "Escuela A", horas: "6" }) }),
          resolution("12345678", { recordKey: "fila-B", valoresNormalizados: fields({ establecimiento: "Escuela B", horas: "4" }) }),
        ],
      })),
    });

    expect(preview.people[0].situationResults.map((item) => item.titularizada)).toEqual([true, true]);
    expect(preview.people[0].reviewEvidence).toHaveLength(0);
  });

  test("R2-B: una evidencia inequívoca confirma una situación entre tres", () => {
    const situations = [
      situation("sit-A", fields({ establecimiento: "Escuela A", horas: "6" })),
      situation("sit-B", fields({ establecimiento: "Escuela B", horas: "4" })),
      situation("sit-C", fields({ establecimiento: "Escuela C", horas: "3" })),
    ];
    const preview = buildMinisterialCrossPreview({
      basePeople: [person("12345678", situations)],
      workspace: workspace(source({
        id: "res-una-inequivoca",
        sourceType: WORKSPACE_SOURCE_TYPES.RESOLUCION,
        records: [resolution("12345678", {
          recordKey: "fila-A",
          valoresNormalizados: fields({ establecimiento: "Escuela A", horas: "6" }),
        })],
      })),
    });

    expect(preview.people[0].situationResults.map((item) => item.titularizada)).toEqual([true, false, false]);
    expect(preview.people[0].reviewEvidence).toHaveLength(0);
  });

  test("una resolución con sólo DNI no marca todas las situaciones", () => {
    const situations = [situation("a"), situation("b", fields({ establecimiento: "Escuela B" }))];
    const preview = buildMinisterialCrossPreview({
      basePeople: [person("12345678", situations)],
      workspace: workspace(source({
        id: "res-dni-only",
        sourceType: WORKSPACE_SOURCE_TYPES.RESOLUCION,
        records: [evidenceRecord("12345678", { valoresNormalizados: { dni: "12345678" } })],
      })),
    });

    expect(preview.people[0].situationResults.every((item) => !item.titularizada)).toBe(true);
    expect(preview.people[0].personLevelEvidence).toHaveLength(1);
  });

  test("un DNI externo queda como evidencia externa y no participa", () => {
    const preview = buildMinisterialCrossPreview({
      basePeople: [person()],
      workspace: workspace(source({
        id: "res-external",
        sourceType: WORKSPACE_SOURCE_TYPES.RESOLUCION,
        records: [resolution("99999999")],
      })),
    });

    expect(preview.people).toHaveLength(1);
    expect(preview.people[0].resolutions).toHaveLength(0);
    expect(preview.externalEvidence).toHaveLength(1);
    expect(preview.metrics.personasExternasResoluciones).toBe(1);
  });

  test("177 y 222 conservan dos evidencias sobre la misma situación", () => {
    const preview = buildMinisterialCrossPreview({
      basePeople: [person()],
      workspace: workspace(
        source({ id: "res-177", sourceType: WORKSPACE_SOURCE_TYPES.RESOLUCION, resolutionNumber: "177", records: [resolution("12345678", { recordKey: "r177" })] }),
        source({ id: "res-222", sourceType: WORKSPACE_SOURCE_TYPES.RESOLUCION, resolutionNumber: "222", records: [resolution("12345678", { recordKey: "r222" })] })
      ),
    });

    const result = preview.people[0].situationResults[0];
    expect(result.titularizada).toBe(true);
    expect(result.resolutionEvidences).toHaveLength(2);
    expect(preview.people[0].resolutions.map((item) => item.resolutionFamily)).toEqual(["177", "222"]);
  });

  test("Aptos sin resolución quedan APTA PENDIENTE DE RESOLUCIÓN", () => {
    const preview = buildMinisterialCrossPreview({
      basePeople: [person()],
      workspace: workspace(source({
        id: "aptos",
        sourceType: WORKSPACE_SOURCE_TYPES.MINISTERIO_APTOS,
        records: [evidenceRecord("12345678")],
      })),
    });

    const result = preview.people[0].situationResults[0];
    expect(result.state.ministerio).toBe("APTA");
    expect(result.label).toBe("APTA_PENDIENTE_RESOLUCION");
    expect(result.titularizada).toBe(false);
  });

  test("Observada más resolución queda titularizada y conserva la observación", () => {
    const preview = buildMinisterialCrossPreview({
      basePeople: [person()],
      workspace: workspace(
        source({ id: "observados", sourceType: WORKSPACE_SOURCE_TYPES.MINISTERIO_OBSERVADOS, records: [evidenceRecord("12345678")] }),
        source({ id: "res-222", sourceType: WORKSPACE_SOURCE_TYPES.RESOLUCION, records: [resolution("12345678")] })
      ),
    });

    const result = preview.people[0].situationResults[0];
    expect(result.state.ministerio).toBe("OBSERVADA");
    expect(result.state.resolucion).toBe("TITULARIZADA");
    expect(result.label).toBe("TITULARIZADA");
    expect(result.ministerialEvidences).toHaveLength(1);
  });

  test("No Apta más resolución produce contradicción y revisión", () => {
    const preview = buildMinisterialCrossPreview({
      basePeople: [person()],
      workspace: workspace(
        source({ id: "no-aptos", sourceType: WORKSPACE_SOURCE_TYPES.MINISTERIO_NO_APTOS, records: [evidenceRecord("12345678")] }),
        source({ id: "res-222", sourceType: WORKSPACE_SOURCE_TYPES.RESOLUCION, records: [resolution("12345678")] })
      ),
    });

    const result = preview.people[0].situationResults[0];
    expect(result.state.ministerio).toBe("NO_APTA");
    expect(result.state.resolucion).toBe("TITULARIZADA");
    expect(result.label).toBe("CONTRADICTORIA");
    expect(preview.people[0].estadoPersona).toBe("REQUIERE_REVISION");
  });

  test("No Apta en una situación y titularizada en otra produce titularización parcial", () => {
    const situations = [situation("a"), situation("b", fields({ establecimiento: "Escuela B", horas: "4" }))];
    const preview = buildMinisterialCrossPreview({
      basePeople: [person("12345678", situations)],
      workspace: workspace(
        source({ id: "no-aptos", sourceType: WORKSPACE_SOURCE_TYPES.MINISTERIO_NO_APTOS, records: [evidenceRecord("12345678", { valoresNormalizados: fields({ establecimiento: "Escuela B", horas: "4" }) })] }),
        source({ id: "res-222", sourceType: WORKSPACE_SOURCE_TYPES.RESOLUCION, records: [resolution("12345678", { valoresNormalizados: fields() })] })
      ),
    });

    expect(preview.people[0].estadoPersona).toBe("TITULARIZACION_PARCIAL");
    expect(preview.people[0].situationResults.map((item) => item.label)).toEqual(["TITULARIZADA", "NO_APTA"]);
  });

  test("la ausencia de resolución no infiere NO_TITULARIZADA", () => {
    const preview = buildMinisterialCrossPreview({ basePeople: [person()], workspace: workspace() });
    expect(preview.people[0].situationResults[0].label).not.toBe("NO_TITULARIZADA");
    expect(preview.people[0].situationResults[0].state.resolucion).toBe("SIN_DATO");
  });

  test("Omitidos no equivale a No Apta", () => {
    const preview = buildMinisterialCrossPreview({
      basePeople: [person()],
      workspace: workspace(source({ id: "omitidos", sourceType: WORKSPACE_SOURCE_TYPES.MINISTERIO_OMITIDOS, records: [evidenceRecord("12345678")] })),
    });
    const result = preview.people[0].situationResults[0];
    expect(result.ministerialStatus).toBe("OMITIDA");
    expect(result.state.ministerio).toBe(MINISTERIO_STATES.OMITIDA);
    expect(result.label).toBe("OMITIDA");
  });

  test("Rezagados conserva su estado específico", () => {
    const preview = buildMinisterialCrossPreview({
      basePeople: [person()],
      workspace: workspace(source({ id: "rezagados", sourceType: WORKSPACE_SOURCE_TYPES.MINISTERIO_REZAGADOS, records: [evidenceRecord("12345678")] })),
    });
    const result = preview.people[0].situationResults[0];
    expect(result.ministerialStatus).toBe("REZAGADA");
    expect(result.state.ministerio).toBe(MINISTERIO_STATES.REZAGADA);
    expect(result.label).toBe("REZAGADA");
  });

  test("evidencia ministerial a nivel persona no se asigna a todas las situaciones", () => {
    const situations = [situation("a"), situation("b", fields({ establecimiento: "Escuela B" }))];
    const preview = buildMinisterialCrossPreview({
      basePeople: [person("12345678", situations)],
      workspace: workspace(source({
        id: "observados",
        sourceType: WORKSPACE_SOURCE_TYPES.MINISTERIO_OBSERVADOS,
        records: [evidenceRecord("12345678", { valoresNormalizados: { dni: "12345678", observacion: "Documentación pendiente" } })],
      })),
    });
    expect(preview.people[0].personLevelEvidence).toHaveLength(1);
    expect(preview.people[0].situationResults.every((item) => !item.ministerialEvidences.length)).toBe(true);
  });

  test("R4-A: evidencia persona-level extra no degrada 3/3 situaciones titularizadas", () => {
    const preview = buildMinisterialCrossPreview({
      basePeople: [person()],
      workspace: workspace(source({
        id: "res-completa-con-extra",
        sourceType: WORKSPACE_SOURCE_TYPES.RESOLUCION,
        records: [
          resolution("12345678", { recordKey: "fila-completa" }),
          evidenceRecord("12345678", {
            recordKey: "fila-sin-situacion",
            valoresNormalizados: { dni: "12345678" },
          }),
        ],
      })),
    });
    const result = preview.people[0];

    expect(result.estadoPersona).toBe("TITULARIZACION_COMPLETA");
    expect(result.alertasPersona).toHaveLength(1);
    expect(result.evidenciasPersona).toBe(1);
    expect(result.personLevelEvidence).toHaveLength(1);
  });

  test("R4-B: situación pendiente más evidencia persona-level conserva revisión", () => {
    const preview = buildMinisterialCrossPreview({
      basePeople: [person()],
      workspace: workspace(source({
        id: "res-pendiente-extra",
        sourceType: WORKSPACE_SOURCE_TYPES.RESOLUCION,
        records: [evidenceRecord("12345678", {
          recordKey: "fila-sin-situacion",
          valoresNormalizados: { dni: "12345678" },
        })],
      })),
    });

    expect(preview.people[0].estadoPersona).toBe("REQUIERE_REVISION");
    expect(preview.people[0].alertasPersona).toHaveLength(1);
  });

  test("R4-C: sin situaciones estructuradas conserva alerta persona-level", () => {
    const preview = buildMinisterialCrossPreview({
      basePeople: [person("12345678", [])],
      workspace: workspace(source({
        id: "res-sin-situacion",
        sourceType: WORKSPACE_SOURCE_TYPES.RESOLUCION,
        records: [evidenceRecord("12345678", {
          recordKey: "fila-sin-situacion",
          valoresNormalizados: { dni: "12345678" },
        })],
      })),
    });

    expect(preview.people[0].estadoPersona).toBe("SIN_SITUACION_ESTRUCTURADA");
    expect(preview.people[0].alertasPersona).toHaveLength(1);
    expect(preview.people[0].personLevelEvidence).toHaveLength(1);
  });

  test("dos registros de resolución para cargos distintos se conservan", () => {
    const situations = [situation("a"), situation("b", fields({ establecimiento: "Escuela B", horas: "4" }))];
    const preview = buildMinisterialCrossPreview({
      basePeople: [person("12345678", situations)],
      workspace: workspace(source({
        id: "res-222",
        sourceType: WORKSPACE_SOURCE_TYPES.RESOLUCION,
        records: [
          resolution("12345678", { recordKey: "r-a", valoresNormalizados: fields() }),
          resolution("12345678", { recordKey: "r-b", valoresNormalizados: fields({ establecimiento: "Escuela B", horas: "4" }) }),
        ],
      })),
    });
    expect(preview.people[0].resolutions).toHaveLength(2);
    expect(preview.metrics.titularizadasConfirmadas).toBe(2);
  });

  test("ID Plaza ausente no rompe el cruce", () => {
    const preview = buildMinisterialCrossPreview({
      basePeople: [person()],
      workspace: workspace(source({ id: "res", sourceType: WORKSPACE_SOURCE_TYPES.RESOLUCION, records: [resolution("12345678", { idPlaza: "" })] })),
    });
    expect(preview.people[0].situationResults[0].titularizada).toBe(true);
    expect(preview.people[0].resolutions[0].idPlaza).toBeNull();
  });

  test("ID Plaza presente se conserva sin ser requisito del matcher", () => {
    const preview = buildMinisterialCrossPreview({
      basePeople: [person()],
      workspace: workspace(source({ id: "res", sourceType: WORKSPACE_SOURCE_TYPES.RESOLUCION, records: [resolution("12345678", { idPlaza: "905723" })] })),
    });
    expect(preview.people[0].resolutions[0].idPlaza).toBe("905723");
    expect(preview.people[0].situationResults[0].titularizada).toBe(true);
  });

  test("el orden de las fuentes no cambia el resultado", () => {
    const aptos = source({ id: "aptos", sourceType: WORKSPACE_SOURCE_TYPES.MINISTERIO_APTOS, records: [evidenceRecord("12345678", { recordKey: "a" })] });
    const resolucion = source({ id: "res", sourceType: WORKSPACE_SOURCE_TYPES.RESOLUCION, records: [resolution("12345678", { recordKey: "r" })] });
    const first = buildMinisterialCrossPreview({ basePeople: [person()], workspace: workspace(aptos, resolucion) });
    const second = buildMinisterialCrossPreview({ basePeople: [person()], workspace: workspace(resolucion, aptos) });
    expect(second.metrics).toMatchObject(first.metrics);
    expect(second.people[0].situationResults[0].label).toBe(first.people[0].situationResults[0].label);
    expect(second.people[0].situationResults[0].evidenceIds).toEqual(first.people[0].situationResults[0].evidenceIds);
  });

  test("agregar una resolución no cambia la cantidad de situaciones solicitadas", () => {
    const base = { basePeople: [person()], workspace: workspace() };
    const withoutResolution = buildMinisterialCrossPreview(base);
    const withResolution = buildMinisterialCrossPreview({
      basePeople: base.basePeople,
      workspace: workspace(source({ id: "res", sourceType: WORKSPACE_SOURCE_TYPES.RESOLUCION, records: [resolution("12345678")] })),
    });
    expect(withResolution.metrics.situacionesSolicitadas).toBe(withoutResolution.metrics.situacionesSolicitadas);
    expect(withResolution.basePeopleCount).toBe(withoutResolution.basePeopleCount);
  });

  test("una fuente ministerial no amplía el universo de 1430 personas", () => {
    const basePeople = Array.from({ length: 1430 }, (_, index) => person(String(10000000 + index)));
    const preview = buildMinisterialCrossPreview({
      basePeople,
      workspace: workspace(source({ id: "aptos", sourceType: WORKSPACE_SOURCE_TYPES.MINISTERIO_APTOS, records: [evidenceRecord("99999999")] })),
    });
    expect(preview.basePeopleCount).toBe(1430);
    expect(preview.people).toHaveLength(1430);
    expect(preview.externalEvidence).toHaveLength(1);
  });

  test("el índice y el preview no mutan sus entradas", () => {
    const basePeople = [person()];
    const sourceData = source({ id: "res", sourceType: WORKSPACE_SOURCE_TYPES.RESOLUCION, records: [resolution("12345678")] });
    const inputSnapshot = JSON.parse(JSON.stringify({ basePeople, sourceData }));
    buildMinisterialCrossPreview({ basePeople, workspace: workspace(sourceData) });
    expect({ basePeople, sourceData }).toEqual(inputSnapshot);
  });

  test("los filtros separan completa, revisión y sin evidencia ministerial", () => {
    const complete = buildMinisterialCrossPreview({
      basePeople: [person()],
      workspace: workspace(source({ id: "res", sourceType: WORKSPACE_SOURCE_TYPES.RESOLUCION, records: [resolution("12345678")] })),
    }).people[0];
    const without = buildMinisterialCrossPreview({ basePeople: [person()], workspace: workspace() }).people[0];
    expect(ministerialPersonMatchesFilter(complete, MINISTERIAL_PERSON_FILTERS.COMPLETE)).toBe(true);
    expect(ministerialPersonMatchesFilter(without, MINISTERIAL_PERSON_FILTERS.WITHOUT_MINISTRY)).toBe(true);
  });

  test("la auditoría por DNI devuelve sólo el historial de ese DNI", () => {
    const preview = buildMinisterialCrossPreview({
      basePeople: [person("12345678"), person("22345678", [situation("other")])],
      workspace: workspace(
        source({ id: "res-177", sourceType: WORKSPACE_SOURCE_TYPES.RESOLUCION, resolutionNumber: "177", records: [resolution("12345678", { recordKey: "r177" })] }),
        source({ id: "res-222", sourceType: WORKSPACE_SOURCE_TYPES.RESOLUCION, resolutionNumber: "222", records: [resolution("22345678", { recordKey: "r222" })] })
      ),
    });
    const audit = buildMinisterialAuditTrail({
      dni: "12345678",
      basePeople: [person("12345678"), person("22345678", [situation("other")])],
      workspace: workspace(
        source({ id: "res-177", sourceType: WORKSPACE_SOURCE_TYPES.RESOLUCION, resolutionNumber: "177", records: [resolution("12345678", { recordKey: "r177" })] }),
        source({ id: "res-222", sourceType: WORKSPACE_SOURCE_TYPES.RESOLUCION, resolutionNumber: "222", records: [resolution("22345678", { recordKey: "r222" })] })
      ),
      crossPreview: preview,
    });

    expect(audit.dni).toBe("12345678");
    expect(audit.resolucion177).toHaveLength(1);
    expect(audit.resolucion222).toHaveLength(0);
    expect(audit.resultados[0].situationId).toBe("sit-1");
  });

  test("R5: la familia de resolución sólo usa el número estructurado", () => {
    const preview = buildMinisterialCrossPreview({
      basePeople: [person()],
      workspace: workspace(
        source({
          id: "res-libre",
          sourceType: WORKSPACE_SOURCE_TYPES.RESOLUCION,
          fileName: "2177 docentes.pdf",
          records: [resolution("12345678", { recordKey: "libre" })],
        }),
        source({
          id: "res-1177",
          sourceType: WORKSPACE_SOURCE_TYPES.RESOLUCION,
          fileName: "RESGE-2026-1177-E-CAT-MET.pdf",
          records: [resolution("12345678", { recordKey: "estructurada" })],
        })
      ),
    });
    const resolutions = preview.people[0].resolutions;

    expect(resolutions.find((item) => item.recordKey === "libre").resolutionFamily).toBeNull();
    expect(resolutions.find((item) => item.recordKey === "estructurada").resolutionFamily).toBe("1177");
  });
});
