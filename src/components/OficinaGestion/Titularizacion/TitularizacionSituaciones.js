import React from "react";
import { Tag } from "primereact/tag";

import { TITULARIZACION_SOURCE_ROLE_LABELS } from "../../../services/titularizacion/titularizacionService";
import styles from "../../../pages/Admin/OficinaGestion/Titularizacion/TitularizacionPage.module.css";

const valueOrDash = (value) => value || "—";

const sourceLabel = (sourceRef = {}, situacion = {}) =>
  TITULARIZACION_SOURCE_ROLE_LABELS[sourceRef.rol] ||
  (sourceRef.importId
    ? "Presentación SIDCA"
    : sourceRef.formularioTitulo || "Solicitud afiliado") ||
  situacion.formularioId ||
  "Fuente";

const sourceLabelsFor = (situacion) => {
  const refs = Array.isArray(situacion.sourceRefs) ? situacion.sourceRefs : [];
  const labels = refs.map((sourceRef) =>
    sourceLabel(sourceRef, situacion)
  );
  if (!labels.length) {
    return [situacion.origen === "importacion_excel" ? "Solicitud afiliado" : "Fuente"];
  }
  return [...new Set(labels)];
};

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
            value={sourceLabelsFor(situacion).join(" · ")}
            severity="info"
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
          <span>Fuente</span>
          <strong>{sourceLabelsFor(situacion).join(" · ")}</strong>
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
