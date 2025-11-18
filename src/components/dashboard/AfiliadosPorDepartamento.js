// src/components/dashboard/AfiliadosPorDepartamento.js
import React, { useEffect, useState } from "react";
import { ProgressSpinner } from "primereact/progressspinner";
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

/** Mapa de Catamarca con imagen de fondo + lista a la derecha */
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
            "Afiliados activos por departamento (usuarios + nuevoAfiliado, sin duplicar DNI). Ordenado según número de departamento."}
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

export default function AfiliadosPorDepartamento() {
  const [afiliadosCotizantesDept, setAfiliadosCotizantesDept] = useState([]);
  const [afiliadosTotalDept, setAfiliadosTotalDept] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;

    const fetchAfiliadosByDept = async () => {
      setLoading(true);
      setError("");

      try {
        const [usuariosSnap, nuevoSnap] = await Promise.all([
          getDocs(collection(db, "usuarios")),
          getDocs(collection(db, "nuevoAfiliado")),
        ]);

        const personasByDni = new Map();

        const addPersona = (docSnap, source) => {
          const d = docSnap.data();
          const dni = normalizeDni(
            d.dni || d.DNI || d.documento || d.Documento
          );
          if (!dni) return;

          const departamento = getDepartamentoFromDoc(d);
          const activo = d.activo !== false; // si no tiene campo, lo tomamos como activo
          const adherente = d.adherente; // true / false / undefined

          const existing = personasByDni.get(dni);

          if (existing) {
            // Prioridad: usuarios > nuevoAfiliado, pero mergeamos datos útiles
            if (existing.source === "usuarios") {
              // completamos campos faltantes desde nuevoAfiliado
              if (!existing.departamento && departamento) {
                existing.departamento = departamento;
              }
              if (existing.adherente === undefined && adherente !== undefined) {
                existing.adherente = adherente;
              }
              if (existing.activo && d.activo === false) {
                existing.activo = false;
              }
              personasByDni.set(dni, existing);
              return;
            }
          }

          personasByDni.set(dni, {
            departamento,
            activo,
            adherente,
            source,
          });
        };

        usuariosSnap.forEach((doc) => addPersona(doc, "usuarios"));
        nuevoSnap.forEach((doc) => addPersona(doc, "nuevoAfiliado"));

        const sortWeight = (d) => (d.id && d.id > 0 ? d.id : 999);

        const buildDeptData = (filterFn) => {
          const deptCountsMap = new Map();

          personasByDni.forEach((persona) => {
            if (!persona.activo) return;
            if (filterFn && !filterFn(persona)) return;

            const rawDept = persona.departamento || "";
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

          return Array.from(deptCountsMap.values()).sort(
            (a, b) => sortWeight(a) - sortWeight(b)
          );
        };

        // 🟦 Mapa 1: Afiliados cotizantes (adherente === false o sin campo)
        const dataCotizantes = buildDeptData(
          (p) => p.adherente === false || p.adherente === undefined
        );

        // 🟧 Mapa 2: Total de afiliados (cotizantes + adherentes)
        const dataTotal = buildDeptData(); // todos los activos

        if (!cancelled) {
          setAfiliadosCotizantesDept(dataCotizantes);
          setAfiliadosTotalDept(dataTotal);
        }
      } catch (err) {
        console.error(
          "[AfiliadosPorDepartamento] Error al cargar afiliados:",
          err
        );
        if (!cancelled) {
          setError(
            "No se pudo cargar la información de afiliados por departamento."
          );
          setAfiliadosCotizantesDept([]);
          setAfiliadosTotalDept([]);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    fetchAfiliadosByDept();

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className={styles.deptRow}>
      {/* 🗺️ Mapa Total afiliados (cotizante + adherente) */}
      <div className={styles.deptMapCol}>
        <div className={styles.panel}>
          <div className={styles.panelHeader}>
            Total de afiliados por departamento (mapa)
          </div>
          <div className={styles.panelBody}>
            {loading ? (
              <div style={{ textAlign: "center", paddingTop: "2rem" }}>
                <ProgressSpinner
                  style={{ width: "40px", height: "40px" }}
                  strokeWidth="4"
                />
              </div>
            ) : error ? (
              <p className={styles.errorText}>{error}</p>
            ) : (
              <MapaCatamarcaAfiliados
                data={afiliadosTotalDept}
                hint="Total de afiliados (cotizantes + adherentes) por departamento (usuarios + nuevoAfiliado, sin duplicar DNI)."
              />
            )}
          </div>
        </div>
      </div>
      {/* 🗺️ Mapa Afiliados cotizantes */}
      <div className={styles.deptMapCol}>
        <div className={styles.panel}>
          <div className={styles.panelHeader}>
            Afiliados cotizantes por departamento (mapa)
          </div>
          <div className={styles.panelBody}>
            {loading ? (
              <div style={{ textAlign: "center", paddingTop: "2rem" }}>
                <ProgressSpinner
                  style={{ width: "40px", height: "40px" }}
                  strokeWidth="4"
                />
              </div>
            ) : error ? (
              <p className={styles.errorText}>{error}</p>
            ) : (
              <MapaCatamarcaAfiliados
                data={afiliadosCotizantesDept}
                hint="Afiliados cotizantes (campo adherente = false o sin definir) por departamento (usuarios + nuevoAfiliado, sin duplicar DNI)."
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}




