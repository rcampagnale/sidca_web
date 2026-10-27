import React from "react";
import { Card } from "primereact/card";

import styles from "../../../pages/Admin/OficinaGestion/Titularizacion/TitularizacionPage.module.css";

const etapa1Items = [
  ["personas", "Personas del proceso", "pi pi-users"],
  ["personasConSolicitudEstructurada", "Con solicitud estructurada", "pi pi-file"],
  ["personasSinSolicitudEstructurada", "Sin solicitud estructurada", "pi pi-info-circle"],
  ["afiliadosSidca", "Afiliados SIDCA", "pi pi-check-circle"],
  ["noAfiliadosSidca", "No afiliados", "pi pi-times-circle"],
  ["personasSinIdentidadCompleta", "Sin identidad completa", "pi pi-user-edit"],
  ["situacionesCanonicas", "Situaciones estructuradas", "pi pi-list"],
  ["unaSituacion", "Con una situación", "pi pi-user"],
  ["multiplesSituaciones", "Con múltiples situaciones", "pi pi-sitemap"],
  ["personasSinSituacionEstructurada", "Sin situación estructurada", "pi pi-info-circle"],
];

const etapa2Items = [
  ["personas", "Personas del proceso", "pi pi-users"],
  ["personasConSolicitudEstructurada", "Con solicitud estructurada", "pi pi-file"],
  ["personasSinSolicitudEstructurada", "Sin solicitud estructurada", "pi pi-info-circle"],
  ["afiliadosSidca", "Afiliados SIDCA", "pi pi-check-circle"],
  ["noAfiliadosSidca", "No afiliados", "pi pi-times-circle"],
  ["personasSinIdentidadCompleta", "Sin identidad completa", "pi pi-user-edit"],
  ["situaciones", "Situaciones estructuradas", "pi pi-list"],
  ["personasSinSituacionEstructurada", "Sin situación estructurada", "pi pi-info-circle"],
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
