// src/components/afiliados/AfiliadosTable.js
import React, { memo, useCallback } from "react";
import { DataTable } from "primereact/datatable";
import { Column } from "primereact/column";
import { Button } from "primereact/button";
import { Tag } from "primereact/tag";
import "./AfiliadosTable.css";

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
  const esReafiliacion = (row) => Number(row?.nroAfiliacion || 0) >= 2;
  const nameTemplate = useCallback((row) => row.nombre || "—", []);
  const apellidoTemplate = useCallback((row) => row.apellido || "—", []);
  const dniTemplate = useCallback((row) => row.dni || "—", []);
  const fechaTemplate = useCallback((row) => row.fecha || "—", []);
  const horaTemplate = useCallback((row) => row.hora || "—", []);
  const afiliacionTemplate = useCallback((row) => {
    const nro = Number(row.nroAfiliacion || 0);
    if (!nro) return <Tag value="—" />;
    if (nro >= 2) {
      return (
        <Tag
          icon="pi pi-exclamation-triangle"
          value={`${nro}ª afiliación`}
          severity="warning"
          style={{ fontWeight: 900 }}
        />
      );
    }
    return <Tag value={`${nro}ª afiliación`} severity="success" />;
  }, []);
  const rowClassName = useCallback(
    (row) => (esReafiliacion(row) ? { "sidca-reafiliacion-row": true } : {}),
    []
  );
  const adherenteTemplate = useCallback(
    (row) =>
      typeof row.adherente === "boolean" ? (
        <Tag
          value={row.adherente ? "Sí" : "No"}
          severity={row.adherente ? "success" : "danger"}
        />
      ) : (
        <Tag value="—" />
      ),
    []
  );

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

  const mobileCard = useCallback(
    (row, index) => {
      const reafiliacion = esReafiliacion(row);
      const nombreCompleto = [row.apellido, row.nombre].filter(Boolean).join(", ");

      return (
        <article
          key={`${row.origen || "origen"}-${row.id || row.dni || index}`}
          className={`afiliado-mobile-card ${
            reafiliacion ? "afiliado-mobile-card--reafiliacion" : ""
          }`}
        >
          <div className="afiliado-mobile-card__header">
            <div className="afiliado-mobile-card__identity">
              <h4>{nombreCompleto || "Afiliado sin nombre"}</h4>
              <p>DNI {row.dni || "—"}</p>
            </div>

            <Button
              icon="pi pi-ellipsis-v"
              label="Acciones"
              className="p-button-warning p-button-sm afiliado-mobile-card__action"
              onClick={(e) => onActionClick(e, row)}
            />
          </div>

          <div className="afiliado-mobile-card__badges">
            {origenTemplate(row)}
            {afiliacionTemplate(row)}
            {adherenteTemplate(row)}
          </div>

          <div className="afiliado-mobile-card__meta">
            <span>
              <b>Fecha</b>
              {row.fecha || "—"}
            </span>
            <span>
              <b>Hora</b>
              {row.hora || "—"}
            </span>
          </div>
        </article>
      );
    },
    [adherenteTemplate, afiliacionTemplate, onActionClick, origenTemplate]
  );

  return (
    <>
      <div className="table-wrapper afiliados-table-wrapper">
        <DataTable
          value={data}
          loading={loading || isPending}
          responsiveLayout="scroll"
          rowClassName={rowClassName}
        >
          <Column header="Fecha" body={fechaTemplate} style={{ minWidth: 120 }} />
          <Column header="Hora" body={horaTemplate} style={{ minWidth: 100 }} />
          <Column header="Nombre" body={nameTemplate} style={{ minWidth: 200 }} />
          <Column header="Apellido" body={apellidoTemplate} style={{ minWidth: 200 }} />
          <Column header="DNI" body={dniTemplate} style={{ minWidth: 140 }} />
          <Column header="Afiliación" body={afiliacionTemplate} style={{ minWidth: 150 }} />
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

      <div className="afiliados-mobile-list">
        {isPending ? (
          <div className="afiliados-mobile-empty">Buscando afiliados...</div>
        ) : data.length === 0 ? (
          <div className="afiliados-mobile-empty">No records found</div>
        ) : (
          data.map(mobileCard)
        )}
      </div>

      <div className="afiliados-pagination">
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
