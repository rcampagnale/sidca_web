// src/pages/Turismo.js
import React from 'react';
import styles from './styles.module.css';
import { useHistory } from 'react-router';
import { Button } from 'primereact/button';
import { Carousel } from 'primereact/carousel';

import turismo from '../../assets/turismo/turismo.jpg';
import turismo1 from '../../assets/turismo/turismo1.jpg';
import turismo2 from '../../assets/turismo/turismo2.jpg';
import turismo3 from '../../assets/turismo/turismo3.jpg';
import turismo4 from '../../assets/turismo/turismo4.jpg';
import turismo5 from '../../assets/turismo/turismo5.jpg';

const Turismo = () => {
  const history = useHistory();

  const images = [
    { id: 0, src: turismo,  alt: 'Turismo - portada' },
    { id: 1, src: turismo1, alt: 'Turismo - destino 1' },
    { id: 2, src: turismo2, alt: 'Turismo - destino 2' },
    { id: 3, src: turismo3, alt: 'Turismo - destino 3' },
    { id: 4, src: turismo4, alt: 'Turismo - destino 4' },
    { id: 5, src: turismo5, alt: 'Turismo - destino 5' },
  ];

  const imageTemplate = (item) => (
    <div className={styles.carouselItem}>
      <img src={item.src} alt={item.alt} className={styles.carouselImg} loading="lazy" />
    </div>
  );

  return (
    <div className={styles.mainSection}>
      {/* Intro separado para no afectar el Carousel */}
      <div className={styles.intro}>
        <div className={styles.title}>Turismo</div>
        <p className={styles.text}>
          SIDCA desarrolla su programa de Turismo Social para sus afiliados, con la firma de convenios con otras entidades gremiales a nivel país que permiten disfrutar del tiempo libre o vacacional mediante sus planes de paseo a corredores turísticos de la Argentina y Catamarca, gozando de los mejores paisajes y servicios. ¡Sumate vos también a sus beneficios!
        </p>
      </div>

      <Carousel
        value={images}
        numVisible={1}
        numScroll={1}
        itemTemplate={imageTemplate}
        circular
        autoplayInterval={4000}
      />

      <div className={styles.titleReserva}>Hace tu reserva</div>
      <a className={styles.whatsappBtn} href="https://wa.me/5493834283151">
        <Button icon="pi pi-phone" label="Reservar" className="p-button-raised p-button-success" />
      </a>

      {/* Botones */}
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

export default Turismo;


