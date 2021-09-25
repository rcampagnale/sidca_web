import types from './types'
import { db } from '../../../firebase/firebase-config';
import { collection, addDoc } from "firebase/firestore"; 

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

const nuevoEnlaceProcess = (payload) => ({type: types.NUEVO_ENLACE, payload})
const nuevoEnlaceSuccess = (payload) => ({type: types.NUEVO_ENLACE_SUCCESS, payload})
const nuevoEnlaceError = (payload) => ({type: types.NUEVO_ENLACE_SUCCESS, payload})

export const clearStatus = (payload) => ({type: types.CLEAR_STATUS, payload})
