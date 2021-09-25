import types from './types';

const initialState = {
    msg: '',
    processing: false,
    status: '',
    novedades: [],
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