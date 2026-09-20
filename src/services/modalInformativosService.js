import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  query,
  runTransaction,
  serverTimestamp,
  setDoc,
  where,
} from 'firebase/firestore';
import { auth, db } from '../firebase/firebase-config';

const COLECCION = 'modal_informativos';

const exigirId = (id) => {
  const valor = String(id || '').trim();
  if (!valor) throw new Error('El modal no tiene un identificador válido.');
  return valor;
};

const valorTexto = (valor) => (valor === null || valor === undefined ? '' : String(valor));

const normalizarModal = (snapshot) => ({
  id: snapshot.id,
  titulo: valorTexto(snapshot.data()?.titulo),
  descripcion: valorTexto(snapshot.data()?.descripcion),
  imagen: valorTexto(snapshot.data()?.imagen),
  link: valorTexto(snapshot.data()?.link),
  estado: snapshot.data()?.estado || 'borrador',
  creadoEn: snapshot.data()?.creadoEn || null,
  actualizadoEn: snapshot.data()?.actualizadoEn || null,
  activadoEn: snapshot.data()?.activadoEn || null,
  desactivadoEn: snapshot.data()?.desactivadoEn || null,
});

const datosComunes = ({ titulo, descripcion, imagen, link }) => ({
  titulo: titulo.trim(),
  descripcion: descripcion.trim(),
  imagen: imagen.trim(),
  link: link.trim(),
  actualizadoEn: serverTimestamp(),
  actualizadoPor: auth.currentUser?.uid || null,
});

export const listarModalInformativos = async () => {
  const snapshot = await getDocs(collection(db, COLECCION));
  return snapshot.docs
    .map(normalizarModal)
    .sort((a, b) => {
      const fechaA = a.actualizadoEn?.toMillis?.() || 0;
      const fechaB = b.actualizadoEn?.toMillis?.() || 0;
      return fechaB - fechaA;
    });
};

export const guardarBorradorModal = async ({ id, titulo, descripcion, imagen, link }) => {
  const referencia = id ? doc(db, COLECCION, exigirId(id)) : doc(collection(db, COLECCION));
  const payload = {
    ...datosComunes({ titulo, descripcion, imagen, link }),
    estado: 'borrador',
    activadoEn: null,
    desactivadoEn: null,
  };
  if (!id) {
    payload.creadoEn = serverTimestamp();
    payload.creadoPor = auth.currentUser?.uid || null;
  }
  await setDoc(referencia, payload, { merge: true });
  return referencia.id;
};

export const guardarYActivarModal = async ({ id, titulo, descripcion, imagen, link }) => {
  const modalId = id ? exigirId(id) : '';
  const referencia = modalId ? doc(db, COLECCION, modalId) : doc(collection(db, COLECCION));
  const activosSnapshot = await getDocs(query(collection(db, COLECCION), where('estado', '==', 'activo')));
  const activos = activosSnapshot.docs.map((activo) => ({ id: activo.id, referencia: activo.ref }));

  await runTransaction(db, async (transaction) => {
    if (modalId) {
      const modalSnapshot = await transaction.get(referencia);
      if (!modalSnapshot.exists()) {
        throw new Error('El modal seleccionado ya no existe.');
      }
    }

    activos.forEach((activo) => {
      if (activo.id !== referencia.id) {
        transaction.update(activo.referencia, {
          estado: 'inactivo',
          desactivadoEn: serverTimestamp(),
          actualizadoEn: serverTimestamp(),
        });
      }
    });

    const payload = {
      ...datosComunes({ titulo, descripcion, imagen, link }),
      estado: 'activo',
      activadoEn: serverTimestamp(),
      desactivadoEn: null,
    };
    if (!id) {
      payload.creadoEn = serverTimestamp();
      payload.creadoPor = auth.currentUser?.uid || null;
    }
    transaction.set(referencia, payload, { merge: true });
  });

  return referencia.id;
};

export const desactivarModal = async (id) => {
  await setDoc(doc(db, COLECCION, exigirId(id)), {
    estado: 'inactivo',
    desactivadoEn: serverTimestamp(),
    actualizadoEn: serverTimestamp(),
    actualizadoPor: auth.currentUser?.uid || null,
  }, { merge: true });
};

export const eliminarModal = async (id) => {
  await deleteDoc(doc(db, COLECCION, exigirId(id)));
};
