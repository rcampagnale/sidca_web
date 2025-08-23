// src/pages/Predio.js
import React from 'react'
import styles from './styles.module.css';
import { Button } from 'primereact/button';
import { useHistory } from 'react-router';
import { Carousel } from 'primereact/carousel';

// Importar imágenes desde assets/predio
import predio from '../../assets/predio/predio.jpg';
import predio1 from '../../assets/predio/predio1.jpg';
import predio2 from '../../assets/predio/predio2.jpg';
import predio3 from '../../assets/predio/predio3.jpg';
import predio4 from '../../assets/predio/predio4.jpg';
import predio5 from '../../assets/predio/predio5.jpg';
import predio6 from '../../assets/predio/predio6.jpg';

const Predio = () => {
  const history = useHistory();

  const images = [
    { id: 0, src: predio,  alt: 'Predio Recreativo - portada' },
    { id: 1, src: predio1, alt: 'Predio Recreativo - foto 1' },
    { id: 2, src: predio2, alt: 'Predio Recreativo - foto 2' },
    { id: 3, src: predio3, alt: 'Predio Recreativo - foto 3' },
    { id: 4, src: predio4, alt: 'Predio Recreativo - foto 4' },
    { id: 5, src: predio5, alt: 'Predio Recreativo - foto 5' },
    { id: 6, src: predio6, alt: 'Predio Recreativo - foto 6' },
  ];

  const imageTemplate = (item) => (
    <div className={styles.carouselItem}>
      <img
        src={item.src}
        alt={item.alt}
        className={styles.carouselImg}
        loading="lazy"
      />
    </div>
  );

  return (
    <div className={styles.mainSection}>
      <div className={styles.intro}>
        <div className={styles.title}>Predio Recreativo</div>
        <div className={styles.subTitle}>Salón</div>
        <p className={styles.text}>
          SIDCA próximamente inaugurará su Predio Deportivo, Cultural y Recreativo para todos sus afiliados.
          Salón de usos múltiples, canchas de fútbol y vóley. Un predio para la familia docente, en Banda de Varela,
          a metros del Río del Valle. ¡Sumate vos también a sus beneficios!
        </p>
      </div>

      {/* Carrusel */}
      <Carousel
        value={images}
        numVisible={1}
        numScroll={1}
        itemTemplate={imageTemplate}
        circular
        autoplayInterval={4000}
      />

      <div className={styles.titleReserva}>Hace tu reserva</div>
      <a
        className={styles.whatsappBtn}
        href="https://wa.me/"
        target="_blank"
        rel="noopener noreferrer"
      >
        <Button
          icon="pi pi-phone"
          label="Reservar"
          className="p-button-raised p-button-success"
        />
      </a>

     

      <div className={styles.btn}>
        <Button
          icon="pi pi-calendar"
          label="Novedades"
          className="p-button-raised p-button-warning"
          onClick={() => history.push('/novedades')}
        />
      </div>

      <div className={styles.btn}>
        <Button
          icon="pi pi-arrow-left"
          label="Regresar a Nosotros"
          className="p-button-raised p-button-warning"
          onClick={() => history.push('/nosotros')}
        />
      </div>
    </div>
  );
};

export default Predio;

