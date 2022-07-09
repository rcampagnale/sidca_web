import types from './types'
import { db } from '../../../firebase/firebase-config';
import { collection, addDoc, getDocs, query, orderBy, limit, doc, setDoc, startAfter, endBefore, limitToLast } from "firebase/firestore";
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

export const uploadCurso = (data, id) => {
    return async (dispatch, getState) => {
        dispatch(uploadCursoProcess());
        let cursoObj = {
            titulo: `${data.titulo}`,
            link: `${data.link === '' ? false : data.link}`,
            descripcion: `${data.descripcion}`,
            categoria: `${data.categoria}`,
            estado: `${data.estado}`,
            imagen: `${data.imagen === '' ? false : data.imagen}`,
        }
        try {
            const refDoc = doc(db, 'cursos', id)
            const curso = await setDoc(refDoc, cursoObj)
            dispatch(uploadCursoSuccess(`Curso editado Correctamente. ID: ${id}`));
        } catch (error) {
            dispatch(uploadCursoError('No se ha podido editar el curso'));
            console.log(error)
        }
    }
}

export const getCursos = (pagination, start) => {
    return async (dispatch, getState) => {
        dispatch(getCursosProcess());
        try {
            let q

            if (pagination === 'next') {
                q = await query(collection(db, 'cursos'), orderBy('titulo', 'asc'), limit(10), startAfter(start))
            } else if (pagination === 'prev') {
                q = await query(collection(db, 'cursos'), orderBy('titulo', 'asc'), limitToLast(10), endBefore(start))
            } else {
                q = await query(collection(db, 'cursos'), orderBy('titulo', 'asc'), limit(10))
            }
            const querySnapshot = await getDocs(q);
            if (querySnapshot.size === 0) {
                dispatch(getCursosError('No hay cursos'))
            } else {
                const { page } = getState().cursos;
                const arrayDocs = [];
                querySnapshot.docs.map((doc, i) => {
                    i === 0 && dispatch(setFirstCurso(doc));
                    i === 9 && dispatch(setLastCurso(doc));
                })
                querySnapshot.forEach(doc => {
                    const data = doc.data();
                    let obj = {
                        id: doc.id,
                        titulo: data.titulo,
                        descripcion: data.descripcion,
                        estado: data.estado,
                        categoria: data.categoria,
                        link: data.link,
                        imagen: data.imagen
                    }
                    arrayDocs.push(obj)
                })
                dispatch(getCursosSuccess(arrayDocs))
                dispatch(setPage(pagination == 'next' ? page + 1 : pagination === 'prev' ? page - 1 : page))
            }
        } catch (error) {
            dispatch(getCursosError('No se pudieron cargar los cursos'));
            console.log(error)
        }
    }
}

export const getCurso = (payload) => ({ type: types.GET_CURSO, payload })

const nuevoCursoProcess = (payload) => ({ type: types.NUEVO_CURSO, payload })
const nuevoCursoSuccess = (payload) => ({ type: types.NUEVO_CURSO_SUCCESS, payload })
const nuevoCursoError = (payload) => ({ type: types.NUEVO_CURSO_ERROR, payload })

const uploadImgProcess = (payload) => ({ type: types.UPLOAD_IMG, payload })
const uploadImgSuccess = (payload) => ({ type: types.UPLOAD_IMG_SUCCESS, payload })
const uploadImgError = (payload) => ({ type: types.UPLOAD_IMG_ERROR, payload })

const uploadProgress = (payload) => ({ type: types.UPLOAD_PROGRESS, payload })

const uploadCursoProcess = (payload) => ({ type: types.UPLOAD_CURSO, payload })
const uploadCursoSuccess = (payload) => ({ type: types.UPLOAD_CURSO_SUCCESS, payload })
const uploadCursoError = (payload) => ({ type: types.UPLOAD_CURSO_ERROR, payload })

const getCursosProcess = (payload) => ({ type: types.GET_CURSOS, payload })
const getCursosSuccess = (payload) => ({ type: types.GET_CURSOS_SUCCESS, payload })
const getCursosError = (payload) => ({ type: types.GET_CURSOS_ERROR, payload })

const setFirstCurso = (payload) => ({ type: types.SET_FIRST_CURSO, payload })
const setLastCurso = (payload) => ({ type: types.SET_LAST_CURSO, payload })
const setPage = (payload) => ({ type: types.SET_PAGE, payload })

export const clearStatus = (payload) => ({ type: types.CLEAR_STATUS, payload })


export const clearCursos = (payload) => ({ type: types.CLEAR_CURSOS, payload })