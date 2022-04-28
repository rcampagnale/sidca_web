import types from './types';

const initialState = {
    msg: undefined,
    nuevoAfiliado: undefined,
    processing: false,
    nuevosAfiliados: [],
    status: '',
    firstAfiliado: undefined,
    lastAfiliado: undefined,
}

export const afiliadoReducer = (state = initialState, action) => {
    switch (action.type) {
        case types.GET_AFILIADOS_NUEVOS:
            return {
                ...state,
                processing: true
            };
        case types.GET_AFILIADOS_NUEVOS_SUCCESS:
            return {
                ...state,
                nuevosAfiliados: action.payload,
                processing: false,
                status: 'SUCCESS'
            };
        case types.GET_AFILIADOS_NUEVOS_ERROR:
            return {
                ...state,
                msg: action.payload,
                processing: false,
                status: 'FAILURE'
            };
        case types.NEW_USER:
            return {
                ...state,
                processing: true
            };
        case types.NEW_USER_SUCCESS:
            return {
                ...state,
                msg: action.payload,
                processing: false,
                status: 'SUCCESS'
            };
        case types.NEW_USER_ERROR:
            return {
                ...state,
                msg: action.payload,
                processing: false,
                status: 'FAILURE'
            };
        case types.SET_FIRST_AFILIADO:
            return {
                ...state,
                firstAfiliado: action.payload
            };
        case types.SET_LAST_AFILIADO:
            return {
                ...state,
                lastAfiliado: action.payload
            };
        case types.SET_NUEVO_AFILIADO_DETAILS:
            return {
                ...state,
                nuevoAfiliado: action.payload
            };
        case types.CLEAR_AFILIADOS_STATUS:
            return {
                ...state,
                msg: undefined,
                status: '',
                processing: false,
            };
        default:
            return state;
    }
}

export default afiliadoReducer;