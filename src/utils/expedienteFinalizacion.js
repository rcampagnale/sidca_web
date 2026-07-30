// src/utils/expedienteFinalizacion.js
//
// Lógica compartida para finalizar un expediente de sueldo.
//
// Se extrajo de GestionDelegados.js para que la finalización INDIVIDUAL (botón
// "Expediente finalizado") y la CARGA MASIVA desde PDF usen exactamente las
// mismas reglas: el mismo texto de mensaje, el mismo formato de teléfono y los
// mismos campos escritos en Firestore. Si mañana cambia el mensaje, cambia en
// los dos lados a la vez.

import { serverTimestamp } from "firebase/firestore";

/* ══════════════════════════════════════════════
 * Constantes
 * ══════════════════════════════════════════════ */

export const WHATSAPP_SINDICATO = "+54 9 383 423-0813";

export const MESES_HABER = [
  { label: "Enero", value: "enero" },
  { label: "Febrero", value: "febrero" },
  { label: "Marzo", value: "marzo" },
  { label: "Abril", value: "abril" },
  { label: "Mayo", value: "mayo" },
  { label: "Junio", value: "junio" },
  { label: "Julio", value: "julio" },
  { label: "Agosto", value: "agosto" },
  { label: "Septiembre", value: "septiembre" },
  { label: "Octubre", value: "octubre" },
  { label: "Noviembre", value: "noviembre" },
  { label: "Diciembre", value: "diciembre" },
];

// Estados en los que el cierre se comunica con la observación cargada en vez
// del haber/mes de cobro (no corresponde informar un haber).
export const ESTADOS_CIERRE_CON_OBSERVACION = ["SOLICITUD", "RECLAMO", "VARIOS"];

/* ══════════════════════════════════════════════
 * Helpers
 * ══════════════════════════════════════════════ */

const limpiarTexto = (valor) => String(valor || "").trim().replace(/\s+/g, " ");

export const obtenerMesLabel = (value) =>
  MESES_HABER.find((mes) => mes.value === value)?.label.toLowerCase() ||
  value ||
  "";

export const obtenerMesCobroSiguiente = (value) => {
  const index = MESES_HABER.findIndex((mes) => mes.value === value);
  if (index < 0) return "";
  return MESES_HABER[(index + 1) % MESES_HABER.length].value;
};

// ¿Este estado necesita que se elija el mes de haber para poder finalizar?
export const requiereMesHaber = (estado) =>
  !ESTADOS_CIERRE_CON_OBSERVACION.includes(estado);

/* ══════════════════════════════════════════════
 * Teléfono / WhatsApp
 * ══════════════════════════════════════════════ */

// Normaliza a formato internacional para wa.me, sin duplicar 54/9/0/15.
//   3834123456        → 5493834123456
//   03834123456       → 5493834123456
//   5493834123456     → 5493834123456
//   +54 9 383 4123456 → 5493834123456
export const normalizarTelefonoWhatsapp = (value) => {
  let digits = String(value || "").replace(/\D/g, "");

  if (!digits) return "";

  if (digits.startsWith("00")) digits = digits.slice(2);
  if (digits.startsWith("0")) digits = digits.slice(1);

  if (digits.startsWith("54")) {
    if (!digits.startsWith("549") && digits.length >= 12) {
      digits = `549${digits.slice(2)}`;
    }
    return digits;
  }

  if (digits.length === 10) return `549${digits}`;
  if (digits.length === 11 && digits.startsWith("15")) {
    return `549${digits.slice(2)}`;
  }

  return digits;
};

export const construirUrlWhatsapp = ({ telefono, mensaje }) => {
  const phone = normalizarTelefonoWhatsapp(telefono);
  if (!phone || !mensaje) return "";
  return `https://wa.me/${phone}?text=${encodeURIComponent(mensaje)}`;
};

export const abrirWhatsapp = ({ telefono, mensaje }) => {
  const url = construirUrlWhatsapp({ telefono, mensaje });
  if (!url) return false;
  window.open(url, "_blank", "noopener,noreferrer");
  return true;
};

/* ══════════════════════════════════════════════
 * Generación del mensaje
 * ══════════════════════════════════════════════ */

const construirMensajeCierreConObservacion = ({
  afiliado,
  expediente,
  observacion,
}) => {
  const nombre = afiliado || "Docente";
  const estadoTexto = "Finalizado";
  const expedienteTexto = limpiarTexto(expediente)
    ? ` N° ${limpiarTexto(expediente)}`
    : "";
  const observacionTexto =
    limpiarTexto(observacion) || "Sin observación cargada.";

  return (
    `Estimado/a docente ${nombre}:\n\n` +
    `Le informamos que su expediente${expedienteTexto} se encuentra actualmente en estado ${estadoTexto}.\n\n` +
    "Observación:\n" +
    `${observacionTexto}\n\n` +
    "Desde el Sindicato de Docentes de Catamarca quedamos a disposición para acompañarlo/a ante cualquier consulta o novedad.\n\n" +
    "Saludos cordiales."
  );
};

const construirMensajeCierreExpediente = ({
  afiliado,
  expediente,
  haberMes,
  cobroMes,
}) => {
  const nombre = afiliado || "Docente";
  const expedienteTexto = limpiarTexto(expediente)
    ? ` N° ${limpiarTexto(expediente)}`
    : "";
  const haber = obtenerMesLabel(haberMes) || "julio";
  const cobro = obtenerMesLabel(cobroMes) || "agosto";

  return (
    `Estimado/a docente ${nombre}, le informamos que su expediente${expedienteTexto} se encuentra finalizado ` +
    `y que percibirá el haber correspondiente al mes de ${haber}, a cobrar en ${cobro}.\n\n` +
    "Desde el Sindicato de Docentes de Catamarca quedamos a disposición para acompañarlo/a ante cualquier consulta.\n\n" +
    "Saludos cordiales."
  );
};

/**
 * Generador ÚNICO del mensaje de expediente finalizado.
 * Lo usan tanto la finalización individual como la carga masiva.
 */
export const generarMensajeExpedienteFinalizado = ({
  afiliado,
  expediente,
  haberMes,
  cobroMes,
  estado,
  observacion,
}) => {
  if (ESTADOS_CIERRE_CON_OBSERVACION.includes(estado)) {
    return construirMensajeCierreConObservacion({
      afiliado,
      expediente,
      observacion,
    });
  }

  return construirMensajeCierreExpediente({
    afiliado,
    expediente,
    haberMes,
    cobroMes,
  });
};

// Alias con el nombre histórico, para no romper el código existente.
export const construirMensajeFinalizacion = generarMensajeExpedienteFinalizado;

/* ══════════════════════════════════════════════
 * Payloads de escritura en Firestore
 * ══════════════════════════════════════════════ */

/**
 * Campos que se escriben en el documento del expediente al finalizarlo.
 * Es la MISMA forma que usaba el botón individual.
 *
 * @param {object} p
 * @param {object} p.datosEdicion  departamento/nivel/dependencia/estado/estadoSueldo.
 *   En la carga masiva se pasan los valores ACTUALES del expediente, para no
 *   modificar nada más que la finalización (spec 11.12).
 * @param {object} [p.extra] Metadatos de origen (carga masiva).
 */
export const construirPayloadFinalizacion = ({
  datosEdicion,
  mensajeFinalizacion,
  telefonoDestino,
  haberFinalizacionMes,
  cobroFinalizacionMes,
  usuarioMovimiento,
  extra = {},
}) => ({
  ...datosEdicion,
  observacionActual: mensajeFinalizacion,
  finalizado: true,
  mensajeFinalizacion,
  whatsappEmisor: WHATSAPP_SINDICATO,
  whatsappDestino: normalizarTelefonoWhatsapp(telefonoDestino),
  haberFinalizacionMes,
  cobroFinalizacionMes,
  fechaFinalizacion: serverTimestamp(),
  finalizadoPor: usuarioMovimiento,
  updatedAt: serverTimestamp(),
  updatedBy: usuarioMovimiento,
  ...extra,
});

/**
 * Documento del historial (subcolección "movimientos") para la finalización.
 */
export const construirMovimientoFinalizacion = ({
  mensajeFinalizacion,
  expedienteActual,
  datosEdicion,
  usuarioMovimiento,
  extra = {},
}) => ({
  tipo: "finalizacion_expediente",
  observacion: mensajeFinalizacion || "",
  estadoAnterior: expedienteActual?.estado || "",
  estadoNuevo: datosEdicion?.estado || "",
  dependenciaAnterior: expedienteActual?.dependencia || "",
  dependenciaNueva: datosEdicion?.dependencia || "",
  estadoSueldoAnterior: expedienteActual?.estadoSueldo || "",
  estadoSueldoNuevo: datosEdicion?.estadoSueldo || "",
  fecha: serverTimestamp(),
  ...usuarioMovimiento,
  ...extra,
});

/**
 * En la carga masiva no se editan los datos del expediente: se conservan los
 * valores actuales para que la finalización no altere dependencia, estado ni
 * estado de sueldo (spec 11.12).
 */
export const datosEdicionSinCambios = (expediente) => ({
  departamento: expediente?.departamento || "",
  nivel: expediente?.nivel || "",
  dependencia: expediente?.dependencia || "",
  estado: expediente?.estado || "ALTA_DE_SERVICIO",
  estadoSueldo: expediente?.estadoSueldo || "",
});
