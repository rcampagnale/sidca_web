// src/services/verificacionAfiliacionService.js
//
// Verificación de afiliación de un conjunto de DNI contra el padrón de SIDCA.
//
// Responde UNA pregunta: ¿esta persona figura hoy como afiliada?
//
// REGLA (definida institucionalmente, ver informe de la etapa):
//
//   sin coincidencias en ninguna colección   -> NO AFILIADO · no_encontrado
//   alguna coincidencia con activo === true  -> AFILIADO
//   alguna coincidencia SIN campo `activo`   -> AFILIADO  (registro histórico)
//   todas las coincidencias con activo=false -> NO AFILIADO · baja
//
// Ante conflicto entre colecciones PREVALECE ACTIVO: si un documento dice
// true y otro false, la persona es afiliada. Es lo contrario al criterio de
// AfiliadosPorDepartamento —donde cualquier false gana— y es deliberado: acá
// se responde "¿está afiliada?", no "¿cuántos afiliados vigentes hay?".
//
// La ausencia del campo `activo` NO se interpreta como baja. Coincide con
// `d.activo !== false` que ya usan los dashboards, y protege a los registros
// antiguos anteriores a que ese campo existiera.

import { collection, getDocs } from "firebase/firestore";
import { db } from "../firebase/firebase-config";

/** Estado de verificación de una respuesta. */
export const AFILIACION_ESTADO = {
  AFILIADO: "afiliado",
  NO_AFILIADO: "no_afiliado",
  /** Todavía no se corrió la verificación sobre esta respuesta. */
  SIN_VERIFICAR: "sin_verificar",
};

/** Por qué se llegó a ese estado. Detalle, no reemplaza a AFILIACION_ESTADO. */
export const AFILIACION_MOTIVO = {
  ACTIVO: "activo",
  /** Encontrado en un documento sin campo `activo` (histórico). */
  HISTORICO: "historico",
  /** Encontrado, pero todas sus coincidencias están con activo === false. */
  BAJA: "baja",
  NO_ENCONTRADO: "no_encontrado",
};

export const AFILIACION_ORIGEN = {
  USUARIOS: "usuarios",
  NUEVO_AFILIADO: "nuevoAfiliado",
  AMBOS: "ambos",
  NINGUNO: "ninguno",
};

const COLECCION_USUARIOS = "usuarios";
const COLECCION_NUEVO_AFILIADO = "nuevoAfiliado";

/**
 * DNI comparable: sólo dígitos.
 *
 * Es la misma normalización que aplica `normalizarIdentificador` en
 * excelFormularioService al agrupar, así que "27.341.099", "27341099" y
 * "27 341 099" colapsan a la misma clave y el cruce no depende del formato con
 * el que se haya cargado cada lado.
 */
export const normalizarDniAfiliacion = (valor) =>
  String(valor ?? "").replace(/\D/g, "");

/**
 * DNI de un documento del padrón.
 *
 * Se prueban los mismos campos que ya contemplan los dashboards
 * (`d.dni || d.DNI || d.documento || d.Documento`) y, como último recurso, el
 * ID del documento —hay registros donde el DNI sólo está ahí—. Da igual si el
 * valor está guardado como string o como number: la normalización lo lleva a
 * dígitos en ambos casos.
 */
const dniDeDocumento = (data, docId) => {
  const candidatos = [data?.dni, data?.DNI, data?.documento, data?.Documento, docId];

  for (const candidato of candidatos) {
    const normalizado = normalizarDniAfiliacion(candidato);
    if (normalizado) return normalizado;
  }

  return "";
};

/**
 * Lectura del campo `activo`.
 *
 * Devuelve true/false sólo cuando el dato es concluyente; `undefined` cuando
 * el documento no lo trae, que es el caso "histórico" de la regla 3. Se acepta
 * además la forma string por si algún registro importado lo guardó así: leer
 * "false" como "campo ausente" marcaría como afiliada a una persona dada de
 * baja.
 */
const leerActivo = (valor) => {
  if (typeof valor === "boolean") return valor;

  if (typeof valor === "string") {
    const texto = valor.trim().toLowerCase();
    if (["true", "1", "si", "sí"].includes(texto)) return true;
    if (["false", "0", "no"].includes(texto)) return false;
  }

  return undefined;
};

/**
 * Índice del padrón por DNI normalizado.
 *
 * Se leen las dos colecciones COMPLETAS una sola vez y se cruza en memoria, en
 * lugar de emitir consultas `where("dni","in",lote)` por lote.
 *
 * El motivo es de correctitud, no sólo de costo: el DNI no vive siempre en el
 * mismo campo ni con el mismo tipo —de ahí que todo el proyecto lea
 * `d.dni || d.DNI || d.documento || d.Documento`—, así que una consulta por
 * igualdad sobre `dni` como string dejaría afuera a quienes lo tengan como
 * number o bajo otro nombre, y los reportaría como NO AFILIADOS. Es
 * exactamente el falso negativo que hay que evitar.
 *
 * De paso es más barato: dos lecturas de colección contra ~28 lotes × 2
 * colecciones × cada variante de campo. Es además lo que ya hacen los seis
 * componentes de dashboard del proyecto.
 */
const construirIndicePadron = async () => {
  const [usuariosSnap, nuevoAfiliadoSnap] = await Promise.all([
    getDocs(collection(db, COLECCION_USUARIOS)),
    getDocs(collection(db, COLECCION_NUEVO_AFILIADO)),
  ]);

  const indice = new Map();

  const registrar = (docSnap, coleccion) => {
    const data = docSnap.data() || {};
    const dni = dniDeDocumento(data, docSnap.id);
    if (!dni) return;

    const entrada = indice.get(dni) || {
      enUsuarios: false,
      enNuevoAfiliado: false,
      hayActivoTrue: false,
      hayActivoFalse: false,
      haySinCampoActivo: false,
    };

    if (coleccion === COLECCION_USUARIOS) entrada.enUsuarios = true;
    else entrada.enNuevoAfiliado = true;

    const activo = leerActivo(data.activo);
    if (activo === true) entrada.hayActivoTrue = true;
    else if (activo === false) entrada.hayActivoFalse = true;
    else entrada.haySinCampoActivo = true;

    indice.set(dni, entrada);
  };

  usuariosSnap.forEach((docSnap) => registrar(docSnap, COLECCION_USUARIOS));
  nuevoAfiliadoSnap.forEach((docSnap) => registrar(docSnap, COLECCION_NUEVO_AFILIADO));

  return {
    indice,
    leidos: {
      usuarios: usuariosSnap.size,
      nuevoAfiliado: nuevoAfiliadoSnap.size,
    },
  };
};

const origenDeEntrada = (entrada) => {
  if (entrada.enUsuarios && entrada.enNuevoAfiliado) return AFILIACION_ORIGEN.AMBOS;
  if (entrada.enUsuarios) return AFILIACION_ORIGEN.USUARIOS;
  if (entrada.enNuevoAfiliado) return AFILIACION_ORIGEN.NUEVO_AFILIADO;
  return AFILIACION_ORIGEN.NINGUNO;
};

/** Aplica la regla a UNA entrada del índice. Sin efectos ni consultas. */
export const clasificarEntradaPadron = (entrada) => {
  if (!entrada) {
    return {
      esAfiliado: false,
      estado: AFILIACION_ESTADO.NO_AFILIADO,
      motivo: AFILIACION_MOTIVO.NO_ENCONTRADO,
      origen: AFILIACION_ORIGEN.NINGUNO,
    };
  }

  const origen = origenDeEntrada(entrada);

  // Prevalece ACTIVO sobre cualquier baja registrada en otro documento.
  if (entrada.hayActivoTrue) {
    return {
      esAfiliado: true,
      estado: AFILIACION_ESTADO.AFILIADO,
      motivo: AFILIACION_MOTIVO.ACTIVO,
      origen,
    };
  }

  // Registro anterior a que existiera el campo: se respeta como afiliado.
  if (entrada.haySinCampoActivo) {
    return {
      esAfiliado: true,
      estado: AFILIACION_ESTADO.AFILIADO,
      motivo: AFILIACION_MOTIVO.HISTORICO,
      origen,
    };
  }

  // Existe en el padrón, pero todas sus coincidencias están dadas de baja.
  return {
    esAfiliado: false,
    estado: AFILIACION_ESTADO.NO_AFILIADO,
    motivo: AFILIACION_MOTIVO.BAJA,
    origen,
  };
};

/**
 * Verifica un conjunto de DNI contra el padrón.
 *
 * Cada DNI distinto se resuelve UNA sola vez, sin importar cuántos registros
 * tenga asociados: la persona con 12 cargos se verifica igual que la de 1.
 *
 * Devuelve un Map indexado por DNI normalizado. Si la lectura del padrón
 * falla, la excepción se propaga: quien llama debe abortar y NO interpretar el
 * fallo como "no afiliado".
 */
export const verificarAfiliacionesPorDni = async (dnis = []) => {
  const unicos = [
    ...new Set(dnis.map(normalizarDniAfiliacion).filter(Boolean)),
  ];

  const resultado = new Map();
  if (unicos.length === 0) return resultado;

  const { indice } = await construirIndicePadron();

  unicos.forEach((dni) => {
    resultado.set(dni, clasificarEntradaPadron(indice.get(dni)));
  });

  return resultado;
};

/**
 * Contadores para el preview. `sinVerificar` cubre los DNI que se pidieron
 * pero no aparecen en el Map —no debería ocurrir, y si ocurre no se los cuenta
 * como no afiliados—.
 */
export const resumirVerificacion = (dnis = [], verificaciones = new Map()) => {
  const unicos = [
    ...new Set(dnis.map(normalizarDniAfiliacion).filter(Boolean)),
  ];

  let afiliados = 0;
  let noAfiliados = 0;
  let bajas = 0;
  let sinVerificar = 0;

  unicos.forEach((dni) => {
    const verificacion = verificaciones.get(dni);

    if (!verificacion) {
      sinVerificar += 1;
      return;
    }

    if (verificacion.esAfiliado) {
      afiliados += 1;
      return;
    }

    noAfiliados += 1;
    if (verificacion.motivo === AFILIACION_MOTIVO.BAJA) bajas += 1;
  });

  return { analizados: unicos.length, afiliados, noAfiliados, bajas, sinVerificar };
};

/**
 * Campos que se guardan en la respuesta. Un único lugar donde se decide la
 * forma del documento, para que la importación y la verificación posterior
 * escriban exactamente lo mismo.
 *
 * `afiliacionVerificadaAt` lo pone quien escribe (serverTimestamp), porque
 * este módulo no debe depender del contexto de escritura.
 */
export const camposAfiliacionParaRespuesta = (verificacion) => {
  if (!verificacion) {
    return {
      esAfiliado: null,
      afiliacionEstado: AFILIACION_ESTADO.SIN_VERIFICAR,
      afiliacionMotivo: null,
      afiliacionOrigen: AFILIACION_ORIGEN.NINGUNO,
    };
  }

  return {
    esAfiliado: verificacion.esAfiliado,
    afiliacionEstado: verificacion.estado,
    afiliacionMotivo: verificacion.motivo,
    afiliacionOrigen: verificacion.origen,
  };
};

/**
 * Estado mostrable de una respuesta ya guardada.
 *
 * Distingue los tres casos con cuidado: `esAfiliado === undefined` (o null) es
 * "todavía no se verificó", NO "no afiliado". Un campo ausente nunca debe
 * leerse como una respuesta negativa.
 */
export const estadoAfiliacionDeRespuesta = (respuesta) => {
  if (respuesta?.esAfiliado === true) return AFILIACION_ESTADO.AFILIADO;
  if (respuesta?.esAfiliado === false) return AFILIACION_ESTADO.NO_AFILIADO;
  return AFILIACION_ESTADO.SIN_VERIFICAR;
};

/** Texto para la columna Excel: SI / NO / SIN VERIFICAR. */
export const textoAfiliacionParaExcel = (respuesta) => {
  const estado = estadoAfiliacionDeRespuesta(respuesta);
  if (estado === AFILIACION_ESTADO.AFILIADO) return "SI";
  if (estado === AFILIACION_ESTADO.NO_AFILIADO) return "NO";
  return "SIN VERIFICAR";
};

/** Etiqueta para los badges de la vista administrativa. */
export const etiquetaAfiliacion = (respuesta) => {
  const estado = estadoAfiliacionDeRespuesta(respuesta);
  if (estado === AFILIACION_ESTADO.AFILIADO) return "AFILIADO";
  if (estado === AFILIACION_ESTADO.NO_AFILIADO) {
    return respuesta?.afiliacionMotivo === AFILIACION_MOTIVO.BAJA
      ? "NO AFILIADO · BAJA"
      : "NO AFILIADO";
  }
  return "SIN VERIFICAR";
};
