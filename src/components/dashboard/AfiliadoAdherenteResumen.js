// src/components/dashboard/AfiliadoAdherenteResumen.js
import React, { useEffect, useState, useMemo } from "react";
import { ProgressSpinner } from "primereact/progressspinner";
import { Chart } from "primereact/chart";
import { collection, getDocs } from "firebase/firestore";
import { db } from "../../firebase/firebase-config";
import styles from "../../pages/Admin/AfiliadosDashboard/afiliadosDashboard.module.css";

// 📌 Imagen del mapa beige con los números 1–16
import mapaCatamarca from "../../assets/mapas/mapa_catamarca_departamentos.png";

/** Normaliza DNI a solo números */
const normalizeDni = (dniRaw) =>
  String(dniRaw || "")
    .replace(/[^\d]/g, "")
    .slice(0, 12);

/** Detecta si el registro es Afiliado Adherente */
const isAdherenteFromDoc = (d) => {
  if (d.adherente === true) return true;

  const text = (
    d.tipoAfiliado ||
    d.tipo ||
    d.categoria ||
    ""
  )
    .toString()
    .toLowerCase();

  if (text.includes("adherente")) return true;

  return false;
};

/** Normaliza clave de departamento (sin tildes, mayúsculas) */
const normalizeDeptKey = (name) =>
  String(name || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .trim();

/**
 * Lista de departamentos oficiales de Catamarca
 * (id = número del mapa)
 */
const DEPARTAMENTOS = [
  { id: 1, key: "AMBATO", label: "Ambato" },
  { id: 2, key: "ANCASTI", label: "Ancasti" },
  { id: 3, key: "ANDALGALA", label: "Andalgalá" },
  {
    id: 4,
    key: "ANTOFAGASTA DE LA SIERRA",
    label: "Antofagasta de la Sierra",
  },
  { id: 5, key: "BELEN", label: "Belén" },
  { id: 6, key: "CAPAYAN", label: "Capayán" },
  { id: 7, key: "CAPITAL", label: "Capital" },
  { id: 8, key: "EL ALTO", label: "El Alto" },
  {
    id: 9,
    key: "FRAY MAMERTO ESQUIU",
    label: "Fray Mamerto Esquiú",
  },
  { id: 10, key: "LA PAZ", label: "La Paz" },
  { id: 11, key: "PACLIN", label: "Paclín" },
  { id: 12, key: "POMAN", label: "Pomán" },
  { id: 13, key: "SANTA MARIA", label: "Santa María" },
  { id: 14, key: "SANTA ROSA", label: "Santa Rosa" },
  { id: 15, key: "TINOGASTA", label: "Tinogasta" },
  { id: 16, key: "VALLE VIEJO", label: "Valle Viejo" },
];

const KEY_TO_DEPT = DEPARTAMENTOS.reduce((acc, d) => {
  acc[d.key] = d;
  return acc;
}, {});

/**
 * Mapeo de variantes que pueden venir desde Firestore
 * ➜ a la clave oficial de DEPARTAMENTOS
 */
const NORM_TO_KEY = {
  // directos
  AMBATO: "AMBATO",
  ANCASTI: "ANCASTI",
  ANDALGALA: "ANDALGALA",
  "ANTOFAGASTA DE LA SIERRA": "ANTOFAGASTA DE LA SIERRA",
  BELEN: "BELEN",
  CAPAYAN: "CAPAYAN",
  CAPITAL: "CAPITAL",
  "EL ALTO": "EL ALTO",
  "FRAY MAMERTO ESQUIU": "FRAY MAMERTO ESQUIU",
  "LA PAZ": "LA PAZ",
  PACLIN: "PACLIN",
  POMAN: "POMAN",
  "SANTA MARIA": "SANTA MARIA",
  "SANTA ROSA": "SANTA ROSA",
  TINOGASTA: "TINOGASTA",
  "VALLE VIEJO": "VALLE VIEJO",

  // variantes
  "CIUDAD CAPITAL": "CAPITAL",
  "FRAY M.ESQUIU": "FRAY MAMERTO ESQUIU",
  "FRAY M ESQUIU": "FRAY MAMERTO ESQUIU",
  "FRAY M. ESQUIU": "FRAY MAMERTO ESQUIU",
  "STA MARIA": "SANTA MARIA",
  VALLEVIEJO: "VALLE VIEJO",
};

const SIN_DEP_KEY = "SIN_DEP";

/** 🎨 Color fijo por departamento */
const DEPT_COLORS = {
  AMBATO: "#1976d2", // azul
  ANCASTI: "#43a047", // verde
  ANDALGALA: "#fb8c00", // naranja
  "ANTOFAGASTA DE LA SIERRA": "#8e24aa", // violeta
  BELEN: "#e53935", // rojo
  CAPAYAN: "#00897b", // verde azulado
  CAPITAL: "#3949ab", // azul intenso
  "EL ALTO": "#6d4c41", // marrón
  "FRAY MAMERTO ESQUIU": "#d81b60", // magenta
  "LA PAZ": "#00796b",
  PACLIN: "#5e35b1",
  POMAN: "#fdd835", // amarillo
  "SANTA MARIA": "#039be5",
  "SANTA ROSA": "#8d6e63",
  TINOGASTA: "#c0ca33",
  "VALLE VIEJO": "#f4511e",

  // “Sin departamento”
  [SIN_DEP_KEY]: "#cfd8dc",
};

/** Coordenadas (en %) de cada departamento en el mapa beige */
const deptPositions = {
  // 1. Ambato
  AMBATO: { top: "56%", left: "62%" },

  // 2. Ancasti
  ANCASTI: { top: "74%", left: "70%" },

  // 3. Andalgalá
  ANDALGALA: { top: "48%", left: "56%" },

  // 4. Antofagasta de la Sierra
  "ANTOFAGASTA DE LA SIERRA": { top: "18%", left: "32%" },

  // 5. Belén
  BELEN: { top: "41%", left: "45%" },

  // 6. Capayán
  CAPAYAN: { top: "74%", left: "63%" },

  // 7. Capital
  CAPITAL: { top: "65%", left: "63%" },

  // 8. El Alto
  "EL ALTO": { top: "65%", left: "72%" },

  // 9. Fray Mamerto Esquiú
  "FRAY MAMERTO ESQUIU": { top: "63%", left: "65%" },

  // 10. La Paz
  "LA PAZ": { top: "84%", left: "76%" },

  // 11. Paclín
  PACLIN: { top: "58%", left: "67%" },

  // 12. Pomán
  POMAN: { top: "61%", left: "55%" },

  // 13. Santa María
  "SANTA MARIA": { top: "34%", left: "56%" },

  // 14. Santa Rosa
  "SANTA ROSA": { top: "57%", left: "73%" },

  // 15. Tinogasta
  TINOGASTA: { top: "48%", left: "28%" },

  // 16. Valle Viejo
  "VALLE VIEJO": { top: "69%", left: "66%" },
};

/** Obtiene el departamento desde el doc (ajustá si usás otros campos) */
const getDepartamentoFromDoc = (d) =>
  (d.departamento && String(d.departamento).trim()) ||
  (d.departamentoLaboral && String(d.departamentoLaboral).trim()) ||
  "";

/** Mapa de Catamarca con imagen de fondo + lista a la derecha (reutilizado para adherentes) */
const MapaCatamarcaAfiliados = ({ data, hint }) => {
  if (!data || !data.length) {
    return (
      <p className={styles.mapEmpty}>
        No hay datos de afiliados para mostrar.
      </p>
    );
  }

  // Datos para el mapa: solo departamentos reales (1–16)
  const mapData = data.filter((d) => d.key !== SIN_DEP_KEY);

  // Total de afiliados SOLO entre los que tienen departamento asignado
  const totalMap = mapData.reduce((acc, d) => acc + d.total, 0);

  // Total general para la lista (incluye "Sin departamento")
  const totalList = data.reduce((acc, d) => acc + d.total, 0);

  if (!mapData.length) {
    return (
      <div className={styles.mapLayout}>
        <div className={styles.mapImageWrapper}>
          <img
            src={mapaCatamarca}
            alt="Mapa de Catamarca por departamentos"
            className={styles.mapImage}
          />
          <p className={styles.mapEmpty}>
            No hay afiliados con departamento asignado.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.mapLayout}>
      {/* 🗺️ Mapa con imagen de fondo y marcadores (porcentaje) */}
      <div className={styles.mapImageWrapper}>
        <img
          src={mapaCatamarca}
          alt="Mapa de Catamarca por departamentos"
          className={styles.mapImage}
        />
        {mapData.map((d) => {
          const pos = deptPositions[d.key];
          if (!pos) return null;

          const color = DEPT_COLORS[d.key] || "#cfe2ff";
          const pct = totalMap
            ? ((d.total / totalMap) * 100).toFixed(1)
            : "0.0";

          return (
            <div
              key={d.key}
              className={styles.mapMarker}
              style={{
                top: pos.top,
                left: pos.left,
                backgroundColor: color,
              }}
              title={`${d.departamento}: ${d.total} afiliados (${pct}%)`}
            >
              {pct}%
            </div>
          );
        })}
      </div>

      {/* 📋 Lista ordenada por número de departamento, mismo color que el mapa */}
      <div className={styles.mapListWrapper}>
        <div className={styles.mapHint}>
          {hint ||
            "Afiliados adherentes por departamento (usuarios + nuevoAfiliado, sin duplicar DNI). Ordenado según número de departamento."}
        </div>
        <ul className={styles.mapList}>
          {data.map((d) => {
            const color =
              d.key === SIN_DEP_KEY
                ? DEPT_COLORS[SIN_DEP_KEY]
                : DEPT_COLORS[d.key] || "#cfe2ff";

            return (
              <li key={d.key} className={styles.mapListItem}>
                <span className={styles.mapDeptName}>
                  {/* Número de departamento si existe */}
                  {d.id > 0 && (
                    <span className={styles.mapDeptId}>{d.id}</span>
                  )}
                  <span
                    className={styles.mapListColorDot}
                    style={{ backgroundColor: color }}
                  />
                  {d.departamento}
                </span>
                <span className={styles.mapDeptValue}>
                  {d.total}
                  <span className={styles.mapDeptPercent}>
                    {" "}
                    ({((d.total / totalList) * 100).toFixed(1)}%)
                  </span>
                </span>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
};

/**
 * Panel de resumen para Afiliados Adherentes:
 * - Total adherentes (DNI único, usuarios + nuevoAfiliado)
 * - Habilitados (activo !== false)
 * - No habilitados (activo === false)
 * + gráfico doughnut habilitados vs no habilitados
 * + mapa de afiliados adherentes por departamento
 */
export default function AfiliadoAdherenteResumen() {
  const [stats, setStats] = useState({
    totalAdherentes: 0,
    habilitados: 0,
    noHabilitados: 0,
  });
  const [adherentesDept, setAdherentesDept] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;

    const fetchData = async () => {
      setLoading(true);
      setError("");

      try {
        const [usuariosSnap, nuevoSnap] = await Promise.all([
          getDocs(collection(db, "usuarios")),
          getDocs(collection(db, "nuevoAfiliado")),
        ]);

        /**
         * Unificamos por DNI:
         * - Si existe en usuarios y en nuevoAfiliado, manda usuarios.
         */
        const personasByDni = new Map();

        const addPersona = (docSnap, source) => {
          const d = docSnap.data();
          const dni = normalizeDni(
            d.dni || d.DNI || d.documento || d.Documento
          );
          if (!dni) return;

          const adherente = isAdherenteFromDoc(d);
          const activo = d.activo !== false; // si falta, se considera habilitado
          const departamento = getDepartamentoFromDoc(d);

          const existing = personasByDni.get(dni);
          // Prioridad: usuarios > nuevoAfiliado
          if (existing && existing.source === "usuarios") return;

          personasByDni.set(dni, {
            adherente,
            activo,
            departamento,
            source,
          });
        };

        usuariosSnap.forEach((doc) => addPersona(doc, "usuarios"));
        nuevoSnap.forEach((doc) => addPersona(doc, "nuevoAfiliado"));

        // Calculamos totales y agrupamos por departamento SOLO para adherentes
        let totalAdherentes = 0;
        let habilitados = 0;
        let noHabilitados = 0;

        const deptCountsMap = new Map();
        const sortWeight = (d) => (d.id && d.id > 0 ? d.id : 999);

        personasByDni.forEach((p) => {
          if (!p.adherente) return; // solo adherentes

          totalAdherentes += 1;
          if (p.activo) habilitados += 1;
          else noHabilitados += 1;

          const rawDept = p.departamento || "";
          const norm = normalizeDeptKey(rawDept);
          const canonicalKey = NORM_TO_KEY[norm];

          let key, id, label;
          if (canonicalKey && KEY_TO_DEPT[canonicalKey]) {
            const info = KEY_TO_DEPT[canonicalKey];
            key = canonicalKey;
            id = info.id;
            label = info.label;
          } else {
            key = SIN_DEP_KEY;
            id = 0;
            label = "Sin departamento";
          }

          const current =
            deptCountsMap.get(key) || {
              key,
              id,
              departamento: label,
              total: 0,
            };

          current.total += 1;
          deptCountsMap.set(key, current);
        });

        const dataDept = Array.from(deptCountsMap.values()).sort(
          (a, b) => sortWeight(a) - sortWeight(b)
        );

        if (!cancelled) {
          setStats({ totalAdherentes, habilitados, noHabilitados });
          setAdherentesDept(dataDept);
        }
      } catch (err) {
        console.error(
          "[AfiliadoAdherenteResumen] Error al cargar adherentes:",
          err
        );
        if (!cancelled) {
          setError(
            "No se pudo cargar la información de afiliados adherentes."
          );
          setStats({
            totalAdherentes: 0,
            habilitados: 0,
            noHabilitados: 0,
          });
          setAdherentesDept([]);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    fetchData();
    return () => {
      cancelled = true;
    };
  }, []);

  const { totalAdherentes, habilitados, noHabilitados } = stats;
  const percHabilitados =
    totalAdherentes > 0
      ? ((habilitados / totalAdherentes) * 100).toFixed(1)
      : "0.0";
  const percNoHabilitados =
    totalAdherentes > 0
      ? ((noHabilitados / totalAdherentes) * 100).toFixed(1)
      : "0.0";

  // 🎯 Datos para el gráfico doughnut
  const chartData = useMemo(
    () => ({
      labels: ["Habilitados", "No habilitados"],
      datasets: [
        {
          data: [habilitados, noHabilitados],
          backgroundColor: ["#43a047", "#e53935"],
          hoverBackgroundColor: ["#2e7d32", "#c62828"],
        },
      ],
    }),
    [habilitados, noHabilitados]
  );

  const chartOptions = useMemo(
    () => ({
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: "top",
          labels: {
            color: "#495057",
            usePointStyle: true,
            boxWidth: 14,
            boxHeight: 14,
          },
        },
      },
      layout: {
        padding: {
          top: 8,
          bottom: 8,
        },
      },
      cutout: "65%",
    }),
    []
  );

  return (
    <div className={styles.adherentesRow}>
      <div className={styles.panel}>
        <div className={styles.panelHeader}>Afiliado Adherente</div>
        {/* 🗺️ Mapa Afiliado Adherente por departamento */}
{totalAdherentes > 0 && (
  <div className={styles.adherentesMapWrapper}>
    <MapaCatamarcaAfiliados
      data={adherentesDept}
      hint="Afiliados adherentes (campo adherente = true o tipo 'adherente') por departamento (usuarios + nuevoAfiliado, sin duplicar DNI)."
    />
  </div>
)}

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
          ) : (
            <>
              {/* KPIs */}
              <div className={styles.adherentesKpis}>
                <div className={styles.adherentesKpiCard}>
                  <div className={styles.adherentesKpiLabel}>
                    Total afiliados adherentes
                  </div>
                  <div className={styles.adherentesKpiValue}>
                    {totalAdherentes}
                  </div>
                  <div className={styles.adherentesKpiSub}>
                    (DNI únicos, usuarios + nuevoAfiliado)
                  </div>
                </div>

                <div className={styles.adherentesKpiCard}>
                  <div className={styles.adherentesKpiLabel}>
                    Habilitados
                  </div>
                  <div className={styles.adherentesKpiValue}>
                    {habilitados}
                  </div>
                  <div className={styles.adherentesKpiSub}>
                    {totalAdherentes > 0 && (
                      <span>{percHabilitados}% del total</span>
                    )}
                  </div>
                </div>

                <div className={styles.adherentesKpiCard}>
                  <div className={styles.adherentesKpiLabel}>
                    No habilitados
                  </div>
                  <div className={styles.adherentesKpiValue}>
                    {noHabilitados}
                  </div>
                  <div className={styles.adherentesKpiSub}>
                    {totalAdherentes > 0 && (
                      <span>{percNoHabilitados}% del total</span>
                    )}
                  </div>
                </div>
              </div>

              {/* Gráfico doughnut */}
              {totalAdherentes > 0 && (
                <div className={styles.adherentesChartWrapper}>
                  <Chart
                    type="doughnut"
                    data={chartData}
                    options={chartOptions}
                  />
                </div>
              )}

              
            </>
          )}
        </div>
      </div>
    </div>
  );
}



