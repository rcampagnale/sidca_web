import types from './types';

const initialState = {
    msg: '',
    processing: false,
    status: '',
    asesoramientos: [],
    asesoramiento: {},
    progress: 0,
    uploading: false,
    img: '',
    firstAsesoramiento: undefined,
    lastAsesoramiento: undefined,
    page: 1,
    size: 0,
}

export const asesoramientoReducer = (state = initialState, action) => {
    switch (action.type) {
        case types.NUEVO_ASESORAMIENTO:
            return {
                ...state,
                processing: true
            };
        case types.NUEVO_ASESORAMIENTO_SUCCESS:
            return {
                ...state,
                processing: false,
                status: 'SUCCESS',
                msg: action.payload,
                img: ''
            };
        case types.NUEVO_ASESORAMIENTO_ERROR:
            return {
                ...state,
                processing: false,
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
        case types.UPLOAD_ASESORAMIENTO:
            return {
                ...state,
                processing: true
            };
        case types.UPLOAD_ASESORAMIENTO_SUCCESS:
            return {
                ...state,
                processing: false,
                status: 'SUCCESS_UPLOAD',
                msg: action.payload,
            };
        case types.UPLOAD_ASESORAMIENTO_ERROR:
            return {
                ...state,
                processing: false,
                status: 'FAILURE_UPLOAD',
                msg: action.payload,
            };
        case types.GET_ASESORAMIENTOS:
            return {
                ...state,
                processing: true
            };
        case types.GET_ASESORAMIENTOS_SUCCESS:
            return {
                ...state,
                processing: false,
                asesoramientos: action.payload,
                status: 'SUCCESS',
            };
        case types.GET_ASESORAMIENTOS_ERROR:
            return {
                ...state,
                processing: false,
                status: 'FAILURE',
                msg: action.payload,
            };
            case types.DELETE_ASESORAMIENTO:
            return {
                ...state,
                processing: true
            };
        case types.DELETE_ASESORAMIENTO_SUCCESS:
            return {
                ...state,
                asesoramientos: state.asesoramientos.filter(afiliado => afiliado.id != action.payload),
                processing: false,
                msg: 'Asesoramiento Eliminado con exito',
                status: 'SUCCESS_DELETE'
            };
        case types.DELETE_ASESORAMIENTO_ERROR:
            return {
                ...state,
                msg: action.payload,
                processing: false,
                status: 'FAILURE_DELETE',
            };
        case types.GET_ASESORAMIENTO:
            return {
                ...state,
                asesoramiento: state.asesoramientos.find(asesoramiento => asesoramiento.id == action.payload)
            };
        case types.SET_FIRST_ASESORAMIENTO:
            return {
                ...state,
                firstAsesoramiento: action.payload
            };
        case types.SET_LAST_ASESORAMIENTO:
            return {
                ...state,
                lastAsesoramiento: action.payload
            };
        case types.SET_PAGE_ASESORAMIENTO:
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

        case types.CLEAR_ASESORAMIENTOS:
            return {
                ...state,
                ...initialState
            };
        default:
            return state;
    }
}

export default asesoramientoReducer;