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
import { clearStatus, deleteEnlace, getEnlace, getEnlaces } from '../../../redux/reducers/enlaces/actions';
import SubirEnlaces from './SubirEnlaces';

const Enlaces = () => {

    const dispatch = useDispatch()
    const history = useHistory();

    const columns = [
        { field: 'prioridad', header: 'Prioridad' },
        { field: 'titulo', header: 'Titulo' },
        { field: 'descripcion', header: 'Descripcion' },
        { field: 'link', header: 'Link' },
        { field: 'id', header: 'Acciones' }
    ];

    const enlace = useSelector(state => state.enlace);
    const page = useSelector(state => state.enlace.page)

    const [prevDisable, setPrevDisable] = useState(false);
    const [nextDisable, setNextDisable] = useState(false);
    const [subirEnlacesActive, setSubirEnlacesActive] = useState(false);

    const handleEdit = (id) => {
        dispatch(getEnlace(id));
        history.push(`/admin/nuevo-enlace/${id}`)
    }

    const handleDelete = (id) => {
        dispatch(deleteEnlace(id));
    }

    const handlePagination = async (pagination) => {
        if (pagination === 'prev' && page === 1) {
            return setPrevDisable(true)
        } else {
            setPrevDisable(false)
        }
        if (pagination === 'next' && enlace.enlaces.length < 10) {
            return setNextDisable(true)
        } else {
            setNextDisable(false)
        }
        dispatch(getEnlaces(pagination, pagination == 'next' ? enlace.lastEnlace : enlace.firstEnlace));

    }

    useEffect(() => {
        dispatch(getEnlaces())
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
        if (enlace.status == 'SUCCESS_ADD' || enlace.status == 'SUCCESS_UPLOAD') {
            Swal.fire({
                title: 'Solicitud Exitosa',
                text: enlace.msg,
                icon: 'success',
                confirmButtonText: 'Continuar'
            })
            dispatch(clearStatus())
        } if (enlace.status == 'FAILURE_ADD' || enlace.status == 'FAILURE_UPLOAD') {
            Swal.fire({
                title: 'Error!',
                text: enlace.msg,
                icon: 'error',
                confirmButtonText: 'Continuar'
            })
            dispatch(clearStatus())
        }
    }, [enlace.status])

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
                <h3 className={styles.title}>Enlaces</h3>
                <div>
                    <Button label="Nuevo enlace" icon="pi pi-plus" onClick={() => history.push("/admin/nuevo-enlace")} style={{ marginRight: 3 }} />
                    <Button
                        label={subirEnlacesActive ? 'Ver enlaces' : 'Subir Enlaces'}
                        icon={subirEnlacesActive ? 'pi pi-search' : 'pi pi-file'}
                        onClick={() => setSubirEnlacesActive(!subirEnlacesActive)}
                    />
                </div>
            </div>
            <div className={styles.table_upload}>
                {
                    subirEnlacesActive ?
                        <SubirEnlaces />
                        :
                        enlace.enlaces.length > 0
                            ?
                            <>
                                <DataTable
                                    value={enlace.enlaces}
                                    responsiveLayout="scroll"
                                    loading={enlace.processing}

                                >
                                    {dynamicColumns}
                                </DataTable>
                                <Paginator
                                    template={template2}
                                />
                            </>
                            :
                            enlace.processing ?
                                <ProgressSpinner className='loader' />
                                :
                                <Button label="No hay enlaces" className={`p-button-outlined p-button-danger ${styles.errorBtn}`} />
                }
            </div>

        </div>
    )
}

export default Enlaces;