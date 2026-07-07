// src/components/HabilitarBotones/qr/qrUtils.js

import {
  collection,
  deleteField,
  doc,
  getDocs,
  limit,
  orderBy,
  query,
  setDoc,
  writeBatch,
} from "firebase/firestore";
import { db } from "../../../firebase/firebase-config";

export const DEVICE_ID_KEY = "sidca_qr_device_id";
export const DEVICE_NAME_KEY = "sidca_qr_device_nombre";

export const TIPO_REGISTRO_OPTIONS = [
  { label: "Ingreso", value: "ingreso" },
  { label: "Salida", value: "salida" },
];

export const INTERVALO_QR_OPTIONS = [
  { label: "45 segundos", value: 45 },
  { label: "1 minuto", value: 60 },
  { label: "2 minutos", value: 120 },
  { label: "3 minutos", value: 180 },
  { label: "5 minutos", value: 300 },
];

export const getTipoRegistroLabel = (tipo) => {
  if (tipo === "salida") return "SALIDA";
  return "INGRESO";
};

export const genCodigo = () => {
  const a = Math.random().toString(36).slice(2, 6);
  const b = Math.random().toString(36).slice(2, 6);
  return `${a}-${b}`.toUpperCase();
};

export const genDeviceId = () => {
  const a = Date.now().toString(36);
  const b = Math.random().toString(36).slice(2, 8);
  return `qr_${a}_${b}`;
};

export const crearQrPayload = (codigo, tipoRegistro = "ingreso") => {
  return `sidca://asistencia?s=${encodeURIComponent("auto")}&c=${encodeURIComponent(
    codigo
  )}&t=${encodeURIComponent(tipoRegistro)}&v=1`;
};

export const toISO = (localDateTimeStr) => {
  if (!localDateTimeStr) return null;
  const d = new Date(localDateTimeStr);
  return d.toISOString();
};

export const nowPlusMinutesLocalStr = (mins) => {
  const d = new Date();
  d.setMinutes(d.getMinutes() + mins);

  const pad = (n) => String(n).padStart(2, "0");
  const yyyy = d.getFullYear();
  const MM = pad(d.getMonth() + 1);
  const dd = pad(d.getDate());
  const hh = pad(d.getHours());
  const mm = pad(d.getMinutes());

  return `${yyyy}-${MM}-${dd}T${hh}:${mm}`;
};

export const formatFechaHoraAR = (value) => {
  if (!value) return "—";

  const dateValue = value?.toDate?.() ? value.toDate() : value;
  const d = new Date(dateValue);

  if (Number.isNaN(d.getTime())) return String(value);

  return d.toLocaleString("es-AR", {
    dateStyle: "short",
    timeStyle: "short",
  });
};

export const normalizarQrSync = (value = {}) => {
  const pantallasAutorizadas = Array.isArray(value?.pantallasAutorizadas)
    ? value.pantallasAutorizadas
    : [];

  return {
    habilitada: !!value?.habilitada,
    abrirQr: !!value?.abrirQr,
    cerrarQr: !!value?.cerrarQr,
    sessionId: value?.sessionId || null,
    pantallasAutorizadas,
    updatedAt: value?.updatedAt || null,
  };
};

export const normalizarPantallasRegistradas = (value) => {
  if (!value || typeof value !== "object") return {};
  return value;
};

export async function vaciarColeccion(path, batchSize = 400) {
  const colRef = collection(db, path);

  while (true) {
    const snap = await getDocs(query(colRef, orderBy("__name__"), limit(batchSize)));

    if (snap.empty) break;

    const batch = writeBatch(db);
    snap.docs.forEach((d) => batch.delete(d.ref));
    await batch.commit();
  }
}

export async function deshabilitarYBorrarTodasLasSesiones(pantallasAutorizadas = []) {
  await setDoc(
    doc(db, "cod", "asistencia"),
    {
      habilitada: false,
      sessionId: deleteField(),
      cursoId: deleteField(),
      cursoTitulo: deleteField(),
      modalidad: deleteField(),
      metodo: deleteField(),
      requisitoPresencialVirtual: deleteField(),
      encuentrosPresencialesRequeridos: deleteField(),
      cantidadEncuentrosPresencialesRequeridos: deleteField(),
      qrSync: {
        habilitada: false,
        abrirQr: false,
        cerrarQr: true,
        sessionId: null,
        pantallasAutorizadas,
        updatedAt: new Date(),
      },
    },
    { merge: true }
  );

  await vaciarColeccion("asistencia_sesiones");
}
