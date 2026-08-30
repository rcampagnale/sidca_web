import jsPDF from "jspdf";
import QRCode from "qr.js/lib/QRCode";
import ErrorCorrectLevel from "qr.js/lib/ErrorCorrectLevel";
import tarjetaAcompananteBase from "../assets/gestion-cena/tarjeta-acompanante-base.png";
import tarjetaTitularBase from "../assets/gestion-cena/tarjeta-titular-base.png";
import {
  CENA_CARD_ASPECT_RATIO,
  CENA_CARD_HEIGHT,
  CENA_CARD_LAYOUT,
  CENA_CARD_WIDTH,
  formatearDniCena,
  obtenerDatosEventoCena,
} from "./gestionCenaCardLayout";

const PAGE_WIDTH = 2800;
const PAGE_HEIGHT = 1980;
const PAGE_MARGIN_Y = 70;
const PAGE_GAP = 50;
const PAGE_CARD_HEIGHT = Math.floor((PAGE_HEIGHT - PAGE_MARGIN_Y * 2 - PAGE_GAP) / 2);
const PAGE_CARD_WIDTH = Math.floor(PAGE_CARD_HEIGHT * CENA_CARD_ASPECT_RATIO);
const PAGE_START_X = Math.floor((PAGE_WIDTH - (PAGE_CARD_WIDTH * 2 + PAGE_GAP)) / 2);
const PAGE_START_Y = PAGE_MARGIN_Y;
const CARD_COLOR = "#44413a";
const COMPANION_COLOR = "#302f2b";
export const MAX_TARJETAS_POR_PDF = 200;

let plantillaTitularPromise = null;
let plantillaAcompanantePromise = null;
let recursosPdfCenaPromise = null;

const FUENTES_PDF_CENA = [
  '700 80px "Bodoni Moda"',
  '500 34px "Raleway"',
  '600 33px "Raleway"',
  '700 50px "Raleway"',
  '800 53px "Raleway"',
];

const crearLienzo = (ancho, alto) => {
  const lienzo = document.createElement("canvas");
  lienzo.width = ancho;
  lienzo.height = alto;
  return lienzo;
};

const liberarLienzo = (lienzo) => {
  if (!lienzo) return;
  lienzo.width = 1;
  lienzo.height = 1;
};

const cargarImagen = (src) => new Promise((resolve, reject) => {
  const imagen = new Image();
  imagen.onload = () => resolve(imagen);
  imagen.onerror = () => reject(new Error("No se pudo cargar la plantilla de la tarjeta."));
  imagen.src = src;
});

const cargarPlantilla = (tipo) => {
  const esTitular = tipo === "titular";
  const promesaActual = esTitular ? plantillaTitularPromise : plantillaAcompanantePromise;
  if (promesaActual) return promesaActual;

  const promesa = cargarImagen(esTitular ? tarjetaTitularBase : tarjetaAcompananteBase).catch((error) => {
    if (esTitular) plantillaTitularPromise = null;
    else plantillaAcompanantePromise = null;
    throw error;
  });

  if (esTitular) plantillaTitularPromise = promesa;
  else plantillaAcompanantePromise = promesa;
  return promesa;
};

const prepararFuentesPdfCena = async () => {
  const fuentes = document.fonts;
  if (!fuentes?.ready || !fuentes.load || !fuentes.check) {
    throw new Error("No se pudo verificar la tipografía institucional para generar el PDF.");
  }

  await fuentes.ready;
  await Promise.all(FUENTES_PDF_CENA.map((fuente) => fuentes.load(fuente)));

  const fuenteNoDisponible = FUENTES_PDF_CENA.find((fuente) => !fuentes.check(fuente));
  if (fuenteNoDisponible) {
    throw new Error(`La fuente requerida no está disponible para generar el PDF: ${fuenteNoDisponible}.`);
  }
};

const prepararRecursosPdfCena = () => {
  if (recursosPdfCenaPromise) return recursosPdfCenaPromise;

  recursosPdfCenaPromise = Promise.all([
    cargarPlantilla("titular"),
    cargarPlantilla("acompanante"),
    prepararFuentesPdfCena(),
  ]).catch((error) => {
    recursosPdfCenaPromise = null;
    throw error;
  });

  return recursosPdfCenaPromise;
};

const aplicarFuente = (ctx, peso, tamano, familia = "Raleway") => {
  ctx.font = `${peso} ${tamano}px "${familia}", sans-serif`;
};

const ajustarTamanoTexto = (ctx, texto, maximo, minimo, anchoMaximo) => {
  let tamano = maximo;
  while (tamano > minimo) {
    ctx.font = ctx.font.replace(/\d+(?:\.\d+)?px/, `${tamano}px`);
    if (ctx.measureText(texto).width <= anchoMaximo) break;
    tamano -= 1;
  }
  return tamano;
};

const dividirLineas = (ctx, texto, anchoMaximo, maximoLineas = 2) => {
  const palabras = String(texto || "").trim().split(/\s+/).filter(Boolean);
  if (!palabras.length) return [];

  const lineas = [];
  let linea = "";
  for (const palabra of palabras) {
    const candidata = linea ? `${linea} ${palabra}` : palabra;
    if (!linea || ctx.measureText(candidata).width <= anchoMaximo) {
      linea = candidata;
      continue;
    }
    lineas.push(linea);
    linea = palabra;
  }
  if (linea) lineas.push(linea);

  if (lineas.length <= maximoLineas) return lineas;
  const visibles = lineas.slice(0, maximoLineas);
  let ultima = visibles[maximoLineas - 1];
  while (ultima && ctx.measureText(`${ultima}...`).width > anchoMaximo) ultima = ultima.slice(0, -1).trim();
  visibles[maximoLineas - 1] = `${ultima}...`;
  return visibles;
};

const dibujarLineas = (ctx, lineas, x, y, altoLinea, alineacion = "left") => {
  ctx.textAlign = alineacion;
  lineas.forEach((linea, indice) => ctx.fillText(linea, x, y + indice * altoLinea));
  ctx.textAlign = "left";
};

const dibujarRecuadro = (ctx, x, y, ancho, alto, radio, relleno, borde, grosorBorde) => {
  const r = Math.min(radio, ancho / 2, alto / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + ancho - r, y);
  ctx.quadraticCurveTo(x + ancho, y, x + ancho, y + r);
  ctx.lineTo(x + ancho, y + alto - r);
  ctx.quadraticCurveTo(x + ancho, y + alto, x + ancho - r, y + alto);
  ctx.lineTo(x + r, y + alto);
  ctx.quadraticCurveTo(x, y + alto, x, y + alto - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
  ctx.fillStyle = relleno;
  ctx.fill();
  ctx.lineWidth = grosorBorde;
  ctx.strokeStyle = borde;
  ctx.stroke();
};

const dibujarTextoConMarco = (ctx, texto, x, y, maximoAncho, tamano, color, borde) => {
  aplicarFuente(ctx, 800, tamano);
  const anchoTexto = ctx.measureText(texto).width;
  const paddingX = 18;
  const alto = tamano + 18;
  const ancho = Math.min(maximoAncho, anchoTexto + paddingX * 2);
  dibujarRecuadro(ctx, x, y, ancho, alto, 4, "rgba(245, 238, 216, 0.58)", borde, 2);
  ctx.fillStyle = color;
  ctx.fillText(texto, x + paddingX, y + tamano + 2);
  return { ancho, alto };
};

const dibujarQr = (ctx, valor) => {
  const { x, y, size, darkSize, quietZoneModules } = CENA_CARD_LAYOUT.qr;
  dibujarRecuadro(ctx, x, y, size, size, 7, "#ffffff", "#514d42", 3);

  const qr = new QRCode(-1, ErrorCorrectLevel.L);
  qr.addData(String(valor || ""));
  qr.make();
  const modulos = qr.modules;
  const modulo = Math.max(1, Math.floor(darkSize / modulos.length));
  const qrSize = modulo * (modulos.length + quietZoneModules * 2);
  const inicioX = x + Math.floor((size - qrSize) / 2);
  const inicioY = y + Math.floor((size - qrSize) / 2);
  const imageSmoothingAnterior = ctx.imageSmoothingEnabled;

  ctx.imageSmoothingEnabled = false;
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(inicioX, inicioY, qrSize, qrSize);
  ctx.fillStyle = "#000000";
  modulos.forEach((fila, filaIndice) => {
    fila.forEach((celda, columnaIndice) => {
      if (celda) ctx.fillRect(
        inicioX + (columnaIndice + quietZoneModules) * modulo,
        inicioY + (filaIndice + quietZoneModules) * modulo,
        modulo,
        modulo
      );
    });
  });
  ctx.imageSmoothingEnabled = imageSmoothingAnterior;
};

const dibujarPie = (ctx, evento, esTitular) => {
  const { x, titularBottom, acompananteBottom } = CENA_CARD_LAYOUT.pie;
  const y = CENA_CARD_HEIGHT - (esTitular ? titularBottom : acompananteBottom);
  aplicarFuente(ctx, 600, 33);
  ctx.fillStyle = "#4f4a40";
  ctx.fillText(evento.organizadorTexto, x, y);
  const anchoOrganizador = ctx.measureText(evento.organizadorTexto).width;
  ctx.fillText(evento.sitioWeb, x + anchoOrganizador + 26, y);

  const ubicacion = [evento.direccion, evento.localidad].filter(Boolean).join(" | ");
  if (!ubicacion) return;
  aplicarFuente(ctx, 700, 27);
  ctx.fillStyle = "#5c574d";
  ctx.fillText(ubicacion, x, y + 38);
};

const dibujarDatosEvento = (ctx, evento, fechaHora, x, y, ancho, margenLeyenda) => {
  aplicarFuente(ctx, 700, 50);
  ctx.fillStyle = CARD_COLOR;
  dibujarLineas(ctx, dividirLineas(ctx, evento.lugar, ancho, 1), x, y, 54);

  y += 49;
  aplicarFuente(ctx, 500, 36);
  dibujarLineas(ctx, dividirLineas(ctx, fechaHora, ancho, 1), x, y, 40);

  y += 42 + margenLeyenda;
  aplicarFuente(ctx, 500, 34);
  ctx.fillStyle = "#514d44";
  dibujarLineas(ctx, dividirLineas(ctx, evento.leyenda, ancho, 2), x, y, 42);
};

const dibujarDatosTitular = (ctx, tarjeta, evento, nombre, fechaHora) => {
  const { x, width, top } = CENA_CARD_LAYOUT.contenido;
  const totalTarjetas = Number(tarjeta.totalAcompanantes || 0) + 1;
  let y = top + 44;

  aplicarFuente(ctx, 800, 44);
  ctx.fillStyle = CARD_COLOR;
  ctx.fillText("AFILIADO/A", x, y);

  y += 63;
  aplicarFuente(ctx, 700, nombre.length > 28 ? 41 : 50);
  const tamanoNombre = ajustarTamanoTexto(ctx, nombre, nombre.length > 28 ? 41 : 50, 32, width - 20);
  aplicarFuente(ctx, 700, tamanoNombre);
  ctx.fillText(nombre, x, y);

  y += 44;
  aplicarFuente(ctx, 700, 34);
  ctx.fillText(`DNI ${formatearDniCena(tarjeta.afiliadoDni)}`, x, y);

  y += 54;
  aplicarFuente(ctx, 700, 44);
  ctx.fillText(`TARJETA ${tarjeta.numeroTarjeta} DE ${totalTarjetas}`, x, y);

  dibujarDatosEvento(ctx, evento, fechaHora, x, y + 81, width, 22);
};

const dibujarDatosAcompanante = (ctx, tarjeta, evento, nombre, fechaHora) => {
  const { x, width, top } = CENA_CARD_LAYOUT.contenido;
  const etiqueta = dibujarTextoConMarco(ctx, "ACOMPAÑANTE", x, top, width - 50, 53, COMPANION_COLOR, "#393832");
  let y = top + etiqueta.alto + 36;

  aplicarFuente(ctx, 600, 29);
  ctx.fillStyle = "#5d594f";
  ctx.fillText("Vinculado a:", x, y);

  y += 54;
  aplicarFuente(ctx, 700, 45);
  const tamanoNombre = ajustarTamanoTexto(ctx, nombre, 45, 30, width - 20);
  aplicarFuente(ctx, 700, tamanoNombre);
  ctx.fillStyle = CARD_COLOR;
  ctx.fillText(nombre, x, y);

  y += 42;
  aplicarFuente(ctx, 700, 34);
  ctx.fillText(`DNI ${formatearDniCena(tarjeta.afiliadoDni)}`, x, y);

  y += 26;
  const numero = `ACOMPAÑANTE ${tarjeta.numeroAcompanante} DE ${tarjeta.totalAcompanantes}`;
  const numeroMarco = dibujarTextoConMarco(ctx, numero, x, y, width - 20, 53, COMPANION_COLOR, "#555249");
  dibujarDatosEvento(ctx, evento, fechaHora, x, y + numeroMarco.alto + 61, width, 16);
};

export const renderizarTarjetaCenaCanvas = async ({ tarjeta, configuracion, plantilla }) => {
  const lienzo = crearLienzo(CENA_CARD_WIDTH, CENA_CARD_HEIGHT);
  const ctx = lienzo.getContext("2d");
  const esTitular = tarjeta.tipo === "titular";
  const eventoBase = obtenerDatosEventoCena(configuracion, tarjeta.anio);
  const evento = {
    ...eventoBase,
    leyenda: esTitular ? eventoBase.leyendaTitular : eventoBase.leyendaAcompanante,
  };
  const nombre = `${tarjeta.afiliadoApellido || ""} ${tarjeta.afiliadoNombre || ""}`.trim();
  const fechaHora = [evento.fechaTexto, evento.horaTexto].filter(Boolean).join(" - ");

  ctx.drawImage(plantilla, 0, 0, CENA_CARD_WIDTH, CENA_CARD_HEIGHT);
  ctx.fillStyle = CARD_COLOR;
  aplicarFuente(ctx, 700, CENA_CARD_LAYOUT.titulo.fontSize, "Bodoni Moda");
  dibujarLineas(
    ctx,
    dividirLineas(ctx, evento.nombreEvento, CENA_CARD_LAYOUT.titulo.width, 2),
    CENA_CARD_LAYOUT.titulo.x,
    CENA_CARD_LAYOUT.titulo.top + CENA_CARD_LAYOUT.titulo.fontSize,
    CENA_CARD_LAYOUT.titulo.lineHeight,
    "center"
  );

  if (esTitular) dibujarDatosTitular(ctx, tarjeta, evento, nombre, fechaHora);
  else dibujarDatosAcompanante(ctx, tarjeta, evento, nombre, fechaHora);

  dibujarQr(ctx, tarjeta.urlValidacion || tarjeta.token);
  dibujarPie(ctx, evento, esTitular);
  return lienzo;
};

const cederPintado = () => new Promise((resolve) => {
  if (typeof window !== "undefined" && window.requestAnimationFrame) {
    window.requestAnimationFrame(resolve);
    return;
  }
  resolve();
});

export const generarPdfTarjetasCena = async ({
  tarjetas = [],
  anio,
  configuracion = null,
  edicion = null,
  nombreArchivo = null,
  onProgress = null,
}) => {
  const activas = tarjetas.filter((tarjeta) => !tarjeta.anulada);
  if (!activas.length) throw new Error("No hay tarjetas activas para generar PDF.");

  const datosConfiguracion = configuracion || edicion || {};
  const total = activas.length;
  onProgress?.({ procesadas: 0, total, porcentaje: 0, etapa: "preparando" });
  const [plantillaTitular, plantillaAcompanante] = await prepararRecursosPdfCena();

  const pdf = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  let procesadas = 0;

  for (let inicioPagina = 0; inicioPagina < activas.length; inicioPagina += 4) {
    if (inicioPagina > 0) pdf.addPage();
    const pagina = crearLienzo(PAGE_WIDTH, PAGE_HEIGHT);
    const ctxPagina = pagina.getContext("2d");
    ctxPagina.fillStyle = "#ffffff";
    ctxPagina.fillRect(0, 0, PAGE_WIDTH, PAGE_HEIGHT);

    for (let posicion = 0; posicion < 4 && inicioPagina + posicion < activas.length; posicion += 1) {
      const tarjeta = activas[inicioPagina + posicion];
      const plantilla = tarjeta.tipo === "titular" ? plantillaTitular : plantillaAcompanante;
      const lienzoTarjeta = await renderizarTarjetaCenaCanvas({
        tarjeta,
        configuracion: datosConfiguracion,
        plantilla,
      });
      const columna = posicion % 2;
      const fila = Math.floor(posicion / 2);
      ctxPagina.drawImage(
        lienzoTarjeta,
        PAGE_START_X + columna * (PAGE_CARD_WIDTH + PAGE_GAP),
        PAGE_START_Y + fila * (PAGE_CARD_HEIGHT + PAGE_GAP),
        PAGE_CARD_WIDTH,
        PAGE_CARD_HEIGHT
      );
      liberarLienzo(lienzoTarjeta);
      procesadas += 1;
      onProgress?.({
        procesadas,
        total,
        porcentaje: Math.round((procesadas / total) * 100),
        etapa: "tarjetas",
      });
      await cederPintado();
    }

    const imagenPagina = pagina.toDataURL("image/jpeg", 0.94);
    pdf.addImage(imagenPagina, "JPEG", 0, 0, pageWidth, pageHeight, undefined, "FAST");
    liberarLienzo(pagina);
    await cederPintado();
  }

  onProgress?.({ procesadas: total, total, porcentaje: 100, etapa: "documento" });
  await cederPintado();
  onProgress?.({ procesadas: total, total, porcentaje: 100, etapa: "descarga" });
  pdf.save(nombreArchivo || `tarjetas_cena_${anio}.pdf`);
  onProgress?.({ procesadas: total, total, porcentaje: 100, etapa: "completa" });
};

const dividirEnLotes = (lista, tamano) => {
  const lotes = [];
  for (let inicio = 0; inicio < lista.length; inicio += tamano) {
    lotes.push(lista.slice(inicio, inicio + tamano));
  }
  return lotes;
};

export const generarPdfMasivoPorLotesCena = async ({
  tarjetas = [],
  anio,
  configuracion = null,
  edicion = null,
  nombreArchivo = null,
  onProgress = null,
}) => {
  const activas = tarjetas.filter((tarjeta) => !tarjeta.anulada);
  if (!activas.length) throw new Error("No hay tarjetas activas para generar PDF.");

  const lotes = dividirEnLotes(activas, MAX_TARJETAS_POR_PDF);
  const total = activas.length;
  const nombreBase = String(nombreArchivo || `Cena_Docente_${anio}.pdf`).replace(/\.pdf$/i, "");
  let procesadasPrevias = 0;

  await prepararRecursosPdfCena();

  for (let indiceLote = 0; indiceLote < lotes.length; indiceLote += 1) {
    const lote = lotes[indiceLote];
    const numeroParte = String(indiceLote + 1).padStart(2, "0");
    const archivo = lotes.length === 1 ? `${nombreBase}.pdf` : `${nombreBase}_Parte_${numeroParte}.pdf`;
    const procesadasAntesDelLote = procesadasPrevias;

    onProgress?.({
      procesadas: procesadasAntesDelLote,
      total,
      porcentaje: Math.round((procesadasAntesDelLote / total) * 100),
      etapa: "preparando",
      archivoActual: indiceLote + 1,
      totalArchivos: lotes.length,
    });

    await generarPdfTarjetasCena({
      tarjetas: lote,
      anio,
      configuracion,
      edicion,
      nombreArchivo: archivo,
      onProgress: ({ procesadas, total: totalLote, etapa }) => {
        const procesadasGlobales = procesadasAntesDelLote + procesadas;
        onProgress?.({
          procesadas: procesadasGlobales,
          total,
          porcentaje: Math.round((procesadasGlobales / total) * 100),
          etapa,
          archivoActual: indiceLote + 1,
          totalArchivos: lotes.length,
          procesadasLote: procesadas,
          totalLote,
        });
      },
    });

    procesadasPrevias += lote.length;
    await cederPintado();
  }

  return { total, archivos: lotes.length, paginas: lotes.map((lote) => Math.ceil(lote.length / 4)) };
};

export const descargarPdfTarjetasCena = generarPdfTarjetasCena;
