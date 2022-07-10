import types from './types'
import { db } from '../../../firebase/firebase-config';
import { collection, addDoc, getDocs, query, orderBy, limit, doc, setDoc, startAfter, endBefore, limitToLast, where, Timestamp } from "firebase/firestore";

export const getCategories = () => {
    return async (dispatch, getState) => {
        dispatch(getCategoriesProcess());
        try {
            let q = await query(collection(db, 'categorias'))
            const querySnapshot = await getDocs(q);
            if (querySnapshot.size === 0) {
                dispatch(getCategoriesError('No hay categorias'))
            } else {
                const cateogoriesObj = {};
                querySnapshot.forEach(doc => {
                    cateogoriesObj[doc.id] = doc.data().categorias;
                })
                dispatch(getCategoriesSuccess(cateogoriesObj))
            }
        } catch (error) {
            dispatch(getCategoriesError('No se pudieron cargar las cuotas'));
            console.log(error)
        }
    }
}

const getCategoriesProcess = (payload) => ({ type: types.GET_CATEGORIES, payload })
const getCategoriesSuccess = (payload) => ({ type: types.GET_CATEGORIES_SUCCESS, payload })
const getCategoriesError = (payload) => ({ type: types.GET_CATEGORIES_ERROR, payload })