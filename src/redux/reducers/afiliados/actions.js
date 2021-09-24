import types from './types'
import { db } from '../../../firebase/firebase-config';
import { collection, addDoc, query, where, getDocs, doc, deleteDoc } from "firebase/firestore"; 

export const getAfiliadosNuevos = (data) => {
    return async (dispatch, getState)=>{
        dispatch(getAfiliadosNuevosProcess());
        try {
            const q = await query(collection(db, 'nuevoAfiliado'))
            const querySnapshot = await getDocs(q);
            if(querySnapshot.size === 0){
                dispatch(getAfiliadosNuevosError('No hay afiliados nuevos'))
            }else{
                let arrayDocs = []
                querySnapshot.forEach(doc=>{
                    const data = doc.data();
                    let obj = {
                        id: doc.id,
                        apellido: data.apellido,
                        nombre: data.nombre,
                        dni: data.dni,
                        email: data.email,
                        celular: data.celular,
                        establecimientos: data.establecimientos,
                        error: data.error
                    }
                    arrayDocs.push(obj)
                })
                dispatch(getAFiliadosNuevosSuccess(arrayDocs))
            }
        } catch (error) {
            // dispatch(newUserError('No se ha podido crear un nuevo afiliado'));
            console.log(error)
        } 
    }
}
    
export const deleteAfiliadosNuevos = (id) => {
    return async (dispatch, getState)=>{
        dispatch(deleteAfiliadosNuevosProcess());
        try {
            await deleteDoc(doc(db, "nuevoAfiliado", id));
            dispatch(deleteAFiliadosNuevosSuccess('Se han eliminado los datos correctamente'))
        } catch (error) {
            dispatch(deleteAfiliadosNuevosError('No se eliminaron los datos'))
            console.log(error)
        } 
    }
}

export const nuevoAfiliado = (data) => {
    return async (dispatch, getState)=>{
        dispatch(newUserProcess());
        let user = {
            nombre: `${data.apellido}, ${data.nombre}`,
            dni: `${data.dni}`
        }
        try {
            const q = await query(collection(db, 'usuarios'), where('dni', '==', data.dni))
            const querySnapshot = await getDocs(q);
                if(querySnapshot.size === 0){
                    const doc = await addDoc(collection(db, 'usuarios'), user)
                    dispatch(newUserSuccess(`Usuario agregado Correctamente con el id ${doc.id}`));
                }else if(querySnapshot.size > 0){
                    dispatch(newUserError('Ya existe un afiliado con esos datos'));
                }else{
                    console.log('No existe ese Afiliado')
                    dispatch(newUserError('Ha habido un error, intentalo de nuevo más tarde'));
                }
        } catch (error) {
            dispatch(newUserError('No se ha podido crear un nuevo afiliado'));
            console.log(error)
        } 
    }
}

const getAfiliadosNuevosProcess = (payload) => ({type: types.GET_AFILIADOS_NUEVOS, payload})
const getAFiliadosNuevosSuccess = (payload) => ({type: types.GET_AFILIADOS_NUEVOS_SUCCESS, payload})
const getAfiliadosNuevosError = (payload) => ({type: types.GET_AFILIADOS_NUEVOS_ERROR, payload})

const deleteAfiliadosNuevosProcess = (payload) => ({type: types.GET_AFILIADOS_NUEVOS, payload})
const deleteAFiliadosNuevosSuccess = (payload) => ({type: types.GET_AFILIADOS_NUEVOS_SUCCESS, payload})
const deleteAfiliadosNuevosError = (payload) => ({type: types.GET_AFILIADOS_NUEVOS_ERROR, payload})

const newUserProcess = (payload) => ({type: types.NEW_USER, payload})
const newUserSuccess = (payload) => ({type: types.NEW_USER_SUCCESS, payload})
const newUserError = (payload) => ({type: types.NEW_USER_ERROR, payload})

export const logOutProcess = (payload) => ({type: types.LOGOUT, payload})
export const logOutSuccess = (payload) => ({type: types.LOGOUT_SUCCESS, payload})
export const logOutError = (payload) => ({type: types.LOGOUT_ERROR, payload})

export const clearStatus = (payload) => ({type: types.CLEAR_STATUS, payload})