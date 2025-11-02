import React, {
  useEffect,
  useMemo,
  useState,
  useRef,
  useCallback,
  memo,
} from "react";
import { useDispatch, useSelector } from "react-redux";
import { InputText } from "primereact/inputtext";
import { DataTable } from "primereact/datatable";
import { Column } from "primereact/column";
import { Button } from "primereact/button";
import { Dialog } from "primereact/dialog";
import { ConfirmDialog, confirmDialog } from "primereact/confirmdialog";
import { ProgressSpinner } from "primereact/progressspinner";
import { Toast } from "primereact/toast";
import { InputTextarea } from "primereact/inputtextarea";
import { InputSwitch } from "primereact/inputswitch";
import { Dropdown } from "primereact/dropdown";
import { Tag } from "primereact/tag";
import { Menu } from "primereact/menu";
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
  updateAfiliadoById,
} from "../../../redux/reducers/afiliadoActualizado/slice";

import { db } from "../../../firebase/firebase-config";
import {
  collection as fsCollection,
  query as fsQuery,
  where,
  getDocs as fsGetDocs,
  doc as fsDoc,
  setDoc as fsSetDoc,
  deleteDoc as fsDeleteDoc,
  updateDoc as fsUpdateDoc, // 👈 Asegurate de tener esto
} from "firebase/firestore";



/* =========================
   Helpers
   ========================= */
const splitFechaHora = (fechaStr) => {
  if (!fechaStr || typeof fechaStr !== "string") return { fecha: "", hora: "" };
  const [f, h] = fechaStr.trim().split(" ");
  return { fecha: f || "", hora: h || "" };
};
const clean = (v) => (typeof v === "string" ? v.trim() : v);

// Normaliza descuento priorizando string ("si"/"no"); si no, deriva de cotizante (bool/string)
const getDescuentoValue = (d) => {
  if (typeof d?.descuento === "string") return d.descuento.trim().toLowerCase();
  if (typeof d?.cotizante === "boolean") return d.cotizante ? "si" : "no";
  if (typeof d?.cotizante === "string") return d.cotizante.trim().toLowerCase();
  return "";
};
// Para UI: muestra Sí/No a partir de string/bool
const toSiNo = (v) => {
  if (typeof v === "string") {
    const s = v.trim().toLowerCase();
    if (s === "si" || s === "sí" || s === "true") return "Sí";
    if (s === "no" || s === "false") return "No";
  }
  if (typeof v === "boolean") return v ? "Sí" : "No";
  return "";
};
// Normaliza entradas del modal a "si"/"no"
const normalizeDescuentoInput = (val) => {
  const s = (val ?? "").toString().trim().toLowerCase();
  if (["si", "sí", "true", "1"].includes(s)) return "si";
  if (["no", "false", "0"].includes(s)) return "no";
  return "";
};

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
    tituloGrado: clean(d.tituloGrado) || "",
    cod: d.cod ?? "",
    descuento: getDescuentoValue(d), // "si" | "no" | ""
    observaciones: clean(d.observaciones) || "",
    activo: typeof d.activo === "boolean" ? d.activo : true,
    adherente: (d.adherente ?? d.activo) === true,
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
const norm = (s) =>
  (s ?? "")
    .toString()
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "");

/* =========================
   Componentes Memorizados
   ========================= */
const AfiliadosTable = memo(function AfiliadosTable({
  data,
  loading,
  page,
  hasNext,
  onPrev,
  onNext,
  onActionClick,
}) {
  const afiliacionTemplate = (row) => {
    const n = Number(row.nroAfiliacion);
    if (!Number.isFinite(n) || n <= 0)
      return <Tag value="Sin dato" severity="info" />;
    if (n === 1) return <Tag value="1ª afiliación" severity="success" />;
    return <Tag value={`${n}ª reafiliación`} severity="warning" />;
  };

  const adherenteTemplate = (row) =>
    row.adherente ? (
      <Tag value="Sí" severity="success" />
    ) : (
      <Tag value="No" severity="danger" />
    );

  const actionBodyTemplate = (row) => (
    <Button
      icon="pi pi-ellipsis-v"
      rounded
      text
      onClick={(e) => onActionClick(e, row)}
      aria-haspopup
      aria-controls="row_actions_menu"
    />
  );

  return (
    <>
      <div className={styles.actionsRow}>
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
        <span className={styles.muted}>Página {page}</span>
      </div>

      <div className={styles.tableWrap}>
        <DataTable
          value={data}
          emptyMessage="No hay registros de afiliados actualizados."
          responsiveLayout="scroll"
          tableStyle={{ tableLayout: "auto" }}
          loading={loading}
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
          {/* ❌ Sin columna de "Título de grado" */}
          <Column
            field="adherente"
            header="Adherente"
            body={adherenteTemplate}
          />
          <Column
            header="Acciones"
            body={actionBodyTemplate}
            headerClassName="col-actions sticky-right"
            bodyClassName="col-actions sticky-right"
            style={{ width: 96, textAlign: "center" }}
          />
        </DataTable>
      </div>
    </>
  );
});

const EditAfiliadoDialog = memo(function EditAfiliadoDialog({
  visible,
  initialForm,
  departamentosOptions,
  onCancel,
  onSave,
  saving,
}) {
  const [form, setForm] = useState(initialForm);

  useEffect(() => {
    if (visible) setForm(initialForm);
  }, [visible, initialForm]);

  const validate = () => {
    if (!form.nombre.trim()) return "El nombre es obligatorio.";
    if (!form.apellido.trim()) return "El apellido es obligatorio.";
    if (!form.dni.trim()) return "El DNI es obligatorio.";
    if (!/^\d{6,9}$/.test(form.dni))
      return "El DNI debe ser numérico (6 a 9 dígitos).";
    if (form.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email))
      return "El email no es válido.";
    if (form.nroAfiliacion && !/^\d+$/.test(form.nroAfiliacion))
      return "El N° de afiliación debe ser numérico.";
    return null;
  };

  const handleSave = () => {
    const err = validate();
    if (err) return onSave({ error: err });

    const descuentoNorm = normalizeDescuentoInput(form.descuento); // "si" | "no" | ""
    const payload = {
      nombre: form.nombre.trim(),
      apellido: form.apellido.trim(),
      dni: form.dni.trim(),
      email: form.email.trim(),
      celular: form.celular.trim(),
      departamento: form.departamento,
      establecimientos: form.establecimientos,
      descuento: descuentoNorm,
      cotizante:
        descuentoNorm === "si"
          ? true
          : descuentoNorm === "no"
          ? false
          : undefined,
      nroAfiliacion: form.nroAfiliacion ? Number(form.nroAfiliacion) : "",
      observaciones: form.observaciones ?? "",
      activo: !!form.activo,
      adherente: !!form.adherente,
      tituloGrado: form.tituloGrado ? form.tituloGrado.trim() : "",
    };

    onSave({ payload });
  };

  return (
    <Dialog
      header="Editar afiliado"
      visible={visible}
      style={{ width: "min(720px, 96vw)" }}
      breakpoints={{ "960px": "95vw", "640px": "98vw" }}
      modal
      onHide={onCancel}
      footer={
        <div className="flex gap-2 justify-content-end">
          <Button label="Cancelar" text onClick={onCancel} disabled={saving} />
          <Button
            label="Guardar cambios"
            icon="pi pi-save"
            onClick={handleSave}
            loading={saving}
          />
        </div>
      }
    >
      {/* ========= FORMULARIO (estado local) ========= */}
      <div className="p-fluid formgrid grid">
        <div className="field col-12 md:col-4">
          <label htmlFor="apellido">Apellido</label>
          <InputText
            id="apellido"
            value={form.apellido}
            onChange={(e) =>
              setForm((f) => ({ ...f, apellido: e.target.value }))
            }
          />
        </div>

        <div className="field col-12 md:col-4">
          <label htmlFor="nombre">Nombre</label>
          <InputText
            id="nombre"
            value={form.nombre}
            onChange={(e) => setForm((f) => ({ ...f, nombre: e.target.value }))}
          />
        </div>

        <div className="field col-12 md:col-4">
          <label htmlFor="dni">DNI</label>
          <InputText
            id="dni"
            value={form.dni}
            onChange={(e) => setForm((f) => ({ ...f, dni: e.target.value }))}
          />
        </div>

        <div className="field col-12 md:col-6">
          <label htmlFor="email">Email</label>
          <InputText
            id="email"
            value={form.email}
            onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
          />
        </div>

        <div className="field col-12 md:col-6">
          <label htmlFor="celular">Celular</label>
          <InputText
            id="celular"
            value={form.celular}
            onChange={(e) =>
              setForm((f) => ({ ...f, celular: e.target.value }))
            }
          />
        </div>

        <div className="field col-12 md:col-6">
          <label htmlFor="departamento">Departamento</label>
          <Dropdown
            id="departamento"
            value={form.departamento}
            onChange={(e) => setForm((f) => ({ ...f, departamento: e.value }))}
            options={departamentosOptions}
            optionLabel="label"
            optionValue="value"
            placeholder="Seleccionar…"
            filter
            filterBy="label,value"
            showClear
            disabled={departamentosOptions.length === 0}
          />
        </div>

        <div className="field col-12 md:col-6">
          <label htmlFor="establecimientos">Establecimientos</label>
          <InputText
            id="establecimientos"
            value={form.establecimientos}
            onChange={(e) =>
              setForm((f) => ({ ...f, establecimientos: e.target.value }))
            }
          />
        </div>

        {/* Título de grado */}
        <div className="field col-12 md:col-6">
          <label htmlFor="tituloGrado">
            Título de grado (nombre de la carrera)
          </label>
          <InputText
            id="tituloGrado"
            value={form.tituloGrado}
            onChange={(e) =>
              setForm((f) => ({ ...f, tituloGrado: e.target.value }))
            }
          />
        </div>

        {/* Descuento */}
        <div className="field col-12 md:col-6">
          <label htmlFor="descuento">Descuento</label>
          <InputText
            id="descuento"
            value={form.descuento}
            onChange={(e) =>
              setForm((f) => ({ ...f, descuento: e.target.value }))
            }
            placeholder='Escribí "si" o "no"'
          />
        </div>

        <div className="field col-12 md:col-3">
          <label htmlFor="nroAfiliacion">N° de afiliación</label>
          <InputText
            id="nroAfiliacion"
            value={form.nroAfiliacion}
            onChange={(e) =>
              setForm((f) => ({ ...f, nroAfiliacion: e.target.value }))
            }
          />
        </div>

        {/* Observaciones: sin autoResize para evitar recálculos por tecla */}
        <div className="field col-12">
          <label htmlFor="observaciones">Observaciones</label>
          <InputTextarea
            id="observaciones"
            autoResize={false}
            rows={4}
            value={form.observaciones || ""}
            onChange={(e) =>
              setForm((f) => ({ ...f, observaciones: e.target.value }))
            }
          />
        </div>

        <div
          className="field col-12 md:col-3"
          style={{ display: "flex", alignItems: "center", gap: 8 }}
        >
          <label htmlFor="adherente" className="mb-0">
            Adherente
          </label>
          <InputSwitch
            id="adherente"
            checked={!!form.adherente}
            onChange={(e) => setForm((f) => ({ ...f, adherente: e.value }))}
          />
          <span>{form.adherente ? "Sí" : "No"}</span>
        </div>
      </div>
    </Dialog>
  );
});

/* =========================
   Estado inicial de edición
   ========================= */
const emptyForm = {
  nombre: "",
  apellido: "",
  dni: "",
  email: "",
  celular: "",
  departamento: "",
  establecimientos: "",
  descuento: "", // "si"/"no"
  nroAfiliacion: "",
  observaciones: "",
  adherente: false,
  tituloGrado: "",
};

/* =========================
   Página principal
   ========================= */
const AfiliadoActualizado = () => {
  const dispatch = useDispatch();
  const toast = useRef(null);

  const list = useSelector(selectAfiliadosList);
  const loading = useSelector(selectAfiliadosLoading);
  const page = useSelector(selectAfiliadosPage);
  const hasNext = useSelector(selectAfiliadosHasNext);

  const [search, setSearch] = useState("");
  const [showDetail, setShowDetail] = useState(false);
  const [rowDetail, setRowDetail] = useState(null);

  // Edición
  const [editVisible, setEditVisible] = useState(false);
  const [saving, setSaving] = useState(false);
  const [rowId, setRowId] = useState(null);
  const [initialForm, setInitialForm] = useState(emptyForm);

  // Menú Acciones
  const actionMenuRef = useRef(null);
  const [currentRow, setCurrentRow] = useState(null);

  const showSuccess = (msg) =>
    toast.current?.show({
      severity: "success",
      summary: "OK",
      detail: msg,
      life: 3000,
    });
  const showError = (msg) =>
    toast.current?.show({
      severity: "error",
      summary: "Error",
      detail: msg,
      life: 4000,
    });

  useEffect(() => {
    dispatch(fetchAfiliadosFirstPage());
  }, [dispatch]);

  const rows = useMemo(() => (list || []).map(toRow), [list]);

  // Opciones de Departamento dinámicas
  const departamentosOptions = useMemo(() => {
    const map = new Map();
    rows.forEach((r) => {
      const val = (r.departamento || "").toString().trim();
      const key = norm(val);
      if (val && key && !map.has(key)) map.set(key, val);
    });
    return Array.from(map.values())
      .sort((a, b) => a.localeCompare(b))
      .map((v) => ({ label: v, value: v }));
  }, [rows]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
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
  }, [rows, search]);

  const onVerDetalle = (row) => {
    if (!row) return;
    setRowDetail(row); // 1) primero setear la fila
    actionMenuRef.current?.hide?.(); // opcional: cerrar el menú
    setShowDetail(true); // 2) recién después abrir el modal
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

  const onActionClick = useCallback((e, row) => {
    setCurrentRow(row);
    actionMenuRef.current?.toggle(e);
  }, []);

  const handleExportExcel = () => {
    const ordered = [...list].sort(
      (a, b) => toTimestamp(b.fecha) - toTimestamp(a.fecha)
    );
    const data = ordered.map((d) => {
      const { fecha, hora } = splitFechaHora(d.fecha || "");
      const email = d.email || d["correo electrónico"] || "";
      const desc = toSiNo(getDescuentoValue(d));
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
        "Título de grado (nombre de la carrera)": clean(d.tituloGrado) || "",
        Descuento: desc || "",
        Código: d.cod ?? "",
        ID: d.id,
      };
    });

    exportFromJSON({
      data,
      fileName: "afiliados_actualizados",
      exportType: "xls",
    });
  };

  // Editar
  const openEdit = (row) => {
    const dep = (row.departamento || "").toString().trim();
    setRowId(row.id);
    setInitialForm({
      nombre: row.nombre ?? "",
      apellido: row.apellido ?? "",
      dni: row.dni ?? "",
      email: row.email ?? "",
      celular: row.celular ?? "",
      departamento: dep,
      establecimientos: row.establecimientos ?? "",
      descuento: row.descuento ?? "",
      nroAfiliacion: String(row.nroAfiliacion ?? ""),
      observaciones: row.observaciones ?? "",
      adherente: typeof row.adherente === "boolean" ? row.adherente : false,
      tituloGrado: row.tituloGrado ?? "",
    });
    setEditVisible(true);
  };
  const closeEdit = () => {
    setEditVisible(false);
    setRowId(null);
    setInitialForm(emptyForm);
  };

  const validateDuplicateNroAfiliacion = async (dni, nro, currentId) => {
    const nroNum = Number(nro);
    const dniStr = String(dni || "").trim();
    if (!dniStr || Number.isNaN(nroNum)) return false;
    const ref = fsQuery(
      fsCollection(db, "nuevoAfiliado"),
      where("dni", "==", dniStr),
      where("nroAfiliacion", "==", nroNum)
    );
    const snap = await fsGetDocs(ref);
    return snap.docs.some((d) => d.id !== currentId);
  };

  const handleSaveEdit = async ({ payload, error }) => {
  if (error) {
    return toast.current?.show({
      severity: "error",
      summary: "Error",
      detail: error,
      life: 4000,
    });
  }

  try {
    setSaving(true);

    // (Opcional) Validación N° de afiliación duplicado
    if (payload.nroAfiliacion !== "") {
      const duplicated = await validateDuplicateNroAfiliacion(
        payload.dni,
        payload.nroAfiliacion,
        rowId
      );
      if (duplicated) {
        toast.current?.show({
          severity: "error",
          summary: "Error",
          detail: "El N° de afiliación ya existe para ese DNI.",
          life: 4000,
        });
        setSaving(false);
        return;
      }
    }

    const prevAdherente = !!initialForm.adherente;
    const nextAdherente = !!payload.adherente;
    const dniKey = String(payload.dni || "").trim();

    // --- REGLA QUE PEDISTE ---
    // Si cambia de SÍ -> NO: primero actualizar SOLO 'observaciones' en nuevoAfiliado
    if (prevAdherente && !nextAdherente) {
      await fsUpdateDoc(fsDoc(db, "nuevoAfiliado", String(rowId)), {
        observaciones: payload.observaciones ?? "",
      });
    }

    // Actualizar el doc completo en nuevoAfiliado (mantiene la UI/store en sync)
    const res = await dispatch(updateAfiliadoById({ id: rowId, data: payload }));
    if (res?.meta?.requestStatus === "rejected") {
      throw new Error(res?.payload || "No se pudo actualizar el afiliado.");
    }

    // Alta/limpieza en 'adherentes' según el cambio del switch
    if (!prevAdherente && nextAdherente) {
      // pasó a SÍ: limpiar duplicados por DNI y dejar 1 doc con ID=rowId
      const qDup = fsQuery(fsCollection(db, "adherentes"), where("dni", "==", dniKey));
      const dupSnap = await fsGetDocs(qDup);
      await Promise.all(
        dupSnap.docs.map((d) => (d.id !== String(rowId) ? fsDeleteDoc(d.ref) : Promise.resolve()))
      );

      const espejo = {
        apellido: payload.apellido ?? initialForm.apellido ?? "",
        nombre: payload.nombre ?? initialForm.nombre ?? "",
        dni: dniKey,
        nroAfiliacion:
          payload.nroAfiliacion !== "" && payload.nroAfiliacion != null
            ? Number(payload.nroAfiliacion)
            : null,
        tituloGrado: payload.tituloGrado ?? initialForm.tituloGrado ?? "",
        descuento:
          typeof payload.descuento === "string" ? payload.descuento : (initialForm.descuento ?? ""),
        departamento: payload.departamento ?? initialForm.departamento ?? "",
        establecimientos: payload.establecimientos ?? initialForm.establecimientos ?? "",
        celular: payload.celular ?? initialForm.celular ?? "",
        email: payload.email ?? initialForm.email ?? "",
        estado: typeof initialForm.estado === "boolean" ? initialForm.estado : true,
        observaciones: payload.observaciones ?? initialForm.observaciones ?? "",
        adherente: true,
      };

      await fsSetDoc(fsDoc(db, "adherentes", String(rowId)), espejo, { merge: true });
    }

    if (prevAdherente && !nextAdherente) {
      // pasó a NO: borrar en 'adherentes' por DNI (puede haber docs con otro ID)
      const q = fsQuery(fsCollection(db, "adherentes"), where("dni", "==", dniKey));
      const snap = await fsGetDocs(q);
      if (!snap.empty) {
        await Promise.all(snap.docs.map((d) => fsDeleteDoc(d.ref)));
      }
    }

    showSuccess("Afiliado actualizado correctamente.");
    closeEdit();
  } catch (err) {
    showError(err?.message || "Error al actualizar el afiliado.");
  } finally {
    setSaving(false);
  }
};

  return (
    <div className={styles.container}>
      <Toast ref={toast} />
      <ConfirmDialog />
      <Menu
        model={[
          {
            label: "Ver",
            icon: "pi pi-eye",
            command: () => currentRow && onVerDetalle(currentRow),
          },
          {
            label: "Editar",
            icon: "pi pi-pencil",
            command: () => currentRow && openEdit(currentRow),
          },
          { separator: true },
          {
            label: "Eliminar",
            icon: "pi pi-trash",
            className: "p-menuitem-danger",
            command: () => currentRow && onEliminar(currentRow),
          },
        ]}
        popup
        ref={actionMenuRef}
        id="row_actions_menu"
      />

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
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar por nombre, apellido o DNI…"
                style={{ width: "100%" }}
                disabled={loading}
              />
            </span>
          </div>

          {/* DataTable aislada: NO se re-renderiza al tipear en el modal */}
          <AfiliadosTable
            data={filtered}
            loading={loading}
            page={page}
            hasNext={hasNext}
            onPrev={() => dispatch(fetchAfiliadosPrevPage())}
            onNext={() => dispatch(fetchAfiliadosNextPage())}
            onActionClick={onActionClick}
          />
        </>
      )}

      {/* ----- Modal Detalle (Ver) ----- */}
      <Dialog
        header="Detalle del afiliado"
        visible={showDetail}
        style={{ width: "min(520px, 96vw)" }}
         onHide={() => { setShowDetail(false); setRowDetail(null); }}
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
              {rowDetail.tituloGrado && (
                <div>
                  <b>Título de grado:</b> {rowDetail.tituloGrado}
                </div>
              )}
              <div>
                <b>Descuento:</b> {toSiNo(rowDetail.descuento) || "—"}
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
              {rowDetail.observaciones && (
                <div>
                  <b>Observaciones:</b> {rowDetail.observaciones}
                </div>
              )}
              <div>
                <b>Adherente:</b>{" "}
                {rowDetail.adherente ?? rowDetail.activo ? "Sí" : "No"}
              </div>
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

      {/* ----- Modal Editar (aislado y memorizado) ----- */}
      <EditAfiliadoDialog
        visible={editVisible}
        initialForm={initialForm}
        departamentosOptions={departamentosOptions}
        onCancel={closeEdit}
        onSave={handleSaveEdit}
        saving={saving}
      />
    </div>
  );
};

export default AfiliadoActualizado;
