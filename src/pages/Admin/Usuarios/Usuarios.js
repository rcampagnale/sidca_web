import React from 'react'
import { useHistory } from 'react-router'
import global from '../../../assets/styles/global.module.css'

const Usuarios = () => {

    const history = useHistory();

    return (
        <div className={global.container}>
            <button 
                onClick={()=>history.push("/admin/nuevo-usuario")}
                className={global.btn}
            >
                Nuevo Usuario
            </button>

            
        </div>
    )
}

export default Usuarios;