import types from './types'
import { db } from '../../../firebase/firebase-config';
import { collection, addDoc, query, where, getDocs } from "firebase/firestore"; 

// export const authenticateUser = (data) => {
//     return async (dispatch, getState)=>{
//         // .get()
//         // .then(documentSnapshot => {
//         //     console.log('User exists: ', documentSnapshot.exists);

//         //     if (documentSnapshot.exists) {
//         //     console.log('User data: ', documentSnapshot.data());
//         //     }
//         // });
//         dispatch(authenticateUserProcess());
//         if(data.usuario.toLowerCase() !== 'sidcagremio'){
//             return dispatch(authenticateUserError('Usuario o DNI incorrectos'));
//         }
//         await usuarios.where('dni', '==', data.dni).get()
//             .then(querySnapshot => {
//                 if(querySnapshot.size > 0 && querySnapshot.size < 2){
//                     querySnapshot.forEach(documentSnapshot => {
//                         const user = {
//                             id: documentSnapshot.id,
//                             ...documentSnapshot.data()
//                         }
//                         dispatch(authenticateUserSuccess(user));
//                         setUser(user);
//                     })
//                 }else if(querySnapshot.size > 1){
//                     dispatch(authenticateUserError('Algo ha salido mal, contactate con un administrador'));
//                 }else{
//                     dispatch(authenticateUserError('Usuario o DNI incorrectos'));
//                 }
//             })
//     }
// }

// export const setUserDispatch = (data) => {
//     return async (dispatch, getState)=>{
//         dispatch(setUserProcess());
//         try {
//             dispatch(setUserSuccess(data));
//         } catch (error) {
//             dispatch(setUserError());
//             console.log(error)
//         } 
//     }
// }

// export const newtUser = (data) => {
//     return async (dispatch, getState)=>{
//         dispatch(newUserProcess());
//         let user = {
//             nombre: `${data.apellido}, ${data.nombre}`,
//             dni: `${data.dni}`
//         }
//         try {
//             await usuarios.where('dni', '==', data.dni).get()
//             .then(async(querySnapshot) => {
//                 if(querySnapshot.size == 0){
//                     await usuarios.add(user).then(response => console.log('usuario afiliado'));
//                     await nuevoAfiliado.add(data).then(response => dispatch(newUserSuccess()));
//                 }else if(querySnapshot.size > 0){
//                     await nuevoAfiliado.add({...data, error: 'ya existe este dni en la base de datos'})
//                     .then(response => dispatch(newUserError('Ya existe un afiliado con esos datos, contacta con un administrador de SiDCa o si ya eres afiliado ingresa con tu DNI.')));
//                 }else{
//                     dispatch(newUserError('Ha habido un error, intentalo de nuevo más tarde'));
//                 }
//             })
//         } catch (error) {
//             dispatch(newUserError('No se ha podido crear un nuevo afiliado'));
//             console.log(error)
//         } 
//     }
// }

export const nuevoAfiliado = (data) => {
    return async (dispatch, getState)=>{
        // dispatch(newUserProcess());
        let user = {
            nombre: `${data.apellido}, ${data.nombre}`,
            dni: `${data.dni}`
        }
        try {
            const q = await query(collection(db, 'usuarios'), where('dni', '==', data.dni))
            const querySnapshot = await getDocs(q);
            console.log(querySnapshot)
                if(querySnapshot.size === 0){
                    const doc = await addDoc(collection(db, 'usuarios'), user)
                    console.log('usuario afiliado', doc.id)
                }else if(querySnapshot.size > 0){
                    console.log('Ya existe ese Afiliado')
                    // await nuevoAfiliado.add({...data, error: 'ya existe este dni en la base de datos'})
                    // .then(response => dispatch(newUserError('Ya existe un afiliado con esos datos, contacta con un administrador de SiDCa o si ya eres afiliado ingresa con tu DNI.')));
                }else{
                    console.log('No existe ese Afiliado')
                    // dispatch(newUserError('Ha habido un error, intentalo de nuevo más tarde'));
                }
        } catch (error) {
            // dispatch(newUserError('No se ha podido crear un nuevo afiliado'));
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

export const logOutProcess = (payload) => ({type: types.LOGOUT, payload})
export const logOutSuccess = (payload) => ({type: types.LOGOUT_SUCCESS, payload})
export const logOutError = (payload) => ({type: types.LOGOUT_ERROR, payload})