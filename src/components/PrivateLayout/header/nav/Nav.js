import React from 'react';
import styles from './styles.module.css';
import { useHistory } from 'react-router';

const Nav = () => {

    const history = useHistory();

    return(
        <div>
            <ul className={styles.list}>
                <button className={styles.list_btn} onClick={()=>history.push("/admin/cursos")}>Cursos</button>         
                <button className={styles.list_btn} onClick={()=>history.push("/admin/enlaces")}>Enlaces</button>
                <button className={styles.list_btn} onClick={()=>history.push("/admin/asesoramiento")}>Asesoramiento</button>
                <button className={styles.list_btn} onClick={()=>history.push("/admin/novedades")}>Novedades</button>
                <button className={styles.list_btn} onClick={()=>history.push("/admin/nuevos-afiliados")}>Nuevos afiliados</button>
                <button className={styles.list_btn} onClick={()=>history.push("/admin/usuarios")}>Usuarios</button>
            </ul>
        </div>
    )
}

export default Nav;
