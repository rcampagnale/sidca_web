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
                    <div className={styles.aside_title}>Indice</div>
                    <Button label="Cursos" className="p-button-outlined p-button-secondary mr-2 mb-2" onClick={()=>history.push("/admin/cursos")}/>
                    <hr />
                    <Button label="Enlaces" className="p-button-outlined p-button-secondary mr-2 mb-2" onClick={()=>history.push("/admin/enlaces")}/>
                    <hr />
                    <Button label="Enlaces de Asesoramiento" className="p-button-outlined p-button-secondary mr-2 mb-2" onClick={()=>history.push("/admin/asesoramiento")}/>
                    <hr />
                    <Button label="Novedades" className="p-button-outlined p-button-secondary mr-2 mb-2" onClick={()=>history.push("/admin/novedades")}/>
                    <hr />
                    <Button label="Nuevos Afiliados" className="p-button-outlined p-button-secondary mr-2 mb-2" onClick={()=>history.push("/admin/nuevos-afiliados")}/>
                    <hr />
                    <Button label="Usuarios" className="p-button-outlined p-button-secondary mr-2 mb-2" onClick={()=>history.push("/admin/usuarios")}/>
                </div>
            </aside>
        </div>
    )
}

export default Aside;
