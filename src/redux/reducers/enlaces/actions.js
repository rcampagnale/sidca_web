// import types from './types'
import { db } from '../../../firebase/firebase-config';
import { collection, addDoc } from "firebase/firestore"; 

export const nuevoEnlace = (data) => {
    return async (dispatch, getState)=>{
        // dispatch(newUserProcess());
        let enlace = {
            titulo: `${data.titulo}`,
            link: `${data.link}`,
            descripcion: `${data.descripcion}`,
            prioridad: Number.parseInt(data.prioridad),
        }

        try {
            const doc = await addDoc(collection(db, 'enlaces'), enlace)
            console.log('enlace agregado', doc.id)
        } catch (error) {
            // dispatch(newUserError('No se ha podido crear un nuevo afiliado'));
            console.log('No se ha podido agregar el enlace');
            console.log(error)
        } 
    }
}

// const authenticateUserProcess = (payload) => ({type: types.AUTHENTICATE_USER, payload})
// const authenticateUserSuccess = (payload) => ({type: types.AUTHENTICATE_USER_SUCCESS, payload})
// const authenticateUserError = (payload) => ({type: types.AUTHENTICATE_USER_ERROR, payload})

// const setUserProcess = (payload) => ({type: types.SET_USER, payload})
// const setUserSuccess = (payload) => ({type: types.SET_USER_SUCCESS, payload})
// const setUserError = (payload) => ({type: types.SET_USER_ERROR, payload})

// const newUserProcess = (payload) => ({type: types.NEW_USER, payload})
// const newUserSuccess = (payload) => ({type: types.NEW_USER_SUCCESS, payload})
// const newUserError = (payload) => ({type: types.NEW_USER_ERROR, payload})

// export const logOutProcess = (payload) => ({type: types.LOGOUT, payload})
// export const logOutSuccess = (payload) => ({type: types.LOGOUT_SUCCESS, payload})
// export const logOutError = (payload) => ({type: types.LOGOUT_ERROR, payload})