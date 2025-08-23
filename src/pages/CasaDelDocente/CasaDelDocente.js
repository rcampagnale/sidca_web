// src/pages/CasaDelDocente.js
import React from 'react'
import styles from './styles.module.css';
import { Button } from 'primereact/button';
import { useHistory } from 'react-router';
import { Carousel } from 'primereact/carousel';

// Importar imágenes desde assets/casa
import casa from '../../assets/casa/casa.jpg';
import casa1 from '../../assets/casa/casa1.jpg';
import casa2 from '../../assets/casa/casa2.jpg';
import casa3 from '../../assets/casa/casa3.jpg';

const CasaDelDocente = () => {
  const history = useHistory();

  const images = [
    { id: 0, src: casa,  alt: 'Casa del Docente - portada' },
    { id: 1, src: casa1, alt: 'Casa del Docente - foto 1' },
    { id: 2, src: casa2, alt: 'Casa del Docente - foto 2' },
    { id: 3, src: casa3, alt: 'Casa del Docente - foto 3' },
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
        <div className={styles.title}>Casa del Docente</div>
        <p className={styles.text}>
          En Lavalle 815 de la Ciudad Capital en Catamarca, la Casa del Docente es el anexo de servicios que ofrece SIDCA.
          Hospedaje, bar y cocina compartida, Salón de Conferencias y Sala de Computación.
          Más servicios para la docencia. ¡Sumate vos también a sus beneficios!
        </p>
      </div>

      {/* Carrusel de imágenes */}
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
        href="https://wa.me/5493834250139"
        target="_blank"
        rel="noopener noreferrer"
      >
        <Button
          icon="pi pi-phone"
          label="Reservar"
          className="p-button-raised p-button-success"
        />
      </a>

      {/* Nuevo botón Ver ubicación */}
      <div className={styles.btn}>
        <a
          className={styles.whatsappBtn}
          href="https://maps.app.goo.gl/uVD5hSbcXxM6APm28"
          target="_blank"
          rel="noopener noreferrer"
        >
          <Button
            icon="pi pi-map-marker"
            label="Ver ubicación"
            className="p-button-raised p-button-info"
          />
        </a>
      </div>

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

export default CasaDelDocente;

