// src/components/dashboard/DetalleInformacionAfiliado.js
import React, { useEffect, useState } from "react";
import { ProgressSpinner } from "primereact/progressspinner";
import { collection, getDocs } from "firebase/firestore";
import { db } from "../../firebase/firebase-config";
import styles from "../../pages/Admin/AfiliadosDashboard/afiliadosDashboard.module.css";
import infoStyles from "./DetalleInformacionAfiliado.module.css";

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

/** Formatea solo la fecha de un Timestamp o valor combinado fecha/hora */
const formatDate = (value) => {
  if (!value) return "";
  if (value.toDate) {
    try {
      return value.toDate().toLocaleDateString("es-AR");
    } catch {
      return "";
    }
  }
  const raw = String(value).trim();
  if (!raw) return "";
  return raw.split(/[T\s]+/)[0] || raw;
};

/** Obtiene la hora guardada separada o incluida dentro de fecha */
const formatTime = (value) => {
  if (!value) return "";
  if (value.toDate) {
    try {
      return value.toDate().toLocaleTimeString("es-AR", {
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return "";
    }
  }

  const raw = String(value).trim();
  if (!raw) return "";

  const timeMatch = raw.match(/(?:T|\s)(\d{1,2}:\d{2}(?::\d{2})?)/);
  return timeMatch?.[1] || "";
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
    getter: (p) =>
      getFromPaths(p, ["horaAlta", "hora", "hs", "horaRegistro"]) ||
      formatTime(getFromPaths(p, ["fechaAlta", "fecha"])),
  },
  {
    id: "afiliacion",
    label: "Afiliación",
    getter: (p) =>
      getFromPaths(p, [
        "nroAfiliacion",
        "afiliacion",
        "tipoAfiliado",
        "tipo",
      ]),
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

const formatNumber = (value) =>
  new Intl.NumberFormat("es-AR").format(Number(value) || 0);

const getCoverageLevel = (percent) => {
  if (percent >= 80) {
    return {
      label: "Bueno",
      className: infoStyles.levelGood,
      fillClassName: infoStyles.fillGood,
    };
  }

  if (percent >= 50) {
    return {
      label: "Atención",
      className: infoStyles.levelWarning,
      fillClassName: infoStyles.fillWarning,
    };
  }

  return {
    label: "Crítico",
    className: infoStyles.levelCritical,
    fillClassName: infoStyles.fillCritical,
  };
};

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

  const camposCriticos = camposStats.filter(
    (field) => field.percentComplete < 50
  ).length;

  return (
    <div className={`${styles.infoAfiliadoRow} ${infoStyles.root}`}>
      <div className={`${styles.panel} ${infoStyles.panel}`}>
        <div className={infoStyles.header}>
          <div>
            <span className={infoStyles.eyebrow}>Calidad de datos</span>
            <h2 className={infoStyles.title}>Información del afiliado</h2>
            <p className={infoStyles.subtitle}>
              Cobertura de los datos registrados en usuarios y nuevos afiliados,
              unificados por DNI.
            </p>
          </div>
          {!loading && !error && resumenGlobal && (
            <span className={infoStyles.headerBadge}>
              {FIELDS_CONFIG.length} campos evaluados
            </span>
          )}
        </div>

        <div className={`${styles.panelBody} ${infoStyles.panelBody}`}>
          {loading && (
            <div className={infoStyles.loading}>
              <ProgressSpinner
                style={{ width: "38px", height: "38px" }}
                strokeWidth="4"
              />
              <span>Calculando la calidad de la información...</span>
            </div>
          )}

          {!loading && error && (
            <div className={infoStyles.errorBox}>
              <i className="pi pi-exclamation-circle" aria-hidden="true" />
              <p className={styles.errorText}>{error}</p>
            </div>
          )}

          {!loading && !error && resumenGlobal && (
            <>
              <div className={infoStyles.kpiGrid}>
                <article className={`${infoStyles.kpiCard} ${infoStyles.kpiBlue}`}>
                  <div className={infoStyles.kpiIcon}>
                    <i className="pi pi-users" aria-hidden="true" />
                  </div>
                  <div>
                    <span className={infoStyles.kpiLabel}>Afiliados únicos</span>
                    <strong className={infoStyles.kpiValue}>
                      {formatNumber(resumenGlobal.totalAfiliados)}
                    </strong>
                    <small className={infoStyles.kpiHint}>
                      Usuarios + nuevos afiliados
                    </small>
                  </div>
                </article>

                <article className={`${infoStyles.kpiCard} ${infoStyles.kpiGreen}`}>
                  <div className={infoStyles.kpiIcon}>
                    <i className="pi pi-check-circle" aria-hidden="true" />
                  </div>
                  <div>
                    <span className={infoStyles.kpiLabel}>Datos completos</span>
                    <strong className={infoStyles.kpiValue}>
                      {formatNumber(resumenGlobal.completosTotales)}
                    </strong>
                    <small className={infoStyles.kpiHint}>
                      De {formatNumber(resumenGlobal.totalCampos)} relevados
                    </small>
                  </div>
                </article>

                <article className={`${infoStyles.kpiCard} ${infoStyles.kpiRed}`}>
                  <div className={infoStyles.kpiIcon}>
                    <i className="pi pi-exclamation-triangle" aria-hidden="true" />
                  </div>
                  <div>
                    <span className={infoStyles.kpiLabel}>Datos faltantes</span>
                    <strong className={infoStyles.kpiValue}>
                      {formatNumber(resumenGlobal.faltantesTotales)}
                    </strong>
                    <small className={infoStyles.kpiHint}>
                      Requieren actualización
                    </small>
                  </div>
                </article>

                <article className={`${infoStyles.kpiCard} ${infoStyles.kpiAmber}`}>
                  <div className={infoStyles.kpiIcon}>
                    <i className="pi pi-flag" aria-hidden="true" />
                  </div>
                  <div>
                    <span className={infoStyles.kpiLabel}>Campos críticos</span>
                    <strong className={infoStyles.kpiValue}>
                      {camposCriticos}
                    </strong>
                    <small className={infoStyles.kpiHint}>
                      Con cobertura menor al 50%
                    </small>
                  </div>
                </article>
              </div>

              <div className={infoStyles.overviewGrid}>
                <section className={infoStyles.scoreCard}>
                  <div className={infoStyles.scoreGlow} />
                  <div className={infoStyles.scoreContent}>
                    <span className={infoStyles.scoreLabel}>
                      Completitud general
                    </span>
                    <strong className={infoStyles.scoreValue}>
                      {resumenGlobal.completenessPct}%
                    </strong>
                    <div
                      className={infoStyles.scoreTrack}
                      role="progressbar"
                      aria-label="Completitud general"
                      aria-valuemin="0"
                      aria-valuemax="100"
                      aria-valuenow={resumenGlobal.completenessPct}
                    >
                      <span
                        className={infoStyles.scoreFill}
                        style={{ width: `${resumenGlobal.completenessPct}%` }}
                      />
                    </div>
                    <span className={infoStyles.scoreHint}>
                      {formatNumber(resumenGlobal.completosTotales)} de{" "}
                      {formatNumber(resumenGlobal.totalCampos)} datos completos
                    </span>
                  </div>
                </section>

                <section className={infoStyles.fieldsSection}>
                  <div className={infoStyles.fieldsHeader}>
                    <div>
                      <h3>Cobertura por campo</h3>
                      <p>Ordenados desde los que más atención necesitan.</p>
                    </div>
                    <div className={infoStyles.legend}>
                      <span><i className={infoStyles.dotCritical} />Crítico</span>
                      <span><i className={infoStyles.dotWarning} />Atención</span>
                      <span><i className={infoStyles.dotGood} />Bueno</span>
                    </div>
                  </div>

                  {camposStats.length > 0 ? (
                    <div className={infoStyles.fieldsGrid}>
                      {camposStats.map((field) => {
                        const level = getCoverageLevel(field.percentComplete);

                        return (
                          <article key={field.id} className={infoStyles.fieldCard}>
                            <div className={infoStyles.fieldTop}>
                              <span className={infoStyles.fieldLabel}>
                                {field.label}
                              </span>
                              <span
                                className={`${infoStyles.levelBadge} ${level.className}`}
                              >
                                {level.label}
                              </span>
                            </div>
                            <div className={infoStyles.fieldMetric}>
                              <strong>{field.percentComplete}%</strong>
                              <span>
                                {formatNumber(field.completos)} completos
                              </span>
                            </div>
                            <div
                              className={infoStyles.fieldTrack}
                              role="progressbar"
                              aria-label={`Cobertura de ${field.label}`}
                              aria-valuemin="0"
                              aria-valuemax="100"
                              aria-valuenow={field.percentComplete}
                            >
                              <span
                                className={`${infoStyles.fieldFill} ${level.fillClassName}`}
                                style={{ width: `${field.percentComplete}%` }}
                              />
                            </div>
                            <div className={infoStyles.fieldFooter}>
                              <span>
                                {formatNumber(field.faltantes)} faltantes
                              </span>
                              <span>
                                {formatNumber(resumenGlobal.totalAfiliados)} afiliados
                              </span>
                            </div>
                          </article>
                        );
                      })}
                    </div>
                  ) : (
                    <p className={infoStyles.emptyState}>
                      No hay datos suficientes para calcular estadísticas.
                    </p>
                  )}
                </section>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
