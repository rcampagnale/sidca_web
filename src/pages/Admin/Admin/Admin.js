import React from 'react'
import { useHistory } from 'react-router'
import global from '../../../assets/styles/global.module.css'
import styles from './styles.module.css'

const Admin = () => {

    const history = useHistory();

    return (
        <div className={global.container}>
            {/* <h1 className={global.title}>Página Administrativa de SiDCa</h1> */}
            {/* <h3 className={global.subTitle}>Agregar</h3>
            <div className={styles.container}>
                
                <button 
                    onClick={()=>history.push("/admin/nueva-novedad")}
                    className={global.btn}
                >
                    Novedad
                </button>
            </div> */}
            
            {/* <div className={styles.container}>
                <button 
                    onClick={()=>history.push("/admin/cursos")}
                    className={global.btn}
                >
                    Cursos
                </button>
                <button 
                    onClick={()=>history.push("/admin/enlaces")}
                    className={global.btn}
                >
                    Enlaces
                </button>   
                <button 
                    onClick={()=>history.push("/admin/asesoramiento")}
                    className={global.btn}
                >
                    Enlaces de Asesoramiento
                </button>
                <button 
                    onClick={()=>history.push("/admin/novedades")}
                    className={global.btn}
                >
                    Novedades
                </button>
                <button 
                    onClick={()=>history.push("/admin/nuevos-afiliados")}
                    className={global.btn}
                >
                    Nuevos Afiliados
                </button>
                <button 
                    onClick={()=>history.push("/admin/usuarios")}
                    className={global.btn}
                >
                    Usuarios
                </button>
            </div> */}
        </div>
    )
}

export default Admin;