import React, { useEffect } from 'react'
import { useDispatch, useSelector } from 'react-redux';
import ReactPaginate from 'react-paginate';
import { getAfiliadosNuevos } from '../../../redux/reducers/afiliados/actions';
import Swal from 'sweetalert2'

const AfiliadosNuevos = () => {

    const dispatch = useDispatch();

    const nuevosAfiliados = useSelector(state => state.afiliado.nuevosAfiliados)

    useEffect(() => {
        dispatch(getAfiliadosNuevos());
    }, [])

    useEffect(() => {
        
    }, [])

    return (
        <div>
            <table style={{borderColor: 'black', borderWidth: 1}}>
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
            {/* <ReactPaginate
                previousLabel={'anterior'}
                nextLabel={'siguiente'}
                breakLabel={'...'}
                // breakClassName={'break-me'}
                // pageCount={total}
                // marginPagesDisplayed={2}
                // pageRangeDisplayed={5}
                // onPageChange={handleChange}
                containerClassName={'pagination'}
                activeClassName={'active'}
            /> */}
        </div>
    )
}

export default AfiliadosNuevos;