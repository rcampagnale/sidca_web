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

export const setUserCuotas = (data) => {
    return async (dispatch, getState) => {
        dispatch(setUserCuotasProcess());
        try {
            if (data) {
                const q = query(collection(db, "transacciones"), where("collection_id", "==", data.collection_id));
                const docSnap = await getDocs(q);
                if(docSnap.size === 0){
                    const external = JSON.parse(data.external_reference.split('%22').join('"'))
                    const userTransationData = {
                        status: data.status,
                        cuota: external.id,
                        collection_id: data.collection_id,
                        fecha: Timestamp.now()
                    }
                    console.log(external)
                    const userTransaccion = await addDoc(collection(db, "usuarios", external.userId, 'cuotas'),  userTransationData)
                    const transaccion = await addDoc(collection(db, 'transacciones'), { ...data, fecha: Timestamp.now(), user: external.userId, cuota: external.id})
                    dispatch(setUserCuotasSuccess());
                }
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

const setUserCuotasProcess = (payload) => ({ type: types.SET_USER_CUOTAS, payload })
const setUserCuotasSuccess = (payload) => ({ type: types.SET_USER_CUOTAS_SUCCESS, payload })
const setUserCuotasError = (payload) => ({ type: types.SET_USER_CUOTAS_ERROR, payload })

export const setUserSession = (payload) => ({ type: types.SET_USER_SESSION, payload })

export const clearStatus = (payload) => ({ type: types.CLEAR_CUOTAS_STATUS, payload })
export const aprove = (payload) => ({ type: types.APROVE, payload })
