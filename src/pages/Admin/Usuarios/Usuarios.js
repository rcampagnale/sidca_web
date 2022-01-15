import React from 'react'
import { useHistory } from 'react-router'
import global from '../../../assets/styles/global.module.css'
import styles from './styles.module.css';
import { Button } from 'primereact/button';

const Usuarios = () => {

    const history = useHistory();

    return (
        <div className={styles.visibleContent}>
            <div className={styles.container}>
                <div className={styles.btn}>
                    <Button label="Nuevo usuario" icon="pi pi-plus" className="p-button-raised p-button-warning" onClick={()=>history.push("/admin/nuevo-usuario")}/>
                </div>

            </div>
        </div>
    )
}

export default Usuarios;