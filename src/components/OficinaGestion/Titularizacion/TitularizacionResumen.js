import React from "react";
import { Card } from "primereact/card";

import styles from "../../../pages/Admin/OficinaGestion/Titularizacion/TitularizacionPage.module.css";

const etapa1Items = [
  ["personas", "Personas", "pi pi-users"],
  ["situaciones", "Situaciones", "pi pi-list"],
  ["unaSituacion", "Con una situación", "pi pi-user"],
  ["multiplesSituaciones", "Con múltiples situaciones", "pi pi-sitemap"],
];

const etapa2Items = [
  ["personas", "Personas", "pi pi-users"],
  ["situaciones", "Situaciones", "pi pi-list"],
  ["presentadasSidca", "Presentadas SIDCA", "pi pi-check-circle"],
  ["pendientesSidca", "Pendientes SIDCA", "pi pi-inbox", "pendientes"],
  ["requierenRevision", "Requieren revisión", "pi pi-exclamation-triangle", "revision"],
];

const TitularizacionResumen = ({ metrics = {}, initialized = false, onNavigate }) => {
  const items = initialized ? etapa2Items : etapa1Items;

  return (
  <div className={styles.summaryGrid}>
    {items.map(([key, label, icon]) => (
      <Card
        key={key}
        className={`${styles.summaryCard} ${onNavigate && (key === "pendientesSidca" || key === "requierenRevision") ? styles.summaryCardAction : ""}`}
        onClick={onNavigate && (key === "pendientesSidca" || key === "requierenRevision") ? () => onNavigate(key) : undefined}
      >
        <div className={styles.summaryIcon}>
          <i className={icon} aria-hidden="true" />
        </div>
        <div>
          <span>{label}</span>
          <strong>{metrics[key] || 0}</strong>
        </div>
      </Card>
    ))}
  </div>
  );
};

export default TitularizacionResumen;
