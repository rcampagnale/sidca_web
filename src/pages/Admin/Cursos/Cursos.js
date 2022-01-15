import React, { useEffect } from 'react'
import { useDispatch, useSelector } from 'react-redux';
import { useHistory } from 'react-router';
import global from '../../../assets/styles/global.module.css'
import styles from './styles.module.css';
import { Button } from 'primereact/button';

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
        <div className={styles.visibleContent}>
            <div className={styles.container}>
                <div className={styles.btn}>
                    <Button label="Nuevo curso" icon="pi pi-plus" className="p-button-raised p-button-warning" onClick={()=>history.push("/admin/nuevo-curso")}/>
                </div>
            
            
            {
            cursos.cursos.length > 0
            ?
            <table className={styles.fl_table}>
                
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
            <Button label="No hay cursos" className={`p-button-outlined p-button-danger ${styles.errorBtn}`}/>
            
            }
            </div>
        </div>
    )
}

export default Cursos;