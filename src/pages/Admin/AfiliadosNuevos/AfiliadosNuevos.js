import React, { useEffect } from 'react'
import { useDispatch, useSelector } from 'react-redux';
import ReactPaginate from 'react-paginate';
import { getAfiliadosNuevos } from '../../../redux/reducers/afiliados/actions';
import Swal from 'sweetalert2'
import global from '../../../assets/styles/global.module.css'
import styles from './styles.module.css'

const AfiliadosNuevos = () => {

    const dispatch = useDispatch();

    const nuevosAfiliados = useSelector(state => state.afiliado.nuevosAfiliados)

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
        </div>
    )
}

export default AfiliadosNuevos;