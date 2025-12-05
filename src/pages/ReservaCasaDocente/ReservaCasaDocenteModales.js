// src/pages/ReservaCasaDocente/ReservaCasaDocenteModales.js
import React, { useState, useEffect } from "react";
import styles from "./ReservaCasaDocente.module.css";

// Firebase reservas (sidcareservas)
import { dbReservas } from "../../firebase/firebaseReservas";
// Firebase principal SIDCA (usuarios / nuevoAfiliado)
import { db as dbSidca } from "../../firebase/firebase-config";

import {
  collection,
  getDocs,
  query,
  where,
  addDoc,
} from "firebase/firestore";

/* ======================
 * Helpers generales
 * ====================== */

// 🔹 Máximo de no afiliados por habitación (en base a camas)
const getMaxNoAfiliados = (habitacion, tipo) => {
  if (!habitacion) return 0;
  if (tipo === "simple") return 0;
  const camas = Number(habitacion.camas) || 1;
  return Math.max(camas - 1, 0); // 1 afiliado + resto no afiliados
};

// 🔹 Cálculo de precios por reserva (POR NOCHE: 1 afiliado + no afiliados)
const calcularPreciosReserva = (habitacion, tipo, cantidadNoAfiliados) => {
  const precioAfiliado = Number(habitacion?.precio) || 0;
  const precioNoAfiliado = Number(habitacion?.precioNoAfiliado) || 0;

  if (!precioAfiliado) {
    return { precioAfiliado, precioNoAfiliado, precioFinal: 0 };
  }

  if (tipo === "simple") {
    return { precioAfiliado, precioNoAfiliado, precioFinal: precioAfiliado };
  }

  const cant = Math.max(Number(cantidadNoAfiliados) || 0, 0);
  const precioFinal =
    precioAfiliado + (precioNoAfiliado > 0 ? cant * precioNoAfiliado : 0);

  return { precioAfiliado, precioNoAfiliado, precioFinal };
};

// 🔹 Calcula cantidad de noches entre ingreso y egreso
const calcularNoches = (fechaIngreso, fechaEgreso) => {
  if (!fechaIngreso || !fechaEgreso) return 0;

  const inicio = new Date(fechaIngreso);
  const fin = new Date(fechaEgreso);

  if (isNaN(inicio.getTime()) || isNaN(fin.getTime())) return 0;

  const diffMs = fin.getTime() - inicio.getTime();
  const diffDias = Math.round(diffMs / (1000 * 60 * 60 * 24));

  // Si ponen misma fecha o algo raro, consideramos mínimo 1 noche
  return diffDias <= 0 ? 1 : diffDias;
};

const normalizarEstado = (raw) => {
  const e = (raw || "pendiente").toLowerCase();
  if (e === "pendiente") return "Pendiente de confirmación";
  if (e === "confirmada") return "Confirmada";
  if (e === "rechazada") return "Rechazada";
  if (e === "cancelada") return "Cancelada";
  return raw || "Pendiente";
};

const ReservaCasaDocenteModales = ({
  isReservaModalOpen,
  onCloseReserva,
  tipoSeleccionado,
  habitaciones,
  isConsultaModalOpen,
  onCloseConsulta,
  TIPOS_HABITACION,
}) => {
  /* ======================
   * Helpers locales
   * ====================== */
  const getTipoById = (tipoId) =>
    TIPOS_HABITACION.find((t) => t.id === tipoId);

  /* ======================
   * Estado: modal de reserva
   * ====================== */
  const [fechaIngreso, setFechaIngreso] = useState("");
  const [fechaEgreso, setFechaEgreso] = useState("");
  const [checkingDisponibilidad, setCheckingDisponibilidad] = useState(false);
  const [mensajeDisponibilidad, setMensajeDisponibilidad] = useState("");
  const [errorFechas, setErrorFechas] = useState("");
  const [disponibilidadOk, setDisponibilidadOk] = useState(false);
  const [habitacionAsignable, setHabitacionAsignable] = useState(null);
  const [cantidadNoAfiliados, setCantidadNoAfiliados] = useState(0);

  const [formNombre, setFormNombre] = useState("");
  const [formDni, setFormDni] = useState("");
  const [formEmail, setFormEmail] = useState("");
  const [formCelular, setFormCelular] = useState("");
  const [formComentario, setFormComentario] = useState("");
  const [formError, setFormError] = useState("");
  const [sendingReserva, setSendingReserva] = useState(false);
  const [reservaConfirmada, setReservaConfirmada] = useState(false);

  const [dniBusqueda, setDniBusqueda] = useState("");
  const [buscandoAfiliado, setBuscandoAfiliado] = useState(false);
  const [mensajeAutofill, setMensajeAutofill] = useState("");
  const [autofillOk, setAutofillOk] = useState(false);

  const [emailBloqueado, setEmailBloqueado] = useState(false);
  const [celularBloqueado, setCelularBloqueado] = useState(false);
  const [aceptaDescuento, setAceptaDescuento] = useState(false);

  /* ======================
   * Estado: modal consulta reserva
   * ====================== */
  const [dniConsulta, setDniConsulta] = useState("");
  const [consultaLoading, setConsultaLoading] = useState(false);
  const [consultaResultados, setConsultaResultados] = useState([]);
  const [consultaMensaje, setConsultaMensaje] = useState("");

  /* ======================
   * Efectos de apertura/cierre
   * ====================== */

  // Cuando se abre el modal de reserva, reseteamos todo
  useEffect(() => {
    if (isReservaModalOpen) {
      setFechaIngreso("");
      setFechaEgreso("");
      setMensajeDisponibilidad("");
      setErrorFechas("");
      setDisponibilidadOk(false);
      setHabitacionAsignable(null);
      setCantidadNoAfiliados(0);

      setFormNombre("");
      setFormDni("");
      setFormEmail("");
      setFormCelular("");
      setFormComentario("");
      setFormError("");
      setSendingReserva(false);
      setReservaConfirmada(false);

      setDniBusqueda("");
      setBuscandoAfiliado(false);
      setMensajeAutofill("");
      setAutofillOk(false);

      setEmailBloqueado(false);
      setCelularBloqueado(false);
      setAceptaDescuento(false);
    }
  }, [isReservaModalOpen, tipoSeleccionado]);

  // Si cambian las fechas, reseteamos disponibilidad
  useEffect(() => {
    if (!isReservaModalOpen) return;
    setDisponibilidadOk(false);
    setMensajeDisponibilidad("");
    setHabitacionAsignable(null);
    setCantidadNoAfiliados(0);
  }, [fechaIngreso, fechaEgreso, isReservaModalOpen]);

  // Al abrir el modal de consulta, reseteamos búsqueda
  useEffect(() => {
    if (isConsultaModalOpen) {
      setDniConsulta("");
      setConsultaResultados([]);
      setConsultaMensaje("");
      setConsultaLoading(false);
    }
  }, [isConsultaModalOpen]);

  /* ======================
   * Buscar afiliado por DNI
   * ====================== */

  const handleBuscarAfiliado = async () => {
    const dni = dniBusqueda.trim();
    if (!dni) {
      setMensajeAutofill("Ingresá un DNI para buscar tus datos.");
      setAutofillOk(false);
      return;
    }

    setBuscandoAfiliado(true);
    setMensajeAutofill("");
    setAutofillOk(false);

    try {
      let docData = null;

      // 1) Colección usuarios
      const colUsuarios = collection(dbSidca, "usuarios");
      let qUsuarios = query(colUsuarios, where("dni", "==", dni));
      let snap = await getDocs(qUsuarios);

      if (!snap.empty) {
        docData = snap.docs[0].data();
      } else {
        // 2) Colección nuevoAfiliado
        const colNuevo = collection(dbSidca, "nuevoAfiliado");
        const qNuevo = query(colNuevo, where("dni", "==", dni));
        snap = await getDocs(qNuevo);
        if (!snap.empty) {
          docData = snap.docs[0].data();
        }
      }

      if (!docData) {
        setMensajeAutofill("No se encontró un afiliado con ese DNI.");
        setAutofillOk(false);
        return;
      }

      const apellido =
        docData.apellido ||
        docData.Apellido ||
        (docData.apellidoNombre
          ? String(docData.apellidoNombre).split(",")[0]
          : "");
      const nombre =
        docData.nombre ||
        docData.Nombre ||
        (docData.apellidoNombre
          ? String(docData.apellidoNombre).split(",")[1]
          : "");
      const apellidoNombre =
        docData.apellidoNombre ||
        `${apellido || ""} ${nombre || ""}`.trim();

      const email =
        docData.email || docData.Email || docData.correo || "";
      const celular =
        docData.celular ||
        docData.telefono ||
        docData.cel ||
        "";

      if (apellidoNombre) setFormNombre(apellidoNombre);
      setFormDni(dni);

      // Email
      if (email) {
        setFormEmail(email);
        setEmailBloqueado(true);
      } else {
        setFormEmail("");
        setEmailBloqueado(false);
      }

      // Celular
      if (celular) {
        setFormCelular(celular);
        setCelularBloqueado(true);
      } else {
        setFormCelular("");
        setCelularBloqueado(false);
      }

      setAutofillOk(true);
      setMensajeAutofill("Datos cargados desde el padrón de afiliados.");
    } catch (error) {
      console.error(
        "[ReservaCasaDocente] Error buscando afiliado por DNI:",
        error
      );
      setMensajeAutofill(
        "Ocurrió un problema al buscar tus datos. Intentá nuevamente."
      );
      setAutofillOk(false);
    } finally {
      setBuscandoAfiliado(false);
    }
  };

  /* ======================
   * Consultar disponibilidad
   * ====================== */

  const consultarDisponibilidad = async () => {
    setErrorFechas("");
    setMensajeDisponibilidad("");
    setDisponibilidadOk(false);
    setHabitacionAsignable(null);
    setCantidadNoAfiliados(0);

    if (!fechaIngreso || !fechaEgreso) {
      setErrorFechas("Por favor seleccioná fecha de ingreso y egreso.");
      return;
    }

    if (fechaIngreso > fechaEgreso) {
      setErrorFechas(
        "La fecha de ingreso no puede ser posterior a la fecha de egreso."
      );
      return;
    }

    if (!tipoSeleccionado) {
      setErrorFechas("Ocurrió un problema con el tipo de habitación.");
      return;
    }

    const habitacionesTipo = habitaciones.filter(
      (h) => h.tipo === tipoSeleccionado && h.activa !== false
    );

    if (habitacionesTipo.length === 0) {
      setMensajeDisponibilidad(
        "Por el momento no hay habitaciones de este tipo habilitadas."
      );
      return;
    }

    try {
      setCheckingDisponibilidad(true);

      const solIng = fechaIngreso;
      const solEgr = fechaEgreso;

      /* ===============================
       * 1) CHEQUEAR BLOQUEOS DE FECHAS
       * =============================== */
      try {
        const colBloqueos = collection(dbReservas, "bloqueosCasaDocente");
        // Bloqueos que aplican a este tipo o a todas las habitaciones
        const qBloq = query(
          colBloqueos,
          where("tipo", "in", [tipoSeleccionado, "todos"])
        );
        const snapBloq = await getDocs(qBloq);
        const bloqueos = snapBloq.docs.map((d) => d.data());

        const bloqueoEncontrado = bloqueos.find((b) => {
          const bIng = b.fechaIngreso;
          const bEgr = b.fechaEgreso;
          // Rango solapado
          return bEgr >= solIng && bIng <= solEgr;
        });

        if (bloqueoEncontrado) {
          const motivoTxt = bloqueoEncontrado.motivo
            ? ` Motivo: ${bloqueoEncontrado.motivo}.`
            : "";
          setMensajeDisponibilidad(
            "Las fechas seleccionadas se encuentran bloqueadas para este tipo de habitación. Por favor elegí otro rango de fechas." +
              motivoTxt
          );
          setDisponibilidadOk(false);
          setHabitacionAsignable(null);
          setCheckingDisponibilidad(false);
          return; // No seguimos con la lógica de reservas
        }
      } catch (errBloq) {
        console.error(
          "[ReservaCasaDocente] Error al chequear bloqueos de fechas:",
          errBloq
        );
        // Si falla el chequeo de bloqueos, seguimos con la comprobación normal de reservas
      }

      /* ==================================
       * 2) CHEQUEAR RESERVAS YA EXISTENTES
       * ================================== */
      const colReservas = collection(dbReservas, "reservasCasaDocente");
      const qRes = query(colReservas, where("tipo", "==", tipoSeleccionado));
      const snapshot = await getDocs(qRes);
      const reservas = snapshot.docs.map((d) => d.data());

      let reservasSuperpuestas = 0;

      reservas.forEach((r) => {
        const rIng = r.fechaIngreso;
        const rEgr = r.fechaEgreso;
        const estado = (r.estado || "pendiente").toLowerCase();
        if (estado === "cancelada") return;
        if (rEgr >= solIng && rIng <= solEgr) {
          reservasSuperpuestas += 1;
        }
      });

      if (reservasSuperpuestas < habitacionesTipo.length) {
        const disponibles = habitacionesTipo.length - reservasSuperpuestas;
        setDisponibilidadOk(true);
        setHabitacionAsignable(habitacionesTipo[0]);
        setCantidadNoAfiliados(0); // arrancamos sin no afiliados
        setMensajeDisponibilidad(
          `Hay disponibilidad para las fechas seleccionadas. Habitaciones libres estimadas: ${disponibles}.`
        );
      } else {
        setDisponibilidadOk(false);
        setHabitacionAsignable(null);
        setMensajeDisponibilidad(
          "No se encontraron habitaciones disponibles de este tipo para las fechas seleccionadas."
        );
      }
    } catch (error) {
      console.error(
        "[ReservaCasaDocente] Error al consultar disponibilidad:",
        error
      );
      setMensajeDisponibilidad(
        "Ocurrió un problema al consultar la disponibilidad. Intentá nuevamente."
      );
    } finally {
      setCheckingDisponibilidad(false);
    }
  };

  /* ======================
   * Confirmar / guardar reserva
   * ====================== */

  const confirmarReserva = async () => {
    setFormError("");

    if (!disponibilidadOk || !habitacionAsignable) {
      setFormError(
        "Primero tenés que consultar disponibilidad y confirmar que haya lugar."
      );
      return;
    }

    if (!fechaIngreso || !fechaEgreso) {
      setFormError("Las fechas de ingreso y egreso son obligatorias.");
      return;
    }

    if (!formNombre.trim()) {
      setFormError(
        "No se pudo obtener tu Apellido y Nombre desde el padrón. Verificá el DNI."
      );
      return;
    }

    if (!formDni.trim()) {
      setFormError("No se pudo obtener tu DNI desde el padrón.");
      return;
    }

    if (!formEmail.trim() || !formEmail.includes("@")) {
      setFormError("Ingresá un correo electrónico válido.");
      return;
    }

    if (!formCelular.trim()) {
      setFormError("Ingresá un número de celular de contacto.");
      return;
    }

    // ✅ Aceptación obligatoria
    if (!aceptaDescuento) {
      setFormError(
        "Para registrar la reserva debés aceptar el descuento sobre tu recibo de sueldo."
      );
      return;
    }

    try {
      setSendingReserva(true);

      // 🔢 Limitar no afiliados al máximo permitido
      const maxNoAfiliados = getMaxNoAfiliados(
        habitacionAsignable,
        tipoSeleccionado
      );
      const cantNoAfiliados =
        tipoSeleccionado === "simple"
          ? 0
          : Math.min(
              Math.max(Number(cantidadNoAfiliados) || 0, 0),
              maxNoAfiliados
            );

      const { precioAfiliado, precioNoAfiliado, precioFinal } =
        calcularPreciosReserva(
          habitacionAsignable,
          tipoSeleccionado,
          cantNoAfiliados
        );

      const noches = calcularNoches(fechaIngreso, fechaEgreso);
      const precioTotalEstadia =
        noches > 0 ? precioFinal * noches : precioFinal;

      const colReservas = collection(dbReservas, "reservasCasaDocente");
      const nuevaReserva = {
        tipo: tipoSeleccionado,
        idHabitacion: habitacionAsignable.id || null,
        nombreHabitacion: habitacionAsignable.nombre || "",
        fechaIngreso,
        fechaEgreso,
        noches,
        cantidadPersonas: 1 + cantNoAfiliados,
        cantidadNoAfiliados: cantNoAfiliados,
        precioAfiliado,
        precioNoAfiliado,
        precioFinal, // por noche
        precioTotalEstadia, // total noches
        apellidoNombre: formNombre.trim(),
        dni: formDni.trim(),
        email: formEmail.trim(),
        celular: formCelular.trim(),
        comentario: formComentario.trim() || "",
        estado: "pendiente",
        fechaCreacion: new Date().toISOString(),
        origen: "web-publica",
        aceptaDescuento: !!aceptaDescuento,
      };

      await addDoc(colReservas, nuevaReserva);

      setReservaConfirmada(true);
      setMensajeDisponibilidad(
        "Tu solicitud de reserva fue registrada correctamente. El equipo de SIDCA confirmará la reserva por los canales de contacto habituales."
      );

      // 📲 Abrir WhatsApp con mensaje
      try {
        // 54 (AR) + 3834012228
        const phoneWithCountry = "543834012228";
        const tipoNombre =
          getTipoById(tipoSeleccionado)?.nombre || "habitación";

        const comentarioExtra = formComentario.trim()
          ? `\n• Comentario: ${formComentario.trim()}`
          : "";

        const preciosExtra =
          precioAfiliado || precioNoAfiliado || precioFinal
            ? `\n\nDetalle de precios:\n` +
              `• Precio afiliado por noche: $${precioAfiliado || 0}\n` +
              (tipoSeleccionado !== "simple"
                ? `• Precio no afiliado por noche: $${precioNoAfiliado || 0}\n` +
                  `• Cant. no afiliados: ${cantNoAfiliados}\n`
                : "") +
              `• Precio final por noche (${1 + cantNoAfiliados} persona/s): $${precioFinal || 0}\n` +
              `• Noches: ${noches}\n` +
              `• Precio total estimado estadía: $${precioTotalEstadia || 0}`
            : "";

        const mensajeWhatsapp =
          `Su reserva se encuentra en estado "pedido". ` +
          `Aguarde por su confirmación.\n\n` +
          `Datos de la reserva:\n` +
          `• Tipo: ${tipoNombre}\n` +
          `• Fechas: ${fechaIngreso} al ${fechaEgreso}\n` +
          `• Apellido y nombre: ${formNombre.trim()}\n` +
          `• DNI: ${formDni.trim()}\n` +
          `• Celular de contacto: ${formCelular.trim()}` +
          comentarioExtra +
          preciosExtra;

        const url = `https://wa.me/${phoneWithCountry}?text=${encodeURIComponent(
          mensajeWhatsapp
        )}`;

        window.open(url, "_blank");
      } catch (err) {
        console.error("[ReservaCasaDocente] No se pudo abrir WhatsApp:", err);
      }
    } catch (error) {
      console.error(
        "[ReservaCasaDocente] Error al guardar la reserva:",
        error
      );
      setFormError(
        "Ocurrió un problema al registrar la reserva. Intentá nuevamente en unos minutos."
      );
    } finally {
      setSendingReserva(false);
    }
  };

  /* ======================
   * Consultar reservas por DNI
   * ====================== */

  const handleConsultarReserva = async () => {
    const dni = dniConsulta.trim();
    if (!dni) {
      setConsultaMensaje("Ingresá tu DNI para buscar tus reservas.");
      setConsultaResultados([]);
      return;
    }

    setConsultaLoading(true);
    setConsultaMensaje("");
    setConsultaResultados([]);

    try {
      const colReservas = collection(dbReservas, "reservasCasaDocente");
      const qRes = query(colReservas, where("dni", "==", dni));
      const snapshot = await getDocs(qRes);

      if (snapshot.empty) {
        setConsultaMensaje(
          "No se encontraron reservas registradas para ese DNI."
        );
        return;
      }

      const resultados = snapshot.docs.map((docSnap) => ({
        id: docSnap.id,
        ...docSnap.data(),
      }));

      // Ordenamos por fechaCreacion descendente (si existe)
      resultados.sort((a, b) => {
        const fa = a.fechaCreacion || "";
        const fb = b.fechaCreacion || "";
        return fb.localeCompare(fa);
      });

      setConsultaResultados(resultados);
    } catch (error) {
      console.error(
        "[ReservaCasaDocente] Error al consultar reservas por DNI:",
        error
      );
      setConsultaMensaje(
        "Ocurrió un problema al buscar tu reserva. Intentá nuevamente."
      );
    } finally {
      setConsultaLoading(false);
    }
  };

  /* ======================
   * Render
   * ====================== */

  return (
    <>
      {/* MODAL: Consulta de disponibilidad + datos de reserva */}
      {isReservaModalOpen && (
        <div className={styles.reservaModalOverlay}>
          <div className={styles.reservaModal}>
            <div className={styles.reservaModalHeader}>
              <h3 className={styles.reservaModalTitle}>
                Reservar{" "}
                {getTipoById(tipoSeleccionado)?.nombre || "habitación"}
              </h3>
              <button
                type="button"
                className={styles.reservaModalClose}
                onClick={onCloseReserva}
              >
                ×
              </button>
            </div>

            <div className={styles.reservaModalBody}>
              <p className={styles.reservaModalInfo}>
                Seleccioná la fecha de ingreso y de egreso para consultar la
                disponibilidad. Luego completá tus datos para registrar la
                solicitud de reserva.
              </p>

              {/* Fechas (almanaque) */}
              <div className={styles.reservaModalGrid}>
                <div className={styles.reservaFieldGroup}>
                  <label
                    className={styles.reservaLabel}
                    htmlFor="fechaIngreso"
                  >
                    Fecha de ingreso
                  </label>
                  <input
                    id="fechaIngreso"
                    type="date"
                    className={styles.reservaInput}
                    value={fechaIngreso}
                    onChange={(e) => setFechaIngreso(e.target.value)}
                  />
                </div>

                <div className={styles.reservaFieldGroup}>
                  <label
                    className={styles.reservaLabel}
                    htmlFor="fechaEgreso"
                  >
                    Fecha de egreso
                  </label>
                  <input
                    id="fechaEgreso"
                    type="date"
                    className={styles.reservaInput}
                    value={fechaEgreso}
                    onChange={(e) => setFechaEgreso(e.target.value)}
                  />
                </div>
              </div>

              {errorFechas && (
                <p className={styles.reservaErrorText}>{errorFechas}</p>
              )}

              {mensajeDisponibilidad && (
                <p className={styles.reservaResultadoText}>
                  {mensajeDisponibilidad}
                </p>
              )}

              {/* Si hay disponibilidad, mostramos el formulario de datos */}
              {disponibilidadOk && !reservaConfirmada && (
                <>
                  {/* 🔹 Detalle de precios + cantidad de no afiliados */}
                  {habitacionAsignable && (
                    <>
                      {(() => {
                        const maxNoAf = getMaxNoAfiliados(
                          habitacionAsignable,
                          tipoSeleccionado
                        );
                        const {
                          precioAfiliado,
                          precioNoAfiliado,
                          precioFinal,
                        } = calcularPreciosReserva(
                          habitacionAsignable,
                          tipoSeleccionado,
                          tipoSeleccionado === "simple"
                            ? 0
                            : cantidadNoAfiliados
                        );

                        const cantNoAfValidos =
                          tipoSeleccionado === "simple"
                            ? 0
                            : Math.min(
                                Math.max(
                                  Number(cantidadNoAfiliados) || 0,
                                  0
                                ),
                                maxNoAf
                              );

                        const totalPersonas =
                          tipoSeleccionado === "simple"
                            ? 1
                            : 1 + cantNoAfValidos;

                        const noches = calcularNoches(
                          fechaIngreso,
                          fechaEgreso
                        );
                        const precioTotalEstadia =
                          noches > 0 ? precioFinal * noches : precioFinal;

                        return (
                          <>
                            {tipoSeleccionado !== "simple" && (
                              <div className={styles.reservaFieldGroup}>
                                <label
                                  className={styles.reservaLabel}
                                  htmlFor="noAfiliados"
                                >
                                  Cantidad de acompañantes no afiliados
                                </label>
                                <input
                                  id="noAfiliados"
                                  type="number"
                                  min="0"
                                  max={maxNoAf}
                                  className={styles.reservaInput}
                                  value={cantidadNoAfiliados}
                                  onChange={(e) => {
                                    const raw = e.target.value;
                                    let n = parseInt(raw, 10);
                                    if (isNaN(n) || n < 0) n = 0;
                                    if (maxNoAf > 0) {
                                      n = Math.min(n, maxNoAf);
                                    } else {
                                      n = 0;
                                    }
                                    setCantidadNoAfiliados(n);
                                  }}
                                  placeholder={
                                    maxNoAf > 0
                                      ? `Máximo ${maxNoAf} no afiliado(s) para esta habitación`
                                      : "Esta habitación es solo para afiliado"
                                  }
                                />
                                {maxNoAf > 0 && (
                                  <p className={styles.reservaAutofillStatus}>
                                    Recordá: en una habitación doble suele ser
                                    1 no afiliado; en una triple, 2; etc.
                                  </p>
                                )}
                              </div>
                            )}

                            <div className={styles.reservaAceptacionBox}>
                              <p className={styles.reservaAceptacionLegend}>
                                Detalle de precios
                              </p>
                              <p className={styles.reservaResultadoText}>
                                Precio afiliado (por noche):{" "}
                                {precioAfiliado
                                  ? `$${precioAfiliado}`
                                  : "A definir"}
                              </p>
                              {tipoSeleccionado !== "simple" && (
                                <p className={styles.reservaResultadoText}>
                                  Precio no afiliado (por noche):{" "}
                                  {precioNoAfiliado
                                    ? `$${precioNoAfiliado}`
                                    : "A definir"}
                                  {maxNoAf > 0 &&
                                    `  (hasta ${maxNoAf} no afiliado/s)`}
                                </p>
                              )}
                              <p className={styles.reservaResultadoText}>
                                Precio final por noche para{" "}
                                <strong>
                                  {totalPersonas} persona
                                  {totalPersonas !== 1 ? "s" : ""}
                                </strong>
                                :{" "}
                                {precioFinal
                                  ? `$${precioFinal}`
                                  : "A definir"}
                              </p>
                              {noches > 0 && (
                                <p className={styles.reservaResultadoText}>
                                  Precio final para{" "}
                                  <strong>
                                    {noches} noche
                                    {noches !== 1 ? "s" : ""} ·{" "}
                                    {totalPersonas} persona
                                    {totalPersonas !== 1 ? "s" : ""}
                                  </strong>
                                  :{" "}
                                  {precioTotalEstadia
                                    ? `$${precioTotalEstadia}`
                                    : "A definir"}
                                </p>
                              )}
                            </div>
                          </>
                        );
                      })()}
                    </>
                  )}

                  <div className={styles.reservaDivider} />
                  <p className={styles.reservaSectionTitle}>
                    Datos para completar la reserva
                  </p>

                  {/* Bloque de "login" por DNI */}
                  <p className={styles.reservaAutofillHelp}>
                    Si ya sos afiliado de SIDCA, ingresá tu DNI para cargar tus
                    datos automáticamente.
                  </p>
                  <div className={styles.reservaAutofillRow}>
                    <div className={styles.reservaAutofillInput}>
                      <input
                        type="text"
                        placeholder="Ingresá tu DNI"
                        value={dniBusqueda}
                        onChange={(e) => setDniBusqueda(e.target.value)}
                      />
                    </div>
                    <button
                      type="button"
                      className={styles.reservaAutofillButton}
                      onClick={handleBuscarAfiliado}
                      disabled={buscandoAfiliado}
                    >
                      {buscandoAfiliado
                        ? "Buscando..."
                        : "Completar con mis datos"}
                    </button>
                  </div>
                  {mensajeAutofill && (
                    <p
                      className={`${styles.reservaAutofillStatus} ${
                        autofillOk
                          ? styles.reservaAutofillStatusOk
                          : styles.reservaAutofillStatusError
                      }`}
                    >
                      {mensajeAutofill}
                    </p>
                  )}

                  {/* Campos (nombre, dni, email, celular) */}
                  <div className={styles.reservaModalGrid}>
                    <div className={styles.reservaFieldGroup}>
                      <label
                        className={styles.reservaLabel}
                        htmlFor="resNombre"
                      >
                        Apellido y nombre
                      </label>
                      <input
                        id="resNombre"
                        type="text"
                        className={styles.reservaInput}
                        value={formNombre}
                        readOnly
                        placeholder="Se completará al buscar por DNI"
                      />
                    </div>

                    <div className={styles.reservaFieldGroup}>
                      <label className={styles.reservaLabel} htmlFor="resDni">
                        DNI
                      </label>
                      <input
                        id="resDni"
                        type="text"
                        className={styles.reservaInput}
                        value={formDni}
                        readOnly
                        placeholder="Se completará al buscar por DNI"
                      />
                    </div>

                    <div className={styles.reservaFieldGroup}>
                      <label
                        className={styles.reservaLabel}
                        htmlFor="resEmail"
                      >
                        Correo electrónico
                      </label>
                      <input
                        id="resEmail"
                        type="email"
                        className={styles.reservaInput}
                        value={formEmail}
                        onChange={(e) => setFormEmail(e.target.value)}
                        readOnly={emailBloqueado}
                        placeholder={
                          emailBloqueado
                            ? "Correo registrado en el padrón"
                            : "Ingresá tu correo electrónico"
                        }
                      />
                    </div>

                    <div className={styles.reservaFieldGroup}>
                      <label
                        className={styles.reservaLabel}
                        htmlFor="resCelular"
                      >
                        Celular de contacto
                      </label>
                      <input
                        id="resCelular"
                        type="text"
                        className={styles.reservaInput}
                        value={formCelular}
                        onChange={(e) => setFormCelular(e.target.value)}
                        readOnly={celularBloqueado}
                        placeholder={
                          celularBloqueado
                            ? "Celular registrado en el padrón"
                            : "Ingresá tu celular"
                        }
                      />
                    </div>
                  </div>

                  {/* Comentario adicional */}
                  <div className={styles.reservaFieldGroup}>
                    <label
                      className={styles.reservaLabel}
                      htmlFor="resComentario"
                    >
                      Comentario sobre la habitación
                    </label>
                    <textarea
                      id="resComentario"
                      className={styles.reservaInput}
                      rows={3}
                      value={formComentario}
                      onChange={(e) => setFormComentario(e.target.value)}
                      placeholder="Ej.: cama matrimonial, dos camas individuales, cuna para bebé, etc."
                    />
                  </div>

                  {/* ✅ Cuadro de aceptación de descuento */}
                  <div className={styles.reservaAceptacionBox}>
                    <p className={styles.reservaAceptacionLegend}>
                      Autorización de descuento
                    </p>
                    <div className={styles.reservaCheckboxRow}>
                      <label className={styles.reservaCheckboxLabel}>
                        <input
                          type="checkbox"
                          checked={aceptaDescuento}
                          onChange={(e) =>
                            setAceptaDescuento(e.target.checked)
                          }
                        />
                        Declaro que acepto que el importe correspondiente a los
                        servicios de hospedaje de la Casa del Docente sea
                        descontado de mi recibo de sueldo en concepto de
                        servicios.
                      </label>
                    </div>
                  </div>

                  {formError && (
                    <p className={styles.reservaErrorText}>{formError}</p>
                  )}
                </>
              )}

              {/* Mensaje final si ya se confirmó */}
              {reservaConfirmada && (
                <>
                  <div className={styles.reservaDivider} />
                  <p className={styles.reservaSectionTitle}>
                    Reserva registrada
                  </p>
                  <p className={styles.reservaResultadoText}>
                    Muchas gracias. Tu solicitud quedará sujeta a confirmación
                    por parte del equipo de SIDCA, quienes se comunicarán usando
                    los datos de contacto informados.
                  </p>
                </>
              )}
            </div>

            <div className={styles.reservaModalFooter}>
              <button
                type="button"
                className={styles.reservaSecondaryButton}
                onClick={onCloseReserva}
              >
                Cerrar
              </button>

              {!reservaConfirmada && (
                <button
                  type="button"
                  className={styles.reservaPrimaryButton}
                  onClick={
                    disponibilidadOk ? confirmarReserva : consultarDisponibilidad
                  }
                  disabled={checkingDisponibilidad || sendingReserva}
                >
                  {disponibilidadOk
                    ? sendingReserva
                      ? "Enviando..."
                      : "Confirmar reserva"
                    : checkingDisponibilidad
                    ? "Consultando..."
                    : "Consultar disponibilidad"}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* MODAL: Consulta de reserva por DNI */}
      {isConsultaModalOpen && (
        <div className={styles.reservaModalOverlay}>
          <div className={styles.reservaModal}>
            <div className={styles.reservaModalHeader}>
              <h3 className={styles.reservaModalTitle}>Consultar mi reserva</h3>
              <button
                type="button"
                className={styles.reservaModalClose}
                onClick={onCloseConsulta}
              >
                ×
              </button>
            </div>

            <div className={styles.reservaModalBody}>
              <p className={styles.reservaModalInfo}>
                Ingresá tu DNI para ver las reservas registradas y su estado.
              </p>

              <div className={styles.reservaAutofillRow}>
                <div className={styles.reservaAutofillInput}>
                  <input
                    type="text"
                    placeholder="Ingresá tu DNI"
                    value={dniConsulta}
                    onChange={(e) => setDniConsulta(e.target.value)}
                  />
                </div>
                <button
                  type="button"
                  className={styles.reservaAutofillButton}
                  onClick={handleConsultarReserva}
                  disabled={consultaLoading}
                >
                  {consultaLoading ? "Buscando..." : "Buscar reserva"}
                </button>
              </div>

              {consultaMensaje && (
                <p className={styles.reservaResultadoText}>
                  {consultaMensaje}
                </p>
              )}

              {consultaResultados.length > 0 && (
                <div className={styles.consultaResultadosList}>
                  {consultaResultados.map((reserva) => {
                    const tipoNombre =
                      getTipoById(reserva.tipo)?.nombre || reserva.tipo;
                    const estadoLabel = normalizarEstado(reserva.estado);

                    return (
                      <div
                        key={reserva.id}
                        className={styles.consultaResultadoCard}
                      >
                        <p className={styles.consultaResultadoTitle}>
                          {tipoNombre}
                        </p>
                        <p className={styles.consultaResultadoText}>
                          Fechas: {reserva.fechaIngreso} al{" "}
                          {reserva.fechaEgreso}
                        </p>
                        <p className={styles.consultaResultadoText}>
                          Estado:{" "}
                          <span className={styles.consultaResultadoEstado}>
                            {estadoLabel}
                          </span>
                        </p>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div className={styles.reservaModalFooter}>
              <button
                type="button"
                className={styles.reservaSecondaryButton}
                onClick={onCloseConsulta}
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default ReservaCasaDocenteModales;
