import types from './types';

const initialState = {
    msg: '',
    processing: false,
    status: '',
    cursos: [],
    progress: 0,
    uploading: false,
    img: '',
}

export const cursosReducer = (state = initialState, action) => {
    switch (action.type) {
        case types.NUEVO_CURSO:
            return {
                ...state,
                processing: true
            };
        case types.NUEVO_CURSO_SUCCESS:
            return {
                ...state,
                processing: false,
                status: 'SUCCESS',
                msg: action.payload
            };
        case types.NUEVO_CURSO_ERROR:
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

export default cursosReducer;