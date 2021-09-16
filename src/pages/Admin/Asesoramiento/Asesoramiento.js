import React from 'react'

const Asesoramiento = () => {

    const asesoramiento = [
        
    ]

    const handleEdit = () => {
        // history.push('/admin/nuevo-enlace/')
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
                    asesoramiento.length > 0
                    ?
                    <>
                    {
                        asesoramiento.map(enlace => {
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
                    </>
                    :
                    <h3>No hay enlaces</h3>
                }
            </table> */}
        </div>
    )
}

export default Asesoramiento;