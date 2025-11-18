// src/components/dashboard/RegistroAsistencia.js
import React, { useEffect, useMemo, useState } from "react";
import { collection, getDocs } from "firebase/firestore";
import { ProgressSpinner } from "primereact/progressspinner";
import { DataTable } from "primereact/datatable";
import { Column } from "primereact/column";
import { Chart } from "primereact/chart";
import { db } from "../../firebase/firebase-config";
import styles from "../../pages/Admin/AfiliadosDashboard/afiliadosDashboard.module.css";

/* ========= Helpers ========= */

const getCursoFromDoc = (d) =>
  d.curso || d.nombreCurso || d.tituloCurso || "";

const getNivelFromDoc = (d) =>
  d.nivelEducativo || d.nivel || d.nivel_educativo || "";

const getModalidadFromDoc = (d) => {
  if (d.modalidad) return d.modalidad;
  if (typeof d.presencial === "boolean") {
    return d.presencial ? "presencial" : "virtual";
  }
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
  if (typeof value === "string") {
    return value.split(" ")[0]; // "14/11/2025 9:41" -> "14/11/2025"
  }
  if (value instanceof Date) {
    return value.toLocaleDateString("es-AR");
  }
  if (value && typeof value.toDate === "function") {
    return value.toDate().toLocaleDateString("es-AR");
  }
  return "";
};

const getYearFromFecha = (value) => {
  if (!value) return null;
  if (value instanceof Date) return String(value.getFullYear());
  if (value && typeof value.toDate === "function") {
    return String(value.toDate().getFullYear());
  }
  if (typeof value === "string") {
    const match = value.match(/(\d{4})/);
    return match ? match[1] : null;
  }
  return null;
};

/* ========= Componente ========= */

export default function RegistroAsistencia({ year }) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

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

          const rawFecha = getFechaRawFromDoc(d);
          const fechaYear = getYearFromFecha(rawFecha);
          if (yearFilter && fechaYear && fechaYear !== yearFilter) return;

          const fechaLabel = formatFechaLabel(rawFecha);
          const nivel = getNivelFromDoc(d) || "—";
          const modalidad = normalizeModalidad(getModalidadFromDoc(d));

          const key = `${curso}||${nivel}||${fechaLabel}||${modalidad}`;

          const current =
            grouped.get(key) || {
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
          return a.curso.localeCompare(b.curso, "es", {
            sensitivity: "base",
          });
        });

        if (!cancelled) setRows(rowsArray);
      } catch (err) {
        console.error("[RegistroAsistencia] Error al cargar asistencia:", err);
        if (!cancelled) {
          setError("No se pudo cargar el registro de asistencia.");
          setRows([]);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    fetchAsistencia();
    return () => {
      cancelled = true;
    };
  }, [year]);

  /* ==== KPIs ==== */
  const { totalRegistros, cursosConAsistencia, totalSesiones } = useMemo(() => {
    if (!rows.length) {
      return { totalRegistros: 0, cursosConAsistencia: 0, totalSesiones: 0 };
    }
    const totalRegistros = rows.reduce((acc, r) => acc + r.registros, 0);
    const cursosSet = new Set(rows.map((r) => r.curso));
    const cursosConAsistencia = cursosSet.size;
    const totalSesiones = rows.length;
    return { totalRegistros, cursosConAsistencia, totalSesiones };
  }, [rows]);

  /* ==== Gráfico barras: registros por curso ==== */
  const barData = useMemo(() => {
    if (!rows.length) return null;

    const byCourse = new Map();
    rows.forEach((r) => {
      byCourse.set(r.curso, (byCourse.get(r.curso) || 0) + r.registros);
    });

    return {
      labels: Array.from(byCourse.keys()),
      datasets: [
        {
          label: "Registros de asistencia",
          data: Array.from(byCourse.values()),
          backgroundColor: "#90caf9",
        },
      ],
    };
  }, [rows]);

  const barOptions = useMemo(
    () => ({
      indexAxis: "y",
      maintainAspectRatio: false,
      plugins: {
        legend: { labels: { color: "#495057" } },
        tooltip: {
          callbacks: {
            label: (ctx) => `${ctx.parsed.x} registros de asistencia`,
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

  /* ==== Gráfico DONA: registros por modalidad ==== */
  const donutModalData = useMemo(() => {
    if (!rows.length) return null;

    const counts = rows.reduce((acc, r) => {
      const key = r.modalidad || "sin dato";
      acc[key] = (acc[key] || 0) + r.registros;
      return acc;
    }, {});

    return {
      labels: Object.keys(counts),
      datasets: [
        {
          data: Object.values(counts),
          backgroundColor: ["#43a047", "#e53935", "#ffb300", "#546e7a"],
        },
      ],
    };
  }, [rows]);

  const donutModalOptions = useMemo(
    () => ({
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: "bottom",
          labels: { color: "#495057" },
        },
        tooltip: {
          callbacks: {
            label: (ctx) =>
              `${ctx.label}: ${ctx.parsed} registros de asistencia`,
          },
        },
      },
      cutout: "65%",
    }),
    []
  );

  return (
    <div className={styles.asistenciaRow}>
      <div className={styles.panel}>
        <div className={styles.panelHeader}>Registro de asistencia por curso</div>
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
          ) : rows.length === 0 ? (
            <p className={styles.mapEmpty}>
              No hay registros de asistencia para mostrar en este período.
            </p>
          ) : (
            <>
              {/* KPIs */}
              <div className={styles.asistenciaKpis}>
                <div className={styles.asistenciaKpiCard}>
                  <div className={styles.asistenciaKpiLabel}>
                    Registros de asistencia
                  </div>
                  <div className={styles.asistenciaKpiValue}>
                    {totalRegistros}
                  </div>
                </div>
                <div className={styles.asistenciaKpiCard}>
                  <div className={styles.asistenciaKpiLabel}>
                    Cursos con asistencia
                  </div>
                  <div className={styles.asistenciaKpiValue}>
                    {cursosConAsistencia}
                  </div>
                </div>
                <div className={styles.asistenciaKpiCard}>
                  <div className={styles.asistenciaKpiLabel}>
                    Sesiones (curso / nivel / fecha / modalidad)
                  </div>
                  <div className={styles.asistenciaKpiValue}>
                    {totalSesiones}
                  </div>
                </div>
              </div>

              {/* Fila de gráficos: barras + dona */}
              {barData && (
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "minmax(0, 2fr) minmax(0, 1fr)",
                    gap: "1rem",
                    margin: "0.75rem 0",
                  }}
                >
                  <div style={{ height: "280px" }}>
                    <Chart
                      type="bar"
                      data={barData}
                      options={barOptions}
                    />
                  </div>

                  {donutModalData && (
                    <div style={{ height: "280px" }}>
                      <Chart
                        type="doughnut"
                        data={donutModalData}
                        options={donutModalOptions}
                      />
                    </div>
                  )}
                </div>
              )}

              {/* Tabla detalle */}
              <div className={styles.tableWrapper}>
                <DataTable
                  value={rows}
                  size="small"
                  stripedRows
                  scrollable
                  scrollHeight="260px"
                >
                  <Column field="curso" header="Curso" />
                  <Column field="nivel" header="Nivel educativo" />
                  <Column field="fecha" header="Fecha" />
                  <Column field="modalidad" header="Modalidad" />
                  <Column field="registros" header="Registros" />
                </DataTable>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

