// src/services/certificadosValidacionService.js
//
// Acceso al endpoint de VALIDACIÓN de certificados.
//
// Separado de certificadosService.js a propósito: aquel obtiene el token con
// getAdminIdToken(), que exige sesión administrativa y comprueba el timeout de
// 5 horas del panel. Los validadores designados no son administradores, así
// que esa vía los rechazaría.
//
// Acá la sesión es la de validatorAuth — la instancia Firebase aislada — y el
// permiso lo resuelve el backend, que acepta administrador O usuario con
// validarCertificados === true.
//
// Sobre los dos "tokens" que aparecen en este flujo, que NO son lo mismo:
//   certificadoToken : los 48 hex que viajan en la URL del QR, identifican el
//                      certificado y son parte del path del endpoint.
//   firebaseIdToken  : el JWT de Firebase Auth que acredita QUIÉN consulta, y
//                      viaja en el header Authorization.

import {
  browserSessionPersistence,
  setPersistence,
  signInWithEmailAndPassword,
  signOut,
} from "firebase/auth";

import { validatorAuth } from "../firebase/firebaseCertificadosValidator";

const API_BASE_URL = String(
  process.env.REACT_APP_CERTIFICADOS_API_BASE_URL || ""
)
  .trim()
  .replace(/\/+$/, "");

const MENSAJES_POR_ESTADO = {
  400: "El enlace de validación no es válido.",
  401: "La sesión venció. Ingresá nuevamente.",
  403: "Tu cuenta no tiene permiso para validar certificados SIDCA.",
  404: "El código QR no corresponde a un certificado emitido por SIDCA o el enlace es inválido.",
};

/**
 * Inicia sesión del validador.
 *
 * browserSessionPersistence: la sesión sobrevive un F5 —importante, porque el
 * flujo empieza escaneando un QR y recargar es habitual— pero termina al
 * cerrar el navegador. No conviene dejarla indefinidamente en un dispositivo
 * que puede ser compartido.
 */
export const iniciarSesionValidador = async (email, password) => {
  await setPersistence(validatorAuth, browserSessionPersistence);

  const credencial = await signInWithEmailAndPassword(
    validatorAuth,
    String(email || "").trim(),
    String(password || "")
  );

  return credencial.user;
};

/**
 * Cierra la sesión del validador.
 *
 * Sólo afecta a validatorAuth: la sesión administrativa del panel, su
 * sessionStorage y su marca de actividad quedan intactos.
 */
export const cerrarSesionValidador = () => signOut(validatorAuth);

/** Espera a que Firebase termine de restaurar la sesión del validador. */
export const esperarSesionValidador = () =>
  new Promise((resolve) => {
    if (validatorAuth.currentUser) {
      resolve(validatorAuth.currentUser);
      return;
    }

    const desuscribir = validatorAuth.onAuthStateChanged((usuario) => {
      desuscribir();
      resolve(usuario || null);
    });
  });

const errorValidacion = (mensaje, status) =>
  Object.assign(new Error(mensaje), { status });

/**
 * Consulta la validez de un certificado escaneado.
 *
 * Ante un 401 reintenta UNA sola vez con el ID Token refrescado — cubre el
 * caso del token vencido entre que se leyó y se envió. Sin bucles: el segundo
 * intento ya no reintenta.
 */
export const validarCertificadoQr = async (
  cursoId,
  certificadoToken,
  permitirReintento = true
) => {
  if (!API_BASE_URL) {
    throw new Error(
      "Falta configurar REACT_APP_CERTIFICADOS_API_BASE_URL en el archivo .env."
    );
  }

  const usuario = validatorAuth.currentUser;

  if (!usuario) {
    throw errorValidacion("Ingresá con una cuenta autorizada.", 401);
  }

  const firebaseIdToken = await usuario.getIdToken(!permitirReintento);

  const ruta = `/validar/${encodeURIComponent(cursoId)}/${encodeURIComponent(
    certificadoToken
  )}`;

  let respuesta;

  try {
    respuesta = await fetch(`${API_BASE_URL}${ruta}`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${firebaseIdToken}`,
      },
    });
  } catch (error) {
    throw new Error(
      "No se pudo conectar con el servidor de SIDCA. Revisá tu conexión."
    );
  }

  let datos = null;
  try {
    datos = await respuesta.json();
  } catch (error) {
    datos = null;
  }

  if (respuesta.ok) return datos?.validacion || null;

  if (respuesta.status === 401 && permitirReintento) {
    return validarCertificadoQr(cursoId, certificadoToken, false);
  }

  throw errorValidacion(
    datos?.error ||
      MENSAJES_POR_ESTADO[respuesta.status] ||
      "No se pudo validar el certificado.",
    respuesta.status
  );
};
