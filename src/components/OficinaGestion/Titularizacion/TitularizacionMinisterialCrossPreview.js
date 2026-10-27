import React, { useMemo, useState } from "react";
import { InputText } from "primereact/inputtext";
import { Tag } from "primereact/tag";

import {
  buildMinisterialAuditTrail,
  buildMinisterialCrossPreview,
  MINISTERIAL_PERSON_FILTERS,
  ministerialPersonMatchesFilter,
} from "../../../services/titularizacion/titularizacionMinisterialCrossService";
import { buildVisiblePersonName } from "../../../services/titularizacion/titularizacionNormalizer";
import styles from "../../../pages/Admin/OficinaGestion/Titularizacion/TitularizacionStage2.module.css";

const metricItems = [
  ["situacionesSolicitadas", "Situaciones solicitadas"],
  ["situacionesConEvidenciaMinisterio", "Con evidencia Ministerio"],
  ["aptas", "Aptas"],
  ["noAptas", "No Aptas"],
  ["observadas", "Observadas"],
  ["rezagadas", "Rezagadas"],
  ["omitidas", "Omitidas"],
  ["situacionesConEvidenciaResolucion", "Con evidencia de resolución"],
  ["titularizadasConfirmadas", "Titularizadas confirmadas"],
  ["evidenciaResolucionSinSituacionVinculable", "Resolución sin situación vinculable"],
  ["contradicciones", "Contradicciones"],
  ["requierenRevision", "Requieren revisión"],
];

const filters = [
  [MINISTERIAL_PERSON_FILTERS.ALL, "Todos"],
  [MINISTERIAL_PERSON_FILTERS.COMPLETE, "Titularización completa"],
  [MINISTERIAL_PERSON_FILTERS.PARTIAL, "Titularización parcial"],
  [MINISTERIAL_PERSON_FILTERS.APTA_PENDING, "Aptos pendientes"],
  [MINISTERIAL_PERSON_FILTERS.NO_APTA, "No aptos"],
  [MINISTERIAL_PERSON_FILTERS.OBSERVED, "Observados"],
  [MINISTERIAL_PERSON_FILTERS.OMITTED, "Omitidos"],
  [MINISTERIAL_PERSON_FILTERS.DELAYED, "Rezagados"],
  [MINISTERIAL_PERSON_FILTERS.REVIEW, "Requiere revisión"],
  [MINISTERIAL_PERSON_FILTERS.WITHOUT_MINISTRY, "Sin evidencia ministerial"],
];

const severityFor = (label) => {
  if (label === "TITULARIZADA" || label === "TITULARIZACION_COMPLETA") return "success";
  if (label === "APTA_PENDIENTE_RESOLUCION" || label === "OMITIDA" || label === "REZAGADA") return "warning";
  if (label === "CONTRADICTORIA" || label === "REQUIERE_REVISION" || label === "NO_APTA") return "danger";
  return "info";
};

const formatScore = (value) => value === null || value === undefined ? "—" : Number(value).toFixed(2);

const situationForEvidence = (person, evidenceId) =>
  person.situationResults?.find((item) => item.evidenceIds.includes(evidenceId));

const ResolutionDetails = ({ person }) => (
  <div className={styles.workspacePersonSection}>
    <h4>RESOLUCIONES</h4>
    {person.resolutions.length ? person.resolutions.map((resolution) => {
      const situation = situationForEvidence(person, resolution.evidenceId);
      const link = situation?.linkedEvidence?.find((evidence) => evidence.evidenceId === resolution.evidenceId);
      return (
        <details key={resolution.evidenceId} className={styles.workspaceRecord}>
          <summary>{resolution.resolutionNumber || "Resolución sin número"} · {resolution.fileName || "Archivo no informado"}</summary>
          <div className={styles.workspaceRecordMeta}>
            <span>Página {resolution.pageNumber || "—"}</span>
            <span>DNI {resolution.dni || person.dni}</span>
            <span>ID Plaza {resolution.idPlaza || "—"}</span>
            <span>{situation ? `Situación vinculada: ${situation.situationId}` : "Sin situación vinculada"}</span>
            <span>Estado del vínculo: {link ? "confirmado" : resolution.classification || "revisión"}</span>
            <span>Score {formatScore(link?.matchScore ?? link?.similarityScore)}</span>
            <span>Coverage {formatScore(link?.fieldCoverage)}</span>
          </div>
          <div className={styles.technicalLists}>
            <div><span>Datos extraídos</span><strong>{[resolution.valoresNormalizados?.cargo, resolution.valoresNormalizados?.establecimiento, resolution.valoresNormalizados?.horas].filter(Boolean).join(" · ") || "—"}</strong></div>
            <div><span>Razones</span><strong>{link?.razones?.join(" · ") || resolution.reason || "—"}</strong></div>
          </div>
          <pre>{JSON.stringify(resolution.rawRecord || resolution.rawText || resolution.provenance || resolution, null, 2)}</pre>
        </details>
      );
    }) : <span className={styles.muted}>Sin registros de resolución.</span>}
  </div>
);

const PersonDetails = ({ person }) => (
  <div className={styles.crossPersonDetails}>
    {person.personLevelEvidence.length > 0 && (
      <div className={styles.crossWarning}>
        <strong>Evidencia a nivel persona sin vínculo automático</strong>
        <span>{person.personLevelEvidence.length} registro(s) conservado(s). Las situaciones no se modifican por estos registros.</span>
      </div>
    )}
    {person.reviewEvidence.length > 0 && (
      <div className={styles.crossReason}>
        <strong>Evidencia que requiere revisión</strong>
        <span>{person.reviewEvidence.length} registro(s) con candidatos no suficientemente discriminados.</span>
      </div>
    )}
    {person.situationResults.map((item) => (
      <article className={styles.crossSituationCard} key={item.situationId}>
        <div className={styles.crossSituationHeader}>
          <div><strong>Situación {item.situationId}</strong><small>{item.situation.establecimiento || "Establecimiento no informado"} · {item.situation.cargo || "Cargo no informado"}</small></div>
          <Tag value={item.label} severity={severityFor(item.label)} />
        </div>
        <div className={styles.crossSituationFields}>
          <div><span>Ministerio</span><strong>{item.ministerialStatus || "SIN EVIDENCIA"}</strong></div>
          <div><span>Resolución</span><strong>{item.resolutionStatus || "SIN_DATO"}</strong></div>
          <div><span>Evidencias</span><strong>{item.linkedEvidence.length}</strong></div>
          <div><span>Estado dimensional</span><strong>{item.state.etiqueta}</strong></div>
        </div>
        {item.linkedEvidence.length > 0 && (
          <div className={styles.workspaceRecordMeta}>
            {item.linkedEvidence.map((evidence) => <span key={evidence.evidenceId}>{evidence.sourceType} · {evidence.resolutionNumber || evidence.fileName || evidence.sourceId}</span>)}
          </div>
        )}
      </article>
    ))}
    <ResolutionDetails person={person} />
  </div>
);

const AuditRecord = ({ record }) => (
  <details className={styles.workspaceRecord}>
    <summary>{record.sourceType || "Fuente"} · {record.fileName || record.displayName || "Registro"} · Página {record.pageNumber || record.provenance?.pageNumber || "—"}</summary>
    <div className={styles.workspaceRecordMeta}>
      <span>DNI {record.dni || record.dniCandidate || "—"}</span>
      <span>Apellido y nombre {buildVisiblePersonName(record) || "—"}</span>
      <span>ID Plaza {record.idPlaza || "—"}</span>
      <span>Cargo {record.cargo || record.valoresNormalizados?.cargo || "—"}</span>
      <span>Anexo {record.anexo || record.provenance?.anexo || "—"}</span>
      {record.pdfRecordStatus && <span>{record.pdfRecordStatus}</span>}
    </div>
    <pre>{record.rawText || record.textOriginal || JSON.stringify(record.rawRecord || record, null, 2)}</pre>
  </details>
);

const AuditSection = ({ title, records }) => (
  <div className={styles.workspacePersonSection}>
    <h4>{title}</h4>
    {records.length ? records.map((record, index) => <AuditRecord key={`${record.evidenceId || record.recordKey || "registro"}-${index}`} record={record} />) : <span className={styles.muted}>Sin registros.</span>}
  </div>
);

const AuditTrail = ({ audit }) => {
  if (!audit) return null;
  return (
    <div className={styles.unlinkedPresentationPanel}>
      <h3>AUDITORÍA DEL CRUCE MINISTERIAL</h3>
      <p className={styles.muted}>DNI exacto: {audit.dni || "—"} · Estado derivado: {audit.estadoDerivado || "Fuera del universo SIDCA"}</p>
      {audit.solicitud ? (
        <div className={styles.workspacePersonSection}>
          <h4>SOLICITUD SIDCA</h4>
          {audit.solicitud.situaciones.map((situation) => (
            <div className={styles.crossSituationCard} key={situation.id}>
              <strong>Situación {situation.id}</strong>
              <div className={styles.crossSituationFields}>
                {[
                  ["Cargo", situation.cargo], ["Horas", situation.horas], ["Materia", situation.materia],
                  ["Establecimiento", situation.establecimiento], ["Nivel", situation.nivel], ["Modalidad", situation.modalidad],
                ].map(([label, value]) => <div key={label}><span>{label}</span><strong>{value || "—"}</strong></div>)}
              </div>
            </div>
          ))}
        </div>
      ) : <div className={styles.crossWarning}>El DNI no pertenece al universo canónico SIDCA.</div>}
      <AuditSection title="PRESENTACIONES SIDCA" records={audit.presentaciones} />
      <AuditSection title="MINISTERIO" records={audit.ministerio} />
      <AuditSection title="RES 177" records={audit.resolucion177} />
      <AuditSection title="RES 222" records={audit.resolucion222} />
      {audit.externalEvidence.length > 0 && <AuditSection title="EVIDENCIA EXTERNA" records={audit.externalEvidence} />}
      {audit.resultados.length > 0 && (
        <div className={styles.workspacePersonSection}>
          <h4>RESULTADO DEL CRUCE</h4>
          {audit.resultados.map((result) => (
            <div className={styles.workspaceRecord} key={result.situationId}>
              <div className={styles.workspaceRecordMeta}>
                <span>Situación {result.situationId}</span>
                <span>Resultado {result.label}</span>
                <span>Estado {result.state.etiqueta}</span>
                <span>Evidencias vinculadas {result.linkedEvidence.length}</span>
              </div>
              {result.linkedEvidence.map((evidence) => (
                <div className={styles.workspaceRecordMeta} key={evidence.evidenceId}>
                  <span>{evidence.sourceType}</span>
                  <span>Score {formatScore(evidence.matchScore ?? evidence.similarityScore)}</span>
                  <span>Coverage {formatScore(evidence.fieldCoverage)}</span>
                  <span>Coincidentes {evidence.matchedFields?.join(", ") || "—"}</span>
                  <span>Diferentes {evidence.diferencias?.join(" · ") || "—"}</span>
                </div>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

const TitularizacionMinisterialCrossPreview = ({ workspace, basePeople = [] }) => {
  const [filter, setFilter] = useState(MINISTERIAL_PERSON_FILTERS.ALL);
  const [auditDni, setAuditDni] = useState("");
  const [expandedPeople, setExpandedPeople] = useState({});
  const preview = useMemo(
    () => buildMinisterialCrossPreview({ workspace, basePeople }),
    [workspace, basePeople]
  );
  const visiblePeople = useMemo(
    () => preview.people.filter((person) => ministerialPersonMatchesFilter(person, filter)),
    [preview.people, filter]
  );
  const audit = useMemo(
    () => auditDni.trim()
      ? buildMinisterialAuditTrail({ dni: auditDni, workspace, basePeople, crossPreview: preview })
      : null,
    [auditDni, basePeople, preview, workspace]
  );

  const toggle = (dni) => setExpandedPeople((current) => ({ ...current, [dni]: !current[dni] }));

  return (
    <section className={styles.crossPreview}>
      <div className={styles.crossPreviewHeader}>
        <div>
          <h2>CRUCE MINISTERIAL</h2>
          <p className={styles.muted}>Evaluación por situación canónica en memoria. El resultado no se guarda y las fuentes se conservan completas.</p>
        </div>
        <Tag value="NO PERSISTIDO" severity="warning" />
      </div>

      <div className={styles.crossMetrics}>
        {metricItems.map(([key, label]) => <div key={key} className={styles.crossMetric}><span>{label}</span><strong>{preview.metrics[key] || 0}</strong></div>)}
      </div>

      <div className={styles.pendingToolbar}>
        <label>
          Filtrar personas
          <select value={filter} onChange={(event) => setFilter(event.target.value)}>
            {filters.map(([value, label]) => <option value={value} key={value}>{label}</option>)}
          </select>
        </label>
        <span className={styles.muted}>{visiblePeople.length} de {preview.people.length} personas del proceso</span>
        {(preview.externalEvidence?.length || 0) > 0 && <span className={styles.muted}>{preview.externalEvidence.length} evidencia(s) externa(s), separada(s) sin participación</span>}
      </div>

      <div className={styles.pendingToolbar}>
        <label>
          Auditar un DNI exacto
          <InputText value={auditDni} onChange={(event) => setAuditDni(event.target.value)} placeholder="Ej. 34118279" />
        </label>
        <span className={styles.muted}>Consulta solicitud, presentaciones, Ministerio, RES 177, RES 222 y estado derivado.</span>
      </div>
      <AuditTrail audit={audit} />

      <div className={styles.crossPeopleTable}>
        <div className={styles.crossTableHeader}>
          <span>DNI</span><span>Apellido y nombre</span><span>Situaciones</span><span>Titularizadas</span><span>Ministerio</span><span>Resoluciones</span><span>Estado persona</span><span />
        </div>
        {visiblePeople.map((person) => (
          <div className={styles.crossPersonBlock} key={person.dni}>
            <div className={styles.crossPersonRow}>
              <strong>{person.dni}</strong>
              <span>{buildVisiblePersonName(person) || "—"}</span>
              <span>{person.totalSituaciones}</span>
              <span>{person.titularizadas}</span>
              <span>{person.aptas + person.noAptas + person.observadas + person.rezagadas + person.omitidasMinisterio}</span>
              <span>{person.resolutions.length}</span>
              <Tag value={person.estadoPersona} severity={severityFor(person.estadoPersona)} />
              <button type="button" className="p-button p-component p-button-text p-button-sm" onClick={() => toggle(person.dni)}>
                {expandedPeople[person.dni] ? "Ocultar" : "Expandir"}
              </button>
            </div>
            {expandedPeople[person.dni] && <PersonDetails person={person} />}
          </div>
        ))}
        {!visiblePeople.length && <div className={styles.empty}>No hay personas para el filtro actual.</div>}
      </div>
    </section>
  );
};

export default TitularizacionMinisterialCrossPreview;
