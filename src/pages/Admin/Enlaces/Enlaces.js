import React, { useState, useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useHistory } from 'react-router';
import { DataTable } from 'primereact/datatable';
import { Column } from 'primereact/column';
import { Button } from 'primereact/button';
import { Paginator } from 'primereact/paginator';
import { Ripple } from 'primereact/ripple';
import { ProgressSpinner } from 'primereact/progressspinner';
import Swal from 'sweetalert2';

import styles from './styles.module.css';
import {
  clearStatus,
  clearEnlaces,
  deleteEnlace,
  getEnlace,
  getEnlaces,
} from '../../../redux/reducers/enlaces/actions';

// 🔎 Para búsqueda global (carga completa)
import { db } from '../../../firebase/firebase-config';
import { collection, getDocs, query, orderBy } from 'firebase/firestore';

const Enlaces = () => {
  const dispatch = useDispatch();
  const history = useHistory();

  const enlace = useSelector((state) => state.enlace);
  const page = useSelector((state) => state.enlace.page);

  // UI / UX
  const [prevDisable, setPrevDisable] = useState(false);
  const [nextDisable, setNextDisable] = useState(false);
  const [subirEnlacesActive, setSubirEnlacesActive] = useState(false);

  // 🔎 Búsqueda global
  const [filterValue, setFilterValue] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [searchLoading, setSearchLoading] = useState(false);
  const [allData, setAllData] = useState([]); // cache de todos los enlaces
  const [searchResults, setSearchResults] = useState([]);

  // Carga inicial (primera página)
  useEffect(() => {
    dispatch(getEnlaces());
  }, [dispatch]);

  // Control de paginación (habilitar/deshabilitar) cuando NO estamos buscando
  useEffect(() => {
    if (isSearching) return;
    setPrevDisable(page === 1);
    setNextDisable((enlace?.enlaces?.length || 0) < 10);
  }, [page, enlace?.enlaces, isSearching]);

  // Feedback de operaciones (alta, edición y eliminación)
  useEffect(() => {
    if (
      enlace.status === 'SUCCESS_ADD' ||
      enlace.status === 'SUCCESS_UPLOAD' ||
      enlace.status === 'SUCCESS_DELETE'
    ) {
      Swal.fire({
        title: 'Operación exitosa',
        text: enlace.msg,
        icon: 'success',
        confirmButtonText: 'Continuar',
      });
      dispatch(clearStatus());
      if (!isSearching) {
        // si no estamos en modo búsqueda, refrescamos la página actual
        dispatch(getEnlaces());
      } else {
        // si estamos buscando, refrescamos el caché
        runGlobalSearch(false);
      }
    }

    if (
      enlace.status === 'FAILURE_ADD' ||
      enlace.status === 'FAILURE_UPLOAD' ||
      enlace.status === 'FAILURE_DELETE' ||
      enlace.status === 'FAILURE'
    ) {
      Swal.fire({
        title: 'Error',
        text: enlace.msg,
        icon: 'error',
        confirmButtonText: 'Continuar',
      });
      dispatch(clearStatus());
    }
  }, [enlace.status, enlace.msg, dispatch, isSearching]);

  // Handlers básicos
  const handleEdit = (id) => {
    dispatch(getEnlace(id));
    history.push(`/admin/nuevo-enlace/${id}`);
  };

  const handleDelete = async (id, titulo) => {
    const res = await Swal.fire({
      title: '¿Eliminar enlace?',
      html: `<p>Estás por eliminar: <strong>${titulo || id}</strong></p><p>Esta acción no se puede deshacer.</p>`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Sí, eliminar',
      cancelButtonText: 'Cancelar',
      reverseButtons: true,
      focusCancel: true,
    });

    if (res.isConfirmed) {
      dispatch(deleteEnlace(id));
    }
  };

  const handlePagination = (pagination) => {
    if (isSearching) return; // en búsqueda global no usamos paginación server-side

    if (pagination === 'prev' && page === 1) return;
    if (pagination === 'next' && (enlace?.enlaces?.length || 0) < 10) return;

    dispatch(
      getEnlaces(pagination, pagination === 'next' ? enlace.lastEnlace : enlace.firstEnlace)
    );
  };

  // 🔎 Carga completa + filtro (búsqueda global)
  const runGlobalSearch = async (fromUser = true) => {
    const qtext = filterValue.trim();
    if (fromUser && !qtext) return;

    setIsSearching(true);
    setSearchLoading(true);

    try {
      // Cacheamos todos los enlaces si aún no lo hicimos o si venimos de un CRUD
      if (allData.length === 0 || !fromUser) {
        const qRef = query(collection(db, 'enlaces'), orderBy('prioridad', 'asc'));
        const snap = await getDocs(qRef);
        const all = [];
        snap.forEach((doc) => {
          const d = doc.data();
          all.push({
            id: doc.id,
            titulo: d.titulo || '',
            descripcion: d.descripcion || '',
            link: d.link || '',
            prioridad: d.prioridad ?? 0,
          });
        });
        setAllData(all);
      }

      // Filtrado local (case-insensitive) por 3 campos
      const q = qtext.toLowerCase();
      const base = allData.length > 0 ? allData : [];
      const filtered = base.filter((e) => {
        return (
          String(e.titulo).toLowerCase().includes(q) ||
          String(e.descripcion).toLowerCase().includes(q) ||
          String(e.link).toLowerCase().includes(q)
        );
      });

      setSearchResults(filtered);
    } catch (err) {
      console.error(err);
      Swal.fire('Error', 'No se pudo realizar la búsqueda global', 'error');
    } finally {
      setSearchLoading(false);
    }
  };

  // Enter en el input dispara buscar global
  const onKeyDownSearch = (e) => {
    if (e.key === 'Enter') {
      runGlobalSearch(true);
    }
  };

  // 🔄 Volver al inicio (reset total)
  const handleVolverAlInicio = () => {
    setIsSearching(false);
    setFilterValue('');
    setSearchResults([]);
    setAllData([]);
    dispatch(clearEnlaces()); // vuelve a initialState (page=1)
    dispatch(getEnlaces());   // primera página otra vez
  };

  /* ============================
   * Columnas / templates
   * ============================ */

  // 🔗 Link como íconos (sin texto largo)
  const LinkTemplate = (row) => {
    const openInNewTab = () => {
      if (row.link) window.open(row.link, '_blank', 'noopener,noreferrer');
    };

    const copyToClipboard = async () => {
      try {
        await navigator.clipboard.writeText(row.link || '');
        Swal.fire({
          toast: true,
          position: 'top-end',
          icon: 'success',
          title: 'Link copiado',
          showConfirmButton: false,
          timer: 1200,
        });
      } catch (err) {
        Swal.fire({
          toast: true,
          position: 'top-end',
          icon: 'error',
          title: 'No se pudo copiar',
          showConfirmButton: false,
          timer: 1500,
        });
      }
    };

    return (
      <div style={{ display: 'flex', gap: 6, justifyContent: 'center' }}>
        <Button
          type="button"
          icon="pi pi-external-link"
          className="p-button-rounded p-button-text p-button-sm"
          onClick={openInNewTab}
          title="Abrir enlace"
        />
        <Button
          type="button"
          icon="pi pi-copy"
          className="p-button-rounded p-button-text p-button-sm"
          onClick={copyToClipboard}
          title="Copiar enlace"
        />
      </div>
    );
  };

  const ActionsTemplate = (row) => (
    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
      <Button
        label="Editar"
        icon="pi pi-pencil"
        className="p-button-raised p-button-primary"
        onClick={() => handleEdit(row.id)}
        disabled={enlace.processing}
      />
      <Button
        label="Eliminar"
        icon="pi pi-trash"
        className="p-button-raised p-button-danger"
        onClick={() => handleDelete(row.id, row.titulo)}
        disabled={enlace.processing}
      />
    </div>
  );

  // Definición de columnas con anchos ajustados
  const columns = [
    {
      field: 'prioridad',
      header: 'Prioridad',
      style: { width: '100px' },         // ancho reducido
      bodyStyle: { textAlign: 'center' } // centrado del valor
    },
    { field: 'titulo', header: 'Título' },
    { field: 'descripcion', header: 'Descripción' },
    {
      field: 'link',
      header: 'Enlace',
      body: LinkTemplate,
      style: { width: '120px' },         // columna compacta para íconos
      bodyStyle: { textAlign: 'center' }
    },
    { field: 'id', header: 'Acciones', body: ActionsTemplate },
  ];

  const template2 = {
    layout: 'PrevPageLink CurrentPageReport NextPageLink',
    PrevPageLink: (options) => (
      <button
        type="button"
        className={options.className}
        onClick={() => handlePagination('prev')}
        disabled={prevDisable || enlace.processing}
      >
        <span className="p-3">Anterior</span>
      </button>
    ),
    NextPageLink: (options) => (
      <button
        type="button"
        className={options.className}
        onClick={() => handlePagination('next')}
        disabled={nextDisable || enlace.processing}
      >
        <span className="p-3">Siguiente</span>
      </button>
    ),
    CurrentPageReport: (options) => (
      <button type="button" className={options.className} onClick={options.onClick}>
        {page}
        <Ripple />
      </button>
    ),
  };

  // Dataset a mostrar: si buscamos, uso searchResults; si no, Redux page actual
  const dataToShow = isSearching ? searchResults : enlace.enlaces;

  return (
    <div className={styles.container}>
      {/* Barra superior */}
      <div className={styles.title_and_button} style={{ gap: 8, flexWrap: 'wrap' }}>
        <h3 className={styles.title} style={{ marginBottom: 8 }}>
          Enlaces
        </h3>

        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          {/* 🔎 Búsqueda global */}
          <span className="p-input-icon-left" style={{ minWidth: 260 }}>
            <i className="pi pi-search" />
            <input
              type="text"
              className="p-inputtext p-component"
              placeholder="Buscar en toda la lista (título, descripción, link)"
              value={filterValue}
              onChange={(e) => setFilterValue(e.target.value)}
              onKeyDown={onKeyDownSearch}
              style={{ width: '100%' }}
            />
          </span>
          <Button
            label="Buscar"
            icon="pi pi-search"
            onClick={() => runGlobalSearch(true)}
            disabled={searchLoading || !filterValue.trim()}
          />
          <Button
            label="Volver al inicio"
            icon="pi pi-replay"
            className="p-button-secondary"
            onClick={handleVolverAlInicio}
            disabled={enlace.processing && !isSearching}
          />

          <div style={{ width: 12 }} />

          <Button
            label="Nuevo enlace"
            icon="pi pi-plus"
            onClick={() => history.push('/admin/nuevo-enlace')}
          />
          <Button
            label={subirEnlacesActive ? 'Ver enlaces' : 'Subir Enlaces'}
            icon={subirEnlacesActive ? 'pi pi-search' : 'pi pi-file'}
            onClick={() => setSubirEnlacesActive(!subirEnlacesActive)}
            className="p-button-help"
          />
        </div>
      </div>

      <div className={styles.table_upload}>
        {subirEnlacesActive ? (
          // vista de carga por Excel
          <React.Suspense fallback={<ProgressSpinner />}>
            {/* mantengo tu componente */}
            {/* SubirEnlaces no usa búsqueda ni paginación */}
          </React.Suspense>
        ) : searchLoading ? (
          <div style={{ display: 'grid', placeItems: 'center', padding: '2rem' }}>
            <ProgressSpinner className="loader" />
            <p style={{ marginTop: 12 }}>Buscando en toda la lista…</p>
          </div>
        ) : dataToShow.length > 0 ? (
          <>
            <DataTable
              value={dataToShow}
              responsiveLayout="scroll"
              loading={enlace.processing && !isSearching}
              emptyMessage={
                isSearching
                  ? 'No hay resultados que coincidan con la búsqueda.'
                  : 'No hay enlaces para mostrar.'
              }
            >
              {columns.map((col) => (
                <Column
                  key={col.field}
                  field={col.field}
                  header={col.header}
                  body={col.body}
                  style={col.style}
                  headerStyle={col.headerStyle}
                  bodyStyle={{ overflowWrap: 'break-word', ...(col.bodyStyle || {}) }}
                />
              ))}
            </DataTable>

            {/* Paginador sólo cuando NO estamos en búsqueda */}
            {!isSearching && <Paginator template={template2} />}
          </>
        ) : enlace.processing && !isSearching ? (
          <div style={{ display: 'grid', placeItems: 'center', padding: '2rem' }}>
            <ProgressSpinner className="loader" />
          </div>
        ) : (
          <Button
            label={isSearching ? 'Sin resultados' : 'No hay enlaces'}
            className={`p-button-outlined p-button-danger ${styles.errorBtn}`}
          />
        )}
      </div>
    </div>
  );
};

export default Enlaces;
