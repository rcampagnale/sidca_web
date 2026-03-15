import types from './types';
import { db } from '../../../firebase/firebase-config';
import {
  collection,
  addDoc,
  getDocs,
  query,
  getDoc,
  orderBy,
  limit,
  doc,
  startAfter,
  endBefore,
  limitToLast,
} from "firebase/firestore";
import moment from 'moment';

export const nuevaTransaccion = (data) => {
  return async (dispatch) => {
    dispatch(nuevaTransaccionProcess());

    const transaccion = {
      titulo: `${data.titulo}`,
      link: `${data.link}`,
      descripcion: `${data.descripcion}`,
      prioridad: Number.parseInt(data.prioridad, 10),
    };

    try {
      const docRef = await addDoc(collection(db, 'transacciones'), transaccion);
      dispatch(nuevaTransaccionSuccess(`Transaccion agregada correctamente. ID: ${docRef.id}`));
    } catch (error) {
      dispatch(nuevaTransaccionError('No se ha podido agregar la transaccion'));
      console.log(error);
    }
  };
};

export const getTransacciones = (pagination, start) => {
  return async (dispatch, getState) => {
    dispatch(getTransaccionesProcess());

    try {
      let q;

      if (pagination === 'next') {
        q = query(
          collection(db, 'transacciones'),
          orderBy('fecha', 'desc'),
          limit(10),
          startAfter(start)
        );
      } else if (pagination === 'prev') {
        q = query(
          collection(db, 'transacciones'),
          orderBy('fecha', 'desc'),
          limitToLast(10),
          endBefore(start)
        );
      } else {
        q = query(
          collection(db, 'transacciones'),
          orderBy('fecha', 'desc'),
          limit(10)
        );
      }

      const querySnapshot = await getDocs(q);

      if (querySnapshot.size === 0) {
        dispatch(getTransaccionesError('No hay transacciones'));
      } else {
        const { page } = getState().transacciones;

        querySnapshot.docs.forEach((document, i) => {
          if (i === 0) dispatch(setFirstTransaccion(document));
          if (i === 9) dispatch(setLastTransaccion(document));
        });

        const arrayTransacciones = [];

        querySnapshot.forEach((documentSnapshot) => {
          const data = documentSnapshot.data();

          const transaccion = {
            id: documentSnapshot.id,
            ...data,
            fecha: moment(data.fecha.seconds * 1000).format('DD-MM-YYYY HH:mm'),
            userId: JSON.parse(data.external_reference.split('%22').join('"')).userId,
          };

          arrayTransacciones.push(transaccion);
        });

        dispatch(getTransaccionesSuccess(arrayTransacciones));
        dispatch(
          setPage(
            pagination === 'next'
              ? page + 1
              : pagination === 'prev'
              ? page - 1
              : page
          )
        );
      }
    } catch (error) {
      dispatch(getTransaccionesError('No se pudo traer las transacciones'));
      console.log(error);
    }
  };
};

export const getUserCuotas = (id) => {
  return async (dispatch) => {
    dispatch(getUserCuotasProcess());

    try {
      const docRef = doc(db, 'usuarios', id);
      const docSnap = await getDoc(docRef);

      let user;

      if (docSnap.exists()) {
        user = {
          id,
          ...docSnap.data(),
        };
      }

      const cuotasRef = collection(db, "usuarios", id, 'cuotas');
      const querySnapshot = await getDocs(cuotasRef);

      console.log(user);

      if (querySnapshot.size > 0) {
        const arrayCuotas = [];

        querySnapshot.forEach((documentSnapshot) => {
          const cuota = {
            id: documentSnapshot.id,
            ...documentSnapshot.data(),
          };
          arrayCuotas.push(cuota);
        });

        dispatch(getUserCuotasSuccess({ user, cuotas: arrayCuotas }));
      } else {
        dispatch(getUserCuotasError('No se ha podido cargar la información del usuario.'));
      }
    } catch (error) {
      dispatch(getUserCuotasError('No se ha podido cargar la información del usuario.'));
      console.log(error);
    }
  };
};

export const getTransaccion = (payload) => ({ type: types.GET_TRANSACCION, payload });

const nuevaTransaccionProcess = (payload) => ({ type: types.NUEVA_TRANSACCION, payload });
const nuevaTransaccionSuccess = (payload) => ({ type: types.NUEVA_TRANSACCION_SUCCESS, payload });
const nuevaTransaccionError = (payload) => ({ type: types.NUEVA_TRANSACCION_ERROR, payload });

const getTransaccionesProcess = (payload) => ({ type: types.GET_TRANSACCIONES, payload });
const getTransaccionesSuccess = (payload) => ({ type: types.GET_TRANSACCIONES_SUCCESS, payload });
const getTransaccionesError = (payload) => ({ type: types.GET_TRANSACCIONES_ERROR, payload });

const getUserCuotasProcess = (payload) => ({ type: types.GET_USER_CUOTAS, payload });
const getUserCuotasSuccess = (payload) => ({ type: types.GET_USER_CUOTAS_SUCCESS, payload });
const getUserCuotasError = (payload) => ({ type: types.GET_USER_CUOTAS_ERROR, payload });

const setFirstTransaccion = (payload) => ({ type: types.SET_FIRST_TRANSACCION, payload });
const setLastTransaccion = (payload) => ({ type: types.SET_LAST_TRANSACCION, payload });
const setPage = (payload) => ({ type: types.SET_PAGE_TRANSACCION, payload });

export const clearStatus = (payload) => ({ type: types.CLEAR_TRANSACCIONES_STATUS, payload });
export const clearTransacciones = (payload) => ({ type: types.CLEAR_TRANSACCIONES, payload });