import types from './types';
import { db, storage } from '../../../firebase/firebase-config';
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
  where, // 👈 IMPORTANTE
} from 'firebase/firestore';
import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';

import { uploadImgFunction } from '../../../functions/uploadImgFunction';

// -------------------- CREATE --------------------
export const nuevoAsesoramiento = (data) => {
  return async (dispatch) => {
    dispatch(nuevoAsesoramientoProcess());

    const prioridadNum = Number.parseInt(data.prioridad);
    const enlace = {
      titulo: (data.titulo ?? '').trim(),
      // Nuevo campo oficial para PDF:
      pdf: data.pdf ? String(data.pdf) : '',
      // Si querés mantener el legacy link sincronizado:
      link: data.link ? String(data.link) : (data.pdf ? String(data.pdf) : ''),

      descripcion: data.descripcion ? String(data.descripcion) : '',
      categoria: data.categoria ? String(data.categoria) : '',
      estado: data.estado ? String(data.estado) : 'activo',
      imagen: data.imagen ? String(data.imagen) : '',
      prioridad: Number.isFinite(prioridadNum) ? prioridadNum : 0,
      descarga: data.descarga === 'no' ? false : true,
    };

    try {
      const docRef = await addDoc(collection(db, 'asesoramiento'), enlace);
      dispatch(nuevoAsesoramientoSuccess(`Enlace de asesoramiento agregado. ID: ${docRef.id}`));
    } catch (error) {
      dispatch(nuevoAsesoramientoError('No se ha podido agregar el enlace de asesoramiento'));
      console.log(error);
    }
  };
};

// -------------------- UPDATE --------------------
export const uploadAsesoramiento = (data, id) => {
  return async (dispatch) => {
    dispatch(uploadAsesoramientoProcess());

    const prioridadNum = Number.parseInt(data.prioridad);
    const asesoramientoObj = {
      titulo: (data.titulo ?? '').trim(),
      pdf: data.pdf ? String(data.pdf) : '',
      link: data.link ? String(data.link) : (data.pdf ? String(data.pdf) : ''),

      descripcion: data.descripcion ? String(data.descripcion) : '',
      categoria: data.categoria ? String(data.categoria) : '',
      estado: data.estado ? String(data.estado) : 'activo',
      imagen: data.imagen ? String(data.imagen) : '',
      prioridad: Number.isFinite(prioridadNum) ? prioridadNum : 0,
      descarga: data.descarga === 'no' ? false : true,
    };

    try {
      const refDoc = doc(db, 'asesoramiento', id);
      await setDoc(refDoc, asesoramientoObj);
      dispatch(uploadAsesoramientoSuccess(`Asesoramiento editado Correctamente. ID: ${id}`));
    } catch (error) {
      dispatch(uploadAsesoramientoError('No se ha podido editar el asesoramiento'));
      console.log(error);
    }
  };
};

// -------------------- UPLOAD IMG --------------------
export const uploadImg = (file) => {
  return async (dispatch) => {
    uploadImgFunction(
      dispatch,
      file,
      uploadImgProcess,
      uploadImgSuccess,
      uploadImgError,
      uploadProgress
    );
  };
};

// -------------------- UPLOAD PDF --------------------
export const uploadPdf = (file) => {
  return async (dispatch) => {
    try {
      if (!file) return;
      if (file.type !== 'application/pdf') {
        return dispatch({ type: types.UPLOAD_PDF_FAILURE, payload: 'Formato inválido. Solo PDF.' });
      }

      dispatch({ type: types.UPLOAD_PDF_REQUEST });

      const timestamp = Date.now();
      const safeName = (file.name || `asesoramiento_${timestamp}.pdf`)
        .replace(/\s+/g, '_')
        .toLowerCase();
      const storagePath = `asesoramiento/pdfs/${timestamp}_${safeName}`;

      const storageRef = ref(storage, storagePath);
      const uploadTask = uploadBytesResumable(storageRef, file, { contentType: 'application/pdf' });

      uploadTask.on(
        'state_changed',
        (snap) => {
          const progress = Math.round((snap.bytesTransferred / snap.totalBytes) * 100);
          dispatch({ type: types.UPLOAD_PDF_PROGRESS, payload: progress });
        },
        (error) => {
          dispatch({ type: types.UPLOAD_PDF_FAILURE, payload: error?.message || 'Error subiendo PDF' });
        },
        async () => {
          const url = await getDownloadURL(uploadTask.snapshot.ref);
          dispatch({ type: types.UPLOAD_PDF_SUCCESS, payload: url }); // el componente copiará a form.pdf
        }
      );
    } catch (err) {
      dispatch({ type: types.UPLOAD_PDF_FAILURE, payload: err?.message || 'Error subiendo PDF' });
    }
  };
};

// -------------------- FILTER (Category) --------------------
export const setAsesoramientoCategoryFilter = (category) => ({
  type: types.SET_ASESORAMIENTO_CATEGORY_FILTER,
  payload: category || '',
});

// -------------------- LIST / PAGINATION --------------------
export const getAsesoramientos = (pagination, start, categoryOverride) => {
  return async (dispatch, getState) => {
    dispatch(getAsesoramientosProcess());
    try {
      const { categoryFilter } = getState().asesoramiento;
      const category = categoryOverride !== undefined ? categoryOverride : categoryFilter;

      // Base ref + filtro opcional
      let baseRef = collection(db, 'asesoramiento');
      if (category) {
        baseRef = query(baseRef, where('categoria', '==', category)); // 👈 ahora sí existe where
      }

      let q;
      if (pagination === 'next') {
        q = await query(baseRef, orderBy('prioridad', 'asc'), limit(10), startAfter(start));
      } else if (pagination === 'prev') {
        q = await query(baseRef, orderBy('prioridad', 'asc'), limitToLast(10), endBefore(start));
      } else {
        q = await query(baseRef, orderBy('prioridad', 'asc'), limit(10));
      }

      const querySnapshot = await getDocs(q);
      if (querySnapshot.size === 0) {
        dispatch(getAsesoramientosError('No hay asesoramientos'));
      } else {
        const { page } = getState().asesoramiento;
        const arrayDocs = [];

        querySnapshot.docs.forEach((d, i) => {
          i === 0 && dispatch(setFirstAsesoramiento(d)); // 👈 definidos abajo
          i === 9 && dispatch(setLastAsesoramiento(d));
        });

        querySnapshot.forEach((docSnap) => {
          const data = docSnap.data();
          arrayDocs.push({
            id: docSnap.id,
            titulo: data.titulo ?? '',
            descripcion: data.descripcion ?? '',
            estado: data.estado ?? 'activo',
            categoria: data.categoria ?? '',
            link: data.link ?? '',
            pdf: data.pdf ?? '',
            imagen: data.imagen ?? '',
            prioridad: Number.isFinite(Number(data.prioridad)) ? Number(data.prioridad) : 0,
            descarga: !!data.descarga,
          });
        });

        dispatch(getAsesoramientosSuccess(arrayDocs));
        dispatch(setPage(pagination === 'next' ? page + 1 : pagination === 'prev' ? page - 1 : page));
      }
    } catch (error) {
      dispatch(getAsesoramientosError('No se pudieron cargar los asesoramientos'));
      console.log(error);
    }
  };
};

// -------------------- DELETE --------------------
export const deleteAsesoramientos = (id) => {
  return async (dispatch) => {
    dispatch(deleteAsesoramientosProcess());
    try {
      await deleteDoc(doc(db, 'asesoramiento', id));
      dispatch(deleteAsesoramientosSuccess(id));
    } catch (error) {
      dispatch(deleteAsesoramientosError('No se eliminaron los datos'));
      console.log(error);
    }
  };
};

// -------------------- GET ONE --------------------
export const getAsesoramiento = (payload) => ({ type: types.GET_ASESORAMIENTO, payload });

// -------------------- SIMPLE ACTION CREATORS --------------------
const nuevoAsesoramientoProcess = (payload) => ({ type: types.NUEVO_ASESORAMIENTO, payload });
const nuevoAsesoramientoSuccess = (payload) => ({ type: types.NUEVO_ASESORAMIENTO_SUCCESS, payload });
const nuevoAsesoramientoError = (payload) => ({ type: types.NUEVO_ASESORAMIENTO_ERROR, payload });

const uploadImgProcess = (payload) => ({ type: types.UPLOAD_IMG, payload });
const uploadImgSuccess = (payload) => ({ type: types.UPLOAD_IMG_SUCCESS, payload });
const uploadImgError = (payload) => ({ type: types.UPLOAD_IMG_ERROR, payload });

const uploadProgress = (payload) => ({ type: types.UPLOAD_PROGRESS, payload });

const uploadAsesoramientoProcess = (payload) => ({ type: types.UPLOAD_ASESORAMIENTO, payload });
const uploadAsesoramientoSuccess = (payload) => ({ type: types.UPLOAD_ASESORAMIENTO_SUCCESS, payload });
const uploadAsesoramientoError = (payload) => ({ type: types.UPLOAD_ASESORAMIENTO_ERROR, payload });

const getAsesoramientosProcess = (payload) => ({ type: types.GET_ASESORAMIENTOS, payload });          // 👈 definido
const getAsesoramientosSuccess = (payload) => ({ type: types.GET_ASESORAMIENTOS_SUCCESS, payload });  // 👈 definido
const getAsesoramientosError = (payload) => ({ type: types.GET_ASESORAMIENTOS_ERROR, payload });      // 👈 definido

const deleteAsesoramientosProcess = (payload) => ({ type: types.DELETE_ASESORAMIENTO, payload });
const deleteAsesoramientosSuccess = (payload) => ({ type: types.DELETE_ASESORAMIENTO_SUCCESS, payload });
const deleteAsesoramientosError = (payload) => ({ type: types.DELETE_ASESORAMIENTO_ERROR, payload });

const setFirstAsesoramiento = (payload) => ({ type: types.SET_FIRST_ASESORAMIENTO, payload });        // 👈 definido
const setLastAsesoramiento = (payload) => ({ type: types.SET_LAST_ASESORAMIENTO, payload });          // 👈 definido
const setPage = (payload) => ({ type: types.SET_PAGE_ASESORAMIENTO, payload });                       // 👈 definido

export const clearStatus = (payload) => ({ type: types.CLEAR_STATUS, payload });
export const clearAsesoramiento = (payload) => ({ type: types.CLEAR_ASESORAMIENTOS, payload });
