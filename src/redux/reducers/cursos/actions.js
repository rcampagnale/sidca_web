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
  where,
  deleteDoc,
} from 'firebase/firestore';
import { uploadImgFunction } from '../../../functions/uploadImgFunction';
// import { ref } from '@firebase/storage'; // 👈 ya no se usa

// ======================================================
// NUEVO CURSO
// ======================================================
export const nuevoCurso = (data) => {
  return async (dispatch, getState) => {
    dispatch(nuevoCursoProcess());

    // URL que dejó el uploadImg en el reducer
    const { img } = getState().cursos;

    const linkFinal =
      data.link && String(data.link).trim() !== ''
        ? String(data.link).trim()
        : false;

    // priorizamos data.imagen; si viene vacío usamos state.cursos.img
    const imagenFinal =
      data.imagen && String(data.imagen).trim() !== ''
        ? String(data.imagen).trim()
        : img && String(img).trim() !== ''
        ? String(img).trim()
        : false;

    console.log('[Cursos] nuevoCurso -> data.imagen:', data.imagen);
    console.log('[Cursos] nuevoCurso -> state.cursos.img:', img);
    console.log('[Cursos] nuevoCurso -> imagenFinal:', imagenFinal);

    const enlace = {
      titulo: data.titulo || '',
      link: linkFinal,
      descripcion: data.descripcion || '',
      categoria: data.categoria || '',
      estado: data.estado || '',
      imagen: imagenFinal,
    };

    try {
      const docRef = await addDoc(collection(db, 'cursos'), enlace);
      dispatch(nuevoCursoSuccess(`curso agregado. id: ${docRef.id}`));
    } catch (error) {
      dispatch(nuevoCursoError('No se ha podido agregar el curso'));
      console.log(error);
    }
  };
};

// ======================================================
// SUBIR IMAGEN
// ======================================================
export const uploadImg = (file) => {
  return async (dispatch, getState) => {
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

// ======================================================
// EDITAR CURSO
// ======================================================
export const uploadCurso = (data, id) => {
  return async (dispatch, getState) => {
    dispatch(uploadCursoProcess());

    // leo lo que guardó UPLOAD_IMG_SUCCESS
    const { img } = getState().cursos;

    const linkFinal =
      data.link && String(data.link).trim() !== ''
        ? String(data.link).trim()
        : false;

    const imagenFinal =
      data.imagen && String(data.imagen).trim() !== ''
        ? String(data.imagen).trim()
        : img && String(img).trim() !== ''
        ? String(img).trim()
        : false;

    console.log('[Cursos] uploadCurso -> data.imagen:', data.imagen);
    console.log('[Cursos] uploadCurso -> state.cursos.img:', img);
    console.log('[Cursos] uploadCurso -> imagenFinal:', imagenFinal);

    const cursoObj = {
      titulo: data.titulo || '',
      link: linkFinal,
      descripcion: data.descripcion || '',
      categoria: data.categoria || '',
      estado: data.estado || '',
      imagen: imagenFinal,
    };

    try {
      const refDoc = doc(db, 'cursos', id);
      await setDoc(refDoc, cursoObj);
      dispatch(uploadCursoSuccess(`Curso editado Correctamente. ID: ${id}`));
    } catch (error) {
      dispatch(uploadCursoError('No se ha podido editar el curso'));
      console.log(error);
    }
  };
};

// ======================================================
// LISTADO, CATEGORÍAS, MIS CURSOS, DELETE
// ======================================================
export const getCursos = (pagination, start) => {
  return async (dispatch, getState) => {
    dispatch(getCursosProcess());
    try {
      let q;

      if (pagination === 'next') {
        q = await query(
          collection(db, 'cursos'),
          orderBy('titulo', 'asc'),
          limit(10),
          startAfter(start)
        );
      } else if (pagination === 'prev') {
        q = await query(
          collection(db, 'cursos'),
          orderBy('titulo', 'asc'),
          limitToLast(10),
          endBefore(start)
        );
      } else {
        q = await query(
          collection(db, 'cursos'),
          orderBy('titulo', 'asc'),
          limit(10)
        );
      }
      const querySnapshot = await getDocs(q);
      if (querySnapshot.size === 0) {
        dispatch(getCursosError('No hay cursos'));
      } else {
        const { page } = getState().cursos;
        const arrayDocs = [];
        querySnapshot.docs.map((docSnap, i) => {
          i === 0 && dispatch(setFirstCurso(docSnap));
          i === 9 && dispatch(setLastCurso(docSnap));
        });
        querySnapshot.forEach((docSnap) => {
          const data = docSnap.data();
          let obj = {
            id: docSnap.id,
            titulo: data.titulo,
            descripcion: data.descripcion,
            estado: data.estado,
            categoria: data.categoria,
            link: data.link,
            imagen: data.imagen,
          };
          arrayDocs.push(obj);
        });
        dispatch(getCursosSuccess(arrayDocs));
        dispatch(
          setPage(
            pagination == 'next'
              ? page + 1
              : pagination === 'prev'
              ? page - 1
              : page
          )
        );
      }
    } catch (error) {
      dispatch(getCursosError('No se pudieron cargar los cursos'));
      console.log(error);
    }
  };
};

export const getCurso = (payload) => ({ type: types.GET_CURSO, payload });

export const getCursosCategory = (type) => {
  return async (dispatch, getState) => {
    dispatch(getCursosCategoryProcess());
    try {
      let q = await query(
        collection(db, 'cursos'),
        orderBy('titulo', 'asc'),
        where('categoria', '==', type)
      );
      const querySnapshot = await getDocs(q);
      if (querySnapshot.size === 0) {
        dispatch(getCursosCategoryError('No hay cursos'));
      } else {
        const arrayDocs = [];
        querySnapshot.forEach((docSnap) => {
          const data = docSnap.data();
          let obj = {
            id: docSnap.id,
            titulo: data.titulo,
            descripcion: data.descripcion,
            estado: data.estado,
            categoria: data.categoria,
            link: data.link,
            imagen: data.imagen,
          };
          arrayDocs.push(obj);
        });
        dispatch(getCursosCategorySuccess(arrayDocs));
      }
    } catch (error) {
      dispatch(getCursosCategoryError('No se pudieron cargar los cursos'));
      console.log(error);
    }
  };
};

export const getMisCursos = () => {
  return async (dispatch, getState) => {
    dispatch(getMisCursosProcess());
    try {
      const { id } = getState().user.profile;
      const q = await collection(db, 'usuarios', id, 'cursos');
      const querySnapshot = await getDocs(q);
      if (querySnapshot.size > 0) {
        let arrayCursos = [];
        querySnapshot.forEach((docSnap) => {
          const data = docSnap.data();
          let obj = {
            id: docSnap.id,
            titulo: data.titulo,
            estado: data.estado,
            imagen: data.imagen,
            aprobo: data.aprobo,
          };
          arrayCursos.push(obj);
        });
        dispatch(getMisCursosSuccess(arrayCursos));
      } else {
        dispatch(getMisCursosError('No tienes Cursos'));
      }
    } catch (error) {
      dispatch(
        getMisCursosError('No se ha podido cargar la información del usuario.')
      );
      console.log(error);
    }
  };
};

export const deleteCursos = (id) => {
  return async (dispatch, getState) => {
    dispatch(deleteCursosProcess());
    try {
      await deleteDoc(doc(db, 'cursos', id));
      dispatch(deleteCursosSuccess(id));
    } catch (error) {
      dispatch(deleteCursosError('No se eliminaron los datos'));
      console.log(error);
    }
  };
};

// ======================================================
// CARGA MASIVA USUARIOS ↔ CURSOS
// ======================================================
export const uploadUserCursosInfo = (curso, rows) => {
  return async (dispatch, getState) => {
    dispatch(uploadUserCursosInfoProcess());
    try {
      let subidos = [];
      let noSubidos = [];

      if (!rows || rows.length === 0) {
        dispatch(uploadUserCursosInfoError('El archivo Excel está vacío.'));
        return;
      }

      // Buscamos la columna DNI de manera flexible
      const headerRow = rows[0].map((h) => String(h || '').trim().toLowerCase());
      let indexOfDNI = headerRow.findIndex((h) => h === 'dni');

      if (indexOfDNI === -1) {
        dispatch(
          uploadUserCursosInfoError(
            'No se encontró la columna "DNI" en el Excel. Verificá el encabezado.'
          )
        );
        return;
      }

      // Recorremos las filas de datos (saltamos encabezado en i = 0)
      for (let i = 1; i < rows.length; i++) {
        const aprobado = rows[i];
        if (!aprobado || !aprobado.length) continue;

        const rawDni = aprobado[indexOfDNI];

        // Si no hay DNI en esa fila, lo agregamos a los noSubidos y seguimos
        if (rawDni === undefined || rawDni === null || rawDni === '') {
          noSubidos.push(`SIN_DNI_FILA_${i + 1}`);
          continue;
        }

        // Normalizamos DNI a solo números (por si viene con puntos, espacios, etc.)
        const dniAprobado = String(rawDni).replace(/[^\d]/g, '');

        if (!dniAprobado) {
          noSubidos.push(`DNI_INVALIDO_FILA_${i + 1}`);
          continue;
        }

        // Consulta a Firestore
        const q = query(
          collection(db, 'usuarios'),
          where('dni', '==', dniAprobado)
        );
        const querySnapshot = await getDocs(q);

        if (querySnapshot.size > 0) {
          for (const documentSnapshot of querySnapshot.docs) {
            const cursoAprobado = {
              aprobo: true,
              estado: 'terminado',
              titulo: curso.titulo,
              imagen: curso.imagen,
              curso: `cursos/${curso.id}`,
            };
            try {
              await addDoc(
                collection(db, 'usuarios', documentSnapshot.id, 'cursos'),
                cursoAprobado
              );
              subidos.push(dniAprobado);
            } catch (e) {
              console.log('Error agregando curso a usuario', e);
              noSubidos.push(dniAprobado);
            }
          }
        } else {
          // No se encontró el usuario con ese DNI
          noSubidos.push(dniAprobado);
        }
      }

      dispatch(uploadUserCursosInfoSuccess({ subidos, noSubidos }));
      console.log('subidos', subidos);
      console.log('no subidos', noSubidos);
    } catch (error) {
      console.log(error);
      dispatch(uploadUserCursosInfoError('No se cargaron los datos'));
    }
  };
};


// ======================================================
// NUEVA ACCIÓN: Cursos Disponibles
// ======================================================
export const getCursosDisponibles = () => {
  return async (dispatch, getState) => {
    dispatch({ type: types.GET_CURSOS_DISPONIBLES });
    try {
      const q = await query(
        collection(db, 'cursos'),
        orderBy('titulo', 'asc')
      );
      const querySnapshot = await getDocs(q);

      if (querySnapshot.size === 0) {
        dispatch({
          type: types.GET_CURSOS_DISPONIBLES_ERROR,
          payload: 'No hay cursos disponibles',
        });
      } else {
        const arrayDocs = [];
        querySnapshot.forEach((docSnap) => {
          const data = docSnap.data();
          if (data && data.estado !== 'terminado') {
            arrayDocs.push({
              id: docSnap.id,
              titulo: data.titulo,
              descripcion: data.descripcion,
              estado: data.estado,
              categoria: data.categoria,
              link: data.link,
              imagen: data.imagen,
            });
          }
        });
        dispatch({
          type: types.GET_CURSOS_DISPONIBLES_SUCCESS,
          payload: arrayDocs,
        });
      }
    } catch (error) {
      console.log(error);
      dispatch({
        type: types.GET_CURSOS_DISPONIBLES_ERROR,
        payload: 'No se pudieron cargar los cursos disponibles',
      });
    }
  };
};

// ======================================================
// ACTION CREATORS
// ======================================================
const nuevoCursoProcess = (payload) => ({ type: types.NUEVO_CURSO, payload });
const nuevoCursoSuccess = (payload) => ({
  type: types.NUEVO_CURSO_SUCCESS,
  payload,
});
const nuevoCursoError = (payload) => ({
  type: types.NUEVO_CURSO_ERROR,
  payload,
});

const uploadImgProcess = (payload) => ({ type: types.UPLOAD_IMG, payload });

// 🔴 AQUÍ el cambio importante: envolvemos la URL en { msg, img }
const uploadImgSuccess = (imgUrl) => ({
  type: types.UPLOAD_IMG_SUCCESS,
  payload: {
    msg: 'Imagen subida correctamente',
    img: imgUrl,
  },
});

const uploadImgError = (payload) => ({ type: types.UPLOAD_IMG_ERROR, payload });

const uploadProgress = (payload) => ({ type: types.UPLOAD_PROGRESS, payload });

const uploadCursoProcess = (payload) => ({ type: types.UPLOAD_CURSO, payload });
const uploadCursoSuccess = (payload) => ({
  type: types.UPLOAD_CURSO_SUCCESS,
  payload,
});
const uploadCursoError = (payload) => ({
  type: types.UPLOAD_CURSO_ERROR,
  payload,
});

const getCursosProcess = (payload) => ({ type: types.GET_CURSOS, payload });
const getCursosSuccess = (payload) => ({
  type: types.GET_CURSOS_SUCCESS,
  payload,
});
const getCursosError = (payload) => ({
  type: types.GET_CURSOS_ERROR,
  payload,
});

const setFirstCurso = (payload) => ({ type: types.SET_FIRST_CURSO, payload });
const setLastCurso = (payload) => ({ type: types.SET_LAST_CURSO, payload });
const setPage = (payload) => ({ type: types.SET_PAGE_CURSO, payload });

const getCursosCategoryProcess = (payload) => ({
  type: types.GET_CURSOS_CATEGORY,
  payload,
});
const getCursosCategorySuccess = (payload) => ({
  type: types.GET_CURSOS_CATEGORY_SUCCESS,
  payload,
});
const getCursosCategoryError = (payload) => ({
  type: types.GET_CURSOS_CATEGORY_ERROR,
  payload,
});

const getMisCursosProcess = (payload) => ({
  type: types.GET_MIS_CURSOS,
  payload,
});
const getMisCursosSuccess = (payload) => ({
  type: types.GET_MIS_CURSOS_SUCCESS,
  payload,
});
const getMisCursosError = (payload) => ({
  type: types.GET_MIS_CURSOS_ERROR,
  payload,
});

const deleteCursosProcess = (payload) => ({
  type: types.DELETE_CURSOS,
  payload,
});
const deleteCursosSuccess = (payload) => ({
  type: types.DELETE_CURSOS_SUCCESS,
  payload,
});
const deleteCursosError = (payload) => ({
  type: types.DELETE_CURSOS_ERROR,
  payload,
});

const uploadUserCursosInfoProcess = (payload) => ({
  type: types.UPLOAD_CURSOS_USER_INFO,
  payload,
});
const uploadUserCursosInfoSuccess = (payload) => ({
  type: types.UPLOAD_CURSOS_USER_INFO_SUCCESS,
  payload,
});
const uploadUserCursosInfoError = (payload) => ({
  type: types.UPLOAD_CURSOS_USER_INFO_ERROR,
  payload,
});

export const clearStatus = (payload) => ({ type: types.CLEAR_STATUS, payload });
export const clearCursos = (payload) => ({ type: types.CLEAR_CURSOS, payload });

