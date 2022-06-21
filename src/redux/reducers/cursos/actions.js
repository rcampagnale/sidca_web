import types from './types'
import { db } from '../../../firebase/firebase-config';
import { collection, addDoc } from "firebase/firestore";
import { getStorage, ref, uploadBytesResumable, getDownloadURL } from "firebase/storage";
import { uploadImgFunction } from '../../../functions/uploadImgFunction';

export const nuevoCurso = (data) => {
    return async (dispatch, getState) => {
        dispatch(nuevoCursoProcess());
        let enlace = {
            titulo: `${data.titulo}`,
            link: `${data.link === '' ? false : data.link}`,
            descripcion: `${data.descripcion}`,
            categoria: `${data.categoria}`,
            estado: `${data.estado}`,
            imagen: `${data.imagen === '' ? false : data.imagen}`,
        }
        try {
            const doc = await addDoc(collection(db, 'cursos'), enlace)
            dispatch(nuevoCursoSuccess(`curso agregado. id: ${doc.id}`))
        } catch (error) {
            dispatch(nuevoCursoError('No se ha podido agregar el curso'));
            console.log(error)
        }
    }
}

export const uploadImg = (file) => {
    return async (dispatch, getState) => {
        uploadImgFunction(dispatch, file, uploadImgProcess, uploadImgSuccess, uploadImgError, uploadProgress);
    }
}

const nuevoCursoProcess = (payload) => ({ type: types.NUEVO_CURSO, payload })
const nuevoCursoSuccess = (payload) => ({ type: types.NUEVO_CURSO_SUCCESS, payload })
const nuevoCursoError = (payload) => ({ type: types.NUEVO_CURSO_ERROR, payload })

const uploadImgProcess = (payload) => ({ type: types.UPLOAD_IMG, payload })
const uploadImgSuccess = (payload) => ({ type: types.UPLOAD_IMG_SUCCESS, payload })
const uploadImgError = (payload) => ({ type: types.UPLOAD_IMG_ERROR, payload })

const uploadProgress = (payload) => ({ type: types.UPLOAD_PROGRESS, payload })

export const clearStatus = (payload) => ({ type: types.CLEAR_STATUS, payload })