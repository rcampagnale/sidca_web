// src/components/afiliados/ViewDialog.js
import React, { memo } from "react";
import { Dialog } from "primereact/dialog";
import { Button } from "primereact/button";
import { toSiNo } from "./utils/shared.js";

/**
 * Props:
 * - visible: boolean
 * - data: objeto fila normalizado (puede incluir: apellido, nombre, dni, fecha, hora, nroAfiliacion, tituloGrado, descuento, departamento, establecimientos, celular, email, observaciones, adherente)
 * - onClose: () => void
 */
function ViewDialog({ visible, data, onClose }) {
  const Row = ({ label, value }) =>
    value ? (
      <div style={{ display: "grid", gridTemplateColumns: "220px 1fr", gap: 8 }}>
        <b>{label}:</b>
        <span>{value}</span>
      </div>
    ) : null;

  return (
    <Dialog
      header="Detalle del afiliado"
      visible={visible}
      style={{ width: "min(560px, 96vw)" }}
      onHide={onClose}
      modal
      draggable={false}
      resizable={false}
      footer={
        <div style={{ display: "flex", justifyContent: "flex-end" }}>
          <Button label="Cerrar" icon="pi pi-check" onClick={onClose} />
        </div>
      }
    >
      {data ? (
        <div style={{ display: "grid", gap: 10, padding: 6 }}>
          <Row label="Apellido y Nombre" value={`${data.apellido ?? ""}, ${data.nombre ?? ""}`} />
          <Row label="DNI" value={data.dni} />
          <Row label="Fecha" value={data.fecha} />
          <Row label="Hora" value={data.hora} />
          <Row
            label="Afiliación"
            value={
              data.nroAfiliacion
                ? `${Number(data.nroAfiliacion)}ª`
                : "Sin dato"
            }
          />
          <Row label="Título de grado" value={data.tituloGrado} />
          <Row label="Descuento" value={toSiNo(data.descuento) || "—"} />
          <Row label="Departamento" value={data.departamento} />
          <Row label="Establecimientos" value={data.establecimientos} />
          <Row label="Celular" value={data.celular} />
          <Row label="Email" value={data.email} />
          <Row label="Observaciones" value={data.observaciones} />
          <Row label="Adherente" value={data.adherente ? "Sí" : "No"} />
          <Row label="Origen" value={data.origen} />
        </div>
      ) : (
        <p>No hay datos para mostrar.</p>
      )}
    </Dialog>
  );
}

export default memo(ViewDialog);
