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
//
// DOS SESIONES POSIBLES
// La consulta puede hacerse con cualquiera de las dos sesiones Firebase que
// pueden existir en el navegador:
//
//   validatorAuth.currentUser : el validador que ingresó en esta pantalla.
//   auth.currentUser          : la sesión principal, típicamente un
//                               administrador con el panel abierto.
//
// Un administrador ya autenticado no debería tener que loguearse de nuevo sólo
// por escanear un QR. Quién tiene permiso lo decide el backend, que acepta
// administrador O usuario con validarCertificados === true; acá no se
// comprueban roles.
//
// Este módulo NUNCA hace signIn ni signOut sobre la sesión principal: sólo la
// LEE. Su ciclo de vida es del panel administrativo, no de esta pantalla.

import {
  browserLocalPersistence,
  setPersistence,
  signInWithEmailAndPassword,
  signOut,
} from "firebase/auth";

import { auth } from "../firebase/firebase-config";
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

// ====================================================================
// VENCIMIENTO DE LA SESIÓN DEL VALIDADOR
//
// La persistencia es browserLocalPersistence, compartida entre pestañas del
// mismo navegador. Es lo que hace operativo el uso real: la cámara del celular
// abre cada QR en una pestaña nueva, y con persistencia por pestaña el
// validador tendría que ingresar credenciales en cada certificado.
//
// El costo de esa persistencia es que sobrevive al cierre del navegador, así
// que hace falta un vencimiento propio: 5 horas SIN actividad. No es un plazo
// desde el login — cada validación exitosa reinicia el contador.
//
// La marca vive en localStorage y es EXCLUSIVA del validador: no comparte
// clave con sidca_admin_last_activity ni la lee.
// ====================================================================

export const VALIDADOR_IDLE_MS = 5 * 60 * 60 * 1000;

export const CLAVE_ACTIVIDAD_VALIDADOR =
  "sidca_certificados_validator_last_activity";

/** Registra actividad del validador. Sólo guarda un timestamp. */
export const registrarActividadValidador = () => {
  try {
    localStorage.setItem(CLAVE_ACTIVIDAD_VALIDADOR, String(Date.now()));
  } catch (e) {
    /* storage bloqueado: no es motivo para romper la validación */
  }
};

const limpiarActividadValidador = () => {
  try {
    localStorage.removeItem(CLAVE_ACTIVIDAD_VALIDADOR);
  } catch (e) {
    /* nada que hacer */
  }
};

const leerActividadValidador = () => {
  try {
    const valor = Number(localStorage.getItem(CLAVE_ACTIVIDAD_VALIDADOR));
    return Number.isFinite(valor) && valor > 0 ? valor : 0;
  } catch (e) {
    return 0;
  }
};

/**
 * ¿Venció la sesión del validador por inactividad?
 *
 * Sin marca se considera vencida: es el caso de una credencial persistida en
 * IndexedDB sin registro de cuándo se usó por última vez. No hay forma de
 * justificar un plazo que no se puede medir, así que se pide login de nuevo.
 */
export const sesionValidadorExpirada = () => {
  const ultima = leerActividadValidador();
  if (!ultima) return true;

  return Date.now() - ultima >= VALIDADOR_IDLE_MS;
};

/**
 * Cierra la sesión del validador si venció.
 *
 * Devuelve true si la descartó. Impide que una credencial guardada por la
 * persistencia local quede utilizable indefinidamente.
 */
export const descartarSesionValidadorVencida = async () => {
  if (!validatorAuth.currentUser) return false;
  if (!sesionValidadorExpirada()) return false;

  await signOut(validatorAuth);
  limpiarActividadValidador();

  return true;
};

/**
 * Inicia sesión del validador.
 *
 * browserLocalPersistence: la sesión se comparte entre pestañas del mismo
 * navegador, así el validador ingresa UNA vez y puede verificar muchos
 * certificados durante su turno aunque cada QR abra una pestaña nueva.
 *
 * El límite lo pone el vencimiento propio de 5 horas de inactividad, no la
 * persistencia.
 */
export const iniciarSesionValidador = async (email, password) => {
  await setPersistence(validatorAuth, browserLocalPersistence);

  const credencial = await signInWithEmailAndPassword(
    validatorAuth,
    String(email || "").trim(),
    String(password || "")
  );

  registrarActividadValidador();

  return credencial.user;
};

/**
 * Cierra la sesión del validador y borra su marca de actividad.
 *
 * Sólo afecta a validatorAuth: la sesión administrativa del panel, su
 * sessionStorage y su marca de actividad quedan intactos.
 */
export const cerrarSesionValidador = async () => {
  await signOut(validatorAuth);
  limpiarActividadValidador();
};

/**
 * Espera a que una instancia de Firebase Auth termine de restaurar su sesión.
 *
 * Al abrir el QR recién escaneado, currentUser puede ser null durante los
 * primeros milisegundos aunque la sesión exista. Preguntar sin esperar
 * mostraría el formulario a alguien que ya está autenticado — que es
 * exactamente el problema que corrige esta etapa.
 *
 * onAuthStateChanged emite una primera vez cuando la inicialización termina,
 * con el usuario restaurado o con null. Esa emisión es la que interesa. Sin
 * timeouts arbitrarios.
 */
const esperarSesion = (instanciaAuth) =>
  new Promise((resolve) => {
    if (instanciaAuth.currentUser) {
      resolve(instanciaAuth.currentUser);
      return;
    }

    const desuscribir = instanciaAuth.onAuthStateChanged((usuario) => {
      desuscribir();
      resolve(usuario || null);
    });
  });

/**
 * Sesión del validador, ya comprobada contra el vencimiento.
 *
 * Si la persistencia local restauró un usuario pero su marca de actividad está
 * vencida, se cierra la sesión y se devuelve null: una credencial guardada no
 * debe quedar utilizable para siempre.
 */
export const obtenerSesionValidador = async () => {
  const usuario = await esperarSesion(validatorAuth);

  if (!usuario) return null;

  if (sesionValidadorExpirada()) {
    await signOut(validatorAuth);
    limpiarActividadValidador();
    return null;
  }

  return usuario;
};

/**
 * Sesión Firebase principal — la del panel administrativo.
 * Sólo se lee. Este módulo no la inicia ni la cierra.
 */
export const obtenerSesionPrincipal = () => esperarSesion(auth);

/** Alias histórico. */
export const esperarSesionValidador = obtenerSesionValidador;

const errorValidacion = (mensaje, status) =>
  Object.assign(new Error(mensaje), { status });

/**
 * Consulta la validez de un certificado escaneado.
 *
 * `usuarioFirebase` decide con QUÉ identidad se consulta: puede ser el
 * validador de esta pantalla o la sesión principal. La lógica HTTP es una
 * sola — no se duplica el fetch por cada origen.
 *
 * Ante un 401 reintenta UNA vez con el ID Token refrescado, con el MISMO
 * usuario: cubre el token vencido entre la lectura y el envío. Sin bucles: el
 * segundo intento ya no reintenta.
 *
 * No decide permisos ni interpreta el 403: eso corresponde a quien llama, que
 * es el único que sabe qué sesión eligió y por lo tanto cómo reaccionar.
 */
export const validarCertificadoQr = async (
  cursoId,
  certificadoToken,
  { usuarioFirebase, permitirReintento = true } = {}
) => {
  if (!API_BASE_URL) {
    throw new Error(
      "Falta configurar REACT_APP_CERTIFICADOS_API_BASE_URL en el archivo .env."
    );
  }

  if (!usuarioFirebase) {
    throw errorValidacion("Ingresá con una cuenta autorizada.", 401);
  }

  const firebaseIdToken = await usuarioFirebase.getIdToken(!permitirReintento);

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

  if (respuesta.ok) {
    return datos?.validacion ? { ...datos.validacion, verificacion: datos.verificacion || null } : null;
  }

  if (respuesta.status === 401 && permitirReintento) {
    return validarCertificadoQr(cursoId, certificadoToken, {
      usuarioFirebase,
      permitirReintento: false,
    });
  }

  throw errorValidacion(
    datos?.error ||
      MENSAJES_POR_ESTADO[respuesta.status] ||
      "No se pudo validar el certificado.",
    respuesta.status
  );
};

/** Registra el curso usando la misma sesión autorizada que validó el QR. */
export const registrarCursoValidado = async (
  cursoId,
  certificadoToken,
  { usuarioFirebase, idToken: idTokenInicial, permitirReintento = true } = {}
) => {
  if (!API_BASE_URL) throw new Error("Falta configurar REACT_APP_CERTIFICADOS_API_BASE_URL en el archivo .env.");
  if (!usuarioFirebase && !idTokenInicial) throw errorValidacion("La sesión del validador no está disponible.", 401);

  const firebaseIdToken = idTokenInicial || await usuarioFirebase.getIdToken(!permitirReintento);
  const ruta = `/validar/${encodeURIComponent(cursoId)}/${encodeURIComponent(certificadoToken)}/registrar`;
  let respuesta;
  try {
    respuesta = await fetch(`${API_BASE_URL}${ruta}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${firebaseIdToken}` },
    });
  } catch (error) {
    throw new Error("No se pudo conectar con el servidor de SIDCA. Revisá tu conexión.");
  }
  let datos = null;
  try { datos = await respuesta.json(); } catch (error) { datos = null; }
  if (respuesta.ok) return datos?.registro || datos;
  if (respuesta.status === 401 && permitirReintento) {
    return registrarCursoValidado(cursoId, certificadoToken, { usuarioFirebase, idToken: idTokenInicial, permitirReintento: false });
  }
  throw Object.assign(new Error(datos?.error || "No se pudo registrar el curso."), { status: respuesta.status, datos });
};
