// import * as types from "./types";

// const result = (type, payload) => {
//     return {
//         type: type,
//         payload: payload,
//     };
// };

export const adminLogin = (data) => {
    return async (dispatch, getState)=>{
        if(data.admin !== 'Yesi'){return null}
        if(data.password !== 'sidca'){return null}
        try {
            localStorage.setItem('user', '{"access_token": "asdfqwerasdfqwer"}')
            localStorage.setItem('es_admin', 'true');
        } catch (error) {
            // dispatch(newUserError('No se ha podido crear un nuevo afiliado'));
            console.log(error)
        } 
    }
}
