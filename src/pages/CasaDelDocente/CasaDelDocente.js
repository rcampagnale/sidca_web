import React from 'react'
import styles from './styles.module.css';
import { Button } from 'primereact/button';
import { useHistory } from 'react-router';

const CasaDelDocente = () => {

    const history = useHistory();

    return (
        <div className={styles.mainSection}>
            <div>
                <div className={styles.title}>Casa del Docente</div>
                <p className={styles.text}>En lavalle 815 de la Ciudad Capital en Catamarca, la Casa del Docente es el anexo de servicios que ofrece SIDCA. Hospedaje, bar y cocina compartida, Salón de Conferencias y Sala de Computación. Más servicios para la docencia. ¡Sumate vos también a sus beneficios!</p>
            </div>
            <img className={styles.img} src="https://miramarense.com.ar/admin/recursos/hoteles/20_2.jpg" alt="Fotos de casa del docente"/>
            <div className={styles.titleReserva}>Hace tu reserva</div>
            <a className={styles.whatsappBtn} href="https://wa.link/wi539p"><Button icon="pi pi-phone" label="Reservar" className="p-button-raised p-button-success" /></a> 
            <div className={styles.btn}>
                <Button icon="pi pi-calendar" label="Novedades" className="p-button-raised p-button-warning" onClick={() => history.push('novedades')}/>
            </div>
        </div>
    )
}

export default CasaDelDocente;
