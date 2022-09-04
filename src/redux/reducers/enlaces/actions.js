import types from './types'
import { db } from '../../../firebase/firebase-config';
import { collection, addDoc, getDocs, query, orderBy, limit, setDoc, doc, deleteDoc, startAfter, endBefore, limitToLast } from "firebase/firestore";

export const nuevoEnlace = (data) => {
    return async (dispatch, getState) => {
        dispatch(nuevoEnlaceProcess());
        let enlace = {
            titulo: `${data.titulo}`,
            link: `${data.link}`,
            descripcion: `${data.descripcion}`,
            prioridad: Number.parseInt(data.prioridad),
        }

        try {
            const doc = await addDoc(collection(db, 'enlaces'), enlace)
            dispatch(nuevoEnlaceSuccess(`Enlace agregado Correctamente. ID: ${doc.id}`));
        } catch (error) {
            dispatch(nuevoEnlaceError('No se ha podido agregar el enlace'));
            console.log(error)
        }
    }
}

export const uploadEnlace = (data, id) => {
    return async (dispatch, getState) => {
        dispatch(uploadEnlaceProcess());
        let enlaceObj = {
            titulo: `${data.titulo}`,
            link: `${data.link}`,
            descripcion: `${data.descripcion}`,
            prioridad: Number.parseInt(data.prioridad),
        }
        try {
            const refDoc = doc(db, 'enlaces', id)
            const enlace = await setDoc(refDoc, enlaceObj)
            dispatch(uploadEnlaceSuccess(`Enlace editado Correctamente. ID: ${id}`));
        } catch (error) {
            dispatch(uploadEnlaceError('No se ha podido editar el enlace'));
            console.log(error)
        }
    }
}

export const deleteEnlace = (id) => {
    return async (dispatch, getState) => {
        dispatch(deleteEnlaceProcess());
        try {
            const refDoc = doc(db, 'enlaces', id)
            const enlace = await deleteDoc(refDoc);
            dispatch(deleteEnlaceSuccess(`Enlace Eliminado Correctamente`));
        } catch (error) {
            dispatch(deleteEnlaceError('No se ha podido eliminar el enlace'));
            console.log(error)
        }
    }
}

export const getEnlaces = (pagination, start) => {
    return async (dispatch, getState) => {
        dispatch(getEnlacesProcess());
        try {
            let q

            if (pagination === 'next') {
                q = await query(collection(db, 'enlaces'), orderBy('prioridad', 'asc'), limit(10), startAfter(start))
            } else if (pagination === 'prev') {
                q = await query(collection(db, 'enlaces'), orderBy('prioridad', 'asc'), limitToLast(10), endBefore(start))
            } else {
                q = await query(collection(db, 'enlaces'), orderBy('prioridad', 'asc'), limit(10))
            }
            const querySnapshot = await getDocs(q);
            if (querySnapshot.size === 0) {
                dispatch(getEnlacesError('No hay enlaces'))
            } else {
                const { page } = getState().enlace;
                const arrayDocs = [];
                querySnapshot.docs.map((doc, i) => {
                    i === 0 && dispatch(setFirstEnlace(doc));
                    i === 9 && dispatch(setLastEnlace(doc));
                })
                querySnapshot.forEach(doc => {
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
                dispatch(setPage(pagination == 'next' ? page + 1 : pagination === 'prev' ? page - 1 : page))
            }
        } catch (error) {
            dispatch(getEnlacesError('No se pudieron cargar los enlaces'));
            console.log(error)
        }
    }
}

export const uploadEnlaces = (rows) => {
    return async (dispatch, getState) => {
        dispatch(uploadEnlacesProcess());
        try {
            //verificar con datos correctos, constants
            rows.map(async (row, index) => {
                if (index === 0) {
                    return
                } else {
                    const enlaceObj = {}
                    row.map((item, index) => {
                        enlaceObj[rows[0][index]] = item
                    })
                    const doc = await addDoc(collection(db, 'enlaces'), enlaceObj)
                    await dispatch(uploadEnlacesComment(`${index} enlaces agregados correctamente.`));
                }
            })
            dispatch(uploadEnlacesSuccess(`${rows.length - 1} enlaces agregados correctamente.`));
        } catch (error) {
            dispatch(uploadEnlacesError('No se pudieron agregar todos los mensajes.'));
            console.log(error)
        }
    }
}

export const getEnlace = (payload) => ({ type: types.GET_ENLACE, payload })

const nuevoEnlaceProcess = (payload) => ({ type: types.NUEVO_ENLACE, payload })
const nuevoEnlaceSuccess = (payload) => ({ type: types.NUEVO_ENLACE_SUCCESS, payload })
const nuevoEnlaceError = (payload) => ({ type: types.NUEVO_ENLACE_ERROR, payload })

const uploadEnlaceProcess = (payload) => ({ type: types.UPLOAD_ENLACE, payload })
const uploadEnlaceSuccess = (payload) => ({ type: types.UPLOAD_ENLACE_SUCCESS, payload })
const uploadEnlaceError = (payload) => ({ type: types.UPLOAD_ENLACE_ERROR, payload })

const uploadEnlacesProcess = (payload) => ({ type: types.UPLOAD_ENLACES, payload })
const uploadEnlacesComment = (payload) => ({ type: types.UPLOAD_ENLACES_COMMENT, payload })
const uploadEnlacesSuccess = (payload) => ({ type: types.UPLOAD_ENLACES_SUCCESS, payload })
const uploadEnlacesError = (payload) => ({ type: types.UPLOAD_ENLACES_ERROR, payload })

const deleteEnlaceProcess = (payload) => ({ type: types.DELETE_ENLACE, payload })
const deleteEnlaceSuccess = (payload) => ({ type: types.DELETE_ENLACE_SUCCESS, payload })
const deleteEnlaceError = (payload) => ({ type: types.DELETE_ENLACE_ERROR, payload })

const getEnlacesProcess = (payload) => ({ type: types.GET_ENLACES, payload })
const getEnlacesSuccess = (payload) => ({ type: types.GET_ENLACES_SUCCESS, payload })
const getEnlacesError = (payload) => ({ type: types.GET_ENLACES_ERROR, payload })

const setFirstEnlace = (payload) => ({ type: types.SET_FIRST_ENLACE, payload })
const setLastEnlace = (payload) => ({ type: types.SET_LAST_ENLACE, payload })
const setPage = (payload) => ({ type: types.SET_PAGE_ENLACE, payload })

export const clearStatus = (payload) => ({ type: types.CLEAR_STATUS, payload })


export const clearEnlaces = (payload) => ({ type: types.CLEAR_ENLACES, payload })
