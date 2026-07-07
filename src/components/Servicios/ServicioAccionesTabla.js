import React from "react";
import { Button } from "primereact/button";
import styles from "../../pages/Admin/Servicios/servicios.module.css";

const ServicioAccionesTabla = ({
  servicio,
  eliminandoServicioId,
  onVer,
  onEditar,
  onCambiarVisibleEnApp,
  onEliminar,
}) => {
  const visible = servicio?.visibleEnApp === true;
  const eliminando = eliminandoServicioId === servicio?.id;

  return (
    <div className={styles.accionesTabla}>
      <Button
        icon="pi pi-search"
        className="p-button-rounded p-button-help p-button-sm"
        tooltip="Ver y administrar servicio"
        tooltipOptions={{ position: "top" }}
        onClick={() => onVer(servicio)}
      />

      <Button
        icon="pi pi-pencil"
        className="p-button-rounded p-button-info p-button-sm"
        tooltip="Editar servicio"
        tooltipOptions={{ position: "top" }}
        onClick={() => onEditar(servicio)}
      />

      <Button
        icon={visible ? "pi pi-eye" : "pi pi-eye-slash"}
        className={
          visible
            ? "p-button-rounded p-button-success p-button-sm"
            : "p-button-rounded p-button-secondary p-button-sm"
        }
        tooltip={visible ? "Ocultar en app" : "Mostrar en app"}
        tooltipOptions={{ position: "top" }}
        onClick={() => onCambiarVisibleEnApp(servicio)}
      />

      <Button
        icon="pi pi-trash"
        className="p-button-rounded p-button-danger p-button-sm"
        tooltip="Eliminar servicio completo"
        tooltipOptions={{ position: "top" }}
        onClick={() => onEliminar(servicio)}
        loading={eliminando}
      />
    </div>
  );
};

export default ServicioAccionesTabla;