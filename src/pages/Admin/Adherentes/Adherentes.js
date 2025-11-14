// src/pages/Admin/Adherentes/Adherentes.js
import React, { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "primereact/button";
import { Dialog } from "primereact/dialog";
import { Toast } from "primereact/toast";
import { InputText } from "primereact/inputtext";
import { Dropdown } from "primereact/dropdown";
import { InputTextarea } from "primereact/inputtextarea";
import { Tag } from "primereact/tag";
import { DataTable } from "primereact/datatable";
import { Column } from "primereact/column";
import { Toolbar } from "primereact/toolbar";
import { ConfirmDialog, confirmDialog } from "primereact/confirmdialog";
import { ProgressBar } from "primereact/progressbar";
import exportFromJSON from "export-from-json";
import * as XLSX from "xlsx";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  query,
  updateDoc,
  where,
  getDocs,
  limit,
} from "firebase/firestore";
import { db } from "../../../firebase/firebase-config";
import styles from "./Adherente.module.css";

// ===== Colecciones =====
const ADHERENTES_COLLECTION = "adherentes";
const USUARIOS_COLLECTION = "usuarios";

// ===== Opciones de departamento =====
const DEPARTAMENTOS = [
  "Ambato","Ancasti","Andalgalá","Antofagasta de la Sierra","Belén","Capayán","Capital",
  "El Alto","Fray Mamerto Esquiú","La Paz","Paclín","Pomán","Santa María","Santa Rosa",
  "Tinogasta","Valle Viejo",
].map((d) => ({ label: d, value: d }));

// ===== Utils =====
const normalize = (t) =>
  (t ?? "").toString().trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
const normalizeText = (t) => normalize(t);
const normalizeDni = (v) => String(v ?? "").replace(/\D+/g, "").trim();

const toSiNo = (v) =>
  typeof v === "boolean" ? (v ? "Sí" : "No")
  : ["si","sí","true","1"].includes(normalize(String(v ?? ""))) ? "Sí"
  : ["no","false","0"].includes(normalize(String(v ?? ""))) ? "No" : "—";

const afiliacionLabel = (n) => {
  const num = Number(n);
  if (!Number.isFinite(num) || num <= 0) return "Sin dato";
  return num === 1 ? "1ª afiliación" : `${num}ª reafiliación`;
};

// ===== Normalización de Departamento =====
const depKey = (s) => normalize(String(s || "").replace(/[_-]+/g, " ").replace(/\s+/g, " "));
const toTitle = (s) =>
  (s || "").toString().toLowerCase().replace(/[_-]+/g, " ").replace(/\s+/g, " ")
  .replace(/\b\p{L}/gu, (m) => m.toUpperCase()).trim();
const DEP_MAP = new Map(DEPARTAMENTOS.map((o) => [depKey(o.value || o.label), o.value || o.label]));
const toCanonicalDepartamento = (v) => {
  if (!v) return "";
  const key = depKey(v);
  return DEP_MAP.get(key) || toTitle(String(v));
};

// ✅ “sí” genérico
const parseYes = (v) => {
  const s = normalize(String(v ?? ""));
  return ["1","true","si","sí","x","ok","marcar","habilitar"].includes(s);
};

// ✅ Estado Excel → boolean
const parseEstadoExcel = (v) => {
  const s = normalize(String(v ?? ""));
  if (!s) return null;
  if (["habilitado","habilitada","activo","activa","si","sí","true","1"].some((x) => s.startsWith(x))) return true;
  if (["nohabilitado","nohabilitada","deshabilitado","deshabilitada","inactivo","inactiva","no","false","0"].some((x) => s.startsWith(x))) return false;
  return null;
};

// Map headers de Excel → claves internas
const headerKey = (h) => {
  const s = normalize(h).replace(/[^\w]/g, "");
  const map = {
    apellido: "apellido",
    apellidos: "apellido",
    nombre: "nombre",
    nombres: "nombre",
    dni: "dni",
    documento: "dni",
    departament: "departamento",
    departamento: "departamento",
    establecimiento: "establecimientos",
    establecimientos: "establecimientos",
    celular: "celular",
    telefono: "celular",
    tel: "celular",
    email: "email",
    observaciones: "observaciones",
    observacion: "observaciones",
    // ---- TÍTULO DE GRADO ----
    titulogrado: "tituloGrado",
    titulo: "tituloGrado",
    titulodegradonombredelacarrera: "tituloGrado",
    nroafiliacion: "nroAfiliacion",
    afiliacion: "nroAfiliacion",
    descuento: "descuento",
    // ✅ SI / adherente / habilitar
    si: "adherenteExcel",
    adherente: "adherenteExcel",
    habilitar: "adherenteExcel",
    // 🆕 motivo
    motivo: "motivo",
    razon: "motivo",
    razonmotivo: "motivo",
    // Estado en Excel
    estado: "estadoExcel",
    status: "estadoExcel",
  };
  if (map[s]) return map[s];
  if (s.includes("titulodegrado") || s.includes("titulogrado")) return "tituloGrado";
  return null;
};

// ========= Helpers NUEVOAFILIADO =========
const findNuevoAfiliadoDocs = async (dni, nroAfiliacion) => {
  let targets = [];
  if (dni) {
    if (nroAfiliacion !== null && nroAfiliacion !== undefined && nroAfiliacion !== "") {
      const qNum = query(
        collection(db, "nuevoAfiliado"),
        where("dni", "==", String(dni).trim()),
        where("nroAfiliacion", "==", Number(nroAfiliacion))
      );
      const sNum = await getDocs(qNum);
      targets = sNum.docs;
      if (targets.length === 0) {
        const qStr = query(
          collection(db, "nuevoAfiliado"),
          where("dni", "==", String(dni).trim()),
          where("nroAfiliacion", "==", String(nroAfiliacion))
        );
        const sStr = await getDocs(qStr);
        targets = sStr.docs;
      }
    }
    if (targets.length === 0) {
      const qDni = query(collection(db, "nuevoAfiliado"), where("dni", "==", String(dni).trim()));
      const sDni = await getDocs(qDni);
      targets = sDni.docs;
    }
  }
  return targets;
};

const getActivoFromNuevo = async (dni, nroAfiliacion) => {
  const docs = await findNuevoAfiliadoDocs(dni, nroAfiliacion);
  if (docs.length > 0) {
    for (const d of docs) {
      const v = d.data()?.activo;
      if (typeof v === "boolean") return v;
    }
  }
  const uDocs = await findUsuariosDocs(dni);
  if (uDocs.length > 0) {
    for (const d of uDocs) {
      const v = d.data()?.activo;
      if (typeof v === "boolean") return v;
    }
  }
  return undefined;
};

// ========= Helpers USUARIOS =========
const FIELDS_USUARIOS = new Set([
  "apellido","nombre","dni","nroAfiliacion","tituloGrado","descuento",
  "departamento","establecimientos","celular","email","observaciones",
  "adherente","cotizante","activo","motivo",
]);
const pickUsuarios = (obj = {}) => {
  const out = {};
  for (const k of Object.keys(obj)) if (FIELDS_USUARIOS.has(k)) out[k] = obj[k];
  return out;
};
const findUsuariosDocs = async (dniInput) => {
  const dni = normalizeDni(dniInput);
  if (!dni) return [];
  const qRef = query(collection(db, USUARIOS_COLLECTION), where("dni", "==", dni));
  const snap = await getDocs(qRef);
  return snap.docs;
};
const upsertUsuarioByDni = async (payload, { mirrorCreate = true } = {}) => {
  const dni = normalizeDni(payload?.dni);
  if (!dni) throw new Error("DNI obligatorio (usuarios).");
  const data = pickUsuarios({ ...payload, dni, departamento: toCanonicalDepartamento(payload?.departamento) });
  const docs = await findUsuariosDocs(dni);
  if (docs.length > 0) {
    await Promise.all(docs.map((d) => updateDoc(d.ref, data)));
    return { op: "updated", count: docs.length };
  } else if (mirrorCreate) {
    await addDoc(collection(db, USUARIOS_COLLECTION), data);
    return { op: "created", count: 1 };
  }
  return { op: "not_found", count: 0 };
};
const patchUsuarioByDni = async (dniInput, patch, { mirrorCreate = true } = {}) => {
  const dni = normalizeDni(dniInput);
  if (!dni) throw new Error("DNI obligatorio (usuarios).");
  const data = pickUsuarios(patch || {});
  if (!Object.keys(data).length) return { op: "noop" };
  const docs = await findUsuariosDocs(dni);
  if (docs.length > 0) {
    await Promise.all(docs.map((d) => updateDoc(d.ref, data)));
    return { op: "updated", count: docs.length };
  } else if (mirrorCreate) {
    await addDoc(collection(db, USUARIOS_COLLECTION), { dni, ...data });
    return { op: "created", count: 1 };
  }
  return { op: "not_found", count: 0 };
};

export default function Adherente() {
  const toast = useRef(null);
  const fileInputRef = useRef(null);

  // Base
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);

  // Filtros
  const [busqueda, setBusqueda] = useState("");
  const [deptoSeleccionado, setDeptoSeleccionado] = useState(null);
  const [deptoAplicado, setDeptoAplicado] = useState(null);

  // Filtro Estado
  const [estadoSeleccionado, setEstadoSeleccionado] = useState(null);
  const [estadoAplicado, setEstadoAplicado] = useState(null);

  // Paginación
  const [first, setFirst] = useState(0);

  // Modal alta/edición
  const [visibleDialog, setVisibleDialog] = useState(false);
  const [editandoId, setEditandoId] = useState(null);
  const [saving, setSaving] = useState(false);

  // ⏳ Importando Excel
  const [importing, setImporting] = useState(false);
  const [importPercent, setImportPercent] = useState(0);
  const [importStage, setImportStage] = useState("Listo para importar");

  // 🧾 Resumen de importación (modal que NO se cierra solo)
  const [summaryVisible, setSummaryVisible] = useState(false);
  const [summaryRows, setSummaryRows] = useState([]);
  const [summaryCounts, setSummaryCounts] = useState({
    inserted: 0, updated: 0, skipped: 0,
  });

  const [form, setForm] = useState({
    apellido: "", nombre: "", dni: "", nroAfiliacion: "",
    tituloGrado: "", descuento: "", departamento: "",
    establecimientos: "", celular: "", email: "",
    observaciones: "", adherente: true, motivo: "",
  });

  // Modal Ver
  const [visibleVer, setVisibleVer] = useState(false);
  const [rowVer, setRowVer] = useState(null);

  // ====== Modal Cotizante ======
  const [cotzVisible, setCotzVisible] = useState(false);
  const [cotzRow, setCotzRow] = useState(null);
  const [cotzObs, setCotzObs] = useState("");
  const [cotzSaving, setCotzSaving] = useState(false);

  // ===== Suscripción a Adherentes + join con nuevoAfiliado.activo =====
  useEffect(() => {
    setLoading(true);
    const base = collection(db, ADHERENTES_COLLECTION);
    const qRef = deptoAplicado ? query(base, where("departamento", "==", deptoAplicado)) : base;

    const unsub = onSnapshot(
      qRef,
      async (snap) => {
        try {
          const baseRows = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
          const enriched = await Promise.all(
            baseRows.map(async (r) => {
              const activo = await getActivoFromNuevo(r.dni, r.nroAfiliacion ?? null);
              return { ...r, estadoFromNuevo: (typeof activo === "boolean" ? activo : undefined) };
            })
          );
          setRows(enriched);
          setLoading(false);
        } catch (e) {
          console.error("join nuevoAfiliado.activo:", e);
          setRows(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
          setLoading(false);
        }
      },
      (err) => {
        console.error("onSnapshot adherentes:", err);
        toast.current?.show({ severity: "error", summary: "Error", detail: "No se pudo leer la información." });
        setLoading(false);
      }
    );
    return () => unsub();
  }, [deptoAplicado]);

  useEffect(() => setFirst(0), [deptoAplicado, estadoAplicado]);

  const estadoUI = (r) => (typeof r?.estadoFromNuevo === "boolean" ? r.estadoFromNuevo : false);

  // ===== Búsqueda + filtro Estado =====
  const dataFiltrada = useMemo(() => {
    const s = normalizeText(busqueda).trim();
    let base = [...rows];
    if (estadoAplicado !== null) base = base.filter((r) => estadoUI(r) === estadoAplicado);
    if (!s) return base;

    return base.filter((r) => {
      const establecimiento = r.establecimientos || r.establecimiento || "";
      const estadoTxt = estadoUI(r) ? "habilitado" : "no habilitado";
      const txt = normalizeText(
        `${r.apellido||""} ${r.nombre||""} ${r.dni||""} ${r.departamento||""} ${establecimiento} ${r.celular||""} ${r.email||""} ${estadoTxt} ${r.observaciones||""} ${r.tituloGrado||""} ${r.descuento||""} ${r.nroAfiliacion||""} ${r.motivo||""}`
      );
      return txt.includes(s);
    });
  }, [rows, busqueda, estadoAplicado]);

  // ===== Exportar Excel =====
  const handleExportExcel = () => {
    const data = dataFiltrada.map((r) => ({
      Apellido: r.apellido || "", Nombre: r.nombre || "", DNI: r.dni || "",
      Afiliación: afiliacionLabel(r.nroAfiliacion),
      "Título de grado (nombre de la carrera)": r.tituloGrado || "",
      Descuento: toSiNo(r.descuento),
      Departamento: toCanonicalDepartamento(r.departamento),
      Establecimiento: r.establecimientos || r.establecimiento || "",
      Celular: r.celular || "", Email: r.email || "",
      Observaciones: r.observaciones || "", Motivo: r.motivo || "",
      Estado: estadoUI(r) ? "Habilitado" : "No habilitado", Adherente: "Sí",
    }));
    exportFromJSON({ data, fileName: "adherentes", exportType: "xls" });
  };

  // ===== Importar Excel =====
  const handleClickImport = () => fileInputRef.current?.click();
  const handleFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImportPercent(0);
    setImportStage("Leyendo archivo…");
    setImporting(true);
    try {
      await importExcel(file);
    } catch (err) {
      console.error("importExcel:", err);
      toast.current?.show({ severity: "error", summary: "Error", detail: "No se pudo importar el archivo." });
    } finally {
      setImporting(false);
      e.target.value = "";
    }
  };

  const importExcel = async (file) => {
    // 1) Leer archivo
    const buf = await file.arrayBuffer();
    const wb = XLSX.read(buf, { type: "array" });
    const ws = wb.Sheets[wb.SheetNames[0]];
    if (!ws) throw new Error("Hoja vacía");

    // 2) Convertir a matriz
    const rows = XLSX.utils.sheet_to_json(ws, { header: 1 });
    if (!rows.length) throw new Error("Sin datos");

    // 3) Preparar mapeo de encabezados
    const headers = rows[0].map((h) => headerKey(String(h || "")));
    const idxMap = {};
    headers.forEach((k, i) => { if (k) idxMap[k] = i; });

    let inserted = 0, updated = 0, skipped = 0;
    let habilitadosNuevoAfiliado = 0, noEncontradosNuevoAfiliado = 0;
    let usuariosCreated = 0, usuariosUpdated = 0;
    let estadosUsers = 0, estadosNuevo = 0, estadosNuevoNoEncontrado = 0;

    const resumen = [];

    // 4) Progreso
    const total = Math.max(rows.length - 1, 0);
    let done = 0;
    setImportStage(total === 0 ? "Sin registros para importar" : "Procesando registros…");
    setImportPercent(total === 0 ? 100 : 0);

    // 5) Procesar filas
    for (const arr of rows.slice(1)) {
      const getVal = (k) => { const i = idxMap[k]; return i === undefined ? "" : arr[i] ?? ""; };

      const apellido = String(getVal("apellido") || "").trim();
      const nombre = String(getVal("nombre") || "").trim();
      const dni = String(getVal("dni") || "").trim();

      if (!apellido || !nombre || !dni) {
        skipped++; resumen.push({ apellido, nombre, dni, accion: "Omitido (faltan campos)" });
        done++;
        if (total > 0) setImportPercent(Math.min(100, Math.round((done / total) * 100)));
        continue;
      }

      const nroAf = (() => { const n = Number(getVal("nroAfiliacion")); return Number.isFinite(n) && n > 0 ? n : null; })();
      const flagAdherenteExcel = parseYes(getVal("adherenteExcel"));
      const estadoExcel = parseEstadoExcel(getVal("estadoExcel"));

      const payload = {
        apellido, nombre, dni, nroAfiliacion: nroAf,
        tituloGrado: String(getVal("tituloGrado") || "").trim(),
        descuento: String(getVal("descuento") || "").trim(),
        departamento: toCanonicalDepartamento(getVal("departamento")),
        establecimientos: String(getVal("establecimientos") || "").trim(),
        establecimiento: String(getVal("establecimientos") || "").trim(),
        celular: String(getVal("celular") || "").trim(),
        email: String(getVal("email") || "").trim(),
        observaciones: String(getVal("observaciones") || "").trim(),
        adherente: true,
        motivo: String(getVal("motivo") || "").trim(),
      };

      // ➤ Adherentes: ACTUALIZAR si existe(n) por DNI; insertar si no hay ninguno
      const qRef = query(collection(db, ADHERENTES_COLLECTION), where("dni", "==", payload.dni));
      const snap = await getDocs(qRef);
      if (!snap.empty) {
        await Promise.all(snap.docs.map((d) => updateDoc(d.ref, payload)));
        updated += snap.size;
        resumen.push({ apellido, nombre, dni, accion: `Actualizado (${snap.size})` });
      } else {
        await addDoc(collection(db, ADHERENTES_COLLECTION), payload);
        inserted++;
        resumen.push({ apellido, nombre, dni, accion: "Insertado" });
      }

      // Espejo en "usuarios"
      {
        const r = await upsertUsuarioByDni(payload, { mirrorCreate: true });
        if (r.op === "created") usuariosCreated += r.count || 1;
        if (r.op === "updated") usuariosUpdated += r.count || 1;
      }

      // Adherente = Sí desde Excel
      if (flagAdherenteExcel) {
        const targets = await findNuevoAfiliadoDocs(dni, nroAf);
        if (targets.length > 0) {
          await Promise.all(targets.map((dref) => updateDoc(dref.ref, { adherente: true })));
          habilitadosNuevoAfiliado += targets.length;
        } else {
          noEncontradosNuevoAfiliado++;
        }
        await patchUsuarioByDni(dni, { adherente: true }, { mirrorCreate: true });
      }

      // Estado (activo) desde Excel
      if (estadoExcel !== null) {
        await patchUsuarioByDni(dni, { activo: estadoExcel }, { mirrorCreate: true });
        estadosUsers++;
        const targets = await findNuevoAfiliadoDocs(dni, nroAf);
        if (targets.length > 0) {
          await Promise.all(targets.map((dref) => updateDoc(dref.ref, { activo: estadoExcel })));
          estadosNuevo += targets.length;
        } else {
          estadosNuevoNoEncontrado++;
        }
      }

      // ▶️ Avanza el progreso y cede control al render cada 50 items
      done++;
      if (total > 0) setImportPercent(Math.min(100, Math.round((done / total) * 100)));
      if (done % 50 === 0) await new Promise((r) => setTimeout(r, 0));
    }

    setImportStage("Finalizando…");
    setImportPercent(100);

    setSummaryCounts({ inserted, updated, skipped });
    setSummaryRows(resumen);
    setSummaryVisible(true);

    toast.current?.show({
      severity: "info",
      summary: "Importación finalizada",
      detail: `Actualizados: ${updated} • Insertados: ${inserted} • Omitidos: ${skipped}`,
      life: 6000,
    });
  };

  // ===== CRUD (NO guardamos 'estado' en adherentes) =====
  const abrirNuevo = () => {
    setEditandoId(null);
    setForm({
      apellido: "", nombre: "", dni: "", nroAfiliacion: "",
      tituloGrado: "", descuento: "", departamento: "",
      establecimientos: "", celular: "", email: "",
      observaciones: "", adherente: true, motivo: "",
    });
    setVisibleDialog(true);
  };

  const abrirEditar = (row) => {
    setEditandoId(row.id);
    setForm({
      apellido: row.apellido || "", nombre: row.nombre || "", dni: row.dni || "",
      nroAfiliacion: row.nroAfiliacion ?? "", tituloGrado: row.tituloGrado || "",
      descuento: typeof row.descuento === "string" ? row.descuento : row.descuento ?? "",
      departamento: toCanonicalDepartamento(row.departamento || ""),
      establecimientos: row.establecimientos || row.establecimiento || "",
      celular: row.celular || "", email: row.email || "",
      observaciones: row.observaciones || "", adherente: true, motivo: row.motivo || "",
    });
    setVisibleDialog(true);
  };

  const abrirVer = (row) => { setRowVer(row); setVisibleVer(true); };

  const validar = () => {
    const faltan = [];
    if (!form.apellido.trim()) faltan.push("Apellido");
    if (!form.nombre.trim()) faltan.push("Nombre");
    if (!form.dni.trim()) faltan.push("DNI");
    if (faltan.length) {
      toast.current?.show({ severity: "warn", summary: "Datos incompletos", detail: `Faltan: ${faltan.join(", ")}` });
      return false;
    }
    return true;
  };

  const guardar = async () => {
    if (!validar()) return;
    setSaving(true);
    try {
      const payload = {
        apellido: form.apellido.trim(), nombre: form.nombre.trim(), dni: form.dni.trim(),
        nroAfiliacion: form.nroAfiliacion !== "" ? Number(form.nroAfiliacion) : null,
        tituloGrado: form.tituloGrado?.trim() || "", descuento: String(form.descuento ?? "").trim(),
        departamento: toCanonicalDepartamento(form.departamento || ""),
        establecimientos: form.establecimientos?.trim() || "",
        establecimiento: form.establecimientos?.trim() || "",
        celular: form.celular?.trim() || "", email: form.email?.trim() || "",
        observaciones: form.observaciones?.trim() || "", adherente: true, motivo: form.motivo?.trim() || "",
      };

      if (editandoId) {
        await updateDoc(doc(db, ADHERENTES_COLLECTION, editandoId), payload);
        toast.current?.show({ severity: "success", summary: "Actualizado", detail: "Registro actualizado." });
      } else {
        const qRef = query(collection(db, ADHERENTES_COLLECTION), where("dni", "==", payload.dni));
        const snap = await getDocs(qRef);
        if (!snap.empty) {
          await Promise.all(snap.docs.map((d) => updateDoc(d.ref, payload)));
          toast.current?.show({ severity: "success", summary: "Actualizado", detail: "Registro existente actualizado." });
        } else {
          await addDoc(collection(db, ADHERENTES_COLLECTION), payload);
          toast.current?.show({ severity: "success", summary: "Guardado", detail: "Registro agregado." });
        }
      }

      await upsertUsuarioByDni(payload, { mirrorCreate: true });

      setVisibleDialog(false);
    } catch (err) {
      console.error("guardar adherente:", err);
      toast.current?.show({ severity: "error", summary: "Error", detail: "No se pudo guardar." });
    } finally {
      setSaving(false);
    }
  };

  const borrar = async (row) => {
    try {
      await deleteDoc(doc(db, ADHERENTES_COLLECTION, row.id));
      toast.current?.show({ severity: "success", summary: "Eliminado", detail: "Registro borrado." });
    } catch (err) {
      console.error("borrar adherente:", err);
      toast.current?.show({ severity: "error", summary: "Error", detail: "No se pudo borrar." });
    }
  };

  // ===== Toggle Estado =====
  const toggleEstadoNuevoAfiliado = async (row) => {
    try {
      const current = estadoUI(row);
      const next = !current;

      const [nuevoTargets, usuariosDocs] = await Promise.all([
        findNuevoAfiliadoDocs(row.dni, row.nroAfiliacion ?? null),
        findUsuariosDocs(row.dni),
      ]);

      if (nuevoTargets.length === 0 && usuariosDocs.length === 0) {
        toast.current?.show({
          severity: "warn",
          summary: "No encontrado",
          detail: "No se encontró el DNI en “nuevoAfiliado” ni en “usuarios”.",
          life: 5000,
        });
        return;
      }

      const ops = [];
      if (nuevoTargets.length > 0) ops.push(...nuevoTargets.map((dref) => updateDoc(dref.ref, { activo: next })));
      if (usuariosDocs.length > 0) ops.push(...usuariosDocs.map((d) => updateDoc(d.ref, { activo: next })));
      await Promise.all(ops);

      setRows((prev) => prev.map((r) => (r.id === row.id ? { ...r, estadoFromNuevo: next } : r)));

      const donde = [nuevoTargets.length > 0 ? "nuevoAfiliado" : null, usuariosDocs.length > 0 ? "usuarios" : null].filter(Boolean).join(" y ");
      toast.current?.show({ severity: "success", summary: next ? "Habilitado" : "Deshabilitado", detail: `Se ${next ? "habilitó" : "deshabilitó"} en ${donde}.` });
    } catch (err) {
      console.error("toggleEstadoNuevoAfiliado:", err);
      toast.current?.show({ severity: "error", summary: "Error", detail: "No se pudo actualizar el estado." });
    }
  };

  const confirmarBorrado = (row) => {
    confirmDialog({
      header: "Confirmar",
      message: `¿Eliminar a ${row.apellido ?? ""} ${row.nombre ?? ""}? Esta acción no se puede deshacer.`,
      icon: "pi pi-exclamation-triangle",
      acceptLabel: "Sí, borrar",
      rejectLabel: "Cancelar",
      accept: () => borrar(row),
    });
  };

  // ===== COTIZANTE =====
  const abrirCotizante = (row) => { setCotzRow(row); setCotzObs(row?.observaciones || ""); setCotzVisible(true); };

  const runCotizante = async () => {
    if (!cotzRow) return;
    const dniKey = String(cotzRow.dni || "").trim();
    const nro = cotzRow.nroAfiliacion ?? null;

    if (!dniKey) {
      toast.current?.show({ severity: "warn", summary: "Datos insuficientes", detail: "Falta el DNI para actualizar el registro." });
      return;
    }

    setCotzSaving(true);
    try {
      const [nuevoTargets, usuariosDocs] = await Promise.all([findNuevoAfiliadoDocs(dniKey, nro), findUsuariosDocs(dniKey)]);

      if (nuevoTargets.length === 0 && usuariosDocs.length === 0) {
        toast.current?.show({ severity: "warn", summary: "No encontrado", detail: "No se encontró el DNI en “nuevoAfiliado” ni en “usuarios”.", life: 5000 });
        setCotzSaving(false);
        return;
      }

      const trimmedObs = (cotzObs ?? "").trim();
      const ops = [];
      if (nuevoTargets.length > 0) ops.push(...nuevoTargets.map((dref) => updateDoc(dref.ref, { observaciones: trimmedObs, adherente: false })));
      if (usuariosDocs.length > 0) ops.push(...usuariosDocs.map((d) => updateDoc(d.ref, { observaciones: trimmedObs, adherente: false })));
      await Promise.all(ops);

      await deleteDoc(doc(db, ADHERENTES_COLLECTION, cotzRow.id));

      const donde = [nuevoTargets.length > 0 ? "nuevoAfiliado" : null, usuariosDocs.length > 0 ? "usuarios" : null].filter(Boolean).join(" y ");
      toast.current?.show({ severity: "success", summary: "Cotizante aplicado", detail: `Se actualizó adherente = no y observaciones en ${donde}, y se eliminó el registro en Adherentes.` });

      setCotzVisible(false);
      setCotzRow(null);
      setCotzObs("");
    } catch (err) {
      console.error("runCotizante:", err);
      toast.current?.show({ severity: "error", summary: "Error", detail: "No se pudo completar la operación Cotizante." });
    } finally {
      setCotzSaving(false);
    }
  };

  // ===== UI =====
  const accionesTemplate = (row) => {
    const activo = estadoUI(row);
    return (
      <div className={styles.actions}>
        <Button icon="pi pi-eye" tooltip="Ver" rounded text aria-label="Ver" onClick={() => abrirVer(row)} />
        <Button icon="pi pi-pencil" tooltip="Editar" rounded text aria-label="Editar" onClick={() => abrirEditar(row)} />
        <Button icon="pi pi-user-edit" tooltip="Cotizante (actualiza observaciones y elimina)" rounded text severity="info" aria-label="Cotizante" onClick={() => abrirCotizante(row)} />
        <Button icon={activo ? "pi pi-ban" : "pi pi-check"} tooltip={activo ? "Deshabilitar" : "Habilitar"} rounded text severity={activo ? "warning" : "success"} aria-label={activo ? "Deshabilitar" : "Habilitar"} onClick={() => toggleEstadoNuevoAfiliado(row)} />
        <Button icon="pi pi-trash" tooltip="Eliminar" rounded text severity="danger" aria-label="Eliminar" onClick={() => confirmarBorrado(row)} />
      </div>
    );
  };

  const estadoBodyTemplate = (row) => (
    <Tag value={estadoUI(row) ? "Habilitado" : "No habilitado"} severity={estadoUI(row) ? "success" : "danger"} rounded />
  );

  const leftToolbar = (
    <div className={styles.toolbarLeft}>
      <Button label="Nuevo" icon="pi pi-plus" severity="success" onClick={abrirNuevo} />
      <Button label="Importar Excel" icon="pi pi-upload" severity="info" onClick={handleClickImport} />
      <Button label="Descargar Excel" icon="pi pi-download" severity="help" onClick={handleExportExcel} disabled={loading || dataFiltrada.length === 0} />
      <input ref={fileInputRef} type="file" accept=".xlsx,.xls" style={{ display: "none" }} onChange={handleFileChange} />
    </div>
  );

  const rightToolbar = (
    <div className={styles.toolbarRight}>
      <span className="p-input-icon-left">
        <i className="pi pi-search" />
        <InputText value={busqueda} onChange={(e) => setBusqueda(e.target.value)} placeholder="Buscar (apellido, nombre, DNI, email, ...)" />
      </span>
      <Dropdown value={deptoSeleccionado} onChange={(e) => setDeptoSeleccionado(e.value)} options={DEPARTAMENTOS} placeholder="Departamento" className={styles.filterItem} showClear />
      <Dropdown value={estadoSeleccionado} onChange={(e) => setEstadoSeleccionado(e.value)} options={[{ label: "Habilitado", value: true }, { label: "No habilitado", value: false }]} placeholder="Estado" className={styles.filterItem} showClear />
      <Button label="Aplicar filtros" icon="pi pi-filter" onClick={() => { setDeptoAplicado(deptoSeleccionado || null); setEstadoAplicado(typeof estadoSeleccionado === "boolean" ? estadoSeleccionado : null); setFirst(0); }} />
      <Button text label="Limpiar" onClick={() => { setBusqueda(""); setDeptoSeleccionado(null); setDeptoAplicado(null); setEstadoSeleccionado(null); setEstadoAplicado(null); setFirst(0); }} />
    </div>
  );

  const columns = [
    <Column key="apellido" field="apellido" header="Apellido" sortable />,
    <Column key="nombre" field="nombre" header="Nombre" sortable />,
    <Column key="dni" field="dni" header="DNI" sortable />,
    <Column key="departamento" field="departamento" header="Departamento" body={(r) => toCanonicalDepartamento(r.departamento)} sortable />,
    <Column key="establecimientos" field="establecimientos" header="Establecimiento" body={(r)=> r.establecimientos || r.establecimiento || "—"} />,
    <Column key="celular" field="celular" header="Celular" />,
    <Column key="email" field="email" header="Email" />,
    <Column key="motivo" field="motivo" header="Motivo" />,
    <Column key="estado" header="Estado" body={estadoBodyTemplate} sortable />,
    <Column key="observaciones" field="observaciones" header="Observaciones" className={styles.observacionesCol || ""} />,
    <Column key="acciones" header="Acciones" body={accionesTemplate} exportable={false} />,
  ].filter(Boolean);

  return (
    <div className={styles.container}>
      <Toast ref={toast} />
      <ConfirmDialog />

      <div className={styles.header}>
        <h2>Afiliados Adherentes</h2>
        <p className={styles.subtitle}>
          Gestioná adherentes: crear, importar/descargar Excel, buscar y filtrar por Departamento y Estado (tomado de “nuevoAfiliado.activo”); ver/editar, habilitar/deshabilitar o eliminar, y operar Cotizante.
        </p>
      </div>

      <Toolbar className={styles.toolbar} left={leftToolbar} right={rightToolbar} />

      <DataTable value={dataFiltrada} loading={loading} paginator first={first} onPage={(e) => setFirst(e.first)} rows={10} rowsPerPageOptions={[10, 20, 50]} stripedRows showGridlines emptyMessage="Sin registros" className={styles.table} dataKey="id">
        {columns}
      </DataTable>

      {/* Modal Ver */}
      <Dialog header="Detalle de Adherente" visible={visibleVer} style={{ width: 640 }} modal onHide={() => setVisibleVer(false)}>
        <div className={styles.viewGrid}>
          <div><strong>Apellido y Nombre:</strong> {rowVer ? `${rowVer.apellido || "—"}, ${rowVer?.nombre || "—"}` : "—"}</div>
          <div><strong>DNI:</strong> {rowVer?.dni || "—"}</div>
          <div><strong>Afiliación:</strong> {afiliacionLabel(rowVer?.nroAfiliacion)}</div>
          <div><strong>Título de grado:</strong> {rowVer?.tituloGrado || "—"}</div>
          <div><strong>Descuento:</strong> {toSiNo(rowVer?.descuento)}</div>
          <div><strong>Departamento:</strong> {toCanonicalDepartamento(rowVer?.departamento) || "—"}</div>
          <div><strong>Establecimiento:</strong> {rowVer?.establecimientos || rowVer?.establecimiento || "—"}</div>
          <div><strong>Celular:</strong> {rowVer?.celular || "—"}</div>
          <div><strong>Email:</strong> {rowVer?.email || "—"}</div>
          <div><strong>Motivo:</strong> {rowVer?.motivo || "—"}</div>
          <div className={styles.viewRowFull}><strong>Observaciones:</strong><div>{rowVer?.observaciones || "—"}</div></div>
          <div><strong>Adherente:</strong> Sí</div>
          <div><strong>Estado:</strong> <Tag value={estadoUI(rowVer) ? "Habilitado" : "No habilitado"} severity={estadoUI(rowVer) ? "success" : "danger"} /></div>
        </div>
      </Dialog>

      {/* Modal alta/edición */}
      <Dialog header={editandoId ? "Editar adherente" : "Nuevo adherente"} visible={visibleDialog} style={{ width: 760 }} modal onHide={() => setVisibleDialog(false)}>
        <div className={styles.formGrid}>
          <div className={styles.formRow}><label>Apellido</label><InputText autoFocus value={form.apellido} onChange={(e) => setForm((f) => ({ ...f, apellido: e.target.value }))} /></div>
          <div className={styles.formRow}><label>Nombre</label><InputText value={form.nombre} onChange={(e) => setForm((f) => ({ ...f, nombre: e.target.value }))} /></div>
          <div className={styles.formRow}><label>DNI</label><InputText value={form.dni} onChange={(e) => setForm((f) => ({ ...f, dni: e.target.value }))} inputMode="numeric" pattern="\d*" /></div>
          <div className={styles.formRow}><label>N° de afiliación</label><InputText value={form.nroAfiliacion} onChange={(e) => setForm((f) => ({ ...f, nroAfiliacion: e.target.value }))} inputMode="numeric" pattern="\d*" /></div>
          <div className={styles.formRow}><label>Título de grado (nombre de la carrera)</label><InputText value={form.tituloGrado} onChange={(e) => setForm((f) => ({ ...f, tituloGrado: e.target.value }))} /></div>
          <div className={styles.formRow}><label>Descuento</label><InputText value={form.descuento} onChange={(e) => setForm((f) => ({ ...f, descuento: e.target.value }))} placeholder="si / no" /></div>
          <div className={styles.formRow}><label>Departamento</label><Dropdown value={form.departamento} onChange={(e) => setForm((f) => ({ ...f, departamento: e.value }))} options={DEPARTAMENTOS} placeholder="Selecciona" showClear /></div>
          <div className={styles.formRow}><label>Establecimiento</label><InputText value={form.establecimientos} onChange={(e) => setForm((f) => ({ ...f, establecimientos: e.target.value }))} /></div>
          <div className={styles.formRow}><label>Celular</label><InputText value={form.celular} onChange={(e) => setForm((f) => ({ ...f, celular: e.target.value }))} inputMode="tel" /></div>
          <div className={styles.formRow}><label>Email</label><InputText type="email" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} /></div>
          <div className={styles.formRowFull}><label>Motivo</label><InputText value={form.motivo} onChange={(e) => setForm((f) => ({ ...f, motivo: e.target.value }))} placeholder="Ej.: Cambio de plan, solicitud especial, etc." /></div>
          <div className={styles.formRowFull}><label>Observaciones</label><InputTextarea autoResize rows={3} value={form.observaciones} onChange={(e) => setForm((f) => ({ ...f, observaciones: e.target.value }))} /></div>
        </div>
        <div className={styles.dialogActions}>
          <Button label="Guardar" icon="pi pi-check" severity="success" onClick={guardar} loading={saving} />
          <Button label="Cancelar" icon="pi pi-times" severity="danger" onClick={() => setVisibleDialog(false)} disabled={saving} />
        </div>
      </Dialog>

      {/* Modal Cotizante */}
      <Dialog
        header="Cotizante — Actualizar observaciones y eliminar"
        visible={cotzVisible}
        style={{ width: 680 }}
        modal
        onHide={() => setCotzVisible(false)}
        footer={
          <div className="flex gap-2 justify-content-end">
            <Button
              label="Cancelar"
              text
              onClick={() => setCotzVisible(false)}
              disabled={cotzSaving}
            />
            <Button
              label="Aplicar y eliminar"
              icon="pi pi-check"
              severity="warning"
              onClick={runCotizante}
              loading={cotzSaving}
              disabled={!cotzRow}
            />
          </div>
        }
      >
        <div className={styles.formGrid}>
          <div className={styles.formRow}>
            <label>Apellido y Nombre</label>
            <InputText
              value={cotzRow ? `${cotzRow.apellido || ""}, ${cotzRow.nombre || ""}` : ""}
              readOnly
            />
          </div>
          <div className={styles.formRow}>
            <label>DNI</label>
            <InputText value={cotzRow?.dni || ""} readOnly />
          </div>
          <div className={styles.formRow}>
            <label>N° de afiliación</label>
            <InputText value={cotzRow?.nroAfiliacion ?? ""} readOnly />
          </div>
          <div className={styles.formRowFull}>
            <label>Observaciones (se guardará en “nuevoAfiliado” y/o “usuarios”)</label>
            <InputTextarea
              autoResize
              rows={4}
              value={cotzObs}
              onChange={(e) => setCotzObs(e.target.value)}
              placeholder="Escribí el motivo o detalle…"
            />
          </div>
        </div>
      </Dialog>

      {/* 📋 Resumen de importación (NO autocierra) */}
      <Dialog header="Resultado de la importación" visible={summaryVisible} modal closable={false} style={{ width: 900 }}
        footer={<div className="flex justify-content-end gap-2">
          <Button label="Cerrar" icon="pi pi-times" onClick={() => setSummaryVisible(false)} />
        </div>}
      >
        <p><strong>Actualizados:</strong> {summaryCounts.updated} • <strong>Insertados:</strong> {summaryCounts.inserted} • <strong>Omitidos:</strong> {summaryCounts.skipped}</p>
        <DataTable value={summaryRows} rows={10} paginator showGridlines stripedRows>
          <Column field="apellido" header="Apellido" />
          <Column field="nombre" header="Nombre" />
          <Column field="dni" header="DNI" />
          <Column field="accion" header="Acción" />
        </DataTable>
      </Dialog>

      {/* ⏳ Modal Importando (con barra de progreso) */}
      <Dialog
        header="Importando Excel"
        visible={importing}
        style={{ width: 460 }}
        modal
        closable={false}
        aria-modal="true"
        aria-busy="true"
      >
        <div className={styles.center} style={{ paddingTop: 6, paddingBottom: 6 }}>
          <div style={{ marginBottom: 8, fontWeight: 600 }}>{importStage}</div>
          <ProgressBar value={importPercent} style={{ width: 380, maxWidth: "80vw" }} />
          <div style={{ marginTop: 10, fontSize: 13, opacity: 0.85 }}>
            {importPercent}% completado
          </div>
          <div style={{ marginTop: 6, fontSize: 12, color: "#6b7280", textAlign: "center" }}>
            La interfaz permanecerá bloqueada hasta finalizar.
          </div>
        </div>
      </Dialog>
    </div>
  );
}
