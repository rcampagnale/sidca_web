import types from './types';
import { db } from '../../../firebase/firebase-config';
import {
  collection,
  addDoc,
  getDocs,
  query,
  orderBy,
  limit,
  doc,
  setDoc,
  startAfter,
  endBefore,
  limitToLast,
  deleteDoc,
  where,
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
const VALID_VALUES = new Set([
  'turismo', 'predio', 'casa', 'convenio_comercio', 'convenio_hoteles'
]);
const normalizeCategoria = (v) => CATEGORIA_MAP[v] || v;

/* ======================= CREAR ======================= */
export const nuevaNovedad = (data) => {
  return async (dispatch) => {
    dispatch(nuevaNovedadProcess());

    const categoriaNorm = normalizeCategoria(data.categoria);
    if (!VALID_VALUES.has(categoriaNorm)) {
      return dispatch(nuevaNovedadError('Categoría inválida. Usa: turismo, predio, casa, convenio_comercio o convenio_hoteles.'));
    }

    // departamento solo aplica para convenio_comercio
    const departamentoValue = categoriaNorm === 'convenio_comercio'
      ? (data.departamento || '')
      : ''; // <-- si preferís null, reemplazá '' por null

    const enlace = {
      titulo: `${data.titulo}`,
      link: `${data.link === '' ? false : data.link}`,
      descripcion: `${data.descripcion}`,
      categoria: categoriaNorm,
      estado: `${data.estado}`,
      imagen: `${data.imagen === '' ? false : data.imagen}`,
      prioridad: Number.parseInt(data.prioridad, 10),
      descarga: `${data.descarga === 'no' ? false : true}`,
      departamento: departamentoValue, // 👈 NUEVO
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
    if (!VALID_VALUES.has(categoriaNorm)) {
      return dispatch(uploadNovedadError('Categoría inválida. Usa: turismo, predio, casa, convenio_comercio o convenio_hoteles.'));
    }

    // departamento solo aplica para convenio_comercio
    const departamentoValue = categoriaNorm === 'convenio_comercio'
      ? (data.departamento || '')
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
      departamento: departamentoValue, // 👈 NUEVO
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

/* ======================= LISTAR con FILTRO y PAGINACIÓN ======================= */
/**
 * @param {'next'|'prev'|undefined} pagination - dirección de la paginación
 * @param {import('firebase/firestore').QueryDocumentSnapshot|undefined} start - doc de referencia para startAfter/endBefore
 * @param {string} categoria - categoría a filtrar; 'todas' para sin filtro (admite label o value)
 */
export const getNovedades = (pagination, start, categoria = 'todas') => {
  return async (dispatch, getState) => {
    dispatch(getNovedadesProcess());
    try {
      const PAGE_SIZE = 20;

      // Normalizamos por si llega un label desde la UI
      const categoriaNorm = categoria === 'todas' ? 'todas' : normalizeCategoria(categoria);

      // ====== Constraints base: where (opcional) + orderBy obligatorio ======
      const constraints = [];

      if (categoriaNorm && categoriaNorm !== 'todas') {
        constraints.push(where('categoria', '==', categoriaNorm));
      }

      constraints.push(orderBy('prioridad', 'asc'));

      // ====== Paginación ======
      let q;
      if (pagination === 'next' && start) {
        q = query(
          collection(db, 'novedades'),
          ...constraints,
          startAfter(start),
          limit(PAGE_SIZE)
        );
      } else if (pagination === 'prev' && start) {
        q = query(
          collection(db, 'novedades'),
          ...constraints,
          endBefore(start),
          limitToLast(PAGE_SIZE)
        );
      } else {
        q = query(
          collection(db, 'novedades'),
          ...constraints,
          limit(PAGE_SIZE)
        );
      }

      const querySnapshot = await getDocs(q);

      if (querySnapshot.size === 0) {
        dispatch(getNovedadesError('No hay novedades'));
        return;
      }

      const { page } = getState().novedades;

      // Guardamos referencias de paginación (primer y último doc de esta página)
      querySnapshot.docs.forEach((docSnap, i) => {
        if (i === 0) dispatch(setFirstNovedad(docSnap));
        if (i === PAGE_SIZE - 1) dispatch(setLastNovedad(docSnap));
      });

      // Normalizamos data
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
          departamento: data.departamento || '', // 👈 NUEVO
        });
      });

      dispatch(getNovedadesSuccess(arrayDocs));
      dispatch(setPage(
        pagination === 'next' ? page + 1 :
        pagination === 'prev' ? page - 1 : page
      ));

    } catch (error) {
      if (error?.code === 'failed-precondition') {
        dispatch(getNovedadesError('Se requiere un índice compuesto para filtrar por categoría y ordenar por prioridad. Crealo desde el link que muestra la consola.'));
      } else {
        dispatch(getNovedadesError('No se pudieron cargar las novedades'));
      }
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
        departamento: data.departamento || '', // 👈 NUEVO
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

const setFirstNovedad = (payload) => ({ type: types.SET_FIRST_NOVEDAD, payload });
const setLastNovedad  = (payload) => ({ type: types.SET_LAST_NOVEDAD, payload });
const setPage         = (payload) => ({ type: types.SET_PAGE_NOVEDAD, payload });

export const clearStatus    = (payload) => ({ type: types.CLEAR_STATUS, payload });
export const clearNovedades = (payload) => ({ type: types.CLEAR_NOVEDADES, payload });

