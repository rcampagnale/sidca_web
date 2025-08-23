import * as types from "./types";

const initialState = {
  // sesión
  auth: false,
  isAdmin: sessionStorage.getItem("es_admin") === "true",
  uid: "",
  accessToken: "",
  docId: localStorage.getItem("sidca_user_docId") || "",
  dni: localStorage.getItem("sidca_user_dni") || "",
  nombre: "",
  apellido: "",
  departamento: "",

  // UI
  loading: false,
  processing: false,
  status: "IDLE", // IDLE | AUTH_SUCCESS | AUTH_FAILURE
  msg: "",

  // legacy/compat
  profile: undefined,
  empresa: undefined,
  currentStep: undefined,
  ubicacion: undefined,
  user: [],
  userEdit: undefined,
};

export const userReducer = (state = initialState, action) => {
  switch (action.type) {
    /* ========== ADMIN AUTH ========== */
    case types.AUTHENTICATE_ADMIN:
      return { ...state, processing: true, status: "IDLE", msg: "" };

    case types.AUTHENTICATE_ADMIN_SUCCESS:
      return {
        ...state,
        processing: false,
        status: "AUTH_SUCCESS",
        auth: true,
        isAdmin: true,
        uid: action.payload?.uid || "",
        accessToken: action.payload?.accessToken || "",
        profile: { ...action.payload },
        msg: "",
      };

    case types.AUTHENTICATE_ADMIN_ERROR:
      return {
        ...state,
        processing: false,
        status: "AUTH_FAILURE",
        msg: action.payload,
        auth: false,
        isAdmin: false,
      };

    /* ========== USER AUTH (colección 'usuarios') ========== */
    case types.AUTHENTICATE_USER:
      return { ...state, processing: true, status: "IDLE", msg: "" };

    case types.AUTHENTICATE_USER_SUCCESS: {
      const p = action.payload || {};
      return {
        ...state,
        processing: false,
        status: "AUTH_SUCCESS",
        auth: true,
        isAdmin: false,
        docId: p.id || p.docId || state.docId,
        dni: p.dni || state.dni,
        nombre: p.nombre || "",
        apellido: p.apellido || "",
        departamento: p.departamento || "",
        profile: { ...p },
        msg: "",
      };
    }

    case types.AUTHENTICATE_USER_ERROR:
      return {
        ...state,
        processing: false,
        status: "AUTH_FAILURE",
        msg: action.payload,
        auth: false,
      };

    /* ========== LOGOUTS ========== */
    case types.ADMIN_LOGOUT:
    case types.LOGOUT:
      return { ...state, processing: true };

    case types.ADMIN_LOGOUT_SUCCESS:
    case types.LOGOUT_SUCCESS:
      return {
        ...initialState,
        auth: false,
        isAdmin: false,
        status: "IDLE",
        msg: "Se ha cerrado la sesión con exito",
        // forzamos limpiar los derivados de localStorage
        docId: "",
        dni: "",
      };

    case types.ADMIN_LOGOUT_ERROR:
    case types.LOGOUT_ERROR:
      return { ...state, processing: false, msg: action.payload };

    /* ========== SESIÓN / PERFIL ========== */
    case types.SET_USER_SESSION: {
      const p = action.payload || {};
      return {
        ...state,
        auth: true,
        isAdmin: !!p.isAdmin,
        docId: p.docId ?? state.docId,
        dni: p.dni ?? state.dni,
        nombre: p.nombre ?? state.nombre,
        apellido: p.apellido ?? state.apellido,
        departamento: p.departamento ?? state.departamento,
        profile: { ...(state.profile || {}), ...p },
      };
    }

    case types.CLEAR_USER_STATUS:
      return {
        ...state,
        loading: false,
        processing: false,
        msg: "",
        status: "IDLE",
      };

    case types.SET_PROFILE:
      return {
        ...state,
        profile: action.payload,
        // sincroniza campos de sesión si vienen en el payload
        docId: action.payload?.id ?? action.payload?.docId ?? state.docId,
        dni: action.payload?.dni ?? state.dni,
        nombre: action.payload?.nombre ?? state.nombre,
        apellido: action.payload?.apellido ?? state.apellido,
        departamento: action.payload?.departamento ?? state.departamento,
      };

    default:
      return state;
  }
};

export default userReducer;
