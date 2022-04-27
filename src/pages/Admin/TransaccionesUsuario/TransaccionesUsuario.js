import React, { useState, useEffect } from 'react'
import { useDispatch, useSelector } from 'react-redux';
import { useHistory } from 'react-router';
import { DataTable } from 'primereact/datatable';
import { Column } from 'primereact/column';
import { Button } from 'primereact/button';
import { Paginator } from 'primereact/paginator';
import Swal from 'sweetalert2';
import _ from 'lodash';

import styles from './styles.module.css';
import { getCuotas } from '../../../redux/reducers/cuotas/actions';

const TransaccionesUsuario = () => {

    const dispatch = useDispatch()
    const history = useHistory();

    const columns = [
        { field: 'title', header: 'Titulo' },
        { field: 'unit_price', header: 'Precio' },
    ];

    const transacciones = useSelector(state => state.transacciones);
    const cuotas = useSelector(state => state.cuotas);

    const [cuotasPagadas, setCuotasPagadas] = useState([]);
    const [startAfter, setStartAfter] = useState(0);
    const [prevDisable, setPrevDisable] = useState(false);
    const [nextDisable, setNextDisable] = useState(false);

    useEffect(() => {
        dispatch(getCuotas())
    }, [])

    useEffect(() => {
        if (transacciones.cuotas?.length > 0 && cuotas.cuotas?.length > 0) {
            const cuotasUser = cuotas.cuotas.filter(cuota => transacciones.cuotas.find(cuotaUser => cuota.id === cuotaUser.cuota))
            setCuotasPagadas(cuotasUser);
            console.log({cuotasUser})
        }
    }, [transacciones.cuotas, cuotas.cuotas])

    const dynamicColumns = columns.map((col, i) => {
        return <Column key={col.field} bodyStyle={{ overflowWrap: 'break-word' }} field={col.field} header={col.header} />;
    })

    return (
        <div className={styles.container}>
            <div className={styles.title_and_button}>
                <h3 className={styles.title}>Cuotas Pagadas de '{transacciones.user?.nombre}' - DNI: {transacciones.user?.dni}</h3>
                {/* <Button label="Nueva Cuota" icon="pi pi-plus" onClick={() => history.push("/admin/nueva-transaccion")} /> */}
            </div>
            <div>
                {
                    transacciones.transacciones.length > 0
                        ?
                        <>
                            <DataTable
                                value={cuotasPagadas}
                                responsiveLayout="scroll"
                            >
                                {dynamicColumns}
                            </DataTable>
                        </>
                        :
                        <Button label="No hay cuotas" className={`p-button-outlined p-button-danger ${styles.errorBtn}`} />
                }
            </div>

        </div>
    )
}

export default TransaccionesUsuario;