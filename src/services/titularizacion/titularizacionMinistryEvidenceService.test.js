import { matchMinistryEvidenceToResolution } from "./titularizacionMinistryEvidenceService";

const ministry = (overrides = {}) => ({
  dni: "29837689",
  idPlaza: "905723",
  cargo: "Profesor",
  establecimiento: "Escuela 91",
  horas: "4",
  ...overrides,
});

const resolution = (overrides = {}) => ({
  dni: "29837689",
  idPlaza: "905723",
  cargo: "Profesor",
  establecimiento: "Escuela 91",
  horas: "4",
  ...overrides,
});

test("DNI e ID Plaza exactos producen vínculo ministerial exacto", () => {
  expect(matchMinistryEvidenceToResolution({
    ministryRecord: ministry(),
    resolutionRecord: resolution(),
  })).toMatchObject({
    matched: true,
    requiresReview: false,
    status: "EXACT_MINISTRY_LINK",
    idPlaza: "905723",
  });
});

test("mismo DNI con ID Plaza diferente no produce vínculo exacto", () => {
  expect(matchMinistryEvidenceToResolution({
    ministryRecord: ministry(),
    resolutionRecord: resolution({ idPlaza: "905724" }),
  })).toMatchObject({
    matched: false,
    requiresReview: true,
    status: "REVIEW",
    reason: "dni_igual_id_plaza_distinto",
  });
});

test("si falta ID Plaza permite candidato semántico del mismo DNI para revisión", () => {
  expect(matchMinistryEvidenceToResolution({
    ministryRecord: ministry({ idPlaza: "" }),
    resolutionRecord: resolution(),
  })).toMatchObject({
    matched: false,
    requiresReview: true,
    status: "SEMANTIC_CANDIDATE",
    reason: "falta_id_plaza_en_una_fuente",
  });
});

test("DNI distinto nunca se vincula aunque comparta ID Plaza", () => {
  expect(matchMinistryEvidenceToResolution({
    ministryRecord: ministry({ dni: "29837689" }),
    resolutionRecord: resolution({ dni: "30111222" }),
  })).toMatchObject({
    matched: false,
    requiresReview: false,
    status: "NO_MATCH",
    reason: "dni_distinto_o_ausente",
  });
});
