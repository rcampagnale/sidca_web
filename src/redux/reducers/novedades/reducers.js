import types from './types';

const initialState = {
  msg: '',
  processing: false,
  status: '',
  novedades: [],
  novedad: {},
  progress: 0,
  uploading: false,
  img: '',
  firstNovedad: undefined,
  lastNovedad: undefined,
  page: 1,
  size: 0, // cantidad items en la página actual (para deshabilitar "Siguiente")
};

export const novedadesReducer = (state = initialState, action) => {
  switch (action.type) {
    // === CREAR ===
    case types.NUEVA_NOVEDAD:
      return { ...state, processing: true };
    case types.NUEVA_NOVEDAD_SUCCESS:
      return { ...state, processing: false, status: 'SUCCESS_ADD', msg: action.payload };
    case types.NUEVA_NOVEDAD_ERROR:
      return { ...state, processing: false, status: 'FAILURE_ADD', msg: action.payload };

    // === EDITAR ===
    case types.UPLOAD_NOVEDAD:
      return { ...state, processing: true };
    case types.UPLOAD_NOVEDAD_SUCCESS:
      return { ...state, processing: false, status: 'SUCCESS_UPLOAD', msg: action.payload };
    case types.UPLOAD_NOVEDAD_ERROR:
      return { ...state, processing: false, status: 'FAILURE_UPLOAD', msg: action.payload };

    // === IMAGEN ===
    case types.UPLOAD_IMG:
      return { ...state, uploading: true, progress: 0 };
    case types.UPLOAD_IMG_SUCCESS:
      return { ...state, uploading: false, status: 'SUCCESS_UPLOAD_IMG', img: action.payload };
    case types.UPLOAD_IMG_ERROR:
      return { ...state, uploading: false, status: 'FAILURE_UPLOAD_IMG', msg: action.payload };
    case types.UPLOAD_PROGRESS:
      return { ...state, progress: action.payload };

    // === LISTAR ===
    case types.GET_NOVEDADES:
      return { ...state, processing: true };
    case types.GET_NOVEDADES_SUCCESS:
      return {
        ...state,
        processing: false,
        status: 'SUCCESS_LIST',
        novedades: action.payload,
        size: Array.isArray(action.payload) ? action.payload.length : 0,
      };
    case types.GET_NOVEDADES_ERROR:
      return {
        ...state,
        processing: false,
        status: 'FAILURE_LIST',
        msg: action.payload,
        novedades: [],
        size: 0,
      };

    // === DETALLE ===
    case types.GET_NOVEDAD:
      // guardamos lo que llegue (puede ser id o el objeto seleccionado según tu flujo)
      return { ...state, novedad: action.payload };

    // === ELIMINAR ===
    case types.DELETE_NOVEDADES:
      return { ...state, processing: true };
    case types.DELETE_NOVEDADES_SUCCESS:
      return {
        ...state,
        processing: false,
        status: 'SUCCESS_DELETE',
        novedades: state.novedades.filter((n) => n.id !== action.payload),
        msg: 'Eliminado correctamente',
      };
    case types.DELETE_NOVEDADES_ERROR:
      return { ...state, processing: false, status: 'FAILURE_DELETE', msg: action.payload };

    // === PAGINACIÓN ===
    case types.SET_FIRST_NOVEDAD:
      return { ...state, firstNovedad: action.payload };
    case types.SET_LAST_NOVEDAD:
      return { ...state, lastNovedad: action.payload };
    case types.SET_PAGE_NOVEDAD:
      return { ...state, page: action.payload };

    // === LIMPIEZAS ===
    case types.CLEAR_NOVEDADES:
      return {
        ...state,
        novedades: [],
        firstNovedad: undefined,
        lastNovedad: undefined,
        page: 1,
        size: 0,
      };
    case types.CLEAR_STATUS:
      return { ...state, status: '', msg: '' };

    default:
      return state;
  }
};

export default novedadesReducer;
