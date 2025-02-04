import types from './types';

const initialState = {
    msg: '',
    processing: false,
    status: '',
    cursos: [],
    curso: {},
    progress: 0,
    uploading: false,
    img: '',
    firstCurso: undefined,
    lastCurso: undefined,
    page: 1,
    size: 0,
    misCursos: [],
    subidos: [],
    noSubidos: []
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
                msg: action.payload,
                img: ''
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
        case types.UPLOAD_CURSO:
            return {
                ...state,
                processing: true
            };
        case types.UPLOAD_CURSO_SUCCESS:
            return {
                ...state,
                processing: false,
                status: 'SUCCESS_UPLOAD',
                msg: action.payload,
            };
        case types.UPLOAD_CURSO_ERROR:
            return {
                ...state,
                processing: false,
                status: 'FAILURE_UPLOAD',
                msg: action.payload,
            };
        case types.GET_CURSOS:
            return {
                ...state,
                processing: true
            };
        case types.GET_CURSOS_SUCCESS:
            return {
                ...state,
                processing: false,
                cursos: action.payload,
                status: 'SUCCESS',
            };
        case types.GET_CURSOS_ERROR:
            return {
                ...state,
                processing: false,
                status: 'FAILURE',
                msg: action.payload,
            };
        case types.GET_CURSO:
            return {
                ...state,
                curso: state.cursos.find(curso => curso.id == action.payload)
            };
        case types.SET_FIRST_CURSO:
            return {
                ...state,
                firstCurso: action.payload
            };
        case types.SET_LAST_CURSO:
            return {
                ...state,
                lastCurso: action.payload
            };
        case types.SET_PAGE_CURSO:
            return {
                ...state,
                page: action.payload
            };
        case types.GET_CURSOS_CATEGORY:
            return {
                ...state,
                processing: true
            };
        case types.GET_CURSOS_CATEGORY_SUCCESS:
            return {
                ...state,
                processing: false,
                cursos: action.payload,
                status: 'SUCCESS',
            };
        case types.GET_CURSOS_CATEGORY_ERROR:
            return {
                ...state,
                processing: false,
                status: 'FAILURE',
                msg: action.payload,
            };
        case types.GET_MIS_CURSOS:
            return {
                ...state,
                processing: true
            };
        case types.GET_MIS_CURSOS_SUCCESS:
            return {
                ...state,
                processing: false,
                misCursos: action.payload,
                status: 'SUCCESS',
            };
        case types.GET_MIS_CURSOS_ERROR:
            return {
                ...state,
                processing: false,
                status: 'FAILURE',
                msg: action.payload,
            };
        case types.DELETE_CURSOS:
            return {
                ...state,
                processing: true
            };
        case types.DELETE_CURSOS_SUCCESS:
            return {
                ...state,
                cursos: state.cursos.filter(curso => curso.id != action.payload),
                processing: false,
                msg: 'Curso Eliminado con exito',
                status: 'SUCCESS_DELETE'
            };
        case types.DELETE_CURSOS_ERROR:
            return {
                ...state,
                msg: action.payload,
                processing: false,
                status: 'FAILURE_DELETE',
            };
            case types.UPLOAD_CURSOS_USER_INFO:
            return {
                ...state,
                processing: true
            };
        case types.UPLOAD_CURSOS_USER_INFO_SUCCESS:
            return {
                ...state,
                processing: false,
                msg: '',
                subidos: action.payload.subidos,
                noSubidos: action.payload.noSubidos,
                status: 'SUCCESS_USER_INFO'
            };
        case types.UPLOAD_CURSOS_USER_INFO_ERROR:
            return {
                ...state,
                msg: action.payload,
                processing: false,
                status: 'FAILURE_USER_INFO',
            };
        case types.CLEAR_STATUS:
            return {
                ...state,
                processing: false,
                status: '',
                msg: '',
                noSubidos: [],
                subidos: []
            };
        case types.CLEAR_CURSOS:
            return {
                ...state,
                ...initialState
            };
        default:
            return state;
    }
}

export default cursosReducer;