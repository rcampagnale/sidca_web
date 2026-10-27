import { extractResolutionNumber } from "./titularizacionResolutionNumber";

test("R5: extrae sólo números de resolución con referencia estructurada", () => {
  expect(extractResolutionNumber("RESGE-2026-177-E-CAT-MET.pdf")).toBe("177");
  expect(extractResolutionNumber("RESGE-2026-222-E-CAT-MET.pdf")).toBe("222");
  expect(extractResolutionNumber("2177 docentes.pdf")).toBeNull();
  expect(extractResolutionNumber("RESGE-2026-1177-E-CAT-MET.pdf")).toBe("1177");
  expect(extractResolutionNumber("RESGE-2026-310-E-CAT-MET.pdf")).toBe("310");
});

test("R5: prioriza metadata explícita y no usa substring libre", () => {
  expect(extractResolutionNumber("222", "RESGE-2026-177-E-CAT-MET.pdf")).toBe("222");
  expect(extractResolutionNumber("archivo-2220.pdf")).toBeNull();
  expect(extractResolutionNumber("RESGE-2026-415-E-CAT-MET.pdf")).toBe("415");
});

