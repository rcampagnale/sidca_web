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
 * - Firestore Timestamp (toDate)
 * - { seconds, nanoseconds }
 * - número (milisegundos)
 * - string "DD/MM/YYYY HH:mm" o "DD-MM-YYYY HH:mm"
 * - string genérica que entienda new Date()
 */
const parseDateFlexible = (value) => {
  if (!value) return null;

  // Date nativa
  if (value instanceof Date) {
    return isNaN(value.getTime()) ? null : value;
  }

  // Firestore Timestamp
  if (value && typeof value.toDate === "function") {
    const d = value.toDate();
    return isNaN(d.getTime()) ? null : d;
  }

  // Objeto { seconds, nanoseconds }
  if (
    typeof value === "object" &&
    value !== null &&
    typeof value.seconds === "number"
  ) {
    const d = new Date(value.seconds * 1000);
    return isNaN(d.getTime()) ? null : d;
  }

  // Número (milisegundos unix)
  if (typeof value === "number") {
    const d = new Date(value);
    return isNaN(d.getTime()) ? null : d;
  }

  // String
  if (typeof value === "string") {
    const s = value.trim();
    if (!s) return null;

    // Ej: "14/11/2025 9:41" o "14-11-2025 09:41"
    const matchDMY = s.match(
      /(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})(?:\s+(\d{1,2}):(\d{2}))?/
    );
    if (matchDMY) {
      let [, dd, mm, yy, hh, min] = matchDMY;
      let year = parseInt(yy, 10);
      if (year < 100) year += 2000; // por si viniera "25" en lugar de "2025"
      const month = parseInt(mm, 10) - 1;
      const day = parseInt(dd, 10);
      const hour = hh ? parseInt(hh, 10) : 0;
      const minute = min ? parseInt(min, 10) : 0;
      const d = new Date(year, month, day, hour, minute);
      return isNaN(d.getTime()) ? null : d;
    }

    // Último intento genérico
    const d = new Date(s);
    return isNaN(d.getTime()) ? null : d;
  }

  return null;
};

/** 🔎 Convierte un valor de fecha a { year, month (0-11), key "YYYY-MM" } */
const extractMonthInfo = (value) => {
  const date = parseDateFlexible(value);
  if (!date) return null;

  const year = date.getFullYear();
  const month = date.getMonth(); // 0-11
  const key = `${year}-${String(month + 1).padStart(2, "0")}`;

  return { year, month, key };
};

/**
 * De dónde sacamos la fecha de ALTA (nuevoAfiliado)
 * ➜ usamos primero fechaServer (Timestamp) y si no, fecha (string).
 */
const getAltaDateFromNuevoAfiliado = (d) =>
  d.fechaServer || d.fecha || d.fechaAlta || d.fechaRegistro;

/**
 * De dónde sacamos la fecha de BAJA (usuarios)
 * Regla:
 *  - bajas solo se toman desde "usuarios"
 *  - si no tenés un campo específico, usamos fechaServer/fecha como fallback
 */
const getBajaDateFromUsuario = (d) =>
  d.fechaBajaServer ||
  d.fechaBaja ||
  d.fecha_baja ||
  d.fechaDesafiliacion ||
  d.fechaServer ||
  d.fecha;

/**
 * 📊 Altas y bajas de afiliados por mes
 * - Altas: SOLO documentos en "nuevoAfiliado"
 * - Bajas: SOLO documentos en "usuarios" con activo === false
 * - Se evita contar dos veces el mismo DNI en el mismo mes.
 */
export default function AltasBajasMensual({ year }) {
  const [dataChart, setDataChart] = useState(null);
  const [kpis, setKpis] = useState({ totalAltas: 0, totalBajas: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

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

        // Para NO repetir el mismo DNI en el mismo mes
        const seenAltas = new Set(); // "dni-YYYY-MM"
        const seenBajas = new Set(); // "dni-YYYY-MM"

        // ✅ ALTAS: cada registro en nuevoAfiliado cuenta como 1 "entrada" al sindicato
        // (sin duplicar DNI+mes).
        nuevoSnap.forEach((docSnap) => {
          const d = docSnap.data();
          const dni = normalizeDni(
            d.dni || d.DNI || d.documento || d.Documento
          );
          if (!dni) return;

          const rawDate = getAltaDateFromNuevoAfiliado(d);
          const info = extractMonthInfo(rawDate);
          if (!info) return;

          if (year && String(info.year) !== String(year)) return;

          const key = info.key; // "YYYY-MM"
          const tag = `${dni}-${key}`;
          if (seenAltas.has(tag)) return; // ya contamos este DNI en este mes

          seenAltas.add(tag);
          altasByMonth.set(key, (altasByMonth.get(key) || 0) + 1);
        });

        // ✅ BAJAS: SOLO usuarios con activo === false
        // (no usamos nuevoAfiliado para bajas, respetando tu lógica).
        usuariosSnap.forEach((docSnap) => {
          const d = docSnap.data();
          if (d.activo !== false) return; // solo desafiliados

          const dni = normalizeDni(
            d.dni || d.DNI || d.documento || d.Documento
          );
          if (!dni) return;

          const rawDate = getBajaDateFromUsuario(d);
          const info = extractMonthInfo(rawDate);
          if (!info) return;

          if (year && String(info.year) !== String(year)) return;

          const key = info.key;
          const tag = `${dni}-${key}`;
          if (seenBajas.has(tag)) return;

          seenBajas.add(tag);
          bajasByMonth.set(key, (bajasByMonth.get(key) || 0) + 1);
        });

        // Unificamos meses usados por altas o bajas
        const allKeysSet = new Set([
          ...altasByMonth.keys(),
          ...bajasByMonth.keys(),
        ]);
        const allKeys = Array.from(allKeysSet).sort(); // "YYYY-MM"

        const labels = allKeys.map((k) => {
          const [y, m] = k.split("-");
          const monthIndex = Number(m) - 1;
          return `${MONTH_LABELS[monthIndex]} ${y}`;
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
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    fetchMonthlyData();
    return () => {
      cancelled = true;
    };
  }, [year]);

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
          ticks: { color: "#495057", maxRotation: 60, minRotation: 45 },
          grid: { color: "#ebedef" },
        },
        y: {
          ticks: { color: "#495057" },
          grid: { color: "#ebedef" },
        },
      },
    }),
    []
  );

  const { totalAltas, totalBajas } = kpis;
  const saldo = totalAltas - totalBajas;

  return (
    <div className={styles.altasBajasMonthlyRow}>
      <div className={styles.panel}>
        <div className={styles.panelHeader}>
          Altas y bajas de afiliados por mes
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
          ) : !dataChart || !dataChart.labels.length ? (
            <p className={styles.mapEmpty}>
              No hay datos suficientes para mostrar el gráfico mensual.
            </p>
          ) : (
            <>
              {/* KPIs arriba del gráfico */}
              <div className={styles.altasBajasMonthlyKpis}>
                <div className={styles.altasBajasMonthlyKpi}>
                  <span className={styles.altasBajasMonthlyLabel}>
                    Altas en el período
                  </span>
                  <span className={styles.altasBajasMonthlyValue}>
                    {totalAltas}
                  </span>
                </div>
                <div className={styles.altasBajasMonthlyKpi}>
                  <span className={styles.altasBajasMonthlyLabel}>
                    Bajas en el período
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

              {/* Gráfico de barras */}
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

