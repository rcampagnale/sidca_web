import React from 'react';
import styles from "../styles.module.css";
import { useHistory } from 'react-router';
import { Button } from 'primereact/button';

const Aside = () => {
    const history = useHistory();

    return (
        <div>
            <aside>
                <div className={styles.aside_container}>
                    <button className={styles.btn} onClick={()=>history.push("/admin/cursos")}>Cursos</button>
                    <hr />
                    <button className={styles.btn} onClick={()=>history.push("/admin/enlaces")}>Enlaces</button>
                    <hr />
                    <button className={styles.btn} onClick={()=>history.push("/admin/asesoramiento")}>Asesoramiento</button>
                    <hr />
                    <button className={styles.btn} onClick={()=>history.push("/admin/novedades")}>Novedades</button>
                    <hr />
                    <button className={styles.btn} onClick={()=>history.push("/admin/nuevos-afiliados")}>Nuevos afiliados</button>
                    <hr />
                    <button className={styles.btn} onClick={()=>history.push("/admin/usuarios")}>Usuarios</button>
                    <hr />
                    <div className={styles.btnExit}>
                        <Button label="Salir" className="p-button-rounded p-button-danger" onClick={()=>history.push("/admin/login")}/>
                    </div>
                </div>
            </aside>
        </div>
    )
}

export default Aside;
