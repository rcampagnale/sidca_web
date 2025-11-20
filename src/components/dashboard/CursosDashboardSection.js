// src/components/dashboard/CursosDashboardSection.js
import React, { useEffect, useMemo, useState } from "react";
import { ProgressSpinner } from "primereact/progressspinner";
import { Chart } from "primereact/chart";
import { Button } from "primereact/button";
import {
  collection,
  getDocs,
  collectionGroup,
  query,
  where,
} from "firebase/firestore";
import { db } from "../../firebase/firebase-config";
import styles from "../../pages/Admin/AfiliadosDashboard/afiliadosDashboard.module.css";

const COURSE_PATH_PREFIX = "cursos/";
const PAGE_SIZE = 15; // cursos por página en el gráfico

/** Intenta extraer el año del documento de cursos (ajustá el nombre de campo si es otro) */
const getCourseYear = (data) =>
  data.anio ||
  data.año ||
  data.anioCurso ||
  data.anioDictado ||
  data.anioCohorte ||
  null;

/** Normaliza un año a string "YYYY" */
const normalizeYear = (value) => {
  if (!value) return null;
  const n = Number(String(value).slice(0, 4));
  return Number.isNaN(n) ? null : String(n);
};

/** Estado: helpers para saber si un curso está activo o finalizado */
const isFinishedStatus = (estado) => {
  const s = String(estado || "").toLowerCase();
  return (
    s.includes("terminado") ||
    s.includes("finalizado") ||
    s.includes("cerrado")
  );
};

const isActiveStatus = (estado) => {
  const s = String(estado || "").toLowerCase();
  if (!s) return false;
  if (isFinishedStatus(estado)) return false;
  return (
    s.includes("inscripcion abierta") ||
    s.includes("inscripción abierta") ||
    s.includes("en curso") ||
    s.includes("activo")
  );
};

/** Devuelve colores y etiqueta para el chip de estado */
const getStatusMeta = (estado) => {
  const originalLabel = estado || "Sin estado";
  const s = String(estado || "").toLowerCase();

  if (isFinishedStatus(s)) {
    return {
      label: originalLabel || "Finalizado",
      bg: "#ffebee",
      text: "#c62828",
      border: "#e53935",
    };
  }

  if (isActiveStatus(s)) {
    return {
      label: originalLabel || "Activo",
      bg: "#e8f5e9",
      text: "#2e7d32",
      border: "#43a047",
    };
  }

  return {
    label: originalLabel || "Sin estado",
    bg: "#eceff1",
    text: "#455a64",
    border: "#90a4ae",
  };
};

/**
 * Dashboard de cursos:
 * - Lee los metadatos de la colección raíz "cursos"
 * - Cuenta aprobados desde todas las subcolecciones "cursos" de /usuarios/{dni}/cursos
 *   usando collectionGroup (solo documentos con aprobo === true)
 * - Muestra:
 *    • Gráfico de barras paginado: afiliados aprobados por curso
 *    • Resumen + donut global (activos vs no activos)
 *    • Lista de cursos con estado en color (rojo/verde) + aprobados
 */
export default function CursosDashboardSection({ year }) {
  const [cursos, setCursos] = useState([]); // [{id, titulo, estado, aprobados, year}]
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [page, setPage] = useState(0); // página actual del gráfico

  useEffect(() => {
    let cancelled = false;

    const fetchCursos = async () => {
      setLoading(true);
      setError("");

      try {
        // 1) Traemos todos los cursos (colección raíz "cursos")
        const cursosSnap = await getDocs(collection(db, "cursos"));
        const cursosMap = new Map(); // key: "cursos/<idCurso>" -> { id, titulo, estado, aprobados, year }

        const yearFilter = year ? normalizeYear(year) : null;

        cursosSnap.forEach((docSnap) => {
          const data = docSnap.data() || {};
          const id = docSnap.id;
          const titulo = data.titulo || "Curso sin título";
          const estado = data.estado || "sin estado";
          const courseYear = normalizeYear(getCourseYear(data));

          // Si se pasa año, filtramos por el año del curso
          if (yearFilter && courseYear && courseYear !== yearFilter) return;

          const key = `${COURSE_PATH_PREFIX}${id}`;
          cursosMap.set(key, {
            id,
            titulo,
            estado,
            aprobados: 0,
            year: courseYear,
          });
        });

        // Si no hay cursos, cortamos acá
        if (cursosMap.size === 0) {
          if (!cancelled) {
            setCursos([]);
            setPage(0);
          }
          return;
        }

        // 2) Contamos aprobados desde TODAS las subcolecciones "cursos"
        //    de usuarios usando collectionGroup (requiere índice en Firestore)
        const cgQuery = query(
          collectionGroup(db, "cursos"),
          where("aprobo", "==", true)
        );

        const cgSnap = await getDocs(cgQuery);

        cgSnap.forEach((docSnap) => {
          const d = docSnap.data() || {};
          const cursoPath = d.curso; // ej: "cursos/ID_DEL_CURSO"
          if (!cursoPath || typeof cursoPath !== "string") return;

          const entry = cursosMap.get(cursoPath);
          if (!entry) return; // puede ser un curso viejo o de otro año

          entry.aprobados = (entry.aprobados || 0) + 1;
        });

        const cursosArray = Array.from(cursosMap.values()).sort((a, b) =>
          a.titulo.localeCompare(b.titulo, "es", { sensitivity: "base" })
        );

        if (!cancelled) {
          setCursos(cursosArray);
          setPage(0); // reseteamos a la primera página cuando cambia el listado
        }
      } catch (err) {
        console.error("[CursosDashboardSection] Error al cargar cursos:", err);
        if (!cancelled) {
          setError("No se pudo cargar la información de cursos.");
          setCursos([]);
          setPage(0);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    fetchCursos();
    return () => {
      cancelled = true;
    };
  }, [year]);

  // ===== KPIs y métricas =====
  const { totalCursos, cursosActivos, totalAprobados } = useMemo(() => {
    const totalCursos = cursos.length;
    const cursosActivos = cursos.filter((c) => isActiveStatus(c.estado)).length;
    const totalAprobados = cursos.reduce(
      (acc, c) => acc + (c.aprobados || 0),
      0
    );
    return { totalCursos, cursosActivos, totalAprobados };
  }, [cursos]);

  // ===== Paginación para el gráfico =====
  const totalPages = useMemo(
    () => (cursos.length === 0 ? 1 : Math.ceil(cursos.length / PAGE_SIZE)),
    [cursos.length]
  );

  const pagedCursos = useMemo(() => {
    const start = page * PAGE_SIZE;
    return cursos.slice(start, start + PAGE_SIZE);
  }, [cursos, page]);

  const startIndex = page * PAGE_SIZE;
  const endIndex = Math.min(startIndex + pagedCursos.length, cursos.length);

  // ===== Gráfico de barras: aprobados por curso (paginado) =====
  const barData = useMemo(
    () => ({
      labels: pagedCursos.map((c) => c.titulo),
      datasets: [
        {
          label: "Aprobados",
          data: pagedCursos.map((c) => c.aprobados || 0),
          backgroundColor: "#90caf9",
        },
      ],
    }),
    [pagedCursos]
  );

  // 💡 Mucho más alto por curso para que entren bien las líneas de texto
  const barHeight = useMemo(
    () => Math.max(70 * pagedCursos.length, 320),
    [pagedCursos.length]
  );

  const barOptions = useMemo(
    () => ({
      indexAxis: "y",
      maintainAspectRatio: false,
      layout: {
        // desplazamos el área del gráfico un poco a la derecha
        padding: {
          left: 40,
          right: 10,  
          top: 20,
          bottom: 20,
        },
      },
      plugins: {
        legend: {
          labels: { color: "#495057" },
        },
        tooltip: {
          callbacks: {
            label: (ctx) => `${ctx.parsed.x} afiliados aprobados`,
          },
        },
      },
      scales: {
        x: {
          ticks: { color: "#495057" },
          grid: { color: "#ebedef" },
        },
        y: {
          ticks: {
            color: "#495057",
            autoSkip: false,
            font: { size: 11 },
            align: "outer",   // texto un poquito más separado del eje
            padding: 16,       // espacio extra hacia la izquierda
            // multi-line: devolvemos un array de líneas
            callback: function (value) {
              const raw =
                (this.getLabelForValue &&
                  this.getLabelForValue(value)) || "";
              const label = Array.isArray(raw) ? raw.join(" ") : raw;
              if (typeof label !== "string") return label;

              // Partimos en bloques de ~28 caracteres
              const lines = label.match(/.{1,30}/g) || [label];
              return lines;
            },
          },
          grid: { color: "#f1f3f5" },
        },
      },
    }),
    []
  );

  // ===== Donut: proporción de cursos activos vs no activos =====
  const donutData = useMemo(() => {
    const inactivos = Math.max(totalCursos - cursosActivos, 0);
    if (totalCursos === 0) {
      return {
        labels: ["Activos", "No activos"],
        datasets: [
          {
            data: [0, 0],
            backgroundColor: ["#43a047", "#e53935"],
          },
        ],
      };
    }
    return {
      labels: ["Activos", "No activos"],
      datasets: [
        {
          data: [cursosActivos, inactivos],
          backgroundColor: ["#43a047", "#e53935"], // verde = activos, rojo = no activos
        },
      ],
    };
  }, [cursosActivos, totalCursos]);

  const donutOptions = useMemo(
    () => ({
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: "bottom",
          labels: { color: "#495057" },
        },
      },
      cutout: "65%",
    }),
    []
  );

  return (
    <div style={{ marginTop: "1.5rem" }}>
      {/* ===== FILA 1: gráfico de barras a todo el ancho ===== */}
      <div className={styles.coursesTopRow}>
        <div className={styles.coursesTopCol}>
          <div className={styles.panel}>
            <div className={styles.panelHeader}>
              Afiliados aprobados por curso
            </div>
            <div className={styles.panelBody}>
              {loading ? (
                <div style={{ textAlign: "center", paddingTop: "1.5rem" }}>
                  <ProgressSpinner
                    style={{ width: "40px", height: "40px" }}
                    strokeWidth="4"
                  />
                </div>
              ) : error ? (
                <p className={styles.errorText}>{error}</p>
              ) : cursos.length === 0 ? (
                <p className={styles.mapEmpty}>
                  No hay cursos para mostrar en este período.
                </p>
              ) : (
                <>
                  <Chart
                    type="bar"
                    data={barData}
                    options={barOptions}
                    style={{ width: "100%", height: `${barHeight}px` }}
                  />

                  {/* Controles de paginación del gráfico */}
                  {cursos.length > 0 && (
                    <div
                      style={{
                        marginTop: "0.5rem",
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        fontSize: "0.8rem",
                        color: "#6c757d",
                      }}
                    >
                      <span>
                        Mostrando {startIndex + 1}-{endIndex} de{" "}
                        {cursos.length} cursos
                      </span>
                      <div style={{ display: "flex", gap: "0.5rem" }}>
                        <Button
                          type="button"
                          label="Anterior"
                          icon="pi pi-chevron-left"
                          className="p-button-text p-button-sm"
                          onClick={() =>
                            setPage((p) => Math.max(0, p - 1))
                          }
                          disabled={page === 0}
                        />
                        <Button
                          type="button"
                          label="Siguiente"
                          icon="pi pi-chevron-right"
                          iconPos="right"
                          className="p-button-text p-button-sm"
                          onClick={() =>
                            setPage((p) =>
                              Math.min(totalPages - 1, p + 1)
                            )
                          }
                          disabled={page >= totalPages - 1}
                        />
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ===== FILA 2: Resumen (izquierda) + Lista (derecha) ===== */}
      <div className={styles.coursesBottomRow}>
        {/* Resumen de cursos + donut */}
        <div className={styles.coursesBottomCol}>
          <div className={styles.panel}>
            <div className={styles.panelHeader}>Resumen de cursos</div>
            <div className={styles.panelBody}>
              <div className={styles.coursesKpis}>
                <div className={styles.coursesKpiCard}>
                  <div className={styles.coursesKpiLabel}>Cursos totales</div>
                  <div className={styles.coursesKpiValue}>{totalCursos}</div>
                </div>
                <div className={styles.coursesKpiCard}>
                  <div className={styles.coursesKpiLabel}>Cursos activos</div>
                  <div className={styles.coursesKpiValue}>{cursosActivos}</div>
                </div>
                <div className={styles.coursesKpiCard}>
                  <div className={styles.coursesKpiLabel}>
                    Afiliados aprobados
                  </div>
                  <div className={styles.coursesKpiValue}>
                    {totalAprobados}
                  </div>
                </div>
              </div>

              <div className={styles.coursesDonutWrapper}>
                {loading ? (
                  <div
                    style={{
                      textAlign: "center",
                      paddingTop: "1.5rem",
                    }}
                  >
                    <ProgressSpinner
                      style={{ width: "30px", height: "30px" }}
                      strokeWidth="4"
                    />
                  </div>
                ) : totalCursos === 0 ? (
                  <p className={styles.mapEmpty}>
                    No hay cursos para calcular la distribución.
                  </p>
                ) : (
                  <Chart
                    type="doughnut"
                    data={donutData}
                    options={donutOptions}
                  />
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Lista de cursos con estado (color) + aprobados */}
        <div className={styles.coursesBottomCol}>
          <div className={styles.panel}>
            <div className={styles.panelHeader}>Detalle de cursos</div>
            <div className={styles.panelBody}>
              {loading ? (
                <div
                  style={{
                    textAlign: "center",
                    paddingTop: "1.5rem",
                    paddingBottom: "1rem",
                  }}
                >
                  <ProgressSpinner
                    style={{ width: "30px", height: "30px" }}
                    strokeWidth="4"
                  />
                </div>
              ) : cursos.length === 0 ? (
                <p className={styles.mapEmpty}>
                  No hay cursos para mostrar en este período.
                </p>
              ) : (
                <div
                  style={{
                    maxHeight: "280px",
                    overflowY: "auto",
                    paddingRight: "0.25rem",
                  }}
                >
                  {cursos.map((c) => {
                    const meta = getStatusMeta(c.estado);
                    return (
                      <div
                        key={c.id}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          padding: "0.55rem 0.75rem",
                          marginBottom: "0.4rem",
                          borderRadius: "8px",
                          backgroundColor: "#fafafa",
                          borderLeft: `4px solid ${meta.border}`,
                          boxShadow: "0 1px 1px rgba(0,0,0,0.03)",
                          gap: "0.5rem",
                        }}
                      >
                        {/* Título + año */}
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div
                            style={{
                              fontWeight: 600,
                              fontSize: "0.95rem",
                              whiteSpace: "nowrap",
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                            }}
                          >
                            {c.titulo}
                          </div>
                          {c.year && (
                            <div
                              style={{
                                fontSize: "0.8rem",
                                color: "#6b7280",
                                marginTop: "0.1rem",
                              }}
                            >
                              Año {c.year}
                            </div>
                          )}
                        </div>

                        {/* Chip de estado: verde (activo) / rojo (finalizado) */}
                        <div style={{ marginRight: "0.5rem" }}>
                          <span
                            style={{
                              padding: "0.15rem 0.55rem",
                              borderRadius: "999px",
                              fontSize: "0.75rem",
                              backgroundColor: meta.bg,
                              color: meta.text,
                              border: `1px solid ${meta.border}`,
                              textTransform: "capitalize",
                              whiteSpace: "nowrap",
                            }}
                          >
                            {meta.label}
                          </span>
                        </div>

                        {/* Aprobados */}
                        <div
                          style={{
                            minWidth: "70px",
                            textAlign: "right",
                          }}
                        >
                          <div
                            style={{
                              fontWeight: 700,
                              fontSize: "0.95rem",
                            }}
                          >
                            {c.aprobados || 0}
                          </div>
                          <div
                            style={{
                              fontSize: "0.75rem",
                              color: "#6b7280",
                            }}
                          >
                            aprobados
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

