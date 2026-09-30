import React from "react";
import { Card } from "primereact/card";

import styles from "../../../pages/Admin/OficinaGestion/Titularizacion/TitularizacionPage.module.css";

const items = [
  ["personas", "Personas", "pi pi-users"],
  ["situaciones", "Situaciones", "pi pi-list"],
  ["unaSituacion", "Con una situación", "pi pi-user"],
  ["multiplesSituaciones", "Con múltiples situaciones", "pi pi-sitemap"],
];

const TitularizacionResumen = ({ metrics = {} }) => (
  <div className={styles.summaryGrid}>
    {items.map(([key, label, icon]) => (
      <Card key={key} className={styles.summaryCard}>
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

export default TitularizacionResumen;

