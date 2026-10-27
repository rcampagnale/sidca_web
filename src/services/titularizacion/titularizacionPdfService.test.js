import { summarizeTitularizacionPdfPages } from "./titularizacionPdfService";

test("un PDF con páginas vacías informa posible escaneo sin inventar registros", () => {
  const pages = [
    { pageNumber: 1, hasText: true },
    { pageNumber: 2, hasText: false },
    { pageNumber: 3, hasText: false },
  ];
  expect(summarizeTitularizacionPdfPages(pages)).toEqual({
    pageCount: 3,
    textPages: 1,
    emptyPages: [2, 3],
    possibleScanned: true,
  });
});

test("un PDF con texto digital no se marca como escaneado", () => {
  const pages = [
    { pageNumber: 1, hasText: true },
    { pageNumber: 2, hasText: true },
  ];
  expect(summarizeTitularizacionPdfPages(pages)).toEqual({
    pageCount: 2,
    textPages: 2,
    emptyPages: [],
    possibleScanned: false,
  });
});
