// src/components/dashboard/AfiliadosPorDepartamento.js
import React, { useEffect, useState } from "react";
import { ProgressSpinner } from "primereact/progressspinner";
import { collection, getDocs } from "firebase/firestore";
import { db } from "../../firebase/firebase-config";
import styles from "../../pages/Admin/AfiliadosDashboard/afiliadosDashboard.module.css";
import ab from "./AfiliadosPorDepartamento.module.css";

import mapaCatamarca from "../../assets/mapas/mapa_catamarca_departamentos.png";

const normalizeDni = (dniRaw) =>
  String(dniRaw || "").replace(/[^\d]/g, "").slice(0, 12);

const normalizeDeptKey = (name) =>
  String(name || "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toUpperCase()
    .trim();

const DEPARTAMENTOS = [
  { id: 1,  key: "AMBATO",                    label: "Ambato" },
  { id: 2,  key: "ANCASTI",                   label: "Ancasti" },
  { id: 3,  key: "ANDALGALA",                 label: "Andalgalá" },
  { id: 4,  key: "ANTOFAGASTA DE LA SIERRA",  label: "Antofagasta de la Sierra" },
  { id: 5,  key: "BELEN",                     label: "Belén" },
  { id: 6,  key: "CAPAYAN",                   label: "Capayán" },
  { id: 7,  key: "CAPITAL",                   label: "Capital" },
  { id: 8,  key: "EL ALTO",                   label: "El Alto" },
  { id: 9,  key: "FRAY MAMERTO ESQUIU",       label: "Fray Mamerto Esquiú" },
  { id: 10, key: "LA PAZ",                    label: "La Paz" },
  { id: 11, key: "PACLIN",                    label: "Paclín" },
  { id: 12, key: "POMAN",                     label: "Pomán" },
  { id: 13, key: "SANTA MARIA",               label: "Santa María" },
  { id: 14, key: "SANTA ROSA",                label: "Santa Rosa" },
  { id: 15, key: "TINOGASTA",                 label: "Tinogasta" },
  { id: 16, key: "VALLE VIEJO",               label: "Valle Viejo" },
];

const KEY_TO_DEPT = DEPARTAMENTOS.reduce((acc, d) => { acc[d.key] = d; return acc; }, {});

const NORM_TO_KEY = {
  AMBATO: "AMBATO", ANCASTI: "ANCASTI", ANDALGALA: "ANDALGALA",
  "ANTOFAGASTA DE LA SIERRA": "ANTOFAGASTA DE LA SIERRA",
  BELEN: "BELEN", CAPAYAN: "CAPAYAN", CAPITAL: "CAPITAL",
  "EL ALTO": "EL ALTO", "FRAY MAMERTO ESQUIU": "FRAY MAMERTO ESQUIU",
  "LA PAZ": "LA PAZ", PACLIN: "PACLIN", POMAN: "POMAN",
  "SANTA MARIA": "SANTA MARIA", "SANTA ROSA": "SANTA ROSA",
  TINOGASTA: "TINOGASTA", "VALLE VIEJO": "VALLE VIEJO",
  "CIUDAD CAPITAL": "CAPITAL",
  "FRAY M.ESQUIU": "FRAY MAMERTO ESQUIU",
  "FRAY M ESQUIU": "FRAY MAMERTO ESQUIU",
  "FRAY M. ESQUIU": "FRAY MAMERTO ESQUIU",
  "STA MARIA": "SANTA MARIA",
  VALLEVIEJO: "VALLE VIEJO",
};

const SIN_DEP_KEY = "SIN_DEP";

const DEPT_COLORS = {
  AMBATO:                    "#1976d2",
  ANCASTI:                   "#43a047",
  ANDALGALA:                 "#fb8c00",
  "ANTOFAGASTA DE LA SIERRA": "#8e24aa",
  BELEN:                     "#e53935",
  CAPAYAN:                   "#00897b",
  CAPITAL:                   "#3949ab",
  "EL ALTO":                 "#6d4c41",
  "FRAY MAMERTO ESQUIU":     "#d81b60",
  "LA PAZ":                  "#00796b",
  PACLIN:                    "#5e35b1",
  POMAN:                     "#fdd835",
  "SANTA MARIA":             "#039be5",
  "SANTA ROSA":              "#8d6e63",
  TINOGASTA:                 "#c0ca33",
  "VALLE VIEJO":             "#f4511e",
  [SIN_DEP_KEY]:             "#cfd8dc",
};

const deptPositions = {
  AMBATO:                    { top: "56%", left: "62%" },
  ANCASTI:                   { top: "74%", left: "70%" },
  ANDALGALA:                 { top: "48%", left: "56%" },
  "ANTOFAGASTA DE LA SIERRA": { top: "18%", left: "32%" },
  BELEN:                     { top: "41%", left: "45%" },
  CAPAYAN:                   { top: "74%", left: "63%" },
  CAPITAL:                   { top: "65%", left: "63%" },
  "EL ALTO":                 { top: "65%", left: "72%" },
  "FRAY MAMERTO ESQUIU":     { top: "63%", left: "65%" },
  "LA PAZ":                  { top: "84%", left: "76%" },
  PACLIN:                    { top: "58%", left: "67%" },
  POMAN:                     { top: "61%", left: "55%" },
  "SANTA MARIA":             { top: "34%", left: "56%" },
  "SANTA ROSA":              { top: "57%", left: "73%" },
  TINOGASTA:                 { top: "48%", left: "28%" },
  "VALLE VIEJO":             { top: "69%", left: "66%" },
};

const getDepartamentoFromDoc = (d) =>
  (d.departamento && String(d.departamento).trim()) ||
  (d.departamentoLaboral && String(d.departamentoLaboral).trim()) ||
  "";

/* ── Mapa PNG con burbujas — sin cambios ── */
const MapaAfiliados = ({ data }) => {
  const mapData = data.filter((d) => d.key !== SIN_DEP_KEY);
  const totalMap = mapData.reduce((acc, d) => acc + d.total, 0);

  return (
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
        const pct = totalMap ? ((d.total / totalMap) * 100).toFixed(1) : "0.0";
        return (
          <div
            key={d.key}
            className={styles.mapMarker}
            style={{ top: pos.top, left: pos.left, backgroundColor: color }}
            title={`${d.departamento}: ${d.total} afiliados (${pct}%)`}
          >
            {pct}%
          </div>
        );
      })}
    </div>
  );
};

/* ── Podio top 3 + lista compacta ── */
const PodioYLista = ({ data, hint }) => {
  const totalList = data.reduce((acc, d) => acc + d.total, 0);

  // Ordenar por total desc para el podio (excluye sin depto)
  const conDepto  = data.filter((d) => d.key !== SIN_DEP_KEY);
  const sinDepto  = data.filter((d) => d.key === SIN_DEP_KEY);
  const porTotal  = [...conDepto].sort((a, b) => b.total - a.total);

  const top3  = porTotal.slice(0, 3);
  const resto = [...porTotal.slice(3), ...sinDepto];

  // Altura máxima de barra: 72px para el 1°
  const maxTotal = top3[0]?.total || 1;
  const MAX_H = 72;

  // Orden visual del podio: 2° | 1° | 3°
  const podioOrden = [top3[1], top3[0], top3[2]].filter(Boolean);
  const rankLabels = [2, 1, 3];
  const podioMedalColors = ["#90a4ae", "#f9a825", "#a1623c"];

  return (
    <div className={ab.sidePanel}>
      <div className={ab.sidePanelHint}>{hint}</div>

      {/* Podio */}
      <div className={ab.podioWrap}>
        {podioOrden.map((d, vi) => {
          const rankIdx = rankLabels[vi] - 1; // 0=1°, 1=2°, 2=3°
          const realRank = rankLabels[vi];
          const color = DEPT_COLORS[d.key] || "#cfe2ff";
          const pct = totalList ? ((d.total / totalList) * 100).toFixed(1) : "0.0";
          const barH = Math.round((d.total / maxTotal) * MAX_H);

          return (
            <div key={d.key} className={ab.podioCol}>
              <span className={ab.podioPct} style={{ color }}>{pct}%</span>
              <div
                className={ab.podioBar}
                style={{ height: `${barH}px`, background: color, opacity: realRank === 1 ? 1 : 0.75 }}
                title={`${d.departamento}: ${d.total} (${pct}%)`}
              />
              <div
                className={ab.podioRank}
                style={{ background: podioMedalColors[rankIdx] }}
              >
                {realRank}
              </div>
              <span className={ab.podioNombre} title={d.departamento}>{d.departamento}</span>
            </div>
          );
        })}
      </div>

      <div className={ab.divisor} />

      {/* Resto */}
      <div className={ab.restoLista}>
        {resto.map((d, i) => {
          const color = d.key === SIN_DEP_KEY ? DEPT_COLORS[SIN_DEP_KEY] : (DEPT_COLORS[d.key] || "#cfe2ff");
          const pct = totalList ? ((d.total / totalList) * 100).toFixed(1) : "0.0";
          const rank = d.key === SIN_DEP_KEY ? "—" : i + 4;

          return (
            <div key={d.key} className={`${ab.restoItem} ${d.key === SIN_DEP_KEY ? ab.sinDepItem : ""}`}>
              <span className={ab.restoNum}>{rank}</span>
              <span className={ab.restoDot} style={{ background: color }} />
              <span className={ab.restoNombre} title={d.departamento}>{d.departamento}</span>
              <span className={ab.restoCant}>{d.total}</span>
              <span className={ab.restoPct}>({pct}%)</span>
            </div>
          );
        })}
      </div>
    </div>
  );
};

/* ── Mapa + panel lateral combinado ── */
const MapaConPodio = ({ data, hint }) => {
  if (!data || !data.length) {
    return <p className={styles.mapEmpty}>No hay datos de afiliados para mostrar.</p>;
  }

  return (
    <div className={styles.mapLayout}>
      <MapaAfiliados data={data} />
      <div className={styles.mapListWrapper}>
        <PodioYLista data={data} hint={hint} />
      </div>
    </div>
  );
};

export default function AfiliadosPorDepartamento() {
  const [afiliadosCotizantesDept, setAfiliadosCotizantesDept] = useState([]);
  const [afiliadosTotalDept,      setAfiliadosTotalDept]      = useState([]);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState("");

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
          const dni = normalizeDni(d.dni || d.DNI || d.documento || d.Documento);
          if (!dni) return;

          const departamento = getDepartamentoFromDoc(d);
          const activo = d.activo !== false;
          const adherente = d.adherente;

          const existing = personasByDni.get(dni);
          if (existing) {
            if (existing.source === "usuarios") {
              if (!existing.departamento && departamento) existing.departamento = departamento;
              if (existing.adherente === undefined && adherente !== undefined) existing.adherente = adherente;
              if (existing.activo && d.activo === false) existing.activo = false;
              personasByDni.set(dni, existing);
              return;
            }
          }

          personasByDni.set(dni, { departamento, activo, adherente, source });
        };

        usuariosSnap.forEach((doc) => addPersona(doc, "usuarios"));
        nuevoSnap.forEach((doc)     => addPersona(doc, "nuevoAfiliado"));

        const sortWeight = (d) => (d.id && d.id > 0 ? d.id : 999);

        const buildDeptData = (filterFn) => {
          const deptCountsMap = new Map();

          personasByDni.forEach((persona) => {
            if (!persona.activo) return;
            if (filterFn && !filterFn(persona)) return;

            const norm = normalizeDeptKey(persona.departamento || "");
            const canonicalKey = NORM_TO_KEY[norm];
            let key, id, label;

            if (canonicalKey && KEY_TO_DEPT[canonicalKey]) {
              const info = KEY_TO_DEPT[canonicalKey];
              key = canonicalKey; id = info.id; label = info.label;
            } else {
              key = SIN_DEP_KEY; id = 0; label = "Sin departamento";
            }

            const current = deptCountsMap.get(key) || { key, id, departamento: label, total: 0 };
            current.total += 1;
            deptCountsMap.set(key, current);
          });

          return Array.from(deptCountsMap.values()).sort((a, b) => sortWeight(a) - sortWeight(b));
        };

        const dataCotizantes = buildDeptData((p) => p.adherente === false || p.adherente === undefined);
        const dataTotal      = buildDeptData();

        if (!cancelled) {
          setAfiliadosCotizantesDept(dataCotizantes);
          setAfiliadosTotalDept(dataTotal);
        }
      } catch (err) {
        console.error("[AfiliadosPorDepartamento] Error:", err);
        if (!cancelled) setError("No se pudo cargar la información de afiliados por departamento.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    fetchAfiliadosByDept();
    return () => { cancelled = true; };
  }, []);

  const paneles = [
    {
      header: "Total de afiliados por departamento (mapa)",
      data: afiliadosTotalDept,
      hint: "Total de afiliados (cotizantes + adherentes) por departamento (usuarios + nuevoAfiliado, sin duplicar DNI).",
    },
    {
      header: "Afiliados cotizantes por departamento (mapa)",
      data: afiliadosCotizantesDept,
      hint: "Afiliados cotizantes (campo adherente = false o sin definir) por departamento (usuarios + nuevoAfiliado, sin duplicar DNI).",
    },
  ];

  return (
    <div className={styles.deptRow}>
      {paneles.map((p) => (
        <div key={p.header} className={styles.deptMapCol}>
          <div className={styles.panel}>
            <div className={styles.panelHeader}>{p.header}</div>
            <div className={styles.panelBody}>
              {loading ? (
                <div style={{ textAlign: "center", paddingTop: "2rem" }}>
                  <ProgressSpinner style={{ width: "40px", height: "40px" }} strokeWidth="4" />
                </div>
              ) : error ? (
                <p className={styles.errorText}>{error}</p>
              ) : (
                <MapaConPodio data={p.data} hint={p.hint} />
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
