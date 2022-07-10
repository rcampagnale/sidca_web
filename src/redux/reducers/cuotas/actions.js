import types from './types'
import { db } from '../../../firebase/firebase-config';
import { collection, addDoc, getDocs, query, orderBy, limit, doc, setDoc, startAfter, endBefore, limitToLast, where, Timestamp } from "firebase/firestore";

export const nuevaCuota = (data) => {
    return async (dispatch, getState) => {
        dispatch(nuevaCuotaProcess());
        let cuota = {
            title: `${data.title}`,
            position: Number.parseInt(data.position),
            unit_price: Number.parseInt(data.unit_price),
            quantity: 1,
            currency_id: 'ARS',
            categoria: data.categoria,
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
            title: `${data.title}`,
            position: Number.parseInt(data.position),
            unit_price: Number.parseInt(data.unit_price),
            quantity: 1,
            currency_id: 'ARS',
            categoria: data.categoria
        }

        try {
            const refDoc = doc(db, 'cuotas', id)
            const cuota = await setDoc(refDoc, cuotaObj)
            dispatch(uploadCuotaSuccess(`Cuota editado Correctamente. ID: ${id}`));
        } catch (error) {
            dispatch(uploadCuotaError('No se ha podido editar la cuota'));
            console.log(error)
        }
    }
}

export const getCuotas = (pagination, start) => {
    return async (dispatch, getState) => {
        dispatch(getCuotasProcess());
        try {
            let q

            if (pagination === 'next') {
                q = await query(collection(db, 'cuotas'), orderBy('position', 'asc'), limit(10), startAfter(start))
            } else if (pagination === 'prev') {
                q = await query(collection(db, 'cuotas'), orderBy('position', 'asc'), limitToLast(10), endBefore(start))
            } else {
                q = await query(collection(db, 'cuotas'), orderBy('position', 'asc'), limit(10))
            }
            const querySnapshot = await getDocs(q);
            if (querySnapshot.size === 0) {
                dispatch(getCuotasError('No hay cuotas'))
            } else {
                const { page } = getState().cuotas;
                const arrayDocs = [];
                querySnapshot.docs.map((doc, i) => {
                    i === 0 && dispatch(setFirstCuota(doc));
                    i === 9 && dispatch(setLastCuota(doc));
                })
                querySnapshot.forEach(doc => {
                    const data = doc.data();
                    let obj = {
                        id: doc.id,
                        title: data.title,
                        position: data.position,
                        unit_price: data.unit_price,
                        categoria: data.categoria
                    }
                    arrayDocs.push(obj)
                })
                dispatch(getCuotasSuccess(arrayDocs))
                dispatch(setPage(pagination == 'next' ? page + 1 : pagination === 'prev' ? page - 1 : page))
            }
        } catch (error) {
            dispatch(getCuotasError('No se pudieron cargar las cuotas'));
            console.log(error)
        }
    }
}

export const getAllCuotas = (pagination, start) => {
    return async (dispatch, getState) => {
        dispatch(getCuotasProcess());
        try {
            let q = await query(collection(db, 'cuotas'), orderBy('position', 'asc'))
            const querySnapshot = await getDocs(q);
            if (querySnapshot.size === 0) {
                dispatch(getCuotasError('No hay cuotas'))
            } else {
                const arrayDocs = [];
                querySnapshot.forEach(doc => {
                    const data = doc.data();
                    let obj = {
                        id: doc.id,
                        title: data.title,
                        position: data.position,
                        unit_price: data.unit_price,
                        categoria: data.categoria
                    }
                    arrayDocs.push(obj)
                })
                dispatch(getCuotasSuccess(arrayDocs))
            }
        } catch (error) {
            dispatch(getCuotasError('No se pudieron cargar las cuotas'));
            console.log(error)
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
                if (docSnap.size === 0) {
                    const external = JSON.parse(data.external_reference.split('%22').join('"'))
                    const userTransationData = {
                        status: data.status,
                        cuota: external.id,
                        collection_id: data.collection_id,
                        fecha: Timestamp.now()
                    }
                    console.log(external)
                    const userTransaccion = await addDoc(collection(db, "usuarios", external.userId, 'cuotas'), userTransationData)
                    const transaccion = await addDoc(collection(db, 'transacciones'), { ...data, fecha: Timestamp.now(), user: external.userId, cuota: external.id })
                    dispatch(setUserCuotasSuccess());
                }
            }
        } catch (error) {
            dispatch(setUserCuotasError('No se pudo cargar la transaccion'));
            console.log(error);
        }
    }
}

export const getCuota = (payload) => ({ type: types.GET_CUOTA, payload })

const nuevaCuotaProcess = (payload) => ({ type: types.NUEVA_CUOTA, payload })
const nuevaCuotaSuccess = (payload) => ({ type: types.NUEVA_CUOTA_SUCCESS, payload })
const nuevaCuotaError = (payload) => ({ type: types.NUEVA_CUOTA_ERROR, payload })

const uploadCuotaProcess = (payload) => ({ type: types.UPLOAD_CUOTA, payload })
const uploadCuotaSuccess = (payload) => ({ type: types.UPLOAD_CUOTA_SUCCESS, payload })
const uploadCuotaError = (payload) => ({ type: types.UPLOAD_CUOTA_ERROR, payload })

const getCuotasProcess = (payload) => ({ type: types.GET_CUOTAS, payload })
const getCuotasSuccess = (payload) => ({ type: types.GET_CUOTAS_SUCCESS, payload })
const getCuotasError = (payload) => ({ type: types.GET_CUOTAS_ERROR, payload })

const setUserCuotasProcess = (payload) => ({ type: types.SET_USER_CUOTAS, payload })
const setUserCuotasSuccess = (payload) => ({ type: types.SET_USER_CUOTAS_SUCCESS, payload })
const setUserCuotasError = (payload) => ({ type: types.SET_USER_CUOTAS_ERROR, payload })

const setFirstCuota = (payload) => ({ type: types.SET_FIRST_CUOTA, payload })
const setLastCuota = (payload) => ({ type: types.SET_LAST_CUOTA, payload })
const setPage = (payload) => ({ type: types.SET_PAGE, payload })

export const setUserSession = (payload) => ({ type: types.SET_USER_SESSION, payload })

export const clearStatus = (payload) => ({ type: types.CLEAR_CUOTAS_STATUS, payload })
export const aprove = (payload) => ({ type: types.APROVE, payload })


export const clearCuotas = (payload) => ({ type: types.CLEAR_CUOTAS, payload })
