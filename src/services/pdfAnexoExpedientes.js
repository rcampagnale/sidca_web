// src/services/pdfAnexoExpedientes.js
//
// Lectura y parseo de los ANEXOS oficiales en PDF (resoluciones de
// reconocimiento de servicios docentes) para extraer las filas de la tabla.
//
// ── Por qué este parser es así ────────────────────────────────────────────
// Los PDF oficiales NO traen la tabla como estructura: traen fragmentos de
// texto con coordenadas. Una sola fila de la tabla ocupa 4 o 5 "líneas" de Y
// distintas, porque las celdas largas se parten en varios renglones:
//
//   y=521  [x47]EX-2025-01872607- -   [x194]ESCUELA SECUNDARIA Nº
//   y=516  [x104]SALAYA ROMINA        [x291]PROFESOR/A HORA CATEDRA...
//   y=512  [x30]1  [x65]CAT-  [x153]27-25117487-9  [x264]1067173   ← ANCLA
//   y=508  [x110]GERALDINE            [x309]HORA CATEDRA NIVEL MEDIO
//   y=504  [x51]DPRHED#MTPRH         [x216]CAPITAL
//
// La línea "ancla" es la que tiene el número de ORDEN (columna 1) y el CUIL.
// Las líneas de arriba y abajo pertenecen a la misma fila. Para saber dónde
// termina una fila y empieza la siguiente usamos el punto medio entre anclas.
//
// Luego, cada celda se reconstruye juntando los fragmentos que caen dentro de
// la banda horizontal (X) de su columna.
//
// Calibrado contra: RESGE-2026-123-E-CAT-MET.pdf (4 páginas, 13 filas).

import * as pdfjsLib from "pdfjs-dist/legacy/build/pdf";
import {
  extraerExpedienteDesdeTexto,
  normalizeCuil,
  normalizeDocumento,
  limpiarTextoPlano,
} from "../utils/expedientesNormalizacion";

// El worker se sirve desde public/ (lo copia scripts/copy-pdf-worker.js).
// No usamos CDN para que funcione sin internet y sin problemas de CSP.
pdfjsLib.GlobalWorkerOptions.workerSrc = `${
  process.env.PUBLIC_URL || ""
}/pdf.worker.min.js`;

/* ══════════════════════════════════════════════
 * Bandas de columnas (coordenada X inicial)
 * ══════════════════════════════════════════════
 * Calibradas con el encabezado real del anexo:
 *   ORDEN x22 · EXPEDIENTE x55 · APELLIDO Y NOMBRES x109 · CUIL x165
 *   ESTABLECIMIENTO x203 · ID CARGO x262 · CARGO x336 · NIVEL x415
 *   TURNO x450 · MODALIDAD x498 · MATERIA x572 · AÑO SEC. HS x615
 *   SITUACIÓN DE REVISTA x656 · DESDE x692 · HASTA x722 · ID PLAZA x750
 */
const BANDAS = {
  orden: [0, 46],
  expediente: [46, 95],
  apellidoNombre: [95, 148],
  // El CUIL está siempre en x≈153. Se corta en 190 porque el texto de
  // ESTABLECIMIENTO empieza en x≈193 y si entra en esta banda contamina el
  // número (ej. "27-36719111-8" + "02 CLARA J. ARMSTRONG").
  cuil: [148, 190],
  establecimiento: [190, 260],
  idCargo: [260, 286],
  cargo: [286, 405],
  nivel: [405, 436],
  turno: [436, 476],
  modalidad: [476, 551],
  materia: [551, 611],
  anioSecHs: [611, 655],
  situacionRevista: [655, 686],
  desde: [686, 716],
  hasta: [716, 741],
  idPlaza: [741, 9999],
};

const TOLERANCIA_Y = 2; // fragmentos con Y casi igual son la misma línea
const ALTO_FILA_POR_DEFECTO = 25; // medido en los anexos reales

const RE_CUIL = /\b\d{2}\s*-?\s*\d{8}\s*-?\s*\d\b/;
const RE_ORDEN = /^\d{1,4}$/;

/* ══════════════════════════════════════════════
 * Utilidades internas
 * ══════════════════════════════════════════════ */

// Agrupa los fragmentos de una página en líneas por coordenada Y.
const agruparEnLineas = (items) => {
  const mapa = new Map();

  items.forEach((item) => {
    const str = item.str;
    if (!str || !str.trim()) return;

    const x = item.transform[4];
    const y = item.transform[5];

    // Busca una línea existente con Y casi igual (el PDF puede tener
    // decimales distintos para fragmentos de la misma línea visual).
    let claveY = null;
    for (const y0 of mapa.keys()) {
      if (Math.abs(y0 - y) <= TOLERANCIA_Y) {
        claveY = y0;
        break;
      }
    }
    if (claveY === null) {
      claveY = y;
      mapa.set(claveY, []);
    }

    mapa.get(claveY).push({ x, str });
  });

  // Orden: de arriba hacia abajo (Y descendente); dentro de la línea, de
  // izquierda a derecha.
  return Array.from(mapa.entries())
    .map(([y, frags]) => ({
      y,
      frags: frags.sort((a, b) => a.x - b.x),
      texto: frags
        .sort((a, b) => a.x - b.x)
        .map((f) => f.str)
        .join(" ")
        .replace(/\s+/g, " ")
        .trim(),
    }))
    .sort((a, b) => b.y - a.y);
};

// ¿Esta línea es el encabezado de la tabla del anexo?
const esLineaEncabezado = (linea) => {
  const t = linea.texto.toUpperCase();
  return t.includes("EXPEDIENTE") && t.includes("CUIL") && t.includes("ORDEN");
};

// Busca el fragmento que contiene un CUIL dentro de la banda correspondiente.
// Se evalúa fragmento por fragmento (nunca el texto concatenado de la banda):
// si se concatenan celdas vecinas, los dígitos se pegan y el CUIL deja de ser
// reconocible (ej. "27-36719111-8" + "02 CLARA..." → "...-802CLARA").
const buscarFragmentoCuil = (linea) =>
  linea.frags.find(
    (f) =>
      f.x >= BANDAS.cuil[0] &&
      f.x < BANDAS.cuil[1] &&
      RE_CUIL.test(f.str.replace(/\s/g, ""))
  ) || null;

// ¿Esta línea es el "ancla" de una fila? (tiene N° de orden y un CUIL)
const esLineaAncla = (linea) => {
  const tieneOrden = linea.frags.some(
    (f) => f.x < BANDAS.orden[1] && RE_ORDEN.test(f.str.trim())
  );
  if (!tieneOrden) return false;
  return !!buscarFragmentoCuil(linea);
};

// Junta el texto de una banda X a lo largo de todas las líneas de un bloque.
const textoDeBanda = (lineasBloque, banda) => {
  const [xMin, xMax] = banda;
  const partes = [];
  lineasBloque.forEach((linea) => {
    linea.frags.forEach((f) => {
      if (f.x >= xMin && f.x < xMax) {
        const s = f.str.trim();
        if (s) partes.push(s);
      }
    });
  });
  return partes.join(" ").replace(/\s+/g, " ").trim();
};

/* ══════════════════════════════════════════════
 * Extracción de una fila
 * ══════════════════════════════════════════════ */

const extraerFila = ({ lineasBloque, lineaAncla, pagina, indiceEnPagina }) => {
  const textoBloque = lineasBloque.map((l) => l.texto).join(" ");

  // ── CUIL ──
  // Se toma del fragmento individual de la línea ancla. Nunca del texto
  // concatenado de la banda: al pegarse con la celda vecina los dígitos se
  // corrompen y el CUIL deja de ser válido.
  let cuilCrudo = "";
  const fragCuil = lineaAncla ? buscarFragmentoCuil(lineaAncla) : null;
  if (fragCuil) {
    cuilCrudo = fragCuil.str.trim();
  } else {
    // Respaldo: primer CUIL que aparezca en cualquier fragmento del bloque.
    for (const linea of lineasBloque) {
      const f = linea.frags.find((fr) =>
        RE_CUIL.test(fr.str.replace(/\s/g, ""))
      );
      if (f) {
        cuilCrudo = f.str.trim();
        break;
      }
    }
  }
  const cuil = normalizeCuil(cuilCrudo);
  const dni = normalizeDocumento(cuilCrudo);

  // ── EXPEDIENTE ──
  // El número viene partido en varias líneas ("EX-2025-01872607- -" + "CAT-" +
  // "DPRHED#MTPRH"); la banda los reúne en el orden correcto.
  const expedienteBanda = textoDeBanda(lineasBloque, BANDAS.expediente);
  const expediente =
    extraerExpedienteDesdeTexto(expedienteBanda) ||
    extraerExpedienteDesdeTexto(textoBloque) ||
    expedienteBanda;

  // ── Resto de columnas (informativas) ──
  const ordenTexto = textoDeBanda(lineasBloque, BANDAS.orden);

  return {
    pagina,
    indiceEnPagina,
    orden: ordenTexto.match(/\d{1,4}/)?.[0] || "",
    expedientePdf: expediente,
    expedienteCrudo: expedienteBanda,
    apellidoNombrePdf: textoDeBanda(lineasBloque, BANDAS.apellidoNombre),
    cuilPdf: cuilCrudo.trim(),
    cuil,
    dni,
    establecimiento: textoDeBanda(lineasBloque, BANDAS.establecimiento),
    idCargo: textoDeBanda(lineasBloque, BANDAS.idCargo),
    cargo: textoDeBanda(lineasBloque, BANDAS.cargo),
    nivel: textoDeBanda(lineasBloque, BANDAS.nivel),
    turno: textoDeBanda(lineasBloque, BANDAS.turno),
    modalidad: textoDeBanda(lineasBloque, BANDAS.modalidad),
    materia: textoDeBanda(lineasBloque, BANDAS.materia),
    situacionRevista: textoDeBanda(lineasBloque, BANDAS.situacionRevista),
    desde: textoDeBanda(lineasBloque, BANDAS.desde),
    hasta: textoDeBanda(lineasBloque, BANDAS.hasta),
    idPlaza: textoDeBanda(lineasBloque, BANDAS.idPlaza),
  };
};

/* ══════════════════════════════════════════════
 * Parseo de una página
 * ══════════════════════════════════════════════ */

const parsearPagina = ({ lineas, pagina }) => {
  const indiceEncabezado = lineas.findIndex(esLineaEncabezado);
  const tieneEncabezado = indiceEncabezado >= 0;

  // Solo consideramos las líneas que están por debajo del encabezado.
  // Así se descartan considerandos, artículos y títulos institucionales.
  const lineasCuerpo = tieneEncabezado
    ? lineas.slice(indiceEncabezado + 1)
    : lineas;

  const anclas = [];
  lineasCuerpo.forEach((linea, idx) => {
    if (esLineaAncla(linea)) anclas.push({ idx, y: linea.y });
  });

  // Sin anclas no hay tabla en esta página (es la resolución o la hoja de
  // firmas): se ignora por completo.
  if (anclas.length === 0) {
    return { filas: [], tieneTabla: false, tieneEncabezado };
  }

  // Alto típico de fila, medido entre anclas consecutivas. Sirve de respaldo
  // cuando la fila es la primera o la última de la página.
  const altoFila =
    anclas.length > 1
      ? Math.abs(anclas[0].y - anclas[1].y)
      : ALTO_FILA_POR_DEFECTO;

  // Cada fila abarca las líneas entre el punto medio con la ancla anterior y
  // el punto medio con la ancla siguiente. Para la primera y la última se usa
  // un margen simétrico (medio alto de fila) en vez de infinito: así quedan
  // afuera los renglones de continuación del encabezado (ej. "NOMBRES",
  // "DE REVISTA") y los pies de página.
  const filas = anclas.map((ancla, i) => {
    const yAnterior = i > 0 ? anclas[i - 1].y : null;
    const ySiguiente = i < anclas.length - 1 ? anclas[i + 1].y : null;

    const limiteSuperior =
      yAnterior !== null ? (yAnterior + ancla.y) / 2 : ancla.y + altoFila / 2;
    const limiteInferior =
      ySiguiente !== null ? (ancla.y + ySiguiente) / 2 : ancla.y - altoFila / 2;

    const lineasBloque = lineasCuerpo.filter(
      (l) => l.y <= limiteSuperior && l.y > limiteInferior
    );

    return extraerFila({
      lineasBloque,
      lineaAncla: lineasCuerpo[ancla.idx],
      pagina,
      indiceEnPagina: i + 1,
    });
  });

  return { filas, tieneTabla: true, tieneEncabezado };
};

/* ══════════════════════════════════════════════
 * API pública
 * ══════════════════════════════════════════════ */

/**
 * Lee un PDF de anexo y devuelve las filas de la tabla.
 *
 * @param {File|Blob|ArrayBuffer|Uint8Array} archivo
 * @param {(progreso: {pagina:number,totalPaginas:number}) => void} [onProgreso]
 * @returns {Promise<{
 *   filas: Array<object>,
 *   totalPaginas: number,
 *   paginasConTabla: number[],
 *   paginasConError: Array<{pagina:number,error:string}>,
 *   nombreArchivo: string,
 * }>}
 */
export const leerAnexoPdf = async (archivo, onProgreso) => {
  const nombreArchivo = archivo?.name || "documento.pdf";

  const data =
    archivo instanceof ArrayBuffer || archivo instanceof Uint8Array
      ? archivo
      : await archivo.arrayBuffer();

  const pdf = await pdfjsLib.getDocument({
    data: new Uint8Array(data),
    // No necesitamos renderizar: solo la capa de texto.
    disableFontFace: true,
    isEvalSupported: false,
  }).promise;

  const totalPaginas = pdf.numPages;
  const filas = [];
  const paginasConTabla = [];
  const paginasConError = [];

  for (let pagina = 1; pagina <= totalPaginas; pagina += 1) {
    try {
      const page = await pdf.getPage(pagina);
      const textContent = await page.getTextContent();
      const lineas = agruparEnLineas(textContent.items);

      const resultado = parsearPagina({ lineas, pagina });
      if (resultado.tieneTabla) {
        paginasConTabla.push(pagina);
        filas.push(...resultado.filas);
      }

      // Liberar memoria: los PDF de 40+ páginas acumulan mucho si no se limpia.
      page.cleanup();
    } catch (error) {
      // Una página corrupta no debe abortar todo el archivo (caso 19.17).
      console.error(`[pdfAnexoExpedientes] Error en página ${pagina}:`, error);
      paginasConError.push({
        pagina,
        error: error?.message || "Error desconocido al leer la página",
      });
    }

    onProgreso?.({ pagina, totalPaginas });
  }

  await pdf.destroy();

  return {
    filas,
    totalPaginas,
    paginasConTabla,
    paginasConError,
    nombreArchivo,
  };
};

/* ══════════════════════════════════════════════
 * Agrupación de duplicados (spec 6)
 * ══════════════════════════════════════════════ */

/**
 * Un mismo docente + expediente puede aparecer en varias filas del PDF porque
 * tiene varios cargos, horas cátedra o plazas. Se agrupan en un único registro
 * para no finalizar el expediente más de una vez.
 *
 * Devuelve además las filas que no se pueden agrupar (sin DNI o sin expediente
 * válidos), para poder mostrarlas como inválidas en la verificación.
 */
export const agruparFilasPdf = (filas) => {
  const grupos = new Map();
  const invalidas = [];

  filas.forEach((fila) => {
    const dniOk = fila.dni && fila.dni.length >= 7;
    const expOk = !!fila.expedientePdf;

    if (!dniOk || !expOk) {
      invalidas.push({
        ...fila,
        motivoInvalido: !dniOk
          ? "CUIL/DNI inválido o no detectado"
          : "Número de expediente inválido o no detectado",
      });
      return;
    }

    // La clave la calcula el llamador con claveRegistroPdf, pero acá la
    // recomponemos con los datos ya normalizados de la fila.
    const clave = `${fila.dni}|${fila.expedientePdf}`;

    if (!grupos.has(clave)) {
      grupos.set(clave, {
        ...fila,
        // Se conservan los datos de la PRIMERA aparición (spec 6.2)
        filasAgrupadas: 1,
        idsCargo: fila.idCargo ? [fila.idCargo] : [],
        idsPlaza: fila.idPlaza ? [fila.idPlaza] : [],
        paginas: [fila.pagina],
      });
      return;
    }

    const grupo = grupos.get(clave);
    grupo.filasAgrupadas += 1;
    if (fila.idCargo && !grupo.idsCargo.includes(fila.idCargo)) {
      grupo.idsCargo.push(fila.idCargo);
    }
    if (fila.idPlaza && !grupo.idsPlaza.includes(fila.idPlaza)) {
      grupo.idsPlaza.push(fila.idPlaza);
    }
    if (!grupo.paginas.includes(fila.pagina)) {
      grupo.paginas.push(fila.pagina);
    }
  });

  return {
    registros: Array.from(grupos.values()),
    invalidas,
    totalFilas: filas.length,
    totalRegistrosUnicos: grupos.size,
    totalDuplicadosAgrupados: Array.from(grupos.values()).reduce(
      (acc, g) => acc + (g.filasAgrupadas - 1),
      0
    ),
  };
};

export const __testing = {
  agruparEnLineas,
  parsearPagina,
  esLineaEncabezado,
  esLineaAncla,
  BANDAS,
};

export default { leerAnexoPdf, agruparFilasPdf };
