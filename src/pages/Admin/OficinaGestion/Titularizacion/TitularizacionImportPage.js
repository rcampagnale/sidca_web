import React, { useEffect, useMemo, useState } from "react";
import { Button } from "primereact/button";
import { Message } from "primereact/message";
import { ProgressSpinner } from "primereact/progressspinner";
import { Tag } from "primereact/tag";
import { useHistory } from "react-router-dom";

import TitularizacionCrucePreview from "../../../../components/OficinaGestion/Titularizacion/TitularizacionCrucePreview";
import TitularizacionMinisterialCrossPreview from "../../../../components/OficinaGestion/Titularizacion/TitularizacionMinisterialCrossPreview";
import TitularizacionWorkspacePanel from "../../../../components/OficinaGestion/Titularizacion/TitularizacionWorkspacePanel";
import {
  SIDCA_IMPORT_FIELDS,
  calculateFileHash,
  normalizeSidcaRows,
  prepareSidcaPresentation,
  selectPreparedSidcaSheets,
  summarizeSidcaRows,
  validateSidcaMapping,
} from "../../../../services/titularizacion/titularizacionImportService";
import { prepareTitularizacionResolutionPdf } from "../../../../services/titularizacion/titularizacionResolucionPdfParser";
import {
  DEFAULT_TITULARIZACION_SOURCE_CONFIGS,
  DEFAULT_TITULARIZACION_FORMULARIO_ID,
  loadTitularizacionData,
} from "../../../../services/titularizacion/titularizacionService";
import { buildVisiblePersonName } from "../../../../services/titularizacion/titularizacionNormalizer";
import { SOURCE_COVERAGE } from "../../../../services/titularizacion/titularizacionSourceModel";
import {
  WORKSPACE_SOURCE_TYPES,
  WORKSPACE_SOURCE_TYPE_OPTIONS,
  addTitularizacionWorkspaceSource,
  createTitularizacionWorkspace,
  createTitularizacionWorkspaceSource,
  findTitularizacionWorkspaceDuplicate,
  getTitularizacionWorkspacePreviewConfig,
  getTitularizacionWorkspacePreviewRows,
  rebuildTitularizacionWorkspace,
  removeTitularizacionWorkspaceSource,
  setTitularizacionWorkspaceSourceEnabled,
  updateTitularizacionWorkspaceSource,
} from "../../../../services/titularizacion/titularizacionWorkspaceService";
import {
  buildTitularizacionPreview,
  createPreviewSource,
  emptyPreviewManualDecisions,
} from "../../../../services/titularizacion/titularizacionPreviewService";
import styles from "./TitularizacionStage2.module.css";

const steps = ["Fuente base", "Archivo", "Encabezados", "Mapeo", "Preview base", "Cruce"];

const splitScopeValue = (value) => {
  const values = String(value || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
  return values.length ? values : null;
};

const emptyScopeValues = () => ({
  nivel: "",
  departamento: "",
  tipoCargo: "",
  modalidad: "",
  establecimiento: "",
  periodoDesde: "",
  periodoHasta: "",
});

const scopeValuesToScope = (values = {}) => ({
  niveles: splitScopeValue(values.nivel),
  departamentos: splitScopeValue(values.departamento),
  tiposCargo: splitScopeValue(values.tipoCargo),
  modalidades: splitScopeValue(values.modalidad),
  establecimientos: splitScopeValue(values.establecimiento),
  periodo:
    values.periodoDesde && values.periodoHasta
      ? { desde: values.periodoDesde, hasta: values.periodoHasta }
      : null,
});

const scopeToValues = (scope = {}) => ({
  nivel: (scope.niveles || []).join(", "),
  departamento: (scope.departamentos || []).join(", "),
  tipoCargo: (scope.tiposCargo || []).join(", "),
  modalidad: (scope.modalidades || []).join(", "),
  establecimiento: (scope.establecimientos || []).join(", "),
  periodoDesde: scope.periodo?.desde || "",
  periodoHasta: scope.periodo?.hasta || "",
});

const wideSituationFields = [
  ["cargo", "Cargo"],
  ["horas", "Horas"],
  ["materia", "Materia"],
  ["establecimiento", "Establecimiento"],
  ["nivel", "Nivel"],
  ["modalidad", "Modalidad"],
  ["cursoAnio", "Curso/Año"],
];

const WidePeoplePreview = ({ people = [] }) => {
  const [expanded, setExpanded] = useState({});
  const visiblePeople = people.slice(0, 20);

  return (
    <div className={styles.previewTable}>
      <div className={styles.sectionHeader}>
        <div>
          <h3>Personas y situaciones extraídas</h3>
          <p className={styles.muted}>
            Diagnóstico previo al cruce. Se muestran las primeras 20 personas; cada fila conserva el orden de sus bloques originales.
          </p>
        </div>
      </div>
      <table>
        <thead>
          <tr><th>DNI</th><th>Apellido y nombre</th><th>Situaciones extraídas</th><th>Acción</th></tr>
        </thead>
        <tbody>
          {visiblePeople.map((person, index) => {
            const key = `${person.dni || "sin-dni"}-${index}`;
            const isExpanded = Boolean(expanded[key]);
            return (
              <React.Fragment key={key}>
                <tr>
                  <td>{person.dni || "DNI ausente"}</td>
                  <td>{buildVisiblePersonName(person) || "—"}</td>
                  <td>{person.situacionesCount || 0}</td>
                  <td>
                    <Button
                      label={isExpanded ? "Ocultar" : "Expandir"}
                      icon={isExpanded ? "pi pi-chevron-up" : "pi pi-chevron-down"}
                      text
                      size="small"
                      onClick={() => setExpanded((current) => ({ ...current, [key]: !current[key] }))}
                    />
                  </td>
                </tr>
                {isExpanded && (
                  <tr>
                    <td colSpan="4">
                      <div className={styles.detailGrid}>
                        {person.situaciones.map((situation) => (
                          <div key={`${key}-${situation.indiceBloqueOriginal}`}>
                            <strong>Situación {situation.indiceBloqueOriginal}</strong>
                            <p><span>Origen</span><strong>{situation.sourceSheetName || "—"} · fila {situation.sourceRowNumber || "—"} · bloque {situation.sourceBlockIndex || "—"}</strong></p>
                            {wideSituationFields.map(([field, label]) => (
                              <p key={field}><span>{label}</span><strong>{situation[field] || "—"}</strong></p>
                            ))}
                          </div>
                        ))}
                        {!person.situaciones.length && <span>Sin bloques con contenido sustantivo.</span>}
                      </div>
                    </td>
                  </tr>
                )}
              </React.Fragment>
            );
          })}
        </tbody>
      </table>
      {people.length > visiblePeople.length && (
        <p className={styles.muted}>Hay {people.length - visiblePeople.length} personas adicionales disponibles en el parser.</p>
      )}
    </div>
  );
};

const ResolutionPdfPreview = ({ importData }) => (
  <div className={styles.notice}>
    <strong>Resolución PDF detectada</strong>
    <p>
      Resolución: {importData.resolutionNumber || "No identificada"} · Fecha: {importData.resolutionDate || "No identificada"} · Cobertura: UNKNOWN.
    </p>
    <p>
      Páginas: {importData.pdfMetadata?.pageCount || 0} · Con texto: {importData.pdfMetadata?.textPages || 0} · Sin texto: {importData.pdfMetadata?.emptyPages?.length || 0} · Registros extraídos: {importData.summary?.registrosResolucion || 0}.
    </p>
    <div className={styles.summaryGrid}>
      {[
        ["Registros con DNI confiable", importData.summary?.registrosDniConfiables],
        ["Registros con DNI sospechoso", importData.summary?.registrosDniSospechosos],
        ["Registros sin DNI", importData.summary?.registrosSinDni],
        ["Registros con nombre", importData.summary?.registrosConNombre],
        ["Registros con cargo", importData.summary?.registrosConCargo],
        ["Registros con ID Plaza", importData.summary?.registrosConIdPlaza],
        ["Registros completos", importData.summary?.registrosCompletos],
        ["Registros parciales", importData.summary?.registrosParciales],
        ["DNI únicos confiables", importData.summary?.dniUnicosConfiables],
      ].map(([label, value]) => <div className={styles.summaryItem} key={label}><span>{label}</span><strong>{value || 0}</strong></div>)}
    </div>
    {importData.pdfMetadata?.possibleScanned && (
      <p>Página sin texto digital. Puede requerir OCR. No se generaron registros automáticamente para esas páginas.</p>
    )}
    <details>
      <summary><strong>AUDITAR EXTRACCIÓN</strong> · Ver muestra de hasta 20 registros</summary>
      <div className={styles.previewTable}>
        <table>
          <thead>
            <tr><th>Página</th><th>Línea</th><th>DNI interpretado</th><th>Candidato / confianza</th><th>ID Plaza</th><th>Apellido y nombre</th><th>Cargo</th><th>Anexo</th><th>Clasificación</th><th>Texto RAW</th></tr>
          </thead>
          <tbody>
            {(importData.rows || []).slice(0, 20).map((row) => (
              <tr key={row.recordKey}>
                <td>{row.pageNumber || "—"}</td>
                <td>{row.lineNumber || row.rowIndex || "—"}</td>
                <td>{row.dni || "—"}</td>
                <td>{row.dniCandidate || "—"} · {row.dniConfidence || "none"}</td>
                <td>{row.idPlaza || "—"}</td>
                <td>{buildVisiblePersonName(row) || "—"}</td>
                <td>{row.cargo || "—"}</td>
                <td>{row.anexo || "—"}</td>
                <td>{row.pdfRecordStatus || "—"}</td>
                <td>{row.rawText || row.textOriginal || row.rawRecord?.textOriginal || "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {!importData.rows?.length && <p>No se extrajeron filas estructuradas. El PDF puede requerir revisión manual u OCR posterior.</p>}
      </div>
    </details>
  </div>
);

const TitularizacionImportPage = () => {
  const history = useHistory();
  const [baseData, setBaseData] = useState(null);
  const [loadingBase, setLoadingBase] = useState(true);
  const [importData, setImportData] = useState(null);
  const [step, setStep] = useState(0);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [previewRequested, setPreviewRequested] = useState(false);
  const [workspace, setWorkspace] = useState(createTitularizacionWorkspace);
  const [workspaceSearch, setWorkspaceSearch] = useState("");
  const [editingSourceId, setEditingSourceId] = useState(null);
  const [sourceDraft, setSourceDraft] = useState({
    sourceType: "",
    displayName: "",
    fileName: "",
    coverage: SOURCE_COVERAGE.UNKNOWN,
    scopeValues: emptyScopeValues(),
  });
  const [manualDecisions, setManualDecisions] = useState(emptyPreviewManualDecisions);

  useEffect(() => {
    loadTitularizacionData({ sourceConfigs: DEFAULT_TITULARIZACION_SOURCE_CONFIGS })
      .then((data) => {
        setBaseData(data);
        setWorkspace((current) => rebuildTitularizacionWorkspace(current, { basePeople: data.personas }));
      })
      .catch((exception) => setError(exception.message || "No se pudieron cargar las solicitudes SIDCA."))
      .finally(() => setLoadingBase(false));
  }, []);

  const validation = useMemo(() => {
    if (!importData) return { valid: false, errors: [] };
    if (importData.parserMode === "resolution-pdf") return importData.validation || { valid: false, errors: [] };
    if (importData.parserMode === "wide") return importData.validation || { valid: false, errors: [] };
    return validateSidcaMapping(importData.mapping, importData.parsed.columnas);
  }, [importData]);

  const normalizedRows = useMemo(() => {
    if (!importData || !validation.valid) return [];
    if (importData.parserMode === "resolution-pdf") return importData.rows || [];
    if (importData.parserMode === "wide") return importData.rows || [];
    return normalizeSidcaRows({
      ...importData.parsed,
      mapping: importData.mapping,
    });
  }, [importData, validation.valid]);

  const summary = useMemo(
    () => importData?.parserMode === "wide" || importData?.parserMode === "resolution-pdf"
      ? importData.summary
      : summarizeSidcaRows(normalizedRows),
    [importData, normalizedRows]
  );

  const structuredRequestSource = useMemo(
    () => baseData?.fuentes?.find(
      (source) => source.formularioId === DEFAULT_TITULARIZACION_FORMULARIO_ID
    ) || null,
    [baseData]
  );

  const sourceScope = useMemo(() => ({
    ...scopeValuesToScope(sourceDraft.scopeValues),
  }), [sourceDraft.scopeValues]);

  const workspacePreviewRows = useMemo(
    () => getTitularizacionWorkspacePreviewRows(workspace),
    [workspace]
  );
  const workspacePreviewConfig = useMemo(
    () => getTitularizacionWorkspacePreviewConfig(workspace),
    [workspace]
  );

  const previewSource = useMemo(
    () => createPreviewSource({
      fileName: workspacePreviewConfig.fileName || "Presentación SIDCA (preview)",
      coverage: workspacePreviewConfig.coverage,
      scope: workspacePreviewConfig.scope || sourceScope,
      metadata: {
        workspaceSourceIds: workspacePreviewConfig.sourceIds,
        workspaceSourceTypes: workspacePreviewConfig.sourceTypes,
      },
    }),
    [sourceScope, workspacePreviewConfig]
  );

  const preview = useMemo(() => {
    if (!previewRequested || !baseData || !workspacePreviewRows.length) return null;
    return buildTitularizacionPreview({
      solicitudData: baseData,
      rows: workspacePreviewRows,
      source: previewSource,
      manualDecisions,
    });
  }, [baseData, manualDecisions, previewRequested, previewSource, workspacePreviewRows]);

  const selectFile = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setError("");
    setPreviewRequested(false);
    setManualDecisions(emptyPreviewManualDecisions());
    setBusy(true);
    try {
      const isPdf = file.type === "application/pdf" || /\.pdf$/i.test(file.name || "");
      const prepared = isPdf
        ? await prepareTitularizacionResolutionPdf(file)
        : await prepareSidcaPresentation(file);
      setImportData({ ...prepared, fileHash: await calculateFileHash(file) });
      setEditingSourceId(null);
      setSourceDraft((current) => ({
        ...current,
        sourceType: isPdf ? WORKSPACE_SOURCE_TYPES.RESOLUCION : current.sourceType,
        displayName: file.name,
        fileName: file.name,
      }));
      setStep(3);
    } catch (exception) {
      setImportData(null);
      setError(exception.message || "No se pudo leer el archivo seleccionado.");
    } finally {
      setBusy(false);
    }
  };

  const updateMapping = (fieldKey, columnKey) => {
    setImportData((current) => ({
      ...current,
      mapping: { ...current.mapping, [fieldKey]: columnKey },
    }));
    setPreviewRequested(false);
    setManualDecisions(emptyPreviewManualDecisions());
  };

  const updateScope = (key, value) => {
    setSourceDraft((current) => ({
      ...current,
      scopeValues: { ...current.scopeValues, [key]: value },
    }));
    setPreviewRequested(false);
    setManualDecisions(emptyPreviewManualDecisions());
  };

  const updateSourceDraft = (key, value) => {
    setSourceDraft((current) => ({ ...current, [key]: value }));
    setPreviewRequested(false);
  };

  const resetSourceDraft = () => {
    setEditingSourceId(null);
    setSourceDraft({
      sourceType: "",
      displayName: "",
      fileName: "",
      coverage: SOURCE_COVERAGE.UNKNOWN,
      scopeValues: emptyScopeValues(),
    });
  };

  const addSourceToWorkspace = () => {
    const canAddEmptyPdf = importData?.parserMode === "resolution-pdf";
    if (!importData || !sourceDraft.sourceType || !validation.valid || importData.structureValid === false || (!normalizedRows.length && !canAddEmptyPdf)) return;
    const source = createTitularizacionWorkspaceSource({
      prepared: importData,
      sourceType: importData.parserMode === "resolution-pdf"
        ? WORKSPACE_SOURCE_TYPES.RESOLUCION
        : sourceDraft.sourceType,
      stage: importData.stage,
      afirma: importData.afirma,
      displayName: sourceDraft.displayName || sourceDraft.fileName || importData.file?.name,
      fileName: sourceDraft.fileName || importData.file?.name,
      coverage: sourceDraft.coverage,
      scope: sourceScope,
      existingSourceIds: workspace.sources.map((item) => item.workspaceSourceId),
    });
    const duplicate = findTitularizacionWorkspaceDuplicate(workspace, source);
    if (duplicate) {
      setError("Este archivo ya está cargado en el workspace.");
      return;
    }
    setWorkspace((current) => addTitularizacionWorkspaceSource(current, source, {
      basePeople: baseData?.personas || [],
    }));
    setImportData(null);
    setPreviewRequested(false);
    setManualDecisions(emptyPreviewManualDecisions());
    resetSourceDraft();
    setStep(0);
  };

  const configureSource = (source) => {
    setEditingSourceId(source.workspaceSourceId);
    setSourceDraft({
      sourceType: source.sourceType,
      displayName: source.displayName,
      fileName: source.fileName,
      coverage: source.coverage || SOURCE_COVERAGE.UNKNOWN,
      scopeValues: scopeToValues(source.scope),
    });
    setImportData(null);
    setPreviewRequested(false);
  };

  const saveSourceConfiguration = () => {
    if (!editingSourceId) return;
    setWorkspace((current) => updateTitularizacionWorkspaceSource(
      current,
      editingSourceId,
      {
        sourceType: sourceDraft.sourceType,
        displayName: sourceDraft.displayName || sourceDraft.fileName,
        coverage: sourceDraft.coverage,
        scope: sourceScope,
      },
      { basePeople: baseData?.personas || [] }
    ));
    resetSourceDraft();
  };

  const toggleWorkspaceSource = (source) => {
    setWorkspace((current) => setTitularizacionWorkspaceSourceEnabled(
      current,
      source.workspaceSourceId,
      !current.activeSourceIds.includes(source.workspaceSourceId),
      { basePeople: baseData?.personas || [] }
    ));
    setPreviewRequested(false);
    setManualDecisions(emptyPreviewManualDecisions());
  };

  const removeWorkspaceSource = (source) => {
    if (!window.confirm(`¿Quitar la fuente "${source.displayName}" del workspace en memoria?`)) return;
    setWorkspace((current) => removeTitularizacionWorkspaceSource(
      current,
      source.workspaceSourceId,
      { basePeople: baseData?.personas || [] }
    ));
    if (editingSourceId === source.workspaceSourceId) resetSourceDraft();
    setPreviewRequested(false);
    setManualDecisions(emptyPreviewManualDecisions());
  };

  const executePreview = () => {
    if (!baseData || !workspacePreviewRows.length) return;
    setBusy(true);
    setError("");
    setManualDecisions(emptyPreviewManualDecisions());
    setPreviewRequested(true);
    setStep(5);
    setBusy(false);
  };

  const toggleSheet = (sheetIndex) => {
    setImportData((current) => {
      if (!current) return current;
      const selected = current.selectedSheetIndexes || [];
      const next = selected.includes(sheetIndex)
        ? selected.filter((index) => index !== sheetIndex)
        : [...selected, sheetIndex];
      return current.parserMode === "resolution-pdf"
        ? { ...current, selectedSheetIndexes: next }
        : selectPreparedSidcaSheets(current, next);
    });
    setPreviewRequested(false);
    setManualDecisions(emptyPreviewManualDecisions());
  };

  const handleDecision = (decision) => {
    setManualDecisions((current) => ({
      ...current,
      situations: {
        ...current.situations,
        [decision.situationId]: decision,
      },
    }));
  };

  const mappingError = validation.errors.length > 0;
  const selectedColumn = (fieldKey) =>
    importData?.parsed?.columnas?.find((column) => column.key === importData.mapping[fieldKey]);
  const mappedColumns = importData
    ? importData.parserMode === "wide" || importData.parserMode === "resolution-pdf"
      ? summary?.columnasReconocidas || 0
      : new Set(Object.values(importData.mapping || {}).filter(Boolean)).size
    : 0;

  if (loadingBase) {
    return (
      <main className={styles.page}>
        <div className={styles.loading}><ProgressSpinner /><span>Cargando solicitudes SIDCA base...</span></div>
      </main>
    );
  }

  return (
    <main className={styles.page}>
      <section className={styles.header}>
        <div>
          <span className={styles.badge}>Titularización · Preview en memoria</span>
          <h1>Cruce de Presentación SIDCA</h1>
          <p>
            Compará la solicitud estructurada de Titularización Docente 2026 con lo presentado al Ministerio.
            Esta etapa no persiste archivos, resultados ni decisiones.
          </p>
        </div>
        <div className={styles.headerActions}>
          <Tag value="PERSISTENCIA DESHABILITADA" severity="warning" />
          <Button label="Volver al módulo" icon="pi pi-arrow-left" outlined onClick={() => history.push("/admin/oficina-gestion/titularizacion")} disabled={busy} />
        </div>
      </section>

      {error && <Message severity="error" text={error} />}
      <Message severity="warn" text="Preview local únicamente: no se ejecutan setDoc, addDoc, updateDoc, deleteDoc, writeBatch ni uploadBytes." />

      <TitularizacionWorkspacePanel
        workspace={workspace}
        basePeople={baseData?.personas || []}
        search={workspaceSearch}
        onSearch={setWorkspaceSearch}
        onConfigureSource={configureSource}
        onToggleSource={toggleWorkspaceSource}
        onRemoveSource={removeWorkspaceSource}
      />

      {baseData && (
        <TitularizacionMinisterialCrossPreview
          workspace={workspace}
          basePeople={baseData.personas || []}
        />
      )}

      <section className={styles.panel}>
        <div className={styles.steps}>
          {steps.map((label, index) => (
            <div key={label} className={`${styles.step} ${index <= step ? styles.stepActive : ""}`}>
              {index + 1}. {label}
            </div>
          ))}
        </div>

        <div className={styles.sectionHeader}>
          <div>
            <h2>1. Solicitud estructurada YHe</h2>
            <p className={styles.muted}>Fuente estructurada exacta: {DEFAULT_TITULARIZACION_FORMULARIO_ID} · TITULARIZACIÓN DOCENTE 2026</p>
          </div>
          <Tag value="Solicitud canónica" severity="success" />
        </div>
        <div className={styles.summaryGrid}>
          {[
            ["Respuestas YHe", structuredRequestSource?.respuestas],
            ["Personas válidas YHe", structuredRequestSource?.personas],
            ["Situaciones YHe", structuredRequestSource?.situacionesCanonicas],
            ["Situaciones en revisión YHe", structuredRequestSource?.situacionesRevision],
          ].map(([label, value]) => (
            <div className={styles.summaryItem} key={label}><span>{label}</span><strong>{value || 0}</strong></div>
          ))}
        </div>
        <div className={styles.sectionHeader}>
          <div>
            <h3>Universo del proceso (cinco fuentes)</h3>
            <p className={styles.muted}>Personas únicas identificadas por DNI en todas las fuentes, separando quienes tienen y no tienen solicitud estructurada.</p>
          </div>
        </div>
        <div className={styles.summaryGrid}>
          {[
            ["Personas únicas", baseData?.metrics?.personasUnicas],
            ["Con solicitud estructurada", baseData?.metrics?.personasConSolicitudEstructurada],
            ["Sin solicitud estructurada", baseData?.metrics?.personasSinSolicitudEstructurada],
            ["Situaciones canónicas del universo", baseData?.metrics?.situacionesCanonicas],
          ].map(([label, value]) => (
            <div className={styles.summaryItem} key={label}><span>{label}</span><strong>{value || 0}</strong></div>
          ))}
        </div>
      </section>

      <section className={styles.panel}>
        <div className={styles.sectionHeader}>
          <div>
            <h2>2. Configuración de la fuente</h2>
            <p className={styles.muted}>{editingSourceId ? "Editá la fuente cargada sin alterar sus registros." : "Definí el tipo y la cobertura antes de agregar el archivo al workspace."}</p>
          </div>
          <Tag value={sourceDraft.coverage.toUpperCase()} severity={sourceDraft.coverage === SOURCE_COVERAGE.COMPLETE ? "success" : "warning"} />
        </div>
        <div className={styles.sourceBox}>
          <div>
            <span>Tipo de fuente</span>
            <select value={sourceDraft.sourceType} onChange={(event) => updateSourceDraft("sourceType", event.target.value)} disabled={busy || importData?.parserMode === "resolution-pdf"}>
              <option value="">Seleccioná el tipo real de fuente…</option>
              {WORKSPACE_SOURCE_TYPE_OPTIONS.map((option) => (
                <option value={option.value} key={option.value}>{option.value}</option>
              ))}
            </select>
          </div>
          <div>
            <span>Nombre descriptivo</span>
            <input value={sourceDraft.displayName} onChange={(event) => updateSourceDraft("displayName", event.target.value)} placeholder="Opcional" disabled={busy} />
          </div>
          <div>
            <span>Cobertura</span>
            <select value={sourceDraft.coverage} onChange={(event) => updateSourceDraft("coverage", event.target.value)} disabled={busy}>
              <option value={SOURCE_COVERAGE.UNKNOWN}>UNKNOWN</option>
              <option value={SOURCE_COVERAGE.PARTIAL}>PARTIAL</option>
              <option value={SOURCE_COVERAGE.COMPLETE}>COMPLETE</option>
            </select>
          </div>
          <div>
            <span>Scope conceptual</span>
            <strong>Nivel, departamento, cargo, modalidad, establecimiento y periodo</strong>
          </div>
          <div>
            <span>Regla</span>
            <strong>Sin dato nunca se interpreta como omisión</strong>
          </div>
        </div>
        <div className={styles.scopeGrid}>
          {[
            ["nivel", "Nivel (separado por comas)"],
            ["departamento", "Departamento (separado por comas)"],
            ["tipoCargo", "Tipo de cargo (separado por comas)"],
            ["modalidad", "Modalidad (separado por comas)"],
            ["establecimiento", "Establecimiento (separado por comas)"],
          ].map(([key, label]) => (
            <label key={key}>
              <span>{label}</span>
              <input value={sourceDraft.scopeValues[key]} onChange={(event) => updateScope(key, event.target.value)} disabled={busy} />
            </label>
          ))}
          <label><span>Periodo desde</span><input type="date" value={sourceDraft.scopeValues.periodoDesde} onChange={(event) => updateScope("periodoDesde", event.target.value)} disabled={busy} /></label>
          <label><span>Periodo hasta</span><input type="date" value={sourceDraft.scopeValues.periodoHasta} onChange={(event) => updateScope("periodoHasta", event.target.value)} disabled={busy} /></label>
        </div>
        {editingSourceId && (
          <div className={styles.stepActions}>
            <Button label="Guardar configuración" icon="pi pi-check" severity="success" onClick={saveSourceConfiguration} disabled={busy} />
            <Button label="Cancelar" icon="pi pi-times" outlined onClick={resetSourceDraft} disabled={busy} />
          </div>
        )}
      </section>

      <section className={styles.panel}>
        <div className={styles.sectionHeader}>
          <div><h2>3–4. Archivo, encabezados y mapeo</h2><p className={styles.muted}>DNI es obligatorio. Los demás campos pueden faltar y quedarán reflejados en fieldCoverage.</p></div>
          <Tag value={importData ? `${importData.parsed.columnas?.length || 0} columnas` : "Sin archivo"} severity="secondary" />
        </div>
        <div className={styles.filePicker}>
          <div>
            <strong>{importData?.file.name || "Ningún archivo seleccionado para agregar"}</strong>
            <p className={styles.muted}>Se admiten .xlsx, .xls, .csv y .pdf. El archivo sólo se lee en memoria.</p>
          </div>
          <label>
            <input type="file" accept=".xlsx,.xls,.csv,.pdf,application/pdf" onChange={selectFile} disabled={busy} style={{ display: "none" }} />
            <Button type="button" label="Agregar fuente / archivo" icon="pi pi-upload" severity="success" outlined onClick={(event) => event.currentTarget.parentElement.querySelector("input")?.click()} disabled={busy} />
          </label>
        </div>
        {importData?.sheets?.length > 0 && (
          <div className={styles.sheetSelector}>
            <div className={styles.sectionHeader}>
              <div>
                <h3>{importData.parserMode === "resolution-pdf" ? "Páginas detectadas" : "Hojas detectadas"}: {importData.sheets.length}</h3>
                <p className={styles.muted}>{importData.parserMode === "resolution-pdf" ? "Las páginas se mantienen como provenance del PDF." : "Seleccioná una, varias o todas las hojas compatibles antes del preview."}</p>
              </div>
              <Button
                label={importData.parserMode === "resolution-pdf" ? "Activar todas las páginas" : "Seleccionar compatibles"}
                icon="pi pi-check-square"
                outlined
                size="small"
                disabled={busy || !importData.compatibleSheetIndexes?.length}
                onClick={() => {
                  setImportData((current) => current.parserMode === "resolution-pdf"
                    ? { ...current, selectedSheetIndexes: current.compatibleSheetIndexes || [] }
                    : selectPreparedSidcaSheets(current, current.compatibleSheetIndexes || []));
                  setPreviewRequested(false);
                  setManualDecisions(emptyPreviewManualDecisions());
                }}
              />
            </div>
            <div className={styles.sheetList}>
              {importData.sheets.map((sheet) => {
                const selected = importData.selectedSheetIndexes?.includes(sheet.sheetIndex);
                const statusLabel = importData.parserMode === "resolution-pdf"
                  ? (sheet.status === "PDF_TEXT" ? "texto digital" : "posible escaneada")
                  : sheet.status === "COMPATIBLE_ESTRUCTURADA"
                    ? "COMPATIBLE ESTRUCTURADA"
                    : sheet.status === "COMPATIBLE_PARCIAL"
                      ? "COMPATIBLE PARCIAL"
                      : "NO COMPATIBLE";
                return (
                  <label className={`${styles.sheetItem} ${selected ? styles.sheetItemSelected : ""}`} key={`${sheet.sheetIndex}-${sheet.sheetName}`}>
                    <input type="checkbox" checked={Boolean(selected)} disabled={busy || !sheet.selectable} onChange={() => toggleSheet(sheet.sheetIndex)} />
                    <span className={styles.sheetItemMain}>
                      <strong>{sheet.sheetName}</strong>
                      <span>{sheet.rowCount || 0} registros · {importData.parserMode === "resolution-pdf" ? statusLabel : `${sheet.columnCount || 0} columnas · ${statusLabel}`}</span>
                    </span>
                    <span className={styles.sheetItemMetrics}>
                      {importData.parserMode === "resolution-pdf"
                        ? `${sheet.pageNumber || sheet.sheetIndex + 1} · ${sheet.rows?.length || 0} registros de resolución`
                         : `${sheet.summary?.dniValidos || 0} DNI válidos · ${sheet.summary?.personas || 0} personas · ${sheet.summary?.situacionesExtraidas || 0} situaciones interpretables`}
                    </span>
                  </label>
                );
              })}
            </div>
          </div>
        )}
        {importData && (
          <>
            {importData.parsed.encabezadosDuplicados?.length > 0 && <div className={styles.notice}>Hay encabezados repetidos: {importData.parsed.encabezadosDuplicados.join(", ")}. Revisá el mapeo.</div>}
            {importData.parserMode === "resolution-pdf" ? (
              <ResolutionPdfPreview importData={importData} />
            ) : importData.parserMode === "wide" ? (
              <div className={styles.notice}>
                <strong>Estructura multibloque detectada automáticamente.</strong>
                <p>
                  Persona: DNI, apellido, nombre y departamento. Hojas seleccionadas: {importData.selectedSheetIndexes?.length || 0}. Situaciones: {importData.summary?.situacionesExtraidas || 0}.
                </p>
                <details>
                  <summary>Ver detalle de columnas reconocidas</summary>
                  <ul>
                    {Object.values(importData.wideSchemas || { primary: importData.wideSchema }).flatMap((schema) => schema.blocks).map((block, index) => (
                      <li key={`${block.sheetIndex || index}-${block.indiceBloqueOriginal}`}>
                        Bloque {block.indiceBloqueOriginal}: {block.startColumn}–{block.endColumn}
                        {block.controlColumn ? ` · control ${block.controlColumn}` : ""}
                      </li>
                    ))}
                  </ul>
                  <p>
                    No se identificaron columnas específicas para materia ni curso/año; se conservan vacías sin inventar valores.
                  </p>
                </details>
              </div>
            ) : (
              <div className={styles.mappingTable}>
                <table>
                  <thead><tr><th>Campo interno</th><th>Requerido</th><th>Columna del archivo</th><th>Detección</th></tr></thead>
                  <tbody>
                    {SIDCA_IMPORT_FIELDS.map((field) => {
                      const currentColumn = selectedColumn(field.key);
                      return (
                        <tr key={field.key}>
                          <td><strong>{field.label}</strong></td>
                          <td>{field.required ? <span className={styles.required}>Sí</span> : "No"}</td>
                          <td>
                            <select value={importData.mapping[field.key] || ""} onChange={(event) => updateMapping(field.key, event.target.value)} disabled={busy}>
                              <option value="">— Ignorar —</option>
                              {importData.parsed.columnas.map((column) => {
                                const assignedElsewhere = Object.entries(importData.mapping).some(([key, value]) => key !== field.key && value === column.key);
                                return <option key={column.key} value={column.key} disabled={assignedElsewhere}>{column.label}</option>;
                              })}
                            </select>
                          </td>
                          <td>{currentColumn ? "Automático / seleccionado" : "Sin asignar"}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
            {mappingError && <div className={styles.errorList}><strong>Corregí el mapeo:</strong>{validation.errors.map((item) => <p key={item}>{item}</p>)}</div>}
            {importData.wideSchema?.detected && importData.parserMode !== "wide" && (
              <div className={styles.errorList}>
                <strong>Requiere revisión de estructura.</strong>
                <p>La detección multibloque no fue suficientemente segura; se habilitó el mapeo manual como fallback.</p>
              </div>
            )}
          </>
        )}
      </section>

      {importData?.parserMode === "wide" && importData.validation?.warnings?.length > 0 && (
        <div className={styles.notice}>
          <strong>Warnings semánticos del parser</strong>
          {importData.validation.warnings.map((warning) => <p key={warning}>{warning}</p>)}
        </div>
      )}

      {importData?.parserMode === "wide" && !importData.structureValid && (
        <div className={styles.errorList}>
          <strong>La estructura del archivo presenta inconsistencias semánticas.</strong>
          <p>Revisá el diagnóstico antes de ejecutar el cruce.</p>
        </div>
      )}

      {importData && (
        <section className={styles.previewPanel}>
          <div className={styles.previewHeader}>
            <div><h2>5. Preview base normalizado</h2><p className={styles.muted}>Primeras 20 filas. Todavía no se ejecutó el cruce.</p></div>
            <Tag value={mappingError ? "Mapeo incompleto" : "Lista para cruzar"} severity={mappingError ? "warning" : "success"} />
          </div>
          <div className={styles.summaryGrid}>
            {[
              ["Filas Excel", summary.filasExcel || summary.filasDetectadas], ["DNI detectados", summary.dniDetectados], ["DNI válidos", summary.dniValidos],
              ["DNI inválidos", summary.dniInvalidos], ["DNI únicos", summary.dniUnicos], ["Personas", summary.personas],
              ["Situaciones extraídas", summary.situacionesExtraidas], ["Bloques vacíos descartados", summary.bloquesVaciosDescartados],
              ["Situaciones válidas", summary.situacionesValidas ?? summary.situacionesExtraidas], ["Situaciones con warnings", summary.situacionesConWarnings || 0],
              ["Situaciones inválidas", summary.situacionesInvalidas || 0], ["Bloques reconocidos", summary.bloquesReconocidos], ["Columnas reconocidas", mappedColumns],
            ].map(([label, value]) => <div className={styles.summaryItem} key={label}><span>{label}</span><strong>{value || 0}</strong></div>)}
          </div>
          {importData.parserMode === "wide" && <WidePeoplePreview people={importData.wideParsed?.personas || []} />}
          {importData.parserMode !== "wide" && importData.parserMode !== "resolution-pdf" && !mappingError && normalizedRows.length > 0 && (
            <div className={styles.previewTable}>
              <table>
                <thead><tr><th>Fila</th>{SIDCA_IMPORT_FIELDS.filter((field) => importData.mapping[field.key]).map((field) => <th key={field.key}>{field.label}</th>)}</tr></thead>
                <tbody>{normalizedRows.slice(0, 20).map((row) => <tr key={row.recordKey}><td>{row.numeroFila}</td>{SIDCA_IMPORT_FIELDS.filter((field) => importData.mapping[field.key]).map((field) => <td key={field.key}>{row.valoresNormalizados[field.key] || "—"}</td>)}</tr>)}</tbody>
              </table>
            </div>
          )}
          {!mappingError && !normalizedRows.length && <div className={styles.empty}>No se detectaron filas de datos.</div>}
          <div className={styles.stepActions}>
            {importData && (
              <Button label="Agregar fuente al workspace" icon="pi pi-plus" severity="success" onClick={addSourceToWorkspace} loading={busy} disabled={busy || !sourceDraft.sourceType || mappingError || importData.structureValid === false || (!normalizedRows.length && importData.parserMode !== "resolution-pdf") || !baseData} />
            )}
            <Button label="Ejecutar cruce del workspace" icon="pi pi-sitemap" severity="success" onClick={executePreview} loading={busy} disabled={busy || !workspacePreviewRows.length || !baseData} />
          </div>
        </section>
      )}

      {preview && <TitularizacionCrucePreview preview={preview} onDecision={handleDecision} />}
    </main>
  );
};

export default TitularizacionImportPage;
