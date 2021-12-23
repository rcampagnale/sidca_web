import React from "react";
import styles from './styles.module.css';
import { Button } from 'primereact/button';

const Cursos2020_2019 = () => {
    return(
        <div>
            <div className={styles.title}>Cursos 2020-2019</div>
            <Button icon="pi pi-check-square" label="Ver cursos" className="p-button-raised p-button-warning" />
        </div>
    )
}

export default Cursos2020_2019;