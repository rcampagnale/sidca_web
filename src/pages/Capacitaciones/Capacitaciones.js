import React from 'react';
import styles from './styles.module.css';
import { Button } from 'primereact/button';
import MisCursos from './MisCursos/MisCursos';
import Cursos20202019 from './Cursos 2020-2019/Cursos2020_2019';
import Cursos2021 from './Cursos 2021/Cursos2021';
import NuevosCursos from './Nuevos Cursos/NuevosCursos';

const Capacitaciones = () => {
    return (
        <div className={styles.mainSection}>
            <div>
                <div className={styles.title}>Capacitaciones</div>
                <div className={styles.textContainer}>
                    <p className={styles.text}>El <span style={{fontWeight: "bold"}}>Programa de Capacitación de SIDCA</span> brinda durante todo el año ofertas de capacitación y perfeccionamiento docente gratuita a sus afiliados, mediante cursos, talleres, congresos y seminarios que propician el acceso a material innovador y actualizado, contribuyendo en la profesionalización de nuestros docente. ¡Súmate vos también a estos beneficios!</p>
                </div>
            </div>
            <div className={styles.contentFlex}>
                <div className={styles.firstSection}>
                    <MisCursos/>
                    <NuevosCursos/>
                </div>
                <div className={styles.secondSection}>
                    <Cursos2021/>
                    <Cursos20202019/>
                </div>
            </div>
            <div className={styles.btn}>
                <a href="https://wa.link/xyhui7"><Button icon="pi pi-phone" label="Contacto" className="p-button-raised p-button-success" /></a> 
            </div>
        </div>
    )
}

export default Capacitaciones
