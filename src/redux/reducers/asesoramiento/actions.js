import types from './types';
import { db, storage } from '../../../firebase/firebase-config';
import {
  collection, addDoc, getDocs, query, orderBy, limit,
  doc, setDoc, startAfter, endBefore, limitToLast, deleteDoc,
} from 'firebase/firestore';
import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';

import { uploadImgFunction } from '../../../functions/uploadImgFunction';

// ---------- CREATE ----------
export const nuevoAsesoramiento = (data) => {
  return async (dispatch) => {
    dispatch({ type: types.NUEVO_ASESORAMIENTO });

    const prioridadNum = Number.parseInt(data.prioridad);
    // Guardamos pdf como string ('' si no hay), y NO tocamos 'link' legacy.
    const enlace = {
      titulo: (data.titulo ?? '').trim(),
      pdf: data.pdf ? String(data.pdf) : '',              // NUEVO CAMPO OFICIAL
      link: data.link ? String(data.link) : (data.pdf ? String(data.pdf) : ''), // opcional: copia a link si querés backward
      descripcion: data.descripcion ? String(data.descripcion) : '',
      categoria: data.categoria ? String(data.categoria) : '',
      estado: data.estado ? String(data.estado) : 'activo',
      imagen: data.imagen ? String(data.imagen) : '',
      prioridad: Number.isFinite(prioridadNum) ? prioridadNum : 0,
      descarga: data.descarga === 'no' ? false : true,
    };

    try {
      const docRef = await addDoc(collection(db, 'asesoramiento'), enlace);
      dispatch({ type: types.NUEVO_ASESORAMIENTO_SUCCESS, payload: `Enlace de asesoramiento agregado. ID: ${docRef.id}` });
    } catch (error) {
      dispatch({ type: types.NUEVO_ASESORAMIENTO_ERROR, payload: 'No se ha podido agregar el enlace de asesoramiento' });
      console.log(error);
    }
  };
};

// ---------- UPDATE ----------
export const uploadAsesoramiento = (data, id) => {
  return async (dispatch) => {
    dispatch({ type: types.UPLOAD_ASESORAMIENTO });

    const prioridadNum = Number.parseInt(data.prioridad);
    const asesoramientoObj = {
      titulo: (data.titulo ?? '').trim(),
      pdf: data.pdf ? String(data.pdf) : '',              // actualizamos PDF aquí
      // Si querés mantener 'link' legacy sincronizado:
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
      dispatch({ type: types.UPLOAD_ASESORAMIENTO_SUCCESS, payload: `Asesoramiento editado Correctamente. ID: ${id}` });
    } catch (error) {
      dispatch({ type: types.UPLOAD_ASESORAMIENTO_ERROR, payload: 'No se ha podido editar el asesoramiento' });
      console.log(error);
    }
  };
};

// ---------- UPLOAD IMG ----------
export const uploadImg = (file) => {
  return async (dispatch) => {
    uploadImgFunction(dispatch, file,
      (p) => ({ type: types.UPLOAD_IMG, payload: p }),
      (p) => ({ type: types.UPLOAD_IMG_SUCCESS, payload: p }),
      (p) => ({ type: types.UPLOAD_IMG_ERROR, payload: p }),
      (p) => ({ type: types.UPLOAD_PROGRESS, payload: p }),
    );
  };
};

// ---------- UPLOAD PDF ----------
export const uploadPdf = (file) => {
  return async (dispatch) => {
    try {
      if (!file) return;
      if (file.type !== 'application/pdf') {
        return dispatch({ type: types.UPLOAD_PDF_FAILURE, payload: 'Formato inválido. Solo PDF.' });
      }

      dispatch({ type: types.UPLOAD_PDF_REQUEST });

      const timestamp = Date.now();
      const safeName = (file.name || `asesoramiento_${timestamp}.pdf`).replace(/\s+/g, '_').toLowerCase();
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
          dispatch({ type: types.UPLOAD_PDF_SUCCESS, payload: url }); // se copia a form.pdf desde el componente
        }
      );
    } catch (err) {
      dispatch({ type: types.UPLOAD_PDF_FAILURE, payload: err?.message || 'Error subiendo PDF' });
    }
  };
};

// ---------- LIST / PAGINATION ----------
export const getAsesoramientos = (pagination, start) => {
  return async (dispatch, getState) => {
    dispatch({ type: types.GET_ASESORAMIENTOS });
    try {
      let q;
      if (pagination === 'next') {
        q = await query(collection(db, 'asesoramiento'), orderBy('prioridad', 'asc'), limit(10), startAfter(start));
      } else if (pagination === 'prev') {
        q = await query(collection(db, 'asesoramiento'), orderBy('prioridad', 'asc'), limitToLast(10), endBefore(start));
      } else {
        q = await query(collection(db, 'asesoramiento'), orderBy('prioridad', 'asc'), limit(10));
      }

      const querySnapshot = await getDocs(q);
      if (querySnapshot.size === 0) {
        dispatch({ type: types.GET_ASESORAMIENTOS_ERROR, payload: 'No hay asesoramientos' });
      } else {
        const { page } = getState().asesoramiento;
        const arrayDocs = [];

        querySnapshot.docs.forEach((d, i) => {
          i === 0 && dispatch({ type: types.SET_FIRST_ASESORAMIENTO, payload: d });
          i === 9 && dispatch({ type: types.SET_LAST_ASESORAMIENTO, payload: d });
        });

        querySnapshot.forEach((docSnap) => {
          const data = docSnap.data();
          arrayDocs.push({
            id: docSnap.id,
            titulo: data.titulo,
            descripcion: data.descripcion,
            estado: data.estado,
            categoria: data.categoria,
            // traemos ambos para compatibilidad
            link: data.link,
            pdf: data.pdf,
            imagen: data.imagen,
            prioridad: data.prioridad,
            descarga: data.descarga,
          });
        });

        dispatch({ type: types.GET_ASESORAMIENTOS_SUCCESS, payload: arrayDocs });
        dispatch({ type: types.SET_PAGE_ASESORAMIENTO, payload: pagination === 'next' ? page + 1 : pagination === 'prev' ? page - 1 : page });
      }
    } catch (error) {
      dispatch({ type: types.GET_ASESORAMIENTOS_ERROR, payload: 'No se pudieron cargar los asesoramientos' });
      console.log(error);
    }
  };
};

// ---------- DELETE ----------
export const deleteAsesoramientos = (id) => {
  return async (dispatch) => {
    dispatch({ type: types.DELETE_ASESORAMIENTO });
    try {
      await deleteDoc(doc(db, 'asesoramiento', id));
      dispatch({ type: types.DELETE_ASESORAMIENTO_SUCCESS, payload: id });
    } catch (error) {
      dispatch({ type: types.DELETE_ASESORAMIENTO_ERROR, payload: 'No se eliminaron los datos' });
      console.log(error);
    }
  };
};

// ---------- UTIL ----------
export const getAsesoramiento = (payload) => ({ type: types.GET_ASESORAMIENTO, payload });
export const clearStatus = (payload) => ({ type: types.CLEAR_STATUS, payload });
export const clearAsesoramiento = (payload) => ({ type: types.CLEAR_ASESORAMIENTOS, payload });
