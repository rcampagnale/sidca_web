// actions.js
import types from './types'
import { db } from '../../../firebase/firebase-config';
import {
  collection,
  addDoc,
  query,
  where,
  getDocs,
  doc,
  deleteDoc,
  orderBy,
  startAfter,
  limit,
  endBefore,
  limitToLast,
  setDoc,
  getDoc,
  Timestamp
} from "firebase/firestore";

// -------------------------------
// Helpers
// -------------------------------
const separarFechaYHora = (fechaStr) => {
  if (!fechaStr || typeof fechaStr !== 'string') return { fecha: '', hora: '' };
  const partes = fechaStr.split(' ');
  return { fecha: partes[0] || '', hora: partes[1] || '' };
};

// Normaliza descuento para UI/export (prioriza string; si no hay, deriva de booleano 'cotizante')
const getDescuentoSiNo = (data) => {
  if (typeof data?.descuento === 'string') return data.descuento; // "si" | "no"
  if (typeof data?.cotizante === 'boolean') return data.cotizante ? 'si' : 'no';
  if (typeof data?.cotizante === 'string') return data.cotizante; // por si existe legacy como string
  return ""; // sin dato
};

// -------------------------------
// Afiliados nuevos (paginado)
// -------------------------------
export const getAfiliadosNuevos = (pagination, start) => {
  return async (dispatch, getState) => {
    dispatch(getAfiliadosNuevosProcess());
    try {
      let q;
      if (pagination === 'next') {
        q = await query(collection(db, 'nuevoAfiliado'), orderBy('fecha', 'desc'), limit(10), startAfter(start));
      } else if (pagination === 'prev') {
        q = await query(collection(db, 'nuevoAfiliado'), orderBy('fecha', 'desc'), limitToLast(10), endBefore(start));
      } else {
        q = await query(collection(db, 'nuevoAfiliado'), orderBy('fecha', 'desc'), limit(10));
      }

      const querySnapshot = await getDocs(q);
      if (querySnapshot.size === 0) {
        dispatch(getAfiliadosNuevosError('No hay afiliados nuevos'));
      } else {
        const { page } = getState().afiliado;
        const arrayDocs = [];

        const docs = querySnapshot.docs;
        if (docs.length > 0) {
          dispatch(setfirstAfiliado(docs[0]));
          dispatch(setLastAfiliado(docs[docs.length - 1]));
        }

        querySnapshot.forEach(docSnap => {
          const data = docSnap.data();
          const { fecha, hora } = separarFechaYHora(data.fecha);
          arrayDocs.push({
            id: docSnap.id,
            apellido: data.apellido,
            nombre: data.nombre,
            dni: data.dni,
            fecha,
            hora,
            email: data.email,
            celular: data.celular,
            establecimientos: data.establecimientos,
            error: data.error,
            departamento: data.departamento,
            nroAfiliacion: data.nroAfiliacion ?? 1,
            tituloGrado: data.tituloGrado || "",
            // ✅ ahora disponible normalizado
            descuento: getDescuentoSiNo(data),
          });
        });

        dispatch(getAFiliadosNuevosSuccess(arrayDocs));
        dispatch(setPage(
          pagination === 'next' ? page + 1
            : pagination === 'prev' ? page - 1
              : page
        ));
      }
    } catch (error) {
      dispatch(getAfiliadosNuevosError('No se pudieron cargar los afiliados nuevos'));
      console.log(error);
    }
  };
};

// -------------------------------
// Descargar afiliados nuevos (todo)
// -------------------------------
export const descargarAfiliadosNuevos = () => {
  return async (dispatch, getState) => {
    dispatch(descargarAfiliadosNuevosProcess());
    try {
      let q = await query(collection(db, 'nuevoAfiliado'), orderBy('fecha', 'desc'));
      const querySnapshot = await getDocs(q);
      if (querySnapshot.size === 0) {
        dispatch(descargarAfiliadosNuevosError('No hay afiliados nuevos'));
      } else {
        let arrayDocs = [];

        querySnapshot.forEach(docSnap => {
          const data = docSnap.data();
          const { fecha, hora } = separarFechaYHora(data.fecha);
          arrayDocs.push({
            id: docSnap.id,
            apellido: data.apellido,
            nombre: data.nombre,
            dni: data.dni,
            fecha,
            hora,
            email: data.email,
            celular: data.celular,
            establecimientos: data.establecimientos,
            error: data.error,
            departamento: data.departamento,
            nroAfiliacion: data.nroAfiliacion ?? 1,
            tituloGrado: data.tituloGrado || "",
            // ✅ normalizado para export
            descuento: getDescuentoSiNo(data),
          });
        });

        // del más reciente al más antiguo
        arrayDocs.sort((a, b) => {
          const fechaA = new Date(`${a.fecha} ${a.hora}`);
          const fechaB = new Date(`${b.fecha} ${b.hora}`);
          return fechaB - fechaA;
        });

        dispatch(descargarAFiliadosNuevosSuccess(arrayDocs));
      }
    } catch (error) {
      dispatch(descargarAfiliadosNuevosError('No se pudo descargar la data de afiliados'));
      console.log(error);
    }
  };
};

// -------------------------------
// Eliminar un registro de "nuevoAfiliado" por id (individual)
// -------------------------------
export const deleteAfiliadosNuevos = (id) => {
  return async (dispatch, getState) => {
    dispatch(deleteAfiliadosNuevosProcess());
    try {
      await deleteDoc(doc(db, "nuevoAfiliado", id));
      dispatch(deleteAFiliadosNuevosSuccess(id))
    } catch (error) {
      dispatch(deleteAfiliadosNuevosError('No se eliminaron los datos de nuevoAfiliado'))
      console.log(error)
    }
  }
};

// -------------------------------
// Crear nuevo afiliado básico en "usuarios" (se mantiene igual)
// -------------------------------
export const nuevoAfiliado = (data) => {
  return async (dispatch, getState) => {
    dispatch(newUserProcess());

    const hoy = new Date();
    const fechaFormateada = hoy.toLocaleDateString();
    const horaFormateada = hoy.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const fechaCompleta = `${fechaFormateada} ${horaFormateada}`;

    let user = {
      nombre: `${data.apellido}, ${data.nombre}`,
      dni: `${data.dni}`,
      fecha: fechaCompleta
    };

    try {
      const q = await query(collection(db, 'usuarios'), where('dni', '==', data.dni));
      const querySnapshot = await getDocs(q);

      if (querySnapshot.size === 0) {
        const docRef = await addDoc(collection(db, 'usuarios'), user);
        dispatch(newUserSuccess(`Usuario agregado correctamente con el ID ${docRef.id}`));
      } else if (querySnapshot.size > 0) {
        dispatch(newUserError('Ya existe un afiliado con esos datos'));
      } else {
        dispatch(newUserError('Ha habido un error, intentá de nuevo más tarde'));
      }
    } catch (error) {
      dispatch(newUserError('No se pudo crear el nuevo afiliado'));
      console.log(error);
    }
  };
};

// -------------------------------
// Afiliación (reafiliaciones contabilizadas)
// -------------------------------
export const afiliacion = (data) => {
  return async (dispatch, getState) => {
    dispatch(afiliacionProcess());
    try {
      // 1) Verificar si el usuario YA EXISTE en "usuarios"
      const qUser = await query(collection(db, 'usuarios'), where('dni', '==', data.dni));
      const qUserSnap = await getDocs(qUser);

      if (qUserSnap.size > 0) {
        return dispatch(afiliacionError('Este DNI ya está afiliado. Descargá la app e ingresá con tu DNI, o bien comunícate con el Admonistrador del Sindicato.'));
      }

      // 2) Contar reafiliaciones previas
      const qReaf = await query(collection(db, 'nuevoAfiliado'), where('dni', '==', data.dni));
      const prev = await getDocs(qReaf);
      const nroAfiliacion = prev.size + 1; // 1=primera, 2=segunda, etc.

      const hoy = new Date();
      const fechaFormateada = hoy.toLocaleDateString();
      const horaFormateada = hoy.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      const fechaCompleta = `${fechaFormateada} ${horaFormateada}`;

      // ✅ Guardamos ambos: 'descuento' (si/no) y 'cotizante' (boolean) por compatibilidad
      const descuentoSiNo = data.descuento ? 'si' : 'no';

      const user = {
        nombre: data.nombre,
        apellido: data.apellido,
        dni: data.dni,
        departamento: data.departamento,
        celular: data.celular,
        email: data.email,
        establecimientos: data.establecimientos,
        fecha: fechaCompleta,
        // antes: cotizante: data.descuento
        descuento: descuentoSiNo,          // <-- lo que pediste
        cotizante: !!data.descuento,       // <-- legacy/compat
        nroAfiliacion,
        tituloGrado: data.tituloGrado?.trim() || "",
      };

      // 3) Registrar SIEMPRE una nueva fila en "nuevoAfiliado"
      await addDoc(collection(db, 'nuevoAfiliado'), user);

      // 4) Crear en "usuarios" SOLO si no existe (minimalista)
      if (qUserSnap.size === 0) {
        await addDoc(collection(db, 'usuarios'), {
          nombre: `${data.apellido}, ${data.nombre}`,
          dni: `${data.dni}`,
          fecha: fechaCompleta
        });
      }

      const msg = nroAfiliacion === 1
        ? 'Afiliación registrada. ¡Bienvenido a SiDCa! Ingrese con su DNI'
        : `Reafiliación registrada (n° ${nroAfiliacion}).`;

      dispatch(afiliacionSuccess(msg));
    } catch (error) {
      dispatch(afiliacionError('No se pudo procesar la afiliación, inténtelo más tarde'));
      console.log(error);
    }
  };
};

// -------------------------------
// Buscar usuario por DNI
// -------------------------------
export const getUser = (data) => {
  return async (dispatch, getState) => {
    dispatch(getUserProcess());
    try {
      const q = await query(collection(db, 'usuarios'), where('dni', '==', data.dni))
      const querySnapshot = await getDocs(q);
      if (querySnapshot.size > 0) {
        let users = [];
        querySnapshot.forEach(documentSnapshot => {
          const nombreCompleto = documentSnapshot.data().nombre?.split(', ') || [];
          const [apellido = '', nombre = ''] = nombreCompleto;
          users.push({
            id: documentSnapshot.id,
            dni: documentSnapshot.data().dni,
            nombre,
            apellido
          });
        });
        dispatch(getUserSuccess(users));
      } else {
        dispatch(getUserError('DNI incorrecto'));
      }
    } catch (error) {
      dispatch(getUserError('No se pudo ingresar'));
      console.log(error);
    }
  }
};

// -------------------------------
// Actualizar usuario en "usuarios"
// -------------------------------
export const updateUser = (data, id) => {
  return async (dispatch, getState) => {
    dispatch(updateUserProcess());
    let userObj = {
      nombre: `${data.apellido}, ${data.nombre}`,
      dni: `${data.dni}`
    }
    try {
      const refDoc = doc(db, 'usuarios', id)
      await setDoc(refDoc, userObj)
      dispatch(updateUserSuccess(`Usuario editado correctamente. ID: ${id}`));
    } catch (error) {
      dispatch(updateUserError('No se pudo editar el usuario'));
      console.log(error)
    }
  }
};

// -------------------------------
// Eliminar SOLO en "usuarios"
// -------------------------------
export const deleteUser = (id) => {
  return async (dispatch, getState) => {
    dispatch(deleteUserProcess());
    try {
      await deleteDoc(doc(db, "usuarios", id));
      dispatch(deleteUserSuccess(id))
    } catch (error) {
      dispatch(deleteUserError('No se eliminaron los datos'))
      console.log(error)
    }
  }
};

// -------------------------------
// Action creators (sync)
// -------------------------------
const getAfiliadosNuevosProcess = (payload) => ({ type: types.GET_AFILIADOS_NUEVOS, payload })
const getAFiliadosNuevosSuccess = (payload) => ({ type: types.GET_AFILIADOS_NUEVOS_SUCCESS, payload })
const getAfiliadosNuevosError = (payload) => ({ type: types.GET_AFILIADOS_NUEVOS_ERROR, payload })

const descargarAfiliadosNuevosProcess = (payload) => ({ type: types.DESCARGAR_AFILIADOS_NUEVOS, payload })
const descargarAFiliadosNuevosSuccess = (payload) => ({ type: types.DESCARGAR_AFILIADOS_NUEVOS_SUCCESS, payload })
const descargarAfiliadosNuevosError = (payload) => ({ type: types.DESCARGAR_AFILIADOS_NUEVOS_ERROR, payload })

const deleteAfiliadosNuevosProcess = (payload) => ({ type: types.DELETE_AFILIADOS_NUEVOS, payload })
const deleteAFiliadosNuevosSuccess = (payload) => ({ type: types.DELETE_AFILIADOS_NUEVOS_SUCCESS, payload })
const deleteAfiliadosNuevosError = (payload) => ({ type: types.DELETE_AFILIADOS_NUEVOS_ERROR, payload })

const deleteUserProcess = (payload) => ({ type: types.DELETE_USER, payload })
const deleteUserSuccess = (payload) => ({ type: types.DELETE_USER_SUCCESS, payload })
const deleteUserError = (payload) => ({ type: types.DELETE_USER_ERROR, payload })

const newUserProcess = (payload) => ({ type: types.NEW_USER, payload })
const newUserSuccess = (payload) => ({ type: types.NEW_USER_SUCCESS, payload })
const newUserError = (payload) => ({ type: types.NEW_USER_ERROR, payload })

const afiliacionProcess = (payload) => ({ type: types.AFILIACION, payload })
const afiliacionSuccess = (payload) => ({ type: types.AFILIACION_SUCCESS, payload })
const afiliacionError = (payload) => ({ type: types.AFILIACION_ERROR, payload })

const getUserProcess = (payload) => ({ type: types.GET_USER, payload })
const getUserSuccess = (payload) => ({ type: types.GET_USER_SUCCESS, payload })
const getUserError = (payload) => ({ type: types.GET_USER_ERROR, payload })

export const setUserEdit = (payload) => ({ type: types.SET_USER_EDIT, payload })

const updateUserProcess = (payload) => ({ type: types.UPDATE_USER, payload })
const updateUserSuccess = (payload) => ({ type: types.UPDATE_USER_SUCCESS, payload })
const updateUserError = (payload) => ({ type: types.UPDATE_USER_ERROR, payload })

const setfirstAfiliado = (payload) => ({ type: types.SET_FIRST_AFILIADO, payload })
const setLastAfiliado = (payload) => ({ type: types.SET_LAST_AFILIADO, payload })
const setPage = (payload) => ({ type: types.SET_PAGE_AFILIADO, payload })

export const setNuevoAfiliadoDetails = (payload) => ({ type: types.SET_NUEVO_AFILIADO_DETAILS, payload })
export const clearStatus = (payload) => ({ type: types.CLEAR_AFILIADOS_STATUS, payload })
export const clearDownload = (payload) => ({ type: types.CLEAR_DOWNLOAD, payload })

export const clearAfiliados = (payload) => ({ type: types.CLEAR_AFILIADOS, payload })
