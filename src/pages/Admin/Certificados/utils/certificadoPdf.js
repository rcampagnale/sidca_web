import html2canvas from "html2canvas";
import { jsPDF } from "jspdf";

export const sanitizarNombreArchivo = (valor) =>
  String(valor || "certificado")
    .replace(/[\\/:*?"<>|]/g, "-")
    .replace(/\s+/g, " ")
    .trim();

export const esperarImagenes = async (elemento) => {
  const imagenes = Array.from(elemento.querySelectorAll("img"));
  await Promise.all(
    imagenes.map(async (imagen) => {
      if (imagen.complete && imagen.naturalWidth > 0) {
        if (typeof imagen.decode === "function") {
          try { await imagen.decode(); } catch (_) {}
        }
        return;
      }

      if (imagen.complete) {
        throw new Error("No se pudo cargar una imagen del certificado.");
      }

      await new Promise((resolve, reject) => {
        imagen.addEventListener("load", resolve, { once: true });
        imagen.addEventListener(
          "error",
          () => reject(new Error("No se pudo cargar una imagen del certificado.")),
          { once: true }
        );
      });

      if (typeof imagen.decode === "function") {
        try { await imagen.decode(); } catch (_) {}
      }
    })
  );
};

export const capturarCertificado = async (elemento, { scale = 2 } = {}) => {
  await document.fonts?.ready;
  await esperarImagenes(elemento);
  elemento.setAttribute("data-pdf-capture", "true");
  try {
    return await html2canvas(elemento, {
      scale,
      useCORS: true,
      backgroundColor: "#ffffff",
      logging: false,
    });
  } finally {
    elemento.removeAttribute("data-pdf-capture");
  }
};

export const agregarCanvasAPdf = (pdf, canvas, primeraPagina = false) => {
  if (!primeraPagina) pdf.addPage("a4", "landscape");
  const ratio = canvas.width / canvas.height;
  let ancho = 297;
  let alto = ancho / ratio;
  if (alto > 210) {
    alto = 210;
    ancho = alto * ratio;
  }
  const x = (297 - ancho) / 2;
  const y = (210 - alto) / 2;
  pdf.addImage(canvas.toDataURL("image/jpeg", 0.95), "JPEG", x, y, ancho, alto, undefined, "FAST");
};

export const crearPdfA4Horizontal = () =>
  new jsPDF({ orientation: "landscape", unit: "mm", format: "a4", compress: true });
