import React from 'react';
import { Card } from 'primereact/card';
import { Button } from 'primereact/button';
import { Skeleton } from 'primereact/skeleton';
import { Tag } from 'primereact/tag';
import { useHistory } from 'react-router-dom';  // ✅ importar

import styles from './CursosCard.module.css';

const CursosCard = ({ curso, miCurso }) => {
  const history = useHistory(); // ✅ ahora sí tenemos history disponible

  const header = (curso?.imagen || '').includes('https://')
    ? <img alt={curso?.titulo || 'Card'} src={curso.imagen} className={styles.headerImg} />
    : <Skeleton width="100%" height="12rem" />;

  const footer = miCurso
    ? (curso.aprobo
        ? (
          <div className={styles.statusWrapper}>
            <Tag
              value="Aprobaste este curso"
              icon="pi pi-check-circle"
              severity="success"
              className={styles.successTag}
              rounded
            />
            <small className={styles.statusHelp}>
              ¡Felicitaciones! 
            </small>
          </div>
        )
        : (curso.estado !== 'terminado'
            ? <span className={styles.footerText}>Curso aún dictándose</span>
            : <span className={styles.footerText}>Desaprobaste el curso</span>
          )
      )
    : (curso.estado !== 'terminado'
        ? (
          <div className={styles.footerBtnsCol}>
            <Button
              label="Inscribirse"
              icon="pi pi-check"
              className="p-button-success"
              onClick={() => window.location = curso.link}
              disabled={!curso?.link}
            />
            <Button
              label="Regresar a Capacitaciones"
              icon="pi pi-arrow-left"
              className="p-button-secondary"
              onClick={() => history.push('/capacitaciones')} // ✅ ahora funciona
            />
          </div>
        )
        : <span className={styles.footerText}>Curso Finalizado</span>
      );

  return (
    <Card title={curso.titulo} footer={footer} header={header} className={styles.cardContainer}>
      <p className={styles.descripcion}>{curso.descripcion}</p>
    </Card>
  );
};

export default CursosCard;
