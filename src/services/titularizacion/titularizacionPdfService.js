import * as pdfjsLib from "pdfjs-dist/legacy/build/pdf";

pdfjsLib.GlobalWorkerOptions.workerSrc = `${
  process.env.PUBLIC_URL || ""
}/pdf.worker.min.js`;

const bytesFor = async (fileOrData) => {
  if (fileOrData instanceof ArrayBuffer) return new Uint8Array(fileOrData);
  if (fileOrData instanceof Uint8Array) return fileOrData;
  if (fileOrData?.arrayBuffer) return new Uint8Array(await fileOrData.arrayBuffer());
  throw new Error("El PDF no contiene datos legibles en memoria.");
};

const pageTextFor = (items = []) => items
  .map((item) => `${String(item?.str || "").trim()}${item?.hasEOL ? "\n" : " "}`)
  .filter(Boolean)
  .join("")
  .replace(/[ \t]+/g, " ")
  .trim();

export const summarizeTitularizacionPdfPages = (pages = []) => {
  const textPages = pages.filter((page) => page.hasText).length;
  const emptyPages = pages.filter((page) => !page.hasText).map((page) => page.pageNumber);
  return {
    pageCount: pages.length,
    textPages,
    emptyPages,
    possibleScanned: emptyPages.length > 0,
  };
};

export const readTitularizacionPdf = async (fileOrData, onProgress) => {
  const data = await bytesFor(fileOrData);
  const loadingTask = pdfjsLib.getDocument({
    data,
    disableFontFace: true,
    isEvalSupported: false,
  });
  const pdf = await loadingTask.promise;
  const pages = [];

  try {
    for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
      let pageText = "";
      let items = [];
      let error = null;
      try {
        const page = await pdf.getPage(pageNumber);
        const textContent = await page.getTextContent();
        items = textContent.items || [];
        pageText = pageTextFor(items);
        page.cleanup();
      } catch (exception) {
        error = exception?.message || "No se pudo leer la página.";
      }
      pages.push({
        pageNumber,
        text: pageText,
        items,
        hasText: Boolean(pageText),
        error,
      });
      onProgress?.({ pageNumber, pageCount: pdf.numPages });
    }
  } finally {
    await pdf.destroy();
  }

  return {
    fileName: fileOrData?.name || "resolucion.pdf",
    pages,
    ...summarizeTitularizacionPdfPages(pages),
  };
};
