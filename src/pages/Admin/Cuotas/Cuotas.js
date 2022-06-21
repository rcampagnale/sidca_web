import React, { useState, useEffect } from 'react'
import { useDispatch, useSelector } from 'react-redux';
import { useHistory } from 'react-router';
import { DataTable } from 'primereact/datatable';
import { Column } from 'primereact/column';
import { Button } from 'primereact/button';
import { Paginator } from 'primereact/paginator';
import Swal from 'sweetalert2';

import styles from './styles.module.css';
import { clearStatus, getCuotas } from '../../../redux/reducers/cuotas/actions';

const Cuotas = () => {

    const dispatch = useDispatch()
    const history = useHistory();

    const columns = [
        { field: 'position', header: 'Prioridad' },
        { field: 'title', header: 'Titulo' },
        { field: 'unit_price', header: 'Precio' },
    ];

    const cuotas = useSelector(state => state.cuotas);

    const [startAfter, setStartAfter] = useState(0);
    const [prevDisable, setPrevDisable] = useState(false);
    const [nextDisable, setNextDisable] = useState(false);

    const handleEdit = (id) => {
        // dispatch(getEnlace(id));
        // history.push(`/admin/nueva-cuota/${id}`)
    }

    const handleDelete = (id) => {
        // dispatch(deleteEnlace(id));
    }

    const handlePagination = async(pagination) => {
        if(pagination === 'prev' && startAfter === 0){
            return setPrevDisable(true)
        }else{
            setPrevDisable(false)
        }
        if(pagination === 'next' && cuotas.cuotas.length < 10 ){
            return setNextDisable(true)
        }else{
            setNextDisable(false)
        }
        setStartAfter(pagination == 'next' ? startAfter + 10 : startAfter - 10);
        dispatch(getCuotas(pagination, pagination == 'next' ? startAfter + 10 : startAfter - 10));

    }

    useEffect(() => {
        dispatch(getCuotas())
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
        if (cuotas.status == 'SUCCESS_ADD' || cuotas.status == 'SUCCESS_UPLOAD') {
            Swal.fire({
                title: 'Solicitud Exitosa',
                text: cuotas.msg,
                icon: 'success',
                confirmButtonText: 'Continuar'
            })
            dispatch(clearStatus())
        } if (cuotas.status == 'FAILURE_ADD' || cuotas.status == 'FAILURE_UPLOAD') {
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
        layout: 'PrevPageLink NextPageLink',
        'PrevPageLink': (options) => {
            return (
                <button type="button" className={options.className} style={{ marginRight: 8 }} onClick={() => handlePagination('prev')} disabled={prevDisable}>
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
    };

    return (
        <div className={styles.container}>
            <div className={styles.title_and_button}>
                <h3 className={styles.title}>Cuotas</h3>
                <Button label="Nueva Cuota" icon="pi pi-plus" onClick={() => history.push("/admin/nueva-cuota")} />
            </div>
            <div>
                {
                    cuotas.cuotas.length > 0
                        ?
                        <>
                            <DataTable
                                value={cuotas.cuotas}
                                responsiveLayout="scroll"
                            >
                                {dynamicColumns}
                            </DataTable>
                            {/* <Paginator
                                template={template2}
                            /> */}
                        </>
                        :
                        <Button label="No hay cuotas" className={`p-button-outlined p-button-danger ${styles.errorBtn}`} />
                }
            </div>

        </div>
    )
}

export default Cuotas;