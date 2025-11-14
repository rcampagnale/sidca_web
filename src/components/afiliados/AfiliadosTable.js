// src/components/afiliados/AfiliadosTable.js
import React, { memo, useCallback } from "react";
import { DataTable } from "primereact/datatable";
import { Column } from "primereact/column";
import { Button } from "primereact/button";
import { Tag } from "primereact/tag";

function AfiliadosTable({
  data = [],
  loading = false,
  isPending = false,
  page = 1,
  hasNext = false,
  onPrev = () => {},
  onNext = () => {},
  onActionClick = () => {},
}) {
  const nameTemplate = useCallback((row) => row.nombre || "—", []);
  const apellidoTemplate = useCallback((row) => row.apellido || "—", []);
  const dniTemplate = useCallback((row) => row.dni || "—", []);
  const fechaTemplate = useCallback((row) => row.fecha || "—", []);
  const horaTemplate = useCallback((row) => row.hora || "—", []);
  const afiliacionTemplate = useCallback(
    (row) =>
      row.nroAfiliacion ? (
        <Tag value={`${Number(row.nroAfiliacion)}ª afiliación`} severity="success" />
      ) : (
        <Tag value="—" />
      ),
    []
  );
  const adherenteTemplate = useCallback(
    (row) =>
      typeof row.adherente === "boolean" ? (
        <Tag value={row.adherente ? "Sí" : "No"} severity={row.adherente ? "success" : "danger"} />
      ) : (
        <Tag value="—" />
      ),
    []
  );

  // ⬇️ Origen: soporta "ambos"
  const origenTemplate = useCallback((row) => {
    if (row.origen === "ambos") {
      return (
        <div style={{ display: "flex", gap: 6 }}>
          <Tag value="nuevoAfiliado" severity="contrast" />
          <Tag value="usuarios" severity="info" />
        </div>
      );
    }
    const origen = row.origen === "usuarios" ? "usuarios" : "nuevoAfiliado";
    const sev = origen === "usuarios" ? "info" : "contrast";
    return <Tag value={origen} severity={sev} />;
  }, []);

  const actionBodyTemplate = useCallback(
    (row) => (
      <Button
        icon="pi pi-ellipsis-v"
        className="p-button-warning p-button-sm"
        onClick={(e) => onActionClick(e, row)}
      />
    ),
    [onActionClick]
  );

  return (
    <>
      <div className="table-wrapper">
        <DataTable value={data} loading={loading || isPending} responsiveLayout="scroll">
          <Column header="Fecha" body={fechaTemplate} style={{ minWidth: 120 }} />
          <Column header="Hora" body={horaTemplate} style={{ minWidth: 100 }} />
          <Column header="Nombre" body={nameTemplate} style={{ minWidth: 200 }} />
          <Column header="Apellido" body={apellidoTemplate} style={{ minWidth: 200 }} />
          <Column header="DNI" body={dniTemplate} style={{ minWidth: 140 }} />
          <Column header="Afiliación" body={afiliacionTemplate} style={{ minWidth: 130 }} />
          <Column header="Adherente" body={adherenteTemplate} style={{ minWidth: 110 }} />
          <Column header="Origen" body={origenTemplate} style={{ minWidth: 160 }} />
          <Column
            header="Acciones"
            body={actionBodyTemplate}
            headerClassName="col-actions sticky-right"
            bodyClassName="col-actions sticky-right"
            style={{ width: 110, textAlign: "center" }}
          />
        </DataTable>
      </div>

      {/* Controles de paginación simple */}
      <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 8 }}>
        <Button
          label="Anterior"
          icon="pi pi-chevron-left"
          onClick={onPrev}
          disabled={loading || page <= 1}
          className="p-button-sm p-button-outlined"
        />
        <Button
          label="Siguiente"
          icon="pi pi-chevron-right"
          onClick={onNext}
          disabled={loading || !hasNext}
          className="p-button-sm p-button-outlined"
        />
      </div>
    </>
  );
}

export default memo(AfiliadosTable);
