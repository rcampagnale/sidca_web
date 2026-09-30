const FIELD_ALIASES = {
  dni: ["dni", "documento", "nro dni", "numero de dni", "numero documento"],
  apellido: ["apellido", "apellidos"],
  nombre: ["nombre", "nombres"],
  departamento: ["departamento", "depto", "dpto", "delegacion", "delegación"],
  email: ["correo", "correo electronico", "email", "e-mail"],
  telefono: ["telefono", "teléfono", "contacto", "numero de contacto", "número de contacto"],
  cargo: ["cargo", "puesto"],
  horas: ["hs", "hora", "horas", "horas catedra", "horas de catedra", "cantidad horas"],
  materia: ["materia", "espacio curricular", "asignatura"],
  establecimiento: ["establecimiento", "escuela", "organismo", "institucion", "institución"],
  nivel: ["nivel", "nivel educativo"],
  modalidad: ["modalidad"],
  cursoAnio: ["curso", "año", "ano", "año secc", "ano secc", "anosecc", "año/secc", "ano/secc", "curso año", "curso/ano"],
};

export const normalizeSearchText = (value) =>
  String(value === null || value === undefined ? "" : value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();

export const normalizeFieldName = (value) =>
  normalizeSearchText(value).replace(/[\u00a0_-]+/g, " ");

export const normalizeDni = (value) => {
  if (value === null || value === undefined) return "";

  let text = String(value).trim();
  if (!text) return "";

  // Excel puede serializar un DNI como texto terminado en .0 o ,0.
  text = text.replace(/([.,]0+)$/g, "");

  return text.replace(/\D/g, "");
};

export const isValidDni = (value) => /^[0-9]{7,8}$/.test(normalizeDni(value));

export const textValue = (value) => {
  if (value === null || value === undefined || value === "") return "";
  if (typeof value === "boolean") return value ? "Sí" : "No";

  if (Array.isArray(value)) {
    return value.map(textValue).filter(Boolean).join(", ");
  }

  if (typeof value === "object") {
    if (value.label !== undefined) return textValue(value.label);
    if (value.nombre !== undefined) return textValue(value.nombre);
    if (value.value !== undefined) return textValue(value.value);
    if (value.valor !== undefined) return textValue(value.valor);
    return JSON.stringify(value);
  }

  return String(value).trim();
};

const rawFieldName = (field = {}) =>
  field.key || field.id || field.label || field.sourceHeader || "";

const fieldNames = (field = {}) =>
  [field.key, field.id, field.label, field.sourceHeader]
    .filter(Boolean)
    .map(normalizeFieldName);

const aliasesFor = (concept) =>
  (FIELD_ALIASES[concept] || [concept]).map(normalizeFieldName);

const mergeFieldDescriptors = (formulario = {}) => {
  const campos = [
    ...(Array.isArray(formulario.campos) ? formulario.campos : []),
    ...(Array.isArray(formulario.configuracionExcel?.camposSeleccionados)
      ? formulario.configuracionExcel.camposSeleccionados
      : []),
  ];

  const seen = new Set();
  return campos.filter((campo) => {
    const key = String(rawFieldName(campo));
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};

export const createFieldAdapter = (formulario = {}) => {
  const campos = mergeFieldDescriptors(formulario);

  return Object.fromEntries(
    Object.keys(FIELD_ALIASES).map((concept) => {
      const aliases = aliasesFor(concept);
      const descriptor =
        campos.find((campo) =>
          fieldNames(campo).some((nombre) => aliases.includes(nombre))
        ) || null;

      return [concept, descriptor];
    })
  );
};

export const countMappedConcepts = (formulario = {}) => {
  const adapter = createFieldAdapter(formulario);
  return ["cargo", "horas", "materia", "establecimiento", "nivel", "cursoAnio"].filter(
    (concept) => Boolean(adapter[concept])
  ).length;
};

const readDirectValue = (source, descriptor) => {
  if (!source || typeof source !== "object" || Array.isArray(source)) {
    return { found: false, value: "", campo: descriptor?.label || "" };
  }

  const candidates = [
    descriptor?.key,
    descriptor?.id,
    descriptor?.label,
    descriptor?.sourceHeader,
  ].filter(Boolean);

  for (const key of candidates) {
    if (Object.prototype.hasOwnProperty.call(source, key)) {
      return {
        found: true,
        value: source[key],
        campo: descriptor?.label || descriptor?.sourceHeader || key,
      };
    }
  }

  const normalizedCandidates = candidates.map(normalizeFieldName);
  const encontrada = Object.entries(source).find(([key]) =>
    normalizedCandidates.includes(normalizeFieldName(key))
  );

  if (encontrada) {
    return {
      found: true,
      value: encontrada[1],
      campo: descriptor?.label || encontrada[0],
    };
  }

  return { found: false, value: "", campo: descriptor?.label || "" };
};

const readResponsesByField = (respuesta, descriptor) => {
  const entries = Object.values(respuesta?.respuestasPorCampo || {});
  const aliases = [
    descriptor?.key,
    descriptor?.id,
    descriptor?.label,
    descriptor?.sourceHeader,
  ]
    .filter(Boolean)
    .map(normalizeFieldName);

  const encontrada = entries.find((campo) =>
    [campo?.key, campo?.id, campo?.label]
      .filter(Boolean)
      .map(normalizeFieldName)
      .some((nombre) => aliases.includes(nombre))
  );

  if (!encontrada) return { found: false, value: "", campo: descriptor?.label || "" };

  return {
    found: true,
    value:
      encontrada.valorLegible !== undefined
        ? encontrada.valorLegible
        : encontrada.valor,
    campo: encontrada.label || descriptor?.label || descriptor?.key || "",
  };
};

export const readResponseValue = (respuesta, descriptor, record = null) => {
  if (record) {
    const desdeRegistro = readDirectValue(record, descriptor);
    if (desdeRegistro.found) return desdeRegistro;
  }

  const sources = [
    respuesta || {},
    respuesta?.datosPersona || {},
    respuesta?.respuestas || {},
  ];

  for (const source of sources) {
    const encontrada = readDirectValue(source, descriptor);
    if (encontrada.found) return encontrada;
  }

  return readResponsesByField(respuesta, descriptor);
};

const conceptValue = (respuesta, adapter, concept, record = null) => {
  const descriptor = adapter[concept];
  const result = readResponseValue(respuesta, descriptor, record);

  return {
    valor: textValue(result.value),
    valorOriginal: result.value,
    campoReal: result.campo || descriptor?.label || descriptor?.key || "",
    encontrado: result.found,
  };
};

const hasMeaningfulSituationData = (situacion) =>
  ["cargo", "horas", "materia", "establecimiento", "nivel", "modalidad", "cursoAnio"].some(
    (concept) => Boolean(textValue(situacion[concept]))
  );

const personValue = (respuesta, adapter, concept) =>
  conceptValue(respuesta, adapter, concept, null);

export const adaptResponseToPerson = (respuesta = {}, formulario = {}) => {
  const adapter = createFieldAdapter(formulario);
  const dniResult = personValue(respuesta, adapter, "dni");
  const dni = normalizeDni(dniResult.valorOriginal || respuesta.dni || respuesta.identificador);

  const personFields = ["apellido", "nombre", "departamento", "email", "telefono"];
  const personaOriginal = {};
  const persona = {};

  personFields.forEach((concept) => {
    const value = personValue(respuesta, adapter, concept);
    persona[concept] = value.valor;
    personaOriginal[concept] = {
      campoReal: value.campoReal,
      valor: value.valorOriginal,
    };
  });

  if (!persona.dni) persona.dni = dni;

  const registros = Array.isArray(respuesta.registros)
    ? respuesta.registros
    : [null];

  const situaciones = registros.map((registro, index) => {
    const valorOriginal = {};
    const situacion = {
      id: `${respuesta.id || "respuesta"}-${index + 1}`,
      cargo: "",
      horas: "",
      materia: "",
      establecimiento: "",
      nivel: "",
      modalidad: "",
      cursoAnio: "",
      origenRespuestaId: respuesta.id || "",
      formularioId: respuesta.formularioId || formulario.id || "",
      origen: respuesta.origen || "sin_origen",
      camposReales: {},
    };

    ["cargo", "horas", "materia", "establecimiento", "nivel", "modalidad", "cursoAnio"].forEach(
      (concept) => {
        const value = conceptValue(respuesta, adapter, concept, registro);
        situacion[concept] = value.valor;
        situacion.camposReales[concept] = {
          campoReal: value.campoReal,
          valorOriginal: value.valorOriginal,
          encontrado: value.encontrado,
        };
        valorOriginal[concept] = value.valorOriginal;
      }
    );

    situacion.valorOriginal = {
      registro: registro,
      campos: valorOriginal,
    };

    return situacion;
  });

  const razonesRevision = [];
  if (!isValidDni(dni)) razonesRevision.push("DNI ausente o inválido");
  if (!situaciones.length) razonesRevision.push("Sin situaciones interpretables");
  if (situaciones.some((situacion) => !hasMeaningfulSituationData(situacion))) {
    razonesRevision.push("Existe una situación sin datos mínimos");
  }

  const personaKey = dni || `sin-dni-${respuesta.id || "respuesta"}`;

  return {
    id: personaKey,
    dni,
    apellido: persona.apellido,
    nombre: persona.nombre,
    departamento: persona.departamento,
    email: persona.email,
    telefono: persona.telefono,
    datosPersonaOriginales: personaOriginal,
    situaciones,
    estadoInicial: razonesRevision.length
      ? "REQUIERE REVISIÓN"
      : "SOLICITUD REGISTRADA",
    razonesRevision,
    respuestaIds: respuesta.id ? [respuesta.id] : [],
    formularioId: respuesta.formularioId || formulario.id || "",
  };
};

export const groupResponsesByPerson = (respuestas = [], formulario = {}) => {
  const personasMap = new Map();

  respuestas.forEach((respuesta) => {
    const personaNueva = adaptResponseToPerson(respuesta, formulario);
    const existente = personasMap.get(personaNueva.id);

    if (!existente) {
      personasMap.set(personaNueva.id, personaNueva);
      return;
    }

    existente.situaciones.push(...personaNueva.situaciones);
    existente.respuestaIds = [
      ...new Set([...existente.respuestaIds, ...personaNueva.respuestaIds]),
    ];

    ["apellido", "nombre", "departamento", "email", "telefono"].forEach((campo) => {
      if (!existente[campo] && personaNueva[campo]) existente[campo] = personaNueva[campo];
    });

    existente.razonesRevision = [
      ...new Set([...existente.razonesRevision, ...personaNueva.razonesRevision]),
    ];
    existente.estadoInicial = existente.razonesRevision.length
      ? "REQUIERE REVISIÓN"
      : "SOLICITUD REGISTRADA";
  });

  const personas = Array.from(personasMap.values()).map((persona) => ({
    ...persona,
    situacionesCount: persona.situaciones.length,
    nombreCompleto: [persona.apellido, persona.nombre].filter(Boolean).join(" "),
    searchable: normalizeSearchText(
      [persona.dni, persona.apellido, persona.nombre].filter(Boolean).join(" ")
    ),
  }));

  return personas.sort((a, b) =>
    normalizeSearchText(a.nombreCompleto).localeCompare(
      normalizeSearchText(b.nombreCompleto),
      "es"
    )
  );
};

export const buildTitularizacionMetrics = (personas = []) => {
  const personasIdentificadas = personas.filter((persona) =>
    isValidDni(persona.dni)
  );
  const situations = personas.reduce(
    (total, persona) => total + persona.situaciones.length,
    0
  );

  return {
    // Los casos sin DNI o con DNI inválido permanecen en la tabla para su
    // revisión, pero no forman parte del total de personas identificadas.
    personas: personasIdentificadas.length,
    personasRevision: personas.length - personasIdentificadas.length,
    situaciones: situations,
    unaSituacion: personasIdentificadas.filter(
      (persona) => persona.situaciones.length === 1
    ).length,
    multiplesSituaciones: personasIdentificadas.filter(
      (persona) => persona.situaciones.length > 1
    ).length,
    requierenRevision: personas.filter(
      (persona) => persona.estadoInicial === "REQUIERE REVISIÓN"
    ).length,
  };
};
