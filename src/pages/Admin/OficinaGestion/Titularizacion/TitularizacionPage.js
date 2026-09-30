import React, { useCallback, useEffect, useState } from "react";
import { Button } from "primereact/button";
import { Message } from "primereact/message";
import { ProgressBar } from "primereact/progressbar";
import { ProgressSpinner } from "primereact/progressspinner";
import { useHistory } from "react-router-dom";

import TitularizacionPersonasTable from "../../../../components/OficinaGestion/Titularizacion/TitularizacionPersonasTable";
import TitularizacionResumen from "../../../../components/OficinaGestion/Titularizacion/TitularizacionResumen";
import {
  initializeTitularizacionProcess,
  loadTitularizacionDashboard,
} from "../../../../services/titularizacion/titularizacionProcessService";
import styles from "./TitularizacionPage.module.css";

const TitularizacionPage = () => {
  const history = useHistory();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [initializing, setInitializing] = useState(false);
  const [initializationProgress, setInitializationProgress] = useState(null);
  const [initializationMessage, setInitializationMessage] = useState("");

  const cargar = useCallback(() => {
    setLoading(true);
    setError("");
    let activo = true;

    loadTitularizacionDashboard()
      .then((resultado) => {
        if (activo) setData(resultado);
      })
      .catch((exception) => {
        console.error("Error al cargar Titularización:", exception);
        if (activo) setError(exception.message || "No se pudo cargar Titularización.");
      })
      .finally(() => {
      if (activo) setLoading(false);
    });

    return () => {
      activo = false;
    };
  }, []);

  useEffect(() => cargar(), [cargar]);

  const inicializar = async () => {
    if (initializing) return;
    const confirmar = window.confirm(
      "Se preparará el proceso 2026 con las personas y situaciones de la fuente original. ¿Continuar?"
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
      });
      setInitializationMessage(
        resultado.alreadyInitialized
          ? "Proceso 2026 ya estaba inicializado."
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
          {data?.initialized && (
            <>
              <Button
                label="Importar presentación SIDCA"
                icon="pi pi-file-excel"
                severity="success"
                onClick={() => history.push("/admin/oficina-gestion/titularizacion/importar")}
                disabled={initializing}
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
          <section className={styles.sourceBox}>
            <div>
              <span>{data.initialized ? "Proceso" : "Formulario fuente"}</span>
              <strong>{data.initialized ? data.process?.nombre : data.formulario.titulo || "—"}</strong>
            </div>
            <div>
              <span>{data.initialized ? "Estado" : "ID"}</span>
              <strong>{data.initialized ? "Activo" : data.formulario.id}</strong>
            </div>
            <div>
              <span>{data.initialized ? "Respuestas fuente" : "Respuestas leídas"}</span>
              <strong>{data.respuestas.length || 0}</strong>
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
