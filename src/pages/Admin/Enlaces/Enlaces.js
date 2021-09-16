import React from 'react'
import { useHistory } from 'react-router';

const Enlaces = () => {

    const history = useHistory();

    // const enlaces = useSelector(state => state.enlaces);
    const enlaces = [{
        prioridad: 1,
        titulo: 'Hola',
        descripcion: 'hola 12345 1324 hola',
        link: 'https://google.com'
    }];

    const handleEdit = () => {
        history.push('/admin/nuevo-enlace/')
    }

    return (
        <div>
            Web in Maintenance
            {/* <table style={{borderColor: 'black', borderWidth: 1}}>
                <tr>
                    <th>Prioridad</th>
                    <th>Titulo</th>
                    <th>Descripcion</th>
                    <th>Link</th>
                </tr>
                {
                    enlaces.map(enlace => {
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
            </table> */}
        </div>
    )
}

export default Enlaces;