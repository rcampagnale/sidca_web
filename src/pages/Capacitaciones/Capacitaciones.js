import React from 'react';
import styles from './styles.module.css';
import { Button } from 'primereact/button';
import { useHistory } from 'react-router-dom';

const Capacitaciones = () => {
  const history = useHistory();

  return (
    <div className={styles.mainSection}>
      {/* Encabezado */}
      <div>
        <div className={styles.title}>Capacitaciones</div>
        <div className={styles.textContainer}>
          <p className={styles.text}>
            El <span style={{ fontWeight: "bold" }}>Programa de Capacitación de SIDCA</span> brinda durante todo el año
            ofertas de capacitación y perfeccionamiento docente gratuita a sus afiliados, mediante cursos, talleres,
            congresos y seminarios que propician el acceso a material innovador y actualizado, contribuyendo en la
            profesionalización de nuestros docentes. ¡Súmate vos también a estos beneficios!
          </p>
        </div>
      </div>

      {/* Botones principales */}
      <div className={styles.cards_container}>
        <div className={styles.button_title}>
          <Button
            icon="pi pi-external-link"
            label="Abrir Aula Virtual"
            className="p-button-raised p-button-info"
            onClick={() => window.open('https://aula.sidcagremio.com/', '_blank')}
          />
        </div>

        <div className={styles.button_title}>
          <Button
            icon="pi pi-check-circle"
            label="Cursos Aprobados"
            className="p-button-raised p-button-success"
            onClick={() => history.push('/capacitaciones/cursos-aprobados')}
          />
        </div>

        <div className={styles.button_title}>
          <Button
            icon="pi pi-book"
            label="Cursos Disponibles"
            className="p-button-raised p-button-warning"
            onClick={() => history.push('/capacitaciones/cursos-disponibles')}
          />
        </div>

        <div className={styles.button_title}>
          <Button
            icon="pi pi-users"
            label="Registro de Asistencia"
            className="p-button-raised p-button-help"
            onClick={() => history.push('/capacitaciones/registro-asistencia')}
          />
        </div>
      </div>

      
    </div>
  );
};

export default Capacitaciones;
