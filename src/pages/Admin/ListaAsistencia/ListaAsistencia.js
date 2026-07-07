import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Button } from 'primereact/button';
import { Dialog } from 'primereact/dialog';
import { Toast } from 'primereact/toast';
import { InputText } from 'primereact/inputtext';
import { Dropdown } from 'primereact/dropdown';
import { InputSwitch } from 'primereact/inputswitch';
import { Calendar } from 'primereact/calendar';
import { DataTable } from 'primereact/datatable';
import { Column } from 'primereact/column';
import { Toolbar } from 'primereact/toolbar';
import { ConfirmDialog } from 'primereact/confirmdialog';
import { ProgressBar } from 'primereact/progressbar';
import {
  addDoc,
  collection,
  deleteDoc,
  deleteField,
  doc,
  getDocs,
  onSnapshot,
  query,
  updateDoc,
  where,
} from 'firebase/firestore';
import * as XLSX from 'xlsx';
import { db } from '../../../firebase/firebase-config';
import styles from './ListaAsistencia.module.css';

/** ---------- Opciones Modalidad ---------- */
const MODALIDAD_OPTIONS = [
  { label: 'Presencial', value: 'Presencial' },
  { label: 'Virtual', value: 'Virtual' },
];

const MODALIDAD_OPTIONS_EXPORT = [
  { label: 'Todas', value: '*' },
  ...MODALIDAD_OPTIONS,
];

const MODALIDAD_OPTIONS_FILTER = [
  { label: 'Todas', value: '*' },
  ...MODALIDAD_OPTIONS,
];

const ESTADO_PRESENCIAL_OPTIONS_EXPORT = [
  { label: 'Todos los registros', value: '*' },
  { label: 'Con ingreso y salida', value: 'completo' },
  { label: 'Con un solo registro', value: 'incompleto' },
  { label: 'Solo ingreso', value: 'solo_ingreso' },
  { label: 'Solo salida', value: 'solo_salida' },
  { label: 'Sin ingreso/salida', value: 'sin_marcas' },
];

/** ---------- Utils fecha ---------- */
const parseToDate = (value) => {
  if (!value) return null;

  if (value instanceof Date) return value;

  if (typeof value?.toDate === 'function') {
    return value.toDate();
  }

  if (typeof value === 'object' && value.seconds) {
    return new Date(value.seconds * 1000);
  }

  if (typeof value === 'object' && value._seconds) {
    return new Date(value._seconds * 1000);
  }

  const s = String(value).trim();

  if (/^\d{4}-\d{1,2}-\d{1,2}$/.test(s)) {
    const [y, m, d] = s.split('-').map(Number);
    return new Date(y, (m || 1) - 1, d || 1);
  }

  if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(s)) {
    const [d, m, y] = s.split('/').map(Number);
    return new Date(y, m - 1, d);
  }

  if (/^\d{4}-\d{1,2}-\d{1,2}T/.test(s)) {
    const d = new Date(s);
    return Number.isNaN(d.getTime()) ? null : d;
  }

  if (!Number.isNaN(Number(s))) {
    const n = Number(s);
    const epoch = new Date(Date.UTC(1899, 11, 30));
    const ms = Math.round(n * 86400000);
    const dt = new Date(epoch.getTime() + ms);
    return new Date(dt.getUTCFullYear(), dt.getUTCMonth(), dt.getUTCDate());
  }

  return null;
};

const dateToDMY = (date) => {
  if (!date) return '';
  const d = String(date.getDate()).padStart(2, '0');
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const y = date.getFullYear();
  return `${d}/${m}/${y}`;
};

const sameDay = (a, b) =>
  a instanceof Date &&
  b instanceof Date &&
  a.getFullYear() === b.getFullYear() &&
  a.getMonth() === b.getMonth() &&
  a.getDate() === b.getDate();

/** ---------- Normalizadores ---------- */
const normalizeText = (t) =>
  (t ?? '')
    .toString()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

const canonModalidad = (val) => {
  if (val == null) return '';

  const v = String(val).trim().toLowerCase();

  if (v.startsWith('pre')) return 'Presencial';
  if (v.startsWith('vir')) return 'Virtual';

  return '';
};

const toDniDigits = (dni) => String(dni ?? '').replace(/\D/g, '');

const EMPTY = (v) =>
  v === undefined ||
  v === null ||
  (typeof v === 'string' && v.trim() === '') ||
  (Array.isArray(v) && v.length === 0);

const isPlaceholder = (v) => {
  const s = String(v ?? '').trim().toLowerCase();

  return (
    s === '' ||
    s === '-' ||
    s === 'n/a' ||
    s === 'na' ||
    s === 's/d' ||
    s === 'sd' ||
    s === 'sin dato' ||
    s === 'sin datos' ||
    s === 'sin nombre' ||
    s === 'sin apellido'
  );
};

const sanitizeMissing = (v) => (isPlaceholder(v) ? '' : String(v ?? '').trim());

/** ---------- Merge sólo campos vacíos ---------- */
function patchOnlyEmpty(currentData, incoming, allowKeys = null) {
  const patch = {};
  const entries = allowKeys
    ? Object.entries(incoming).filter(([k]) => allowKeys.includes(k))
    : Object.entries(incoming);

  for (const [k, v] of entries) {
    const cur = currentData?.[k];

    if (EMPTY(cur) && !EMPTY(v)) {
      patch[k] = v;
    }
  }

  return patch;
}

/** ---------- Helpers Apellido, Nombre ---------- */
const splitApellidoNombre = (value) => {
  const s = String(value || '').trim();

  if (!s) return { nombre: '', apellido: '' };

  const i = s.indexOf(',');

  if (i !== -1) {
    const apellido = s.slice(0, i).trim();
    const nombre = s.slice(i + 1).trim();
    return { nombre, apellido };
  }

  return { nombre: '', apellido: '' };
};

const splitApellidoNombreFlexible = (value) => {
  const s = String(value || '').replace(/\s+/g, ' ').trim();

  if (!s) return { nombre: '', apellido: '' };

  if (s.includes(',')) {
    return splitApellidoNombre(s);
  }

  const partes = s.split(' ').filter(Boolean);

  if (partes.length <= 1) {
    return { nombre: s, apellido: '' };
  }

  if (partes.length === 2) {
    return { apellido: partes[0], nombre: partes[1] };
  }

  const p0 = normalizeText(partes[0]);
  const p1 = normalizeText(partes[1]);

  // Apellidos con partículas frecuentes: De La Vega Juan Carlos, Del Valle Ana, etc.
  if (['de', 'del', 'da', 'do', 'di'].includes(p0)) {
    if (p0 === 'de' && ['la', 'las', 'los', 'el'].includes(p1) && partes.length >= 4) {
      return {
        apellido: partes.slice(0, 3).join(' '),
        nombre: partes.slice(3).join(' '),
      };
    }

    return {
      apellido: partes.slice(0, 2).join(' '),
      nombre: partes.slice(2).join(' '),
    };
  }

  // Criterio usado cuando el dato llega como "Apellido Nombre" sin coma.
  // 3 palabras: Apellido + dos nombres.
  // 4 o más palabras: se toma apellido compuesto de 2 palabras + nombres.
  const cantidadApellido = partes.length >= 4 ? 2 : 1;

  return {
    apellido: partes.slice(0, cantidadApellido).join(' '),
    nombre: partes.slice(cantidadApellido).join(' '),
  };
};

const deriveNombreApellido = (r = {}) => {
  let nombre = sanitizeMissing(r.nombre);
  let apellido = sanitizeMissing(r.apellido);

  const nombreHasComma = typeof nombre === 'string' && nombre.includes(',');
  const apellidoHasComma = typeof apellido === 'string' && apellido.includes(',');

  const nombreMissing = isPlaceholder(r.nombre) || nombre === '';
  const apellidoMissing = isPlaceholder(r.apellido) || apellido === '';

  if (apellidoMissing && nombreHasComma) {
    const sp = splitApellidoNombre(nombre);
    apellido = sp.apellido || '';
    nombre = sp.nombre || '';
  } else if (nombreMissing && apellidoHasComma) {
    const sp = splitApellidoNombre(apellido);
    apellido = sp.apellido || '';
    nombre = sp.nombre || '';
  } else if (apellidoMissing && nombre) {
    const sp = splitApellidoNombreFlexible(nombre);

    if (sp.apellido && sp.nombre) {
      apellido = sp.apellido;
      nombre = sp.nombre;
    }
  } else if (nombreMissing && apellido) {
    const sp = splitApellidoNombreFlexible(apellido);

    if (sp.apellido && sp.nombre) {
      apellido = sp.apellido;
      nombre = sp.nombre;
    }
  }

  return {
    nombre: sanitizeMissing(nombre),
    apellido: sanitizeMissing(apellido),
  };
};

/** ---------- Ingreso / Salida presencial ---------- */
const INGRESO_KEYS = [
  'ingreso',
  'ingresoFechaHora',
  'horaIngreso',
  'fechaIngreso',
  'entrada',
  'horaEntrada',
  'fechaEntrada',
  'checkIn',
  'checkin',
  'marcaIngreso',
  'marcacionIngreso',
  'registroIngreso',
  'ingresoPresencial',
  'entradaPresencial',
  'asistenciaIngreso',
  'createdAtIngreso',
];

const SALIDA_KEYS = [
  'salida',
  'salidaFechaHora',
  'horaSalida',
  'fechaSalida',
  'egreso',
  'horaEgreso',
  'fechaEgreso',
  'checkOut',
  'checkout',
  'marcaSalida',
  'marcacionSalida',
  'registroSalida',
  'salidaPresencial',
  'egresoPresencial',
  'asistenciaSalida',
  'createdAtSalida',
];

const REGISTRO_BOOL_KEYS = [
  'registrado',
  'registrada',
  'registered',
  'marcado',
  'marcada',
  'validado',
  'validada',
];

const valueToBool = (value) => {
  if (value === true) return true;
  if (value === false) return false;

  const s = normalizeText(value).trim();

  if (['true', 'si', 'sí', '1', 'yes', 'y'].includes(s)) return true;
  if (['false', 'no', '0', 'n'].includes(s)) return false;

  return null;
};

const getRegistroFlag = (value) => {
  if (!value || typeof value !== 'object' || value instanceof Date) return null;

  for (const key of REGISTRO_BOOL_KEYS) {
    if (Object.prototype.hasOwnProperty.call(value, key)) {
      const parsed = valueToBool(value[key]);

      if (parsed !== null) return parsed;
    }
  }

  return null;
};

const isMarcaExplicitamenteNoRegistrada = (value) => getRegistroFlag(value) === false;

const getValueByKeys = (row, keys) => {
  for (const key of keys) {
    const value = row?.[key];

    if (isPlaceholder(value) || isMarcaExplicitamenteNoRegistrada(value)) {
      continue;
    }

    return value;
  }

  return '';
};

const getIngresoRaw = (row) => getValueByKeys(row, INGRESO_KEYS);
const getSalidaRaw = (row) => getValueByKeys(row, SALIDA_KEYS);

const formatDateTimeAR = (date) => {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return '';

  const dd = String(date.getDate()).padStart(2, '0');
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const yyyy = date.getFullYear();
  const hh = String(date.getHours()).padStart(2, '0');
  const min = String(date.getMinutes()).padStart(2, '0');

  return `${dd}/${mm}/${yyyy} ${hh}:${min} hs`;
};

const dateToLocalISOArgentina = (date) => {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return '';

  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  const hh = String(date.getHours()).padStart(2, '0');
  const min = String(date.getMinutes()).padStart(2, '0');

  return `${yyyy}-${mm}-${dd}T${hh}:${min}:00.000-03:00`;
};

const modalidadFirestore = (value) => {
  const modalidad = canonModalidad(value);

  if (modalidad === 'Presencial') return 'presencial';
  if (modalidad === 'Virtual') return 'virtual';

  return '';
};

const isPresencialRow = (row) => {
  if (!row) return false;

  return (
    canonModalidad(row.modalidad) === 'Presencial' ||
    String(row.modalidadDb || '').toLowerCase() === 'presencial' ||
    row.presencial === true
  );
};

const getCursoRow = (row) => row?.curso || row?.cursoNombre || row?.cursoTitulo || '';

const matchCursoRow = (row, curso) => {
  const selected = String(curso || '').trim();

  if (!selected) return false;

  return (
    String(row?.curso || '').trim() === selected ||
    String(row?.cursoNombre || '').trim() === selected ||
    String(row?.cursoTitulo || '').trim() === selected
  );
};

const dateWithTime = (baseDate, hours, minutes = 0) => {
  const d = baseDate instanceof Date ? new Date(baseDate) : new Date();

  d.setHours(hours, minutes, 0, 0);

  return d;
};

const parseFechaHoraString = (value) => {
  if (!value) return null;

  const s = String(value).trim();

  const matchDMY = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:\s+(\d{1,2}):(\d{2}))?/);

  if (matchDMY) {
    const [, d, m, y, h = '0', min = '0'] = matchDMY;
    return new Date(Number(y), Number(m) - 1, Number(d), Number(h), Number(min));
  }

  const matchYMD = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})(?:[T\s](\d{1,2}):(\d{2}))?/);

  if (matchYMD) {
    const [, y, m, d, h = '0', min = '0'] = matchYMD;
    return new Date(Number(y), Number(m) - 1, Number(d), Number(h), Number(min));
  }

  const d = new Date(s);

  return Number.isNaN(d.getTime()) ? null : d;
};

const getObjectFirstValue = (obj, keys) => {
  if (!obj || typeof obj !== 'object') return '';

  for (const key of keys) {
    if (!isPlaceholder(obj[key])) {
      return obj[key];
    }
  }

  return '';
};

const marcaToDate = (value) => {
  if (!value || isMarcaExplicitamenteNoRegistrada(value)) return null;

  if (value instanceof Date) return value;

  if (typeof value?.toDate === 'function') {
    return value.toDate();
  }

  if (typeof value === 'object') {
    if (value.seconds) return new Date(value.seconds * 1000);
    if (value._seconds) return new Date(value._seconds * 1000);

    const directValue = getObjectFirstValue(value, [
      'fechaHora',
      'fechaHoraISO',
      'fecha_hora',
      'dateTime',
      'datetime',
      'timestamp',
      'createdAt',
      'updatedAt',
      'at',
    ]);

    if (directValue) {
      const directDate = marcaToDate(directValue);
      if (directDate) return directDate;
    }

    const fecha = getObjectFirstValue(value, ['fecha', 'date', 'dia']);
    const hora = getObjectFirstValue(value, ['hora', 'time', 'horario']);

    if (fecha && hora) {
      return parseFechaHoraString(`${fecha} ${hora}`);
    }

    if (fecha) {
      return parseFechaHoraString(fecha);
    }

    return null;
  }

  return parseFechaHoraString(value);
};

const formatMarcaAsistencia = (value) => {
  if (!value || isMarcaExplicitamenteNoRegistrada(value)) return '';

  const date = marcaToDate(value);

  if (date) {
    return formatDateTimeAR(date);
  }

  if (typeof value === 'object') {
    const flag = getRegistroFlag(value);
    const fechaHora = getObjectFirstValue(value, [
      'fechaHora',
      'fechaHoraISO',
      'fecha_hora',
      'fechaHoraTexto',
      'dateTime',
      'datetime',
    ]);

    if (fechaHora) return String(fechaHora);

    const fecha = getObjectFirstValue(value, ['fecha', 'date', 'dia']);
    const hora = getObjectFirstValue(value, ['hora', 'time', 'horario']);

    if (fecha && hora) return `${fecha} ${hora} hs`;
    if (fecha) return String(fecha);
    if (hora) return `${hora} hs`;

    // Si el objeto indica registrado:true pero no trae hora, cuenta como marca,
    // pero evitamos mostrar JSON como {"registrado":true}.
    if (flag === true) return 'Registrado';

    return '';
  }

  const text = String(value ?? '').trim();
  const boolValue = valueToBool(text);

  if (boolValue === false) return '';
  if (boolValue === true) return 'Registrado';

  return text;
};

const hasMarca = (value) => {
  const formatted = formatMarcaAsistencia(value);

  return !isPlaceholder(formatted);
};

const getEstadoPresencial = (row) => {
  const modalidad = canonModalidad(row?.modalidad);

  if (modalidad === 'Virtual') {
    return {
      key: 'virtual',
      label: 'Presente',
      detail: 'Modalidad virtual',
      severity: 'success',
    };
  }

  const tieneIngreso = hasMarca(getIngresoRaw(row));
  const tieneSalida = hasMarca(getSalidaRaw(row));

  if (tieneIngreso && tieneSalida) {
    return {
      key: 'completo',
      label: 'Presente',
      detail: 'Ingreso y salida',
      severity: 'success',
    };
  }

  if (tieneIngreso && !tieneSalida) {
    return {
      key: 'solo_ingreso',
      label: 'Incompleto',
      detail: 'Solo ingreso',
      severity: 'warning',
    };
  }

  if (!tieneIngreso && tieneSalida) {
    return {
      key: 'solo_salida',
      label: 'Incompleto',
      detail: 'Solo salida',
      severity: 'warning',
    };
  }

  return {
    key: 'sin_marcas',
    label: 'Pendiente',
    detail: 'Sin ingreso/salida',
    severity: 'neutral',
  };
};

const matchesEstadoExport = (row, filtro) => {
  if (!filtro || filtro === '*') return true;

  const estado = getEstadoPresencial(row);

  if (filtro === 'completo') return estado.key === 'completo';
  if (filtro === 'incompleto') return estado.key === 'solo_ingreso' || estado.key === 'solo_salida';
  if (filtro === 'solo_ingreso') return estado.key === 'solo_ingreso';
  if (filtro === 'solo_salida') return estado.key === 'solo_salida';
  if (filtro === 'sin_marcas') return estado.key === 'sin_marcas';

  return true;
};

/** ---------- Mapeo encabezados Excel -> campos asistencia ---------- */
const headerMapAsistencia = (hRaw) => {
  const h = normalizeText(hRaw).replace(/\s+/g, ' ').trim();

  const map = {
    fecha: 'fecha',
    dia: 'fecha',
    'marca temporal': 'fecha',

    mod: 'modalidad',
    modalidad: 'modalidad',
    curso: 'curso',
    'titulo del curso': 'curso',

    dni: 'dni',
    documento: 'dni',
    'nro documento': 'dni',
    'dni nro': 'dni',

    nombre: 'nombre',
    'nombre/s': 'nombre',
    apellido: 'apellido',
    'apellido/s': 'apellido',
    'apellido, nombre': 'apenom',
    'apellido y nombre': 'apenom',
    'nombre y apellido': 'apenom',
    apenom: 'apenom',
    ayn: 'apenom',
    nya: 'apenom',

    departamento: 'departamento',
    depto: 'departamento',
    dep: 'departamento',

    email: 'email',
    correo: 'email',
    mail: 'email',
    'e-mail': 'email',
    'direccion de correo electronico': 'email',

    'nivel educativo': 'nivelEducativo',
    nivel: 'nivelEducativo',
  };

  return map[h] || null;
};

const normalizeRowAsistencia = (row) => {
  const out = {};

  for (const [k, v] of Object.entries(row)) {
    if (v === undefined) continue;

    switch (k) {
      case 'fecha': {
        const d = parseToDate(v);
        const s = dateToDMY(d);
        if (s) out.fecha = s;
        break;
      }

      case 'modalidad': {
        const s = canonModalidad(v);
        if (s) out.modalidad = s;
        break;
      }

      case 'dni': {
        const d = toDniDigits(v);
        if (d) out.dni = d;
        break;
      }

      case 'apenom': {
        const { nombre, apellido } = splitApellidoNombre(v);
        if (apellido) out.apellido = apellido;
        if (nombre) out.nombre = nombre;
        break;
      }

      case 'nombre': {
        const s = String(v ?? '').trim();

        if (!s) break;

        if (s.includes(',')) {
          const { nombre, apellido } = splitApellidoNombre(s);

          if (apellido && !out.apellido) out.apellido = apellido;
          if (nombre) out.nombre = nombre;
        } else {
          out.nombre = s;
        }

        break;
      }

      case 'apellido': {
        const s = String(v ?? '').trim();

        if (!s) break;

        if (s.includes(',')) {
          const { nombre, apellido } = splitApellidoNombre(s);

          if (apellido) out.apellido = apellido;
          if (nombre && !out.nombre) out.nombre = nombre;
        } else {
          out.apellido = s;
        }

        break;
      }

      case 'curso':
      case 'departamento':
      case 'nivelEducativo':
      case 'email': {
        const s = String(v ?? '').trim();

        if (s) out[k] = s;
        break;
      }

      default:
        break;
    }
  }

  return out;
};

/** ---------- Buscar registro existente ---------- */
async function findAsistenciaDoc(dni, curso, fecha) {
  const col = collection(db, 'asistencia');

  const qs = await getDocs(
    query(col, where('dni', '==', dni), where('curso', '==', curso), where('fecha', '==', fecha))
  );

  return qs.empty ? null : qs.docs[0];
}

/** ---------- Validación por DNI en usuarios / usuario / nuevoAfiliado ---------- */
async function findPersonaDocByDni(collectionName, dni) {
  const colRef = collection(db, collectionName);

  const fields = [
    'dni',
    'DNI',
    'documento',
    'Documento',
    'nroDocumento',
    'numeroDocumento',
    'numDocumento',
  ];

  const values = [dni];
  const dniNumber = Number(dni);

  if (!Number.isNaN(dniNumber)) {
    values.push(dniNumber);
  }

  for (const field of fields) {
    for (const value of values) {
      try {
        const qs = await getDocs(query(colRef, where(field, '==', value)));

        if (!qs.empty) {
          const snap = qs.docs[0];

          return {
            id: snap.id,
            source: collectionName,
            data: snap.data(),
          };
        }
      } catch (err) {
        console.warn(`No se pudo consultar ${collectionName}.${field}:`, err);
      }
    }
  }

  return null;
}

async function getPersonaByDni(dni) {
  const cleanDni = toDniDigits(dni);

  if (!cleanDni) return null;

  const sources = ['usuarios', 'nuevoAfiliado', 'usuario'];

  for (const source of sources) {
    const found = await findPersonaDocByDni(source, cleanDni);

    if (found) return found;
  }

  return null;
}

const pickPersonaFields = (raw, fallbackDni = '', source = '') => {
  if (!raw) {
    return {
      dni: fallbackDni,
      nombre: '',
      apellido: '',
      departamento: '',
      nivelEducativo: '',
      email: '',
      _source: source,
    };
  }

  const getFirst = (...keys) => {
    for (const k of keys) {
      if (raw[k] != null && String(raw[k]).trim() !== '') {
        return String(raw[k]).trim();
      }
    }

    return '';
  };

  const dni = toDniDigits(
    getFirst(
      'dni',
      'DNI',
      'documento',
      'Documento',
      'nroDocumento',
      'numeroDocumento',
      'numDocumento',
      'idnumber',
      'idNumber'
    ) || fallbackDni
  );

  /*
    Algunos documentos históricos tienen los datos separados:
      nombre: "Pablo" / apellido: "Tejeda"

    Otros vienen en un solo campo:
      nombre: "Tejeda, Pablo"
      nombreCompleto: "Tejeda, Pablo"
      apellidoNombre: "Tejeda Pablo"

    Primero tomamos los campos posibles y después normalizamos.
  */
  let nombre = getFirst(
    'nombre',
    'Nombre',
    'nombres',
    'Nombres',
    'name',
    'Name',
    'firstName',
    'firstname'
  );

  let apellido = getFirst(
    'apellido',
    'Apellido',
    'apellidos',
    'Apellidos',
    'surname',
    'lastName',
    'lastname'
  );

  const apenom = getFirst(
    'apenom',
    'apeNom',
    'apellidoNombre',
    'apellido_nombre',
    'apellido_y_nombre',
    'apellidoNombreCompleto',
    'nombreApellido',
    'nombre_apellido',
    'nombreCompleto',
    'NombreCompleto',
    'displayName',
    'display_name',
    'fullName',
    'fullname',
    'Apellido y Nombre',
    'Nombre y Apellido'
  );

  if ((!nombre || !apellido) && apenom) {
    const sp = apenom.includes(',')
      ? splitApellidoNombre(apenom)
      : splitApellidoNombreFlexible(apenom);

    if (!apellido && sp.apellido) apellido = sp.apellido;
    if (!nombre && sp.nombre) nombre = sp.nombre;

    // Si no se pudo separar por formato flexible, conservamos el texto
    // para que deriveNombreApellido intente resolverlo.
    if (!nombre && !apellido) {
      nombre = apenom;
    }
  }

  const normalizado = deriveNombreApellido({
    nombre,
    apellido,
  });

  const departamento = getFirst(
    'departamento',
    'Departamento',
    'depto',
    'Depto',
    'dep',
    'Dep',
    'localidad',
    'Localidad'
  );

  const nivelEducativo = getFirst(
    'nivelEducativo',
    'NivelEducativo',
    'nivel',
    'Nivel',
    'nivel_educativo',
    'Nivel_Educativo',
    'nivel educativo',
    'Nivel Educativo'
  );

  const email = getFirst(
    'email',
    'Email',
    'correo',
    'Correo',
    'mail',
    'Mail',
    'e-mail',
    'E-mail',
    'correoElectronico',
    'correo_electronico'
  );

  return {
    dni,
    nombre: sanitizeMissing(normalizado.nombre),
    apellido: sanitizeMissing(normalizado.apellido),
    departamento: sanitizeMissing(departamento),
    nivelEducativo: sanitizeMissing(nivelEducativo),
    email: sanitizeMissing(email),
    _source: source,
  };
};

const ListaAsistencia = () => {
  const toast = useRef(null);
  const dt = useRef(null);

  const personaCacheRef = useRef(new Map());

  const getPersonaDataCached = async (dni) => {
    const key = toDniDigits(dni);

    if (!key) {
      return {
        dni: '',
        nombre: '',
        apellido: '',
        departamento: '',
        nivelEducativo: '',
        email: '',
        _source: '',
      };
    }

    if (personaCacheRef.current.has(key)) {
      return personaCacheRef.current.get(key);
    }

    const found = await getPersonaByDni(key);
    const picked = pickPersonaFields(found?.data, key, found?.source || '');

    personaCacheRef.current.set(key, picked);

    return picked;
  };

  // ------------------- Datos base -------------------
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);

  // ------------------- Filtros cliente -------------------
  const [busqueda, setBusqueda] = useState('');
  const [filtroFecha, setFiltroFecha] = useState(null);
  const [filtroModalidad, setFiltroModalidad] = useState('*');

  // ------------------- Cursos -------------------
  const [cursosOptions, setCursosOptions] = useState([]);
  const [cursoSeleccionado, setCursoSeleccionado] = useState(null);
  const [cursoAplicado, setCursoAplicado] = useState(null);
  const [cursosListaOptions, setCursosListaOptions] = useState([]);

  // ------------------- Paginación -------------------
  const [first, setFirst] = useState(0);

  // ------------------- Modal Alta/Edición -------------------
  const [visibleDialog, setVisibleDialog] = useState(false);
  const [editandoId, setEditandoId] = useState(null);
  const [validatingDni, setValidatingDni] = useState(false);

  const [form, setForm] = useState({
    fecha: new Date(),
    modalidad: '',
    curso: '',
    cursoId: '',
    nombre: '',
    apellido: '',
    dni: '',
    departamento: '',
    nivelEducativo: '',
    email: '',
    ingreso: null,
    salida: null,
  });

  const [saving, setSaving] = useState(false);

  // ------------------- Modal carga masiva ingreso/salida -------------------
  const [visibleMasivo, setVisibleMasivo] = useState(false);
  const [ingresoMasivo, setIngresoMasivo] = useState(null);
  const [salidaMasivo, setSalidaMasivo] = useState(null);
  const [sobrescribirMarcas, setSobrescribirMarcas] = useState(false);
  const [savingMasivo, setSavingMasivo] = useState(false);

  // ------------------- Modal Ver -------------------
  const [visibleVer, setVisibleVer] = useState(false);
  const [rowVer, setRowVer] = useState(null);

  // ------------------- Importar Excel -------------------
  const [importing, setImporting] = useState(false);
  const fileExcelRef = useRef(null);
  const [importProgress, setImportProgress] = useState(0);
  const [importStage, setImportStage] = useState('');

  const [visibleSelCurso, setVisibleSelCurso] = useState(false);
  const [cursoImport, setCursoImport] = useState('');
  const [modalidadImport, setModalidadImport] = useState('');
  const [fechaImport, setFechaImport] = useState(null);

  const [visibleResultado, setVisibleResultado] = useState(false);
  const [resumenImport, setResumenImport] = useState({
    creados: 0,
    actualizados: 0,
    sinCambios: 0,
    noEncontrados: 0,
  });

  const [erroresImport, setErroresImport] = useState([]);

  // ------------------- Exportar Excel -------------------
  const [visibleExport, setVisibleExport] = useState(false);
  const [cursoExport, setCursoExport] = useState('');
  const [modalidadExport, setModalidadExport] = useState('*');
  const [estadoPresencialExport, setEstadoPresencialExport] = useState('*');
  const [exporting, setExporting] = useState(false);
  const [exportMode, setExportMode] = useState('asistencia'); // asistencia | moodle

  const isBusy = importing;

  useEffect(() => {
    if (!isBusy) return undefined;

    const onBeforeUnload = (e) => {
      e.preventDefault();
      e.returnValue = '';
    };

    window.addEventListener('beforeunload', onBeforeUnload);

    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [isBusy]);

  const guardBusy = (fn) => (...args) => {
    if (isBusy) {
      toast.current?.show({
        severity: 'warn',
        summary: 'Procesando importación',
        detail: 'Vas a poder continuar cuando finalice.',
      });

      return;
    }

    return fn?.(...args);
  };

  // ===== Cursos desde asistencia =====
  useEffect(() => {
    const base = collection(db, 'asistencia');

    const unsub = onSnapshot(
      base,
      (snap) => {
        const setCursos = new Set();

        snap.forEach((d) => {
          const data = d.data() || {};
          const c = data.curso || data.cursoNombre || data.cursoTitulo;

          if (c) setCursos.add(c);
        });

        setCursosOptions(
          Array.from(setCursos)
            .sort((a, b) => a.localeCompare(b))
            .map((c) => ({ label: c, value: c }))
        );
      },
      (err) => console.error('cursos asistencia onSnapshot:', err)
    );

    return () => unsub();
  }, []);

  // ===== Cursos desde colección cursos =====
  useEffect(() => {
    const colRef = collection(db, 'cursos');

    const unsub = onSnapshot(
      colRef,
      (snap) => {
        const items = snap.docs
          .map((d) => {
            const data = d.data() || {};
            const titulo = (
              data.titulo ||
              data.nombre ||
              data.name ||
              data.curso ||
              data.tituloCurso ||
              ''
            )
              .toString()
              .trim();

            if (!titulo) return null;

            return {
              label: titulo,
              value: d.id,
              id: d.id,
              titulo,
            };
          })
          .filter(Boolean)
          .sort((a, b) => a.label.localeCompare(b.label));

        setCursosListaOptions(items);
      },
      (err) => console.error('cursos colección onSnapshot:', err)
    );

    return () => unsub();
  }, []);

  const cursosFormOptions = useMemo(() => cursosListaOptions, [cursosListaOptions]);

  const cursosExportOptions = useMemo(() => {
    const set = new Set([
      ...cursosListaOptions.map((o) => o.titulo),
      ...cursosOptions.map((o) => o.value),
    ]);

    return Array.from(set)
      .filter(Boolean)
      .sort((a, b) => a.localeCompare(b))
      .map((n) => ({ label: n, value: n }));
  }, [cursosListaOptions, cursosOptions]);

  const getCursoOption = (cursoId, cursoTitulo) => {
    if (cursoId) {
      const byId = cursosListaOptions.find((c) => c.id === cursoId || c.value === cursoId);
      if (byId) return byId;
    }

    const normalizedTitle = normalizeText(cursoTitulo || '').trim();

    if (!normalizedTitle) return null;

    return (
      cursosListaOptions.find((c) => normalizeText(c.titulo || c.label).trim() === normalizedTitle) || null
    );
  };

  // ===== Asistencia principal =====
  useEffect(() => {
    setLoading(true);

    const base = collection(db, 'asistencia');

    const unsub = onSnapshot(
      base,
      (snap) => {
        const data = snap.docs.map((d) => ({ id: d.id, ...d.data() }));

        setRows(data);
        setLoading(false);
      },
      (err) => {
        console.error('asistencia onSnapshot:', err);

        toast.current?.show({
          severity: 'error',
          summary: 'Error',
          detail: 'No se pudo leer la asistencia.',
        });

        setLoading(false);
      }
    );

    return () => unsub();
  }, []);

  useEffect(() => {
    setFirst(0);
  }, [cursoAplicado]);

  // ===== Autocompletar mínimo por DNI =====
  useEffect(() => {
    const dni = toDniDigits(form.dni);

    if (!dni || dni.length < 7) return undefined;

    const timer = setTimeout(async () => {
      const persona = await getPersonaDataCached(dni);

      const updates = {};

      if (!form.nombre?.trim() && persona.nombre) updates.nombre = persona.nombre;
      if (!form.apellido?.trim() && persona.apellido) updates.apellido = persona.apellido;
      if (!form.departamento?.trim() && persona.departamento) updates.departamento = persona.departamento;
      if (!form.nivelEducativo?.trim() && persona.nivelEducativo) updates.nivelEducativo = persona.nivelEducativo;
      if (!form.email?.trim() && persona.email) updates.email = persona.email;

      if (Object.keys(updates).length) {
        setForm((f) => ({ ...f, ...updates }));
      }
    }, 450);

    return () => clearTimeout(timer);

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.dni]);

  // ===== Join en vivo por DNI =====
  const [dniJoin, setDniJoin] = useState({});

  useEffect(() => {
    const fetchMissing = async () => {
      const toFetch = new Set();

      rows.forEach((r) => {
        const dni = toDniDigits(r.dni);

        if (!dni) return;

        const need =
          EMPTY(r.email) ||
          EMPTY(r.departamento) ||
          EMPTY(r.nivelEducativo) ||
          EMPTY(r.nombre) ||
          EMPTY(r.apellido);

        if (need && !dniJoin[dni]) {
          toFetch.add(dni);
        }
      });

      if (toFetch.size === 0) return;

      const updates = {};

      for (const dni of toFetch) {
        updates[dni] = await getPersonaDataCached(dni);
      }

      if (Object.keys(updates).length) {
        setDniJoin((prev) => ({ ...prev, ...updates }));
      }
    };

    fetchMissing();

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows]);

  // ===== Filtros =====
  const dataFiltrada = useMemo(() => {
    const s = normalizeText(busqueda).trim();

    const filtrada = rows.filter((r) => {
      const dni = toDniDigits(r.dni);
      const joined = dniJoin[dni] || {};
      const curso = getCursoRow(r);

      const okCurso = !cursoAplicado || matchCursoRow(r, cursoAplicado);
      const okModalidad =
        filtroModalidad === '*' ||
        (filtroModalidad === 'Presencial'
          ? isPresencialRow(r)
          : canonModalidad(r.modalidad) === filtroModalidad);

      const txt = normalizeText(
        `${r.nombre || joined.nombre || ''} ${r.apellido || joined.apellido || ''} ${r.dni || ''} ${curso} ${
          r.departamento || joined.departamento || ''
        } ${r.nivelEducativo || joined.nivelEducativo || ''} ${r.email || joined.email || ''}`
      );

      const okTexto = s === '' || txt.includes(s);

      const fechaRow = parseToDate(r.fecha);
      const okFecha = !filtroFecha || (fechaRow && sameDay(fechaRow, filtroFecha));

      return okCurso && okModalidad && okTexto && okFecha;
    });

    const toTime = (f) => parseToDate(f)?.getTime() || 0;

    return filtrada.sort((a, b) => toTime(b.fecha) - toTime(a.fecha));
  }, [rows, busqueda, filtroFecha, filtroModalidad, dniJoin, cursoAplicado]);

  const resumenCorreos = useMemo(() => {
    const porDni = new Map();

    dataFiltrada.forEach((row) => {
      const dni = toDniDigits(row.dni);

      if (!dni) return;

      const joined = dniJoin[dni] || {};
      const email = sanitizeMissing(row.email) || sanitizeMissing(joined.email);
      const actual = porDni.get(dni) || { dni, tieneEmail: false };

      if (email) {
        actual.tieneEmail = true;
      }

      porDni.set(dni, actual);
    });

    const total = porDni.size;
    const conEmail = Array.from(porDni.values()).filter((item) => item.tieneEmail).length;
    const sinEmail = total - conEmail;

    return {
      total,
      conEmail,
      sinEmail,
    };
  }, [dataFiltrada, dniJoin]);

  const registrosObjetivoMasivo = useMemo(() => {
    if (!cursoAplicado || filtroModalidad !== 'Presencial' || !filtroFecha) return [];

    return rows.filter((r) => {
      const fechaRow = parseToDate(r.fecha);

      return matchCursoRow(r, cursoAplicado) && fechaRow && sameDay(fechaRow, filtroFecha) && isPresencialRow(r);
    });
  }, [rows, cursoAplicado, filtroModalidad, filtroFecha]);

  const abrirIngresoSalidaMasivo = () => {
    if (!cursoAplicado) {
      toast.current?.show({
        severity: 'warn',
        summary: 'Seleccioná un curso',
        detail: 'Primero seleccioná un curso y presioná Filtrar.',
      });

      return;
    }

    if (filtroModalidad !== 'Presencial') {
      toast.current?.show({
        severity: 'warn',
        summary: 'Modalidad requerida',
        detail: 'Para esta acción masiva, el filtro de modalidad debe estar en Presencial.',
      });

      return;
    }

    if (!filtroFecha) {
      toast.current?.show({
        severity: 'warn',
        summary: 'Seleccioná una fecha',
        detail: 'Para evitar errores, primero filtrá por fecha.',
      });

      return;
    }

    setIngresoMasivo(dateWithTime(filtroFecha, 9, 0));
    setSalidaMasivo(dateWithTime(filtroFecha, 15, 0));
    setSobrescribirMarcas(false);
    setVisibleMasivo(true);
  };

  const cargarIngresoSalidaMasivo = async () => {
    if (!cursoAplicado || filtroModalidad !== 'Presencial' || !filtroFecha) {
      toast.current?.show({
        severity: 'warn',
        summary: 'Filtros incompletos',
        detail: 'Debés filtrar por curso, modalidad Presencial y fecha antes de actualizar.',
      });

      return;
    }

    if (!ingresoMasivo && !salidaMasivo) {
      toast.current?.show({
        severity: 'warn',
        summary: 'Horarios incompletos',
        detail: 'Indicá al menos ingreso o salida.',
      });

      return;
    }

    if (!registrosObjetivoMasivo.length) {
      toast.current?.show({
        severity: 'info',
        summary: 'Sin registros',
        detail: 'No hay registros presenciales para ese curso y fecha.',
      });

      return;
    }

    const ingresoTexto = ingresoMasivo ? formatDateTimeAR(ingresoMasivo) : '';
    const salidaTexto = salidaMasivo ? formatDateTimeAR(salidaMasivo) : '';
    const ingresoISO = ingresoMasivo ? dateToLocalISOArgentina(ingresoMasivo) : '';
    const salidaISO = salidaMasivo ? dateToLocalISOArgentina(salidaMasivo) : '';

    setSavingMasivo(true);

    let actualizados = 0;
    let sinCambios = 0;
    let errores = 0;

    try {
      for (const row of registrosObjetivoMasivo) {
        const tieneIngreso = hasMarca(getIngresoRaw(row));
        const tieneSalida = hasMarca(getSalidaRaw(row));

        const debeActualizarIngreso = !!ingresoMasivo && (sobrescribirMarcas || !tieneIngreso);
        const debeActualizarSalida = !!salidaMasivo && (sobrescribirMarcas || !tieneSalida);

        if (!debeActualizarIngreso && !debeActualizarSalida) {
          sinCambios += 1;
          continue;
        }

        const finalTieneIngreso = debeActualizarIngreso ? true : tieneIngreso;
        const finalTieneSalida = debeActualizarSalida ? true : tieneSalida;
        const registroCompleto = finalTieneIngreso && finalTieneSalida;

        const patch = {
          presencial: true,
          modalidad: 'presencial',
          modalidadDb: 'presencial',
          estado: registroCompleto ? 'Presente' : 'Incompleto',
          estadoAsistencia: registroCompleto ? 'validada' : 'parcial',
          estadoPresencial: registroCompleto
            ? 'completo'
            : finalTieneIngreso
            ? 'solo_ingreso'
            : 'solo_salida',
          asistenciaValidada: true,
          actualizadoIngresoSalidaMasivoAdmin: true,
          updatedAt: new Date(),
        };

        if (debeActualizarIngreso) {
          patch.ingreso = {
            registrado: true,
            fechaHora: ingresoTexto,
            fechaHoraISO: ingresoISO,
            metodo: 'masivo_admin',
          };
          patch.ingresoFechaHora = ingresoTexto;
        }

        if (debeActualizarSalida) {
          patch.salida = {
            registrado: true,
            fechaHora: salidaTexto,
            fechaHoraISO: salidaISO,
            metodo: 'masivo_admin',
          };
          patch.salidaFechaHora = salidaTexto;
        }

        try {
          await updateDoc(doc(db, 'asistencia', row.id), patch);
          actualizados += 1;
        } catch (err) {
          console.error('actualizar ingreso/salida masivo:', err);
          errores += 1;
        }
      }

      toast.current?.show({
        severity: errores ? 'warn' : 'success',
        summary: errores ? 'Proceso finalizado con errores' : 'Carga masiva completada',
        detail: `Actualizados: ${actualizados} · Sin cambios: ${sinCambios} · Errores: ${errores}`,
      });

      if (!errores) {
        setVisibleMasivo(false);
      }
    } catch (err) {
      console.error('carga masiva ingreso/salida:', err);

      toast.current?.show({
        severity: 'error',
        summary: 'Error',
        detail: 'No se pudo completar la carga masiva.',
      });
    } finally {
      setSavingMasivo(false);
    }
  };

  // ===== CRUD =====
  const abrirNuevo = () => {
    setEditandoId(null);

    setForm({
      fecha: new Date(),
      modalidad: '',
      curso: '',
      cursoId: '',
      nombre: '',
      apellido: '',
      dni: '',
      departamento: '',
      nivelEducativo: '',
      email: '',
      ingreso: null,
      salida: null,
    });

    setVisibleDialog(true);
  };

  const abrirEditar = (row) => {
    const rawModalidad = row.modalidad ?? row.Modalidad ?? '';
    const dni = toDniDigits(row.dni);
    const join = dniJoin[dni] || {};
    const cursoTitulo = row.curso || row.cursoNombre || row.cursoTitulo || '';
    const cursoOption = getCursoOption(row.cursoId, cursoTitulo);

    setEditandoId(row.id);

    setForm({
      fecha: parseToDate(row.fecha) || new Date(),
      modalidad: canonModalidad(rawModalidad),
      curso: cursoOption?.titulo || cursoTitulo,
      cursoId: cursoOption?.id || row.cursoId || '',
      nombre: sanitizeMissing(row.nombre) || join.nombre || '',
      apellido: sanitizeMissing(row.apellido) || join.apellido || '',
      dni: row.dni || '',
      departamento: row.departamento || join.departamento || '',
      nivelEducativo: row.nivelEducativo || join.nivelEducativo || '',
      email: row.email || join.email || '',
      ingreso: marcaToDate(getIngresoRaw(row)),
      salida: marcaToDate(getSalidaRaw(row)),
    });

    setVisibleDialog(true);
  };

  const validarDniFormulario = async () => {
    const dni = toDniDigits(form.dni);

    if (!dni || dni.length < 7) {
      toast.current?.show({
        severity: 'warn',
        summary: 'DNI inválido',
        detail: 'Ingresá un DNI válido para buscar.',
      });

      return;
    }

    setValidatingDni(true);

    try {
      const found = await getPersonaByDni(dni);

      if (!found) {
        toast.current?.show({
          severity: 'warn',
          summary: 'No encontrado',
          detail: 'No se encontró el DNI en usuarios ni en nuevoAfiliado.',
        });

        return;
      }

      const persona = pickPersonaFields(found.data, dni, found.source);

      personaCacheRef.current.set(dni, persona);

      setForm((f) => ({
        ...f,
        dni: persona.dni || dni,
        nombre: persona.nombre || f.nombre,
        apellido: persona.apellido || f.apellido,
        departamento: persona.departamento || f.departamento,
        nivelEducativo: persona.nivelEducativo || f.nivelEducativo,
        email: persona.email || f.email,
      }));

      toast.current?.show({
        severity: 'success',
        summary: 'DNI validado',
        detail: `Datos encontrados en ${found.source}.`,
      });
    } catch (err) {
      console.error('validar DNI:', err);

      toast.current?.show({
        severity: 'error',
        summary: 'Error',
        detail: 'No se pudo validar el DNI.',
      });
    } finally {
      setValidatingDni(false);
    }
  };

  const guardar = async () => {
    try {
      setSaving(true);

      const dniNum = toDniDigits(form.dni);
      let persona = null;

      if (dniNum) {
        persona = await getPersonaDataCached(dniNum);
      }

      const cursoOption = getCursoOption(form.cursoId, form.curso);
      const cursoId = cursoOption?.id || form.cursoId || '';
      const cursoTitulo = (cursoOption?.titulo || form.curso || '').trim();
      const modalidadCanon = canonModalidad(form.modalidad);
      const modalidadDb = modalidadFirestore(modalidadCanon);

      const formToSave = {
        ...form,
        dni: dniNum,
        modalidad: modalidadCanon,
        modalidadDb,
        curso: cursoTitulo,
        cursoId,
        nombre: form.nombre?.trim() || persona?.nombre || '',
        apellido: form.apellido?.trim() || persona?.apellido || '',
        departamento: form.departamento?.trim() || persona?.departamento || '',
        nivelEducativo: form.nivelEducativo?.trim() || persona?.nivelEducativo || '',
        email: form.email?.trim() || persona?.email || '',
      };

      const faltan = [];

      if (!formToSave.fecha) faltan.push('Fecha');
      if (!formToSave.modalidad) faltan.push('Modalidad');
      if (!formToSave.curso?.trim()) faltan.push('Curso');
      if (!formToSave.cursoId?.trim()) faltan.push('Curso válido de la colección cursos');
      if (!formToSave.dni?.trim()) faltan.push('DNI');
      if (!formToSave.nombre?.trim()) faltan.push('Nombre');
      if (!formToSave.apellido?.trim()) faltan.push('Apellido');

      if (formToSave.modalidad === 'Presencial') {
        if (!formToSave.ingreso && !formToSave.salida) {
          faltan.push('Ingreso o Salida');
        }
      }

      if (faltan.length) {
        toast.current?.show({
          severity: 'warn',
          summary: 'Datos incompletos',
          detail: `Faltan: ${faltan.join(', ')}`,
        });

        setSaving(false);
        return;
      }

      const fechaTexto = dateToDMY(formToSave.fecha);
      const ahora = new Date();

      const payload = {
        fecha: fechaTexto,
        curso: formToSave.curso.trim(),
        cursoNombre: formToSave.curso.trim(),
        cursoTitulo: formToSave.curso.trim(),
        cursoId: formToSave.cursoId.trim(),
        modalidad: modalidadDb,
        nombre: formToSave.nombre.trim(),
        apellido: formToSave.apellido.trim(),
        dni: formToSave.dni,
        departamento: formToSave.departamento.trim(),
        nivelEducativo: formToSave.nivelEducativo.trim(),
        email: formToSave.email.trim(),
        estado: 'Presente',
        estadoAsistencia: 'validada',
        asistenciaValidada: true,
        origen: editandoId ? 'manual_admin_editado' : 'manual_admin',
        actualizadoManualAdmin: true,
        updatedAt: ahora,
      };

      if (formToSave.modalidad === 'Presencial') {
        const tieneIngreso = !!formToSave.ingreso;
        const tieneSalida = !!formToSave.salida;
        const registroCompleto = tieneIngreso && tieneSalida;

        payload.presencial = true;
        payload.estado = registroCompleto ? 'Presente' : 'Incompleto';
        payload.estadoAsistencia = registroCompleto ? 'validada' : 'parcial';
        payload.estadoPresencial = registroCompleto
          ? 'completo'
          : tieneIngreso
          ? 'solo_ingreso'
          : 'solo_salida';
        payload.asistenciaValidada = true;
        payload.creadoManualAdmin = true;

        if (tieneIngreso) {
          const ingresoTexto = formatDateTimeAR(formToSave.ingreso);
          const ingresoISO = dateToLocalISOArgentina(formToSave.ingreso);

          payload.ingreso = {
            registrado: true,
            fechaHora: ingresoTexto,
            fechaHoraISO: ingresoISO,
            metodo: 'manual_admin',
          };
          payload.ingresoFechaHora = ingresoTexto;
        } else if (editandoId) {
          payload.ingreso = deleteField();
          payload.ingresoFechaHora = deleteField();
        }

        if (tieneSalida) {
          const salidaTexto = formatDateTimeAR(formToSave.salida);
          const salidaISO = dateToLocalISOArgentina(formToSave.salida);

          payload.salida = {
            registrado: true,
            fechaHora: salidaTexto,
            fechaHoraISO: salidaISO,
            metodo: 'manual_admin',
          };
          payload.salidaFechaHora = salidaTexto;
        } else if (editandoId) {
          payload.salida = deleteField();
          payload.salidaFechaHora = deleteField();
        }
      } else {
        payload.presencial = false;
        payload.estado = 'Presente';
        payload.estadoAsistencia = 'validada';
        payload.estadoPresencial = 'virtual';
        payload.asistenciaValidada = true;
        payload.ingreso = '';
        payload.salida = '';
        payload.ingresoFechaHora = '';
        payload.salidaFechaHora = '';
      }

      if (editandoId) {
        await updateDoc(doc(db, 'asistencia', editandoId), payload);

        toast.current?.show({
          severity: 'success',
          summary: 'Actualizado',
          detail: 'Registro actualizado con estructura compatible con la app.',
        });
      } else {
        const ex = await findAsistenciaDoc(payload.dni, payload.curso, payload.fecha);

        if (ex) {
          await updateDoc(ex.ref, payload);

          toast.current?.show({
            severity: 'success',
            summary: 'Actualizado',
            detail: 'Ya existía ese DNI en el curso y fecha. Se actualizó como asistencia validada.',
          });
        } else {
          await addDoc(collection(db, 'asistencia'), {
            ...payload,
            createdAt: ahora,
          });

          toast.current?.show({
            severity: 'success',
            summary: 'Guardado',
            detail: 'Registro agregado como asistencia validada.',
          });
        }
      }

      setVisibleDialog(false);
    } catch (err) {
      console.error('guardar asistencia:', err);

      toast.current?.show({
        severity: 'error',
        summary: 'Error',
        detail: 'No se pudo guardar.',
      });
    } finally {
      setSaving(false);
    }
  };

  const borrar = async (row) => {
    try {
      await deleteDoc(doc(db, 'asistencia', row.id));

      toast.current?.show({
        severity: 'success',
        summary: 'Eliminado',
        detail: 'Registro borrado.',
      });
    } catch (err) {
      console.error('borrar asistencia:', err);

      toast.current?.show({
        severity: 'error',
        summary: 'Error',
        detail: 'No se pudo borrar.',
      });
    }
  };

  const abrirVer = (row) => {
    setRowVer(row);
    setVisibleVer(true);
  };

  /** ===== Importar Excel ===== */
  const abrirSelectorCurso = () => {
    const pre = cursoAplicado || cursoSeleccionado || '';
    setCursoImport(pre);
    setModalidadImport('');
    setFechaImport(parseToDate(filtroFecha));
    setVisibleSelCurso(true);
  };

  const continuarSeleccionCurso = () => {
    if (!cursoImport || !String(cursoImport).trim()) {
      toast.current?.show({
        severity: 'warn',
        summary: 'Seleccioná el curso',
        detail: 'El curso es obligatorio para importar.',
      });

      return;
    }

    if (!modalidadImport) {
      toast.current?.show({
        severity: 'warn',
        summary: 'Seleccioná la modalidad',
        detail: 'Debes elegir Virtual o Presencial para completar las faltantes.',
      });

      return;
    }

    if (!fechaImport) {
      toast.current?.show({
        severity: 'warn',
        summary: 'Seleccioná la fecha',
        detail: 'La fecha de la asistencia es obligatoria para importar.',
      });
      return;
    }

    setVisibleSelCurso(false);
    fileExcelRef.current?.click();
  };

  const handleFileChange = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';

    if (!file) return;

    setImporting(true);
    setImportProgress(1);
    setImportStage('Leyendo archivo...');

    const errores = [];
    let creados = 0;
    let actualizados = 0;
    let sinCambios = 0;
    let noEncontrados = 0;

    try {
      const data = await file.arrayBuffer();
      const wb = XLSX.read(data, { type: 'array' });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const jsonRaw = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });

      if (!jsonRaw.length) {
        setResumenImport({
          creados: 0,
          actualizados: 0,
          sinCambios: 0,
          noEncontrados: 0,
        });

        setErroresImport([
          {
            dni: '-',
            nombre: '-',
            apellido: '-',
            fecha: '-',
            curso: cursoImport,
            motivo: 'Archivo vacío',
          },
        ]);

        setImportProgress(100);
        setImportStage('Sin datos');
        setVisibleResultado(true);
        return;
      }

      const headers = (jsonRaw[0] || []).map((h) => headerMapAsistencia(h)).map((x) => x || '');
      const filas = jsonRaw.slice(1);

      const byDni = new Map();
      const selectedMod = canonModalidad(modalidadImport);
      const fechaSeleccionada = dateToDMY(fechaImport);

      for (const arr of filas) {
        const rowObj = {};

        headers.forEach((fieldKey, idx) => {
          if (!fieldKey) return;
          rowObj[fieldKey] = arr[idx];
        });

        const norm = normalizeRowAsistencia(rowObj);
        norm.curso = cursoImport;
        norm.fecha = fechaSeleccionada;

        const excelMod = canonModalidad(norm.modalidad);
        const finalMod = selectedMod || excelMod;

        if (finalMod) norm.modalidad = finalMod;

        const dni = norm.dni;

        if (!dni) {
          errores.push({
            dni: '(sin DNI)',
            nombre: norm.nombre || '',
            apellido: norm.apellido || '',
            fecha: norm.fecha || '',
            curso: cursoImport,
            motivo: 'Falta DNI',
          });

          continue;
        }

        const prev = byDni.get(dni) || {};
        const merged = { ...prev };

        for (const [k, v] of Object.entries(norm)) {
          if (!EMPTY(v)) {
            merged[k] = v;
          }
        }

        byDni.set(dni, merged);
      }

      setImportStage('Actualizando registros…');

      const entries = Array.from(byDni.entries());
      const total = entries.length || 1;
      const step = Math.max(1, Math.floor(total / 100));
      let processed = 0;

      const documentosCursoPorDni = new Map();
      rows.forEach((row) => {
        if (!matchCursoRow(row, cursoImport)) return;
        const dniRow = toDniDigits(row.dni);
        if (!dniRow || !row.id) return;
        const items = documentosCursoPorDni.get(dniRow) || [];
        items.push({
          ref: doc(db, 'asistencia', row.id),
          data: () => row,
        });
        documentosCursoPorDni.set(dniRow, items);
      });

      const ALLOW_KEYS = ['nombre', 'apellido', 'email', 'departamento', 'nivelEducativo', 'modalidad'];

      for (let i = 0; i < entries.length; i += 1) {
        const [dni, value] = entries[i];
        const { fecha, ...rest } = value;

        if (
          EMPTY(rest.email) ||
          EMPTY(rest.departamento) ||
          EMPTY(rest.nivelEducativo) ||
          EMPTY(rest.nombre) ||
          EMPTY(rest.apellido)
        ) {
          const persona = await getPersonaDataCached(dni);

          if (EMPTY(rest.email) && persona.email) rest.email = persona.email;
          if (EMPTY(rest.departamento) && persona.departamento) rest.departamento = persona.departamento;
          if (EMPTY(rest.nivelEducativo) && persona.nivelEducativo) rest.nivelEducativo = persona.nivelEducativo;
          if (EMPTY(rest.nombre) && persona.nombre) rest.nombre = persona.nombre;
          if (EMPTY(rest.apellido) && persona.apellido) rest.apellido = persona.apellido;
        }

        const docsCurso = documentosCursoPorDni.get(dni) || [];
        const modalidadFinal = canonModalidad(rest.modalidad || selectedMod);
        const docs = docsCurso.filter((documento) => {
          const dataDoc = documento.data() || {};
          const fechaDoc = dateToDMY(parseToDate(dataDoc.fecha));
          const modalidadDoc = canonModalidad(
            dataDoc.modalidad || dataDoc.modalidadDb ||
              (dataDoc.presencial === true ? 'Presencial' : 'Virtual')
          );
          return fechaDoc === fecha && modalidadDoc === modalidadFinal;
        });

        if (!docs.length && modalidadFinal === 'Virtual') {
          const cursoOption = getCursoOption('', cursoImport);
          const ahora = new Date();
          await addDoc(collection(db, 'asistencia'), {
            fecha,
            curso: cursoImport,
            cursoNombre: cursoImport,
            cursoTitulo: cursoImport,
            cursoId: cursoOption?.id || null,
            modalidad: 'virtual',
            modalidadDb: 'virtual',
            presencial: false,
            nombre: rest.nombre || '',
            apellido: rest.apellido || '',
            dni,
            departamento: rest.departamento || '',
            nivelEducativo: rest.nivelEducativo || '',
            email: rest.email || '',
            estado: 'Presente',
            estadoAsistencia: 'validada',
            estadoPresencial: 'virtual',
            asistenciaValidada: true,
            asistenciaValida: true,
            presente: true,
            ingreso: '',
            salida: '',
            ingresoFechaHora: '',
            salidaFechaHora: '',
            origen: 'importacion_excel_admin',
            archivoImportado: file.name,
            createdAt: ahora,
            updatedAt: ahora,
          });
          creados += 1;
          processed += 1;
          if (processed % step === 0 || processed === total) {
            setImportProgress(Math.round((processed / total) * 100));
          }
          continue;
        }

        if (!docs.length) {
          noEncontrados += 1;

          errores.push({
            dni,
            nombre: rest.nombre || '',
            apellido: rest.apellido || '',
            fecha: fecha || '',
            curso: cursoImport,
            motivo: 'No encontrado en asistencia para este curso (no se creó)',
          });

          processed += 1;

          if (processed % step === 0 || processed === total) {
            setImportProgress(Math.round((processed / total) * 100));
          }

          continue;
        }

        let huboUpdate = false;

        for (const dSnap of docs) {
          const current = dSnap.data() || {};
          const patch = patchOnlyEmpty(current, rest, ALLOW_KEYS);

          if (modalidadFinal === 'Virtual') {
            Object.assign(patch, {
              fecha,
              modalidad: 'virtual',
              modalidadDb: 'virtual',
              presencial: false,
              estado: 'Presente',
              estadoAsistencia: 'validada',
              estadoPresencial: 'virtual',
              asistenciaValidada: true,
              asistenciaValida: true,
              presente: true,
              origen: current.origen || 'importacion_excel_admin',
              archivoImportado: file.name,
              updatedAt: new Date(),
            });
          }

          if (Object.keys(patch).length) {
            await updateDoc(dSnap.ref, patch);
            huboUpdate = true;
          }
        }

        if (huboUpdate) actualizados += 1;
        else sinCambios += 1;

        processed += 1;

        if (processed % step === 0 || processed === total) {
          setImportProgress(Math.round((processed / total) * 100));
        }
      }

      setImportProgress(100);
      setImportStage('Listo');

      setResumenImport({
        creados,
        actualizados,
        sinCambios,
        noEncontrados,
      });

      setErroresImport(errores);
      setVisibleResultado(true);
    } catch (err) {
      console.error('importar asistencia:', err);

      setImportProgress(100);
      setImportStage('Error');

      setResumenImport({
        creados: 0,
        actualizados: 0,
        sinCambios: 0,
        noEncontrados: 0,
      });

      setErroresImport([
        {
          dni: '-',
          nombre: '-',
          apellido: '-',
          fecha: '-',
          curso: cursoImport || '-',
          motivo: err?.message || 'Error procesando el archivo',
        },
      ]);

      setVisibleResultado(true);
    } finally {
      setImporting(false);
    }
  };

  /** ---------- Export helpers ---------- */
  const slug = (s = '') =>
    String(s)
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');

  const abrirExportarExcel = () => {
    const pre = cursoAplicado || cursoSeleccionado || '';
    setExportMode('asistencia');
    setCursoExport(pre);
    setModalidadExport('*');
    setEstadoPresencialExport('*');
    setVisibleExport(true);
  };

  const abrirExportarMoodle = () => {
    const pre = cursoAplicado || cursoSeleccionado || '';
    setExportMode('moodle');
    setCursoExport(pre);
    setModalidadExport('*');
    setEstadoPresencialExport('*');
    setVisibleExport(true);
  };

  const getModalidadExportLabel = (row) => {
    if (isPresencialRow(row)) return 'Presencial';

    return canonModalidad(row?.modalidad || row?.modalidadDb) || row?.modalidad || '';
  };

  const matchesModalidadExport = (row) => {
    if (!modalidadExport || modalidadExport === '*') return true;

    if (modalidadExport === 'Presencial') {
      return isPresencialRow(row);
    }

    return getModalidadExportLabel(row) === canonModalidad(modalidadExport);
  };

  const obtenerItemsExportacion = async () => {
    const colRef = collection(db, 'asistencia');
    const docsMap = new Map();

    const consultas = [
      query(colRef, where('curso', '==', cursoExport)),
      query(colRef, where('cursoTitulo', '==', cursoExport)),
      query(colRef, where('cursoNombre', '==', cursoExport)),
    ];

    for (const qRef of consultas) {
      const qs = await getDocs(qRef);

      qs.docs.forEach((d) => {
        docsMap.set(d.id, { id: d.id, ...d.data() });
      });
    }

    return Array.from(docsMap.values()).filter((r) => {
      const modalidadOk = matchesModalidadExport(r);
      const estadoOk = matchesEstadoExport(r, estadoPresencialExport);

      return modalidadOk && estadoOk;
    });
  };

  const enriquecerItemsExportacion = async (items) => {
    const enriched = await Promise.all(
      items.map(async (r) => {
        const dni = toDniDigits(r.dni);

        const persona =
          EMPTY(r.email) ||
          EMPTY(r.departamento) ||
          EMPTY(r.nivelEducativo) ||
          EMPTY(r.nombre) ||
          EMPTY(r.apellido)
            ? await getPersonaDataCached(dni)
            : {};

        return {
          ...r,
          dni,
          modalidad: getModalidadExportLabel(r),
          email: sanitizeMissing(r.email) || sanitizeMissing(persona.email),
          departamento: sanitizeMissing(r.departamento) || sanitizeMissing(persona.departamento),
          nivelEducativo: sanitizeMissing(r.nivelEducativo) || sanitizeMissing(persona.nivelEducativo),
          nombre: sanitizeMissing(r.nombre) || sanitizeMissing(persona.nombre),
          apellido: sanitizeMissing(r.apellido) || sanitizeMissing(persona.apellido),
        };
      })
    );

    return enriched.sort((a, b) => {
      const ta = parseToDate(a.fecha)?.getTime() || 0;
      const tb = parseToDate(b.fecha)?.getTime() || 0;

      if (ta !== tb) return ta - tb;

      const apellidoA = normalizeText(deriveNombreApellido(a).apellido);
      const apellidoB = normalizeText(deriveNombreApellido(b).apellido);

      return apellidoA.localeCompare(apellidoB);
    });
  };

  const crearFilasControlAsistencia = (enriched, emailPorDni = null) =>
    enriched.map((r) => {
      const { nombre, apellido } = deriveNombreApellido(r);
      const dni = toDniDigits(r.dni);
      const estado = getEstadoPresencial(r);
      const email = emailPorDni?.get(dni) || r.email || '';

      return {
        Fecha: r.fecha || '',
        Curso: r.curso || r.cursoNombre || r.cursoTitulo || '',
        Modalidad: r.modalidad || '',
        Nombre: nombre || '',
        Apellido: apellido || '',
        DNI: dni || '',
        Departamento: r.departamento || '',
        'Nivel Educativo': r.nivelEducativo || '',
        Email: email,
        Ingreso: formatMarcaAsistencia(getIngresoRaw(r)),
        Salida: formatMarcaAsistencia(getSalidaRaw(r)),
        'Estado presencial': `${estado.label} - ${estado.detail}`,
      };
    });

  const crearFilasMoodle = (enriched) => {
    const agrupados = new Map();

    enriched.forEach((r) => {
      const dni = toDniDigits(r.dni);

      if (!dni) return;

      const { nombre, apellido } = deriveNombreApellido(r);
      const actual = agrupados.get(dni) || {
        dni,
        nombre: '',
        apellido: '',
        email: '',
      };

      if (!actual.nombre && nombre) actual.nombre = nombre;
      if (!actual.apellido && apellido) actual.apellido = apellido;
      if (!actual.email && sanitizeMissing(r.email)) actual.email = sanitizeMissing(r.email);

      agrupados.set(dni, actual);
    });

    const ordenados = Array.from(agrupados.values()).sort((a, b) => {
      const apellidos = normalizeText(a.apellido).localeCompare(normalizeText(b.apellido));

      if (apellidos !== 0) return apellidos;

      return normalizeText(a.nombre).localeCompare(normalizeText(b.nombre));
    });

    const emailPorDni = new Map();
    let contadorSinCorreo = 1;

    const moodleRows = ordenados.map((persona) => {
      const email = persona.email || `usuario${contadorSinCorreo++}@gmail.com.ar`;

      emailPorDni.set(persona.dni, email);

      return {
        firstname: persona.nombre || '',
        lastname: persona.apellido || '',
        username: persona.dni,
        password: persona.dni,
        course1: '',
        email,
      };
    });

    return {
      moodleRows,
      emailPorDni,
      correosGenerados: contadorSinCorreo - 1,
    };
  };

  const aplicarAnchos = (worksheet, widths) => {
    worksheet['!cols'] = widths.map((wch) => ({ wch }));
  };

  const descargarExcelPorCurso = async () => {
    if (!cursoExport || !String(cursoExport).trim()) {
      toast.current?.show({
        severity: 'warn',
        summary: 'Faltan datos',
        detail: 'Seleccioná el curso para exportar.',
      });

      return;
    }

    setExporting(true);

    try {
      const items = await obtenerItemsExportacion();

      if (!items.length) {
        toast.current?.show({
          severity: 'info',
          summary: 'Sin datos',
          detail: 'No hay registros para los filtros seleccionados.',
        });

        setExporting(false);
        return;
      }

      const enriched = await enriquecerItemsExportacion(items);
      const data = crearFilasControlAsistencia(enriched);
      const ws = XLSX.utils.json_to_sheet(data);
      const wb = XLSX.utils.book_new();

      aplicarAnchos(ws, [12, 34, 14, 20, 22, 14, 20, 20, 30, 22, 22, 24]);

      XLSX.utils.book_append_sheet(wb, ws, 'Asistencia');

      const now = new Date();
      const y = now.getFullYear();
      const m = String(now.getMonth() + 1).padStart(2, '0');
      const d = String(now.getDate()).padStart(2, '0');
      const hh = String(now.getHours()).padStart(2, '0');
      const mm = String(now.getMinutes()).padStart(2, '0');

      const modaSlug = modalidadExport === '*' ? 'todas' : modalidadExport.toLowerCase();
      const estadoSlug = estadoPresencialExport === '*' ? 'todos' : estadoPresencialExport;

      const filename = `asistencia_${slug(cursoExport)}_${slug(modaSlug)}_${slug(estadoSlug)}_${y}${m}${d}_${hh}${mm}.xlsx`;

      XLSX.writeFile(wb, filename);

      toast.current?.show({
        severity: 'success',
        summary: 'Descarga lista',
        detail: `Se descargó el Excel de "${cursoExport}".`,
      });

      setVisibleExport(false);
    } catch (err) {
      console.error('descargar excel:', err);

      toast.current?.show({
        severity: 'error',
        summary: 'Error',
        detail: 'No se pudo generar el Excel.',
      });
    } finally {
      setExporting(false);
    }
  };

  const descargarExcelMoodle = async () => {
    if (!cursoExport || !String(cursoExport).trim()) {
      toast.current?.show({
        severity: 'warn',
        summary: 'Faltan datos',
        detail: 'Seleccioná el curso para exportar.',
      });

      return;
    }

    setExporting(true);

    try {
      const items = await obtenerItemsExportacion();

      if (!items.length) {
        toast.current?.show({
          severity: 'info',
          summary: 'Sin datos',
          detail: 'No hay registros para los filtros seleccionados.',
        });

        setExporting(false);
        return;
      }

      const enriched = await enriquecerItemsExportacion(items);
      const { moodleRows, emailPorDni, correosGenerados } = crearFilasMoodle(enriched);

      if (!moodleRows.length) {
        toast.current?.show({
          severity: 'warn',
          summary: 'Sin DNI válidos',
          detail: 'No hay registros con DNI válido para generar la hoja Moodle.',
        });

        setExporting(false);
        return;
      }

      const controlRows = crearFilasControlAsistencia(enriched, emailPorDni);
      const wb = XLSX.utils.book_new();

      const wsMoodle = XLSX.utils.json_to_sheet(moodleRows, {
        header: ['firstname', 'lastname', 'username', 'password', 'course1', 'email'],
      });

      aplicarAnchos(wsMoodle, [22, 24, 16, 16, 14, 34]);

      const wsControl = XLSX.utils.json_to_sheet(controlRows);
      aplicarAnchos(wsControl, [12, 34, 14, 20, 22, 14, 20, 20, 30, 22, 22, 24]);

      XLSX.utils.book_append_sheet(wb, wsMoodle, 'Moodle');
      XLSX.utils.book_append_sheet(wb, wsControl, 'Control asistencia');

      const now = new Date();
      const y = now.getFullYear();
      const m = String(now.getMonth() + 1).padStart(2, '0');
      const d = String(now.getDate()).padStart(2, '0');
      const hh = String(now.getHours()).padStart(2, '0');
      const mm = String(now.getMinutes()).padStart(2, '0');

      const modaSlug = modalidadExport === '*' ? 'todas' : modalidadExport.toLowerCase();
      const estadoSlug = estadoPresencialExport === '*' ? 'todos' : estadoPresencialExport;

      const filename = `moodle_${slug(cursoExport)}_${slug(modaSlug)}_${slug(estadoSlug)}_${y}${m}${d}_${hh}${mm}.xlsx`;

      XLSX.writeFile(wb, filename);

      toast.current?.show({
        severity: 'success',
        summary: 'Excel Moodle generado',
        detail: `Usuarios únicos: ${moodleRows.length}. Correos generados: ${correosGenerados}.`,
      });

      setVisibleExport(false);
    } catch (err) {
      console.error('descargar excel moodle:', err);

      toast.current?.show({
        severity: 'error',
        summary: 'Error',
        detail: 'No se pudo generar el Excel para Moodle.',
      });
    } finally {
      setExporting(false);
    }
  };

  // ===== Templates tabla =====
  const TextCell = ({ value, lines = 2, title }) => (
    <span
      className={lines === 3 ? styles.cellClamp3 : styles.cellClamp}
      title={title || String(value || '')}
    >
      {value || '-'}
    </span>
  );

  const nombreBody = (row) => {
    const dni = toDniDigits(row.dni);
    return <TextCell value={sanitizeMissing(row.nombre) || dniJoin[dni]?.nombre || ''} />;
  };

  const apellidoBody = (row) => {
    const dni = toDniDigits(row.dni);
    return <TextCell value={sanitizeMissing(row.apellido) || dniJoin[dni]?.apellido || ''} />;
  };

  const departamentoBody = (row) => {
    const dni = toDniDigits(row.dni);
    return <TextCell value={row.departamento || dniJoin[dni]?.departamento || ''} />;
  };

  const nivelEducativoBody = (row) => {
    const dni = toDniDigits(row.dni);
    return <TextCell value={row.nivelEducativo || dniJoin[dni]?.nivelEducativo || ''} />;
  };

  const emailBody = (row) => {
    const dni = toDniDigits(row.dni);
    const value = row.email || dniJoin[dni]?.email || '';

    return (
      <span className={styles.emailCell} title={value}>
        {value || '-'}
      </span>
    );
  };

  const cursoBody = (row) => <TextCell value={row.curso || row.cursoNombre || row.cursoTitulo || ''} lines={3} />;

  const modalidadBody = (row) => <TextCell value={canonModalidad(row.modalidad) || row.modalidad || ''} />;

  const ingresoBody = (row) => {
    const value = formatMarcaAsistencia(getIngresoRaw(row));

    return (
      <span className={styles.marcaCell} title={value}>
        {value || '-'}
      </span>
    );
  };

  const salidaBody = (row) => {
    const value = formatMarcaAsistencia(getSalidaRaw(row));

    return (
      <span className={styles.marcaCell} title={value}>
        {value || '-'}
      </span>
    );
  };

  const estadoBody = (row) => {
    const estado = getEstadoPresencial(row);

    let cls = styles.badgeNeutral;

    if (estado.severity === 'success') cls = styles.badgeSi;
    if (estado.severity === 'warning') cls = styles.badgeWarn;

    return (
      <div className={styles.estadoCell}>
        <span className={cls}>{estado.label}</span>
        <small>{estado.detail}</small>
      </div>
    );
  };

  const accionesTemplate = (row) => (
    <div className={styles.actions}>
      <Button
        icon="pi pi-eye"
        rounded
        text
        aria-label="Ver"
        onClick={guardBusy(() => abrirVer(row))}
        disabled={isBusy}
      />
      <Button
        icon="pi pi-pencil"
        rounded
        text
        aria-label="Editar"
        onClick={guardBusy(() => abrirEditar(row))}
        disabled={isBusy}
      />
      <Button
        icon="pi pi-trash"
        rounded
        text
        severity="danger"
        aria-label="Borrar"
        onClick={guardBusy(() => borrar(row))}
        disabled={isBusy}
      />
    </div>
  );

  const leftToolbar = (
    <div className={styles.toolbarLeft}>
      <Button
        label="Nuevo"
        icon="pi pi-plus"
        severity="success"
        onClick={guardBusy(abrirNuevo)}
        disabled={isBusy}
      />

      <input
        ref={fileExcelRef}
        type="file"
        accept=".xlsx,.xls"
        style={{ display: 'none' }}
        onChange={handleFileChange}
      />

      <Button
        label="Importar Excel (Asistencia)"
        icon="pi pi-upload"
        onClick={guardBusy(abrirSelectorCurso)}
        loading={importing}
        className="p-button-secondary"
        disabled={isBusy}
      />

      <Button
        label="Cargar ingreso/salida masivo"
        icon="pi pi-clock"
        severity="warning"
        onClick={guardBusy(abrirIngresoSalidaMasivo)}
        disabled={isBusy || !cursoAplicado || filtroModalidad !== 'Presencial' || !filtroFecha}
        title="Requiere curso filtrado, modalidad Presencial y fecha seleccionada"
      />
    </div>
  );

  const rightToolbar = (
    <div className={styles.toolbarRight}>
      <span className="p-input-icon-left">
        <i className="pi pi-search" />
        <InputText
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          placeholder="Buscar nombre, apellido, DNI, curso, email"
          disabled={isBusy}
        />
      </span>

      <Dropdown
        value={cursoSeleccionado}
        onChange={(e) => setCursoSeleccionado(e.value)}
        options={cursosOptions}
        placeholder="Curso"
        className={styles.filterItem}
        showClear
        filter
        disabled={isBusy}
      />

      <Dropdown
        value={filtroModalidad}
        onChange={(e) => setFiltroModalidad(e.value || '*')}
        options={MODALIDAD_OPTIONS_FILTER}
        placeholder="Modalidad"
        className={styles.filterItem}
        disabled={isBusy}
      />

      <Button
        label="Filtrar"
        icon="pi pi-filter"
        onClick={guardBusy(() => {
          setCursoAplicado(cursoSeleccionado || null);
          setFirst(0);

          toast.current?.show({
            severity: 'info',
            summary: 'Filtro aplicado',
            detail: cursoSeleccionado ? `Curso: ${cursoSeleccionado}` : 'Todos los cursos',
          });
        })}
        disabled={isBusy}
      />

      <Button
        label="Descargar Excel"
        icon="pi pi-download"
        className="p-button-help"
        onClick={guardBusy(abrirExportarExcel)}
        disabled={isBusy}
      />

      <Button
        label="Descargar Moodle"
        icon="pi pi-file-excel"
        severity="success"
        onClick={guardBusy(abrirExportarMoodle)}
        disabled={isBusy}
        title="Genera un Excel con hoja Moodle y hoja Control asistencia"
      />

      <Calendar
        value={filtroFecha}
        onChange={(e) => setFiltroFecha(e.value)}
        placeholder="Fecha"
        dateFormat="dd/mm/yy"
        className={styles.filterItem}
        showIcon
        showButtonBar
        readOnlyInput
        disabled={isBusy}
      />

      <Button
        text
        label="Limpiar"
        onClick={guardBusy(() => {
          setBusqueda('');
          setFiltroFecha(null);
          setCursoSeleccionado(null);
          setCursoAplicado(null);
          setFiltroModalidad('*');
          setFirst(0);
        })}
        disabled={isBusy}
      />
    </div>
  );

  return (
    <div className={styles.container}>
      <Toast ref={toast} />
      <ConfirmDialog />

      <div className={styles.header}>
        <h2>Asistencia por curso</h2>
        <p className={styles.subtitle}>
          Gestión de asistencia por curso. En modalidad presencial se visualiza ingreso, salida y estado del registro.
        </p>
      </div>

      <Toolbar className={styles.toolbar} left={leftToolbar} right={rightToolbar} />

      <div className={styles.emailSummary}>
        <span className={styles.emailSummaryItem}>
          Usuarios únicos: <strong>{resumenCorreos.total}</strong>
        </span>

        <span className={styles.emailSummaryItem}>
          Con correo: <strong>{resumenCorreos.conEmail}</strong>
        </span>

        <span
          className={`${styles.emailSummaryItem} ${
            resumenCorreos.sinEmail > 0 ? styles.emailSummaryWarning : styles.emailSummaryOk
          }`}
        >
          Sin correo: <strong>{resumenCorreos.sinEmail}</strong>
        </span>
      </div>

      <DataTable
        key={cursoAplicado || 'all'}
        ref={dt}
        value={dataFiltrada}
        loading={loading}
        paginator
        first={first}
        onPage={(e) => setFirst(e.first)}
        rows={10}
        rowsPerPageOptions={[10, 20, 50]}
        stripedRows
        showGridlines
        emptyMessage="Sin registros"
        className={`${styles.table} ${isBusy ? styles.tableDisabled : ''}`}
        onRowDoubleClick={(e) => !isBusy && abrirVer(e.data)}
        tableStyle={{ width: '100%', tableLayout: 'fixed' }}
      >
        <Column field="fecha" header="Fecha" sortable style={{ width: '90px' }} />

        <Column
          header="Curso"
          body={cursoBody}
          sortable
          style={{ width: '125px' }}
          headerClassName={styles.hide820}
          bodyClassName={styles.hide820}
        />

        <Column header="Modalidad" body={modalidadBody} style={{ width: '95px' }} />

        <Column field="nombre" header="Nombre" sortable body={nombreBody} style={{ width: '115px' }} />

        <Column field="apellido" header="Apellido" sortable body={apellidoBody} style={{ width: '115px' }} />

        <Column field="dni" header="DNI" sortable style={{ width: '95px' }} />

        <Column
          field="departamento"
          header="Departamento"
          body={departamentoBody}
          style={{ width: '115px' }}
          headerClassName={styles.hide1250}
          bodyClassName={styles.hide1250}
        />

        <Column
          field="nivelEducativo"
          header="Nivel Educativo"
          body={nivelEducativoBody}
          style={{ width: '115px' }}
          headerClassName={styles.hide1050}
          bodyClassName={styles.hide1050}
        />

        <Column
          field="email"
          header="Email"
          sortable
          body={emailBody}
          style={{ width: '120px' }}
          headerClassName={styles.hide1450}
          bodyClassName={styles.hide1450}
        />

        <Column header="Ingreso" body={ingresoBody} style={{ width: '130px' }} />

        <Column header="Salida" body={salidaBody} style={{ width: '130px' }} />

        <Column header="Estado" body={estadoBody} style={{ width: '110px' }} />

        <Column
          header="Acciones"
          body={accionesTemplate}
          exportable={false}
          style={{ width: '100px', textAlign: 'center' }}
        />
      </DataTable>

      {/* Modal carga masiva ingreso/salida */}
      <Dialog
        header="Cargar ingreso/salida masivo"
        visible={visibleMasivo}
        style={{ width: 640, maxWidth: '95vw' }}
        modal
        onHide={() => setVisibleMasivo(false)}
      >
        <div className={styles.detailSection}>
          <h3 className={styles.detailTitle}>Filtros obligatorios aplicados</h3>
          <div className={styles.formGrid}>
            <div className={styles.formRow}>
              <label>Curso</label>
              <div>{cursoAplicado || '-'}</div>
            </div>

            <div className={styles.formRow}>
              <label>Fecha</label>
              <div>{filtroFecha ? dateToDMY(filtroFecha) : '-'}</div>
            </div>

            <div className={styles.formRow}>
              <label>Modalidad</label>
              <div>Presencial</div>
            </div>

            <div className={styles.formRow}>
              <label>Registros a actualizar</label>
              <div><strong>{registrosObjetivoMasivo.length}</strong></div>
            </div>
          </div>
          <small className={styles.helpText}>
            Esta acción solo toma registros existentes en asistencia para el curso, la fecha y la modalidad presencial.
            No crea asistencias nuevas.
          </small>
        </div>

        <div className={styles.formGrid}>
          <div className={styles.formRow}>
            <label>Ingreso</label>
            <Calendar
              value={ingresoMasivo}
              onChange={(e) => setIngresoMasivo(e.value)}
              dateFormat="dd/mm/yy"
              showTime
              hourFormat="24"
              showIcon
              showButtonBar
              placeholder="Fecha y hora de ingreso"
              disabled={savingMasivo}
            />
          </div>

          <div className={styles.formRow}>
            <label>Salida</label>
            <Calendar
              value={salidaMasivo}
              onChange={(e) => setSalidaMasivo(e.value)}
              dateFormat="dd/mm/yy"
              showTime
              hourFormat="24"
              showIcon
              showButtonBar
              placeholder="Fecha y hora de salida"
              disabled={savingMasivo}
            />
          </div>

          <div className={styles.formRowFull}>
            <label>Actualizar marcas existentes</label>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              <InputSwitch
                checked={sobrescribirMarcas}
                onChange={(e) => setSobrescribirMarcas(e.value)}
                disabled={savingMasivo}
              />
              <span>
                {sobrescribirMarcas
                  ? 'Sí, reemplazar ingreso/salida aunque ya existan.'
                  : 'No, solo completar ingreso/salida cuando falten.'}
              </span>
            </div>
            <small className={styles.helpText}>
              Recomendado: dejar desactivado para no pisar registros cargados desde QR o editados manualmente. Podés cargar solo ingreso, solo salida o ambos.
            </small>
          </div>
        </div>

        <div className={styles.dialogActions}>
          <Button
            label="Guardar carga masiva"
            icon="pi pi-check"
            severity="success"
            onClick={cargarIngresoSalidaMasivo}
            loading={savingMasivo}
            disabled={savingMasivo || (!ingresoMasivo && !salidaMasivo) || registrosObjetivoMasivo.length === 0}
          />
          <Button
            label="Cancelar"
            icon="pi pi-times"
            severity="danger"
            onClick={() => setVisibleMasivo(false)}
            disabled={savingMasivo}
          />
        </div>
      </Dialog>

      {/* Modal Alta/Edición */}
      <Dialog
        header={editandoId ? 'Editar registro' : 'Nuevo registro'}
        visible={visibleDialog}
        style={{ width: 720, maxWidth: '95vw' }}
        modal
        onHide={() => setVisibleDialog(false)}
      >
        <div className={styles.formGrid}>
          <div className={styles.formRow}>
            <label>Fecha</label>
            <Calendar
              value={form.fecha}
              onChange={(e) => setForm((f) => ({ ...f, fecha: e.value }))}
              dateFormat="dd/mm/yy"
              showIcon
              readOnlyInput
            />
          </div>

          <div className={styles.formRow}>
            <label>Modalidad</label>
            <Dropdown
              value={form.modalidad}
              onChange={(e) =>
                setForm((f) => ({
                  ...f,
                  modalidad: e.value,
                  ingreso: e.value === 'Presencial' ? f.ingreso : null,
                  salida: e.value === 'Presencial' ? f.salida : null,
                }))
              }
              options={MODALIDAD_OPTIONS}
              placeholder="Seleccionar"
              showClear
            />
          </div>

          <div className={styles.formRowFull}>
            <label>Curso</label>
            <Dropdown
              value={form.cursoId}
              onChange={(e) => {
                const selected = cursosFormOptions.find((c) => c.value === e.value);

                setForm((f) => ({
                  ...f,
                  cursoId: selected?.id || '',
                  curso: selected?.titulo || '',
                }));
              }}
              options={cursosFormOptions}
              optionLabel="label"
              optionValue="value"
              placeholder="Seleccionar curso"
              filter
              showClear
              className="w-full"
            />
            <small className={styles.helpText}>
              Seleccioná el curso desde la colección <strong>cursos</strong>. Esto guarda el <strong>cursoId</strong> real para habilitar la constancia.
            </small>
          </div>

          <div className={styles.formRowFull}>
            <label>DNI</label>
            <div className={styles.dniValidationRow}>
              <InputText
                value={form.dni}
                onChange={(e) => setForm((f) => ({ ...f, dni: toDniDigits(e.target.value) }))}
                placeholder="Ingrese DNI y valide"
              />
              <Button
                label="Validar DNI"
                icon="pi pi-search"
                severity="info"
                onClick={validarDniFormulario}
                loading={validatingDni}
                disabled={validatingDni || !form.dni}
              />
            </div>
            <small className={styles.helpText}>
              Busca primero en <strong>usuarios</strong> y luego en <strong>nuevoAfiliado</strong>.
            </small>
          </div>

          <div className={styles.formRow}>
            <label>Nombre</label>
            <InputText
              value={form.nombre}
              onChange={(e) => setForm((f) => ({ ...f, nombre: e.target.value }))}
            />
          </div>

          <div className={styles.formRow}>
            <label>Apellido</label>
            <InputText
              value={form.apellido}
              onChange={(e) => setForm((f) => ({ ...f, apellido: e.target.value }))}
            />
          </div>

          <div className={styles.formRow}>
            <label>Departamento</label>
            <InputText
              value={form.departamento}
              onChange={(e) => setForm((f) => ({ ...f, departamento: e.target.value }))}
            />
          </div>

          <div className={styles.formRow}>
            <label>Nivel Educativo</label>
            <InputText
              value={form.nivelEducativo}
              onChange={(e) => setForm((f) => ({ ...f, nivelEducativo: e.target.value }))}
            />
          </div>

          <div className={styles.formRow}>
            <label>Email</label>
            <InputText
              type="email"
              value={form.email}
              onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
              placeholder="ej: usuario@dominio.com"
            />
          </div>

          {canonModalidad(form.modalidad) === 'Presencial' && (
            <>
              <div className={styles.formRow}>
                <label>Ingreso</label>
                <Calendar
                  value={form.ingreso}
                  onChange={(e) => setForm((f) => ({ ...f, ingreso: e.value }))}
                  dateFormat="dd/mm/yy"
                  showTime
                  hourFormat="24"
                  showIcon
                  showButtonBar
                  placeholder="Fecha y hora de ingreso"
                />
              </div>

              <div className={styles.formRow}>
                <label>Salida</label>
                <Calendar
                  value={form.salida}
                  onChange={(e) => setForm((f) => ({ ...f, salida: e.value }))}
                  dateFormat="dd/mm/yy"
                  showTime
                  hourFormat="24"
                  showIcon
                  showButtonBar
                  placeholder="Fecha y hora de salida"
                />
              </div>
            </>
          )}
        </div>

        <div className={styles.dialogActions}>
          <Button
            label="Guardar"
            icon="pi pi-check"
            severity="success"
            onClick={guardar}
            loading={saving}
          />
          <Button
            label="Cancelar"
            icon="pi pi-times"
            severity="danger"
            onClick={() => setVisibleDialog(false)}
            disabled={saving}
          />
        </div>
      </Dialog>

      {/* Modal Ver */}
      <Dialog
        header="Detalle de asistencia"
        visible={visibleVer}
        style={{ width: 720, maxWidth: '95vw' }}
        modal
        onHide={() => setVisibleVer(false)}
      >
        {rowVer ? (
          <>
            <div className={styles.detailSection}>
              <h3 className={styles.detailTitle}>Datos del docente</h3>

              <div className={styles.formGrid}>
                <div className={styles.formRow}>
                  <label>Nombre</label>
                  <div>{sanitizeMissing(rowVer.nombre) || dniJoin[toDniDigits(rowVer.dni)]?.nombre || '-'}</div>
                </div>

                <div className={styles.formRow}>
                  <label>Apellido</label>
                  <div>{sanitizeMissing(rowVer.apellido) || dniJoin[toDniDigits(rowVer.dni)]?.apellido || '-'}</div>
                </div>

                <div className={styles.formRow}>
                  <label>DNI</label>
                  <div>{rowVer.dni || '-'}</div>
                </div>

                <div className={styles.formRow}>
                  <label>Departamento</label>
                  <div>{rowVer.departamento || dniJoin[toDniDigits(rowVer.dni)]?.departamento || '-'}</div>
                </div>

                <div className={styles.formRow}>
                  <label>Nivel Educativo</label>
                  <div>{rowVer.nivelEducativo || dniJoin[toDniDigits(rowVer.dni)]?.nivelEducativo || '-'}</div>
                </div>

                <div className={styles.formRow}>
                  <label>Email</label>
                  <div>{rowVer.email || dniJoin[toDniDigits(rowVer.dni)]?.email || '-'}</div>
                </div>
              </div>
            </div>

            <div className={styles.detailSection}>
              <h3 className={styles.detailTitle}>Registro de asistencia</h3>

              <div className={styles.formGrid}>
                <div className={styles.formRow}>
                  <label>Fecha</label>
                  <div>{rowVer.fecha || '-'}</div>
                </div>

                <div className={styles.formRow}>
                  <label>Modalidad</label>
                  <div>{canonModalidad(rowVer.modalidad) || '-'}</div>
                </div>

                <div className={styles.formRowFull}>
                  <label>Curso</label>
                  <div>{rowVer.curso || rowVer.cursoNombre || rowVer.cursoTitulo || '-'}</div>
                </div>

                <div className={styles.formRow}>
                  <label>Ingreso</label>
                  <div>{formatMarcaAsistencia(getIngresoRaw(rowVer)) || '-'}</div>
                </div>

                <div className={styles.formRow}>
                  <label>Salida</label>
                  <div>{formatMarcaAsistencia(getSalidaRaw(rowVer)) || '-'}</div>
                </div>

                <div className={styles.formRowFull}>
                  <label>Estado</label>
                  {(() => {
                    const estado = getEstadoPresencial(rowVer);
                    let cls = styles.badgeNeutral;

                    if (estado.severity === 'success') cls = styles.badgeSi;
                    if (estado.severity === 'warning') cls = styles.badgeWarn;

                    return (
                      <div className={styles.estadoDetalle}>
                        <span className={cls}>{estado.label}</span>
                        <strong>{estado.detail}</strong>
                      </div>
                    );
                  })()}
                </div>
              </div>
            </div>
          </>
        ) : (
          <p>Sin datos.</p>
        )}

        <div className={styles.dialogActions}>
          <Button label="Cerrar" icon="pi pi-times" onClick={() => setVisibleVer(false)} />
        </div>
      </Dialog>

      {/* Modal seleccionar curso/modalidad antes de importar */}
      <Dialog
        header="Seleccionar curso y modalidad a actualizar"
        visible={visibleSelCurso}
        style={{ width: 520, maxWidth: '95vw' }}
        modal
        onHide={() => setVisibleSelCurso(false)}
      >
        <div className={styles.formGrid}>
          <div className={styles.formRowFull}>
            <label>Curso</label>
            <Dropdown
              value={cursoImport}
              onChange={(e) => setCursoImport(e.value)}
              options={cursosExportOptions}
              placeholder="Elegí un curso"
              filter
              showClear
              className="w-full"
              disabled={cursosExportOptions.length === 0 || isBusy}
            />

            {cursosExportOptions.length === 0 && (
              <small style={{ opacity: 0.8 }}>
                No se encontraron cursos disponibles.
              </small>
            )}
          </div>

          <div className={styles.formRowFull}>
            <label>Modalidad de importación</label>
            <Dropdown
              value={modalidadImport}
              onChange={(e) => setModalidadImport(e.value)}
              options={MODALIDAD_OPTIONS}
              placeholder="Elegí la modalidad"
              className="w-full"
              disabled={isBusy}
            />
          </div>

          <div className={styles.formRowFull}>
            <label>Fecha de asistencia</label>
            <Calendar
              value={fechaImport}
              onChange={(e) => setFechaImport(e.value)}
              dateFormat="dd/mm/yy"
              showIcon
              placeholder="Seleccioná la fecha"
              className="w-full"
              disabled={isBusy}
            />
            <small style={{ opacity: 0.8 }}>
              Esta fecha se aplicará a todos los registros del archivo.
            </small>
          </div>
        </div>

        <div className={styles.dialogActions}>
          <Button
            label="Continuar"
            icon="pi pi-check"
            severity="success"
            onClick={continuarSeleccionCurso}
            disabled={!cursoImport || !String(cursoImport).trim() || !modalidadImport || !fechaImport || isBusy}
          />
          <Button
            label="Cancelar"
            icon="pi pi-times"
            severity="danger"
            onClick={() => setVisibleSelCurso(false)}
            disabled={isBusy}
          />
        </div>
      </Dialog>

      {/* Modal exportar */}
      <Dialog
        header={exportMode === 'moodle' ? 'Descargar Excel para Moodle' : 'Descargar Excel por curso'}
        visible={visibleExport}
        style={{ width: 620, maxWidth: '95vw' }}
        modal
        onHide={() => setVisibleExport(false)}
      >
        <div className={styles.formGrid}>
          <div className={styles.formRowFull}>
            <label>Curso</label>
            <Dropdown
              value={cursoExport}
              onChange={(e) => setCursoExport(e.value)}
              options={cursosExportOptions}
              placeholder="Elegí un curso"
              filter
              showClear
              className="w-full"
              disabled={cursosExportOptions.length === 0 || isBusy}
            />

            {cursosExportOptions.length === 0 && (
              <small style={{ opacity: 0.8 }}>
                No hay cursos disponibles para exportar.
              </small>
            )}
          </div>

          <div className={styles.formRow}>
            <label>Modalidad</label>
            <Dropdown
              value={modalidadExport}
              onChange={(e) => setModalidadExport(e.value)}
              options={MODALIDAD_OPTIONS_EXPORT}
              placeholder="Elegí la modalidad"
              className="w-full"
              disabled={isBusy}
            />
          </div>

          <div className={styles.formRow}>
            <label>Estado presencial</label>
            <Dropdown
              value={estadoPresencialExport}
              onChange={(e) => setEstadoPresencialExport(e.value)}
              options={ESTADO_PRESENCIAL_OPTIONS_EXPORT}
              placeholder="Estado"
              className="w-full"
              disabled={isBusy}
            />
          </div>

          {exportMode === 'moodle' && (
            <div className={styles.formRowFull}>
              <small className={styles.helpText}>
                La descarga para Moodle genera dos hojas: <strong>Moodle</strong> con una sola fila por DNI
                y <strong>Control asistencia</strong> con el detalle completo. Si falta el correo, se genera
                automáticamente como <strong>usuario1@gmail.com.ar</strong>, <strong>usuario2@gmail.com.ar</strong>, etc.
                El campo <strong>course1</strong> queda vacío y la contraseña es el DNI sin puntos.
              </small>
            </div>
          )}
        </div>

        <div className={styles.dialogActions}>
          <Button
            label={exportMode === 'moodle' ? 'Descargar Moodle' : 'Descargar'}
            icon="pi pi-download"
            severity="success"
            onClick={exportMode === 'moodle' ? descargarExcelMoodle : descargarExcelPorCurso}
            disabled={!cursoExport || !String(cursoExport).trim() || isBusy}
            loading={exporting}
          />
          <Button
            label="Cancelar"
            icon="pi pi-times"
            severity="danger"
            onClick={() => setVisibleExport(false)}
            disabled={exporting || isBusy}
          />
        </div>
      </Dialog>

      {/* Modal resultado importación */}
      <Dialog
        header="Resultado de la importación"
        visible={visibleResultado}
        style={{ width: 760, maxWidth: '95vw' }}
        modal
        onHide={() => {
          setVisibleResultado(false);
          setImportProgress(0);
          setImportStage('');
        }}
      >
        <div style={{ marginBottom: 12 }}>
          {erroresImport.length === 0 ? (
            <div>
              <h3 style={{ marginTop: 0 }}>¡Actualización completada! ✅</h3>
              <p>
                Curso: <strong>{cursoImport}</strong>
                <br />
                Modalidad aplicada: <strong>{modalidadImport}</strong>
                <br />
                Fecha aplicada: <strong>{dateToDMY(fechaImport)}</strong>
                <br />
                Creados: <strong>{resumenImport.creados}</strong> · Actualizados:{' '}
                <strong>{resumenImport.actualizados}</strong> · Sin cambios:{' '}
                <strong>{resumenImport.sinCambios}</strong> · No encontrados:{' '}
                <strong>{resumenImport.noEncontrados}</strong>
              </p>
            </div>
          ) : (
            <div>
              <h3 style={{ marginTop: 0 }}>Importación con incidencias ⚠️</h3>
              <p>
                Curso: <strong>{cursoImport}</strong>
                <br />
                Modalidad aplicada: <strong>{modalidadImport}</strong>
                <br />
                Fecha aplicada: <strong>{dateToDMY(fechaImport)}</strong>
                <br />
                Creados: <strong>{resumenImport.creados}</strong> · Actualizados:{' '}
                <strong>{resumenImport.actualizados}</strong> · Sin cambios:{' '}
                <strong>{resumenImport.sinCambios}</strong> · No encontrados:{' '}
                <strong>{resumenImport.noEncontrados}</strong>
                <br />
                Errores: <strong>{erroresImport.length}</strong>
              </p>

              <DataTable value={erroresImport} size="small" rows={7} paginator showGridlines stripedRows>
                <Column field="dni" header="DNI" />
                <Column field="nombre" header="Nombre" />
                <Column field="apellido" header="Apellido" />
                <Column field="fecha" header="Fecha" />
                <Column field="curso" header="Curso" />
                <Column field="motivo" header="Motivo / Error" />
              </DataTable>
            </div>
          )}
        </div>

        <div className={styles.dialogActions}>
          <Button
            label="Cerrar"
            icon="pi pi-times"
            onClick={() => {
              setVisibleResultado(false);
              setImportProgress(0);
              setImportStage('');
            }}
          />
        </div>
      </Dialog>

      {/* Overlay importación */}
      {importing && (
        <div className={styles.blocker} aria-live="polite" role="status">
          <div className={styles.blockCard}>
            <div style={{ marginBottom: 8, fontWeight: 600 }}>Importando datos…</div>
            <ProgressBar value={importProgress} style={{ width: 360 }} />
            <div style={{ marginTop: 8, fontSize: 13, opacity: 0.85 }}>
              {importStage || 'Procesando…'} ({importProgress}%)
            </div>
            <div style={{ marginTop: 6, fontSize: 12, color: '#6b7280', textAlign: 'center' }}>
              Por favor, no cierres esta ventana ni cambies de opción hasta finalizar.
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ListaAsistencia;
