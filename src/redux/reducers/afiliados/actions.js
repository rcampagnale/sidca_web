import types from './types'
import { db } from '../../../firebase/firebase-config';
import { collection, addDoc, query, where, getDocs, doc, deleteDoc, orderBy, startAfter, limit, endBefore, limitToLast, setDoc, getDoc, Timestamp } from "firebase/firestore";

const separarFechaYHora = (fechaStr) => {
    if (!fechaStr || typeof fechaStr !== 'string') return { fecha: '', hora: '' };

    const partes = fechaStr.split(' ');
    return {
        fecha: partes[0] || '',
        hora: partes[1] || ''
    };
};

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

                querySnapshot.forEach(doc => {
                    const data = doc.data();
                    const { fecha, hora } = separarFechaYHora(data.fecha);
                    let obj = {
                        id: doc.id,
                        apellido: data.apellido,
                        nombre: data.nombre,
                        dni: data.dni,
                        fecha,
                        hora,
                        email: data.email,
                        celular: data.celular,
                        establecimientos: data.establecimientos,
                        error: data.error,
                        departamento: data.departamento
                    };
                    arrayDocs.push(obj);
                });

                dispatch(getAFiliadosNuevosSuccess(arrayDocs));
                dispatch(setPage(
                    pagination === 'next' ? page + 1
                    : pagination === 'prev' ? page - 1
                    : page
                ));
            }
        } catch (error) {
            dispatch(getAfiliadosNuevosError('No se ha podido crear un nuevo afiliado'));
            console.log(error);
        }
    };
};


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

                querySnapshot.forEach(doc => {
                    const data = doc.data();
                    const { fecha, hora } = separarFechaYHora(data.fecha);
                    let obj = {
                        id: doc.id,
                        apellido: data.apellido,
                        nombre: data.nombre,
                        dni: data.dni,
                        fecha,
                        hora,
                        email: data.email,
                        celular: data.celular,
                        establecimientos: data.establecimientos,
                        error: data.error,
                        departamento: data.departamento
                    };
                    arrayDocs.push(obj);
                });

                // 🔽 Ordenar del más reciente al más antiguo
                arrayDocs.sort((a, b) => {
                    const fechaA = new Date(`${a.fecha} ${a.hora}`);
                    const fechaB = new Date(`${b.fecha} ${b.hora}`);
                    return fechaB - fechaA;
                });

                dispatch(descargarAFiliadosNuevosSuccess(arrayDocs));
            }
        } catch (error) {
            dispatch(descargarAfiliadosNuevosError('No se ha podido descargar la data de afiliados'));
            console.log(error);
        }
    };
};



export const deleteAfiliadosNuevos = (id) => {
    return async (dispatch, getState) => {
        dispatch(deleteAfiliadosNuevosProcess());
        try {
            await deleteDoc(doc(db, "nuevoAfiliado", id));
            dispatch(deleteAFiliadosNuevosSuccess(id))
        } catch (error) {
            dispatch(deleteAfiliadosNuevosError('No se eliminaron los datos'))
            console.log(error)
        }
    }
}

export const nuevoAfiliado = (data) => {
    return async (dispatch, getState) => {
        dispatch(newUserProcess());

        const hoy = new Date();
        const fechaFormateada = hoy.toLocaleDateString(); // Ej: "29/07/2025"
        const horaFormateada = hoy.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }); // Ej: "11:58"
        const fechaCompleta = `${fechaFormateada} ${horaFormateada}`;

        let user = {
            nombre: `${data.apellido}, ${data.nombre}`,
            dni: `${data.dni}`,
            fecha: fechaCompleta // ✅ se guarda la fecha con hora
        };

        try {
            const q = await query(collection(db, 'usuarios'), where('dni', '==', data.dni));
            const querySnapshot = await getDocs(q);

            if (querySnapshot.size === 0) {
                const doc = await addDoc(collection(db, 'usuarios'), user);
                dispatch(newUserSuccess(`Usuario agregado correctamente con el ID ${doc.id}`));
            } else if (querySnapshot.size > 0) {
                dispatch(newUserError('Ya existe un afiliado con esos datos'));
            } else {
                dispatch(newUserError('Ha habido un error, intentá de nuevo más tarde'));
            }
        } catch (error) {
            dispatch(newUserError('No se ha podido crear un nuevo afiliado'));
            console.log(error);
        }
    };
};


export const afiliacion = (data) => {
    return async (dispatch, getState) => {
        dispatch(afiliacionProcess());
        try {
            const qc = await doc(db, 'cod', 'cod');
            const cod = await getDoc(qc);
            const q = await query(collection(db, 'usuarios'), where('dni', '==', data.dni));
            const querySnapshot = await getDocs(q);

            if (querySnapshot.size === 0) {
                const hoy = new Date();
                const fechaFormateada = hoy.toLocaleDateString(); // Ej: 29/07/2025
                const horaFormateada = hoy.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }); // Ej: 12:05
                const fechaCompleta = `${fechaFormateada} ${horaFormateada}`;

                let user = {
                    nombre: data.nombre,
                    apellido: data.apellido,
                    dni: data.dni,
                    departamento: data.departamento,
                    celular: data.celular,
                    email: data.email,
                    establecimientos: data.establecimientos,
                    cod: Number(cod.data().ultimoCod) + 1,
                    fecha: fechaCompleta, // ✅ fecha como string con hora
                    cotizante: data.descuento
                };

                await addDoc(collection(db, 'nuevoAfiliado'), user);
                await addDoc(collection(db, 'usuarios'), user);
                await setDoc(qc, { ultimoCod: user.cod });

                dispatch(afiliacionSuccess(`Se ha registrado su afiliación. ¡Bienvenido a SiDCa! Ingrese con su DNI`));
            } else {
                dispatch(afiliacionError('Ya existe un afiliado con esos datos. Ingrese desde la pantalla principal'));
            }
        } catch (error) {
            dispatch(afiliacionError('No se ha podido afiliar, intentelo más tarde'));
            console.log(error);
        }
    };
};


export const getUser = (data) => {
    return async (dispatch, getState) => {
        dispatch(getUserProcess());
        try {
            const q = await query(collection(db, 'usuarios'), where('dni', '==', data.dni))
            const querySnapshot = await getDocs(q);
            if (querySnapshot.size > 0) {
                let users = [];
                querySnapshot.forEach(documentSnapshot => {
                    const nombreCompleto = documentSnapshot.data().nombre.split(', ')
                    const [apellido, nombre] = nombreCompleto
                    const user = {
                        id: documentSnapshot.id,
                        dni: documentSnapshot.data().dni,
                        nombre,
                        apellido
                    }
                    users.push(user)
                })
                dispatch(getUserSuccess(users));
            } else {
                dispatch(getUserError('DNI incorrecto'));
            }
        } catch (error) {
            dispatch(getUserError('No se ha ingresar'));
            console.log(error);
        }
    }
}

export const updateUser = (data, id) => {
    return async (dispatch, getState) => {
        dispatch(updateUserProcess());
        let userObj = {
            nombre: `${data.apellido}, ${data.nombre}`,
            dni: `${data.dni}`
        }
        try {
            const refDoc = doc(db, 'usuarios', id)
            const enlace = await setDoc(refDoc, userObj)
            dispatch(updateUserSuccess(`Enlace editado Correctamente. ID: ${id}`));
        } catch (error) {
            dispatch(updateUserError('No se ha podido editar el enlace'));
            console.log(error)
        }
    }
}

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
}

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
