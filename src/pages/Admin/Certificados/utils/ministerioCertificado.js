import { ministerioLayout } from "../layouts/ministerioLayout";

const texto = (valor) => String(valor || "").replace(/\s+/g, " ").trim();

const MESES = {
  enero: 1,
  febrero: 2,
  marzo: 3,
  abril: 4,
  mayo: 5,
  junio: 6,
  julio: 7,
  agosto: 8,
  septiembre: 9,
  setiembre: 9,
  octubre: 10,
  noviembre: 11,
  diciembre: 12,
};

const construirFechaIso = (dia, mes, anio) => {
  const fecha = new Date(Date.UTC(anio, mes - 1, dia));

  if (
    fecha.getUTCFullYear() !== anio ||
    fecha.getUTCMonth() !== mes - 1 ||
    fecha.getUTCDate() !== dia
  ) {
    return "";
  }

  return `${String(anio).padStart(4, "0")}-${String(mes).padStart(2, "0")}-${String(dia).padStart(2, "0")}`;
};

export const normalizarFechaParaInput = (valor) => {
  if (!valor) return "";

  if (valor?.toDate && typeof valor.toDate === "function") {
    return normalizarFechaParaInput(valor.toDate());
  }

  if (valor instanceof Date && !Number.isNaN(valor.getTime())) {
    return construirFechaIso(
      valor.getUTCDate(),
      valor.getUTCMonth() + 1,
      valor.getUTCFullYear()
    );
  }

  if (typeof valor === "object" && typeof valor.seconds === "number") {
    return normalizarFechaParaInput(new Date(valor.seconds * 1000));
  }

  const normalizado = texto(valor)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();

  let coincidencia = normalizado.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (coincidencia) {
    return construirFechaIso(
      Number(coincidencia[3]),
      Number(coincidencia[2]),
      Number(coincidencia[1])
    );
  }

  coincidencia = normalizado.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
  if (coincidencia) {
    return construirFechaIso(
      Number(coincidencia[1]),
      Number(coincidencia[2]),
      Number(coincidencia[3])
    );
  }

  coincidencia = normalizado.match(
    /^(\d{1,2})\s+de\s+([a-z]+)\s+(?:del|de)\s+(\d{4})$/
  );
  if (!coincidencia) return "";

  const mes = MESES[coincidencia[2]];
  if (!mes) return "";

  return construirFechaIso(
    Number(coincidencia[1]),
    mes,
    Number(coincidencia[3])
  );
};

const crearMedidor = () => {
  const canvas = document.createElement("canvas");
  return canvas.getContext("2d");
};

const medirConCanvas = (contexto, valor, fontSize, fontWeight, fontFamily) => {
  // El lienzo lógico usa un píxel por punto PDF. Medir en px mantiene la
  // misma métrica que el DOM que html2canvas captura para jsPDF.
  contexto.font = `${fontWeight} ${fontSize}px ${fontFamily}`;
  return contexto.measureText(valor).width;
};

export const fitText = ({
  text,
  maxWidth,
  maxHeight = Infinity,
  initialFontSize,
  minFontSize,
  maxLines,
  lineHeightFactor,
  fontFamily = ministerioLayout.fonts.family,
  fontWeight = "400",
  preferredBreakBefore = "",
  measureText,
}) => {
  const contenido = texto(text);
  const medir = measureText || (() => 0);
  const palabras = contenido ? contenido.split(" ") : [""];
  const indiceCorte = preferredBreakBefore
    ? contenido.indexOf(preferredBreakBefore)
    : -1;
  const lineasPreferidas =
    indiceCorte > 0
      ? [
          contenido.slice(0, indiceCorte).trim(),
          contenido.slice(indiceCorte).trim(),
        ]
      : null;

  for (let fontSize = initialFontSize; fontSize >= minFontSize; fontSize -= 0.25) {
    if (lineasPreferidas) {
      const lineHeight = fontSize * lineHeightFactor;
      const altura = lineasPreferidas.length * lineHeight;
      const entra = lineasPreferidas.every(
        (linea) => medir(linea, fontSize, fontWeight, fontFamily) <= maxWidth
      );
      if (entra && lineasPreferidas.length <= maxLines && altura <= maxHeight) {
        return {
          fontSize,
          lines: lineasPreferidas,
          lineHeight,
          height: altura,
          fits: true,
        };
      }
    }

    const lineas = [];
    let linea = "";

    palabras.forEach((palabra) => {
      const candidata = linea ? `${linea} ${palabra}` : palabra;
      if (linea && medir(candidata, fontSize, fontWeight, fontFamily) > maxWidth) {
        lineas.push(linea);
        linea = palabra;
      } else {
        linea = candidata;
      }
    });

    if (linea || !lineas.length) lineas.push(linea);

    const lineHeight = fontSize * lineHeightFactor;
    const height = lineas.length * lineHeight;
    const palabraMasLargaEntra = palabras.every(
      (palabra) => medir(palabra, fontSize, fontWeight, fontFamily) <= maxWidth
    );

    if (
      palabraMasLargaEntra &&
      lineas.length <= maxLines &&
      height <= maxHeight
    ) {
      return { fontSize, lines: lineas, lineHeight, height, fits: true };
    }
  }

  const lineHeight = minFontSize * lineHeightFactor;
  return {
    fontSize: minFontSize,
    lines: [contenido],
    lineHeight,
    height: lineHeight,
    fits: false,
  };
};

const centrarBloqueVertical = ({ limiteInferior, limiteSuperior, altura }) =>
  limiteInferior + (limiteSuperior - limiteInferior - altura) / 2;

export const listarNivelesEnCastellano = (niveles) => {
  const lista = (Array.isArray(niveles) ? niveles : [])
    .map(texto)
    .filter(Boolean);
  if (!lista.length) return "";
  if (lista.length === 1) return `Para el nivel ${lista[0]}.`;
  const enumerados =
    lista.length === 2
      ? lista.join(" y ")
      : `${lista.slice(0, -1).join(", ")} y ${lista[lista.length - 1]}`;
  return `Para los niveles ${enumerados}.`;
};

const agregarPunto = (valor) => {
  const resultado = texto(valor);
  return resultado && !/[.!?]$/.test(resultado) ? `${resultado}.` : resultado;
};

const normalizarNumeroResolucion = (valor) =>
  texto(valor).replace(/^resoluci[oó]n\b[\s:.-]*/i, "");

const ETIQUETA_RESOLUCION_MINISTERIO = "S.I.E.(MECYT) N°";

export const normalizarTextoAuspicioMinisterio = (valor) =>
  texto(valor)
    .replace(
      /resoluci[oó]n\s+S\.I\.C\.E\.\(MET\)\s*N[°º]\s*$/i,
      `Resolución ${ETIQUETA_RESOLUCION_MINISTERIO}`
    )
    .replace(
      /resoluci[oó]n\s*$/i,
      `Resolución ${ETIQUETA_RESOLUCION_MINISTERIO}`
    );

const quitarResolucionDuplicada = (valor) =>
  texto(valor)
    .replace(/(N[°º])\.\s*/gi, "$1 ")
    .replace(/(N[°º]\.?\s*)resoluci[oó]n\b\s*/i, "$1");

export const textoAuspicioConResolucion = (textoAuspicio, resolucion) => {
  const base = normalizarTextoAuspicioMinisterio(textoAuspicio);
  const numero = normalizarNumeroResolucion(resolucion);
  if (!base) {
    return numero
      ? `Resolución ${ETIQUETA_RESOLUCION_MINISTERIO} ${numero}.`
      : "";
  }
  if (!numero) return agregarPunto(base);
  const resultado = /N[°º]\s*$/i.test(base)
    ? `${base} ${numero}.`
    : `${agregarPunto(base)} Resolución ${ETIQUETA_RESOLUCION_MINISTERIO} ${numero}.`;
  return quitarResolucionDuplicada(resultado);
};

export const fechaExpedicionMinisterio = (fecha) => {
  const valor = texto(fecha);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(valor)) return "";
  const [anio, mes, dia] = valor.split("-").map(Number);
  const fechaUtc = new Date(Date.UTC(anio, mes - 1, dia));
  if (
    fechaUtc.getUTCFullYear() !== anio ||
    fechaUtc.getUTCMonth() !== mes - 1 ||
    fechaUtc.getUTCDate() !== dia
  ) {
    return "";
  }
  const meses = [
    "enero", "febrero", "marzo", "abril", "mayo", "junio",
    "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
  ];
  return `El presente certificado se expide en San Fernando del Valle de Catamarca a ${dia} días del mes de ${meses[mes - 1]} de ${anio}.`;
};

const fechaCorta = (fecha) => {
  const valor = texto(fecha);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(valor)) return "";
  const [anio, mes, dia] = valor.split("-");
  return `${dia}/${mes}/${anio.slice(-2)}`;
};

export const construirTextoMinisterio = (certificado) => {
  const modalidad = texto(certificado?.modalidad);
  const inicio = fechaCorta(certificado?.fechaInicio);
  const fin = fechaCorta(certificado?.fechaFin);
  const localidad = texto(certificado?.localidad);
  const departamento = texto(certificado?.departamento);
  const ubicacion = localidad
    ? `, en la Localidad de ${localidad}${departamento ? ` -DPTO ${departamento}` : ""}`
    : departamento
    ? `, -DPTO ${departamento}`
    : "";
  const evaluacion = texto(certificado?.textoEvaluacion);

  return {
    actividad: `Participó y aprobó el ${texto(certificado?.tipoActividad) || "[TIPO DE ACTIVIDAD]"} denominado`,
    dictado: `Dictado de manera ${modalidad || "[MODALIDAD]"}, desde ${inicio || "[FECHA INICIO]"} al ${fin || "[FECHA FIN]"}${ubicacion}.`,
    duracion: `Con una duración de ${texto(certificado?.cargaHoraria) || "[CARGA HORARIA]"} horas cátedra${evaluacion ? `, ${evaluacion}` : "."}`,
    niveles: listarNivelesEnCastellano(certificado?.niveles),
    auspicio: textoAuspicioConResolucion(
      certificado?.textoAuspicio,
      certificado?.resolucion
    ),
    expedicion: fechaExpedicionMinisterio(certificado?.fecha),
  };
};

const fechaValida = (valor) => Boolean(fechaExpedicionMinisterio(valor));

export const calcularLayoutMinisterio = ({ certificado, participante }) => {
  const contexto = crearMedidor();
  if (!contexto) return { fits: false, errores: ["No se pudo medir el texto del certificado."] };
  const medida = (valor, tamanio, peso, familia) =>
    medirConCanvas(contexto, valor, tamanio, peso, familia);
  const {
    fonts,
    participante: cajaParticipante,
    actividad,
    titulo,
    cuerpo,
  } = ministerioLayout;
  const nombre = texto(participante?.apellidoNombre) || "[APELLIDO Y NOMBRE]";
  const dni = texto(participante?.dni) || "[DNI]";
  const textoParticipante = `Que ${nombre} D.N.I. N° ${dni}`;
  const participanteFit = fitText({
    text: textoParticipante,
    maxWidth: cajaParticipante.width,
    initialFontSize: fonts.participant.initial,
    minFontSize: fonts.participant.min,
    maxLines: cajaParticipante.maxLines,
    lineHeightFactor: fonts.participant.lineHeightFactor,
    fontFamily: fonts.family,
    fontWeight: "400",
    measureText: medida,
  });
  const tituloFit = fitText({
    // Las comillas forman parte del texto renderizado y, por lo tanto, de su
    // ancho y altura reales al centrar el bloque.
    text: `“${texto(certificado?.titulo) || "[TÍTULO DE LA CAPACITACIÓN]"}”`,
    maxWidth: titulo.width,
    initialFontSize: fonts.title.initial,
    minFontSize: fonts.title.min,
    maxLines: titulo.maxLines,
    lineHeightFactor: fonts.title.lineHeightFactor,
    fontFamily: fonts.boldFamily,
    fontWeight: "700",
    measureText: medida,
  });
  const textos = construirTextoMinisterio(certificado);
  const definicionBloques = [
    { contenido: textos.dictado, maxLines: 1 },
    { contenido: textos.duracion, maxLines: 1 },
    { contenido: textos.niveles, maxLines: 1 },
    {
      contenido: textos.auspicio,
      maxLines: 2,
      preferredBreakBefore: "el Ministerio de Educación y Trabajo",
    },
    { contenido: textos.expedicion, maxLines: 1 },
  ];
  const bloques = definicionBloques
    .filter(({ contenido }) => Boolean(contenido))
    .map(({ contenido, maxLines, preferredBreakBefore }) => fitText({
      text: contenido,
      maxWidth: cuerpo.width,
      initialFontSize: fonts.body.size,
      minFontSize: fonts.body.min,
      maxLines,
      lineHeightFactor: fonts.body.lineHeightFactor,
      fontFamily: fonts.family,
      fontWeight: "400",
      preferredBreakBefore,
      measureText: medida,
    }));
  let currentY = titulo.y + tituloFit.height + cuerpo.gapAfterTitle;
  const cuerpoConY = bloques.map((bloque) => {
    const resultado = { ...bloque, y: currentY };
    currentY += bloque.height + cuerpo.gapBetweenBlocks;
    return resultado;
  });
  const limiteInferiorActividad =
    actividad.y + fonts.activity.size;
  const limiteSuperiorDictado = cuerpoConY[0]?.y ?? currentY;
  const tituloTop = centrarBloqueVertical({
    limiteInferior: limiteInferiorActividad,
    limiteSuperior: limiteSuperiorDictado,
    altura: tituloFit.height,
  });

  return {
    participanteFit,
    tituloFit,
    tituloCenterY: tituloTop + tituloFit.height / 2,
    textos,
    cuerpo: cuerpoConY,
    cuerpoBottom: currentY - cuerpo.gapBetweenBlocks,
    fits:
      participanteFit.fits && tituloFit.fits &&
      cuerpoConY.every((bloque) => bloque.fits) &&
      currentY - cuerpo.gapBetweenBlocks < cuerpo.maxBottom,
  };
};

export const validarConfiguracionMinisterio = ({ certificado, participante }) => {
  const errores = [];
  const requerido = [
    ["titulo", "Falta el título del certificado."],
    ["modalidad", "Falta la modalidad."],
    ["cargaHoraria", "Falta la carga horaria."],
    ["resolucion", "Falta la resolución."],
    ["tipoActividad", "Falta el tipo de actividad."],
    ["fechaInicio", "Falta la fecha de inicio."],
    ["fechaFin", "Falta la fecha de finalización."],
    ["fecha", "Falta la fecha de expedición."],
  ];
  requerido.forEach(([campo, mensaje]) => {
    if (!texto(certificado?.[campo])) errores.push(mensaje);
  });
  if (!texto(participante?.apellidoNombre)) errores.push("Falta el nombre del participante.");
  if (!texto(participante?.dni)) errores.push("Falta el DNI del participante.");
  if (!Array.isArray(certificado?.niveles) || !certificado.niveles.filter(texto).length) {
    errores.push("Seleccioná al menos un nivel educativo.");
  }
  if (texto(certificado?.fechaInicio) && texto(certificado?.fechaFin) && certificado.fechaInicio > certificado.fechaFin) {
    errores.push("La fecha de finalización no puede ser anterior a la fecha de inicio.");
  }
  if (texto(certificado?.fecha) && !fechaValida(certificado.fecha)) {
    errores.push("La fecha de expedición no es válida.");
  }

  const activos = (Array.isArray(certificado?.firmantesMinisterio) ? certificado.firmantesMinisterio : [])
    .filter((firmante) => firmante?.activo !== false);
  if (!activos.length) errores.push("Debe existir al menos un firmante activo.");
  activos.forEach((firmante, indice) => {
    const nombre = texto(firmante?.nombre) || `Firmante ${indice + 1}`;
    if (!texto(firmante?.nombre) || !texto(firmante?.cargo) || !texto(firmante?.organismo)) {
      errores.push(`El firmante "${nombre}" debe tener nombre, cargo y organismo.`);
    }
    if (!texto(firmante?.imagenStoragePath) || Number(firmante?.imagenVersion) <= 0 || !/^[a-f0-9]{64}$/.test(texto(firmante?.imagenSha256))) {
      errores.push(`El firmante "${nombre}" todavía no tiene una firma digital guardada. Cargue la firma desde Configuración antes de emitir certificados.`);
    }
  });

  const layout = calcularLayoutMinisterio({ certificado, participante });
  if (!layout.tituloFit?.fits) {
    errores.push("El nombre de la capacitación excede el espacio disponible del Modelo Ministerio.");
  }
  if (!layout.participanteFit?.fits) {
    errores.push("El nombre del participante excede el espacio disponible del Modelo Ministerio.");
  }
  if (layout.cuerpo && !layout.fits) {
    errores.push("El cuerpo del certificado invade la zona reservada para las firmas.");
  }

  return { valid: errores.length === 0, errores, layout };
};
