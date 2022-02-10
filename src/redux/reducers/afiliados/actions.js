import types from './types'
import { db } from '../../../firebase/firebase-config';
import { collection, addDoc, query, where, getDocs, doc, deleteDoc, orderBy, startAfter, limit } from "firebase/firestore";

export const getAfiliadosNuevos = (data) => {
    return async (dispatch, getState)=>{
        dispatch(getAfiliadosNuevosProcess());
        try {
            if(!getState().afiliado.lastAfiliado){
                const q = await query(collection(db, "nuevoAfiliado"))
                // , orderBy('fecha', 'desc'), limit(10));
                const querySnapshot = await getDocs(q);
                if(querySnapshot.size === 0){
                    dispatch(getAfiliadosNuevosError('No hay afiliados nuevos'))
                }else{
                    // dispatch(setLastAfiliado(querySnapshot.docs[querySnapshot.docs.length-1]))
                    let arrayDocs = []
                    querySnapshot.forEach(doc=>{
                        const data = doc.data();
                        let obj = {
                            id: doc.id,
                            apellido: data.apellido,
                            nombre: data.nombre,
                            dni: data.dni,
                            fecha: data.fecha,
                            email: data.email,
                            celular: data.celular,
                            establecimientos: data.establecimientos,
                            error: data.error,
                            departamento: data.departamento
                        }
                        arrayDocs.push(obj)
                    })
                    dispatch(getAFiliadosNuevosSuccess(arrayDocs))
                }
            }else{
                const q = await query(collection(db, "nuevoAfiliado"))
                // , orderBy('fecha'), startAfter(getState().afiliado.lastAfiliado), limit(10));
                const querySnapshot = await getDocs(q);
                if(querySnapshot.size === 0){
                    dispatch(getAfiliadosNuevosError('No hay afiliados nuevos'))
                }else{
                    // dispatch(setLastAfiliado(querySnapshot.docs[querySnapshot.docs.length-1]))
                    let arrayDocs = []
                    querySnapshot.forEach(doc=>{
                        const data = doc.data();
                        let obj = {
                            id: doc.id,
                            apellido: data.apellido,
                            nombre: data.nombre,
                            dni: data.dni,
                            fecha: data.fecha,
                            email: data.email,
                            celular: data.celular,
                            establecimientos: data.establecimientos,
                            error: data.error,
                            departamento: data.departamento
                        }
                        arrayDocs.push(obj)
                    })
                    dispatch(getAFiliadosNuevosSuccess(arrayDocs))
                }
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

const setAfiliadosSize = (payload) => ({type: types.SET_AFILIADOS_SIZE, payload})
const setLastAfiliado = (payload) => ({type: types.SET_LAST_AFILIADO, payload})

export const clearStatus = (payload) => ({type: types.CLEAR_STATUS, payload})

// // Query the first page of docs
// const first = query(collection(db, "cities"), orderBy("population"), limit(25));
// const documentSnapshots = await getDocs(first);

// // Get the last visible document
// const lastVisible = documentSnapshots.docs[documentSnapshots.docs.length-1];
// console.log("last", lastVisible);

// // Construct a new query starting at this document,
// // get the next 25 cities.
// const next = query(collection(db, "cities"),
//     orderBy("population"),
//     startAfter(lastVisible),
//     limit(25));
