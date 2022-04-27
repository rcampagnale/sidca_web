import * as types from "./types";
import { db } from '../../../firebase/firebase-config';
import { collection, addDoc, query, where, getDocs, doc, deleteDoc, orderBy, startAfter, limit, Timestamp, setDoc } from "firebase/firestore";
import { search } from "mercadopago/lib/resources/payment";
import { date } from "mercadopago/lib/utils";

export const nuevoCuota = (data) => {
    return async (dispatch, getState) => {
        dispatch(nuevaCuotaProcess());
        let cuota = {
            titulo: `${data.titulo}`,
            link: `${data.link}`,
            descripcion: `${data.descripcion}`,
            prioridad: Number.parseInt(data.prioridad),
        }

        try {
            const doc = await addDoc(collection(db, 'cuotas'), cuota)
            dispatch(nuevaCuotaSuccess(`Cuota agregada correctamente. ID: ${doc.id}`));
        } catch (error) {
            dispatch(nuevaCuotaError('No se ha podido agregar la cuota'));
            console.log(error)
        }
    }
}

export const uploadCuota = (data, id) => {
    return async (dispatch, getState) => {
        dispatch(uploadCuotaProcess());
        let cuotaObj = {
            titulo: `${data.titulo}`,
            link: `${data.link}`,
            descripcion: `${data.descripcion}`,
            prioridad: Number.parseInt(data.prioridad),
        }
        try {
            const refDoc = doc(db, 'cuotas', id)
            const cuota = await setDoc(refDoc, cuotaObj)
            dispatch(uploadCuotaSuccess(`Cuota editado Correctamente. ID: ${id}`));
        } catch (error) {
            dispatch(uploadCuotaError('No se ha podido editar el enlace'));
            console.log(error)
        }
    }
}

export const getCuotas = (data) => {
    return async (dispatch, getState) => {
        dispatch(getCuotasProcess());
        try {
            const q = await query(collection(db, 'cuotas'), orderBy('position', "asc"))
            const querySnapshot = await getDocs(q);
            if (querySnapshot.size > 0) {
                let arrayCuotas = []
                querySnapshot.forEach(documentSnapshot => {
                    const cuota = {
                        id: documentSnapshot.id,
                        ...documentSnapshot.data()
                    }
                    arrayCuotas.push(cuota)
                })
                dispatch(getCuotasSuccess(arrayCuotas));
            } else {
                dispatch(getCuotasError('No hay cuotas'));
            }
        } catch (error) {
            dispatch(getCuotasError('No se pudo traer las cuotas'));
            console.log(error);
        }
    }
}

export const postTransaction = (data) => {
    return async (dispatch, getState) => {
        dispatch(postTransactionProcess());
        try {
            if (data) {
                const doc = await addDoc(collection(db, 'transacciones'), { ...data, fecha: Timestamp.now() })
                dispatch(postTransactionSuccess(doc));
            }
        } catch (error) {
            dispatch(postTransactionError('No se pudo cargar la transaccion'));
            console.log(error);
        }
    }
}

export const setUserCuotas = (search, data) => {
    return async (dispatch, getState) => {
        dispatch(setUserCuotasProcess());
        try {
            if (data) {
                const external = JSON.parse(search.split('%22').join('"'))
                const colection = await addDoc(collection(db, "usuarios", external.userId, 'cuotas'), { ...data, cuota: external.id, fecha: Timestamp.now() })
                dispatch(setUserCuotasSuccess(colection));
            }
        } catch (error) {
            dispatch(setUserCuotasError('No se pudo cargar la transaccion'));
            console.log(error);
        }
    }
}

const nuevaCuotaProcess = (payload) => ({ type: types.GET_CUOTAS, payload })
const nuevaCuotaSuccess = (payload) => ({ type: types.GET_CUOTAS_SUCCESS, payload })
const nuevaCuotaError = (payload) => ({ type: types.GET_CUOTAS_ERROR, payload })

const uploadCuotaProcess = (payload) => ({ type: types.UPLOAD_CUOTA, payload })
const uploadCuotaSuccess = (payload) => ({ type: types.UPLOAD_CUOTA_SUCCESS, payload })
const uploadCuotaError = (payload) => ({ type: types.UPLOAD_CUOTA_ERROR, payload })

const getCuotasProcess = (payload) => ({ type: types.GET_CUOTAS, payload })
const getCuotasSuccess = (payload) => ({ type: types.GET_CUOTAS_SUCCESS, payload })
const getCuotasError = (payload) => ({ type: types.GET_CUOTAS_ERROR, payload })

const postTransactionProcess = (payload) => ({ type: types.POST_TRANSACTION, payload })
const postTransactionSuccess = (payload) => ({ type: types.POST_TRANSACTION_SUCCESS, payload })
const postTransactionError = (payload) => ({ type: types.POST_TRANSACTION_ERROR, payload })

const setUserCuotasProcess = (payload) => ({ type: types.SET_USER_CUOTAS, payload })
const setUserCuotasSuccess = (payload) => ({ type: types.SET_USER_CUOTAS_SUCCESS, payload })
const setUserCuotasError = (payload) => ({ type: types.SET_USER_CUOTAS_ERROR, payload })

export const setUserSession = (payload) => ({ type: types.SET_USER_SESSION, payload })

export const clearStatus = (payload) => ({ type: types.CLEAR_CUOTAS_STATUS, payload })
export const aprove = (payload) => ({ type: types.APROVE, payload })
