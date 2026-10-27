import { collection, getDocs, query, where } from "firebase/firestore";
import { db } from "../../firebase/firebase-config";
import {
  buildSituationFingerprint,
  buildVisiblePersonName,
  buildTitularizacionMetrics,
  countMappedConcepts,
  createFieldAdapter,
  groupResponsesByPerson,
  isValidDni,
  normalizeDni,
  normalizeSearchText,
} from "./titularizacionNormalizer";
import {
  enrichTitularizacionPeople,
  mergePersonIdentity,
  loadAuxiliaryIdentityIndex,
} from "./titularizacionIdentityService";

export const TITULARIZACION_FORMULARIOS_COLLECTION = "oficina_gestion_formularios";
export const TITULARIZACION_RESPUESTAS_COLLECTION = "oficina_gestion_respuestas";
export const DEFAULT_TITULARIZACION_FORMULARIO_ID = "YHe6DibXG17hi9uST4oG";

export const TITULARIZACION_SOURCE_ROLES = [
  "solicitud_inicial",
  "reclamo",
  "reapertura",
  "otra_solicitud",
];

export const TITULARIZACION_SOURCE_ROLE_LABELS = {
  solicitud_inicial: "Solicitud inicial",
  reclamo: "Reclamo",
  reapertura: "Reapertura de gestión",
  otra_solicitud: "Otra solicitud",
};

// Lista explícita: no todo formulario de Oficina de Gestión pertenece al
// universo de Titularización.
export const TITULARIZACION_VALID_SOURCE_DEFINITIONS = Object.freeze([
  {
    formularioId: "YHe6DibXG17hi9uST4oG",
    nombre: "TITULARIZACIÓN DOCENTE 2026",
    rol: "solicitud_inicial",
    tipoFuente: "solicitud_estructurada",
    identitySourceType: "YHe",
    sourceScope: "situation",
    esSolicitudEstructurada: true,
  },
  {
    formularioId: "BddUY86djot8gqt18o1d",
    nombre: "CONSULTA DE CARGA DE DATOS Y DOCUMENTACIÓN – TITULARIZACIÓN DOCENTE",
    rol: "otra_solicitud",
    tipoFuente: "consulta_carga_documentacion",
    identitySourceType: "Bdd",
    sourceScope: "person",
    esSolicitudEstructurada: false,
  },
  {
    formularioId: "UBJWIrQgQjN1Mh95ains",
    nombre: "RECLAMOS – PRIMER DICTAMEN",
    rol: "reclamo",
    tipoFuente: "reclamo",
    identitySourceType: "Reclamo",
    sourceScope: "person",
    esSolicitudEstructurada: false,
  },
  {
    formularioId: "eVgdKqU0Ntavd2TmxbRE",
    nombre: "REAPERTURA DE GESTIÓN",
    rol: "reapertura",
    tipoFuente: "reapertura",
    identitySourceType: "Reapertura",
    sourceScope: "person",
    esSolicitudEstructurada: false,
  },
  {
    formularioId: "dVAOz4oRe3EDFFwkKlzn",
    nombre: "RENUNCIA CONDICIONAL",
    rol: "otra_solicitud",
    tipoFuente: "renuncia_condicional",
    identitySourceType: "Renuncia",
    sourceScope: "person",
    esSolicitudEstructurada: false,
  },
]);

const validSourceDefinitionById = new Map(
  TITULARIZACION_VALID_SOURCE_DEFINITIONS.map((definition) => [
    definition.formularioId,
    definition,
  ])
);

export const DEFAULT_TITULARIZACION_SOURCE_CONFIGS = [
  ...TITULARIZACION_VALID_SOURCE_DEFINITIONS.map(({ formularioId, rol }) => ({
    formularioId,
    rol,
  })),
];

const formSearchText = (formulario = {}) =>
  normalizeSearchText(
    [
      formulario.titulo,
      formulario.descripcion,
      formulario.codigoFormulario,
      formulario.formularioCodigo,
      formulario.formularioNumero,
    ]
      .filter(Boolean)
      .join(" ")
  );

export const suggestTitularizacionSourceRole = (formulario = {}) => {
  const searchable = formSearchText(formulario);
  if (searchable.includes("reclamo")) return "reclamo";
  if (searchable.includes("reapertura")) return "reapertura";
  if (searchable.includes("consulta de estado") || searchable.includes("renuncia")) {
    return "otra_solicitud";
  }
  if (searchable.includes("titularizacion")) return "solicitud_inicial";
  return "otra_solicitud";
};

export const scoreForm = (formulario = {}) => {
  const searchable = formSearchText(formulario);
  const adapter = createFieldAdapter(formulario);
  const grouped =
    formulario.tipoFormulario === "consulta_excel_agrupada" ||
    formulario.tipoRespuesta === "excel_agrupada" ||
    formulario.configuracionExcel?.habilitado;

  let score = 0;
  if (searchable.includes("titularizacion")) score += 100;
  if (searchable.includes("reclamo")) score += 70;
  if (searchable.includes("reapertura")) score += 60;
  if (grouped) score += 40;
  score += countMappedConcepts(formulario) * 10;
  if (adapter.dni) score += 10;
  if (formulario.configuracionExcel?.columnaAgrupacion) score += 10;

  return score;
};

export const seleccionarFormularioTitularizacion = (formularios = []) =>
  formularios.find((formulario) => formulario.id === DEFAULT_TITULARIZACION_FORMULARIO_ID) ||
  [...formularios].sort((a, b) => scoreForm(b) - scoreForm(a))[0] ||
  null;

const sourceIdFor = (formularioId) => `formulario_${formularioId}`;

export const loadTitularizacionSources = async () => {
  const snapshot = await getDocs(collection(db, TITULARIZACION_FORMULARIOS_COLLECTION));
  return snapshot.docs
    .map((docSnap) => {
      const definition = validSourceDefinitionById.get(docSnap.id);
      if (!definition) return null;
      const data = docSnap.data();
      return {
        ...data,
        id: docSnap.id,
        ...definition,
        scoreSugerido: scoreForm(data),
        rolSugerido: definition.rol,
      };
    })
    .filter(Boolean)
    .sort((a, b) => {
      if (a.id === DEFAULT_TITULARIZACION_FORMULARIO_ID) return -1;
      if (b.id === DEFAULT_TITULARIZACION_FORMULARIO_ID) return 1;
      return b.scoreSugerido - a.scoreSugerido;
    });
};

const cargarRespuestasPorFormulario = async (formularioId) => {
  const consultas = [
    ["formularioId", formularioId],
    ["formularioCodigo", formularioId],
    ["formularioNumero", formularioId],
  ];
  const respuestasMap = new Map();

  for (const [campo, valor] of consultas) {
    const snapshot = await getDocs(
      query(collection(db, TITULARIZACION_RESPUESTAS_COLLECTION), where(campo, "==", valor))
    );

    snapshot.docs.forEach((docSnap) => {
      respuestasMap.set(docSnap.id, {
        ...docSnap.data(),
        id: docSnap.id,
      });
    });
  }

  return Array.from(respuestasMap.values());
};

const normalizeSourceConfigs = (sourceConfigs, formularios) => {
  const byId = new Map(formularios.map((formulario) => [formulario.id, formulario]));
  const configured = Array.isArray(sourceConfigs) && sourceConfigs.length
    ? sourceConfigs
    : DEFAULT_TITULARIZACION_SOURCE_CONFIGS;

  return configured
    .map((config) => {
      const formularioId = config.formularioId || config.id;
      const formulario = byId.get(formularioId);
      if (!formulario) return null;
      return {
        formularioId,
        rol: TITULARIZACION_SOURCE_ROLES.includes(config.rol)
          ? config.rol
          : formulario.rolSugerido || suggestTitularizacionSourceRole(formulario),
        tipoFuente: formulario.tipoFuente,
        identitySourceType: formulario.identitySourceType,
        sourceScope: formulario.sourceScope,
        esSolicitudEstructurada: Boolean(formulario.esSolicitudEstructurada),
        formulario,
        sourceId: sourceIdFor(formularioId),
      };
    })
    .filter(Boolean)
    .filter((config, index, configs) =>
      configs.findIndex((item) => item.formularioId === config.formularioId) === index
    );
};

const sourceRefKey = (sourceRef = {}) =>
  [
    sourceRef.sourceId,
    sourceRef.formularioId,
    sourceRef.rol,
    sourceRef.respuestaId,
    sourceRef.indiceRegistro,
    sourceRef.importId,
    sourceRef.registroId,
  ]
    .map((value) => String(value || ""))
    .join("|");

const mergeSourceRefs = (existingRefs = [], nextRefs = []) => {
  const result = [];
  const seen = new Set();
  [...(Array.isArray(existingRefs) ? existingRefs : []), ...(Array.isArray(nextRefs) ? nextRefs : [])].forEach(
    (sourceRef) => {
      const key = sourceRefKey(sourceRef);
      if (seen.has(key)) return;
      seen.add(key);
      result.push(sourceRef);
    }
  );
  return result;
};

const sourceIndexFromSituation = (situacion) => {
  const match = String(situacion?.id || "").match(/-(\d+)$/);
  return match ? Number(match[1]) : 1;
};

const decorateSituation = (situacion, persona, sourceConfig) => {
  const indiceRegistro = sourceIndexFromSituation(situacion);
  const sourceRef = {
    sourceId: sourceConfig.sourceId,
    formularioId: sourceConfig.formularioId,
    formularioTitulo: sourceConfig.formulario.titulo || sourceConfig.formularioId,
    rol: sourceConfig.rol,
    respuestaId: situacion.origenRespuestaId || "",
    indiceRegistro,
    origen: situacion.origen || "solicitud_afiliado",
  };
  const fingerprint = buildSituationFingerprint(situacion);
  const dni = normalizeDni(persona.dni);

  return {
    ...situacion,
    fingerprint,
    signature: fingerprint,
    canonicalSituationKey: isValidDni(dni)
      ? `${dni}|${fingerprint}`
      : `revision|${sourceConfig.sourceId}|${situacion.id}`,
    sourceRefs: mergeSourceRefs(situacion.sourceRefs, [sourceRef]),
  };
};

const decorateSourcePerson = (persona, sourceConfig) => {
  const validDni = isValidDni(persona.dni);
  const id = validDni
    ? normalizeDni(persona.dni)
    : `revision-${sourceConfig.sourceId}-${persona.id}`;
  const esFuenteDeSituaciones = sourceConfig.sourceScope === "situation";
  const situaciones = esFuenteDeSituaciones
    ? persona.situaciones.map((situacion) =>
        decorateSituation(situacion, persona, sourceConfig)
      )
    : [];
  const sourceRefs = situaciones.flatMap((situacion) => situacion.sourceRefs || []);
  const responseRefs = (persona.respuestaIds || []).map((respuestaId) => ({
    sourceId: sourceConfig.sourceId,
    formularioId: sourceConfig.formularioId,
    formularioTitulo: sourceConfig.formulario.titulo || sourceConfig.formularioId,
    rol: sourceConfig.rol,
    respuestaId,
    indiceRegistro: null,
    origen: esFuenteDeSituaciones ? "solicitud_afiliado" : "antecedente_persona",
  }));
  const fuentePersona = {
    sourceId: sourceConfig.sourceId,
    formularioId: sourceConfig.formularioId,
    formularioTitulo: sourceConfig.formulario.titulo || sourceConfig.formularioId,
    rol: sourceConfig.rol,
    tipoFuente: sourceConfig.tipoFuente || sourceConfig.rol,
    identitySourceType: sourceConfig.identitySourceType || sourceConfig.rol,
    sourceScope: sourceConfig.sourceScope,
  };
  const eventos = esFuenteDeSituaciones
    ? []
    : (persona.respuestaIds || []).map((respuestaId) => ({
        id: `evento-${sourceConfig.formularioId}-${respuestaId}`,
        tipo: sourceConfig.tipoFuente || sourceConfig.rol,
        tipoFuente: sourceConfig.tipoFuente || sourceConfig.rol,
        sourceId: sourceConfig.sourceId,
        formularioId: sourceConfig.formularioId,
        formularioTitulo: sourceConfig.formulario.titulo || sourceConfig.formularioId,
        rol: sourceConfig.rol,
        respuestaId,
        origen: "fuente_persona",
      }));

  return {
    ...persona,
    id,
    situaciones,
    tieneSolicitudEstructurada: Boolean(sourceConfig.esSolicitudEstructurada),
    sinSituacionEstructurada: situaciones.length === 0,
    eventos,
    sourceRefs: mergeSourceRefs(persona.sourceRefs, [...sourceRefs, ...responseRefs]),
    fuentes: [fuentePersona],
    fuentesPersona: [fuentePersona],
  };
};

const sourceResultIsStructured = (sourceResult = {}, sourcePersona = {}) =>
  sourcePersona.tieneSolicitudEstructurada !== undefined
    ? Boolean(sourcePersona.tieneSolicitudEstructurada)
    : sourceResult.sourceScope === "situation" ||
      sourceResult.esSolicitudEstructurada === true ||
      sourceResult.rol === "solicitud_inicial";

const stateForPerson = (persona = {}) => {
  if (persona.razonesRevision?.length) return "REQUIERE REVISIÓN";
  if (persona.situaciones?.length > 0) return "SOLICITUD REGISTRADA";
  if (persona.tieneSolicitudEstructurada) return "SIN SITUACIÓN ESTRUCTURADA";
  return "SIN SOLICITUD ESTRUCTURADA";
};

const mergeUniqueBy = (items = [], keyFor) => {
  const result = [];
  const seen = new Set();
  items.filter(Boolean).forEach((item) => {
    const key = keyFor(item);
    if (seen.has(key)) return;
    seen.add(key);
    result.push(item);
  });
  return result;
};

const eventsForSourcePerson = (sourceResult = {}, sourcePersona = {}) => {
  if (Array.isArray(sourcePersona.eventos) && sourcePersona.eventos.length) {
    return sourcePersona.eventos;
  }
  if (sourceResult.sourceScope !== "person") return [];
  return (sourcePersona.respuestaIds || []).map((respuestaId) => ({
    id: `evento-${sourceResult.formularioId || sourceResult.sourceId}-${respuestaId}`,
    tipo: sourceResult.tipoFuente || sourceResult.rol || "antecedente_persona",
    tipoFuente: sourceResult.tipoFuente || sourceResult.rol || "antecedente_persona",
    sourceId: sourceResult.sourceId,
    formularioId: sourceResult.formularioId,
    formularioTitulo: sourceResult.formulario?.titulo || sourceResult.formularioId,
    rol: sourceResult.rol,
    respuestaId,
    origen: "fuente_persona",
  }));
};

const situationSourceIds = (situacion) =>
  new Set(
    (Array.isArray(situacion.sourceRefs) ? situacion.sourceRefs : [])
      .map((sourceRef) => sourceRef.sourceId || sourceRef.formularioId)
      .filter(Boolean)
  );

export const mergeTitularizacionSourceResults = (sourceResults) => {
  const peopleMap = new Map();
  const sourceStats = [];
  let situacionesDeduplicadas = 0;

  sourceResults.forEach((sourceResult) => {
    const sourceStat = {
      ...sourceResult.metrics,
      personasNuevas: 0,
      personasYaPresentes: 0,
      situacionesDeduplicadas: 0,
    };

    sourceResult.personas.forEach((sourcePersona) => {
      const validDni = isValidDni(sourcePersona.dni);
      const dni = normalizeDni(sourcePersona.dni);
      const key = validDni
        ? `dni:${dni}`
        : `revision:${sourceResult.sourceId}:${sourcePersona.id}`;
      const existing = peopleMap.get(key);
      const tieneSolicitudEstructurada = sourceResultIsStructured(sourceResult, sourcePersona);
      const sourceEvents = eventsForSourcePerson(sourceResult, sourcePersona);
      const sourceSituations = sourceResult.sourceScope === "person"
        ? []
        : (sourcePersona.situaciones || []);
      const identitySourceType =
        sourceResult.identitySourceType ||
        sourcePersona.fuentesPersona?.[0]?.identitySourceType ||
        sourceResult.formularioId ||
        sourceResult.sourceId ||
        "fuente";
      const sourceIdentity = mergePersonIdentity(
        { ...sourcePersona, identitySources: [], identityConflicts: [] },
        { ...sourcePersona, sourceType: identitySourceType }
      );

      if (!existing) {
        peopleMap.set(key, {
          ...sourceIdentity,
          estadoInicial: stateForPerson({
            ...sourcePersona,
            situaciones: sourceSituations,
            tieneSolicitudEstructurada,
          }),
          tieneSolicitudEstructurada,
          situaciones: sourceSituations.map((situacion) => ({
            ...situacion,
            sourceRefs: [...(situacion.sourceRefs || [])],
          })),
          sourceRefs: [...(sourcePersona.sourceRefs || [])],
          fuentes: [...(sourcePersona.fuentes || [])],
          fuentesPersona: [...(sourcePersona.fuentesPersona || sourcePersona.fuentes || [])],
          eventos: [...sourceEvents],
          registrosDescartados: [...(sourcePersona.registrosDescartados || [])],
          sinSituacionEstructurada: sourceSituations.length === 0,
        });
        if (validDni) sourceStat.personasNuevas += 1;
        return;
      }

      if (validDni) sourceStat.personasYaPresentes += 1;
      Object.assign(
        existing,
        mergePersonIdentity(existing, {
          ...sourcePersona,
          sourceType: identitySourceType,
        })
      );
      existing.situaciones = existing.situaciones || [];
      existing.tieneSolicitudEstructurada =
        Boolean(existing.tieneSolicitudEstructurada) || tieneSolicitudEstructurada;
      sourceSituations.forEach((incomingSituation) => {
        const incomingSources = situationSourceIds(incomingSituation);
        const duplicate = validDni
          ? existing.situaciones.find((candidate) => {
              if (candidate.fingerprint !== incomingSituation.fingerprint) return false;
              const candidateSources = situationSourceIds(candidate);
              return Array.from(incomingSources).every(
                (sourceId) => !candidateSources.has(sourceId)
              );
            })
          : null;

        if (!duplicate) {
          existing.situaciones.push({
            ...incomingSituation,
            sourceRefs: [...(incomingSituation.sourceRefs || [])],
          });
          return;
        }

        duplicate.sourceRefs = mergeSourceRefs(
          duplicate.sourceRefs,
          incomingSituation.sourceRefs
        );
        duplicate.canonicalSituationKey = incomingSituation.canonicalSituationKey;
        sourceStat.situacionesDeduplicadas += 1;
        situacionesDeduplicadas += 1;
      });

      existing.sourceRefs = mergeSourceRefs(existing.sourceRefs, sourcePersona.sourceRefs);
      existing.fuentes = [...(existing.fuentes || []), ...(sourcePersona.fuentes || [])].filter(
        (fuente, index, fuentes) =>
          fuentes.findIndex((item) => item.sourceId === fuente.sourceId) === index
      );
      existing.fuentesPersona = mergeUniqueBy(
        [
          ...(existing.fuentesPersona || []),
          ...(sourcePersona.fuentesPersona || sourcePersona.fuentes || []),
        ],
        (fuente) => fuente.sourceId || fuente.formularioId
      );
      existing.eventos = mergeUniqueBy(
        [...(existing.eventos || []), ...sourceEvents],
        (evento) => evento.id || `${evento.sourceId}|${evento.respuestaId}|${evento.tipo}`
      );
      existing.respuestaIds = [
        ...new Set([...(existing.respuestaIds || []), ...(sourcePersona.respuestaIds || [])]),
      ];
      existing.registrosDescartados = [
        ...(existing.registrosDescartados || []),
        ...(sourcePersona.registrosDescartados || []),
      ];
      existing.sinSituacionEstructurada =
        Boolean(existing.sinSituacionEstructurada) &&
        sourceSituations.length === 0;
      ["apellido", "nombre", "departamento", "email", "telefono"].forEach((campo) => {
        if (!existing[campo] && sourcePersona[campo]) existing[campo] = sourcePersona[campo];
      });
      existing.razonesRevision = [
        ...new Set([...(existing.razonesRevision || []), ...(sourcePersona.razonesRevision || [])]),
      ];
      existing.estadoInicial = existing.razonesRevision.length
        ? "REQUIERE REVISIÓN"
        : stateForPerson(existing);
    });

    sourceStats.push({
      ...sourceResult,
      metrics: sourceStat,
    });
  });

  const personas = Array.from(peopleMap.values())
    .map((persona) => ({
      ...persona,
      situacionesCount: persona.situaciones.length,
      registrosDescartadosCount: (persona.registrosDescartados || []).length,
      nombreCompleto: buildVisiblePersonName(persona),
      searchable: normalizeSearchText(
        [persona.dni, persona.apellido, persona.nombre].filter(Boolean).join(" ")
      ),
    }))
    .sort((a, b) =>
      normalizeSearchText(a.nombreCompleto).localeCompare(
        normalizeSearchText(b.nombreCompleto),
        "es"
      )
    );

  return { personas, sourceStats, situacionesDeduplicadas };
};

export const buildTitularizacionMetricsForPeople = (
  personas,
  respuestas,
  situacionesDeduplicadas
) => {
  const base = buildTitularizacionMetrics(personas);
  const personasValidas = personas.filter((persona) => isValidDni(persona.dni));
  const situacionesCanonicas = personasValidas.reduce(
    (total, persona) => total + persona.situaciones.length,
    0
  );
  const situacionesRevision = base.situaciones - situacionesCanonicas;
  const identidadCompleta = personasValidas.filter(
    (persona) => persona.apellido && persona.nombre
  ).length;
  const afiliadosSidca = personasValidas.filter(
    (persona) => persona.afiliadoSidca === true
  ).length;
  const noAfiliadosSidca = personasValidas.filter(
    (persona) => persona.afiliadoSidca === false
  ).length;

  return {
    ...base,
    respuestas: respuestas.length,
    personasUnicas: base.personas,
    situaciones: situacionesCanonicas,
    situacionesCanonicas,
    situacionesRevision,
    situacionesTotales: base.situaciones,
    situacionesDeduplicadas,
    personasSinSituacionEstructurada: personasValidas.filter(
      (persona) => persona.sinSituacionEstructurada
    ).length,
    personasConSolicitudEstructurada: personasValidas.filter(
      (persona) => persona.tieneSolicitudEstructurada
    ).length,
    personasSinSolicitudEstructurada: personasValidas.filter(
      (persona) => !persona.tieneSolicitudEstructurada
    ).length,
    personasConSituacionesEstructuradas: personasValidas.filter(
      (persona) => persona.situaciones.length > 0
    ).length,
    personasConIdentidadCompleta: identidadCompleta,
    personasSinIdentidadCompleta: personasValidas.length - identidadCompleta,
    afiliadosSidca,
    noAfiliadosSidca,
    afiliacionNoVerificada: personasValidas.filter(
      (persona) => persona.afiliadoSidca === null || persona.afiliadoSidca === undefined
    ).length,
  };
};

export const loadTitularizacionData = async ({ sourceConfigs } = {}) => {
  const formularios = await loadTitularizacionSources();
  const configs = normalizeSourceConfigs(sourceConfigs, formularios);

  if (!configs.length) {
    throw new Error("No se seleccionaron formularios para Titularización 2026.");
  }

  const sourceResults = await Promise.all(
    configs.map(async (sourceConfig) => {
      const respuestas = await cargarRespuestasPorFormulario(sourceConfig.formularioId);
      const personas = groupResponsesByPerson(respuestas, sourceConfig.formulario);
      const decoratedPeople = personas.map((persona) =>
        decorateSourcePerson(persona, sourceConfig)
      );
      const baseMetrics = buildTitularizacionMetrics(decoratedPeople);
      const situacionesCanonicas = decoratedPeople
        .filter((persona) => isValidDni(persona.dni))
        .reduce((total, persona) => total + persona.situaciones.length, 0);

      return {
        ...sourceConfig,
        respuestas,
        personas: decoratedPeople,
        metrics: {
          ...baseMetrics,
          respuestas: respuestas.length,
          personasValidas: baseMetrics.personas,
          situacionesCanonicas,
          situacionesRevision: baseMetrics.situaciones - situacionesCanonicas,
          casosRevision: baseMetrics.requierenRevision,
          personasSinSituacionEstructurada: baseMetrics.personasSinSituacionEstructurada,
        },
      };
    })
  );

  const merged = mergeTitularizacionSourceResults(sourceResults);
  const respuestas = sourceResults.flatMap((source) => source.respuestas);
  let auxiliaryIdentity = { index: new Map(), leidos: { usuarios: 0, nuevoAfiliado: 0 } };
  let identityVerificationCompleted = true;
  try {
    auxiliaryIdentity = await loadAuxiliaryIdentityIndex();
  } catch (exception) {
    identityVerificationCompleted = false;
    console.error("No se pudo verificar afiliación SIDCA; se conserva como NO VERIFICADO.", exception);
  }
  const identityEnrichment = enrichTitularizacionPeople(merged.personas, {
    auxiliaryIndex: auxiliaryIdentity.index,
    verificationCompleted: identityVerificationCompleted,
  });
  const personasEnriquecidas = identityEnrichment.people;
  const metrics = buildTitularizacionMetricsForPeople(
    personasEnriquecidas,
    respuestas,
    merged.situacionesDeduplicadas
  );

  const fuentes = merged.sourceStats.map((source) => ({
    sourceId: source.sourceId,
    formularioId: source.formularioId,
    formularioTitulo: source.formulario.titulo || source.formularioId,
    rol: source.rol,
    formulario: source.formulario,
    tipoFuente: source.tipoFuente,
    sourceScope: source.sourceScope,
    respuestas: source.respuestas.length,
    personas: source.metrics.personas,
    situaciones: source.metrics.situacionesCanonicas,
    situacionesCanonicas: source.metrics.situacionesCanonicas,
    situacionesRevision: source.metrics.situacionesRevision,
    casosRevision: source.metrics.casosRevision || 0,
    personasSinSituacionEstructurada: source.metrics.personasSinSituacionEstructurada || 0,
    registrosDescartados: source.metrics.registrosDescartados || 0,
    personasNuevas: source.metrics.personasNuevas,
    personasYaPresentes: source.metrics.personasYaPresentes,
    situacionesDeduplicadas: source.metrics.situacionesDeduplicadas,
    metrics: source.metrics,
  }));

  const personasValidas = personasEnriquecidas.filter((persona) => isValidDni(persona.dni));
  const yheId = DEFAULT_TITULARIZACION_FORMULARIO_ID;
  const tieneFuente = (persona, formularioId) =>
    (persona.fuentesPersona || persona.fuentes || []).some(
      (fuente) => fuente.formularioId === formularioId
    );
  const personasSoloYHe = personasValidas.filter(
    (persona) => tieneFuente(persona, yheId) && (persona.fuentesPersona || persona.fuentes || []).length === 1
  ).length;
  const personasYHeMasOtras = personasValidas.filter(
    (persona) =>
      tieneFuente(persona, yheId) &&
      (persona.fuentesPersona || persona.fuentes || []).some(
        (fuente) => fuente.formularioId !== yheId
      )
  ).length;
  const personasSoloOtras = personasValidas.filter(
    (persona) => !tieneFuente(persona, yheId)
  ).length;
  const personasPorFuente = fuentes.map((fuente) => ({
    sourceId: fuente.sourceId,
    formularioId: fuente.formularioId,
    nombre: fuente.formularioTitulo,
    tipoFuente: fuente.tipoFuente,
    personas: fuente.personas,
  }));
  const recoverySources = [
    "YHe",
    "Bdd",
    "Reclamo",
    "Reapertura",
    "Renuncia",
    "Excel workspace",
    "usuarios",
    "nuevoAfiliado",
  ];
  const identidadRecuperadaPorFuente = recoverySources.reduce((result, sourceType) => {
    result[sourceType] = personasEnriquecidas.filter((persona) =>
      (persona.identityCompletionSources || []).includes(sourceType)
    ).length;
    return result;
  }, {});

  return {
    initialized: false,
    formulario: configs[0].formulario,
    formularios,
    formulariosRelacionados: formularios,
    sourceConfigs: configs.map(({ formulario, ...config }) => config),
    fuentes,
    respuestas,
    personas: personasEnriquecidas,
    metrics,
    universeDiagnostics: {
      personasPorFuente,
      personasUnicasTotales: metrics.personasUnicas,
      personasConSolicitudEstructurada: metrics.personasConSolicitudEstructurada,
      personasSinSolicitudEstructurada: metrics.personasSinSolicitudEstructurada,
      personasSoloYHe,
      personasYHeMasOtras,
      personasSoloOtras,
      identidadAntes: identityEnrichment.diagnostics.before,
      identidadDespues: identityEnrichment.diagnostics.after,
      personasInicialmenteSinIdentidad: identityEnrichment.diagnostics.before.sinApellidoNombre,
      personasSinIdentidadLuego: identityEnrichment.diagnostics.after.sinApellidoNombre,
      afiliadosSidca: identityEnrichment.diagnostics.afiliadosSidca,
      noAfiliadosSidca: identityEnrichment.diagnostics.noAfiliadosSidca,
      identityConflicts: identityEnrichment.diagnostics.identityConflicts,
      cantidadAntesEnriquecimiento: identityEnrichment.diagnostics.cantidadAntes,
      cantidadDespuesEnriquecimiento: identityEnrichment.diagnostics.cantidadDespues,
      identidadRecuperadaPorFuente,
      padron: {
        verificacionCompletada: identityVerificationCompleted,
        leidos: auxiliaryIdentity.leidos,
      },
    },
  };
};
