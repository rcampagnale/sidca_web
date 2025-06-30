import React from 'react'
import styles from './styles.module.css';
import { Button } from 'primereact/button';
import { useHistory } from 'react-router-dom';

const Predio = () => {

    const history = useHistory();

    return (
        <div className={styles.mainSection}>
            <div>
                <div className={styles.title}>Predio Recreativo</div>
                <div className={styles.subTitle}>Salón</div>
                <p className={styles.text}>SIDCA proximamente inaugurará su Predio Deportivo, Cultural y Recreativo, para todos sus afiliados. Salón de usos múltiples, canchas de fútbol y voley. Un predio para la familia docente, en Banda de Varela, a metros del Río del Valle. ¡Sumate vos también a sus beneficios!</p>
            </div>
            <img className={styles.img} src="https://sisanjuan2-imagenysistemas.netdna-ssl.com/media/xt-adaptive-images/optimized/480/media/k2/items/cache/3368b041c8e5a9fe4ab9f9a468368047_XL.jpg" alt="Proximamente Predio Deportivo"/>
            <div className={styles.titleReserva}>Hace tu reserva</div>
            <a className={styles.whatsappBtn} href="https://wa.link/wi539p"><Button icon="pi pi-phone" label="Reservar" className="p-button-raised p-button-success" /></a> 
            <div className={styles.btn}>
                <Button icon="pi pi-calendar" label="Novedades" className="p-button-raised p-button-warning" onClick={() => history.push('novedades')}/>
            </div>
        </div>
    )
}

export default Predio
