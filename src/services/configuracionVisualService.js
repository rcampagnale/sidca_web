// Presentación visual de los formularios `consulta_excel_agrupada`.
// La configuración vive en el formulario, nunca en las respuestas importadas.

export const COLOR_TARJETA = {
  VERDE: "verde",
  AMARILLO: "amarillo",
  ROJO: "rojo",
  SIN_COLOR: "sin_color",
};

export const MODO_COLOR = {
  SIN_COLOR: "sin_color",
  SEMAFORO_SI_NO: "semaforo_si_no",
  COLOR_SI_TIENE_VALOR: "color_si_tiene_valor",
  // Compatibilidad con la opción que ya se guardaba como modo directo.
  VERDE: COLOR_TARJETA.VERDE,
  AMARILLO: COLOR_TARJETA.AMARILLO,
  ROJO: COLOR_TARJETA.ROJO,
};

export const OPCIONES_MODO_COLOR = [
  { label: "Sin color", value: MODO_COLOR.SIN_COLOR },
  { label: "Semáforo SI / NO", value: MODO_COLOR.SEMAFORO_SI_NO },
  { label: "Verde si tiene valor", value: MODO_COLOR.VERDE },
  { label: "Amarillo si tiene valor", value: MODO_COLOR.AMARILLO },
  { label: "Rojo si tiene valor", value: MODO_COLOR.ROJO },
];

export const OPCIONES_COLOR = [
  { label: "Verde", value: COLOR_TARJETA.VERDE },
  { label: "Amarillo", value: COLOR_TARJETA.AMARILLO },
  { label: "Rojo", value: COLOR_TARJETA.ROJO },
  { label: "Sin color", value: COLOR_TARJETA.SIN_COLOR },
];

export const COLOR_INICIAL_SI = COLOR_TARJETA.SIN_COLOR;
export const COLOR_INICIAL_NO = COLOR_TARJETA.SIN_COLOR;

const COLORES_VALIDOS = new Set(Object.values(COLOR_TARJETA));
const COLOR_LEGACY_SI = COLOR_TARJETA.VERDE;
const COLOR_LEGACY_NO = COLOR_TARJETA.ROJO;

export const PRIORIDAD_COLOR = {
  [COLOR_TARJETA.SIN_COLOR]: 0,
  [COLOR_TARJETA.VERDE]: 1,
  [COLOR_TARJETA.AMARILLO]: 2,
  [COLOR_TARJETA.ROJO]: 3,
};

export const normalizarColorVisual = (valor) => {
  const texto = String(valor ?? "").trim().toLowerCase();
  if (texto === "ninguno") return COLOR_TARJETA.SIN_COLOR;
  return COLORES_VALIDOS.has(texto) ? texto : null;
};

export const normalizarValorSemaforo = (valor) => {
  const texto = String(valor ?? "").trim().toLowerCase();
  if (texto === "si" || texto === "sí") return "si";
  if (texto === "no") return "no";
  return "";
};

/** Distingue valores realmente informados de los marcadores visuales vacíos. */
export const tieneValorSignificativo = (valor) => {
  if (valor === null || valor === undefined) return false;
  if (typeof valor === "string") {
    const texto = valor.trim();
    return texto !== "" && texto !== "—" && texto !== "-";
  }
  return true;
};

const esColorDirecto = (modo) =>
  [COLOR_TARJETA.VERDE, COLOR_TARJETA.AMARILLO, COLOR_TARJETA.ROJO].includes(modo);

const colorConfiguradoPara = (regla, valor) => {
  const guardado = valor === "si"
    ? regla.reglas?.si ?? regla.colorSi
    : regla.reglas?.no ?? regla.colorNo;
  const hayColorGuardado = guardado !== undefined && guardado !== null && guardado !== "";

  if (hayColorGuardado) return normalizarColorVisual(guardado);
  return valor === "si" ? COLOR_LEGACY_SI : COLOR_LEGACY_NO;
};

const normalizarRegla = (regla) => {
  if (!regla?.campoKey) return null;
  const modo = regla.modo;

  if (modo === MODO_COLOR.SEMAFORO_SI_NO) {
    return {
      campoKey: regla.campoKey,
      campoLabel: regla.campoLabel || regla.campoKey,
      modo,
      reglas: {
        si: normalizarColorVisual(regla.reglas?.si ?? regla.colorSi) || COLOR_LEGACY_SI,
        no: normalizarColorVisual(regla.reglas?.no ?? regla.colorNo) || COLOR_LEGACY_NO,
      },
    };
  }

  const color = normalizarColorVisual(regla.color ?? (esColorDirecto(modo) ? modo : null));
  if (!color || color === COLOR_TARJETA.SIN_COLOR) return null;

  return {
    campoKey: regla.campoKey,
    campoLabel: regla.campoLabel || regla.campoKey,
    modo: MODO_COLOR.COLOR_SI_TIENE_VALOR,
    color,
  };
};

const normalizarEntradaTarjeta = (configuracion) => {
  if (!configuracion) return null;
  if (configuracion.tarjeta) return configuracion.tarjeta;
  if (configuracion.configuracionVisual?.tarjeta) return configuracion.configuracionVisual.tarjeta;
  return configuracion;
};

const normalizarEntradaVisual = (configuracion) => {
  if (!configuracion) return null;
  return configuracion.configuracionVisual || configuracion;
};

/**
 * Lee reglas nuevas y también la forma legacy de una regla única. Nunca hace
 * falta migrar manualmente formularios existentes: la conversión es en memoria.
 */
export const obtenerReglasTarjeta = (configuracion) => {
  const tarjeta = normalizarEntradaTarjeta(configuracion);
  if (!tarjeta || tarjeta.habilitado === false) return [];

  const origen = Array.isArray(tarjeta.reglasCampos)
    ? tarjeta.reglasCampos
    : tarjeta.modo && tarjeta.modo !== MODO_COLOR.SIN_COLOR
      ? [tarjeta]
      : [];

  return origen.map(normalizarRegla).filter(Boolean);
};

/** Devuelve una tarjeta normalizada para componentes que consumen esta API. */
export const obtenerConfiguracionTarjeta = (formulario) => {
  const tarjeta = normalizarEntradaTarjeta(formulario);
  const reglasCampos = obtenerReglasTarjeta(tarjeta);
  return reglasCampos.length ? { ...tarjeta, habilitado: true, reglasCampos } : null;
};

/**
 * Lee la presentación opcional del sello. Formularios anteriores que no la
 * tengan siguen devolviendo una configuración deshabilitada, sin migraciones.
 */
export const obtenerConfiguracionSello = (configuracion) => {
  const sello = normalizarEntradaVisual(configuracion)?.detalle?.selloEstado;
  return {
    habilitado: sello?.habilitado === true,
    textos: {
      [COLOR_TARJETA.VERDE]: String(sello?.textos?.[COLOR_TARJETA.VERDE] || "").trim(),
      [COLOR_TARJETA.AMARILLO]: String(sello?.textos?.[COLOR_TARJETA.AMARILLO] || "").trim(),
      [COLOR_TARJETA.ROJO]: String(sello?.textos?.[COLOR_TARJETA.ROJO] || "").trim(),
    },
  };
};

/** Construye la porción visual independiente de las reglas de tarjeta. */
export const construirConfiguracionSello = ({ habilitado = false, textos = {} } = {}) => ({
  habilitado: Boolean(habilitado),
  textos: {
    [COLOR_TARJETA.VERDE]: String(textos[COLOR_TARJETA.VERDE] || "").trim(),
    [COLOR_TARJETA.AMARILLO]: String(textos[COLOR_TARJETA.AMARILLO] || "").trim(),
    [COLOR_TARJETA.ROJO]: String(textos[COLOR_TARJETA.ROJO] || "").trim(),
  },
});

/**
 * Traduce exclusivamente el color final ya resuelto a un sello configurado.
 * No recalcula reglas, prioridades ni lee valores de columnas.
 */
export const obtenerSelloPorColor = (color, configuracionVisual) => {
  if (![COLOR_TARJETA.VERDE, COLOR_TARJETA.AMARILLO, COLOR_TARJETA.ROJO].includes(color)) {
    return null;
  }

  const configuracion = obtenerConfiguracionSello(configuracionVisual);
  if (!configuracion.habilitado) return null;

  const texto = configuracion.textos[color];
  return texto ? { color, texto } : null;
};

const resolverColorRegla = (registro, regla) => {
  const valor = registro?.[regla.campoKey];

  if (regla.modo === MODO_COLOR.COLOR_SI_TIENE_VALOR) {
    return tieneValorSignificativo(valor) ? regla.color : null;
  }

  if (regla.modo !== MODO_COLOR.SEMAFORO_SI_NO) return null;
  const semaforo = normalizarValorSemaforo(valor);
  if (!semaforo) return null;
  const color = colorConfiguradoPara(regla, semaforo);
  return color === COLOR_TARJETA.SIN_COLOR ? null : color;
};

/** Resuelve todas las reglas y conserva el color con mayor prioridad. */
export const resolverColorRegistro = (registro, configuracion) => {
  const colores = obtenerReglasTarjeta(configuracion)
    .map((regla) => resolverColorRegla(registro, regla))
    .filter(Boolean);

  const ganador = colores.reduce(
    (ganador, color) => (PRIORIDAD_COLOR[color] > PRIORIDAD_COLOR[ganador] ? color : ganador),
    COLOR_TARJETA.SIN_COLOR
  );
  return ganador === COLOR_TARJETA.SIN_COLOR ? null : ganador;
};

/**
 * Resuelve la situación visual general de una persona a partir de sus
 * registros. No persiste nada: aplica la misma prioridad ya vigente para cada
 * registro (rojo > amarillo > verde > neutro) cada vez que se consulta.
 */
export const resolverEstadoGeneralPersona = (respuesta, configuracion) => {
  const datosPersona = respuesta?.datosPersona || {};
  const registros = Array.isArray(respuesta?.registros) ? respuesta.registros : [];

  const ganador = registros.reduce((colorGeneral, registro) => {
    const registroCompleto = { ...datosPersona, ...registro };
    const colorRegistro = resolverColorRegistro(registroCompleto, configuracion);

    return PRIORIDAD_COLOR[colorRegistro] > PRIORIDAD_COLOR[colorGeneral]
      ? colorRegistro
      : colorGeneral;
  }, COLOR_TARJETA.SIN_COLOR);

  return ganador === COLOR_TARJETA.SIN_COLOR ? null : ganador;
};

/** Indicador exclusivamente para reglas semáforo del campo mostrado en detalle. */
export const obtenerIndicadorSemaforo = (registro, campo, configuracion) => {
  if (!campo?.key) return null;
  const regla = obtenerReglasTarjeta(configuracion).find(
    (item) => item.campoKey === campo.key && item.modo === MODO_COLOR.SEMAFORO_SI_NO
  );
  if (!regla) return null;

  const valor = registro?.[campo.key];
  const normalizado = normalizarValorSemaforo(valor);
  if (!normalizado) return null;

  const color = colorConfiguradoPara(regla, normalizado);
  if (!color || color === COLOR_TARJETA.SIN_COLOR) return null;
  return { color, valor: String(valor).trim() };
};

/** Compatibilidad con consumidores previos de la API de un solo campo. */
export const esCampoDeColor = (campo, configuracion) =>
  obtenerReglasTarjeta(configuracion).some((regla) => regla.campoKey === campo?.key);

export const obtenerValorIndicador = (registro, configuracion) => {
  const regla = obtenerReglasTarjeta(configuracion).find(
    (item) => item.modo === MODO_COLOR.SEMAFORO_SI_NO
  );
  const valor = regla ? registro?.[regla.campoKey] : null;
  return valor === null || valor === undefined ? "" : String(valor).trim();
};

/** Construye el formato nuevo de escritura; acepta reglas ya normalizadas. */
export const construirConfiguracionTarjeta = ({ reglasCampos = [], modo, campo, colorSi, colorNo } = {}) => {
  const reglasOrigen = reglasCampos.length
    ? reglasCampos
    : modo && modo !== MODO_COLOR.SIN_COLOR
      ? [{ campoKey: campo?.key, campoLabel: campo?.label, modo, color: modo, colorSi, colorNo, reglas: { si: colorSi, no: colorNo } }]
      : [];
  const reglas = reglasOrigen.map(normalizarRegla).filter(Boolean);

  return {
    habilitado: reglas.length > 0,
    reglasCampos: reglas,
  };
};
