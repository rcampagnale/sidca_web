import React from 'react';
import styles from './styles.module.css';
import { useHistory } from 'react-router-dom';
import { Button } from 'primereact/button';

const Turismo = () => {

    const history = useHistory();

    return (
        <div className={styles.mainSection}>
            <div>
                <div className={styles.title}>Turismo</div>
                <p className={styles.text}>SIDCA desarrolla su programa de Turismo Social para sus afiliados, con la firma de convenios con otras entidades gremiales a nivel país que permiten disfrutar del tiempo libre o vacacional mediante sus planes de paseo a corredores turísticos de la Argentina y Catamarca, gozando de los mejores paisajes y servicios. ¡Sumate vos también a sus beneficios!</p>
            </div>
            <img className={styles.img} src="https://static.treslineas.com.ar/foto/nota-1619529-movilizacion-docentes-valle-viejo-962562.jpg?imgres=400x0x80" alt="Turismo SiDCa"/>
            <div className={styles.titleReserva}>Hace tu reserva</div>
            <a className={styles.whatsappBtn} href="https://wa.link/wi539p"><Button icon="pi pi-phone" label="Reservar" className="p-button-raised p-button-success" /></a> 
            <div className={styles.btn}>
                <Button icon="pi pi-calendar" label="Novedades" className="p-button-raised p-button-warning" onClick={() => history.push('/novedades')}/>
            </div>
        </div>
    )
}
export default Turismo;