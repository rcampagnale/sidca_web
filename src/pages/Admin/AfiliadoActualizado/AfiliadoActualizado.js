// src/pages/Admin/AfiliadoActualizado/AfiliadoActualizado.js
import React, {
  useEffect,
  useMemo,
  useRef,
  useState,
  useCallback,
} from "react";
import { useDispatch } from "react-redux";
import { Button } from "primereact/button";
import { ConfirmDialog, confirmDialog } from "primereact/confirmdialog";
import { ProgressSpinner } from "primereact/progressspinner";
import { Toast } from "primereact/toast";
import { Menu } from "primereact/menu";
import { Dialog } from "primereact/dialog";
import { ProgressBar } from "primereact/progressbar";
import exportFromJSON from "export-from-json";

// ✅ Componentes + hook + utils
import {
  AfiliadosTable,
  EditAfiliadoDialog,
  ViewDialog,
  FiltersBar,
  useUsuariosOnce,
  toRow,
  toTimestamp,
  norm,
  departamentosOptionsFrom,
  toSiNo,
} from "../../../components/afiliados";

// ✅ Firestore
import {
  collection as fsCollection,
  query as fsQuery,
  getDocs as fsGetDocs,
  getDoc as fsGetDoc, // 👈 agregado para upsert
  where,
  doc as fsDoc,
  setDoc as fsSetDoc,
  deleteDoc as fsDeleteDoc,
  updateDoc as fsUpdateDoc,
  orderBy as fsOrderBy,
  startAfter as fsStartAfter,
  limit as fsLimit,
  documentId,
} from "firebase/firestore";
import { db } from "../../../firebase/firebase-config.js";

// ✅ Redux thunks SOLO para update/delete (nuevoAfiliado)
import {
  updateAfiliadoById,
  deleteAfiliadoById,
} from "../../../redux/reducers/afiliadoActualizado/slice.js";

// ======================
const PAGE_SIZE = 50;
// ======================

const EMPTY_FORM = {
  nombre: "",
  apellido: "",
  dni: "",
  email: "",
  celular: "",
  departamento: "",
  establecimientos: "",
  descuento: "",
  nroAfiliacion: "",
  observaciones: "",
  adherente: false,
  tituloGrado: "",
  activo: true,
  // 👇 nuevos
  motivo: "",
  cotizante: false,
};

// 🔸 Normaliza descuento a "si"/"no"/""
const normalizeDescuentoInput = (val) => {
  const s = (val ?? "").toString().trim().toLowerCase();
  if (["si", "sí", "true", "1"].includes(s)) return "si";
  if (["no", "false", "0"].includes(s)) return "no";
  return "";
};

// 🔸 Mapeos a filas
const mapUsuarioDocToRow = (d) => {
  const base = { id: d.id, ...d.data() };
  const r = { ...toRow(base), origen: "usuarios" };
  const haystack = norm(
    `${r.apellido} ${r.nombre} ${String(r.dni || "")} ${r.email || ""} ${r.departamento || ""} ${r.motivo || ""}`
  );
  return { ...r, haystack };
};

const mapNuevoDocToRow = (d) => {
  const base = { id: d.id, ...d.data() };
  const row = { ...toRow(base), origen: "nuevoAfiliado" };
  const haystack = norm(
    `${row.apellido} ${row.nombre} ${row.dni} ${row.nroAfiliacion} ${row.email} ${row.departamento} ${row.motivo || ""}`
  );
  return { ...row, haystack };
};

// 🔸 Combinar arrays por id (B sobrescribe A)
const mergeUniqueById = (a, b) => {
  const map = new Map();
  a.forEach((x) => map.set(String(x.id), x));
  b.forEach((x) => map.set(String(x.id), x));
  return Array.from(map.values());
};

// 🔸 Lee TODA una colección en lotes por documentId()
async function fetchAllDocsPaged(collectionName, mapFn, batch = 1000) {
  const out = [];
  let q = fsQuery(
    fsCollection(db, collectionName),
    fsOrderBy(documentId()),
    fsLimit(batch)
  );
  let snap = await fsGetDocs(q);
  while (!snap.empty) {
    snap.docs.forEach((docSnap) => out.push(mapFn(docSnap)));
    const last = snap.docs[snap.docs.length - 1];
    q = fsQuery(
      fsCollection(db, collectionName),
      fsOrderBy(documentId()),
      fsStartAfter(last),
      fsLimit(batch)
    );
    snap = await fsGetDocs(q);
  }
  return out;
}

// 🔸 Unificación por DNI (si está en ambas → 1 fila con origen "ambos")
const unifyByDni = (arrNuevo, arrUsuarios) => {
  const toKey = (dni) => String(dni ?? "").trim();
  const mapN = new Map();
  const mapU = new Map();
  arrNuevo.forEach((r) => mapN.set(toKey(r.dni), r));
  arrUsuarios.forEach((r) => mapU.set(toKey(r.dni), r));

  const allKeys = new Set([...mapN.keys(), ...mapU.keys()]);
  const pick = (a, b) => {
    const s = (a ?? "").toString().trim();
    return s ? a : b;
  };

  const out = [];
  for (const k of allKeys) {
    const nr = mapN.get(k);
    const ur = mapU.get(k);
    if (nr && ur) {
      const merged = {
        id: nr.id || ur.id,     // id visual estable
        idNuevo: nr.id,
        idUsuario: ur.id,
        rowNuevo: nr,
        rowUsuario: ur,
        origen: "ambos",
        nombre: pick(nr.nombre, ur.nombre),
        apellido: pick(nr.apellido, ur.apellido),
        dni: pick(nr.dni, ur.dni),
        email: pick(nr.email, ur.email),
        celular: pick(nr.celular, ur.celular),
        departamento: pick(nr.departamento, ur.departamento),
        establecimientos: pick(nr.establecimientos, ur.establecimientos),
        descuento: pick(nr.descuento, ur.descuento),
        nroAfiliacion: pick(nr.nroAfiliacion, ur.nroAfiliacion),
        observaciones: pick(nr.observaciones, ur.observaciones),
        adherente:
          typeof nr.adherente === "boolean"
            ? nr.adherente
            : (typeof ur.adherente === "boolean" ? ur.adherente : false),
        tituloGrado: pick(nr.tituloGrado, ur.tituloGrado),
        activo:
          typeof nr.activo === "boolean"
            ? nr.activo
            : (typeof ur.activo === "boolean" ? ur.activo : true),
        fecha: pick(nr.fecha, ur.fecha),
        hora: pick(nr.hora, ur.hora),
        cod: pick(nr.cod, ur.cod),
        motivo: pick(nr.motivo, ur.motivo),
        cotizante:
          typeof nr.cotizante === "boolean"
            ? nr.cotizante
            : (typeof ur.cotizante === "boolean" ? ur.cotizante : false),
      };
      merged.haystack = norm(
        `${merged.apellido} ${merged.nombre} ${merged.dni} ${merged.email || ""} ${merged.departamento || ""} ${merged.motivo || ""}`
      );
      out.push(merged);
    } else if (nr) {
      out.push(nr);
    } else if (ur) {
      out.push(ur);
    }
  }
  return out;
};

// 🔸 Sincroniza adherentes (evita duplicados, usa preferredId)
async function syncAdherentesForPayload(dniKey, payload, preferredId) {
  const qDup = fsQuery(fsCollection(db, "adherentes"), where("dni", "==", dniKey));
  const dupSnap = await fsGetDocs(qDup);

  if (payload.adherente) {
    await Promise.all(
      dupSnap.docs.map((d) =>
        d.id !== String(preferredId) ? fsDeleteDoc(d.ref) : Promise.resolve()
      )
    );

    const espejo = {
      apellido: payload.apellido ?? "",
      nombre: payload.nombre ?? "",
      dni: dniKey,
      nroAfiliacion:
        payload.nroAfiliacion !== "" && payload.nroAfiliacion != null
          ? Number(payload.nroAfiliacion)
          : null,
      tituloGrado: payload.tituloGrado ?? "",
      descuento: typeof payload.descuento === "string" ? payload.descuento : "",
      departamento: payload.departamento ?? "",
      establecimientos: payload.establecimientos ?? "",
      celular: payload.celular ?? "",
      email: payload.email ?? "",
      observaciones: payload.observaciones ?? "",
      adherente: true,
      activo: true,
      estado: true,
    };

    await fsSetDoc(fsDoc(db, "adherentes", String(preferredId)), espejo, { merge: true });
  } else {
    if (!dupSnap.empty) {
      await Promise.all(dupSnap.docs.map((d) => fsDeleteDoc(d.ref)));
    }
  }
}

export default function AfiliadoActualizado() {
  const dispatch = useDispatch();
  const toast = useRef(null);
  const actionMenuRef = useRef(null);

  // Estado base
  const [loadingNuevo, setLoadingNuevo] = useState(true);
  const [rowsNuevo, setRowsNuevo] = useState([]);

  const [rowsUsuarios, loadingUsuarios] = useUsuariosOnce({
    orderField: "updatedAt",
    pageSize: 5000,
  });

  const [rowsUsuariosLocal, setRowsUsuariosLocal] = useState([]);
  useEffect(() => setRowsUsuariosLocal(rowsUsuarios || []), [rowsUsuarios]);

  const [extraUsuariosRows, setExtraUsuariosRows] = useState([]);
  const [dniFetchLoading, setDniFetchLoading] = useState(false);

  const [source, setSource] = useState("ambos");
  const [searchInput, setSearchInput] = useState("");
  const [query, setQuery] = useState("");

  const [page, setPage] = useState(1);

  const [showDetail, setShowDetail] = useState(false);
  const [rowDetail, setRowDetail] = useState(null);

  const [editVisible, setEditVisible] = useState(false);
  const [saving, setSaving] = useState(false);
  const [rowId, setRowId] = useState(null);                 // para edición simple
  const [rowIdBoth, setRowIdBoth] = useState({ nuevo: null, usuario: null }); // para edición ambas
  const [initialForm, setInitialForm] = useState(EMPTY_FORM);
  const [editOrigin, setEditOrigin] = useState("nuevoAfiliado");

  const [currentRow, setCurrentRow] = useState(null);

  // Export bloqueante
  const [exporting, setExporting] = useState(false);
  const [exportModal, setExportModal] = useState(false);
  const [exportMsg, setExportMsg] = useState("Preparando…");

  const showSuccess = (msg) =>
    toast.current?.show({ severity: "success", summary: "OK", detail: msg, life: 3000 });
  const showError = (msg) =>
    toast.current?.show({ severity: "error", summary: "Error", detail: msg, life: 4000 });

  // 1) Cargar nuevoAfiliado (una vez)
  const fetchAllNuevoAfiliado = useCallback(async () => {
    try {
      setLoadingNuevo(true);
      const ref = fsCollection(db, "nuevoAfiliado");
      const snap = await fsGetDocs(ref);
      setRowsNuevo(snap.docs.map(mapNuevoDocToRow));
    } catch (e) {
      showError(e?.message || "No se pudo leer nuevoAfiliado");
    } finally {
      setLoadingNuevo(false);
    }
  }, []);

  useEffect(() => { fetchAllNuevoAfiliado(); }, [fetchAllNuevoAfiliado]);

  // 2) Consulta puntual en usuarios por DNI
  const fetchUsuariosByDniIfNeeded = useCallback(async (term) => {
    const onlyDigits = /^\d{3,}$/.test((term || "").trim());
    setExtraUsuariosRows([]);
    if (!onlyDigits) return;
    try {
      setDniFetchLoading(true);
      const results = [];
      const qStr = fsQuery(fsCollection(db, "usuarios"), where("dni", "==", String(term).trim()));
      const snapStr = await fsGetDocs(qStr);
      snapStr.forEach((d) => results.push(mapUsuarioDocToRow(d)));
      const dniNum = Number(term);
      if (!Number.isNaN(dniNum)) {
        const qNum = fsQuery(fsCollection(db, "usuarios"), where("dni", "==", dniNum));
        const snapNum = await fsGetDocs(qNum);
        snapNum.forEach((d) => results.push(mapUsuarioDocToRow(d)));
      }
      setExtraUsuariosRows(mergeUniqueById([], results));
    } finally {
      setDniFetchLoading(false);
    }
  }, []);

  // 3) Combinar / ordenar (unificando por DNI cuando source=ambos)
  const rowsUsuariosMerged = useMemo(
    () => mergeUniqueById(rowsUsuariosLocal, extraUsuariosRows),
    [rowsUsuariosLocal, extraUsuariosRows]
  );

  const combinedRows = useMemo(() => {
    let arr = [];
    if (source === "nuevoAfiliado") arr = rowsNuevo;
    else if (source === "usuarios") arr = rowsUsuariosMerged;
    else arr = unifyByDni(rowsNuevo, rowsUsuariosMerged);

    return [...arr].sort((a, b) => {
      const sa = a.hora ? `${a.fecha} ${a.hora}` : a.fecha || "";
      const sb = b.hora ? `${b.fecha} ${b.hora}` : b.fecha || "";
      return toTimestamp(sb) - toTimestamp(sa);
    });
  }, [rowsNuevo, rowsUsuariosMerged, source]);

  // 4) Filtro local por texto
  const filteredRows = useMemo(() => {
    const qn = norm(query);
    if (!qn) return combinedRows;
    return combinedRows.filter((r) => r.haystack.includes(qn));
  }, [combinedRows, query]);

  // Reset de página
  useEffect(() => setPage(1), [source, query, rowsNuevo.length, rowsUsuariosMerged.length]);

  // 5) Paginación
  const countNuevo = rowsNuevo.length;
  const countUsuarios = rowsUsuariosMerged.length;
  const totalFiltered = filteredRows.length;
  const lastPage = Math.max(1, Math.ceil(totalFiltered / PAGE_SIZE));
  const pageRows = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    const end = start + PAGE_SIZE;
    return filteredRows.slice(start, end);
  }, [filteredRows, page]);
  const hasNext = page < lastPage;
  const hasPrev = page > 1;
  const loading = loadingNuevo || loadingUsuarios;

  // 6) Buscar / Limpiar
  const doSearch = async () => {
    const term = (searchInput || "").trim();
    await fetchUsuariosByDniIfNeeded(term);
    setQuery(term);
  };
  const onSearch = () => { void doSearch(); };
  const onClear = () => {
    setSearchInput("");
    setQuery("");
    setPage(1);
    setExtraUsuariosRows([]);
    setDniFetchLoading(false);
  };
  const onKeyDown = (e) => { if (e.key === "Enter") onSearch(); };

  // 7) Acciones
  const onActionClick = useCallback((e, row) => {
    setCurrentRow(row);
    actionMenuRef.current?.toggle(e);
  }, []);

  const onVerDetalle = (row) => {
    if (!row) return;
    setRowDetail(row); // para "ambos" muestra la unificada
    actionMenuRef.current?.hide?.();
    setShowDetail(true);
  };

  const onEliminar = (row) => {
    if (!row) return;
    confirmDialog({
      message: `¿Eliminar el registro de ${row.apellido}, ${row.nombre} (DNI ${row.dni})?`,
      header: "Confirmar eliminación",
      icon: "pi pi-exclamation-triangle",
      acceptLabel: "Sí, eliminar",
      rejectLabel: "Cancelar",
      acceptClassName: "p-button-danger",
      accept: async () => {
        try {
          if (row.origen === "nuevoAfiliado") {
            const res = await dispatch(deleteAfiliadoById(row.id));
            if (res?.meta?.requestStatus === "rejected") {
              throw new Error(res?.payload || "No se pudo eliminar");
            }
            setRowsNuevo((prev) => prev.filter((x) => x.id !== row.id));
          } else {
            await fsDeleteDoc(fsDoc(db, "usuarios", String(row.id)));
            setRowsUsuariosLocal((prev) => prev.filter((x) => x.id !== row.id));
            setExtraUsuariosRows((prev) => prev.filter((x) => x.id !== row.id));
          }
          showSuccess("Eliminado correctamente");
        } catch (e) {
          showError(e?.message || "Error al eliminar");
        }
      },
    });
  };

  // 🔹 NUEVO: eliminar en ambas
  const onEliminarAmbos = (row) => {
    if (!row) return;
    confirmDialog({
      message: `¿Eliminar en ambas colecciones a ${row.apellido}, ${row.nombre} (DNI ${row.dni})?`,
      header: "Confirmar eliminación",
      icon: "pi pi-exclamation-triangle",
      acceptLabel: "Sí, eliminar en ambas",
      rejectLabel: "Cancelar",
      acceptClassName: "p-button-danger",
      accept: async () => {
        try {
          if (row.idNuevo) {
            const res = await dispatch(deleteAfiliadoById(row.idNuevo));
            if (res?.meta?.requestStatus === "rejected") {
              throw new Error(res?.payload || "No se pudo eliminar en nuevoAfiliado");
            }
            setRowsNuevo((prev) => prev.filter((x) => x.id !== row.idNuevo));
          }
          if (row.idUsuario) {
            await fsDeleteDoc(fsDoc(db, "usuarios", String(row.idUsuario)));
            setRowsUsuariosLocal((prev) => prev.filter((x) => x.id !== row.idUsuario));
            setExtraUsuariosRows((prev) => prev.filter((x) => x.id !== row.idUsuario));
          }
          showSuccess("Eliminado en ambas colecciones.");
        } catch (e) {
          showError(e?.message || "Error al eliminar en ambas colecciones");
        }
      },
    });
  };

  const openEdit = (row) => {
    setRowId(row.id);
    setEditOrigin(row.origen === "usuarios" ? "usuarios" : "nuevoAfiliado");
    setInitialForm({
      nombre: row.nombre ?? "",
      apellido: row.apellido ?? "",
      dni: row.dni ?? "",
      email: row.email ?? "",
      celular: row.celular ?? "",
      departamento: (row.departamento || "").toString().trim(),
      establecimientos: row.establecimientos ?? "",
      descuento: row.descuento ?? "",
      nroAfiliacion: String(row.nroAfiliacion ?? ""),
      observaciones: row.observaciones ?? "",
      adherente: typeof row.adherente === "boolean" ? row.adherente : false,
      tituloGrado: row.tituloGrado ?? "",
      activo: typeof row.activo === "boolean" ? row.activo : true,
      // nuevos
      motivo: row.motivo ?? "",
      cotizante: typeof row.cotizante === "boolean" ? row.cotizante : false,
    });
    setEditVisible(true);
  };

  // 🔹 NUEVO: editar ambas colecciones
  const openEditBoth = (row) => {
    setRowIdBoth({ nuevo: row.idNuevo, usuario: row.idUsuario });
    setEditOrigin("ambas");
    setInitialForm({
      nombre: row.nombre ?? "",
      apellido: row.apellido ?? "",
      dni: row.dni ?? "",
      email: row.email ?? "",
      celular: row.celular ?? "",
      departamento: (row.departamento || "").toString().trim(),
      establecimientos: row.establecimientos ?? "",
      descuento: row.descuento ?? "",
      nroAfiliacion: String(row.nroAfiliacion ?? ""),
      observaciones: row.observaciones ?? "",
      adherente: typeof row.adherente === "boolean" ? row.adherente : false,
      tituloGrado: row.tituloGrado ?? "",
      activo: typeof row.activo === "boolean" ? row.activo : true,
      // nuevos
      motivo: row.motivo ?? "",
      cotizante: typeof row.cotizante === "boolean" ? row.cotizante : false,
    });
    setEditVisible(true);
  };

  // Menú dinámico (unificado cuando origen=ambos)
  const menuModel = useMemo(() => {
    if (!currentRow) return [];
    if (currentRow.origen === "ambos") {
      return [
        { label: "Ver", icon: "pi pi-eye", command: () => onVerDetalle(currentRow) },
        { label: "Editar (ambas)", icon: "pi pi-pencil", command: () => openEditBoth(currentRow) },
        { separator: true },
        { label: "Eliminar (ambas)", icon: "pi pi-trash", className: "p-menuitem-danger", command: () => onEliminarAmbos(currentRow) },
      ];
    }
    return [
      { label: "Ver", icon: "pi pi-eye", command: () => onVerDetalle(currentRow) },
      { label: "Editar", icon: "pi pi-pencil", command: () => openEdit(currentRow) },
      { separator: true },
      { label: "Eliminar", icon: "pi pi-trash", className: "p-menuitem-danger", command: () => onEliminar(currentRow) },
    ];
  }, [currentRow]);

  // 8) Exportar TODO (bloqueando con barra de progreso) — UNIFICADO POR DNI
const handleExportExcel = async () => {
  try {
    setExporting(true);
    setExportModal(true);
    setExportMsg("Leyendo colección nuevoAfiliado…");

    // Traemos TODAS las filas de ambas colecciones
    const allNuevoPromise = fetchAllDocsPaged("nuevoAfiliado", mapNuevoDocToRow, 1000);
    const allUsuariosPromise = (async () => {
      const allNuevo = await allNuevoPromise;
      setExportMsg("Leyendo colección usuarios…");
      const allUsuarios = await fetchAllDocsPaged("usuarios", mapUsuarioDocToRow, 1000);
      return { allNuevo, allUsuarios };
    })();

    const { allNuevo, allUsuarios } = await allUsuariosPromise;

    // 🔸 Unificamos por DNI igual que en pantalla (origen => "ambos" si corresponde)
    setExportMsg("Unificando registros por DNI…");
    const unified = unifyByDni(allNuevo, allUsuarios);

    // Ordenamos por fecha/hora desc, y aplicamos (si hay) el filtro de búsqueda
    setExportMsg("Preparando datos…");
    const sorted = [...unified].sort((a, b) => {
      const sa = a.hora ? `${a.fecha} ${a.hora}` : a.fecha || "";
      const sb = b.hora ? `${b.fecha} ${b.hora}` : b.fecha || "";
      return toTimestamp(sb) - toTimestamp(sa);
    });

    const qn = norm(query);
    const dataset = qn ? sorted.filter((r) => r.haystack.includes(qn)) : sorted;

    // Mapeo a columnas del Excel
    setExportMsg("Generando Excel…");
    const data = dataset.map((d) => ({
      Fecha: d.fecha || "",
      Hora: d.hora || "",
      Nombre: d.nombre || "",
      Apellido: d.apellido || "",
      DNI: d.dni || "",
      Afiliación: d.nroAfiliacion ? Number(d.nroAfiliacion) : "",
      Departamento: d.departamento || "",
      Establecimientos: d.establecimientos || "",
      Celular: d.celular || "",
      Email: d.email || "",
      "Título de grado (nombre de la carrera)": d.tituloGrado || "",
      Descuento: toSiNo(d.descuento) || "",
      Código: d.cod ?? "",
      Origen: d.origen,                // "nuevoAfiliado" | "usuarios" | "ambos"
      ID: d.id,                        // id visual (si es "ambos" es el de nuevo/usuario según merge)
    }));

    const fileName = qn
      ? "afiliados_usuarios_resultado_unificado"
      : "afiliados_usuarios_base_unificada";

    exportFromJSON({ data, fileName, exportType: "xls" });
    showSuccess("Excel generado (unificado por DNI).");
  } catch (e) {
    console.error(e);
    showError(e?.message || "No se pudo generar el Excel unificado.");
  } finally {
    setExporting(false);
    setExportModal(false);
    setExportMsg("Preparando…");
  }
};


  // 9) Guardar edición (soporta: nuevoAfiliado | usuarios | ambas)
  const closeEdit = () => {
    setEditVisible(false);
    setRowId(null);
    setRowIdBoth({ nuevo: null, usuario: null });
    setInitialForm(EMPTY_FORM);
    setEditOrigin("nuevoAfiliado");
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
      return toast.current?.show({ severity: "error", summary: "Error", detail: error, life: 4000 });
    }

    try {
      setSaving(true);

      // 🔹 NUEVO: edición unificada
      if (editOrigin === "ambas") {
        const idN = rowIdBoth.nuevo;
        const idU = rowIdBoth.usuario;

        if (payload.nroAfiliacion !== "" && idN) {
          const duplicated = await validateDuplicateNroAfiliacion(payload.dni, payload.nroAfiliacion, idN);
          if (duplicated) {
            toast.current?.show({ severity: "error", summary: "Error", detail: "El N° de afiliación ya existe para ese DNI.", life: 4000 });
            setSaving(false);
            return;
          }
        }

        // nuevoAfiliado
        if (idN) {
          const res = await dispatch(updateAfiliadoById({ id: idN, data: payload }));
          if (res?.meta?.requestStatus === "rejected") throw new Error(res?.payload || "No se pudo actualizar nuevoAfiliado.");
          setRowsNuevo((prev) => prev.map((r) => (r.id === idN ? { ...r, ...payload } : r)));
        }

        // usuarios (upsert seguro)
        const payloadUsuarios = {
          nombre: payload.nombre ?? "",
          apellido: payload.apellido ?? "",
          dni: payload.dni ?? "",
          email: payload.email ?? "",
          celular: payload.celular ?? "",
          departamento: payload.departamento ?? "",
          establecimientos: payload.establecimientos ?? "",
          tituloGrado: payload.tituloGrado ?? "",
          observaciones: payload.observaciones ?? "",
          adherente: !!payload.adherente,
          descuento: normalizeDescuentoInput(payload.descuento),
          activo: typeof payload.activo === "boolean" ? payload.activo : true,
          motivo: payload.motivo ?? "",
          cotizante: !!payload.cotizante,
        };

        if (idU) {
          const ref = fsDoc(db, "usuarios", String(idU));
          const snap = await fsGetDoc(ref);
          if (snap.exists()) {
            await fsUpdateDoc(ref, payloadUsuarios);
          } else {
            await fsSetDoc(ref, payloadUsuarios, { merge: true });
          }
          setRowsUsuariosLocal((prev) => prev.map((r) => (r.id === idU ? { ...r, ...payloadUsuarios } : r)));
          setExtraUsuariosRows((prev) => prev.map((r) => (r.id === idU ? { ...r, ...payloadUsuarios } : r)));
        } else {
          // sin idUsuario: usamos DNI como ID
          const altId = String(payload.dni).trim();
          const refAlt = fsDoc(db, "usuarios", altId);
          await fsSetDoc(refAlt, payloadUsuarios, { merge: true });
          // reflejo en UI (si estuviera presente)
          setRowsUsuariosLocal((prev) => prev.map((r) => (r.id === altId ? { ...r, ...payloadUsuarios } : r)));
          setExtraUsuariosRows((prev) => prev.map((r) => (r.id === altId ? { ...r, ...payloadUsuarios } : r)));
        }

        // adherentes (preferimos idNuevo si existe; sino idUsuario o altId por DNI)
        const dniKey = String(payload.dni || "").trim();
        await syncAdherentesForPayload(dniKey, payload, idN || rowIdBoth.usuario || dniKey);

        showSuccess("Registro actualizado en ambas colecciones.");
        closeEdit();
        return;
      }

      // ====== nuevoAfiliado ======
      if (editOrigin === "nuevoAfiliado") {
        if (payload.nroAfiliacion !== "") {
          const duplicated = await validateDuplicateNroAfiliacion(payload.dni, payload.nroAfiliacion, rowId);
          if (duplicated) {
            toast.current?.show({ severity: "error", summary: "Error", detail: "El N° de afiliación ya existe para ese DNI.", life: 4000 });
            setSaving(false);
            return;
          }
        }

        const res = await dispatch(updateAfiliadoById({ id: rowId, data: payload }));
        if (res?.meta?.requestStatus === "rejected") {
          throw new Error(res?.payload || "No se pudo actualizar el afiliado.");
        }

        setRowsNuevo((prevArr) => prevArr.map((r) => (r.id === rowId ? { ...r, ...payload } : r)));

        const prevAdherente = initialForm.adherente === true;
        const nextAdherente = !!payload.adherente;
        const prevActivo = typeof initialForm.activo === "boolean" ? initialForm.activo : true;
        const nextActivo = typeof payload.activo === "boolean" ? payload.activo : true;
        const dniKey = String(payload.dni || "").trim();

        if (prevAdherente && !nextAdherente) {
          await fsUpdateDoc(fsDoc(db, "nuevoAfiliado", String(rowId)), {
            observaciones: payload.observaciones ?? "",
          });
        }

        if (!nextAdherente || !nextActivo) {
          const q = fsQuery(fsCollection(db, "adherentes"), where("dni", "==", dniKey));
          const snap = await fsGetDocs(q);
          if (!snap.empty) await Promise.all(snap.docs.map((d) => fsDeleteDoc(d.ref)));
        } else {
          await syncAdherentesForPayload(dniKey, payload, rowId);
        }
      } else {
        // ====== USUARIOS ======
        const ref = fsDoc(db, "usuarios", String(rowId));
        const payloadUsuarios = {
          nombre: payload.nombre ?? "",
          apellido: payload.apellido ?? "",
          dni: payload.dni ?? "",
          email: payload.email ?? "",
          celular: payload.celular ?? "",
          departamento: payload.departamento ?? "",
          establecimientos: payload.establecimientos ?? "",
          tituloGrado: payload.tituloGrado ?? "",
          observaciones: payload.observaciones ?? "",
          adherente: !!payload.adherente,
          descuento: normalizeDescuentoInput(payload.descuento),
          activo: typeof payload.activo === "boolean" ? payload.activo : true,
          motivo: payload.motivo ?? "",
          cotizante: !!payload.cotizante,
        };
        await fsUpdateDoc(ref, payloadUsuarios);

        const dniKey = String(payload.dni || "").trim();
        await syncAdherentesForPayload(dniKey, payload, rowId); // usa rowId de usuarios si no hay nuevoAfiliado

        setRowsUsuariosLocal((prev) => prev.map((r) => (r.id === rowId ? { ...r, ...payloadUsuarios } : r)));
        setExtraUsuariosRows((prev) => prev.map((r) => (r.id === rowId ? { ...r, ...payloadUsuarios } : r)));
      }

      showSuccess("Registro actualizado correctamente.");
      closeEdit();
    } catch (err) {
      showError(err?.message || "Error al actualizar el registro.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ display: "grid", gap: 12 }}>
      <Toast ref={toast} />
      <ConfirmDialog />
      <Menu model={menuModel} popup ref={actionMenuRef} id="row_actions_menu" />

      {/* Header + contadores + export */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
        <h3 style={{ margin: 0 }}>Afiliado Actualizado</h3>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <span className="p-tag p-tag-info">nuevoAfiliado: {countNuevo}</span>
          <span className="p-tag p-tag-secondary">usuarios: {countUsuarios}</span>
          <span className="p-tag">mostrando: {pageRows.length} / {totalFiltered}</span>
          <Button
            label={exporting ? "Preparando Excel..." : "Descargar Lista (Base/resultado completo)"}
            icon={exporting ? "pi pi-spin pi-spinner" : "pi pi-download"}
            className="p-button-success p-button-sm"
            onClick={handleExportExcel}
            disabled={loading || exporting || totalFiltered === 0}
          />
        </div>
      </div>

      {/* Filtros */}
      <FiltersBar
        searchInput={searchInput}
        setSearchInput={setSearchInput}
        onSearch={onSearch}
        onClear={onClear}
        onKeyDown={onKeyDown}
        disabled={loading}
        isPending={dniFetchLoading}
        source={source}
        onSourceChange={setSource}
      />

      {/* Tabla */}
      {loading ? (
        <div style={{ padding: 48, minHeight: 240, display: "grid", placeItems: "center" }}>
          <ProgressSpinner />
        </div>
      ) : (
        <AfiliadosTable
          data={pageRows}
          loading={false}
          isPending={dniFetchLoading}
          page={page}
          hasNext={hasNext}
          onPrev={hasPrev ? () => setPage(page - 1) : () => {}}
          onNext={hasNext ? () => setPage(page + 1) : () => {}}
          onActionClick={(e, row) => {
            setCurrentRow(row);
            actionMenuRef.current?.toggle(e);
          }}
        />
      )}

      {/* Modales */}
      <ViewDialog
        visible={showDetail}
        data={rowDetail}
        onClose={() => { setShowDetail(false); setRowDetail(null); }}
      />

      <EditAfiliadoDialog
        visible={editVisible}
        initialForm={initialForm}
        departamentosOptions={departamentosOptionsFrom(combinedRows)}
        onCancel={closeEdit}
        onSave={handleSaveEdit}
        saving={saving}
        showActivo={false}
      />

      {/* Modal bloqueante de progreso (export) */}
      <Dialog header="Exportando Excel" visible={exportModal} modal closable={false} blockScroll style={{ width: 480, maxWidth: "90vw" }} contentStyle={{ paddingTop: 8 }}>
        <div style={{ display: "grid", gap: 12 }}>
          <div style={{ fontSize: 14 }}>{exportMsg}</div>
          <ProgressBar mode="indeterminate" style={{ height: 6 }} />
          <div style={{ fontSize: 12, opacity: 0.8 }}>Esto puede tardar unos segundos. No cierres esta ventana.</div>
        </div>
      </Dialog>
    </div>
  );
}


