import types from './types';

const initialState = {
    msg: '',
    processing: false,
    status: '',
    cuotas: [],
    cuota: {},
    progress: 0,
    uploading: false,
    img: '',
    firstCuota: undefined,
    lastCuota: undefined,
    page: 1,
    size: 0,
    loading: true,
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

        // FALTA SET_USER-CUOTAS

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
        case types.GET_CUOTA:
            return {
                ...state,
                cuota: state.cuotas.find(cuota => cuota.id == action.payload)
            };
        case types.SET_FIRST_CUOTA:
            return {
                ...state,
                firstCuota: action.payload
            };
        case types.SET_LAST_CUOTA:
            return {
                ...state,
                lastCuota: action.payload
            };
        case types.SET_PAGE_CUOTA:
            return {
                ...state,
                page: action.payload
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


        case types.CLEAR_CUOTAS:
            return {
                ...state,
                ...initialState
            };
        default:
            return state;
    }
}

export default cuotasReducer;