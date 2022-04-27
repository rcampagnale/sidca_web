import types from './types';

const initialState = {
    msg: '',
    processing: false,
    stauts: '',
    enlaces: [],
    enlace: {},
    size: 0,
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
        case types.CLEAR_STATUS:
            return {
                ...state,
                processing: false,
                status: '',
                msg: '',
            };
        default:
            return state;
    }
}

export default enlaceReducer;