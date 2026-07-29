import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useSelector } from "react-redux";
import { useLocation } from "react-router-dom";
import { jsPDF } from "jspdf";
import { collection, getDocs, limit, query, where } from "firebase/firestore";
import sidcaLogo from "../../assets/img/logo-01.png";
import { db } from "../../firebase/firebase-config";
import {
  consultarEstadoPago,
  crearPreferenciaPago,
  getMercadoPagoEnvironmentLabel,
  obtenerMisPagos,
} from "../../services/mercadoPagoService";
import styles from "./GestionPagos.module.css";

const ESTADOS_APROBADOS = ["aprobado", "approved"];
const ESTADOS_PENDIENTES = ["pendiente", "pending", "in_process"];
const ESTADOS_RECHAZADOS = ["rechazado", "rejected", "cancelado", "cancelled", "vencido"];
const ESTADOS_WARNING = ["refunded", "charged_back"];
const COLECCION_PAGOS = "pagos_adherentes";

const normalizarDni = (value) => String(value || "").replace(/[^\d]/g, "");

const obtenerSesionUsuario = () => {
  try {
    return JSON.parse(sessionStorage.getItem("user") || "{}") || {};
  } catch {
    return {};
  }
};

const obtenerDniSesion = (usuarioRedux = {}) => {
  const usuario = obtenerSesionUsuario();
  const posiblesDni = [
    localStorage.getItem("sidca_user_dni"),
    localStorage.getItem("userDni"),
    localStorage.getItem("dni"),
    usuarioRedux.dni,
    usuarioRedux.DNI,
    usuarioRedux.documento,
    usuarioRedux.user?.dni,
    usuarioRedux.user?.DNI,
    usuarioRedux.user?.documento,
    usuarioRedux.usuario?.dni,
    usuarioRedux.usuario?.DNI,
    usuarioRedux.usuario?.documento,
    usuarioRedux.data?.dni,
    usuarioRedux.data?.DNI,
    usuarioRedux.data?.documento,
    usuarioRedux.profile?.dni,
    usuarioRedux.profile?.DNI,
    usuarioRedux.profile?.documento,
    usuario.dni,
    usuario.DNI,
    usuario.documento,
  ];

  return normalizarDni(posiblesDni.find((value) => normalizarDni(value)));
};

const formatCurrency = (value) =>
  Number(value || 0).toLocaleString("es-AR", {
    style: "currency",
    currency: "ARS",
    maximumFractionDigits: 0,
  });

const parseDate = (value) => {
  if (!value) return null;
  if (typeof value?.toDate === "function") return value.toDate();
  if (typeof value === "number") return new Date(value);
  if (value?.seconds) return new Date(value.seconds * 1000);
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

const formatDate = (value) => {
  const date = parseDate(value);
  return date ? date.toLocaleDateString("es-AR") : "—";
};

const formatDateTime = (value) => {
  const date = parseDate(value);
  return date
    ? date.toLocaleString("es-AR", {
        dateStyle: "short",
        timeStyle: "short",
      })
    : "—";
};

const estadoNormalizado = (estado) => String(estado || "pendiente").toLowerCase();

const estadoLabel = (estado) => {
  const normalized = estadoNormalizado(estado);
  const labels = {
    approved: "Aprobado",
    aprobado: "Aprobado",
    pending: "Pendiente",
    pendiente: "Pendiente",
    in_process: "En proceso",
    rejected: "Rechazado",
    rechazado: "Rechazado",
    cancelled: "Cancelado",
    cancelado: "Cancelado",
    vencido: "Vencido",
    refunded: "Devuelto",
    charged_back: "Contracargo",
  };
  return labels[normalized] || normalized.charAt(0).toUpperCase() + normalized.slice(1);
};

const getStatusClass = (estado) => {
  const normalized = estadoNormalizado(estado);
  if (ESTADOS_APROBADOS.includes(normalized)) return styles.paid;
  if (ESTADOS_PENDIENTES.includes(normalized)) return styles.pending;
  if (ESTADOS_WARNING.includes(normalized)) return styles.warningStatus;
  if (ESTADOS_RECHAZADOS.includes(normalized)) return styles.rejected;
  return styles.neutralStatus;
};

const getPagoId = (pago) => pago?.id || pago?.pagoId || pago?.docId;
const getOperacion = (pago) =>
  pago?.mercadoPagoPaymentId ||
  pago?.paymentId ||
  pago?.numeroOperacion ||
  pago?.mercadoPagoPreferenceId ||
  "—";
const getMedio = (pago) =>
  pago?.medioPago || pago?.paymentMethodId || pago?.metodoPago || "Mercado Pago";
const getPeriodo = (pago) => pago?.periodo || pago?.periodoCuota || pago?.detallePeriodo || "—";

const ordenarPagos = (lista = []) =>
  [...lista].sort((a, b) => {
    const dateA = parseDate(a.fechaPago || a.updatedAt || a.fechaCreacion)?.getTime() || 0;
    const dateB = parseDate(b.fechaPago || b.updatedAt || b.fechaCreacion)?.getTime() || 0;
    return dateB - dateA;
  });

const unirPagos = (...listas) => {
  const mapa = new Map();
  listas.flat().forEach((pago) => {
    if (!pago) return;
    const key =
      getPagoId(pago) ||
      pago.mercadoPagoPreferenceId ||
      `${normalizarDni(pago.dni)}-${pago.concepto || ""}-${pago.detalle || ""}-${pago.importe || ""}`;
    mapa.set(key, { ...mapa.get(key), ...pago });
  });
  return ordenarPagos(Array.from(mapa.values()));
};

const obtenerPagosFirestorePorDni = async (dni) => {
  const dniLimpio = normalizarDni(dni);
  if (!dniLimpio) return [];

  const valores = [dniLimpio];
  const dniNumero = Number(dniLimpio);
  if (!Number.isNaN(dniNumero)) valores.push(dniNumero);

  const snaps = await Promise.all(
    valores.map((valor) =>
      getDocs(query(collection(db, COLECCION_PAGOS), where("dni", "==", valor), limit(100)))
    )
  );

  const mapa = new Map();
  snaps.forEach((snap) => {
    snap.docs.forEach((docSnap) => {
      mapa.set(docSnap.id, { id: docSnap.id, ...docSnap.data() });
    });
  });

  return Array.from(mapa.values());
};

const cargarImagen = (src) =>
  new Promise((resolve) => {
    const image = new Image();
    image.crossOrigin = "anonymous";
    image.onload = () => resolve(image);
    image.onerror = () => resolve(null);
    image.src = src;
  });

const generarComprobantePdf = async (pago) => {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const logo = await cargarImagen(sidcaLogo);

  if (logo) doc.addImage(logo, "PNG", 16, 12, 36, 24);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.text("Comprobante de pago", 105, 25, { align: "center" });

  doc.setFontSize(10);
  doc.setTextColor(90, 100, 115);
  doc.text("Sindicato de Docentes de Catamarca", 105, 32, { align: "center" });

  doc.setDrawColor(240, 180, 0);
  doc.setLineWidth(0.8);
  doc.line(16, 44, 194, 44);

  const filas = [
    ["Apellido y nombre", pago.afiliadoNombre || "—"],
    ["DNI", normalizarDni(pago.dni) || "—"],
    ["Concepto", pago.concepto || "Cuota sindical"],
    ["Período", getPeriodo(pago)],
    ["Detalle", pago.detalle || "Pago de cuota sindical"],
    ["Importe", formatCurrency(pago.importe)],
    ["Fecha", formatDateTime(pago.fechaPago || pago.updatedAt || pago.fechaCreacion)],
    ["Medio de pago", getMedio(pago)],
    ["Número de operación", getOperacion(pago)],
    ["Estado", estadoLabel(pago.estado)],
  ];

  let y = 58;
  filas.forEach(([label, value]) => {
    doc.setFont("helvetica", "bold");
    doc.setTextColor(85, 98, 118);
    doc.text(`${label}:`, 22, y);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(12, 26, 45);
    const lines = doc.splitTextToSize(String(value), 112);
    doc.text(lines, 72, y);
    y += Math.max(8, lines.length * 6);
  });

  doc.setFillColor(255, 248, 230);
  doc.roundedRect(20, y + 6, 170, 18, 3, 3, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(120, 78, 0);
  doc.text("Comprobante de pago. No válido como factura.", 105, y + 17, {
    align: "center",
  });

  doc.save(`comprobante-sidca-${normalizarDni(pago.dni) || "pago"}.pdf`);
};

const GestionPagos = () => {
  const [pagos, setPagos] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState("");
  const [creandoPagoId, setCreandoPagoId] = useState("");
  const [comprobante, setComprobante] = useState(null);
  const [descargandoId, setDescargandoId] = useState("");
  const location = useLocation();
  const usuarioRedux = useSelector((state) => state.user);

  const dniSesion = useMemo(() => obtenerDniSesion(usuarioRedux), [usuarioRedux]);

  const contextoSesionPago = useMemo(
    () => ({
      ...(usuarioRedux || {}),
      usuario: usuarioRedux,
      user: usuarioRedux,
      dni: dniSesion,
    }),
    [usuarioRedux, dniSesion]
  );

  const cargarPagos = useCallback(async () => {
    setCargando(true);
    setError("");
    const dniActual = obtenerDniSesion(usuarioRedux) || dniSesion;
    let pagosFirestore = [];
    let errorBackend = null;

    if (!dniActual) {
      setPagos([]);
      setError("No se encontrÃ³ el DNI de la sesiÃ³n. CerrÃ¡ sesiÃ³n e ingresÃ¡ nuevamente.");
      setCargando(false);
      return;
    }

    try {
      pagosFirestore = await obtenerPagosFirestorePorDni(dniActual);
    } catch (err) {
      console.warn("[GestionPagos] No se pudieron cargar pagos desde Firestore:", err);
    }

    try {
      const respuesta = await obtenerMisPagos(contextoSesionPago);
      const pagosBackend = respuesta?.pagos || respuesta?.data || [];
      setPagos(unirPagos(pagosFirestore, pagosBackend));
    } catch (err) {
      errorBackend = err;
      setPagos(ordenarPagos(pagosFirestore));
      if (pagosFirestore.length === 0 && err.status !== 401) {
        setError(err.message || "No se pudieron cargar tus pagos.");
      }
    } finally {
      if (errorBackend && pagosFirestore.length > 0) {
        setError("");
      }
      setCargando(false);
    }
  }, [usuarioRedux, dniSesion, contextoSesionPago]);

  useEffect(() => {
    cargarPagos();
  }, [cargarPagos]);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const pagoId = params.get("pagoId");
    if (!pagoId) return;

    consultarEstadoPago(pagoId, contextoSesionPago)
      .then(() => cargarPagos())
      .catch(() => {
        setError("Estamos verificando el estado del pago. Volvé a intentar en unos segundos.");
      });
  }, [location.search, cargarPagos, contextoSesionPago]);

  const pendientes = pagos.filter(
    (pago) => !ESTADOS_APROBADOS.includes(estadoNormalizado(pago.estado))
  );

  const aprobados = pagos.filter((pago) =>
    ESTADOS_APROBADOS.includes(estadoNormalizado(pago.estado))
  );

  const pagar = async (pago) => {
    const pagoId = getPagoId(pago);
    setError("");
    setCreandoPagoId(pagoId || "nuevo");

    try {
      const respuesta = await crearPreferenciaPago(
        dniSesion || pago.dni,
        pagoId,
        contextoSesionPago
      );
      const checkoutUrl =
        respuesta?.checkoutUrl ||
        respuesta?.sandbox_init_point ||
        respuesta?.init_point;

      if (!checkoutUrl) {
        throw new Error("El backend no devolvió el enlace de pago de Mercado Pago.");
      }

      window.location.assign(checkoutUrl);
    } catch (err) {
      setError(err.message || "No se pudo crear la orden de pago.");
      setCreandoPagoId("");
    }
  };

  const descargarComprobante = async (pago) => {
    const id = getPagoId(pago);
    setDescargandoId(id || "pdf");
    try {
      await generarComprobantePdf(pago);
    } finally {
      setDescargandoId("");
    }
  };

  return (
    <main className={styles.page}>
      <section className={styles.hero}>
        <p className={styles.kicker}>Autogestión</p>
        <h1>Gestión de Pagos</h1>
        <p>
          Desde este espacio podrás consultar pagos disponibles, abonar online con
          Mercado Pago y descargar tus comprobantes cuando el pago esté aprobado.
        </p>
      </section>

      <section className={styles.panel}>
        <div className={styles.sectionTitle}>
          <div>
            <p className={styles.kicker}>Pagos disponibles</p>
            <h2>Conceptos para abonar</h2>
          </div>
          <span className={styles.pendingBadge}>
            Checkout Pro {getMercadoPagoEnvironmentLabel()}
          </span>
        </div>

        {error && (
          <div className={styles.errorBox}>
            <p className={styles.error}>{error}</p>
            <button type="button" className={styles.secondaryButton} onClick={cargarPagos}>
              Reintentar
            </button>
          </div>
        )}
        {cargando && <p className={styles.empty}>Cargando tus pagos...</p>}

        {!cargando && !error && pendientes.length === 0 && (
          <p className={styles.empty}>No tenés pagos pendientes para abonar.</p>
        )}

        {!cargando && !error && pendientes.length > 0 && (
          <div className={styles.paymentGrid}>
            {pendientes.map((pago) => {
              const id = getPagoId(pago);
              const estado = estadoNormalizado(pago.estado);
              const rejected = ESTADOS_RECHAZADOS.includes(estado);
              return (
                <article key={id || `${pago.dni}-${pago.concepto}`} className={styles.paymentCard}>
                  <div>
                    <h3>{pago.concepto || "Cuota sindical"}</h3>
                    <p>{pago.detalle || "Regularizar situación de adherente"}</p>
                    <p>Período: {getPeriodo(pago)}</p>
                  </div>
                  <strong>{formatCurrency(pago.importe)}</strong>
                  <span className={`${styles.status} ${getStatusClass(pago.estado)}`}>
                    {estadoLabel(pago.estado)}
                  </span>
                  {rejected && (
                    <p className={styles.warningText}>
                      Este pago figura como {estadoLabel(pago.estado).toLowerCase()}. Si
                      corresponde, solicitá una nueva orden administrativa.
                    </p>
                  )}
                  <button
                    type="button"
                    onClick={() => pagar(pago)}
                    disabled={Boolean(creandoPagoId) || rejected}
                  >
                    {creandoPagoId === id || creandoPagoId === "nuevo"
                      ? "Generando orden..."
                      : "Pagar cuota sindical"}
                  </button>
                </article>
              );
            })}
          </div>
        )}
      </section>

      <section className={styles.panel}>
        <div className={styles.sectionTitle}>
          <div>
            <p className={styles.kicker}>Historial</p>
            <h2>Pagos realizados</h2>
          </div>
          <button type="button" className={styles.secondaryButton} onClick={cargarPagos}>
            Actualizar
          </button>
        </div>

        {!cargando && aprobados.length === 0 && (
          <p className={styles.empty}>Todavía no tenés comprobantes disponibles.</p>
        )}

        {aprobados.length > 0 && (
          <div className={styles.receiptList}>
            {aprobados.map((pago) => {
              const id = getPagoId(pago);
              return (
                <article key={id || `${pago.dni}-${pago.concepto}`} className={styles.receiptCard}>
                  <div>
                    <span>{formatDate(pago.fechaPago || pago.fechaCreacion)}</span>
                    <strong>{pago.concepto || "Cuota sindical"}</strong>
                    <p>{pago.detalle || `Período ${getPeriodo(pago)}`}</p>
                  </div>
                  <span>{getPeriodo(pago)}</span>
                  <strong>{formatCurrency(pago.importe)}</strong>
                  <span>{getMedio(pago)}</span>
                  <span className={`${styles.status} ${getStatusClass(pago.estado)}`}>
                    {estadoLabel(pago.estado)}
                  </span>
                  <div className={styles.receiptActions}>
                    <button type="button" onClick={() => setComprobante(pago)}>
                      Ver comprobante
                    </button>
                    <button
                      type="button"
                      onClick={() => descargarComprobante(pago)}
                      disabled={descargandoId === id}
                    >
                      {descargandoId === id ? "Generando..." : "Descargar comprobante"}
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>

      {comprobante && (
        <div className={styles.modalOverlay} role="dialog" aria-modal="true">
          <div className={styles.modal}>
            <div className={styles.modalHeader}>
              <h2>Comprobante de pago</h2>
              <button type="button" onClick={() => setComprobante(null)}>
                ×
              </button>
            </div>
            <div className={styles.receiptPreview}>
              <img src={sidcaLogo} alt="SIDCA" />
              <dl>
                <div>
                  <dt>Apellido y nombre</dt>
                  <dd>{comprobante.afiliadoNombre || "—"}</dd>
                </div>
                <div>
                  <dt>DNI</dt>
                  <dd>{normalizarDni(comprobante.dni) || "—"}</dd>
                </div>
                <div>
                  <dt>Concepto</dt>
                  <dd>{comprobante.concepto || "Cuota sindical"}</dd>
                </div>
                <div>
                  <dt>Período</dt>
                  <dd>{getPeriodo(comprobante)}</dd>
                </div>
                <div>
                  <dt>Importe</dt>
                  <dd>{formatCurrency(comprobante.importe)}</dd>
                </div>
                <div>
                  <dt>Fecha</dt>
                  <dd>{formatDateTime(comprobante.fechaPago || comprobante.fechaCreacion)}</dd>
                </div>
                <div>
                  <dt>Medio de pago</dt>
                  <dd>{getMedio(comprobante)}</dd>
                </div>
                <div>
                  <dt>Número de operación</dt>
                  <dd>{getOperacion(comprobante)}</dd>
                </div>
                <div>
                  <dt>Estado</dt>
                  <dd>{estadoLabel(comprobante.estado)}</dd>
                </div>
              </dl>
              <p className={styles.receiptLegend}>Comprobante de pago. No válido como factura.</p>
            </div>
            <div className={styles.modalActions}>
              <button type="button" onClick={() => setComprobante(null)}>
                Cerrar
              </button>
              <button type="button" onClick={() => descargarComprobante(comprobante)}>
                Descargar PDF
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
};

export default GestionPagos;
