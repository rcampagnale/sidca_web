// src/pages/Capacitaciones/RegistroAsistencia/MiRegistro.jsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import { useSelector } from "react-redux";
import { useHistory } from "react-router-dom";
import {
  getFirestore,
  getDoc,
  doc,
  serverTimestamp,
  collection,
  query,
  where,
  limit,
  getDocs,
  addDoc,
  setDoc,
} from "firebase/firestore";

import { InputText } from "primereact/inputtext";
import { Dropdown } from "primereact/dropdown";
import { Button } from "primereact/button";
import { Card } from "primereact/card";
import { Message } from "primereact/message";
import { Dialog } from "primereact/dialog";
import { ProgressSpinner } from "primereact/progressspinner";
import { ConfirmDialog, confirmDialog } from "primereact/confirmdialog";
import { QrReader } from "react-qr-reader";

import styles from "./miRegistro.module.css";
import ConstanciaPreview from "./ConstanciaPreview";

/* =========================
   Helpers generales
   ========================= */

const pad2 = (n) => String(n).padStart(2, "0");

const toDisplay = (d) =>
  `${pad2(d.getDate())}/${pad2(d.getMonth() + 1)}/${d.getFullYear()}`;

const parseDisplay = (value) => {
  if (!value) return null;

  const txt = String(value).trim();

  const iso = new Date(txt);
  if (/^\d{4}-\d{2}-\d{2}/.test(txt) && !Number.isNaN(iso.getTime())) {
    return iso;
  }

  const match = txt.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
  if (!match) return null;

  const dd = Number(match[1]);
  const mm = Number(match[2]);
  const yyyy = Number(match[3]);

  if (!Number.isFinite(dd) || !Number.isFinite(mm) || !Number.isFinite(yyyy)) {
    return null;
  }

  return new Date(yyyy, mm - 1, dd);
};

const dateToYMD = (date) => {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return "";

  const yyyy = date.getFullYear();
  const mm = pad2(date.getMonth() + 1);
  const dd = pad2(date.getDate());

  return `${yyyy}-${mm}-${dd}`;
};

const normalizarFechaYMD = (value) => {
  if (!value) return "";

  if (value instanceof Date) return dateToYMD(value);
  if (typeof value?.toDate === "function") return dateToYMD(value.toDate());
  if (value?.seconds != null) return dateToYMD(new Date(value.seconds * 1000));

  const txt = String(value).trim();

  if (/^\d{4}-\d{2}-\d{2}/.test(txt)) {
    return txt.slice(0, 10);
  }

  const d = parseDisplay(txt) || new Date(txt);

  return !Number.isNaN(d.getTime()) ? dateToYMD(d) : "";
};

const cap = (value) => {
  if (!value) return "";
  const txt = String(value).trim();
  return txt.charAt(0).toUpperCase() + txt.slice(1);
};

const normalizarTexto = (value) =>
  String(value || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

const normalizarCursoKey = (value) =>
  normalizarTexto(value)
    .replace(/curso\s*:/g, "")
    .replace(/[–—]/g, "-")
    .replace(/\s*-\s*/g, "-")
    .replace(/\s+/g, " ")
    .trim();

const nowIsBetween = (sinceISO, untilISO) => {
  if (!sinceISO || !untilISO) return false;

  const now = new Date();
  const since = new Date(sinceISO);
  const until = new Date(untilISO);

  if (Number.isNaN(since.getTime()) || Number.isNaN(until.getTime())) {
    return false;
  }

  return now >= since && now <= until;
};

const nombreAfiliado = (apellido, nombre) => {
  const ap = (apellido || "").trim();
  const no = (nombre || "").trim();
  const combinado = ap && no ? `${ap}, ${no}` : ap || no;
  return combinado.replace(/\s*,\s*/g, ", ").replace(/\s+/g, " ").trim();
};

const pick = (obj, keys) => {
  for (const k of keys) {
    const v = obj?.[k];
    if (v !== undefined && v !== null && String(v).trim() !== "") {
      return String(v).trim();
    }
  }

  return "";
};

const getDateFromFirestoreOrString = (value) => {
  if (!value) return null;

  if (typeof value?.toDate === "function") return value.toDate();
  if (value?.seconds != null) return new Date(value.seconds * 1000);
  if (value instanceof Date) return value;

  if (typeof value === "string") {
    const parsed = parseDisplay(value) || new Date(value);
    if (!Number.isNaN(parsed.getTime())) return parsed;
  }

  return null;
};

const formatFecha = (value) => {
  const d = getDateFromFirestoreOrString(value);
  return d ? toDisplay(d) : "";
};

const formatHora = (value) => {
  const d = getDateFromFirestoreOrString(value);
  return d ? `${pad2(d.getHours())}:${pad2(d.getMinutes())} hs` : "";
};

const getSortTime = (value) => {
  const d = getDateFromFirestoreOrString(value);
  return d ? d.getTime() : 0;
};

const tieneDatoUtil = (value) => {
  if (value === null || value === undefined) return false;

  if (typeof value === "string") {
    const limpio = value.trim();
    return limpio !== "" && limpio !== "-" && limpio !== "—";
  }

  if (typeof value?.toDate === "function") return true;
  if (value instanceof Date) return true;

  return Boolean(value);
};

const tieneIngresoRegistrado = (data) => {
  if (!data) return false;

  if (data.ingreso?.registrado === true) return true;
  if (tieneDatoUtil(data.ingreso?.fechaHoraISO)) return true;
  if (tieneDatoUtil(data.ingreso?.fechaHora)) return true;
  if (tieneDatoUtil(data.ingreso?.registradoEn)) return true;

  if (tieneDatoUtil(data.ingresoFechaHora)) return true;
  if (tieneDatoUtil(data.horaIngreso)) return true;
  if (tieneDatoUtil(data.fechaIngreso)) return true;
  if (tieneDatoUtil(data.entrada)) return true;
  if (tieneDatoUtil(data.checkIn)) return true;
  if (data.ingresoRegistrado === true) return true;

  if (typeof data.ingreso !== "object" && tieneDatoUtil(data.ingreso)) return true;

  return false;
};

const tieneSalidaRegistrada = (data) => {
  if (!data) return false;

  if (data.salida?.registrado === true) return true;
  if (tieneDatoUtil(data.salida?.fechaHoraISO)) return true;
  if (tieneDatoUtil(data.salida?.fechaHora)) return true;
  if (tieneDatoUtil(data.salida?.registradoEn)) return true;

  if (tieneDatoUtil(data.salidaFechaHora)) return true;
  if (tieneDatoUtil(data.horaSalida)) return true;
  if (tieneDatoUtil(data.fechaSalida)) return true;
  if (tieneDatoUtil(data.egreso)) return true;
  if (tieneDatoUtil(data.checkOut)) return true;
  if (data.salidaRegistrada === true) return true;

  if (typeof data.salida !== "object" && tieneDatoUtil(data.salida)) return true;

  return false;
};

const obtenerValorIngreso = (data) =>
  data?.ingreso?.fechaHoraISO ||
  data?.ingreso?.fechaHora ||
  data?.ingreso?.registradoEn ||
  data?.ingresoFechaHora ||
  data?.horaIngreso ||
  data?.fechaIngreso ||
  data?.entrada ||
  data?.checkIn ||
  (typeof data?.ingreso !== "object" ? data?.ingreso : null) ||
  null;

const obtenerValorSalida = (data) =>
  data?.salida?.fechaHoraISO ||
  data?.salida?.fechaHora ||
  data?.salida?.registradoEn ||
  data?.salidaFechaHora ||
  data?.horaSalida ||
  data?.fechaSalida ||
  data?.egreso ||
  data?.checkOut ||
  (typeof data?.salida !== "object" ? data?.salida : null) ||
  null;

const buildAttendanceRow = (data) => {
  const modalidadItem = normalizarTexto(
    data?.modalidad || (data?.presencial ? "presencial" : "virtual")
  );

  const esPresencial = modalidadItem === "presencial";
  const ingresoRegistrado = tieneIngresoRegistrado(data);
  const salidaRegistrada = tieneSalidaRegistrada(data);

  // Regla final:
  // Virtual: si existe el registro, queda presente.
  // Presencial: solamente queda presente si tiene ingreso y salida.
  const asistenciaValidada = esPresencial
    ? ingresoRegistrado && salidaRegistrada
    : true;

  let estadoLabel = "NO VALIDADA";
  let severity = "danger";
  let detalle = "Debe registrar ingreso y salida para quedar presente.";

  if (asistenciaValidada) {
    estadoLabel = "PRESENTE";
    severity = "ok";
    detalle = esPresencial
      ? "Asistencia validada correctamente."
      : "Asistencia virtual registrada correctamente.";
  } else if (esPresencial && ingresoRegistrado && !salidaRegistrada) {
    estadoLabel = "PENDIENTE DE SALIDA";
    severity = "warn";
    detalle = "Registró el ingreso, falta registrar la salida para validar la asistencia.";
  }

  const ingresoValor = obtenerValorIngreso(data);
  const salidaValor = obtenerValorSalida(data);

  const cursoNombre =
    data?.cursoTitulo ||
    data?.curso ||
    data?.cursoNombre ||
    data?.nombreCurso ||
    data?.capacitacion ||
    data?.tituloCurso ||
    "Curso";

  const fechaVista =
    data?.fecha ||
    formatFecha(ingresoValor) ||
    formatFecha(salidaValor) ||
    formatFecha(data?.createdAt) ||
    "-";

  // Orden visual de la asistencia:
  // 1) fecha propia del registro, porque es la fecha real de asistencia.
  // 2) ingreso/salida, para casos donde la fecha venga vacía.
  // 3) updatedAt/createdAt solo como respaldo técnico.
  const sortTime =
    getSortTime(fechaVista) ||
    getSortTime(data?.fecha) ||
    getSortTime(ingresoValor) ||
    getSortTime(salidaValor) ||
    getSortTime(data?.updatedAt) ||
    getSortTime(data?.createdAt);

  return {
    id: data?.id || null,
    original: data,
    curso: cursoNombre,
    cursoTitulo: cursoNombre,
    // IMPORTANTE:
    // La vista del afiliado debe agrupar por nombre de curso.
    // No usamos cursoId como clave principal porque los registros manuales
    // y los QR pueden venir con IDs distintos o sin ID, aunque pertenezcan
    // al mismo curso visible.
    cursoKey: normalizarCursoKey(cursoNombre),
    cursoId: data?.cursoId || data?.idCurso || data?.courseId || data?.cursoDocId || "",
    fecha: fechaVista,
    sortTime,
    modalidad: esPresencial ? "presencial" : "virtual",
    modalidadVista: esPresencial ? "Presencial" : "Virtual",
    ingresoRegistrado,
    salidaRegistrada,
    ingresoFechaHora: ingresoValor,
    salidaFechaHora: salidaValor,
    asistenciaValidada,
    estadoLabel,
    severity,
    detalle,
    constanciaUrl:
      data?.constanciaUrl ||
      data?.urlConstancia ||
      data?.certificadoUrl ||
      data?.urlCertificado ||
      data?.pdfUrl ||
      data?.archivoConstanciaUrl ||
      "",
  };
};

const agruparPorCurso = (rows) => {
  const mapa = new Map();

  rows.forEach((row) => {
    const key = row.cursoKey || normalizarCursoKey(row.curso || "Curso");

    if (!mapa.has(key)) {
      mapa.set(key, {
        key,
        curso: row.curso,
        cursoId: row.cursoId,
        items: [],
      });
    }

    mapa.get(key).items.push(row);
  });

  const grupos = Array.from(mapa.values()).map((grupo) => {
    const items = [...grupo.items].sort((a, b) => (b.sortTime || 0) - (a.sortTime || 0));
    const itemConstancia =
      items.find((item) => item.asistenciaValidada && item.constanciaUrl) ||
      items.find((item) => item.asistenciaValidada) ||
      null;

    return {
      ...grupo,
      items,
      itemConstancia,
      tieneConstanciaHabilitada: Boolean(itemConstancia),
      sortTime: items[0]?.sortTime || 0,
    };
  });

  return grupos.sort((a, b) => (b.sortTime || 0) - (a.sortTime || 0));
};

const getEstadoClase = (severity) => {
  if (severity === "ok") return "ok";
  if (severity === "warn") return "warn";
  return "danger";
};


/* =========================
   Helpers de constancia/certificado
   ========================= */

const TEXTO_BOTON_CONSTANCIA = "Ver constancia";

const normalizarArrayFechasConstancia = (value) => {
  if (!Array.isArray(value)) return [];

  return [...new Set(value.map(normalizarFechaYMD).filter(Boolean))].sort();
};

const obtenerFechasPermitidasConstancia = (configCurso = {}) => {
  const dataOriginal = configCurso?.dataOriginal || {};

  return normalizarArrayFechasConstancia(
    configCurso?.fechasConstancia?.length
      ? configCurso.fechasConstancia
      : configCurso?.fechasHabilitadasConstancia?.length
      ? configCurso.fechasHabilitadasConstancia
      : configCurso?.fechasMostrarConstancia?.length
      ? configCurso.fechasMostrarConstancia
      : dataOriginal?.fechasConstancia?.length
      ? dataOriginal.fechasConstancia
      : dataOriginal?.fechasHabilitadasConstancia?.length
      ? dataOriginal.fechasHabilitadasConstancia
      : dataOriginal?.fechasMostrarConstancia?.length
      ? dataOriginal.fechasMostrarConstancia
      : dataOriginal?.fechaConstanciaPrincipal
      ? [dataOriginal.fechaConstanciaPrincipal]
      : []
  );
};

const asistenciaCoincideConFechaConstancia = (item, configCurso) => {
  const fechaAsistencia = normalizarFechaYMD(
    item?.fecha ||
      item?.fechaVista ||
      item?.original?.fecha ||
      item?.original?.fechaAsistencia ||
      item?.original?.createdAt
  );

  if (!fechaAsistencia) return false;

  const fechasPermitidas = obtenerFechasPermitidasConstancia(configCurso);

  return fechasPermitidas.includes(fechaAsistencia);
};

const puedeMostrarConstanciaEnItem = (item, configCurso) => {
  if (!item?.asistenciaValidada) return false;
  if (configCurso?.habilitado !== true) return false;

  return asistenciaCoincideConFechaConstancia(item, configCurso);
};

const normalizarConfigConstanciaCurso = (cursoId, data = {}) => {
  const id = String(
    data?.cursoId ||
      data?.idCurso ||
      data?.courseId ||
      data?.cursoDocId ||
      cursoId ||
      ""
  ).trim();

  const cursoNombre = String(
    data?.cursoNombre ||
      data?.nombreCurso ||
      data?.cursoTitulo ||
      data?.curso ||
      data?.titulo ||
      ""
  ).trim();

  const fechasConstancia = normalizarArrayFechasConstancia(data?.fechasConstancia);
  const fechasHabilitadasConstancia = normalizarArrayFechasConstancia(
    data?.fechasHabilitadasConstancia
  );
  const fechasMostrarConstancia = normalizarArrayFechasConstancia(
    data?.fechasMostrarConstancia
  );

  const fechaConstanciaPrincipal =
    normalizarFechaYMD(data?.fechaConstanciaPrincipal) ||
    fechasConstancia[0] ||
    fechasHabilitadasConstancia[0] ||
    fechasMostrarConstancia[0] ||
    "";

  return {
    idDocumento: String(cursoId || "").trim(),
    cursoId: id,
    cursoNombre,
    habilitado:
      data?.habilitado === true ||
      data?.habilitadoConstancia === true ||
      data?.activo === true ||
      data?.enabled === true,
    textoBoton: TEXTO_BOTON_CONSTANCIA,
    fechasConstancia,
    fechasHabilitadasConstancia,
    fechasMostrarConstancia,
    fechaConstanciaPrincipal,
    url:
      data?.url ||
      data?.link ||
      data?.constanciaUrl ||
      data?.urlConstancia ||
      data?.certificadoUrl ||
      data?.urlCertificado ||
      data?.pdfUrl ||
      "",
    dataOriginal: data,
  };
};

const guardarConfigConstanciaEnMapa = (mapa, cursoId, config, dataOriginal = {}) => {
  const ids = [
    cursoId,
    config?.cursoId,
    dataOriginal?.cursoId,
    dataOriginal?.idCurso,
    dataOriginal?.courseId,
    dataOriginal?.cursoDocId,
  ]
    .map((v) => String(v ?? "").trim())
    .filter(Boolean);

  ids.forEach((id) => {
    mapa[id] = config;
  });

  const nombres = [
    config?.cursoNombre,
    dataOriginal?.cursoNombre,
    dataOriginal?.nombreCurso,
    dataOriginal?.cursoTitulo,
    dataOriginal?.curso,
    dataOriginal?.titulo,
  ]
    .map((v) => String(v ?? "").trim())
    .filter(Boolean);

  nombres.forEach((nombre) => {
    const key = normalizarCursoKey(nombre);
    if (key) mapa[`nombre:${key}`] = config;
  });
};

const obtenerCursoIdConstancia = (item = {}) => {
  const original = item?.original || {};

  return String(
    item?.cursoId ||
      original?.cursoId ||
      original?.idCurso ||
      original?.courseId ||
      original?.cursoDocId ||
      ""
  ).trim();
};

const obtenerNombresCursoConstancia = (item = {}) => {
  const original = item?.original || {};

  return [
    item?.curso,
    item?.cursoTitulo,
    original?.cursoTitulo,
    original?.curso,
    original?.cursoNombre,
    original?.nombreCurso,
    original?.capacitacion,
    original?.tituloCurso,
    original?.titulo,
  ]
    .map((v) => String(v ?? "").trim())
    .filter(Boolean);
};

const obtenerConfigConstanciaParaItem = (item, constanciasPorCurso) => {
  const cursoId = obtenerCursoIdConstancia(item);

  if (cursoId && constanciasPorCurso?.[cursoId]) {
    return constanciasPorCurso[cursoId];
  }

  const nombresCurso = obtenerNombresCursoConstancia(item);

  for (const nombre of nombresCurso) {
    const key = normalizarCursoKey(nombre);
    if (key && constanciasPorCurso?.[`nombre:${key}`]) {
      return constanciasPorCurso[`nombre:${key}`];
    }
  }

  return null;
};

const obtenerConfigConstanciaParaGrupo = (grupo, constanciasPorCurso) => {
  if (!grupo) return null;

  if (grupo?.cursoId && constanciasPorCurso?.[grupo.cursoId]) {
    return constanciasPorCurso[grupo.cursoId];
  }

  const keyGrupo = normalizarCursoKey(grupo?.curso || "");
  if (keyGrupo && constanciasPorCurso?.[`nombre:${keyGrupo}`]) {
    return constanciasPorCurso[`nombre:${keyGrupo}`];
  }

  for (const item of grupo?.items || []) {
    const config = obtenerConfigConstanciaParaItem(item, constanciasPorCurso);
    if (config) return config;
  }

  return null;
};

const obtenerUrlConstancia = (item, configCurso) =>
  item?.constanciaUrl ||
  item?.original?.constanciaUrl ||
  item?.original?.urlConstancia ||
  item?.original?.certificadoUrl ||
  item?.original?.urlCertificado ||
  item?.original?.pdfUrl ||
  configCurso?.url ||
  configCurso?.dataOriginal?.url ||
  configCurso?.dataOriginal?.link ||
  configCurso?.dataOriginal?.constanciaUrl ||
  configCurso?.dataOriginal?.urlConstancia ||
  configCurso?.dataOriginal?.certificadoUrl ||
  configCurso?.dataOriginal?.urlCertificado ||
  configCurso?.dataOriginal?.pdfUrl ||
  "";

const getMensajeConstanciaNoDisponible = ({
  cargandoConstancias,
  configCurso,
  item,
}) => {
  if (cargandoConstancias) return "Verificando habilitación de constancia...";

  if (!configCurso) {
    return "La constancia de este curso todavía no fue habilitada desde administración.";
  }

  if (configCurso?.habilitado !== true) {
    return "La constancia de este curso se encuentra deshabilitada desde administración.";
  }

  if (!item?.asistenciaValidada) {
    return "La constancia se habilita cuando la asistencia esté validada.";
  }

  if (!asistenciaCoincideConFechaConstancia(item, configCurso)) {
    return "La constancia no está habilitada para esta fecha de asistencia.";
  }

  return "La constancia todavía no se encuentra disponible.";
};

const parseAsistenciaUrl = (urlStr) => {
  const raw = String(urlStr || "").trim();
  const qIndex = raw.indexOf("?");

  if (qIndex === -1) throw new Error("QR sin query");

  const queryStr = raw.slice(qIndex + 1);
  const params = new URLSearchParams(queryStr);

  const s = params.get("s") || "auto";
  const c = params.get("c") || "";
  const t = params.get("t") || params.get("tipo") || params.get("registro") || "";

  if (!s || !c) throw new Error("Faltan parámetros en el QR");

  return {
    sessionParam: s,
    codeParam: c,
    tipoParam: normalizarTexto(t),
  };
};

const normalizarTipoRegistroQR = (value, asistenciaExistente = null) => {
  const normalizado = normalizarTexto(value);

  if (["salida", "egreso", "out", "checkout", "check_out"].includes(normalizado)) {
    return "salida";
  }

  if (["ingreso", "entrada", "in", "checkin", "check_in"].includes(normalizado)) {
    return "ingreso";
  }

  const ingresoRegistrado = tieneIngresoRegistrado(asistenciaExistente);
  const salidaRegistrada = tieneSalidaRegistrada(asistenciaExistente);

  if (!ingresoRegistrado) return "ingreso";
  if (ingresoRegistrado && !salidaRegistrada) return "salida";

  return "completa";
};

const DEVICE_STORAGE_KEY = "sidca_asistencia_device_id";

const normalizarDni = (valor) => String(valor || "").replace(/\D/g, "");

const obtenerNombreAfiliado = (data = {}) => {
  const nombreCompleto = String(
    data.apellidoNombre || data.nombreCompleto || data.displayName || ""
  ).trim();

  if (nombreCompleto) return nombreCompleto;

  return [data.apellido, data.nombre]
    .map((valor) => String(valor || "").trim())
    .filter(Boolean)
    .join(", ") || "otro afiliado";
};

const MODELOS_DISPOSITIVO_CONOCIDOS = {
  "SM-A705": "Samsung Galaxy A70",
  "SM-A705F": "Samsung Galaxy A70",
  "SM-A705FN": "Samsung Galaxy A70",
  "SM-A705GM": "Samsung Galaxy A70",
  "SM-A705MN": "Samsung Galaxy A70",
};

const obtenerInfoDispositivo = async () => {
  const userAgent = String(navigator?.userAgent || "");
  let codigoModelo = "";
  let plataforma = String(
    navigator?.userAgentData?.platform || navigator?.platform || ""
  ).trim();

  try {
    if (navigator?.userAgentData?.getHighEntropyValues) {
      const datos = await navigator.userAgentData.getHighEntropyValues([
        "model",
        "platform",
      ]);
      codigoModelo = String(datos?.model || "").trim();
      plataforma = String(datos?.platform || plataforma).trim();
    }
  } catch {
    // Algunos navegadores no permiten acceder a estos datos.
  }

  if (!codigoModelo) {
    const androidMatch = userAgent.match(
      /Android[^;]*;\s*([^;)]+?)(?:\s+Build\/|\))/i
    );
    codigoModelo = String(androidMatch?.[1] || "").trim();
  }

  const codigoNormalizado = codigoModelo.toUpperCase();
  let modelo = MODELOS_DISPOSITIVO_CONOCIDOS[codigoNormalizado] || "";

  if (!modelo && codigoNormalizado.startsWith("SM-")) {
    modelo = `Samsung ${codigoModelo}`;
  } else if (!modelo && codigoModelo) {
    modelo = codigoModelo;
  } else if (!modelo) {
    modelo = plataforma || "Dispositivo no identificado";
  }

  return {
    dispositivoModelo: modelo,
    dispositivoCodigoModelo: codigoModelo || null,
    dispositivoPlataforma: plataforma || null,
    dispositivoUserAgent: userAgent || null,
  };
};

const formatearFechaHoraDispositivo = (value) => {
  const fecha = value?.toDate?.() || (value ? new Date(value) : null);
  if (!fecha || Number.isNaN(fecha.getTime())) return "Fecha no informada";

  return new Intl.DateTimeFormat("es-AR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(fecha);
};

const generarDeviceId = () => {
  const random =
    typeof crypto !== "undefined" && crypto.randomUUID
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2)}`;

  return `sidca-device-${random}`;
};

const getOrCreateDeviceId = () => {
  try {
    const actual = localStorage.getItem(DEVICE_STORAGE_KEY);

    if (actual && actual.trim()) return actual.trim();

    const nuevo = generarDeviceId();
    localStorage.setItem(DEVICE_STORAGE_KEY, nuevo);

    return nuevo;
  } catch {
    return generarDeviceId();
  }
};

const NIVELES = [
  { label: "Nivel Inicial", value: "Nivel Inicial" },
  { label: "Nivel Primario", value: "Nivel Primario" },
  { label: "Nivel Secundario", value: "Nivel Secundario" },
  { label: "Nivel Superior", value: "Nivel Superior" },
  {
    label: "Educación Técnica (Técnica/Agro/FP)",
    value: "Educación Técnica (Técnica/Agro/FP)",
  },
];

export default function MiRegistro() {
  const db = getFirestore();
  const history = useHistory();

  const user = useSelector((s) => s.user);
  const docId = user?.docId || localStorage.getItem("sidca_user_docId") || "";
  const dni = user?.dni || localStorage.getItem("sidca_user_dni") || "";

  const [perfil, setPerfil] = useState({
    apellido: "",
    nombre: "",
    dni: "",
    departamento: "",
    correo: "",
    telefono: "",
  });

  const [cargandoPerfil, setCargandoPerfil] = useState(true);
  const [perfilNoEncontrado, setPerfilNoEncontrado] = useState(false);

  const [botonHabilitado, setBotonHabilitado] = useState(false);
  const [cargandoBoton, setCargandoBoton] = useState(true);

  const [selectedCourse, setSelectedCourse] = useState("");
  const [selectedCourseId, setSelectedCourseId] = useState("");
  const [modalidad, setModalidad] = useState("virtual");
  const [requisitoPresencialVirtual, setRequisitoPresencialVirtual] =
    useState("ninguno");
  const [encuentrosPresencialesRequeridos, setEncuentrosPresencialesRequeridos] =
    useState([]);
  const [metodo, setMetodo] = useState(undefined);
  const [sessionIdCfg, setSessionIdCfg] = useState(undefined);
  const [habilitadaCfg, setHabilitadaCfg] = useState(false);
  const [cargandoCfg, setCargandoCfg] = useState(true);

  const [nivel, setNivel] = useState("");

  const [asistencias, setAsistencias] = useState([]);
  const [cargandoAsistencias, setCargandoAsistencias] = useState(false);
  const [asisError, setAsisError] = useState("");

  const [qrVisible, setQrVisible] = useState(false);
  const scannedRef = useRef(false);
  const [codeInput, setCodeInput] = useState("");
  const [manualLoading, setManualLoading] = useState(false);

  const [procesandoAsistencia, setProcesandoAsistencia] = useState(false);
  const [mensajeProceso, setMensajeProceso] = useState("Procesando asistencia...");

  const [, setConstanciaGlobalCfg] = useState({
    habilitadoGlobal: true,
    textoBotonDefault: TEXTO_BOTON_CONSTANCIA,
  });
  const [constanciasPorCurso, setConstanciasPorCurso] = useState({});
  const [cargandoConstancias, setCargandoConstancias] = useState(true);
  const [constanciaSeleccionada, setConstanciaSeleccionada] = useState(null);

  const hoy = useMemo(() => new Date(), []);
  const fechaDisplay = toDisplay(hoy);

  const buscarDocumentosAfiliado = async (dniValue) => {
    const refs = [];
    const agregados = new Set();

    const agregar = (ref, data) => {
      if (!ref?.path || agregados.has(ref.path)) return;
      agregados.add(ref.path);
      refs.push({ ref, data: data || {} });
    };

    if (docId) {
      const refUsuario = doc(db, "usuarios", docId);
      const snapUsuario = await getDoc(refUsuario);

      if (snapUsuario.exists()) {
        const data = snapUsuario.data() || {};
        if (!dniValue || String(data?.dni || "") === String(dniValue)) {
          agregar(refUsuario, data);
        }
      }
    }

    if (dniValue) {
      const qUsuarios = query(
        collection(db, "usuarios"),
        where("dni", "==", dniValue),
        limit(5)
      );
      const snapUsuarios = await getDocs(qUsuarios);
      snapUsuarios.docs.forEach((d) => agregar(d.ref, d.data()));

      const qNuevoAfiliado = query(
        collection(db, "nuevoAfiliado"),
        where("dni", "==", dniValue),
        limit(5)
      );
      const snapNuevoAfiliado = await getDocs(qNuevoAfiliado);
      snapNuevoAfiliado.docs.forEach((d) => agregar(d.ref, d.data()));
    }

    return refs;
  };

  const buscarTitularDelDispositivo = async (deviceId, dniActual) => {
    const dniNormalizado = normalizarDni(dniActual);
    const colecciones = ["usuarios", "nuevoAfiliado"];

    const resultados = await Promise.all(
      colecciones.map(async (nombreColeccion) => {
        const snap = await getDocs(
          query(
            collection(db, nombreColeccion),
            where("dispositivoAsistenciaId", "==", deviceId),
            limit(10)
          )
        );

        return snap.docs.map((documento) => ({
          id: documento.id,
          ref: documento.ref,
          data: {
            ...(documento.data() || {}),
            dni: documento.data()?.dni || documento.id,
          },
        }));
      })
    );

    return resultados
      .flat()
      .find(
        ({ id, data }) =>
          normalizarDni(data?.dni || id) !== dniNormalizado
      ) || null;
  };

  const auditarBloqueoDispositivo = async ({
    motivo,
    deviceId,
    titular = null,
    infoDispositivo = null,
  }) => {
    try {
      await addDoc(collection(db, "asistencia_intentos_bloqueados"), {
        motivo,
        deviceId,
        dniIntento: normalizarDni(perfil?.dni),
        afiliadoIntento: obtenerNombreAfiliado(perfil),
        dniTitular: titular ? normalizarDni(titular?.dni) : null,
        afiliadoTitular: titular ? obtenerNombreAfiliado(titular) : null,
        dispositivoModeloIntento: infoDispositivo?.dispositivoModelo || null,
        dispositivoCodigoModeloIntento:
          infoDispositivo?.dispositivoCodigoModelo || null,
        dispositivoPlataformaIntento:
          infoDispositivo?.dispositivoPlataforma || null,
        dispositivoTitularId: titular?.dispositivoAsistenciaId || null,
        dispositivoTitularModelo:
          titular?.dispositivoModelo || titular?.dispositivoCodigoModelo || null,
        cursoId: selectedCourseId || null,
        cursoTitulo: selectedCourse || null,
        sessionId: sessionIdCfg || null,
        metodoRegistro: metodo || null,
        modalidad: "presencial",
        creadoEn: serverTimestamp(),
      });
    } catch (error) {
      console.error("No se pudo auditar el bloqueo de dispositivo:", error);
    }
  };

  const validarDispositivoAfiliado = async () => {
    if (!perfil?.dni) throw new Error("No se encontró el DNI del usuario.");

    const deviceId = getOrCreateDeviceId();
    const infoDispositivo = await obtenerInfoDispositivo();
    const documentos = await buscarDocumentosAfiliado(perfil.dni);

    if (documentos.length === 0) {
      throw new Error("No se encontró el afiliado en usuarios o nuevoAfiliado.");
    }

    const titularOtroDni = await buscarTitularDelDispositivo(
      deviceId,
      perfil.dni
    );

    if (titularOtroDni) {
      await auditarBloqueoDispositivo({
        motivo: "dispositivo_asociado_a_otro_dni",
        deviceId,
        titular: titularOtroDni.data,
        infoDispositivo,
      });

      throw new Error(
        `Este dispositivo está autorizado para ${obtenerNombreAfiliado(
          titularOtroDni.data
        )}. Registrado el ${formatearFechaHoraDispositivo(
          titularOtroDni.data?.dispositivoVinculadoEn
        )}. Iniciá sesión desde tu dispositivo personal para registrar la asistencia.`
      );
    }

    const documentoMismoDispositivo = documentos.find(({ data }) => {
      const vinculado = String(data?.dispositivoAsistenciaId || "").trim();
      return vinculado === deviceId;
    });

    const documentoBloqueado = !documentoMismoDispositivo && documentos.find(({ data }) => {
      const vinculado = String(data?.dispositivoAsistenciaId || "").trim();
      return vinculado && vinculado !== deviceId;
    });

    if (documentoBloqueado) {
      await auditarBloqueoDispositivo({
        motivo: "dni_asociado_a_otro_dispositivo",
        deviceId,
        titular: documentoBloqueado.data,
        infoDispositivo,
      });

      throw new Error(
        `El DNI ${perfil.dni} de ${obtenerNombreAfiliado(
          documentoBloqueado.data
        )} está vinculado a otro dispositivo (${
          documentoBloqueado.data?.dispositivoModelo ||
          documentoBloqueado.data?.dispositivoCodigoModelo ||
          "modelo no informado"
        }), registrado el ${formatearFechaHoraDispositivo(
          documentoBloqueado.data?.dispositivoVinculadoEn
        )}. Esta computadora no coincide con el dispositivo autorizado. Si cambiaste de equipo, solicitá la actualización desde administración.`
      );
    }

    await Promise.all(
      documentos.map(async ({ ref, data }) => {
        const yaTieneDispositivo = Boolean(
          String(data?.dispositivoAsistenciaId || "").trim()
        );

        const payload = {
          apellido: perfil.apellido || data?.apellido || "",
          nombre: perfil.nombre || data?.nombre || "",
          dni: perfil.dni || data?.dni || "",
          correo: perfil.correo || data?.correo || data?.email || "",
          telefono: perfil.telefono || data?.telefono || data?.celular || "",
          departamento:
            perfil.departamento ||
            data?.departamento ||
            data?.depto ||
            data?.departamentoNombre ||
            "",
          dispositivoAsistenciaId: deviceId,
          asistenciaDispositivoVinculado: true,
          dispositivoVinculadoDesde: "web-mi-registro",
          dispositivoUltimaValidacionEn: serverTimestamp(),
          ...infoDispositivo,
        };

        if (!yaTieneDispositivo) payload.dispositivoVinculadoEn = serverTimestamp();

        await setDoc(ref, payload, { merge: true });
      })
    );

    return deviceId;
  };

  const buscarDocAsistenciaSesion = async (sessionId, dniValue) => {
    const idDoc = `${sessionId}_${dniValue || "sin_dni"}`;
    const refDefault = doc(db, "asistencia", idDoc);
    const snapDefault = await getDoc(refDefault);

    if (snapDefault.exists()) {
      return {
        ref: refDefault,
        data: { id: snapDefault.id, ...snapDefault.data() },
        exists: true,
      };
    }

    if (dniValue) {
      const qDni = query(collection(db, "asistencia"), where("dni", "==", dniValue));
      const snapDni = await getDocs(qDni);

      const encontrado = snapDni.docs.find((d) => {
        const data = d.data() || {};
        return String(data?.sessionId || "") === String(sessionId || "");
      });

      if (encontrado) {
        return {
          ref: encontrado.ref,
          data: { id: encontrado.id, ...encontrado.data() },
          exists: true,
        };
      }
    }

    return { ref: refDefault, data: null, exists: false };
  };


  const cursoCoincideConSesionActual = (data = {}, sesion = {}) => {
    const cursoIdData = String(
      data?.cursoId || data?.idCurso || data?.courseId || data?.cursoDocId || ""
    ).trim();

    const cursoIdSesion = String(sesion?.cursoId || selectedCourseId || "").trim();

    if (cursoIdData && cursoIdSesion && cursoIdData === cursoIdSesion) {
      return true;
    }

    const nombreData = normalizarCursoKey(
      data?.cursoTitulo ||
        data?.curso ||
        data?.cursoNombre ||
        data?.nombreCurso ||
        data?.capacitacion ||
        data?.tituloCurso ||
        ""
    );

    const nombreSesion = normalizarCursoKey(
      sesion?.cursoTitulo ||
        sesion?.curso ||
        sesion?.cursoNombre ||
        sesion?.nombreCurso ||
        selectedCourse ||
        ""
    );

    return Boolean(nombreData && nombreSesion && nombreData === nombreSesion);
  };

  const buscarIngresoPendienteMismoCurso = async ({ dniValue, sesion }) => {
    if (!dniValue) return null;

    const qDni = query(collection(db, "asistencia"), where("dni", "==", dniValue));
    const snapDni = await getDocs(qDni);

    const candidatos = snapDni.docs
      .map((d) => ({
        ref: d.ref,
        data: {
          id: d.id,
          ...d.data(),
        },
      }))
      .filter(({ data }) => {
        const esPresencial =
          normalizarTexto(data?.modalidad || "") === "presencial" ||
          data?.presencial === true;

        const tieneIngreso = tieneIngresoRegistrado(data);
        const tieneSalida = tieneSalidaRegistrada(data);
        const mismoCurso = cursoCoincideConSesionActual(data, sesion);

        return esPresencial && tieneIngreso && !tieneSalida && mismoCurso;
      })
      .sort((a, b) => {
        const fechaA =
          getSortTime(obtenerValorIngreso(a.data)) ||
          getSortTime(a.data?.updatedAt) ||
          getSortTime(a.data?.createdAt) ||
          0;

        const fechaB =
          getSortTime(obtenerValorIngreso(b.data)) ||
          getSortTime(b.data?.updatedAt) ||
          getSortTime(b.data?.createdAt) ||
          0;

        return fechaB - fechaA;
      });

    if (candidatos.length === 0) return null;

    return {
      ref: candidatos[0].ref,
      data: candidatos[0].data,
      exists: true,
    };
  };

  const resolverSesionPorCodigo = async (codeParam) => {
    const qSes = query(
      collection(db, "asistencia_sesiones"),
      where("codigo", "==", codeParam),
      limit(1)
    );

    const sSnap = await getDocs(qSes);
    if (sSnap.empty) throw new Error("No se encontró una sesión para ese código.");

    return sSnap.docs[0].id;
  };

  const procesarTextoQR = async (rawText) => {
    const text = String(rawText || "").trim();
    if (!text) throw new Error("QR vacío.");

    let sessionId = null;
    let codeParam = "";
    let tipoParam = "";

    if (text.includes("?")) {
      const parsed = parseAsistenciaUrl(text);
      codeParam = parsed.codeParam?.trim();
      tipoParam = parsed.tipoParam || "";
      sessionId = parsed.sessionParam === "auto" ? sessionIdCfg : parsed.sessionParam;
    } else {
      codeParam = text.trim();
      sessionId = sessionIdCfg || null;
    }

    if (!sessionId) sessionId = await resolverSesionPorCodigo(codeParam);

    await validarYRegistrarPresencial(sessionId, codeParam, tipoParam);
  };

  useEffect(() => {
    (async () => {
      try {
        setCargandoPerfil(true);
        setPerfilNoEncontrado(false);

        let data = null;

        if (docId) {
          const ref = doc(db, "usuarios", docId);
          const snap = await getDoc(ref);
          if (snap.exists()) data = snap.data();
        }

        if (!data && dni) {
          const qUsr = query(collection(db, "usuarios"), where("dni", "==", dni), limit(1));
          const snap = await getDocs(qUsr);
          if (!snap.empty) data = snap.docs[0].data();
        }

        if (!data && dni) {
          const qNA = query(
            collection(db, "nuevoAfiliado"),
            where("dni", "==", dni),
            limit(1)
          );
          const snapNA = await getDocs(qNA);
          if (!snapNA.empty) data = snapNA.docs[0].data();
        }

        if (!data) {
          setPerfilNoEncontrado(true);
          setPerfil({
            apellido: "",
            nombre: "",
            dni: dni || "",
            departamento: "",
            correo: "",
            telefono: "",
          });
          return;
        }

        let basePerfil = {
          apellido: data.apellido || "",
          nombre: data.nombre || "",
          dni: data.dni || dni || "",
          departamento: pick(data, ["departamento", "depto", "departamentoNombre"]),
          correo: pick(data, ["correo", "email", "mail"]),
          telefono: pick(data, ["telefono", "celular", "tel"]),
        };

        if (!basePerfil.departamento && basePerfil.dni) {
          const qNA = query(
            collection(db, "nuevoAfiliado"),
            where("dni", "==", basePerfil.dni),
            limit(1)
          );
          const sNA = await getDocs(qNA);

          if (!sNA.empty) {
            const dNA = sNA.docs[0].data();
            const depFallback = pick(dNA, ["departamento", "depto", "departamentoNombre"]);
            if (depFallback) basePerfil.departamento = depFallback;
          }
        }

        setPerfil(basePerfil);
      } catch (e) {
        console.error("Error cargando perfil:", e);
        setPerfilNoEncontrado(true);
      } finally {
        setCargandoPerfil(false);
      }
    })();
  }, [db, docId, dni]);

  useEffect(() => {
    (async () => {
      try {
        setCargandoBoton(true);

        const ref = doc(db, "cod", "boton");
        const snap = await getDoc(ref);

        setBotonHabilitado(
          snap.exists() && String(snap.data()?.cargar).trim().toLowerCase() === "si"
        );
      } catch (e) {
        console.error("Error consultando cod/boton.cargar:", e);
        setBotonHabilitado(false);
      } finally {
        setCargandoBoton(false);
      }
    })();
  }, [db]);

  useEffect(() => {
    (async () => {
      try {
        setCargandoCfg(true);

        const ref = doc(db, "cod", "asistencia");
        const snap = await getDoc(ref);

        if (snap.exists()) {
          const data = snap.data() || {};

          setSelectedCourse(data?.cursoTitulo || data?.curso || "");
          setSelectedCourseId(data?.cursoId || "");
          setModalidad(data?.modalidad || "virtual");
          setRequisitoPresencialVirtual(
            data?.requisitoPresencialVirtual || "ninguno"
          );
          setEncuentrosPresencialesRequeridos(
            Array.isArray(data?.encuentrosPresencialesRequeridos)
              ? data.encuentrosPresencialesRequeridos
              : []
          );
          setMetodo(data?.metodo);
          setSessionIdCfg(data?.sessionId);
          setHabilitadaCfg(Boolean(data?.habilitada));
        } else {
          setSelectedCourse("");
          setSelectedCourseId("");
          setModalidad("virtual");
          setRequisitoPresencialVirtual("ninguno");
          setEncuentrosPresencialesRequeridos([]);
          setMetodo(undefined);
          setSessionIdCfg(undefined);
          setHabilitadaCfg(false);
        }
      } catch (e) {
        console.error("Error leyendo cod/asistencia:", e);

        setSelectedCourse("");
        setSelectedCourseId("");
        setModalidad("virtual");
        setRequisitoPresencialVirtual("ninguno");
        setEncuentrosPresencialesRequeridos([]);
        setMetodo(undefined);
        setSessionIdCfg(undefined);
        setHabilitadaCfg(false);
      } finally {
        setCargandoCfg(false);
      }
    })();
  }, [db]);

  useEffect(() => {
    const fetchConstanciasPorCurso = async () => {
      try {
        setCargandoConstancias(true);

        // La configuración global se eliminó del panel administrativo.
        // El botón queda fijo como texto interno del sistema y la disponibilidad
        // se decide por curso + fecha dentro de cod/constancia_certificado/cursos.
        setConstanciaGlobalCfg({
          habilitadoGlobal: true,
          textoBotonDefault: TEXTO_BOTON_CONSTANCIA,
        });

        const cursosConstanciaRef = collection(
          db,
          "cod",
          "constancia_certificado",
          "cursos"
        );

        const cursosConstanciaSnap = await getDocs(cursosConstanciaRef);
        const configs = {};

        cursosConstanciaSnap.docs.forEach((documentoCurso) => {
          const data = documentoCurso.data() || {};
          const config = normalizarConfigConstanciaCurso(documentoCurso.id, data);

          guardarConfigConstanciaEnMapa(configs, documentoCurso.id, config, data);
        });

        setConstanciasPorCurso(configs);
      } catch (error) {
        console.error("Error al leer constancias por curso:", error);
        setConstanciaGlobalCfg({
          habilitadoGlobal: true,
          textoBotonDefault: TEXTO_BOTON_CONSTANCIA,
        });
        setConstanciasPorCurso({});
      } finally {
        setCargandoConstancias(false);
      }
    };

    fetchConstanciasPorCurso();
  }, [db, asistencias.length]);

  const fetchAsistencias = async (dniValue) => {
    if (!dniValue) return;

    try {
      setCargandoAsistencias(true);
      setAsisError("");

      const qA = query(collection(db, "asistencia"), where("dni", "==", dniValue));
      const snap = await getDocs(qA);

      const items = snap.docs.map((d) => ({ id: d.id, ...d.data() }));

      items.sort((a, b) => {
        const da =
          getSortTime(a?.fecha) ||
          getSortTime(obtenerValorIngreso(a)) ||
          getSortTime(obtenerValorSalida(a)) ||
          getSortTime(a?.updatedAt) ||
          getSortTime(a?.createdAt);

        const dbb =
          getSortTime(b?.fecha) ||
          getSortTime(obtenerValorIngreso(b)) ||
          getSortTime(obtenerValorSalida(b)) ||
          getSortTime(b?.updatedAt) ||
          getSortTime(b?.createdAt);

        return dbb - da;
      });

      setAsistencias(items);
    } catch (e) {
      console.error("Error cargando asistencias:", e);
      setAsisError("No se pudieron cargar tus asistencias.");
      setAsistencias([]);
    } finally {
      setCargandoAsistencias(false);
    }
  };

  useEffect(() => {
    if (perfil?.dni) fetchAsistencias(perfil.dni);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [perfil?.dni]);

  const registrarVirtual = async () => {
    if (!perfil?.dni) return alert("No se encontró el DNI del usuario.");
    if (perfilNoEncontrado) return alert("No se encontró el usuario.");
    if (!nivel) return alert("Seleccione un nivel educativo.");
    if (!botonHabilitado) return alert("El registro de asistencia está deshabilitado.");
    if (!habilitadaCfg) return alert("La asistencia no está habilitada por el organizador.");
    if (!selectedCourse) return alert("No hay curso habilitado actualmente.");
    if (modalidad !== "virtual") return alert("El curso habilitado no es virtual.");

    try {
      setProcesandoAsistencia(true);
      setMensajeProceso("Procesando asistencia virtual...");

      const qDni = query(collection(db, "asistencia"), where("dni", "==", perfil.dni));
      const snapDni = await getDocs(qDni);

      const presencialesCompletos = snapDni.docs
        .map((documento) => ({ id: documento.id, ...(documento.data() || {}) }))
        .filter((data) => {
          const esPresencial =
            data.presencial === true ||
            normalizarTexto(data.modalidad) === "presencial";
          const mismoCurso =
            (selectedCourseId && data.cursoId === selectedCourseId) ||
            normalizarTexto(data.cursoTitulo || data.curso) ===
              normalizarTexto(selectedCourse);
          const ingresoCompleto = tieneIngresoRegistrado(data);
          const salidaCompleta = tieneSalidaRegistrada(data);

          return (
            esPresencial &&
            mismoCurso &&
            ingresoCompleto &&
            salidaCompleta
          );
        });

      const idsEncuentrosCumplidos = new Set(
        presencialesCompletos.map(
          (data) =>
            data.sessionId ||
            data.sessionIdIngreso ||
            `${selectedCourseId}-${data.fecha || "sin-fecha"}`
        )
      );

      if (
        requisitoPresencialVirtual === "alguno" &&
        presencialesCompletos.length === 0
      ) {
        throw new Error(
          "No podés registrar asistencia a la instancia virtual, por inasistencia al encuentro presencial."
        );
      }

      if (
        requisitoPresencialVirtual === "todos" ||
        requisitoPresencialVirtual === "especificos"
      ) {
        if (!encuentrosPresencialesRequeridos.length) {
          throw new Error(
            "La asistencia virtual requiere encuentros presenciales, pero la configuración no indica cuáles."
          );
        }

        const faltantes = encuentrosPresencialesRequeridos.filter(
          (encuentro) => !idsEncuentrosCumplidos.has(encuentro.id)
        );

        if (faltantes.length) {
          const fechasFaltantes = faltantes
            .map((encuentro) => encuentro.fecha || "fecha no informada")
            .join(", ");

          throw new Error(
            faltantes.length === 1
              ? `No registraste asistencia al encuentro presencial del ${fechasFaltantes}. Por este motivo, no podrás cargar la asistencia virtual correspondiente a este encuentro.`
              : `No registraste asistencia a los encuentros presenciales de las fechas ${fechasFaltantes}. Por este motivo, no podrás cargar la asistencia virtual correspondiente.`
          );
        }
      }

      const yaTieneVirtual = snapDni.docs.some((d) => {
        const data = d.data() || {};
        const curso = data?.cursoTitulo || data?.curso || "";
        const mod =
          data.presencial === true
            ? "presencial"
            : normalizarTexto(data?.modalidad || "virtual");
        const mismoCurso =
          (selectedCourseId && data.cursoId && data.cursoId === selectedCourseId) ||
          normalizarCursoKey(curso) === normalizarCursoKey(selectedCourse);
        const fechaRegistro = normalizarFechaYMD(
          data.fecha || data.fechaYMD || data.createdAt
        );
        const mismaJornada = fechaRegistro === normalizarFechaYMD(fechaDisplay);

        return mismoCurso && mod === "virtual" && mismaJornada;
      });

      if (yaTieneVirtual) {
        alert("Ya registraste asistencia virtual para este curso en la jornada de hoy.");
        await fetchAsistencias(perfil.dni);
        return;
      }

      await addDoc(collection(db, "asistencia"), {
        apellido: perfil.apellido || "Sin apellido",
        nombre: perfil.nombre || "Sin nombre",
        dni: perfil.dni || "Sin DNI",
        departamento: perfil.departamento || "Sin departamento",
        nivelEducativo: nivel,
        curso: selectedCourse,
        cursoTitulo: selectedCourse,
        cursoId: selectedCourseId || null,
        fecha: fechaDisplay,
        fechaYMD: normalizarFechaYMD(fechaDisplay),
        presencial: false,
        modalidad: "virtual",
        estadoAsistencia: "validada",
        asistenciaValidada: true,
        asistenciaValida: true,
        presente: true,
        requisitoPresencialVirtual,
        encuentrosPresencialesValidados: Array.from(idsEncuentrosCumplidos),
        createdAt: serverTimestamp(),
      });

      alert("Asistencia virtual registrada con éxito.");
      setNivel("");
      await fetchAsistencias(perfil.dni);
    } catch (e) {
      console.error(e);
      alert(e?.message || "No se pudo registrar. Intente nuevamente.");
    } finally {
      setProcesandoAsistencia(false);
      setMensajeProceso("Procesando asistencia...");
    }
  };

  const abrirQR = () => {
    if (!nivel) return alert("Seleccione un nivel educativo antes de continuar.");

    if (!botonHabilitado || !habilitadaCfg) {
      return alert("Asistencia deshabilitada por el organizador.");
    }

    if (!selectedCourse) return alert("No hay curso habilitado actualmente.");

    if (modalidad !== "presencial" || (metodo !== "qr_static" && metodo !== "qr_dynamic")) {
      return alert("Este curso no utiliza registro por QR.");
    }

    scannedRef.current = false;
    setCodeInput("");
    setQrVisible(true);
  };

  const confirmarRegistroPresencial = () => {
    if (!nivel) return alert("Seleccione un nivel educativo antes de continuar.");

    confirmDialog({
      header: "Confirmar titular del dispositivo",
      icon: "pi pi-exclamation-triangle",
      message: (
        <div style={{ display: "grid", gap: 10 }}>
          <div>
            Vas a registrar asistencia como <strong>{afiliadoLabel}</strong>, DNI{" "}
            <strong>{perfil.dni}</strong>.
          </div>
          <div>
            Este dispositivo quedará vinculado a ese afiliado. Si el celular no
            te pertenece, no continúes: no podrá utilizarse para registrar la
            asistencia de otra persona.
          </div>
          <strong>¿Confirmás que sos el titular de esta cuenta y del dispositivo?</strong>
        </div>
      ),
      acceptLabel: "Sí, continuar",
      rejectLabel: "Cancelar",
      acceptClassName: "p-button-warning",
      accept: abrirQR,
    });
  };

  const validarYRegistrarPresencial = async (sessionId, codeParam, tipoParam = "") => {
    if (!perfil?.dni) throw new Error("No se encontró el DNI del usuario.");
    if (perfilNoEncontrado) throw new Error("No se encontró el usuario.");
    if (!nivel) throw new Error("Seleccione un nivel educativo.");
    if (!botonHabilitado) throw new Error("El registro de asistencia está deshabilitado.");
    if (!habilitadaCfg) throw new Error("La asistencia no está habilitada por el organizador.");
    if (!selectedCourse) throw new Error("No hay curso habilitado actualmente.");
    if (modalidad !== "presencial") throw new Error("El curso habilitado no es presencial.");
    if (!sessionId) throw new Error("No se pudo resolver la sesión activa.");
    if (!codeParam) throw new Error("Debe ingresar un código válido.");

    setProcesandoAsistencia(true);
    setMensajeProceso("Validando QR y sesión activa...");

    const sesRef = doc(db, "asistencia_sesiones", sessionId);
    const sesSnap = await getDoc(sesRef);

    if (!sesSnap.exists()) throw new Error("Sesión de asistencia no encontrada.");

    const sesion = sesSnap.data() || {};

    if (sesion.estado !== "abierta") throw new Error("Sesión cerrada o vencida.");
    if (!nowIsBetween(sesion.desde, sesion.hasta)) {
      throw new Error("Fuera de la ventana horaria de asistencia.");
    }

    if (
      String(sesion.codigo || "").trim().toUpperCase() !==
      String(codeParam || "").trim().toUpperCase()
    ) {
      throw new Error("Código inválido o no vigente.");
    }

    setMensajeProceso("Validando DNI y dispositivo vinculado...");
    const deviceId = await validarDispositivoAfiliado();

    setMensajeProceso("Verificando registro de ingreso y salida...");

    let docAsistencia = await buscarDocAsistenciaSesion(sessionId, perfil.dni);
    let anterior = docAsistencia.exists ? docAsistencia.data : null;

    const tipoDesdeSesion =
      tipoParam ||
      sesion.tipoRegistro ||
      sesion.tipo_registro ||
      sesion.tipo ||
      sesion.registroTipo ||
      sesion.momento ||
      sesion.accion ||
      sesion.tipoQR ||
      "";

    let tipoRegistroQR = normalizarTipoRegistroQR(tipoDesdeSesion, anterior);

    /*
      Corrección web para QR de salida:
      Si la salida usa una sesión distinta a la del ingreso, primero no va a
      encontrar el documento `${sessionId}_${dni}`. En ese caso buscamos un
      ingreso pendiente del mismo DNI y del mismo curso, y completamos la salida
      sobre ese mismo documento.
    */
    if (tipoRegistroQR === "salida" && !tieneIngresoRegistrado(anterior)) {
      const ingresoPendiente = await buscarIngresoPendienteMismoCurso({
        dniValue: perfil.dni,
        sesion,
      });

      if (ingresoPendiente?.exists) {
        docAsistencia = ingresoPendiente;
        anterior = ingresoPendiente.data;
      }
    }

    if (tipoRegistroQR === "completa") {
      throw new Error("La asistencia ya tiene ingreso y salida registrados.");
    }

    const nowISO = new Date().toISOString();

    const baseRegistro = {
      sessionId,
      uid: perfil?.dni || "sin_dni",
      dni: perfil?.dni ?? null,
      apellido: perfil?.apellido || "Sin apellido",
      nombre: perfil?.nombre || "Sin nombre",
      departamento: perfil?.departamento || "Sin departamento",
      nivelEducativo: nivel,
      curso: selectedCourse,
      cursoTitulo: selectedCourse,
      cursoId: sesion?.cursoId || selectedCourseId || null,
      codigoUsado: codeParam,
      fecha: fechaDisplay,
      presencial: true,
      modalidad: "presencial",
      requiereSalida: true,
      validacionAsistencia: "ingreso_salida",
      deviceId,
      dispositivoAsistenciaId: deviceId,
      dispositivoValidado: true,
      updatedAt: serverTimestamp(),
    };

    if (tipoRegistroQR === "ingreso") {
      const ingresoRegistrado = tieneIngresoRegistrado(anterior);
      const salidaRegistrada = tieneSalidaRegistrada(anterior);

      if (ingresoRegistrado) {
        throw new Error(
          salidaRegistrada
            ? "La asistencia ya tiene ingreso y salida registrados."
            : "El ingreso ya fue registrado. Al finalizar, escaneá el QR de salida."
        );
      }

      setMensajeProceso("Guardando ingreso...");

      await setDoc(
        docAsistencia.ref,
        {
          ...baseRegistro,
          ingreso: {
            registrado: true,
            codigoUsado: codeParam,
            fechaHoraISO: nowISO,
            deviceId,
            dispositivoValidado: true,
            createdAt: serverTimestamp(),
          },
          salida: anterior?.salida || { registrado: false },
          codigoIngreso: codeParam,
          asistenciaValidada: false,
          asistenciaValida: false,
          presente: false,
          estadoAsistencia: "pendiente_salida",
          createdAt: anterior?.createdAt || serverTimestamp(),
        },
        { merge: true }
      );

      alert(
        "Ingreso registrado correctamente. Para validar la asistencia completa, escaneá el QR de salida al finalizar."
      );
    }

    if (tipoRegistroQR === "salida") {
      const ingresoRegistrado = tieneIngresoRegistrado(anterior);
      const salidaRegistrada = tieneSalidaRegistrada(anterior);

      if (!ingresoRegistrado) {
        throw new Error(
          "No se encontró un ingreso válido para esta misma sesión. Primero debe registrarse el ingreso."
        );
      }

      if (salidaRegistrada) {
        throw new Error("La salida ya fue registrada. La asistencia está validada.");
      }

      setMensajeProceso("Guardando salida...");

      await setDoc(
        docAsistencia.ref,
        {
          ...baseRegistro,
          // Conserva la sesión original del ingreso cuando la salida se marca
          // con otra sesión/otro QR, y deja auditoría de la sesión de salida.
          sessionId: anterior?.sessionId || sessionId,
          sessionIdSalida: sessionId,
          codigoSalida: codeParam,
          salida: {
            registrado: true,
            codigoUsado: codeParam,
            fechaHoraISO: nowISO,
            deviceId,
            dispositivoValidado: true,
            createdAt: serverTimestamp(),
          },
          asistenciaValidada: true,
          asistenciaValida: true,
          presente: true,
          estadoAsistencia: "validada",
        },
        { merge: true }
      );

      alert("Salida registrada correctamente. Tu asistencia quedó validada.");
    }

    setMensajeProceso("Actualizando historial de asistencia...");
    await fetchAsistencias(perfil.dni);
  };

  const onQrResult = async (result, error) => {
    if (error) return;
    if (!result || scannedRef.current) return;

    const text = result?.text || result?.getText?.() || "";
    if (!text) return;

    scannedRef.current = true;
    setQrVisible(false);

    try {
      await procesarTextoQR(text);
    } catch (e) {
      console.error("QR asistencia:", e);
      alert(e?.message || "QR inválido.");
      scannedRef.current = false;
    } finally {
      setProcesandoAsistencia(false);
      setMensajeProceso("Procesando asistencia...");
    }
  };

  const onManualCodeSubmit = async () => {
    if (!codeInput.trim()) return alert("Ingresá el código del QR.");

    try {
      setManualLoading(true);
      setQrVisible(false);
      await procesarTextoQR(codeInput.trim());
      setCodeInput("");
    } catch (e) {
      console.error("Error al validar código manual:", e);
      alert(e?.message || "Código inválido.");
    } finally {
      setManualLoading(false);
      setProcesandoAsistencia(false);
      setMensajeProceso("Procesando asistencia...");
    }
  };

  const verConstancia = ({ item, grupo, configCurso }) => {
    if (item?.modalidad !== "presencial") return;

    if (!puedeMostrarConstanciaEnItem(item, configCurso)) {
      alert(
        getMensajeConstanciaNoDisponible({
          cargandoConstancias,
          configCurso,
          item,
        })
      );
      return;
    }

    setConstanciaSeleccionada({
      item,
      grupo,
      configCurso,
    });
  };

  const levelSelected = Boolean(nivel);

  const isVirtualActive =
    botonHabilitado &&
    habilitadaCfg &&
    Boolean(selectedCourse) &&
    modalidad === "virtual" &&
    levelSelected;

  const isPresencialQRActive =
    botonHabilitado &&
    habilitadaCfg &&
    Boolean(selectedCourse) &&
    modalidad === "presencial" &&
    (metodo === "qr_static" || metodo === "qr_dynamic") &&
    levelSelected;

  const afiliadoLabel = useMemo(
    () => nombreAfiliado(perfil.apellido, perfil.nombre),
    [perfil.apellido, perfil.nombre]
  );

  const volver = () => history.push("/capacitaciones");

  const asistenciasVista = useMemo(
    () => asistencias.map(buildAttendanceRow),
    [asistencias]
  );

  const asistenciasAgrupadas = useMemo(
    () => agruparPorCurso(asistenciasVista),
    [asistenciasVista]
  );

  return (
    <div className={styles.page}>
      <ConfirmDialog />
      <h2 className={styles.title}>Mi registro de asistencia</h2>

      <Card className={styles.card}>
        <div className={`${styles.formGrid} ${styles.readonly}`}>
          <div className={`${styles.field} ${styles.colSpan2}`}>
            <label className={styles.label} htmlFor="afiliado">
              Afiliado
            </label>
            <InputText id="afiliado" value={afiliadoLabel} disabled />
          </div>

          <div className={styles.field}>
            <label className={styles.label} htmlFor="dni">
              DNI
            </label>
            <InputText id="dni" value={perfil.dni} disabled />
          </div>

          <div className={styles.field}>
            <label className={styles.label} htmlFor="depto">
              Departamento
            </label>
            <InputText id="depto" value={perfil.departamento} disabled />
          </div>
        </div>

        {cargandoPerfil && <Message severity="info" text="Cargando perfil..." />}

        {!cargandoPerfil && perfilNoEncontrado && (
          <Message
            severity="warn"
            text="No se encontró el usuario con el DNI provisto."
          />
        )}
      </Card>

      <Card className={styles.card}>
        <div className={styles.formGrid}>
          <div className={styles.field}>
            <label className={styles.label} htmlFor="nivel">
              Nivel Educativo
            </label>

            <Dropdown
              id="nivel"
              value={nivel}
              onChange={(e) => setNivel(e.value)}
              options={NIVELES}
              optionLabel="label"
              optionValue="value"
              placeholder="Seleccione un nivel educativo"
              className="w-full"
              disabled={perfilNoEncontrado || procesandoAsistencia}
            />
          </div>

          <div className={styles.field}>
            <label className={styles.label}>Curso habilitado</label>

            <div className={styles.courseCard}>
              <div className={styles.asisItemTitle}>
                {cargandoCfg ? "Cargando..." : selectedCourse || "(no hay curso habilitado)"}
              </div>

              <div className={styles.asisItemMeta}>
                <span
                  className={`${styles.chip} ${
                    habilitadaCfg ? styles.chipOk : styles.chipWarn
                  }`}
                >
                  {habilitadaCfg ? "Habilitado" : "Inactivo"}
                </span>

                <span className={`${styles.chip} ${styles.chipMode}`}>
                  Modalidad: {cap(modalidad)}
                </span>
              </div>

              <div className={styles.date}>
                <small>Fecha: {fechaDisplay}</small>
              </div>
            </div>
          </div>
        </div>

        <div className={styles.actions}>
          <Button
            type="button"
            label="Regresar a capacitaciones"
            icon="pi pi-arrow-left"
            className={`p-button-outlined p-button-secondary ${styles.btnBack}`}
            onClick={volver}
            disabled={procesandoAsistencia}
          />

          {modalidad === "virtual" ? (
            <Button
              label={cargandoBoton ? "Verificando..." : "Registrar asistencia virtual"}
              onClick={registrarVirtual}
              loading={cargandoBoton || cargandoCfg}
              disabled={!isVirtualActive || cargandoCfg || cargandoBoton || procesandoAsistencia}
              className={styles.btnPrimary}
            />
          ) : (
            <Button
              label="Registrar asistencia Presencial QR"
              onClick={confirmarRegistroPresencial}
              disabled={!isPresencialQRActive || cargandoCfg || cargandoBoton || procesandoAsistencia}
              className={styles.btnPrimary}
            />
          )}
        </div>
      </Card>

      <Card className={styles.card}>
        <h3 className={styles.sectionTitle}>Asistencias cargadas</h3>

        {cargandoAsistencias && (
          <Message severity="info" text="Cargando asistencias..." />
        )}

        {asisError && <Message severity="error" text={asisError} />}

        {!cargandoAsistencias && !asisError && asistenciasAgrupadas.length === 0 && (
          <Message severity="warn" text="Aún no registraste asistencias." />
        )}

        {!cargandoAsistencias && asistenciasAgrupadas.length > 0 && (
          <div className={styles.asisList}>
            {asistenciasAgrupadas.map((grupo) => (
              <div key={grupo.key} className={styles.courseGroup}>
                <div className={styles.courseGroupTitle}>
                  Curso: <span>{grupo.curso}</span>
                </div>

                <div className={styles.courseDatesList}>
                  {grupo.items.map((a) => {
                    const estadoClase = getEstadoClase(a.severity);
                    const esPresencial = a.modalidad === "presencial";
                    const configCurso = obtenerConfigConstanciaParaItem(
                      a,
                      constanciasPorCurso
                    ) || obtenerConfigConstanciaParaGrupo(grupo, constanciasPorCurso);
                    const puedeVerConstancia =
                      esPresencial &&
                      puedeMostrarConstanciaEnItem(a, configCurso);

                    const itemClass =
                      estadoClase === "ok"
                        ? styles.asisCardOk
                        : estadoClase === "warn"
                        ? styles.asisCardWarn
                        : styles.asisCardDanger;

                    const badgeClass =
                      estadoClase === "ok"
                        ? styles.estadoOk
                        : estadoClase === "warn"
                        ? styles.estadoWarn
                        : styles.estadoDanger;

                    const textClass =
                      estadoClase === "ok"
                        ? styles.textOk
                        : estadoClase === "warn"
                        ? styles.textWarn
                        : styles.textDanger;

                    return (
                      <div
                        key={a.id || `${a.curso}-${a.fecha}-${a.modalidad}`}
                        className={`${styles.attendanceDateCard} ${itemClass}`}
                      >
                        <div className={styles.asisHeader}>
                          <div className={styles.asisFechaBloque}>
                            <strong className={styles.asisFecha}>{a.fecha}</strong>
                            <span className={styles.asisModalidad}>
                              Modalidad: {a.modalidadVista}
                            </span>
                          </div>

                          <span className={`${styles.estadoBadge} ${badgeClass}`}>
                            {a.estadoLabel}
                          </span>
                        </div>

                        {esPresencial && (
                          <div className={styles.checkGrid}>
                            <div
                              className={`${styles.checkBox} ${
                                a.ingresoRegistrado ? styles.checkBoxOk : styles.checkBoxDanger
                              }`}
                            >
                              <span className={styles.checkLabel}>Ingreso</span>
                              <strong className={styles.checkValue}>
                                {a.ingresoRegistrado
                                  ? `Sí${
                                      formatHora(a.ingresoFechaHora)
                                        ? ` · ${formatHora(a.ingresoFechaHora)}`
                                        : ""
                                    }`
                                  : "No registrado"}
                              </strong>
                            </div>

                            <div
                              className={`${styles.checkBox} ${
                                a.salidaRegistrada ? styles.checkBoxOk : styles.checkBoxDanger
                              }`}
                            >
                              <span className={styles.checkLabel}>Salida</span>
                              <strong className={styles.checkValue}>
                                {a.salidaRegistrada
                                  ? `Sí${
                                      formatHora(a.salidaFechaHora)
                                        ? ` · ${formatHora(a.salidaFechaHora)}`
                                        : ""
                                    }`
                                  : "No registrada"}
                              </strong>
                            </div>
                          </div>
                        )}

                        <p className={`${styles.estadoDetalle} ${textClass}`}>{a.detalle}</p>

                        {puedeVerConstancia && (
                          <Button
                            label={TEXTO_BOTON_CONSTANCIA}
                            className={styles.btnConstancia}
                            onClick={() =>
                              verConstancia({ item: a, grupo, configCurso })
                            }
                          />
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      <Dialog
        header="Escanear código QR"
        visible={qrVisible}
        style={{ width: "min(720px, 95vw)" }}
        modal
        onHide={() => setQrVisible(false)}
      >
        <div className={styles.qrContent}>
          <Message
            severity="info"
            text="Apuntá la cámara al QR entregado por la organización o ingresá el código manualmente."
          />

          <div className={styles.qrBox}>
            <QrReader
              constraints={{ facingMode: "environment" }}
              onResult={onQrResult}
              videoStyle={{ width: "100%", height: "100%", objectFit: "cover" }}
            />
          </div>

          <div className={styles.formGrid}>
            <div className={`${styles.field} ${styles.colSpan2}`}>
              <label className={styles.label} htmlFor="codigoManual">
                Código del QR o URL completa
              </label>

              <InputText
                id="codigoManual"
                value={codeInput}
                onChange={(e) => setCodeInput(e.target.value)}
                placeholder="Ej: ABCD-1234 o sidca://asistencia?s=auto&c=ABCD-1234"
              />
            </div>
          </div>

          <div className={styles.qrActions}>
            <Button
              label="Validar código manual"
              onClick={onManualCodeSubmit}
              loading={manualLoading}
              className={styles.btnPrimary}
            />

            <Button
              label="Cancelar"
              className="p-button-text"
              onClick={() => setQrVisible(false)}
            />
          </div>
        </div>
      </Dialog>

      <Dialog
        header="Procesando asistencia..."
        visible={procesandoAsistencia}
        modal
        closable={false}
        closeOnEscape={false}
        draggable={false}
        style={{ width: "min(420px, 92vw)" }}
      >
        <div className={styles.processingBox}>
          <ProgressSpinner />
          <h3>Procesando...</h3>
          <p>{mensajeProceso}</p>
          <small>No cierres la app hasta que finalice el registro.</small>
        </div>
      </Dialog>

      <ConstanciaPreview
        visible={Boolean(constanciaSeleccionada)}
        onHide={() => setConstanciaSeleccionada(null)}
        perfil={perfil}
        item={constanciaSeleccionada?.item}
        grupo={constanciaSeleccionada?.grupo}
        configCurso={constanciaSeleccionada?.configCurso}
      />
    </div>
  );
}
