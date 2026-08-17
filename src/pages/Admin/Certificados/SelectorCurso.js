// src/pages/Admin/Certificados/SelectorCurso.js
//
// Paso 1: selección de la capacitación.
//
// Lee la colección "cursos" directamente desde Firestore, tal como ya lo
// hace el resto del panel administrativo. No se creó un endpoint de backend
// sólo para listar cursos.

import React, { useEffect, useMemo, useState } from "react";
import { collection, getDocs } from "firebase/firestore";

import { db } from "../../../firebase/firebase-config";
import styles from "./CertificadosAdmin.module.css";

/** Rango de marcas diacríticas que deja NFD al descomponer los acentos. */
const DIACRITICOS = new RegExp("[\\u0300-\\u036f]", "g");

/** Quita acentos y pasa a minúsculas para que la búsqueda sea tolerante. */
const normalizar = (valor) =>
  String(valor || "")
    .normalize("NFD")
    .replace(DIACRITICOS, "")
    .trim()
    .toLowerCase();

// Etiquetas legibles, con los mismos valores que usa /admin/cursos.
const estadoLegible = (estado) => {
  const valor = normalizar(estado);
  if (valor === "inscripcion_abierta") return "Inscripción abierta";
  if (valor === "terminado") return "Terminado";
  return estado || "Sin estado";
};

const categoriaLegible = (categoria) => {
  const valor = normalizar(categoria);
  if (valor === "nuevos" || valor === "nuevo") return "Nuevos";
  return categoria || "Sin categoría";
};

const esTerminado = (estado) => normalizar(estado) === "terminado";

/**
 * Prioriza los cursos terminados, que son los que efectivamente necesitan
 * certificado, y dentro de cada grupo ordena alfabéticamente.
 */
const ordenarCursos = (cursos) =>
  [...cursos].sort((a, b) => {
    const prioridadA = esTerminado(a.estado) ? 0 : 1;
    const prioridadB = esTerminado(b.estado) ? 0 : 1;

    if (prioridadA !== prioridadB) return prioridadA - prioridadB;

    return String(a.titulo || "").localeCompare(String(b.titulo || ""), "es");
  });

const SelectorCurso = ({ cursoSeleccionado, onSeleccionar, deshabilitado }) => {
  const [cursos, setCursos] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState("");
  const [busqueda, setBusqueda] = useState("");

  useEffect(() => {
    let activo = true;

    const cargar = async () => {
      try {
        const snapshot = await getDocs(collection(db, "cursos"));

        if (!activo) return;

        setCursos(
          snapshot.docs.map((documento) => ({
            id: documento.id,
            ...documento.data(),
          }))
        );
        setError("");
      } catch (e) {
        if (!activo) return;
        setError("No se pudieron cargar las capacitaciones.");
      } finally {
        if (activo) setCargando(false);
      }
    };

    cargar();

    return () => {
      activo = false;
    };
  }, []);

  const cursosVisibles = useMemo(() => {
    const termino = normalizar(busqueda);
    const ordenados = ordenarCursos(cursos);

    if (!termino) return ordenados;

    return ordenados.filter((curso) =>
      normalizar(curso.titulo).includes(termino)
    );
  }, [cursos, busqueda]);

  if (cargando) {
    return <p className={styles.estadoTexto}>Cargando capacitaciones…</p>;
  }

  if (error) {
    return <p className={styles.mensajeError}>{error}</p>;
  }

  return (
    <div className={styles.selectorCurso}>
      <label className={styles.campo}>
        <span className={styles.campoLabel}>Buscar capacitación</span>
        <input
          type="search"
          className={styles.input}
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          placeholder="Escribí parte del título…"
          disabled={deshabilitado}
        />
      </label>

      <p className={styles.ayuda}>
        {cursosVisibles.length} de {cursos.length} capacitaciones. Los cursos
        terminados aparecen primero.
      </p>

      {cursosVisibles.length === 0 ? (
        <p className={styles.estadoTexto}>
          Ninguna capacitación coincide con la búsqueda.
        </p>
      ) : (
        <ul className={styles.listaCursos}>
          {cursosVisibles.map((curso) => {
            const activo = cursoSeleccionado?.id === curso.id;

            return (
              <li key={curso.id}>
                <button
                  type="button"
                  className={`${styles.cursoItem} ${
                    activo ? styles.cursoItemActivo : ""
                  }`}
                  onClick={() => onSeleccionar(curso)}
                  disabled={deshabilitado}
                  aria-pressed={activo}
                >
                  <span className={styles.cursoTitulo}>
                    {curso.titulo || "Sin título"}
                  </span>

                  <span className={styles.cursoMeta}>
                    <span
                      className={`${styles.chip} ${
                        esTerminado(curso.estado)
                          ? styles.chipTerminado
                          : styles.chipAbierto
                      }`}
                    >
                      {estadoLegible(curso.estado)}
                    </span>
                    <span className={styles.chipNeutro}>
                      {categoriaLegible(curso.categoria)}
                    </span>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
};

export default SelectorCurso;
