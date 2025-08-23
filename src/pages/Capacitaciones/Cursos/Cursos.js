import React, { useEffect } from "react";
import styles from './styles.module.css';
import { useHistory, useParams } from 'react-router-dom';
import { useDispatch, useSelector } from "react-redux";
import CursosSkeleton from "../../../components/Cursos/CursosSkeleton";
import CursosCard from "../../../components/Cards/CursosCard";
import {
  clearCursos,
  getCursosCategory,
  getMisCursos,
  getCursosDisponibles,
} from "../../../redux/reducers/cursos/actions";
import { Button } from "primereact/button";

const CursosUser = () => {
  const history = useHistory();
  const dispatch = useDispatch();
  const { type } = useParams();

  const cursos = useSelector(state => state.cursos);

  useEffect(() => {
    if (!type) {
      history.push('/capacitaciones');
      return;
    }

    if (type === 'mis-cursos') {
      dispatch(getMisCursos());
    } else if (type === 'cursos-disponibles') {
      dispatch(getCursosDisponibles());
    } else if (type === 'cursos-aprobados') {
      dispatch(getMisCursos()); // traemos todos y filtramos en render
    } else {
      dispatch(getCursosCategory(type));
    }

    return () => {
      dispatch(clearCursos());
    };
  }, [type, dispatch, history]);

  const titulo =
    type === 'mis-cursos'
      ? 'Mis Cursos'
      : type === 'cursos-disponibles'
        ? 'Cursos Disponibles'
        : type === 'cursos-aprobados'
          ? 'Cursos Aprobados'
          : `Cursos ${type}`;

  const EmptyBox = ({ text }) => (
    <div className={styles.boxContainer}>
      <h1 className={styles.title}>{text}</h1>
      <Button label="Volver" onClick={() => history.push('/capacitaciones')} />
    </div>
  );

  const misCursosAprobados = (cursos.misCursos || []).filter(c => c.aprobo === true);

  return (
    <div className={styles.mainContainer}>
      <h1 className={styles.title}>{titulo}</h1>

      {/* 👇 Botón siempre visible para volver a Capacitaciones */}
      <div style={{ marginBottom: "1.5rem" }}>
        <Button
          label="Regresar a Capacitaciones"
          icon="pi pi-arrow-left"
          className="p-button-secondary"
          onClick={() => history.push('/capacitaciones')}
        />
      </div>

      {cursos.processing ? (
        <CursosSkeleton />
      ) : type === 'mis-cursos' ? (
        cursos.misCursos.length === 0 ? (
          <EmptyBox text="No tienes Cursos" />
        ) : (
          <div className={styles.container}>
            {cursos.misCursos.map(curso => (
              <CursosCard key={curso.id} curso={curso} miCurso={true} />
            ))}
          </div>
        )
      ) : type === 'cursos-aprobados' ? (
        misCursosAprobados.length === 0 ? (
          <EmptyBox text="No tienes Cursos Aprobados" />
        ) : (
          <div className={styles.container}>
            {misCursosAprobados.map(curso => (
              <CursosCard key={curso.id} curso={curso} miCurso={true} />
            ))}
          </div>
        )
      ) : cursos.cursos?.length === 0 ? (
        <EmptyBox text={type === 'cursos-disponibles' ? "No hay cursos disponibles" : "No hay cursos en esta categoría"} />
      ) : (
        <div className={styles.container}>
          {(type === 'cursos-disponibles'
            ? cursos.cursos
            : [...cursos.cursos].reverse()
          ).map(curso => (
            <CursosCard key={curso.id} curso={curso} />
          ))}
        </div>
      )}
    </div>
  );
};

export default CursosUser;


