import React, { useEffect } from 'react'
import { useDispatch, useSelector } from 'react-redux';
import { useHistory } from 'react-router';
import global from '../../../assets/styles/global.module.css'

const Cursos = () => {

    const dispatch = useDispatch()
    const history = useHistory();

    const cursos = useSelector(state => state.cursos);

    const handleEdit = (id) => {
        // dispatch(getEnlace(id));
        history.push(`/admin/nuevo-curso/${id}`)
    }

    useEffect(() => {
        // dispatch(getEnlaces())
    }, [])

    return (
        <div className={global.container}>
            <button 
                    onClick={()=>history.push("/admin/nuevo-curso")}
                    className={global.btn}
                >
                    Nuevo Curso
            </button>   
            {
            cursos.cursos.length > 0
            ?
            <table className={global.fl_table}>
                
                <thead>
                    <tr>
                        <th>Prioridad</th>
                        <th>Titulo</th>
                        <th>Descripcion</th>
                        <th>Link</th>
                        <th>ACTIONS</th>
                    </tr>
                </thead>
                <tbody>
                {
                    cursos.cursos.map(curso => {
                        return (
                            <tr>
                                <td>{curso.prioridad}</td>
                                <td>{curso.titulo}</td>
                                <td>{curso.descripcion}</td>
                                <td>{curso.link}</td>
                                
                                <td>
                                    <button onClick={()=>handleEdit(curso.id)}>Editar</button>
                                    <button onClick={()=>handleEdit(curso.id)}>Eliminar</button>
                                </td>
                            </tr>
                        )
                    })
                }
                </tbody>
            </table>
            :
            <h3>No hay Cursos</h3>
            }
        </div>
    )
}

export default Cursos;