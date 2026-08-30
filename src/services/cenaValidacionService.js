// Acceso del personal de ingreso a los endpoints protegidos de Gestión Cena.
// La sesión aislada es la misma de certificados: nunca se inicia ni se cierra
// la sesión Firebase principal que pueda tener abierta un administrador.

import {
  cerrarSesionValidador,
  descartarSesionValidadorVencida,
  iniciarSesionValidador,
  registrarActividadValidador,
  sesionValidadorExpirada,
} from "./certificadosValidacionService";

export {
  cerrarSesionValidador,
  descartarSesionValidadorVencida,
  iniciarSesionValidador,
  registrarActividadValidador,
  sesionValidadorExpirada,
};

const certificadosBase = String(
  process.env.REACT_APP_CERTIFICADOS_API_BASE_URL || ""
)
  .trim()
  .replace(/\/+$/, "");

const API_BASE_URL = String(
  process.env.REACT_APP_CENA_VALIDACION_API_BASE_URL ||
    certificadosBase.replace(/\/certificados$/, "/cena")
)
  .trim()
  .replace(/\/+$/, "");

const MENSAJES_POR_ESTADO = {
  400: "El código de la tarjeta no tiene un formato válido.",
  401: "La sesión venció. Ingresá nuevamente.",
  403: "Tu cuenta no tiene permiso para validar la Cena SIDCA.",
  404: "No se encontró una tarjeta o reserva de Cena con esos datos.",
  409: "La operación no se pudo completar porque los datos cambiaron. Volvé a consultar.",
};

const errorCena = (mensaje, status, datos = null) =>
  Object.assign(new Error(mensaje), { status, datos });

const pedirCena = async (
  ruta,
  { usuarioFirebase, method = "GET", permitirReintento = true } = {}
) => {
  if (!API_BASE_URL) {
    throw new Error(
      "Falta configurar REACT_APP_CENA_VALIDACION_API_BASE_URL o REACT_APP_CERTIFICADOS_API_BASE_URL en el archivo .env."
    );
  }
  if (!usuarioFirebase) {
    throw errorCena("Ingresá con una cuenta autorizada.", 401);
  }

  const firebaseIdToken = await usuarioFirebase.getIdToken(!permitirReintento);
  let respuesta;
  try {
    respuesta = await fetch(`${API_BASE_URL}${ruta}`, {
      method,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${firebaseIdToken}`,
      },
    });
  } catch (error) {
    throw new Error("No se pudo conectar con el servidor de SIDCA. Revisá tu conexión.");
  }

  let datos = null;
  try {
    datos = await respuesta.json();
  } catch (error) {
    datos = null;
  }

  if (respuesta.ok) return datos;
  if (respuesta.status === 401 && permitirReintento) {
    return pedirCena(ruta, { usuarioFirebase, method, permitirReintento: false });
  }

  throw errorCena(
    datos?.error || MENSAJES_POR_ESTADO[respuesta.status] || "No se pudo completar la validación de Cena.",
    respuesta.status,
    datos
  );
};

export const consultarTarjetaCenaQr = async (token, opciones = {}) => {
  const datos = await pedirCena(`/validar/${encodeURIComponent(token)}`, opciones);
  return datos?.validacion || null;
};

export const consultarReservaCenaPorDni = async (anio, dni, opciones = {}) => {
  const parametros = new URLSearchParams({ anio: String(anio || ""), dni: String(dni || "") });
  const datos = await pedirCena(`/reserva?${parametros.toString()}`, opciones);
  return datos?.validacion || null;
};

export const registrarTarjetaCena = async (token, opciones = {}) => {
  const datos = await pedirCena(`/validar/${encodeURIComponent(token)}/registrar`, {
    ...opciones,
    method: "POST",
  });
  return {
    resultado: datos?.resultado || "registrada",
    validacion: datos?.validacion || null,
  };
};
