import {
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
  setDoc,
  where,
  writeBatch,
} from "firebase/firestore";
import { db } from "../firebase/firebase-config";
import {
  obtenerDatosEventoPredeterminadosCena,
} from "./gestionCenaCardLayout";

export { formatearDniCena, obtenerDatosEventoCena } from "./gestionCenaCardLayout";

export const GESTION_CENA_COLLECTION = "gestion_cena";

export const normalizarDniCena = (valor) => String(valor || "").replace(/\D/g, "");

const limpiarTexto = (valor) => String(valor || "").trim();

const upper = (valor) => limpiarTexto(valor).toUpperCase();

const anoId = (anio) => String(Number(anio) || new Date().getFullYear());

const anualRef = (anio) => doc(db, GESTION_CENA_COLLECTION, anoId(anio));
const reservasRef = (anio) => collection(db, GESTION_CENA_COLLECTION, anoId(anio), "reservas");
const tarjetasRef = (anio) => collection(db, GESTION_CENA_COLLECTION, anoId(anio), "tarjetas");
const validacionesRef = (anio) => collection(db, GESTION_CENA_COLLECTION, anoId(anio), "validaciones");
const contadoresRef = (anio) => collection(db, GESTION_CENA_COLLECTION, anoId(anio), "contadores");
const contadorRef = (anio) => doc(db, GESTION_CENA_COLLECTION, anoId(anio), "contadores", "tarjetas");

export const esTarjetaVigenteCena = (tarjeta) => Boolean(tarjeta) && tarjeta.anulada !== true && tarjeta.reemplazada !== true;

export const estaTarjetaAcreditadaCena = (tarjeta) => (
  esTarjetaVigenteCena(tarjeta) && (tarjeta.validada === true || tarjeta.estado === "validada")
);

export const resumirTarjetasVigentesCena = (tarjetas = []) => {
  const vigentes = tarjetas.filter(esTarjetaVigenteCena);
  const acreditadas = vigentes.filter(estaTarjetaAcreditadaCena).length;
  const pendientes = vigentes.filter((tarjeta) => !estaTarjetaAcreditadaCena(tarjeta) && String(tarjeta.estado || "pendiente") === "pendiente").length;
  return { vigentes, total: vigentes.length, acreditadas, pendientes };
};

export const estadoAcreditacionReservaCena = (reserva, tarjetas = []) => {
  if (reserva?.estado === "anulada") return "ANULADA";
  const resumen = resumirTarjetasVigentesCena(tarjetas);
  if (!resumen.total || resumen.acreditadas === 0) return "SIN ACREDITAR";
  if (resumen.acreditadas === resumen.total) return "ACREDITADA";
  return "PARCIAL";
};

const dniCampos = ["dni", "DNI", "documento", "Documento", "cuil", "CUIL", "cuit", "CUIT"];
const nombreCampos = ["nombre", "nombres", "Nombre", "Nombres"];
const apellidoCampos = ["apellido", "apellidos", "Apellido", "Apellidos"];

const primerValor = (data, campos) => {
  for (const campo of campos) {
    if (data?.[campo] !== undefined && data?.[campo] !== null && String(data[campo]).trim()) {
      return data[campo];
    }
  }
  return "";
};

const afiliadoDesdeDoc = (docSnap, dniBuscado, origen) => {
  const data = docSnap.data() || {};
  const dni = normalizarDniCena(primerValor(data, dniCampos) || docSnap.id || dniBuscado);
  const apellidoNombre =
    data.apellidoNombre ||
    data.nombreCompleto ||
    data.apellido_y_nombre ||
    data["Apellido y Nombre"] ||
    "";
  let apellido = primerValor(data, apellidoCampos);
  let nombre = primerValor(data, nombreCampos);

  if ((!apellido || !nombre) && apellidoNombre) {
    const partes = String(apellidoNombre).split(",");
    if (partes.length > 1) {
      apellido = apellido || partes[0];
      nombre = nombre || partes.slice(1).join(" ");
    } else {
      nombre = nombre || apellidoNombre;
    }
  }

  return {
    dni,
    apellido: upper(apellido),
    nombre: upper(nombre),
    apellidoNombre: upper(`${apellido} ${nombre}`.trim() || apellidoNombre),
    origen,
    docId: docSnap.id,
  };
};

const buscarEnColeccion = async (nombreColeccion, dni) => {
  const directo = await getDoc(doc(db, nombreColeccion, dni));
  if (directo.exists()) return afiliadoDesdeDoc(directo, dni, nombreColeccion);

  for (const campo of dniCampos) {
    const snap = await getDocs(query(collection(db, nombreColeccion), where(campo, "==", dni), limit(1)));
    if (!snap.empty) return afiliadoDesdeDoc(snap.docs[0], dni, nombreColeccion);

    const numero = Number(dni);
    if (!Number.isNaN(numero)) {
      const snapNumero = await getDocs(query(collection(db, nombreColeccion), where(campo, "==", numero), limit(1)));
      if (!snapNumero.empty) return afiliadoDesdeDoc(snapNumero.docs[0], dni, nombreColeccion);
    }
  }

  return null;
};

export const buscarAfiliadoCenaPorDni = async (valor) => {
  const dni = normalizarDniCena(valor);
  if (!dni) return null;
  const enUsuarios = await buscarEnColeccion("usuarios", dni);
  if (enUsuarios) return enUsuarios;
  return buscarEnColeccion("nuevoAfiliado", dni);
};

export const asegurarEdicionCena = async (anio) => {
  const ref = anualRef(anio);
  const snap = await getDoc(ref);
  if (snap.exists()) return { id: snap.id, ...snap.data() };

  const data = {
    anio: Number(anio),
    ...obtenerDatosEventoPredeterminadosCena(anio),
    activo: true,
    fechaCreacion: serverTimestamp(),
    fechaActualizacion: serverTimestamp(),
  };
  await setDoc(ref, data);
  return { id: ref.id, ...data };
};

export const guardarDatosEventoCena = async (anio, datos = {}) => {
  const base = obtenerDatosEventoPredeterminadosCena(anio);
  const configuracion = Object.keys(base).reduce((resultado, campo) => {
    resultado[campo] = limpiarTexto(datos[campo]);
    return resultado;
  }, {});

  await setDoc(anualRef(anio), {
    anio: Number(anio),
    ...configuracion,
    fechaActualizacion: serverTimestamp(),
  }, { merge: true });
};

export const cargarGestionCena = async (anio) => {
  const edicion = await asegurarEdicionCena(anio);
  const [reservasSnap, tarjetasSnap] = await Promise.all([
    getDocs(query(reservasRef(anio), orderBy("fechaCreacion", "desc"))),
    getDocs(query(tarjetasRef(anio), orderBy("numeroTarjeta", "asc"))),
  ]);

  return {
    edicion,
    reservas: reservasSnap.docs.map((item) => ({ id: item.id, ...item.data() })),
    tarjetas: tarjetasSnap.docs.map((item) => ({ id: item.id, ...item.data() })),
  };
};

export const suscribirGestionCena = (anio, onCambio, onError) => {
  const estado = { edicion: null, reservas: [], tarjetas: [] };
  const notificar = () => onCambio({ ...estado });
  const reportarError = (error) => {
    if (onError) onError(error);
  };

  const desuscripciones = [
    onSnapshot(anualRef(anio), (snap) => {
      estado.edicion = snap.exists() ? { id: snap.id, ...snap.data() } : null;
      notificar();
    }, reportarError),
    onSnapshot(query(reservasRef(anio), orderBy("fechaCreacion", "desc")), (snap) => {
      estado.reservas = snap.docs.map((item) => ({ id: item.id, ...item.data() }));
      notificar();
    }, reportarError),
    onSnapshot(query(tarjetasRef(anio), orderBy("numeroTarjeta", "asc")), (snap) => {
      estado.tarjetas = snap.docs.map((item) => ({ id: item.id, ...item.data() }));
      notificar();
    }, reportarError),
  ];

  return () => desuscripciones.forEach((desuscribir) => desuscribir());
};

export const obtenerResumenVaciadoGestionCena = async (anio) => {
  const [reservasSnap, tarjetasSnap, validacionesSnap, contadoresSnap] = await Promise.all([
    getDocs(reservasRef(anio)),
    getDocs(tarjetasRef(anio)),
    getDocs(validacionesRef(anio)),
    getDocs(contadoresRef(anio)),
  ]);

  return {
    reservas: reservasSnap.size,
    tarjetas: tarjetasSnap.size,
    validaciones: validacionesSnap.size,
    contadores: contadoresSnap.size,
    acreditadas: tarjetasSnap.docs.filter((item) => item.data()?.validada).length,
  };
};

const borrarColeccionPorLotes = async (ref, tamanoLote = 400) => {
  let eliminados = 0;

  while (true) {
    const snap = await getDocs(query(ref, limit(tamanoLote)));
    if (snap.empty) return eliminados;

    const batch = writeBatch(db);
    snap.docs.forEach((item) => batch.delete(item.ref));
    await batch.commit();
    eliminados += snap.size;
  }
};

export const vaciarGestionCenaAnio = async (anio) => {
  // Estas son todas las subcolecciones operativas creadas por Gestión Cena.
  // El documento anual se conserva para mantener configurada la edición.
  await asegurarEdicionCena(anio);
  const reservasEliminadas = await borrarColeccionPorLotes(reservasRef(anio));
  const tarjetasEliminadas = await borrarColeccionPorLotes(tarjetasRef(anio));
  const validacionesEliminadas = await borrarColeccionPorLotes(validacionesRef(anio));
  const contadoresEliminados = await borrarColeccionPorLotes(contadoresRef(anio));

  await setDoc(anualRef(anio), {
    fechaActualizacion: serverTimestamp(),
  }, { merge: true });

  return { reservasEliminadas, tarjetasEliminadas, validacionesEliminadas, contadoresEliminados };
};

export const buscarReservaPorDni = async (anio, dniValor) => {
  const dni = normalizarDniCena(dniValor);
  if (!dni) return null;
  const snap = await getDocs(query(reservasRef(anio), where("afiliado.dni", "==", dni), limit(1)));
  return snap.empty ? null : { id: snap.docs[0].id, ...snap.docs[0].data() };
};

const crearToken = () => {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  const valores = new Uint32Array(4);
  if (typeof crypto !== "undefined" && crypto.getRandomValues) crypto.getRandomValues(valores);
  return `${Date.now().toString(36)}-${Array.from(valores).map((v) => v.toString(36)).join("-")}`;
};

const codigoVisible = (anio, numero) => `CENA-${anio}-${String(numero).padStart(6, "0")}`;

const tarjetaPayload = ({ anio, reservaId, reserva, numeroTarjeta, correlativo }) => {
  const total = Number(reserva.cantidadTarjetas || 1);
  const totalAcompanantes = Math.max(0, total - 1);
  const esTitular = numeroTarjeta === 1;

  return {
    anio: Number(anio),
    reservaId,
    token: crearToken(),
    codigoVisible: codigoVisible(anio, correlativo),
    tipo: esTitular ? "titular" : "acompanante",
    numeroTarjeta,
    numeroAcompanante: esTitular ? null : numeroTarjeta - 1,
    totalAcompanantes,
    afiliadoDni: reserva.afiliado.dni,
    afiliadoApellido: reserva.afiliado.apellido,
    afiliadoNombre: reserva.afiliado.nombre,
    estado: "pendiente",
    validada: false,
    anulada: false,
    fechaValidacion: null,
    validadoPor: null,
    fechaCreacion: serverTimestamp(),
  };
};

const normalizarReservaInput = ({ anio, afiliado, cantidadTarjetas }) => {
  const cantidad = Math.max(1, Number(cantidadTarjetas || 1));
  return {
    anio: Number(anio),
    afiliado: {
      dni: normalizarDniCena(afiliado?.dni),
      apellido: upper(afiliado?.apellido),
      nombre: upper(afiliado?.nombre),
    },
    cantidadTarjetas: cantidad,
    cantidadTitular: 1,
    cantidadAcompanantes: Math.max(0, cantidad - 1),
    estado: "activa",
    tarjetasGeneradas: false,
    estadoGeneracionTarjetas: "pendiente",
    errorGeneracionTarjetas: null,
  };
};

export const guardarReservaCena = async ({ anio, afiliado, cantidadTarjetas, reservaId = null }) => {
  const payload = normalizarReservaInput({ anio, afiliado, cantidadTarjetas });
  if (!payload.afiliado.dni || !payload.afiliado.apellido || !payload.afiliado.nombre) {
    throw new Error("Completá un afiliado válido antes de guardar.");
  }

  return runTransaction(db, async (transaction) => {
    await transaction.get(anualRef(anio));
    const id = reservaId || payload.afiliado.dni;
    const ref = doc(reservasRef(anio), id);
    const snap = await transaction.get(ref);

    if (!reservaId && snap.exists() && snap.data()?.estado !== "anulada") {
      throw Object.assign(new Error(`Este afiliado ya posee una reserva para la Cena ${anio}`), {
        code: "reserva-duplicada",
        reserva: { id: snap.id, ...snap.data() },
      });
    }

    transaction.set(
      ref,
      {
        ...payload,
        ...(snap.exists() ? { fechaActualizacion: serverTimestamp() } : { fechaCreacion: serverTimestamp(), fechaActualizacion: serverTimestamp() }),
      },
      { merge: true }
    );

    transaction.set(anualRef(anio), { fechaActualizacion: serverTimestamp() }, { merge: true });
    return { id, ...payload };
  });
};

const detalleErrorGeneracion = (error) => String(error?.message || "No se pudieron generar las tarjetas.").slice(0, 500);

export const crearReservaImportadaConTarjetasCena = async ({ anio, afiliado, cantidadTarjetas }) => {
  const reserva = normalizarReservaInput({ anio, afiliado, cantidadTarjetas });
  if (!reserva.afiliado.dni || !reserva.afiliado.apellido || !reserva.afiliado.nombre) {
    throw new Error("La fila no contiene una identidad válida.");
  }

  // Una transacción Firestore admite hasta 500 escrituras; dejamos margen para
  // reserva, contador y edición anual sin partir una reserva en operaciones.
  if (reserva.cantidadTarjetas > 450) {
    throw new Error("La reserva supera el máximo de 450 tarjetas para una importación atómica.");
  }

  return runTransaction(db, async (transaction) => {
    const reservaRef = doc(reservasRef(anio), reserva.afiliado.dni);
    const [reservaSnap, contadorSnap] = await Promise.all([
      transaction.get(reservaRef),
      transaction.get(contadorRef(anio)),
    ]);

    if (reservaSnap.exists()) {
      throw Object.assign(new Error(`Este afiliado ya posee una reserva para la Cena ${anio}`), {
        code: "reserva-duplicada",
        reserva: { id: reservaSnap.id, ...reservaSnap.data() },
      });
    }

    let correlativo = Number(contadorSnap.data()?.ultimo || 0);
    const tarjetas = [];
    for (let numeroTarjeta = 1; numeroTarjeta <= reserva.cantidadTarjetas; numeroTarjeta += 1) {
      correlativo += 1;
      tarjetas.push(tarjetaPayload({ anio, reservaId: reserva.afiliado.dni, reserva, numeroTarjeta, correlativo }));
    }

    transaction.set(reservaRef, {
      ...reserva,
      tarjetasGeneradas: true,
      estadoGeneracionTarjetas: "completa",
      errorGeneracionTarjetas: null,
      fechaCreacion: serverTimestamp(),
      fechaActualizacion: serverTimestamp(),
    });
    tarjetas.forEach((tarjeta) => transaction.set(doc(tarjetasRef(anio), tarjeta.token), tarjeta));
    transaction.set(contadorRef(anio), { ultimo: correlativo, fechaActualizacion: serverTimestamp() }, { merge: true });
    transaction.set(anualRef(anio), { fechaActualizacion: serverTimestamp() }, { merge: true });

    return { id: reservaRef.id, reserva, tarjetasCreadas: tarjetas.length };
  });
};

export const sincronizarTarjetasReserva = async ({ anio, reservaId }) => {
  const reservaRef = doc(reservasRef(anio), reservaId);

  try {
    const existentesSnap = await getDocs(query(tarjetasRef(anio), where("reservaId", "==", reservaId)));
    const referenciasExistentes = existentesSnap.docs.map((item) => item.ref);

    return await runTransaction(db, async (transaction) => {
      const reservaSnap = await transaction.get(reservaRef);
      if (!reservaSnap.exists()) throw new Error("No se encontró la reserva.");
      const reserva = { id: reservaSnap.id, ...reservaSnap.data() };

      const existentes = [];
      for (const ref of referenciasExistentes) {
        const itemSnap = await transaction.get(ref);
        if (itemSnap.exists()) existentes.push({ id: itemSnap.id, ...itemSnap.data(), ref });
      }
      const deseadas = Number(reserva.cantidadTarjetas || 1);
      const activas = existentes.filter(esTarjetaVigenteCena);
      const maxNumero = existentes.reduce((max, item) => Math.max(max, Number(item.numeroTarjeta || 0)), 0);
      const contadorSnap = await transaction.get(contadorRef(anio));
      const ultimo = Number(contadorSnap.data()?.ultimo || 0);

      activas
        .filter((item) => Number(item.numeroTarjeta || 0) > deseadas)
        .forEach((item) => {
          transaction.update(item.ref, {
            estado: "anulada",
            anulada: true,
            fechaAnulacion: serverTimestamp(),
            motivoAnulacion: "reduccion_reserva",
          });
        });

      const faltantes = [];
      for (let numero = maxNumero + 1; numero <= deseadas; numero += 1) faltantes.push(numero);
      let correlativo = ultimo;

      faltantes.forEach((numeroTarjeta) => {
        correlativo += 1;
        const payload = tarjetaPayload({ anio, reservaId, reserva, numeroTarjeta, correlativo });
        transaction.set(doc(tarjetasRef(anio), payload.token), payload);
      });

      if (faltantes.length) {
        transaction.set(contadorRef(anio), { ultimo: correlativo, fechaActualizacion: serverTimestamp() }, { merge: true });
      }

      transaction.update(reservaRef, {
        tarjetasGeneradas: true,
        estadoGeneracionTarjetas: "completa",
        errorGeneracionTarjetas: null,
        fechaActualizacion: serverTimestamp(),
      });
      return { creadas: faltantes.length, anuladas: Math.max(0, activas.length - deseadas) };
    });
  } catch (error) {
    try {
      const reservaSnap = await getDoc(reservaRef);
      if (reservaSnap.exists()) {
        await setDoc(reservaRef, {
          tarjetasGeneradas: false,
          estadoGeneracionTarjetas: "error",
          errorGeneracionTarjetas: detalleErrorGeneracion(error),
          fechaActualizacion: serverTimestamp(),
        }, { merge: true });
      }
    } catch (marcaError) {
      // Si Firestore también rechaza la marca, se conserva el error original.
    }
    throw error;
  }
};

export const anularReservaCena = async ({ anio, reservaId, usuario = null }) => {
  const tarjetasSnap = await getDocs(query(tarjetasRef(anio), where("reservaId", "==", reservaId)));
  const referenciasTarjetas = tarjetasSnap.docs.map((item) => item.ref);

  return runTransaction(db, async (transaction) => {
    const reservaRef = doc(reservasRef(anio), reservaId);
    const reservaSnap = await transaction.get(reservaRef);
    if (!reservaSnap.exists()) throw new Error("No se encontró la reserva.");

    let acreditadas = 0;
    const tarjetasLeidas = [];
    for (const ref of referenciasTarjetas) {
      const item = await transaction.get(ref);
      if (!item.exists()) continue;
      tarjetasLeidas.push({ ref, data: item.data() });
    }

    tarjetasLeidas.forEach(({ ref, data }) => {
      if (data.validada) acreditadas += 1;
      if (!data.validada && !data.anulada) {
        transaction.update(ref, {
          estado: "anulada",
          anulada: true,
          fechaAnulacion: serverTimestamp(),
          motivoAnulacion: "anulacion_reserva",
          anuladaPor: usuario,
        });
      }
    });

    transaction.update(reservaRef, { estado: "anulada", fechaAnulacion: serverTimestamp(), fechaActualizacion: serverTimestamp() });
    return { acreditadas };
  });
};

export const anularTarjetaCena = async ({ anio, tarjetaId, motivo, observacion = "", usuario = null }) => {
  const tarjetaRef = doc(tarjetasRef(anio), tarjetaId);

  return runTransaction(db, async (transaction) => {
    const tarjetaSnap = await transaction.get(tarjetaRef);
    if (!tarjetaSnap.exists()) {
      throw Object.assign(new Error("No se encontró la tarjeta."), { code: "tarjeta-no-encontrada" });
    }

    const tarjeta = tarjetaSnap.data();
    if (tarjeta.anulada) {
      throw Object.assign(new Error("TARJETA YA ANULADA"), { code: "tarjeta-ya-anulada" });
    }
    if (tarjeta.validada) {
      throw Object.assign(new Error("TARJETA YA ACREDITADA"), { code: "tarjeta-ya-acreditada" });
    }

    transaction.update(tarjetaRef, {
      estado: "anulada",
      anulada: true,
      fechaAnulacion: serverTimestamp(),
      motivoAnulacion: limpiarTexto(motivo),
      observacionAnulacion: limpiarTexto(observacion) || null,
      anuladaPor: usuario || null,
      fechaActualizacion: serverTimestamp(),
    });

    return {
      id: tarjetaSnap.id,
      ...tarjeta,
      estado: "anulada",
      anulada: true,
    };
  });
};

export const reemitirTarjetaCena = async ({ anio, tarjetaId, usuario = null }) => {
  const tarjetaAnteriorRef = doc(tarjetasRef(anio), tarjetaId);

  return runTransaction(db, async (transaction) => {
    const [tarjetaAnteriorSnap, contadorSnap] = await Promise.all([
      transaction.get(tarjetaAnteriorRef),
      transaction.get(contadorRef(anio)),
    ]);

    if (!tarjetaAnteriorSnap.exists()) {
      throw Object.assign(new Error("No se encontró la tarjeta."), { code: "tarjeta-no-encontrada" });
    }

    const anterior = tarjetaAnteriorSnap.data();
    if (!anterior.anulada) {
      throw Object.assign(new Error("Sólo se pueden reemitir tarjetas anuladas."), { code: "tarjeta-no-anulada" });
    }
    if (anterior.validada) {
      throw Object.assign(new Error("TARJETA YA ACREDITADA"), { code: "tarjeta-ya-acreditada" });
    }
    if (anterior.reemplazada || anterior.reemplazadaPor) {
      throw Object.assign(new Error("ESTA TARJETA YA FUE REEMITIDA"), { code: "tarjeta-ya-reemitida" });
    }

    const correlativo = Number(contadorSnap.data()?.ultimo || 0) + 1;
    const token = crearToken();
    const nuevaTarjetaRef = doc(tarjetasRef(anio), token);
    const numeroReemision = Number(anterior.numeroReemision || 0) + 1;
    const nuevaTarjeta = {
      anio: Number(anterior.anio || anio),
      reservaId: anterior.reservaId,
      token,
      codigoVisible: codigoVisible(anio, correlativo),
      tipo: anterior.tipo,
      numeroTarjeta: anterior.numeroTarjeta,
      numeroAcompanante: anterior.numeroAcompanante || null,
      totalAcompanantes: Number(anterior.totalAcompanantes || 0),
      afiliadoDni: anterior.afiliadoDni,
      afiliadoApellido: anterior.afiliadoApellido,
      afiliadoNombre: anterior.afiliadoNombre,
      estado: "pendiente",
      validada: false,
      anulada: false,
      fechaValidacion: null,
      esReemision: true,
      reemisionDe: tarjetaAnteriorSnap.id,
      numeroReemision,
      fechaCreacion: serverTimestamp(),
      fechaActualizacion: serverTimestamp(),
      emitidaPor: usuario || null,
    };

    transaction.set(nuevaTarjetaRef, nuevaTarjeta);
    transaction.update(tarjetaAnteriorRef, {
      reemplazada: true,
      reemplazadaPor: nuevaTarjetaRef.id,
      fechaReemision: serverTimestamp(),
      fechaActualizacion: serverTimestamp(),
    });
    transaction.set(contadorRef(anio), { ultimo: correlativo, fechaActualizacion: serverTimestamp() }, { merge: true });
    transaction.set(anualRef(anio), { fechaActualizacion: serverTimestamp() }, { merge: true });

    return { id: nuevaTarjetaRef.id, ...nuevaTarjeta };
  });
};

export const obtenerTarjetaPorToken = async (anio, token) => {
  const limpio = limpiarTexto(token);
  if (!limpio) return null;
  const snap = await getDocs(query(tarjetasRef(anio), where("token", "==", limpio), limit(1)));
  return snap.empty ? null : { id: snap.docs[0].id, ...snap.docs[0].data() };
};

export const validarIngresoCena = async ({ anio, token, usuario }) => {
  return runTransaction(db, async (transaction) => {
    const tarjetaRef = doc(tarjetasRef(anio), limpiarTexto(token));
    const tarjetaSnap = await transaction.get(tarjetaRef);
    if (!tarjetaSnap.exists()) throw Object.assign(new Error("QR no válido"), { code: "no-valido" });
    const tarjeta = tarjetaSnap.data();

    if (tarjeta.anulada) throw Object.assign(new Error("Tarjeta anulada"), { code: "anulada", tarjeta: { id: tarjetaSnap.id, ...tarjeta } });
    if (tarjeta.validada) throw Object.assign(new Error("TARJETA REGISTRADA CON ÉXITO"), { code: "ya-utilizada", tarjeta: { id: tarjetaSnap.id, ...tarjeta } });

    const validacionRef = doc(validacionesRef(anio));
    transaction.update(tarjetaRef, {
      estado: "validada",
      validada: true,
      fechaValidacion: serverTimestamp(),
      validadoPor: usuario || null,
      validadoPorUid: usuario?.uid || null,
      validadoPorEmail: usuario?.email || null,
      validadoPorNombre: usuario?.nombre || null,
    });
    transaction.set(validacionRef, {
      anio: Number(anio),
      tarjetaId: tarjetaSnap.id,
      reservaId: tarjeta.reservaId,
      token: tarjeta.token,
      codigoVisible: tarjeta.codigoVisible,
      afiliadoDni: tarjeta.afiliadoDni,
      tipo: tarjeta.tipo,
      fechaValidacion: serverTimestamp(),
      validadoPor: usuario || null,
      validadoPorUid: usuario?.uid || null,
      validadoPorEmail: usuario?.email || null,
      validadoPorNombre: usuario?.nombre || null,
    });
    return { id: tarjetaSnap.id, ...tarjeta, validada: true, estado: "validada" };
  });
};

export const importarReservasCena = async ({ anio, filas = [], onProgress = null }) => {
  const total = filas.length;
  let procesadas = 0;
  let creadas = 0;
  let omitidas = 0;
  let pendientesGeneracion = 0;
  let tarjetasGeneradas = 0;
  const errores = [];

  onProgress?.({ etapa: "importando", procesadas, total, tarjetasGeneradas });

  for (const fila of filas) {
    try {
      const resultado = await crearReservaImportadaConTarjetasCena({
        anio,
        afiliado: fila.afiliado,
        cantidadTarjetas: fila.cantidadTarjetas,
      });
      creadas += 1;
      tarjetasGeneradas += Number(resultado.tarjetasCreadas || 0);
    } catch (error) {
      if (error.code === "reserva-duplicada") {
        omitidas += 1;
      } else {
        if (error.reservaPendienteGeneracion) pendientesGeneracion += 1;
        errores.push({ fila, error });
      }
    } finally {
      procesadas += 1;
      onProgress?.({ etapa: "importando", procesadas, total, tarjetasGeneradas });
    }
  }

  return { creadas, omitidas, errores, pendientesGeneracion, tarjetasGeneradas };
};
