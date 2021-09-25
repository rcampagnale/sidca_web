import types from './types';

const initialState = {
    msg: '',
    processing: false,
    stauts: '',
    enlaces: [],
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
                status: 'SUCCESS',
                msg: action.payload,
            };
        case types.NUEVO_ENLACE_ERROR:
            return {
                ...state,
                processing: false,
                status: 'FAILURE',
                msg: action.payload,
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