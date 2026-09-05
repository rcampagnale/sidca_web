// src/pages/Admin/Certificados/InstitucionCertificado.js
//
// Institución del certificado: define qué plantilla se usa al emitir.
//
// Tres opciones, con valores semánticos ("sidca" / "itm" / "ministerio"). No es texto
// libre: el valor viaja a Firestore y determina un asset, así que un typo
// rompería la plantilla sin aviso.

import React from "react";

import styles from "./CertificadosAdmin.module.css";

export const INSTITUCIONES = [
  {
    valor: "sidca",
    etiqueta: "Sindicato",
    detalle: "Certificado institucional SIDCA",
  },
  {
    valor: "itm",
    etiqueta: "ITM",
    detalle: "Instituto Tecnológico Municipal",
  },
  {
    valor: "ministerio",
    etiqueta: "Ministerio de Educación",
    detalle: "Certificado oficial del Ministerio de Educación y Trabajo",
  },
];

/** Toda configuración sin institución explícita es SIDCA. */
export const normalizarInstitucion = (valor) =>
  ["itm", "ministerio"].includes(valor) ? valor : "sidca";

const InstitucionCertificado = ({ valor, onCambiar, deshabilitado }) => {
  const seleccionada = normalizarInstitucion(valor);

  return (
    <section className={styles.bloque}>
      <div className={styles.bloqueHeader}>
        <h2 className={styles.bloqueTitulo}>Institución del certificado</h2>
      </div>

      <div
        className={styles.listaInstituciones}
        role="radiogroup"
        aria-label="Institución del certificado"
      >
        {INSTITUCIONES.map((institucion) => {
          const activa = seleccionada === institucion.valor;

          return (
            <button
              key={institucion.valor}
              type="button"
              role="radio"
              aria-checked={activa}
              className={`${styles.institucionCard} ${
                activa ? styles.institucionCardActiva : ""
              }`}
              onClick={() => onCambiar(institucion.valor)}
              disabled={deshabilitado}
            >
              <span className={styles.institucionEtiqueta}>
                {institucion.etiqueta}
              </span>
              <span className={styles.institucionDetalle}>
                {institucion.detalle}
              </span>
            </button>
          );
        })}
      </div>

      <p className={styles.ayuda}>
        Esta opción define la plantilla institucional que se utilizará al
        emitir el certificado.
      </p>
    </section>
  );
};

export default InstitucionCertificado;
