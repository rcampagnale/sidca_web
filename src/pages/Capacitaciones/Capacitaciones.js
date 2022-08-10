import React, { useEffect, useState } from 'react';
import styles from './styles.module.css';
import { Button } from 'primereact/button';
import { useHistory } from 'react-router-dom';
import { useSelector } from 'react-redux';

const Capacitaciones = () => {

    const history = useHistory();
    const categoriasCursos = useSelector(state => state.categorias?.categorias?.cursos)

    const [categorias, setCategorias] = useState(undefined);

    useEffect(() => {
        setCategorias(categoriasCursos);

    }, [categoriasCursos])

    return (
        <div className={styles.mainSection}>
            <div>
                <div className={styles.title}>Capacitaciones</div>
                <div className={styles.textContainer}>
                    <p className={styles.text}>El <span style={{ fontWeight: "bold" }}>Programa de Capacitación de SIDCA</span> brinda durante todo el año ofertas de capacitación y perfeccionamiento docente gratuita a sus afiliados, mediante cursos, talleres, congresos y seminarios que propician el acceso a material innovador y actualizado, contribuyendo en la profesionalización de nuestros docente. ¡Súmate vos también a estos beneficios!</p>
                </div>
            </div>

            <div className="fixthismessfran">
                {
                    categorias?.map(categoria => (<div className={styles.button_title}>
                        <div className={styles.title}>Nuevos cursos</div>
                            <Button key={categoria} icon="pi pi-check-square" label="Ver cursos" className="p-button-raised p-button-warning" onClick={() => history.push(`/capacitaciones/cursos/${categoria}`)} />
                        </div>)
                    )
                }
            </div>
            <div className={styles.card_container}>
                <div className={styles.secondSection}>
                    <div>
                        <div className={styles.title}>Mis Cursos</div>
                        <Button icon="pi pi-check-square" label="Ver cursos" className="p-button-raised p-button-warning" onClick={() => history.push('/capacitaciones/cursos/mis-cursos')} />
                    </div>
                </div>
            </div>
            <div className={styles.btn}>
                <a href="https://wa.link/xyhui7"><Button icon="pi pi-phone" label="Contacto" className="p-button-raised p-button-success" /></a>
            </div>
        </div>
    )
}

export default Capacitaciones
