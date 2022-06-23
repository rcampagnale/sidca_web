import types from './types';

const initialState = {
    msg: '',
    processing: false,
    status: '',
    novedades: [],
    novedad: {},
    progress: 0,
    uploading: false,
    img: '',
    firstNovedad: undefined,
    lastNovedad: undefined,
    page: 1,
    size: 0,
}

export const novedadesReducer = (state = initialState, action) => {
    switch (action.type) {
        case types.NUEVA_NOVEDAD:
            return {
                ...state,
                processing: true
            };
        case types.NUEVA_NOVEDAD_SUCCESS:
            return {
                ...state,
                processing: true,
                status: 'SUCCESS',
                msg: action.payload
            };
        case types.NUEVA_NOVEDAD_ERROR:
            return {
                ...state,
                processing: true,
                status: 'FAILURE',
                msg: action.payload
            };
        case types.UPLOAD_IMG:
            return {
                ...state,
                uploading: true
            };
        case types.UPLOAD_IMG_SUCCESS:
            return {
                ...state,
                uploading: false,
                status: 'SUCCESS',
                msg: action.payload.msg,
                img: action.payload.img,
            };
        case types.UPLOAD_IMG_ERROR:
            return {
                ...state,
                uploading: false,
                status: 'FAILURE',
                msg: action.payload
            };
        case types.UPLOAD_PROGRESS:
            return {
                ...state,
                progress: action.payload,
            };
        case types.UPLOAD_NOVEDAD:
            return {
                ...state,
                processing: true
            };
        case types.UPLOAD_NOVEDAD_SUCCESS:
            return {
                ...state,
                processing: false,
                status: 'SUCCESS_UPLOAD',
                msg: action.payload,
            };
        case types.UPLOAD_NOVEDAD_ERROR:
            return {
                ...state,
                processing: false,
                status: 'FAILURE_UPLOAD',
                msg: action.payload,
            };
        case types.GET_NOVEDADES:
            return {
                ...state,
                processing: true
            };
        case types.GET_NOVEDADES_SUCCESS:
            return {
                ...state,
                processing: false,
                novedades: action.payload,
                status: 'SUCCESS',
            };
        case types.GET_NOVEDADES_ERROR:
            return {
                ...state,
                processing: false,
                status: 'FAILURE',
                msg: action.payload,
            };
        case types.GET_NOVEDAD:
            return {
                ...state,
                novedad: state.novedades.find(novedad => novedad.id == action.payload)
            };
        case types.SET_FIRST_NOVEDAD:
            return {
                ...state,
                firstNovedad: action.payload
            };
        case types.SET_LAST_NOVEDAD:
            return {
                ...state,
                lastNovedad: action.payload
            };
        case types.SET_PAGE:
            return {
                ...state,
                page: action.payload
            };
        case types.CLEAR_STATUS:
            return {
                ...state,
                processing: false,
                status: '',
                msg: ''
            };
        default:
            return state;
    }
}

export default novedadesReducer;