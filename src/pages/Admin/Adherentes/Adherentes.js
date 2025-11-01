// Adherente.js
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
import { confirmDialog } from 'primereact/confirmdialog';
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

// 👇 Ajusta esta ruta según tu proyecto
import { db } from '../../../firebase/firebase-config';

import styles from './Adherente.module.css';

// ===== Colección en Firestore =====
const COLLECTION = 'adherentes';

// ===== Opciones de departamento =====
const DEPARTAMENTOS = [
  'Ambato','Ancasti','Andalgalá','Antofagasta de la Sierra','Belén','Capayán','Capital',
  'El Alto','Fray Mamerto Esquiú','La Paz','Paclín','Pomán','Santa María','Santa Rosa',
  'Tinogasta','Valle Viejo',
].map(d => ({ label: d, value: d }));

// ===== Utils =====
const pad2 = (n) => String(n).padStart(2, '0');
const nowDMYHM = () => {
  const d = new Date();
  return `${pad2(d.getDate())}/${pad2(d.getMonth()+1)}/${d.getFullYear()} ${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
};
const normalize = (t) =>
  (t ?? '').toString().trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
const normalizeText = (t) => normalize(t);

// Parse texto de estado → boolean
const parseEstado = (v) => {
  const s = normalize(String(v));
  return ['1','true','si','sí','habilitado','habilitada','activo','activa'].includes(s);
};

// Mapear encabezados del Excel a claves de Firestore
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
    establecimiento: 'establecimiento',
    establecimientos: 'establecimiento',
    celular: 'celular',
    telefono: 'celular',
    tel: 'celular',
    email: 'email',
    correo: 'email',
    estado: 'estado',
    observaciones: 'observaciones',
    observacion: 'observaciones',
  };
  return map[s] || null;
};

export default function Adherente() {
  const toast = useRef(null);

  // Base
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);

  // Filtros
  const [busqueda, setBusqueda] = useState('');
  const [deptoSeleccionado, setDeptoSeleccionado] = useState(null); // UI
  const [deptoAplicado, setDeptoAplicado] = useState(null);         // Query

  // Paginación
  const [first, setFirst] = useState(0);

  // Modal alta/edición
  const [visibleDialog, setVisibleDialog] = useState(false);
  const [editandoId, setEditandoId] = useState(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    apellido: '',
    nombre: '',
    dni: '',
    departamento: '',
    establecimiento: '',
    celular: '',
    email: '',
    estado: true,
    observaciones: '',
  });

  // Modal Ver (solo lectura)
  const [visibleVer, setVisibleVer] = useState(false);
  const [rowVer, setRowVer] = useState(null);

  // ===== Importar Excel =====
  const [importVisible, setImportVisible] = useState(false);
  const [importPreview, setImportPreview] = useState([]); // filas parseadas listas para importar
  const [importFileName, setImportFileName] = useState('');
  const [importing, setImporting] = useState(false);

  // ===== Suscripción a Firestore (con filtro por departamento aplicado) =====
  useEffect(() => {
    setLoading(true);
    const base = collection(db, COLLECTION);
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

  // Reset paginación al cambiar filtro aplicado
  useEffect(() => setFirst(0), [deptoAplicado]);

  // ===== Búsqueda en cliente =====
  const dataFiltrada = useMemo(() => {
    const s = normalizeText(busqueda).trim();
    if (!s) return [...rows];

    return rows.filter(r => {
      const estadoTxt = r.estado ? 'habilitado' : 'no habilitado';
      const txt = normalizeText(
        `${r.apellido||''} ${r.nombre||''} ${r.dni||''} ${r.departamento||''} ${r.establecimiento||''} ${r.celular||''} ${r.email||''} ${estadoTxt} ${r.observaciones||''}`
      );
      return txt.includes(s);
    });
  }, [rows, busqueda]);

  // ===== CRUD =====
  const abrirNuevo = () => {
    setEditandoId(null);
    setForm({
      apellido: '',
      nombre: '',
      dni: '',
      departamento: '',
      establecimiento: '',
      celular: '',
      email: '',
      estado: true,
      observaciones: '',
    });
    setVisibleDialog(true);
  };

  const abrirEditar = (row) => {
    setEditandoId(row.id);
    setForm({
      apellido: row.apellido || '',
      nombre: row.nombre || '',
      dni: row.dni || '',
      departamento: row.departamento || '',
      establecimiento: row.establecimiento || '',
      celular: row.celular || '',
      email: row.email || '',
      estado: typeof row.estado === 'boolean' ? row.estado : true,
      observaciones: row.observaciones || '',
    });
    setVisibleDialog(true);
  };

  const abrirVer = (row) => { setRowVer(row); setVisibleVer(true); };

  const validar = () => {
    const faltan = [];
    if (!form.apellido.trim()) faltan.push('Apellido');
    if (!form.nombre.trim()) faltan.push('Nombre');
    if (!form.dni.trim()) faltan.push('DNI');
    if (!form.departamento) faltan.push('Departamento');
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
        departamento: form.departamento || '',
        establecimiento: form.establecimiento?.trim() || '',
        celular: form.celular?.trim() || '',
        email: form.email?.trim() || '',
        estado: !!form.estado,
        observaciones: form.observaciones?.trim() || '',
        fechaAlta: nowDMYHM(),
      };

      if (editandoId) {
        await updateDoc(doc(db, COLLECTION, editandoId), payload);
        toast.current?.show({ severity: 'success', summary: 'Actualizado', detail: 'Registro actualizado.' });
      } else {
        await addDoc(collection(db, COLLECTION), payload);
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
      await deleteDoc(doc(db, COLLECTION, row.id));
      toast.current?.show({ severity: 'success', summary: 'Eliminado', detail: 'Registro borrado.' });
    } catch (err) {
      console.error('borrar adherente:', err);
      toast.current?.show({ severity: 'error', summary: 'Error', detail: 'No se pudo borrar.' });
    }
  };

  const toggleEstado = async (row) => {
    try {
      await updateDoc(doc(db, COLLECTION, row.id), { estado: !row.estado });
      toast.current?.show({
        severity: !row.estado ? 'success' : 'warn',
        summary: 'Estado actualizado',
        detail: !row.estado ? 'Ahora está Habilitado' : 'Ahora está No habilitado',
      });
    } catch (err) {
      console.error('toggleEstado:', err);
      toast.current?.show({ severity: 'error', summary: 'Error', detail: 'No se pudo actualizar el estado.' });
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

  // ====== Importar Excel ======
  const onExcelChange = async (file) => {
    if (!file) return;
    try {
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: 'array' });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const rowsJson = XLSX.utils.sheet_to_json(ws, { raw: false });

      if (!rowsJson.length) {
        toast.current?.show({ severity: 'warn', summary: 'Archivo vacío', detail: 'No se encontraron filas.' });
        setImportPreview([]);
        return;
      }

      // Mapear encabezados
      const mapped = rowsJson.map((r) => {
        const obj = {
          apellido: '',
          nombre: '',
          dni: '',
          departamento: '',
          establecimiento: '',
          celular: '',
          email: '',
          estado: true,
          observaciones: '',
        };
        for (const key of Object.keys(r)) {
          const k = headerKey(key);
          if (!k) continue;
          if (k === 'estado') obj.estado = parseEstado(r[key]);
          else obj[k] = String(r[key] ?? '').trim();
        }
        return obj;
      });

      // Validación mínima (DNI + Apellido + Nombre)
      const invalid = mapped.filter(m => !m.dni || !m.apellido || !m.nombre);
      if (invalid.length) {
        toast.current?.show({
          severity: 'warn',
          summary: 'Columnas requeridas',
          detail: 'Cada fila debe incluir al menos Apellido, Nombre y DNI.',
          life: 6000,
        });
      }

      setImportPreview(mapped);
      toast.current?.show({ severity: 'info', summary: 'Vista previa lista', detail: `Filas detectadas: ${mapped.length}` });
    } catch (err) {
      console.error('onExcelChange:', err);
      toast.current?.show({ severity: 'error', summary: 'Error al leer Excel', detail: 'Revisá el formato del archivo.' });
      setImportPreview([]);
    }
  };

  const procesarImportacion = async () => {
    if (!importPreview.length) {
      toast.current?.show({ severity: 'warn', summary: 'Sin datos', detail: 'Cargá un archivo válido.' });
      return;
    }

    setImporting(true);
    let creados = 0, actualizados = 0, fallidos = 0;

    try {
      for (const r of importPreview) {
        try {
          if (!r?.dni?.trim() || !r?.apellido?.trim() || !r?.nombre?.trim()) {
            fallidos++;
            continue;
          }

          // Buscar si existe por DNI
          const qRef = query(collection(db, COLLECTION), where('dni', '==', r.dni.trim()), limit(1));
          const snap = await getDocs(qRef);

          const payload = {
            apellido: r.apellido.trim(),
            nombre: r.nombre.trim(),
            dni: r.dni.trim(),
            departamento: r.departamento || '',
            establecimiento: r.establecimiento || '',
            celular: r.celular || '',
            email: r.email || '',
            estado: !!r.estado,
            observaciones: r.observaciones || '',
          };

          if (snap.empty) {
            // Crear
            await addDoc(collection(db, COLLECTION), { ...payload, fechaAlta: nowDMYHM() });
            creados++;
          } else {
            // Actualizar (primer doc coincidente por DNI)
            const docId = snap.docs[0].id;
            await updateDoc(doc(db, COLLECTION, docId), payload);
            actualizados++;
          }
        } catch {
          fallidos++;
        }
      }

      toast.current?.show({
        severity: 'success',
        summary: 'Importación finalizada',
        detail: `Creados: ${creados} | Actualizados: ${actualizados} | Fallidos: ${fallidos}`,
        life: 6000,
      });
      setImportVisible(false);
      setImportPreview([]);
      setImportFileName('');
    } catch (err) {
      console.error('procesarImportacion:', err);
      toast.current?.show({ severity: 'error', summary: 'Error en importación', detail: 'Ocurrió un problema al importar.' });
    } finally {
      setImporting(false);
    }
  };

  // ===== UI helpers =====
  const accionesTemplate = (row) => (
    <div className={styles.actions}>
      <Button icon="pi pi-eye" tooltip="Ver" rounded text aria-label="Ver" onClick={() => abrirVer(row)} />
      <Button icon="pi pi-pencil" tooltip="Editar" rounded text aria-label="Editar" onClick={() => abrirEditar(row)} />
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
      <Button
        label="Importar Excel"
        icon="pi pi-file-excel"
        severity="help"
        onClick={() => {
          setImportPreview([]);
          setImportFileName('');
          setImportVisible(true);
        }}
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
          placeholder="Buscar (apellido, nombre, DNI, email, ...)"
        />
      </span>

      <Dropdown
        value={deptoSeleccionado}
        onChange={(e) => setDeptoSeleccionado(e.value)}
        options={DEPARTAMENTOS}
        placeholder="Departamento"
        className={styles.filterItem}
        showClear
      />

      <Button
        label="Filtrar"
        icon="pi pi-filter"
        onClick={() => {
          setDeptoAplicado(deptoSeleccionado || null);
          setFirst(0);
          toast.current?.show({
            severity: 'info',
            summary: 'Filtro aplicado',
            detail: deptoSeleccionado ? `Departamento: ${deptoSeleccionado}` : 'Todos',
          });
        }}
      />

      <Button
        text
        label="Limpiar"
        onClick={() => {
          setBusqueda('');
          setDeptoSeleccionado(null);
          setDeptoAplicado(null);
          setFirst(0);
        }}
      />
    </div>
  );

  return (
    <div className={styles.container}>
      <Toast ref={toast} />
      <div className={styles.header}>
        <h2>Afiliados Adherentes</h2>
        <p className={styles.subtitle}>Apellido, Nombre, DNI, Departamento, Establecimiento, Celular, Email, Estado y Observaciones.</p>
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
        <Column field="departamento" header="Departamento" sortable />
        <Column field="establecimiento" header="Establecimiento" />
        <Column field="celular" header="Celular" />
        <Column field="email" header="Email" />
        <Column header="Estado" body={estadoBodyTemplate} sortable />
        <Column field="observaciones" header="Observaciones" className={styles.observacionesCol} />
        <Column header="Acciones" body={accionesTemplate} exportable={false} />
      </DataTable>

      {/* Modal alta/edición */}
      <Dialog
        header={editandoId ? 'Editar adherente' : 'Nuevo adherente'}
        visible={visibleDialog}
        style={{ width: 720 }}
        modal
        onHide={() => setVisibleDialog(false)}
      >
        <div className={styles.formGrid}>
          {/* Apellido */}
          <div className={styles.formRow}>
            <label>Apellido</label>
            <InputText
              autoFocus
              value={form.apellido}
              onChange={(e) => setForm(f => ({ ...f, apellido: e.target.value }))}
            />
          </div>

          {/* Nombre */}
          <div className={styles.formRow}>
            <label>Nombre</label>
            <InputText
              value={form.nombre}
              onChange={(e) => setForm(f => ({ ...f, nombre: e.target.value }))}
            />
          </div>

          {/* DNI */}
          <div className={styles.formRow}>
            <label>DNI</label>
            <InputText
              value={form.dni}
              onChange={(e) => setForm(f => ({ ...f, dni: e.target.value }))}
              inputMode="numeric"
              pattern="\d*"
            />
          </div>

          {/* Departamento */}
          <div className={styles.formRow}>
            <label>Departamento</label>
            <Dropdown
              value={form.departamento}
              onChange={(e) => setForm(f => ({ ...f, departamento: e.value }))}
              options={DEPARTAMENTOS}
              placeholder="Selecciona"
              showClear
            />
          </div>

          {/* Establecimiento */}
          <div className={styles.formRow}>
            <label>Establecimiento</label>
            <InputText
              value={form.establecimiento}
              onChange={(e) => setForm(f => ({ ...f, establecimiento: e.target.value }))}
            />
          </div>

          {/* Celular */}
          <div className={styles.formRow}>
            <label>Celular</label>
            <InputText
              value={form.celular}
              onChange={(e) => setForm(f => ({ ...f, celular: e.target.value }))}
              inputMode="tel"
            />
          </div>

          {/* Email */}
          <div className={styles.formRow}>
            <label>Email</label>
            <InputText
              type="email"
              value={form.email}
              onChange={(e) => setForm(f => ({ ...f, email: e.target.value }))}
            />
          </div>

          {/* Estado */}
          <div className={styles.formRowSwitch}>
            <label>Estado</label>
            <div className={styles.switchInline}>
              <InputSwitch
                checked={form.estado}
                onChange={(e) => setForm(f => ({ ...f, estado: e.value }))}
              />
              <span className={styles.switchLabel}>
                {form.estado ? 'Habilitado' : 'No habilitado'}
              </span>
            </div>
          </div>

          {/* Observaciones */}
          <div className={styles.formRowFull}>
            <label>Observaciones</label>
            <InputTextarea
              autoResize
              rows={3}
              value={form.observaciones}
              onChange={(e) => setForm(f => ({ ...f, observaciones: e.target.value }))}
            />
          </div>
        </div>

        {/* Acciones */}
        <div className={styles.dialogActions}>
          <Button label="Guardar" icon="pi pi-check" severity="success" onClick={guardar} loading={saving} />
          <Button label="Cancelar" icon="pi pi-times" severity="danger" onClick={() => setVisibleDialog(false)} disabled={saving} />
        </div>
      </Dialog>

      {/* Modal Ver */}
      <Dialog
        header="Detalle de Adherente"
        visible={visibleVer}
        style={{ width: 600 }}
        modal
        onHide={() => setVisibleVer(false)}
      >
        <div className={styles.viewGrid}>
          <div><strong>Apellido:</strong> {rowVer?.apellido || '-'}</div>
          <div><strong>Nombre:</strong> {rowVer?.nombre || '-'}</div>
          <div><strong>DNI:</strong> {rowVer?.dni || '-'}</div>
          <div><strong>Departamento:</strong> {rowVer?.departamento || '-'}</div>
          <div><strong>Establecimiento:</strong> {rowVer?.establecimiento || '-'}</div>
          <div><strong>Celular:</strong> {rowVer?.celular || '-'}</div>
          <div><strong>Email:</strong> {rowVer?.email || '-'}</div>
          <div>
            <strong>Estado:</strong>{' '}
            <Tag value={rowVer?.estado ? 'Habilitado' : 'No habilitado'} severity={rowVer?.estado ? 'success' : 'danger'} />
          </div>
          <div className={styles.viewRowFull}>
            <strong>Observaciones:</strong>
            <div>{rowVer?.observaciones || '-'}</div>
          </div>
        </div>
      </Dialog>

      {/* Modal Importar Excel */}
      <Dialog
        header="Importar Adherentes desde Excel"
        visible={importVisible}
        style={{ width: 820 }}
        modal
        onHide={() => setImportVisible(false)}
      >
        <div className={styles.importGrid}>
          <div className={styles.formRowFull}>
            <label>Archivo (.xlsx o .xls)</label>
            <input
              type="file"
              accept=".xlsx,.xls"
              onChange={(e) => {
                const f = e.target.files?.[0];
                setImportFileName(f?.name || '');
                onExcelChange(f);
              }}
            />
            {importFileName && <small className={styles.fileHint}>Archivo: {importFileName}</small>}
            <small className={styles.help}>
              Encabezados esperados (flexibles): Apellido, Nombre, DNI, Departamento, Establecimiento, Celular, Email, Estado (Habilitado/No), Observaciones.
            </small>
          </div>

          <div className={styles.formRowFull} style={{ marginTop: 10 }}>
            <strong>Vista previa ({importPreview.length} filas)</strong>
            <DataTable
              value={importPreview.slice(0, 50)}
              rows={10}
              paginator
              stripedRows
              className={styles.table}
            >
              <Column field="apellido" header="Apellido" />
              <Column field="nombre" header="Nombre" />
              <Column field="dni" header="DNI" />
              <Column field="departamento" header="Departamento" />
              <Column field="establecimiento" header="Establecimiento" />
              <Column field="celular" header="Celular" />
              <Column field="email" header="Email" />
              <Column
                header="Estado"
                body={(r) => <Tag value={r.estado ? 'Habilitado' : 'No habilitado'} severity={r.estado ? 'success' : 'danger'} />}
              />
              <Column field="observaciones" header="Observaciones" />
            </DataTable>
            {importPreview.length > 50 && <small>Mostrando primeras 50 filas.</small>}
          </div>

          <div className={styles.dialogActions}>
            <Button
              label="Importar"
              icon="pi pi-upload"
              severity="success"
              onClick={procesarImportacion}
              loading={importing}
              disabled={!importPreview.length}
            />
            <Button
              label="Cancelar"
              icon="pi pi-times"
              severity="danger"
              onClick={() => setImportVisible(false)}
              disabled={importing}
            />
          </div>
        </div>
      </Dialog>
    </div>
  );
}
