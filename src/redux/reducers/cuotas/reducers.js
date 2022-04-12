import * as types from "./types";

const initialState = {
    cuotas: [],
    msg: undefined,
    status: undefined,
    loading: true,
    processing: false,
};
export const cuotasReducer = (state = initialState, action) => {
    switch (action.type) {
        case types.GET_CUOTAS:
            return {
                ...state,
                loading: true
            };
        case types.GET_CUOTAS_SUCCESS:
            return {
                ...state,
                cuotas: action.payload || [],
                loading: false
            };
        case types.GET_CUOTAS_ERROR:
            return {
                ...state,
                msg: action.payload,
                loading: false
            };
        case types.SET_USER_SESSION:
            return {
                ...state,
                profile: action.payload
            };
        case types.CLEAR_USER_STATUS:
            return {
                ...state,
                loading: undefined,
                processing: undefined,
                msg: false,
                status: false,
                tarjeta: undefined
            };
        case types.APROVE:
            return {
                ...state,
                tarjeta: 'SUCCESS'
            };
        default:
            return state;
    }
}

export default cuotasReducer;