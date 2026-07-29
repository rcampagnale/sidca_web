import React, { useEffect, useMemo, useState } from "react";
import * as XLSX from "xlsx";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  where,
} from "firebase/firestore";
import { db } from "../../../firebase/firebase-config";
import styles from "./GestionPagosAdmin.module.css";

const COLECCION_PAGOS = "pagos_adherentes";

const CONCEPTOS = [
  "Cuota sindical adherente",
  "Turismo",
  "Cena del Maestro",
  "Otro",
];

const ESTADOS = [
  "pendiente",
  "approved",
  "in_process",
  "rejected",
  "cancelled",
  "vencido",
];

const FORM_INICIAL = {
  dni: "",
  afiliadoNombre: "",
  concepto: "Cuota sindical adherente",
  conceptoOtro: "",
  periodo: "",
  detalle: "",
  importe: "",
  estado: "pendiente",
  comprobanteUrl: "",
};

const normalizarDni = (value) => String(value || "").replace(/[^\d]/g, "");

const formatCurrency = (value) =>
  Number(value || 0).toLocaleString("es-AR", {
    style: "currency",
    currency: "ARS",
    maximumFractionDigits: 0,
  });

const parseDate = (value) => {
  if (!value) return null;
  if (typeof value?.toDate === "function") return value.toDate();
  if (value?.seconds) return new Date(value.seconds * 1000);
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

const formatDate = (value) => {
  const date = parseDate(value);
  return date ? date.toLocaleDateString("es-AR") : "—";
};

const estadoNormalizado = (estado) => String(estado || "pendiente").toLowerCase();

const estadoLabel = (estado) => {
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
  const normalized = estadoNormalizado(estado);
  return labels[normalized] || normalized;
};

const getNombreAfiliado = (data = {}) => {
  const nombreCompleto =
    data.apellidoNombre ||
    data.nombreCompleto ||
    data.apellido_y_nombre ||
    data["Apellido y Nombre"];
  if (nombreCompleto) return String(nombreCompleto).trim();

  const apellido = data.apellido || data.apellidos || "";
  const nombre = data.nombre || data.nombres || "";
  return `${apellido}, ${nombre}`.replace(/^,\s*/, "").trim();
};

const getStatusClass = (estado) => {
  const normalized = estadoNormalizado(estado);
  if (["approved", "aprobado"].includes(normalized)) return styles.aprobado;
  if (["pending", "pendiente", "in_process"].includes(normalized)) return styles.pendiente;
  if (["refunded", "charged_back"].includes(normalized)) return styles.warningStatus;
  return styles.rechazado;
};

const GestionPagosAdmin = () => {
  const [activeTab, setActiveTab] = useState("pagos");
  const [pagos, setPagos] = useState([]);
  const [config, setConfig] = useState({});
  const [form, setForm] = useState(FORM_INICIAL);
  const [modalAbierto, setModalAbierto] = useState(false);
  const [busqueda, setBusqueda] = useState("");
  const [filtroEstado, setFiltroEstado] = useState("");
  const [filtroPeriodo, setFiltroPeriodo] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [validando, setValidando] = useState(false);
  const [error, setError] = useState("");
  const [mensaje, setMensaje] = useState("");

  useEffect(() => {
    const unsubscribePagos = onSnapshot(
      query(collection(db, COLECCION_PAGOS), orderBy("fechaCreacion", "desc")),
      (snapshot) => {
        setPagos(snapshot.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() })));
      },
      () => setError("No se pudo cargar la colección pagos_adherentes.")
    );

    return unsubscribePagos;
  }, []);

  const resumen = useMemo(() => {
    const pendientes = pagos.filter((p) =>
      ["pendiente", "pending", "in_process"].includes(estadoNormalizado(p.estado))
    ).length;
    const aprobados = pagos.filter((p) =>
      ["approved", "aprobado"].includes(estadoNormalizado(p.estado))
    ).length;
    const totalAprobado = pagos
      .filter((p) => ["approved", "aprobado"].includes(estadoNormalizado(p.estado)))
      .reduce((acc, p) => acc + Number(p.importe || 0), 0);

    return [
      { label: "Órdenes", value: pagos.length, tone: "primary" },
      { label: "Pendientes", value: pendientes, tone: "warning" },
      { label: "Aprobadas", value: aprobados, tone: "success" },
      { label: "Total aprobado", value: formatCurrency(totalAprobado), tone: "neutral" },
    ];
  }, [pagos]);

  const pagosPorConcepto = useMemo(() => {
    const grupos = pagos.reduce((acc, pago) => {
      const concepto = pago.concepto || "Sin concepto";
      if (!acc[concepto]) {
        acc[concepto] = { concepto, cantidad: 0, pendientes: 0, aprobadas: 0, total: 0 };
      }
      acc[concepto].cantidad += 1;
      acc[concepto].total += Number(pago.importe || 0);
      if (["approved", "aprobado"].includes(estadoNormalizado(pago.estado))) {
        acc[concepto].aprobadas += 1;
      }
      if (["pendiente", "pending", "in_process"].includes(estadoNormalizado(pago.estado))) {
        acc[concepto].pendientes += 1;
      }
      return acc;
    }, {});

    return Object.values(grupos).sort((a, b) => b.cantidad - a.cantidad);
  }, [pagos]);

  const pagosFiltrados = useMemo(() => {
    const texto = busqueda.trim().toLowerCase();
    return pagos.filter((pago) => {
      const matchesTab =
        activeTab === "pagos"
          ? ["approved", "aprobado"].includes(estadoNormalizado(pago.estado))
          : activeTab === "pendientes"
          ? ["pendiente", "pending", "in_process"].includes(estadoNormalizado(pago.estado))
          : activeTab === "revision"
          ? Boolean(pago.revisionAdministrativa) ||
            ["rejected", "rechazado", "cancelled", "cancelado", "refunded", "charged_back"].includes(
              estadoNormalizado(pago.estado)
            )
          : true;

      const matchesTexto =
        !texto ||
        normalizarDni(pago.dni).includes(normalizarDni(texto)) ||
        String(pago.afiliadoNombre || "").toLowerCase().includes(texto) ||
        String(pago.concepto || "").toLowerCase().includes(texto);

      const matchesEstado = !filtroEstado || estadoNormalizado(pago.estado) === filtroEstado;
      const matchesPeriodo = !filtroPeriodo || String(pago.periodo || "").includes(filtroPeriodo);

      return matchesTab && matchesTexto && matchesEstado && matchesPeriodo;
    });
  }, [activeTab, busqueda, filtroEstado, filtroPeriodo, pagos]);

  const buscarDniEnColeccion = async (coleccion, dni) => {
    let snap = await getDocs(query(collection(db, coleccion), where("dni", "==", dni), limit(1)));
    if (!snap.empty) return { origen: coleccion, ...snap.docs[0].data() };

    const dniNumero = Number(dni);
    if (!Number.isNaN(dniNumero)) {
      snap = await getDocs(query(collection(db, coleccion), where("dni", "==", dniNumero), limit(1)));
      if (!snap.empty) return { origen: coleccion, ...snap.docs[0].data() };
    }
    return null;
  };

  const validarDni = async () => {
    const dni = normalizarDni(form.dni);
    setError("");
    setMensaje("");
    if (!dni) {
      setError("Ingresá un DNI para validar.");
      return;
    }

    setValidando(true);
    try {
      const [usuario, nuevoAfiliado] = await Promise.all([
        buscarDniEnColeccion("usuarios", dni),
        buscarDniEnColeccion("nuevoAfiliado", dni),
      ]);
      const afiliado = nuevoAfiliado || usuario;
      if (!afiliado) {
        setMensaje("No se encontró el DNI en usuarios ni en nuevoAfiliado.");
        return;
      }
      const nombre = getNombreAfiliado(afiliado);
      setForm((prev) => ({ ...prev, dni, afiliadoNombre: nombre || prev.afiliadoNombre }));
      setMensaje(`DNI validado desde ${afiliado.origen}: ${nombre || "afiliado encontrado"}.`);
    } catch (err) {
      setError("No se pudo validar el DNI.");
    } finally {
      setValidando(false);
    }
  };

  // Se conserva únicamente para que el bloque histórico, ya fuera de la interfaz,
  // no envíe formularios si vuelve a habilitarse durante una revisión.
  const guardarConfig = (event) => event.preventDefault();

  const crearOrden = async (event) => {
    event.preventDefault();
    setGuardando(true);
    setError("");

    const conceptoFinal = form.concepto === "Otro" ? form.conceptoOtro.trim() : form.concepto;
    const importe = Number(String(form.importe || "").replace(/[^\d]/g, ""));
    const dni = normalizarDni(form.dni);

    if (!dni || !form.afiliadoNombre.trim() || !conceptoFinal || !form.detalle.trim() || !importe) {
      setError("Completá DNI, afiliado, concepto, detalle e importe.");
      setGuardando(false);
      return;
    }

    try {
      await addDoc(collection(db, COLECCION_PAGOS), {
        dni,
        afiliadoNombre: form.afiliadoNombre.trim(),
        concepto: conceptoFinal,
        detalle: form.detalle.trim(),
        periodo: form.periodo.trim(),
        importe,
        moneda: "ARS",
        estado: form.estado,
        fechaCreacion: serverTimestamp(),
        fechaPago: null,
        mercadoPagoPreferenceId: "",
        mercadoPagoPaymentId: "",
        comprobanteUrl: form.comprobanteUrl.trim(),
        origen: "admin",
        revisionAdministrativa: false,
      });
      setModalAbierto(false);
      setForm(FORM_INICIAL);
      setMensaje("Orden creada en pagos_adherentes.");
    } catch (err) {
      setError("No se pudo crear la orden de pago.");
    } finally {
      setGuardando(false);
    }
  };

  const eliminarOrden = async (pago) => {
    const confirmar = window.confirm(
      `¿Deseás cancelar y eliminar la orden de ${pago.afiliadoNombre || "este afiliado"}?`
    );
    if (!confirmar) return;

    try {
      await deleteDoc(doc(db, COLECCION_PAGOS, pago.id));
    } catch (err) {
      setError("No se pudo cancelar y eliminar la orden.");
    }
  };

  const exportarExcel = () => {
    const rows = pagosFiltrados.map((pago) => ({
      DNI: pago.dni || "",
      "Apellido y nombre": pago.afiliadoNombre || "",
      Concepto: pago.concepto || "",
      Período: pago.periodo || "",
      Detalle: pago.detalle || "",
      Importe: Number(pago.importe || 0),
      Moneda: pago.moneda || "ARS",
      Estado: estadoLabel(pago.estado),
      "Fecha creación": formatDate(pago.fechaCreacion),
      "Fecha pago": formatDate(pago.fechaPago),
      "Preference ID": pago.mercadoPagoPreferenceId || "",
      "Payment ID": pago.mercadoPagoPaymentId || "",
      Comprobante: pago.comprobanteUrl || "",
    }));
    const worksheet = XLSX.utils.json_to_sheet(rows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Pagos");
    XLSX.writeFile(workbook, `pagos_adherentes_${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  return (
    <main className={styles.page}>
      <section className={styles.hero}>
        <div>
          <p className={styles.kicker}>Vista administrativa</p>
          <h1>Gestión de Pagos</h1>
          <p>
            Administración de órdenes de pago para cuota sindical adherente, turismo,
            Cena del Maestro y otros conceptos. Checkout Pro se crea desde backend seguro.
          </p>
        </div>
        <span className={styles.integrationBadge}>Checkout Pro prueba</span>
      </section>

      <section className={styles.summaryGrid}>
        {resumen.map((item) => (
          <article key={item.label} className={`${styles.summaryCard} ${styles[item.tone]}`}>
            <span>{item.label}</span>
            <strong>{item.value}</strong>
          </article>
        ))}
      </section>

      <section className={styles.tabs}>
        {[
          ["pagos", "Pagos recibidos"],
          ["pendientes", "Pendientes"],
          ["revision", "Revisión administrativa"],
        ].map(([key, label]) => (
          <button
            key={key}
            type="button"
            className={activeTab === key ? styles.activeTab : ""}
            onClick={() => setActiveTab(key)}
          >
            {label}
          </button>
        ))}
      </section>

      {error && <p className={styles.error}>{error}</p>}
      {mensaje && <p className={styles.validation}>{mensaje}</p>}

      {false && (
        <>
          <section className={styles.panel}>
            <div className={styles.sectionTitle}>
              <div>
                <p className={styles.kicker}>Configuración</p>
                <h2>config/cuotaAdherente</h2>
              </div>
              <button type="button" className={styles.primaryButton} onClick={() => setModalAbierto(true)}>
                + Crear orden de pago
              </button>
            </div>

            <form className={styles.paymentForm} onSubmit={guardarConfig}>
              <label>
                Habilitada
                <select
                  value={config.habilitada ? "true" : "false"}
                  onChange={(e) =>
                    setConfig((prev) => ({ ...prev, habilitada: e.target.value === "true" }))
                  }
                >
                  <option value="true">Sí</option>
                  <option value="false">No</option>
                </select>
              </label>
              <label>
                Período
                <input
                  value={config.periodo || ""}
                  onChange={(e) => setConfig((prev) => ({ ...prev, periodo: e.target.value }))}
                  placeholder="Ej: Julio 2026"
                />
              </label>
              <label>
                Importe
                <input
                  value={config.importe || ""}
                  onChange={(e) => setConfig((prev) => ({ ...prev, importe: e.target.value }))}
                  placeholder="Ej: 50000"
                  inputMode="numeric"
                />
              </label>
              <label>
                Moneda
                <input
                  value={config.moneda || "ARS"}
                  onChange={(e) => setConfig((prev) => ({ ...prev, moneda: e.target.value }))}
                />
              </label>
              <label>
                Concepto
                <input
                  value={config.concepto || ""}
                  onChange={(e) => setConfig((prev) => ({ ...prev, concepto: e.target.value }))}
                />
              </label>
              <label>
                Cuotas máximas
                <input
                  value={config.cuotasMaximas || 1}
                  onChange={(e) => setConfig((prev) => ({ ...prev, cuotasMaximas: e.target.value }))}
                  inputMode="numeric"
                />
              </label>
              <label className={styles.fullField}>
                Detalle
                <textarea
                  value={config.detalle || ""}
                  onChange={(e) => setConfig((prev) => ({ ...prev, detalle: e.target.value }))}
                />
              </label>
              <button type="submit" className={styles.primaryButton} disabled={guardando}>
                {guardando ? "Guardando..." : "Guardar configuración"}
              </button>
            </form>
          </section>

          <section className={styles.panel}>
            <div className={styles.sectionTitle}>
              <div>
                <p className={styles.kicker}>Conceptos</p>
                <h2>Órdenes por concepto</h2>
              </div>
            </div>
            {pagosPorConcepto.length === 0 ? (
              <p className={styles.empty}>Todavía no hay órdenes cargadas.</p>
            ) : (
              <div className={styles.conceptOrdersList}>
                {pagosPorConcepto.map((item) => (
                  <article key={item.concepto} className={styles.conceptOrderCard}>
                    <h3>{item.concepto}</h3>
                    <span>{item.cantidad} orden(es)</span>
                    <span>Pendientes: {item.pendientes}</span>
                    <span>Aprobadas: {item.aprobadas}</span>
                    <strong>{formatCurrency(item.total)}</strong>
                  </article>
                ))}
              </div>
            )}
          </section>
        </>
      )}

      {activeTab !== "configuracion" && (
        <section className={styles.panel}>
          <div className={styles.sectionTitle}>
            <div>
              <p className={styles.kicker}>Órdenes recientes</p>
              <h2>Seguimiento administrativo</h2>
            </div>
            <div className={styles.orderActions}>
              <button type="button" className={styles.secondaryButton} onClick={exportarExcel}>
                Exportar Excel
              </button>
              <button type="button" className={styles.primaryButton} onClick={() => setModalAbierto(true)}>
                + Crear orden de pago
              </button>
            </div>
          </div>

          <div className={styles.ordersToolbar}>
            <label>
              Buscar por DNI, nombre o concepto
              <input value={busqueda} onChange={(e) => setBusqueda(e.target.value)} />
            </label>
            <label>
              Estado
              <select value={filtroEstado} onChange={(e) => setFiltroEstado(e.target.value)}>
                <option value="">Todos</option>
                {ESTADOS.map((estado) => (
                  <option key={estado} value={estado}>
                    {estadoLabel(estado)}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Período
              <input
                value={filtroPeriodo}
                onChange={(e) => setFiltroPeriodo(e.target.value)}
                placeholder="Ej: Julio 2026"
              />
            </label>
          </div>

          <div className={styles.ordersList}>
            {pagosFiltrados.length === 0 ? (
              <p className={styles.empty}>No hay órdenes para los filtros seleccionados.</p>
            ) : (
              pagosFiltrados.map((pago) => (
                <article key={pago.id} className={styles.orderRow}>
                  <div>
                    <strong>{pago.afiliadoNombre || "Sin nombre"}</strong>
                    <span>DNI {pago.dni || "—"}</span>
                  </div>
                  <div>
                    <strong>{pago.concepto || "Sin concepto"}</strong>
                    <span>{pago.detalle || "—"}</span>
                  </div>
                  <strong>{formatCurrency(pago.importe)}</strong>
                  <span className={`${styles.status} ${getStatusClass(pago.estado)}`}>
                    {estadoLabel(pago.estado)}
                  </span>
                  <span>Creado {formatDate(pago.fechaCreacion)}</span>
                  <span>{pago.mercadoPagoPaymentId ? `Operación ${pago.mercadoPagoPaymentId}` : "Sin operación"}</span>
                  <div className={styles.orderActions}>
                    {!["approved", "aprobado"].includes(estadoNormalizado(pago.estado)) && (
                      <button
                        type="button"
                        className={styles.deleteButton}
                        onClick={() => eliminarOrden(pago)}
                      >
                        Cancelar y eliminar
                      </button>
                    )}
                  </div>
                </article>
              ))
            )}
          </div>
        </section>
      )}

      {modalAbierto && (
        <div className={styles.modalOverlay} role="dialog" aria-modal="true">
          <div className={styles.modal}>
            <div className={styles.modalHeader}>
              <h2>Crear orden de pago</h2>
              <button type="button" className={styles.closeButton} onClick={() => setModalAbierto(false)}>
                ×
              </button>
            </div>
            <form className={styles.paymentForm} onSubmit={crearOrden}>
              <label>
                DNI
                <div className={styles.dniRow}>
                  <input
                    value={form.dni}
                    onChange={(e) =>
                      setForm((prev) => ({ ...prev, dni: normalizarDni(e.target.value) }))
                    }
                    placeholder="DNI sin puntos"
                    inputMode="numeric"
                  />
                  <button type="button" className={styles.secondaryButton} onClick={validarDni} disabled={validando}>
                    {validando ? "Validando..." : "Validar DNI"}
                  </button>
                </div>
              </label>
              <label>
                Afiliado
                <input
                  value={form.afiliadoNombre}
                  onChange={(e) => setForm((prev) => ({ ...prev, afiliadoNombre: e.target.value }))}
                  placeholder="Apellido y nombre"
                />
              </label>
              <label>
                Concepto
                <select
                  value={form.concepto}
                  onChange={(e) => setForm((prev) => ({ ...prev, concepto: e.target.value }))}
                >
                  {CONCEPTOS.map((concepto) => (
                    <option key={concepto} value={concepto}>
                      {concepto}
                    </option>
                  ))}
                </select>
              </label>
              {form.concepto === "Otro" && (
                <label>
                  Nombre del concepto
                  <input
                    value={form.conceptoOtro}
                    onChange={(e) => setForm((prev) => ({ ...prev, conceptoOtro: e.target.value }))}
                  />
                </label>
              )}
              <label>
                Período
                <input
                  value={form.periodo}
                  onChange={(e) => setForm((prev) => ({ ...prev, periodo: e.target.value }))}
                  placeholder="Ej: Julio 2026"
                />
              </label>
              <label>
                Importe
                <input
                  value={form.importe}
                  onChange={(e) => setForm((prev) => ({ ...prev, importe: e.target.value }))}
                  inputMode="numeric"
                  placeholder="Ej: 50000"
                />
              </label>
              <label>
                Estado
                <select
                  value={form.estado}
                  onChange={(e) => setForm((prev) => ({ ...prev, estado: e.target.value }))}
                >
                  {ESTADOS.map((estado) => (
                    <option key={estado} value={estado}>
                      {estadoLabel(estado)}
                    </option>
                  ))}
                </select>
              </label>
              <label className={styles.fullField}>
                Detalle
                <textarea
                  value={form.detalle}
                  onChange={(e) => setForm((prev) => ({ ...prev, detalle: e.target.value }))}
                  placeholder="Ej: cuota julio 2026, saldo viaje, reserva cena..."
                />
              </label>
              <label className={styles.fullField}>
                Comprobante URL o dato del comprobante
                <input
                  value={form.comprobanteUrl}
                  onChange={(e) => setForm((prev) => ({ ...prev, comprobanteUrl: e.target.value }))}
                  placeholder="Opcional por ahora"
                />
              </label>
              <div className={styles.modalActions}>
                <button type="button" className={styles.secondaryButton} onClick={() => setModalAbierto(false)}>
                  Cancelar
                </button>
                <button type="submit" className={styles.primaryButton} disabled={guardando}>
                  {guardando ? "Creando..." : "Crear orden de pago"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </main>
  );
};

export default GestionPagosAdmin;
