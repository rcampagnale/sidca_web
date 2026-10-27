import {
  EVIDENCE_ASSERTIONS,
  MINISTERIO_STATES,
  PERSON_LABELS,
  RESOLUCION_STATES,
  SIDCA_STATES,
  SOLICITUD_STATES,
  SITUATION_LABELS,
  STATE_ALGORITHM_VERSION,
  derivePersonSummary,
  deriveSituationState,
  filterEffectiveEvidences,
  resolveRevokedEvidences,
} from "./titularizacionStateModel";

const evidence = (id, etapa, afirma, overrides = {}) => ({
  id,
  etapa,
  afirma,
  vigente: true,
  ...overrides,
});

const solicitud = (overrides = {}) =>
  evidence("solicitud-1", "solicitud", EVIDENCE_ASSERTIONS.SOLICITUD_DECLARADA, overrides);

const sidca = (overrides = {}) =>
  evidence("sidca-1", "sidca", EVIDENCE_ASSERTIONS.SIDCA_PRESENTADA, overrides);

const ministerio = (afirma, id = "ministerio-1", overrides = {}) =>
  evidence(id, "ministerio", afirma, overrides);

const resolucion = (id = "resolucion-1", overrides = {}) =>
  evidence(id, "resolucion", EVIDENCE_ASSERTIONS.RESOLUCION_TITULARIZADA, overrides);

const derive = (evidences, stageEvaluations = {}, context = {}) =>
  deriveSituationState({ evidences, stageEvaluations, context });

describe("titularizacionStateModel - situaciones", () => {
  test("1. solicitud declarada solamente", () => {
    const result = derive([solicitud()]);
    expect(result.solicitud).toBe(SOLICITUD_STATES.DECLARADA);
    expect(result.sidca).toBe(SIDCA_STATES.SIN_DATO);
    expect(result.ministerio).toBe(MINISTERIO_STATES.SIN_DATO);
    expect(result.resolucion).toBe(RESOLUCION_STATES.SIN_DATO);
    expect(result.etiqueta).toBe(SITUATION_LABELS.DECLARADA);
  });

  test("2. solicitud y SIDCA presentada", () => {
    expect(derive([solicitud(), sidca()]).etiqueta).toBe(
      SITUATION_LABELS.PRESENTADA_SIDCA
    );
  });

  test("3. solicitud y posible omisión SIDCA", () => {
    const result = derive([solicitud()], {
      sidca: { absenceEvaluation: { status: "possible_omission" } },
    });
    expect(result.sidca).toBe(SIDCA_STATES.POSIBLE_OMISION);
    expect(result.etiqueta).toBe(SITUATION_LABELS.POSIBLE_OMISION_SIDCA);
  });

  test("4. solicitud y SIDCA no_data no afirma omisión", () => {
    const result = derive([solicitud()], {
      sidca: { absenceEvaluation: { status: "no_data" } },
    });
    expect(result.sidca).toBe(SIDCA_STATES.SIN_DATO);
    expect(result.etiqueta).toBe(SITUATION_LABELS.DECLARADA);
  });

  test("5. solicitud y SIDCA en revisión bloquean", () => {
    const result = derive(
      [solicitud()],
      { sidca: { matchResult: { matchStatus: "revision" } } }
    );
    expect(result.sidca).toBe(SIDCA_STATES.REVISION);
    expect(result.bloqueo.tipo).toBe("revision");
    expect(result.etiqueta).toBe(SITUATION_LABELS.REQUIERE_REVISION);
  });

  test("6. SIDCA presentada sin solicitud queda en revisión", () => {
    const result = derive([sidca()]);
    expect(result.solicitud).toBe(SOLICITUD_STATES.SIN_DATO);
    expect(result.sidca).toBe(SIDCA_STATES.PRESENTADA_SIN_SOLICITUD);
    expect(result.bloqueo.tipo).toBe("revision");
    expect(result.etiqueta).toBe(SITUATION_LABELS.PRESENTADA_SIN_SOLICITUD);
  });

  test("7. SIDCA presentada y Ministerio apta", () => {
    const result = derive([
      solicitud(),
      sidca(),
      ministerio(EVIDENCE_ASSERTIONS.MINISTERIO_APTA),
    ]);
    expect(result.ministerio).toBe(MINISTERIO_STATES.APTA);
    expect(result.resolucion).toBe(RESOLUCION_STATES.PENDIENTE);
    expect(result.etiqueta).toBe(SITUATION_LABELS.APTA_PENDIENTE_RESOLUCION);
  });

  test("8. Ministerio no apta", () => {
    const result = derive([
      solicitud(),
      sidca(),
      ministerio(EVIDENCE_ASSERTIONS.MINISTERIO_NO_APTA),
    ]);
    expect(result.ministerio).toBe(MINISTERIO_STATES.NO_APTA);
    expect(result.etiqueta).toBe(SITUATION_LABELS.NO_APTA);
  });

  test("9. Ministerio observada", () => {
    const result = derive([
      solicitud(),
      sidca(),
      ministerio(EVIDENCE_ASSERTIONS.MINISTERIO_OBSERVADA),
    ]);
    expect(result.ministerio).toBe(MINISTERIO_STATES.OBSERVADA);
    expect(result.etiqueta).toBe(SITUATION_LABELS.OBSERVADA);
  });

  test("9a. Ministerio omitida es un estado semántico propio", () => {
    const result = derive([
      solicitud(),
      ministerio(EVIDENCE_ASSERTIONS.MINISTERIO_OMITIDA),
    ]);

    expect(result.ministerio).toBe(MINISTERIO_STATES.OMITIDA);
    expect(result.etiqueta).toBe(SITUATION_LABELS.OMITIDA);
  });

  test("9b. Ministerio rezagada es un estado semántico propio", () => {
    const result = derive([
      solicitud(),
      ministerio(EVIDENCE_ASSERTIONS.MINISTERIO_REZAGADA),
    ]);

    expect(result.ministerio).toBe(MINISTERIO_STATES.REZAGADA);
    expect(result.etiqueta).toBe(SITUATION_LABELS.REZAGADA);
  });

  test("10. Ministerio posible omisión", () => {
    const result = derive([solicitud(), sidca()], {
      ministerio: { absenceEvaluation: { status: "possible_omission" } },
    });
    expect(result.ministerio).toBe(MINISTERIO_STATES.POSIBLE_OMISION);
    expect(result.etiqueta).toBe(SITUATION_LABELS.POSIBLE_OMISION_MINISTERIO);
  });

  test("11. Resolución titularizada", () => {
    const result = derive([
      solicitud(),
      sidca(),
      ministerio(EVIDENCE_ASSERTIONS.MINISTERIO_APTA),
      resolucion(),
    ]);
    expect(result.resolucion).toBe(RESOLUCION_STATES.TITULARIZADA);
    expect(result.etiqueta).toBe(SITUATION_LABELS.TITULARIZADA);
  });

  test("12. observada y resolución titularizada no es contradicción", () => {
    const result = derive([
      solicitud(),
      sidca(),
      ministerio(EVIDENCE_ASSERTIONS.MINISTERIO_OBSERVADA),
      resolucion(),
    ]);
    expect(result.etiqueta).toBe(SITUATION_LABELS.TITULARIZADA);
    expect(result.bloqueo).toBeNull();
    expect(result.ministerio).toBe(MINISTERIO_STATES.OBSERVADA);
  });

  test("13. no apta y resolución titularizada es contradictoria", () => {
    const result = derive([
      ministerio(EVIDENCE_ASSERTIONS.MINISTERIO_NO_APTA),
      resolucion(),
    ]);
    expect(result.bloqueo.tipo).toBe("contradiccion");
    expect(result.etiqueta).toBe(SITUATION_LABELS.CONTRADICTORIA);
  });

  test("14. posible omisión SIDCA y Ministerio apta es contradictoria", () => {
    const result = derive(
      [solicitud(), ministerio(EVIDENCE_ASSERTIONS.MINISTERIO_APTA)],
      { sidca: { absenceEvaluation: { status: "possible_omission" } } }
    );
    expect(result.bloqueo.tipo).toBe("contradiccion");
    expect(result.etiqueta).toBe(SITUATION_LABELS.CONTRADICTORIA);
  });

  test("15. Ministerio apta sin resolución queda pendiente", () => {
    const result = derive([ministerio(EVIDENCE_ASSERTIONS.MINISTERIO_APTA)]);
    expect(result.resolucion).toBe(RESOLUCION_STATES.PENDIENTE);
    expect(result.etiqueta).toBe(SITUATION_LABELS.APTA_PENDIENTE_RESOLUCION);
  });

  test("16. una resolución posterior titularizada prevalece aunque otra no tenga evidencia", () => {
    const result = derive([
      ministerio(EVIDENCE_ASSERTIONS.MINISTERIO_APTA),
      resolucion("resolucion-222", { sourceId: "resolucion-222" }),
    ]);
    expect(result.resolucion).toBe(RESOLUCION_STATES.TITULARIZADA);
    expect(result.etiqueta).toBe(SITUATION_LABELS.TITULARIZADA);
  });

  test("17. Ministerio apta y no apta vigentes producen contradicción", () => {
    const result = derive([
      ministerio(EVIDENCE_ASSERTIONS.MINISTERIO_APTA, "ministerio-apta"),
      ministerio(EVIDENCE_ASSERTIONS.MINISTERIO_NO_APTA, "ministerio-no-apta"),
    ]);
    expect(result.ministerio).toBe(MINISTERIO_STATES.REVISION);
    expect(result.etiqueta).toBe(SITUATION_LABELS.CONTRADICTORIA);
  });

  test("18. evidencia de fuente supersedida no contradice a la vigente", () => {
    const result = derive(
      [
        ministerio(EVIDENCE_ASSERTIONS.MINISTERIO_NO_APTA, "ministerio-v1", {
          sourceId: "ministerio-v1",
        }),
        ministerio(EVIDENCE_ASSERTIONS.MINISTERIO_APTA, "ministerio-v2", {
          sourceId: "ministerio-v2",
        }),
      ],
      {},
      {
        activeSources: [{ sourceId: "ministerio-v2", vigente: true }],
        supersededSourceIds: ["ministerio-v1"],
      }
    );
    expect(result.ministerio).toBe(MINISTERIO_STATES.APTA);
    expect(result.bloqueo).toBeNull();
  });

  test("19. decisión manual confirma vínculo sin inventar hecho administrativo", () => {
    const result = derive(
      [
        solicitud(),
        evidence("manual-match", "sidca", EVIDENCE_ASSERTIONS.MATCH_CONFIRMADO, {
          origen: "manual",
        }),
      ],
      { sidca: { matchResult: { matchStatus: "revision" } } }
    );
    expect(result.bloqueo).toBeNull();
    expect(result.sidca).toBe(SIDCA_STATES.SIN_DATO);
    expect(result.ministerio).toBe(MINISTERIO_STATES.SIN_DATO);
    expect(result.etiqueta).toBe(SITUATION_LABELS.DECLARADA);
  });

  test("20. revocación manual excluye la decisión anterior sin borrarla", () => {
    const previous = evidence("manual-anterior", "sidca", EVIDENCE_ASSERTIONS.MATCH_RECHAZADO, {
      origen: "manual",
    });
    const revocation = evidence("manual-revocacion", "sidca", EVIDENCE_ASSERTIONS.REVOCACION, {
      origen: "manual",
      revocaEvidenceId: "manual-anterior",
    });
    const resolved = resolveRevokedEvidences([previous, revocation]);
    expect(resolved.revokedEvidenceIds).toEqual(["manual-anterior"]);
    expect(resolved.evidences.map((item) => item.id)).toEqual(["manual-revocacion"]);
    expect(previous.afirma).toBe(EVIDENCE_ASSERTIONS.MATCH_RECHAZADO);
  });
});

describe("titularizacionStateModel - resumen de persona", () => {
  const state = (overrides = {}) => ({
    solicitud: SOLICITUD_STATES.DECLARADA,
    sidca: SIDCA_STATES.PRESENTADA,
    ministerio: MINISTERIO_STATES.APTA,
    resolucion: RESOLUCION_STATES.TITULARIZADA,
    bloqueo: null,
    etiqueta: SITUATION_LABELS.TITULARIZADA,
    ...overrides,
  });

  test("21. 3/3 titularizadas produce completa", () => {
    const result = derivePersonSummary([state(), state(), state()]);
    expect(result.titularizadas).toBe(3);
    expect(result.etiqueta).toBe(PERSON_LABELS.TITULARIZACION_COMPLETA);
  });

  test("22. 2 titularizadas y 1 no apta produce parcial", () => {
    const result = derivePersonSummary([
      state(),
      state(),
      state({
        ministerio: MINISTERIO_STATES.NO_APTA,
        resolucion: RESOLUCION_STATES.SIN_DATO,
        etiqueta: SITUATION_LABELS.NO_APTA,
      }),
    ]);
    expect(result.noAptas).toBe(1);
    expect(result.etiqueta).toBe(PERSON_LABELS.TITULARIZACION_PARCIAL);
  });

  test("23. 2 titularizadas y 1 revisión requiere revisión", () => {
    const result = derivePersonSummary([
      state(),
      state(),
      state({
        bloqueo: { tipo: "revision" },
        etiqueta: SITUATION_LABELS.REQUIERE_REVISION,
      }),
    ]);
    expect(result.enRevision).toBe(1);
    expect(result.etiqueta).toBe(PERSON_LABELS.REQUIERE_REVISION);
  });

  test("24. 0 titularizadas y 3 no aptas produce no titularizada", () => {
    const result = derivePersonSummary([
      state({
        ministerio: MINISTERIO_STATES.NO_APTA,
        resolucion: RESOLUCION_STATES.SIN_DATO,
        etiqueta: SITUATION_LABELS.NO_APTA,
      }),
      state({
        ministerio: MINISTERIO_STATES.NO_APTA,
        resolucion: RESOLUCION_STATES.SIN_DATO,
        etiqueta: SITUATION_LABELS.NO_APTA,
      }),
      state({
        ministerio: MINISTERIO_STATES.NO_APTA,
        resolucion: RESOLUCION_STATES.SIN_DATO,
        etiqueta: SITUATION_LABELS.NO_APTA,
      }),
    ]);
    expect(result.titularizadas).toBe(0);
    expect(result.etiqueta).toBe(PERSON_LABELS.NO_TITULARIZADA);
  });

  test("25. cero situaciones y dos reclamos no cuentan como situaciones", () => {
    const result = derivePersonSummary([], [
      { tipo: "reclamo" },
      { tipo: "reclamo" },
    ]);
    expect(result.totalSituaciones).toBe(0);
    expect(result.eventos.reclamo).toBe(2);
    expect(result.etiqueta).toBe(PERSON_LABELS.SIN_SITUACION_ESTRUCTURADA);
  });

  test("26. una posible omisión SIDCA produce CON_OMISIONES", () => {
    const result = derivePersonSummary([
      state({
        sidca: SIDCA_STATES.POSIBLE_OMISION,
        resolucion: RESOLUCION_STATES.SIN_DATO,
        etiqueta: SITUATION_LABELS.POSIBLE_OMISION_SIDCA,
      }),
    ]);
    expect(result.omitidasSidca).toBe(1);
    expect(result.etiqueta).toBe(PERSON_LABELS.CON_OMISIONES);
  });

  test("27. una titularizada y una omisión ministerial produce parcial", () => {
    const result = derivePersonSummary([
      state(),
      state({
        ministerio: MINISTERIO_STATES.POSIBLE_OMISION,
        resolucion: RESOLUCION_STATES.SIN_DATO,
        etiqueta: SITUATION_LABELS.POSIBLE_OMISION_MINISTERIO,
      }),
    ]);
    expect(result.titularizadas).toBe(1);
    expect(result.omitidasMinisterio).toBe(1);
    expect(result.etiqueta).toBe(PERSON_LABELS.TITULARIZACION_PARCIAL);
  });

  test("28. una contradicción requiere revisión de persona", () => {
    const result = derivePersonSummary([
      state({
        bloqueo: { tipo: "contradiccion" },
        etiqueta: SITUATION_LABELS.CONTRADICTORIA,
      }),
    ]);
    expect(result.contradictorias).toBe(1);
    expect(result.etiqueta).toBe(PERSON_LABELS.REQUIERE_REVISION);
  });
});

describe("titularizacionStateModel - invariantes", () => {
  test("el resultado es determinista aunque cambie el orden de evidencias", () => {
    const evidences = [
      ministerio(EVIDENCE_ASSERTIONS.MINISTERIO_APTA, "ministerio-apta"),
      solicitud(),
      sidca(),
      resolucion(),
    ];
    const first = derive(evidences);
    const second = derive([...evidences].reverse());
    expect(second).toEqual(first);
  });

  test("el motor no muta evidencias, estados ni eventos de entrada", () => {
    const evidences = [solicitud(), sidca()];
    const situationStates = [
      {
        solicitud: SOLICITUD_STATES.DECLARADA,
        sidca: SIDCA_STATES.PRESENTADA,
        ministerio: MINISTERIO_STATES.SIN_DATO,
        resolucion: RESOLUCION_STATES.SIN_DATO,
      },
    ];
    const personEvents = [{ tipo: "reclamo" }];
    const before = JSON.stringify({ evidences, situationStates, personEvents });
    derive(evidences);
    derivePersonSummary(situationStates, personEvents);
    expect(JSON.stringify({ evidences, situationStates, personEvents })).toBe(before);
  });

  test("todos los resultados usan la versión fija del algoritmo", () => {
    const situationResult = derive([solicitud()]);
    const personResult = derivePersonSummary([situationResult]);
    expect(situationResult.version).toBe(STATE_ALGORITHM_VERSION);
    expect(personResult.version).toBe(STATE_ALGORITHM_VERSION);
    expect(STATE_ALGORITHM_VERSION).toBe(1);
  });
});
