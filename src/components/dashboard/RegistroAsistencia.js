// src/components/dashboard/RegistroAsistencia.js
import React, { useEffect, useMemo, useState } from "react";
import { collection, getDocs } from "firebase/firestore";
import { ProgressSpinner } from "primereact/progressspinner";
import { Chart } from "primereact/chart";
import { db } from "../../firebase/firebase-config";
import styles from "../../pages/Admin/AfiliadosDashboard/afiliadosDashboard.module.css";
import asst from "./RegistroAsistencia.module.css";

/* ── Helpers ── */

const getCursoFromDoc = (d) => d.curso || d.nombreCurso || d.tituloCurso || "";
const getNivelFromDoc = (d) => d.nivelEducativo || d.nivel || d.nivel_educativo || "";

const getModalidadFromDoc = (d) => {
  if (d.modalidad) return d.modalidad;
  if (typeof d.presencial === "boolean") return d.presencial ? "presencial" : "virtual";
  return "";
};

const normalizeModalidad = (value) => {
  const s = String(value || "").toLowerCase().trim();
  if (!s) return "sin dato";
  if (s.startsWith("virt")) return "virtual";
  if (s.startsWith("presen")) return "presencial";
  return s;
};

const getFechaRawFromDoc = (d) =>
  d.fecha || d.fechaAsistencia || d.fechaRegistro || d.fechaServer || null;

const formatFechaLabel = (value) => {
  if (!value) return "";
  if (typeof value === "string") return value.split(" ")[0];
  if (value instanceof Date) return value.toLocaleDateString("es-AR");
  if (value && typeof value.toDate === "function") return value.toDate().toLocaleDateString("es-AR");
  return "";
};

const getYearFromFecha = (value) => {
  if (!value) return null;
  if (value instanceof Date) return String(value.getFullYear());
  if (value && typeof value.toDate === "function") return String(value.toDate().getFullYear());
  if (typeof value === "string") {
    const match = value.match(/(\d{4})/);
    return match ? match[1] : null;
  }
  return null;
};

/* ── Constantes de color ── */
const COLOR_PRESENCIAL = "#1976d2";
const COLOR_VIRTUAL    = "#43a047";
const COLOR_OTRO       = "#90a4ae";

const modalidadColor = (m) => {
  if (!m) return COLOR_OTRO;
  const s = m.toLowerCase();
  if (s.startsWith("presen")) return COLOR_PRESENCIAL;
  if (s.startsWith("virt"))   return COLOR_VIRTUAL;
  return COLOR_OTRO;
};

/* ── Componente ── */

export default function RegistroAsistencia({ year }) {
  const [rows, setRows]       = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState("");
  const [expandido, setExpandido] = useState(null); // nombre del curso expandido

  useEffect(() => {
    let cancelled = false;

    const fetchAsistencia = async () => {
      setLoading(true);
      setError("");
      try {
        const snap = await getDocs(collection(db, "asistencia"));
        if (cancelled) return;

        const grouped = new Map();
        const yearFilter = year ? String(year) : null;

        snap.forEach((docSnap) => {
          const d = docSnap.data() || {};
          const curso = getCursoFromDoc(d);
          if (!curso) return;

          const rawFecha  = getFechaRawFromDoc(d);
          const fechaYear = getYearFromFecha(rawFecha);
          if (yearFilter && fechaYear && fechaYear !== yearFilter) return;

          const fechaLabel = formatFechaLabel(rawFecha);
          const nivel      = getNivelFromDoc(d) || "—";
          const modalidad  = normalizeModalidad(getModalidadFromDoc(d));
          const key        = `${curso}||${nivel}||${fechaLabel}||${modalidad}`;

          const current = grouped.get(key) || {
            curso,
            nivel,
            fecha: fechaLabel || "—",
            modalidad,
            registros: 0,
          };
          current.registros += 1;
          grouped.set(key, current);
        });

        const rowsArray = Array.from(grouped.values()).sort((a, b) => {
          if (a.fecha !== b.fecha) return a.fecha < b.fecha ? 1 : -1;
          return a.curso.localeCompare(b.curso, "es", { sensitivity: "base" });
        });

        if (!cancelled) setRows(rowsArray);
      } catch (err) {
        console.error("[RegistroAsistencia] Error:", err);
        if (!cancelled) { setError("No se pudo cargar el registro de asistencia."); setRows([]); }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    fetchAsistencia();
    return () => { cancelled = true; };
  }, [year]);

  /* ── Cursos agrupados ── */
  const cursoMap = useMemo(() => {
    const map = new Map();
    rows.forEach((r) => {
      if (!map.has(r.curso)) map.set(r.curso, []);
      map.get(r.curso).push(r);
    });
    // ordenar cursos por total registros desc
    return new Map(
      [...map.entries()].sort((a, b) => {
        const totA = a[1].reduce((s, r) => s + r.registros, 0);
        const totB = b[1].reduce((s, r) => s + r.registros, 0);
        return totB - totA;
      })
    );
  }, [rows]);

  const cursoList = useMemo(() => [...cursoMap.keys()], [cursoMap]);

  /* ── KPIs ── */
  const { totalRegistros, cursosConAsistencia, totalSesiones } = useMemo(() => ({
    totalRegistros:    rows.reduce((acc, r) => acc + r.registros, 0),
    cursosConAsistencia: new Set(rows.map((r) => r.curso)).size,
    totalSesiones:     rows.length,
  }), [rows]);

  /* ── Donut: data según selección ── */
  const donutSource = useMemo(() => {
    if (expandido && cursoMap.has(expandido)) return cursoMap.get(expandido);
    return rows;
  }, [expandido, cursoMap, rows]);

  const donutData = useMemo(() => {
    if (!donutSource.length) return null;
    const counts = {};
    donutSource.forEach((r) => {
      const key = r.modalidad || "sin dato";
      counts[key] = (counts[key] || 0) + r.registros;
    });
    const labels = Object.keys(counts);
    return {
      labels,
      datasets: [{
        data: Object.values(counts),
        backgroundColor: labels.map(modalidadColor),
        borderWidth: 0,
      }],
    };
  }, [donutSource]);

  const donutOptions = useMemo(() => ({
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        callbacks: { label: (ctx) => ` ${ctx.label}: ${ctx.parsed}` },
      },
    },
    cutout: "68%",
  }), []);

  /* ── Stats de donut ── */
  const donutStats = useMemo(() => {
    if (!donutSource.length) return [];
    const counts = {};
    const total = donutSource.reduce((s, r) => s + r.registros, 0);
    donutSource.forEach((r) => {
      const key = r.modalidad || "sin dato";
      counts[key] = (counts[key] || 0) + r.registros;
    });
    return Object.entries(counts).map(([label, val]) => ({
      label,
      val,
      pct: total ? Math.round((val / total) * 100) : 0,
      color: modalidadColor(label),
    }));
  }, [donutSource]);

  const toggle = (curso) => setExpandido((prev) => (prev === curso ? null : curso));

  return (
    <div className={asst.root}>

      {/* ── KPIs ── */}
      <div className={asst.kpiRow}>
        <div className={asst.kpiCard}>
          <span className={asst.kpiVal}>{loading ? "—" : totalRegistros}</span>
          <span className={asst.kpiLbl}>Registros totales</span>
        </div>
        <div className={`${asst.kpiCard} ${asst.kpiBlue}`}>
          <span className={asst.kpiVal}>{loading ? "—" : cursosConAsistencia}</span>
          <span className={asst.kpiLbl}>Cursos con asistencia</span>
        </div>
        <div className={`${asst.kpiCard} ${asst.kpiGreen}`}>
          <span className={asst.kpiVal}>{loading ? "—" : totalSesiones}</span>
          <span className={asst.kpiLbl}>Sesiones registradas</span>
        </div>
      </div>

      {loading ? (
        <div className={asst.loadingBox}>
          <ProgressSpinner style={{ width: "38px", height: "38px" }} strokeWidth="4" />
          <span>Cargando asistencia...</span>
        </div>
      ) : error ? (
        <p className={styles.errorText}>{error}</p>
      ) : rows.length === 0 ? (
        <p className={styles.mapEmpty}>No hay registros de asistencia para mostrar en este período.</p>
      ) : (
        <div className={asst.layout}>

          {/* ── Acordeón de cursos ── */}
          <div className={asst.acordeon}>
            {cursoList.map((curso) => {
              const sesiones = cursoMap.get(curso) || [];
              const total    = sesiones.reduce((s, r) => s + r.registros, 0);
              const abierto  = expandido === curso;

              return (
                <div key={curso} className={`${asst.cursoItem} ${abierto ? asst.cursoItemAbierto : ""}`}>
                  <button
                    className={asst.cursoHead}
                    onClick={() => toggle(curso)}
                    aria-expanded={abierto}
                  >
                    <span className={asst.cursoDot} style={{ background: abierto ? COLOR_PRESENCIAL : "#94a3b8" }} />
                    <span className={asst.cursoNombre}>{curso}</span>
                    <span className={asst.cursoTotal}>{total} reg.</span>
                    <i className={`pi ${abierto ? "pi-chevron-up" : "pi-chevron-down"} ${asst.cursoChevron}`} />
                  </button>

                  {abierto && (
                    <div className={asst.sesionesLista}>
                      {sesiones
                        .sort((a, b) => (a.fecha < b.fecha ? 1 : -1))
                        .map((s, i) => (
                          <div key={i} className={asst.sesionRow}>
                            <span className={asst.sesionFecha}>{s.fecha}</span>
                            <span
                              className={asst.sesionChip}
                              style={{
                                background: s.modalidad.startsWith("presen") ? "#e3f2fd" : "#e8f5e9",
                                color:      s.modalidad.startsWith("presen") ? "#1565c0" : "#2e7d32",
                              }}
                            >
                              {s.modalidad}
                            </span>
                            <span className={asst.sesionNivel}>{s.nivel}</span>
                            <span className={asst.sesionReg}>{s.registros}</span>
                          </div>
                        ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* ── Sidebar: donut + stats ── */}
          <div className={asst.sidebar}>
            <div className={asst.sidebarTitle}>
              {expandido ? expandido : "Todos los cursos"}
            </div>
            <div className={asst.sidebarSub}>Distribución por modalidad</div>

            {donutData ? (
              <>
                <div className={asst.donutWrapper}>
                  <Chart
                    type="doughnut"
                    data={donutData}
                    options={donutOptions}
                    style={{ width: "110px", height: "110px" }}
                  />
                </div>
                <div className={asst.statsList}>
                  {donutStats.map((s) => (
                    <div key={s.label} className={asst.statRow}>
                      <span className={asst.statDot} style={{ background: s.color }} />
                      <div className={asst.statInfo}>
                        <span className={asst.statLabel}>{s.label}</span>
                        <span className={asst.statNumbers}>
                          <b>{s.pct}%</b> · {s.val}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
                {expandido && (
                  <button className={asst.resetBtn} onClick={() => setExpandido(null)}>
                    <i className="pi pi-times" /> Ver total general
                  </button>
                )}
              </>
            ) : (
              <p className={asst.sidebarEmpty}>Sin datos</p>
            )}
          </div>

        </div>
      )}
    </div>
  );
}
