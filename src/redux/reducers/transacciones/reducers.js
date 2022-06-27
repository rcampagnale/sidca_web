import types from './types'

const initialState = {
    msg: '',
    processing: false,
    status: '',
    loading: true,
    transacciones: [],
    transaccion: {},
    firstTransaccion: undefined,
    lastTransaccion: undefined,
    page: 1,
    size: 0,
};
export const transaccionesReducer = (state = initialState, action) => {
    switch (action.type) {
        case types.NUEVA_TRANSACCION:
            return {
                ...state,
                loading: true
            };
        case types.NUEVA_TRANSACCION_SUCCESS:
            return {
                ...state,
                msg: action.payload,
                status: 'SUCCESS_ADD',
                loading: false
            };
        case types.NUEVA_TRANSACCION_ERROR:
            return {
                ...state,
                msg: action.payload,
                status: 'FAILURE_ADD',
                loading: false
            };
        case types.GET_TRANSACCIONES:
            return {
                ...state,
                loading: true
            };
        case types.GET_TRANSACCIONES_SUCCESS:
            return {
                ...state,
                transacciones: action.payload || [],
                loading: false
            };
        case types.GET_TRANSACCIONES_ERROR:
            return {
                ...state,
                msg: action.payload,
                loading: false
            };
        case types.GET_USER_CUOTAS:
            return {
                ...state,
                loading: true
            };
        case types.GET_USER_CUOTAS_SUCCESS:
            return {
                ...state,
                cuotas: action.payload.cuotas || [],
                user: action.payload.user,
                loading: false
            };
        case types.GET_USER_CUOTAS_ERROR:
            return {
                ...state,
                msg: action.payload,
                loading: false
            };
        case types.GET_TRANSACCION:
            return {
                ...state,
                transaccion: state.transacciones.find(transaccion => transaccion.id == action.payload)
            };
        case types.SET_FIRST_TRANSACCION:
            return {
                ...state,
                firstTransaccion: action.payload
            };
        case types.SET_LAST_TRANSACCION:
            return {
                ...state,
                lastTransaccion: action.payload
            };
        case types.SET_PAGE:
            return {
                ...state,
                page: action.payload
            };
        case types.CLEAR_TRANSACCIONES_STATUS:
            return {
                ...state,
                loading: undefined,
                processing: undefined,
                msg: false,
                status: false,
                tarjeta: undefined
            };
        default:
            return state;
    }
}

export default transaccionesReducer;