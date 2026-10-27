import React, { useMemo, useState } from "react";
import { Button } from "primereact/button";
import { InputText } from "primereact/inputtext";
import { Tag } from "primereact/tag";

import {
  WORKSPACE_PRESENTATION_SOURCE_TYPES,
  WORKSPACE_EXTERNAL_EVIDENCE_SOURCE_TYPES,
  WORKSPACE_SOURCE_TYPES,
  searchTitularizacionWorkspacePeople,
  workspaceSourceTypeLabel,
} from "../../../services/titularizacion/titularizacionWorkspaceService";
import { buildVisiblePersonName } from "../../../services/titularizacion/titularizacionNormalizer";
import styles from "../../../pages/Admin/OficinaGestion/Titularizacion/TitularizacionStage2.module.css";

const metricItems = [
  ["fuentesCargadas", "Fuentes cargadas"],
  ["fuentesActivas", "Fuentes activas"],
  ["archivos", "Archivos"],
  ["hojasActivas", "Hojas activas"],
  ["personasUnicas", "Personas únicas"],
  ["personasProceso", "Personas del proceso"],
  ["personasExternas", "Personas externas / revisión"],
  ["personasSoloMinisterio", "Personas sólo Ministerio"],
  ["personasSoloPresentacionSidca", "Personas sólo Presentación SIDCA"],
  ["registrosTotales", "Registros originales totales"],
  ["registrosAdministrativosTotales", "Registros administrativos"],
  ["situacionesEstructuradas", "Situaciones estructuradas"],
  ["personasProcesoConEvidenciaResolucion", "Personas del proceso con evidencia en resoluciones"],
  ["personasConEvidenciaResolucion177", "Personas con evidencia en RES 177"],
  ["personasConEvidenciaResolucion222", "Personas con evidencia en RES 222"],
  ["personasConEvidenciaEnAmbasResoluciones", "Personas con evidencia en ambas resoluciones"],
  ["personasExternasDetectadasResoluciones", "Externas detectadas en resoluciones"],
  ["personasExternasDetectadasMinisteriales", "Externas detectadas en fuentes ministeriales"],
];

const typeSummary = [
  [WORKSPACE_SOURCE_TYPES.PRESENTACION_SIDCA, "Presentación SIDCA"],
  [WORKSPACE_SOURCE_TYPES.PRESENTACION_SIDCA_COMPLEMENTARIA, "SIDCA complementaria"],
  [WORKSPACE_SOURCE_TYPES.MINISTERIO_APTOS, "Ministerio Aptos"],
  [WORKSPACE_SOURCE_TYPES.MINISTERIO_NO_APTOS, "Ministerio No Aptos"],
  [WORKSPACE_SOURCE_TYPES.MINISTERIO_OBSERVADOS, "Observados"],
  [WORKSPACE_SOURCE_TYPES.MINISTERIO_REZAGADOS, "Rezagados"],
  [WORKSPACE_SOURCE_TYPES.MINISTERIO_OMITIDOS, "Omitidos"],
  [WORKSPACE_SOURCE_TYPES.RESOLUCION, "Resoluciones"],
];

const sourceRecordType = (record) => record.sourceType || "OTRA";

const ResolutionSourceAudit = ({ source }) => {
  if (source.sourceType !== WORKSPACE_SOURCE_TYPES.RESOLUCION) return null;
  const diagnostics = source.diagnostics || {};
  const rows = (source.interpretedSituations || source.administrativeRecords || []).slice(0, 20);
  return (
    <details className={styles.workspaceSourceDetails}>
      <summary><strong>AUDITAR EXTRACCIÓN</strong> · muestra de hasta 20 registros</summary>
      <div className={styles.summaryGrid}>
        {[
          ["Páginas totales", source.pdfMetadata?.pageCount],
          ["Páginas con texto", source.pdfMetadata?.textPages],
          ["Registros detectados", diagnostics.registrosResolucion ?? source.rawRecords.length],
          ["DNI confiables", diagnostics.registrosDniConfiables],
          ["DNI sospechosos", diagnostics.registrosDniSospechosos],
          ["Sin DNI", diagnostics.registrosSinDni],
          ["Con nombre", diagnostics.registrosConNombre],
          ["Con cargo", diagnostics.registrosConCargo],
          ["Con ID Plaza", diagnostics.registrosConIdPlaza],
          ["Completos", diagnostics.registrosCompletos],
          ["Parciales", diagnostics.registrosParciales],
          ["DNI únicos confiables", diagnostics.dniUnicosConfiables],
        ].map(([label, value]) => <div className={styles.summaryItem} key={label}><span>{label}</span><strong>{value || 0}</strong></div>)}
      </div>
      <div className={styles.previewTable}>
        <table>
          <thead><tr><th>Página</th><th>DNI</th><th>Candidato</th><th>Nombre</th><th>ID Plaza</th><th>Cargo</th><th>Anexo</th><th>Estado</th><th>RAW</th></tr></thead>
          <tbody>{rows.map((record, index) => (
            <tr key={`${record.recordKey || "registro"}-${index}`}>
              <td>{record.pageNumber || record.provenance?.pageNumber || "—"}</td>
              <td>{record.dni || "—"}</td>
              <td>{record.dniCandidate || "—"} · {record.dniConfidence || "none"}</td>
              <td>{buildVisiblePersonName(record) || "—"}</td>
              <td>{record.idPlaza || "—"}</td>
              <td>{record.cargo || record.valoresNormalizados?.cargo || "—"}</td>
              <td>{record.anexo || record.provenance?.anexo || "—"}</td>
              <td>{record.pdfRecordStatus || "—"}</td>
              <td>{record.rawText || record.textOriginal || record.rawRecord?.textOriginal || "—"}</td>
            </tr>
          ))}</tbody>
        </table>
        {!rows.length && <p className={styles.muted}>No hay registros extraídos para auditar.</p>}
      </div>
    </details>
  );
};

const WorkspacePersonDetails = ({ person }) => {
  const grouped = useMemo(() => ({
    antecedentes: (person.registros || []).filter((record) =>
      !WORKSPACE_PRESENTATION_SOURCE_TYPES.includes(sourceRecordType(record)) &&
      !sourceRecordType(record).startsWith("MINISTERIO") &&
      sourceRecordType(record) !== WORKSPACE_SOURCE_TYPES.RESOLUCION
    ),
    solicitudes: person.situaciones || [],
    sidca: (person.registros || []).filter((record) =>
      WORKSPACE_PRESENTATION_SOURCE_TYPES.includes(sourceRecordType(record))
    ),
    ministerio: (person.registros || []).filter((record) =>
      sourceRecordType(record).startsWith("MINISTERIO")
    ),
    resoluciones: (person.registros || []).filter((record) =>
      sourceRecordType(record) === WORKSPACE_SOURCE_TYPES.RESOLUCION
    ),
  }), [person]);

  const section = (title, records, empty = "Sin registros") => (
    <div className={styles.workspacePersonSection}>
      <h4>{title}</h4>
      {records.length ? records.map((record, index) => (
        <details key={`${record.recordKey || record.id || "registro"}-${index}`} className={styles.workspaceRecord}>
          <summary>
            {record.displayName || record.fileName || "Fuente"} · {record.sheetName || "Hoja no informada"} · Fila {record.sourceRowNumber || record.rowNumber || record.numeroFila || "—"}
          </summary>
          <div className={styles.workspaceRecordMeta}>
            <span>{workspaceSourceTypeLabel(sourceRecordType(record))}</span>
            <span>{record.fileName || "Archivo no informado"}</span>
            <span>{record.sheetName || "Hoja no informada"}</span>
            <span>Fila {record.sourceRowNumber || record.rowNumber || record.numeroFila || "—"}</span>
            {record.blockIndex != null && <span>Bloque {record.blockIndex}</span>}
          </div>
          {sourceRecordType(record) === WORKSPACE_SOURCE_TYPES.RESOLUCION && (
            <div className={styles.detailGrid}>
              <p><span>Resolución</span><strong>{record.resolucionNumero || record.resolutionNumber || "—"}</strong></p>
              <p><span>ID Plaza ministerial</span><strong>{record.idPlaza || record.externalIds?.ministryPlazaId || "—"}</strong></p>
              <p><span>Cargo</span><strong>{record.cargo || "—"}</strong></p>
              <p><span>Organismo / establecimiento</span><strong>{record.organismo || record.establecimiento || "—"}</strong></p>
              <p><span>Página / anexo</span><strong>{record.pageNumber || "—"} · {record.anexo || "—"}</strong></p>
            </div>
          )}
          <pre>{JSON.stringify(record.rawRecord || record.valoresOriginales || record, null, 2)}</pre>
        </details>
      )) : <span className={styles.muted}>{empty}</span>}
    </div>
  );

  return (
    <div className={styles.workspacePersonDetails}>
      {section("ANTECEDENTES TITULARIZACIÓN", grouped.antecedentes)}
      {section("SOLICITUDES ESTRUCTURADAS", grouped.solicitudes)}
      {section("REGISTROS DE PRESENTACIÓN SIDCA", grouped.sidca)}
      {section("REGISTROS MINISTERIO", grouped.ministerio)}
      {section("RESOLUCIONES", grouped.resoluciones)}
    </div>
  );
};

const TitularizacionWorkspacePanel = ({
  workspace,
  search,
  onSearch,
  onConfigureSource,
  onToggleSource,
  onRemoveSource,
}) => {
  const [expandedSources, setExpandedSources] = useState({});
  const [expandedPeople, setExpandedPeople] = useState({});
  const people = useMemo(
    () => searchTitularizacionWorkspacePeople(workspace, search),
    [workspace, search]
  );

  const toggle = (setter, key) => setter((current) => ({ ...current, [key]: !current[key] }));

  return (
    <>
      <section className={styles.panel}>
        <div className={styles.sectionHeader}>
          <div>
            <h2>FUENTES CARGADAS</h2>
            <p className={styles.muted}>Cada archivo permanece disponible en memoria y puede activarse o desactivarse sin ejecutar el Matcher.</p>
          </div>
          <Tag value="WORKSPACE EN MEMORIA" severity="info" />
        </div>
        <div className={styles.workspaceSourceList}>
          {workspace.sources.map((source, index) => {
            const expanded = expandedSources[source.workspaceSourceId];
            const active = workspace.activeSourceIds.includes(source.workspaceSourceId) && source.enabled !== false;
            const isPdf = source.documentKind === "pdf";
            const isExternalEvidence = WORKSPACE_EXTERNAL_EVIDENCE_SOURCE_TYPES.includes(source.sourceType);
            return (
              <article className={styles.workspaceSourceCard} key={source.workspaceSourceId}>
                <div className={styles.workspaceSourceMain}>
                  <div>
                    <strong>{index + 1}. {source.displayName}</strong>
                    <span>Tipo real: {source.sourceType}</span>
                    <span>{workspaceSourceTypeLabel(source.sourceType)} · {source.fileName}</span>
                    <span>Etapa: {source.stage || "—"} · Afirma: {source.afirma || "—"}</span>
                    <span>
                      Estado: {active ? "Activa" : "Desactivada"} · {isPdf ? `Páginas activas: ${source.selectedSheets.length}` : `Hojas seleccionadas: ${source.selectedSheets.length}`}
                    </span>
                    {isPdf && (
                      <span>
                        Páginas: {source.pdfMetadata?.pageCount || source.sheets.length} · Con texto: {source.pdfMetadata?.textPages || 0} · Posibles escaneadas: {source.pdfMetadata?.emptyPages?.length || 0}
                      </span>
                    )}
                    {isExternalEvidence ? (
                      <span>
                        Personas detectadas: {source.metrics?.personasDetectadas ?? source.diagnostics.personasDetectadas ?? 0} · Registros extraídos: {source.metrics?.registrosOriginales ?? source.rawRecords.length}
                      </span>
                    ) : (
                      <span>
                        Personas: {source.metrics?.personasActivas || 0} · Personas detectadas: {source.metrics?.personasDetectadas ?? source.diagnostics.personasDetectadas ?? 0}
                      </span>
                    )}
                    <span>
                      Registros originales: {source.metrics?.registrosOriginales ?? source.rawRecords.length} · Registros administrativos: {source.metrics?.registrosAdministrativos ?? (source.administrativeRecords?.length || 0)} · Situaciones estructuradas: {source.metrics?.situacionesEstructuradas ?? source.interpretedSituations.length} · Situaciones activas: {source.metrics?.situacionesEstructuradasActivas || 0}
                    </span>
                    {isExternalEvidence && (
                      <span>
                        Personas SIDCA encontradas: {source.metrics?.personasSidcaEncontradas || 0} · Registros SIDCA: {source.metrics?.registrosSidca || 0} · Personas externas al proceso: {source.metrics?.personasExternasFuente || 0} · Registros externos: {source.metrics?.registrosExternos || 0}
                      </span>
                    )}
                  </div>
                  <div className={styles.workspaceSourceActions}>
                    <Button label={expanded ? "Ocultar" : "Ver"} size="small" outlined onClick={() => toggle(setExpandedSources, source.workspaceSourceId)} />
                    <Button label="Configurar" size="small" outlined onClick={() => onConfigureSource(source)} />
                    <Button label={active ? "Desactivar" : "Activar"} size="small" severity={active ? "warning" : "success"} outlined onClick={() => onToggleSource(source)} />
                    <Button label="Quitar" size="small" severity="danger" outlined onClick={() => onRemoveSource(source)} />
                  </div>
                </div>
                {expanded && (
                  <div className={styles.workspaceSourceDetails}>
                    <div className={styles.workspaceSheetList}>
                      {source.selectedSheets.map((sheet) => (
                        <span key={`${source.workspaceSourceId}-${sheet.sheetIndex}`}>{isPdf ? `Página ${sheet.sheetIndex + 1}` : sheet.sheetName} · {sheet.rowCount || 0} {isPdf ? "registros" : "filas"}</span>
                      ))}
                    </div>
                    {source.diagnostics.warnings?.length > 0 && <p>Warnings: {source.diagnostics.warnings.join(" · ")}</p>}
                    {source.diagnostics.errors?.length > 0 && <p className={styles.errorList}>Errores: {source.diagnostics.errors.join(" · ")}</p>}
                    <ResolutionSourceAudit source={source} />
                  </div>
                )}
              </article>
            );
          })}
          {!workspace.sources.length && <div className={styles.empty}>Todavía no hay fuentes cargadas.</div>}
        </div>
      </section>

      <section className={styles.panel}>
        <div className={styles.sectionHeader}>
          <div>
            <h2>RESUMEN DEL WORKSPACE</h2>
            <p className={styles.muted}>Las métricas se recalculan sólo con las fuentes activas.</p>
          </div>
        </div>
        <div className={styles.summaryGrid}>
          {metricItems.map(([key, label]) => (
            <div className={styles.summaryItem} key={key}><span>{label}</span><strong>{workspace.metrics[key] || 0}</strong></div>
          ))}
        </div>
        <div className={styles.workspaceTypeSummary}>
          {typeSummary.map(([type, label]) => (
            <div key={type}>
              <span>{label}</span>
              <strong>
                Personas: {workspace.metrics.porTipo[type]?.personas || 0} · Registros originales: {workspace.metrics.porTipo[type]?.registros || 0} · Registros administrativos: {workspace.metrics.porTipo[type]?.registrosAdministrativos || 0} · Situaciones estructuradas: {workspace.metrics.porTipo[type]?.situaciones || 0}
              </strong>
            </div>
          ))}
        </div>
      </section>

      <section className={styles.panel}>
        <div className={styles.sectionHeader}>
          <div>
            <h2>PERSONAS CONSOLIDADAS Y PROVENIENCIA</h2>
            <p className={styles.muted}>Una persona por DNI normalizado exacto. Los registros de cada archivo permanecen separados.</p>
          </div>
          <InputText value={search} onChange={(event) => onSearch(event.target.value)} placeholder="Buscar por DNI, apellido o nombre" />
        </div>
        <div className={styles.workspacePeopleTable}>
          <div className={styles.workspacePeopleHeader}><span>DNI</span><span>Apellido y nombre</span><span>Afiliación</span><span>Fuentes</span><span>Registros originales</span><span>Situaciones interpretadas</span><span>Estado actual</span><span /></div>
          {people.map((person) => {
            const expanded = expandedPeople[person.dni];
            return (
              <React.Fragment key={person.dni}>
                <div className={styles.workspacePersonRow}>
                  <strong>{person.dni}</strong>
                  <span>{buildVisiblePersonName(person) || "—"}</span>
                  <Tag value={person.estadoAfiliacion || "NO_VERIFICADO"} severity={person.afiliadoSidca === true ? "success" : person.afiliadoSidca === false ? "danger" : "secondary"} />
                  <span>{person.fuentesCount || 0}</span>
                  <span>{person.registrosCount || 0}</span>
                  <span>{person.situacionesEstructuradasCount || 0}</span>
                  <span>{person.estadoInicial || person.estado || "—"}</span>
                  <Button label={expanded ? "Ocultar" : "Expandir"} size="small" text onClick={() => toggle(setExpandedPeople, person.dni)} />
                </div>
                {expanded && <WorkspacePersonDetails person={person} />}
              </React.Fragment>
            );
          })}
          {!people.length && <div className={styles.empty}>No hay personas para el filtro actual.</div>}
        </div>
        {workspace.externalPersons?.length > 0 && (
          <div className={styles.workspaceExternalNotice}>
            <strong>{workspace.externalPersons.length} persona(s) externa(s) separada(s) para revisión.</strong>
            <span>No se incorporan silenciosamente al universo de solicitantes.</span>
            {workspace.externalPersons.map((person) => {
              const key = `external:${person.dni || person.id}`;
              const expanded = expandedPeople[key];
              return (
                <div className={styles.workspaceExternalPerson} key={key}>
                  <span><strong>{person.dni || "DNI inválido/ausente"}</strong> · {buildVisiblePersonName(person) || "Sin identidad"} · {person.registrosCount || 0} registro(s)</span>
                  <Button label={expanded ? "Ocultar" : "Ver revisión"} size="small" text onClick={() => toggle(setExpandedPeople, key)} />
                  {expanded && <WorkspacePersonDetails person={person} />}
                </div>
              );
            })}
          </div>
        )}
      </section>
    </>
  );
};

export default TitularizacionWorkspacePanel;
