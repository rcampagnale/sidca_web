import React from "react";
import styles from './styles.module.css';
import { Button } from 'primereact/button';
import { useHistory } from 'react-router';

const MisCursos = () => {

    const history = useHistory();

    return(
        <div>
            <div className={styles.title}>Mis cursos</div>
            <Button icon="pi pi-check-square" label="Ver cursos" className="p-button-raised p-button-warning" onClick={() => history.push('/capacitaciones/mis-cursos')}/>
        </div>
    )
}

export default MisCursos;