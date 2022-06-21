import React, { useState, useEffect } from 'react'
import { useDispatch, useSelector } from 'react-redux';
import { useHistory } from 'react-router';
import { DataTable } from 'primereact/datatable';
import { Column } from 'primereact/column';
import { Button } from 'primereact/button';
import { Paginator } from 'primereact/paginator';
import Swal from 'sweetalert2';

import styles from './styles.module.css';
import { clearStatus, getTransacciones, getUserCuotas } from '../../../redux/reducers/transacciones/actions';

const Transacciones = () => {

    const dispatch = useDispatch()
    const history = useHistory();

    const columns = [
        { field: 'fecha', header: 'Fecha' },
        { field: 'status', header: 'Estado' },
        { field: 'payment_id', header: 'ID del pago' },
        { field: 'userId', header: 'Acciones'}
    ];

    const transacciones = useSelector(state => state.transacciones);

    const [startAfter, setStartAfter] = useState(0);
    const [prevDisable, setPrevDisable] = useState(false);
    const [nextDisable, setNextDisable] = useState(false);

    const handleUser = (id) => {
        // const transaccion = transacciones.transacciones.find(trans => trans.id === id)
        // const userId = JSON.parse(transaccion.external_reference.split('%22').join('"')).userId
        dispatch(getUserCuotas(id));
        history.push(`/admin/transacciones/usuario/${id}`)
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
        if(pagination === 'next' && transacciones.transacciones.length < 10 ){
            return setNextDisable(true)
        }else{
            setNextDisable(false)
        }
        setStartAfter(pagination == 'next' ? startAfter + 10 : startAfter - 10);
        dispatch(getTransacciones(pagination, pagination == 'next' ? startAfter + 10 : startAfter - 10));
    }

    useEffect(() => {
        dispatch(getTransacciones())
    }, [])

    const dynamicColumns = columns.map((col, i) => {
        if (col.field === 'userId') {
            return <Column
                key={col.field}
                field={(enlace) => <div>
                    <Button label="ver Usuario" icon="pi pi-plus" className="p-button-raised p-button-primary" onClick={() => handleUser(enlace.userId)} style={{ marginRight: 4 }} />
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
        if (transacciones.status == 'SUCCESS_ADD' || transacciones.status == 'SUCCESS_UPLOAD') {
            Swal.fire({
                title: 'Solicitud Exitosa',
                text: transacciones.msg,
                icon: 'success',
                confirmButtonText: 'Continuar'
            })
            dispatch(clearStatus())
        } if (transacciones.status == 'FAILURE_ADD' || transacciones.status == 'FAILURE_UPLOAD') {
            Swal.fire({
                title: 'Error!',
                text: transacciones.msg,
                icon: 'error',
                confirmButtonText: 'Continuar'
            })
            dispatch(clearStatus())
        }
    }, [transacciones.status])

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
                <h3 className={styles.title}>Transacciones</h3>
                {/* <Button label="Nueva Cuota" icon="pi pi-plus" onClick={() => history.push("/admin/nueva-transaccion")} /> */}
            </div>
            <div>
                {
                    transacciones.transacciones.length > 0
                        ?
                        <>
                            <DataTable
                                value={transacciones.transacciones}
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

export default Transacciones;