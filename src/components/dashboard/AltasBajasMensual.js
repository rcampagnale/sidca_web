import React, { useEffect, useMemo, useState, useRef, useCallback } from "react";
import { ProgressSpinner } from "primereact/progressspinner";
import { Chart } from "primereact/chart";
import { collection, getDocs } from "firebase/firestore";
import { db } from "../../firebase/firebase-config";
import styles from "../../pages/Admin/AfiliadosDashboard/afiliadosDashboard.module.css";
import ab from "./AltasBajasMensual.module.css";

const MONTH_LABELS  = ["Ene","Feb","Mar","Abr","May","Jun","Jul","Ago","Sep","Oct","Nov","Dic"];
const MONTH_FULL    = ["Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"];

const normalizeDni = (dniRaw) =>
  String(dniRaw || "").replace(/[^\d]/g, "").slice(0, 12);

const parseDateFlexible = (value) => {
  if (!value) return null;
  if (value instanceof Date)                          return isNaN(value.getTime()) ? null : value;
  if (value && typeof value.toDate === "function")    { const d = value.toDate(); return isNaN(d.getTime()) ? null : d; }
  if (typeof value === "object" && value !== null && typeof value.seconds === "number") {
    const d = new Date(value.seconds * 1000); return isNaN(d.getTime()) ? null : d;
  }
  if (typeof value === "number") { const d = new Date(value); return isNaN(d.getTime()) ? null : d; }
  if (typeof value === "string") {
    const s = value.trim();
    if (!s) return null;
    // Las bajas masivas se guardan como YYYY-MM. Debe construirse una fecha
    // local: new Date("2025-05") se interpreta como UTC y en Argentina puede
    // retroceder al último día de abril.
    const matchYM = s.match(/^(\d{4})-(\d{1,2})$/);
    if (matchYM) {
      const [, yy, mm] = matchYM;
      const mes = parseInt(mm, 10);
      if (mes < 1 || mes > 12) return null;
      return new Date(parseInt(yy, 10), mes - 1, 1);
    }
    const matchYMD = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
    if (matchYMD) {
      const [, yy, mm, dd] = matchYMD;
      const d = new Date(parseInt(yy,10), parseInt(mm,10)-1, parseInt(dd,10));
      return isNaN(d.getTime()) ? null : d;
    }
    const matchDMY = s.match(/(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})(?:\s+(\d{1,2}):(\d{2}))?/);
    if (matchDMY) {
      let [, dd, mm, yy, hh, min] = matchDMY;
      let yr = parseInt(yy,10); if (yr < 100) yr += 2000;
      const d = new Date(yr, parseInt(mm,10)-1, parseInt(dd,10), hh?parseInt(hh,10):0, min?parseInt(min,10):0);
      return isNaN(d.getTime()) ? null : d;
    }
    const d = new Date(s); return isNaN(d.getTime()) ? null : d;
  }
  return null;
};

const extractMonthInfo = (value) => {
  const date = parseDateFlexible(value);
  if (!date) return null;
  const year = date.getFullYear();
  const month = date.getMonth();
  const key = `${year}-${String(month+1).padStart(2,"0")}`;
  const dateKey = `${year}-${String(month+1).padStart(2,"0")}-${String(date.getDate()).padStart(2,"0")}`;
  return { year, month, key, dateKey };
};

const getAltaDate  = (d) => d.fechaServer || d.fecha || d.fechaAlta || d.fechaRegistro;
const getBajaDate  = (d) => d.fechaBajaServer || d.fechaBaja || d.fecha_baja || d.fechaDesafiliacion || d.fechaServer || d.fecha;

const getBajaDatesFromCounter = (d) => {
  const fechas = [];
  const push = (v) => { if (v != null && v !== "") fechas.push(v); };
  if (Array.isArray(d.fechasBaja))  d.fechasBaja.forEach(push);
  if (Array.isArray(d.fechas_baja)) d.fechas_baja.forEach(push);
  if (Array.isArray(d.bajas))       d.bajas.forEach(item => {
    if (!item) return;
    if (typeof item === "string" || item instanceof Date) { push(item); return; }
    if (typeof item === "object") push(item.fecha || item.fechaBaja || item.fecha_baja || item.date || item.createdAt);
  });
  if (!fechas.length) push(d.fechaUltimaBaja || d.fechaBaja || d.fecha_baja);
  return fechas;
};

const buildMonthKeys = (year) =>
  Array.from({length:12},(_,i) => `${year}-${String(i+1).padStart(2,"0")}`);

const addBaja = ({dni, rawDate, effectiveYear, seenBajas, bajasByMonth}) => {
  if (!dni || !rawDate) return;
  const info = extractMonthInfo(rawDate);
  if (!info || info.year !== effectiveYear) return;
  const tag = `${dni}-${info.dateKey}`;
  if (seenBajas.has(tag)) return;
  seenBajas.add(tag);
  bajasByMonth.set(info.key, (bajasByMonth.get(info.key) || 0) + 1);
};

export default function AltasBajasMensual({ year }) {
  const now                        = new Date();
  const [currentYear]              = useState(() => now.getFullYear());
  const [currentMonth]             = useState(() => now.getMonth()); // 0-11
  const [altasData,  setAltasData] = useState([]);
  const [bajasData,  setBajasData] = useState([]);
  const [loading,    setLoading]   = useState(true);
  const [error,      setError]     = useState("");
  const [mesActivo,  setMesActivo] = useState(null);

  const chartRef = useRef(null);

  const effectiveYear = useMemo(() => {
    const p = Number(year);
    return Number.isInteger(p) && p >= 2000 && p <= 2100 ? p : currentYear;
  }, [year, currentYear]);

  useEffect(() => {
    let cancelled = false;
    const fetch = async () => {
      setLoading(true); setError("");
      try {
        const [usuariosSnap, nuevoSnap, countersSnap] = await Promise.all([
          getDocs(collection(db, "usuarios")),
          getDocs(collection(db, "nuevoAfiliado")),
          getDocs(collection(db, "nuevoAfiliado_counters")),
        ]);

        const altasMap  = new Map();
        const bajasMap  = new Map();
        const seenAltas = new Set();
        const seenBajas = new Set();

        nuevoSnap.forEach((docSnap) => {
          const d   = docSnap.data();
          const dni = normalizeDni(d.dni || d.DNI || d.documento || d.Documento);
          if (!dni) return;
          const info = extractMonthInfo(getAltaDate(d));
          if (!info || info.year !== effectiveYear) return;
          const tag = `${dni}-${info.dateKey}`;
          if (seenAltas.has(tag)) return;
          seenAltas.add(tag);
          altasMap.set(info.key, (altasMap.get(info.key) || 0) + 1);
        });

        countersSnap.forEach((docSnap) => {
          const d   = docSnap.data() || {};
          const dni = normalizeDni(d.dni || d.DNI || d.documento || d.Documento || docSnap.id);
          if (!dni) return;
          getBajaDatesFromCounter(d).forEach(rawDate =>
            addBaja({dni, rawDate, effectiveYear, seenBajas, bajasByMonth: bajasMap})
          );
        });

        usuariosSnap.forEach((docSnap) => {
          const d = docSnap.data();
          if (d.activo !== false) return;
          const dni = normalizeDni(d.dni || d.DNI || d.documento || d.Documento);
          if (!dni) return;
          addBaja({dni, rawDate: getBajaDate(d), effectiveYear, seenBajas, bajasByMonth: bajasMap});
        });

        const keys = buildMonthKeys(effectiveYear);
        const ad   = keys.map(k => altasMap.get(k)  || 0);
        const bd   = keys.map(k => bajasMap.get(k)  || 0);

        if (!cancelled) {
          setAltasData(ad);
          setBajasData(bd);
          // Seleccionar mes por defecto: mes actual si es el año en curso,
          // o null si es un año pasado (panel muestra resumen anual)
          setMesActivo(effectiveYear === new Date().getFullYear() ? new Date().getMonth() : null);
        }
      } catch (err) {
        console.error("[AltasBajasMensual]", err);
        if (!cancelled) { setError("No se pudo cargar la información de altas y bajas."); }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    fetch();
    return () => { cancelled = true; };
  }, [effectiveYear]);

  /* ── Año finalizado: effectiveYear < año actual ── */
  const yearComplete = effectiveYear < currentYear;

  /* ── KPIs globales ── */
  const totalAltas = useMemo(() => altasData.reduce((s,v) => s+v, 0), [altasData]);
  const totalBajas = useMemo(() => bajasData.reduce((s,v) => s+v, 0), [bajasData]);
  const saldoNeto  = totalAltas - totalBajas;

  /* ── Resumen anual (para año finalizado) ── */
  const resumenAnual = useMemo(() => {
    if (!yearComplete || !altasData.length) return null;
    const total  = totalAltas + totalBajas;
    const pctA   = total > 0 ? Math.round((totalAltas / total) * 100) : 0;
    const pctB   = total > 0 ? Math.round((totalBajas / total) * 100) : 0;
    const mejorMesIdx = altasData.reduce((best, v, i) => v > altasData[best] ? i : best, 0);
    const peorMesIdx  = bajasData.reduce((worst, v, i) => v > bajasData[worst] ? i : worst, 0);
    return { pctA, pctB, mejorMes: MONTH_FULL[mejorMesIdx], mejorVal: altasData[mejorMesIdx],
             peorMes: MONTH_FULL[peorMesIdx], peorVal: bajasData[peorMesIdx] };
  }, [yearComplete, altasData, bajasData, totalAltas, totalBajas]);

  /* ── Datos del mes activo ── */
  const detallesMes = useMemo(() => {
    if (mesActivo === null) return null;
    const a  = altasData[mesActivo]  || 0;
    const b  = bajasData[mesActivo]  || 0;
    const s  = a - b;
    const prevA = mesActivo > 0 ? (altasData[mesActivo-1]  || 0) : null;
    const prevB = mesActivo > 0 ? (bajasData[mesActivo-1]  || 0) : null;
    const diffA = prevA !== null ? a - prevA : null;
    const diffB = prevB !== null ? b - prevB : null;
    return { mes: MONTH_FULL[mesActivo], a, b, s, diffA, diffB };
  }, [mesActivo, altasData, bajasData]);

  /* ── Chart data con highlight del mes activo ── */
  const chartData = useMemo(() => ({
    labels: MONTH_LABELS,
    datasets: [
      {
        label: "Altas",
        data: altasData,
        backgroundColor: altasData.map((_,i) =>
          mesActivo === null || mesActivo === i ? "#43a047" : "rgba(67,160,71,0.3)"
        ),
        borderRadius: 4,
        borderSkipped: false,
      },
      {
        label: "Bajas",
        data: bajasData,
        backgroundColor: bajasData.map((_,i) =>
          mesActivo === null || mesActivo === i ? "#e53935" : "rgba(229,57,53,0.3)"
        ),
        borderRadius: 4,
        borderSkipped: false,
      },
    ],
  }), [altasData, bajasData, mesActivo]);

  const chartOptions = useMemo(() => ({
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: { callbacks: { label: ctx => ` ${ctx.dataset.label}: ${ctx.parsed.y}` } },
    },
    scales: {
      x: {
        ticks: { autoSkip: false, maxRotation: 0, color: "#888", font: { size: 11 } },
        grid: { display: false },
      },
      y: {
        beginAtZero: true,
        ticks: { color: "#888", precision: 0, font: { size: 11 } },
        grid: { color: "rgba(0,0,0,0.05)" },
      },
    },
    onClick: (_evt, elements) => {
      if (!elements.length) return;
      const i = elements[0].index;
      setMesActivo(prev => prev === i ? null : i);
    },
    onHover: (evt, elements) => {
      evt.native.target.style.cursor = elements.length ? "pointer" : "default";
    },
  }), []);

  const sinMovimientos = totalAltas === 0 && totalBajas === 0;

  return (
    <div className={ab.root}>

      {/* ── KPIs ── */}
      <div className={ab.kpiRow}>
        <div className={`${ab.kpiCard} ${ab.kpiGreen}`}>
          <span className={ab.kpiVal}>{loading ? "—" : totalAltas}</span>
          <span className={ab.kpiLbl}>Altas {effectiveYear}</span>
        </div>
        <div className={`${ab.kpiCard} ${ab.kpiRed}`}>
          <span className={ab.kpiVal}>{loading ? "—" : totalBajas}</span>
          <span className={ab.kpiLbl}>Bajas {effectiveYear}</span>
        </div>
        <div className={`${ab.kpiCard} ${saldoNeto >= 0 ? ab.kpiBlue : ab.kpiRed}`}>
          <span className={`${ab.kpiVal} ${saldoNeto >= 0 ? ab.kpiValBlue : ab.kpiValRed}`}>
            {loading ? "—" : `${saldoNeto >= 0 ? "+" : ""}${saldoNeto}`}
          </span>
          <span className={ab.kpiLbl}>Saldo neto</span>
        </div>
      </div>

      {loading ? (
        <div className={ab.loadingBox}>
          <ProgressSpinner style={{width:"38px",height:"38px"}} strokeWidth="4" />
          <span>Cargando datos...</span>
        </div>
      ) : error ? (
        <p className={styles.errorText}>{error}</p>
      ) : sinMovimientos ? (
        <p className={styles.mapEmpty}>No hay altas ni bajas registradas para el año {effectiveYear}.</p>
      ) : (
        <div className={ab.layout}>

          {/* ── Gráfico ── */}
          <div className={ab.chartPanel}>
            <div className={ab.legend}>
              <span className={ab.legendItem}>
                <span className={ab.legendDot} style={{background:"#43a047"}} />Altas
              </span>
              <span className={ab.legendItem}>
                <span className={ab.legendDot} style={{background:"#e53935"}} />Bajas
              </span>
            </div>
            <div className={ab.chartWrap}>
              <Chart ref={chartRef} type="bar" data={chartData} options={chartOptions} />
            </div>
            <p className={ab.chartHint}>
              <i className="pi pi-hand-pointer" style={{fontSize:"0.8rem"}} /> Hacé clic en un mes para ver el detalle
            </p>
          </div>

          {/* ── Panel lateral ── */}
          <div className={`${ab.detailPanel} ${mesActivo !== null || (yearComplete && resumenAnual) ? ab.detailPanelActive : ""}`}>
            {mesActivo === null && yearComplete && resumenAnual ? (
              /* Resumen anual — año finalizado */
              <>
                <div className={ab.detailHeader}>
                  <span className={ab.detailMes}>Resumen {effectiveYear}</span>
                </div>
                <div className={ab.detailStats}>
                  <div className={ab.detailStat}>
                    <span className={ab.detailStatLbl}>Altas del año</span>
                    <span className={`${ab.detailStatVal} ${ab.detailStatGreen}`}>{totalAltas}</span>
                    <span className={`${ab.detailDiff} ${ab.diffPos}`}>{resumenAnual.pctA}% del total</span>
                  </div>
                  <div className={ab.detailDivider} />
                  <div className={ab.detailStat}>
                    <span className={ab.detailStatLbl}>Bajas del año</span>
                    <span className={`${ab.detailStatVal} ${ab.detailStatRed}`}>{totalBajas}</span>
                    <span className={`${ab.detailDiff} ${ab.diffNeg}`}>{resumenAnual.pctB}% del total</span>
                  </div>
                  <div className={ab.detailDivider} />
                  <div className={ab.detailStat}>
                    <span className={ab.detailStatLbl}>Mejor mes (altas)</span>
                    <span className={ab.anualMeta}>{resumenAnual.mejorMes} · <b style={{color:"#2e7d32"}}>{resumenAnual.mejorVal}</b></span>
                  </div>
                  <div className={ab.detailDivider} />
                  <div className={ab.detailStat}>
                    <span className={ab.detailStatLbl}>Más bajas</span>
                    <span className={ab.anualMeta}>{resumenAnual.peorMes} · <b style={{color:"#c62828"}}>{resumenAnual.peorVal}</b></span>
                  </div>
                </div>
                <div className={ab.detailBar}>
                  <div className={ab.detailBarAltas} style={{flex: totalAltas || 0.001}} />
                  <div className={ab.detailBarBajas} style={{flex: totalBajas || 0.001}} />
                </div>
                <div className={ab.detailBarLabels}>
                  <span style={{color:"#2e7d32"}}>{resumenAnual.pctA}% altas</span>
                  <span style={{color:"#c62828"}}>{resumenAnual.pctB}% bajas</span>
                </div>
                <p className={ab.anualHint}>Seleccioná un mes para ver su detalle</p>
              </>
            ) : mesActivo === null ? (
              <div className={ab.detailEmpty}>
                <i className="pi pi-chart-bar" style={{fontSize:"1.8rem",color:"#cbd5e1"}} />
                <span>Seleccioná un mes<br/>para ver el detalle</span>
              </div>
            ) : (
              <>
                <div className={ab.detailHeader}>
                  <span className={ab.detailMes}>{detallesMes.mes} {effectiveYear}</span>
                  <button className={ab.detailClose} onClick={() => setMesActivo(null)}>
                    <i className="pi pi-times" />
                  </button>
                </div>

                <div className={ab.detailStats}>
                  <div className={ab.detailStat}>
                    <span className={ab.detailStatLbl}>Altas</span>
                    <span className={`${ab.detailStatVal} ${ab.detailStatGreen}`}>{detallesMes.a}</span>
                    {detallesMes.diffA !== null && (
                      <span className={`${ab.detailDiff} ${detallesMes.diffA >= 0 ? ab.diffPos : ab.diffNeg}`}>
                        {detallesMes.diffA >= 0 ? "↑" : "↓"} {Math.abs(detallesMes.diffA)} vs mes ant.
                      </span>
                    )}
                  </div>

                  <div className={ab.detailDivider} />

                  <div className={ab.detailStat}>
                    <span className={ab.detailStatLbl}>Bajas</span>
                    <span className={`${ab.detailStatVal} ${ab.detailStatRed}`}>{detallesMes.b}</span>
                    {detallesMes.diffB !== null && (
                      <span className={`${ab.detailDiff} ${detallesMes.diffB <= 0 ? ab.diffPos : ab.diffNeg}`}>
                        {detallesMes.diffB <= 0 ? "↓" : "↑"} {Math.abs(detallesMes.diffB)} vs mes ant.
                      </span>
                    )}
                  </div>

                  <div className={ab.detailDivider} />

                  <div className={ab.detailStat}>
                    <span className={ab.detailStatLbl}>Saldo del mes</span>
                    <span className={`${ab.detailStatVal} ${detallesMes.s >= 0 ? ab.detailStatBlue : ab.detailStatRed}`}>
                      {detallesMes.s >= 0 ? "+" : ""}{detallesMes.s}
                    </span>
                  </div>
                </div>

                {/* mini barra visual */}
                <div className={ab.detailBar}>
                  {(detallesMes.a + detallesMes.b) > 0 && (
                    <>
                      <div
                        className={ab.detailBarAltas}
                        style={{flex: detallesMes.a || 0.001}}
                        title={`Altas: ${detallesMes.a}`}
                      />
                      <div
                        className={ab.detailBarBajas}
                        style={{flex: detallesMes.b || 0.001}}
                        title={`Bajas: ${detallesMes.b}`}
                      />
                    </>
                  )}
                </div>
                <div className={ab.detailBarLabels}>
                  <span style={{color:"#2e7d32"}}>{detallesMes.a > 0 ? `${Math.round(detallesMes.a/(detallesMes.a+detallesMes.b)*100)}% altas` : ""}</span>
                  <span style={{color:"#c62828"}}>{detallesMes.b > 0 ? `${Math.round(detallesMes.b/(detallesMes.a+detallesMes.b)*100)}% bajas` : ""}</span>
                </div>
              </>
            )}
          </div>

        </div>
      )}
    </div>
  );
}
