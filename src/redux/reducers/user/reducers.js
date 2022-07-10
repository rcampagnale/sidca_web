import * as types from "./types";

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
    user: [],
    userEdit: undefined
};
export const userReducer = (state = initialState, action) => {
    switch (action.type) {
        case types.AUTHENTICATE_ADMIN:
            return {
                ...state,
                processing: true
            };
        case types.AUTHENTICATE_ADMIN_SUCCESS:
            return {
                ...state,
                auth: true,
                profile: { ...action.payload },
                processing: false
            };
        case types.AUTHENTICATE_ADMIN_ERROR:
            return {
                ...state,
                msg: action.payload,
                processing: false
            };
        case types.AUTHENTICATE_USER:
            return {
                ...state,
                processing: true
            };
        case types.AUTHENTICATE_USER_SUCCESS:
            return {
                ...state,
                auth: true,
                profile: { ...action.payload },
                processing: false
            };
        case types.AUTHENTICATE_USER_ERROR:
            return {
                ...state,
                msg: action.payload,
                processing: false
            };
        case types.ADMIN_LOGOUT:
            return {
                ...state,
                processing: true
            };
        case types.ADMIN_LOGOUT_SUCCESS:
            return {
                ...state,
                auth: false,
                profile: false,
                msg: 'Se ha cerrado la sesión con exito',
                processing: false
            };
        case types.ADMIN_LOGOUT_ERROR:
            return {
                ...state,
                msg: action.payload,
                processing: false
            };
        case types.LOGOUT:
            return {
                ...state,
                processing: true
            };
        case types.LOGOUT_SUCCESS:
            return {
                ...state,
                auth: false,
                profile: false,
                msg: 'Se ha cerrado la sesión con exito',
                processing: false
            };
        case types.LOGOUT_ERROR:
            return {
                ...state,
                msg: action.payload,
                processing: false
            };
        case types.SET_USER_SESSION:
            return {
                ...state,
                profile: action.payload
            };
        case types.CLEAR_USER_STATUS:
            return {
                ...state,
                loading: undefined,
                processing: undefined,
                msg: false,
                status: false,
                tarjeta: undefined
            };
        // case types.APROVE:
        //     return {
        //         ...state,
        //         tarjeta: 'SUCCESS'
        //     };
        default:
            return state;
    }
}

export default userReducer;