import * as types from "./types";
import { db } from '../../../firebase/firebase-config';
import { collection, query, where, getDocs } from "firebase/firestore";
import { getAuth, signInWithEmailAndPassword, signOut } from "firebase/auth";
import { clearAfiliados } from "../afiliados/actions";
import { clearAsesoramiento } from "../asesoramiento/actions";
import { clearCuotas } from "../cuotas/actions";
import { clearCursos } from "../cursos/actions";
import { clearEnlaces } from "../enlaces/actions";
import { clearNovedades } from "../novedades/actions";
import { clearTransacciones } from "../transacciones/actions";

export const adminLogin = (data) => {
    return async (dispatch, getState) => {
        dispatch(authenticateAdminProcess())
        const auth = getAuth();
        signInWithEmailAndPassword(auth, data.admin, data.password)
            .then((userCredential) => {
                const user = userCredential.user;
                sessionStorage.setItem('user', JSON.stringify({ uid: user.uid, accessToken: user.accessToken }))
                sessionStorage.setItem('es_admin', 'true');
                dispatch(authenticateAdminSuccess({ uid: user.uid, accessToken: user.accessToken }))
            })
            .catch((error) => {
                dispatch(authenticateAdminError('Error al Ingresar'))
            });
    }
}

export const authenticateUser = (data) => {
    return async (dispatch, getState) => {
        dispatch(authenticateUserProcess());
        try {
            const q = await query(collection(db, 'usuarios'), where('dni', '==', data.dni))
            const querySnapshot = await getDocs(q);
            if (querySnapshot.size > 0 && querySnapshot.size < 2) {
                querySnapshot.forEach(documentSnapshot => {
                    const user = {
                        id: documentSnapshot.id,
                        ...documentSnapshot.data()
                    }
                    dispatch(authenticateUserSuccess(user));
                    sessionStorage.setItem('user', JSON.stringify(user));
                })
            } else if (querySnapshot.size > 1) {
                dispatch(authenticateUserError('Algo ha salido mal, contactate con un administrador'));
            } else {
                dispatch(authenticateUserError('DNI incorrecto'));
            }
        } catch (error) {
            dispatch(authenticateUserError('No se ha ingresar'));
            console.log(error);
        }
    }
}

export const adminLogout = () => {
    return async (dispatch, getState) => {
        dispatch(adminLogoutProcess());
        const auth = getAuth();
        signOut(auth).then(() => {
            dispatch(adminLogoutSuccess());

            dispatch(clearAfiliados());
            dispatch(clearAsesoramiento());
            dispatch(clearCuotas());
            dispatch(clearCursos());
            dispatch(clearEnlaces());
            dispatch(clearNovedades());
            dispatch(clearTransacciones());

            sessionStorage.removeItem('user');
            sessionStorage.removeItem('es_admin');
        }).catch((error) => {
            dispatch(adminLogoutError('Algo ha salido mal al intentar cerrar sesión'));
        });
    }

}

export const logout = () => {
    return async (dispatch, getState) => {
        dispatch(logoutProcess());
        try {
            dispatch(clearAfiliados());
            dispatch(clearAsesoramiento());
            dispatch(clearCuotas());
            dispatch(clearCursos());
            dispatch(clearEnlaces());
            dispatch(clearNovedades());
            dispatch(clearTransacciones());

            dispatch(logoutSuccess());
            sessionStorage.removeItem('user');
            sessionStorage.removeItem('es_admin');
        } catch (error) {
            dispatch(logoutError('Algo ha salido mal al intentar cerrar sesión'));
        }
    }
}

const authenticateAdminProcess = (payload) => ({ type: types.AUTHENTICATE_ADMIN, payload })
const authenticateAdminSuccess = (payload) => ({ type: types.AUTHENTICATE_ADMIN_SUCCESS, payload })
const authenticateAdminError = (payload) => ({ type: types.AUTHENTICATE_ADMIN_ERROR, payload })

const authenticateUserProcess = (payload) => ({ type: types.AUTHENTICATE_USER, payload })
const authenticateUserSuccess = (payload) => ({ type: types.AUTHENTICATE_USER_SUCCESS, payload })
const authenticateUserError = (payload) => ({ type: types.AUTHENTICATE_USER_ERROR, payload })

const adminLogoutProcess = (payload) => ({ type: types.ADMIN_LOGOUT, payload })
const adminLogoutSuccess = (payload) => ({ type: types.ADMIN_LOGOUT_SUCCESS, payload })
const adminLogoutError = (payload) => ({ type: types.ADMIN_LOGOUT_ERROR, payload })

const logoutProcess = (payload) => ({ type: types.LOGOUT, payload })
const logoutSuccess = (payload) => ({ type: types.LOGOUT_SUCCESS, payload })
const logoutError = (payload) => ({ type: types.LOGOUT_ERROR, payload })

export const setUserSession = (payload) => ({ type: types.SET_USER_SESSION, payload })

export const clearStatus = (payload) => ({ type: types.CLEAR_USER_STATUS, payload })
export const aprove = (payload) => ({ type: types.APROVE, payload })

export const setProfile = (payload) => ({ type: types.SET_PROFILE, payload })