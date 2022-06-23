import React, { useState, useEffect } from 'react'
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
import { clearStatus, deleteNovedad, getNovedad, getNovedades } from '../../../redux/reducers/novedades/actions';
// import SubirEnlaces from './SubirEnlaces';

const Novedades = () => {

    const dispatch = useDispatch()
    const history = useHistory();

    const columns = [
        { field: 'prioridad', header: 'Prioridad' },
        { field: 'titulo', header: 'Titulo' },
        { field: 'descripcion', header: 'Descripcion' },
        { field: 'categoria', header: 'Categoria' },
        { field: 'link', header: 'Link' },
        { field: 'id', header: 'Acciones' }
    ];

    const novedades = useSelector(state => state.novedades);
    const page = useSelector(state => state.novedades.page);

    const [prevDisable, setPrevDisable] = useState(false);
    const [nextDisable, setNextDisable] = useState(false);
    const [subirNovedadesActive, setSubirNovedadesActive] = useState(false);

    const handleEdit = async (id) => {
        await dispatch(getNovedad(id));
        history.push(`/admin/nueva-novedad/${id}`)
    }

    // const handleDelete = (id) => {
    //     dispatch(deleteNovedad(id));
    // }

    const handlePagination = async (pagination) => {
        if (pagination === 'prev' && page === 1) {
            return setPrevDisable(true)
        } else {
            setPrevDisable(false)
        }
        if (pagination === 'next' && novedades.novedades.length < 10) {
            return setNextDisable(true)
        } else {
            setNextDisable(false)
        }
        dispatch(getNovedades(pagination, pagination == 'next' ? novedades.lastNovedad : novedades.firstNovedad));

    }

    useEffect(() => {
        dispatch(getNovedades())
    }, [])

    const dynamicColumns = columns.map((col, i) => {
        if (col.field === 'id') {
            return <Column
                key={col.field}
                field={(enlace) => <div>
                    <Button label="Editar" icon="pi pi-plus" className="p-button-raised p-button-primary" onClick={() => handleEdit(enlace.id)} style={{ marginRight: 4 }} />
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
        if (novedades.status == 'SUCCESS_ADD' || novedades.status == 'SUCCESS_UPLOAD') {
            Swal.fire({
                title: 'Solicitud Exitosa',
                text: novedades.msg,
                icon: 'success',
                confirmButtonText: 'Continuar'
            })
            dispatch(clearStatus())
        } if (novedades.status == 'FAILURE_ADD' || novedades.status == 'FAILURE_UPLOAD') {
            Swal.fire({
                title: 'Error!',
                text: novedades.msg,
                icon: 'error',
                confirmButtonText: 'Continuar'
            })
            dispatch(clearStatus())
        }
    }, [novedades.status])

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
                <h3 className={styles.title}>Novedades</h3>
                <div>
                    <Button label="Nueva novedad" icon="pi pi-plus" onClick={() => history.push("/admin/nueva-novedad")} style={{ marginRight: 3 }} />
                </div>
            </div>
            <div className={styles.table_upload}>
                {
                    subirNovedadesActive ?
                        <></>
                        :
                        novedades.novedades.length > 0
                            ?
                            <>
                                <DataTable
                                    value={novedades.novedades}
                                    responsiveLayout="scroll"
                                    loading={novedades.processing}

                                >
                                    {dynamicColumns}
                                </DataTable>
                                <Paginator
                                    template={template2}
                                />
                            </>
                            :
                            novedades.processing ?
                                <ProgressSpinner className='loader' />
                                :
                                <Button label="No hay novedades" className={`p-button-outlined p-button-danger ${styles.errorBtn}`} />
                }
            </div>

        </div>
    )
}

export default Novedades;