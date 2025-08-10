import React, { useEffect, useState } from 'react'
import { useDispatch, useSelector } from 'react-redux';
import { useHistory } from 'react-router';
import { DataTable } from 'primereact/datatable';
import { Column } from 'primereact/column';
import { Button } from 'primereact/button';
import { Paginator } from 'primereact/paginator';
import { Ripple } from 'primereact/ripple';
import { Dialog } from 'primereact/dialog';
import { confirmDialog, ConfirmDialog } from 'primereact/confirmdialog';
import Swal from 'sweetalert2';

import styles from './styles.module.css';
import {
  clearDownload,
  clearStatus,
  deleteAfiliadosNuevos,
  descargarAfiliadosNuevos,
  getAfiliadosNuevos,
  setNuevoAfiliadoDetails
} from '../../../redux/reducers/afiliados/actions';
import { ProgressSpinner } from 'primereact/progressspinner';
import exportFromJSON from 'export-from-json'

const AfiliadosNuevos = () => {
  const dispatch = useDispatch();
  const history = useHistory();

  const columnas = [
    { field: 'fecha', header: 'Fecha' },
    { field: 'hora', header: 'Hora' },
    { field: 'nombre', header: 'Nombre' },
    { field: 'apellido', header: 'Apellido' },
    { field: 'dni', header: 'DNI' },
    { field: 'nroAfiliacion', header: 'Afiliación' }, // 👈 nueva columna visible
    { field: 'id', header: 'Acciones' }
  ];

  const nuevosAfiliados = useSelector(state => state.afiliado.nuevosAfiliados) || [];
  const page = useSelector(state => state.afiliado.page);
  const afiliado = useSelector(state => state.afiliado);
  const downloading = useSelector(state => state.afiliado.downloading) || [];
  const user = useSelector(state => state.user.profile);

  const [visible, setVisible] = useState(false);
  const [prevDisable, setPrevDisable] = useState(false);
  const [nextDisable, setNextDisable] = useState(false);

  // Export
  const ExportToExcel = () => {
    dispatch(descargarAfiliadosNuevos());
  };

  useEffect(() => {
    if (downloading.length > 0) {
      const fileName = 'nuevos_afiliados';
      const exportType = 'xls';
      exportFromJSON({ data: downloading, fileName, exportType });
      dispatch(clearDownload());
    }
  }, [downloading, dispatch]);

  useEffect(() => {
    dispatch(getAfiliadosNuevos());
  }, [dispatch]);

  // Detalles
  const handleEdit = (registro) => {
    dispatch(setNuevoAfiliadoDetails(registro));
    setVisible(true);
  };

  // ❗ Paginación correcta con el evento del Paginator (page base 0)
  const onPageChange = (event) => {
    const currentPage = event.page + 1; // base 1
    const direction = currentPage > page ? 'next' : 'prev';

    if (direction === 'prev' && page === 1) {
      setPrevDisable(true);
      return;
    } else {
      setPrevDisable(false);
    }

    // Nota: nextDisable se decide desde la cantidad devuelta (10 por página)
    setNextDisable((afiliado?.nuevosAfiliados?.length || 0) < 10);

    dispatch(
      getAfiliadosNuevos(
        direction,
        direction === 'next' ? afiliado.lastAfiliado : afiliado.firstAfiliado
      )
    );
  };

  const accept = (id) => {
    dispatch(deleteAfiliadosNuevos(id));
  };

  const confirm = (id) => {
    confirmDialog({
      message: '¿Está seguro que desea eliminar este registro?',
      header: 'Atención',
      icon: 'pi pi-exclamation-triangle',
      acceptLabel: 'Sí, eliminar',
      rejectLabel: 'Cancelar',
      accept: () => accept(id),
      reject: () => {}
    });
  };

  // Columna Acciones y resto dinámicas
  const dynamicColumns = columnas.map((col) => {
    if (col.field === 'id') {
      return (
        <Column
          key={col.field}
          header={col.header}
          body={(row) => (
            <div>
              <Button
                label="Ver Detalles"
                icon="pi pi-plus"
                className="p-button-raised p-button-primary"
                onClick={() => handleEdit(row)}
                style={{ marginRight: 4 }}
              />
              {user?.uid === process.env.REACT_APP_ADMIN_ID && (
                <Button
                  label="Eliminar"
                  icon="pi pi-trash"
                  className="p-button-raised p-button-danger"
                  onClick={() => confirm(row.id)}
                />
              )}
            </div>
          )}
        />
      );
    }

    if (col.field === 'nroAfiliacion') {
      return (
        <Column
          key={col.field}
          header={col.header}
          body={(row) =>
            Number(row.nroAfiliacion) > 1 ? (
              <span className={styles.badgeReafiliado}>
                {row.nroAfiliacion}ª afiliación
              </span>
            ) : (
              '1ª afiliación'
            )
          }
        />
      );
    }

    return (
      <Column
        key={col.field}
        field={col.field}
        header={col.header}
        bodyStyle={{ overflowWrap: 'break-word' }}
      />
    );
  });

  // Mensajes
  useEffect(() => {
    if (
      afiliado.status === 'SUCCESS_ADD' ||
      afiliado.status === 'SUCCESS_UPLOAD' ||
      afiliado.status === 'SUCCESS_DELETE'
    ) {
      Swal.fire({
        title: 'Solicitud Exitosa',
        text: afiliado.msg,
        icon: 'success',
        confirmButtonText: 'Continuar'
      });
      dispatch(clearStatus());
    }
    if (
      afiliado.status === 'FAILURE_ADD' ||
      afiliado.status === 'FAILURE_UPLOAD' ||
      afiliado.status === 'FAILURE_DELETE'
    ) {
      Swal.fire({
        title: 'Error!',
        text: afiliado.msg,
        icon: 'error',
        confirmButtonText: 'Continuar'
      });
      dispatch(clearStatus());
    }
  }, [afiliado.status, afiliado.msg, dispatch]);

  // Template del Paginator (usa onPageChange)
  const template2 = {
    layout: 'PrevPageLink CurrentPageReport NextPageLink',
    PrevPageLink: (options) => (
      <button
        type="button"
        className={options.className}
        onClick={() =>
          onPageChange({ page: Math.max(page - 2, 0) }) /* ir a la anterior (base 0) */
        }
        disabled={prevDisable}
      >
        <span className="p-3">Anterior</span>
      </button>
    ),
    NextPageLink: (options) => (
      <button
        type="button"
        className={options.className}
        onClick={() => onPageChange({ page: page /* actual base1 -> base0 siguiente */ })}
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
    )
  };

  const generateDetails = () => (
    <>
      <h2>
        Nombre:{' '}
        {afiliado.nuevoAfiliado
          ? `${afiliado.nuevoAfiliado.apellido} ${afiliado.nuevoAfiliado.nombre}`
          : 'Cargando...'}
      </h2>
      <h3>
        <b>DNI:</b> {afiliado.nuevoAfiliado?.dni}
      </h3>
      <h3>Departamento: {afiliado.nuevoAfiliado?.departamento}</h3>
      <h3>Establecimiento: {afiliado.nuevoAfiliado?.establecimientos || ''}</h3>
      <h2>{afiliado.nuevoAfiliado?.error ? '\nYA AFILIADO' : ''}</h2>
    </>
  );

  // Resaltado de filas con nroAfiliacion > 1
  const rowClassName = (row) => ({
    [styles.rowReafiliado]: Number(row.nroAfiliacion) > 1
  });

  return (
    <div className={styles.container}>
      {/* Necesario para el confirmDialog programático */}
      <ConfirmDialog />

      <div className={styles.title_and_button}>
        <h3 className={styles.title}>Nuevos Afiliados</h3>
        <Button label="Agregar Usuario" icon="pi pi-plus" onClick={() => history.push("/admin/nuevo-usuario")} />
        <Button label="Descargar" icon="pi pi-download" onClick={ExportToExcel} />
      </div>

      <div>
        {nuevosAfiliados.length > 0 ? (
          <>
            <DataTable
              value={nuevosAfiliados}
              responsiveLayout="scroll"
              loading={afiliado.processing}
              rowClassName={rowClassName}
              emptyMessage="No hay registros."
            >
              {dynamicColumns}
            </DataTable>

            {/* Paginador controlado por onPageChange */}
            <Paginator
              template={template2}
              onPageChange={onPageChange}
            />
          </>
        ) : afiliado.processing ? (
          <ProgressSpinner className="loader" />
        ) : (
          <Button
            label="No hay afiliados nuevos"
            className={`p-button-outlined p-button-danger ${styles.errorBtn}`}
          />
        )}
      </div>

      <Dialog visible={visible} onHide={() => setVisible(false)} footer={() => <div />}>
        {generateDetails()}
      </Dialog>
    </div>
  );
};

export default AfiliadosNuevos;
