import types from './types';

const initialState = {
    msg: '',
    processing: false,
    status: '',
    enlaces: []
}

export const asesoramientoReducer = (state = initialState, action) => {
    switch (action.type) {
        case types.NUEVO_ASESORAMIENTO :
            return {
                ...state,
                processing: true,
                status: '',
                msg: '',
            };
        case types.NUEVO_ASESORAMIENTO_SUCCESS :
            return {
                ...state,
                processing: true,
                status: 'SUCCESS',
                msg: action.payload,
            };
        case types.NUEVO_ASESORAMIENTO_ERROR :
            return {
                ...state,
                processing: false,
                status: 'FAILURE',
                msg: action.payload,
            };
        case types.CLEAR_STATUS :
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

export default asesoramientoReducer;