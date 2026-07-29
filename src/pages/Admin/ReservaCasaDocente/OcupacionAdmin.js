import React, { useState, useMemo, useEffect } from "react";
import styles from "./OcupacionAdmin.module.css";

import { dbReservas } from "../../../firebase/firebaseReservas";
import { collection, doc, onSnapshot, updateDoc } from "firebase/firestore";
import {
  nombreDeHabitacion,
  labelSexo,
} from "../../../utils/habitacionesCasaDocente";

const MESES = [
  "Enero","Febrero","Marzo","Abril","Mayo","Junio",
  "Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre",
];
const DIAS_SEMANA = ["Dom","Lun","Mar","Mié","Jue","Vie","Sáb"];

const toDateOnly = (valor) => {
  if (!valor) return null;
  if (typeof valor === "object" && valor.toDate) {
    const d = valor.toDate();
    return new Date(d.getFullYear(), d.getMonth(), d.getDate());
  }
  const str = String(valor).split("T")[0];
  const [yyyy, mm, dd] = str.split("-");
  if (yyyy && mm && dd) return new Date(Number(yyyy), Number(mm) - 1, Number(dd));
  return null;
};

const dateToStr = (d) => {
  const yyyy = d.getFullYear();
  const mm   = String(d.getMonth() + 1).padStart(2, "0");
  const dd2  = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd2}`;
};

const diasEnMes = (yr, mo) => new Date(yr, mo + 1, 0).getDate();

// Reservas activas de una habitación en una fecha dada.
// Match por idHabitacion; si la reserva es vieja y no lo tiene, cae al tipo.
const reservasDeHabEnFecha = (reservas, hab, f) =>
  (reservas || []).filter((r) => {
    const est = String(r.estado || "pendiente").toLowerCase();
    if (est === "rechazada" || est === "cancelada") return false;

    const coincide = r.idHabitacion
      ? r.idHabitacion === hab.id
      : r.tipo === hab.tipo;
    if (!coincide) return false;

    const ing = toDateOnly(r.fechaIngreso);
    const egr = toDateOnly(r.fechaEgreso);
    if (!ing || !egr) return false;
    return f >= ing && f < egr;
  });

// Bloqueo administrativo que aplica a esta habitación en esta fecha.
// A diferencia de las reservas, el rango del bloqueo es inclusivo en ambos
// extremos (así se carga desde la pestaña "Bloqueo de fechas").
const bloqueoDeHabEnFecha = (bloqueos, hab, f) =>
  (bloqueos || []).find((b) => {
    if (b.tipo && b.tipo !== "todos" && b.tipo !== hab.tipo) return false;
    const ing = toDateOnly(b.fechaIngreso);
    const egr = toDateOnly(b.fechaEgreso);
    if (!ing || !egr) return false;
    return f >= ing && f <= egr;
  }) || null;

// Estado de una habitación en una fecha, a nivel de PLAZA (no habitación
// entera): una habitación de 4 camas con 2 personas queda "parcial", no
// "ocupada". Prioridad: bloqueo administrativo > vence > ocupada > parcial.
const getEstadoHab = ({ reservas, bloqueos, hab, fecha }) => {
  const f = new Date(fecha.getFullYear(), fecha.getMonth(), fecha.getDate());

  const bloqueo = bloqueoDeHabEnFecha(bloqueos, hab, f);
  const activas = reservasDeHabEnFecha(reservas, hab, f);

  const camas = Math.max(Number(hab?.camas) || 1, 1);
  const personas = activas.reduce(
    (acc, r) => acc + (Number(r.cantidadPersonas) || 1),
    0
  );
  const cuposLibres = Math.max(camas - personas, 0);
  const sexo = activas.find((r) => r.sexo)?.sexo || null;

  // Las reservas viejas no tienen "modoReserva": se asumen completas.
  const hayCompleta = activas.some(
    (r) => (r.modoReserva || "completa") === "completa"
  );
  const llena = hayCompleta || personas >= camas;

  const venceAlguna = activas.some((r) => {
    const egr = toDateOnly(r.fechaEgreso);
    if (!egr) return false;
    const ultimoDia = new Date(egr.getTime() - 86400000);
    return f.getTime() === ultimoDia.getTime();
  });

  let estado;
  if (activas.length === 0) estado = bloqueo ? "bloqueada" : "libre";
  else if (venceAlguna) estado = "vence";
  else if (llena) estado = "ocupada";
  else estado = "parcial";

  return {
    estado,
    bloqueo,
    reservas: activas,
    // Se mantiene "reserva" (la primera) por compatibilidad con el detalle.
    reserva: activas[0] || null,
    camas,
    personas,
    cuposLibres,
    sexo,
    llena,
  };
};

const ETIQUETA_ESTADO = {
  libre: "Libre",
  parcial: "Parcial",
  ocupada: "Ocupada",
  vence: "Vence hoy",
  bloqueada: "Bloqueada",
};

const OcupacionAdmin = ({ habitaciones = [], reservas = [] }) => {
  const hoy = useMemo(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), d.getDate());
  }, []);

  const [mes, setMes]           = useState(new Date(hoy.getFullYear(), hoy.getMonth(), 1));
  const [vistaTab, setVistaTab] = useState("mensual");
  // Pre-seleccionamos hoy para que el detalle aparezca sin hacer clic
  const [diaSelec, setDiaSelec] = useState(() => new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate()));
  const [guardando, setGuardando] = useState(null);
  const [msg, setMsg]           = useState(null);
  const [bloqueos, setBloqueos] = useState([]);

  // Bloqueos cargados desde la pestaña "Bloqueo de fechas", para que la
  // ocupación refleje también las fechas cerradas por administración.
  useEffect(() => {
    const colRef = collection(dbReservas, "bloqueosCasaDocente");
    const unsubscribe = onSnapshot(
      colRef,
      (snap) => setBloqueos(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
      (error) =>
        console.error("[OcupacionAdmin] Error al cargar bloqueos:", error)
    );
    return () => unsubscribe();
  }, []);

  const yr = mes.getFullYear();
  const mo = mes.getMonth();
  const dias = diasEnMes(yr, mo);

  const showMsg = (texto, tipo = "ok") => {
    setMsg({ texto, tipo });
    setTimeout(() => setMsg(null), 3500);
  };

  const cambiarMes = (dir) => {
    setMes(new Date(yr, mo + dir, 1));
    setDiaSelec(null);
  };

  const selDia = (d) => {
    const nueva = new Date(yr, mo, d);
    setDiaSelec((prev) =>
      prev && prev.getTime() === nueva.getTime() ? null : nueva
    );
  };

  const handleLiberar = async (reserva, habNombre) => {
    const confirmar = window.confirm(
      `¿Marcar la habitación "${habNombre}" como liberada?\n\nEsto registrará el egreso hoy y cerrará la reserva.`
    );
    if (!confirmar) return;
    try {
      setGuardando(reserva.id);
      const ref = doc(dbReservas, "reservasCasaDocente", reserva.id);
      await updateDoc(ref, {
        fechaEgreso: dateToStr(hoy),
        liberadaManualmente: true,
        estado: "confirmada",
      });
      showMsg(`Habitación "${habNombre}" liberada correctamente.`, "ok");
    } catch (e) {
      console.error(e);
      showMsg("Error al liberar la habitación. Revisá la consola.", "error");
    } finally {
      setGuardando(null);
    }
  };

  const handleDiaExtra = async (reserva, habNombre) => {
    const egr = toDateOnly(reserva.fechaEgreso);
    if (!egr) return;
    const nuevaFecha = new Date(egr.getTime() + 86400000);

    const precioPorNoche =
      Number(reserva.precioFinal ?? reserva.precioFinalNoche ?? reserva.precioAfiliado ?? 0);

    const confirmar = window.confirm(
      `Agregar 1 día extra a "${habNombre}".\n` +
      `Nueva fecha de egreso: ${nuevaFecha.getDate()}/${nuevaFecha.getMonth()+1}/${nuevaFecha.getFullYear()}\n` +
      (precioPorNoche ? `Costo adicional: $${precioPorNoche.toLocaleString("es-AR")}\n` : "") +
      `\n¿Confirmar?`
    );
    if (!confirmar) return;
    try {
      setGuardando(reserva.id);
      const ref = doc(dbReservas, "reservasCasaDocente", reserva.id);
      const diasExtraActuales = Number(reserva.diasExtra || 0);
      const importeDiasExtraActual = Number(reserva.importeDiasExtra || 0);
      const updates = {
        fechaEgreso: dateToStr(nuevaFecha),
        diaExtraAplicado: true,
        diasExtra: diasExtraActuales + 1,
        importeDiasExtra: importeDiasExtraActual + precioPorNoche,
      };
      if (precioPorNoche) {
        const totalAnterior = Number(reserva.totalReserva ?? reserva.precioFinalTotal ?? 0);
        if (totalAnterior) updates.totalReserva = totalAnterior + precioPorNoche;
      }
      await updateDoc(ref, updates);
      showMsg(`Día extra registrado para "${habNombre}".`, "ok");
    } catch (e) {
      console.error(e);
      showMsg("Error al registrar el día extra. Revisá la consola.", "error");
    } finally {
      setGuardando(null);
    }
  };

  const vencenHoy = useMemo(() => {
    return habitaciones.filter(
      (h) =>
        getEstadoHab({ reservas, bloqueos, hab: h, fecha: hoy }).estado ===
        "vence"
    );
  }, [habitaciones, reservas, bloqueos, hoy]);

  // Bloqueos vigentes hoy, para avisar arriba de la grilla.
  const bloqueadasHoy = useMemo(() => {
    return habitaciones
      .map((h) => ({ hab: h, bloqueo: bloqueoDeHabEnFecha(bloqueos, h, hoy) }))
      .filter((x) => x.bloqueo);
  }, [habitaciones, bloqueos, hoy]);

  // Para el detalle del almanaque (mensual): usa el día clickeado
  const estadosDetalle = useMemo(() => {
    const refDia = diaSelec ?? hoy;
    return habitaciones.map((h) => ({
      hab: h,
      ...getEstadoHab({ reservas, bloqueos, hab: h, fecha: refDia }),
    }));
  }, [habitaciones, reservas, bloqueos, diaSelec, hoy]);

  // Para Vista del día: SIEMPRE usa hoy, nunca diaSelec
  const estadosHoy = useMemo(() => {
    return habitaciones.map((h) => ({
      hab: h,
      ...getEstadoHab({ reservas, bloqueos, hab: h, fecha: hoy }),
    }));
  }, [habitaciones, reservas, bloqueos, hoy]);

  const metricasHoy = useMemo(() => {
    const acc = {
      libres: 0,
      parciales: 0,
      ocupadas: 0,
      vence: 0,
      bloqueadas: 0,
      plazasTotales: 0,
      plazasOcupadas: 0,
    };
    habitaciones.forEach((h) => {
      const info = getEstadoHab({ reservas, bloqueos, hab: h, fecha: hoy });
      if (info.estado === "libre") acc.libres++;
      else if (info.estado === "parcial") acc.parciales++;
      else if (info.estado === "ocupada") acc.ocupadas++;
      else if (info.estado === "vence") acc.vence++;
      else if (info.estado === "bloqueada") acc.bloqueadas++;
      acc.plazasTotales += info.camas;
      acc.plazasOcupadas += info.personas;
    });
    return { ...acc, total: habitaciones.length };
  }, [habitaciones, reservas, bloqueos, hoy]);

  const renderBotones = (estado, reserva, habNombre) => {
    if (!reserva) return null;
    const cargando = guardando === reserva.id;
    return (
      <div className={styles.acciones}>
        {(estado === "vence" || estado === "ocupada") && (
          <button
            className={`${styles.btnAccion} ${styles.btnLiberar}`}
            onClick={() => handleLiberar(reserva, habNombre)}
            disabled={cargando}
          >
            {cargando ? "..." : "Liberar"}
          </button>
        )}
        {estado === "vence" && (
          <button
            className={`${styles.btnAccion} ${styles.btnDiaExtra}`}
            onClick={() => handleDiaExtra(reserva, habNombre)}
            disabled={cargando}
          >
            {cargando ? "..." : "+ 1 día extra"}
          </button>
        )}
      </div>
    );
  };

  const fechaCorta = (valor) => {
    const d = toDateOnly(valor);
    if (!d) return null;
    return `${String(d.getDate()).padStart(2, "0")}/${String(
      d.getMonth() + 1
    ).padStart(2, "0")}`;
  };

  const renderFilaDia = ({
    hab,
    estado,
    reservas: reservasDia = [],
    bloqueo,
    camas,
    personas,
    cuposLibres,
    sexo,
  }) => {
    const habNombre = nombreDeHabitacion(hab);

    return (
      <div key={hab.id} className={`${styles.filaHab} ${styles[estado]}`}>
        <span className={`${styles.dot} ${styles[`dot_${estado}`]}`} />

        <div className={styles.filaInfo}>
          <span className={styles.filaHabNombre}>
            {habNombre}
            <span className={styles.filaPlazas}>
              {personas}/{camas} plaza{camas !== 1 ? "s" : ""}
            </span>
            {sexo && (
              <span className={styles.filaSexo}>{labelSexo(sexo)}</span>
            )}
          </span>

          {bloqueo && (
            <span className={styles.filaBloqueo}>
              🔒 Bloqueada por administración
              {bloqueo.motivo ? ` · ${bloqueo.motivo}` : ""}
              {` · ${fechaCorta(bloqueo.fechaIngreso)} al ${fechaCorta(
                bloqueo.fechaEgreso
              )}`}
            </span>
          )}

          {reservasDia.map((r) => (
            <span key={r.id || r.dni} className={styles.filaHuesped}>
              {r.apellidoNombre}
              {` · ${Number(r.cantidadPersonas) || 1} pers.`}
              {(r.modoReserva || "completa") === "compartida"
                ? " · comparte"
                : " · exclusiva"}
              {fechaCorta(r.fechaEgreso) ? ` · sale ${fechaCorta(r.fechaEgreso)}` : ""}
              {r.precioFinal
                ? ` · $${Number(r.precioFinal).toLocaleString("es-AR")}/noche`
                : ""}
            </span>
          ))}

          {estado === "parcial" && (
            <span className={styles.filaCupos}>
              Quedan {cuposLibres} lugar{cuposLibres !== 1 ? "es" : ""} libre
              {cuposLibres !== 1 ? "s" : ""}
              {sexo ? ` (solo ${labelSexo(sexo).toLowerCase()})` : ""}
            </span>
          )}
        </div>

        <span className={`${styles.badge} ${styles[`badge_${estado}`]}`}>
          {ETIQUETA_ESTADO[estado] || estado}
        </span>

        {/* Cada reserva tiene sus propias acciones (puede haber varias) */}
        <div className={styles.accionesGrupo}>
          {reservasDia.map((r) => {
            const egr = toDateOnly(r.fechaEgreso);
            const ultimoDia = egr ? new Date(egr.getTime() - 86400000) : null;
            const esVenceEsta =
              ultimoDia &&
              ultimoDia.getTime() ===
                new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate()).getTime();
            return (
              <div key={`acc-${r.id || r.dni}`}>
                {renderBotones(esVenceEsta ? "vence" : "ocupada", r, habNombre)}
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <div className={styles.wrap}>

      {msg && (
        <div className={`${styles.toast} ${styles[`toast_${msg.tipo}`]}`}>
          {msg.texto}
        </div>
      )}

      {/* Header */}
      <div className={styles.header}>
        <div className={styles.tabs}>
          <button
            className={`${styles.tabBtn} ${vistaTab === "mensual" ? styles.tabActivo : ""}`}
            onClick={() => setVistaTab("mensual")}
          >
            Vista mensual
          </button>
          <button
            className={`${styles.tabBtn} ${vistaTab === "dia" ? styles.tabActivo : ""}`}
            onClick={() => setVistaTab("dia")}
          >
            Vista del día
          </button>
        </div>
        <div className={styles.navMes}>
          <button className={styles.navBtn} onClick={() => cambiarMes(-1)}>‹</button>
          <span className={styles.mesLabel}>{MESES[mo]} {yr}</span>
          <button className={styles.navBtn} onClick={() => cambiarMes(1)}>›</button>
        </div>
      </div>

      {/* Alerta vencimientos hoy */}
      {vencenHoy.length > 0 && (
        <div className={styles.alertaVence}>
          <span className={styles.alertaIcon}>⚠</span>
          <span>
            <strong>{vencenHoy.map(nombreDeHabitacion).join(", ")}</strong>
            {vencenHoy.length === 1 ? " tiene" : " tienen"} check-out hoy antes de las 10:00 hs.
            {" "}Podés liberar o agregar un día extra desde la grilla.
          </span>
        </div>
      )}

      {/* Alerta bloqueos administrativos vigentes hoy */}
      {bloqueadasHoy.length > 0 && (
        <div className={styles.alertaBloqueo}>
          <span className={styles.alertaIcon}>🔒</span>
          <span>
            <strong>
              {bloqueadasHoy.map((x) => nombreDeHabitacion(x.hab)).join(", ")}
            </strong>
            {bloqueadasHoy.length === 1 ? " está" : " están"} bloqueada
            {bloqueadasHoy.length === 1 ? "" : "s"} hoy por administración.
            {bloqueadasHoy[0]?.bloqueo?.motivo
              ? ` Motivo: ${bloqueadasHoy[0].bloqueo.motivo}.`
              : ""}
          </span>
        </div>
      )}

      {/* VISTA MENSUAL */}
      {vistaTab === "mensual" && (
        <>
          <div className={styles.gridWrap}>
            <table className={styles.gridTable}>
              <thead>
                <tr>
                  <th className={styles.thHab}>Habitación</th>
                  {Array.from({ length: dias }, (_, i) => i + 1).map((d) => {
                    const esHoy = yr === hoy.getFullYear() && mo === hoy.getMonth() && d === hoy.getDate();
                    return (
                      <th key={d} className={`${styles.thDia} ${esHoy ? styles.thHoy : ""}`}>
                        {d}
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                {habitaciones.map((hab) => (
                  <tr key={hab.id}>
                    <td className={styles.tdHabNombre}>{nombreDeHabitacion(hab)}</td>
                    {Array.from({ length: dias }, (_, i) => i + 1).map((d) => {
                      const fecha = new Date(yr, mo, d);
                      const info = getEstadoHab({ reservas, bloqueos, hab, fecha });
                      const esHoy2 = yr === hoy.getFullYear() && mo === hoy.getMonth() && d === hoy.getDate();
                      const esSel  = diaSelec && diaSelec.getTime() === fecha.getTime();
                      const tooltip =
                        `${nombreDeHabitacion(hab)} · ${ETIQUETA_ESTADO[info.estado] || info.estado}` +
                        (info.estado === "bloqueada" && info.bloqueo?.motivo
                          ? ` · ${info.bloqueo.motivo}`
                          : "") +
                        (info.reservas.length > 0
                          ? ` · ${info.personas}/${info.camas} plazas${
                              info.sexo ? ` · ${labelSexo(info.sexo)}` : ""
                            }`
                          : "");
                      return (
                        <td key={d} className={`${styles.tdDia} ${esHoy2 ? styles.tdHoy : ""}`}>
                          <span
                            className={`${styles.celda} ${styles[`celda_${info.estado}`]} ${esSel ? styles.celdaSel : ""}`}
                            onClick={() => selDia(d)}
                            title={tooltip}
                          />
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className={styles.mobileMonthList}>
            {habitaciones.map((hab) => (
              <div key={hab.id} className={styles.mobileRoomCard}>
                <div className={styles.mobileRoomHeader}>
                  <span className={styles.mobileRoomName}>
                    {nombreDeHabitacion(hab)}
                  </span>
                </div>
                <div className={styles.mobileDaysGrid}>
                  {Array.from({ length: dias }, (_, i) => i + 1).map((d) => {
                    const fecha = new Date(yr, mo, d);
                    const info = getEstadoHab({ reservas, bloqueos, hab, fecha });
                    const esHoy = yr === hoy.getFullYear() && mo === hoy.getMonth() && d === hoy.getDate();
                    const esSel = diaSelec && diaSelec.getTime() === fecha.getTime();

                    return (
                      <button
                        key={d}
                        type="button"
                        className={`${styles.mobileDayCell} ${styles[`mobileDay_${info.estado}`]} ${
                          esHoy ? styles.mobileDayHoy : ""
                        } ${esSel ? styles.mobileDaySel : ""}`}
                        onClick={() => selDia(d)}
                        title={`${nombreDeHabitacion(hab)} · ${
                          ETIQUETA_ESTADO[info.estado] || info.estado
                        }`}
                      >
                        {d}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>

          <div className={styles.leyenda}>
            <span><span className={`${styles.dot} ${styles.dot_libre}`} /> Libre</span>
            <span><span className={`${styles.dot} ${styles.dot_parcial}`} /> Parcial (quedan lugares)</span>
            <span><span className={`${styles.dot} ${styles.dot_ocupada}`} /> Ocupada</span>
            <span><span className={`${styles.dot} ${styles.dot_vence}`} /> Vence ese día</span>
            <span><span className={`${styles.dot} ${styles.dot_bloqueada}`} /> Bloqueada</span>
            <span className={styles.leyendaHint}>Clic en un día para ver detalle</span>
          </div>

          {/* Detalle día seleccionado */}
          {diaSelec && (
            <div className={styles.detalleDia}>
              <div className={styles.detalleHeader}>
                <span className={styles.detalleTitulo}>
                  {DIAS_SEMANA[diaSelec.getDay()]} {diaSelec.getDate()} de {MESES[diaSelec.getMonth()]} {diaSelec.getFullYear()}
                  {diaSelec.getTime() === hoy.getTime() && <span className={styles.hoyPill}> · Hoy</span>}
                </span>
                <button className={styles.cerrarDetalle} onClick={() => setDiaSelec(null)}>×</button>
              </div>
              <div className={styles.detalleBody}>
                {estadosDetalle.map(renderFilaDia)}
              </div>
            </div>
          )}
        </>
      )}

      {/* VISTA DEL DÍA */}
      {vistaTab === "dia" && (
        <>
          <div className={styles.metricas}>
            <div className={styles.metCard}>
              <span className={styles.metNum}>
                {metricasHoy.plazasOcupadas}/{metricasHoy.plazasTotales}
              </span>
              <span className={styles.metLabel}>Plazas ocupadas</span>
            </div>
            <div className={`${styles.metCard} ${styles.metLibre}`}>
              <span className={styles.metNum}>{metricasHoy.libres}</span>
              <span className={styles.metLabel}>Libres</span>
            </div>
            <div className={`${styles.metCard} ${styles.metParcial}`}>
              <span className={styles.metNum}>{metricasHoy.parciales}</span>
              <span className={styles.metLabel}>Parciales</span>
            </div>
            <div className={`${styles.metCard} ${styles.metOcup}`}>
              <span className={styles.metNum}>{metricasHoy.ocupadas}</span>
              <span className={styles.metLabel}>Ocupadas</span>
            </div>
            <div className={`${styles.metCard} ${styles.metVence}`}>
              <span className={styles.metNum}>{metricasHoy.vence}</span>
              <span className={styles.metLabel}>Vencen hoy</span>
            </div>
            <div className={`${styles.metCard} ${styles.metBloq}`}>
              <span className={styles.metNum}>{metricasHoy.bloqueadas}</span>
              <span className={styles.metLabel}>Bloqueadas</span>
            </div>
          </div>

          <div className={styles.listaHoy}>
            <p className={styles.listaFecha}>
              Estado al {hoy.getDate().toString().padStart(2,"0")}/{(hoy.getMonth()+1).toString().padStart(2,"0")}/{hoy.getFullYear()}
            </p>
            {habitaciones.length === 0 && (
              <p className={styles.emptyText}>No hay habitaciones cargadas.</p>
            )}
            {estadosHoy.map(renderFilaDia)}
          </div>
        </>
      )}
    </div>
  );
};

export default OcupacionAdmin;
