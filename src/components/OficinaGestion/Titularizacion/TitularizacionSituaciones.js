import React from "react";
import { Tag } from "primereact/tag";

import styles from "../../../pages/Admin/OficinaGestion/Titularizacion/TitularizacionPage.module.css";

const valueOrDash = (value) => value || "—";

const fields = [
  ["cargo", "Cargo"],
  ["horas", "Horas"],
  ["materia", "Materia"],
  ["establecimiento", "Establecimiento"],
  ["nivel", "Nivel"],
  ["modalidad", "Modalidad"],
  ["cursoAnio", "Curso/Año"],
];

const TitularizacionSituaciones = ({ situaciones = [] }) => (
  <div className={styles.situationsList}>
    {situaciones.map((situacion, index) => (
      <article className={styles.situationCard} key={situacion.id || index}>
        <div className={styles.situationHeading}>
          <strong>Situación {index + 1}</strong>
          <Tag
            value={
              situacion.origen === "importacion_excel"
                ? "Solicitud afiliado"
                : situacion.origen || "sin_origen"
            }
            severity={situacion.origen === "importacion_excel" ? "warning" : "info"}
          />
        </div>

        <div className={styles.situationGrid}>
          {fields.map(([key, label]) => (
            <div className={styles.situationField} key={key}>
              <span>{label}</span>
              <strong>{valueOrDash(situacion[key])}</strong>
            </div>
          ))}
        </div>

        <div className={styles.situationReference}>
          <span>Respuesta ID</span>
          <strong>{valueOrDash(situacion.origenRespuestaId)}</strong>
          <span>Formulario ID</span>
          <strong>{valueOrDash(situacion.formularioId)}</strong>
        </div>
      </article>
    ))}
  </div>
);

export default TitularizacionSituaciones;
