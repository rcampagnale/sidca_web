// src/components/dashboard/CursosDashboardSection.js
import React, { useEffect, useMemo, useState } from "react";
import { ProgressSpinner } from "primereact/progressspinner";
import { Chart } from "primereact/chart";
import { DataTable } from "primereact/datatable";
import { Column } from "primereact/column";
import { collection, getDocs, collectionGroup, query, where } from "firebase/firestore";
import { db } from "../../firebase/firebase-config";
import styles from "../../pages/Admin/AfiliadosDashboard/afiliadosDashboard.module.css";

const COURSE_PATH_PREFIX = "cursos/";

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

/**
 * Dashboard de cursos:
 * - Lee los metadatos de la colección raíz "cursos"
 * - Cuenta aprobados desde todas las subcolecciones "cursos" de /usuarios/{dni}/cursos
 *   usando collectionGroup (solo documentos con aprobo === true)
 * - Muestra:
 *    • Gráfico de barras: afiliados aprobados por curso
 *    • Resumen + donut global
 *    • Tabla con cursos, aprobados y estado
 */
export default function CursosDashboardSection({ year }) {
  const [cursos, setCursos] = useState([]); // [{id, titulo, estado, aprobados}]
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

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
          const cursoPath = d.curso; // ej: "cursos/IDDEL CURSO"
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
        }
      } catch (err) {
        console.error("[CursosDashboardSection] Error al cargar cursos:", err);
        if (!cancelled) {
          setError("No se pudo cargar la información de cursos.");
          setCursos([]);
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
    const cursosActivos = cursos.filter((c) => {
      const est = String(c.estado || "").toLowerCase();
      return (
        est === "terminado" ||
        est === "inscripcion abierta" ||
        est === "inscripción abierta"
      );
    }).length;
    const totalAprobados = cursos.reduce(
      (acc, c) => acc + (c.aprobados || 0),
      0
    );
    return { totalCursos, cursosActivos, totalAprobados };
  }, [cursos]);

  // ===== Gráfico de barras: aprobados por curso =====
  const barData = useMemo(
    () => ({
      labels: cursos.map((c) => c.titulo),
      datasets: [
        {
          label: "Aprobados",
          data: cursos.map((c) => c.aprobados || 0),
          backgroundColor: "#90caf9",
        },
      ],
    }),
    [cursos]
  );

  const barOptions = useMemo(
    () => ({
      indexAxis: "y",
      maintainAspectRatio: false,
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
            // cortar títulos largos con "…" (usamos this.getLabelForValue)
            callback: function (value) {
              const label =
                (this.getLabelForValue &&
                  this.getLabelForValue(value)) ||
                "";
              if (typeof label !== "string") return label;
              return label.length > 40
                ? `${label.slice(0, 40)}…`
                : label;
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
          backgroundColor: ["#43a047", "#e53935"],
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
            <div className={styles.panelHeader}>Afiliados aprobados por curso</div>
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
                <div style={{ height: "320px" }}>
                  <Chart type="bar" data={barData} options={barOptions} />
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ===== FILA 2: Resumen (izquierda) + Tabla (derecha) ===== */}
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
                  <div className={styles.coursesKpiValue}>{totalAprobados}</div>
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
                  <Chart type="doughnut" data={donutData} options={donutOptions} />
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Tabla de cursos */}
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
                <div className={styles.tableWrapper}>
                  <DataTable
                    value={cursos}
                    size="small"
                    stripedRows
                    scrollable
                    scrollHeight="260px"
                  >
                    <Column field="titulo" header="Curso" />
                    <Column field="aprobados" header="Aprobados" />
                    <Column field="estado" header="Estado" />
                  </DataTable>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}



