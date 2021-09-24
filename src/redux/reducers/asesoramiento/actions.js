import types from './types'
import { db } from '../../../firebase/firebase-config';
import { collection, addDoc, query, where, getDocs } from "firebase/firestore"; 

export const nuevoAsesoramiento = (data) => {
    return async (dispatch, getState)=>{
        dispatch(nuevoAsesoramientoProcess());
        let enlace = {
            titulo: `${data.titulo}`,
            link: `${data.link == '' ? false : data.link}`,
            descripcion: `${data.descripcion}`,
            categoria: `${data.categoria}`,
            estado: `${data.estado}`,
            imagen: `${data.imagen == '' ? false : data.imagen}`,
            prioridad: Number.parseInt(data.prioridad),
            descarga: `${data.descarga == 'no' ? false : true}`
        }
        try {
            const doc = await addDoc(collection(db, 'asesoramiento'), enlace)
            dispatch(nuevoAsesoramientoSuccess(`Enlace de asesoramiento agregado.ID: ${doc.id}`));
        } catch (error) {
            dispatch(nuevoAsesoramientoSuccess('No se ha podido agregar el enlace de asesoramiento'));
            console.log(error)
        } 
    }
}

const nuevoAsesoramientoProcess = (payload) => ({type: types.NUEVO_ASESORAMIENTO, payload})
const nuevoAsesoramientoSuccess = (payload) => ({type: types.NUEVO_ASESORAMIENTO_SUCCESS, payload})
const nuevoAsesoramientoError = (payload) => ({type: types.NUEVO_ASESORAMIENTO_ERROR, payload})

export const clearStatus = (payload) => ({type: types.CLEAR_STATUS, payload})