import React, { useMemo, useState } from "react";
import { Button } from "primereact/button";
import { Tag } from "primereact/tag";

import {
  PREVIEW_DECISION_TYPES,
  PREVIEW_RESULT_LABELS,
} from "../../../services/titularizacion/titularizacionPreviewService";
import { buildVisiblePersonName } from "../../../services/titularizacion/titularizacionNormalizer";
import styles from "../../../pages/Admin/OficinaGestion/Titularizacion/TitularizacionStage2.module.css";

const FIELD_LABELS = {
  cargo: "Cargo",
  horas: "Horas",
  materia: "Materia",
  establecimiento: "Establecimiento",
  nivel: "Nivel",
  modalidad: "Modalidad",
  cursoAnio: "Curso/Año",
};

const resultSeverity = (result) => {
  if (result === PREVIEW_RESULT_LABELS.PRESENTADA) return "success";
  if (result === PREVIEW_RESULT_LABELS.POSIBLE_OMISION) return "warning";
  if (result === PREVIEW_RESULT_LABELS.REVISION) return "danger";
  if (result === PREVIEW_RESULT_LABELS.PRESENTADA_SIN_SOLICITUD) return "danger";
  if (result === PREVIEW_RESULT_LABELS.PRESENTADA_SIN_ANTECEDENTE) return "danger";
  if (result === PREVIEW_RESULT_LABELS.PRESENTADA_SIN_SITUACION_COMPATIBLE) return "warning";
  return "info";
};

const formatScore = (value) =>
  value === null || value === undefined ? "—" : Number(value).toFixed(2);

const situationLabel = (value) => value || "—";

const affiliationSeverity = (state) =>
  state === "AFILIADO" ? "success" : state === "NO_AFILIADO" ? "danger" : "secondary";

const candidateLabel = (candidate) =>
  `${candidate.fileName || candidate.sourceType || "Fuente SIDCA"} · ${candidate.sourceSheetName || "Hoja"} · fila ${candidate.numeroFila || candidate.recordKey} · score ${formatScore(candidate.similarityScore)} · cobertura ${formatScore(candidate.fieldCoverage)}`;

const MatchTechnicalDetails = ({ item }) => {
  const { result, scopeEvaluation } = item;
  return (
    <details className={styles.technicalDetails}>
      <summary>Ver trazabilidad técnica</summary>
      <div className={styles.technicalGrid}>
        <span>similarityScore</span><strong>{formatScore(result.similarityScore)}</strong>
        <span>fieldCoverage</span><strong>{formatScore(result.fieldCoverage)}</strong>
        <span>strongMatches</span><strong>{result.strongMatches ?? 0}</strong>
        <span>cardinalidad</span><strong>{result.cardinality || "—"}</strong>
        <span>discriminador</span><strong>{result.discriminator?.satisfied ? "satisfecho" : "pendiente"}</strong>
        <span>scope</span><strong>{scopeEvaluation?.inScope === true ? "dentro" : scopeEvaluation?.inScope === false ? "fuera" : "no determinable"}</strong>
        <span>fila Excel</span><strong>{result.recordKey || result.candidateRows?.join(", ") || "—"}</strong>
      </div>
      <div className={styles.technicalLists}>
        <div><span>Campos coincidentes</span><strong>{result.matchedFields?.join(", ") || "—"}</strong></div>
        <div><span>Campos diferentes</span><strong>{result.differentFields?.join(", ") || "—"}</strong></div>
        <div><span>Razones</span><strong>{result.razones?.join(" · ") || "—"}</strong></div>
        <div><span>Diferencias</span><strong>{result.diferencias?.join(" · ") || "—"}</strong></div>
      </div>
    </details>
  );
};

const SituationPreview = ({ item, onDecision }) => {
  const [selectedCandidate, setSelectedCandidate] = useState(
    item.result.recordKey || item.candidates?.[0]?.recordKey || ""
  );
  const { situation, result, adminResult } = item;
  const isGrouping = result.tipoInconsistencia === "revision_agrupamiento";
  const isDesegregation = result.tipoInconsistencia === "revision_desagregacion";
  const canChoose = result.matchStatus !== "confirmada" && item.candidates?.length > 0;

  return (
    <article className={styles.crossSituationCard}>
      <div className={styles.crossSituationHeader}>
        <div>
          <strong>Situación</strong>
          <small>{situation.id}</small>
        </div>
        <Tag value={adminResult} severity={resultSeverity(adminResult)} />
      </div>

      <div className={styles.crossSituationFields}>
        {Object.entries(FIELD_LABELS).map(([key, label]) => (
          <div key={key}>
            <span>{label}</span>
            <strong>{situationLabel(situation[key])}</strong>
          </div>
        ))}
      </div>

      {adminResult === PREVIEW_RESULT_LABELS.POSIBLE_OMISION && (
        <p className={styles.crossReason}>
          No se encontró una fila compatible en una fuente declarada completa y la situación está dentro del scope.
        </p>
      )}
      {adminResult === PREVIEW_RESULT_LABELS.SIN_DATO && (
        <p className={styles.crossReason}>
          No hay evidencia suficiente para inferir una omisión: la cobertura es parcial, desconocida o el scope no es determinable.
        </p>
      )}

      <MatchTechnicalDetails item={item} />

      {canChoose && (
        <div className={styles.crossDecisionBox}>
          <label>
            Elegir fila candidata
            <select
              value={selectedCandidate}
              onChange={(event) => setSelectedCandidate(event.target.value)}
            >
              <option value="">Seleccionar…</option>
              {item.candidates.map((candidate) => (
                <option key={candidate.recordKey} value={candidate.recordKey}>
                  {candidateLabel(candidate)}
                </option>
              ))}
            </select>
          </label>
          <div className={styles.crossDecisionActions}>
            <Button
              label="Confirmar coincidencia"
              icon="pi pi-check"
              size="small"
              severity="success"
              disabled={!selectedCandidate}
              onClick={() => onDecision({
                type: PREVIEW_DECISION_TYPES.CONFIRM,
                situationId: situation.id,
                recordKey: selectedCandidate,
              })}
            />
            <Button
              label="Rechazar coincidencia"
              icon="pi pi-times"
              size="small"
              severity="danger"
              outlined
              onClick={() => onDecision({
                type: PREVIEW_DECISION_TYPES.REJECT,
                situationId: situation.id,
              })}
            />
            {isGrouping && (
              <Button
                label="Aceptar agrupamiento"
                icon="pi pi-check-square"
                size="small"
                severity="warning"
                outlined
                onClick={() => onDecision({
                  type: PREVIEW_DECISION_TYPES.ACCEPT_GROUPING,
                  situationId: situation.id,
                  recordKeys: result.candidateRows,
                })}
              />
            )}
            {isDesegregation && (
              <Button
                label="Aceptar desagregación"
                icon="pi pi-check-square"
                size="small"
                severity="warning"
                outlined
                onClick={() => onDecision({
                  type: PREVIEW_DECISION_TYPES.ACCEPT_DISEGREGATION,
                  situationId: situation.id,
                  recordKeys: result.candidateRows,
                })}
              />
            )}
          </div>
        </div>
      )}
    </article>
  );
};

const metricItems = [
  ["personasProceso", "Personas del proceso"],
  ["personasConSolicitudEstructurada", "Con solicitud estructurada"],
  ["personasSinSolicitudEstructurada", "Sin solicitud estructurada"],
  ["situacionesSolicitadas", "Situaciones solicitadas"],
  ["presentadasSidca", "COINCIDENCIAS CONFIRMADAS"],
  ["posiblesOmisionesSidca", "Posibles omisiones SIDCA"],
  ["requierenRevision", "Requieren revisión"],
  ["sinDatoSuficiente", "Sin dato suficiente"],
  ["presentadasSinSituacionCompatible", "Sin situación compatible"],
  ["presentadasSinSolicitudEstructurada", "Sin solicitud estructurada"],
  ["presentadasSinAntecedente", "Sin antecedente"],
  ["situacionesPresentadas", "SITUACIONES SIDCA LEÍDAS"],
  ["agrupamientosARevisar", "Agrupamientos a revisar"],
  ["desagregacionesARevisar", "Desagregaciones a revisar"],
];

const Distribution = ({ title, values }) => (
  <div className={styles.distributionCard}>
    <h4>{title}</h4>
    {Object.entries(values || {}).map(([label, value]) => (
      <div key={label} className={styles.distributionRow}>
        <span>{label}</span><strong>{value}</strong>
      </div>
    ))}
    {!Object.keys(values || {}).length && <span className={styles.muted}>Sin matches comparables todavía.</span>}
  </div>
);

const TitularizacionCrucePreview = ({ preview, onDecision }) => {
  const [expandedPeople, setExpandedPeople] = useState({});
  const invalidRequestPeople = preview.invalidRequestPeople || [];

  const sortedPeople = useMemo(
    () => [...(preview.personas || [])].sort((left, right) => String(left.dni).localeCompare(String(right.dni))),
    [preview.personas]
  );

  const togglePerson = (dni) =>
    setExpandedPeople((current) => ({ ...current, [dni]: !current[dni] }));

  const togglePresentedPerson = (dni) =>
    setExpandedPeople((current) => ({
      ...current,
      [`presentada:${dni}`]: !current[`presentada:${dni}`],
    }));

  return (
    <section className={styles.crossPreview}>
      <div className={styles.crossPreviewHeader}>
        <div>
          <h2>7. Preview del cruce</h2>
          <p className={styles.muted}>
            Solicitudes canónicas contra las fuentes SIDCA activas del workspace. Todo este resultado vive únicamente en memoria.
          </p>
        </div>
        <Tag value="NO PERSISTIDO" severity="warning" />
      </div>

      <div className={styles.crossMetrics}>
        {metricItems.map(([key, label]) => (
          <div key={key} className={styles.crossMetric}>
            <span>{label}</span>
            <strong>{preview.metrics[key] || 0}</strong>
          </div>
        ))}
      </div>

      <div className={styles.calibrationGrid}>
        <Distribution title="Distribución similarityScore" values={preview.calibration.scoreDistribution} />
        <Distribution title="Distribución fieldCoverage" values={preview.calibration.fieldCoverageDistribution} />
      </div>

      {invalidRequestPeople.length > 0 && (
        <div className={styles.crossWarning}>
          <strong>{invalidRequestPeople.length} solicitud(es) separada(s) por DNI ausente o inválido.</strong>
          <span>No se mezclan con personas canónicas ni se cuentan en Personas solicitantes.</span>
        </div>
      )}

      <div className={styles.crossPeopleTable}>
        <div className={styles.crossTableHeader}>
          <span>DNI</span><span>Apellido y nombre</span><span>Situaciones</span><span>Presentadas</span><span>Omisiones</span><span>Revisión</span><span>Estado persona</span><span aria-hidden="true" />
        </div>
        {sortedPeople.map((persona) => (
          <div key={persona.dni} className={styles.crossPersonBlock}>
            <div className={styles.crossPersonRow}>
              <strong>{persona.dni}</strong>
              <span>{buildVisiblePersonName(persona) || "—"}</span>
              <span>{persona.situacionesCount}</span>
              <span>{persona.presentadas}</span>
              <span>{persona.posiblesOmisiones}</span>
              <span>{persona.revisiones}</span>
              <Tag value={persona.estadoPersona} severity={persona.revisiones ? "danger" : persona.posiblesOmisiones ? "warning" : "success"} />
              <Button
                label={expandedPeople[persona.dni] ? "Ocultar" : "Expandir"}
                icon={expandedPeople[persona.dni] ? "pi pi-chevron-up" : "pi pi-chevron-down"}
                text
                size="small"
                onClick={() => togglePerson(persona.dni)}
              />
            </div>
            {expandedPeople[persona.dni] && (
              <div className={styles.crossPersonDetails}>
                {persona.situationResults.map((item) => (
                  <SituationPreview
                    key={item.situation.id}
                    item={item}
                    onDecision={onDecision}
                  />
                ))}
              </div>
            )}
          </div>
        ))}
        {!sortedPeople.length && <div className={styles.empty}>No hay personas solicitantes con DNI válido.</div>}
      </div>

      {preview.presentedWithoutRequest.length > 0 && (
        <div className={styles.unlinkedPresentationPanel}>
          <h3>Presentaciones SIDCA sin situación vinculada</h3>
          <p className={styles.muted}>
            Una fila por persona identificada por DNI. Los registros de presentación se conservan
            individualmente para conciliación y revisión manual.
          </p>
          <div className={styles.unlinkedHeader}>
            <span>DNI</span>
            <span>Apellido y nombre</span>
            <span>Antecedente</span>
            <span>Solicitud estructurada</span>
            <span>Afiliación</span>
            <span>Fuente(s)</span>
            <span>Hoja/Fila presentación</span>
            <span>Estado</span>
            <span aria-hidden="true" />
          </div>
          <div className={styles.unlinkedRows}>
            {preview.presentedWithoutRequest.map((item) => (
              <div key={item.dni} className={styles.unlinkedPersonBlock}>
                <div className={styles.unlinkedRow}>
                <strong>{item.dni}</strong>
                <span>{item.nombreCompleto || "—"}</span>
                <span>{item.antecedenteEnTitularizacion ? "Sí" : "No"}</span>
                <span>{item.solicitudEstructurada ? "Sí" : "No"}</span>
                <Tag value={item.estadoAfiliacion} severity={affiliationSeverity(item.estadoAfiliacion)} />
                <span>{item.fuentes?.join(" · ") || "Sin antecedente registrado"}</span>
                <span>
                  {item.recordCount} registro{item.recordCount === 1 ? "" : "s"}
                  {item.hojasFilas?.[0] && ` · ${item.hojasFilas[0].sheetName} · Fila ${item.hojasFilas[0].rowNumber}`}
                </span>
                <Tag value={item.estado} severity={resultSeverity(item.estado)} />
                <Button
                  label={expandedPeople[`presentada:${item.dni}`] ? "Ocultar" : "Expandir"}
                  icon={expandedPeople[`presentada:${item.dni}`] ? "pi pi-chevron-up" : "pi pi-chevron-down"}
                  text
                  size="small"
                  onClick={() => togglePresentedPerson(item.dni)}
                />
                </div>
                {expandedPeople[`presentada:${item.dni}`] && (
                  <div className={styles.unlinkedDetails}>
                    <strong>{item.recordCount} registro(s) de presentación conservado(s)</strong>
                    {item.records.map((record, index) => (
                      <div key={record.row.recordKey} className={styles.unlinkedRecord}>
                        <span>Registro {index + 1}</span>
                        <span>
                          {record.row.fileName || record.row.sourceType || "Fuente SIDCA"} · {record.row.sourceSheetName || record.row.hoja || "Hoja no informada"} · Fila {record.row.numeroFila || record.row.sourceRowNumber || record.row.recordKey}
                        </span>
                        <span>{record.reason}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  );
};

export default TitularizacionCrucePreview;
