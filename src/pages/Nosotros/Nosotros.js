import React from "react";
import styles from "./styles.module.css";
import { Button } from "primereact/button";
import { useHistory } from "react-router-dom";
import ImageSlider from "../../components/Slider/ImageSlider";

import img1 from "../../assets/nosotros/somos1.jpg";
import img2 from "../../assets/nosotros/somos2.jpg";
import img3 from "../../assets/nosotros/somos3.jpg";
import img4 from "../../assets/nosotros/somos4.jpg";
import img5 from "../../assets/nosotros/somos5.jpg";
import img6 from "../../assets/nosotros/somos6.jpg";
import img7 from "../../assets/nosotros/somos7.jpg";
import img8 from "../../assets/nosotros/somos8.jpg";
import img9 from "../../assets/nosotros/somos9.jpg";
import img10 from "../../assets/nosotros/somos10.jpg";
import img11 from "../../assets/nosotros/somos11.png";
import img12 from "../../assets/nosotros/somos12.png";

const Nosotros = () => {
  const slides = [
    { url: img1, title: "img1-somos" },
    { url: img2, title: "img2-somos" },
    { url: img3, title: "img3-somos" },
    { url: img4, title: "img4-somos" },
    { url: img5, title: "img5-somos" },
    { url: img6, title: "img6-somos" },
    { url: img7, title: "img7-somos" },
    { url: img8, title: "img8-somos" },
    { url: img9, title: "img9-somos" },
    { url: img10, title: "img10-somos" },
    { url: img11, title: "img11-somos" },
    { url: img12, title: "img12-somos" },
  ];

  const history = useHistory();

  return (
    <div className={styles.componentContainer}>
      {/* Título y descripción */}
      <h1 className={styles.title}>Quiénes Somos</h1>
      <p className={styles.text}>
        SIDCA, el Sindicato de Docentes de Catamarca, inscripción gremial 2902,
        adherido a la Confederación Argentina de Educadores, CEA, Personería
        gremial 1716.
        <br />
        <br />
        Trabaja en la firme defensa de los derechos docentes, reafirmando el
        reclamo permanente por mejores condiciones en el desempeño profesional,
        promoviendo la capacitación y el perfeccionamiento, exigiendo el respeto
        a normativas justas para los trabajadores y trabajadoras de la
        educación.
        <br />
        <br />
        Creemos que la educación es motor indiscutible de desarrollo de los
        pueblos y por eso, defendemos las mejores condiciones laborales para
        quienes la imparten, en consonancia con las instituciones gremiales
        consolidadas a nivel país y la Internacional de la Educación, que cuidan
        y protegen a educadores del país y el mundo.
      </p>

      {/* Botones abajo del texto */}
      <div className={styles.btnSection}>
        <Button
          icon="pi pi-send"
          /* Ícono de viajes */
          label="Turismo"
          className="p-button-raised p-button-warning"
          onClick={() => history.push("/turismo")}
        />
        <Button
          icon="pi pi-home"
          /* Ícono de casa */
          label="Casa del docente"
          className="p-button-raised p-button-warning"
          onClick={() => history.push("/casa-del-docente")}
        />
        <Button
          icon="pi pi-map"
          /* Ícono de predio */
          label="Predio"
          className="p-button-raised p-button-warning"
          onClick={() => history.push("/predio")}
        />
      </div>

      {/* Carrusel */}
      <div className={styles.containerSlides}>
        <ImageSlider slides={slides} />
      </div>
    </div>
  );
};

export default Nosotros;

