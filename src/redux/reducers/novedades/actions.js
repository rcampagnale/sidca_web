import types from './types'
import { db } from '../../../firebase/firebase-config';
import { collection, addDoc, getDocs, query, orderBy, limit, doc, setDoc, startAfter, endBefore, limitToLast } from "firebase/firestore";
import { uploadImgFunction } from '../../../functions/uploadImgFunction';

export const nuevaNovedad = (data) => {
    return async (dispatch, getState) => {
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
            dispatch(nuevaNovedadSuccess(`Novedad agregada Correctamente. ID: ${doc.id}`));
        } catch (error) {
            dispatch(nuevaNovedadError(`No se pudo agregar la novedad`));
            console.log(error)
        }
    }
}

export const uploadImg = (file) => {
    return async (dispatch, getState) => {
        uploadImgFunction(dispatch, file, uploadImgProcess, uploadImgSuccess, uploadImgError, uploadProgress);
    }
}

export const uploadNovedad = (data, id) => {
    return async (dispatch, getState) => {
        dispatch(uploadNovedadProcess());
        let novedadObj = {
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
            const refDoc = doc(db, 'novedades', id)
            const novedad = await setDoc(refDoc, novedadObj)
            dispatch(uploadNovedadSuccess(`Novedad editado Correctamente. ID: ${id}`));
        } catch (error) {
            dispatch(uploadNovedadError('No se ha podido editar la novedad'));
            console.log(error)
        }
    }
}

export const getNovedades = (pagination, start) => {
    return async (dispatch, getState) => {
        dispatch(getNovedadesProcess());
        try {
            let q

            if (pagination === 'next') {
                q = await query(collection(db, 'novedades'), orderBy('prioridad', 'asc'), limit(10), startAfter(start))
            } else if (pagination === 'prev') {
                q = await query(collection(db, 'novedades'), orderBy('prioridad', 'asc'), limitToLast(10), endBefore(start))
            } else {
                q = await query(collection(db, 'novedades'), orderBy('prioridad', 'asc'), limit(10))
            }
            const querySnapshot = await getDocs(q);
            if (querySnapshot.size === 0) {
                dispatch(getNovedadesError('No hay novedades'))
            } else {
                const { page } = getState().novedades
                const arrayDocs = [];
                querySnapshot.docs.map((doc, i) => {
                    i === 0 && dispatch(setFirstNovedad(doc));
                    i === 9 && dispatch(setLastNovedad(doc));
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
                        imagen: data.imagen,
                        prioridad: data.prioridad,
                        descarga: data.descarga
                    }
                    arrayDocs.push(obj)
                })
                dispatch(getNovedadesSuccess(arrayDocs))
                dispatch(setPage(pagination == 'next' ? page + 1 : pagination === 'prev' ? page - 1 : page))
            }
        } catch (error) {
            dispatch(getNovedadesError('No se pudieron cargar las novedades'));
            console.log(error)
        }
    }
}

export const getNovedad = (payload) => ({ type: types.GET_NOVEDAD, payload })

const nuevaNovedadProcess = (payload) => ({ type: types.NUEVA_NOVEDAD, payload })
const nuevaNovedadSuccess = (payload) => ({ type: types.NUEVA_NOVEDAD_SUCCESS, payload })
const nuevaNovedadError = (payload) => ({ type: types.NUEVA_NOVEDAD_ERROR, payload })

const uploadImgProcess = (payload) => ({ type: types.UPLOAD_IMG, payload })
const uploadImgSuccess = (payload) => ({ type: types.UPLOAD_IMG_SUCCESS, payload })
const uploadImgError = (payload) => ({ type: types.UPLOAD_IMG_ERROR, payload })

const uploadProgress = (payload) => ({ type: types.UPLOAD_PROGRESS, payload })

const uploadNovedadProcess = (payload) => ({ type: types.UPLOAD_NOVEDAD, payload })
const uploadNovedadSuccess = (payload) => ({ type: types.UPLOAD_NOVEDAD_SUCCESS, payload })
const uploadNovedadError = (payload) => ({ type: types.UPLOAD_NOVEDAD_ERROR, payload })

const getNovedadesProcess = (payload) => ({ type: types.GET_NOVEDADES, payload })
const getNovedadesSuccess = (payload) => ({ type: types.GET_NOVEDADES_SUCCESS, payload })
const getNovedadesError = (payload) => ({ type: types.GET_NOVEDADES_ERROR, payload })

const setFirstNovedad = (payload) => ({ type: types.SET_FIRST_NOVEDAD, payload })
const setLastNovedad = (payload) => ({ type: types.SET_LAST_NOVEDAD, payload })
const setPage = (payload) => ({ type: types.SET_PAGE, payload })

export const clearStatus = (payload) => ({ type: types.CLEAR_STATUS, payload })


export const clearNovedades = (payload) => ({ type: types.CLEAR_NOVEDADES, payload })