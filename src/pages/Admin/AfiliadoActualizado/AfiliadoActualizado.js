// src/pages/Admin/Afiliados/AfiliadoActualizado.js
import React, { useEffect, useMemo, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { InputText } from "primereact/inputtext";
import { DataTable } from "primereact/datatable";
import { Column } from "primereact/column";
import { Button } from "primereact/button";
import { Dialog } from "primereact/dialog";
import { ConfirmDialog, confirmDialog } from "primereact/confirmdialog";
import { ProgressSpinner } from "primereact/progressspinner";
import exportFromJSON from "export-from-json";
import styles from "./styles.module.css";

import {
  fetchAfiliadosFirstPage,
  fetchAfiliadosNextPage,
  fetchAfiliadosPrevPage,
  deleteAfiliadoById,
  selectAfiliadosList,
  selectAfiliadosLoading,
  selectAfiliadosPage,
  selectAfiliadosHasNext,
} from "../../../redux/reducers/afiliadoActualizado/slice";

// helpers
const splitFechaHora = (fechaStr) => {
  if (!fechaStr || typeof fechaStr !== "string") return { fecha: "", hora: "" };
  const [f, h] = fechaStr.trim().split(" ");
  return { fecha: f || "", hora: h || "" };
};
const clean = (v) => (typeof v === "string" ? v.trim() : v);
const toRow = (d) => {
  const { fecha: f, hora: h } = splitFechaHora(d.fecha);
  return {
    id: d.id,
    fecha: f,
    hora: h,
    nombre: clean(d.nombre) || "",
    apellido: clean(d.apellido) || "",
    dni: clean(d.dni) || "",
    nroAfiliacion: Number(d.nroAfiliacion ?? 1),
    departamento: clean(d.departamento) || "",
    establecimientos: clean(d.establecimientos) || "",
    celular: clean(d.celular) || "",
    email: clean(d.email) || clean(d["correo electrónico"]) || "",
    cod: d.cod ?? "",
    descuento: clean(d.descuento) || "",
  };
};
const toTimestamp = (s) => {
  if (!s || typeof s !== "string") return 0;
  const raw = s.trim().replace(/-/g, "/");
  const [dmy, hms = "00:00:00"] = raw.split(" ");
  if (!dmy) return 0;
  const [d, m, y] = dmy.split("/").map((n) => parseInt(n, 10));
  const parts = hms.split(":").map((n) => parseInt(n, 10) || 0);
  const [hh = 0, mm = 0, ss = 0] = parts;
  const dt = new Date(y, (m || 1) - 1, d || 1, hh, mm, ss);
  return isNaN(dt.getTime()) ? 0 : dt.getTime();
};

const AfiliadoActualizado = () => {
  const dispatch = useDispatch();

  const list = useSelector(selectAfiliadosList);
  const loading = useSelector(selectAfiliadosLoading);
  const page = useSelector(selectAfiliadosPage);
  const hasNext = useSelector(selectAfiliadosHasNext);

  const [query, setQuery] = useState("");
  const [showDetail, setShowDetail] = useState(false);
  const [rowDetail, setRowDetail] = useState(null);

  useEffect(() => {
    dispatch(fetchAfiliadosFirstPage());
  }, [dispatch]);

  const rows = useMemo(() => (list || []).map(toRow), [list]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const ordered = [...rows].sort((a, b) => {
      const sa = a.hora ? `${a.fecha} ${a.hora}` : a.fecha;
      const sb = b.hora ? `${b.fecha} ${b.hora}` : b.fecha;
      return toTimestamp(sb) - toTimestamp(sa);
    });
    if (!q) return ordered;
    return ordered.filter((r) => {
      const nombreCompleto = `${r.apellido} ${r.nombre}`.toLowerCase();
      return (
        nombreCompleto.includes(q) ||
        String(r.dni).includes(q) ||
        String(r.nroAfiliacion).includes(q)
      );
    });
  }, [rows, query]);

  const afiliacionTemplate = (row) =>
    Number(row.nroAfiliacion) > 1 ? (
      <span className={styles.badgeReafiliado}>
        {row.nroAfiliacion}ª afiliación
      </span>
    ) : (
      "1ª afiliación"
    );

  const onVerDetalle = (row) => { setRowDetail(row); setShowDetail(true); };
  const onEliminar = (row) => {
    confirmDialog({
      message: `¿Eliminar el registro de ${row.apellido}, ${row.nombre} (DNI ${row.dni})?`,
      header: "Confirmar eliminación",
      icon: "pi pi-exclamation-triangle",
      acceptLabel: "Sí, eliminar",
      rejectLabel: "Cancelar",
      acceptClassName: "p-button-danger",
      accept: async () => { await dispatch(deleteAfiliadoById(row.id)); },
    });
  };

  const handleExportExcel = () => {
    const ordered = [...list].sort(
      (a, b) => toTimestamp(b.fecha) - toTimestamp(a.fecha)
    );
    const data = ordered.map((d) => {
      const { fecha, hora } = splitFechaHora(d.fecha || "");
      const email = d.email || d["correo electrónico"] || "";
      return {
        Fecha: fecha,
        Hora: hora,
        Nombre: clean(d.nombre) || "",
        Apellido: clean(d.apellido) || "",
        DNI: clean(d.dni) || "",
        Afiliación: Number(d.nroAfiliacion ?? 1),
        Departamento: clean(d.departamento) || "",
        Establecimientos: clean(d.establecimientos) || "",
        Celular: clean(d.celular) || "",
        Email: clean(email) || "",
        Descuento: clean(d.descuento) || "",
        Código: d.cod ?? "",
        ID: d.id,
      };
    });
    exportFromJSON({ data, fileName: "afiliados_actualizados", exportType: "xls" });
  };

  return (
    <div className={styles.container}>
      <ConfirmDialog />

      <div className={styles.title_and_button}>
        <h3 className={styles.title}>Afiliado Actualizado</h3>
        <Button
          label="Descargar Lista de Afiliados"
          icon="pi pi-download"
          className="p-button-success p-button-sm"
          onClick={handleExportExcel}
          disabled={loading || (list?.length ?? 0) === 0}
        />
      </div>

      {/* Spinner de pantalla completa mientras carga inicial */}
      {loading && (list?.length ?? 0) === 0 ? (
        <div className={styles.center} style={{ padding: 48, minHeight: 240 }}>
          <ProgressSpinner />
        </div>
      ) : (
        <>
          <div className={styles.toolbarRow}>
            <span className="p-input-icon-left" style={{ width: 360 }}>
              <i className="pi pi-search" />
              <InputText
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Buscar por nombre, apellido o DNI…"
                style={{ width: "100%" }}
                disabled={loading}
              />
            </span>

            <div className={styles.actionsRow}>
              <Button
                label="Anterior"
                icon="pi pi-chevron-left"
                onClick={() => dispatch(fetchAfiliadosPrevPage())}
                disabled={loading || page <= 1}
                className="p-button-sm p-button-outlined"
              />
              <Button
                label="Siguiente"
                icon="pi pi-chevron-right"
                onClick={() => dispatch(fetchAfiliadosNextPage())}
                disabled={loading || !hasNext}
                className="p-button-sm p-button-outlined"
              />
              <span className={styles.muted}>Página {page}</span>
            </div>
          </div>

          <DataTable
            value={filtered}
            emptyMessage="No hay registros de afiliados actualizados."
            responsiveLayout="scroll"
            tableStyle={{ tableLayout: "auto" }}
            loading={loading}                 // 👈 overlay de carga en la tabla
          >
            <Column field="fecha" header="Fecha" />
            <Column field="hora" header="Hora" />
            <Column field="nombre" header="Nombre" />
            <Column field="apellido" header="Apellido" />
            <Column field="dni" header="DNI" />
            <Column field="nroAfiliacion" header="Afiliación" body={afiliacionTemplate} />
            <Column
              header="Acciones"
              body={(row) => (
                <div style={{ display: "flex", gap: 8, whiteSpace: "nowrap" }}>
                  <Button
                    icon="pi pi-eye"
                    className="p-button-rounded p-button-text"
                    tooltip="Ver detalle"
                    onClick={() => onVerDetalle(row)}
                  />
                  <Button
                    icon="pi pi-trash"
                    className="p-button-rounded p-button-text p-button-danger"
                    tooltip="Eliminar"
                    onClick={() => onEliminar(row)}
                  />
                </div>
              )}
            />
          </DataTable>
        </>
      )}

      <Dialog
        header="Detalle del afiliado"
        visible={showDetail}
        style={{ width: "min(520px, 96vw)" }}
        onHide={() => setShowDetail(false)}
        draggable={false}
        resizable={false}
      >
        {rowDetail ? (
          <div className="p-3">
            <div className={styles.stack}>
              <div><b>Apellido y Nombre:</b> {rowDetail.apellido}, {rowDetail.nombre}</div>
              <div><b>DNI:</b> {rowDetail.dni}</div>
              <div><b>Fecha:</b> {rowDetail.fecha} — <b>Hora:</b> {rowDetail.hora}</div>
              <div><b>Afiliación:</b> {rowDetail.nroAfiliacion}ª</div>
              {rowDetail.departamento && <div><b>Departamento:</b> {rowDetail.departamento}</div>}
              {rowDetail.establecimientos && <div><b>Establecimiento:</b> {rowDetail.establecimientos}</div>}
              {rowDetail.celular && <div><b>Celular:</b> {rowDetail.celular}</div>}
              {rowDetail.email && <div><b>Email:</b> {rowDetail.email}</div>}
            </div>
            <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 16 }}>
              <Button label="Cerrar" icon="pi pi-check" onClick={() => setShowDetail(false)} />
            </div>
          </div>
        ) : (
          <p>No hay datos para mostrar.</p>
        )}
      </Dialog>
    </div>
  );
};

export default AfiliadoActualizado;

