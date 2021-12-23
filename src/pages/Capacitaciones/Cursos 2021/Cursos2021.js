import React from "react";
import styles from './styles.module.css';
import { Button } from 'primereact/button';

const Cursos2021 = () => {
    return(
        <div>
            <div className={styles.title}>Cursos 2021</div>
            <Button icon="pi pi-check-square" label="Ver cursos" className="p-button-raised p-button-warning" />
        </div>
    )
}

export default Cursos2021;