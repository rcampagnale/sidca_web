import React, { useEffect, useState } from 'react'
import { useDispatch, useSelector } from 'react-redux';
import { useHistory } from 'react-router';
import { DataTable } from 'primereact/datatable';
import { Column } from 'primereact/column';
import { Button } from 'primereact/button';
import { Paginator } from 'primereact/paginator';
import { Ripple } from 'primereact/ripple';
import { ConfirmDialog } from 'primereact/confirmdialog';
import Swal from 'sweetalert2';

import styles from './styles.module.css';
import { clearStatus, getAfiliadosNuevos, setNuevoAfiliadoDetails } from '../../../redux/reducers/afiliados/actions';
import { ProgressSpinner } from 'primereact/progressspinner';

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

    const nuevosAfiliados = useSelector(state => state.afiliado.nuevosAfiliados)
    const afiliado = useSelector(state => state.afiliado)

    const [visible, setVisible] = useState(false);
    const [page, setPage] = useState(0);
    const [prevDisable, setPrevDisable] = useState(false);
    const [nextDisable, setNextDisable] = useState(false);

    useEffect(() => {
        dispatch(getAfiliadosNuevos());
    }, [])

    const handleEdit = (afiliado) => {
        dispatch(setNuevoAfiliadoDetails(afiliado))
        setVisible(true)
    }

    const handlePagination = async (pagination) => {
        if (pagination === 'prev' && page === 0) {
            return setPrevDisable(true)
        } else {
            setPrevDisable(false)
        }
        if (pagination === 'next' && nuevosAfiliados.length < 10) {
            return setNextDisable(true)
        } else {
            setNextDisable(false)
        }
        setPage(pagination == 'next' ? page + 1 : page - 1);
        dispatch(getAfiliadosNuevos(pagination, pagination == 'next' ? afiliado.lastAfiliado : afiliado.firstAfiliado));
    }

    const dynamicColumns = columns.map((col, i) => {
        if (col.field === 'id') {
            return <Column
                key={col.field}
                field={(nuevoAfiliado) => <div>
                    <Button label="Ver Detalles" icon="pi pi-plus" className="p-button-raised p-button-primary" onClick={() => handleEdit(nuevoAfiliado)} style={{ marginRight: 4 }} />
                    {/* <Button label="Eliminar" icon="pi pi-minus" className="p-button-raised p-button-danger" onClick={() => handleDelete(enlace.id)} /> */}
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
        if (afiliado.status == 'SUCCESS_ADD' || afiliado.status == 'SUCCESS_UPLOAD') {
            Swal.fire({
                title: 'Solicitud Exitosa',
                text: afiliado.msg,
                icon: 'success',
                confirmButtonText: 'Continuar'
            })
            dispatch(clearStatus())
        } if (afiliado.status == 'FAILURE_ADD' || afiliado.status == 'FAILURE_UPLOAD') {
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
                    {page + 1}
                    <Ripple />
                </button>
            )
        }
    };

    const generateDetails = () => {
        return `
            DNI: ${afiliado.nuevoAfiliado?.dni}
            \nDepartamento: ${afiliado.nuevoAfiliado?.departamento}
            \nEstablecimiento: ${afiliado.nuevoAfiliado?.establecimientos || ''}
            ${afiliado.nuevoAfiliado?.error ? '\nYA AFILIADO' : ''}
        `
    }

    return (
        <div className={styles.container}>
            <div className={styles.title_and_button}>
                <h3 className={styles.title}>Nuevos Afiliados</h3>
                <Button label="Agregar Usuario" icon="pi pi-plus" onClick={() => history.push("/admin/nuevo-usuario")} />
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
            <ConfirmDialog 
                visible={visible} 
                onHide={() => setVisible(false)} 
                message={generateDetails()}
                header={`${afiliado.nuevoAfiliado ? afiliado.nuevoAfiliado.apellido + ' ' + afiliado.nuevoAfiliado.nombre : 'Cargando...'}`} 
                accept={() => setVisible(false)}
                reject={false}
            />
        </div>
    )
}

export default AfiliadosNuevos;