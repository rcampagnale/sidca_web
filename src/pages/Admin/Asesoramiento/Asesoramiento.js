import React from 'react'
import { useDispatch, useSelector } from 'react-redux';
import { useHistory } from 'react-router';
import global from '../../../assets/styles/global.module.css'

const Asesoramiento = () => {

    const dispatch = useDispatch()
    const history = useHistory();

    const asesoramiento = useSelector(state => state.asesoramiento);

    const handleEdit = (id) => {
        history.push(`/admin/nuevo-asesoramiento/${id}`)
    }

    return (
        <div className={global.container}>
            <button 
                onClick={()=>history.push("/admin/nuevo-asesoramiento")}
                className={global.btn}
            >
                Nuevo Asesoramiento
            </button>
            {
            asesoramiento.enlaces.length > 0
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
                        asesoramiento.enlaces.map(enlace => {
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

export default Asesoramiento;