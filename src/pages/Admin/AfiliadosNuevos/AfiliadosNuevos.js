import React, { useEffect, useState } from 'react'
import { useDispatch, useSelector } from 'react-redux';
import { getAfiliadosNuevos } from '../../../redux/reducers/afiliados/actions';
import Swal from 'sweetalert2'
import global from '../../../assets/styles/global.module.css'
import styles from './styles.module.css'
import { Paginator } from 'primereact/paginator';

const AfiliadosNuevos = () => {

    const dispatch = useDispatch();

    const nuevosAfiliados = useSelector(state => state.afiliado.nuevosAfiliados)

    const [basicFirst, setBasicFirst] = useState(0);
    const [basicRows, setBasicRows] = useState(10);

    const onBasicPageChange = (event) => {
        setBasicFirst(event.first);
        setBasicRows(event.rows);
        console.log(event.first, basicFirst)
        console.log(event.rows, basicRows)
    }

    useEffect(() => {
        dispatch(getAfiliadosNuevos());
    }, [])

    useEffect(() => {
        
    }, [])

    return (
        <div className={global.container}>
            <table className={global.fl_table}>
                <thead>
                    <tr>
                        <th>Nombre</th>
                        <th>Apellido</th>
                        <th>DNI</th>
                        <th>Email</th>
                        <th>Celular</th>
                        <th>Establecimientos</th>
                        <th>Departamento</th>
                        <th>Ya afiliado?</th>
                        <th>ACTIONS</th>
                    </tr>
                </thead>
                <tbody>
                {
                    nuevosAfiliados.map(afiliado => {
                        return (
                            <tr key={afiliado.id}>
                                <td>{afiliado.nombre}</td>
                                <td>{afiliado.apellido}</td>
                                <td>{afiliado.dni}</td>
                                <td>{afiliado.email}</td>
                                <td>{afiliado.celular}</td>
                                <td>{afiliado.establecimientos}</td>
                                <td>{afiliado.departamento}</td>
                                <td>{afiliado.error ? 'Ya está afiliado' : ''}</td>
    
                                <td><button>Eliminar</button></td>
                            </tr>
                        )
                    })
                }
                </tbody>
            </table>
            <Paginator 
                first={basicFirst} 
                rows={basicRows} 
                //totalRecords={120} 
                //rowsPerPageOptions={[10, 20, 30]} 
                onPageChange={onBasicPageChange}
            ></Paginator>
        </div>
    )
}

export default AfiliadosNuevos;