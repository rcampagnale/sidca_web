import * as types from "./types";
import { db } from '../../../firebase/firebase-config';
import { collection, addDoc, query, where, getDocs, doc, deleteDoc, orderBy, startAfter, limit } from "firebase/firestore";

export const adminLogin = (data) => {
    return async (dispatch, getState)=>{
        if(data.admin !== 'Yesi'){return null}
        if(data.password !== 'sidca'){return null}
        try {
            sessionStorage.setItem('user', '{"access_token": "asdfqwerasdfqwer"}')
            sessionStorage.setItem('es_admin', 'true');
        } catch (error) {
            // dispatch(newUserError('No se ha podido crear un nuevo afiliado'));
            console.log(error)
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

const authenticateUserProcess = (payload) => ({type: types.AUTHENTICATE_USER, payload})
const authenticateUserSuccess = (payload) => ({type: types.AUTHENTICATE_USER_SUCCESS, payload})
const authenticateUserError = (payload) => ({type: types.AUTHENTICATE_USER_ERROR, payload})

export const logout = (payload) => ({type: types.LOGOUT, payload})
export const setUserSession = (payload) => ({type: types.SET_USER_SESSION, payload})

export const clearStatus = (payload) => ({type: types.CLEAR_USER_STATUS, payload})
export const aprove = (payload) => ({type: types.APROVE, payload})
