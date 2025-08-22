import React, { useEffect } from "react";
import styles from './styles.module.css';
import { useHistory, useParams } from 'react-router';
import { useDispatch, useSelector } from "react-redux";
import CursosSkeleton from "../../../components/Cursos/CursosSkeleton";
import CursosCard from "../../../components/Cards/CursosCard";
import {
  clearCursos,
  getCursosCategory,
  getMisCursos,
  getCursosDisponibles, // 👈 nuevo import
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
    } else {
      if (type === 'mis-cursos') {
        dispatch(getMisCursos());
      } else if (type === 'cursos-disponibles') {
        dispatch(getCursosDisponibles()); // 👈 acá disparamos disponibles
      } else {
        dispatch(getCursosCategory(type));
      }
    }
    return () => {
      dispatch(clearCursos());
    };
    // Si querés que reaccione a cambios de ruta, podés usar [type, dispatch, history]
  }, []); // eslint-disable-line

  const titulo =
    type === 'mis-cursos'
      ? 'Mis Cursos'
      : type === 'cursos-disponibles'
        ? 'Cursos Disponibles'
        : `Cursos ${type}`;

  const EmptyBox = ({ text }) => (
    <div className={styles.boxContainer}>
      <h1 className={styles.title}>{text}</h1>
      <Button label="Volver" onClick={() => history.goBack()} />
    </div>
  );

  return (
    <div className={styles.mainContainer}>
      <h1 className={styles.title}>{titulo}</h1>

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
      ) : cursos.cursos?.length === 0 ? (
        <EmptyBox text={type === 'cursos-disponibles' ? "No hay cursos disponibles" : "No hay cursos en esta categoria"} />
      ) : (
        <div className={styles.container}>
          {/* Para disponibles, respetamos el orden ascendente;
              para el resto, mostramos últimos primero SIN mutar el estado */}
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
