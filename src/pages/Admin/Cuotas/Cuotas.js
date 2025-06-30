import React, { useState, useEffect } from 'react'
import { useDispatch, useSelector } from 'react-redux';
import { useHistory } from 'react-router-dom';
import { DataTable } from 'primereact/datatable';
import { Column } from 'primereact/column';
import { Button } from 'primereact/button';
import { Paginator } from 'primereact/paginator';
import { Ripple } from 'primereact/ripple';
import { ProgressSpinner } from 'primereact/progressspinner';
import { confirmDialog } from 'primereact/confirmdialog';
import Swal from 'sweetalert2';

import styles from './styles.module.css';
import { clearStatus, deleteCuotas, getCuota, getCuotas } from '../../../redux/reducers/cuotas/actions';

const Cuotas = () => {

    const dispatch = useDispatch()
    const history = useHistory();

    const columns = [
        { field: 'position', header: 'Posición' },
        { field: 'categoria', header: 'Categoria' },
        { field: 'title', header: 'Titulo' },
        { field: 'unit_price', header: 'Precio' },
        { field: 'id', header: 'Acciones' }
    ];

    const cuotas = useSelector(state => state.cuotas);
    const page = useSelector(state => state.cuotas.page);
    const user = useSelector(state => state.user.profile);

    const [prevDisable, setPrevDisable] = useState(false);
    const [nextDisable, setNextDisable] = useState(false);
    const [subirCuotasActive, setSubirCuotasActive] = useState(false);

    const handleEdit = async (id) => {
        await dispatch(getCuota(id));
        history.push(`/admin/nueva-cuota/${id}`)
    }

    const handlePagination = async (pagination) => {
        if (pagination === 'prev' && page === 1) {
            return setPrevDisable(true)
        } else {
            setPrevDisable(false)
        }
        // if (pagination === 'next' && cuotas.cuotas.length < 10) {
        //     return setNextDisable(true)
        // } else {
        //     setNextDisable(false)
        // }
        dispatch(getCuotas(pagination, pagination == 'next' ? cuotas.lastCuota : cuotas.firstCuota));

    }

    useEffect(() => {
        dispatch(getCuotas())
    }, [])

    const accept = (id) => {
        dispatch(deleteCuotas(id))
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
                field={(enlace) => <div>
                    <Button label="Editar" icon="pi pi-plus" className="p-button-raised p-button-primary" onClick={() => handleEdit(enlace.id)} style={{ marginRight: 4 }} />
                    {
                        user?.uid === process.env.REACT_APP_ADMIN_ID &&
                        <Button label="Eliminar" icon="pi pi-trash" className="p-button-raised p-button-danger" onClick={() => confirm(enlace.id)} />
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
        if (cuotas.status == 'SUCCESS_ADD' || cuotas.status == 'SUCCESS_UPLOAD' || cuotas.status == 'SUCCESS_DELETE') {
            Swal.fire({
                title: 'Solicitud Exitosa',
                text: cuotas.msg,
                icon: 'success',
                confirmButtonText: 'Continuar'
            })
            dispatch(clearStatus())
        } if (cuotas.status == 'FAILURE_ADD' || cuotas.status == 'FAILURE_UPLOAD' || cuotas.status == 'FAILURE_DELETE') {
            Swal.fire({
                title: 'Error!',
                text: cuotas.msg,
                icon: 'error',
                confirmButtonText: 'Continuar'
            })
            dispatch(clearStatus())
        }
    }, [cuotas.status])

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

    return (
        <div className={styles.container}>
            <div className={styles.title_and_button}>
                <h3 className={styles.title}>Cuotas</h3>
                <div>
                    <Button label="Nueva cuota" icon="pi pi-plus" onClick={() => history.push("/admin/nueva-cuota")} style={{ marginRight: 3 }} />
                </div>
            </div>
            <div className={styles.table_upload}>
                {
                    subirCuotasActive ?
                        <></>
                        :
                        cuotas.cuotas.length > 0
                            ?
                            <>
                                <DataTable
                                    value={cuotas.cuotas}
                                    responsiveLayout="scroll"
                                    loading={cuotas.processing}

                                >
                                    {dynamicColumns}
                                </DataTable>
                                <Paginator
                                    template={template2}
                                />
                            </>
                            :
                            cuotas.processing ?
                                <ProgressSpinner className='loader' />
                                :
                                <Button label="No hay cuotas" className={`p-button-outlined p-button-danger ${styles.errorBtn}`} />
                }
            </div>

        </div>
    )
}

export default Cuotas;