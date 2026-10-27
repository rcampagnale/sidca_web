import { compareSituations, matchSituationsOneToOne } from "./titularizacionMatcher";
import {
  createSourceDefinition,
  evaluateSourceAbsence,
  SOURCE_COVERAGE,
  SOURCE_SCOPE,
  SOURCE_STAGE,
  isSituationInSourceScope,
} from "./titularizacionSourceModel";
import {
  derivePersonSummary,
  deriveSituationState,
  EVIDENCE_ASSERTIONS,
  PERSON_LABELS,
  SIDCA_STATES,
} from "./titularizacionStateModel";
import {
  buildVisiblePersonName,
  isValidDni,
  normalizeDni,
  normalizeSearchText,
} from "./titularizacionNormalizer";
import { mergePersonIdentity } from "./titularizacionIdentityService";

export const PREVIEW_RESULT_LABELS = Object.freeze({
  PRESENTADA: "PRESENTADA SIDCA",
  POSIBLE_OMISION: "POSIBLE OMISIÓN SIDCA",
  REVISION: "REQUIERE REVISIÓN",
  SIN_DATO: "SIN DATO SIDCA",
  PRESENTADA_SIN_SITUACION_COMPATIBLE: "PRESENTADA SIN SITUACIÓN COMPATIBLE",
  PRESENTADA_SIN_SOLICITUD: "PRESENTADA SIN SOLICITUD ESTRUCTURADA",
  PRESENTADA_SIN_ANTECEDENTE: "PRESENTADA SIN ANTECEDENTE REGISTRADO",
});

export const PREVIEW_DECISION_TYPES = Object.freeze({
  CONFIRM: "confirm",
  REJECT: "reject",
  ACCEPT_GROUPING: "accept-grouping",
  ACCEPT_DISEGREGATION: "accept-desegregation",
});

const unique = (values = []) => [...new Set(values.filter(Boolean))];

const sourceEvidence = ({ source, result, rowKeys = [], manual = false }) => ({
  id: `preview-sidca-${result?.situacionId || rowKeys.join("-") || "row"}`,
  etapa: "sidca",
  afirma: EVIDENCE_ASSERTIONS.SIDCA_PRESENTADA,
  vigente: true,
  sourceId: source.sourceId,
  sourceVersion: source.version,
  matchStatus: "confirmada",
  matchScore: result?.matchScore ?? result?.similarityScore ?? null,
  fieldCoverage: result?.fieldCoverage ?? null,
  registroIds: rowKeys,
  cardinalidad: result?.cardinality || "1:1",
  origen: manual ? "manual_preview" : "automatico_preview",
});

const requestEvidence = (situation) => ({
  id: `preview-solicitud-${situation.id}`,
  etapa: "solicitud",
  afirma: EVIDENCE_ASSERTIONS.SOLICITUD_DECLARADA,
  vigente: true,
  sourceId: situation.sourceRefs?.[0]?.sourceId || situation.formularioId || "solicitud_sidca",
});

const reviewEvidence = ({ situation, source, result, rowKeys = [], manual = false }) => ({
  id: `preview-revision-${situation.id}`,
  etapa: "sidca",
  afirma: EVIDENCE_ASSERTIONS.SIDCA_PRESENTADA,
  vigente: true,
  tipo: "revision",
  sourceId: source.sourceId,
  sourceVersion: source.version,
  matchStatus: "revision",
  matchScore: result?.matchScore ?? result?.similarityScore ?? null,
  fieldCoverage: result?.fieldCoverage ?? null,
  registroIds: rowKeys,
  cardinalidad: result?.cardinality || null,
  origen: manual ? "manual_preview" : "automatico_preview",
});

const emptyManualDecisions = () => ({ situations: {}, rows: {} });

const manualDecisionForSituation = (manualDecisions, situationId) =>
  manualDecisions?.situations?.[situationId] || null;

const candidateOptionsFor = (situation, rows, result) => {
  const candidateKeys = new Set(result?.candidateRows || []);
  const candidates = rows
    .map((fila) => {
      const comparison = compareSituations(situation, fila.valuesNormalized || {});
      return {
        recordKey: fila.recordKey,
        numeroFila: fila.numeroFila,
        dni: fila.dni,
        similarityScore: comparison.similarityScore,
        fieldCoverage: comparison.fieldCoverage,
        matchedFields: comparison.matchedFields,
      };
    })
    .filter((candidate) =>
      candidateKeys.size
        ? candidateKeys.has(candidate.recordKey)
        : candidate.similarityScore >= 0.45
    )
    .sort(
      (left, right) =>
        right.similarityScore - left.similarityScore ||
        right.fieldCoverage - left.fieldCoverage ||
        String(left.recordKey).localeCompare(String(right.recordKey))
    );

  return candidates.slice(0, 12);
};

const applyManualSituationDecision = ({
  result,
  decision,
  assignedRows,
  situationId,
}) => {
  if (!decision) return result;

  if (decision.type === PREVIEW_DECISION_TYPES.REJECT) {
    return {
      ...result,
      recordKey: null,
      sourceRowId: null,
      matchStatus: "revision",
      autoConfirmEligible: false,
      manualDecision: decision,
      razones: unique([...(result.razones || []), "rechazado_manualmente_en_preview"]),
      tipoInconsistencia: "revision",
    };
  }

  const rowKeys = decision.recordKeys?.length
    ? decision.recordKeys
    : decision.recordKey
      ? [decision.recordKey]
      : result.recordKey
        ? [result.recordKey]
        : result.candidateRows || [];
  const cardinality =
    decision.type === PREVIEW_DECISION_TYPES.ACCEPT_GROUPING
      ? "1:N"
      : decision.type === PREVIEW_DECISION_TYPES.ACCEPT_DISEGREGATION
        ? "N:1"
        : "1:1";

  if (!rowKeys.length) return result;

  if (cardinality === "1:1") {
    const alreadyAssigned = rowKeys.some(
      (rowKey) => assignedRows.has(rowKey) && assignedRows.get(rowKey) !== situationId
    );
    if (alreadyAssigned) {
      return {
        ...result,
        recordKey: null,
        sourceRowId: null,
        matchStatus: "revision",
        autoConfirmEligible: false,
        manualDecision: decision,
        razones: unique([...(result.razones || []), "fila_ya_asociada_a_otra_situacion"]),
        tipoInconsistencia: "revision",
      };
    }
  }

  rowKeys.forEach((rowKey) => assignedRows.set(rowKey, situationId));
  return {
    ...result,
    recordKey: cardinality === "1:1" ? rowKeys[0] : null,
    sourceRowId: cardinality === "1:1" ? rowKeys[0] : null,
    candidateRows: rowKeys,
    matchStatus: "confirmada",
    autoConfirmEligible: false,
    manualDecision: decision,
    cardinality,
    tipoInconsistencia: "",
  };
};

const buildStateForSituation = ({ situation, result, source, scopeEvaluation }) => {
  const evidences = [requestEvidence(situation)];
  const rowKeys = result.candidateRows?.length
    ? result.candidateRows
    : result.recordKey
      ? [result.recordKey]
      : [];

  if (result.matchStatus === "confirmada") {
    evidences.push(
      sourceEvidence({
        source,
        result,
        rowKeys,
        manual: Boolean(result.manualDecision),
      })
    );
  }

  const stageEvaluation =
    result.matchStatus === "revision"
      ? {
          matchResult: result,
          evidences: [
            reviewEvidence({
              situation,
              source,
              result,
              rowKeys,
              manual: Boolean(result.manualDecision),
            }),
          ],
        }
      : result.matchStatus === "confirmada"
        ? {}
        : {
            absenceEvaluation: {
              status: evaluateSourceAbsence({
                source,
                situation,
                evidenceFound: false,
              }),
              scopeEvaluation,
            },
          };

  return deriveSituationState({
    evidences,
    stageEvaluations: { sidca: stageEvaluation },
  });
};

const adminResultForState = (state, result) => {
  if (state.sidca === SIDCA_STATES.PRESENTADA_SIN_SOLICITUD) {
    return PREVIEW_RESULT_LABELS.PRESENTADA_SIN_SOLICITUD;
  }
  if (state.sidca === SIDCA_STATES.PRESENTADA) return PREVIEW_RESULT_LABELS.PRESENTADA;
  if (state.sidca === SIDCA_STATES.POSIBLE_OMISION) return PREVIEW_RESULT_LABELS.POSIBLE_OMISION;
  if (state.sidca === SIDCA_STATES.REVISION || result.matchStatus === "revision") {
    return PREVIEW_RESULT_LABELS.REVISION;
  }
  return PREVIEW_RESULT_LABELS.SIN_DATO;
};

const scoreBucket = (score) => {
  if (score < 0.45) return "0.00-0.44";
  if (score < 0.6) return "0.45-0.59";
  if (score < 0.7) return "0.60-0.69";
  if (score < 0.8) return "0.70-0.79";
  if (score < 0.9) return "0.80-0.89";
  if (score < 1) return "0.90-0.99";
  return "1.00";
};

const coverageBucket = (coverage) => {
  if (coverage < 0.5) return "<0.50";
  if (coverage < 0.7) return "0.50-0.69";
  if (coverage < 0.85) return "0.70-0.84";
  return ">=0.85";
};

const distribution = (values, bucketFor) => {
  const buckets = {};
  values.forEach((value) => {
    const bucket = bucketFor(value);
    buckets[bucket] = (buckets[bucket] || 0) + 1;
  });
  return buckets;
};

const personHasStructuredRequest = (persona = {}) =>
  persona.tieneSolicitudEstructurada !== undefined
    ? Boolean(persona.tieneSolicitudEstructurada)
    : Array.isArray(persona.situaciones) && persona.situaciones.length > 0;

const sourceLabelsForPerson = (persona = {}) =>
  unique(
    (persona.fuentesPersona || persona.fuentes || []).map(
      (fuente) => fuente.formularioTitulo || fuente.titulo || fuente.tipoFuente || fuente.formularioId
    )
  );

const classificationForPresentedRow = ({ existingPerson, structuredPerson }) => {
  if (structuredPerson) return PREVIEW_RESULT_LABELS.PRESENTADA_SIN_SITUACION_COMPATIBLE;
  if (existingPerson) return PREVIEW_RESULT_LABELS.PRESENTADA_SIN_SOLICITUD;
  return PREVIEW_RESULT_LABELS.PRESENTADA_SIN_ANTECEDENTE;
};

const reasonForPresentedClassification = (classification) => {
  if (classification === PREVIEW_RESULT_LABELS.PRESENTADA_SIN_SITUACION_COMPATIBLE) {
    return "El DNI existe en la solicitud estructurada, pero no hay una situación compatible.";
  }
  if (classification === PREVIEW_RESULT_LABELS.PRESENTADA_SIN_SOLICITUD) {
    return "El DNI tiene antecedente en Titularización, pero no una solicitud estructurada.";
  }
  return "El DNI no aparece en ninguna fuente válida del proceso de Titularización.";
};

const personPresentation = ({ persona, situations }) => {
  const states = situations.map((item) => item.state);
  const summary = derivePersonSummary(states);
  return {
    ...persona,
    nombreCompleto: buildVisiblePersonName(persona),
    situaciones: situations.map((item) => item.situation),
    situationResults: situations,
    situacionesCount: situations.length,
    presentadas: situations.filter((item) => item.adminResult === PREVIEW_RESULT_LABELS.PRESENTADA).length,
    posiblesOmisiones: situations.filter((item) => item.adminResult === PREVIEW_RESULT_LABELS.POSIBLE_OMISION).length,
    revisiones: situations.filter((item) => item.adminResult === PREVIEW_RESULT_LABELS.REVISION).length,
    sinDato: situations.filter((item) => item.adminResult === PREVIEW_RESULT_LABELS.SIN_DATO).length,
    estadoPersona: summary.etiqueta || PERSON_LABELS.EN_TRAMITE,
    personSummary: summary,
    searchable: normalizeSearchText(
      [persona.dni, persona.apellido, persona.nombre].filter(Boolean).join(" ")
    ),
  };
};

export const buildTitularizacionPreview = ({
  solicitudData = {},
  rows = [],
  source: sourceInput = {},
  manualDecisions = emptyManualDecisions(),
} = {}) => {
  const source = createSourceDefinition({
    sourceId: sourceInput.sourceId || "presentacion_sidca_preview",
    nombre: sourceInput.nombre || "Presentación SIDCA (preview)",
    stage: SOURCE_STAGE.SIDCA,
    sourceScope: sourceInput.sourceScope || SOURCE_SCOPE.SITUATION,
    coverage: sourceInput.coverage || SOURCE_COVERAGE.UNKNOWN,
    scope: sourceInput.scope,
    version: sourceInput.version || 1,
    vigente: sourceInput.vigente !== false,
    metadata: { previewOnly: true, ...(sourceInput.metadata || {}) },
  });

  const baseRequestPeople = (solicitudData.personas || []).filter((persona) =>
    isValidDni(persona.dni)
  );
  const invalidRequestPeople = (solicitudData.personas || []).filter(
    (persona) => !isValidDni(persona.dni)
  );
  const rowsWithDni = rows.map((row) => ({
    ...row,
    dni: normalizeDni(row.dni || row.valoresNormalizados?.dni),
    valuesNormalized: row.valuesNormalized || row.valoresNormalizados || {},
  }));
  const validRequestPeople = baseRequestPeople.map((persona) => {
    const identityRow = rowsWithDni.find((row) => row.dni === normalizeDni(persona.dni));
    if (!identityRow) return persona;
    return mergePersonIdentity(persona, {
      ...identityRow.valuesNormalized,
      ...identityRow,
      sourceType: "Excel workspace",
    });
  });
  const structuredRequestPeople = validRequestPeople.filter(personHasStructuredRequest);
  const rowsByDni = new Map();
  rowsWithDni.forEach((row) => {
    if (!isValidDni(row.dni)) return;
    if (!rowsByDni.has(row.dni)) rowsByDni.set(row.dni, []);
    rowsByDni.get(row.dni).push(row);
  });

  const requestByDni = new Map(
    validRequestPeople.map((persona) => [normalizeDni(persona.dni), persona])
  );
  const structuredRequestByDni = new Map(
    structuredRequestPeople.map((persona) => [normalizeDni(persona.dni), persona])
  );
  const assignedRows = new Map();
  const rowResultsByKey = new Map();
  const situationResults = [];
  const scoreValues = [];
  const coverageValues = [];

  structuredRequestPeople.forEach((persona) => {
    const dni = normalizeDni(persona.dni);
    const situations = Array.isArray(persona.situaciones) ? persona.situaciones : [];
    const matched = matchSituationsOneToOne(situations, rowsByDni.get(dni) || []);
    const rawBySituationId = new Map(
      matched.situationResults.map((result) => [result.situacionId, result])
    );
    matched.situationResults
      .filter((result) => result.matchStatus === "confirmada" && result.recordKey)
      .forEach((result) => assignedRows.set(result.recordKey, result.situacionId));
    const acceptedDesegregation = situations
      .map((item) => manualDecisionForSituation(manualDecisions, item.id))
      .find((decision) => decision?.type === PREVIEW_DECISION_TYPES.ACCEPT_DISEGREGATION);

    situations.forEach((situation) => {
      const rawResult = rawBySituationId.get(situation.id) || {
        situacion: situation,
        situacionId: situation.id,
        matchStatus: null,
        tipoInconsistencia: "omision_sidca",
        candidateRows: [],
        matchScore: null,
        similarityScore: null,
        fieldCoverage: 0,
        razones: [],
        diferencias: [],
      };
      const explicitDecision = manualDecisionForSituation(manualDecisions, situation.id);
      const decision = explicitDecision || (
        acceptedDesegregation &&
        rawResult.tipoInconsistencia === "revision_desagregacion" &&
        rawResult.candidateRows?.some((recordKey) => acceptedDesegregation.recordKeys?.includes(recordKey))
          ? { ...acceptedDesegregation, situationId: situation.id }
          : null
      );
      const effectiveResult = applyManualSituationDecision({
        result: { ...rawResult },
        decision,
        assignedRows,
        situationId: situation.id,
      });
      const scopeEvaluation = isSituationInSourceScope(situation, source);
      const state = buildStateForSituation({
        situation,
        result: effectiveResult,
        source,
        scopeEvaluation,
      });
      const adminResult = adminResultForState(state, effectiveResult);
      const candidates = candidateOptionsFor(
        situation,
        rowsByDni.get(dni) || [],
        rawResult
      );

      if (effectiveResult.similarityScore !== null && effectiveResult.similarityScore !== undefined) {
        scoreValues.push(Number(effectiveResult.similarityScore));
      }
      if (effectiveResult.fieldCoverage !== null && effectiveResult.fieldCoverage !== undefined) {
        coverageValues.push(Number(effectiveResult.fieldCoverage));
      }

      const situationPreview = {
        dni,
        situation,
        result: effectiveResult,
        state,
        adminResult,
        source,
        scopeEvaluation,
        candidates,
      };
      situationResults.push(situationPreview);
    });

    matched.rowResults.forEach((rowResult) => {
      rowResultsByKey.set(rowResult.fila.recordKey, { ...rowResult, dni });
    });
  });

  situationResults.forEach((item) => {
    const result = item.result;
    const rowKeys = result.candidateRows?.length
      ? result.candidateRows
      : result.recordKey
        ? [result.recordKey]
        : [];
    rowKeys.forEach((recordKey) => {
      const rowResult = rowResultsByKey.get(recordKey);
      if (!rowResult) return;
      rowResultsByKey.set(recordKey, {
        ...rowResult,
        matchStatus: result.matchStatus,
        situacionIdVinculada: result.cardinality === "1:1" ? item.situation.id : rowResult.situacionIdVinculada,
        situacionIdsVinculadas:
          result.cardinality === "N:1"
            ? unique([...(rowResult.situacionIdsVinculadas || []), item.situation.id])
            : rowResult.situacionIdsVinculadas,
        tipoInconsistencia: result.tipoInconsistencia || "",
      });
    });
  });

  const presentedWithoutRequestByPerson = new Map();
  rowsWithDni.forEach((row) => {
    const rowResult = rowResultsByKey.get(row.recordKey);
    const hasLinkedSituation = rowResult?.situacionIdVinculada || rowResult?.situacionIdsVinculadas?.length;
    if (hasLinkedSituation || rowResult?.matchStatus === "revision") return;

    const existingPerson = requestByDni.get(row.dni);
    const structuredPerson = structuredRequestByDni.get(row.dni);
    const classification = classificationForPresentedRow({ existingPerson, structuredPerson });
    const state = deriveSituationState({
      evidences: [
        {
          id: `preview-row-${row.recordKey}`,
          etapa: "sidca",
          afirma: EVIDENCE_ASSERTIONS.SIDCA_PRESENTADA,
          vigente: true,
          sourceId: source.sourceId,
          matchStatus: "confirmada",
          presentadaSinSolicitud: true,
        },
      ],
      context: { sinSolicitudVinculada: true },
    });
    const record = {
      row,
      result: rowResult || {
        fila: row,
        matchStatus: null,
        tipoInconsistencia: "presentada_sin_antecedente_registrado",
      },
      dni: row.dni || "DNI inválido/ausente",
      reason: reasonForPresentedClassification(classification),
      classification,
      state,
    };
    const groupKey = isValidDni(row.dni)
      ? `dni:${row.dni}`
      : `revision:${row.recordKey}`;
    const existingGroup = presentedWithoutRequestByPerson.get(groupKey);
    if (existingGroup) {
      existingGroup.records.push(record);
      existingGroup.registros.push(row);
      return;
    }
    const person = existingPerson || {};
    presentedWithoutRequestByPerson.set(groupKey, {
      dni: row.dni || "DNI inválido/ausente",
      apellido: person.apellido || row.apellido || row.valuesNormalized?.apellido || "",
      nombre: person.nombre || row.nombre || row.valuesNormalized?.nombre || "",
      nombreCompleto: buildVisiblePersonName({
        apellido: person.apellido || row.apellido || row.valuesNormalized?.apellido,
        nombre: person.nombre || row.nombre || row.valuesNormalized?.nombre,
        nombreCompleto: row.nombreCompleto || row.valuesNormalized?.apellidoNombre,
      }),
      antecedenteEnTitularizacion: Boolean(existingPerson),
      solicitudEstructurada: Boolean(structuredPerson),
      afiliadoSidca: existingPerson?.afiliadoSidca ?? null,
      estadoAfiliacion: existingPerson?.estadoAfiliacion || "NO_VERIFICADO",
      afiliacionSource: existingPerson?.afiliacionSource || "no_encontrado",
      fuentes: sourceLabelsForPerson(existingPerson),
      estado: classification,
      classification,
      reason: record.reason,
      row,
      record,
      records: [record],
      registros: [row],
    });
  });

  const presentedWithoutRequest = Array.from(presentedWithoutRequestByPerson.values()).map(
    (group) => ({
      ...group,
      recordCount: group.records.length,
      hojasFilas: group.records.map((item) => ({
        sheetName: item.row.sourceSheetName || item.row.hoja || "—",
        rowNumber: item.row.numeroFila || item.row.sourceRowNumber || item.row.recordKey,
      })),
    })
  );

  const situationResultsByPerson = new Map();
  situationResults.forEach((item) => {
    const dni = normalizeDni(item.dni);
    if (!situationResultsByPerson.has(dni)) situationResultsByPerson.set(dni, []);
    situationResultsByPerson.get(dni).push(item);
  });

  const personas = validRequestPeople.map((persona) =>
    personPresentation({
      persona,
      situations: situationResultsByPerson.get(normalizeDni(persona.dni)) || [],
    })
  );

  const reviewSituations = situationResults.filter(
    (item) => item.adminResult === PREVIEW_RESULT_LABELS.REVISION
  );
  const groupingReviews = situationResults.filter(
    (item) => item.result.tipoInconsistencia === "revision_agrupamiento"
  );
  const desegregationReviews = situationResults.filter(
    (item) => item.result.tipoInconsistencia === "revision_desagregacion"
  );
  const possibleOmissions = situationResults.filter(
    (item) => item.adminResult === PREVIEW_RESULT_LABELS.POSIBLE_OMISION
  );
  const presented = situationResults.filter(
    (item) => item.adminResult === PREVIEW_RESULT_LABELS.PRESENTADA
  );
  const noData = situationResults.filter(
    (item) => item.adminResult === PREVIEW_RESULT_LABELS.SIN_DATO
  );

  return {
    previewOnly: true,
    source,
    personas,
    invalidRequestPeople,
    situationResults,
    presentedWithoutRequest,
    rowResults: rowsWithDni.map(
      (row) =>
        rowResultsByKey.get(row.recordKey) || {
          fila: row,
          matchStatus: null,
          tipoInconsistencia: "presentada_sin_solicitud_vinculada",
        }
    ),
    metrics: {
      personasSolicitantes: structuredRequestPeople.length,
      personasProceso: validRequestPeople.length,
      personasConSolicitudEstructurada: structuredRequestPeople.length,
      personasSinSolicitudEstructurada: validRequestPeople.length - structuredRequestPeople.length,
      situacionesSolicitadas: situationResults.length,
      presentadasSidca: presented.length,
      posiblesOmisionesSidca: possibleOmissions.length,
      requierenRevision: reviewSituations.length,
      sinDatoSuficiente: noData.length,
      presentadasSinSolicitud: presentedWithoutRequest.length,
      presentadasSinSituacionCompatible: presentedWithoutRequest.filter(
        (item) => item.classification === PREVIEW_RESULT_LABELS.PRESENTADA_SIN_SITUACION_COMPATIBLE
      ).length,
      presentadasSinSolicitudEstructurada: presentedWithoutRequest.filter(
        (item) => item.classification === PREVIEW_RESULT_LABELS.PRESENTADA_SIN_SOLICITUD
      ).length,
      presentadasSinAntecedente: presentedWithoutRequest.filter(
        (item) => item.classification === PREVIEW_RESULT_LABELS.PRESENTADA_SIN_ANTECEDENTE
      ).length,
      situacionesPresentadas: rowsWithDni.length,
      registrosPresentadosSinVinculo: presentedWithoutRequest.reduce(
        (total, item) => total + item.recordCount,
        0
      ),
      agrupamientosARevisar: groupingReviews.length,
      desagregacionesARevisar: desegregationReviews.length,
      personasSinDniValido: invalidRequestPeople.length,
      filasPresentacion: rowsWithDni.length,
      filasDniInvalido: rowsWithDni.filter((row) => !isValidDni(row.dni)).length,
      scoreDistribution: distribution(scoreValues, scoreBucket),
      fieldCoverageDistribution: distribution(coverageValues, coverageBucket),
    },
    calibration: {
      scoreDistribution: distribution(scoreValues, scoreBucket),
      fieldCoverageDistribution: distribution(coverageValues, coverageBucket),
      comparedSituations: situationResults.filter((item) => item.result.similarityScore !== null).length,
    },
    manualDecisions,
  };
};

export const createPreviewSource = ({
  fileName,
  coverage = SOURCE_COVERAGE.UNKNOWN,
  scope = {},
  metadata = {},
} = {}) =>
  createSourceDefinition({
    sourceId: "presentacion_sidca_preview",
    nombre: fileName || "Presentación SIDCA (preview)",
    stage: SOURCE_STAGE.SIDCA,
    sourceScope: SOURCE_SCOPE.SITUATION,
    coverage,
    scope,
    metadata: { previewOnly: true, ...metadata },
  });

export const emptyPreviewManualDecisions = emptyManualDecisions;
