// scripts/copy-pdf-worker.js
//
// Copia el worker de PDF.js a public/ para que la app lo sirva desde su propio
// dominio, sin depender de un CDN (evita fallas si no hay internet y problemas
// de CSP). Se ejecuta solo con `npm run copy:pdf-worker` y automáticamente en
// el postinstall, así el archivo nunca falta al clonar el repo.
//
// Importante: se usa el build "legacy" porque el proyecto compila con
// webpack 4 (react-scripts 4), que no soporta la sintaxis del build moderno.

const fs = require("fs");
const path = require("path");

const ORIGEN = path.join(
  __dirname,
  "..",
  "node_modules",
  "pdfjs-dist",
  "legacy",
  "build",
  "pdf.worker.min.js"
);

const DESTINO = path.join(__dirname, "..", "public", "pdf.worker.min.js");

try {
  if (!fs.existsSync(ORIGEN)) {
    console.warn(
      "[copy-pdf-worker] No se encontró pdfjs-dist. Ejecutá npm install primero."
    );
    process.exit(0); // No romper el install si la dependencia todavía no está
  }

  fs.copyFileSync(ORIGEN, DESTINO);
  console.log("[copy-pdf-worker] Worker copiado a public/pdf.worker.min.js");
} catch (error) {
  console.warn("[copy-pdf-worker] No se pudo copiar el worker:", error.message);
  process.exit(0); // Nunca bloquear el install por esto
}
