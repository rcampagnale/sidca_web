import React from 'react'
import { useDispatch, useSelector } from 'react-redux';
import { useHistory } from 'react-router';
import global from '../../../assets/styles/global.module.css'
import styles from './styles.module.css';
import { Button } from 'primereact/button';

const Asesoramiento = () => {

    const dispatch = useDispatch()
    const history = useHistory();

    const asesoramiento = useSelector(state => state.asesoramiento);

    const handleEdit = (id) => {
        history.push(`/admin/nuevo-asesoramiento/${id}`)
    }

    return (
        <div className={styles.visibleContent}>
            <div className={styles.container}>
                <div className={styles.btn}>
                    <Button label="Nuevo asesoramiento" icon="pi pi-plus" className="p-button-raised p-button-warning" onClick={()=>history.push("/admin/nuevo-asesoramiento")}/>
                </div>
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
            <Button label="No hay enlaces" className={`p-button-outlined p-button-danger ${styles.errorBtn}`}/>
        }
        </div>
        </div>
    )
}

export default Asesoramiento;