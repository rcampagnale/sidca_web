// src/components/dashboard/DetalleInformacionAfiliado.js
import React, { useEffect, useState } from "react";
import { ProgressSpinner } from "primereact/progressspinner";
import { ProgressBar } from "primereact/progressbar";
import { collection, getDocs } from "firebase/firestore";
import { db } from "../../firebase/firebase-config";
import styles from "../../pages/Admin/AfiliadosDashboard/afiliadosDashboard.module.css";

/** Normaliza DNI a solo números */
const normalizeDni = (dniRaw) =>
  String(dniRaw || "")
    .replace(/[^\d]/g, "")
    .slice(0, 12);

/** Devuelve el primer valor no vacío de una lista de paths */
const getFromPaths = (obj, paths) => {
  for (const p of paths) {
    const v = obj?.[p];
    if (v === null || v === undefined) continue;
    const s = String(v).trim();
    if (s !== "") return v;
  }
  return null;
};

/** Formatea fecha (Timestamp o string) a texto legible */
const formatDate = (value) => {
  if (!value) return "";
  if (value.toDate) {
    try {
      return value.toDate().toLocaleDateString("es-AR");
    } catch {
      return "";
    }
  }
  return String(value);
};

/** Mapeo de campos que queremos controlar */
const FIELDS_CONFIG = [
  {
    id: "apellidoNombre",
    label: "Apellido y Nombre",
    getter: (p) => {
      const apellido = getFromPaths(p, ["apellido", "Apellido"]);
      const nombre = getFromPaths(p, ["nombre", "Nombre"]);
      const full = `${apellido || ""} ${nombre || ""}`.trim();
      return full || null;
    },
  },
  {
    id: "dni",
    label: "DNI",
    getter: (p) =>
      getFromPaths(p, ["dni", "DNI", "documento", "Documento"]),
  },
  {
    id: "fecha",
    label: "Fecha",
    getter: (p) =>
      formatDate(
        getFromPaths(p, ["fechaAlta", "fecha", "fechaNacimiento"])
      ),
  },
  {
    id: "hora",
    label: "Hora",
    getter: (p) => getFromPaths(p, ["horaAlta", "hora"]),
  },
  {
    id: "afiliacion",
    label: "Afiliación",
    getter: (p) =>
      getFromPaths(p, ["afiliacion", "tipoAfiliado", "tipo"]),
  },
  {
    id: "descuento",
    label: "Descuento",
    getter: (p) =>
      getFromPaths(p, ["descuento", "porcentajeDescuento", "descuentoCuota"]),
  },
  {
    id: "departamento",
    label: "Departamento",
    getter: (p) =>
      getFromPaths(p, ["departamento", "departamentoLaboral"]),
  },
  {
    id: "establecimientos",
    label: "Establecimientos",
    getter: (p) =>
      getFromPaths(p, [
        "establecimiento",
        "establecimientos",
        "escuela",
        "institucion",
      ]),
  },
  {
    id: "celular",
    label: "Celular",
    getter: (p) =>
      getFromPaths(p, ["celular", "telefono", "tel", "telefonoContacto"]),
  },
  {
    id: "email",
    label: "Email",
    getter: (p) => getFromPaths(p, ["email", "correo"]),
  },
  {
    id: "adherente",
    label: "Adherente",
    getter: (p) => {
      if (p.adherente === true) return "Sí (Adherente)";
      if (p.adherente === false) return "No (Titular)";
      return null;
    },
  },
  {
    id: "origen",
    label: "Origen",
    getter: (p) =>
      getFromPaths(p, ["origenRegistro", "origen"]) ||
      (p._sources && p._sources.length
        ? `Fuentes: ${p._sources.join(", ")}`
        : null),
  },
];

/**
 * Panel "Información del Afiliado" -> estadísticas globales
 * de completitud de datos personales (usuarios + nuevoAfiliado,
 * unificados por DNI).
 */
export default function DetalleInformacionAfiliado() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [resumenGlobal, setResumenGlobal] = useState(null);
  const [camposStats, setCamposStats] = useState([]);

  useEffect(() => {
    let cancelled = false;

    const fetchStats = async () => {
      setLoading(true);
      setError("");
      setResumenGlobal(null);
      setCamposStats([]);

      try {
        const usuariosRef = collection(db, "usuarios");
        const nuevoRef = collection(db, "nuevoAfiliado");

        const [usuariosSnap, nuevoSnap] = await Promise.all([
          getDocs(usuariosRef),
          getDocs(nuevoRef),
        ]);

        // Unificamos por DNI, mergeando datos (prioridad a usuarios)
        const personasByDni = new Map();

        const addPersona = (docSnap, source) => {
          const d = docSnap.data();
          const dni = normalizeDni(
            d.dni || d.DNI || d.documento || d.Documento
          );
          if (!dni) return;

          const existing = personasByDni.get(dni) || { _sources: [] };

          const merged = {
            ...existing,
            ...d,
            _sources: Array.from(new Set([...(existing._sources || []), source])),
          };

          personasByDni.set(dni, merged);
        };

        // Primero nuevoAfiliado, luego usuarios (usuarios pisa datos si duplica)
        nuevoSnap.forEach((doc) => addPersona(doc, "nuevoAfiliado"));
        usuariosSnap.forEach((doc) => addPersona(doc, "usuarios"));

        const totalAfiliados = personasByDni.size;
        if (totalAfiliados === 0) {
          if (!cancelled) {
            setResumenGlobal({
              totalAfiliados: 0,
              totalCampos: 0,
              completosTotales: 0,
              faltantesTotales: 0,
              completenessPct: 0,
            });
            setCamposStats([]);
          }
          return;
        }

        // Inicializar stats por campo
        const fieldStatsMap = new Map();
        FIELDS_CONFIG.forEach((f) => {
          fieldStatsMap.set(f.id, {
            id: f.id,
            label: f.label,
            completos: 0,
            faltantes: 0,
            percentComplete: 0,
          });
        });

        let completosTotales = 0;
        let faltantesTotales = 0;

        // Recorremos cada persona y evaluamos campos
        personasByDni.forEach((persona) => {
          FIELDS_CONFIG.forEach((f) => {
            const raw = f.getter ? f.getter(persona) : persona[f.id];
            const str =
              raw !== null && raw !== undefined ? String(raw).trim() : "";
            const complete = str !== "";

            const stat = fieldStatsMap.get(f.id);
            if (!stat) return;

            if (complete) {
              stat.completos += 1;
              completosTotales += 1;
            } else {
              stat.faltantes += 1;
              faltantesTotales += 1;
            }
          });
        });

        const totalCampos = totalAfiliados * FIELDS_CONFIG.length;
        const completenessPct =
          totalCampos > 0
            ? Math.round((completosTotales / totalCampos) * 100)
            : 0;

        // Calcular % por campo
        fieldStatsMap.forEach((stat) => {
          stat.percentComplete =
            totalAfiliados > 0
              ? Math.round((stat.completos / totalAfiliados) * 100)
              : 0;
        });

        // Ordenamos campos por menor % de completitud primero
        const camposStatsArr = Array.from(fieldStatsMap.values()).sort(
          (a, b) => a.percentComplete - b.percentComplete
        );

        if (!cancelled) {
          setResumenGlobal({
            totalAfiliados,
            totalCampos,
            completosTotales,
            faltantesTotales,
            completenessPct,
          });
          setCamposStats(camposStatsArr);
        }
      } catch (err) {
        console.error("[DetalleInformacionAfiliado] Error:", err);
        if (!cancelled) {
          setError(
            "Ocurrió un error al calcular las estadísticas de información de afiliados."
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    fetchStats();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className={styles.infoAfiliadoRow}>
      <div className={styles.panel}>
        <div className={styles.panelHeader}>Información del afiliado</div>
        <div className={styles.panelBody}>
          {loading && (
            <div style={{ textAlign: "center", paddingTop: "1rem" }}>
              <ProgressSpinner
                style={{ width: "35px", height: "35px" }}
                strokeWidth="4"
              />
            </div>
          )}

          {!loading && error && (
            <p className={styles.errorText}>{error}</p>
          )}

          {!loading && !error && resumenGlobal && (
            <>
              {/* Resumen global de completitud */}
              <div className={styles.infoResumenCampos}>
                <div>
                  <strong>{resumenGlobal.totalAfiliados}</strong> afiliados
                  únicos (usuarios + nuevoAfiliado).
                </div>
                <div>
                  <strong>{resumenGlobal.completosTotales}</strong> de{" "}
                  <strong>{resumenGlobal.totalCampos}</strong> datos personales
                  completos (
                  {resumenGlobal.completenessPct}
                  %).
                </div>
                {resumenGlobal.faltantesTotales > 0 && (
                  <div className={styles.infoResumenSub}>
                    Faltan completar{" "}
                    {resumenGlobal.faltantesTotales} datos personales en total.
                  </div>
                )}
              </div>

              <div className={styles.infoCompletenessBar}>
                <ProgressBar
                  value={resumenGlobal.completenessPct}
                  showValue
                />
              </div>

              {/* Estadística por campo */}
              {camposStats.length > 0 ? (
                <div className={styles.infoFieldsGrid}>
                  {camposStats.map((field) => (
                    <div key={field.id} className={styles.infoField}>
                      <div className={styles.infoFieldLabel}>
                        {field.label}
                      </div>
                      <div className={styles.infoFieldValue}>
                        <div style={{ marginTop: "0.25rem" }}>
                          <ProgressBar
                            value={field.percentComplete}
                            showValue
                          />
                        </div>
                        <div className={styles.infoResumenSub}>
                          {field.percentComplete}% de afiliados con este dato
                          completo · {field.completos} completos ·{" "}
                          {field.faltantes} faltantes
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className={styles.mapEmpty}>
                  No hay datos suficientes para calcular estadísticas.
                </p>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
