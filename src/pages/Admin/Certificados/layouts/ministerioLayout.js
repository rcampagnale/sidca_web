export const MINISTERIO_LAYOUT_VERSION = "ministerio-v1";

export const ministerioLayout = {
  page: { width: 842, height: 595 },
  marco: { x: 0, y: 0, width: 842, height: 595 },
  logo: { x: 326.7, y: 42, width: 49.4, height: 58 },
  encabezado: {
    ministerio: { x: 385, y: 49, width: 190 },
    gobierno: { x: 385, y: 79, width: 190 },
    secretaria: { x: 274.3, y: 105, width: 293.1 },
    institucion: { x: 245, y: 122.5, width: 352 },
  },
  certifica: { x: 351.7, y: 147.5, width: 138.5 },
  participante: { x: 101, y: 184, width: 640, maxLines: 2 },
  actividad: { x: 85, y: 207.9, width: 672 },
  // La caja visual usa 17% desde la izquierda y 66% de ancho. Su posición y
  // altura se calculan dinámicamente según el título; estos valores quedan
  // como fallback visual.
  titulo: { x: 143.14, y: 234.5, width: 555.72, maxLines: 2 },
  tituloBox: { left: 17, top: 35.5, width: 66, height: 5.2 },
  cuerpo: {
    x: 85,
    width: 672,
    gapAfterTitle: 8,
    gapBetweenBlocks: 10,
    // El último renglón queda 12 pt antes de la imagen de firmas (420 pt).
    // El margen evita rechazar títulos de dos líneas por redondeo del cálculo.
    maxBottom: 408,
  },
  firmas: {
    startY: 420,
    imageHeight: 62,
    imageWidths: [124, 124, 99.1184],
    positions: [63, 228, 483],
    columnWidths: [170, 250, 150],
    textY: 486,
    textHeight: 65,
  },
  qr: { x: 683, y: 431, width: 90, height: 90 },
  fonts: {
    family: '"Liberation Sans", Arial, sans-serif',
    boldFamily: '"Liberation Sans", Arial, sans-serif',
    participant: { initial: 13, min: 11, lineHeightFactor: 1.15 },
    activity: { size: 11.5, lineHeightFactor: 1.2 },
    title: { initial: 14.5, min: 11.5, lineHeightFactor: 1.1 },
    body: { size: 12, min: 10.5, lineHeightFactor: 1.2 },
    signerName: { size: 6.5, lineHeightFactor: 1.1 },
    signerDetail: { size: 5.5, lineHeightFactor: 1.12 },
  },
};

// Compatibilidad visual: una emisión histórica sin institución explícita no
// recibe la nueva línea y conserva el flujo anterior del contenido.
export const ministerioLayoutLegacy = {
  ...ministerioLayout,
  encabezado: { ...ministerioLayout.encabezado },
  certifica: { ...ministerioLayout.certifica, y: 136 },
  participante: { ...ministerioLayout.participante, y: 172.5 },
  actividad: { ...ministerioLayout.actividad, y: 196.4 },
  titulo: { ...ministerioLayout.titulo, y: 223 },
  cuerpo: {
    ...ministerioLayout.cuerpo,
    gapAfterTitle: 14,
    gapBetweenBlocks: 12,
  },
};

export const obtenerLayoutMinisterio = (mostrarInstitucion) =>
  mostrarInstitucion ? ministerioLayout : ministerioLayoutLegacy;
