import types from './types'
import { db } from '../../../firebase/firebase-config';
import { collection, addDoc, query, where, getDocs } from "firebase/firestore"; 

export const nuevaNovedad = (data) => {
    return async (dispatch, getState)=>{
        dispatch(nuevaNovedadProcess());
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
            const doc = await addDoc(collection(db, 'novedades'), enlace)
            dispatch(nuevaNovedadSuccess(`Novedad Agregada Correctamente. ID: ${doc.id}`));
        } catch (error) {
            dispatch(nuevaNovedadError(`No se pudo Agregar la novedad`));
            console.log(error)
        } 
    }
}

const nuevaNovedadProcess = (payload) => ({type: types.NUEVA_NOVEDAD, payload})
const nuevaNovedadSuccess = (payload) => ({type: types.NUEVA_NOVEDAD_SUCCESS, payload})
const nuevaNovedadError = (payload) => ({type: types.NUEVA_NOVEDAD_ERROR, payload})

export const clearStatus = (payload) => ({type: types.CLEAR_STATUS, payload})