// src/pages/Admin/Certificados/SelectorConfiguracion.js
//
// Selector de la pestaña EMITIR.
//
// Deliberadamente NO reutiliza SelectorCurso: aquel lee la colección "cursos"
// directamente desde Firestore, que es justo lo que acá no queremos. Emitir
// sólo puede trabajar sobre capacitaciones que ya tienen configuración de
// certificado creada, así que la fuente es el backend administrativo.
//
//   CONFIGURAR -> cursos                    (elegir qué configurar)
//   EMITIR     -> certificados configurados (elegir qué emitir)
//
// Se comparte la presentación reutilizando las clases de
// CertificadosAdmin.module.css, de modo que ambos selectores se ven igual sin
// acoplar su lógica de datos.

import React, { useMemo } from "react";

import styles from "./CertificadosAdmin.module.css";

const DIACRITICOS = new RegExp("[\\u0300-\\u036f]", "g");

const normalizar = (valor) =>
  String(valor || "")
    .normalize("NFD")
    .replace(DIACRITICOS, "")
    .trim()
    .toLowerCase();

const estadoLegible = (estado) =>
  normalizar(estado) === "lista" ? "Lista" : "Borrador";

const SelectorConfiguracion = ({
  configuraciones,
  configuracionSeleccionada,
  onSeleccionar,
  deshabilitado,
  busqueda,
  onBuscar,
}) => {
  const visibles = useMemo(() => {
    const termino = normalizar(busqueda);
    if (!termino) return configuraciones;

    return configuraciones.filter((configuracion) => {
      if (normalizar(configuracion.cursoTitulo).includes(termino)) return true;
      if (normalizar(configuracion.titulo).includes(termino)) return true;
      if (normalizar(configuracion.resolucion).includes(termino)) return true;
      return false;
    });
  }, [configuraciones, busqueda]);

  if (configuraciones.length === 0) {
    return (
      <p className={styles.estadoTexto}>
        Todavía no hay certificados configurados. Creá la configuración de una
        capacitación en la pestaña <strong>Configurar</strong>.
      </p>
    );
  }

  return (
    <div className={styles.selectorCurso}>
      <label className={styles.campo}>
        <span className={styles.campoLabel}>Buscar certificado o capacitación</span>
        <input
          type="search"
          className={styles.input}
          value={busqueda}
          onChange={(e) => onBuscar(e.target.value)}
          placeholder="Escribí parte del título o la resolución…"
          disabled={deshabilitado}
        />
      </label>

      <p className={styles.ayuda}>
        {visibles.length} de {configuraciones.length}{" "}
        {configuraciones.length === 1
          ? "certificado configurado"
          : "certificados configurados"}
        .
      </p>

      {visibles.length === 0 ? (
        <p className={styles.estadoTexto}>
          Ningún certificado coincide con la búsqueda.
        </p>
      ) : (
        <ul className={styles.listaCursos}>
          {visibles.map((configuracion) => {
            const activo =
              configuracionSeleccionada?.cursoId === configuracion.cursoId;

            const esLista = normalizar(configuracion.estadoConfiguracion) === "lista";

            return (
              <li key={configuracion.cursoId}>
                <button
                  type="button"
                  className={`${styles.cursoItem} ${
                    activo ? styles.cursoItemActivo : ""
                  }`}
                  onClick={() => onSeleccionar(configuracion)}
                  disabled={deshabilitado}
                  aria-pressed={activo}
                >
                  <span className={styles.cursoTitulo}>
                    {configuracion.cursoTitulo ||
                      configuracion.titulo ||
                      "Sin título"}
                  </span>

                  <span className={styles.cursoMeta}>
                    {configuracion.resolucion && (
                      <span className={styles.chipNeutro}>
                        Resolución: {configuracion.resolucion}
                      </span>
                    )}
                    <span
                      className={`${styles.chip} ${
                        esLista ? styles.chipTerminado : styles.chipAbierto
                      }`}
                    >
                      {estadoLegible(configuracion.estadoConfiguracion)}
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

export default SelectorConfiguracion;
