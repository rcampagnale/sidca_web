import {
  MATCH_FIELDS,
  matchSituationsOneToOne,
} from "./titularizacionMatcher";
import {
  derivePersonSummary,
  deriveSituationState,
  EVIDENCE_ASSERTIONS,
  MINISTERIO_STATES,
  PERSON_LABELS,
  RESOLUCION_STATES,
  SITUATION_LABELS,
} from "./titularizacionStateModel";
import {
  buildVisiblePersonName,
  isValidDni,
  normalizeDni,
  normalizeSearchText,
} from "./titularizacionNormalizer";
import {
  WORKSPACE_EXTERNAL_EVIDENCE_SOURCE_TYPES,
  WORKSPACE_SOURCE_TYPES,
} from "./titularizacionWorkspaceService";
import { extractResolutionNumber } from "./titularizacionResolutionNumber";

export const MINISTERIAL_EVIDENCE_CLASSIFICATIONS = Object.freeze({
  LINKED_TO_SITUATION: "SITUATION_LEVEL_EVIDENCE",
  PERSON_LEVEL: "PERSON_LEVEL_EVIDENCE",
  REVIEW: "EVIDENCE_REQUIRES_REVIEW",
  EXTERNAL: "EXTERNAL_EVIDENCE",
});

export const MINISTERIAL_PERSON_FILTERS = Object.freeze({
  ALL: "TODOS",
  COMPLETE: PERSON_LABELS.TITULARIZACION_COMPLETA,
  PARTIAL: PERSON_LABELS.TITULARIZACION_PARCIAL,
  APTA_PENDING: SITUATION_LABELS.APTA_PENDIENTE_RESOLUCION,
  NO_APTA: SITUATION_LABELS.NO_APTA,
  OBSERVED: SITUATION_LABELS.OBSERVADA,
  OMITTED: "OMITIDA",
  DELAYED: "REZAGADA",
  REVIEW: PERSON_LABELS.REQUIERE_REVISION,
  WITHOUT_MINISTRY: "SIN_EVIDENCIA_MINISTERIAL",
});

const MINISTERIAL_TYPES = new Set(
  WORKSPACE_EXTERNAL_EVIDENCE_SOURCE_TYPES.filter(
    (sourceType) => sourceType !== WORKSPACE_SOURCE_TYPES.RESOLUCION
  )
);

const SITUATION_FIELDS = MATCH_FIELDS;

const text = (value) => (value === null || value === undefined ? "" : String(value).trim());

const unique = (values = []) => [...new Set(values.filter(Boolean))];

const sourceIsActive = (workspace, source) => {
  if (source?.enabled === false) return false;
  if (Array.isArray(workspace?.activeSourceIds) && workspace.activeSourceIds.length) {
    return workspace.activeSourceIds.includes(source.workspaceSourceId);
  }
  return true;
};

const selectedSheetIndexesFor = (source = {}) => new Set(
  Array.isArray(source.selectedSheetIndexes)
    ? source.selectedSheetIndexes
    : (source.selectedSheets || []).map((sheet) => sheet.sheetIndex)
);

const activeSourceRecords = (source = {}) => {
  const selected = selectedSheetIndexesFor(source);
  const records = [
    ...(source.administrativeRecords || []),
    ...(source.interpretedSituations || []),
  ];
  return records.filter((record) => {
    const sheetIndex = record.sourceSheetIndex ?? record.sheetIndex;
    return !selected.size || selected.has(sheetIndex);
  });
};

const valuesForRecord = (record = {}) => {
  const nested = record.valuesNormalized || record.valoresNormalizados || record.situacion || {};
  return SITUATION_FIELDS.reduce((values, field) => {
    const value = record[field] ?? nested[field];
    if (value !== undefined && value !== null) values[field] = value;
    return values;
  }, {});

};

const dniForRecord = (record = {}) => normalizeDni(
  record.dni ||
  record.valoresNormalizados?.dni ||
  record.valuesNormalized?.dni ||
  record.situacion?.dni
);

const sourceAssertionFor = (source = {}, record = {}) =>
  record.evidence?.afirma ||
  record.afirma ||
  source.afirma ||
  ({
    [WORKSPACE_SOURCE_TYPES.MINISTERIO_APTOS]: EVIDENCE_ASSERTIONS.MINISTERIO_APTA,
    [WORKSPACE_SOURCE_TYPES.MINISTERIO_NO_APTOS]: EVIDENCE_ASSERTIONS.MINISTERIO_NO_APTA,
    [WORKSPACE_SOURCE_TYPES.MINISTERIO_OBSERVADOS]: EVIDENCE_ASSERTIONS.MINISTERIO_OBSERVADA,
    [WORKSPACE_SOURCE_TYPES.MINISTERIO_OMITIDOS]: EVIDENCE_ASSERTIONS.MINISTERIO_OMITIDA,
    [WORKSPACE_SOURCE_TYPES.MINISTERIO_REZAGADOS]: EVIDENCE_ASSERTIONS.MINISTERIO_REZAGADA,
    [WORKSPACE_SOURCE_TYPES.RESOLUCION]: EVIDENCE_ASSERTIONS.RESOLUCION_TITULARIZADA,
  }[record.sourceType || source.sourceType] || null);

const stageFor = (source = {}, record = {}) =>
  record.evidence?.etapa || record.stage || source.stage || null;

const sourceIdFor = (source = {}, record = {}) =>
  record.sourceId || record.workspaceSourceId || source.workspaceSourceId || source.sourceId || "";

const evidenceIdFor = (source = {}, record = {}, index = 0) => {
  const localId = record.evidenceId || record.id || record.recordKey ||
    `fila_${record.sourceRowNumber || record.rowNumber || index + 1}`;
  return `${sourceIdFor(source, record)}::${localId}`;
};

const resolutionNumberFor = (source = {}, record = {}) => extractResolutionNumber(
  record.resolucionNumero,
  record.resolutionNumber,
  record.valoresNormalizados?.resolucionNumero,
  source.resolutionNumber,
  source.fileName,
  source.displayName
);

const resolutionKeyFor = (evidence = {}) => extractResolutionNumber(
  evidence.resolutionNumber,
  evidence.fileName,
  evidence.displayName
);

const resolutionFamilyFor = (evidence = {}) => resolutionKeyFor(evidence);

const sourceMetadataFor = (source = {}, record = {}) => ({
  sourceId: sourceIdFor(source, record),
  workspaceSourceId: source.workspaceSourceId || record.workspaceSourceId || null,
  sourceType: record.sourceType || source.sourceType || null,
  fileName: record.fileName || source.fileName || null,
  displayName: record.displayName || source.displayName || null,
  stage: stageFor(source, record),
  afirma: sourceAssertionFor(source, record),
  resolutionNumber: resolutionNumberFor(source, record) || null,
  resolutionDate: record.resolutionDate || source.resolutionDate || null,
});

const evidenceFor = (source, record, index) => {
  const valuesNormalized = valuesForRecord(record);
  const metadata = sourceMetadataFor(source, record);
  const evidenceId = evidenceIdFor(source, record, index);
  const stage = metadata.stage;
  const assertion = metadata.afirma;
  return {
    ...record,
    ...metadata,
    evidenceId,
    id: evidenceId,
    dni: dniForRecord(record),
    etapa: stage,
    stage,
    afirma: assertion,
    assertion,
    valuesNormalized,
    valoresNormalizados: record.valoresNormalizados || valuesNormalized,
    idPlaza: record.idPlaza || record.externalIds?.ministryPlazaId || null,
    pageNumber: record.pageNumber || record.provenance?.pageNumber || null,
    anexo: record.anexo || record.provenance?.anexo || null,
    rawText: record.rawText || record.text || record.raw?.text || null,
    rawRecord: record.rawRecord || record.valoresOriginales || record.raw || record,
    provenance: {
      ...(record.provenance || {}),
      ...(metadata.sourceId ? { sourceId: metadata.sourceId } : {}),
      sourceType: metadata.sourceType,
      stage,
      afirma: assertion,
      fileName: metadata.fileName,
      pageNumber: record.pageNumber || record.provenance?.pageNumber || null,
      anexo: record.anexo || record.provenance?.anexo || null,
    },
    resolutionFamily: metadata.sourceType === WORKSPACE_SOURCE_TYPES.RESOLUCION
      ? resolutionFamilyFor({ ...metadata, fileName: metadata.fileName })
      : null,
  };
};

const evidenceSort = (left, right) =>
  String(left.evidenceId).localeCompare(String(right.evidenceId), "es");

const processPeopleByDni = (basePeople = []) => new Map(
  (Array.isArray(basePeople) ? basePeople : [])
    .filter((person) => isValidDni(person?.dni))
    .map((person) => [normalizeDni(person.dni), person])
);

/**
 * Indexa sólo evidencia de fuentes ministeriales/resoluciones.
 * El DNI es una frontera de seguridad: los registros fuera de basePeople
 * salen por externalEvidence y nunca entran en el matching de situaciones.
 */
export const buildMinisterialEvidenceIndex = ({ workspace = {}, basePeople = [] } = {}) => {
  const peopleByDni = processPeopleByDni(basePeople);
  const byDni = new Map([...peopleByDni.keys()].map((dni) => [dni, []]));
  const linkedEvidence = [];
  const externalEvidence = [];
  const sources = (workspace.sources || [])
    .filter((source) => sourceIsActive(workspace, source))
    .filter((source) => WORKSPACE_EXTERNAL_EVIDENCE_SOURCE_TYPES.includes(source.sourceType));

  sources.forEach((source) => {
    activeSourceRecords(source).forEach((record, index) => {
      const evidence = evidenceFor(source, record, index);
      const dni = evidence.dni;
      if (!isValidDni(dni) || !peopleByDni.has(dni)) {
        externalEvidence.push({
          ...evidence,
          classification: MINISTERIAL_EVIDENCE_CLASSIFICATIONS.EXTERNAL,
          reason: !isValidDni(dni) ? "dni_invalido_o_ausente" : "dni_fuera_del_universo",
        });
        return;
      }
      const linked = {
        ...evidence,
        classification: null,
      };
      byDni.get(dni).push(linked);
      linkedEvidence.push(linked);
    });
  });

  byDni.forEach((records, dni) => records.sort(evidenceSort));
  linkedEvidence.sort(evidenceSort);
  externalEvidence.sort(evidenceSort);

  return {
    byDni,
    linkedEvidence,
    externalEvidence,
    processDnis: [...peopleByDni.keys()].sort(),
    externalDnis: unique(externalEvidence.map((evidence) => evidence.dni).filter(isValidDni)).sort(),
    sources,
  };
};

const canonicalSituationsFor = (person = {}) => {
  const usedIds = new Set();
  return (Array.isArray(person.situaciones) ? person.situaciones : []).map((situation, index) => {
    const baseId = situation.id || `${normalizeDni(person.dni)}::situacion_${index + 1}`;
    let id = baseId;
    let suffix = 2;
    while (usedIds.has(id)) {
      id = `${baseId}::${suffix}`;
      suffix += 1;
    }
    usedIds.add(id);
    return { ...situation, id };
  });
};

const comparableFieldsFor = (values = {}) =>
  SITUATION_FIELDS.filter((field) => text(values[field]));

const candidateSituationIdsForRow = ({ rowResult, situationResults, recordKey }) => unique([
  rowResult?.situacionId,
  ...(rowResult?.cardinality === "N:1" ? rowResult.candidateRows || [] : []),
  ...situationResults
    .filter((result) => result.cardinality === "1:N" && (result.candidateRows || []).includes(recordKey))
    .map((result) => result.situacionId),
]);

/**
 * Evalúa en conjunto todas las evidencias comparables del mismo DNI.
 * El matcher necesita ver simultáneamente las situaciones y las filas para
 * resolver cardinalidades 1:N, N:1 y la reserva global de filas.
 */
export const matchEvidenceToPersonSituations = ({
  person = {},
  evidenceRecords = [],
} = {}) => {
  const situations = canonicalSituationsFor(person);
  const situationLinks = [];
  const reviewEvidence = [];
  const personLevelEvidence = [];
  const personDni = normalizeDni(person.dni);
  const comparableRowsBySource = new Map();

  evidenceRecords.forEach((evidence) => {
    if (isValidDni(evidence.dni) && evidence.dni !== personDni) {
      personLevelEvidence.push({
        ...evidence,
        classification: MINISTERIAL_EVIDENCE_CLASSIFICATIONS.EXTERNAL,
        reason: "dni_no_coincide_con_persona",
      });
      return;
    }
    const valuesNormalized = evidence.valuesNormalized || valuesForRecord(evidence);
    const comparableFields = comparableFieldsFor(valuesNormalized);
    if (comparableFields.length < 2 || !situations.length) {
      personLevelEvidence.push({
        ...evidence,
        valuesNormalized,
        classification: MINISTERIAL_EVIDENCE_CLASSIFICATIONS.PERSON_LEVEL,
        reason: situations.length ? "datos_insuficientes_para_vincular_situacion" : "persona_sin_situaciones",
      });
      return;
    }

    const logicalSourceId = evidence.sourceId || evidence.workspaceSourceId || evidence.sourceType || "ministerial";
    if (!comparableRowsBySource.has(logicalSourceId)) comparableRowsBySource.set(logicalSourceId, []);
    comparableRowsBySource.get(logicalSourceId).push({
      evidence,
      row: { recordKey: evidence.evidenceId, valuesNormalized },
    });
  });

  comparableRowsBySource.forEach((comparableRows) => {
    const matched = matchSituationsOneToOne(
      situations,
      comparableRows.map(({ row }) => row),
      {
        totalSituationsForPerson: situations.length,
        totalComparableRows: comparableRows.length,
        confirmedAssignments: 0,
        unresolvedSituations: situations.length,
        unresolvedRows: comparableRows.length,
      }
    );

    comparableRows.forEach(({ evidence, row }) => {
      const rowResult = matched.rowResults.find((result) => result.fila?.recordKey === row.recordKey) || null;
      if (rowResult?.matchStatus === "confirmada" && rowResult.situacionIdVinculada) {
        situationLinks.push({
          evidence,
          situationId: rowResult.situacionIdVinculada,
          classification: MINISTERIAL_EVIDENCE_CLASSIFICATIONS.LINKED_TO_SITUATION,
          match: {
            ...rowResult,
            stage: evidence.stage,
            sourceType: evidence.sourceType,
          },
        });
        return;
      }

      reviewEvidence.push({
        ...evidence,
        classification: MINISTERIAL_EVIDENCE_CLASSIFICATIONS.REVIEW,
        reason: "match_ministerial_requiere_revision",
        candidateSituationIds: candidateSituationIdsForRow({
          rowResult,
          situationResults: matched.situationResults,
          recordKey: row.recordKey,
        }),
        match: rowResult,
      });
    });
  });

  return {
    situations,
    situationLinks,
    reviewEvidence,
    personLevelEvidence,
  };
};

const baseEvidenceForSituation = (situation = {}) => {
  if (Array.isArray(situation.evidencias) && situation.evidencias.length) {
    return situation.evidencias.map((evidence) => ({ ...evidence }));
  }
  const evidences = [];
  if (situation.formularioSolicitud !== false || situation.esSituacionCanonica) {
    evidences.push({
      id: `base-solicitud-${situation.id}`,
      etapa: "solicitud",
      afirma: EVIDENCE_ASSERTIONS.SOLICITUD_DECLARADA,
      sourceId: situation.sourceRefs?.[0]?.sourceId || situation.formularioId || "solicitud_sidca",
      vigente: true,
    });
  }
  if (situation.presentadoSidca === true || situation.estado === "presentada_sidca") {
    evidences.push({
      id: `base-sidca-${situation.id}`,
      etapa: "sidca",
      afirma: EVIDENCE_ASSERTIONS.SIDCA_PRESENTADA,
      sourceId: situation.sourceRefs?.[0]?.sourceId || "presentacion_sidca",
      vigente: true,
      matchStatus: situation.matchStatus || "confirmada",
      matchScore: situation.matchScore ?? null,
    });
  }
  return evidences;
};

const linkedEvidenceForState = (link) => ({
  ...link.evidence,
  id: link.evidence.evidenceId,
  evidenceId: link.evidence.evidenceId,
  etapa: link.evidence.stage,
  afirma: link.evidence.assertion,
  vigente: true,
  matchStatus: "confirmada",
  matchScore: link.match?.matchScore ?? link.match?.similarityScore ?? null,
  similarityScore: link.match?.similarityScore ?? null,
  fieldCoverage: link.match?.fieldCoverage ?? null,
  razones: link.match?.razones || [],
  diferencias: link.match?.diferencias || [],
  provenance: link.evidence.provenance,
});

export const deriveSituationMinisterialResult = ({
  situation = {},
  situationLinks = [],
} = {}) => {
  const sortedLinks = [...situationLinks].sort((left, right) =>
    evidenceSort(left.evidence, right.evidence)
  );
  const linkedEvidences = sortedLinks.map(linkedEvidenceForState);
  const state = deriveSituationState({
    evidences: [...baseEvidenceForSituation(situation), ...linkedEvidences],
  });
  const ministerialEvidences = linkedEvidences.filter((evidence) =>
    MINISTERIAL_TYPES.has(evidence.sourceType)
  );
  const resolutionEvidences = linkedEvidences.filter((evidence) =>
    evidence.sourceType === WORKSPACE_SOURCE_TYPES.RESOLUCION
  );
  const ministerialStatus = state.ministerio === MINISTERIO_STATES.SIN_DATO
    ? null
    : state.ministerio;
  const evidenceIds = linkedEvidences.map((evidence) => evidence.evidenceId);

  return {
    situation: { ...situation },
    situationId: situation.id,
    state,
    label: state.etiqueta,
    ministerialStatus,
    resolutionStatus: state.resolucion,
    ministerialEvidences,
    resolutionEvidences,
    linkedEvidence: linkedEvidences,
    evidenceIds,
    titularizada: state.resolucion === RESOLUCION_STATES.TITULARIZADA,
    contradictory: state.etiqueta === SITUATION_LABELS.CONTRADICTORIA,
    requiresReview: Boolean(state.bloqueo),
  };
};

const situationSummaryCounts = (situationResults = []) => ({
  aptas: situationResults.filter((item) => item.ministerialStatus === MINISTERIO_STATES.APTA).length,
  noAptas: situationResults.filter((item) => item.ministerialStatus === MINISTERIO_STATES.NO_APTA).length,
  observadas: situationResults.filter((item) => item.ministerialStatus === MINISTERIO_STATES.OBSERVADA).length,
  omitidasMinisterio: situationResults.filter((item) => item.ministerialStatus === MINISTERIO_STATES.OMITIDA).length,
  rezagadas: situationResults.filter((item) => item.ministerialStatus === MINISTERIO_STATES.REZAGADA).length,
});

export const derivePersonMinisterialSummary = ({
  situationResults = [],
  personLevelEvidence = [],
  reviewEvidence = [],
} = {}) => {
  const states = situationResults.map((item) => item.state);
  const baseSummary = derivePersonSummary(states);
  const counts = situationSummaryCounts(situationResults);
  const hasMinisterialEvidence = situationResults.some((item) => item.ministerialEvidences.length) ||
    personLevelEvidence.some((evidence) => MINISTERIAL_TYPES.has(evidence.sourceType));
  const hasResolutionEvidence = situationResults.some((item) => item.resolutionEvidences.length) ||
    personLevelEvidence.some((evidence) => evidence.sourceType === WORKSPACE_SOURCE_TYPES.RESOLUCION);
  const contradictions = baseSummary.contradictorias;
  const reviewSituationIds = unique([
    ...reviewEvidence.flatMap((evidence) => evidence.candidateSituationIds || []),
    ...situationResults.filter((item) => item.requiresReview).map((item) => item.situationId),
  ]);
  const enRevision = baseSummary.enRevision + reviewSituationIds.filter(
    (situationId) => !situationResults.some((item) => item.situationId === situationId && item.requiresReview)
  ).length;
  const estadoDerivadoDeSituaciones = baseSummary.etiqueta;
  const todasLasSituacionesTitularizadas = situationResults.length > 0 &&
    baseSummary.titularizadas === situationResults.length &&
    baseSummary.enRevision === 0 &&
    contradictions === 0;
  const alertasPersona = personLevelEvidence.length
    ? [{
        tipo: "evidencia_persona_pendiente_vinculacion",
        cantidad: personLevelEvidence.length,
        evidenceIds: personLevelEvidence.map((evidence) => evidence.evidenceId).filter(Boolean),
      }]
    : [];
  let etiqueta = baseSummary.etiqueta;
  if (contradictions > 0 || enRevision > 0) {
    etiqueta = PERSON_LABELS.REQUIERE_REVISION;
  } else if (!situationResults.length) {
    etiqueta = PERSON_LABELS.SIN_SITUACION_ESTRUCTURADA;
  } else if (personLevelEvidence.length && !todasLasSituacionesTitularizadas) {
    etiqueta = PERSON_LABELS.REQUIERE_REVISION;
  } else if (todasLasSituacionesTitularizadas) {
    etiqueta = PERSON_LABELS.TITULARIZACION_COMPLETA;
  } else if (baseSummary.titularizadas > 0) {
    etiqueta = PERSON_LABELS.TITULARIZACION_PARCIAL;
  } else if (baseSummary.noAptas === situationResults.length) {
    etiqueta = PERSON_LABELS.NO_TITULARIZADA;
  } else if (counts.omitidasMinisterio + counts.rezagadas > 0) {
    etiqueta = PERSON_LABELS.CON_OMISIONES;
  } else if (!hasMinisterialEvidence && !hasResolutionEvidence) {
    etiqueta = PERSON_LABELS.EN_TRAMITE;
  }

  return {
    ...baseSummary,
    ...counts,
    enRevision,
    etiqueta,
    estadoDerivadoDeSituaciones,
    alertasPersona,
    tieneEvidenciaMinisterial: hasMinisterialEvidence,
    tieneEvidenciaResolucion: hasResolutionEvidence,
    evidenciasPersona: personLevelEvidence.length,
    evidenciasRequierenRevision: reviewEvidence.length,
    situacionesConEvidenciaEnRevision: reviewSituationIds.length,
  };
};

const emptyMetrics = () => ({
  situacionesSolicitadas: 0,
  situacionesConEvidenciaMinisterio: 0,
  aptas: 0,
  noAptas: 0,
  observadas: 0,
  rezagadas: 0,
  omitidas: 0,
  situacionesConEvidenciaResolucion: 0,
  titularizadasConfirmadas: 0,
  evidenciaResolucionSinSituacionVinculable: 0,
  contradicciones: 0,
  requierenRevision: 0,
  evidenciasMinisteriales: 0,
  evidenciasResoluciones: 0,
  personasConEvidenciaMinisterial: 0,
  personasConEvidenciaResolucion: 0,
  personasExternasResoluciones: 0,
  personasExternasMinisteriales: 0,
});

const canonicalPersonFor = (person) => ({
  ...person,
  dni: normalizeDni(person.dni),
  nombreCompleto: buildVisiblePersonName(person),
  situaciones: canonicalSituationsFor(person),
});

/** Construye el preview completo sin modificar personas, fuentes ni registros. */
export const buildMinisterialCrossPreview = ({
  workspace = {},
  basePeople = [],
} = {}) => {
  const index = buildMinisterialEvidenceIndex({ workspace, basePeople });
  const metrics = emptyMetrics();
  const people = [...processPeopleByDni(basePeople).entries()]
    .sort(([left], [right]) => left.localeCompare(right, "es"))
    .map(([dni, sourcePerson]) => {
      const canonicalPerson = canonicalPersonFor(sourcePerson);
      const matched = matchEvidenceToPersonSituations({
        person: canonicalPerson,
        evidenceRecords: index.byDni.get(dni) || [],
      });
      const linksBySituation = new Map();
      matched.situationLinks.forEach((link) => {
        if (!linksBySituation.has(link.situationId)) linksBySituation.set(link.situationId, []);
        linksBySituation.get(link.situationId).push(link);
      });
      const situationResults = matched.situations.map((situation) =>
        deriveSituationMinisterialResult({
          situation,
          situationLinks: linksBySituation.get(situation.id) || [],
        })
      );
      const summary = derivePersonMinisterialSummary({
        situationResults,
        personLevelEvidence: matched.personLevelEvidence,
        reviewEvidence: matched.reviewEvidence,
      });
      const person = {
        ...canonicalPerson,
        situaciones: situationResults.map((item) => item.situation),
        situationResults,
        ministerialEvidence: [...index.byDni.get(dni) || []],
        personLevelEvidence: matched.personLevelEvidence,
        reviewEvidence: matched.reviewEvidence,
        resolutions: [...index.byDni.get(dni) || []].filter(
          (evidence) => evidence.sourceType === WORKSPACE_SOURCE_TYPES.RESOLUCION
        ),
        ...summary,
        estadoPersona: summary.etiqueta,
        searchable: normalizeSearchText([
          dni,
          sourcePerson.apellido,
          sourcePerson.nombre,
          buildVisiblePersonName(sourcePerson),
        ].filter(Boolean).join(" ")),
      };

      metrics.situacionesSolicitadas += situationResults.length;
      metrics.situacionesConEvidenciaMinisterio += situationResults.filter((item) => item.ministerialEvidences.length).length;
      metrics.aptas += summary.aptas;
      metrics.noAptas += summary.noAptas;
      metrics.observadas += summary.observadas;
      metrics.rezagadas += summary.rezagadas;
      metrics.omitidas += summary.omitidasMinisterio;
      metrics.situacionesConEvidenciaResolucion += situationResults.filter((item) => item.resolutionEvidences.length).length;
      metrics.titularizadasConfirmadas += situationResults.filter((item) => item.titularizada).length;
      metrics.contradicciones += summary.contradictorias;
      metrics.requierenRevision += summary.enRevision;
      metrics.evidenciasMinisteriales += index.byDni.get(dni).filter((item) => MINISTERIAL_TYPES.has(item.sourceType)).length;
      metrics.evidenciasResoluciones += index.byDni.get(dni).filter((item) => item.sourceType === WORKSPACE_SOURCE_TYPES.RESOLUCION).length;
      metrics.evidenciaResolucionSinSituacionVinculable += matched.personLevelEvidence.filter(
        (evidence) => evidence.sourceType === WORKSPACE_SOURCE_TYPES.RESOLUCION
      ).length + matched.reviewEvidence.filter(
        (evidence) => evidence.sourceType === WORKSPACE_SOURCE_TYPES.RESOLUCION
      ).length;
      if (summary.tieneEvidenciaMinisterial) metrics.personasConEvidenciaMinisterial += 1;
      if (summary.tieneEvidenciaResolucion) metrics.personasConEvidenciaResolucion += 1;
      return person;
    });

  const ministerialResolutionPeople = new Set(
    index.linkedEvidence
      .filter((evidence) => evidence.sourceType === WORKSPACE_SOURCE_TYPES.RESOLUCION)
      .map((evidence) => evidence.dni)
  );
  metrics.personasExternasResoluciones = new Set(
    index.externalEvidence
      .filter((evidence) => evidence.sourceType === WORKSPACE_SOURCE_TYPES.RESOLUCION)
      .map((evidence) => evidence.dni)
      .filter(isValidDni)
  ).size;
  metrics.personasExternasMinisteriales = new Set(
    index.externalEvidence
      .filter((evidence) => MINISTERIAL_TYPES.has(evidence.sourceType))
      .map((evidence) => evidence.dni)
      .filter(isValidDni)
  ).size;
  metrics.personasProceso = people.length;
  metrics.personasConEvidenciaResolucion = ministerialResolutionPeople.size;
  metrics.externalEvidence = index.externalEvidence.length;
  metrics.externalEvidenceRecords = index.externalEvidence;
  metrics.personasConEvidenciaMinisterial = people.filter((person) => person.tieneEvidenciaMinisterial).length;
  metrics.situacionesSinEvidenciaResolucion = metrics.situacionesSolicitadas - metrics.situacionesConEvidenciaResolucion;

  return {
    generatedInMemory: true,
    basePeopleCount: people.length,
    people,
    personas: people,
    externalEvidence: index.externalEvidence,
    metrics,
    processDnis: index.processDnis,
    activeSourceIds: index.sources.map((source) => source.workspaceSourceId),
  };
};

export const ministerialPersonMatchesFilter = (person = {}, filter = MINISTERIAL_PERSON_FILTERS.ALL) => {
  if (!filter || filter === MINISTERIAL_PERSON_FILTERS.ALL) return true;
  if (filter === MINISTERIAL_PERSON_FILTERS.WITHOUT_MINISTRY) return !person.tieneEvidenciaMinisterial;
  if (filter === MINISTERIAL_PERSON_FILTERS.COMPLETE || filter === MINISTERIAL_PERSON_FILTERS.PARTIAL || filter === MINISTERIAL_PERSON_FILTERS.REVIEW) {
    return person.estadoPersona === filter;
  }
  return (person.situationResults || []).some((item) => item.label === filter || item.ministerialStatus === filter);
};

/** Devuelve una traza de auditoría por DNI sin combinar ni mutar registros. */
export const buildMinisterialAuditTrail = ({
  dni,
  workspace = {},
  basePeople = [],
  crossPreview = null,
} = {}) => {
  const normalizedDni = normalizeDni(dni);
  const preview = crossPreview || buildMinisterialCrossPreview({ workspace, basePeople });
  const person = preview.people.find((item) => item.dni === normalizedDni) || null;
  const workspacePerson = (workspace.persons || []).find((item) => normalizeDni(item.dni) === normalizedDni) || null;
  const index = buildMinisterialEvidenceIndex({ workspace, basePeople });
  const presentations = workspacePerson
    ? (workspacePerson.registros || []).filter((record) =>
      [WORKSPACE_SOURCE_TYPES.PRESENTACION_SIDCA, WORKSPACE_SOURCE_TYPES.PRESENTACION_SIDCA_COMPLEMENTARIA]
        .includes(record.sourceType)
    )
    : workspace.sources
      .filter((source) => sourceIsActive(workspace, source))
      .filter((source) => [WORKSPACE_SOURCE_TYPES.PRESENTACION_SIDCA, WORKSPACE_SOURCE_TYPES.PRESENTACION_SIDCA_COMPLEMENTARIA].includes(source.sourceType))
      .flatMap(activeSourceRecords)
      .filter((record) => dniForRecord(record) === normalizedDni);
  const ministerial = (index.byDni.get(normalizedDni) || []).filter((evidence) => MINISTERIAL_TYPES.has(evidence.sourceType));
  const resolutions = (index.byDni.get(normalizedDni) || []).filter((evidence) => evidence.sourceType === WORKSPACE_SOURCE_TYPES.RESOLUCION);

  return {
    dni: normalizedDni,
    foundInProcess: Boolean(person),
    solicitud: person ? {
      dni: person.dni,
      nombreCompleto: buildVisiblePersonName(person),
      situaciones: person.situaciones.map((situation) => ({ ...situation })),
    } : null,
    presentaciones: presentations.map((record) => ({ ...record })),
    ministerio: ministerial.map((evidence) => ({ ...evidence })),
    resolucion177: resolutions.filter((evidence) => evidence.resolutionFamily === "177").map((evidence) => ({ ...evidence })),
    resolucion222: resolutions.filter((evidence) => evidence.resolutionFamily === "222").map((evidence) => ({ ...evidence })),
    resoluciones: resolutions.map((evidence) => ({ ...evidence })),
    externalEvidence: index.externalEvidence
      .filter((evidence) => evidence.dni === normalizedDni)
      .map((evidence) => ({ ...evidence })),
    resultados: person ? person.situationResults.map((result) => ({
      ...result,
      situation: { ...result.situation },
      linkedEvidence: result.linkedEvidence.map((evidence) => ({ ...evidence })),
    })) : [],
    estadoDerivado: person?.estadoPersona || null,
  };
};
