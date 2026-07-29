import { onAuthStateChanged, signInWithCustomToken } from "firebase/auth";
import { auth } from "../firebase/firebase-config";

const getPreferenceUrl = () => {
  const apiUrl = process.env.REACT_APP_MP_CREATE_PREFERENCE_URL?.trim();
  if (!apiUrl) {
    throw new Error("No está configurada REACT_APP_MP_CREATE_PREFERENCE_URL.");
  }
  return apiUrl;
};

const getApiBaseUrl = () => {
  const apiBaseUrl = process.env.REACT_APP_MP_API_BASE_URL?.trim();
  if (apiBaseUrl) {
    return apiBaseUrl.replace(/\/+$/, "");
  }

  const preferenceUrl = process.env.REACT_APP_MP_CREATE_PREFERENCE_URL?.trim();
  const derivedBaseUrl = preferenceUrl?.replace(/\/preference\/?$/, "");

  if (!derivedBaseUrl || derivedBaseUrl === preferenceUrl) {
    throw new Error(
      "No está configurada REACT_APP_MP_API_BASE_URL y no se pudo derivar desde REACT_APP_MP_CREATE_PREFERENCE_URL."
    );
  }

  return derivedBaseUrl.replace(/\/+$/, "");
};

const normalizarDni = (value) => String(value || "").replace(/\D/g, "");

const getStorage = (storageName) => {
  if (typeof window === "undefined") return null;
  try {
    return window[storageName];
  } catch {
    return null;
  }
};

const readStorageValue = (storage, key) => {
  try {
    return storage?.getItem(key) || "";
  } catch {
    return "";
  }
};

const readJsonStorage = (storage, key) => {
  const value = readStorageValue(storage, key);
  if (!value) return {};

  try {
    return JSON.parse(value) || {};
  } catch {
    return {};
  }
};

const pickFirst = (...values) =>
  values.find(
    (value) =>
      value !== undefined && value !== null && String(value).trim() !== ""
  );

const obtenerSesionUsuario = () => {
  const local = getStorage("localStorage");
  const session = getStorage("sessionStorage");

  return {
    ...readJsonStorage(local, "user"),
    ...readJsonStorage(local, "usuario"),
    ...readJsonStorage(local, "sidca_user"),
    ...readJsonStorage(session, "user"),
    ...readJsonStorage(session, "usuario"),
    ...readJsonStorage(session, "sidca_user"),
  };
};

const obtenerDniDesdeContexto = (context = {}) => {
  const sessionUser = obtenerSesionUsuario();
  const local = getStorage("localStorage");
  const session = getStorage("sessionStorage");

  return normalizarDni(
    pickFirst(
      context.dni,
      context.DNI,
      context.documento,
      context.user?.dni,
      context.user?.DNI,
      context.user?.documento,
      context.usuario?.dni,
      context.usuario?.DNI,
      context.usuario?.documento,
      context.data?.dni,
      context.data?.DNI,
      context.data?.documento,
      context.profile?.dni,
      context.profile?.DNI,
      context.profile?.documento,
      sessionUser.dni,
      sessionUser.DNI,
      sessionUser.documento,
      readStorageValue(local, "sidca_user_dni"),
      readStorageValue(local, "userDni"),
      readStorageValue(local, "dni"),
      readStorageValue(session, "sidca_user_dni"),
      readStorageValue(session, "userDni"),
      readStorageValue(session, "dni")
    )
  );
};

const obtenerUsuarioIdDesdeContexto = (context = {}) => {
  const sessionUser = obtenerSesionUsuario();
  const local = getStorage("localStorage");
  const session = getStorage("sessionStorage");

  return String(
    pickFirst(
      context.usuarioId,
      context.usuarioID,
      context.userId,
      context.uid,
      context.id,
      context.idUsuario,
      context.user?.usuarioId,
      context.user?.usuarioID,
      context.user?.userId,
      context.user?.uid,
      context.user?.id,
      context.usuario?.usuarioId,
      context.usuario?.usuarioID,
      context.usuario?.userId,
      context.usuario?.uid,
      context.usuario?.id,
      context.data?.usuarioId,
      context.data?.usuarioID,
      context.data?.userId,
      context.data?.uid,
      context.data?.id,
      context.profile?.usuarioId,
      context.profile?.usuarioID,
      context.profile?.userId,
      context.profile?.uid,
      context.profile?.id,
      sessionUser.usuarioId,
      sessionUser.usuarioID,
      sessionUser.userId,
      sessionUser.uid,
      sessionUser.id,
      sessionUser.idUsuario,
      readStorageValue(local, "sidca_user_id"),
      readStorageValue(local, "userId"),
      readStorageValue(local, "uid"),
      readStorageValue(session, "sidca_user_id"),
      readStorageValue(session, "userId"),
      readStorageValue(session, "uid")
    ) || ""
  ).trim();
};

const getBackendRootUrl = () =>
  getApiBaseUrl().replace(/\/api\/pagos\/mercadopago\/?$/, "");

const getBootstrapUrl = () =>
  `${getBackendRootUrl()}/api/auth/firebase/bootstrap`;

const waitForAuthUser = (timeoutMs = 3000) =>
  new Promise((resolve) => {
    if (auth.currentUser) {
      resolve(auth.currentUser);
      return;
    }

    let settled = false;
    let unsubscribe = () => {};
    let timeoutId = null;

    const finish = (user) => {
      if (settled) return;
      settled = true;
      if (timeoutId) clearTimeout(timeoutId);
      unsubscribe();
      resolve(user || null);
    };

    timeoutId = setTimeout(() => finish(auth.currentUser), timeoutMs);
    unsubscribe = onAuthStateChanged(auth, (user) => finish(user));
  });

const buildBackendError = (response, data) => {
  const backendMessage = data?.error || data?.message || data?.detalle || "";
  const messagesByStatus = {
    401: "Tu sesión venció. Volvé a iniciar sesión para continuar.",
    403: "Los pagos de la cuota sindical no están habilitados actualmente.",
    404: "No se encontró la configuración necesaria para realizar el pago.",
    409: "La cuota de este período ya fue abonada o existe una orden de pago vigente.",
    500: "No pudimos iniciar el pago. Intentá nuevamente más tarde.",
  };

  const friendlyMessage =
    messagesByStatus[response.status] ||
    `No se pudo completar la operación. Código ${response.status}.`;

  const message =
    backendMessage && backendMessage !== friendlyMessage
      ? `${friendlyMessage} ${backendMessage}`
      : friendlyMessage;

  const error = new Error(message);
  error.status = response.status;
  error.data = data;
  throw error;
};

const parseResponse = async (response) => {
  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    buildBackendError(response, data);
  }

  return data;
};

const bootstrapFirebaseAuth = async (sessionContext = {}) => {
  const dni = obtenerDniDesdeContexto(sessionContext);
  const usuarioId = obtenerUsuarioIdDesdeContexto(sessionContext);

  if (!dni || !usuarioId) {
    const error = new Error(
      "No se encontró el vínculo entre este DNI y el usuario autenticado."
    );
    error.status = 401;
    throw error;
  }

  const response = await fetch(getBootstrapUrl(), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ dni, usuarioId }),
  });

  const data = await parseResponse(response);
  const customToken =
    data?.customToken ||
    data?.token ||
    data?.firebaseCustomToken ||
    data?.firebaseToken;

  if (!customToken) {
    const error = new Error("El backend no devolvió el token seguro de Firebase.");
    error.status = 500;
    throw error;
  }

  const credential = await signInWithCustomToken(auth, customToken);
  return credential.user || auth.currentUser;
};

const getAuthToken = async (sessionContext = {}) => {
  let user = auth.currentUser || (await waitForAuthUser(1200));
  if (!user) {
    user = await bootstrapFirebaseAuth(sessionContext);
  }

  if (!user) {
    const error = new Error("Debés iniciar sesión para realizar el pago.");
    error.status = 401;
    throw error;
  }

  return user.getIdToken(true);
};

const requestWithAuth = async (url, options = {}, sessionContext = {}) => {
  const token = await getAuthToken(sessionContext);
  const response = await fetch(url, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      ...(options.headers || {}),
    },
  });

  return parseResponse(response);
};

export async function crearPreferenciaPago(dni, pagoId, sessionContext = {}) {
  const dniLimpio = normalizarDni(dni);
  if (!dniLimpio) {
    throw new Error("No se encontró un DNI válido para crear la orden de pago.");
  }

  const data = await requestWithAuth(
    getPreferenceUrl(),
    {
      method: "POST",
      body: JSON.stringify({
        dni: dniLimpio,
        ...(pagoId ? { pagoId } : {}),
      }),
    },
    sessionContext
  );

  if (!data.checkoutUrl) {
    throw new Error("El backend no devolvió la dirección de Checkout Pro.");
  }

  return data;
}

export async function consultarEstadoPago(pagoId, sessionContext = {}) {
  if (!pagoId) {
    throw new Error("No se recibió el identificador del pago.");
  }

  return requestWithAuth(
    `${getApiBaseUrl()}/estado/${encodeURIComponent(pagoId)}`,
    {},
    sessionContext
  );
}

export async function obtenerMisPagos(sessionContext = {}) {
  return requestWithAuth(`${getApiBaseUrl()}/mis-pagos`, {}, sessionContext);
}

export const getMercadoPagoEnvironmentLabel = () =>
  process.env.REACT_APP_MP_ENV === "production" ? "producción" : "prueba";
