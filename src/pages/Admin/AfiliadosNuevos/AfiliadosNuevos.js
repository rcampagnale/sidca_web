import React, { useEffect, useState } from 'react'
import { useDispatch, useSelector } from 'react-redux';
import { useHistory } from 'react-router';
import { DataTable } from 'primereact/datatable';
import { Column } from 'primereact/column';
import { Button } from 'primereact/button';
import { Paginator } from 'primereact/paginator';
import { Ripple } from 'primereact/ripple';
import { Dialog } from 'primereact/dialog';
import { confirmDialog } from 'primereact/confirmdialog';
import Swal from 'sweetalert2';

import styles from './styles.module.css';
import { clearDownload, clearStatus, deleteAfiliadosNuevos, descargarAfiliadosNuevos, getAfiliadosNuevos, setNuevoAfiliadoDetails } from '../../../redux/reducers/afiliados/actions';
import { ProgressSpinner } from 'primereact/progressspinner';
import exportFromJSON from 'export-from-json'

const AfiliadosNuevos = () => {

    const dispatch = useDispatch();
    const history = useHistory();

    const columns = [
        { field: 'fecha', header: 'Fecha' },
        { field: 'nombre', header: 'Nombre' },
        { field: 'apellido', header: 'Apellido' },
        { field: 'dni', header: 'DNI' },
        { field: 'id', header: 'Acciones' },
    ];

    const nuevosAfiliados = useSelector(state => state.afiliado.nuevosAfiliados);
    const page = useSelector(state => state.afiliado.page);
    const afiliado = useSelector(state => state.afiliado);
    const downloading = useSelector(state => state.afiliado.downloading);
    const user = useSelector(state => state.user.profile);

    const [visible, setVisible] = useState(false);
    const [prevDisable, setPrevDisable] = useState(false);
    const [nextDisable, setNextDisable] = useState(false);

    const ExportToExcel = () => {
        dispatch(descargarAfiliadosNuevos());
    }

    useEffect(() => {
        if (downloading.length > 0) {
            const fileName = 'nuevos_afiliados'
            const exportType = 'xls'
            exportFromJSON({ data: downloading, fileName, exportType })
            dispatch(clearDownload())
        }
    }, [downloading]);

    useEffect(() => {
        dispatch(getAfiliadosNuevos());
    }, [])

    const handleEdit = (afiliado) => {
        dispatch(setNuevoAfiliadoDetails(afiliado))
        setVisible(true)
    }

    const handlePagination = async (pagination) => {
        if (pagination === 'prev' && page === 1) {
            return setPrevDisable(true)
        } else {
            setPrevDisable(false)
        }
        // if (pagination === 'next' && nuevosAfiliados.length < 10) {
        //     return setNextDisable(true)
        // } else {
        //     setNextDisable(false)
        // }
        dispatch(getAfiliadosNuevos(pagination, pagination === 'next' ? afiliado.lastAfiliado : afiliado.firstAfiliado));
    }

    const accept = (id) => {
        dispatch(deleteAfiliadosNuevos(id))
    }

    const confirm = (id) => {
        confirmDialog({
            message: 'Esta seguro que desea Eliminar?',
            header: 'Atención',
            icon: 'pi pi-exclamation-triangle',
            accept: ()=>accept(id),
            reject: () => {}
        });
    };

    const dynamicColumns = columns.map((col, i) => {
        if (col.field === 'id') {
            return <Column
                key={col.field}
                field={(nuevoAfiliado) => <div>
                    <Button label="Ver Detalles" icon="pi pi-plus" className="p-button-raised p-button-primary" onClick={() => handleEdit(nuevoAfiliado)} style={{ marginRight: 4 }} />
                    {
                        user?.uid === process.env.REACT_APP_ADMIN_ID &&
                        <Button label="Eliminar" icon="pi pi-trash" className="p-button-raised p-button-danger" onClick={() => confirm(nuevoAfiliado.id)} />
                    }
                </div>}
                header={col.header}
            />
        }
        else {
            return <Column key={col.field} bodyStyle={{ overflowWrap: 'break-word' }} field={col.field} header={col.header} />;
        }
    })

    //MESSAGE
    useEffect(() => {
        if (afiliado.status == 'SUCCESS_ADD' || afiliado.status == 'SUCCESS_UPLOAD'||  afiliado.status == 'SUCCESS_DELETE') {
            Swal.fire({
                title: 'Solicitud Exitosa',
                text: afiliado.msg,
                icon: 'success',
                confirmButtonText: 'Continuar'
            })
            dispatch(clearStatus())
        } if (afiliado.status == 'FAILURE_ADD' || afiliado.status == 'FAILURE_UPLOAD' || afiliado.status == 'FAILURE_DELETE') {
            Swal.fire({
                title: 'Error!',
                text: afiliado.msg,
                icon: 'error',
                confirmButtonText: 'Continuar'
            })
            dispatch(clearStatus())
        }
    }, [afiliado.status])

    const template2 = {
        layout: 'PrevPageLink CurrentPageReport NextPageLink',
        'PrevPageLink': (options) => {
            return (
                <button type="button" className={options.className} onClick={() => handlePagination('prev')} disabled={prevDisable}>
                    <span className="p-3">Anterior</span>
                </button>
            )
        },
        'NextPageLink': (options) => {
            return (
                <button type="button" className={options.className} onClick={() => handlePagination('next')} disabled={nextDisable}>
                    <span className="p-3">Siguiente</span>
                </button>
            )
        },
        'CurrentPageReport': (options) => {
            return (
                <button type="button" className={options.className} onClick={options.onClick}>
                    {page}
                    <Ripple />
                </button>
            )
        }
    };

    const generateDetails = () => {
        return <>
            <h2>Nombre: {afiliado.nuevoAfiliado ? afiliado.nuevoAfiliado.apellido + ' ' + afiliado.nuevoAfiliado.nombre : 'Cargando...'}</h2>
            <h3><b>DNI:</b> {afiliado.nuevoAfiliado?.dni}</h3>
            <h3>Departamento: {afiliado.nuevoAfiliado?.departamento}</h3>
            <h3>Establecimiento: {afiliado.nuevoAfiliado?.establecimientos || ''}</h3>
            <h2>{afiliado.nuevoAfiliado?.error ? '\nYA AFILIADO' : ''}</h2>
        </>

    }

    return (
        <div className={styles.container}>
            <div className={styles.title_and_button}>
                <h3 className={styles.title}>Nuevos Afiliados</h3>
                <Button label="Agregar Usuario" icon="pi pi-plus" onClick={() => history.push("/admin/nuevo-usuario")} />
                <Button label="Descargar" icon="pi pi-plus" onClick={ExportToExcel} />
            </div>
            <div>
                {

                    nuevosAfiliados.length > 0
                        ?
                        <>
                            <DataTable
                                value={nuevosAfiliados}
                                responsiveLayout="scroll"
                                loading={afiliado.processing}
                            >
                                {dynamicColumns}
                            </DataTable>
                            <Paginator
                                template={template2}
                            />
                        </>
                        :
                        afiliado.processing ?
                            <ProgressSpinner className='loader' />
                            :
                            <Button label="No hay afiliados nuevos" className={`p-button-outlined p-button-danger ${styles.errorBtn}`} />
                }
            </div>
            <Dialog
                visible={visible}
                onHide={() => setVisible(false)}
                footer={() => (<div></div>)}
            >
                {generateDetails()}
            </ Dialog>
        </div>
    )
}

export default AfiliadosNuevos;