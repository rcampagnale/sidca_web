import React, { useEffect, useMemo, useState } from "react";
import { Button } from "primereact/button";
import { Column } from "primereact/column";
import { DataTable } from "primereact/datatable";
import { Dialog } from "primereact/dialog";
import { InputText } from "primereact/inputtext";
import { Message } from "primereact/message";
import { ProgressSpinner } from "primereact/progressspinner";
import { Tag } from "primereact/tag";
import { useHistory, useLocation } from "react-router-dom";

import { exportTitularizacionPendientes } from "../../../../services/titularizacion/titularizacionExportService";
import { loadTitularizacionPendingData } from "../../../../services/titularizacion/titularizacionProcessService";
import { normalizeSearchText } from "../../../../services/titularizacion/titularizacionNormalizer";
import styles from "./TitularizacionStage2.module.css";

const FILTERS = [
  ["todos", "Todos"],
  ["pendientes", "Posibles pendientes SIDCA"],
  ["omision", "Posible omisión SIDCA"],
  ["revision", "Requieren revisión"],
  ["sinSolicitud", "Presentados sin solicitud vinculada"],
];

const valueOrDash = (value) => value || "—";

const TitularizacionPendientesPage = () => {
  const history = useHistory();
  const location = useLocation();
  const initialFilter = new URLSearchParams(location.search).get("filtro") || "todos";
  const [data, setData] = useState(null);
  const [filter, setFilter] = useState(FILTERS.some(([key]) => key === initialFilter) ? initialFilter : "todos");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    loadTitularizacionPendingData()
      .then(setData)
      .catch((exception) => setError(exception.message || "No se pudieron cargar los pendientes."))
      .finally(() => setLoading(false));
  }, []);

  const rows = useMemo(() => {
    const source = data?.rows || [];
    const term = normalizeSearchText(search);
    return source.filter((row) => {
      const matchesFilter =
        filter === "todos" ||
        (filter === "pendientes" && !row.presentadoSidca && row.esSituacionCanonica) ||
        (filter === "omision" && row.tipoInconsistencia === "omision_sidca") ||
        (filter === "revision" && (row.estado === "requiere_revision" || row.tipoInconsistencia === "revision")) ||
        (filter === "sinSolicitud" && row.tipoInconsistencia === "presentada_sin_solicitud_vinculada");
      if (!matchesFilter) return false;
      if (!term) return true;
      return normalizeSearchText(
        [row.dni, row.apellido, row.nombre, row.nombreCompleto].filter(Boolean).join(" ")
      ).includes(term);
    });
  }, [data, filter, search]);

  const estadoBody = (row) => (
    <Tag
      value={row.estado || "requiere_revision"}
      severity={row.estado === "presentada_sidca" ? "success" : row.estado === "no_encontrada" ? "danger" : "warning"}
    />
  );

  const presentedBody = (row) => (
    <Tag value={row.presentadoSidca ? "Sí" : "No / revisión"} severity={row.presentadoSidca ? "success" : "warning"} />
  );

  const detail = selected && (
    <div>
      <div className={styles.detailGrid}>
        {[
          ["DNI", selected.dni],
          ["Apellido y nombre", selected.nombreCompleto || [selected.apellido, selected.nombre].filter(Boolean).join(" ")],
          ["Cargo", selected.cargo],
          ["Materia", selected.materia],
          ["Horas", selected.horas],
          ["Curso/Año", selected.cursoAnio],
          ["Establecimiento", selected.establecimiento],
          ["Nivel", selected.nivel],
          ["Formulario solicitud", selected.formularioSolicitud ? "Sí" : "No / no vinculada"],
          ["Presentación SIDCA", selected.presentadoSidca ? "Sí" : "No / revisión"],
          ["Estado", selected.estado],
          ["Tipo de inconsistencia", selected.tipoInconsistencia],
          ["Score", selected.matchScore == null ? "—" : selected.matchScore],
        ].map(([label, value]) => <div key={label}><span>{label}</span><strong>{valueOrDash(value)}</strong></div>)}
      </div>
      <h3>Fuentes y trazabilidad</h3>
      <pre style={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>{JSON.stringify({ sourceRefs: selected.sourceRefs || [], razones: selected.razonesMatch || [], diferencias: selected.diferenciasMatch || [] }, null, 2)}</pre>
    </div>
  );

  if (loading) {
    return <main className={styles.page}><div className={styles.loading}><ProgressSpinner /><span>Cargando pendientes...</span></div></main>;
  }

  if (!data) {
    return <main className={styles.page}><Message severity="warn" text="El proceso 2026 todavía no está inicializado." /><Button label="Volver al módulo" icon="pi pi-arrow-left" outlined onClick={() => history.push("/admin/oficina-gestion/titularizacion")} /></main>;
  }

  return (
    <main className={styles.page}>
      <section className={styles.header}>
        <div><span className={styles.badge}>Titularización · Etapa 2</span><h1>Pendientes e inconsistencias</h1><p>Una fila por situación canónica. Las filas presentadas sin solicitud vinculada se muestran separadamente para revisión.</p></div>
        <div className={styles.headerActions}>
          <Button label="Importar presentación SIDCA" icon="pi pi-file-excel" severity="success" outlined onClick={() => history.push("/admin/oficina-gestion/titularizacion/importar")} />
          <Button label="Volver al módulo" icon="pi pi-arrow-left" outlined onClick={() => history.push("/admin/oficina-gestion/titularizacion")} />
        </div>
      </section>

      {error && <Message severity="error" text={error} />}

      <section className={styles.panel}>
        <div className={styles.pendingToolbar}>
          <label>Buscar por DNI, apellido o nombre<InputText className={styles.searchInput} value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar..." /></label>
          <label>Filtro<select className={styles.filterControl} value={filter} onChange={(event) => setFilter(event.target.value)}>{FILTERS.map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label>
          <Button label={`Exportar ${rows.length} filas`} icon="pi pi-file-excel" severity="success" outlined onClick={() => exportTitularizacionPendientes(rows)} disabled={!rows.length} />
        </div>
        <div className={styles.pendingTable}>
          <DataTable value={rows} dataKey="id" paginator rows={25} rowsPerPageOptions={[25, 50, 100]} responsiveLayout="scroll" emptyMessage="No hay situaciones para este filtro." sortMode="single">
            <Column field="dni" header="DNI" sortable body={(row) => valueOrDash(row.dni)} />
            <Column header="Apellido y nombre" sortable sortField="nombreCompleto" body={(row) => valueOrDash(row.nombreCompleto || [row.apellido, row.nombre].filter(Boolean).join(" "))} />
            <Column field="cargo" header="Cargo" sortable body={(row) => valueOrDash(row.cargo)} />
            <Column field="materia" header="Materia" sortable body={(row) => valueOrDash(row.materia)} />
            <Column field="horas" header="Horas" body={(row) => valueOrDash(row.horas)} />
            <Column field="cursoAnio" header="Curso/Año" body={(row) => valueOrDash(row.cursoAnio)} />
            <Column field="establecimiento" header="Establecimiento" body={(row) => valueOrDash(row.establecimiento)} />
            <Column field="nivel" header="Nivel" body={(row) => valueOrDash(row.nivel)} />
            <Column header="Presentado SIDCA" body={presentedBody} />
            <Column header="Estado" body={estadoBody} />
            <Column header="Inconsistencia" body={(row) => valueOrDash(row.tipoInconsistencia)} />
            <Column header="Acciones" body={(row) => <Button label="Detalle" icon="pi pi-eye" outlined onClick={() => setSelected(row)} />} />
          </DataTable>
        </div>
      </section>

      <Dialog header="Detalle pendiente" visible={Boolean(selected)} onHide={() => setSelected(null)} modal style={{ width: "960px", maxWidth: "96vw" }}>
        {detail}
      </Dialog>
    </main>
  );
};

export default TitularizacionPendientesPage;

