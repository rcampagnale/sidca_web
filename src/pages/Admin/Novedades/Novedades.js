import React, { useState, useEffect, useMemo } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useHistory, useLocation } from 'react-router';
import { DataTable } from 'primereact/datatable';
import { Column } from 'primereact/column';
import { Button } from 'primereact/button';
import { Paginator } from 'primereact/paginator';
import { ProgressSpinner } from 'primereact/progressspinner';
import { confirmDialog } from 'primereact/confirmdialog';
import { ConfirmDialog } from 'primereact/confirmdialog';
import Swal from 'sweetalert2';
import NotificacionesPush from '../NotificacionesPush/NotificacionesPush';

import styles from './styles.module.css';
import {
  clearStatus,
  deleteNovedades,
  getNovedad,
  getNovedades,
} from '../../../redux/reducers/novedades/actions';

const PAGE_SIZE = 10;

const CATEGORIA_LABEL = {
  turismo: 'Turismo',
  casa: 'Casa del Docente',
  predio: 'Predio',
  convenio_comercio: 'Convenio Comercio',
  convenio_hoteles: 'Convenio Hoteles',
};

const CATEGORIAS_PRINCIPALES = [
  { label: 'Todas', value: 'todas' },
  { label: 'Convenio Comercio', value: 'convenio_comercio' },
  { label: 'Convenio Hoteles', value: 'convenio_hoteles' },
  { label: 'Turismo', value: 'turismo' },
  { label: 'Casa del Docente', value: 'casa' },
  { label: 'Predio', value: 'predio' },
];

const normalizarCategoria = (value) => String(value || '').trim().toLowerCase() || 'todas';

const getDepartamentos = (novedad) => {
  if (Array.isArray(novedad?.departamentos)) return novedad.departamentos;
  return novedad?.departamento ? [novedad.departamento] : [];
};

const departamentosBodyTemplate = (row) => {
  if (row.alcanceTodosDepartamentos === true) {
    return <span className={styles.departmentCell}>Todos los departamentos</span>;
  }

  const valores = getDepartamentos(row);
  if (!valores.length) return <span className={styles.noLink}>—</span>;

  const visibles = valores.slice(0, 2).join(', ');
  const resto = valores.length - 2;
  return (
    <span className={styles.departmentCell} title={valores.join(', ')}>
      {visibles}{resto > 0 ? ` +${resto}` : ''}
    </span>
  );
};

const Novedades = () => {
  const dispatch = useDispatch();
  const history = useHistory();
  const location = useLocation();
  const navigationParams = useMemo(() => new URLSearchParams(location.search), [location.search]);
  const vista = navigationParams.get('vista') === 'push' ? 'push' : 'novedades';

  const columns = useMemo(() => ([
    { field: 'prioridad', header: 'Prioridad' },
    { field: 'titulo', header: 'Titulo' },
    { field: 'descripcion', header: 'Descripcion' },
    { field: 'categoria', header: 'Categoria' },
    { field: 'departamentosAlcance', header: 'Departamentos' },
    { field: 'link', header: 'Link' },
    { field: 'id', header: 'Acciones' },
  ]), []);

  const novedades = useSelector((state) => state.novedades);
  const [paginaActual, setPaginaActual] = useState(() => {
    const pagina = Number(navigationParams.get('pagina'));
    return Number.isInteger(pagina) && pagina >= 0 ? pagina : 0;
  });
  const [subirNovedadesActive] = useState(false);

  // === Filtro de categoría ===
  const [categoria, setCategoria] = useState(() => normalizarCategoria(navigationParams.get('categoria')));
  const categorias = useMemo(() => {
    const conocidas = new Set(CATEGORIAS_PRINCIPALES.map((item) => item.value));
    const adicionales = (novedades.novedades || [])
      .map((item) => item.categoria)
      .filter((value) => value && !conocidas.has(value))
      .filter((value, index, values) => values.indexOf(value) === index)
      .map((value) => ({ label: CATEGORIA_LABEL[value] || value, value }));

    return [...CATEGORIAS_PRINCIPALES, ...adicionales];
  }, [novedades.novedades]);

  const handleEdit = async (id) => {
    await dispatch(getNovedad(id));
    history.push({
      pathname: `/admin/nueva-novedad/${id}`,
      search: `?categoria=${encodeURIComponent(categoria)}&pagina=${paginaActual}`,
    });
  };

  const actualizarNavegacion = (nuevaCategoria, nuevaPagina, nuevaVista = vista) => {
    history.replace({
      pathname: '/admin/novedades',
      search: `?vista=${nuevaVista}&categoria=${encodeURIComponent(nuevaCategoria)}&pagina=${nuevaPagina}`,
    });
  };

  const cambiarCategoria = (valor) => {
    const nuevaCategoria = normalizarCategoria(valor);
    setCategoria(nuevaCategoria);
    setPaginaActual(0);
    actualizarNavegacion(nuevaCategoria, 0);
  };

  const cambiarPagina = (nuevaPagina) => {
    setPaginaActual(nuevaPagina);
    actualizarNavegacion(categoria, nuevaPagina);
  };

  const cambiarVista = (nuevaVista) => {
    actualizarNavegacion(categoria, paginaActual, nuevaVista);
  };

  const handlePagination = (pagination) => {
    const totalPaginas = Math.max(1, Math.ceil(novedadesFiltradas.length / PAGE_SIZE));
    if (pagination === 'prev') {
      cambiarPagina(Math.max(0, paginaActual - 1));
      return;
    }
    cambiarPagina(Math.min(totalPaginas - 1, paginaActual + 1));
  };

  // Carga inicial
  useEffect(() => {
    dispatch(getNovedades());
  }, [dispatch]);

  const accept = (id) => {
    dispatch(deleteNovedades(id));
  };

  // Re-fetch tras eliminar con el filtro actual (cuando llega SUCCESS_DELETE)
  useEffect(() => {
    if (novedades.status === 'SUCCESS_DELETE') {
      dispatch(getNovedades());
    }
  }, [novedades.status, dispatch]);

  const confirm = (id) => {
    confirmDialog({
      message: '¿Está seguro que desea eliminar esta novedad?',
      header: 'Atención',
      icon: 'pi pi-exclamation-triangle',
      accept: () => accept(id),
    });
  };

  const actionsBodyTemplate = (row) => (
    <div className={styles.tableActions}>
      <Button
        label="Editar"
        icon="pi pi-pencil"
        className="p-button-raised p-button-primary"
        onClick={() => handleEdit(row.id)}
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
    row.link && String(row.link).toLowerCase() !== 'false' ? (
      <a className={styles.linkButton} href={row.link} target="_blank" rel="noopener noreferrer">
        <i className="pi pi-external-link" aria-hidden="true" />
        Abrir
      </a>
    ) : (
      <span className={styles.noLink}>Sin enlace</span>
    );

  const categoriaBodyTemplate = (row) =>
    <span className={styles.categoryBadge}>
      {CATEGORIA_LABEL[row.categoria] || row.categoria || '—'}
    </span>;

  const descripcionBodyTemplate = (row) => (
    <span className={styles.descriptionCell}>{row.descripcion || '—'}</span>
  );

  const titleBodyTemplate = (row) => (
    <span className={styles.titleCell}>{row.titulo || '—'}</span>
  );

  const dynamicColumns = columns.map((col) => {
    if (col.field === 'id') {
      return (
        <Column
          key={col.field}
          header={col.header}
          body={actionsBodyTemplate}
          className={styles.column_id}
        />
      );
    }
    if (col.field === 'link') {
      return (
        <Column
          key={col.field}
          header={col.header}
          body={linkBodyTemplate}
          className={styles.linkColumn}
        />
      );
    }
    if (col.field === 'categoria') {
      return (
        <Column
          key={col.field}
          header={col.header}
          body={categoriaBodyTemplate}
          className={styles.column_categoria}
        />
      );
    }
    if (col.field === 'departamentosAlcance') {
      return (
        <Column
          key={col.field}
          header={col.header}
          body={departamentosBodyTemplate}
          className={styles.column_departamentosAlcance}
        />
      );
    }
    return (
      <Column
        key={col.field}
        body={col.field === 'titulo' ? titleBodyTemplate : col.field === 'descripcion' ? descripcionBodyTemplate : undefined}
        className={styles[`column_${col.field}`]}
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

  const novedadesFiltradas = useMemo(() => {
    const todas = novedades.novedades || [];
    if (categoria === 'todas') return todas;
    return todas.filter((item) => normalizarCategoria(item.categoria) === categoria);
  }, [novedades.novedades, categoria]);

  const totalPaginas = Math.max(1, Math.ceil(novedadesFiltradas.length / PAGE_SIZE));
  const novedadesPaginadas = useMemo(() => {
    const inicio = paginaActual * PAGE_SIZE;
    return novedadesFiltradas.slice(inicio, inicio + PAGE_SIZE);
  }, [novedadesFiltradas, paginaActual]);

  useEffect(() => {
    if (paginaActual >= totalPaginas) {
      const paginaValida = totalPaginas - 1;
      setPaginaActual(paginaValida);
      actualizarNavegacion(categoria, paginaValida);
    }
  }, [totalPaginas, paginaActual, categoria]);

  const template2 = {
    layout: 'PrevPageLink CurrentPageReport NextPageLink',
    PrevPageLink: (options) => (
      <button
        type="button"
        className={options.className}
        onClick={() => handlePagination('prev')}
        disabled={paginaActual <= 0}
      >
        <span className="p-3">Anterior</span>
      </button>
    ),
    NextPageLink: (options) => (
      <button
        type="button"
        className={options.className}
        onClick={() => handlePagination('next')}
        disabled={paginaActual >= totalPaginas - 1}
      >
        <span className="p-3">Siguiente</span>
      </button>
    ),
    CurrentPageReport: (options) => (
      <span className={options.className}>
        {paginaActual + 1}
      </span>
    ),
  };

  return (
    <div className={styles.container}>
      {/* Necesario para que funcione confirmDialog() */}
      <ConfirmDialog />

      <div className={styles.viewTabs} role="tablist" aria-label="Secciones de novedades">
        <button
          type="button"
          role="tab"
          aria-selected={vista === 'novedades'}
          className={`${styles.viewTab} ${vista === 'novedades' ? styles.viewTabActive : ''}`}
          onClick={() => cambiarVista('novedades')}
        >
          <i className="pi pi-list" aria-hidden="true" />
          Novedades
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={vista === 'push'}
          className={`${styles.viewTab} ${vista === 'push' ? styles.viewTabActive : ''}`}
          onClick={() => cambiarVista('push')}
        >
          <i className="pi pi-bell" aria-hidden="true" />
          Notificaciones Push
        </button>
      </div>

      {vista === 'push' ? (
        <NotificacionesPush />
      ) : (
        <>
        <div className={styles.pageHeader}>
        <h3 className={styles.title}>Novedades</h3>
        <Button
          label="Nueva Novedad"
          icon="pi pi-plus"
          onClick={() => history.push({
            pathname: '/admin/nueva-novedad',
            search: `?categoria=${encodeURIComponent(categoria)}&pagina=${paginaActual}`,
          })}
          className={styles.newButton}
        />
        </div>

      <div className={styles.categoryTabs} role="tablist" aria-label="Categorías de novedades">
        {categorias.map((item) => (
          <button
            key={item.value}
            type="button"
            role="tab"
            aria-selected={categoria === item.value}
            className={`${styles.categoryTab} ${categoria === item.value ? styles.categoryTabActive : ''}`}
            onClick={() => cambiarCategoria(item.value)}
          >
            {item.label}
          </button>
        ))}
      </div>

        <div className={styles.table_upload}>
        {subirNovedadesActive ? (
          <></>
          ) : novedadesPaginadas.length > 0 ? (
          <>
            <div className={styles.desktopTable}>
              <DataTable
                value={novedadesPaginadas}
                loading={novedades.processing}
                className={styles.novedadesTable}
              >
                {dynamicColumns}
              </DataTable>
            </div>
            <div className={styles.mobileCards}>
              {novedadesPaginadas.map((row) => (
                <article className={styles.novedadCard} key={row.id}>
                  <span className={styles.cardCategory}>
                    {CATEGORIA_LABEL[row.categoria] || row.categoria || '—'}
                  </span>
                  {(row.categoria === 'convenio_comercio' || row.categoria === 'convenio_hoteles') && (
                    <span className={styles.mobileDepartment}>
                      <strong>Disponible en:</strong>{' '}
                      {row.alcanceTodosDepartamentos === true
                        ? 'Todos los departamentos'
                        : getDepartamentos(row).length
                          ? getDepartamentos(row).join(', ')
                          : '—'}
                    </span>
                  )}
                  <h4>{row.titulo || '—'}</h4>
                  <p>{row.descripcion || '—'}</p>
                  <div className={styles.cardMeta}>
                    <span>Prioridad: {row.prioridad ?? '—'}</span>
                  </div>
                  {row.link && String(row.link).toLowerCase() !== 'false' && (
                    <a
                      className={styles.mobileLink}
                      href={row.link}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <i className="pi pi-external-link" aria-hidden="true" />
                      Abrir enlace
                    </a>
                  )}
                  <div className={styles.mobileActions}>
                    <Button
                      label="Editar"
                      icon="pi pi-pencil"
                      className="p-button-raised p-button-primary"
                      onClick={() => handleEdit(row.id)}
                    />
                    <Button
                      label="Eliminar"
                      icon="pi pi-trash"
                      className="p-button-raised p-button-danger"
                      onClick={() => confirm(row.id)}
                    />
                  </div>
                </article>
              ))}
            </div>
            <Paginator
              first={paginaActual * PAGE_SIZE}
              rows={PAGE_SIZE}
              totalRecords={novedadesFiltradas.length}
              onPageChange={(event) => cambiarPagina(event.page)}
              template={template2}
            />
          </>
        ) : novedades.processing ? (
          <ProgressSpinner className="loader" />
        ) : (
          <div className={styles.emptyState}>
            <i className="pi pi-inbox" aria-hidden="true" />
            <strong>No hay novedades cargadas en esta categoría.</strong>
            <span>Podés crear una nueva novedad desde el botón superior.</span>
          </div>
        )}
        </div>
        </>
      )}
    </div>
  );
};

export default Novedades;

