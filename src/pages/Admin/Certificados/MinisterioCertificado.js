import React from "react";
import { Dropdown } from "primereact/dropdown";
import { MultiSelect } from "primereact/multiselect";

import styles from "./CertificadosAdmin.module.css";

export const TIPOS_ACTIVIDAD_MINISTERIO = [
  "CURSO",
  "CONGRESO",
  "SIMPOSIO",
  "JORNADA",
  "TALLER",
  "SEMINARIO",
  "CAPACITACIÓN",
].map((valor) => ({ label: valor, value: valor }));

export const NIVELES_MINISTERIO = [
  "INICIAL",
  "PRIMARIO",
  "SECUNDARIO",
  "SUPERIOR",
].map((valor) => ({ label: valor, value: valor }));

export const normalizarNivelesMinisterio = (niveles) =>
  Array.isArray(niveles)
    ? niveles
        .map((nivel) => String(nivel || "").trim())
        .filter(Boolean)
    : [];

export const DATOS_MINISTERIO_VACIOS = {
  tipoActividad: "",
  fechaInicio: "",
  fechaFin: "",
  localidad: "",
  departamento: "",
  niveles: [],
  textoEvaluacion: "y el correspondiente trabajo de evaluación.",
  textoAuspicio:
    "Este evento de capacitación, fortalecimiento y actualización docente fue auspiciado por el Ministerio de Educación y Trabajo, a través de Resolución S.I.E.(MECYT) N°",
};

const MinisterioCertificado = ({ valores, onCambiar, deshabilitado }) => (
  <section className={styles.bloque}>
    <div className={styles.bloqueHeader}>
      <h3 className={styles.bloqueTitulo}>
        Datos del certificado - Modelo Ministerio
      </h3>
    </div>

    <div className={styles.grillaCampos}>
      <label className={styles.campo}>
        <span className={styles.campoLabel}>Tipo de actividad</span>
        <Dropdown
          value={valores.tipoActividad}
          options={TIPOS_ACTIVIDAD_MINISTERIO}
          onChange={(event) => onCambiar("tipoActividad", event.value)}
          editable
          filter
          disabled={deshabilitado}
          placeholder="Seleccioná o escribí una actividad"
          className={styles.controlPrime}
        />
      </label>

      <label className={styles.campo}>
        <span className={styles.campoLabel}>Fecha de inicio</span>
        <input
          type="date"
          className={styles.input}
          value={valores.fechaInicio}
          onChange={(event) => onCambiar("fechaInicio", event.target.value)}
          disabled={deshabilitado}
        />
      </label>

      <label className={styles.campo}>
        <span className={styles.campoLabel}>Fecha de finalización</span>
        <input
          type="date"
          className={styles.input}
          value={valores.fechaFin}
          onChange={(event) => onCambiar("fechaFin", event.target.value)}
          disabled={deshabilitado}
        />
      </label>

      <label className={styles.campo}>
        <span className={styles.campoLabel}>Localidad</span>
        <input
          type="text"
          className={styles.input}
          value={valores.localidad}
          onChange={(event) => onCambiar("localidad", event.target.value)}
          maxLength={160}
          disabled={deshabilitado}
        />
      </label>

      <label className={styles.campo}>
        <span className={styles.campoLabel}>Departamento</span>
        <input
          type="text"
          className={styles.input}
          value={valores.departamento}
          onChange={(event) => onCambiar("departamento", event.target.value)}
          maxLength={160}
          disabled={deshabilitado}
        />
      </label>

      <div className={styles.campo}>
        <span className={styles.campoLabel}>Niveles educativos</span>
        <MultiSelect
          value={Array.isArray(valores.niveles) ? valores.niveles : []}
          options={NIVELES_MINISTERIO}
          optionLabel="label"
          optionValue="value"
          onChange={(event) => {
            const niveles = Array.isArray(event.value) ? event.value : [];
            onCambiar("niveles", niveles);
          }}
          display="chip"
          filter
          showClear
          disabled={deshabilitado}
          placeholder="Seleccioná uno o más niveles"
          className={styles.controlPrime}
          style={{ width: "100%" }}
          appendTo={document.body}
          panelClassName="ministerio-niveles-panel"
          panelStyle={{ zIndex: 1300 }}
        />
      </div>
    </div>

    <div className={styles.grillaCampos}>
      <label className={`${styles.campo} ${styles.campoAnchoCompleto}`}>
        <span className={styles.campoLabel}>Texto de evaluación</span>
        <textarea
          className={styles.textarea}
          value={valores.textoEvaluacion}
          onChange={(event) => onCambiar("textoEvaluacion", event.target.value)}
          maxLength={500}
          disabled={deshabilitado}
          rows={2}
        />
      </label>

      <label className={`${styles.campo} ${styles.campoAnchoCompleto}`}>
        <span className={styles.campoLabel}>Texto de auspicio</span>
        <textarea
          className={styles.textarea}
          value={valores.textoAuspicio}
          onChange={(event) => onCambiar("textoAuspicio", event.target.value)}
          maxLength={700}
          disabled={deshabilitado}
          rows={3}
        />
        <span className={styles.campoAyuda}>
          La resolución se agrega como dato independiente al final de esta frase.
        </span>
      </label>
    </div>
  </section>
);

export default MinisterioCertificado;
