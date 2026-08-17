// src/utils/adminSession.js
//
// Política de sesión del ADMINISTRADOR.
//
// Sólo aplica al administrador autenticado con Firebase Authentication.
// NO afecta al usuario normal de SIDCA, que ingresa por DNI y no pasa por
// Firebase Auth.
//
// Regla: 5 horas consecutivas SIN actividad cierran la sesión por completo.
// No es un plazo desde el login: cada interacción real del administrador
// reinicia el contador.
//
// Este módulo sólo conoce el almacenamiento y el tiempo. El cierre efectivo
// (signOut + limpieza de Redux) vive en cerrarSesionAdmin(), en el módulo de
// acciones, para que el cierre manual y el automático compartan exactamente
// el mismo camino.

/**
 * Inactividad máxima permitida.
 *
 * PARA PROBAR EN DESARROLLO: bajar temporalmente a 2 * 60 * 1000 (2 minutos)
 * y RESTAURAR este valor antes de dar por terminada la prueba.
 */
export const ADMIN_SESSION_IDLE_MS = 5 * 60 * 60 * 1000;

/** Cada cuánto, como máximo, se escribe la marca de actividad. */
export const ACTIVIDAD_THROTTLE_MS = 30 * 1000;

/** Cada cuánto se comprueba si venció la inactividad. */
export const CHEQUEO_INACTIVIDAD_MS = 30 * 1000;

export const CLAVE_ES_ADMIN = "es_admin";
export const CLAVE_USUARIO = "user";
export const CLAVE_ULTIMA_ACTIVIDAD = "sidca_admin_last_activity";

/**
 * Motivo del último cierre. Se escribe justo antes de redirigir y lo consume
 * LoginAdmin para explicar por qué se cerró la sesión. Es transitorio: se
 * borra apenas se lee.
 */
export const CLAVE_MOTIVO_CIERRE = "sidca_admin_cierre_motivo";

export const MOTIVO_INACTIVIDAD = "inactividad";
export const MOTIVO_MANUAL = "manual";

export const MENSAJE_INACTIVIDAD =
  "Tu sesión se cerró por 5 horas de inactividad. Iniciá sesión nuevamente.";

/** ¿El storage dice que hay una sesión administrativa? */
export const esSesionAdmin = () => {
  try {
    return sessionStorage.getItem(CLAVE_ES_ADMIN) === "true";
  } catch (e) {
    return false;
  }
};

export const leerUltimaActividad = () => {
  try {
    const valor = Number(sessionStorage.getItem(CLAVE_ULTIMA_ACTIVIDAD));
    return Number.isFinite(valor) && valor > 0 ? valor : 0;
  } catch (e) {
    return 0;
  }
};

let ultimaEscritura = 0;

/**
 * Registra actividad real del administrador.
 *
 * Con throttle para no escribir en sessionStorage en cada evento: alcanza con
 * una escritura cada ACTIVIDAD_THROTTLE_MS. `forzar` la salta, y se usa en el
 * login, donde la marca tiene que quedar sí o sí.
 *
 * No hace nada si no hay sesión administrativa: la renovación de token, el
 * polling y los timers no deben extender el plazo.
 */
export const registrarActividadAdmin = (forzar = false) => {
  if (!esSesionAdmin()) return;

  const ahora = Date.now();
  if (!forzar && ahora - ultimaEscritura < ACTIVIDAD_THROTTLE_MS) return;

  ultimaEscritura = ahora;

  try {
    sessionStorage.setItem(CLAVE_ULTIMA_ACTIVIDAD, String(ahora));
  } catch (e) {
    /* storage lleno o bloqueado: no es motivo para romper la app */
  }
};

/**
 * ¿Venció la sesión administrativa por inactividad?
 *
 * Sin sesión administrativa no hay nada que vencer.
 *
 * Si hay sesión pero NO hay marca de actividad, se considera vencida: es el
 * caso de una sesión abierta antes de que existiera esta política, y no hay
 * forma de saber cuánto lleva inactiva. Se prefiere pedir login de nuevo
 * antes que conceder un plazo que no se puede justificar.
 */
export const sesionAdminExpirada = () => {
  if (!esSesionAdmin()) return false;

  const ultima = leerUltimaActividad();
  if (!ultima) return true;

  return Date.now() - ultima >= ADMIN_SESSION_IDLE_MS;
};

/** Milisegundos que faltan para el cierre. 0 si ya venció. */
export const restanteSesionAdmin = () => {
  const ultima = leerUltimaActividad();
  if (!ultima) return 0;
  return Math.max(0, ultima + ADMIN_SESSION_IDLE_MS - Date.now());
};

/**
 * Borra TODAS las claves de sesión administrativa.
 *
 * Punto único: si más adelante se agrega otra clave exclusivamente
 * administrativa, va acá y queda cubierta tanto por el cierre manual como
 * por el automático.
 */
export const limpiarSesionAdminStorage = () => {
  try {
    sessionStorage.removeItem(CLAVE_USUARIO);
    sessionStorage.removeItem(CLAVE_ES_ADMIN);
    sessionStorage.removeItem(CLAVE_ULTIMA_ACTIVIDAD);
  } catch (e) {
    /* nada que hacer */
  }

  ultimaEscritura = 0;
};

export const marcarMotivoCierre = (motivo) => {
  try {
    sessionStorage.setItem(CLAVE_MOTIVO_CIERRE, motivo);
  } catch (e) {
    /* nada que hacer */
  }
};

/** Lee y borra el motivo del último cierre. */
export const consumirMotivoCierre = () => {
  try {
    const motivo = sessionStorage.getItem(CLAVE_MOTIVO_CIERRE);
    if (motivo) sessionStorage.removeItem(CLAVE_MOTIVO_CIERRE);
    return motivo || "";
  } catch (e) {
    return "";
  }
};

// ====================================================================
// FIREBASE ID TOKEN
// ====================================================================

let promesaInicializacion = null;

/**
 * Espera a que Firebase Auth termine de restaurar la sesión.
 *
 * Al refrescar la página auth.currentUser es null durante los primeros
 * milisegundos aunque el administrador siga logueado. Preguntar por
 * currentUser sin esperar es la causa del falso
 * "Tu sesión no está activa. Iniciá sesión nuevamente."
 *
 * onAuthStateChanged dispara una primera vez cuando la inicialización
 * termina, con el usuario restaurado o con null. Esa primera emisión es la
 * única que interesa.
 *
 * La promesa se cachea mientras está pendiente para no abrir un listener por
 * cada request simultáneo, y se libera al resolverse para que un login
 * posterior no quede atado a un resultado viejo.
 */
export const esperarInicializacionAuth = (auth) => {
  if (auth.currentUser) return Promise.resolve(auth.currentUser);
  if (promesaInicializacion) return promesaInicializacion;

  promesaInicializacion = new Promise((resolve) => {
    const desuscribir = auth.onAuthStateChanged((usuario) => {
      desuscribir();
      promesaInicializacion = null;
      resolve(usuario || null);
    });
  });

  return promesaInicializacion;
};

/**
 * Mantiene sincronizada la copia legacy sessionStorage.user.accessToken.
 *
 * Esa copia NO es la fuente de verdad para los requests —lo es
 * user.getIdToken()— pero AdminRoute todavía comprueba su existencia, así que
 * conviene que no quede vieja.
 */
export const sincronizarAccessToken = (token) => {
  try {
    const crudo = sessionStorage.getItem(CLAVE_USUARIO);
    if (!crudo) return;

    const usuario = JSON.parse(crudo);
    if (!usuario || usuario.accessToken === token) return;

    usuario.accessToken = token;
    sessionStorage.setItem(CLAVE_USUARIO, JSON.stringify(usuario));
  } catch (e) {
    /* si el JSON está corrupto no vale la pena romper el request */
  }
};

const errorSesion = (mensaje) =>
  Object.assign(new Error(mensaje), { status: 401 });

/**
 * Devuelve el Firebase ID Token VIGENTE del administrador.
 *
 * Punto único para todas las operaciones administrativas protegidas. Orden:
 *
 *   1. ¿sigue habiendo sesión administrativa?
 *   2. ¿no venció por inactividad?   (falla antes de gastar el request)
 *   3. esperar la inicialización de Firebase Auth
 *   4. ¿hay usuario?
 *   5. getIdToken() — Firebase renueva solo si está por vencer
 *   6. sincronizar la copia legacy
 *
 * forzarRefresco pide un token nuevo aunque el actual siga vigente; se usa al
 * reintentar tras un 401.
 */
export const getAdminIdToken = async (
  auth,
  { forzarRefresco = false } = {}
) => {
  if (!esSesionAdmin()) {
    throw errorSesion("Tu sesión administrativa no está activa. Iniciá sesión nuevamente.");
  }

  if (sesionAdminExpirada()) {
    throw errorSesion(MENSAJE_INACTIVIDAD);
  }

  const usuario = await esperarInicializacionAuth(auth);

  if (!usuario) {
    throw errorSesion("Tu sesión no está activa. Iniciá sesión nuevamente.");
  }

  const token = await usuario.getIdToken(forzarRefresco);
  sincronizarAccessToken(token);

  return token;
};
