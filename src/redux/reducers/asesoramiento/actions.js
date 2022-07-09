import types from './types'
import { db } from '../../../firebase/firebase-config';
import { collection, addDoc, getDocs, query, orderBy, limit, doc, setDoc, startAfter, endBefore, limitToLast } from "firebase/firestore";
import { uploadImgFunction } from '../../../functions/uploadImgFunction';


export const nuevoAsesoramiento = (data) => {
    return async (dispatch, getState) => {
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
            dispatch(nuevoAsesoramientoError('No se ha podido agregar el enlace de asesoramiento'));
            console.log(error)
        }
    }
}

export const uploadImg = (file) => {
    return async (dispatch, getState) => {
        uploadImgFunction(dispatch, file, uploadImgProcess, uploadImgSuccess, uploadImgError, uploadProgress);
    }
}

export const uploadAsesoramiento = (data, id) => {
    return async (dispatch, getState) => {
        dispatch(uploadAsesoramientoProcess());
        let asesoramientoObj = {
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
            const refDoc = doc(db, 'asesoramiento', id)
            const asesoramiento = await setDoc(refDoc, asesoramientoObj)
            dispatch(uploadAsesoramientoSuccess(`Asesoramiento editado Correctamente. ID: ${id}`));
        } catch (error) {
            dispatch(uploadAsesoramientoError('No se ha podido editar el asesoramiento'));
            console.log(error)
        }
    }
}

export const getAsesoramientos = (pagination, start) => {
    return async (dispatch, getState) => {
        dispatch(getAsesoramientosProcess());
        try {
            let q

            if (pagination === 'next') {
                q = await query(collection(db, 'asesoramiento'), orderBy('prioridad', 'asc'), limit(10), startAfter(start))
            } else if (pagination === 'prev') {
                q = await query(collection(db, 'asesoramiento'), orderBy('prioridad', 'asc'), limitToLast(10), endBefore(start))
            } else {
                q = await query(collection(db, 'asesoramiento'), orderBy('prioridad', 'asc'), limit(10))
            }
            const querySnapshot = await getDocs(q);
            if (querySnapshot.size === 0) {
                dispatch(getAsesoramientosError('No hay asesoramientos'))
            } else {
                const { page } = getState().asesoramiento
                const arrayDocs = [];
                querySnapshot.docs.map((doc, i) => {
                    i === 0 && dispatch(setFirstAsesoramiento(doc));
                    i === 9 && dispatch(setLastAsesoramiento(doc));
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
                dispatch(getAsesoramientosSuccess(arrayDocs))
                dispatch(setPage(pagination == 'next' ? page + 1 : pagination === 'prev' ? page - 1 : page))
            }
        } catch (error) {
            dispatch(getAsesoramientosError('No se pudieron cargar los asesoramientos'));
            console.log(error)
        }
    }
}

export const getAsesoramiento = (payload) => ({ type: types.GET_ASESORAMIENTO, payload })

const nuevoAsesoramientoProcess = (payload) => ({ type: types.NUEVO_ASESORAMIENTO, payload })
const nuevoAsesoramientoSuccess = (payload) => ({ type: types.NUEVO_ASESORAMIENTO_SUCCESS, payload })
const nuevoAsesoramientoError = (payload) => ({ type: types.NUEVO_ASESORAMIENTO_ERROR, payload })

const uploadImgProcess = (payload) => ({ type: types.UPLOAD_IMG, payload })
const uploadImgSuccess = (payload) => ({ type: types.UPLOAD_IMG_SUCCESS, payload })
const uploadImgError = (payload) => ({ type: types.UPLOAD_IMG_ERROR, payload })

const uploadProgress = (payload) => ({ type: types.UPLOAD_PROGRESS, payload })

const uploadAsesoramientoProcess = (payload) => ({ type: types.UPLOAD_ASESORAMIENTO, payload })
const uploadAsesoramientoSuccess = (payload) => ({ type: types.UPLOAD_ASESORAMIENTO_SUCCESS, payload })
const uploadAsesoramientoError = (payload) => ({ type: types.UPLOAD_ASESORAMIENTO_ERROR, payload })

const getAsesoramientosProcess = (payload) => ({ type: types.GET_ASESORAMIENTOS, payload })
const getAsesoramientosSuccess = (payload) => ({ type: types.GET_ASESORAMIENTOS_SUCCESS, payload })
const getAsesoramientosError = (payload) => ({ type: types.GET_ASESORAMIENTOS_ERROR, payload })

const setFirstAsesoramiento = (payload) => ({ type: types.SET_FIRST_ASESORAMIENTO, payload })
const setLastAsesoramiento = (payload) => ({ type: types.SET_LAST_ASESORAMIENTO, payload })
const setPage = (payload) => ({ type: types.SET_PAGE, payload })

export const clearStatus = (payload) => ({ type: types.CLEAR_STATUS, payload })


export const clearAsesoramiento = (payload) => ({ type: types.CLEAR_ASESORAMIENTOS, payload })