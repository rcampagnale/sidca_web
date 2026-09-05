// src/pages/Admin/Certificados/FormularioCertificado.js
//
// Paso 2: datos documentales del certificado.
//
// Los nombres de los campos son los mismos que ya usan los documentos de la
// colección "certificados" (titulo, resolucion, cargaHoraria, dias, fecha,
// modalidad), para mantener compatibilidad.
//
// Ojo con la diferencia entre dos campos que suenan parecido:
//   dias  -> fechas/período en que se dictó       ("12/10, 18/10 y 26/10")
//   fecha -> fecha textual impresa en el diploma  ("25 de noviembre del 2024")
//
// El campo histórico "imagen" no se muestra ni se escribe: su significado no
// pudo determinarse desde el código y se decidió no reinterpretarlo.

import React from "react";

import styles from "./CertificadosAdmin.module.css";
import { normalizarFechaParaInput } from "./utils/ministerioCertificado";

export const CAMPOS_CERTIFICADO = [
  {
    nombre: "titulo",
    etiqueta: "Título del certificado",
    ayuda: "Se precarga con el título del curso, pero podés editarlo.",
    placeholder: "Ej.: Inmersos en la tecnología",
  },
  {
    nombre: "resolucion",
    etiqueta: "Resolución",
    ayuda: "",
    placeholder: "Ej.: RESGE-2025-123-E-CAT-MET",
  },
  {
    nombre: "cargaHoraria",
    etiqueta: "Carga horaria",
    ayuda: "",
    placeholder: "Ej.: 40 horas reloj",
  },
  {
    nombre: "dias",
    etiqueta: "Fechas de realización",
    ayuda: "Días en que se dictó la capacitación.",
    placeholder: "Ej.: 12/10, 18/10 y 26/10",
  },
  {
    nombre: "fecha",
    etiqueta: "Fecha del certificado",
    ayuda: "Fecha textual que se imprime en el certificado.",
    placeholder: "Ej.: 25 de noviembre del 2024",
  },
  {
    nombre: "modalidad",
    etiqueta: "Modalidad",
    ayuda: "",
    placeholder: "Ej.: Virtual / Presencial / Mixta",
  },
];

const FormularioCertificado = ({
  valores,
  errores,
  onCambiar,
  deshabilitado,
  modelo,
}) => {
  const campos = CAMPOS_CERTIFICADO.filter(
    (campo) => !(modelo === "ministerio" && campo.nombre === "dias")
  );

  return (
  <section className={styles.bloque}>
    <div className={styles.bloqueHeader}>
      <h3 className={styles.bloqueTitulo}>Datos del certificado</h3>
    </div>

    <div className={styles.grillaCampos}>
      {campos.map((campo) => {
        const error = errores?.[campo.nombre];
        const esFechaMinisterio =
          modelo === "ministerio" && campo.nombre === "fecha";

        return (
          <label key={campo.nombre} className={styles.campo}>
            <span className={styles.campoLabel}>
              {esFechaMinisterio ? "Fecha de expedición" : campo.etiqueta}
            </span>

            <input
              type={esFechaMinisterio ? "date" : "text"}
              className={`${styles.input} ${error ? styles.inputError : ""}`}
              value={
                esFechaMinisterio
                  ? normalizarFechaParaInput(valores[campo.nombre])
                  : valores[campo.nombre] || ""
              }
              onChange={(e) => onCambiar(campo.nombre, e.target.value)}
              placeholder={esFechaMinisterio ? undefined : campo.placeholder}
              disabled={deshabilitado}
              aria-invalid={error ? "true" : "false"}
            />

            {error ? (
              <span className={styles.campoError}>{error}</span>
            ) : (
              campo.ayuda && (
                <span className={styles.campoAyuda}>{campo.ayuda}</span>
              )
            )}
          </label>
        );
      })}
    </div>
  </section>
  );
};

export default FormularioCertificado;
