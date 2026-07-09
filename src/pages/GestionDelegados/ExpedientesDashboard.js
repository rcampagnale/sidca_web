import React, { useMemo } from "react";
import { Chart } from "primereact/chart";
import "chart.js/auto";
import styles from "./GestionDelegados.module.css";

const PALETTE = [
  "#1d4ed8", "#16a34a", "#dc2626", "#f59e0b",
  "#7c3aed", "#0d9488", "#db2777", "#64748b",
  "#0891b2", "#65a30d", "#ea580c", "#9333ea",
];

const coloresPara = (n) =>
  Array.from({ length: n }, (_, i) => PALETTE[i % PALETTE.length]);

const ESTADO_LABELS = {
  ALTA_DE_SERVICIO: "Alta de servicio",
  RECLAMO: "Reclamo",
  DEUDA: "Deuda",
  VARIOS: "Varios",
  SOLICITUD: "Solicitud",
};
const ESTADO_SUELDO_LABELS = { ACTIVO: "Activo", INACTIVO: "Inactivo" };
const CIRCUITO_ADMINISTRATIVO_LABELS = {
  COMPLETO_PENDIENTE: "Completo / pendiente de resolución",
  EXPEDIENTE_FINALIZADO: "Completo / Expediente finalizado",
};

const normalizarNivel = (value) => {
  const texto = String(value || "").trim();
  const clave = texto
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase();

  if (clave === "SECUNDARIO" || clave === "SECUNDARIA") return "SECUNDARIA";
  return texto || "Sin definir";
};

const quitarAcentos = (valor) =>
  String(valor || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

const tieneCircuitoAdministrativoCompleto = (item) =>
  quitarAcentos(String(item?.observacionActual || "").trim().replace(/\s+/g, " "))
    .toUpperCase()
    .includes("CIRCUITO ADMINISTRATIVO COMPLETO");

const obtenerCircuitoAdministrativo = (item) => {
  if (item?.finalizado) return "EXPEDIENTE_FINALIZADO";
  if (tieneCircuitoAdministrativoCompleto(item)) return "COMPLETO_PENDIENTE";
  return "";
};

const contarPor = (items, campo, labelMap) => {
  const mapa = new Map();
  items.forEach((item) => {
    const crudo = item[campo];
    const valor = crudo ? (labelMap?.[crudo] || crudo) : "Sin definir";
    mapa.set(valor, (mapa.get(valor) || 0) + 1);
  });
  // Orden descendente por cantidad: lo más frecuente arriba/primero
  return new Map([...mapa.entries()].sort((a, b) => b[1] - a[1]));
};

const contarPorMes = (items) => {
  const mapa = new Map();
  items.forEach((item) => {
    const f = String(item.fechaInicio || "").slice(0, 7);
    if (!f || f.length !== 7) return;
    mapa.set(f, (mapa.get(f) || 0) + 1);
  });
  return new Map([...mapa.entries()].sort());
};

const contarPorNivel = (items) => {
  const mapa = new Map();
  items.forEach((item) => {
    const nivel = normalizarNivel(item.nivel);
    mapa.set(nivel, (mapa.get(nivel) || 0) + 1);
  });
  return new Map([...mapa.entries()].sort((a, b) => b[1] - a[1]));
};

const contarPorFinalizacion = (items) => {
  const mapa = new Map([
    ["Finalizados", 0],
    ["En trámite", 0],
  ]);
  items.forEach((item) => {
    const clave = item.finalizado ? "Finalizados" : "En trámite";
    mapa.set(clave, mapa.get(clave) + 1);
  });
  return new Map([...mapa.entries()].filter(([, cantidad]) => cantidad > 0));
};

const contarPorCircuitoAdministrativo = (items) => {
  const mapa = new Map([
    [CIRCUITO_ADMINISTRATIVO_LABELS.COMPLETO_PENDIENTE, 0],
    [CIRCUITO_ADMINISTRATIVO_LABELS.EXPEDIENTE_FINALIZADO, 0],
  ]);
  items.forEach((item) => {
    const circuito = obtenerCircuitoAdministrativo(item);
    if (!circuito) return;
    const clave = CIRCUITO_ADMINISTRATIVO_LABELS[circuito];
    mapa.set(clave, mapa.get(clave) + 1);
  });
  return new Map([...mapa.entries()].filter(([, cantidad]) => cantidad > 0));
};

const contarAfiliadosPorCantidadExpedientes = (items) => {
  const cantidadPorDni = new Map();
  items.forEach((item) => {
    const dni = String(item.dni || "").trim();
    if (!dni) return;
    cantidadPorDni.set(dni, (cantidadPorDni.get(dni) || 0) + 1);
  });

  const grupos = new Map([
    ["1 expediente", 0],
    ["2 expedientes", 0],
    ["3 o más expedientes", 0],
  ]);

  cantidadPorDni.forEach((cantidad) => {
    const grupo =
      cantidad === 1
        ? "1 expediente"
        : cantidad === 2
        ? "2 expedientes"
        : "3 o más expedientes";
    grupos.set(grupo, grupos.get(grupo) + 1);
  });

  return new Map([...grupos.entries()].filter(([, cantidad]) => cantidad > 0));
};

const totalDe = (mapa) => Array.from(mapa.values()).reduce((a, b) => a + b, 0);

const tooltipConPorcentaje = (total) => ({
  callbacks: {
    label: (ctx) => {
      const valorRaw = Number(ctx.raw);
      const valorParsed =
        typeof ctx.parsed === "number"
          ? ctx.parsed
          : Number(ctx.parsed?.y ?? ctx.parsed?.x ?? 0);
      const valor = Number.isFinite(valorRaw) ? valorRaw : valorParsed;
      const pct = total > 0 ? Math.round((valor / total) * 100) : 0;
      return ` ${ctx.label}: ${valor} (${pct}%)`;
    },
  },
});

const ExpedientesDashboard = ({ expedientes = [] }) => {
  const porEstado = useMemo(() => contarPor(expedientes, "estado", ESTADO_LABELS), [expedientes]);
  const porEstadoSueldo = useMemo(
    () => contarPor(expedientes, "estadoSueldo", ESTADO_SUELDO_LABELS),
    [expedientes]
  );
  const porDependencia = useMemo(() => contarPor(expedientes, "dependencia"), [expedientes]);
  const porDepartamento = useMemo(() => contarPor(expedientes, "departamento"), [expedientes]);
  const porNivel = useMemo(() => contarPorNivel(expedientes), [expedientes]);
  const porFinalizacion = useMemo(
    () => contarPorFinalizacion(expedientes),
    [expedientes]
  );
  const porCircuitoAdministrativo = useMemo(
    () => contarPorCircuitoAdministrativo(expedientes),
    [expedientes]
  );
  const porMes = useMemo(() => contarPorMes(expedientes), [expedientes]);
  const porMesSueldoActivo = useMemo(
    () =>
      contarPorMes(
        expedientes.filter((item) => item.estadoSueldo === "ACTIVO")
      ),
    [expedientes]
  );
  const afiliadosPorCantidadExpedientes = useMemo(
    () => contarAfiliadosPorCantidadExpedientes(expedientes),
    [expedientes]
  );

  const pieData = (mapa) => ({
    labels: Array.from(mapa.keys()),
    datasets: [{ data: Array.from(mapa.values()), backgroundColor: coloresPara(mapa.size) }],
  });

  // La leyenda interna de Chart.js no reserva espacio de forma confiable
  // dentro de un contenedor de alto fijo, así que armamos una propia en HTML.
  // Tamaño de canvas fijo (responsive:false) para que no quede recortado por
  // un contenedor que no se vuelve a medir cuando solo cambia el CSS.
  const PIE_SIZE = 180;
  const pieOptions = (mapa) => ({
    responsive: false,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: tooltipConPorcentaje(totalDe(mapa)),
    },
  });

  const Leyenda = ({ mapa }) => {
    const total = totalDe(mapa);
    const colores = coloresPara(mapa.size);
    return (
      <div className={styles.chartLeyenda}>
        {Array.from(mapa.entries()).map(([label, valor], i) => (
          <span key={label} className={styles.chartLeyendaItem}>
            <i style={{ background: colores[i] }} />
            {label} ({total > 0 ? Math.round((valor / total) * 100) : 0}%)
          </span>
        ))}
      </div>
    );
  };

  // Barras horizontales: mejor lectura cuando hay muchas categorías o nombres largos
  const barDataHorizontal = (mapa) => ({
    labels: Array.from(mapa.keys()),
    datasets: [
      {
        data: Array.from(mapa.values()),
        backgroundColor: coloresPara(mapa.size),
        borderRadius: 4,
        maxBarThickness: 22,
      },
    ],
  });

  const barOptionsHorizontal = (mapa) => ({
    indexAxis: "y",
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: tooltipConPorcentaje(totalDe(mapa)),
    },
    scales: {
      x: { beginAtZero: true, ticks: { precision: 0, font: { size: 10 } }, grid: { color: "rgba(0,0,0,0.05)" } },
      y: {
        ticks: {
          autoSkip: false,
          font: { size: 10 },
        },
        grid: { display: false },
      },
    },
  });

  const alturaBarraHorizontal = (mapa) =>
    Math.max(260, mapa.size * 34 + 60);

  const barDataMes = (mapa, color = "#ea580c") => ({
    labels: Array.from(mapa.keys()),
    datasets: [
      {
        data: Array.from(mapa.values()),
        backgroundColor: color,
        borderRadius: 4,
      },
    ],
  });

  const barOptionsMes = (mapa) => ({
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: tooltipConPorcentaje(totalDe(mapa)),
    },
    scales: {
      x: { ticks: { font: { size: 10 }, maxRotation: 45, minRotation: 45 }, grid: { display: false } },
      y: { beginAtZero: true, ticks: { precision: 0, font: { size: 10 } }, grid: { color: "rgba(0,0,0,0.05)" } },
    },
  });

  if (expedientes.length === 0) {
    return (
      <p className={styles.emptyText}>No hay expedientes para mostrar estadísticas.</p>
    );
  }

  return (
    <div className={styles.dashboardGrid}>
      <div className={styles.dashboardCard}>
        <h4>Alta de servicio / Reclamo</h4>
        <p className={styles.dashboardCardTotal}>{totalDe(porEstado)} expediente(s)</p>
        <div className={styles.chartBoxPie}>
          <Chart
            key={`estado-${porEstado.size}`}
            type="doughnut"
            data={pieData(porEstado)}
            options={pieOptions(porEstado)}
            width={PIE_SIZE}
            height={PIE_SIZE}
          />
        </div>
        <Leyenda mapa={porEstado} />
      </div>

      <div className={styles.dashboardCard}>
        <h4>Estado de sueldo</h4>
        <p className={styles.dashboardCardTotal}>{totalDe(porEstadoSueldo)} expediente(s)</p>
        <div className={styles.chartBoxPie}>
          <Chart
            key={`sueldo-${porEstadoSueldo.size}`}
            type="doughnut"
            data={pieData(porEstadoSueldo)}
            options={pieOptions(porEstadoSueldo)}
            width={PIE_SIZE}
            height={PIE_SIZE}
          />
        </div>
        <Leyenda mapa={porEstadoSueldo} />
      </div>

      <div className={styles.dashboardCard}>
        <h4>Por dependencia</h4>
        <p className={styles.dashboardCardTotal}>{porDependencia.size} dependencia(s)</p>
        <div
          className={styles.chartBox}
          style={{ height: alturaBarraHorizontal(porDependencia) }}
        >
          <Chart
            key={`dependencia-${porDependencia.size}`}
            type="bar"
            data={barDataHorizontal(porDependencia)}
            options={barOptionsHorizontal(porDependencia)}
          />
        </div>
      </div>

      <div className={styles.dashboardCard}>
        <h4>Expedientes finalizados</h4>
        <p className={styles.dashboardCardTotal}>{totalDe(porFinalizacion)} expediente(s)</p>
        <div className={styles.chartBoxPie}>
          <Chart
            key={`finalizacion-${porFinalizacion.size}`}
            type="doughnut"
            data={pieData(porFinalizacion)}
            options={pieOptions(porFinalizacion)}
            width={PIE_SIZE}
            height={PIE_SIZE}
          />
        </div>
        <Leyenda mapa={porFinalizacion} />
      </div>

      <div className={styles.dashboardCard}>
        <h4>Circuito administrativo</h4>
        <p className={styles.dashboardCardTotal}>
          {totalDe(porCircuitoAdministrativo)} expediente(s)
        </p>
        <div className={styles.chartBoxPie}>
          <Chart
            key={`circuito-administrativo-${porCircuitoAdministrativo.size}`}
            type="doughnut"
            data={pieData(porCircuitoAdministrativo)}
            options={pieOptions(porCircuitoAdministrativo)}
            width={PIE_SIZE}
            height={PIE_SIZE}
          />
        </div>
        <Leyenda mapa={porCircuitoAdministrativo} />
      </div>

      <div className={styles.dashboardCard}>
        <h4>Por departamento</h4>
        <p className={styles.dashboardCardTotal}>{porDepartamento.size} departamento(s)</p>
        <div
          className={styles.chartBox}
          style={{ height: alturaBarraHorizontal(porDepartamento) }}
        >
          <Chart
            key={`departamento-${porDepartamento.size}`}
            type="bar"
            data={barDataHorizontal(porDepartamento)}
            options={barOptionsHorizontal(porDepartamento)}
          />
        </div>
      </div>

      <div className={styles.dashboardCard}>
        <h4>Por nivel</h4>
        <p className={styles.dashboardCardTotal}>{porNivel.size} nivel(es)</p>
        <div
          className={styles.chartBox}
          style={{ height: alturaBarraHorizontal(porNivel) }}
        >
          <Chart
            key={`nivel-${porNivel.size}`}
            type="bar"
            data={barDataHorizontal(porNivel)}
            options={barOptionsHorizontal(porNivel)}
          />
        </div>
      </div>

      <div className={styles.dashboardCard}>
        <h4>Afiliados por cantidad de expedientes</h4>
        <p className={styles.dashboardCardTotal}>
          {totalDe(afiliadosPorCantidadExpedientes)} afiliado(s)
        </p>
        <div className={styles.chartBoxPie}>
          <Chart
            key={`cantidad-expedientes-${afiliadosPorCantidadExpedientes.size}`}
            type="doughnut"
            data={pieData(afiliadosPorCantidadExpedientes)}
            options={pieOptions(afiliadosPorCantidadExpedientes)}
            width={PIE_SIZE}
            height={PIE_SIZE}
          />
        </div>
        <Leyenda mapa={afiliadosPorCantidadExpedientes} />
      </div>

      <div className={`${styles.dashboardCard} ${styles.dashboardCardWide}`}>
        <h4>Expedientes por fecha de inicio (mes)</h4>
        <p className={styles.dashboardCardTotal}>{porMes.size} mes(es) con movimiento</p>
        <div className={styles.chartBox}>
          <Chart
            key={`mes-${porMes.size}`}
            type="bar"
            data={barDataMes(porMes)}
            options={barOptionsMes(porMes)}
          />
        </div>
      </div>

      <div className={`${styles.dashboardCard} ${styles.dashboardCardWide}`}>
        <h4>Expedientes por fecha de sueldo activo</h4>
        <p className={styles.dashboardCardTotal}>
          {totalDe(porMesSueldoActivo)} expediente(s) con sueldo activo · agrupados
          por mes de fecha de inicio
        </p>
        <div className={styles.chartBox}>
          <Chart
            key={`mes-sueldo-activo-${porMesSueldoActivo.size}`}
            type="bar"
            data={barDataMes(porMesSueldoActivo, "#16a34a")}
            options={barOptionsMes(porMesSueldoActivo)}
          />
        </div>
      </div>
    </div>
  );
};

export default ExpedientesDashboard;
