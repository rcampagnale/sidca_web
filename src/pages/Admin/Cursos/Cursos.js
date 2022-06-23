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
import { clearStatus, deleteCurso, getCurso, getCursos } from '../../../redux/reducers/cursos/actions';
// import SubirEnlaces from './SubirEnlaces';

const Cursos = () => {

    const dispatch = useDispatch()
    const history = useHistory();

    const columns = [
        { field: 'titulo', header: 'Titulo' },
        { field: 'descripcion', header: 'Descripcion' },
        { field: 'estado', header: 'Estado' },
        { field: 'categoria', header: 'Categoria' },
        { field: 'link', header: 'Link' },
        { field: 'id', header: 'Acciones' }
    ];

    const cursos = useSelector(state => state.cursos);
    const page = useSelector(state => state.cursos.page);

    const [prevDisable, setPrevDisable] = useState(false);
    const [nextDisable, setNextDisable] = useState(false);
    const [subirCursosActive, setSubirCursosActive] = useState(false);

    const handleEdit = (id) => {
        dispatch(getCurso(id));
        history.push(`/admin/nuevo-curso/${id}`)
    }

    // const handleDelete = (id) => {
    //     dispatch(deleteCurso(id));
    // }

    const handlePagination = async (pagination) => {
        if (pagination === 'prev' && page === 1) {
            return setPrevDisable(true)
        } else {
            setPrevDisable(false)
        }
        if (pagination === 'next' && cursos.cursos.length < 10) {
            return setNextDisable(true)
        } else {
            setNextDisable(false)
        }
        dispatch(getCursos(pagination, pagination == 'next' ? cursos.lastCurso : cursos.firstCurso));

    }

    useEffect(() => {
        dispatch(getCursos())
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
        if (cursos.status == 'SUCCESS_ADD' || cursos.status == 'SUCCESS_UPLOAD') {
            Swal.fire({
                title: 'Solicitud Exitosa',
                text: cursos.msg,
                icon: 'success',
                confirmButtonText: 'Continuar'
            })
            dispatch(clearStatus())
        } if (cursos.status == 'FAILURE_ADD' || cursos.status == 'FAILURE_UPLOAD') {
            Swal.fire({
                title: 'Error!',
                text: cursos.msg,
                icon: 'error',
                confirmButtonText: 'Continuar'
            })
            dispatch(clearStatus())
        }
    }, [cursos.status])

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
                <h3 className={styles.title}>Cursos</h3>
                <div>
                    <Button label="Nuevo curso" icon="pi pi-plus" onClick={() => history.push("/admin/nuevo-curso")} style={{ marginRight: 3 }} />
                </div>
            </div>
            <div className={styles.table_upload}>
                {
                    subirCursosActive ?
                        <></>
                        :
                        cursos.cursos.length > 0
                            ?
                            <>
                                <DataTable
                                    value={cursos.cursos}
                                    responsiveLayout="scroll"
                                    loading={cursos.processing}

                                >
                                    {dynamicColumns}
                                </DataTable>
                                <Paginator
                                    template={template2}
                                />
                            </>
                            :
                            cursos.processing ?
                                <ProgressSpinner className='loader' />
                                :
                                <Button label="No hay cursos" className={`p-button-outlined p-button-danger ${styles.errorBtn}`} />
                }
            </div>

        </div>
    )
}

export default Cursos;