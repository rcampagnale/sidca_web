import React from "react";
import { Card } from "primereact/card";
import { Button } from "primereact/button";
import { Skeleton } from "primereact/skeleton";
import { Tag } from "primereact/tag";
import { useHistory } from "react-router-dom";

import styles from "./CursosCard.module.css";

/**
 * Divide la descripción del curso en líneas ordenadas.
 * Funciona aunque el texto venga de Firebase todo junto en una sola línea.
 */
const prepararDescripcion = (descripcion) => {
  if (!descripcion) return [];

  const textoOriginal = String(descripcion)
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .trim();

  if (!textoOriginal) return [];

  const tieneSaltosDeLinea = textoOriginal.includes("\n");

  const textoPreparado = tieneSaltosDeLinea
    ? textoOriginal
    : textoOriginal
        // Destinatarios / checks
        .replace(/\s+(✅)/g, "\n$1")
        .replace(/\s+(✔️)/g, "\n$1")
        .replace(/\s+(✔)/g, "\n$1")

        // Fechas
        .replace(/\s+(📅\s*Fecha:)/gi, "\n$1")
        .replace(/\s+(Fecha:)/gi, "\n$1")

        // Cronograma
        .replace(/\s+(📌\s*Cronograma:)/gi, "\n$1")
        .replace(/\s+(Cronograma:)/gi, "\n$1")

        // Días
        .replace(/\s+(📌\s*D[ií]a\s*\d+:)/gi, "\n$1")
        .replace(/\s+(D[ií]a\s*\d+:)/gi, "\n$1")

        // Horarios
        .replace(/\s+(⏰\s*Horario:)/gi, "\n$1")
        .replace(/\s+(Horario:)/gi, "\n$1")

        // Lugar
        .replace(/\s+(📍\s*Lugar:)/gi, "\n$1")
        .replace(/\s+(Lugar:)/gi, "\n$1")

        // Carga horaria
        .replace(/\s+(Carga\s*horaria:)/gi, "\n$1")

        // Modalidad
        .replace(/\s+(📝\s*Modalidad:)/gi, "\n$1")
        .replace(/\s+(Modalidad:)/gi, "\n$1")

        // Evaluación
        .replace(/\s+(Evaluaci[oó]n:)/gi, "\n$1")
        .replace(/\s+(Con\s+Evaluaci[oó]n)/gi, "\n$1")
        .replace(/\s+(Producci[oó]n\s+Final)/gi, "\n$1");

  return textoPreparado
    .split("\n")
    .map((linea) => linea.replace(/\s+/g, " ").trim())
    .filter(Boolean);
};

/**
 * Detecta si una línea funciona como título o subtítulo.
 */
const esTituloDescripcion = (linea) => {
  const texto = linea
    .replace(/[🎓📘📅📍📌⏰📝✅✔️✔]/g, "")
    .trim()
    .toLowerCase();

  return (
    texto === "destinatarios:" ||
    texto === "destinatario:" ||
    texto === "cronograma:" ||
    texto === "fecha:" ||
    texto === "modalidad:" ||
    texto === "evaluación:" ||
    texto === "evaluacion:"
  );
};

/**
 * Detecta líneas tipo ítem.
 */
const esItemDescripcion = (linea) => {
  const texto = linea.trim();
  return (
    texto.startsWith("✅") ||
    texto.startsWith("✔️") ||
    texto.startsWith("✔")
  );
};

/**
 * Detecta líneas de datos: fecha, horario, lugar, modalidad, etc.
 */
const esDatoDescripcion = (linea) => {
  const texto = linea.trim().toLowerCase();

  return (
    texto.startsWith("📅") ||
    texto.startsWith("📌") ||
    texto.startsWith("⏰") ||
    texto.startsWith("📍") ||
    texto.startsWith("📝") ||
    texto.startsWith("día") ||
    texto.startsWith("dia") ||
    texto.startsWith("horario") ||
    texto.startsWith("lugar") ||
    texto.startsWith("carga horaria") ||
    texto.startsWith("modalidad") ||
    texto.startsWith("evaluación") ||
    texto.startsWith("evaluacion")
  );
};

/**
 * Pone en negrita la etiqueta inicial de cada línea.
 * Ejemplo: "Horario:" queda en negrita.
 */
const renderizarLinea = (linea) => {
  const indiceDosPuntos = linea.indexOf(":");

  if (indiceDosPuntos > 0 && indiceDosPuntos <= 40) {
    const etiqueta = linea.slice(0, indiceDosPuntos + 1);
    const contenido = linea.slice(indiceDosPuntos + 1).trim();

    return (
      <>
        <strong>{etiqueta}</strong>
        {contenido ? ` ${contenido}` : ""}
      </>
    );
  }

  return linea;
};

const CursosCard = ({ curso, miCurso }) => {
  const history = useHistory();

  const descripcionLineas = prepararDescripcion(curso?.descripcion);

  const header = (curso?.imagen || "").includes("https://") ? (
    <img
      alt={curso?.titulo || "Curso"}
      src={curso.imagen}
      className={styles.headerImg}
    />
  ) : (
    <Skeleton width="100%" height="12rem" />
  );

  const footer = miCurso ? (
    curso.aprobo ? (
      <div className={styles.statusWrapper}>
        <Tag
          value="Aprobaste este curso"
          icon="pi pi-check-circle"
          severity="success"
          className={styles.successTag}
          rounded
        />

        <small className={styles.statusHelp}>¡Felicitaciones!</small>
      </div>
    ) : curso.estado !== "terminado" ? (
      <span className={styles.footerText}>Curso aún dictándose</span>
    ) : (
      <span className={styles.footerText}>Desaprobaste el curso</span>
    )
  ) : curso.estado !== "terminado" ? (
    <div className={styles.footerBtnsCol}>
      <Button
        label="Inscribirse"
        icon="pi pi-check"
        className="p-button-success"
        onClick={() => {
          if (curso?.link) {
            window.location.href = curso.link;
          }
        }}
        disabled={!curso?.link}
      />

      <Button
        label="Regresar a Capacitaciones"
        icon="pi pi-arrow-left"
        className="p-button-secondary"
        onClick={() => history.push("/capacitaciones")}
      />
    </div>
  ) : (
    <span className={styles.footerText}>Curso Finalizado</span>
  );

  return (
    <Card
  title={curso?.titulo || "Curso"}
  footer={footer}
  header={header}
  className={styles.cardContainer}
>
  {descripcionLineas.length > 0 ? (
    <div className={styles.descripcion}>
      {descripcionLineas.map((linea, index) => {
        const clases = [
          styles.descripcionLinea,
          esTituloDescripcion(linea) ? styles.descripcionTitulo : "",
          esItemDescripcion(linea) ? styles.descripcionItem : "",
          esDatoDescripcion(linea) ? styles.descripcionDato : "",
        ]
          .filter(Boolean)
          .join(" ");

        return (
          <p key={`${linea}-${index}`} className={clases}>
            {renderizarLinea(linea)}
          </p>
        );
      })}
    </div>
  ) : null}
</Card>
  );
};

export default CursosCard;