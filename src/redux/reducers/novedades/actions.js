import types from './types';
import { db } from '../../../firebase/firebase-config';
import {
  collection,
  addDoc,
  getDocs,
  doc,
  setDoc,
  deleteDoc,
  getDoc // 👈 IMPORTANTE: para leer una novedad por id
} from "firebase/firestore";
import { uploadImgFunction } from '../../../functions/uploadImgFunction';

/* ======================= Normalización y validación de categoría ======================= */
const CATEGORIA_MAP = {
  'Turismo': 'turismo',
  'Predio': 'predio',
  'Casa del Docente': 'casa',
  'Convenio Comercio': 'convenio_comercio',
  'Convenio Hoteles': 'convenio_hoteles',
  'turismo': 'turismo',
  'predio': 'predio',
  'casa': 'casa',
  'convenio_comercio': 'convenio_comercio',
  'convenio_hoteles': 'convenio_hoteles',
};
const normalizeCategoria = (v) => CATEGORIA_MAP[v] || v;
const esCategoriaConvenio = (categoria) =>
  categoria === 'convenio_comercio' || categoria === 'convenio_hoteles';
const normalizarDepartamentos = (data) => {
  if (Array.isArray(data.departamentos)) return data.departamentos.filter(Boolean);
  return data.departamento ? [data.departamento] : [];
};

/* ======================= CREAR ======================= */
export const nuevaNovedad = (data) => {
  return async (dispatch) => {
    dispatch(nuevaNovedadProcess());

    const categoriaNorm = normalizeCategoria(data.categoria);
    if (typeof categoriaNorm !== 'string' || categoriaNorm.trim() === '') {
      return dispatch(nuevaNovedadError('La categoría es obligatoria.'));
    }

    const esConvenio = esCategoriaConvenio(categoriaNorm);
    const departamentos = esConvenio ? normalizarDepartamentos(data) : [];
    const alcanceTodosDepartamentos = esConvenio && data.alcanceTodosDepartamentos === true;
    const departamentoValue = esConvenio && departamentos.length > 0
      ? departamentos[0]
      : '';

    const enlace = {
      titulo: `${data.titulo}`,
      link: `${data.link === '' ? false : data.link}`,
      descripcion: `${data.descripcion}`,
      categoria: categoriaNorm,
      estado: `${data.estado}`,
      imagen: `${data.imagen === '' ? false : data.imagen}`,
      prioridad: Number.parseInt(data.prioridad, 10),
      descarga: `${data.descarga === 'no' ? false : true}`,
      departamento: departamentoValue,
      departamentos,
      alcanceTodosDepartamentos,
    };

    try {
      const d = await addDoc(collection(db, 'novedades'), enlace);
      dispatch(nuevaNovedadSuccess(`Novedad agregada Correctamente. ID: ${d.id}`));
    } catch (error) {
      dispatch(nuevaNovedadError(`No se pudo agregar la novedad`));
      console.log(error);
    }
  };
};

/* ======================= UPLOAD IMG ======================= */
export const uploadImg = (file) => {
  return async (dispatch) => {
    uploadImgFunction(dispatch, file, uploadImgProcess, uploadImgSuccess, uploadImgError, uploadProgress);
  };
};

/* ======================= EDITAR ======================= */
export const uploadNovedad = (data, id) => {
  return async (dispatch) => {
    dispatch(uploadNovedadProcess());

    const categoriaNorm = normalizeCategoria(data.categoria);
    if (typeof categoriaNorm !== 'string' || categoriaNorm.trim() === '') {
      return dispatch(uploadNovedadError('La categoría es obligatoria.'));
    }

    const esConvenio = esCategoriaConvenio(categoriaNorm);
    const departamentos = esConvenio ? normalizarDepartamentos(data) : [];
    const alcanceTodosDepartamentos = esConvenio && data.alcanceTodosDepartamentos === true;
    const departamentoValue = esConvenio && departamentos.length > 0
      ? departamentos[0]
      : '';

    const novedadObj = {
      titulo: `${data.titulo}`,
      link: `${data.link === '' ? false : data.link}`,
      descripcion: `${data.descripcion}`,
      categoria: categoriaNorm,
      estado: `${data.estado}`,
      imagen: `${data.imagen === '' ? false : data.imagen}`,
      prioridad: Number.parseInt(data.prioridad, 10),
      descarga: `${data.descarga === 'no' ? false : true}`,
      departamento: departamentoValue,
      departamentos,
      alcanceTodosDepartamentos,
    };

    try {
      const refDoc = doc(db, 'novedades', id);
      await setDoc(refDoc, novedadObj, { merge: true }); // merge para no pisar otros campos
      dispatch(uploadNovedadSuccess(`Novedad editado Correctamente. ID: ${id}`));
    } catch (error) {
      dispatch(uploadNovedadError('No se ha podido editar la novedad'));
      console.log(error);
    }
  };
};

/* ======================= LISTAR ======================= */
/* La lista completa se carga una vez; filtro, orden y paginación viven en la UI. */
export const getNovedades = () => {
  return async (dispatch) => {
    dispatch(getNovedadesProcess());
    try {
      const querySnapshot = await getDocs(collection(db, 'novedades'));
      const arrayDocs = [];
      querySnapshot.forEach(docSnap => {
        const data = docSnap.data();
        arrayDocs.push({
          id: docSnap.id,
          titulo: data.titulo,
          descripcion: data.descripcion,
          estado: data.estado,
          categoria: data.categoria,
          link: data.link,
          imagen: data.imagen,
          prioridad: data.prioridad,
          descarga: data.descarga,
          departamento: data.departamento || '',
          departamentos: Array.isArray(data.departamentos) ? data.departamentos : undefined,
          alcanceTodosDepartamentos: data.alcanceTodosDepartamentos === true,
        });
      });

      arrayDocs.sort((a, b) => {
        const prioridadA = Number.isFinite(Number(a.prioridad)) ? Number(a.prioridad) : 0;
        const prioridadB = Number.isFinite(Number(b.prioridad)) ? Number(b.prioridad) : 0;
        return prioridadA - prioridadB;
      });

      dispatch(getNovedadesSuccess(arrayDocs));

    } catch (error) {
      dispatch(getNovedadesError('No se pudieron cargar las novedades'));
      console.log(error);
    }
  };
};

/* ======================= DETALLE (trae el doc por ID) ======================= */
export const getNovedad = (id) => {
  return async (dispatch) => {
    try {
      const ref = doc(db, 'novedades', id);
      const snap = await getDoc(ref);

      if (!snap.exists()) {
        dispatch(getNovedadesError('La novedad no existe'));
        return;
      }

      const data = snap.data();
      const novedad = {
        id: snap.id,
        titulo: data.titulo,
        descripcion: data.descripcion,
        estado: data.estado,
        categoria: data.categoria,
        link: data.link,
        imagen: data.imagen,
        prioridad: data.prioridad,
        descarga: data.descarga,
        departamento: data.departamento || '',
        departamentos: Array.isArray(data.departamentos) ? data.departamentos : undefined,
        alcanceTodosDepartamentos: data.alcanceTodosDepartamentos === true,
      };

      dispatch({ type: types.GET_NOVEDAD, payload: novedad });
    } catch (error) {
      dispatch(getNovedadesError('No se pudo cargar la novedad'));
      console.log(error);
    }
  };
};

/* ======================= DELETE ======================= */
export const deleteNovedades = (id) => {
  return async (dispatch) => {
    dispatch(deleteNovedadesProcess());
    try {
      await deleteDoc(doc(db, "novedades", id));
      dispatch(deleteNovedadesSuccess(id));
    } catch (error) {
      dispatch(deleteNovedadesError('No se eliminaron los datos'));
      console.log(error);
    }
  };
};

/* ======================= ACTION CREATORS ======================= */
const nuevaNovedadProcess = (payload) => ({ type: types.NUEVA_NOVEDAD, payload });
const nuevaNovedadSuccess = (payload) => ({ type: types.NUEVA_NOVEDAD_SUCCESS, payload });
const nuevaNovedadError = (payload) => ({ type: types.NUEVA_NOVEDAD_ERROR, payload });

const uploadImgProcess = (payload) => ({ type: types.UPLOAD_IMG, payload });
const uploadImgSuccess = (payload) => ({ type: types.UPLOAD_IMG_SUCCESS, payload });
const uploadImgError = (payload) => ({ type: types.UPLOAD_IMG_ERROR, payload });

const uploadProgress = (payload) => ({ type: types.UPLOAD_PROGRESS, payload });

const uploadNovedadProcess = (payload) => ({ type: types.UPLOAD_NOVEDAD, payload });
const uploadNovedadSuccess = (payload) => ({ type: types.UPLOAD_NOVEDAD_SUCCESS, payload });
const uploadNovedadError = (payload) => ({ type: types.UPLOAD_NOVEDAD_ERROR, payload });

const getNovedadesProcess = (payload) => ({ type: types.GET_NOVEDADES, payload });
const getNovedadesSuccess = (payload) => ({ type: types.GET_NOVEDADES_SUCCESS, payload });
const getNovedadesError = (payload) => ({ type: types.GET_NOVEDADES_ERROR, payload });

const deleteNovedadesProcess = (payload) => ({ type: types.DELETE_NOVEDADES, payload });
const deleteNovedadesSuccess = (payload) => ({ type: types.DELETE_NOVEDADES_SUCCESS, payload });
const deleteNovedadesError = (payload) => ({ type: types.DELETE_NOVEDADES_ERROR, payload });

export const clearStatus    = (payload) => ({ type: types.CLEAR_STATUS, payload });
export const clearNovedades = (payload) => ({ type: types.CLEAR_NOVEDADES, payload });

