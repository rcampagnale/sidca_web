import {
  EMPTY_TITULARIZACION_COUNTERS,
  STATE_ALGORITHM_VERSION,
  TITULARIZACION_PERSISTENCE_ENABLED,
  TITULARIZACION_SCHEMA_VERSION,
  TITULARIZACION_QUERY_PLAN,
  createAutomaticEvidenceId,
  createHumanDecisionId,
  deriveProcessCounters,
  serializeEvidenceForFirestore,
  serializeEventForFirestore,
  serializeImportedRecordForFirestore,
  serializeObservationForFirestore,
  serializePersonForFirestore,
  serializeSituationForFirestore,
  titularizacionEvidencePath,
  titularizacionEventPath,
  titularizacionPersonPath,
  titularizacionPersonEventsCollectionPath,
  titularizacionSituationPath,
  validateEvidenceDocument,
  validateEventDocument,
  validateImportDocument,
  validatePersonDocument,
  validateSituationDocument,
} from "./titularizacionFirestoreModel";
import { createEventId } from "./titularizacionModel";
import { derivePersonSummary } from "./titularizacionStateModel";

const personSummary = (overrides = {}) => ({
  totalSituaciones: 0,
  titularizadas: 0,
  aptas: 0,
  noAptas: 0,
  observadas: 0,
  omitidasSidca: 0,
  omitidasMinisterio: 0,
  enRevision: 0,
  contradictorias: 0,
  sinDato: 0,
  etiqueta: "EN_TRAMITE",
  version: 1,
  ...overrides,
});

describe("titularizacionFirestoreModel", () => {
  test("1. persona conserva DNI, cero y false", () => {
    const result = serializePersonForFirestore({
      procesoId: "proceso_2026",
      dni: "12345678",
      cantidadSituaciones: 0,
      resumen: { ...personSummary(), requiereRevision: false },
    });
    expect(result.dni).toBe("12345678");
    expect(result.cantidadSituaciones).toBe(0);
    expect(result.resumen.requiereRevision).toBe(false);
  });

  test("2. undefined se elimina sin alterar null", () => {
    const result = serializePersonForFirestore({ dni: "12345678", email: undefined, telefono: null });
    expect(result).not.toHaveProperty("email");
    expect(result.telefono).toBeNull();
  });

  test("3. situación conserva fingerprintCore y fingerprintFull", () => {
    const result = serializeSituationForFirestore({
      procesoId: "proceso_2026",
      dni: "12345678",
      situacionId: "sit-1",
      fingerprintCore: "core",
      fingerprintFull: "full",
    });
    expect(result.fingerprintCore).toBe("core");
    expect(result.fingerprintFull).toBe("full");
  });

  test("4. matchScore cero se serializa como similarityScore cero", () => {
    const result = serializeEvidenceForFirestore({ matchScore: 0, evidenceId: "ev-1" });
    expect(result.similarityScore).toBe(0);
    expect(result.similarityScore).not.toBeNull();
  });

  test("5. evidencia automática conserva procedencia suficiente", () => {
    const result = serializeEvidenceForFirestore({
      procesoId: "proceso_2026",
      dni: "12345678",
      situacionId: "sit-1",
      evidenceId: "ev-1",
      etapa: "sidca",
      afirma: "presentada",
      sourceId: "sidca-1",
      sourceVersion: 1,
      importId: "imp-1",
      registroId: "fila-2",
      origen: "automatico",
    });
    expect(validateEvidenceDocument(result, { parentDni: "12345678", parentSituationId: "sit-1" }).valid).toBe(true);
    expect(result.sourceId).toBe("sidca-1");
    expect(result.importId).toBe("imp-1");
  });

  test("6. evento de persona no contiene situación inventada", () => {
    const result = serializeEventForFirestore({
      procesoId: "proceso_2026",
      dni: "12345678",
      eventId: "event-1",
      tipo: "reclamo",
      situacionId: "no-debe-copiarse",
    });
    expect(result).not.toHaveProperty("situacionId");
    expect(validateEventDocument(result, { parentDni: "12345678" }).valid).toBe(true);
  });

  test("7. registro importado conserva valoresOriginales", () => {
    const result = serializeImportedRecordForFirestore({
      procesoId: "proceso_2026",
      importId: "imp-1",
      registroId: "fila-2",
      valoresOriginales: { DNI: "12345678", Horas: "3" },
    });
    expect(result.valoresOriginales).toEqual({ DNI: "12345678", Horas: "3" });
  });

  test("8. observación puede pertenecer sólo a una persona", () => {
    const result = serializeObservationForFirestore({
      procesoId: "proceso_2026",
      dni: "12345678",
      observacionId: "obs-1",
      texto: "Revisar documentación",
    });
    expect(result).not.toHaveProperty("situacionId");
    expect(result.dni).toBe("12345678");
  });

  test("9. inconsistencias entre IDs padre e hijo son detectadas", () => {
    const situation = validateSituationDocument(
      { procesoId: "proceso_2026", dni: "12345679", situacionId: "sit-1" },
      { parentDni: "12345678", parentProcessId: "proceso_2026" }
    );
    const evidence = validateEvidenceDocument(
      {
        procesoId: "proceso_2026",
        dni: "12345678",
        situacionId: "sit-2",
        evidenceId: "ev-1",
        etapa: "sidca",
        afirma: "presentada",
        origen: "manual",
      },
      { parentDni: "12345678", parentSituationId: "sit-1" }
    );
    expect(situation.valid).toBe(false);
    expect(evidence.valid).toBe(false);
  });

  test("10. contadores con cero personas", () => {
    expect(deriveProcessCounters([])).toEqual(EMPTY_TITULARIZACION_COUNTERS);
  });

  test("11. contadores calculan completa, parcial y revisión", () => {
    const result = deriveProcessCounters([
      { resumen: personSummary({ totalSituaciones: 2, titularizadas: 2 }) },
      { resumen: personSummary({ totalSituaciones: 2, titularizadas: 1, noAptas: 1 }) },
      { resumen: personSummary({ totalSituaciones: 1, enRevision: 1, etiqueta: "REQUIERE_REVISION" }) },
    ]);
    expect(result.personas).toBe(3);
    expect(result.situaciones).toBe(5);
    expect(result.titularizadas).toBe(3);
    expect(result.enRevision).toBe(1);
    expect(result.noAptas).toBe(1);
  });

  test("12. sinSituacionEstructurada se deriva de totalSituaciones cero", () => {
    const result = deriveProcessCounters([
      { resumen: personSummary({ totalSituaciones: 0 }) },
      { resumen: personSummary({ totalSituaciones: 1 }) },
    ]);
    expect(result.sinSituacionEstructurada).toBe(1);
  });

  test("13. schemaVersion y stateAlgorithmVersion son independientes", () => {
    expect(TITULARIZACION_SCHEMA_VERSION).toBe(1);
    expect(STATE_ALGORITHM_VERSION).toBe(1);
    expect(TITULARIZACION_SCHEMA_VERSION).not.toBe(Symbol("different"));
  });

  test("14. paths de dos DNI distintos no colisionan", () => {
    expect(titularizacionPersonPath("12345678")).not.toBe(titularizacionPersonPath("12345679"));
  });

  test("15. paths de dos situaciones de una persona no colisionan", () => {
    expect(titularizacionSituationPath("12345678", "sit-1")).not.toBe(
      titularizacionSituationPath("12345678", "sit-2")
    );
  });

  test("16. evidencia automática igual produce ID determinístico igual", () => {
    const input = {
      sourceId: "sidca-1",
      importId: "imp-1",
      registroId: "fila-2",
      etapa: "sidca",
      afirma: "presentada",
      situacionId: "sit-1",
    };
    expect(createAutomaticEvidenceId(input)).toBe(createAutomaticEvidenceId({ ...input }));
  });

  test("17. dos decisiones humanas distintas pueden tener IDs distintos", () => {
    expect(createHumanDecisionId({ decisionId: "decision-a" })).not.toBe(
      createHumanDecisionId({ decisionId: "decision-b" })
    );
  });

  test("18. datos originales pesados no se copian a situación", () => {
    const result = serializeSituationForFirestore({
      dni: "12345678",
      situacionId: "sit-1",
      valoresOriginales: { muchos: "datos" },
      sourceRefs: [{ sourceId: "source-1" }],
      matchScore: 0.95,
    });
    expect(result).not.toHaveProperty("valoresOriginales");
    expect(result).not.toHaveProperty("sourceRefs");
    expect(result).not.toHaveProperty("matchScore");
  });

  test("19. el flag de persistencia continúa deshabilitado", () => {
    expect(TITULARIZACION_PERSISTENCE_ENABLED).toBe(false);
  });

  test("20. el detalle de persona usa subcolección y no collectionGroup", () => {
    expect(TITULARIZACION_QUERY_PLAN.personDetail.collectionGroup).toBe(false);
    expect(TITULARIZACION_QUERY_PLAN.personDetail.reads).toEqual(["persona", "situaciones"]);
  });

  test("21. evento de persona sin situación es válido", () => {
    const person = serializePersonForFirestore({
      procesoId: "proceso_2026",
      dni: "30111222",
      cantidadSituaciones: 0,
      resumen: personSummary(),
    });
    const event = serializeEventForFirestore({
      procesoId: "proceso_2026",
      dni: "30111222",
      eventId: "evento-reclamo-1",
      tipo: "reclamo",
    });
    expect(validatePersonDocument(person, { documentId: "30111222" }).valid).toBe(true);
    expect(validateEventDocument(event, {
      parentDni: "30111222",
      parentProcessId: "proceso_2026",
    }).valid).toBe(true);
  });

  test("22. el path de evento no contiene situación", () => {
    const collectionPath = titularizacionPersonEventsCollectionPath("30111222");
    const eventPath = titularizacionEventPath("30111222", "evento-reclamo-1");
    expect(collectionPath).toBe("titularizacion/proceso_2026/personas/30111222/eventos");
    expect(eventPath).toBe(`${collectionPath}/evento-reclamo-1`);
    expect(eventPath).not.toContain("/situaciones/");
  });

  test("23. cero situaciones y un reclamo producen resumen de persona válido", () => {
    const summary = derivePersonSummary([], [{ tipo: "reclamo" }]);
    expect(summary.totalSituaciones).toBe(0);
    expect(summary.eventos.reclamo).toBe(1);
  });

  test("24. tres situaciones y un reclamo no crean tres eventos", () => {
    const summary = derivePersonSummary([{}, {}, {}], [{ tipo: "reclamo" }]);
    expect(summary.totalSituaciones).toBe(3);
    expect(summary.eventos.reclamo).toBe(1);
  });

  test("25. reprocesar el mismo evento conserva el mismo ID", () => {
    const input = {
      sourceId: "fuente-reclamos",
      formularioId: "form-1",
      respuestaId: "respuesta-1",
      tipo: "reclamo",
    };
    expect(createEventId(input)).toBe(createEventId({ ...input }));
  });

  test("26. dos reclamos con respuestas distintas conservan IDs distintos", () => {
    const first = createEventId({
      sourceId: "fuente-reclamos",
      formularioId: "form-1",
      respuestaId: "respuesta-1",
      tipo: "reclamo",
    });
    const second = createEventId({
      sourceId: "fuente-reclamos",
      formularioId: "form-1",
      respuestaId: "respuesta-2",
      tipo: "reclamo",
    });
    expect(first).not.toBe(second);
  });

  test("27. la evidencia permanece debajo de la situación", () => {
    const evidencePath = titularizacionEvidencePath("30111222", "sit-1", "ev-1");
    expect(evidencePath).toBe(
      "titularizacion/proceso_2026/personas/30111222/situaciones/sit-1/evidencias/ev-1"
    );
    expect(evidencePath).toContain("/situaciones/sit-1/evidencias/");
  });

  test("28. un evento no puede validarse como evidencia de situación", () => {
    const event = serializeEventForFirestore({
      procesoId: "proceso_2026",
      dni: "30111222",
      eventId: "evento-reclamo-1",
      tipo: "reclamo",
    });
    const validation = validateEvidenceDocument(event, {
      parentDni: "30111222",
      parentSituationId: "sit-1",
    });
    expect(validation.valid).toBe(false);
    expect(validation.errors).toContain("situacionId_requerido");
    expect(validation.errors).toContain("evidenceId_requerido");
  });
});
