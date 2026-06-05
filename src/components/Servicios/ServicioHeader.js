import React from "react";
import { Button } from "primereact/button";
import styles from "../../pages/Admin/Servicios/servicios.module.css";

const ServicioHeader = ({ onNuevoServicio }) => {
  return (
    <div className={styles.header}>
      <div>
        <h2 className={styles.titulo}>Administrar Servicios</h2>
        <p className={styles.subtitulo}>
          Gestión de servicios financiados en cuotas para afiliados.
        </p>
      </div>

      <Button
        label="Nuevo servicio"
        icon="pi pi-plus"
        className="p-button-success"
        onClick={onNuevoServicio}
      />
    </div>
  );
};

export default ServicioHeader;