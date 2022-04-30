import * as types from "./types";

const initialState = {
    cuotas: [],
    msg: undefined,
    status: undefined,
    loading: true,
    processing: false,
    setTransaccion: undefined,
};
export const cuotasReducer = (state = initialState, action) => {
    switch (action.type) {
        case types.NUEVA_CUOTA:
            return {
                ...state,
                loading: true
            };
        case types.NUEVA_CUOTA_SUCCESS:
            return {
                ...state,
                msg: action.payload,
                status: 'SUCCESS_ADD',
                loading: false
            };
        case types.NUEVA_CUOTA_ERROR:
            return {
                ...state,
                msg: action.payload,
                status: 'FAILURE_ADD',
                loading: false
            };
        case types.UPLOAD_CUOTA:
            return {
                ...state,
                processing: true
            };
        case types.UPLOAD_CUOTA_SUCCESS:
            return {
                ...state,
                processing: false,
                status: 'SUCCESS_UPLOAD',
                msg: action.payload,
            };
        case types.UPLOAD_CUOTA_ERROR:
            return {
                ...state,
                processing: false,
                status: 'FAILURE_UPLOAD',
                msg: action.payload,
            };
        case types.GET_CUOTAS:
            return {
                ...state,
                loading: true
            };
        case types.GET_CUOTAS_SUCCESS:
            return {
                ...state,
                cuotas: action.payload || [],
                loading: false
            };
        case types.GET_CUOTAS_ERROR:
            return {
                ...state,
                msg: action.payload,
                loading: false
            };
        case types.SET_USER_SESSION:
            return {
                ...state,
                profile: action.payload
            };
        case types.SET_USER_CUOTAS_SUCCESS:
            return {
                ...state,
                setTransaccion: 'SUCCESS_SET',
            };
        case types.SET_USER_CUOTAS_ERROR:
            return {
                ...state,
                setTransaccion: 'FAILURE_SET',
            };
        case types.CLEAR_CUOTAS_STATUS:
            return {
                ...state,
                loading: undefined,
                processing: undefined,
                msg: false,
                status: false,
                tarjeta: undefined,
                setTransaccion: undefined
            };
        case types.APROVE:
            return {
                ...state,
                tarjeta: 'SUCCESS'
            };
        default:
            return state;
    }
}

export default cuotasReducer;