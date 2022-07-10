import React, { useEffect } from "react";
import styles from './styles.module.css';
import { useHistory, useParams } from 'react-router';
import { useDispatch, useSelector } from "react-redux";
import CursosSkeleton from "../../../components/Cursos/CursosSkeleton";
import CursosCard from "../../../components/Cards/CursosCard";
import { clearCursos, getCursosCategory, getMisCursos } from "../../../redux/reducers/cursos/actions";
import { Button } from "primereact/button";

const CursosUser = () => {

    const history = useHistory();
    const dispatch = useDispatch();
    const { type } = useParams();

    const cursos = useSelector(state => state.cursos)

    useEffect(() => {
        if (!type) {
            history.push('/capacitaciones')
        } else {
            if (type === 'mis-cursos') {
                dispatch(getMisCursos())
            } else {
                dispatch(getCursosCategory(type))
            }
        }
        return () => {
            dispatch(clearCursos())
        }
    }, [])

    // const handleCursos = async () => {
    //     if (curso.estado == 'terminado') {
    //         if (!misCursos) {
    //             await dispatch(getCursosUser())
    //         }
    //         setActive(true)
    //     } else {
    //         curso.link
    //             &&
    //             handlePress(curso.link)
    //     }
    // }

    return (
        <div className={styles.boxContainer}>
            <h1 className={styles.title}>{type === 'mis-cursos' ? 'Mis Cursos' : `Cursos ${type}`}</h1>
            <div className={styles.container}>
                {
                    cursos.processing ?
                        <CursosSkeleton />
                        :
                        type === 'mis-cursos' ?
                            cursos.misCursos.length == 0 ?
                                <div className={styles.boxContainer}>
                                    <h1 className={styles.title}>No tienes Cursos</h1>
                                    <Button label="Volver" onClick={() => history.goBack()} />
                                </div>
                                :
                                cursos.misCursos.map(curso => (<CursosCard curso={curso} miCurso={true}/>))
                            :
                            cursos.cursos?.length == 0 ?
                                <div className={styles.boxContainer} >
                                    <h1 className={styles.title}        >No tienes Cursos En esta categoria</h1>
                                    <Button label="Volver" onClick={() => history.goBack()} />
                                </div>
                                :
                                cursos.cursos.map(curso => (<CursosCard curso={curso} />))
                }
            </div>
        </div>
    )
}

export default CursosUser;