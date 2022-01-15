import React from "react";
import styles from './styles.module.css';
import { Button } from 'primereact/button';
import { useHistory } from 'react-router';

const Cursos2021 = () => {

    const history = useHistory();

    return(
        <div>
            <div className={styles.title}>Cursos 2021</div>
            <Button icon="pi pi-check-square" label="Ver cursos" className="p-button-raised p-button-warning" onClick={() => history.push('/capacitaciones/cursos-2021')}/>
        </div>
    )
}

export default Cursos2021;