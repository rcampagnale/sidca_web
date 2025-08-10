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
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  query,
  updateDoc,
  where,
} from 'firebase/firestore';
import { db } from '../../../firebase/firebase-config';
import styles from './ListaAsistencia.module.css';

/** ---- Helpers de fecha (acepta "27/6/2025" o "2025-06-27") ---- */
const parseToDate = (value) => {
  if (!value) return null;
  if (value.includes('-')) {
    const [y, m, d] = value.split('-').map(Number);
    return new Date(y, (m || 1) - 1, d || 1);
  }
  const [d, m, y] = value.split('/').map(Number);
  if (!y || !m || !d) return null;
  return new Date(y, m - 1, d);
};
const dateToDMY = (date) => {
  if (!date) return '';
  const d = String(date.getDate()).padStart(2, '0');
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const y = date.getFullYear();
  return `${d}/${m}/${y}`;
};

const ListaAsistencia = () => {
  const toast = useRef(null);

  // Datos
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);

  // Filtros UI (cliente)
  const [busqueda, setBusqueda] = useState('');
  const [filtroFecha, setFiltroFecha] = useState(null); // Date | null

  // Cursos para el dropdown
  const [cursosOptions, setCursosOptions] = useState([]);

  // Flujo "Filtrar" manual
  const [cursoSeleccionado, setCursoSeleccionado] = useState(null); // lo que elige el usuario
  const [cursoAplicado, setCursoAplicado] = useState(null);         // lo que usa Firestore

  // Paginación controlada
  const [first, setFirst] = useState(0);

  // Modal alta/edición
  const [visibleDialog, setVisibleDialog] = useState(false);
  const [editandoId, setEditandoId] = useState(null);
  const [form, setForm] = useState({
    fecha: new Date(),
    curso: '',
    nombre: '',
    apellido: '',
    dni: '',
    departamento: '',
    nivelEducativo: '',
  });
  const [saving, setSaving] = useState(false);

  // =================== 1) Suscripción para armar lista de cursos ===================
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
      (err) => {
        console.error('cursos (onSnapshot):', err);
      }
    );
    return () => unsub();
  }, []);

  // =================== 2) Suscripción principal con filtro aplicado ===================
  useEffect(() => {
    setLoading(true);
    const base = collection(db, 'asistencia');
    const q = cursoAplicado ? query(base, where('curso', '==', cursoAplicado)) : base;

    const unsub = onSnapshot(
      q,
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

  // Resetear a primera página cuando cambia el filtro aplicado
  useEffect(() => {
    setFirst(0);
  }, [cursoAplicado]);

  // =================== Filtrado adicional (texto/fecha) y orden local por fecha desc ===================
  const dataFiltrada = useMemo(() => {
    const s = (busqueda || '').toLowerCase();
    const filtroDMY = filtroFecha ? dateToDMY(filtroFecha) : null;

    const filtrada = rows.filter((r) => {
      const txt = `${r.nombre || ''} ${r.apellido || ''} ${r.dni || ''} ${r.curso || ''} ${r.departamento || ''} ${r.nivelEducativo || ''}`.toLowerCase();
      const okTexto = s === '' || txt.includes(s);
      const okFecha = !filtroDMY || r.fecha === filtroDMY;
      return okTexto && okFecha;
    });

    const toTime = (f) => parseToDate(f)?.getTime() || 0;
    return filtrada.sort((a, b) => toTime(b.fecha) - toTime(a.fecha));
  }, [rows, busqueda, filtroFecha]);

  // =================== CRUD ===================
  const abrirNuevo = () => {
    setEditandoId(null);
    setForm({
      fecha: new Date(),
      curso: '',
      nombre: '',
      apellido: '',
      dni: '',
      departamento: '',
      nivelEducativo: '',
    });
    setVisibleDialog(true);
  };

  const abrirEditar = (row) => {
    setEditandoId(row.id);
    setForm({
      fecha: parseToDate(row.fecha) || new Date(),
      curso: row.curso || '',
      nombre: row.nombre || '',
      apellido: row.apellido || '',
      dni: row.dni || '',
      departamento: row.departamento || '',
      nivelEducativo: row.nivelEducativo || '',
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

    setSaving(true);
    try {
      const payload = {
        fecha: dateToDMY(form.fecha),
        curso: form.curso.trim(),
        nombre: form.nombre.trim(),
        apellido: form.apellido.trim(),
        dni: form.dni.trim(),
        departamento: (form.departamento || '').trim(),
        nivelEducativo: (form.nivelEducativo || '').trim(),
      };

      if (editandoId) {
        await updateDoc(doc(db, 'asistencia', editandoId), payload);
        toast.current?.show({ severity: 'success', summary: 'Actualizado', detail: 'Registro actualizado.' });
      } else {
        await addDoc(collection(db, 'asistencia'), payload);
        toast.current?.show({ severity: 'success', summary: 'Guardado', detail: 'Registro agregado.' });
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

  // =================== UI / Render ===================
  const accionesTemplate = (row) => (
    <div className={styles.actions}>
      <Button icon="pi pi-pencil" rounded text aria-label="Editar" onClick={() => abrirEditar(row)} />
      <Button icon="pi pi-trash" rounded text severity="danger" aria-label="Borrar" onClick={() => borrar(row)} />
    </div>
  );

  const leftToolbar = (
    <div className={styles.toolbarLeft}>
      <Button label="Nuevo" icon="pi pi-plus" severity="success" onClick={abrirNuevo} />
      <Button
        label="Exportar CSV"
        icon="pi pi-upload"
        className="p-button-secondary"
        onClick={() => dt.current?.exportCSV({ selectionOnly: false })}
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
          placeholder="Buscar (nombre, apellido, DNI, curso)"
        />
      </span>

      {/* Selección de curso (no aplica aún) */}
      <Dropdown
        value={cursoSeleccionado}
        onChange={(e) => setCursoSeleccionado(e.value)}
        options={cursosOptions}
        placeholder="Curso"
        className={styles.filterItem}
        showClear
      />

      {/* Botón Filtrar: aplica al query y resetea paginación */}
      <Button
        label="Filtrar"
        icon="pi pi-filter"
        onClick={() => {
          setCursoAplicado(cursoSeleccionado || null);
          setFirst(0); // reset de paginación
          toast.current?.show({
            severity: 'info',
            summary: 'Filtro aplicado',
            detail: cursoSeleccionado ? `Curso: ${cursoSeleccionado}` : 'Todos los cursos',
          });
        }}
      />

      {/* Filtro por fecha (cliente) */}
      <Calendar
        value={filtroFecha}
        onChange={(e) => setFiltroFecha(e.value)}
        placeholder="Fecha"
        dateFormat="dd/mm/yy"
        className={styles.filterItem}
        showIcon
        readOnlyInput
      />

      {/* Limpiar todo */}
      <Button
        text
        label="Limpiar"
        onClick={() => {
          setBusqueda('');
          setFiltroFecha(null);
          setCursoSeleccionado(null);
          setCursoAplicado(null); // trae todo
          setFirst(0);            // reset paginación
        }}
      />
    </div>
  );

  const dt = useRef(null);

  return (
    <div className={styles.container}>
      <Toast ref={toast} />
      <div className={styles.header}>
        <h2>Asistencia por curso</h2>
        <p className={styles.subtitle}>Elegí un curso, presioná <strong>Filtrar</strong> y se actualiza la grilla.</p>
      </div>

      <Toolbar className={styles.toolbar} left={leftToolbar} right={rightToolbar} />

      <DataTable
        key={cursoAplicado || 'all'}   /* fuerza re-montaje al cambiar filtro */
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
        className={styles.table}
      >
        <Column field="fecha" header="Fecha" body={(r) => r.fecha || ''} sortable />
        <Column field="curso" header="Curso" sortable />
        <Column field="nombre" header="Nombre" sortable />
        <Column field="apellido" header="Apellido" sortable />
        <Column field="dni" header="DNI" sortable />
        <Column field="departamento" header="Departamento" />
        <Column field="nivelEducativo" header="Nivel Educativo" />
        <Column header="Acciones" body={accionesTemplate} exportable={false} />
      </DataTable>

      {/* Modal Alta/Edición */}
      <Dialog
        header={editandoId ? 'Editar registro' : 'Nuevo registro'}
        visible={visibleDialog}
        style={{ width: 540 }}
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
        </div>

        <div className={styles.dialogActions}>
          <Button label="Guardar" icon="pi pi-check" severity="success" onClick={guardar} loading={saving} />
          <Button label="Cancelar" icon="pi pi-times" severity="danger" onClick={() => setVisibleDialog(false)} disabled={saving} />
        </div>
      </Dialog>
    </div>
  );
};

export default ListaAsistencia;



