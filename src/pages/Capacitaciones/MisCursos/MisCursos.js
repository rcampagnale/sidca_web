import React from "react";
import styles from './styles.module.css';
import { Button } from 'primereact/button';

const MisCursos = () => {
    return(
        <div>
            <div className={styles.title}>Mis cursos</div>
            <Button icon="pi pi-check-square" label="Ver cursos" className="p-button-raised p-button-warning" />
        </div>
    )
}

export default MisCursos;