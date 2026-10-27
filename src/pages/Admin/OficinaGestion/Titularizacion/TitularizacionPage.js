import React, { useCallback, useEffect, useState } from "react";
import { Button } from "primereact/button";
import { Dropdown } from "primereact/dropdown";
import { Message } from "primereact/message";
import { MultiSelect } from "primereact/multiselect";
import { ProgressBar } from "primereact/progressbar";
import { ProgressSpinner } from "primereact/progressspinner";
import { useHistory } from "react-router-dom";

import TitularizacionPersonasTable from "../../../../components/OficinaGestion/Titularizacion/TitularizacionPersonasTable";
import TitularizacionResumen from "../../../../components/OficinaGestion/Titularizacion/TitularizacionResumen";
import {
  initializeTitularizacionProcess,
  loadTitularizacionDashboard,
  TITULARIZACION_PERSISTENCE_ENABLED,
} from "../../../../services/titularizacion/titularizacionProcessService";
import {
  DEFAULT_TITULARIZACION_FORMULARIO_ID,
  DEFAULT_TITULARIZACION_SOURCE_CONFIGS,
  TITULARIZACION_SOURCE_ROLE_LABELS,
  TITULARIZACION_SOURCE_ROLES,
} from "../../../../services/titularizacion/titularizacionService";
import styles from "./TitularizacionPage.module.css";

const TitularizacionPage = () => {
  const history = useHistory();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [initializing, setInitializing] = useState(false);
  const [initializationProgress, setInitializationProgress] = useState(null);
  const [initializationMessage, setInitializationMessage] = useState("");
  const [appliedSourceConfigs, setAppliedSourceConfigs] = useState([]);
  const [draftSourceIds, setDraftSourceIds] = useState([]);
  const [draftRoles, setDraftRoles] = useState({});
  const [applyingSources, setApplyingSources] = useState(false);

  const cargar = useCallback((sourceConfigs, options = {}) => {
    setLoading(true);
    setError("");

    return loadTitularizacionDashboard({ sourceConfigs, ...options })
      .then((resultado) => {
        setData(resultado);
        if (resultado.sourceConfigs?.length) {
          setAppliedSourceConfigs(resultado.sourceConfigs);
          setDraftSourceIds(resultado.sourceConfigs.map((config) => config.formularioId));
          setDraftRoles(
            resultado.sourceConfigs.reduce(
              (roles, config) => ({ ...roles, [config.formularioId]: config.rol }),
              {}
            )
          );
        }
      })
      .catch((exception) => {
        console.error("Error al cargar Titularización:", exception);
        setError(exception.message || "No se pudo cargar Titularización.");
      })
      .finally(() => {
        setLoading(false);
      });
  }, []);

  useEffect(() => cargar(DEFAULT_TITULARIZACION_SOURCE_CONFIGS), [cargar]);

  const inicializar = async () => {
    if (initializing) return;
    const confirmar = window.confirm(
      "Se preparará el proceso 2026 con todas las fuentes seleccionadas. ¿Continuar?"
    );
    if (!confirmar) return;

    setInitializing(true);
    setInitializationMessage("Preparando proceso 2026...");
    setInitializationProgress({ percent: 0 });
    setError("");

    try {
      const resultado = await initializeTitularizacionProcess((progress) => {
        setInitializationProgress(progress);
        setInitializationMessage(
          progress.phase === "persistiendo"
            ? `Persistiendo datos: lote ${progress.completedBatches} de ${progress.totalBatches}`
            : "Preparando proceso 2026..."
        );
      }, appliedSourceConfigs);
      setInitializationMessage(
        resultado.alreadyInitialized
          ? "Proceso 2026 sincronizado."
          : resultado.synchronized
            ? `Fuentes sincronizadas: ${resultado.personasPersistidas} personas y ${resultado.situacionesPersistidas} situaciones.`
            : `Proceso 2026 inicializado: ${resultado.personasPersistidas} personas y ${resultado.situacionesPersistidas} situaciones.`
      );
      await cargar();
    } catch (exception) {
      console.error("Error al inicializar Titularización:", exception);
      setError(exception.message || "No se pudo inicializar el proceso 2026.");
    } finally {
      setInitializing(false);
    }
  };

  const aplicarFuentes = async () => {
    if (applyingSources || !draftSourceIds.length) return;

    const sourceConfigs = draftSourceIds.map((formularioId) => ({
      formularioId,
      rol: draftRoles[formularioId] || "otra_solicitud",
    }));

    setApplyingSources(true);
    try {
      await cargar(sourceConfigs, { previewSources: true });
    } finally {
      setApplyingSources(false);
    }
  };

  const rolOptions = TITULARIZACION_SOURCE_ROLES.map((value) => ({
    value,
    label: TITULARIZACION_SOURCE_ROLE_LABELS[value],
  }));

  const structuredRequestSource = (data?.fuentes || []).find(
    (fuente) => fuente.formularioId === DEFAULT_TITULARIZACION_FORMULARIO_ID
  ) || {};

  const formularioOptionTemplate = (formulario) => (
    <div className={styles.sourceOption}>
      <strong>{formulario.titulo || formulario.id}</strong>
      <small>
        {formulario.id} · {formulario.tipoFormulario || formulario.tipoRespuesta || "sin tipo"}
      </small>
    </div>
  );

  const navegarPendientes = (modo) => {
    history.push(
      modo === "revision"
        ? "/admin/oficina-gestion/titularizacion/pendientes?filtro=revision"
        : "/admin/oficina-gestion/titularizacion/pendientes?filtro=pendientes"
    );
  };

  return (
    <main className={styles.page}>
      <section className={styles.header}>
        <div>
          <span className={styles.badge}>Gestión administrativa</span>
          <h1>Titularización Docente</h1>
          <p>
            Control y seguimiento de solicitudes y situaciones presentadas para titularización.
          </p>
        </div>
        <div className={styles.headerActions}>
          <Button
            label="Cruzar Excel / Vista previa"
            icon="pi pi-chart-bar"
            severity="info"
            onClick={() => history.push("/admin/oficina-gestion/titularizacion/importar")}
          />
          {data?.initialized && (
            <>
              <Button
                label="Sincronizar fuentes"
                icon="pi pi-refresh"
                severity="success"
                onClick={inicializar}
                loading={initializing}
                disabled={!TITULARIZACION_PERSISTENCE_ENABLED}
              />
              <Button
                label="Pendientes"
                icon="pi pi-list"
                severity="warning"
                outlined
                onClick={() => history.push("/admin/oficina-gestion/titularizacion/pendientes")}
                disabled={initializing}
              />
            </>
          )}
          {!data?.initialized && (
            <Button
              label="Inicializar proceso 2026"
              icon="pi pi-database"
              severity="success"
              onClick={inicializar}
              loading={initializing}
              disabled={!TITULARIZACION_PERSISTENCE_ENABLED}
            />
          )}
          <Button
            label="Volver a Oficina de Gestión"
            icon="pi pi-arrow-left"
            outlined
            onClick={() => history.push("/admin/oficina-gestion")}
            disabled={initializing}
          />
        </div>
      </section>

      {loading && (
        <div className={styles.loadingBox}>
          <ProgressSpinner />
          <span>Cargando formulario y respuestas...</span>
        </div>
      )}

      {!loading && error && <Message severity="error" text={error} />}

      {!loading && (
        <Message
          severity="warn"
          text="El guardado definitivo y la inicialización permanecen bloqueados. Podés cargar archivos y realizar cruces en modo vista previa sin guardar datos."
        />
      )}

      {initializationMessage && (
        <div className={styles.processNotice}>
          <strong>{initializationMessage}</strong>
          {initializationProgress && (
            <ProgressBar value={initializationProgress.percent || 0} showValue />
          )}
        </div>
      )}

      {!loading && data && (
        <>
          <section className={styles.sourcesPanel}>
            <div className={styles.sourcesHeader}>
              <div>
                <span className={styles.sectionEyebrow}>Fuentes de solicitudes</span>
                <h2>Formularios incluidos en Titularización 2026</h2>
                <p>
                  Se utilizan únicamente las fuentes explícitas del proceso. YHe aporta situaciones
                  estructuradas; Bdd, reclamos, reaperturas y renuncias aportan personas y antecedentes.
                </p>
              </div>
              <Button
                label="Aplicar fuentes"
                icon="pi pi-refresh"
                onClick={aplicarFuentes}
                loading={applyingSources}
                disabled={!draftSourceIds.length || initializing}
              />
            </div>

            <MultiSelect
              value={draftSourceIds}
              options={data.formularios || []}
              optionLabel="titulo"
              optionValue="id"
              itemTemplate={formularioOptionTemplate}
              valueTemplate={(selected) =>
                selected?.length
                  ? `${selected.length} formulario(s) seleccionado(s)`
                  : "Seleccionar uno o más formularios"
              }
              onChange={(event) => {
                const nextIds = event.value || [];
                setDraftSourceIds(nextIds);
                setDraftRoles((current) =>
                  nextIds.reduce((roles, formularioId) => {
                    const formulario = (data.formularios || []).find(
                      (item) => item.id === formularioId
                    );
                    return {
                      ...roles,
                      [formularioId]:
                        current[formularioId] || formulario?.rolSugerido || "otra_solicitud",
                    };
                  }, {})
                );
              }}
              placeholder="Seleccionar uno o más formularios"
              filter
              display="chip"
              className={styles.sourcesSelector}
              disabled={applyingSources || initializing}
              aria-label="Formularios incluidos en Titularización 2026"
            />

            <div className={styles.sourceSelectionNotice}>
              <span>
                <strong>Seleccionadas para esta vista:</strong>{" "}
                {draftSourceIds.length} formulario(s)
              </span>
              <span>
                <strong>Detectadas:</strong> {(data.formularios || []).length} formulario(s)
              </span>
            </div>

            {draftSourceIds.length > 0 && (
              <div className={styles.sourceRoleList}>
                {draftSourceIds.map((formularioId) => {
                  const formulario = (data.formularios || []).find(
                    (item) => item.id === formularioId
                  );
                  return (
                    <div className={styles.sourceRoleRow} key={formularioId}>
                      <div>
                        <strong>{formulario?.titulo || formularioId}</strong>
                        <small>{formularioId}</small>
                      </div>
                      <Dropdown
                        value={draftRoles[formularioId] || "otra_solicitud"}
                        options={rolOptions}
                        optionLabel="label"
                        optionValue="value"
                        onChange={(event) =>
                          setDraftRoles((current) => ({
                            ...current,
                            [formularioId]: event.value,
                          }))
                        }
                        disabled={applyingSources || initializing}
                        aria-label={`Rol de ${formulario?.titulo || formularioId}`}
                      />
                    </div>
                  );
                })}
              </div>
            )}

            <div className={styles.sourceCards}>
              {(data.fuentes || []).map((fuente) => (
                <article className={styles.sourceCard} key={fuente.sourceId || fuente.formularioId}>
                  <div>
                    <strong>{fuente.formularioTitulo || fuente.formularioId}</strong>
                    <span>{TITULARIZACION_SOURCE_ROLE_LABELS[fuente.rol] || fuente.rol}</span>
                  </div>
                  <small>
                    {fuente.respuestas || 0} respuestas · {fuente.personas || 0} personas · {fuente.situaciones || 0} situaciones
                    {` · ${fuente.situacionesDeduplicadas || 0} deduplicadas`}
                    {fuente.personasSinSituacionEstructurada
                      ? ` · ${fuente.personasSinSituacionEstructurada} sin situación`
                      : ""}
                    {fuente.casosRevision ? ` · ${fuente.casosRevision} en revisión` : ""}
                  </small>
                </article>
              ))}
            </div>

            <div className={styles.sourceTotals}>
              <div className={styles.sourceMetricGroup}>
                <strong className={styles.sourceMetricGroupTitle}>SOLICITUD ESTRUCTURADA YHe</strong>
                <span>Respuestas YHe: <strong>{structuredRequestSource.respuestas || 0}</strong></span>
                <span>Personas válidas YHe: <strong>{structuredRequestSource.personas || 0}</strong></span>
                <span>Situaciones YHe: <strong>{structuredRequestSource.situacionesCanonicas || 0}</strong></span>
                <span>Situaciones en revisión YHe: <strong>{structuredRequestSource.situacionesRevision || 0}</strong></span>
              </div>
              <div className={styles.sourceMetricGroup}>
                <strong className={styles.sourceMetricGroupTitle}>UNIVERSO DEL PROCESO</strong>
                <span>Personas únicas: <strong>{data.metrics.personasUnicas || data.metrics.personas || 0}</strong></span>
                <span>Con solicitud estructurada: <strong>{data.metrics.personasConSolicitudEstructurada || 0}</strong></span>
                <span>Sin solicitud estructurada: <strong>{data.metrics.personasSinSolicitudEstructurada || 0}</strong></span>
              </div>
            </div>

            <div className={styles.universeDiagnostics}>
              <div>
                <strong>Diagnóstico del universo de personas</strong>
                <span>La identidad se consolida por DNI normalizado exacto.</span>
              </div>
              <div className={styles.universeDiagnosticGrid}>
                {(data.universeDiagnostics?.personasPorFuente || []).map((fuente) => (
                  <span key={fuente.formularioId}>
                    {fuente.nombre || fuente.tipoFuente || fuente.formularioId}: <strong>{fuente.personas || 0}</strong>
                  </span>
                ))}
                <span>Personas únicas totales: <strong>{data.universeDiagnostics?.personasUnicasTotales || 0}</strong></span>
                <span>Sólo YHe: <strong>{data.universeDiagnostics?.personasSoloYHe || 0}</strong></span>
                <span>YHe + otras: <strong>{data.universeDiagnostics?.personasYHeMasOtras || 0}</strong></span>
                <span>Sólo otras fuentes: <strong>{data.universeDiagnostics?.personasSoloOtras || 0}</strong></span>
                <span>Con apellido + nombre: <strong>{data.universeDiagnostics?.identidadDespues?.conApellidoNombre || 0}</strong></span>
                <span>Sin apellido ni nombre: <strong>{data.universeDiagnostics?.identidadDespues?.sinApellidoNombre || 0}</strong></span>
                <span>Afiliados SIDCA: <strong>{data.universeDiagnostics?.afiliadosSidca || 0}</strong></span>
                <span>No afiliados SIDCA: <strong>{data.universeDiagnostics?.noAfiliadosSidca || 0}</strong></span>
                <span>Conflictos de identidad: <strong>{data.universeDiagnostics?.identityConflicts || 0}</strong></span>
              </div>
              <small>
                Identidad antes/después: {data.universeDiagnostics?.cantidadAntesEnriquecimiento || 0} / {data.universeDiagnostics?.cantidadDespuesEnriquecimiento || 0} personas.
                {data.universeDiagnostics?.padron?.verificacionCompletada === false
                  ? " Afiliación no verificada por un error de lectura."
                  : " Afiliación verificada por presencia en usuarios/nuevoAfiliado."}
              </small>
            </div>
          </section>

          <TitularizacionResumen
            metrics={data.metrics}
            initialized={data.initialized}
            onNavigate={data.initialized ? navegarPendientes : undefined}
          />

          {data.initialized && data.casosRevision?.length > 0 && (
            <div className={styles.reviewNotice}>
              <strong>{data.casosRevision.length} caso(s) de revisión separado(s)</strong>
              <span>
                No se cuentan como personas identificadas por DNI. Revisá los casos desde el detalle de pendientes cuando corresponda.
              </span>
            </div>
          )}

          <TitularizacionPersonasTable personas={data.personas} />
        </>
      )}
    </main>
  );
};

export default TitularizacionPage;
