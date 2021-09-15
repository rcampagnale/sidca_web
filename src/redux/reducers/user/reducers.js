// import * as types from "./types";

const initialState = {
    auth: undefined,
    profile: undefined,
    empresa: undefined,
    loading: false,
    processing: false,
    msg: undefined,
    status: undefined,
    currentStep: undefined,
    ubicacion: undefined,
};
export const userReducer = (state = initialState, action) => {
    switch (action.type) {
        // case types.AUTHENTICATE_USER:
        //     return {
        //         ...state,
        //         processing: true
        //     };
        // case types.AUTHENTICATE_USER_SUCCESS:
        //     return {
        //         ...state,
        //         auth: true,
        //         profile: {...action.payload},
        //         processing: false
        //     };
        // case types.AUTHENTICATE_USER_ERROR:
        //     return {
        //         ...state,
        //         msg: action.payload,
        //         processing: false
        //     };
        // case types.SET_USER:
        //     return {
        //         ...state,
        //         processing: true
        //     };
        // case types.SET_USER_SUCCESS:
        //     return {
        //         ...state,
        //         auth: true,
        //         profile: {...action.payload},
        //         processing: false
        //     };
        // case types.SET_USER_ERROR:
        //     return {
        //         ...state,
        //         msg: action.payload,
        //         processing: false
        //     };
        // case types.NEW_USER:
        //     return {
        //         ...state,
        //         processing: true
        //     };
        // case types.NEW_USER_SUCCESS:
        //     return {
        //         ...state,
        //         nuevoAfiliado: true,
        //         processing: false,
        //         msg: 'Se ha enviado la informacion correctamente. ¡Gracias por afiliarte a SIDCA! Ingresa con el usuario Sidcagremio y con tu DNI'
        //     };
        // case types.NEW_USER_ERROR:
        //     return {
        //         ...state,
        //         msg: action.payload,
        //         processing: false
        //     };
        // case types.LOGOUT:
        //     return {
        //         ...state,
        //         logoutProcess: true
        //     };
        // case types.LOGOUT_SUCCESS:
        //     return {
        //         ...state,
        //         auth: false,
        //         profile: false,
        //         msg: 'Se ha cerrado la sesión con exito',
        //         logoutProcess: undefined
        //     };
        // case types.LOGOUT_ERROR:
        //     return {
        //         ...state,
        //         logoutProcess: undefined
        //     };
        default:
            return state;
    }
}

export default userReducer;