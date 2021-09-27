import React from 'react'
import { useDispatch, useSelector } from 'react-redux';
import { useHistory } from 'react-router';
import global from '../../../assets/styles/global.module.css'

const Novedades = () => {

    const dispatch = useDispatch()
    const history = useHistory();

    const novedades = useSelector(state => state.novedades);

    const handleEdit = (id) => {
        history.push(`/admin/nueva-novedad/${id}`)
    }

    return (
        <div className={global.container}>
            <button 
                onClick={()=>history.push("/admin/nueva-novedad")}
                className={global.btn}
            >
                Nueva novedad
            </button>
            {
            novedades.enlaces.length > 0
            ?
            <table className={global.fl_table}>
                <thead>
                    <tr>
                        <th>Prioridad</th>
                        <th>Titulo</th>
                        <th>Descripcion</th>
                        <th>Link</th>
                    </tr>
                </thead>
                <tbody>
                    {
                        novedades.enlaces.map(enlace => {
                            return (
                                <tr>
                                    <td>{enlace.prioridad}</td>
                                    <td>{enlace.titulo}</td>
                                    <td>{enlace.descripcion}</td>
                                    <td>{enlace.link}</td>
                                    
                                    <td><button onClick={()=>handleEdit()}>Editar</button></td>
                                    <td><button>Eliminar</button></td>
                                </tr>
                            )
                        })
                    }
                </tbody> 
            </table>
            :
            <h3>No hay enlaces</h3>
        }
        </div>
    )
}

export default Novedades;