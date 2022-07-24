import types from './types';

const initialState = {
    msg: '',
    processing: false,
    uploading: false,
    status: '',
    enlaces: [],
    enlace: {},
    size: 0,
    firstEnlace: undefined,
    lastEnlace: undefined,
    page: 1,
    downloading: []
}

export const enlaceReducer = (state = initialState, action) => {
    switch (action.type) {
        case types.NUEVO_ENLACE:
            return {
                ...state,
                processing: true
            };
        case types.NUEVO_ENLACE_SUCCESS:
            return {
                ...state,
                processing: false,
                status: 'SUCCESS_ADD',
                msg: action.payload,
            };
        case types.NUEVO_ENLACE_ERROR:
            return {
                ...state,
                processing: false,
                status: 'FAILURE_ADD',
                msg: action.payload,
            };
        case types.UPLOAD_ENLACE:
            return {
                ...state,
                processing: true
            };
        case types.UPLOAD_ENLACE_SUCCESS:
            return {
                ...state,
                processing: false,
                status: 'SUCCESS_UPLOAD',
                msg: action.payload,
            };
        case types.UPLOAD_ENLACE_ERROR:
            return {
                ...state,
                processing: false,
                status: 'FAILURE_UPLOAD',
                msg: action.payload,
            };
        case types.UPLOAD_ENLACES:
            return {
                ...state,
                uploading: true
            };
        case types.UPLOAD_ENLACES_COMMENT:
            return {
                ...state,
                msg: action.payload,
            };
        case types.UPLOAD_ENLACES_SUCCESS:
            return {
                ...state,
                uploading: false,
                status: 'SUCCESS_UPLOAD',
                msg: action.payload,
            };
        case types.UPLOAD_ENLACES_ERROR:
            return {
                ...state,
                uploading: false,
                status: 'FAILURE_UPLOAD',
                msg: action.payload,
            };
        case types.DELETE_ENLACE:
            return {
                ...state,
                processing: true
            };
        case types.DELETE_ENLACE_SUCCESS:
            return {
                ...state,
                processing: false,
                status: 'SUCCESS_DELETE',
                msg: action.payload,
            };
        case types.DELETE_ENLACE_ERROR:
            return {
                ...state,
                processing: false,
                status: 'FAILURE_DELETE',
                msg: action.payload,
            };
        case types.GET_ENLACES:
            return {
                ...state,
                processing: true
            };
        case types.GET_ENLACES_SUCCESS:
            return {
                ...state,
                processing: false,
                enlaces: action.payload,
                status: 'SUCCESS',
            };
        case types.GET_ENLACES_ERROR:
            return {
                ...state,
                processing: false,
                status: 'FAILURE',
                msg: action.payload,
            };
        case types.GET_ENLACE:
            return {
                ...state,
                enlace: state.enlaces.find(enlace => enlace.id == action.payload)
            };
        case types.SET_FIRST_ENLACE:
            return {
                ...state,
                firstEnlace: action.payload
            };
        case types.SET_LAST_ENLACE:
            return {
                ...state,
                lastEnlace: action.payload
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
                msg: '',
            };

        case types.CLEAR_ENLACES:
            return {
                ...state,
                ...initialState
            };
        default:
            return state;
    }
}

export default enlaceReducer;