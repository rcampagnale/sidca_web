import * as XLSX from "xlsx";

export const TIPOS_CAMPO_EXCEL = {
  IDENTIFICADOR: "IDENTIFICADOR",
  DATO_PERSONA: "DATO_PERSONA",
  DETALLE: "DETALLE",
};

const texto = (valor) => (valor === null || valor === undefined ? "" : String(valor).trim());

export const normalizarNombreColumna = (nombre) => {
  const base = texto(nombre)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, " ")
    .trim()
    .toLowerCase();

  const partes = base.split(/\s+/).filter(Boolean);
  if (partes.length === 0) return "columna";

  return partes
    .map((parte, index) =>
      index === 0 ? parte : `${parte.charAt(0).toUpperCase()}${parte.slice(1)}`
    )
    .join("");
};

export const crearClavesColumnas = (encabezados = []) => {
  const usadas = new Map();

  return encabezados.map((encabezado, index) => {
    const label = texto(encabezado) || `Columna ${index + 1}`;
    const sourceHeader =
      encabezado === null || encabezado === undefined || String(encabezado) === ""
        ? label
        : String(encabezado);
    const base = normalizarNombreColumna(label);
    const cantidad = usadas.get(base) || 0;
    usadas.set(base, cantidad + 1);

    return {
      key: cantidad === 0 ? base : `${base}_${cantidad + 1}`,
      label,
      sourceHeader,
      orden: index,
      index,
    };
  });
};

const obtenerFilasDeHoja = (sheet) =>
  XLSX.utils.sheet_to_json(sheet, {
    header: 1,
    defval: "",
    raw: false,
    blankrows: false,
  });

const obtenerTextoHeader = (header) =>
  typeof header === "string"
    ? header
    : header?.sourceHeader || header?.label || "";

/**
 * Resuelve una columna configurada contra los encabezados reales del Excel.
 * Prioriza el encabezado original y conserva compatibilidad con formularios
 * creados antes de guardar sourceHeader.
 */
export const resolverHeader = (campo = {}, headersExcel = []) => {
  const entradas = headersExcel.map((header) => ({
    header,
    texto: obtenerTextoHeader(header),
  }));
  const sourceHeader = texto(campo.sourceHeader || campo.originalHeader);
  const label = texto(campo.label);
  const key = texto(campo.key);

  const buscarExacto = (valor) =>
    valor ? entradas.find((entrada) => entrada.texto === valor) : null;

  const exactoSource = buscarExacto(sourceHeader);
  if (exactoSource) return exactoSource.header;

  const exactoLabel = buscarExacto(label);
  if (exactoLabel) return exactoLabel.header;

  const candidatos = [sourceHeader, label, key]
    .filter(Boolean)
    .map((valor) => normalizarNombreColumna(valor));
  const equivalente = entradas.find((entrada) =>
    candidatos.includes(normalizarNombreColumna(entrada.texto))
  );

  return equivalente ? equivalente.header : null;
};

/**
 * ¿El valor cuenta como vacío?
 *
 * Deliberadamente NO usa `!valor`: eso descartaría un 0 numérico o la cadena
 * "0", que en columnas como HS o Año/Secc son datos válidos.
 */
const esValorVacio = (valor) =>
  valor === null || valor === undefined || String(valor).trim() === "";

/**
 * Lee el valor de un campo en una fila, sea cual sea la forma de la fila.
 *
 * Punto único de acceso: hoy `leerEstructuraExcel` devuelve objetos indexados
 * por la clave interna (`dni`, `apellido`, …), pero este helper también acepta
 * filas como array —resueltas por índice de columna— y objetos indexados por
 * el encabezado original del Excel. Así un cambio futuro en la representación
 * de las filas no obliga a tocar cada consumidor, y los formularios creados
 * antes de que se guardara `sourceHeader` siguen resolviéndose.
 *
 * El orden de preferencia va de lo más específico a lo más general y se corta
 * en el primer valor presente; un "" explícito es un valor y detiene la
 * búsqueda.
 */
export const obtenerValorCampoFila = (fila, campo = {}) => {
  if (!fila) return "";

  if (Array.isArray(fila)) {
    const indice = campo.sourceIndex ?? campo.index;
    return Number.isInteger(indice) ? fila[indice] ?? "" : "";
  }

  const candidatos = [campo.key, campo.sourceHeader, campo.label].filter(
    (clave) => clave !== null && clave !== undefined && clave !== ""
  );

  for (const clave of candidatos) {
    const valor = fila[clave];
    if (valor !== undefined) return valor;
  }

  return "";
};

/**
 * Obtiene la columna identificadora aceptando las dos formas con las que se
 * la invoca en el proyecto: la configuración completa del formulario
 * (`{ columnaAgrupacion: {...} }`) o directamente el descriptor de columna.
 *
 * Existe porque confundir ambas no producía un error visible: devolvía `{}`,
 * y con `columna.key === undefined` TODAS las filas quedaban "sin
 * identificador" en vez de fallar. Resolverlo acá deja el resultado
 * independiente de cuál de las dos formas reciba.
 */
export const resolverColumnaAgrupacion = (configuracionOColumna = {}) => {
  if (!configuracionOColumna) return {};
  if (configuracionOColumna.columnaAgrupacion) {
    return configuracionOColumna.columnaAgrupacion || {};
  }
  return configuracionOColumna;
};

/**
 * Convierte filas leídas con claves internas a las claves configuradas del
 * formulario, usando la correspondencia con el encabezado de origen.
 */
export const normalizarFilasExcel = (
  filas = [],
  camposConfigurados = [],
  columnasExcel = []
) => {
  const correspondencias = camposConfigurados.map((campo) => {
    const columna = resolverHeader(campo, columnasExcel);
    return { campo, columna };
  });
  const faltantes = correspondencias
    .filter(({ columna }) => !columna)
    .map(({ campo }) => campo);

  const filasNormalizadas = filas.map((fila) => {
    const salida = {};
    correspondencias.forEach(({ campo, columna }) => {
      salida[campo.key] = columna ? obtenerValorCampoFila(fila, columna) : "";
    });
    return salida;
  });

  return { filas: filasNormalizadas, correspondencias, faltantes };
};

export const leerEstructuraExcel = async (file) => {
  if (!file || !file.name) throw new Error("Seleccione un archivo Excel.");
  if (!/\.(xlsx|xls)$/i.test(file.name)) {
    throw new Error("El archivo debe tener formato .xlsx o .xls.");
  }

  const buffer = await file.arrayBuffer();
  if (!buffer || buffer.byteLength === 0) throw new Error("El archivo está vacío.");

  const workbook = XLSX.read(buffer, { type: "array", cellDates: true });
  const sheetName = workbook.SheetNames?.[0];
  if (!sheetName) throw new Error("El archivo no contiene hojas.");

  const rows = obtenerFilasDeHoja(workbook.Sheets[sheetName]);
  const headerIndex = rows.findIndex(
    (row) => Array.isArray(row) && row.some((cell) => texto(cell))
  );
  if (headerIndex < 0) throw new Error("No se encontraron encabezados.");

  const encabezados = rows[headerIndex] || [];
  const columnas = crearClavesColumnas(encabezados);
  if (columnas.length === 0) throw new Error("No se encontraron columnas.");
  const conteoEncabezados = columnas.reduce((conteo, columna) => {
    const clave = normalizarNombreColumna(columna.label);
    conteo[clave] = (conteo[clave] || 0) + 1;
    return conteo;
  }, {});
  const encabezadosDuplicados = Object.keys(conteoEncabezados).filter(
    (clave) => conteoEncabezados[clave] > 1
  );

  const filas = rows
    .slice(headerIndex + 1)
    .filter((row) => row.some((cell) => texto(cell)))
    .map((row) => {
      const values = {};
      columnas.forEach((columna) => {
        values[columna.key] = row[columna.index] ?? "";
      });
      return values;
    });

  return {
    nombreArchivo: file.name,
    hoja: sheetName,
    filas,
    columnas,
    indiceEncabezados: headerIndex,
    hojasDisponibles: workbook.SheetNames,
    encabezadosDuplicados,
  };
};

export const inferirTipoCampo = (columna, indiceAgrupador) => {
  if (columna.key === indiceAgrupador) return TIPOS_CAMPO_EXCEL.IDENTIFICADOR;
  const normalizado = normalizarNombreColumna(columna.label);
  if (["apellido", "nombre", "nombres", "apellidos"].includes(normalizado)) {
    return TIPOS_CAMPO_EXCEL.DATO_PERSONA;
  }
  return TIPOS_CAMPO_EXCEL.DETALLE;
};

export const detectarColumnaAgrupacion = (columnas = []) => {
  const candidatos = ["dni", "documento", "nroDocumento", "numeroDocumento"];
  return (
    columnas.find((columna) => candidatos.includes(normalizarNombreColumna(columna.label))) ||
    columnas[0] ||
    null
  );
};

export const normalizarIdentificador = (valor, columna = {}) => {
  // esValorVacio en vez de `!valor`: un 0 es un valor presente, no un vacío.
  if (esValorVacio(valor)) return "";
  const original = texto(valor);

  const esDni = ["dni", "documento", "nroDocumento", "numeroDocumento"].includes(
    normalizarNombreColumna(columna.label || columna.key)
  );

  if (esDni) return original.replace(/[^0-9]/g, "");
  return original.replace(/\s+/g, " ");
};

/**
 * Agrupa las filas ya normalizadas por su identificador.
 *
 * `configuracion` acepta tanto la configuración completa del formulario como
 * el descriptor de la columna agrupadora; ver resolverColumnaAgrupacion().
 */
export const agruparFilasPorIdentificador = (filas = [], configuracion = {}) => {
  const columna = resolverColumnaAgrupacion(configuracion);
  const grupos = new Map();
  const filasSinIdentificador = [];
  const identificadoresInvalidos = [];

  filas.forEach((fila, index) => {
    const identificador = normalizarIdentificador(
      obtenerValorCampoFila(fila, columna),
      columna
    );
    if (!identificador) {
      filasSinIdentificador.push(index + 1);
      return;
    }

    if (["dni", "documento", "nroDocumento", "numeroDocumento"].includes(
      normalizarNombreColumna(columna.label || columna.key)
    ) && !/^\d+$/.test(identificador)) {
      identificadoresInvalidos.push(index + 1);
      return;
    }

    if (!grupos.has(identificador)) grupos.set(identificador, []);
    grupos.get(identificador).push({ ...fila, __filaExcel: index + 1 });
  });

  return { grupos, filasSinIdentificador, identificadoresInvalidos };
};

export const generarPreviewImportacion = ({ grupos, filasSinIdentificador, identificadoresInvalidos, columnasSeleccionadas, totalFilas }) => {
  const cantidades = Array.from(grupos.values()).map((filas) => filas.length);
  return {
    filasProcesables: cantidades.reduce((total, cantidad) => total + cantidad, 0),
    identificadoresUnicos: grupos.size,
    personasUnaFila: cantidades.filter((cantidad) => cantidad === 1).length,
    personasMultiplesFilas: cantidades.filter((cantidad) => cantidad > 1).length,
    maximoRegistros: cantidades.length ? Math.max(...cantidades) : 0,
    columnasUtilizadas: columnasSeleccionadas.length,
    columnasIgnoradas: Math.max(0, (columnasSeleccionadas.__total || columnasSeleccionadas.length) - columnasSeleccionadas.length),
    filasSinIdentificador: filasSinIdentificador.length,
    identificadoresInvalidos: identificadoresInvalidos.length,
    totalFilas: totalFilas || 0,
  };
};

export const crearIdRespuestaAgrupada = (formularioId, identificador) => {
  const seguro = String(identificador || "sin_identificador")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9_-]/g, "_");
  return `${formularioId}_${seguro}`;
};

export const transformarGrupoAFirestore = ({ formulario, grupo, identificador }) => {
  const configuracion = formulario.configuracionExcel || {};
  const campos = [...(configuracion.camposSeleccionados || [])].sort(
    (a, b) => Number(a.orden || 0) - Number(b.orden || 0)
  );
  const identificadorCampo = configuracion.columnaAgrupacion || {};
  const camposPersona = campos.filter((campo) => campo.tipo === TIPOS_CAMPO_EXCEL.DATO_PERSONA);
  const camposDetalle = campos.filter((campo) => campo.tipo === TIPOS_CAMPO_EXCEL.DETALLE);
  const primeraFila = grupo[0] || {};
  const datosPersona = {
    [identificadorCampo.key]: identificador,
  };

  camposPersona.forEach((campo) => {
    datosPersona[campo.key] = primeraFila[campo.key] ?? "";
  });

  const registros = grupo.map((fila) => {
    const detalle = {};
    camposDetalle.forEach((campo) => {
      detalle[campo.key] = fila[campo.key] ?? "";
    });
    return detalle;
  });

  return {
    formularioId: formulario.id,
    formularioCodigo: formulario.formularioCodigo || formulario.id,
    formularioNumero: formulario.formularioNumero || formulario.formularioCodigo || formulario.id,
    formularioTitulo: formulario.titulo || "Formulario Excel",
    tipoRespuesta: "excel_agrupada",
    origen: "importacion_excel",
    identificador,
    dni: normalizarNombreColumna(identificadorCampo.label || identificadorCampo.key).includes("dni")
      ? identificador
      : "",
    datosPersona,
    cantidadRegistros: registros.length,
    registros,
    camposSeleccionados: campos,
    updatedAt: new Date(),
  };
};
