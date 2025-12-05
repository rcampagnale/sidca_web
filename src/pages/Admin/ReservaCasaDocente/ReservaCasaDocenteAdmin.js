// src/pages/Admin/ReservaCasaDocente/ReservaCasaDocenteAdmin.js
import React, { useState, useMemo, useEffect } from "react";
import styles from "./ReservaCasaDocenteAdmin.module.css";
import HabitacionesAdmin from "./HabitacionesAdmin";
import BloqueoFecha from "./bloqueofecha";
import ReservarHabitacionAdmin from "./ReservarHabitacionAdmin";

import { dbReservas } from "../../../firebase/firebaseReservas";
import {
  collection,
  onSnapshot,
  query,
  orderBy,
  doc,
  updateDoc,
} from "firebase/firestore";

const ESTADOS = [
  { value: "todos", label: "Todos los estados" },
  { value: "pendiente", label: "Pendiente" },
  { value: "confirmada", label: "Confirmada" },
  { value: "rechazada", label: "Rechazada" },
];

/* =====================================
 * HELPERS DE FECHA / PRECIOS
 * ===================================== */

// 🔹 Convierte string o Timestamp a Date
const toDate = (valor) => {
  if (!valor) return null;

  // Timestamp de Firestore
  if (typeof valor === "object" && valor.toDate) {
    return valor.toDate();
  }

  const str = String(valor);
  const soloFecha = str.split("T")[0]; // "YYYY-MM-DD"
  const [yyyy, mm, dd] = soloFecha.split("-");
  if (yyyy && mm && dd) {
    return new Date(Number(yyyy), Number(mm) - 1, Number(dd));
  }

  const d = new Date(str);
  return isNaN(d.getTime()) ? null : d;
};

// 🔹 Calcula cantidad de noches entre ingreso y egreso
// Regla: 1 noche = desde las 12:00 hs (check-in) hasta las 10:00 hs del día siguiente (check-out)
const calcularNoches = (fechaIngreso, fechaEgreso) => {
  const dIng = toDate(fechaIngreso);
  const dEgr = toDate(fechaEgreso);
  if (!dIng || !dEgr) return 1;

  dIng.setHours(12, 0, 0, 0); // check-in 12:00
  dEgr.setHours(10, 0, 0, 0); // check-out 10:00

  const diffMs = dEgr.getTime() - dIng.getTime();
  const MS_PER_DAY = 1000 * 60 * 60 * 24;
  const noches = Math.ceil(diffMs / MS_PER_DAY);

  return noches <= 0 ? 1 : noches;
};

// 🔹 Calcula precios por reserva (admin)
const calcularPreciosReservaAdmin = (reserva, habitacion) => {
  if (!reserva && !habitacion) {
    return {
      precioAfNoche: 0,
      precioNoAfNoche: 0,
      precioFinalNoche: 0,
      noches: 0,
      totalReserva: 0,
      cantNoAfiliados: 0,
    };
  }

  const tipo = reserva?.tipo || habitacion?.tipo || "simple";

  // Precios por noche, priorizando lo guardado en la reserva
  const precioAfNoche =
    Number(
      reserva?.precioAfiliado ??
        reserva?.precioAfiliadoNoche ??
        habitacion?.precio ??
        0
    ) || 0;

  const precioNoAfNoche =
    Number(
      reserva?.precioNoAfiliado ??
        reserva?.precioNoAfiliadoNoche ??
        habitacion?.precioNoAfiliado ??
        0
    ) || 0;

  // Cantidad de no afiliados
  let cantNoAfiliados = 0;
  if (typeof reserva?.cantidadNoAfiliados === "number") {
    cantNoAfiliados = reserva.cantidadNoAfiliados;
  } else if (tipo !== "simple") {
    const personas = Number(reserva?.cantidadPersonas) || 1;
    cantNoAfiliados = Math.max(personas - 1, 0); // 1 afiliado + resto no afiliados
  }

  if (tipo === "simple") {
    cantNoAfiliados = 0;
  }

  // Precio final por noche: usa el campo guardado si existe, sino lo calcula
  let precioFinalNoche = Number(
    reserva?.precioFinal ?? reserva?.precioFinalNoche ?? 0
  );

  if (!precioFinalNoche && precioAfNoche) {
    if (tipo === "simple") {
      precioFinalNoche = precioAfNoche;
    } else {
      precioFinalNoche =
        precioAfNoche +
        (precioNoAfNoche > 0 ? cantNoAfiliados * precioNoAfNoche : 0);
    }
  }

  const noches = calcularNoches(reserva?.fechaIngreso, reserva?.fechaEgreso);
  const totalReserva = precioFinalNoche * (noches || 1);

  return {
    precioAfNoche,
    precioNoAfNoche,
    precioFinalNoche,
    noches,
    totalReserva,
    cantNoAfiliados,
  };
};

// 🔹 Formatea fechas "YYYY-MM-DD" o Timestamp a "DD-MM-YYYY"
const formatearFecha = (valor) => {
  if (!valor) return "-";

  // Firestore Timestamp
  if (typeof valor === "object" && valor.toDate) {
    const d = valor.toDate();
    const dd = String(d.getDate()).padStart(2, "0");
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const yyyy = d.getFullYear();
    return `${dd}-${mm}-${yyyy}`;
  }

  const str = String(valor);
  // Maneja "YYYY-MM-DD" o "YYYY-MM-DDTHH:mm:ss"
  const soloFecha = str.split("T")[0];
  const [yyyy, mm, dd] = soloFecha.split("-");

  if (yyyy && mm && dd) {
    return `${dd.padStart(2, "0")}-${mm.padStart(2, "0")}-${yyyy}`;
  }

  // Si viene en otro formato, lo devolvemos como está
  return str;
};

// 🔹 Formatea moneda con separador de miles
const formatCurrency = (valor) => {
  const num = Number(valor);
  if (!num) return "-";
  return `$${num.toLocaleString("es-AR")}`;
};

const ReservaCasaDocenteAdmin = () => {
  const [reservas, setReservas] = useState([]);
  const [cargandoReservas, setCargandoReservas] = useState(true);

  // 🔹 habitaciones (para poder mostrar precios por reserva)
  const [habitaciones, setHabitaciones] = useState([]);
  const [cargandoHabitaciones, setCargandoHabitaciones] = useState(true);

  // TAB ACTIVO: "reservas" | "habitaciones" | "bloqueos" | "reservar"
  const [activeTab, setActiveTab] = useState("reservas");

  // Filtros
  const [filtroDni, setFiltroDni] = useState("");
  const [filtroEstado, setFiltroEstado] = useState("todos");
  const [filtroDesde, setFiltroDesde] = useState("");
  const [filtroHasta, setFiltroHasta] = useState("");

  // Modal reservas
  const [selectedReserva, setSelectedReserva] = useState(null);
  const [modalEstado, setModalEstado] = useState("pendiente");
  const [modalNotas, setModalNotas] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);

  /* =====================================
   *   LISTENERS FIRESTORE
   * ===================================== */

  // 🔹 Cargar reservas en tiempo real
  useEffect(() => {
    const colRef = collection(dbReservas, "reservasCasaDocente");
    const q = query(colRef, orderBy("fechaIngreso", "desc"));

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const data = snapshot.docs.map((docSnap) => ({
          id: docSnap.id,
          ...docSnap.data(),
        }));
        setReservas(data);
        setCargandoReservas(false);
      },
      (error) => {
        console.error(
          "[ReservaCasaDocenteAdmin] Error al cargar reservas:",
          error
        );
        setCargandoReservas(false);
      }
    );

    return () => unsubscribe();
  }, []);

  // 🔹 Cargar habitaciones (para mostrar precios)
  useEffect(() => {
    const colRef = collection(dbReservas, "habitacionesCasaDocente");
    const q = query(colRef, orderBy("createdAt", "desc"));

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const data = snapshot.docs.map((docSnap) => ({
          id: docSnap.id,
          ...docSnap.data(),
        }));
        setHabitaciones(data);
        setCargandoHabitaciones(false);
      },
      (error) => {
        console.error(
          "[ReservaCasaDocenteAdmin] Error al cargar habitaciones:",
          error
        );
        setCargandoHabitaciones(false);
      }
    );

    return () => unsubscribe();
  }, []);

  // Mapa idHabitacion -> objeto habitación
  const habitacionesPorId = useMemo(() => {
    const mapa = {};
    habitaciones.forEach((h) => {
      mapa[h.id] = h;
    });
    return mapa;
  }, [habitaciones]);

  // Helper: obtener habitación asociada a la reserva
  const getHabitacionDeReserva = (reserva) => {
    if (!reserva) return null;
    if (reserva.idHabitacion && habitacionesPorId[reserva.idHabitacion]) {
      return habitacionesPorId[reserva.idHabitacion];
    }
    // Fallback: primera habitación del mismo tipo
    if (reserva.tipo) {
      return habitaciones.find((h) => h.tipo === reserva.tipo) || null;
    }
    return null;
  };

  /* =====================================
   *   FILTROS
   * ===================================== */

  const reservasFiltradas = useMemo(() => {
    // 1) Aplicamos filtros
    const filtradas = reservas.filter((r) => {
      if (filtroDni && !String(r.dni || "").includes(filtroDni.trim()))
        return false;
      if (filtroEstado !== "todos" && r.estado !== filtroEstado) return false;

      // Filtros de fecha
      if (filtroDesde && r.fechaIngreso < filtroDesde) return false;
      if (filtroHasta && r.fechaIngreso > filtroHasta) return false;

      return true;
    });

    // 2) Ordenamos por fecha de ingreso: más reciente → más vieja
    return filtradas.slice().sort((a, b) => {
      const da = toDate(a.fechaIngreso);
      const db = toDate(b.fechaIngreso);

      // Sin fecha van al final
      if (!da && !db) return 0;
      if (!da) return 1;
      if (!db) return -1;

      // Descendente
      return db - da;
    });
  }, [reservas, filtroDni, filtroEstado, filtroDesde, filtroHasta]);

  // 🔹 Limpiar filtros
  const handleLimpiarFiltros = () => {
    setFiltroDni("");
    setFiltroEstado("todos");
    setFiltroDesde("");
    setFiltroHasta("");
  };



  /* =====================================
   *   MODAL RESERVA
   * ===================================== */

  const abrirModal = (reserva) => {
    setSelectedReserva(reserva);
    setModalEstado(reserva.estado);
    setModalNotas(reserva.notasAdmin || "");
    setIsModalOpen(true);
  };

  const cerrarModal = () => {
    setIsModalOpen(false);
    setSelectedReserva(null);
  };

  // 👉 helpers para WhatsApp
  const normalizarCelular = (celularRaw) => {
    const soloNumeros = String(celularRaw || "").replace(/[^0-9]/g, "");
    if (!soloNumeros || soloNumeros.length < 8) return null;

    if (!soloNumeros.startsWith("54")) {
      return "54" + soloNumeros;
    }
    return soloNumeros;
  };

  const getNombreHabitacion = (reserva) => {
    return reserva.nombreHabitacion || reserva.idHabitacion || "-";
  };

  const getNombreEstilo = (tipo) => {
    const mapa = {
      simple: "Simple",
      doble: "Doble",
      triple: "Triple",
      cuadruple: "Cuádruple",
      departamento: "Departamento",
    };
    return mapa[tipo] || tipo || "-";
  };

  // Emojis para WhatsApp (Unicode seguro)
  const EMOJI_CLIPBOARD = "\uD83D\uDCCB"; // 📋
  const EMOJI_MONEY = "\uD83D\uDCB0"; // 💰
  const EMOJI_CLOCK = "\uD83D\uDD52"; // 🕒
  const EMOJI_WARNING = "\u26A0\uFE0F"; // ⚠️

  const buildWhatsappMessage = (reserva, nuevoEstado, notasAdmin) => {
    const estadoLabel =
      nuevoEstado === "confirmada" ? "CONFIRMADA" : "RECHAZADA";

    const nombre = reserva.apellidoNombre || "docente";
    const habitacion = getNombreHabitacion(reserva);
    const estilo = getNombreEstilo(reserva.tipo);
    const fechas = `${formatearFecha(
      reserva.fechaIngreso
    )} al ${formatearFecha(reserva.fechaEgreso)}`;
    const personas = reserva.cantidadPersonas || 1;

    // Encabezado + detalles
    let mensaje =
      `Hola ${nombre}, desde SIDCA te informamos que tu reserva en la Casa del Docente fue *${estadoLabel}*.\n\n` +
      `${EMOJI_CLIPBOARD} Detalles de la reserva:\n` +
      `* Habitación: ${habitacion} (${estilo})\n` +
      `* Fechas: ${fechas}\n` +
      `* Personas: ${personas}\n`;

    // Importe + horarios + importante SOLO si está confirmada
    if (nuevoEstado === "confirmada") {
      const hab = getHabitacionDeReserva(reserva);
      const { precioFinalNoche, noches, totalReserva } =
        calcularPreciosReservaAdmin(reserva, hab);

      mensaje += `\n${EMOJI_MONEY} Importe de la estadía:\n`;
      if (precioFinalNoche) {
        mensaje += `* Precio por noche: $${precioFinalNoche}\n`;
      }
      if (noches) {
        mensaje += `* Noches: ${noches}\n`;
      }
      if (totalReserva) {
        mensaje += `* Total: $${totalReserva}\n`;
      }

      mensaje +=
        `\n${EMOJI_CLOCK} Horarios:\n` +
        `* Check-in: 12:00 hs\n` +
        `* Check-out: 10:00 hs\n` +
        `\n${EMOJI_WARNING} Importante:\n` +
        `Te recordamos que el horario de check-out es a las 10:00 hs. Pasado ese horario, se genera automáticamente un día más de estadía, que se descuenta desde los servicios SIDCA.\n`;
    }

    // Motivo / comentarios (sirve tanto para confirmada como rechazada)
    if (notasAdmin && notasAdmin.trim()) {
      mensaje += `\nMotivo / comentarios: ${notasAdmin.trim()}\n`;
    }

    mensaje +=
      "\nAnte cualquier duda podés volver a comunicarte con SIDCA. ¡Muchas gracias!";

    return mensaje;
  };

  const handleGuardarCambios = async () => {
    if (!selectedReserva) return;

    const estadoAnterior = selectedReserva.estado;
    const nuevoEstado = modalEstado;

    try {
      const reservaRef = doc(
        dbReservas,
        "reservasCasaDocente",
        selectedReserva.id
      );

      await updateDoc(reservaRef, {
        estado: nuevoEstado,
        notasAdmin: modalNotas,
      });

      // 🔔 Si cambió el estado a CONFIRMADA o RECHAZADA, disparamos WhatsApp
      if (
        estadoAnterior !== nuevoEstado &&
        (nuevoEstado === "confirmada" || nuevoEstado === "rechazada")
      ) {
        const celularNormalizado = normalizarCelular(selectedReserva.celular);

        if (celularNormalizado) {
          const mensaje = buildWhatsappMessage(
            selectedReserva,
            nuevoEstado,
            modalNotas
          );

          try {
            const url = `https://wa.me/${celularNormalizado}?text=${encodeURIComponent(
              mensaje
            )}`;
            window.open(url, "_blank");
          } catch (err) {
            console.error(
              "[ReservaCasaDocenteAdmin] No se pudo abrir WhatsApp:",
              err
            );
          }
        } else {
          console.warn(
            "[ReservaCasaDocenteAdmin] No hay celular válido para enviar WhatsApp."
          );
        }
      }

      cerrarModal();
    } catch (error) {
      console.error(
        "[ReservaCasaDocenteAdmin] Error al actualizar reserva:",
        error
      );
      alert(
        "Ocurrió un error al actualizar la reserva. Revisá la consola para más detalles."
      );
    }
  };

  /* =====================================
   *   HELPERS VISUALES
   * ===================================== */

  const renderEstadoBadge = (estado) => {
    let className = styles.badge;
    if (estado === "pendiente") className += " " + styles.badgePendiente;
    if (estado === "confirmada") className += " " + styles.badgeConfirmada;
    if (estado === "rechazada") className += " " + styles.badgeRechazada;
    return (
      <span className={className}>{String(estado || "").toUpperCase()}</span>
    );
  };

  /* =====================================
   *   RENDER
   * ===================================== */

  return (
    <div className={styles.page}>
      {/* Header */}
      <div className={styles.header}>
        <h1 className={styles.title}>Administrar reservas - Casa del Docente</h1>
        <p className={styles.subtitle}>
          Desde este panel podés gestionar las reservas, las habitaciones, el
          bloqueo de fechas y registrar nuevas reservas de la Casa del Docente.
        </p>
      </div>

      {/* TABS */}
      <div className={styles.tabs}>
        <button
          type="button"
          className={`${styles.tabButton} ${
            activeTab === "reservas" ? styles.tabButtonActive : ""
          }`}
          onClick={() => setActiveTab("reservas")}
        >
          Reservas
        </button>
        <button
          type="button"
          className={`${styles.tabButton} ${
            activeTab === "habitaciones" ? styles.tabButtonActive : ""
          }`}
          onClick={() => setActiveTab("habitaciones")}
        >
          Habitaciones
        </button>
        <button
          type="button"
          className={`${styles.tabButton} ${
            activeTab === "bloqueos" ? styles.tabButtonActive : ""
          }`}
          onClick={() => setActiveTab("bloqueos")}
        >
          Bloqueo de fechas
        </button>
        <button
          type="button"
          className={`${styles.tabButton} ${
            activeTab === "reservar" ? styles.tabButtonActive : ""
          }`}
          onClick={() => setActiveTab("reservar")}
        >
          Reservar habitación
        </button>
      </div>

      {/* ========= TAB 1: RESERVAS ========= */}
      {activeTab === "reservas" && (
        <>
          {/* Filtros */}
          <section className={styles.filters}>
            <div className={styles.filterGroup}>
              <label className={styles.label} htmlFor="filtroDni">
                DNI
              </label>
              <input
                id="filtroDni"
                type="text"
                className={styles.input}
                value={filtroDni}
                onChange={(e) => setFiltroDni(e.target.value)}
                placeholder="Buscar por DNI"
              />
            </div>

            <div className={styles.filterGroup}>
              <label className={styles.label} htmlFor="filtroEstado">
                Estado
              </label>
              <select
                id="filtroEstado"
                className={styles.input}
                value={filtroEstado}
                onChange={(e) => setFiltroEstado(e.target.value)}
              >
                {ESTADOS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>

            <div className={styles.filterGroup}>
              <label className={styles.label} htmlFor="filtroDesde">
                Ingreso desde
              </label>
              <input
                id="filtroDesde"
                type="date"
                className={styles.input}
                value={filtroDesde}
                onChange={(e) => setFiltroDesde(e.target.value)}
              />
            </div>

            <div className={styles.filterGroup}>
              <label className={styles.label} htmlFor="filtroHasta">
                Ingreso hasta
              </label>
              <input
                id="filtroHasta"
                type="date"
                className={styles.input}
                value={filtroHasta}
                onChange={(e) => setFiltroHasta(e.target.value)}
              />
            </div>

            <div className={styles.filterActions}>
              <button
                type="button"
                className={styles.secondaryButton}
                onClick={handleLimpiarFiltros}
              >
                Limpiar filtros
              </button>
            </div>
          </section>

          {/* Tabla de reservas */}
          <section className={styles.tableSection}>
            <div className={styles.tableHeader}>
              <h2 className={styles.tableTitle}>
                Reservas ({reservasFiltradas.length})
              </h2>
            </div>

            <div className={styles.tableWrapper}>
              {cargandoReservas || cargandoHabitaciones ? (
                <p className={styles.emptyText}>Cargando reservas...</p>
              ) : reservasFiltradas.length === 0 ? (
                <p className={styles.emptyText}>
                  No se encontraron reservas con los filtros seleccionados.
                </p>
              ) : (
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th>Habitación</th>
                      <th>Estilo</th>
                      <th>Afiliado</th>
                      <th>DNI</th>
                      <th>Ingreso</th>
                      <th>Egreso</th>
                      <th>Personas</th>
                      <th>Precio afiliado</th>
                      <th>Precio no afiliado</th>
                      <th>Precio final (reserva)</th>
                      <th>Estado</th>
                      <th>Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {reservasFiltradas.map((r) => {
                      const hab = getHabitacionDeReserva(r);
                      const {
                        precioAfNoche,
                        precioNoAfNoche,
                        totalReserva,
                      } = calcularPreciosReservaAdmin(r, hab);

                      const precioAf = formatCurrency(precioAfNoche);
                      const precioNoAf = formatCurrency(precioNoAfNoche);
                      const precioFinal = formatCurrency(totalReserva);

                      return (
                        <tr key={r.id}>
                          <td>{getNombreHabitacion(r)}</td>
                          <td>{getNombreEstilo(r.tipo)}</td>
                          <td>{r.apellidoNombre}</td>
                          <td>{r.dni}</td>
                          <td>{formatearFecha(r.fechaIngreso)}</td>
                          <td>{formatearFecha(r.fechaEgreso)}</td>
                          <td>{r.cantidadPersonas}</td>
                          <td>{precioAf}</td>
                          <td>{precioNoAf}</td>
                          <td>{precioFinal}</td>
                          <td>{renderEstadoBadge(r.estado)}</td>
                          <td>
                            <button
                              type="button"
                              className={styles.linkButton}
                              onClick={() => abrirModal(r)}
                            >
                              Ver detalle
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          </section>

          {/* Modal de detalle / edición de reserva */}
          {isModalOpen && selectedReserva && (
            <div className={styles.modalOverlay}>
              <div className={styles.modal}>
                <div className={styles.modalHeader}>
                  <h3 className={styles.modalTitle}>
                    Reserva {selectedReserva.id} -{" "}
                    {selectedReserva.apellidoNombre}
                  </h3>
                  <button
                    type="button"
                    className={styles.modalClose}
                    onClick={cerrarModal}
                  >
                    ×
                  </button>
                </div>

                <div className={styles.modalBody}>
                  {(() => {
                    const hab = getHabitacionDeReserva(selectedReserva);
                    const {
                      precioAfNoche,
                      precioNoAfNoche,
                      precioFinalNoche,
                      noches,
                      totalReserva,
                      cantNoAfiliados,
                    } = calcularPreciosReservaAdmin(selectedReserva, hab);

                    const personas =
                      Number(selectedReserva.cantidadPersonas) || 1;
                    const tipo =
                      selectedReserva.tipo || hab?.tipo || "simple";

                    const afiliados =
                      tipo === "simple"
                        ? personas
                        : Math.max(personas - cantNoAfiliados, 1);

                    const detallePersonas =
                      tipo === "simple"
                        ? `${personas} (afiliado${
                            personas > 1 ? "s" : ""
                          }, sin acompañantes)`
                        : `${personas} → ${afiliados} afiliado${
                            afiliados !== 1 ? "s" : ""
                          } + ${cantNoAfiliados} acompañante${
                            cantNoAfiliados !== 1 ? "s" : ""
                          }`;

                    let detalleNoche = "-";
                    if (tipo === "simple" && precioAfNoche) {
                      detalleNoche = `Afiliado: ${formatCurrency(
                        precioAfNoche
                      )} por noche`;
                    } else if (
                      precioAfNoche &&
                      precioNoAfNoche &&
                      cantNoAfiliados >= 0
                    ) {
                      detalleNoche =
                        `${formatCurrency(
                          precioAfNoche
                        )} (afiliado) + ${cantNoAfiliados} × ${formatCurrency(
                          precioNoAfNoche
                        )} (acompañantes) = ` +
                        `${formatCurrency(precioFinalNoche)}`;
                    }

                    let detalleEstadia = "-";
                    if (noches && precioFinalNoche && totalReserva) {
                      detalleEstadia = `${noches} noche${
                        noches !== 1 ? "s" : ""
                      } × ${formatCurrency(
                        precioFinalNoche
                      )} = ${formatCurrency(totalReserva)}`;
                    }

                    return (
                      <>
                        <div className={styles.modalGrid}>
                          <div>
                            <p className={styles.modalLabel}>Habitación</p>
                            <p className={styles.modalValue}>
                              {getNombreHabitacion(selectedReserva)}
                            </p>
                          </div>
                          <div>
                            <p className={styles.modalLabel}>Estilo</p>
                            <p className={styles.modalValue}>
                              {getNombreEstilo(selectedReserva.tipo)}
                            </p>
                          </div>
                          <div>
                            <p className={styles.modalLabel}>DNI</p>
                            <p className={styles.modalValue}>
                              {selectedReserva.dni}
                            </p>
                          </div>
                          <div>
                            <p className={styles.modalLabel}>Email</p>
                            <p className={styles.modalValue}>
                              {selectedReserva.email}
                            </p>
                          </div>
                          <div>
                            <p className={styles.modalLabel}>Celular</p>
                            <p className={styles.modalValue}>
                              {selectedReserva.celular}
                            </p>
                          </div>
                          <div>
                            <p className={styles.modalLabel}>
                              Ingreso / Egreso
                            </p>
                            <p className={styles.modalValue}>
                              {formatearFecha(
                                selectedReserva.fechaIngreso
                              )}{" "}
                              &rarr;{" "}
                              {formatearFecha(selectedReserva.fechaEgreso)}
                            </p>
                          </div>
                          <div>
                            <p className={styles.modalLabel}>Personas</p>
                            <p className={styles.modalValue}>
                              {detallePersonas}
                            </p>
                          </div>
                          <div>
                            <p className={styles.modalLabel}>Motivo</p>
                            <p className={styles.modalValue}>
                              {selectedReserva.motivo}
                            </p>
                          </div>
                          <div>
                            <p className={styles.modalLabel}>
                              Fecha de solicitud
                            </p>
                            <p className={styles.modalValue}>
                              {formatearFecha(selectedReserva.fechaCreacion)}
                            </p>
                          </div>

                          {/* Precios */}
                          <div>
                            <p className={styles.modalLabel}>
                              Precio afiliado (noche)
                            </p>
                            <p className={styles.modalValue}>
                              {formatCurrency(precioAfNoche)}
                            </p>
                          </div>
                          <div>
                            <p className={styles.modalLabel}>
                              Precio no afiliado (noche)
                            </p>
                            <p className={styles.modalValue}>
                              {formatCurrency(precioNoAfNoche)}
                            </p>
                          </div>
                          <div>
                            <p className={styles.modalLabel}>Noches</p>
                            <p className={styles.modalValue}>
                              {noches || "-"}
                            </p>
                          </div>
                          <div>
                            <p className={styles.modalLabel}>
                              Precio final (noche)
                            </p>
                            <p className={styles.modalValue}>
                              {formatCurrency(precioFinalNoche)}
                            </p>
                          </div>
                          <div>
                            <p className={styles.modalLabel}>
                              Precio final (reserva)
                            </p>
                            <p className={styles.modalValue}>
                              {formatCurrency(totalReserva)}
                            </p>
                          </div>
                          <div>
                            <p className={styles.modalLabel}>
                              Detalle por noche
                            </p>
                            <p className={styles.modalValue}>
                              {detalleNoche}
                            </p>
                          </div>
                          <div>
                            <p className={styles.modalLabel}>
                              Detalle por estadía
                            </p>
                            <p className={styles.modalValue}>
                              {detalleEstadia}
                            </p>
                          </div>
                        </div>
                      </>
                    );
                  })()}

                  <div className={styles.modalFieldGroup}>
                    <label className={styles.label} htmlFor="modalEstado">
                      Estado de la reserva
                    </label>
                    <select
                      id="modalEstado"
                      className={styles.input}
                      value={modalEstado}
                      onChange={(e) => setModalEstado(e.target.value)}
                    >
                      <option value="pendiente">Pendiente</option>
                      <option value="confirmada">Confirmada</option>
                      <option value="rechazada">Rechazada</option>
                    </select>
                  </div>

                  <div className={styles.modalFieldGroup}>
                    <label className={styles.label} htmlFor="modalNotas">
                      Notas internas / comentarios
                    </label>
                    <textarea
                      id="modalNotas"
                      className={`${styles.input} ${styles.textarea}`}
                      value={modalNotas}
                      onChange={(e) => setModalNotas(e.target.value)}
                      placeholder="Ej: habitación asignada, observaciones, motivos de rechazo, etc."
                    />
                  </div>
                </div>

                <div className={styles.modalFooter}>
                  <button
                    type="button"
                    className={styles.secondaryButton}
                    onClick={cerrarModal}
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    className={styles.primaryButton}
                    onClick={handleGuardarCambios}
                  >
                    Guardar cambios
                  </button>
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {/* ========= TAB 2: HABITACIONES ========= */}
      {activeTab === "habitaciones" && <HabitacionesAdmin reservas={reservas} />}

      {/* ========= TAB 3: BLOQUEO DE FECHAS ========= */}
      {activeTab === "bloqueos" && <BloqueoFecha />}

      {/* ========= TAB 4: RESERVAR HABITACIÓN ========= */}
      {activeTab === "reservar" && <ReservarHabitacionAdmin />}
    </div>
  );
};

export default ReservaCasaDocenteAdmin;
