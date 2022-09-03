import React from 'react';
import styles from './styles.module.css';
import { Button } from 'primereact/button';
import { useHistory } from 'react-router-dom';
import ImageSlider from '../../components/Slider/ImageSlider';

import img1 from '../../assets/images/nosotros/nosotros-01.jpeg';
import img2 from '../../assets/images/nosotros/nosotros-02.jpeg';
import img3 from '../../assets/images/nosotros/nosotros-03.jpeg';
import img4 from '../../assets/images/nosotros/nosotros-04.jpeg';
import img5 from '../../assets/images/nosotros/nosotros-05.jpeg';
import img6 from '../../assets/images/nosotros/nosotros-06.jpeg';
import img7 from '../../assets/images/nosotros/nosotros-07.jpeg';
import img8 from '../../assets/images/nosotros/nosotros-08.jpeg';
import img9 from '../../assets/images/nosotros/nosotros-09.jpeg';
import img10 from '../../assets/images/nosotros/nosotros-10.jpeg';
import img11 from '../../assets/images/nosotros/nosotros-11.jpeg';
import img12 from '../../assets/images/nosotros/nosotros-12.jpeg';

const Nosotros = () => {

    const slides = [
        { url: img1, title: "img1-nosotros" },
        { url: img2, title: "img2-nosotros" },
        { url: img3, title: "img3-nosotros" },
        { url: img4, title: "img4-nosotros" },
        { url: img5, title: "img5-nosotros" },
        { url: img6, title: "img6-nosotros" },
        { url: img7, title: "img7-nosotros" },
        { url: img8, title: "img8-nosotros" },
        { url: img9, title: "img9-nosotros" },
        { url: img10, title: "img10-nosotros" },
        { url: img11, title: "img11-nosotros" },
        { url: img12, title: "img12-nosotros" },
    ];

    const history = useHistory();

    return (
        <div className={styles.componentContainer}>
            <div className={styles.btnSection}>
                <Button icon="pi pi-arrow-circle-right" label="Turismo" className="p-button-raised p-button-warning" onClick={() => history.push('/turismo')} />
                <Button icon="pi pi-arrow-circle-right" label="Casa del docente" className="p-button-raised p-button-warning" onClick={() => history.push('/casa-del-docente')} />
                <Button icon="pi pi-arrow-circle-right" label="Predio" className="p-button-raised p-button-warning" onClick={() => history.push('/predio')} />
            </div>
            <div className={styles.title}>Quienes Somos</div>
            <p className={styles.text}>SIDCA, el Sindicato de Docentes de Catamarca, inscripción gremial 2902, adherido a la Confederación Argentina de Educadores, CEA, Personería gremial 1716.
                <br /><br />Trabaja en la firme defensa de los derechos docentes, reafirmando el reclamo permanente por mejores condiciones en el desempeño profesional, promoviendo la capacitación y el perfeccionamiento, exigiendo el respeto a normativas justas para los trabajadores y trabajadoras de la educación.
                <br /><br />Creemos que la educación es motor indiscutible de desarrollo de los pueblos y por eso, defendemos las mejores condiciones laborales para quienes la imparten, en consonancia con las instituciones gremiales consolidadas a nivel país y la Internacional de la Educación, que cuidan y protegen a educadores del país y el mundo.</p>
            <div className={styles.containerSlides}>
                <ImageSlider slides={slides} />
            </div>
        </div>
    )
}

export default Nosotros
