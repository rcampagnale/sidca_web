import * as types from "./types";
import { db } from "../../../firebase/firebase-config";
import { collection, query, where, getDocs, limit } from "firebase/firestore";
import { getAuth, signInWithEmailAndPassword, signOut } from "firebase/auth";
import { clearAfiliados } from "../afiliados/actions";
import { clearAsesoramiento } from "../asesoramiento/actions";
import { clearCuotas } from "../cuotas/actions";
import { clearCursos } from "../cursos/actions";
import { clearEnlaces } from "../enlaces/actions";
import { clearNovedades } from "../novedades/actions";
import { clearTransacciones } from "../transacciones/actions";

/** Utils */
const normalizeDni = (dniRaw) =>
  String(dniRaw || "")
    .replace(/[^\d]/g, "") // deja solo números
    .slice(0, 12);

/* ================= ADMIN ================= */

export const adminLogin = (data) => {
  return async (dispatch) => {
    dispatch(authenticateAdminProcess());
    const auth = getAuth();
    return signInWithEmailAndPassword(auth, data.admin, data.password)
      .then((userCredential) => {
        const user = userCredential.user;
        sessionStorage.setItem(
          "user",
          JSON.stringify({ uid: user.uid, accessToken: user.accessToken })
        );
        sessionStorage.setItem("es_admin", "true");
        // Limpio claves de sesión de usuario normal por si quedaron
        localStorage.removeItem("sidca_user_docId");
        localStorage.removeItem("sidca_user_dni");

        dispatch(
          authenticateAdminSuccess({
            uid: user.uid,
            accessToken: user.accessToken,
          })
        );
        return { ok: true };
      })
      .catch(() => {
        dispatch(authenticateAdminError("Error al Ingresar"));
        return { ok: false };
      });
  };
};

/* =========== USER (usuarios + nuevoAfiliado) =========== */

/**
 * 🔎 Busca un documento por DNI en la colección indicada:
 *    - primero como string
 *    - luego como number
 * Devuelve { id, ...data, _from } o null.
 */
const getByDniFromCollection = async (collectionName, dniRaw) => {
  const dni = normalizeDni(dniRaw);
  if (!dni) return null;

  const colRef = collection(db, collectionName);

  // 1) Buscar por DNI como string
  let snap = await getDocs(query(colRef, where("dni", "==", dni), limit(1)));
  if (!snap.empty) {
    const docSnap = snap.docs[0];
    return { id: docSnap.id, ...docSnap.data(), _from: collectionName };
  }

  // 2) Buscar por DNI como number (por compatibilidad)
  const dniNum = Number(dni);
  if (!Number.isNaN(dniNum)) {
    snap = await getDocs(query(colRef, where("dni", "==", dniNum), limit(1)));
    if (!snap.empty) {
      const docSnap = snap.docs[0];
      return { id: docSnap.id, ...docSnap.data(), _from: collectionName };
    }
  }

  return null;
};

/**
 * 👤 Devuelve los datos unificados de la persona por DNI
 *    buscando en 'usuarios' y 'nuevoAfiliado'.
 *    Si existe en ambas, prioriza los datos de 'nuevoAfiliado'.
 */
const findAfiliadoByDni = async (dniRaw) => {
  const [fromUsuarios, fromNuevo] = await Promise.all([
    getByDniFromCollection("usuarios", dniRaw),
    getByDniFromCollection("nuevoAfiliado", dniRaw),
  ]);

  if (!fromUsuarios && !fromNuevo) return null;
  if (fromUsuarios && !fromNuevo) return fromUsuarios;
  if (!fromUsuarios && fromNuevo) return fromNuevo;

  // Merge: datos de nuevoAfiliado pisan a los de usuarios
  return {
    ...fromUsuarios,
    ...fromNuevo,
    _from: "usuarios+nuevoAfiliado",
  };
};

/**
 * Login por DNI con reglas:
 *  - Si el DNI NO existe en ninguna colección → error.
 *  - Si adherente === false → permite el ingreso.
 *  - Si adherente === true:
 *      - activo === true  → permite el ingreso.
 *      - activo === false → NO permite, muestra mensaje de cuenta suspendida con motivo.
 */
export const authenticateUser = (data) => {
  return async (dispatch) => {
    dispatch(authenticateUserProcess());
    try {
      const dni = normalizeDni(data?.dni);
      if (!dni) {
        dispatch(authenticateUserError("Ingresá un DNI válido."));
        return { ok: false };
      }

      // 🔎 Buscar datos en 'usuarios' + 'nuevoAfiliado'
      const afiliado = await findAfiliadoByDni(dni);

      // 1) No existe en ninguna colección
      if (!afiliado) {
        dispatch(
          authenticateUserError(
            "DNI no encontrado. Verificá que estés registrado en el sistema."
          )
        );
        return { ok: false };
      }

      const esAdherente = Boolean(afiliado.adherente);
      const estaActivo = afiliado.activo !== false; // si falta el campo, lo tomamos como activo

      if (esAdherente) {
        // Es adherente: debemos chequear estado activo
        if (!estaActivo) {
          const motivo =
            afiliado.motivo || afiliado.observaciones || "No informado.";

          const msg = `Estimado/a docente, su afiliación figura como Afiliado en carácter de Adherente y actualmente se encuentra SUSPENDIDA.

MOTIVO: ${motivo}

Por favor, escríbanos por WhatsApp al Área Afiliado Adherente (solo mensajes; no llamadas).
Horario de atención: Lunes a Viernes 8:00–12:00 y 16:00–18:00 Hs.
Días no laborables: Feriados, Asuetos, Sábado y Domingo no se atiende.

*Hasta regularizar sus aranceles, los servicios del Sindicato permanecerán suspendidos.`;

          dispatch(authenticateUserError(msg));
          return { ok: false };
        }
        // adherente === true y activo !== false → deja pasar
      }
      // Si NO es adherente, también deja pasar (según tu regla)

      const userSession = {
        ...afiliado,
        dni, // normalizado como string
      };

      // Persistir sesión:
      // - sessionStorage: objeto completo (compatibilidad actual)
      // - localStorage: claves mínimas para otras pantallas (MiRegistro, etc.)
      sessionStorage.setItem("user", JSON.stringify(userSession));
      sessionStorage.setItem("es_admin", "false");
      if (afiliado.id) {
        localStorage.setItem("sidca_user_docId", afiliado.id);
      }
      localStorage.setItem("sidca_user_dni", dni);

      dispatch(authenticateUserSuccess(userSession));
      return { ok: true };
    } catch (error) {
      console.error("[authenticateUser] error:", error);
      dispatch(
        authenticateUserError(
          "No se pudo completar el ingreso. Intentá nuevamente más tarde."
        )
      );
      return { ok: false };
    }
  };
};

/* ================= LOGOUTS ================= */

export const adminLogout = () => {
  return async (dispatch) => {
    dispatch(adminLogoutProcess());
    const auth = getAuth();
    return signOut(auth)
      .then(() => {
        dispatch(adminLogoutSuccess());

        // limpiar stores
        dispatch(clearAfiliados());
        dispatch(clearAsesoramiento());
        dispatch(clearCuotas());
        dispatch(clearCursos());
        dispatch(clearEnlaces());
        dispatch(clearNovedades());
        dispatch(clearTransacciones());

        // limpiar storage
        sessionStorage.removeItem("user");
        sessionStorage.removeItem("es_admin");
        localStorage.removeItem("sidca_user_docId");
        localStorage.removeItem("sidca_user_dni");

        return { ok: true };
      })
      .catch(() => {
        dispatch(
          adminLogoutError("Algo ha salido mal al intentar cerrar sesión")
        );
        return { ok: false };
      });
  };
};

export const logout = () => {
  return async (dispatch) => {
    dispatch(logoutProcess());
    try {
      // limpiar stores
      dispatch(clearAfiliados());
      dispatch(clearAsesoramiento());
      dispatch(clearCuotas());
      dispatch(clearCursos());
      dispatch(clearEnlaces());
      dispatch(clearNovedades());
      dispatch(clearTransacciones());

      dispatch(logoutSuccess());

      // limpiar storage
      sessionStorage.removeItem("user");
      sessionStorage.removeItem("es_admin");
      localStorage.removeItem("sidca_user_docId");
      localStorage.removeItem("sidca_user_dni");

      return { ok: true };
    } catch (error) {
      dispatch(logoutError("Algo ha salido mal al intentar cerrar sesión"));
      return { ok: false };
    }
  };
};

/* ================= ACTION CREATORS ================= */

const authenticateAdminProcess = (payload) => ({
  type: types.AUTHENTICATE_ADMIN,
  payload,
});
const authenticateAdminSuccess = (payload) => ({
  type: types.AUTHENTICATE_ADMIN_SUCCESS,
  payload,
});
const authenticateAdminError = (payload) => ({
  type: types.AUTHENTICATE_ADMIN_ERROR,
  payload,
});

const authenticateUserProcess = (payload) => ({
  type: types.AUTHENTICATE_USER,
  payload,
});
const authenticateUserSuccess = (payload) => ({
  type: types.AUTHENTICATE_USER_SUCCESS,
  payload,
});
const authenticateUserError = (payload) => ({
  type: types.AUTHENTICATE_USER_ERROR,
  payload,
});

const adminLogoutProcess = (payload) => ({
  type: types.ADMIN_LOGOUT,
  payload,
});
const adminLogoutSuccess = (payload) => ({
  type: types.ADMIN_LOGOUT_SUCCESS,
  payload,
});
const adminLogoutError = (payload) => ({
  type: types.ADMIN_LOGOUT_ERROR,
  payload,
});

const logoutProcess = (payload) => ({ type: types.LOGOUT, payload });
const logoutSuccess = (payload) => ({ type: types.LOGOUT_SUCCESS, payload });
const logoutError = (payload) => ({ type: types.LOGOUT_ERROR, payload });

export const setUserSession = (payload) => ({
  type: types.SET_USER_SESSION,
  payload,
});
export const clearStatus = (payload) => ({
  type: types.CLEAR_USER_STATUS,
  payload,
});
export const aprove = (payload) => ({ type: types.APROVE, payload });
export const setProfile = (payload) => ({ type: types.SET_PROFILE, payload });
