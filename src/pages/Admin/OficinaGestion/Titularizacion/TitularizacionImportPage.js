import React, { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "primereact/button";
import { Message } from "primereact/message";
import { ProgressBar } from "primereact/progressbar";
import { ProgressSpinner } from "primereact/progressspinner";
import { Tag } from "primereact/tag";
import { useHistory } from "react-router-dom";

import {
  SIDCA_IMPORT_FIELDS,
  importSidcaPresentation,
  normalizeSidcaRows,
  prepareSidcaPresentation,
  summarizeSidcaRows,
  validateSidcaMapping,
} from "../../../../services/titularizacion/titularizacionImportService";
import { getTitularizacionProcess } from "../../../../services/titularizacion/titularizacionProcessService";
import styles from "./TitularizacionStage2.module.css";

const steps = ["Fuente", "Archivo", "Encabezados", "Mapeo", "Vista previa", "Confirmación", "Cruce"];

const TitularizacionImportPage = () => {
  const history = useHistory();
  const [process, setProcess] = useState(null);
  const [loadingProcess, setLoadingProcess] = useState(true);
  const [importData, setImportData] = useState(null);
  const [step, setStep] = useState(0);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(null);
  const [result, setResult] = useState(null);
  const importingRef = useRef(false);

  useEffect(() => {
    getTitularizacionProcess()
      .then(setProcess)
      .catch((exception) => setError(exception.message || "No se pudo leer el proceso."))
      .finally(() => setLoadingProcess(false));
  }, []);

  const validation = useMemo(() => {
    if (!importData) return { valid: false, errors: [] };
    return validateSidcaMapping(importData.mapping, importData.parsed.columnas);
  }, [importData]);

  const normalizedRows = useMemo(() => {
    if (!importData || !validation.valid) return [];
    return normalizeSidcaRows({
      ...importData.parsed,
      mapping: importData.mapping,
    });
  }, [importData, validation.valid]);

  const summary = useMemo(() => summarizeSidcaRows(normalizedRows), [normalizedRows]);

  const selectFile = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setError("");
    setResult(null);
    setBusy(true);
    try {
      const prepared = await prepareSidcaPresentation(file);
      setImportData(prepared);
      setStep(3);
    } catch (exception) {
      setImportData(null);
      setError(exception.message || "No se pudo leer la presentación SIDCA.");
    } finally {
      setBusy(false);
    }
  };

  const updateMapping = (fieldKey, columnKey) => {
    setImportData((current) => ({
      ...current,
      mapping: { ...current.mapping, [fieldKey]: columnKey },
    }));
    setResult(null);
  };

  const confirmImport = async () => {
    if (!importData || !validation.valid || !normalizedRows.length || busy || importingRef.current) return;
    const confirmed = window.confirm(
      `Se importarán ${normalizedRows.length} filas del archivo ${importData.file.name} al proceso Titularización 2026. ¿Confirmar importación?`
    );
    if (!confirmed) return;

    importingRef.current = true;
    setBusy(true);
    setError("");
    setProgress({ percent: 0 });
    setStep(6);
    try {
      const imported = await importSidcaPresentation({
        file: importData.file,
        rows: normalizedRows,
        mapping: importData.mapping,
        summary,
        onProgress: setProgress,
      });
      setResult(imported);
    } catch (exception) {
      setError(exception.message || "No se pudo completar la importación.");
      setStep(5);
    } finally {
      importingRef.current = false;
      setBusy(false);
    }
  };

  const mappingError = validation.errors.length > 0;
  const selectedColumn = (fieldKey) => importData?.parsed.columnas.find((column) => column.key === importData.mapping[fieldKey]);
  const mappedColumns = importData ? new Set(Object.values(importData.mapping).filter(Boolean)).size : 0;

  if (loadingProcess) {
    return (
      <main className={styles.page}>
        <div className={styles.loading}><ProgressSpinner /><span>Verificando proceso 2026...</span></div>
      </main>
    );
  }

  if (!process || process.estado !== "activo") {
    return (
      <main className={styles.page}>
        <section className={styles.header}>
          <div><span className={styles.badge}>Titularización · Etapa 2</span><h1>Importar presentación SIDCA</h1><p>El proceso debe estar inicializado antes de importar una presentación.</p></div>
          <Button label="Volver al módulo" icon="pi pi-arrow-left" outlined onClick={() => history.push("/admin/oficina-gestion/titularizacion")} />
        </section>
        <Message severity="warn" text="Inicializá primero el proceso 2026 desde la pantalla principal de Titularización." />
      </main>
    );
  }

  return (
    <main className={styles.page}>
      <section className={styles.header}>
        <div>
          <span className={styles.badge}>Titularización · Etapa 2</span>
          <h1>Importar presentación SIDCA</h1>
          <p>Esta fuente representa lo que SIDCA presentó al Ministerio. La vista previa no escribe en Firestore.</p>
        </div>
        <div className={styles.headerActions}>
          <Button label="Pendientes" icon="pi pi-list" severity="warning" outlined onClick={() => history.push("/admin/oficina-gestion/titularizacion/pendientes")} disabled={busy} />
          <Button label="Volver al módulo" icon="pi pi-arrow-left" outlined onClick={() => history.push("/admin/oficina-gestion/titularizacion")} disabled={busy} />
        </div>
      </section>

      {error && <Message severity="error" text={error} />}

      <section className={styles.panel}>
        <div className={styles.steps}>
          {steps.map((label, index) => <div key={label} className={`${styles.step} ${index <= step ? styles.stepActive : ""}`}>{index + 1}. {label}</div>)}
        </div>

        <div className={styles.sectionHeader}>
          <div><h2>1. Fuente</h2><p className={styles.muted}>Presentación SIDCA · proceso_2026</p></div>
          <Tag value="Fuente externa" severity="info" />
        </div>

        <div className={styles.filePicker}>
          <div>
            <strong>{importData?.file.name || "Ningún archivo seleccionado"}</strong>
            <p className={styles.muted}>Se admiten .xlsx, .xls y .csv.</p>
          </div>
          <label>
            <input type="file" accept=".xlsx,.xls,.csv" onChange={selectFile} disabled={busy} style={{ display: "none" }} />
            <Button type="button" label="Seleccionar archivo" icon="pi pi-upload" severity="success" outlined onClick={(event) => event.currentTarget.parentElement.querySelector("input")?.click()} disabled={busy} />
          </label>
        </div>
      </section>

      {importData && (
        <>
          <section className={styles.panel}>
            <div className={styles.sectionHeader}>
              <div><h2>3–4. Encabezados y mapeo</h2><p className={styles.muted}>La detección automática se puede corregir manualmente. DNI es obligatorio.</p></div>
              <Tag value={`${importData.parsed.columnas.length} columnas`} severity="secondary" />
            </div>
            {importData.parsed.encabezadosDuplicados?.length > 0 && <div className={styles.notice}>Hay encabezados repetidos: {importData.parsed.encabezadosDuplicados.join(", ")}. Revisá el mapeo antes de confirmar.</div>}
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
            {mappingError && <div className={styles.errorList}><strong>Corregí el mapeo:</strong>{validation.errors.map((item) => <p key={item}>{item}</p>)}</div>}
          </section>

          <section className={styles.previewPanel}>
            <div className={styles.previewHeader}>
              <div><h2>5. Vista previa</h2><p className={styles.muted}>Primeras 20 filas normalizadas. Todavía no se guardó nada.</p></div>
              <Tag value={mappingError ? "Mapeo incompleto" : "Lista para revisar"} severity={mappingError ? "warning" : "success"} />
            </div>
            <div className={styles.summaryGrid}>
              {[["Archivo", importData.file.name], ["Hoja", importData.parsed.hoja], ["Filas", summary.filasDetectadas], ["DNI detectados", summary.dniDetectados], ["DNI válidos", summary.dniValidos], ["DNI inválidos", summary.dniInvalidos], ["DNI únicos", summary.dniUnicos], ["Personas", summary.personas], ["Situaciones", summary.situacionesEstimadas], ["Columnas mapeadas", mappedColumns], ["Columnas ignoradas", importData.parsed.columnas.length - mappedColumns]].map(([label, value]) => <div className={styles.summaryItem} key={label}><span>{label}</span><strong>{value || 0}</strong></div>)}
            </div>
            {!mappingError && normalizedRows.length > 0 && (
              <div className={styles.previewTable}>
                <table>
                  <thead><tr><th>Fila</th>{SIDCA_IMPORT_FIELDS.filter((field) => importData.mapping[field.key]).map((field) => <th key={field.key}>{field.label}</th>)}</tr></thead>
                  <tbody>{normalizedRows.slice(0, 20).map((row) => <tr key={row.recordKey}><td>{row.numeroFila}</td>{SIDCA_IMPORT_FIELDS.filter((field) => importData.mapping[field.key]).map((field) => <td key={field.key}>{row.valoresNormalizados[field.key] || "—"}</td>)}</tr>)}</tbody>
                </table>
              </div>
            )}
            {!mappingError && !normalizedRows.length && <div className={styles.empty}>No se detectaron filas de datos.</div>}
          </section>

          <section className={styles.panel}>
            <div className={styles.sectionHeader}><div><h2>6. Confirmación e importación</h2><p className={styles.muted}>Se conservará el archivo original en Storage y se registrará la trazabilidad de cada fila.</p></div></div>
            {result ? (
              <Message severity="success" text={`Importación completada: ${result.metrics.registrosImportados} filas, ${result.metrics.coincidenciasConfirmadas} coincidencias confirmadas y ${result.metrics.requierenRevision} revisiones.`} />
            ) : (
              <div className={styles.stepActions}><Button label="Confirmar importación" icon="pi pi-check" severity="success" onClick={confirmImport} loading={busy} disabled={busy || mappingError || !normalizedRows.length} /></div>
            )}
            {progress && busy && <ProgressBar value={progress.percent || 0} showValue />}
          </section>
        </>
      )}
    </main>
  );
};

export default TitularizacionImportPage;
