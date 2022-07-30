import React from 'react'
import styles from './styles.module.css';
import { Button } from 'primereact/button';
import { useHistory } from 'react-router-dom';

const Nosotros = () => {

    const history = useHistory();

    return (
        <div className={styles.mainSection}>
            <div className={styles.btnSection}>
                <Button icon="pi pi-arrow-circle-right" label="Turismo" className="p-button-raised p-button-warning" onClick={() => history.push('/turismo')} />
                <Button icon="pi pi-arrow-circle-right" label="Casa del docente" className="p-button-raised p-button-warning" onClick={() => history.push('/casa-del-docente')} />
                <Button icon="pi pi-arrow-circle-right" label="Predio" className="p-button-raised p-button-warning" onClick={() => history.push('/predio')} />
            </div>
            <div className={styles.title}>Quienes Somos</div>
            <img className={styles.img} src="https://statics.launion.digital/2020/10/crop/5f87b87c87678__940x620.jpg" alt="Personal SiDCa" />
            <p className={styles.text}>SIDCA, el Sindicato de Docentes de Catamarca, inscripción gremial 2902, adherido a la Confederación Argentina de Educadores, CEA, Personería gremial 1716. Trabaja en la firme defensa de los derechos docentes, reafirmando el reclamo permanente por mejores condiciones en el desempeño profesional, promoviendo la capacitación y el perfeccionamiento, exigiendo el respeto a normativas justas para los trabajadores y trabajadoras de la educación. Creemos que la educación es motor indiscutible de desarrollo de los pueblos y por eso, defendemos las mejores condiciones laborales para quienes la imparten, en consonancia con las instituciones gremiales consolidadas a nivel país y la Internacional de la Educación, que cuidan y protegen a educadores del país y el mundo.</p>
            <img className={styles.img} src="https://www.catamarcaciudad.gob.ar/wp-content/uploads/EMA_8943.jpg" alt="Personal SiDCa" />
        </div>
    )
}

export default Nosotros
