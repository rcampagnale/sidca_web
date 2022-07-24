import types from './types';

const initialState = {
    msg: '',
    processing: false,
    categorias: undefined
};

export const categoriasReducer = (state = initialState, action) => {
    switch (action.type) {
        case types.GET_CATEGORIES:
            return {
                ...state,
                loading: true
            };
        case types.GET_CATEGORIES_SUCCESS:
            return {
                ...state,
                categorias: action.payload,
                loading: false
            };
        case types.GET_CATEGORIES_ERROR:
            return {
                ...state,
                msg: action.payload,
                loading: false
            };
        default:
            return state;
    }
}

export default categoriasReducer;