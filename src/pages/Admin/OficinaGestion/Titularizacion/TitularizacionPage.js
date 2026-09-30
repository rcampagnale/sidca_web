import React, { useEffect, useState } from "react";
import { Button } from "primereact/button";
import { Message } from "primereact/message";
import { ProgressSpinner } from "primereact/progressspinner";
import { useHistory } from "react-router-dom";

import TitularizacionPersonasTable from "../../../../components/OficinaGestion/Titularizacion/TitularizacionPersonasTable";
import TitularizacionResumen from "../../../../components/OficinaGestion/Titularizacion/TitularizacionResumen";
import { loadTitularizacionData } from "../../../../services/titularizacion/titularizacionService";
import styles from "./TitularizacionPage.module.css";

const TitularizacionPage = () => {
  const history = useHistory();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let activo = true;

    loadTitularizacionData()
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
        <Button
          label="Volver a Oficina de Gestión"
          icon="pi pi-arrow-left"
          outlined
          onClick={() => history.push("/admin/oficina-gestion")}
        />
      </section>

      {loading && (
        <div className={styles.loadingBox}>
          <ProgressSpinner />
          <span>Cargando formulario y respuestas...</span>
        </div>
      )}

      {!loading && error && <Message severity="error" text={error} />}

      {!loading && data && (
        <>
          <section className={styles.sourceBox}>
            <div>
              <span>Formulario fuente</span>
              <strong>{data.formulario.titulo || "—"}</strong>
            </div>
            <div>
              <span>ID</span>
              <strong>{data.formulario.id}</strong>
            </div>
            <div>
              <span>Respuestas leídas</span>
              <strong>{data.respuestas.length}</strong>
            </div>
          </section>

          <TitularizacionResumen metrics={data.metrics} />

          <TitularizacionPersonasTable personas={data.personas} />
        </>
      )}
    </main>
  );
};

export default TitularizacionPage;

