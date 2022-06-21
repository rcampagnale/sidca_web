import * as types from "./types";
import { db } from '../../../firebase/firebase-config';
import { collection, addDoc, query, where, getDocs, doc, deleteDoc, orderBy, startAfter, limit, Timestamp, setDoc, getDoc } from "firebase/firestore";
import { search } from "mercadopago/lib/resources/payment";
import { date } from "mercadopago/lib/utils";
import moment from 'moment';

export const nuevaTransaccion = (data) => {
    return async (dispatch, getState) => {
        dispatch(nuevaTransaccionProcess());
        let transaccion = {
            titulo: `${data.titulo}`,
            link: `${data.link}`,
            descripcion: `${data.descripcion}`,
            prioridad: Number.parseInt(data.prioridad),
        }

        try {
            const doc = await addDoc(collection(db, 'transacciones'), transaccion)
            dispatch(nuevaTransaccionSuccess(`Transaccion agregada correctamente. ID: ${doc.id}`));
        } catch (error) {
            dispatch(nuevaTransaccionError('No se ha podido agregar la transaccion'));
            console.log(error)
        }
    }
}

export const getTransacciones = (pagination = false, count) => {
    return async (dispatch, getState) => {
        dispatch(getTransaccionesProcess());
        try {
            let q
            if (!!pagination) {
                // q = await query(collection(db, 'transacciones'), orderBy('fecha', "asc"), limit(10), startAfter(count))
            } else {
                q = await query(collection(db, 'transacciones'), orderBy('fecha', "desc"))
            }
            const querySnapshot = await getDocs(q);
            console.log(querySnapshot.size)
            if (querySnapshot.size > 0) {
                let arrayTransacciones = []
                querySnapshot.forEach(documentSnapshot => {
                    const transaccion = {
                        id: documentSnapshot.id,
                        ...documentSnapshot.data(),
                        fecha: moment(documentSnapshot.data().fecha.seconds * 1000).format('DD-MM-YYYY HH:mm'),
                        userId: JSON.parse(documentSnapshot.data().external_reference.split('%22').join('"')).userId
                    }
                    arrayTransacciones.push(transaccion)
                })
                dispatch(getTransaccionesSuccess(arrayTransacciones));
            } else {
                dispatch(getTransaccionesError('No hay transacciones'));
            }
        } catch (error) {
            dispatch(getTransaccionesError('No se pudo traer las transacciones'));
            console.log(error);
        }
    }
}

export const getUserCuotas = (id) => {
    return async (dispatch, getState) => {
        dispatch(getUserCuotasProcess());
        try {
            const docRef = await doc(db, 'usuarios', id)
            const docSnap = await getDoc(docRef);
            let user
            if (docSnap.exists()) {
                user = {
                    id,
                    ...docSnap.data()
                }
            }

            const q = await collection(db, "usuarios", id, 'cuotas')
            const querySnapshot = await getDocs(q);

            console.log(user)

            if (querySnapshot.size > 0) {
                let arrayCuotas = [];
                querySnapshot.forEach(documentSnapshot => {
                    const cuota = {
                        id: documentSnapshot.id,
                        ...documentSnapshot.data()
                    }
                    arrayCuotas.push(cuota);
                })
                dispatch(getUserCuotasSuccess({ user, cuotas: arrayCuotas }));
            } else {
                dispatch(getUserCuotasError('No se ha podido cargar la información del usuario.'));
            }
        } catch (error) {
            dispatch(getUserCuotasError('No se ha podido cargar la información del usuario.'));
            console.log(error);
        }
    }
}



const nuevaTransaccionProcess = (payload) => ({ type: types.NUEVA_TRANSACCION, payload })
const nuevaTransaccionSuccess = (payload) => ({ type: types.NUEVA_TRANSACCION_SUCCESS, payload })
const nuevaTransaccionError = (payload) => ({ type: types.NUEVA_TRANSACCION_ERROR, payload })

const getTransaccionesProcess = (payload) => ({ type: types.GET_TRANSACCIONES, payload })
const getTransaccionesSuccess = (payload) => ({ type: types.GET_TRANSACCIONES_SUCCESS, payload })
const getTransaccionesError = (payload) => ({ type: types.GET_TRANSACCIONES_ERROR, payload })

const getUserCuotasProcess = (payload) => ({ type: types.GET_USER_CUOTAS, payload })
const getUserCuotasSuccess = (payload) => ({ type: types.GET_USER_CUOTAS_SUCCESS, payload })
const getUserCuotasError = (payload) => ({ type: types.GET_USER_CUOTAS_ERROR, payload })

export const clearStatus = (payload) => ({ type: types.CLEAR_TRANSACCIONES_STATUS, payload })
