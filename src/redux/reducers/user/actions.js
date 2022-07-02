import * as types from "./types";
import { db } from '../../../firebase/firebase-config';
import { collection, addDoc, query, where, getDocs, doc, deleteDoc, orderBy, startAfter, limit } from "firebase/firestore";
import { getAuth, signInWithEmailAndPassword } from "firebase/auth";

export const adminLogin = (data) => {
    return async (dispatch, getState) => {
        dispatch(authenticateAdminProcess())
        try {
            const auth = getAuth();
            signInWithEmailAndPassword(auth, data.admin, data.password)
                .then((userCredential) => {
                    const user = userCredential.user;
                    sessionStorage.setItem('user', JSON.stringify({ accessToken: user.accessToken }))
                    sessionStorage.setItem('es_admin', 'true');
                    dispatch(authenticateAdminSuccess({ uid: user.uid, accessToken: user.accessToken }))
                })
                .catch((error) => {
                    const errorCode = error.code;
                    const errorMessage = error.message;
                });
        } catch (err) {
            dispatch(authenticateAdminError('Error al Ingresar'))

        }
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

const authenticateAdminProcess = (payload) => ({ type: types.AUTHENTICATE_ADMIN, payload })
const authenticateAdminSuccess = (payload) => ({ type: types.AUTHENTICATE_ADMIN_SUCCESS, payload })
const authenticateAdminError = (payload) => ({ type: types.AUTHENTICATE_ADMIN_ERROR, payload })

const authenticateUserProcess = (payload) => ({ type: types.AUTHENTICATE_USER, payload })
const authenticateUserSuccess = (payload) => ({ type: types.AUTHENTICATE_USER_SUCCESS, payload })
const authenticateUserError = (payload) => ({ type: types.AUTHENTICATE_USER_ERROR, payload })

export const logout = (payload) => ({ type: types.LOGOUT, payload })
export const setUserSession = (payload) => ({ type: types.SET_USER_SESSION, payload })

export const clearStatus = (payload) => ({ type: types.CLEAR_USER_STATUS, payload })
export const aprove = (payload) => ({ type: types.APROVE, payload })
