import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Button } from 'primereact/button';
import { Dialog } from 'primereact/dialog';
import { Toast } from 'primereact/toast';
import { InputText } from 'primereact/inputtext';
import { Dropdown } from 'primereact/dropdown';
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
// Para exportación agregar “Todas”
const MODALIDAD_OPTIONS_EXPORT = [
  { label: 'Todas', value: '*' },
  ...MODALIDAD_OPTIONS,
];

/** ---------- Utils fecha ---------- */
const parseToDate = (value) => {
  if (!value) return null;
  if (value instanceof Date) return value;
  const s = String(value).trim();

  if (/^\d{4}-\d{1,2}-\d{1,2}$/.test(s)) {
    const [y, m, d] = s.split('-').map(Number);
    return new Date(y, (m || 1) - 1, d || 1);
  }

  if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(s)) {
    const [d, m, y] = s.split('/').map(Number);
    return new Date(y, m - 1, d);
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
  (t ?? '').toString().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
const canonModalidad = (val) => {
  if (val == null) return '';
  const v = String(val).trim().toLowerCase();
  if (v.startsWith('pre')) return 'Presencial';
  if (v.startsWith('vir')) return 'Virtual';
  return '';
};
const toDniDigits = (dni) => String(dni ?? '').replace(/\D/g, '');

/** ---------- Vacío ---------- */
const EMPTY = (v) =>
  v === undefined ||
  v === null ||
  (typeof v === 'string' && v.trim() === '') ||
  (Array.isArray(v) && v.length === 0);

/** Placeholders típicos que significan "no hay dato" */
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
  const entries = allowKeys ? Object.entries(incoming).filter(([k]) => allowKeys.includes(k)) : Object.entries(incoming);
  for (const [k, v] of entries) {
    const cur = currentData?.[k];
    if (EMPTY(cur) && !EMPTY(v)) patch[k] = v;
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

/**
 * Deriva nombre y apellido para exportar:
 * - Trata "Sin apellido"/"Sin nombre" como vacío.
 * - Si uno de los campos está vacío o es placeholder y el otro tiene "Apellido, Nombre", separa.
 * - Limpia placeholders en el resultado final.
 */
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
  }

  return { nombre: sanitizeMissing(nombre), apellido: sanitizeMissing(apellido) };
};

/** ---------- Mapeo encabezados Excel -> campos asistencia ---------- */
const headerMapAsistencia = (hRaw) => {
  const h = normalizeText(hRaw).replace(/\s+/g, ' ').trim();
  const map = {
    // Fecha
    'fecha': 'fecha',
    'dia': 'fecha',
    'marca temporal': 'fecha', // Google Forms

    // Modalidad/Curso
    'mod': 'modalidad',
    'modalidad': 'modalidad',
    'curso': 'curso',
    'titulo del curso': 'curso',

    // Identificación
    'dni': 'dni',
    'documento': 'dni',
    'nro documento': 'dni',
    'dni nro': 'dni',

    // Persona
    'nombre': 'nombre',
    'nombre/s': 'nombre',
    'apellido': 'apellido',
    'apellido/s': 'apellido',
    'apellido, nombre': 'apenom',
    'apellido y nombre': 'apenom',
    'nombre y apellido': 'apenom',
    'apenom': 'apenom',
    'ayn': 'apenom',
    'nya': 'apenom',

    // Contacto/Ubicación
    'departamento': 'departamento',
    'depto': 'departamento',
    'dep': 'departamento',
    'email': 'email',
    'correo': 'email',
    'mail': 'email',
    'e-mail': 'email',
    'direccion de correo electronico': 'email',

    // Nivel
    'nivel educativo': 'nivelEducativo',
    'nivel': 'nivelEducativo',
  };
  return map[h] || null;
};

/** ---------- Normalizar fila de asistencia ---------- */
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

/** 👉 Buscar TODOS los docs por DNI+Curso (sin importar fecha) */
async function findAsistenciaDocsByDniCurso(dni, curso) {
  const col = collection(db, 'asistencia');
  const qs = await getDocs(query(col, where('dni', '==', dni), where('curso', '==', curso)));
  return qs.docs || [];
}

/** ---------- Leer 'nuevoAfiliado' por DNI ---------- */
async function getNuevoAfiliadoByDni(dni) {
  const colRef = collection(db, 'nuevoAfiliado');
  let qs = await getDocs(query(colRef, where('dni', '==', dni)));
  if (!qs.empty) return qs.docs[0].data();
  const n = Number(dni);
  if (!Number.isNaN(n)) {
    qs = await getDocs(query(colRef, where('dni', '==', n)));
    if (!qs.empty) return qs.docs[0].data();
  }
  return null;
}

/** ---------- Pick robusto ---------- */
const pickAfiliadoFields = (data) => {
  if (!data) return { email: '', departamento: '', nivelEducativo: '', nombre: '', apellido: '' };
  const getFirst = (...keys) => {
    for (const k of keys) {
      if (data[k] != null && String(data[k]).trim() !== '') return String(data[k]).trim();
    }
    return '';
  };
  const email = getFirst('email', 'Email', 'correo', 'Correo', 'mail', 'Mail', 'e-mail', 'E-mail');
  const departamento = getFirst('departamento', 'Departamento', 'depto', 'Depto', 'dep', 'Dep');
  const nivelEducativo = getFirst('nivelEducativo', 'NivelEducativo', 'nivel', 'Nivel', 'nivel_educativo', 'Nivel_Educativo');
  const nombre = getFirst('nombre', 'Nombre');
  const apellido = getFirst('apellido', 'Apellido');
  return { email, departamento, nivelEducativo, nombre, apellido };
};

const ListaAsistencia = () => {
  const toast = useRef(null);

  // cache DNI -> datos de nuevoAfiliado
  const afiliadoCacheRef = useRef(new Map());
  const getAfiliadoDataCached = async (dni) => {
    const key = String(dni || '').trim();
    if (!key) return { email: '', departamento: '', nivelEducativo: '', nombre: '', apellido: '' };
    if (afiliadoCacheRef.current.has(key)) return afiliadoCacheRef.current.get(key);
    const raw = await getNuevoAfiliadoByDni(key);
    const picked = pickAfiliadoFields(raw);
    afiliadoCacheRef.current.set(key, picked);
    return picked;
  };

  // ------------------- Datos base -------------------
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);

  // ------------------- Filtros cliente -------------------
  const [busqueda, setBusqueda] = useState('');
  const [filtroFecha, setFiltroFecha] = useState(null);

  // ------------------- Cursos (dropdown derecha - desde asistencia) -------------------
  const [cursosOptions, setCursosOptions] = useState([]);
  const [cursoSeleccionado, setCursoSeleccionado] = useState(null);
  const [cursoAplicado, setCursoAplicado] = useState(null);

  // ------------------- Lista de cursos (modal importar/exportar - desde 'cursos') -------------------
  const [cursosListaOptions, setCursosListaOptions] = useState([]);

  // ------------------- Paginación -------------------
  const [first, setFirst] = useState(0);

  // ------------------- Modal (alta/edición) -------------------
  const [visibleDialog, setVisibleDialog] = useState(false);
  const [editandoId, setEditandoId] = useState(null);
  const [form, setForm] = useState({
    fecha: new Date(),
    modalidad: '',
    curso: '',
    nombre: '',
    apellido: '',
    dni: '',
    departamento: '',
    nivelEducativo: '',
    email: '',
  });
  const [saving, setSaving] = useState(false);

  // ------------------- Modal Ver (solo lectura) -------------------
  const [visibleVer, setVisibleVer] = useState(false);
  const [rowVer, setRowVer] = useState(null);

  // ------------------- Importar Excel (asistencia) -------------------
  const [importing, setImporting] = useState(false);
  const fileExcelRef = useRef(null);
  const [importProgress, setImportProgress] = useState(0);   // 0–100
  const [importStage, setImportStage] = useState('');        // texto de etapa

  // Selección de curso y modalidad para importar
  const [visibleSelCurso, setVisibleSelCurso] = useState(false);
  const [cursoImport, setCursoImport] = useState('');
  const [modalidadImport, setModalidadImport] = useState(''); // 👈 nueva selección requerida

  // Resultado de importación
  const [visibleResultado, setVisibleResultado] = useState(false);
  const [resumenImport, setResumenImport] = useState({ creados: 0, actualizados: 0, sinCambios: 0, noEncontrados: 0 });
  const [erroresImport, setErroresImport] = useState([]); // [{dni, nombre, apellido, fecha, curso, motivo}]

  // ------------------- Exportar Excel por curso -------------------
  const [visibleExport, setVisibleExport] = useState(false);
  const [cursoExport, setCursoExport] = useState('');
  const [modalidadExport, setModalidadExport] = useState('*'); // por defecto “Todas”
  const [exporting, setExporting] = useState(false);

  // ====== Bloqueo de UI durante importación ======
  const isBusy = importing;
  useEffect(() => {
    if (!isBusy) return;
    const onBeforeUnload = (e) => { e.preventDefault(); e.returnValue = ''; };
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

  // ===== Cursos (para filtros - desde asistencia) =====
  useEffect(() => {
    const base = collection(db, 'asistencia');
    const unsub = onSnapshot(
      base,
      (snap) => {
        const setCursos = new Set();
        snap.forEach((d) => {
          const c = d.data()?.curso;
          if (c) setCursos.add(c);
        });
        setCursosOptions(Array.from(setCursos).sort().map((c) => ({ label: c, value: c })));
      },
      (err) => console.error('cursos (onSnapshot):', err)
    );
    return () => unsub();
  }, []);

  // ===== Cursos (para modal importar/exportar - desde colección 'cursos') =====
  useEffect(() => {
    const colRef = collection(db, 'cursos');
    const unsub = onSnapshot(
      colRef,
      (snap) => {
        const nombres = snap.docs
          .map((d) => {
            const data = d.data() || {};
            return data.titulo || data.nombre || data.name || data.curso || data.tituloCurso || '';
          })
          .map((s) => (s || '').toString().trim())
          .filter(Boolean);
        const uniqueSorted = Array.from(new Set(nombres)).sort((a, b) => a.localeCompare(b));
        setCursosListaOptions(uniqueSorted.map((n) => ({ label: n, value: n })));
      },
      (err) => console.error('cursos (modal) onSnapshot:', err)
    );
    return () => unsub();
  }, []);

  // ===== Asistencia (lista principal) =====
  useEffect(() => {
    setLoading(true);
    const base = collection(db, 'asistencia');
    const qy = cursoAplicado ? query(base, where('curso', '==', cursoAplicado)) : base;

    const unsub = onSnapshot(
      qy,
      (snap) => {
        const data = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        setRows(data);
        setLoading(false);
      },
      (err) => {
        console.error('asistencia (onSnapshot):', err);
        toast.current?.show({ severity: 'error', summary: 'Error', detail: 'No se pudo leer la asistencia.' });
        setLoading(false);
      }
    );

    return () => unsub();
  }, [cursoAplicado]);

  // Reset paginación cuando cambia el filtro aplicado
  useEffect(() => { setFirst(0); }, [cursoAplicado]);

  // ===== Autocompletar en formulario cuando cambia el DNI =====
  useEffect(() => {
    const run = async () => {
      const dni = toDniDigits(form.dni);
      if (!dni) return;
      const a = await getAfiliadoDataCached(dni);
      const updates = {};
      if (!form.email?.trim() && a.email) updates.email = a.email;
      if (!form.departamento?.trim() && a.departamento) updates.departamento = a.departamento;
      if (!form.nivelEducativo?.trim() && a.nivelEducativo) updates.nivelEducativo = a.nivelEducativo;
      if (Object.keys(updates).length) setForm((f) => ({ ...f, ...updates }));
    };
    run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.dni]);

  /** ===== Join en vivo por DNI para mostrar email/departamento/nivel aunque no estén guardados ===== */
  const [dniJoin, setDniJoin] = useState({});
  useEffect(() => {
    const fetchMissing = async () => {
      const toFetch = new Set();
      rows.forEach((r) => {
        const dni = toDniDigits(r.dni);
        if (!dni) return;
        const need =
          EMPTY(r.email) || EMPTY(r.departamento) || EMPTY(r.nivelEducativo);
        if (need && !dniJoin[dni]) toFetch.add(dni);
      });
      if (toFetch.size === 0) return;
      const updates = {};
      for (const dni of toFetch) {
        updates[dni] = await getAfiliadoDataCached(dni);
      }
      if (Object.keys(updates).length) {
        setDniJoin((prev) => ({ ...prev, ...updates }));
      }
    };
    fetchMissing();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows]);

  // ===== Derivados: filtro texto/fecha + orden por fecha desc =====
  const dataFiltrada = useMemo(() => {
    const s = normalizeText(busqueda).trim();

    const filtrada = rows.filter((r) => {
      const dni = toDniDigits(r.dni);
      const joined = dniJoin[dni] || {};
      const txt = normalizeText(
        `${r.nombre || ''} ${r.apellido || ''} ${r.dni || ''} ${r.curso || ''} ${(r.departamento || joined.departamento) || ''} ${(r.nivelEducativo || joined.nivelEducativo) || ''} ${(r.email || joined.email) || ''}`
      );
      const okTexto = s === '' || txt.includes(s);

      const fechaRow = parseToDate(r.fecha);
      const okFecha = !filtroFecha || (fechaRow && sameDay(fechaRow, filtroFecha));

      return okTexto && okFecha;
    });

    const toTime = (f) => parseToDate(f)?.getTime() || 0;
    return filtrada.sort((a, b) => toTime(b.fecha) - toTime(a.fecha));
  }, [rows, busqueda, filtroFecha, dniJoin]);

  // ===== CRUD asistencia =====
  const abrirNuevo = () => {
    setEditandoId(null);
    setForm({
      fecha: new Date(),
      modalidad: '',
      curso: '',
      nombre: '',
      apellido: '',
      dni: '',
      departamento: '',
      nivelEducativo: '',
      email: '',
    });
    setVisibleDialog(true);
  };

  const abrirEditar = (row) => {
    const rawModalidad = row.modalidad ?? row.Modalidad ?? '';
    const dni = toDniDigits(row.dni);
    const join = dniJoin[dni] || {};
    setEditandoId(row.id);
    setForm({
      fecha: parseToDate(row.fecha) || new Date(),
      modalidad: canonModalidad(rawModalidad),
      curso: row.curso || '',
      nombre: row.nombre || '',
      apellido: row.apellido || '',
      dni: row.dni || '',
      departamento: row.departamento || join.departamento || '',
      nivelEducativo: row.nivelEducativo || join.nivelEducativo || '',
      email: row.email || join.email || '',
    });
    setVisibleDialog(true);
  };

  const guardar = async () => {
    const faltan = [];
    if (!form.curso?.trim()) faltan.push('Curso');
    if (!form.nombre?.trim()) faltan.push('Nombre');
    if (!form.apellido?.trim()) faltan.push('Apellido');
    if (!form.dni?.trim()) faltan.push('DNI');
    if (!form.fecha) faltan.push('Fecha');

    if (faltan.length) {
      toast.current?.show({ severity: 'warn', summary: 'Datos incompletos', detail: `Faltan: ${faltan.join(', ')}` });
      return;
    }

    try {
      setSaving(true);

      const dniNum = toDniDigits(form.dni);
      const a = await getAfiliadoDataCached(dniNum);

      const payload = {
        fecha: dateToDMY(form.fecha),
        modalidad: canonModalidad(form.modalidad),
        curso: form.curso.trim(),
        nombre: form.nombre.trim(),
        apellido: form.apellido.trim(),
        dni: dniNum,
        departamento: (form.departamento || a.departamento || '').trim(),
        nivelEducativo: (form.nivelEducativo || a.nivelEducativo || '').trim(),
        email: (form.email || a.email || '').trim(),
      };

      if (editandoId) {
        await updateDoc(doc(db, 'asistencia', editandoId), payload);
        toast.current?.show({ severity: 'success', summary: 'Actualizado', detail: 'Registro actualizado.' });
      } else {
        // Alta manual sigue permitida
        const ex = await findAsistenciaDoc(payload.dni, payload.curso, payload.fecha);
        if (ex) {
          const patch = patchOnlyEmpty(ex.data() || {}, payload, ['nombre', 'apellido', 'email', 'departamento', 'nivelEducativo', 'modalidad']);
          if (Object.keys(patch).length) {
            await updateDoc(ex.ref, patch);
            toast.current?.show({ severity: 'success', summary: 'Completado', detail: 'Se completaron campos vacíos.' });
          } else {
            toast.current?.show({ severity: 'info', summary: 'Sin cambios', detail: 'Ya existía ese registro.' });
          }
        } else {
          await addDoc(collection(db, 'asistencia'), payload);
          toast.current?.show({ severity: 'success', summary: 'Guardado', detail: 'Registro agregado.' });
        }
      }
      setVisibleDialog(false);
    } catch (err) {
      console.error('guardar asistencia:', err);
      toast.current?.show({ severity: 'error', summary: 'Error', detail: 'No se pudo guardar.' });
    } finally {
      setSaving(false);
    }
  };

  const borrar = async (row) => {
    try {
      await deleteDoc(doc(db, 'asistencia', row.id));
      toast.current?.show({ severity: 'success', summary: 'Eliminado', detail: 'Registro borrado.' });
    } catch (err) {
      console.error('borrar asistencia:', err);
      toast.current?.show({ severity: 'error', summary: 'Error', detail: 'No se pudo borrar.' });
    }
  };

  // ===== Ver =====
  const abrirVer = (row) => {
    setRowVer(row);
    setVisibleVer(true);
  };

  /** ====== Importar Excel → SOLO ACTUALIZAR (NO CREAR) por DNI en curso seleccionado ====== */
  const abrirSelectorCurso = () => {
    const pre = cursoAplicado || cursoSeleccionado || '';
    setCursoImport(pre);
    setModalidadImport(''); // reset
    setVisibleSelCurso(true);
  };

  const continuarSeleccionCurso = () => {
    if (!cursoImport || !String(cursoImport).trim()) {
      toast.current?.show({ severity: 'warn', summary: 'Seleccioná el curso', detail: 'El curso es obligatorio para importar.' });
      return;
    }
    if (!modalidadImport) {
      toast.current?.show({ severity: 'warn', summary: 'Seleccioná la modalidad', detail: 'Debes elegir Virtual o Presencial para completar las faltantes.' });
      return;
    }
    setVisibleSelCurso(false);
    fileExcelRef.current?.click();
  };

  const handleFileChange = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = ''; // reset input
    if (!file) return;

    setImporting(true);
    setImportProgress(1);
    setImportStage('Leyendo archivo...');
    const errores = [];
    let creados = 0; // siempre 0 en este modo
    let actualizados = 0;
    let sinCambios = 0;
    let noEncontrados = 0;

    try {
      const data = await file.arrayBuffer();
      const wb = XLSX.read(data, { type: 'array' });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const jsonRaw = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });

      if (!jsonRaw.length) {
        setResumenImport({ creados: 0, actualizados: 0, sinCambios: 0, noEncontrados: 0 });
        setErroresImport([{ dni: '-', nombre: '-', apellido: '-', fecha: '-', curso: cursoImport, motivo: 'Archivo vacío' }]);
        setImportProgress(100);
        setImportStage('Sin datos');
        setVisibleResultado(true);
        return;
      }

      // Encabezados → campos
      const headers = (jsonRaw[0] || []).map((h) => headerMapAsistencia(h)).map((x) => x || '');
      const filas = jsonRaw.slice(1);

      // Dedupe por DNI (en este modo solo nos interesa DNI dentro del curso)
      const byDni = new Map();
      const selectedMod = canonModalidad(modalidadImport); // 👈 modalidad elegida en UI

      for (const arr of filas) {
        const rowObj = {};
        headers.forEach((fieldKey, idx) => {
          if (!fieldKey) return;
          rowObj[fieldKey] = arr[idx];
        });
        const norm = normalizeRowAsistencia(rowObj);
        norm.curso = cursoImport;

        // completar modalidad en el registro normalizado: usa la del Excel si viene, si no, la elegida en el modal
        const excelMod = canonModalidad(norm.modalidad);
        const finalMod = excelMod || selectedMod;
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

        // Merge por DNI, priorizando no vacíos
        const prev = byDni.get(dni) || {};
        const merged = { ...prev };
        for (const [k, v] of Object.entries(norm)) {
          if (!EMPTY(v)) merged[k] = v;
        }
        byDni.set(dni, merged);
      }

      // Preparar progreso de actualización
      setImportStage('Actualizando registros…');
      const entries = Array.from(byDni.entries());
      const total = entries.length || 1;
      const step = Math.max(1, Math.floor(total / 100));
      let processed = 0;

      // Escritura: SOLO actualizar documentos existentes por DNI+Curso (todos los que haya), NO crear
      const ALLOW_KEYS = ['nombre', 'apellido', 'email', 'departamento', 'nivelEducativo', 'modalidad']; // 👈 incluimos modalidad
      for (let i = 0; i < entries.length; i++) {
        const [dni, value] = entries[i];
        const { fecha, curso, ...rest } = value; // no usamos fecha para actualizar múltiples docs

        // completar faltantes desde nuevoAfiliado si vinieron vacíos en el Excel
        if (EMPTY(rest.email) || EMPTY(rest.departamento) || EMPTY(rest.nivelEducativo) || EMPTY(rest.nombre) || EMPTY(rest.apellido)) {
          const a = await getAfiliadoDataCached(dni);
          if (EMPTY(rest.email) && a.email) rest.email = a.email;
          if (EMPTY(rest.departamento) && a.departamento) rest.departamento = a.departamento;
          if (EMPTY(rest.nivelEducativo) && a.nivelEducativo) rest.nivelEducativo = a.nivelEducativo;
          if (EMPTY(rest.nombre) && a.nombre) rest.nombre = a.nombre;
          if (EMPTY(rest.apellido) && a.apellido) rest.apellido = a.apellido;
        }

        const docs = await findAsistenciaDocsByDniCurso(dni, cursoImport);
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
          processed++;
          if (processed % step === 0 || processed === total) {
            setImportProgress(Math.round((processed / total) * 100));
          }
          continue;
        }

        // Actualizar TODOS los docs de ese DNI en el curso (por si hay varias fechas)
        let huboUpdate = false;
        for (const dSnap of docs) {
          const current = dSnap.data() || {};
          const patch = patchOnlyEmpty(current, rest, ALLOW_KEYS); // modalidad se aplica solo si falta
          if (Object.keys(patch).length) {
            await updateDoc(dSnap.ref, patch);
            huboUpdate = true;
          }
        }
        if (huboUpdate) actualizados += 1; else sinCambios += 1;

        processed++;
        if (processed % step === 0 || processed === total) {
          setImportProgress(Math.round((processed / total) * 100));
        }
      }

      setImportProgress(100);
      setImportStage('Listo');
      setResumenImport({ creados, actualizados, sinCambios, noEncontrados });
      setErroresImport(errores);
      setVisibleResultado(true);
    } catch (err) {
      setImportProgress(100);
      setImportStage('Error');
      setResumenImport({ creados: 0, actualizados: 0, sinCambios: 0, noEncontrados: 0 });
      setErroresImport([{
        dni: '-',
        nombre: '-',
        apellido: '-',
        fecha: '-',
        curso: cursoImport || '-',
        motivo: err?.message || 'Error procesando el archivo',
      }]);
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

  /** ====== Exportar Excel por curso ====== */
  const cursosExportOptions = useMemo(() => {
    const set = new Set([
      ...cursosListaOptions.map((o) => o.value),
      ...cursosOptions.map((o) => o.value),
    ]);
    return Array.from(set).sort((a, b) => a.localeCompare(b)).map((n) => ({ label: n, value: n }));
  }, [cursosListaOptions, cursosOptions]);

  const abrirExportarExcel = () => {
    const pre = cursoAplicado || cursoSeleccionado || '';
    setCursoExport(pre);
    setModalidadExport('*'); // reset a “Todas”
    setVisibleExport(true);
  };

  const descargarExcelPorCurso = async () => {
    if (!cursoExport || !String(cursoExport).trim()) {
      toast.current?.show({ severity: 'warn', summary: 'Faltan datos', detail: 'Seleccioná el curso para exportar.' });
      return;
    }
    setExporting(true);
    try {
      const colRef = collection(db, 'asistencia');

      // Query principal (si es “Todas”, no filtramos por modalidad)
      const baseQuery = modalidadExport === '*'
        ? query(colRef, where('curso', '==', cursoExport))
        : query(colRef, where('curso', '==', cursoExport), where('modalidad', '==', modalidadExport));

      let qs = await getDocs(baseQuery);
      let items = qs.docs.map((d) => d.data());

      // Fallback si el índice compuesto no existe o no hay resultados exactos
      if (modalidadExport !== '*' && items.length === 0) {
        const qsAll = await getDocs(query(colRef, where('curso', '==', cursoExport)));
        items = qsAll.docs
          .map((d) => d.data())
          .filter((r) => canonModalidad(r.modalidad) === modalidadExport);
      }

      if (!items.length) {
        const msg = modalidadExport === '*'
          ? `No hay registros para "${cursoExport}".`
          : `No hay registros para "${cursoExport}" en modalidad "${modalidadExport}".`;
        toast.current?.show({ severity: 'info', summary: 'Sin datos', detail: msg });
        setExporting(false);
        return;
      }

      // enriquecer con join en vivo por DNI para exportar + normalizar modalidad
      const enriched = await Promise.all(
        items.map(async (r) => {
          const dni = toDniDigits(r.dni);
          const a = (EMPTY(r.email) || EMPTY(r.departamento) || EMPTY(r.nivelEducativo))
            ? await getAfiliadoDataCached(dni)
            : {};
          return {
            ...r,
            modalidad: canonModalidad(r.modalidad),
            email: r.email || a.email || '',
            departamento: r.departamento || a.departamento || '',
            nivelEducativo: r.nivelEducativo || a.nivelEducativo || '',
          };
        })
      );

      const data = enriched
        .sort((a, b) => {
          const ta = parseToDate(a.fecha)?.getTime() || 0;
          const tb = parseToDate(b.fecha)?.getTime() || 0;
          return ta - tb;
        })
        .map((r) => {
          const { nombre, apellido } = deriveNombreApellido(r);
          return {
            Fecha: r.fecha || '',
            Curso: r.curso || '',
            Modalidad: r.modalidad || '',
            Nombre: nombre || '',
            Apellido: apellido || '',
            DNI: r.dni || '',
            Departamento: r.departamento || '',
            'Nivel Educativo': r.nivelEducativo || '',
            Email: r.email || '',
          };
        });

      const ws = XLSX.utils.json_to_sheet(data);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Asistencia');

      const now = new Date();
      const y = now.getFullYear();
      const m = String(now.getMonth() + 1).padStart(2, '0');
      const d = String(now.getDate()).padStart(2, '0');
      const hh = String(now.getHours()).padStart(2, '0');
      const mm = String(now.getMinutes()).padStart(2, '0');

      const modaSlug = modalidadExport === '*' ? 'todas' : modalidadExport.toLowerCase();
      const filename = `asistencia_${slug(cursoExport)}_${slug(modaSlug)}_${y}${m}${d}_${hh}${mm}.xlsx`;
      XLSX.writeFile(wb, filename);

      toast.current?.show({
        severity: 'success',
        summary: 'Descarga lista',
        detail: `Se descargó el Excel de "${cursoExport}" (${modalidadExport === '*' ? 'Todas' : modalidadExport}).`,
      });
      setVisibleExport(false);
    } catch (err) {
      console.error('descargar excel:', err);
      toast.current?.show({ severity: 'error', summary: 'Error', detail: 'No se pudo generar el Excel.' });
    } finally {
      setExporting(false);
    }
  };

  // ===== Templates =====
  const departamentoBody = (row) => {
    const dni = toDniDigits(row.dni);
    return row.departamento || dniJoin[dni]?.departamento || '';
  };
  const nivelEducativoBody = (row) => {
    const dni = toDniDigits(row.dni);
    return row.nivelEducativo || dniJoin[dni]?.nivelEducativo || '';
  };
  const emailBody = (row) => {
    const dni = toDniDigits(row.dni);
    const value = row.email || dniJoin[dni]?.email || '';
    return <span className={styles.emailCell} title={value}>{value}</span>;
  };

  // ===== UI =====
  const accionesTemplate = (row) => (
    <div className={styles.actions}>
      <Button icon="pi pi-eye" rounded text aria-label="Ver" onClick={guardBusy(() => abrirVer(row))} disabled={isBusy} />
      <Button icon="pi pi-pencil" rounded text aria-label="Editar" onClick={guardBusy(() => abrirEditar(row))} disabled={isBusy} />
      <Button icon="pi pi-trash" rounded text severity="danger" aria-label="Borrar" onClick={guardBusy(() => borrar(row))} disabled={isBusy} />
    </div>
  );

  const dt = useRef(null);

  const leftToolbar = (
    <div className={styles.toolbarLeft}>
      <Button label="Nuevo" icon="pi pi-plus" severity="success" onClick={guardBusy(abrirNuevo)} disabled={isBusy} />

      {/* Importar Excel (Asistencia) con selección de curso/modo previa */}
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
    </div>
  );

  const rightToolbar = (
    <div className={styles.toolbarRight}>
      <span className="p-input-icon-left">
        <i className="pi pi-search" />
        <InputText
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          placeholder="Buscar (nombre, apellido, DNI, curso, email)"
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

      {/* Descargar Excel por curso */}
      <Button
        label="Descargar Excel"
        icon="pi pi-download"
        className="p-button-help"
        onClick={guardBusy(abrirExportarExcel)}
        disabled={isBusy}
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
          Importá Excel para <strong>actualizar</strong> solo DNIs existentes en el curso (sin crear).
          Completa campos vacíos (nombre, apellido, email, departamento, nivel) y <strong>modalidad</strong> según lo que elijas.
        </p>
      </div>

      <Toolbar className={styles.toolbar} left={leftToolbar} right={rightToolbar} />

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
        tableStyle={{ tableLayout: 'fixed' }}
      >
        <Column field="fecha" header="Fecha" sortable />
        <Column field="curso" header="Curso" sortable />
        <Column field="modalidad" header="Modalidad" />
        <Column field="nombre" header="Nombre" sortable />
        <Column field="apellido" header="Apellido" sortable />
        <Column field="dni" header="DNI" sortable />
        <Column field="departamento" header="Departamento" body={departamentoBody} />
        <Column field="nivelEducativo" header="Nivel Educativo" body={nivelEducativoBody} />
        <Column field="email" header="Email" sortable body={emailBody} style={{ width: '160px' }} />
        <Column header="Acciones" body={accionesTemplate} exportable={false} style={{ width: '140px', textAlign: 'right' }} />
      </DataTable>

      {/* Modal Alta/Edición */}
      <Dialog
        header={editandoId ? 'Editar registro' : 'Nuevo registro'}
        visible={visibleDialog}
        style={{ width: 560 }}
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
              onChange={(e) => setForm((f) => ({ ...f, modalidad: e.value }))}
              options={MODALIDAD_OPTIONS}
              placeholder="Seleccionar"
              showClear
            />
          </div>

          <div className={styles.formRow}>
            <label>Curso</label>
            <InputText value={form.curso} onChange={(e) => setForm((f) => ({ ...f, curso: e.target.value }))} />
          </div>

          <div className={styles.formRow}>
            <label>Nombre</label>
            <InputText value={form.nombre} onChange={(e) => setForm((f) => ({ ...f, nombre: e.target.value }))} />
          </div>

          <div className={styles.formRow}>
            <label>Apellido</label>
            <InputText value={form.apellido} onChange={(e) => setForm((f) => ({ ...f, apellido: e.target.value }))} />
          </div>

          <div className={styles.formRow}>
            <label>DNI</label>
            <InputText value={form.dni} onChange={(e) => setForm((f) => ({ ...f, dni: e.target.value }))} />
          </div>

          <div className={styles.formRow}>
            <label>Departamento</label>
            <InputText value={form.departamento} onChange={(e) => setForm((f) => ({ ...f, departamento: e.target.value }))} />
          </div>

          <div className={styles.formRow}>
            <label>Nivel Educativo</label>
            <InputText value={form.nivelEducativo} onChange={(e) => setForm((f) => ({ ...f, nivelEducativo: e.target.value }))} />
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
        </div>

        <div className={styles.dialogActions}>
          <Button label="Guardar" icon="pi pi-check" severity="success" onClick={guardar} loading={saving} />
          <Button label="Cancelar" icon="pi pi-times" severity="danger" onClick={() => setVisibleDialog(false)} disabled={saving} />
        </div>
      </Dialog>

      {/* Modal Ver (solo lectura) */}
      <Dialog
        header="Detalle de asistencia"
        visible={visibleVer}
        style={{ width: 560 }}
        modal
        onHide={() => setVisibleVer(false)}
      >
        {rowVer ? (
          <div className={styles.formGrid}>
            <div className={styles.formRow}><label>Fecha</label><div>{rowVer.fecha || '-'}</div></div>
            <div className={styles.formRow}><label>Modalidad</label><div>{rowVer.modalidad || '-'}</div></div>
            <div className={styles.formRow}><label>Curso</label><div>{rowVer.curso || '-'}</div></div>
            <div className={styles.formRow}><label>Nombre</label><div>{sanitizeMissing(rowVer.nombre) || '-'}</div></div>
            <div className={styles.formRow}><label>Apellido</label><div>{sanitizeMissing(rowVer.apellido) || '-'}</div></div>
            <div className={styles.formRow}><label>DNI</label><div>{rowVer.dni || '-'}</div></div>
            <div className={styles.formRow}><label>Departamento</label><div>{rowVer.departamento || dniJoin[toDniDigits(rowVer.dni)]?.departamento || '-'}</div></div>
            <div className={styles.formRow}><label>Nivel Educativo</label><div>{rowVer.nivelEducativo || dniJoin[toDniDigits(rowVer.dni)]?.nivelEducativo || '-'}</div></div>
            <div className={styles.formRow}><label>Email</label><div>{rowVer.email || dniJoin[toDniDigits(rowVer.dni)]?.email || '-'}</div></div>
          </div>
        ) : (
          <p>Sin datos.</p>
        )}

        <div className={styles.dialogActions}>
          <Button label="Cerrar" icon="pi pi-times" onClick={() => setVisibleVer(false)} />
        </div>
      </Dialog>

      {/* Modal: Seleccionar curso y modalidad antes de importar */}
      <Dialog
        header="Seleccionar curso y modalidad a actualizar"
        visible={visibleSelCurso}
        style={{ width: 480 }}
        modal
        onHide={() => setVisibleSelCurso(false)}
      >
        <div className={styles.formGrid}>
          <div className={styles.formRow}>
            <label>Curso</label>
            <Dropdown
              value={cursoImport}
              onChange={(e) => setCursoImport(e.value)}
              options={cursosListaOptions}
              placeholder="Elegí un curso"
              filter
              showClear
              className="w-full"
              disabled={cursosListaOptions.length === 0 || isBusy}
            />
            {cursosListaOptions.length === 0 && (
              <small style={{ opacity: 0.8 }}>
                No se encontraron cursos en la colección <code>cursos</code>.
              </small>
            )}
          </div>

          <div className={styles.formRow}>
            <label>Modalidad a completar (si falta)</label>
            <Dropdown
              value={modalidadImport}
              onChange={(e) => setModalidadImport(e.value)}
              options={MODALIDAD_OPTIONS}
              placeholder="Elegí la modalidad"
              className="w-full"
              disabled={isBusy}
            />
          </div>
        </div>
        <div className={styles.dialogActions}>
          <Button
            label="Continuar"
            icon="pi pi-check"
            severity="success"
            onClick={continuarSeleccionCurso}
            disabled={!cursoImport || !String(cursoImport).trim() || !modalidadImport || isBusy}
          />
          <Button label="Cancelar" icon="pi pi-times" severity="danger" onClick={() => setVisibleSelCurso(false)} disabled={isBusy} />
        </div>
      </Dialog>

      {/* Modal: Seleccionar curso y modalidad para exportar */}
      <Dialog
        header="Descargar Excel por curso y modalidad"
        visible={visibleExport}
        style={{ width: 480 }}
        modal
        onHide={() => setVisibleExport(false)}
      >
        <div className={styles.formGrid}>
          <div className={styles.formRow}>
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
              placeholder="Elegí la modalidad (o Todas)"
              className="w-full"
              disabled={isBusy}
            />
          </div>
        </div>
        <div className={styles.dialogActions}>
          <Button
            label="Descargar"
            icon="pi pi-download"
            severity="success"
            onClick={descargarExcelPorCurso}
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

      {/* Modal: Resultado de importación */}
      <Dialog
        header="Resultado de la importación"
        visible={visibleResultado}
        style={{ width: 760 }}
        modal
        onHide={() => { setVisibleResultado(false); setImportProgress(0); setImportStage(''); }}
      >
        <div style={{ marginBottom: 12 }}>
          {erroresImport.length === 0 ? (
            <div>
              <h3 style={{ marginTop: 0 }}>¡Actualización completada! ✅</h3>
              <p>
                Curso: <strong>{cursoImport}</strong><br />
                Modalidad aplicada (solo donde faltaba): <strong>{modalidadImport}</strong><br />
                Creados: <strong>0</strong> · Actualizados: <strong>{resumenImport.actualizados}</strong> · Sin cambios: <strong>{resumenImport.sinCambios}</strong> · No encontrados: <strong>{resumenImport.noEncontrados}</strong>
              </p>
            </div>
          ) : (
            <div>
              <h3 style={{ marginTop: 0 }}>Importación con incidencias ⚠️</h3>
              <p>
                Curso: <strong>{cursoImport}</strong><br />
                Modalidad aplicada (solo donde faltaba): <strong>{modalidadImport}</strong><br />
                Creados: <strong>0</strong> · Actualizados: <strong>{resumenImport.actualizados}</strong> · Sin cambios: <strong>{resumenImport.sinCambios}</strong> · No encontrados: <strong>{resumenImport.noEncontrados}</strong><br />
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
          <Button label="Cerrar" icon="pi pi-times" onClick={() => { setVisibleResultado(false); setImportProgress(0); setImportStage(''); }} />
        </div>
      </Dialog>

      {/* Overlay de progreso durante importación */}
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



