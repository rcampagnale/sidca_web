import React, { useState, useEffect } from 'react'
import { useDispatch, useSelector } from 'react-redux';
import { useHistory } from 'react-router';
import { DataTable } from 'primereact/datatable';
import { Column } from 'primereact/column';
import { Button } from 'primereact/button';
import { Paginator } from 'primereact/paginator';
import { Ripple } from 'primereact/ripple';
import { ProgressSpinner } from 'primereact/progressspinner';
import { confirmDialog } from 'primereact/confirmdialog';
import Swal from 'sweetalert2';

import styles from './styles.module.css';
import { clearStatus, deleteCursos, getCurso, getCursos } from '../../../redux/reducers/cursos/actions';
import SubirCursosUsuarios from './SubirCursosUsuarios';

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
    const noSubidos = useSelector(state => state.cursos.noSubidos);
    const page = useSelector(state => state.cursos.page);
    const user = useSelector(state => state.user.profile);

    const [prevDisable, setPrevDisable] = useState(false);
    const [nextDisable, setNextDisable] = useState(false);
    const [cursoSelect, setCursoSelect] = useState(undefined);
    const [subirCursosActive, setSubirCursosActive] = useState(false);

    const handleEdit = async (id) => {
        await dispatch(getCurso(id));
        history.push(`/admin/nuevo-curso/${id}`)
    }

    const handlePagination = async (pagination) => {
        if (pagination === 'prev' && page === 1) {
            return setPrevDisable(true)
        } else {
            setPrevDisable(false)
        }
        // if (pagination === 'next' && cursos.cursos.length < 10) {
        //     return setNextDisable(true)
        // } else {
        //     setNextDisable(false)
        // }
        dispatch(getCursos(pagination, pagination == 'next' ? cursos.lastCurso : cursos.firstCurso));
    }

    useEffect(() => {
        dispatch(getCursos())
    }, [])

    const acceptDelete = (id) => {
        dispatch(deleteCursos(id))
    }

    const confirmDelete = (id) => {
        confirmDialog({
            message: 'Esta seguro que desea Eliminar?',
            header: 'Atención',
            icon: 'pi pi-exclamation-triangle',
            accept: () => acceptDelete(id),
            reject: () => { }
        });
    };

    const acceptUpload = (curso) => {
        setCursoSelect(curso)
        setSubirCursosActive(true)
    }

    const confirmUpload = (id) => {
        confirmDialog({
            message: 'Esta seguro que desea Eliminar?',
            header: 'Atención',
            icon: 'pi pi-exclamation-triangle',
            accept: () => acceptUpload(id),
            reject: () => { }
        });
    };

    const dynamicColumns = columns.map((col, i) => {
        if (col.field === 'id') {
            return <Column
                key={col.field}
                field={(curso) => <div>
                    <Button label="Editar" icon="pi pi-plus" className="p-button-raised p-button-primary" onClick={() => handleEdit(curso.id)} style={{ marginRight: 4 }} />
                    {
                        /*
                            Los cursos no deberían eliminarse, según la arquitectura rompería en la forma que se mostraría a los usuarios, 
                            dado a que no existe una relación y se conservarían el curso terminado dentro de la coleccion de usuarios.
                            Para ello la logica debería ser más compleja o refactorizar la manera en la que se manejan los cursos
                        */
                        // user?.uid === process.env.REACT_APP_ADMIN_ID &&
                        // <Button label="Eliminar" icon="pi pi-trash" className="p-button-raised p-button-danger" onClick={() => confirmDelete(curso.id)} />
                    }
                    <Button label="Cargar Usuarios" icon="pi pi-file" className="p-button-raised" onClick={() => acceptUpload(curso)} />
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
        } if (cursos.status == 'FAILURE_ADD' || cursos.status == 'FAILURE_UPLOAD' || cursos.status == 'FAILURE_USER_INFO') {
            Swal.fire({
                title: 'Error!',
                text: cursos.msg,
                icon: 'error',
                confirmButtonText: 'Continuar'
            })
            dispatch(clearStatus())
        }
        //TODO ver como hacer para mostrar los noSubidos
        if ( cursos.status == 'SUCCESS_USER_INFO' ){
            Swal.fire({
                title: noSubidos.length > 0 ? 'Algunos usuarios no fueron cargados con sus cursos!' : 'Se actualizaron los datos correctamente',
                text: noSubidos.length > 0 ? 'Los siguientes dni no fueron subidos: \n' + noSubidos.join(' - \n') : '',
                icon: 'success',
                confirmButtonText: 'Continuar'
            })
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
                    {
                        subirCursosActive && <Button
                            label='Ver Cursos'
                            icon={'pi pi-search'}
                            onClick={() => {setSubirCursosActive(!subirCursosActive); setCursoSelect(undefined)}}
                        />
                    }
                </div>
            </div>
            <div className={styles.table_upload}>
                {
                    subirCursosActive ?
                        <SubirCursosUsuarios curso={cursoSelect} noSubidos={noSubidos}/>
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