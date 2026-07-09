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
import { FileUpload } from "primereact/fileupload";
import { Checkbox } from "primereact/checkbox";
import { DataTable } from "primereact/datatable";
import { Column } from "primereact/column";
import { ExcelRenderer } from "react-excel-renderer";
import "../../../assets/styles/excel/excel-2007.css";
import exportFromJSON from "export-from-json";
import { departamentos } from "../../../constants/departamentos.js";

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
  getDoc as fsGetDoc,
  where,
  doc as fsDoc,
  setDoc as fsSetDoc,
  deleteDoc as fsDeleteDoc,
  updateDoc as fsUpdateDoc,
  orderBy as fsOrderBy,
  startAfter as fsStartAfter,
  limit as fsLimit,
  documentId,
  arrayUnion,
  serverTimestamp,
  writeBatch as fsWriteBatch,
} from "firebase/firestore";
import { db } from "../../../firebase/firebase-config.js";

// ✅ Redux thunks SOLO para update/delete (nuevoAfiliado)
import {
  updateAfiliadoById,
} from "../../../redux/reducers/afiliadoActualizado/slice.js";

const PAGE_SIZE = 50;

const EMPTY_FORM = {
  nombre: "",
  apellido: "",
  dni: "",
  email: "",
  celular: "",
  departamento: "",
  establecimientos: "",
  mesaNro: "",
  lugarVotacion: "",
  descuento: "",
  nroAfiliacion: "",
  observaciones: "",
  adherente: false,
  tituloGrado: "",
  activo: true,
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

// 🔸 Normaliza DNI a solo números
const toDniKey = (dniRaw) =>
  String(dniRaw ?? "")
    .replace(/[^\d]/g, "")
    .trim();

const getDniSearchVariants = (dniRaw) => {
  const limpio = toDniKey(dniRaw);
  const variantes = new Set();
  if (limpio) variantes.add(limpio);
  const numero = Number(limpio);
  if (Number.isFinite(numero)) {
    variantes.add(numero);
    variantes.add(String(numero));
  }
  return Array.from(variantes);
};

const getTodayDateInput = () => {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
};

const MESES_BAJA = [
  "enero",
  "febrero",
  "marzo",
  "abril",
  "mayo",
  "junio",
  "julio",
  "agosto",
  "septiembre",
  "octubre",
  "noviembre",
  "diciembre",
];

const MESES_BAJA_ALIASES = {
  ene: 1,
  enero: 1,
  feb: 2,
  febrero: 2,
  mar: 3,
  marzo: 3,
  abr: 4,
  abril: 4,
  may: 5,
  mayo: 5,
  jun: 6,
  junio: 6,
  jul: 7,
  julio: 7,
  ago: 8,
  agosto: 8,
  sep: 9,
  sept: 9,
  set: 9,
  septiembre: 9,
  setiembre: 9,
  oct: 10,
  octubre: 10,
  nov: 11,
  noviembre: 11,
  dic: 12,
  diciembre: 12,
};

const normalizarEncabezadoBaja = (value) =>
  String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

const parsePeriodoBaja = (value) => {
  if (typeof value === "number" && value > 20000 && value < 80000) {
    const fechaExcel = new Date(Date.UTC(1899, 11, 30) + value * 86400000);
    const mes = fechaExcel.getUTCMonth() + 1;
    const anio = fechaExcel.getUTCFullYear();
    return {
      periodo: `${anio}-${String(mes).padStart(2, "0")}`,
      mes,
      anio,
      label: `${MESES_BAJA[mes - 1]} ${anio}`,
    };
  }

  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    const mes = value.getMonth() + 1;
    const anio = value.getFullYear();
    return {
      periodo: `${anio}-${String(mes).padStart(2, "0")}`,
      mes,
      anio,
      label: `${MESES_BAJA[mes - 1]} ${anio}`,
    };
  }

  const textoOriginal = String(value || "").trim();
  const isoMatch = textoOriginal.match(/^(20\d{2})[-/]([01]?\d)(?:[-/]\d{1,2})?$/);
  if (isoMatch) {
    const anio = Number(isoMatch[1]);
    const mes = Number(isoMatch[2]);
    if (mes >= 1 && mes <= 12) {
      return {
        periodo: `${anio}-${String(mes).padStart(2, "0")}`,
        mes,
        anio,
        label: `${MESES_BAJA[mes - 1]} ${anio}`,
      };
    }
  }

  const texto = normalizarEncabezadoBaja(value).replace(/^baja\s+/, "");
  if (!texto) return null;

  let mes = 0;
  let anio = 0;
  const tokens = texto.split(/\s+/).filter(Boolean);
  const tokenMes = tokens.find((token) => MESES_BAJA_ALIASES[token]);

  if (tokenMes) mes = MESES_BAJA_ALIASES[tokenMes];

  const numeros = texto.match(/\d{1,4}/g) || [];
  if (!mes && numeros.length >= 2) mes = Number(numeros[0]);

  const candidatoAnio = Number(numeros[numeros.length - 1]);
  if (candidatoAnio) anio = candidatoAnio < 100 ? 2000 + candidatoAnio : candidatoAnio;

  if (!mes || mes < 1 || mes > 12 || anio < 2000 || anio > 2100) return null;

  return {
    periodo: `${anio}-${String(mes).padStart(2, "0")}`,
    mes,
    anio,
    label: `${MESES_BAJA[mes - 1]} ${anio}`,
  };
};

// =======================
// Helpers dispositivo asistencia
// =======================

const getDeviceFields = (base = {}) => ({
  dispositivoAsistenciaId: base.dispositivoAsistenciaId ?? null,
  asistenciaDispositivoVinculado:
    typeof base.asistenciaDispositivoVinculado === "boolean"
      ? base.asistenciaDispositivoVinculado
      : false,
  dispositivoVinculadoEn: base.dispositivoVinculadoEn ?? null,
  dispositivoVinculadoDesde: base.dispositivoVinculadoDesde ?? null,
  dispositivoUltimaValidacionEn: base.dispositivoUltimaValidacionEn ?? null,
  dispositivoModelo: base.dispositivoModelo ?? null,
  dispositivoCodigoModelo: base.dispositivoCodigoModelo ?? null,
  dispositivoPlataforma: base.dispositivoPlataforma ?? null,
  dispositivoUserAgent: base.dispositivoUserAgent ?? null,
  dispositivoBloqueado:
    typeof base.dispositivoBloqueado === "boolean"
      ? base.dispositivoBloqueado
      : false,
  dispositivoAnteriorId: base.dispositivoAnteriorId ?? null,
  dispositivoReiniciadoEn: base.dispositivoReiniciadoEn ?? null,
  dispositivoReiniciadoPor: base.dispositivoReiniciadoPor ?? null,
  dispositivoReinicioMotivo: base.dispositivoReinicioMotivo ?? null,
});

const shortDeviceId = (value) => {
  const v = String(value ?? "").trim();
  if (!v) return "Sin dispositivo vinculado";
  if (v.length <= 18) return v;
  return `${v.slice(0, 14)}...${v.slice(-6)}`;
};

const getEstadoDispositivoLabel = (row) => {
  if (row?.dispositivoBloqueado) return "Bloqueado";
  if (row?.asistenciaDispositivoVinculado || row?.dispositivoAsistenciaId) {
    return "Vinculado";
  }
  return "Sin dispositivo vinculado";
};

const formatFechaHoraDispositivo = (value) => {
  const fecha = value?.toDate?.() || (value ? new Date(value) : null);
  if (!fecha || Number.isNaN(fecha.getTime())) return "No informada";

  return new Intl.DateTimeFormat("es-AR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(fecha);
};

const getAdminLabel = () => {
  try {
    return (
      localStorage.getItem("adminEmail") ||
      localStorage.getItem("userEmail") ||
      localStorage.getItem("email") ||
      localStorage.getItem("usuario") ||
      "admin_web"
    );
  } catch {
    return "admin_web";
  }
};

/** Mapeo de documentos a filas */
const mapUsuarioDocToRow = (d) => {
  const base = { id: d.id, ...d.data() };
  const r = {
    ...toRow(base),
    ...getDeviceFields(base),
    origen: "usuarios",
  };

  // 🔹 Normalizamos el departamento SOLO a nivel de UI
  if (r.departamento) {
    r.departamento = normalizeDepartamentoLabel(r.departamento);
  }

  const haystack = norm(
    `${r.apellido} ${r.nombre} ${String(r.dni || "")} ${r.email || ""} ${
      r.departamento || ""
    } ${r.motivo || ""} ${r.mesaNro || ""} ${r.lugarVotacion || ""}`
  );

  return { ...r, haystack };
};

const mapNuevoDocToRow = (d) => {
  const base = { id: d.id, ...d.data() };
  const row = {
    ...toRow(base),
    ...getDeviceFields(base),
    origen: "nuevoAfiliado",
  };

  // 🔹 Igual que arriba, normalizamos el departamento para la UI
  if (row.departamento) {
    row.departamento = normalizeDepartamentoLabel(row.departamento);
  }

  const haystack = norm(
    `${row.apellido} ${row.nombre} ${row.dni} ${row.nroAfiliacion} ${
      row.email
    } ${row.departamento} ${row.motivo || ""} ${row.mesaNro || ""} ${
      row.lugarVotacion || ""
    }`
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

// 🔸 Leer colección grande por páginas
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

// 🔸 Unificación por DNI
const unifyByDni = (arrNuevo, arrUsuarios) => {
  const mapN = new Map();
  const mapU = new Map();

  arrNuevo.forEach((r) => mapN.set(toDniKey(r.dni), r));
  arrUsuarios.forEach((r) => mapU.set(toDniKey(r.dni), r));

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
        id: nr.id || ur.id,
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

        // Campos votación
        mesaNro: pick(nr.mesaNro, ur.mesaNro),
        lugarVotacion: pick(nr.lugarVotacion, ur.lugarVotacion),

        descuento: pick(nr.descuento, ur.descuento),
        nroAfiliacion: pick(nr.nroAfiliacion, ur.nroAfiliacion),
        observaciones: pick(nr.observaciones, ur.observaciones),
        adherente:
          typeof nr.adherente === "boolean"
            ? nr.adherente
            : typeof ur.adherente === "boolean"
            ? ur.adherente
            : false,
        tituloGrado: pick(nr.tituloGrado, ur.tituloGrado),
        activo:
          typeof nr.activo === "boolean"
            ? nr.activo
            : typeof ur.activo === "boolean"
            ? ur.activo
            : true,
        fecha: pick(nr.fecha, ur.fecha),
        hora: pick(nr.hora, ur.hora),
        cod: pick(nr.cod, ur.cod),
        motivo: pick(nr.motivo, ur.motivo),
        cotizante:
          typeof nr.cotizante === "boolean"
            ? nr.cotizante
            : typeof ur.cotizante === "boolean"
            ? ur.cotizante
            : false,

        // Campos dispositivo asistencia
        dispositivoAsistenciaId: pick(
          nr.dispositivoAsistenciaId,
          ur.dispositivoAsistenciaId
        ),
        asistenciaDispositivoVinculado:
          !!nr.asistenciaDispositivoVinculado ||
          !!ur.asistenciaDispositivoVinculado,
        dispositivoVinculadoEn: pick(
          nr.dispositivoVinculadoEn,
          ur.dispositivoVinculadoEn
        ),
        dispositivoVinculadoDesde: pick(
          nr.dispositivoVinculadoDesde,
          ur.dispositivoVinculadoDesde
        ),
        dispositivoUltimaValidacionEn: pick(
          nr.dispositivoUltimaValidacionEn,
          ur.dispositivoUltimaValidacionEn
        ),
        dispositivoModelo: pick(
          nr.dispositivoModelo,
          ur.dispositivoModelo
        ),
        dispositivoCodigoModelo: pick(
          nr.dispositivoCodigoModelo,
          ur.dispositivoCodigoModelo
        ),
        dispositivoPlataforma: pick(
          nr.dispositivoPlataforma,
          ur.dispositivoPlataforma
        ),
        dispositivoUserAgent: pick(
          nr.dispositivoUserAgent,
          ur.dispositivoUserAgent
        ),
        dispositivoBloqueado:
          !!nr.dispositivoBloqueado || !!ur.dispositivoBloqueado,
        dispositivoAnteriorId: pick(
          nr.dispositivoAnteriorId,
          ur.dispositivoAnteriorId
        ),
        dispositivoReiniciadoEn: pick(
          nr.dispositivoReiniciadoEn,
          ur.dispositivoReiniciadoEn
        ),
        dispositivoReiniciadoPor: pick(
          nr.dispositivoReiniciadoPor,
          ur.dispositivoReiniciadoPor
        ),
        dispositivoReinicioMotivo: pick(
          nr.dispositivoReinicioMotivo,
          ur.dispositivoReinicioMotivo
        ),
      };

      merged.haystack = norm(
        `${merged.apellido} ${merged.nombre} ${merged.dni} ${
          merged.email || ""
        } ${merged.departamento || ""} ${merged.motivo || ""} ${
          merged.mesaNro || ""
        } ${merged.lugarVotacion || ""}`
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

// 🔸 Espejo en colección "adherentes"
async function syncAdherentesForPayload(dniKey, payload, preferredId) {
  const qDup = fsQuery(
    fsCollection(db, "adherentes"),
    where("dni", "==", dniKey)
  );
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

    await fsSetDoc(fsDoc(db, "adherentes", String(preferredId)), espejo, {
      merge: true,
    });
  } else {
    if (!dupSnap.empty) {
      await Promise.all(dupSnap.docs.map((d) => fsDeleteDoc(d.ref)));
    }
  }
}

// =======================
// Helpers para DEPARTAMENTO
// =======================

const normalizeTextBasic = (str) =>
  String(str || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

// Construye un diccionario a partir del objeto `departamentos`
const buildDepartamentoLookup = () => {
  const map = new Map();

  Object.entries(departamentos || {}).forEach(([code, label]) => {
    const value = String(label || "").trim();
    if (!value) return;

    const normLabel = normalizeTextBasic(value);
    const normCode = normalizeTextBasic(code);

    if (normLabel) map.set(normLabel, value);
    if (normCode) map.set(normCode, value);

    const first = normLabel.split(" ")[0];
    if (first) map.set(first, value);
  });

  return map;
};

const DEPARTAMENTO_LOOKUP = buildDepartamentoLookup();

const normalizeDepartamentoLabel = (raw) => {
  const normValue = normalizeTextBasic(raw);
  if (!normValue) return "";

  if (DEPARTAMENTO_LOOKUP.has(normValue)) {
    return DEPARTAMENTO_LOOKUP.get(normValue);
  }

  for (const [key, label] of DEPARTAMENTO_LOOKUP.entries()) {
    if (normValue === key || normValue.includes(key) || key.includes(normValue)) {
      return label;
    }
  }

  return String(raw || "").trim();
};

// =======================
// Helpers para EXCEL
// =======================

const normalizeFieldName = (raw) => {
  const k = String(raw || "")
    .trim()
    .toLowerCase();

  switch (k) {
    case "nombre":
    case "nombres":
      return "nombre";

    case "apellido":
    case "apellidos":
      return "apellido";

    case "dni":
    case "documento":
      return "dni";

    case "email":
    case "correo":
    case "correo electrónico":
    case "correo electronico":
      return "email";

    case "celular":
    case "telefono":
    case "teléfono":
    case "whatsapp":
      return "celular";

    case "departamento":
      return "departamento";

    case "establecimientos":
    case "establecimiento":
    case "escuela":
    case "institucion":
    case "institución":
      return "establecimientos";

    case "mesa n°":
    case "mesa nº":
    case "mesa nro":
    case "mesa":
      return "mesaNro";

    case "lugar de votación":
    case "lugar de votacion":
    case "lugar votación":
    case "lugar votacion":
    case "lugar de voto":
    case "lugar voto":
      return "lugarVotacion";

    case "descuento":
      return "descuento";

    case "nro afiliacion":
    case "nro_afiliacion":
    case "nroafiliacion":
    case "n° afiliacion":
    case "n° de afiliacion":
    case "afiliacion":
    case "afiliación":
      return "nroAfiliacion";

    case "titulo grado":
    case "título de grado":
    case "titulo de grado":
    case "titulo de grado (nombre de la carrera)":
    case "título de grado (nombre de la carrera)":
    case "titulo":
      return "tituloGrado";

    default:
      return null;
  }
};

// 🔹 SOLO mostramos estos campos en el modal de importación
const FIELD_LABELS = {
  nroAfiliacion: "Afiliación",
  tituloGrado: "Título de grado (nombre de la carrera)",
  descuento: "Descuento",
  departamento: "Departamento",
  establecimientos: "Establecimiento",
  celular: "Celular",
  email: "Email",
  mesaNro: "Mesa N°",
  lugarVotacion: "Lugar de Votación",
};

const normalizeExcelValue = (field, raw) => {
  if (raw == null) return "";

  const s = String(raw).trim();
  if (!s) return "";

  if (field === "nroAfiliacion") {
    const n = Number(s.replace(/[^\d]/g, ""));
    return Number.isNaN(n) ? "" : n;
  }

  if (field === "departamento") {
    return normalizeDepartamentoLabel(s);
  }

  if (field === "adherente" || field === "activo" || field === "cotizante") {
    const v = s.toLowerCase();
    if (["si", "sí", "true", "1", "x"].includes(v)) return true;
    if (["no", "false", "0"].includes(v)) return false;
    return undefined;
  }

  if (field === "descuento") {
    const normalized = normalizeDescuentoInput(s);
    return normalized || "";
  }

  return s;
};

/**
 * patch por fila:
 * - campos forzados → siempre se actualizan
 * - campos NO forzados → solo si el campo actual está vacío
 * - DNI, nombre y apellido nunca se tocan
 */
const buildPatchFromExcelRow = (
  excelRow,
  fieldMap,
  forceFields,
  currentData
) => {
  const patch = {};

  for (const [field, colIndex] of Object.entries(fieldMap)) {
    if (["dni", "nombre", "apellido"].includes(field)) continue;

    const raw = excelRow[colIndex];
    const normalized = normalizeExcelValue(field, raw);

    if (normalized === undefined || normalized === "") continue;

    const force = !!forceFields[field];
    const prev = currentData ? currentData[field] : undefined;

    const isEmptyPrev =
      prev === undefined ||
      prev === null ||
      (typeof prev === "string" && prev.trim() === "");

    if (force || isEmptyPrev) {
      patch[field] = normalized;
    }
  }

  return patch;
};

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

  useEffect(() => {
    setRowsUsuariosLocal(rowsUsuarios || []);
  }, [rowsUsuarios]);

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
  const [rowId, setRowId] = useState(null);
  const [rowIdBoth, setRowIdBoth] = useState({ nuevo: null, usuario: null });
  const [initialForm, setInitialForm] = useState(EMPTY_FORM);
  const [editOrigin, setEditOrigin] = useState("nuevoAfiliado");

  const [currentRow, setCurrentRow] = useState(null);

  // Baja / eliminación con fecha
  const [bajaVisible, setBajaVisible] = useState(false);
  const [bajaFecha, setBajaFecha] = useState(getTodayDateInput());
  const [bajaRow, setBajaRow] = useState(null);
  const [bajaTipo, setBajaTipo] = useState(null); // "simple" | "ambos"
  const [bajaSaving, setBajaSaving] = useState(false);

  // Baja masiva por Excel
  const [bajaMasivaVisible, setBajaMasivaVisible] = useState(false);
  const [bajaMasivaRows, setBajaMasivaRows] = useState([]);
  const [bajaMasivaArchivo, setBajaMasivaArchivo] = useState("");
  const [bajaMasivaAnalizando, setBajaMasivaAnalizando] = useState(false);
  const [bajaMasivaProcesando, setBajaMasivaProcesando] = useState(false);

  // Export
  const [exporting, setExporting] = useState(false);
  const [exportModal, setExportModal] = useState(false);
  const [exportMsg, setExportMsg] = useState("Preparando…");

  // Excel import
  const [excelMeta, setExcelMeta] = useState(null);
  const [forceFields, setForceFields] = useState({});
  const [excelConfigVisible, setExcelConfigVisible] = useState(false);
  const [importProcessVisible, setImportProcessVisible] = useState(false);
  const [importProgress, setImportProgress] = useState(0);
  const [importResultVisible, setImportResultVisible] = useState(false);
  const [importResult, setImportResult] = useState({
    updated: [],
    errors: [],
  });
  const [excelFieldStats, setExcelFieldStats] = useState({});

  const editableFields = excelMeta?.fieldMap
    ? Object.keys(excelMeta.fieldMap).filter(
        (f) => !["dni", "nombre", "apellido"].includes(f)
      )
    : [];

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

  // 1) Cargar nuevoAfiliado
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

  useEffect(() => {
    fetchAllNuevoAfiliado();
  }, [fetchAllNuevoAfiliado]);

  // 2) Búsqueda puntual por DNI en usuarios
  const fetchUsuariosByDniIfNeeded = useCallback(async (term) => {
    const onlyDigits = /^\d{3,}$/.test((term || "").trim());

    setExtraUsuariosRows([]);

    if (!onlyDigits) return;

    try {
      setDniFetchLoading(true);

      const results = [];

      const qStr = fsQuery(
        fsCollection(db, "usuarios"),
        where("dni", "==", String(term).trim())
      );

      const snapStr = await fsGetDocs(qStr);
      snapStr.forEach((d) => results.push(mapUsuarioDocToRow(d)));

      const dniNum = Number(term);

      if (!Number.isNaN(dniNum)) {
        const qNum = fsQuery(
          fsCollection(db, "usuarios"),
          where("dni", "==", dniNum)
        );

        const snapNum = await fsGetDocs(qNum);
        snapNum.forEach((d) => results.push(mapUsuarioDocToRow(d)));
      }

      setExtraUsuariosRows(mergeUniqueById([], results));
    } finally {
      setDniFetchLoading(false);
    }
  }, []);

  // 3) Combinar / ordenar
  const rowsUsuariosMerged = useMemo(
    () => mergeUniqueById(rowsUsuariosLocal, extraUsuariosRows),
    [rowsUsuariosLocal, extraUsuariosRows]
  );

  const combinedRows = useMemo(() => {
    let arr = [];

    if (source === "nuevoAfiliado") {
      arr = rowsNuevo;
    } else if (source === "usuarios") {
      arr = rowsUsuariosMerged;
    } else {
      arr = unifyByDni(rowsNuevo, rowsUsuariosMerged);
    }

    return [...arr].sort((a, b) => {
      const sa = a.hora ? `${a.fecha} ${a.hora}` : a.fecha || "";
      const sb = b.hora ? `${b.fecha} ${b.hora}` : b.fecha || "";
      return toTimestamp(sb) - toTimestamp(sa);
    });
  }, [rowsNuevo, rowsUsuariosMerged, source]);

  // 🔹 Opciones de DEPARTAMENTO normalizadas y sin duplicados
  const departamentosOptions = useMemo(() => {
    const baseOpts = departamentosOptionsFrom(combinedRows) || [];
    const map = new Map();

    baseOpts.forEach((opt) => {
      if (!opt) return;

      const raw = typeof opt === "string" ? opt : opt.label ?? opt.value;
      if (!raw) return;

      const canon = normalizeDepartamentoLabel(raw);
      if (!canon) return;

      if (!map.has(canon)) {
        map.set(canon, { label: canon, value: canon });
      }
    });

    return Array.from(map.values());
  }, [combinedRows]);

  // 4) Filtro texto
  const filteredRows = useMemo(() => {
    const qn = norm(query);
    if (!qn) return combinedRows;
    return combinedRows.filter((r) => r.haystack.includes(qn));
  }, [combinedRows, query]);

  useEffect(() => {
    setPage(1);
  }, [source, query, rowsNuevo.length, rowsUsuariosMerged.length]);

  // 5) Paginado
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

  // 6) Buscar / limpiar
  const doSearch = async () => {
    const term = (searchInput || "").trim();
    await fetchUsuariosByDniIfNeeded(term);
    setQuery(term);
  };

  const onSearch = () => {
    void doSearch();
  };

  const onClear = () => {
    setSearchInput("");
    setQuery("");
    setPage(1);
    setExtraUsuariosRows([]);
    setDniFetchLoading(false);
  };

  const onKeyDown = (e) => {
    if (e.key === "Enter") onSearch();
  };

  // 7) Acciones sobre filas
  const onActionClick = useCallback((e, row) => {
    setCurrentRow(row);
    actionMenuRef.current?.toggle(e);
  }, []);

  const onVerDetalle = (row) => {
    if (!row) return;

    setRowDetail(row);
    actionMenuRef.current?.hide?.();
    setShowDetail(true);
  };

  const abrirModalBaja = (row, tipo = "simple") => {
    if (!row) return;

    actionMenuRef.current?.hide?.();
    setBajaRow(row);
    setBajaTipo(tipo);
    setBajaFecha(getTodayDateInput());
    setBajaVisible(true);
  };

  const cerrarModalBaja = () => {
    if (bajaSaving) return;

    setBajaVisible(false);
    setBajaFecha(getTodayDateInput());
    setBajaRow(null);
    setBajaTipo(null);
  };

  const registrarFechaBajaCounter = async (row, fechaBaja) => {
    const dniKey = toDniKey(row?.dni);

    if (!dniKey) {
      throw new Error("No se pudo registrar la baja: DNI inválido.");
    }

    if (!fechaBaja) {
      throw new Error("Seleccioná la fecha de baja.");
    }

    await fsSetDoc(
      fsDoc(db, "nuevoAfiliado_counters", dniKey),
      {
        fechaUltimaBaja: fechaBaja,
        fechasBaja: arrayUnion(fechaBaja),
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    );
  };

  const ejecutarEliminarSimple = async (row) => {
    const dniKey = toDniKey(row?.dni);
    if (!dniKey) throw new Error("No se pudo eliminar: DNI inválido.");

    const [usuarios, nuevoAfiliado, usuariosDni] = await Promise.all([
      buscarDocumentosPorDni("usuarios", dniKey, true),
      buscarDocumentosPorDni("nuevoAfiliado", dniKey, true),
      buscarDocumentosPorDni("usuarios_dni", dniKey, true),
    ]);

    const docsAEliminar = new Map();
    [...usuarios, ...nuevoAfiliado, ...usuariosDni].forEach((docSnap) => {
      docsAEliminar.set(docSnap.ref.path, docSnap.ref);
    });

    if (row?.origen === "usuarios" && row?.id) {
      docsAEliminar.set(`usuarios/${row.id}`, fsDoc(db, "usuarios", String(row.id)));
    }
    if (row?.origen === "nuevoAfiliado" && row?.id) {
      docsAEliminar.set(`nuevoAfiliado/${row.id}`, fsDoc(db, "nuevoAfiliado", String(row.id)));
    }
    if (row?.idUsuario) {
      docsAEliminar.set(`usuarios/${row.idUsuario}`, fsDoc(db, "usuarios", String(row.idUsuario)));
    }
    if (row?.idNuevo) {
      docsAEliminar.set(`nuevoAfiliado/${row.idNuevo}`, fsDoc(db, "nuevoAfiliado", String(row.idNuevo)));
    }
    docsAEliminar.set(`usuarios_dni/${dniKey}`, fsDoc(db, "usuarios_dni", dniKey));

    if (docsAEliminar.size === 0) {
      throw new Error("No se encontraron documentos para eliminar en usuarios ni en nuevoAfiliado.");
    }

    await Promise.all(Array.from(docsAEliminar.values()).map((ref) => fsDeleteDoc(ref)));

    setRowsNuevo((prev) => prev.filter((x) => toDniKey(x.dni) !== dniKey));
    setRowsUsuariosLocal((prev) => prev.filter((x) => toDniKey(x.dni) !== dniKey));
    setExtraUsuariosRows((prev) => prev.filter((x) => toDniKey(x.dni) !== dniKey));
  };

  const ejecutarEliminarAmbos = async (row) => {
    await ejecutarEliminarSimple(row);
  };

  const confirmarBajaYEliminar = async () => {
    if (!bajaRow) return;

    if (!bajaFecha) {
      showError("Seleccioná la fecha de baja.");
      return;
    }

    try {
      setBajaSaving(true);

      await registrarFechaBajaCounter(bajaRow, bajaFecha);

      if (bajaTipo === "ambos") {
        await ejecutarEliminarAmbos(bajaRow);
      } else {
        await ejecutarEliminarSimple(bajaRow);
      }

      setBajaVisible(false);
      setBajaFecha(getTodayDateInput());
      setBajaRow(null);
      setBajaTipo(null);

      showSuccess(
        bajaTipo === "ambos"
          ? "Fecha de baja registrada y afiliado eliminado en ambas colecciones."
          : "Fecha de baja registrada y afiliado eliminado correctamente."
      );
    } catch (e) {
      showError(e?.message || "Error al registrar la baja y eliminar.");
    } finally {
      setBajaSaving(false);
    }
  };

  const onEliminar = (row) => abrirModalBaja(row, "simple");

  const onEliminarAmbos = (row) => abrirModalBaja(row, "ambos");

  const buscarDocumentosPorDni = async (collectionName, dni, incluirDirecto = false) => {
    const encontrados = new Map();
    const agregar = (snap) => {
      if (snap?.exists?.()) encontrados.set(snap.ref.path, snap);
    };
    const agregarQuery = (snap) =>
      snap.docs.forEach((documento) => encontrados.set(documento.ref.path, documento));
    const variantes = getDniSearchVariants(dni);

    if (incluirDirecto) {
      for (const valor of variantes) {
        try {
          agregar(await fsGetDoc(fsDoc(db, collectionName, String(valor))));
        } catch {
          // La búsqueda por campo DNI continúa aunque el ID directo no exista.
        }
      }
    }

    const camposDni = ["dni", "DNI", "documento", "Documento", "nroDocumento", "numeroDocumento"];
    for (const campo of camposDni) {
      for (const valor of variantes) {
        const snap = await fsGetDocs(
          fsQuery(fsCollection(db, collectionName), where(campo, "==", valor))
        );
        agregarQuery(snap);
      }
    }

    return Array.from(encontrados.values());
  };

  const analizarFilaBajaMasiva = async (fila) => {
    if (!fila.dni) return { ...fila, valido: false, error: "DNI inválido" };
    if (!fila.periodo) {
      return { ...fila, valido: false, error: "Mes/año de baja inválido" };
    }
    if (fila.duplicado) {
      return { ...fila, valido: false, error: "DNI duplicado en el Excel" };
    }

    try {
      const [usuarios, nuevoAfiliado, usuariosDni, asistencias] = await Promise.all([
        buscarDocumentosPorDni("usuarios", fila.dni, true),
        buscarDocumentosPorDni("nuevoAfiliado", fila.dni, true),
        buscarDocumentosPorDni("usuarios_dni", fila.dni, true),
        buscarDocumentosPorDni("asistencia", fila.dni, false),
      ]);
      const referencia = usuarios[0]?.data?.() || nuevoAfiliado[0]?.data?.() || {};
      const total = usuarios.length + nuevoAfiliado.length + usuariosDni.length + asistencias.length;

      return {
        ...fila,
        nombre:
          fila.nombre ||
          [referencia.apellido, referencia.nombre].filter(Boolean).join(", ") ||
          referencia.apellidoNombre ||
          "Sin nombre",
        pathsUsuarios: usuarios.map((item) => item.ref.path),
        pathsNuevoAfiliado: nuevoAfiliado.map((item) => item.ref.path),
        pathsUsuariosDni: usuariosDni.map((item) => item.ref.path),
        pathsAsistencia: asistencias.map((item) => item.ref.path),
        cantidadUsuarios: usuarios.length,
        cantidadNuevoAfiliado: nuevoAfiliado.length,
        cantidadUsuariosDni: usuariosDni.length,
        cantidadAsistencias: asistencias.length,
        valido: total > 0,
        error: total > 0 ? "" : "Sin coincidencias en las colecciones",
      };
    } catch (error) {
      return { ...fila, valido: false, error: error?.message || "No se pudo validar el DNI" };
    }
  };

  const handleSelectExcelBajaMasiva = (e) => {
    const fileObj = e.files?.[0];
    if (!fileObj) return;
    setBajaMasivaAnalizando(true);

    ExcelRenderer(fileObj, async (err, resp) => {
      try {
        if (err) throw new Error("No se pudo leer el archivo Excel.");
        const rows = resp?.rows || [];
        const headerIndex = rows.slice(0, 15).findIndex((row) =>
          (row || []).some((cell) => normalizarEncabezadoBaja(cell) === "dni")
        );
        if (headerIndex < 0) throw new Error('El Excel debe incluir una columna "DNI".');

        const headers = rows[headerIndex].map(normalizarEncabezadoBaja);
        const dniIndex = headers.findIndex((header) => header === "dni");
        const periodoIndex = headers.findIndex(
          (header) => header.includes("mes de baja") || header.includes("fecha de baja")
        );
        const nombreIndex = headers.findIndex(
          (header) => header.includes("apellido") && header.includes("nombre")
        );
        const sistemaIndex = headers.findIndex((header) => header === "sistema");
        const departamentoIndex = headers.findIndex((header) => header === "departamento");

        if (periodoIndex < 0) {
          throw new Error('El Excel debe incluir una columna "MES DE BAJA" o "FECHA DE BAJA".');
        }

        const filasBase = rows
          .slice(headerIndex + 1)
          .map((row, index) => {
            const dni = toDniKey(row?.[dniIndex]);
            const periodo = parsePeriodoBaja(row?.[periodoIndex]);
            return {
              filaExcel: headerIndex + index + 2,
              dni,
              nombre: nombreIndex >= 0 ? String(row?.[nombreIndex] || "").trim() : "",
              sistema: sistemaIndex >= 0 ? String(row?.[sistemaIndex] || "").trim() : "",
              departamento: departamentoIndex >= 0 ? String(row?.[departamentoIndex] || "").trim() : "",
              periodo: periodo?.periodo || "",
              periodoLabel: periodo?.label || String(row?.[periodoIndex] || "").trim(),
              mesBaja: periodo?.mes || null,
              anioBaja: periodo?.anio || null,
            };
          })
          .filter((fila) => fila.dni || fila.periodoLabel);

        if (!filasBase.length) throw new Error("El Excel no contiene filas para procesar.");

        const repeticiones = filasBase.reduce((map, fila) => {
          if (fila.dni) map.set(fila.dni, (map.get(fila.dni) || 0) + 1);
          return map;
        }, new Map());
        const preparadas = filasBase.map((fila) => ({
          ...fila,
          duplicado: fila.dni && repeticiones.get(fila.dni) > 1,
        }));
        const analizadas = [];

        for (let i = 0; i < preparadas.length; i += 10) {
          const bloque = await Promise.all(
            preparadas.slice(i, i + 10).map(analizarFilaBajaMasiva)
          );
          analizadas.push(...bloque);
        }

        setBajaMasivaArchivo(fileObj.name || "bajas.xlsx");
        setBajaMasivaRows(analizadas);
        setBajaMasivaVisible(true);
      } catch (error) {
        showError(error?.message || "No se pudo analizar el Excel de bajas.");
      } finally {
        setBajaMasivaAnalizando(false);
        e.options?.clear?.();
      }
    });
  };

  const cerrarBajaMasiva = () => {
    if (bajaMasivaProcesando) return;
    setBajaMasivaVisible(false);
    setBajaMasivaRows([]);
    setBajaMasivaArchivo("");
  };

  const confirmarBajaMasiva = async () => {
    const filasValidas = bajaMasivaRows.filter((fila) => fila.valido);
    if (!filasValidas.length) return showError("No hay filas válidas para eliminar.");

    setBajaMasivaProcesando(true);
    const eliminados = [];
    const errores = [];

    for (const fila of filasValidas) {
      try {
        const [usuariosActuales, nuevoActuales, usuariosDniActuales, asistenciasActuales] = await Promise.all([
          buscarDocumentosPorDni("usuarios", fila.dni, true),
          buscarDocumentosPorDni("nuevoAfiliado", fila.dni, true),
          buscarDocumentosPorDni("usuarios_dni", fila.dni, true),
          buscarDocumentosPorDni("asistencia", fila.dni, false),
        ]);
        const paths = Array.from(
          new Set([
            ...fila.pathsUsuarios,
            ...fila.pathsNuevoAfiliado,
            ...(fila.pathsUsuariosDni || []),
            ...fila.pathsAsistencia,
            ...usuariosActuales.map((item) => item.ref.path),
            ...nuevoActuales.map((item) => item.ref.path),
            ...usuariosDniActuales.map((item) => item.ref.path),
            ...asistenciasActuales.map((item) => item.ref.path),
          ])
        );
        const operaciones = [
          { tipo: "counter" },
          ...paths.map((path) => ({ tipo: "delete", path })),
        ];

        for (let i = 0; i < operaciones.length; i += 450) {
          const batch = fsWriteBatch(db);
          operaciones.slice(i, i + 450).forEach((operacion) => {
            if (operacion.tipo === "counter") {
              batch.set(
                fsDoc(db, "nuevoAfiliado_counters", fila.dni),
                {
                  fechaUltimaBaja: fila.periodo,
                  fechasBaja: arrayUnion(fila.periodo),
                  mesBaja: fila.mesBaja,
                  anioBaja: fila.anioBaja,
                  bajaMasivaArchivo,
                  updatedAt: serverTimestamp(),
                },
                { merge: true }
              );
            } else {
              batch.delete(fsDoc(db, operacion.path));
            }
          });
          await batch.commit();
        }
        eliminados.push(fila);
      } catch (error) {
        errores.push({ ...fila, error: error?.message || "Error durante la eliminación" });
      }
    }

    const dnisEliminados = new Set(eliminados.map((fila) => fila.dni));
    setRowsNuevo((prev) => prev.filter((row) => !dnisEliminados.has(toDniKey(row.dni))));
    setRowsUsuariosLocal((prev) => prev.filter((row) => !dnisEliminados.has(toDniKey(row.dni))));
    setExtraUsuariosRows((prev) => prev.filter((row) => !dnisEliminados.has(toDniKey(row.dni))));
    setBajaMasivaProcesando(false);

    if (errores.length) {
      setBajaMasivaRows(errores.map((fila) => ({ ...fila, valido: false })));
      showError(`Se eliminaron ${eliminados.length} afiliados y fallaron ${errores.length}.`);
      return;
    }

    cerrarBajaMasiva();
    showSuccess(`Baja masiva completada: ${eliminados.length} afiliados eliminados junto con sus asistencias.`);
  };

  // ✅ NUEVO: reiniciar dispositivo vinculado para asistencia QR
  const resetDispositivoDocumento = async ({ collectionName, id }) => {
    if (!collectionName || !id) return null;

    const ref = fsDoc(db, collectionName, String(id));
    const snap = await fsGetDoc(ref);

    if (!snap.exists()) return null;

    const data = snap.data() || {};
    const dispositivoAnteriorId = data.dispositivoAsistenciaId ?? null;

    const patch = {
      dispositivoAnteriorId,
      dispositivoAnteriorModelo:
        data.dispositivoModelo || data.dispositivoCodigoModelo || null,
      dispositivoAsistenciaId: null,
      asistenciaDispositivoVinculado: false,
      dispositivoBloqueado: false,
      dispositivoModelo: null,
      dispositivoCodigoModelo: null,
      dispositivoPlataforma: null,
      dispositivoUserAgent: null,

      // Limpieza de fechas del vínculo anterior para evitar confusión visual
      dispositivoVinculadoEn: null,
      dispositivoVinculadoDesde: null,
      dispositivoUltimaValidacionEn: null,

      // Trazabilidad administrativa
      dispositivoReiniciadoEn: new Date().toISOString(),
      dispositivoReiniciadoPor: getAdminLabel(),
      dispositivoReinicioMotivo: "reinicio_desde_web_administrativa",
    };

    await fsUpdateDoc(ref, patch);

    return {
      collectionName,
      id: String(id),
      patch,
    };
  };

  const obtenerDocumentosParaReiniciarDispositivo = async (row) => {
    const targets = new Map();
    const agregar = (collectionName, id) => {
      if (!collectionName || !id) return;
      const key = `${collectionName}/${String(id)}`;
      targets.set(key, { collectionName, id: String(id) });
    };

    agregar("nuevoAfiliado", row?.idNuevo);
    agregar("usuarios", row?.idUsuario);

    if (row?.origen === "usuarios") agregar("usuarios", row?.id);
    if (row?.origen === "nuevoAfiliado") agregar("nuevoAfiliado", row?.id);

    const dniTexto = String(row?.dni || "").replace(/\D/g, "");
    if (!dniTexto) return Array.from(targets.values());

    await Promise.all(
      ["usuarios", "nuevoAfiliado"].map(async (collectionName) => {
        const valoresDni = [dniTexto];
        const dniNumero = Number(dniTexto);
        if (Number.isFinite(dniNumero)) valoresDni.push(dniNumero);

        await Promise.all(
          valoresDni.map(async (dniValue) => {
            try {
              const snap = await fsGetDocs(
                fsQuery(
                  fsCollection(db, collectionName),
                  where("dni", "==", dniValue)
                )
              );
              snap.docs.forEach((documento) =>
                agregar(collectionName, documento.id)
              );
            } catch (error) {
              console.error(
                `No se pudo buscar el DNI en ${collectionName}:`,
                error
              );
            }
          })
        );
      })
    );

    return Array.from(targets.values());
  };

  const onReiniciarDispositivoAsistencia = (row) => {
    if (!row) return;

    actionMenuRef.current?.hide?.();

    const estadoActual = getEstadoDispositivoLabel(row);
    const deviceVisible = shortDeviceId(row.dispositivoAsistenciaId);
    const modeloDispositivo =
      row.dispositivoModelo || row.dispositivoCodigoModelo || "No informado";
    const fechaVinculacion = formatFechaHoraDispositivo(
      row.dispositivoVinculadoEn
    );

    confirmDialog({
      header: "Reiniciar dispositivo de asistencia",
      icon: "pi pi-exclamation-triangle",
      message: (
        <div style={{ display: "grid", gap: 8 }}>
          <div>
            ¿Desea reiniciar el dispositivo vinculado a{" "}
            <strong>
              {row.apellido}, {row.nombre}
            </strong>{" "}
            DNI <strong>{row.dni}</strong>?
          </div>

          <div style={{ fontSize: 13, color: "#475569" }}>
            <div>
              <strong>Estado actual:</strong> {estadoActual}
            </div>
            <div>
              <strong>ID dispositivo:</strong> {deviceVisible}
            </div>
            <div>
              <strong>Modelo:</strong> {modeloDispositivo}
            </div>
            <div>
              <strong>Vinculado:</strong> {fechaVinculacion}
            </div>
          </div>

          <div style={{ fontSize: 13 }}>
            Esta acción permitirá que el afiliado pueda vincular un nuevo
            celular la próxima vez que registre asistencia por QR. No se
            eliminarán sus asistencias anteriores.
          </div>
        </div>
      ),
      acceptLabel: "Sí, reiniciar",
      rejectLabel: "Cancelar",
      acceptClassName: "p-button-warning",
      accept: async () => {
        try {
          const targets = await obtenerDocumentosParaReiniciarDispositivo(row);

          if (!targets.length) {
            throw new Error("No se pudo determinar la colección del afiliado.");
          }

          const resultsRaw = await Promise.all(
            targets.map((target) => resetDispositivoDocumento(target))
          );

          const results = resultsRaw.filter(Boolean);

          if (!results.length) {
            throw new Error(
              "No se encontró el documento del afiliado para reiniciar el dispositivo."
            );
          }

          results.forEach(({ collectionName, id, patch }) => {
            if (collectionName === "nuevoAfiliado") {
              setRowsNuevo((prev) =>
                prev.map((r) => (String(r.id) === String(id) ? { ...r, ...patch } : r))
              );
            }

            if (collectionName === "usuarios") {
              setRowsUsuariosLocal((prev) =>
                prev.map((r) => (String(r.id) === String(id) ? { ...r, ...patch } : r))
              );

              setExtraUsuariosRows((prev) =>
                prev.map((r) => (String(r.id) === String(id) ? { ...r, ...patch } : r))
              );
            }
          });

          const firstPatch = results[0]?.patch || {};

          setCurrentRow((prev) => (prev ? { ...prev, ...firstPatch } : prev));

          setRowDetail((prev) => {
            if (!prev) return prev;

            const sameMainId = String(prev.id) === String(row.id);
            const sameNuevo =
              prev.idNuevo && row.idNuevo && String(prev.idNuevo) === String(row.idNuevo);
            const sameUsuario =
              prev.idUsuario &&
              row.idUsuario &&
              String(prev.idUsuario) === String(row.idUsuario);

            if (sameMainId || sameNuevo || sameUsuario) {
              return { ...prev, ...firstPatch };
            }

            return prev;
          });

          showSuccess("Dispositivo de asistencia reiniciado correctamente.");
        } catch (e) {
          showError(e?.message || "No se pudo reiniciar el dispositivo.");
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
      mesaNro: row.mesaNro ?? "",
      lugarVotacion: row.lugarVotacion ?? "",
      descuento: row.descuento ?? "",
      nroAfiliacion: String(row.nroAfiliacion ?? ""),
      observaciones: row.observaciones ?? "",
      adherente: typeof row.adherente === "boolean" ? row.adherente : false,
      tituloGrado: row.tituloGrado ?? "",
      activo: typeof row.activo === "boolean" ? row.activo : true,
      motivo: row.motivo ?? "",
      cotizante: typeof row.cotizante === "boolean" ? row.cotizante : false,
    });

    setEditVisible(true);
  };

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
      mesaNro: row.mesaNro ?? "",
      lugarVotacion: row.lugarVotacion ?? "",
      descuento: row.descuento ?? "",
      nroAfiliacion: String(row.nroAfiliacion ?? ""),
      observaciones: row.observaciones ?? "",
      adherente: typeof row.adherente === "boolean" ? row.adherente : false,
      tituloGrado: row.tituloGrado ?? "",
      activo: typeof row.activo === "boolean" ? row.activo : true,
      motivo: row.motivo ?? "",
      cotizante: typeof row.cotizante === "boolean" ? row.cotizante : false,
    });

    setEditVisible(true);
  };

  const menuModel = useMemo(() => {
    if (!currentRow) return [];

    if (currentRow.origen === "ambos") {
      return [
        {
          label: "Ver",
          icon: "pi pi-eye",
          command: () => onVerDetalle(currentRow),
        },
        {
          label: "Editar (ambas)",
          icon: "pi pi-pencil",
          command: () => openEditBoth(currentRow),
        },
        {
          label: "Reiniciar dispositivo de asistencia",
          icon: "pi pi-mobile",
          command: () => onReiniciarDispositivoAsistencia(currentRow),
        },
        { separator: true },
        {
          label: "Eliminar (ambas)",
          icon: "pi pi-trash",
          className: "p-menuitem-danger",
          command: () => onEliminarAmbos(currentRow),
        },
      ];
    }

    return [
      {
        label: "Ver",
        icon: "pi pi-eye",
        command: () => onVerDetalle(currentRow),
      },
      {
        label: "Editar",
        icon: "pi pi-pencil",
        command: () => openEdit(currentRow),
      },
      {
        label: "Reiniciar dispositivo de asistencia",
        icon: "pi pi-mobile",
        command: () => onReiniciarDispositivoAsistencia(currentRow),
      },
      { separator: true },
      {
        label: "Eliminar",
        icon: "pi pi-trash",
        className: "p-menuitem-danger",
        command: () => onEliminar(currentRow),
      },
    ];
  }, [currentRow]);

  // 8) Export unificado
  const handleExportExcel = async () => {
    try {
      setExporting(true);
      setExportModal(true);
      setExportMsg("Leyendo colección nuevoAfiliado…");

      const allNuevoPromise = fetchAllDocsPaged(
        "nuevoAfiliado",
        mapNuevoDocToRow,
        1000
      );

      const allUsuariosPromise = (async () => {
        const allNuevo = await allNuevoPromise;

        setExportMsg("Leyendo colección usuarios…");

        const allUsuarios = await fetchAllDocsPaged(
          "usuarios",
          mapUsuarioDocToRow,
          1000
        );

        return { allNuevo, allUsuarios };
      })();

      const { allNuevo, allUsuarios } = await allUsuariosPromise;

      setExportMsg("Unificando registros por DNI…");

      const unified = unifyByDni(allNuevo, allUsuarios);

      setExportMsg("Preparando datos…");

      const sorted = [...unified].sort((a, b) => {
        const sa = a.hora ? `${a.fecha} ${a.hora}` : a.fecha || "";
        const sb = b.hora ? `${b.fecha} ${b.hora}` : b.fecha || "";
        return toTimestamp(sb) - toTimestamp(sa);
      });

      const qn = norm(query);
      const dataset = qn
        ? sorted.filter((r) => r.haystack.includes(qn))
        : sorted;

      setExportMsg("Generando Excel…");

      const data = dataset.map((d) => ({
        Fecha: d.fecha || "",
        Hora: d.hora || "",
        Nombre: d.nombre || "",
        Apellido: d.apellido || "",
        DNI: d.dni || "",
        Afiliación: d.nroAfiliacion ? Number(d.nroAfiliacion) : "",
        Departamento: d.departamento || "",
        "Lugar de Votación": d.lugarVotacion || "",
        "Mesa N°": d.mesaNro || "",
        Establecimientos: d.establecimientos || "",
        Celular: d.celular || "",
        Email: d.email || "",
        "Título de grado (nombre de la carrera)": d.tituloGrado || "",
        Descuento: toSiNo(d.descuento) || "",
        Código: d.cod ?? "",
        Origen: d.origen,
        ID: d.id,
        "Dispositivo asistencia": d.dispositivoAsistenciaId || "",
        "Estado dispositivo": getEstadoDispositivoLabel(d),
        "Dispositivo bloqueado": d.dispositivoBloqueado ? "Sí" : "No",
        "Dispositivo reiniciado en": d.dispositivoReiniciadoEn || "",
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

  // 9) Edición
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
      return toast.current?.show({
        severity: "error",
        summary: "Error",
        detail: error,
        life: 4000,
      });
    }

    try {
      setSaving(true);

      // 🔹 Edición en ambas colecciones
      if (editOrigin === "ambas") {
        const idN = rowIdBoth.nuevo;
        const idU = rowIdBoth.usuario;

        if (payload.nroAfiliacion !== "" && idN) {
          const duplicated = await validateDuplicateNroAfiliacion(
            payload.dni,
            payload.nroAfiliacion,
            idN
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

        if (idN) {
          const res = await dispatch(
            updateAfiliadoById({ id: idN, data: payload })
          );

          if (res?.meta?.requestStatus === "rejected") {
            throw new Error(
              res?.payload || "No se pudo actualizar nuevoAfiliado."
            );
          }

          setRowsNuevo((prev) =>
            prev.map((r) => (r.id === idN ? { ...r, ...payload } : r))
          );
        }

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
          mesaNro: payload.mesaNro ?? "",
          lugarVotacion: payload.lugarVotacion ?? "",
        };

        if (idU) {
          const ref = fsDoc(db, "usuarios", String(idU));
          const snap = await fsGetDoc(ref);

          if (snap.exists()) {
            await fsUpdateDoc(ref, payloadUsuarios);
          } else {
            await fsSetDoc(ref, payloadUsuarios, { merge: true });
          }

          setRowsUsuariosLocal((prev) =>
            prev.map((r) => (r.id === idU ? { ...r, ...payloadUsuarios } : r))
          );

          setExtraUsuariosRows((prev) =>
            prev.map((r) => (r.id === idU ? { ...r, ...payloadUsuarios } : r))
          );
        } else {
          const altId = String(payload.dni).trim();
          const refAlt = fsDoc(db, "usuarios", altId);

          await fsSetDoc(refAlt, payloadUsuarios, { merge: true });

          setRowsUsuariosLocal((prev) =>
            prev.map((r) =>
              r.id === altId ? { ...r, ...payloadUsuarios } : r
            )
          );

          setExtraUsuariosRows((prev) =>
            prev.map((r) =>
              r.id === altId ? { ...r, ...payloadUsuarios } : r
            )
          );
        }

        const dniKey = String(payload.dni || "").trim();

        await syncAdherentesForPayload(
          dniKey,
          payload,
          idN || rowIdBoth.usuario || dniKey
        );

        showSuccess("Registro actualizado en ambas colecciones.");
        closeEdit();
        return;
      }

      // nuevoAfiliado
      if (editOrigin === "nuevoAfiliado") {
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

        const res = await dispatch(
          updateAfiliadoById({ id: rowId, data: payload })
        );

        if (res?.meta?.requestStatus === "rejected") {
          throw new Error(res?.payload || "No se pudo actualizar el afiliado.");
        }

        setRowsNuevo((prevArr) =>
          prevArr.map((r) => (r.id === rowId ? { ...r, ...payload } : r))
        );

        const prevAdherente = initialForm.adherente === true;
        const nextAdherente = !!payload.adherente;
        const dniKey = String(payload.dni || "").trim();
        const nextActivo =
          typeof payload.activo === "boolean" ? payload.activo : true;

        if (prevAdherente && !nextAdherente) {
          await fsUpdateDoc(fsDoc(db, "nuevoAfiliado", String(rowId)), {
            observaciones: payload.observaciones ?? "",
          });
        }

        if (!nextAdherente || !nextActivo) {
          const q = fsQuery(
            fsCollection(db, "adherentes"),
            where("dni", "==", dniKey)
          );

          const snap = await fsGetDocs(q);

          if (!snap.empty) {
            await Promise.all(snap.docs.map((d) => fsDeleteDoc(d.ref)));
          }
        } else {
          await syncAdherentesForPayload(dniKey, payload, rowId);
        }
      } else {
        // usuarios
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
          mesaNro: payload.mesaNro ?? "",
          lugarVotacion: payload.lugarVotacion ?? "",
        };

        await fsUpdateDoc(ref, payloadUsuarios);

        const dniKey = String(payload.dni || "").trim();

        await syncAdherentesForPayload(dniKey, payload, rowId);

        setRowsUsuariosLocal((prev) =>
          prev.map((r) => (r.id === rowId ? { ...r, ...payloadUsuarios } : r))
        );

        setExtraUsuariosRows((prev) =>
          prev.map((r) => (r.id === rowId ? { ...r, ...payloadUsuarios } : r))
        );
      }

      showSuccess("Registro actualizado correctamente.");
      closeEdit();
    } catch (err) {
      showError(err?.message || "Error al actualizar el registro.");
    } finally {
      setSaving(false);
    }
  };

  // =========================================
  // 🔹 LECTURA DE EXCEL + CONFIGURAR CAMPOS
  // =========================================
  const handleSelectExcel = (e) => {
    const fileObj = e.files?.[0];

    if (!fileObj) return;

    ExcelRenderer(fileObj, (err, resp) => {
      if (err) {
        console.error(err);
        showError("No se pudo leer el archivo Excel.");

        if (e.options?.clear) e.options.clear();

        return;
      }

      const rows = resp?.rows || [];

      if (!rows.length) {
        showError("El archivo Excel está vacío.");

        if (e.options?.clear) e.options.clear();

        return;
      }

      const headerRow = rows[0] || [];
      const fieldMap = {};

      headerRow.forEach((colName, idx) => {
        const f = normalizeFieldName(colName);
        if (f) fieldMap[f] = idx;
      });

      if (!fieldMap.dni) {
        showError(
          'El archivo debe incluir una columna "DNI" (o equivalente) en el encabezado.'
        );

        if (e.options?.clear) e.options.clear();

        return;
      }

      const usable = Object.keys(fieldMap).filter(
        (f) => !["dni", "nombre", "apellido"].includes(f)
      );

      if (!usable.length) {
        showError(
          "El Excel no contiene campos editables además de DNI / Nombre / Apellido."
        );

        if (e.options?.clear) e.options.clear();

        return;
      }

      setExcelMeta({ rows, headerRow, fieldMap });

      setForceFields(
        usable.reduce((acc, f) => {
          acc[f] = false;
          return acc;
        }, {})
      );

      // 🔹 Calcular estadísticas por campo
      try {
        const unified = unifyByDni(rowsNuevo, rowsUsuariosMerged);
        const mapByDni = new Map();

        unified.forEach((r) => {
          const key = toDniKey(r.dni);
          if (key) mapByDni.set(key, r);
        });

        const stats = {};

        usable.forEach((f) => {
          stats[f] = { willAuto: 0, needForce: 0 };
        });

        for (let i = 1; i < rows.length; i++) {
          const excelRow = rows[i];

          if (!excelRow) continue;

          const rawDni = excelRow[fieldMap.dni];
          const dniKey = toDniKey(rawDni);

          if (!dniKey) continue;

          const current = mapByDni.get(dniKey);

          if (!current) continue;

          for (const f of usable) {
            const colIdx = fieldMap[f];

            if (colIdx == null) continue;

            const raw = excelRow[colIdx];
            const normalized = normalizeExcelValue(f, raw);

            if (normalized === undefined || normalized === "") continue;

            const prev = current[f];

            const isPrevEmpty =
              prev === undefined ||
              prev === null ||
              (typeof prev === "string" && prev.trim() === "");

            if (isPrevEmpty) {
              stats[f].willAuto += 1;
            } else {
              stats[f].needForce += 1;
            }
          }
        }

        setExcelFieldStats(stats);
      } catch (errStat) {
        console.error("Error calculando estadísticas de Excel:", errStat);
        setExcelFieldStats({});
      }

      setExcelConfigVisible(true);

      if (e.options?.clear) e.options.clear();
    });
  };

  // =========================================
  // 🔹 PROCESAR IMPORTACIÓN DESDE EXCEL
  // =========================================
  const runImportFromExcel = async () => {
    if (!excelMeta) return;

    const { rows, fieldMap } = excelMeta;
    const total = rows.length - 1;

    if (total <= 0) {
      showError("El Excel no tiene filas de datos.");
      return;
    }

    setExcelConfigVisible(false);
    setImportProcessVisible(true);
    setImportProgress(0);

    const updated = [];
    const errors = [];

    // 🔹 Usamos todo nuevoAfiliado
    const mapNuevo = new Map();

    rowsNuevo.forEach((r) => {
      const k = toDniKey(r.dni);
      if (k) mapNuevo.set(k, r);
    });

    // 🔹 Leemos TODOS los usuarios para la importación
    const allUsuariosForImport = await fetchAllDocsPaged(
      "usuarios",
      mapUsuarioDocToRow,
      1000
    );

    const mapUsuarios = new Map();

    allUsuariosForImport.forEach((r) => {
      const k = toDniKey(r.dni);
      if (k) mapUsuarios.set(k, r);
    });

    for (let i = 1; i < rows.length; i++) {
      const excelRow = rows[i];

      if (!excelRow) continue;

      const rawDni = excelRow[fieldMap.dni];
      const dniKey = toDniKey(rawDni);

      if (!dniKey) {
        errors.push({
          row: i + 1,
          dni: rawDni || "",
          reason: "DNI vacío o inválido",
        });

        continue;
      }

      const currentNuevo = mapNuevo.get(dniKey);
      const currentUsuario = mapUsuarios.get(dniKey);

      if (!currentNuevo && !currentUsuario) {
        errors.push({
          row: i + 1,
          dni: dniKey,
          reason: "No se encontró en usuarios ni en nuevoAfiliado",
        });

        continue;
      }

      const patchNuevo = currentNuevo
        ? buildPatchFromExcelRow(excelRow, fieldMap, forceFields, currentNuevo)
        : {};

      const patchUsuario = currentUsuario
        ? buildPatchFromExcelRow(
            excelRow,
            fieldMap,
            forceFields,
            currentUsuario
          )
        : {};

      if (
        (!patchNuevo || !Object.keys(patchNuevo).length) &&
        (!patchUsuario || !Object.keys(patchUsuario).length)
      ) {
        updated.push({
          row: i + 1,
          dni: dniKey,
          note: "Sin cambios (ya tenía datos o celdas vacías).",
        });

        setImportProgress(Math.round((i / total) * 100));

        continue;
      }

      try {
        if (currentNuevo && Object.keys(patchNuevo).length) {
          await fsUpdateDoc(
            fsDoc(db, "nuevoAfiliado", String(currentNuevo.id)),
            patchNuevo
          );

          setRowsNuevo((prev) =>
            prev.map((r) =>
              r.id === currentNuevo.id ? { ...r, ...patchNuevo } : r
            )
          );
        }

        if (currentUsuario && Object.keys(patchUsuario).length) {
          await fsUpdateDoc(
            fsDoc(db, "usuarios", String(currentUsuario.id)),
            patchUsuario
          );

          const mergedUsuario = { ...currentUsuario, ...patchUsuario };
          const dniStr = String(mergedUsuario.dni || "").trim();

          if (
            "adherente" in patchUsuario ||
            "activo" in patchUsuario ||
            "motivo" in patchUsuario ||
            "departamento" in patchUsuario ||
            "nroAfiliacion" in patchUsuario
          ) {
            await syncAdherentesForPayload(
              dniStr,
              mergedUsuario,
              currentUsuario.id
            );
          }

          setRowsUsuariosLocal((prev) =>
            prev.map((r) =>
              r.id === currentUsuario.id ? { ...r, ...patchUsuario } : r
            )
          );

          setExtraUsuariosRows((prev) =>
            prev.map((r) =>
              r.id === currentUsuario.id ? { ...r, ...patchUsuario } : r
            )
          );
        }

        updated.push({ row: i + 1, dni: dniKey });
      } catch (err) {
        console.error(err);

        errors.push({
          row: i + 1,
          dni: dniKey,
          reason: err?.message || "Error al actualizar",
        });
      }

      setImportProgress(Math.round((i / total) * 100));
    }

    setImportProcessVisible(false);
    setImportResult({ updated, errors });
    setImportResultVisible(true);
    setExcelMeta(null);
  };

  return (
    <div style={{ display: "grid", gap: 12 }}>
      <Toast ref={toast} />
      <ConfirmDialog />
      <Menu model={menuModel} popup ref={actionMenuRef} id="row_actions_menu" />

      {/* Header + contadores + export + importar Excel */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: 8,
          flexWrap: "wrap",
        }}
      >
        <h3 style={{ margin: 0 }}>Afiliado Actualizado</h3>

        <div
          style={{
            display: "flex",
            gap: 8,
            alignItems: "center",
            flexWrap: "wrap",
          }}
        >
          <span className="p-tag p-tag-info">nuevoAfiliado: {countNuevo}</span>

          <span className="p-tag p-tag-secondary">
            usuarios: {countUsuarios}
          </span>

          <span className="p-tag">
            mostrando: {pageRows.length} / {totalFiltered}
          </span>

          {/* IMPORTAR EXCEL */}
          <FileUpload
            name="excel"
            mode="basic"
            accept=".xls,.xlsx"
            maxFileSize={5_000_000}
            chooseLabel="Subir archivo Excel para actualizar"
            customUpload
            uploadHandler={handleSelectExcel}
            auto
            className="p-button-sm p-button-warning"
          />

          <FileUpload
            name="excel_bajas"
            mode="basic"
            accept=".xls,.xlsx"
            maxFileSize={5_000_000}
            chooseLabel={
              bajaMasivaAnalizando
                ? "Analizando bajas..."
                : "Baja masiva desde Excel"
            }
            customUpload
            uploadHandler={handleSelectExcelBajaMasiva}
            auto
            disabled={bajaMasivaAnalizando || bajaMasivaProcesando}
            className="p-button-sm p-button-danger"
          />

          {/* EXPORTAR */}
          <Button
            label={
              exporting
                ? "Preparando Excel..."
                : "Descargar Lista (Base/resultado completo)"
            }
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
        <div
          style={{
            padding: 48,
            minHeight: 240,
            display: "grid",
            placeItems: "center",
          }}
        >
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

      {/* Modales detalle / edición */}
      <ViewDialog
        visible={showDetail}
        data={rowDetail}
        onClose={() => {
          setShowDetail(false);
          setRowDetail(null);
        }}
      />

      <EditAfiliadoDialog
        visible={editVisible}
        initialForm={initialForm}
        departamentosOptions={departamentosOptions}
        onCancel={closeEdit}
        onSave={handleSaveEdit}
        saving={saving}
        showActivo={false}
      />

      {/* Modal baja con fecha antes de eliminar */}
      <Dialog
        header="Registrar fecha de baja"
        visible={bajaVisible}
        modal
        closable={!bajaSaving}
        style={{ width: 520, maxWidth: "95vw" }}
        onHide={cerrarModalBaja}
        footer={
          <div
            style={{
              display: "flex",
              justifyContent: "flex-end",
              gap: 8,
              flexWrap: "wrap",
            }}
          >
            <Button
              label="Cancelar"
              className="p-button-text"
              onClick={cerrarModalBaja}
              disabled={bajaSaving}
            />
            <Button
              label={
                bajaSaving
                  ? "Procesando..."
                  : bajaTipo === "ambos"
                  ? "Registrar baja y eliminar en ambas"
                  : "Registrar baja y eliminar"
              }
              icon={bajaSaving ? "pi pi-spin pi-spinner" : "pi pi-trash"}
              className="p-button-danger"
              onClick={confirmarBajaYEliminar}
              disabled={bajaSaving || !bajaFecha}
            />
          </div>
        }
      >
        <div style={{ display: "grid", gap: 12 }}>
          <div
            style={{
              border: "1px solid #fecaca",
              background: "#fff7f7",
              borderRadius: 8,
              padding: 12,
              color: "#7f1d1d",
              fontSize: 14,
            }}
          >
            Antes de eliminar el registro, se guardará la fecha de baja en
            <strong>
              {" "}
              nuevoAfiliado_counters/{toDniKey(bajaRow?.dni) || "DNI"}
            </strong>
            . El contador <strong>last</strong> no se modifica.
          </div>

          {bajaRow && (
            <div style={{ display: "grid", gap: 6, fontSize: 14 }}>
              <div>
                <strong>Afiliado:</strong> {bajaRow.apellido || ""},{" "}
                {bajaRow.nombre || ""}
              </div>
              <div>
                <strong>DNI:</strong> {bajaRow.dni || "—"}
              </div>
              <div>
                <strong>Origen:</strong>{" "}
                {bajaTipo === "ambos"
                  ? "nuevoAfiliado + usuarios"
                  : bajaRow.origen}
              </div>
            </div>
          )}

          <div className="p-field" style={{ display: "grid", gap: 6 }}>
            <label htmlFor="fecha_baja_afiliado">
              <strong>Fecha de baja</strong>
            </label>
            <input
              id="fecha_baja_afiliado"
              type="date"
              value={bajaFecha}
              onChange={(e) => setBajaFecha(e.target.value)}
              disabled={bajaSaving}
              style={{
                width: "100%",
                padding: "10px 12px",
                borderRadius: 8,
                border: "1px solid #d1d5db",
                fontSize: 15,
              }}
            />
          </div>

          <small style={{ color: "#64748b", lineHeight: 1.4 }}>
            Se guardarán los campos <strong>fechaUltimaBaja</strong> y
            <strong> fechasBaja</strong>. No se agregan motivos ni otra
            colección.
          </small>
        </div>
      </Dialog>

      <Dialog
        header="Confirmar baja masiva desde Excel"
        visible={bajaMasivaVisible}
        modal
        closable={!bajaMasivaProcesando}
        style={{ width: "95vw", maxWidth: 1250 }}
        onHide={cerrarBajaMasiva}
        footer={
          <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
            <Button
              label="Cancelar"
              className="p-button-text"
              onClick={cerrarBajaMasiva}
              disabled={bajaMasivaProcesando}
            />
            <Button
              label={
                bajaMasivaProcesando
                  ? "Eliminando..."
                  : `Confirmar y eliminar ${bajaMasivaRows.filter((fila) => fila.valido).length}`
              }
              icon={
                bajaMasivaProcesando ? "pi pi-spin pi-spinner" : "pi pi-trash"
              }
              className="p-button-danger"
              onClick={confirmarBajaMasiva}
              disabled={
                bajaMasivaProcesando ||
                bajaMasivaRows.filter((fila) => fila.valido).length === 0
              }
            />
          </div>
        }
      >
        <div style={{ display: "grid", gap: 14 }}>
          <div
            style={{
              border: "1px solid #fecaca",
              background: "#fff7f7",
              color: "#7f1d1d",
              borderRadius: 8,
              padding: 12,
              lineHeight: 1.45,
            }}
          >
            <strong>Acción irreversible.</strong> Se guardará el mes y año de baja
            en <strong>nuevoAfiliado_counters</strong> y luego se eliminarán las
            coincidencias encontradas en <strong>usuarios</strong>,{" "}
            <strong>nuevoAfiliado</strong>, <strong>usuarios_dni</strong> y{" "}
            <strong>asistencia</strong>. Las filas
            inválidas no serán procesadas.
          </div>

          <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
            <strong>Archivo: {bajaMasivaArchivo || "—"}</strong>
            <span>Total: {bajaMasivaRows.length}</span>
            <span style={{ color: "#166534" }}>
              Válidas: {bajaMasivaRows.filter((fila) => fila.valido).length}
            </span>
            <span style={{ color: "#991b1b" }}>
              Omitidas: {bajaMasivaRows.filter((fila) => !fila.valido).length}
            </span>
          </div>

          <DataTable
            value={bajaMasivaRows}
            dataKey="filaExcel"
            scrollable
            scrollHeight="55vh"
            stripedRows
            emptyMessage="No hay filas para mostrar."
          >
            <Column field="filaExcel" header="Fila" style={{ width: 70 }} />
            <Column field="nombre" header="Apellido y nombre" />
            <Column field="dni" header="DNI" style={{ width: 120 }} />
            <Column field="sistema" header="Sistema" />
            <Column field="departamento" header="Departamento" />
            <Column field="periodoLabel" header="Mes de baja" />
            <Column field="cantidadUsuarios" header="Usuarios" style={{ width: 90 }} />
            <Column
              field="cantidadNuevoAfiliado"
              header="Nuevo afiliado"
              style={{ width: 120 }}
            />
            <Column
              field="cantidadUsuariosDni"
              header="usuarios_dni"
              style={{ width: 115 }}
            />
            <Column
              field="cantidadAsistencias"
              header="Asistencias"
              style={{ width: 105 }}
            />
            <Column
              header="Validación"
              body={(fila) => (
                <span
                  style={{
                    color: fila.valido ? "#166534" : "#991b1b",
                    fontWeight: 700,
                  }}
                >
                  {fila.valido ? "Lista para eliminar" : fila.error || "Omitida"}
                </span>
              )}
            />
          </DataTable>
        </div>
      </Dialog>

      {/* Modal progreso export */}
      <Dialog
        header="Exportando Excel"
        visible={exportModal}
        modal
        closable={false}
        blockScroll
        style={{ width: 480, maxWidth: "90vw" }}
        contentStyle={{ paddingTop: 8 }}
      >
        <div style={{ display: "grid", gap: 12 }}>
          <div style={{ fontSize: 14 }}>{exportMsg}</div>

          <ProgressBar mode="indeterminate" style={{ height: 6 }} />

          <div style={{ fontSize: 12, opacity: 0.8 }}>
            Esto puede tardar unos segundos. No cierres esta ventana.
          </div>
        </div>
      </Dialog>

      {/* 🔹 Modal CONFIGURAR CAMPOS A FORZAR */}
      <Dialog
        header="Configurar actualización desde Excel"
        visible={excelConfigVisible}
        modal
        style={{ width: 520, maxWidth: "95vw" }}
        onHide={() => setExcelConfigVisible(false)}
      >
        <div style={{ display: "grid", gap: 12 }}>
          <p style={{ marginBottom: 4 }}>
            Seleccioná los campos que querés{" "}
            <strong>forzar la actualización</strong>.
          </p>

          <ul style={{ marginTop: 0, paddingLeft: 18, fontSize: 13 }}>
            <li>
              Si el campo está <strong>tildado</strong>, se actualizará siempre
              con el valor del Excel.
            </li>
            <li>
              Si el campo <strong>NO</strong> está tildado, solo se actualizará
              si está vacío en la base.
            </li>
            <li>Los campos DNI, Nombre y Apellido nunca se modifican.</li>
          </ul>

          {editableFields.length === 0 ? (
            <p>No hay campos editables detectados en el Excel.</p>
          ) : (
            <div
              style={{
                display: "grid",
                gap: 6,
                gridTemplateColumns: "minmax(0, 1fr)",
              }}
            >
              {editableFields.map((f) => {
                const stats = excelFieldStats[f] || {
                  willAuto: 0,
                  needForce: 0,
                };

                return (
                  <div
                    key={f}
                    style={{
                      display: "flex",
                      alignItems: "flex-start",
                      gap: 8,
                      padding: "4px 0",
                    }}
                  >
                    <Checkbox
                      inputId={`force_${f}`}
                      checked={!!forceFields[f]}
                      onChange={(e) =>
                        setForceFields((prev) => ({
                          ...prev,
                          [f]: e.checked,
                        }))
                      }
                    />

                    <div>
                      <label htmlFor={`force_${f}`}>
                        <strong>{FIELD_LABELS[f] || f}</strong>
                      </label>

                      <div
                        style={{
                          fontSize: 11,
                          opacity: 0.85,
                          marginTop: 2,
                        }}
                      >
                        {stats.willAuto} registro(s) se pueden completar
                        automáticamente.
                        <br />
                        {stats.needForce} registro(s) ya tienen información en
                        ese campo.
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          <div
            style={{
              display: "flex",
              justifyContent: "flex-end",
              gap: 8,
              marginTop: 12,
            }}
          >
            <Button
              label="Cancelar"
              className="p-button-text"
              onClick={() => setExcelConfigVisible(false)}
            />

            <Button
              label="Comenzar actualización"
              icon="pi pi-check"
              onClick={runImportFromExcel}
              disabled={!excelMeta || !editableFields.length}
            />
          </div>
        </div>
      </Dialog>

      {/* 🔹 Modal PROGRESO IMPORTACIÓN */}
      <Dialog
        header="Actualizando afiliados desde Excel"
        visible={importProcessVisible}
        modal
        closable={false}
        style={{ width: 480, maxWidth: "95vw" }}
      >
        <div style={{ display: "grid", gap: 12 }}>
          <div style={{ fontSize: 14 }}>
            Por favor, no cierres esta ventana mientras se procesan los
            registros.
          </div>

          <ProgressBar value={importProgress} />

          <div style={{ fontSize: 12, opacity: 0.8 }}>
            Progreso: {importProgress}%
          </div>
        </div>
      </Dialog>

      {/* 🔹 Modal RESULTADO IMPORTACIÓN */}
      <Dialog
        header="Resultado de la actualización"
        visible={importResultVisible}
        modal
        style={{ width: 640, maxWidth: "95vw" }}
        onHide={() => setImportResultVisible(false)}
      >
        <div style={{ display: "grid", gap: 12 }}>
          <p>
            <strong>{importResult.updated.length}</strong> registro(s) se
            procesaron correctamente.
          </p>

          <p>
            <strong>{importResult.errors.length}</strong> registro(s) tuvieron
            algún problema o no encontraron coincidencia por DNI.
          </p>

          {importResult.updated.length > 0 && (
            <div
              style={{
                maxHeight: 160,
                overflow: "auto",
                border: "1px solid #ddd",
                padding: 8,
                borderRadius: 6,
                fontSize: 12,
              }}
            >
              <strong>Actualizados (DNI / fila):</strong>

              <ul style={{ margin: 0, paddingLeft: 18 }}>
                {importResult.updated.slice(0, 50).map((u, idx) => (
                  <li key={idx}>
                    DNI {u.dni} — fila {u.row}
                    {u.note ? ` (${u.note})` : ""}
                  </li>
                ))}

                {importResult.updated.length > 50 && <li>… y más registros</li>}
              </ul>
            </div>
          )}

          {importResult.errors.length > 0 && (
            <div
              style={{
                maxHeight: 160,
                overflow: "auto",
                border: "1px solid #f5c2c7",
                padding: 8,
                borderRadius: 6,
                fontSize: 12,
                background: "#fff5f5",
              }}
            >
              <strong>Con errores / sin coincidencia:</strong>

              <ul style={{ margin: 0, paddingLeft: 18 }}>
                {importResult.errors.slice(0, 50).map((err, idx) => (
                  <li key={idx}>
                    Fila {err.row} — DNI {err.dni}: {err.reason}
                  </li>
                ))}

                {importResult.errors.length > 50 && <li>… y más registros</li>}
              </ul>
            </div>
          )}

          <div style={{ textAlign: "right", marginTop: 8 }}>
            <Button
              label="Cerrar"
              onClick={() => setImportResultVisible(false)}
            />
          </div>
        </div>
      </Dialog>
    </div>
  );
}
