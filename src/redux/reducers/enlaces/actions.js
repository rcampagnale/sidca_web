import types from './types'
import { db } from '../../../firebase/firebase-config';
import { collection, addDoc, getDocs, query } from "firebase/firestore"; 

export const nuevoEnlace = (data) => {
    return async (dispatch, getState)=>{
        dispatch(nuevoEnlaceProcess());
        let enlace = {
            titulo: `${data.titulo}`,
            link: `${data.link}`,
            descripcion: `${data.descripcion}`,
            prioridad: Number.parseInt(data.prioridad),
        }

        try {
            const doc = await addDoc(collection(db, 'enlaces'), enlace)
            dispatch(nuevoEnlaceSuccess(`Enlace agregado Corecctamente. ID: ${doc.id}`));
        } catch (error) {
            dispatch(nuevoEnlaceError('No se ha podido agregar el enlace'));
            console.log(error)
        } 
    }
}

export const getEnlaces = () => {
    return async (dispatch, getState)=>{
        dispatch(getEnlacesProcess());
        try {
            const q = await query(collection(db, 'enlaces'))
            const querySnapshot = await getDocs(q);
            if(querySnapshot.size === 0){
                dispatch(getEnlacesError('No hay enlaces'))
            }else{
                let arrayDocs = []
                querySnapshot.forEach(doc=>{
                    const data = doc.data();
                    let obj = {
                        id: doc.id,
                        titulo: data.titulo,
                        descripcion: data.descripcion,
                        link: data.link,
                        prioridad: data.prioridad,
                    }
                    arrayDocs.push(obj)
                })
                dispatch(getEnlacesSuccess(arrayDocs))
            }
        } catch (error) {
            dispatch(getEnlacesError('No se pudieron cargar los enlaces'));
            console.log(error)
        } 
    }
} 

const nuevoEnlaceProcess = (payload) => ({type: types.NUEVO_ENLACE, payload})
const nuevoEnlaceSuccess = (payload) => ({type: types.NUEVO_ENLACE_SUCCESS, payload})
const nuevoEnlaceError = (payload) => ({type: types.NUEVO_ENLACE_SUCCESS, payload})

const getEnlacesProcess = (payload) => ({type: types.GET_ENLACES, payload})
const getEnlacesSuccess = (payload) => ({type: types.GET_ENLACES_SUCCESS, payload})
const getEnlacesError = (payload) => ({type: types.GET_ENLACES_SUCCESS, payload})

export const getEnlace = (payload) => ({type: types.GET_ENLACE, payload})

export const clearStatus = (payload) => ({type: types.CLEAR_STATUS, payload})
