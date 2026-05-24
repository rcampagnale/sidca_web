import React, { useEffect, useMemo, useState } from "react";
import { ProgressSpinner } from "primereact/progressspinner";
import { Chart } from "primereact/chart";
import { collection, getDocs } from "firebase/firestore";
import { db } from "../../firebase/firebase-config";
import styles from "../../pages/Admin/AfiliadosDashboard/afiliadosDashboard.module.css";

const MONTH_LABELS = [
  "Ene",
  "Feb",
  "Mar",
  "Abr",
  "May",
  "Jun",
  "Jul",
  "Ago",
  "Sep",
  "Oct",
  "Nov",
  "Dic",
];

/** Normaliza DNI a solo números */
const normalizeDni = (dniRaw) =>
  String(dniRaw || "")
    .replace(/[^\d]/g, "")
    .slice(0, 12);

/**
 * Intenta parsear una fecha desde varios formatos:
 * - Firestore Timestamp
 * - { seconds, nanoseconds }
 * - número en milisegundos
 * - string "DD/MM/YYYY HH:mm" o "DD-MM-YYYY HH:mm"
 * - string compatible con new Date()
 */
const parseDateFlexible = (value) => {
  if (!value) return null;

  if (value instanceof Date) {
    return isNaN(value.getTime()) ? null : value;
  }

  if (value && typeof value.toDate === "function") {
    const d = value.toDate();
    return isNaN(d.getTime()) ? null : d;
  }

  if (
    typeof value === "object" &&
    value !== null &&
    typeof value.seconds === "number"
  ) {
    const d = new Date(value.seconds * 1000);
    return isNaN(d.getTime()) ? null : d;
  }

  if (typeof value === "number") {
    const d = new Date(value);
    return isNaN(d.getTime()) ? null : d;
  }

  if (typeof value === "string") {
    const s = value.trim();
    if (!s) return null;

    const matchDMY = s.match(
      /(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})(?:\s+(\d{1,2}):(\d{2}))?/
    );

    if (matchDMY) {
      let [, dd, mm, yy, hh, min] = matchDMY;

      let year = parseInt(yy, 10);
      if (year < 100) year += 2000;

      const month = parseInt(mm, 10) - 1;
      const day = parseInt(dd, 10);
      const hour = hh ? parseInt(hh, 10) : 0;
      const minute = min ? parseInt(min, 10) : 0;

      const d = new Date(year, month, day, hour, minute);
      return isNaN(d.getTime()) ? null : d;
    }

    const d = new Date(s);
    return isNaN(d.getTime()) ? null : d;
  }

  return null;
};

/** Convierte una fecha a { year, month, key } */
const extractMonthInfo = (value) => {
  const date = parseDateFlexible(value);
  if (!date) return null;

  const year = date.getFullYear();
  const month = date.getMonth();
  const key = `${year}-${String(month + 1).padStart(2, "0")}`;

  return { year, month, key };
};

/** Fecha de alta desde nuevoAfiliado */
const getAltaDateFromNuevoAfiliado = (d) =>
  d.fechaServer || d.fecha || d.fechaAlta || d.fechaRegistro;

/** Fecha de baja desde usuarios */
const getBajaDateFromUsuario = (d) =>
  d.fechaBajaServer ||
  d.fechaBaja ||
  d.fecha_baja ||
  d.fechaDesafiliacion ||
  d.fechaServer ||
  d.fecha;

/** Crea las claves de los 12 meses del año elegido */
const buildMonthKeysForYear = (year) =>
  Array.from({ length: 12 }, (_, index) => {
    const month = String(index + 1).padStart(2, "0");
    return `${year}-${month}`;
  });

/**
 * 📊 Altas y bajas de afiliados por mes
 *
 * - Altas: SOLO documentos en "nuevoAfiliado"
 * - Bajas: SOLO documentos en "usuarios" con activo === false
 * - Evita duplicar el mismo DNI en el mismo mes
 * - Si no se pasa year, toma automáticamente el año actual
 */
export default function AltasBajasMensual({ year }) {
  const [currentYear, setCurrentYear] = useState(() =>
    new Date().getFullYear()
  );

  const [dataChart, setDataChart] = useState(null);
  const [kpis, setKpis] = useState({ totalAltas: 0, totalBajas: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  /**
   * Revisa cada hora si cambió el año.
   * Esto permite que la sección se actualice automáticamente
   * incluso si la pantalla queda abierta durante el cambio de año.
   */
  useEffect(() => {
    const interval = setInterval(() => {
      const nuevoAnio = new Date().getFullYear();
      setCurrentYear((prev) => (prev !== nuevoAnio ? nuevoAnio : prev));
    }, 60 * 60 * 1000);

    return () => clearInterval(interval);
  }, []);

  /**
   * Año efectivo:
   * - Si el padre manda year válido, se respeta.
   * - Si no manda nada, se usa automáticamente el año actual.
   */
  const effectiveYear = useMemo(() => {
    const parsedYear = Number(year);

    if (
      year !== undefined &&
      year !== null &&
      Number.isInteger(parsedYear) &&
      parsedYear >= 2000 &&
      parsedYear <= 2100
    ) {
      return parsedYear;
    }

    return currentYear;
  }, [year, currentYear]);

  useEffect(() => {
    let cancelled = false;

    const fetchMonthlyData = async () => {
      setLoading(true);
      setError("");

      try {
        const [usuariosSnap, nuevoSnap] = await Promise.all([
          getDocs(collection(db, "usuarios")),
          getDocs(collection(db, "nuevoAfiliado")),
        ]);

        const altasByMonth = new Map();
        const bajasByMonth = new Map();

        const seenAltas = new Set();
        const seenBajas = new Set();

        // ✅ ALTAS: documentos en nuevoAfiliado
        nuevoSnap.forEach((docSnap) => {
          const d = docSnap.data();

          const dni = normalizeDni(
            d.dni || d.DNI || d.documento || d.Documento
          );

          if (!dni) return;

          const rawDate = getAltaDateFromNuevoAfiliado(d);
          const info = extractMonthInfo(rawDate);

          if (!info) return;

          // Año automático
          if (info.year !== effectiveYear) return;

          const key = info.key;
          const tag = `${dni}-${key}`;

          if (seenAltas.has(tag)) return;

          seenAltas.add(tag);
          altasByMonth.set(key, (altasByMonth.get(key) || 0) + 1);
        });

        // ✅ BAJAS: usuarios con activo === false
        usuariosSnap.forEach((docSnap) => {
          const d = docSnap.data();

          if (d.activo !== false) return;

          const dni = normalizeDni(
            d.dni || d.DNI || d.documento || d.Documento
          );

          if (!dni) return;

          const rawDate = getBajaDateFromUsuario(d);
          const info = extractMonthInfo(rawDate);

          if (!info) return;

          // Año automático
          if (info.year !== effectiveYear) return;

          const key = info.key;
          const tag = `${dni}-${key}`;

          if (seenBajas.has(tag)) return;

          seenBajas.add(tag);
          bajasByMonth.set(key, (bajasByMonth.get(key) || 0) + 1);
        });

        // Mostramos siempre los 12 meses del año efectivo
        const allKeys = buildMonthKeysForYear(effectiveYear);

        const labels = allKeys.map((k) => {
          const [, m] = k.split("-");
          const monthIndex = Number(m) - 1;
          return `${MONTH_LABELS[monthIndex]} ${effectiveYear}`;
        });

        const altasData = allKeys.map((k) => altasByMonth.get(k) || 0);
        const bajasData = allKeys.map((k) => bajasByMonth.get(k) || 0);

        const totalAltas = altasData.reduce((a, b) => a + b, 0);
        const totalBajas = bajasData.reduce((a, b) => a + b, 0);

        const chartData = {
          labels,
          datasets: [
            {
              label: "Altas de afiliación",
              data: altasData,
              backgroundColor: "#43a047",
            },
            {
              label: "Bajas de afiliación",
              data: bajasData,
              backgroundColor: "#e53935",
            },
          ],
        };

        if (!cancelled) {
          setDataChart(chartData);
          setKpis({ totalAltas, totalBajas });
        }
      } catch (err) {
        console.error(
          "[AltasBajasMensual] Error al cargar datos mensuales:",
          err
        );

        if (!cancelled) {
          setError(
            "No se pudo cargar la información de altas y bajas mensuales."
          );
          setDataChart(null);
          setKpis({ totalAltas: 0, totalBajas: 0 });
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    fetchMonthlyData();

    return () => {
      cancelled = true;
    };
  }, [effectiveYear]);

  const chartOptions = useMemo(
    () => ({
      maintainAspectRatio: false,
      plugins: {
        legend: {
          labels: { color: "#495057" },
        },
      },
      scales: {
        x: {
          ticks: {
            color: "#495057",
            maxRotation: 60,
            minRotation: 45,
          },
          grid: { color: "#ebedef" },
        },
        y: {
          beginAtZero: true,
          ticks: {
            color: "#495057",
            precision: 0,
          },
          grid: { color: "#ebedef" },
        },
      },
    }),
    []
  );

  const { totalAltas, totalBajas } = kpis;
  const saldo = totalAltas - totalBajas;
  const sinMovimientos = totalAltas === 0 && totalBajas === 0;

  return (
    <div className={styles.altasBajasMonthlyRow}>
      <div className={styles.panel}>
        <div className={styles.panelHeader}>
          Altas y bajas de afiliados por mes - Año {effectiveYear}
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
          ) : !dataChart ? (
            <p className={styles.mapEmpty}>
              No hay datos suficientes para mostrar el gráfico mensual.
            </p>
          ) : (
            <>
              <div className={styles.altasBajasMonthlyKpis}>
                <div className={styles.altasBajasMonthlyKpi}>
                  <span className={styles.altasBajasMonthlyLabel}>
                    Altas en {effectiveYear}
                  </span>
                  <span className={styles.altasBajasMonthlyValue}>
                    {totalAltas}
                  </span>
                </div>

                <div className={styles.altasBajasMonthlyKpi}>
                  <span className={styles.altasBajasMonthlyLabel}>
                    Bajas en {effectiveYear}
                  </span>
                  <span className={styles.altasBajasMonthlyValue}>
                    {totalBajas}
                  </span>
                </div>

                <div className={styles.altasBajasMonthlyKpi}>
                  <span className={styles.altasBajasMonthlyLabel}>
                    Saldo neto
                  </span>
                  <span
                    className={
                      saldo >= 0
                        ? styles.balancePositivo
                        : styles.balanceNegativo
                    }
                  >
                    {saldo >= 0 ? "+" : ""}
                    {saldo}
                  </span>
                </div>
              </div>

              {sinMovimientos && (
                <p className={styles.mapEmpty} style={{ marginTop: "0.75rem" }}>
                  No hay altas ni bajas registradas durante el año{" "}
                  {effectiveYear}.
                </p>
              )}

              <div style={{ height: "260px", marginTop: "0.75rem" }}>
                <Chart type="bar" data={dataChart} options={chartOptions} />
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
