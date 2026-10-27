import {
  ministerioLayout,
  obtenerLayoutMinisterio,
} from "../layouts/ministerioLayout";

export const TEXTO_AUSPICIO_DEFAULT_MINISTERIO =
  "Este evento de capacitación, fortalecimiento y actualización docente fue auspiciado por el Ministerio de Educación y Trabajo, a través de Resolución";

export const NOMBRES_INSTITUCIONES_ORGANIZADORAS = Object.freeze({
  sidca: "SINDICATO DE DOCENTES DE CATAMARCA - SI.D.CA.",
  itm: "INSTITUTO TECNOLOGICO MUNICIPAL (I.T.M)",
});

export const ETIQUETAS_INSTITUCIONES_ORGANIZADORAS = Object.freeze({
  sidca: "SINDICATO DE DOCENTES DE CATAMARCA - SI.D.CA.",
  itm: "INSTITUTO TECNOLÓGICO MUNICIPAL (I.T.M)",
});

export const OPCIONES_INSTITUCIONES_ORGANIZADORAS = Object.freeze([
  { value: "sidca", label: ETIQUETAS_INSTITUCIONES_ORGANIZADORAS.sidca },
  { value: "itm", label: ETIQUETAS_INSTITUCIONES_ORGANIZADORAS.itm },
]);

const normalizarClaveInstitucion = (valor) =>
  String(valor || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase()
    .replace(/[._-]+/g, " ")
    .replace(/\s+/g, " ");

/**
 * Resuelve sólo instituciones conocidas. Los candidatos adicionales permiten
 * leer configuraciones anteriores sin convertir `ministerio` en organizador.
 * Si no hay un dato suficiente devuelve "" para conservar el comportamiento
 * histórico en vez de inventar SIDCA.
 */
export const normalizarInstitucionOrganizadora = (valor) => {
  const clave = normalizarClaveInstitucion(valor);
  if (!clave) return "";

  if (
    clave === "itm" ||
    clave.includes("instituto tecnologico municipal")
  ) {
    return "itm";
  }

  if (
    clave === "sidca" ||
    clave.includes("sindicato de docentes de catamarca") ||
    clave.includes("sidca")
  ) {
    return "sidca";
  }

  return "";
};

export const resolverInstitucionOrganizadora = (certificado) => {
  const candidatos = [
    certificado?.institucionOrganizadora,
    certificado?.institutionKey,
    certificado?.institucion,
    certificado?.organizador,
    certificado?.entidad,
    certificado?.issuer,
    certificado?.institucionCertificado,
  ];

  for (const candidato of candidatos) {
    const clave = normalizarInstitucionOrganizadora(candidato);
    if (clave) return clave;
  }

  return "";
};

export const nombreInstitucionOrganizadora = (certificado) => {
  const clave = resolverInstitucionOrganizadora(certificado);
  return NOMBRES_INSTITUCIONES_ORGANIZADORAS[clave] || "";
};

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
  const seleccionados = new Set(
    (Array.isArray(niveles) ? niveles : [])
      .map(texto)
      .filter(Boolean)
      .map((nivel) => nivel.toUpperCase())
  );
  const lista = ["INICIAL", "PRIMARIO", "SECUNDARIO", "SUPERIOR"]
    .filter((nivel) => seleccionados.has(nivel));
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

// El texto administrado es literal. El campo no se modifica al hidratar ni
// guardar; la composición visual sólo elimina un prefijo legacy si aparece.
export const normalizarTextoAuspicioMinisterio = (valor) => texto(valor);

/**
 * El default sólo se aplica cuando la configuración legacy no tiene la
 * propiedad. Un texto guardado vacío sigue siendo una edición válida.
 */
export const obtenerTextoAuspicioMinisterio = (configuracion) => {
  const tieneCampo =
    configuracion &&
    Object.prototype.hasOwnProperty.call(configuracion, "textoAuspicio");
  if (tieneCampo) return String(configuracion.textoAuspicio ?? "");
  return TEXTO_AUSPICIO_DEFAULT_MINISTERIO;
};

export const textoAuspicioConResolucion = (textoAuspicio, resolucion) => {
  const base = texto(textoAuspicio)
    .replace(/\s*S\.I\.E\.\(MECYT\)\s*N[°º]\s*/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
  const numero = normalizarNumeroResolucion(resolucion);
  if (!base) {
    return numero
      ? `Resolución ${numero}.`
      : "";
  }
  const partes = [base];
  if (numero) partes.push(numero);
  return agregarPunto(partes.join(" "));
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
  return `El presente certificado se expide en San Fernando Del Valle de Catamarca a ${dia} días del mes de ${meses[mes - 1]} de ${anio}.`;
};

const fechaCorta = (fecha) => {
  const valor = texto(fecha);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(valor)) return "";
  const [anio, mes, dia] = valor.split("-");
  return `${dia}/${mes}/${anio.slice(-2)}`;
};

export const formatearTituloMinisterio = (valor) => {
  const contenido = texto(valor)
    .replace(/^["“”]+/, "")
    .replace(/["“”]+$/, "")
    .trim();
  return contenido ? `"${contenido}"` : "";
};

const cargaHorariaPresentacion = (valor) => {
  const carga = texto(valor);
  if (!carga) return "";
  return /(?:horas?|hs\.?)\s*c[aá]tedras?/i.test(carga)
    ? carga
    : `${carga} horas cátedra`;
};

export const construirTextoMinisterio = (certificado, participante = {}) => {
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
  const nombre = texto(participante?.apellidoNombre || participante?.nombre);
  const dni = texto(participante?.dni);
  const auspicio = textoAuspicioConResolucion(
    obtenerTextoAuspicioMinisterio(certificado),
    certificado?.resolucion
  );
  const expedicion = fechaExpedicionMinisterio(certificado?.fecha);

  return {
    institucionOrganizadora: nombreInstitucionOrganizadora(certificado),
    modalidad,
    textoEvaluacion: evaluacion,
    firmantes: Array.isArray(certificado?.firmantesMinisterio)
      ? certificado.firmantesMinisterio
      : [],
    titulo: formatearTituloMinisterio(certificado?.titulo),
    participante: `Que ${nombre || "[APELLIDO Y NOMBRE]"} D.N.I. N° ${dni || "[DNI]"}`,
    actividad: `Participó y aprobó el ${texto(certificado?.tipoActividad) || "[TIPO DE ACTIVIDAD]"} denominado`,
    dictado: `Dictado de manera ${modalidad || "[MODALIDAD]"}, desde ${inicio || "[FECHA INICIO]"} al ${fin || "[FECHA FIN]"}${ubicacion}`,
    duracion: `con una duración de ${cargaHorariaPresentacion(certificado?.cargaHoraria) || "[CARGA HORARIA]"}${evaluacion ? `, ${evaluacion}` : "."}`,
    niveles: listarNivelesEnCastellano(certificado?.niveles),
    auspicio,
    textoAuspicioFinal: auspicio,
    expedicion,
    fechaExpedicion: expedicion,
  };
};

const fechaValida = (valor) => Boolean(fechaExpedicionMinisterio(valor));

export const calcularLayoutMinisterio = ({
  certificado,
  participante,
  mostrarInstitucion = Boolean(nombreInstitucionOrganizadora(certificado)),
}) => {
  const contexto = crearMedidor();
  if (!contexto) return { fits: false, errores: ["No se pudo medir el texto del certificado."] };
  const medida = (valor, tamanio, peso, familia) =>
    medirConCanvas(contexto, valor, tamanio, peso, familia);
  const { fonts,
    participante: cajaParticipante,
    actividad,
    titulo,
    cuerpo,
  } = obtenerLayoutMinisterio(mostrarInstitucion);
  const textos = construirTextoMinisterio(certificado, participante);
  const textoParticipante = textos.participante;
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
    text: textos.titulo || '"[TÍTULO DE LA CAPACITACIÓN]"',
    maxWidth: titulo.width,
    initialFontSize: fonts.title.initial,
    minFontSize: fonts.title.min,
    maxLines: titulo.maxLines,
    lineHeightFactor: fonts.title.lineHeightFactor,
    fontFamily: fonts.boldFamily,
    fontWeight: "700",
    measureText: medida,
  });
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

export const validarConfiguracionMinisterio = ({
  certificado,
  participante,
  mostrarInstitucion = Boolean(nombreInstitucionOrganizadora(certificado)),
}) => {
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

  const layout = calcularLayoutMinisterio({
    certificado,
    participante,
    mostrarInstitucion,
  });
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
