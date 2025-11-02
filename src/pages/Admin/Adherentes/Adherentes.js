// Adherentes.js
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Button } from 'primereact/button';
import { Dialog } from 'primereact/dialog';
import { Toast } from 'primereact/toast';
import { InputText } from 'primereact/inputtext';
import { Dropdown } from 'primereact/dropdown';
import { InputSwitch } from 'primereact/inputswitch';
import { InputTextarea } from 'primereact/inputtextarea';
import { Tag } from 'primereact/tag';
import { DataTable } from 'primereact/datatable';
import { Column } from 'primereact/column';
import { Toolbar } from 'primereact/toolbar';
import { ConfirmDialog, confirmDialog } from 'primereact/confirmdialog';
import { ProgressSpinner } from 'primereact/progressspinner';
import exportFromJSON from 'export-from-json';
import * as XLSX from 'xlsx';

import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  query,
  updateDoc,
  where,
  getDocs,
  limit,
} from 'firebase/firestore';

import { db } from '../../../firebase/firebase-config';
import styles from './Adherente.module.css';

// ===== Colecciones =====
const ADHERENTES_COLLECTION = 'adherentes';

// ===== Opciones de departamento =====
const DEPARTAMENTOS = [
  'Ambato','Ancasti','Andalgalá','Antofagasta de la Sierra','Belén','Capayán','Capital',
  'El Alto','Fray Mamerto Esquiú','La Paz','Paclín','Pomán','Santa María','Santa Rosa',
  'Tinogasta','Valle Viejo',
].map(d => ({ label: d, value: d }));

// ===== Utils =====
const normalize = (t) =>
  (t ?? '').toString().trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
const normalizeText = (t) => normalize(t);

const toSiNo = (v) => {
  if (typeof v === 'string') {
    const s = normalize(v);
    if (['si','sí','true','1'].includes(s)) return 'Sí';
    if (['no','false','0'].includes(s)) return 'No';
  }
  if (typeof v === 'boolean') return v ? 'Sí' : 'No';
  return '—';
};

const afiliacionLabel = (n) => {
  const num = Number(n);
  if (!Number.isFinite(num) || num <= 0) return 'Sin dato';
  if (num === 1) return '1ª afiliación';
  return `${num}ª reafiliación`;
};

// ===== Normalización de Departamento =====
const depKey = (s) =>
  normalize(String(s || '').replace(/[_-]+/g, ' ').replace(/\s+/g, ' '));

const toTitle = (s) =>
  (s || '')
    .toString()
    .toLowerCase()
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .replace(/\b\p{L}/gu, (m) => m.toUpperCase())
    .trim();

const DEP_MAP = new Map(DEPARTAMENTOS.map(o => [depKey(o.value || o.label), (o.value || o.label)]));

const toCanonicalDepartamento = (v) => {
  if (!v) return '';
  const key = depKey(v);
  return DEP_MAP.get(key) || toTitle(String(v));
};

// Normaliza descuento a "si"/"no"
const normalizeDescuento = (v) => {
  const s = normalize(String(v ?? ''));
  if (['si','sí','true','1'].includes(s)) return 'si';
  if (['no','false','0'].includes(s)) return 'no';
  return '';
};

// Interpreta estado excel → boolean
const parseEstadoExcel = (v) => {
  const s = normalize(String(v ?? ''));
  if (['1','true','si','sí','habilitado','habilitada','activo','activa'].includes(s)) return true;
  if (['0','false','no','no habilitado','deshabilitado','inactivo'].includes(s)) return false;
  return true; // por defecto habilitado
};

// ✅ Interpreta “sí” genérico (para columna SI/Adherente/Habilitar)
const parseYes = (v) => {
  const s = normalize(String(v ?? ''));
  return ['1','true','si','sí','x','ok','marcar','habilitar'].includes(s);
};

// Map headers de Excel → claves internas
const headerKey = (h) => {
  const s = normalize(h).replace(/[^\w]/g, '');
  const map = {
    apellido: 'apellido',
    apellidos: 'apellido',
    nombre: 'nombre',
    nombres: 'nombre',
    dni: 'dni',
    documento: 'dni',
    departament: 'departamento',
    departamento: 'departamento',
    establecimiento: 'establecimientos',
    establecimientos: 'establecimientos',
    celular: 'celular',
    telefono: 'celular',
    tel: 'celular',
    email: 'email',
    estado: 'estado',
    observaciones: 'observaciones',
    observacion: 'observaciones',
    titulogrado: 'tituloGrado',
    titulo: 'tituloGrado',
    nroafiliacion: 'nroAfiliacion',
    afiliacion: 'nroAfiliacion',
    descuento: 'descuento',
    // ✅ NUEVOS alias para columna que indica “SI”
    si: 'adherenteExcel',
    adherente: 'adherenteExcel',
    habilitar: 'adherenteExcel',
  };
  return map[s] || null;
};

export default function Adherente() {
  const toast = useRef(null);
  const fileInputRef = useRef(null);

  // Base
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);

  // Filtros
  const [busqueda, setBusqueda] = useState('');
  const [deptoSeleccionado, setDeptoSeleccionado] = useState(null);
  const [deptoAplicado, setDeptoAplicado] = useState(null);

  // Filtro Estado
  const [estadoSeleccionado, setEstadoSeleccionado] = useState(null);
  const [estadoAplicado, setEstadoAplicado] = useState(null);

  // Paginación
  const [first, setFirst] = useState(0);

  // Modal alta/edición
  const [visibleDialog, setVisibleDialog] = useState(false);
  const [editandoId, setEditandoId] = useState(null);
  const [saving, setSaving] = useState(false);

  // ⏳ Importando Excel (spinner)
  const [importing, setImporting] = useState(false);

  const [form, setForm] = useState({
    apellido: '',
    nombre: '',
    dni: '',
    nroAfiliacion: '',
    tituloGrado: '',
    descuento: '',
    departamento: '',
    establecimientos: '',
    celular: '',
    email: '',
    estado: true,
    observaciones: '',
    adherente: true,
  });

  // Modal Ver
  const [visibleVer, setVisibleVer] = useState(false);
  const [rowVer, setRowVer] = useState(null);

  // ====== Modal Cotizante ======
  const [cotzVisible, setCotzVisible] = useState(false);
  const [cotzRow, setCotzRow] = useState(null);
  const [cotzObs, setCotzObs] = useState('');
  const [cotzSaving, setCotzSaving] = useState(false);

  // ===== Suscripción a Firestore =====
  useEffect(() => {
    setLoading(true);
    const base = collection(db, ADHERENTES_COLLECTION);
    const qRef = deptoAplicado ? query(base, where('departamento', '==', deptoAplicado)) : base;

    const unsub = onSnapshot(
      qRef,
      (snap) => {
        const data = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        setRows(data);
        setLoading(false);
      },
      (err) => {
        console.error('onSnapshot adherentes:', err);
        toast.current?.show({ severity: 'error', summary: 'Error', detail: 'No se pudo leer la información.' });
        setLoading(false);
      }
    );
    return () => unsub();
  }, [deptoAplicado]);

  useEffect(() => setFirst(0), [deptoAplicado, estadoAplicado]);

  // ===== Búsqueda + filtro Estado =====
  const dataFiltrada = useMemo(() => {
    const s = normalizeText(busqueda).trim();
    let base = [...rows];

    if (estadoAplicado !== null) base = base.filter(r => !!r.estado === estadoAplicado);

    if (!s) return base;

    return base.filter(r => {
      const establecimiento = r.establecimientos || r.establecimiento || '';
      const estadoTxt = r.estado ? 'habilitado' : 'no habilitado';
      const txt = normalizeText(
        `${r.apellido||''} ${r.nombre||''} ${r.dni||''} ${r.departamento||''} ${establecimiento} ${r.celular||''} ${r.email||''} ${estadoTxt} ${r.observaciones||''} ${r.tituloGrado||''} ${r.descuento||''} ${r.nroAfiliacion||''}`
      );
      return txt.includes(s);
    });
  }, [rows, busqueda, estadoAplicado]);

  // ===== Exportar Excel =====
  const handleExportExcel = () => {
    const data = dataFiltrada.map((r) => ({
      Apellido: r.apellido || '',
      Nombre: r.nombre || '',
      DNI: r.dni || '',
      Afiliación: afiliacionLabel(r.nroAfiliacion),
      'Título de grado (nombre de la carrera)': r.tituloGrado || '',
      Descuento: toSiNo(r.descuento),
      Departamento: toCanonicalDepartamento(r.departamento),
      Establecimiento: r.establecimientos || r.establecimiento || '',
      Celular: r.celular || '',
      Email: r.email || '',
      Observaciones: r.observaciones || '',
      Estado: r.estado ? 'Habilitado' : 'No habilitado',
      Adherente: 'Sí',
    }));

    exportFromJSON({ data, fileName: 'adherentes', exportType: 'xls' });
  };

  // ===== Importar Excel =====
   const handleClickImport = () => fileInputRef.current?.click();

  const handleFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImporting(true);
    try {
      await importExcel(file);
    } catch (err) {
      console.error('importExcel:', err);
      toast.current?.show({ severity: 'error', summary: 'Error', detail: 'No se pudo importar el archivo.' });
    } finally {
      setImporting(false);
      e.target.value = '';
    }
  };

  const importExcel = async (file) => {
    const buf = await file.arrayBuffer();
    const wb = XLSX.read(buf, { type: 'array' });
    const sheetName = wb.SheetNames[0];
    const ws = wb.Sheets[sheetName];
    if (!ws) throw new Error('Hoja vacía');

    const rows = XLSX.utils.sheet_to_json(ws, { header: 1 });
    if (!rows.length) throw new Error('Sin datos');

    const headers = rows[0].map(h => headerKey(String(h || '')));
    const idxMap = {};
    headers.forEach((k, i) => { if (k) idxMap[k] = i; });

    let inserted = 0, updated = 0, skipped = 0;
    let habilitadosNuevoAfiliado = 0, noEncontradosNuevoAfiliado = 0;

    // Procesar filas de datos
    for (const arr of rows.slice(1)) {
      const getVal = (k) => {
        const i = idxMap[k];
        return i === undefined ? '' : (arr[i] ?? '');
      };

      const apellido = String(getVal('apellido') || '').trim();
      const nombre = String(getVal('nombre') || '').trim();
      const dni = String(getVal('dni') || '').trim();

      if (!apellido || !nombre || !dni) { skipped++; continue; }

      const nroAf = (() => {
        const n = Number(getVal('nroAfiliacion'));
        return Number.isFinite(n) && n > 0 ? n : null;
      })();

      const flagAdherenteExcel = parseYes(getVal('adherenteExcel')); // ← columna SI/Adherente/Habilitar

      const payload = {
        apellido,
        nombre,
        dni,
        nroAfiliacion: nroAf,
        tituloGrado: String(getVal('tituloGrado') || '').trim(),
        descuento: normalizeDescuento(getVal('descuento')),
        departamento: toCanonicalDepartamento(getVal('departamento')),
        establecimientos: String(getVal('establecimientos') || '').trim(),
        establecimiento: String(getVal('establecimientos') || '').trim(),
        celular: String(getVal('celular') || '').trim(),
        email: String(getVal('email') || '').trim(),
        estado: parseEstadoExcel(getVal('estado')),
        observaciones: String(getVal('observaciones') || '').trim(),
        adherente: true,
      };

      // Upsert por DNI en colección "adherentes"
      const qRef = query(collection(db, ADHERENTES_COLLECTION), where('dni', '==', payload.dni), limit(1));
      const snap = await getDocs(qRef);

      if (!snap.empty) {
        await updateDoc(snap.docs[0].ref, payload);
        updated++;
      } else {
        await addDoc(collection(db, ADHERENTES_COLLECTION), payload);
        inserted++;
      }

      // ✅ Si la columna "SI" marcó este registro, habilitar en "nuevoAfiliado"
      if (flagAdherenteExcel) {
        let targets = [];
        if (nroAf !== null) {
          // Intentar por dni + nro (num y string)
          const qNum = query(collection(db, 'nuevoAfiliado'),
            where('dni', '==', dni),
            where('nroAfiliacion', '==', Number(nroAf)));
          const sNum = await getDocs(qNum);
          targets = sNum.docs;

          if (targets.length === 0) {
            const qStr = query(collection(db, 'nuevoAfiliado'),
              where('dni', '==', dni),
              where('nroAfiliacion', '==', String(nroAf)));
            const sStr = await getDocs(qStr);
            targets = sStr.docs;
          }
        }

        // Si no hay nroAfiliacion válido, buscar por DNI solo
        if (targets.length === 0) {
          const qDni = query(collection(db, 'nuevoAfiliado'), where('dni', '==', dni));
          const sDni = await getDocs(qDni);
          targets = sDni.docs;
        }

        if (targets.length > 0) {
          await Promise.all(targets.map(dref => updateDoc(dref.ref, { adherente: true })));
          habilitadosNuevoAfiliado += targets.length;
        } else {
          noEncontradosNuevoAfiliado++;
        }
      }
    }

    toast.current?.show({
      severity: 'success',
      summary: 'Importación completa',
      detail: `Insertados: ${inserted} • Actualizados: ${updated} • Omitidos: ${skipped} • Habilitados en nuevoAfiliado: ${habilitadosNuevoAfiliado}${noEncontradosNuevoAfiliado ? ` • No encontrados (dni/nro): ${noEncontradosNuevoAfiliado}` : ''}`,
      life: 7000,
    });
  };

  // ===== CRUD =====
  const abrirNuevo = () => {
    setEditandoId(null);
    setForm({
      apellido: '',
      nombre: '',
      dni: '',
      nroAfiliacion: '',
      tituloGrado: '',
      descuento: '',
      departamento: '',
      establecimientos: '',
      celular: '',
      email: '',
      estado: true,
      observaciones: '',
      adherente: true,
    });
    setVisibleDialog(true);
  };

  const abrirEditar = (row) => {
    setEditandoId(row.id);
    setForm({
      apellido: row.apellido || '',
      nombre: row.nombre || '',
      dni: row.dni || '',
      nroAfiliacion: row.nroAfiliacion ?? '',
      tituloGrado: row.tituloGrado || '',
      descuento: typeof row.descuento === 'string' ? row.descuento : (row.descuento ?? ''),
      departamento: toCanonicalDepartamento(row.departamento || ''),
      establecimientos: row.establecimientos || row.establecimiento || '',
      celular: row.celular || '',
      email: row.email || '',
      estado: typeof row.estado === 'boolean' ? row.estado : true,
      observaciones: row.observaciones || '',
      adherente: true,
    });
    setVisibleDialog(true);
  };

  const abrirVer = (row) => { setRowVer(row); setVisibleVer(true); };

  const validar = () => {
    const faltan = [];
    if (!form.apellido.trim()) faltan.push('Apellido');
    if (!form.nombre.trim()) faltan.push('Nombre');
    if (!form.dni.trim()) faltan.push('DNI');
    if (faltan.length) {
      toast.current?.show({ severity: 'warn', summary: 'Datos incompletos', detail: `Faltan: ${faltan.join(', ')}` });
      return false;
    }
    return true;
  };

  const guardar = async () => {
    if (!validar()) return;
    setSaving(true);
    try {
      const payload = {
        apellido: form.apellido.trim(),
        nombre: form.nombre.trim(),
        dni: form.dni.trim(),
        nroAfiliacion: form.nroAfiliacion !== '' ? Number(form.nroAfiliacion) : null,
        tituloGrado: form.tituloGrado?.trim() || '',
        descuento: normalizeDescuento(form.descuento),
        departamento: toCanonicalDepartamento(form.departamento || ''),
        establecimientos: form.establecimientos?.trim() || '',
        establecimiento: form.establecimientos?.trim() || '',
        celular: form.celular?.trim() || '',
        email: form.email?.trim() || '',
        estado: !!form.estado,
        observaciones: form.observaciones?.trim() || '',
        adherente: true,
      };

      if (editandoId) {
        await updateDoc(doc(db, ADHERENTES_COLLECTION, editandoId), payload);
        toast.current?.show({ severity: 'success', summary: 'Actualizado', detail: 'Registro actualizado.' });
      } else {
        await addDoc(collection(db, ADHERENTES_COLLECTION), payload);
        toast.current?.show({ severity: 'success', summary: 'Guardado', detail: 'Registro agregado.' });
      }
      setVisibleDialog(false);
    } catch (err) {
      console.error('guardar adherente:', err);
      toast.current?.show({ severity: 'error', summary: 'Error', detail: 'No se pudo guardar.' });
    } finally {
      setSaving(false);
    }
  };

  const borrar = async (row) => {
    try {
      await deleteDoc(doc(db, ADHERENTES_COLLECTION, row.id));
      toast.current?.show({ severity: 'success', summary: 'Eliminado', detail: 'Registro borrado.' });
    } catch (err) {
      console.error('borrar adherente:', err);
      toast.current?.show({ severity: 'error', summary: 'Error', detail: 'No se pudo borrar.' });
    }
  };

  const toggleEstado = async (row) => {
    try {
      await updateDoc(doc(db, ADHERENTES_COLLECTION, row.id), { estado: !row.estado });
    } catch (err) {
      console.error('toggleEstado:', err);
      toast.current?.show({ severity: 'error', summary: 'Error', detail: 'No se pudo actualizar el estado.' });
    }
  };

  // ====== COTIZANTE ======
  const abrirCotizante = (row) => {
    setCotzRow(row);
    setCotzObs(row.observaciones || '');
    setCotzVisible(true);
  };

  const runCotizante = async () => {
    if (!cotzRow) return;
    const dniKey = String(cotzRow.dni || '').trim();
    const nro = cotzRow.nroAfiliacion ?? null;

    if (!dniKey || nro == null) {
      toast.current?.show({
        severity: 'warn',
        summary: 'Datos insuficientes',
        detail: 'Faltan DNI o N° de afiliación para actualizar el registro en “nuevoAfiliado”.',
      });
      return;
    }

    setCotzSaving(true);
    try {
      // 1) Buscar en "nuevoAfiliado" por dni + nroAfiliacion (num y string)
      const qNum = query(collection(db, 'nuevoAfiliado'),
        where('dni', '==', dniKey),
        where('nroAfiliacion', '==', Number(nro)));
      const snapNum = await getDocs(qNum);

      let targets = snapNum.docs;

      if (targets.length === 0) {
        const qStr = query(collection(db, 'nuevoAfiliado'),
          where('dni', '==', dniKey),
          where('nroAfiliacion', '==', String(nro)));
        const snapStr = await getDocs(qStr);
        targets = snapStr.docs;
      }

      if (targets.length === 0) {
        toast.current?.show({
          severity: 'warn',
          summary: 'No encontrado',
          detail: 'No se encontró el afiliado en “nuevoAfiliado” con ese DNI y N° de afiliación.',
          life: 5000,
        });
        setCotzSaving(false);
        return;
      }

      // 2) Actualizar "observaciones" y adherente=false en nuevoAfiliado
      const trimmedObs = (cotzObs ?? '').trim();
      await Promise.all(
        targets.map(dref =>
          updateDoc(dref.ref, { observaciones: trimmedObs, adherente: false })
        )
      );

      // 3) Borrar el registro en "adherentes"
      await deleteDoc(doc(db, ADHERENTES_COLLECTION, cotzRow.id));

      toast.current?.show({
        severity: 'success',
        summary: 'Cotizante aplicado',
        detail: 'Se actualizó “observaciones” y adherente = no en nuevoAfiliado y se eliminó el registro en Adherentes.',
      });
      setCotzVisible(false);
      setCotzRow(null);
      setCotzObs('');
    } catch (err) {
      console.error('runCotizante:', err);
      toast.current?.show({ severity: 'error', summary: 'Error', detail: 'No se pudo completar la operación Cotizante.' });
    } finally {
      setCotzSaving(false);
    }
  };

  const confirmarBorrado = (row) => {
    confirmDialog({
      header: 'Confirmar',
      message: `¿Eliminar a ${row.apellido ?? ''} ${row.nombre ?? ''}? Esta acción no se puede deshacer.`,
      icon: 'pi pi-exclamation-triangle',
      acceptLabel: 'Sí, borrar',
      rejectLabel: 'Cancelar',
      accept: () => borrar(row),
    });
  };

  // ===== UI =====
  const accionesTemplate = (row) => (
    <div className={styles.actions}>
      <Button icon="pi pi-eye" tooltip="Ver" rounded text aria-label="Ver" onClick={() => abrirVer(row)} />
      <Button icon="pi pi-pencil" tooltip="Editar" rounded text aria-label="Editar" onClick={() => abrirEditar(row)} />
      <Button
        icon="pi pi-user-edit"
        tooltip="Cotizante (actualiza observaciones y elimina)"
        rounded
        text
        severity="info"
        aria-label="Cotizante"
        onClick={() => abrirCotizante(row)}
      />
      <Button
        icon={row.estado ? 'pi pi-ban' : 'pi pi-check'}
        tooltip={row.estado ? 'Deshabilitar' : 'Habilitar'}
        rounded
        text
        severity={row.estado ? 'warning' : 'success'}
        aria-label={row.estado ? 'Deshabilitar' : 'Habilitar'}
        onClick={() => toggleEstado(row)}
      />
      <Button icon="pi pi-trash" tooltip="Eliminar" rounded text severity="danger" aria-label="Eliminar" onClick={() => confirmarBorrado(row)} />
    </div>
  );

  const estadoBodyTemplate = (row) =>
    <Tag value={row.estado ? 'Habilitado' : 'No habilitado'} severity={row.estado ? 'success' : 'danger'} rounded />;

  const leftToolbar = (
    <div className={styles.toolbarLeft}>
      <Button label="Nuevo" icon="pi pi-plus" severity="success" onClick={abrirNuevo} />
      <Button label="Importar Excel" icon="pi pi-upload" severity="info" onClick={handleClickImport} />
      <Button label="Descargar Excel" icon="pi pi-download" severity="help" onClick={handleExportExcel} disabled={loading || dataFiltrada.length === 0} />
      <input ref={fileInputRef} type="file" accept=".xlsx,.xls" style={{ display: 'none' }} onChange={handleFileChange} />
    </div>
  );

  const rightToolbar = (
    <div className={styles.toolbarRight}>
      <span className="p-input-icon-left">
        <i className="pi pi-search" />
        <InputText value={busqueda} onChange={(e) => setBusqueda(e.target.value)} placeholder="Buscar (apellido, nombre, DNI, email, ...)" />
      </span>

      <Dropdown value={deptoSeleccionado} onChange={(e) => setDeptoSeleccionado(e.value)} options={DEPARTAMENTOS} placeholder="Departamento" className={styles.filterItem} showClear />

      <Dropdown
        value={estadoSeleccionado}
        onChange={(e) => setEstadoSeleccionado(e.value)}
        options={[{ label: 'Habilitado', value: true }, { label: 'No habilitado', value: false }]}
        placeholder="Estado"
        className={styles.filterItem}
        showClear
      />

      <Button
        label="Aplicar filtros"
        icon="pi pi-filter"
        onClick={() => {
          setDeptoAplicado(deptoSeleccionado || null);
          setEstadoAplicado(typeof estadoSeleccionado === 'boolean' ? estadoSeleccionado : null);
          setFirst(0);
        }}
      />

      <Button
        text
        label="Limpiar"
        onClick={() => {
          setBusqueda('');
          setDeptoSeleccionado(null);
          setDeptoAplicado(null);
          setEstadoSeleccionado(null);
          setEstadoAplicado(null);
          setFirst(0);
        }}
      />
    </div>
  );

  return (
    <div className={styles.container}>
      <Toast ref={toast} />
      <ConfirmDialog />

      <div className={styles.header}>
        <h2>Afiliados Adherentes</h2>
        <p className={styles.subtitle}>
          En esta sección podés gestionar afiliados adherentes: crear registros, importar o descargar Excel,
          buscar y filtrar por Departamento y Estado; además ver y editar, habilitar/deshabilitar o eliminar,
          y consultar su situación de pago o deuda (si corresponde).
        </p>
      </div>

      <Toolbar className={styles.toolbar} left={leftToolbar} right={rightToolbar} />

      <DataTable
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
        className={styles.table}
        dataKey="id"
      >
        <Column field="apellido" header="Apellido" sortable />
        <Column field="nombre" header="Nombre" sortable />
        <Column field="dni" header="DNI" sortable />
        <Column field="departamento" header="Departamento" body={(r) => toCanonicalDepartamento(r.departamento)} sortable />
        <Column field="establecimientos" header="Establecimiento" body={(r)=> r.establecimientos || r.establecimiento || '—'} />
        <Column field="celular" header="Celular" />
        <Column field="email" header="Email" />
        <Column header="Estado" body={estadoBodyTemplate} sortable />
        <Column field="observaciones" header="Observaciones" className={styles.observacionesCol} />
        <Column header="Acciones" body={accionesTemplate} exportable={false} />
      </DataTable>

      {/* Modal Ver */}
      <Dialog header="Detalle de Adherente" visible={visibleVer} style={{ width: 640 }} modal onHide={() => setVisibleVer(false)}>
        <div className={styles.viewGrid}>
          <div><strong>Apellido y Nombre:</strong> {rowVer ? `${rowVer.apellido || '—'}, ${rowVer?.nombre || '—'}` : '—'}</div>
          <div><strong>DNI:</strong> {rowVer?.dni || '—'}</div>
          <div><strong>Afiliación:</strong> {afiliacionLabel(rowVer?.nroAfiliacion)}</div>
          <div><strong>Título de grado:</strong> {rowVer?.tituloGrado || '—'}</div>
          <div><strong>Descuento:</strong> {toSiNo(rowVer?.descuento)}</div>
          <div><strong>Departamento:</strong> {toCanonicalDepartamento(rowVer?.departamento) || '—'}</div>
          <div><strong>Establecimiento:</strong> {rowVer?.establecimientos || rowVer?.establecimiento || '—'}</div>
          <div><strong>Celular:</strong> {rowVer?.celular || '—'}</div>
          <div><strong>Email:</strong> {rowVer?.email || '—'}</div>
          <div className={styles.viewRowFull}><strong>Observaciones:</strong><div>{rowVer?.observaciones || '—'}</div></div>
          <div><strong>Adherente:</strong> Sí</div>
          <div><strong>Estado:</strong> <Tag value={rowVer?.estado ? 'Habilitado' : 'No habilitado'} severity={rowVer?.estado ? 'success' : 'danger'} /></div>
        </div>
      </Dialog>

      {/* Modal alta/edición */}
      <Dialog header={editandoId ? 'Editar adherente' : 'Nuevo adherente'} visible={visibleDialog} style={{ width: 760 }} modal onHide={() => setVisibleDialog(false)}>
        <div className={styles.formGrid}>
          {/* ... (form completo exactamente igual que arriba) ... */}
          <div className={styles.formRow}>
            <label>Apellido</label>
            <InputText autoFocus value={form.apellido} onChange={(e) => setForm(f => ({ ...f, apellido: e.target.value }))} />
          </div>
          <div className={styles.formRow}>
            <label>Nombre</label>
            <InputText value={form.nombre} onChange={(e) => setForm(f => ({ ...f, nombre: e.target.value }))} />
          </div>
          <div className={styles.formRow}>
            <label>DNI</label>
            <InputText value={form.dni} onChange={(e) => setForm(f => ({ ...f, dni: e.target.value }))} inputMode="numeric" pattern="\d*" />
          </div>
          <div className={styles.formRow}>
            <label>N° de afiliación</label>
            <InputText value={form.nroAfiliacion} onChange={(e) => setForm(f => ({ ...f, nroAfiliacion: e.target.value }))} inputMode="numeric" pattern="\d*" />
          </div>
          <div className={styles.formRow}>
            <label>Título de grado (nombre de la carrera)</label>
            <InputText value={form.tituloGrado} onChange={(e) => setForm(f => ({ ...f, tituloGrado: e.target.value }))} />
          </div>
          <div className={styles.formRow}>
            <label>Descuento</label>
            <Dropdown value={form.descuento} onChange={(e) => setForm(f => ({ ...f, descuento: e.value }))} options={[{label:'Sí', value:'si'},{label:'No', value:'no'}]} placeholder="Seleccionar…" showClear />
          </div>
          <div className={styles.formRow}>
            <label>Departamento</label>
            <Dropdown value={form.departamento} onChange={(e) => setForm(f => ({ ...f, departamento: e.value }))} options={DEPARTAMENTOS} placeholder="Selecciona" showClear />
          </div>
          <div className={styles.formRow}>
            <label>Establecimiento</label>
            <InputText value={form.establecimientos} onChange={(e) => setForm(f => ({ ...f, establecimientos: e.target.value }))} />
          </div>
          <div className={styles.formRow}>
            <label>Celular</label>
            <InputText value={form.celular} onChange={(e) => setForm(f => ({ ...f, celular: e.target.value }))} inputMode="tel" />
          </div>
          <div className={styles.formRow}>
            <label>Email</label>
            <InputText type="email" value={form.email} onChange={(e) => setForm(f => ({ ...f, email: e.target.value }))} />
          </div>
          <div className={styles.formRow}>
            <label>Estado</label>
            <div className={styles.switchInline}>
              <InputSwitch checked={form.estado} onChange={(e) => setForm(f => ({ ...f, estado: e.value }))} />
              <span className={styles.switchLabel}>{form.estado ? 'Habilitado' : 'No habilitado'}</span>
            </div>
          </div>
          <div className={styles.formRowFull}>
            <label>Observaciones</label>
            <InputTextarea autoResize rows={3} value={form.observaciones} onChange={(e) => setForm(f => ({ ...f, observaciones: e.target.value }))} />
          </div>
        </div>

        <div className={styles.dialogActions}>
          <Button label="Guardar" icon="pi pi-check" severity="success" onClick={guardar} loading={saving} />
          <Button label="Cancelar" icon="pi pi-times" severity="danger" onClick={() => setVisibleDialog(false)} disabled={saving} />
        </div>
      </Dialog>

      {/* Modal Cotizante */}
      <Dialog
        header="Cotizante — Actualizar observaciones y eliminar"
        visible={cotzVisible}
        style={{ width: 680 }}
        modal
        onHide={() => setCotzVisible(false)}
        footer={
          <div className="flex gap-2 justify-content-end">
            <Button label="Cancelar" text onClick={() => setCotzVisible(false)} disabled={cotzSaving} />
            <Button label="Aplicar y eliminar" icon="pi pi-check" severity="warning" onClick={runCotizante} loading={cotzSaving} />
          </div>
        }
      >
        <div className={styles.formGrid}>
          <div className={styles.formRow}><label>Apellido y Nombre</label><InputText value={cotzRow ? `${cotzRow.apellido || ''}, ${cotzRow.nombre || ''}` : ''} readOnly /></div>
          <div className={styles.formRow}><label>DNI</label><InputText value={cotzRow?.dni || ''} readOnly /></div>
          <div className={styles.formRow}><label>N° de afiliación</label><InputText value={cotzRow?.nroAfiliacion ?? ''} readOnly /></div>
          <div className={styles.formRowFull}><label>Observaciones (se guardará en “nuevoAfiliado”)</label><InputTextarea autoResize rows={3} value={cotzObs} onChange={(e) => setCotzObs(e.target.value)} /></div>
        </div>
      </Dialog>

      {/* ⏳ Modal Importando */}
      <Dialog header="Importando Excel" visible={importing} style={{ width: 420 }} modal closable={false}>
        <div className={styles.center}>
          <ProgressSpinner />
          <p style={{ marginTop: 12 }}>Procesando registros… Esto puede tardar según el tamaño del archivo.</p>
        </div>
      </Dialog>
    </div>
  );
}
