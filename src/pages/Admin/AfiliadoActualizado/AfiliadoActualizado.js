import React, { useEffect, useMemo, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { InputText } from "primereact/inputtext";
import { DataTable } from "primereact/datatable";
import { Column } from "primereact/column";
import { Button } from "primereact/button";
import { Dialog } from "primereact/dialog";
import { ConfirmDialog, confirmDialog } from "primereact/confirmdialog";
import { ProgressSpinner } from "primereact/progressspinner";
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
  selectAfiliadosError,
} from "../../../redux/reducers/afiliadoActualizado/slice";

// 🔎 Import para prueba directa a Firestore (sin Redux)
import { db } from "../../../firebase/firebase-config";
import { collection, getDocs, limit as fbLimit } from "firebase/firestore";

/* ===================== helpers para fecha/hora y limpieza ===================== */
const splitFechaHora = (fechaStr) => {
  if (!fechaStr || typeof fechaStr !== "string") return { fecha: "", hora: "" };
  const [f, h] = fechaStr.trim().split(" ");
  return { fecha: f || "", hora: h || "" };
};
const clean = (v) => (typeof v === "string" ? v.trim() : v);

/* === mapeo final a filas de la tabla (según tu colección real) === */
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
    email: clean(d.email) || "",
    cod: d.cod ?? "",
    descuento: clean(d.descuento) || "",
  };
};

const AfiliadoActualizado = () => {
  const dispatch = useDispatch();

  // Datos desde Redux
  const list = useSelector(selectAfiliadosList);
  const loading = useSelector(selectAfiliadosLoading);
  const page = useSelector(selectAfiliadosPage);
  const hasNext = useSelector(selectAfiliadosHasNext);
  const error = useSelector(selectAfiliadosError);

  const [query, setQuery] = useState("");
  const [showDetail, setShowDetail] = useState(false);
  const [rowDetail, setRowDetail] = useState(null);

  // Depuración UI
  const [showDebug, setShowDebug] = useState(true); // puedes poner false si querés oculto por defecto
  const [probeResult, setProbeResult] = useState(null); // resultado de prueba directa
  const [probing, setProbing] = useState(false);

  // Cargar primera página al montar
  useEffect(() => {
    dispatch(fetchAfiliadosFirstPage());
  }, [dispatch]);

  // Normaliza y aplica búsqueda
  const rows = useMemo(() => (list || []).map(toRow), [list]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) => {
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

  const onVerDetalle = (row) => {
    setRowDetail(row);
    setShowDetail(true);
  };

  const onEliminar = (row) => {
    confirmDialog({
      message: `¿Eliminar el registro de ${row.apellido}, ${row.nombre} (DNI ${row.dni})?`,
      header: "Confirmar eliminación",
      icon: "pi pi-exclamation-triangle",
      acceptLabel: "Sí, eliminar",
      rejectLabel: "Cancelar",
      acceptClassName: "p-button-danger",
      accept: async () => {
        await dispatch(deleteAfiliadoById(row.id));
      },
    });
  };

  // 🧪 Probar Firestore sin Redux (lee 5 docs de la colección)
  const probarFirestoreDirecto = async () => {
    try {
      setProbing(true);
      setProbeResult(null);
      const q = query(collection(db, "nuevoAfiliado"), fbLimit(5)); // ✅ así va limit
      const snap = await getDocs(q);
      const docs = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      setProbeResult({ ok: true, count: docs.length, docs });
    } catch (e) {
      setProbeResult({ ok: false, error: String(e?.message || e) });
    } finally {
      setProbing(false);
    }
  };

  return (
    <div className={styles.container}>
      <ConfirmDialog />

      <div className={styles.title_and_button}>
        <h3 className={styles.title}>Afiliado Actualizado</h3>

        {/* Controles de depuración */}
        <div className={styles.actionsRow}>
          <Button
            label={showDebug ? "Ocultar depuración" : "Mostrar depuración"}
            icon="pi pi-bug"
            className="p-button-sm p-button-secondary"
            onClick={() => setShowDebug((v) => !v)}
          />
          <Button
            label="Probar Firestore"
            icon="pi pi-database"
            className="p-button-sm p-button-help"
            onClick={probarFirestoreDirecto}
            disabled={probing}
          />
        </div>
      </div>

      {showDebug && (
        <div className={styles.card} style={{ fontSize: 13 }}>
          <div className={styles.stack}>
            <div>
              <b>Redux:</b> loading={String(loading)} | page={page} | hasNext=
              {String(hasNext)}
            </div>
            <div>
              <b>Error:</b> {error ? <code>{String(error)}</code> : "—"}
            </div>
            <div>
              <b>Docs recibidos:</b> {list?.length ?? 0}
            </div>
            <div>
              <b>Preview (3):</b>
              <pre style={{ whiteSpace: "pre-wrap", margin: 0 }}>
                {JSON.stringify((list || []).slice(0, 3), null, 2)}
              </pre>
            </div>
            <div>
              <b>Prueba directa:</b>{" "}
              {probing
                ? "consultando..."
                : probeResult
                ? probeResult.ok
                  ? `OK (${probeResult.count})`
                  : `ERROR: ${probeResult.error}`
                : "—"}
              {probeResult?.ok && (
                <pre style={{ whiteSpace: "pre-wrap", margin: 0 }}>
                  {JSON.stringify(probeResult.docs, null, 2)}
                </pre>
              )}
            </div>
          </div>
        </div>
      )}

      <div className={styles.toolbarRow}>
        <span className="p-input-icon-left" style={{ width: 360 }}>
          <i className="pi pi-search" />
          <InputText
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar por nombre, apellido o DNI…"
            style={{ width: "100%" }}
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

      {loading && (list?.length ?? 0) === 0 ? (
        <div className={styles.center} style={{ padding: 24 }}>
          <ProgressSpinner />
        </div>
      ) : (
        <DataTable
          value={filtered} // 👈 acá el fix
          emptyMessage="No hay registros de afiliados actualizados."
          responsiveLayout="scroll"
          tableStyle={{ tableLayout: "auto" }}
        >
          <Column field="fecha" header="Fecha" />
          <Column field="hora" header="Hora" />
          <Column field="nombre" header="Nombre" />
          <Column field="apellido" header="Apellido" />
          <Column field="dni" header="DNI" />
          <Column
            field="nroAfiliacion"
            header="Afiliación"
            body={afiliacionTemplate}
          />
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
              <div>
                <b>Apellido y Nombre:</b> {rowDetail.apellido},{" "}
                {rowDetail.nombre}
              </div>
              <div>
                <b>DNI:</b> {rowDetail.dni}
              </div>
              <div>
                <b>Fecha:</b> {rowDetail.fecha} — <b>Hora:</b> {rowDetail.hora}
              </div>
              <div>
                <b>Afiliación:</b> {rowDetail.nroAfiliacion}ª
              </div>
              {rowDetail.departamento && (
                <div>
                  <b>Departamento:</b> {rowDetail.departamento}
                </div>
              )}
              {rowDetail.establecimientos && (
                <div>
                  <b>Establecimiento:</b> {rowDetail.establecimientos}
                </div>
              )}
              {rowDetail.celular && (
                <div>
                  <b>Celular:</b> {rowDetail.celular}
                </div>
              )}
              {rowDetail.email && (
                <div>
                  <b>Email:</b> {rowDetail.email}
                </div>
              )}
            </div>
            <div
              style={{
                display: "flex",
                justifyContent: "flex-end",
                marginTop: 16,
              }}
            >
              <Button
                label="Cerrar"
                icon="pi pi-check"
                onClick={() => setShowDetail(false)}
              />
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
