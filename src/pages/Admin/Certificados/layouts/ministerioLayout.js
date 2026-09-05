export const MINISTERIO_LAYOUT_VERSION = "ministerio-v1";

export const ministerioLayout = {
  page: { width: 842, height: 595 },
  marco: { x: 0, y: 0, width: 842, height: 595 },
  logo: { x: 326.7, y: 42, width: 49.4, height: 58 },
  encabezado: {
    ministerio: { x: 385, y: 49, width: 190 },
    gobierno: { x: 385, y: 84, width: 190 },
    secretaria: { x: 274.3, y: 111.3, width: 293.1 },
  },
  certifica: { x: 351.7, y: 136, width: 138.5 },
  participante: { x: 101, y: 172.5, width: 640, maxLines: 2 },
  actividad: { x: 85, y: 196.4, width: 672 },
  // La caja visual coincide con `.tituloBox`: 17% desde la izquierda y 66%
  // de ancho. `y` se conserva como referencia del flujo del cuerpo.
  titulo: { x: 143.14, y: 223, width: 555.72, maxLines: 2 },
  tituloBox: { left: 17, top: 35.5, width: 66, height: 5.2 },
  cuerpo: {
    x: 85,
    width: 672,
    gapAfterTitle: 14,
    gapBetweenBlocks: 12,
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
    title: { initial: 14.5, min: 11.5, lineHeightFactor: 1.16 },
    body: { size: 12, min: 10.5, lineHeightFactor: 1.2 },
    signerName: { size: 6.5, lineHeightFactor: 1.1 },
    signerDetail: { size: 5.5, lineHeightFactor: 1.12 },
  },
};
