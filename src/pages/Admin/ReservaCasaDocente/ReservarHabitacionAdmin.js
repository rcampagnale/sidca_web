// src/pages/Admin/ReservaCasaDocente/ReservarHabitacionAdmin.js
import React, { useEffect, useMemo, useState } from "react";
import styles from "./ReservaCasaDocenteAdmin.module.css";

import { dbReservas } from "../../../firebase/firebaseReservas";
import { db as dbSidca } from "../../../firebase/firebase-config";
import {
  collection,
  getDocs,
  query,
  orderBy,
  where,
  addDoc,
} from "firebase/firestore";
import {
  opcionesPorHabitacion,
  evaluarDisponibilidadHabitacion,
  SEXO_OPCIONES,
} from "../../../utils/habitacionesCasaDocente";

const ReservarHabitacionAdmin = () => {
  const [habitaciones, setHabitaciones] = useState([]);
  const [loadingHabitaciones, setLoadingHabitaciones] = useState(true);
  const [errorHabitaciones, setErrorHabitaciones] = useState(null);

  const [tipoSeleccionado, setTipoSeleccionado] = useState("");
  const [fechaIngreso, setFechaIngreso] = useState("");
  const [fechaEgreso, setFechaEgreso] = useState("");
  const [cantidadPersonas, setCantidadPersonas] = useState(1);
  const [modoReserva, setModoReserva] = useState("completa");
  const [sexoSeleccionado, setSexoSeleccionado] = useState("");

  const [checkingDisponibilidad, setCheckingDisponibilidad] = useState(false);
  const [mensajeDisponibilidad, setMensajeDisponibilidad] = useState("");
  const [errorFechas, setErrorFechas] = useState("");
  const [disponibilidadOk, setDisponibilidadOk] = useState(false);
  const [habitacionAsignable, setHabitacionAsignable] = useState(null);

  // Datos afiliado
  const [dniBusqueda, setDniBusqueda] = useState("");
  const [formNombre, setFormNombre] = useState("");
  const [formDni, setFormDni] = useState("");
  const [formEmail, setFormEmail] = useState("");
  const [formCelular, setFormCelular] = useState("");
  const [formComentario, setFormComentario] = useState("");
  const [formError, setFormError] = useState("");

  const [buscandoAfiliado, setBuscandoAfiliado] = useState(false);
  const [mensajeAutofill, setMensajeAutofill] = useState("");
  const [autofillOk, setAutofillOk] = useState(false);

  const [emailBloqueado, setEmailBloqueado] = useState(false);
  const [celularBloqueado, setCelularBloqueado] = useState(false);

  const [aceptaDescuento, setAceptaDescuento] = useState(false);
  const [sendingReserva, setSendingReserva] = useState(false);
  const [reservaConfirmada, setReservaConfirmada] = useState(false);

  // Cargar habitaciones
  useEffect(() => {
    const cargarHabitaciones = async () => {
      try {
        setLoadingHabitaciones(true);
        setErrorHabitaciones(null);

        const colRef = collection(dbReservas, "habitacionesCasaDocente");
        const qHab = query(colRef, orderBy("tipo", "asc"));
        const snapshot = await getDocs(qHab);

        const data = snapshot.docs.map((docSnap) => ({
          id: docSnap.id,
          ...docSnap.data(),
        }));

        setHabitaciones(data);
      } catch (error) {
        console.error(
          "[ReservarHabitacionAdmin] Error al cargar habitaciones:",
          error
        );
        setErrorHabitaciones(
          "Ocurrió un problema al cargar las habitaciones. Intentalo nuevamente más tarde."
        );
      } finally {
        setLoadingHabitaciones(false);
      }
    };

    cargarHabitaciones();
  }, []);

  // Reset de disponibilidad cuando cambian fechas, tipo, modo o sexo
  useEffect(() => {
    setDisponibilidadOk(false);
    setMensajeDisponibilidad("");
    setHabitacionAsignable(null);
  }, [
    fechaIngreso,
    fechaEgreso,
    tipoSeleccionado,
    modoReserva,
    sexoSeleccionado,
    cantidadPersonas,
  ]);

  // Al cambiar de habitación, reseteamos modalidad/sexo
  useEffect(() => {
    setModoReserva("completa");
    setSexoSeleccionado("");
  }, [tipoSeleccionado]);

  // Lista de habitaciones seleccionables, derivada de lo cargado en
  // "Habitaciones" (ya no hay una lista fija de tipos).
  const opcionesHabitacion = useMemo(
    () => opcionesPorHabitacion(habitaciones.filter((h) => h.activa !== false)),
    [habitaciones]
  );

  const habitacionSeleccionadaInfo =
    habitaciones.find((h) => h.tipo === tipoSeleccionado) || null;
  const camasHabitacion = Math.max(
    Number(habitacionSeleccionadaInfo?.camas) || 1,
    1
  );
  const permiteCompartir = camasHabitacion > 1;

  // Habitación completa = ocupa todas las camas. Al elegir "completa" (o si
  // la habitación es de 1 cama) fijamos la cantidad automáticamente. Al
  // pasar a "compartida", si quedó el valor de "completa" (todas las camas),
  // lo reseteamos a 1 para que el admin no reserve sin querer la habitación
  // entera bajo la modalidad "compartida".
  useEffect(() => {
    if (modoReserva === "completa" || !permiteCompartir) {
      setCantidadPersonas(camasHabitacion);
    } else if (
      Number(cantidadPersonas) < 1 ||
      Number(cantidadPersonas) >= camasHabitacion
    ) {
      setCantidadPersonas(1);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [modoReserva, camasHabitacion, permiteCompartir]);

  /* ======================
   * Buscar afiliado por DNI
   * ====================== */
  const handleBuscarAfiliado = async () => {
    const dni = dniBusqueda.trim();
    if (!dni) {
      setMensajeAutofill("Ingresá un DNI para buscar los datos.");
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
        docData.celular || docData.telefono || docData.cel || "";

      if (apellidoNombre) setFormNombre(apellidoNombre);
      setFormDni(dni);

      if (email) {
        setFormEmail(email);
        setEmailBloqueado(true);
      } else {
        setFormEmail("");
        setEmailBloqueado(false);
      }

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
        "[ReservarHabitacionAdmin] Error buscando afiliado por DNI:",
        error
      );
      setMensajeAutofill(
        "Ocurrió un problema al buscar los datos. Intentá nuevamente."
      );
      setAutofillOk(false);
    } finally {
      setBuscandoAfiliado(false);
    }
  };

  /* ======================
   * Consultar disponibilidad (incluye bloqueos)
   * ====================== */
  const consultarDisponibilidad = async () => {
  setErrorFechas("");
  setMensajeDisponibilidad("");
  setDisponibilidadOk(false);
  setHabitacionAsignable(null);

  if (!tipoSeleccionado || !habitacionSeleccionadaInfo) {
    setErrorFechas("Seleccioná una habitación.");
    return;
  }

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

  if (modoReserva === "compartida" && !sexoSeleccionado) {
    setErrorFechas("Indicá el sexo del grupo que se hospeda para compartir la habitación.");
    return;
  }

  try {
    setCheckingDisponibilidad(true);

    const solIng = fechaIngreso;
    const solEgr = fechaEgreso;

    // ⚠️ PANEL ADMIN:
    // Acá NO se tienen en cuenta los bloqueos,
    // el administrador puede reservar en fechas bloqueadas.

    const colReservas = collection(dbReservas, "reservasCasaDocente");
    const qRes = query(colReservas, where("tipo", "==", tipoSeleccionado));
    const snapshot = await getDocs(qRes);
    const reservas = snapshot.docs.map((d) => d.data());

    const reservasSuperpuestas = reservas.filter((r) => {
      const estado = (r.estado || "pendiente").toLowerCase();
      if (estado === "cancelada" || estado === "rechazada") return false;
      return r.fechaEgreso > solIng && r.fechaIngreso < solEgr;
    });

    const resultado = evaluarDisponibilidadHabitacion({
      habitacion: habitacionSeleccionadaInfo,
      reservasSuperpuestas,
      modoReserva,
      sexo: sexoSeleccionado,
      cantidadPersonas,
    });

    if (resultado.disponible) {
      setDisponibilidadOk(true);
      setHabitacionAsignable(habitacionSeleccionadaInfo);
      setMensajeDisponibilidad(
        modoReserva === "completa"
          ? "Hay disponibilidad para las fechas seleccionadas."
          : `Hay disponibilidad para las fechas seleccionadas. Lugares libres en la habitación: ${resultado.cuposLibres}.`
      );
    } else {
      setDisponibilidadOk(false);
      setHabitacionAsignable(null);
      setMensajeDisponibilidad(resultado.motivo);
    }
  } catch (error) {
    console.error(
      "[ReservarHabitacionAdmin] Error al consultar disponibilidad:",
      error
    );
    setMensajeDisponibilidad(
      "Ocurrió un problema al consultar la disponibilidad."
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
        "No se pudo obtener Apellido y Nombre. Verificá el DNI."
      );
      return;
    }

    if (!formDni.trim()) {
      setFormError("No se pudo obtener el DNI.");
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

    if (!aceptaDescuento) {
      setFormError(
        "Debés dejar asentado que el afiliado acepta el descuento en el recibo de sueldo."
      );
      return;
    }

    if (modoReserva === "compartida" && !sexoSeleccionado) {
      setFormError("Indicá el sexo del grupo que se hospeda.");
      return;
    }

    try {
      setSendingReserva(true);

      const colReservas = collection(dbReservas, "reservasCasaDocente");
      const nuevaReserva = {
        tipo: tipoSeleccionado,
        idHabitacion: habitacionAsignable.id || null,
        nombreHabitacion: habitacionAsignable.nombre || "",
        fechaIngreso,
        fechaEgreso,
        modoReserva,
        sexo: modoReserva === "compartida" ? sexoSeleccionado : "",
        cantidadPersonas: Number(cantidadPersonas) || 1,
        apellidoNombre: formNombre.trim(),
        dni: formDni.trim(),
        email: formEmail.trim(),
        celular: formCelular.trim(),
        comentario: formComentario.trim() || "",
        estado: "confirmada", // creada desde panel admin
        fechaCreacion: new Date().toISOString(),
        origen: "admin-panel",
        aceptaDescuento: !!aceptaDescuento,
      };

      await addDoc(colReservas, nuevaReserva);

      setReservaConfirmada(true);
      setMensajeDisponibilidad(
        "La reserva fue registrada y marcada como CONFIRMADA."
      );
    } catch (error) {
      console.error(
        "[ReservarHabitacionAdmin] Error al guardar la reserva:",
        error
      );
      setFormError(
        "Ocurrió un problema al registrar la reserva. Intentá nuevamente."
      );
    } finally {
      setSendingReserva(false);
    }
  };

  return (
    <section className={styles.tableSection}>
      <div className={styles.tableHeader}>
        <h2 className={styles.tableTitle}>Reservar habitación (panel admin)</h2>
        <p className={styles.subtitle}>
          Registrá una nueva reserva verificando disponibilidad y bloqueos de
          fechas.
        </p>
      </div>

      {loadingHabitaciones && (
        <p className={styles.emptyText}>Cargando habitaciones...</p>
      )}
      {errorHabitaciones && (
        <p className={styles.emptyText}>{errorHabitaciones}</p>
      )}

      {!loadingHabitaciones && !errorHabitaciones && (
        <div className={styles.modalBody}>
          {/* Tipo + fechas + personas */}
          <div className={styles.modalGrid}>
            <div>
              <label className={styles.label} htmlFor="tipoHabAdmin">
                Habitación
              </label>
              <select
                id="tipoHabAdmin"
                className={styles.input}
                value={tipoSeleccionado}
                onChange={(e) => setTipoSeleccionado(e.target.value)}
              >
                <option value="">Seleccionar...</option>
                {opcionesHabitacion.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className={styles.label} htmlFor="fechaIngAdmin">
                Fecha de ingreso
              </label>
              <input
                id="fechaIngAdmin"
                type="date"
                className={styles.input}
                value={fechaIngreso}
                onChange={(e) => setFechaIngreso(e.target.value)}
              />
            </div>

            <div>
              <label className={styles.label} htmlFor="fechaEgrAdmin">
                Fecha de egreso
              </label>
              <input
                id="fechaEgrAdmin"
                type="date"
                className={styles.input}
                value={fechaEgreso}
                onChange={(e) => setFechaEgreso(e.target.value)}
              />
            </div>

            <div>
              <label className={styles.label} htmlFor="cantPersonasAdmin">
                Personas
              </label>
              <input
                id="cantPersonasAdmin"
                type="number"
                min={1}
                max={camasHabitacion}
                className={styles.input}
                value={cantidadPersonas}
                onChange={(e) => setCantidadPersonas(e.target.value)}
                readOnly={modoReserva === "completa" || !permiteCompartir}
              />
            </div>
          </div>

          {permiteCompartir && (
            <div className={styles.modalGrid} style={{ marginTop: "0.75rem" }}>
              <div>
                <label className={styles.label}>Modalidad</label>
                <select
                  className={styles.input}
                  value={modoReserva}
                  onChange={(e) => setModoReserva(e.target.value)}
                >
                  <option value="completa">
                    Habitación completa (hasta {camasHabitacion} personas)
                  </option>
                  <option value="compartida">Compartir habitación</option>
                </select>
              </div>

              {modoReserva === "compartida" && (
                <div>
                  <label className={styles.label} htmlFor="sexoAdmin">
                    Sexo del grupo que se hospeda
                  </label>
                  <select
                    id="sexoAdmin"
                    className={styles.input}
                    value={sexoSeleccionado}
                    onChange={(e) => setSexoSeleccionado(e.target.value)}
                  >
                    <option value="">Seleccionar...</option>
                    {SEXO_OPCIONES.map((s) => (
                      <option key={s.value} value={s.value}>
                        {s.label}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>
          )}

          {errorFechas && (
            <p className={styles.reservaErrorText}>{errorFechas}</p>
          )}
          {mensajeDisponibilidad && (
            <p className={styles.reservaResultadoText}>
              {mensajeDisponibilidad}
            </p>
          )}

          <div style={{ marginTop: "0.75rem" }}>
            <button
              type="button"
              className={styles.primaryButton}
              onClick={consultarDisponibilidad}
              disabled={checkingDisponibilidad}
            >
              {checkingDisponibilidad ? "Consultando..." : "Consultar disponibilidad"}
            </button>
          </div>

          {/* Datos afiliado cuando hay disponibilidad */}
          {disponibilidadOk && !reservaConfirmada && (
            <>
              <hr className={styles.reservaDivider} />
              <p className={styles.reservaSectionTitle}>
                Datos del afiliado / huésped
              </p>

              {/* 🔹 Autofill con DNI, ahora con mismo estilo de botón */}
              <p className={styles.autofillHelp}>
                Podés cargar los datos automáticamente desde el padrón de SIDCA.
              </p>
              <div className={styles.autofillRow}>
                <input
                  type="text"
                  placeholder="Ingresá DNI"
                  className={`${styles.input} ${styles.autofillInput}`}
                  value={dniBusqueda}
                  onChange={(e) => setDniBusqueda(e.target.value)}
                />
                <button
                  type="button"
                  className={`${styles.primaryButton} ${styles.autofillButton}`}
                  onClick={handleBuscarAfiliado}
                  disabled={buscandoAfiliado}
                >
                  {buscandoAfiliado ? "Buscando..." : "Completar con padrón"}
                </button>
              </div>
              {mensajeAutofill && (
                <p
                  className={`${styles.autofillStatus} ${
                    autofillOk
                      ? styles.autofillStatusOk
                      : styles.autofillStatusError
                  }`}
                >
                  {mensajeAutofill}
                </p>
              )}

              <div className={styles.modalGrid}>
                <div>
                  <label className={styles.label} htmlFor="nombreAdmin">
                    Apellido y nombre
                  </label>
                  <input
                    id="nombreAdmin"
                    type="text"
                    className={styles.input}
                    value={formNombre}
                    onChange={(e) => setFormNombre(e.target.value)}
                  />
                </div>
                <div>
                  <label className={styles.label} htmlFor="dniAdmin">
                    DNI
                  </label>
                  <input
                    id="dniAdmin"
                    type="text"
                    className={styles.input}
                    value={formDni}
                    onChange={(e) => setFormDni(e.target.value)}
                  />
                </div>
                <div>
                  <label className={styles.label} htmlFor="emailAdmin">
                    Correo electrónico
                  </label>
                  <input
                    id="emailAdmin"
                    type="email"
                    className={styles.input}
                    value={formEmail}
                    onChange={(e) => setFormEmail(e.target.value)}
                    readOnly={emailBloqueado}
                  />
                </div>
                <div>
                  <label className={styles.label} htmlFor="celAdmin">
                    Celular
                  </label>
                  <input
                    id="celAdmin"
                    type="text"
                    className={styles.input}
                    value={formCelular}
                    onChange={(e) => setFormCelular(e.target.value)}
                    readOnly={celularBloqueado}
                  />
                </div>
              </div>

              <div className={styles.modalFieldGroup}>
                <label className={styles.label} htmlFor="comentarioAdmin">
                  Comentario / motivo
                </label>
                <textarea
                  id="comentarioAdmin"
                  className={`${styles.input} ${styles.textarea}`}
                  value={formComentario}
                  onChange={(e) => setFormComentario(e.target.value)}
                  placeholder="Ej.: evento, reunión, indicaciones especiales..."
                />
              </div>

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
                    Dejo asentado que el afiliado autoriza el descuento del
                    importe de hospedaje en su recibo de sueldo.
                  </label>
                </div>
              </div>

              {formError && (
                <p className={styles.reservaErrorText}>{formError}</p>
              )}

              <div className={styles.modalFooter} style={{ paddingLeft: 0 }}>
                <button
                  type="button"
                  className={styles.primaryButton}
                  onClick={confirmarReserva}
                  disabled={sendingReserva}
                >
                  {sendingReserva ? "Guardando..." : "Confirmar reserva"}
                </button>
              </div>
            </>
          )}

          {reservaConfirmada && (
            <>
              <hr className={styles.reservaDivider} />
              <p className={styles.reservaSectionTitle}>
                Reserva registrada
              </p>
              <p className={styles.reservaResultadoText}>
                La reserva quedó cargada como CONFIRMADA. Podés verla en la
                pestaña "Reservas".
              </p>
            </>
          )}
        </div>
      )}
    </section>
  );
};

export default ReservarHabitacionAdmin;
