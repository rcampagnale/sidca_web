import React, { useEffect } from 'react'
import { useDispatch, useSelector } from 'react-redux';
import { useHistory } from 'react-router';
import global from '../../../assets/styles/global.module.css'
import { getEnlace, getEnlaces } from '../../../redux/reducers/enlaces/actions';

const Enlaces = () => {

    const dispatch = useDispatch()
    const history = useHistory();

    const enlace = useSelector(state => state.enlace);
    // const enlaces = [{
    //     prioridad: 1,
    //     titulo: 'Hola',
    //     descripcion: 'hola 12345 1324 hola',
    //     link: 'https://google.com'
    // }];

    const handleEdit = (id) => {
        dispatch(getEnlace(id));
        history.push(`/admin/nuevo-enlace/${id}`)
    }

    useEffect(() => {
        // dispatch(getEnlaces())
    }, [])

    return (
        <div className={global.container}>
            <button 
                    onClick={()=>history.push("/admin/nuevo-enlace")}
                    className={global.btn}
                >
                    Nuevo Enlace
            </button>   
            {
            enlace.enlaces.length > 0
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
                    enlace.enlaces.map(enlace => {
                        return (
                            <tr>
                                <td>{enlace.prioridad}</td>
                                <td>{enlace.titulo}</td>
                                <td>{enlace.descripcion}</td>
                                <td>{enlace.link}</td>
                                
                                <td>
                                    <button onClick={()=>handleEdit(enlace.id)}>Editar</button>
                                    <button onClick={()=>handleEdit(enlace.id)}>Eliminar</button>
                                </td>
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

export default Enlaces;