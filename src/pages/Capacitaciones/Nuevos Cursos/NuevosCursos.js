import React from "react";
import styles from './styles.module.css';
import { Button } from 'primereact/button';

const NuevosCursos = () => {
    return(
        <div>
            <div className={styles.title}>Nuevos cursos</div>
            <Button icon="pi pi-check-square" label="Ver cursos" className="p-button-raised p-button-warning" />
        </div>
    )
}

export default NuevosCursos;