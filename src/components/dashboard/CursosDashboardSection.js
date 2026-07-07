// src/components/dashboard/CursosDashboardSection.js
import React, { useEffect, useMemo, useState } from "react";
import { ProgressSpinner } from "primereact/progressspinner";
import { Chart } from "primereact/chart";
import { collection, getDocs, collectionGroup, query, where } from "firebase/firestore";
import { db } from "../../firebase/firebase-config";
import styles from "../../pages/Admin/AfiliadosDashboard/afiliadosDashboard.module.css";
import cursoStyles from "./CursosDashboardSection.module.css";

const COURSE_PATH_PREFIX = "cursos/";

const getCourseYear = (data) =>
  data.anio || data.año || data.anioCurso || data.anioDictado || data.anioCohorte || null;

const normalizeYear = (value) => {
  if (!value) return null;
  const n = Number(String(value).slice(0, 4));
  return Number.isNaN(n) ? null : String(n);
};

const isFinishedStatus = (estado) => {
  const s = String(estado || "").toLowerCase();
  return s.includes("terminado") || s.includes("finalizado") || s.includes("cerrado");
};

const isActiveStatus = (estado) => {
  const s = String(estado || "").toLowerCase();
  if (!s || isFinishedStatus(estado)) return false;
  return (
    s.includes("inscripcion abierta") ||
    s.includes("inscripción abierta") ||
    s.includes("inscripcion_abierta") ||
    s.includes("en curso") ||
    s.includes("activo")
  );
};

const getStatusMeta = (estado) => {
  if (isFinishedStatus(estado))
    return { label: estado || "Finalizado", tipo: "finished" };
  if (isActiveStatus(estado))
    return { label: estado || "Activo", tipo: "active" };
  return { label: estado || "Sin estado", tipo: "neutral" };
};

const limpiarEstadoLabel = (estado) => {
  const s = String(estado || "").toLowerCase();
  if (s === "inscripcion_abierta" || s === "inscripcion abierta") return "Inscripción abierta";
  if (s === "terminado") return "Terminado";
  if (s === "finalizado") return "Finalizado";
  if (s === "en curso") return "En curso";
  if (s === "activo") return "Activo";
  return estado || "Sin estado";
};

export default function CursosDashboardSection({ year }) {
  const [cursos, setCursos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filtro, setFiltro] = useState("todos");

  useEffect(() => {
    let cancelled = false;

    const fetchCursos = async () => {
      setLoading(true);
      setError("");

      try {
        const cursosSnap = await getDocs(collection(db, "cursos"));
        const cursosMap = new Map();
        const yearFilter = year ? normalizeYear(year) : null;

        cursosSnap.forEach((docSnap) => {
          const data = docSnap.data() || {};
          const id = docSnap.id;
          const titulo = data.titulo || "Curso sin título";
          const estado = data.estado || "";
          const courseYear = normalizeYear(getCourseYear(data));

          if (yearFilter && courseYear && courseYear !== yearFilter) return;

          cursosMap.set(`${COURSE_PATH_PREFIX}${id}`, {
            id,
            titulo,
            estado,
            categoria: data.categoria || "",
            aprobados: 0,
            year: courseYear,
          });
        });

        if (cursosMap.size === 0) {
          if (!cancelled) { setCursos([]); }
          return;
        }

        const cgSnap = await getDocs(
          query(collectionGroup(db, "cursos"), where("aprobo", "==", true))
        );

        cgSnap.forEach((docSnap) => {
          const d = docSnap.data() || {};
          const cursoPath = d.curso;
          if (!cursoPath || typeof cursoPath !== "string") return;
          const entry = cursosMap.get(cursoPath);
          if (!entry) return;
          entry.aprobados = (entry.aprobados || 0) + 1;
        });

        const arr = Array.from(cursosMap.values()).sort((a, b) =>
          a.titulo.localeCompare(b.titulo, "es", { sensitivity: "base" })
        );

        if (!cancelled) { setCursos(arr); }
      } catch (err) {
        console.error("[CursosDashboardSection] Error:", err);
        if (!cancelled) { setError("No se pudo cargar la información de cursos."); }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    fetchCursos();
    return () => { cancelled = true; };
  }, [year]);

  const { totalCursos, cursosActivos, cursosFinalizados, totalAprobados, maxAprobados } = useMemo(() => {
    const totalCursos = cursos.length;
    const cursosActivos = cursos.filter((c) => isActiveStatus(c.estado)).length;
    const cursosFinalizados = cursos.filter((c) => isFinishedStatus(c.estado)).length;
    const totalAprobados = cursos.reduce((acc, c) => acc + (c.aprobados || 0), 0);
    const maxAprobados = Math.max(...cursos.map((c) => c.aprobados || 0), 1);
    return { totalCursos, cursosActivos, cursosFinalizados, totalAprobados, maxAprobados };
  }, [cursos]);

  const cursosFiltrados = useMemo(() => {
    if (filtro === "activos") return cursos.filter((c) => isActiveStatus(c.estado));
    if (filtro === "finalizados") return cursos.filter((c) => isFinishedStatus(c.estado));
    return cursos;
  }, [cursos, filtro]);

  const donutData = useMemo(() => ({
    labels: ["Activos", "Finalizados", "Sin estado"],
    datasets: [{
      data: [
        cursosActivos,
        cursosFinalizados,
        Math.max(totalCursos - cursosActivos - cursosFinalizados, 0),
      ],
      backgroundColor: ["#43a047", "#e53935", "#90a4ae"],
      borderWidth: 0,
    }],
  }), [cursosActivos, cursosFinalizados, totalCursos]);

  const donutOptions = useMemo(() => ({
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        callbacks: {
          label: (ctx) => ` ${ctx.label}: ${ctx.parsed}`,
        },
      },
    },
    cutout: "68%",
  }), []);

  return (
    <div className={cursoStyles.root}>

      {/* ── KPIs superiores ── */}
      <div className={cursoStyles.kpiRow}>
        <div className={cursoStyles.kpiCard}>
          <span className={cursoStyles.kpiVal}>{totalCursos}</span>
          <span className={cursoStyles.kpiLbl}>Cursos totales</span>
        </div>
        <div className={`${cursoStyles.kpiCard} ${cursoStyles.kpiCardGreen}`}>
          <span className={cursoStyles.kpiVal}>{cursosActivos}</span>
          <span className={cursoStyles.kpiLbl}>Activos</span>
        </div>
        <div className={`${cursoStyles.kpiCard} ${cursoStyles.kpiCardRed}`}>
          <span className={cursoStyles.kpiVal}>{cursosFinalizados}</span>
          <span className={cursoStyles.kpiLbl}>Finalizados</span>
        </div>
        <div className={`${cursoStyles.kpiCard} ${cursoStyles.kpiCardBlue}`}>
          <span className={cursoStyles.kpiVal}>{totalAprobados}</span>
          <span className={cursoStyles.kpiLbl}>Afiliados aprobados</span>
        </div>
      </div>

      {/* ── Layout principal: tabla + sidebar ── */}
      <div className={cursoStyles.layout}>

        {/* Tabla */}
        <div className={`${styles.panel} ${cursoStyles.tablePanel}`}>
          <div className={cursoStyles.tableHeader}>
            <span className={styles.panelHeader} style={{ margin: 0 }}>Todos los cursos</span>
            <div className={cursoStyles.filtroTabs}>
              {[
                { key: "todos", label: "Todos" },
                { key: "activos", label: "Activos" },
                { key: "finalizados", label: "Finalizados" },
              ].map(({ key, label }) => (
                <button
                  key={key}
                  className={`${cursoStyles.filtroTab} ${filtro === key ? cursoStyles.filtroTabActive : ""}`}
                  onClick={() => setFiltro(key)}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {loading ? (
            <div className={cursoStyles.loadingBox}>
              <ProgressSpinner style={{ width: "36px", height: "36px" }} strokeWidth="4" />
              <span>Cargando cursos...</span>
            </div>
          ) : error ? (
            <p className={styles.errorText}>{error}</p>
          ) : cursosFiltrados.length === 0 ? (
            <div className={cursoStyles.emptyBox}>
              No hay cursos para mostrar.
            </div>
          ) : (
            <div className={cursoStyles.tableScroll}>
              <table className={cursoStyles.table}>
                <thead>
                  <tr>
                    <th style={{ width: "44%" }}>Título</th>
                    <th style={{ width: "20%" }}>Estado</th>
                    <th style={{ width: "36%" }}>Aprobados</th>
                  </tr>
                </thead>
                <tbody>
                  {cursosFiltrados.map((c) => {
                    const meta = getStatusMeta(c.estado);
                    const pct = Math.round(((c.aprobados || 0) / maxAprobados) * 100);
                    return (
                      <tr key={c.id}>
                        <td>
                          <span className={cursoStyles.cursoTitulo}>{c.titulo}</span>
                          {c.categoria && (
                            <span className={cursoStyles.cursoCategoria}>{c.categoria}</span>
                          )}
                        </td>
                        <td>
                          <span className={`${cursoStyles.chip} ${cursoStyles[`chip_${meta.tipo}`]}`}>
                            {limpiarEstadoLabel(meta.label)}
                          </span>
                        </td>
                        <td>
                          <div className={cursoStyles.barRow}>
                            <span className={cursoStyles.barNum}>{c.aprobados || 0}</span>
                            <div className={cursoStyles.barTrack}>
                              <div
                                className={`${cursoStyles.barFill} ${meta.tipo === "active" ? cursoStyles.barFillGreen : meta.tipo === "finished" ? cursoStyles.barFillRed : cursoStyles.barFillGray}`}
                                style={{ width: `${pct}%` }}
                              />
                            </div>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Sidebar */}
        <div className={`${styles.panel} ${cursoStyles.sidebar}`}>
          <span className={styles.panelHeader}>Distribución</span>

          {loading ? (
            <div className={cursoStyles.loadingBox}>
              <ProgressSpinner style={{ width: "28px", height: "28px" }} strokeWidth="4" />
            </div>
          ) : totalCursos === 0 ? (
            <p className={styles.errorText}>Sin datos.</p>
          ) : (
            <>
              <div className={cursoStyles.donutWrapper}>
                <Chart type="doughnut" data={donutData} options={donutOptions} />
              </div>

              <div className={cursoStyles.sidebarDivider} />

              <div className={cursoStyles.sidebarStats}>
                <div className={cursoStyles.sidebarStat}>
                  <span className={cursoStyles.sidebarDot} style={{ background: "#43a047" }} />
                  <div>
                    <div className={cursoStyles.sidebarStatVal}>{cursosActivos}</div>
                    <div className={cursoStyles.sidebarStatLbl}>Activos</div>
                  </div>
                </div>
                <div className={cursoStyles.sidebarStat}>
                  <span className={cursoStyles.sidebarDot} style={{ background: "#e53935" }} />
                  <div>
                    <div className={cursoStyles.sidebarStatVal}>{cursosFinalizados}</div>
                    <div className={cursoStyles.sidebarStatLbl}>Finalizados</div>
                  </div>
                </div>
                <div className={cursoStyles.sidebarStat}>
                  <span className={cursoStyles.sidebarDot} style={{ background: "#90a4ae" }} />
                  <div>
                    <div className={cursoStyles.sidebarStatVal}>
                      {Math.max(totalCursos - cursosActivos - cursosFinalizados, 0)}
                    </div>
                    <div className={cursoStyles.sidebarStatLbl}>Sin estado</div>
                  </div>
                </div>
              </div>

              <div className={cursoStyles.sidebarDivider} />

              <div className={cursoStyles.sidebarTop}>
                <div className={cursoStyles.sidebarTopTitle}>Más aprobados</div>
                {cursos
                  .filter((c) => c.aprobados > 0)
                  .sort((a, b) => b.aprobados - a.aprobados)
                  .slice(0, 3)
                  .map((c, i) => (
                    <div key={c.id} className={cursoStyles.sidebarTopItem}>
                      <span className={cursoStyles.sidebarTopRank}>{i + 1}</span>
                      <span className={cursoStyles.sidebarTopNombre}>{c.titulo}</span>
                      <span className={cursoStyles.sidebarTopNum}>{c.aprobados}</span>
                    </div>
                  ))}
                {cursos.filter((c) => c.aprobados > 0).length === 0 && (
                  <p style={{ fontSize: "0.82rem", color: "#94a3b8", marginTop: "0.5rem" }}>
                    Sin aprobados registrados.
                  </p>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
