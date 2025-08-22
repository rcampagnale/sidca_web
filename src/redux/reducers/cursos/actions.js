import types from './types'
import { db } from '../../../firebase/firebase-config';
import { collection, addDoc, getDocs, query, orderBy, limit, doc, setDoc, startAfter, endBefore, limitToLast, where, deleteDoc } from "firebase/firestore";
import { uploadImgFunction } from '../../../functions/uploadImgFunction';
import { ref } from '@firebase/storage';

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

export const getCursosCategory = (type) => {
    return async (dispatch, getState) => {
        dispatch(getCursosCategoryProcess());
        try {
            let q = await query(collection(db, 'cursos'), orderBy('titulo', 'asc'), where('categoria', '==', type))
            const querySnapshot = await getDocs(q);
            if (querySnapshot.size === 0) {
                dispatch(getCursosCategoryError('No hay cursos'))
            } else {
                const arrayDocs = [];
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
                dispatch(getCursosCategorySuccess(arrayDocs))
            }
        } catch (error) {
            dispatch(getCursosCategoryError('No se pudieron cargar los cursos'));
            console.log(error)
        }
    }
}

export const getMisCursos = () => {
    return async (dispatch, getState) => {
        dispatch(getMisCursosProcess())
        try {
            const { id } = getState().user.profile;
            const q = await collection(db, "usuarios", id, 'cursos')
            const querySnapshot = await getDocs(q);
            if (querySnapshot.size > 0) {
                let arrayCursos = [];
                querySnapshot.forEach(doc => {
                    const data = doc.data();
                    let obj = {
                        id: doc.id,
                        titulo: data.titulo,
                        estado: data.estado,
                        imagen: data.imagen,
                        aprobo: data.aprobo
                    }
                    arrayCursos.push(obj)
                })
                dispatch(getMisCursosSuccess(arrayCursos));
            } else {
                dispatch(getMisCursosError('No tienes Cursos'));
            }
        } catch (error) {
            dispatch(getMisCursosError('No se ha podido cargar la información del usuario.'));
            console.log(error);
        }
    }
}

export const deleteCursos = (id) => {
    return async (dispatch, getState) => {
        dispatch(deleteCursosProcess());
        try {
            await deleteDoc(doc(db, "cursos", id));
            dispatch(deleteCursosSuccess(id))
        } catch (error) {
            dispatch(deleteCursosError('No se eliminaron los datos'))
            console.log(error)
        }
    }
}

export const uploadUserCursosInfo = (curso, rows) => {
    return async (dispatch, getState) => {
        dispatch(uploadUserCursosInfoProcess());
        try {
            let subidos = [];
            let noSubidos = [];
            let indexOfDNI = rows[0].indexOf('DNI')
            rows.map(async (aprobado, index) => {
                if (index === 0) return
                let dniAprobado = JSON.stringify(aprobado[indexOfDNI])
                const q = await query(collection(db, 'usuarios'), where('dni', '==', dniAprobado))
                const querySnapshot = await getDocs(q);
                if (querySnapshot.size > 0) {
                    querySnapshot.forEach(async documentSnapshot => {
                        let cursoAprobado = {
                            aprobo: true,
                            estado: 'terminado',
                            titulo: curso.titulo,
                            imagen: curso.imagen,
                            curso: `cursos/${curso.id}`
                        }
                        try {
                            const doc = await addDoc(collection(db, 'usuarios', documentSnapshot.id, 'cursos'), cursoAprobado)
                            subidos.push(dniAprobado)
                        } catch {
                            noSubidos.push(dniAprobado)
                        }
                    })
                } else {
                    noSubidos.push(dniAprobado)
                }
            })
            dispatch(uploadUserCursosInfoSuccess({subidos, noSubidos}))
            console.log('subidos', subidos)
            console.log('no subidos', noSubidos)
        } catch (error) {
            dispatch(uploadUserCursosInfoError('No se cargaron los datos'))
            console.log(error)
        }
    }
}

// =======================
// NUEVA ACCIÓN: Cursos Disponibles
// =======================
export const getCursosDisponibles = () => {
    return async (dispatch, getState) => {
        dispatch({ type: types.GET_CURSOS_DISPONIBLES });
        try {
            // Traemos todos ordenados por título (podés agregar limit(N) si lo necesitás)
            const q = await query(collection(db, 'cursos'), orderBy('titulo', 'asc'));
            const querySnapshot = await getDocs(q);

            if (querySnapshot.size === 0) {
                dispatch({ type: types.GET_CURSOS_DISPONIBLES_ERROR, payload: 'No hay cursos disponibles' });
            } else {
                const arrayDocs = [];
                querySnapshot.forEach(docSnap => {
                    const data = docSnap.data();
                    // Mostramos solo los que NO están 'terminado'
                    if (data && data.estado !== 'terminado') {
                        arrayDocs.push({
                            id: docSnap.id,
                            titulo: data.titulo,
                            descripcion: data.descripcion,
                            estado: data.estado,
                            categoria: data.categoria,
                            link: data.link,
                            imagen: data.imagen
                        });
                    }
                });
                dispatch({ type: types.GET_CURSOS_DISPONIBLES_SUCCESS, payload: arrayDocs });
            }
        } catch (error) {
            console.log(error);
            dispatch({ type: types.GET_CURSOS_DISPONIBLES_ERROR, payload: 'No se pudieron cargar los cursos disponibles' });
        }
    };
};

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
const setPage = (payload) => ({ type: types.SET_PAGE_CURSO, payload })

const getCursosCategoryProcess = (payload) => ({ type: types.GET_CURSOS_CATEGORY, payload })
const getCursosCategorySuccess = (payload) => ({ type: types.GET_CURSOS_CATEGORY_SUCCESS, payload })
const getCursosCategoryError = (payload) => ({ type: types.GET_CURSOS_CATEGORY_ERROR, payload })

const getMisCursosProcess = (payload) => ({ type: types.GET_MIS_CURSOS, payload })
const getMisCursosSuccess = (payload) => ({ type: types.GET_MIS_CURSOS_SUCCESS, payload })
const getMisCursosError = (payload) => ({ type: types.GET_MIS_CURSOS_ERROR, payload })

const deleteCursosProcess = (payload) => ({ type: types.DELETE_CURSOS, payload })
const deleteCursosSuccess = (payload) => ({ type: types.DELETE_CURSOS_SUCCESS, payload })
const deleteCursosError = (payload) => ({ type: types.DELETE_CURSOS_ERROR, payload })

const uploadUserCursosInfoProcess = (payload) => ({ type: types.UPLOAD_CURSOS_USER_INFO, payload })
const uploadUserCursosInfoSuccess = (payload) => ({ type: types.UPLOAD_CURSOS_USER_INFO_SUCCESS, payload })
const uploadUserCursosInfoError = (payload) => ({ type: types.UPLOAD_CURSOS_USER_INFO_ERROR, payload })

export const clearStatus = (payload) => ({ type: types.CLEAR_STATUS, payload })
export const clearCursos = (payload) => ({ type: types.CLEAR_CURSOS, payload })
