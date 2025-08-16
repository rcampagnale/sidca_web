import React, { useState, useEffect, useMemo } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useHistory } from 'react-router';
import { DataTable } from 'primereact/datatable';
import { Column } from 'primereact/column';
import { Button } from 'primereact/button';
import { Paginator } from 'primereact/paginator';
import { Ripple } from 'primereact/ripple';
import { ProgressSpinner } from 'primereact/progressspinner';
import { confirmDialog } from 'primereact/confirmdialog';
import { ConfirmDialog } from 'primereact/confirmdialog';
import { Dropdown } from 'primereact/dropdown';
import Swal from 'sweetalert2';

import styles from './styles.module.css';
import {
  clearStatus,
  deleteNovedades,
  getNovedad,
  getNovedades,
  clearNovedades,
} from '../../../redux/reducers/novedades/actions';

const PAGE_SIZE = 10;

const CATEGORIA_LABEL = {
  turismo: 'Turismo',
  casa: 'Casa del Docente',
  predio: 'Predio',
  convenio_comercio: 'Convenio Comercio',
  convenio_hoteles: 'Convenio Hoteles',
};

const Novedades = () => {
  const dispatch = useDispatch();
  const history = useHistory();

  const columns = useMemo(() => ([
    { field: 'prioridad', header: 'Prioridad' },
    { field: 'titulo', header: 'Titulo' },
    { field: 'descripcion', header: 'Descripcion' },
    { field: 'categoria', header: 'Categoria' },
    { field: 'link', header: 'Link' },
    { field: 'id', header: 'Acciones' },
  ]), []);

  const novedades = useSelector((state) => state.novedades);
  const page = useSelector((state) => state.novedades.page);

  const [prevDisable, setPrevDisable] = useState(false);
  const [nextDisable, setNextDisable] = useState(false);
  const [subirNovedadesActive] = useState(false);

  // === Filtro de categoría ===
  const [categoria, setCategoria] = useState('todas');
  const categorias = [
    { label: 'Todas', value: 'todas' },
    { label: 'Turismo', value: 'turismo' },
    { label: 'Casa del Docente', value: 'casa' },
    { label: 'Predio', value: 'predio' },
    { label: 'Convenio Comercio', value: 'convenio_comercio' },
    { label: 'Convenio Hoteles', value: 'convenio_hoteles' },
  ];

  const handleEdit = async (id) => {
    await dispatch(getNovedad(id));
    history.push(`/admin/nueva-novedad/${id}`);
  };

  const handlePagination = async (pagination) => {
    if (pagination === 'prev' && page === 1) {
      setPrevDisable(true);
      return;
    }
    setPrevDisable(false);
    dispatch(
      getNovedades(
        pagination,
        pagination === 'next' ? novedades.lastNovedad : novedades.firstNovedad,
        categoria
      )
    );
  };

  // Carga inicial
  useEffect(() => {
    dispatch(getNovedades(undefined, undefined, categoria));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dispatch]);

  // Al cambiar categoría: limpiar y pedir primera página filtrada
  useEffect(() => {
    dispatch(clearNovedades());
    setPrevDisable(false);
    setNextDisable(false);
    dispatch(getNovedades(undefined, undefined, categoria));
  }, [categoria, dispatch]);

  // Habilitar/deshabilitar paginación según estado
  useEffect(() => {
    setPrevDisable(page <= 1);
    setNextDisable(novedades.size < PAGE_SIZE);
  }, [page, novedades.size]);

  const accept = (id) => {
    dispatch(deleteNovedades(id));
  };

  // Re-fetch tras eliminar con el filtro actual (cuando llega SUCCESS_DELETE)
  useEffect(() => {
    if (novedades.status === 'SUCCESS_DELETE') {
      dispatch(getNovedades(undefined, undefined, categoria));
    }
  }, [novedades.status, categoria, dispatch]);

  const confirm = (id) => {
    confirmDialog({
      message: '¿Está seguro que desea eliminar esta novedad?',
      header: 'Atención',
      icon: 'pi pi-exclamation-triangle',
      accept: () => accept(id),
    });
  };

  const actionsBodyTemplate = (row) => (
    <div>
      <Button
        label="Editar"
        icon="pi pi-pencil"
        className="p-button-raised p-button-primary"
        onClick={() => handleEdit(row.id)}
        style={{ marginRight: 4 }}
      />
      <Button
        label="Eliminar"
        icon="pi pi-trash"
        className="p-button-raised p-button-danger"
        onClick={() => confirm(row.id)}
      />
    </div>
  );

  const linkBodyTemplate = (row) =>
    row.link ? (
      <a href={row.link} target="_blank" rel="noopener noreferrer">
        {String(row.link).slice(0, 40)}
        {String(row.link).length > 40 ? '…' : ''}
      </a>
    ) : (
      <span style={{ opacity: 0.7 }}>—</span>
    );

  const categoriaBodyTemplate = (row) =>
    CATEGORIA_LABEL[row.categoria] || row.categoria || '—';

  const dynamicColumns = columns.map((col) => {
    if (col.field === 'id') {
      return <Column key={col.field} header={col.header} body={actionsBodyTemplate} />;
    }
    if (col.field === 'link') {
      return (
        <Column
          key={col.field}
          header={col.header}
          body={linkBodyTemplate}
          style={{ minWidth: 200 }}
        />
      );
    }
    if (col.field === 'categoria') {
      return (
        <Column
          key={col.field}
          header={col.header}
          body={categoriaBodyTemplate}
        />
      );
    }
    return (
      <Column
        key={col.field}
        bodyStyle={{ overflowWrap: 'break-word' }}
        field={col.field}
        header={col.header}
      />
    );
  });

  // Mensajes de éxito/error
  useEffect(() => {
    if (
      novedades.status === 'SUCCESS_ADD' ||
      novedades.status === 'SUCCESS_UPLOAD' ||
      novedades.status === 'SUCCESS_DELETE'
    ) {
      Swal.fire({
        title: 'Solicitud Exitosa',
        text: novedades.msg,
        icon: 'success',
        confirmButtonText: 'Continuar',
      });
      dispatch(clearStatus());
    }
    if (
      novedades.status === 'FAILURE_ADD' ||
      novedades.status === 'FAILURE_UPLOAD' ||
      novedades.status === 'FAILURE_DELETE' ||
      novedades.status === 'FAILURE_LIST'
    ) {
      Swal.fire({
        title: 'Error!',
        text: novedades.msg,
        icon: 'error',
        confirmButtonText: 'Continuar',
      });
      dispatch(clearStatus());
    }
  }, [novedades.status, novedades.msg, dispatch]);

  const template2 = {
    layout: 'PrevPageLink CurrentPageReport NextPageLink',
    PrevPageLink: (options) => (
      <button
        type="button"
        className={options.className}
        onClick={() => handlePagination('prev')}
        disabled={prevDisable}
      >
        <span className="p-3">Anterior</span>
      </button>
    ),
    NextPageLink: (options) => (
      <button
        type="button"
        className={options.className}
        onClick={() => handlePagination('next')}
        disabled={nextDisable}
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

  return (
    <div className={styles.container}>
      {/* Necesario para que funcione confirmDialog() */}
      <ConfirmDialog />

      <div className={styles.title_and_button}>
        <h3 className={styles.title}>Novedades</h3>
        <div>
          <Button
            label="Nueva Novedad"
            icon="pi pi-plus"
            onClick={() => history.push('/admin/nueva-novedad')}
            style={{ marginRight: 3 }}
          />
        </div>
      </div>

      {/* 🔽 Filtro de Categoría */}
      <div style={{ marginBottom: '1rem' }}>
        <Dropdown
          value={categoria}
          options={categorias}
          onChange={(e) => setCategoria(e.value)}
          placeholder="Filtrar por categoría"
          className="w-full md:w-20rem"
        />
      </div>

      <div className={styles.table_upload}>
        {subirNovedadesActive ? (
          <></>
        ) : novedades.novedades.length > 0 ? (
          <>
            <DataTable
              value={novedades.novedades}
              responsiveLayout="scroll"
              loading={novedades.processing}
            >
              {dynamicColumns}
            </DataTable>
            <Paginator template={template2} />
          </>
        ) : novedades.processing ? (
          <ProgressSpinner className="loader" />
        ) : (
          <Button
            label="No hay novedades"
            className={`p-button-outlined p-button-danger ${styles.errorBtn}`}
          />
        )}
      </div>
    </div>
  );
};

export default Novedades;

