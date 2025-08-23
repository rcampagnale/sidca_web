import * as types from "./types";
import { db } from "../../../firebase/firebase-config";
import {
  collection,
  query,
  where,
  getDocs,
  limit,
} from "firebase/firestore";
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
          authenticateAdminSuccess({ uid: user.uid, accessToken: user.accessToken })
        );
        return { ok: true };
      })
      .catch(() => {
        dispatch(authenticateAdminError("Error al Ingresar"));
        return { ok: false };
      });
  };
};

/* ================= USER (colección 'usuarios') ================= */

export const authenticateUser = (data) => {
  return async (dispatch) => {
    dispatch(authenticateUserProcess());
    try {
      const dni = normalizeDni(data?.dni);
      if (!dni) {
        dispatch(authenticateUserError("Ingrese un DNI válido."));
        return { ok: false };
      }

      // Buscar en colección 'usuarios' por DNI (solo 1)
      const q = query(
        collection(db, "usuarios"),
        where("dni", "==", dni),
        limit(1)
      );
      const snap = await getDocs(q);

      if (snap.empty) {
        dispatch(authenticateUserError("DNI incorrecto"));
        return { ok: false };
      }

      const docSnap = snap.docs[0];
      const user = { id: docSnap.id, ...docSnap.data() };

      // Persistir sesión:
      // - sessionStorage: objeto completo (compatibilidad actual)
      // - localStorage: claves mínimas para otras pantallas (MiRegistro, etc.)
      sessionStorage.setItem("user", JSON.stringify(user));
      sessionStorage.setItem("es_admin", "false");
      localStorage.setItem("sidca_user_docId", docSnap.id);
      localStorage.setItem("sidca_user_dni", user.dni);

      dispatch(authenticateUserSuccess(user));
      return { ok: true };
    } catch (error) {
      console.error("[authenticateUser] error:", error);
      dispatch(authenticateUserError("No se ha ingresar"));
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
      dispatch(
        logoutError("Algo ha salido mal al intentar cerrar sesión")
      );
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
