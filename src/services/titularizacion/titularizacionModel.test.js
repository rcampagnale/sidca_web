import {
  adaptResponseToPerson,
  buildTitularizacionMetrics,
} from "./titularizacionNormalizer";
import {
  createEvidenceId,
  createSituationIdFromOrigin,
  deriveSituationSummary,
} from "./titularizacionModel";
import { matchSituationsOneToOne } from "./titularizacionMatcher";

const structuredForm = {
  campos: [
    { key: "dni", label: "DNI" },
    { key: "apellido", label: "Apellido" },
    { key: "nombre", label: "Nombre" },
  ],
};

describe("modelo Titularización", () => {
  test("no considera la falta de situación un error técnico de una persona válida", () => {
    const valid = adaptResponseToPerson(
      { id: "respuesta-valida", dni: "12345678", registros: [] },
      structuredForm
    );
    const invalid = adaptResponseToPerson(
      { id: "respuesta-invalida", dni: "123456789", registros: [] },
      structuredForm
    );

    expect(valid.sinSituacionEstructurada).toBe(true);
    expect(valid.razonesRevision).toEqual([]);
    expect(invalid.razonesRevision).toContain("DNI ausente o inválido");
    expect(buildTitularizacionMetrics([valid, invalid])).toMatchObject({
      personas: 1,
      personasRevision: 1,
      personasSinSituacionEstructurada: 1,
      requierenRevision: 1,
    });
  });

  test("el ID de situación depende del origen y no cambia con el fingerprint", () => {
    const origin = {
      sourceId: "formulario_inicial",
      respuestaId: "respuesta-1",
      indiceRegistroOriginal: 2,
    };
    expect(createSituationIdFromOrigin(origin)).toBe(createSituationIdFromOrigin(origin));
    expect(createSituationIdFromOrigin(origin)).not.toBe(
      createSituationIdFromOrigin({ ...origin, indiceRegistroOriginal: 3 })
    );
  });

  test("las evidencias automáticas son idempotentes y conservan score cero", () => {
    const args = {
      sourceId: "sidca-hash",
      importId: "import-hash",
      registroId: "fila_12",
      tipo: "presentacion_sidca",
    };
    expect(createEvidenceId(args)).toBe(createEvidenceId(args));
    expect(deriveSituationSummary([
      { tipo: "presentacion_sidca", matchStatus: "confirmada", matchScore: 0 },
    ])).toMatchObject({
      presentadaSidca: true,
      estadoActual: "presentada_sidca",
    });
  });

  test("una evidencia ambigua posterior no degrada una situación confirmada", () => {
    expect(deriveSituationSummary([
      { tipo: "presentacion_sidca", matchStatus: "confirmada", matchScore: 0.95 },
      { tipo: "revision", matchStatus: "revision", matchScore: 0.51 },
    ])).toMatchObject({
      presentadaSidca: true,
      requiereRevision: true,
      estadoActual: "presentada_sidca",
    });
  });

  test("el matcher mantiene asignación uno-a-uno", () => {
    const result = matchSituationsOneToOne(
      [
        { id: "situacion-1", cargo: "Docente", establecimiento: "Escuela A" },
        { id: "situacion-2", cargo: "Docente", establecimiento: "Escuela B" },
      ],
      [
        { recordKey: "fila-1", valuesNormalized: { cargo: "Docente", establecimiento: "Escuela A" } },
      ]
    );
    expect(result.rowResults.filter((row) => row.situacionIdVinculada).length).toBeLessThanOrEqual(1);
  });
});
