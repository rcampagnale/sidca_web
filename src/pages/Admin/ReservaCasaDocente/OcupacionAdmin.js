import React, { useState, useMemo } from "react";
import styles from "./OcupacionAdmin.module.css";

import { dbReservas } from "../../../firebase/firebaseReservas";
import { doc, updateDoc } from "firebase/firestore";

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

const getEstadoHab = (reservas, habId, fecha) => {
  const f = new Date(fecha.getFullYear(), fecha.getMonth(), fecha.getDate());
  for (const r of reservas) {
    if (r.idHabitacion !== habId) continue;
    if (r.estado === "rechazada") continue;
    const ing = toDateOnly(r.fechaIngreso);
    const egr = toDateOnly(r.fechaEgreso);
    if (!ing || !egr) continue;
    if (f >= ing && f < egr) {
      const ultimoDia = new Date(egr.getTime() - 86400000);
      const esVence   = f.getTime() === ultimoDia.getTime();
      return { estado: esVence ? "vence" : "ocupada", reserva: r };
    }
  }
  return { estado: "libre", reserva: null };
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
    return habitaciones.filter((h) => {
      const { estado } = getEstadoHab(reservas, h.id, hoy);
      return estado === "vence";
    });
  }, [habitaciones, reservas, hoy]);

  // Para el detalle del almanaque (mensual): usa el día clickeado
  const estadosDetalle = useMemo(() => {
    const refDia = diaSelec ?? hoy;
    return habitaciones.map((h) => ({
      hab: h,
      ...getEstadoHab(reservas, h.id, refDia),
    }));
  }, [habitaciones, reservas, diaSelec, hoy]);

  // Para Vista del día: SIEMPRE usa hoy, nunca diaSelec
  const estadosHoy = useMemo(() => {
    return habitaciones.map((h) => ({
      hab: h,
      ...getEstadoHab(reservas, h.id, hoy),
    }));
  }, [habitaciones, reservas, hoy]);

  const metricasHoy = useMemo(() => {
    let libres = 0, ocupadas = 0, vence = 0;
    habitaciones.forEach((h) => {
      const { estado } = getEstadoHab(reservas, h.id, hoy);
      if (estado === "libre") libres++;
      else if (estado === "ocupada") ocupadas++;
      else vence++;
    });
    return { libres, ocupadas, vence, total: habitaciones.length };
  }, [habitaciones, reservas, hoy]);

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

  const renderFilaDia = ({ hab, estado, reserva }) => {
    const egr = reserva ? toDateOnly(reserva.fechaEgreso) : null;
    const egresoStr = egr
      ? `${egr.getDate().toString().padStart(2,"0")}/${(egr.getMonth()+1).toString().padStart(2,"0")}`
      : null;
    return (
      <div key={hab.id} className={`${styles.filaHab} ${styles[estado]}`}>
        <span className={`${styles.dot} ${styles[`dot_${estado}`]}`} />
        <div className={styles.filaInfo}>
          <span className={styles.filaHabNombre}>{hab.nombre || hab.tipo} · {hab.tipo}</span>
          {reserva && (
            <span className={styles.filaHuesped}>
              {reserva.apellidoNombre}
              {egresoStr ? ` · sale ${egresoStr}` : ""}
              {reserva.precioFinal ? ` · $${Number(reserva.precioFinal).toLocaleString("es-AR")}/noche` : ""}
            </span>
          )}
        </div>
        <span className={`${styles.badge} ${styles[`badge_${estado}`]}`}>
          {estado === "libre" ? "Libre" : estado === "ocupada" ? "Ocupada" : "Vence hoy"}
        </span>
        {renderBotones(estado, reserva, hab.nombre || hab.tipo)}
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
            <strong>{vencenHoy.map(h => h.nombre || h.tipo).join(", ")}</strong>
            {vencenHoy.length === 1 ? " tiene" : " tienen"} check-out hoy antes de las 10:00 hs.
            {" "}Podés liberar o agregar un día extra desde la grilla.
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
                    <td className={styles.tdHabNombre}>{hab.nombre || hab.tipo}</td>
                    {Array.from({ length: dias }, (_, i) => i + 1).map((d) => {
                      const fecha = new Date(yr, mo, d);
                      const { estado } = getEstadoHab(reservas, hab.id, fecha);
                      const esHoy2 = yr === hoy.getFullYear() && mo === hoy.getMonth() && d === hoy.getDate();
                      const esSel  = diaSelec && diaSelec.getTime() === fecha.getTime();
                      return (
                        <td key={d} className={`${styles.tdDia} ${esHoy2 ? styles.tdHoy : ""}`}>
                          <span
                            className={`${styles.celda} ${styles[`celda_${estado}`]} ${esSel ? styles.celdaSel : ""}`}
                            onClick={() => selDia(d)}
                            title={`${hab.nombre || hab.tipo} · ${estado}`}
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
                    {hab.nombre || hab.tipo}
                  </span>
                </div>
                <div className={styles.mobileDaysGrid}>
                  {Array.from({ length: dias }, (_, i) => i + 1).map((d) => {
                    const fecha = new Date(yr, mo, d);
                    const { estado } = getEstadoHab(reservas, hab.id, fecha);
                    const esHoy = yr === hoy.getFullYear() && mo === hoy.getMonth() && d === hoy.getDate();
                    const esSel = diaSelec && diaSelec.getTime() === fecha.getTime();

                    return (
                      <button
                        key={d}
                        type="button"
                        className={`${styles.mobileDayCell} ${styles[`mobileDay_${estado}`]} ${
                          esHoy ? styles.mobileDayHoy : ""
                        } ${esSel ? styles.mobileDaySel : ""}`}
                        onClick={() => selDia(d)}
                        title={`${hab.nombre || hab.tipo} · ${estado}`}
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
            <span><span className={`${styles.dot} ${styles.dot_ocupada}`} /> Ocupada</span>
            <span><span className={`${styles.dot} ${styles.dot_vence}`} /> Vence ese día</span>
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
              <span className={styles.metNum}>{metricasHoy.total}</span>
              <span className={styles.metLabel}>Total</span>
            </div>
            <div className={`${styles.metCard} ${styles.metLibre}`}>
              <span className={styles.metNum}>{metricasHoy.libres}</span>
              <span className={styles.metLabel}>Libres</span>
            </div>
            <div className={`${styles.metCard} ${styles.metOcup}`}>
              <span className={styles.metNum}>{metricasHoy.ocupadas}</span>
              <span className={styles.metLabel}>Ocupadas</span>
            </div>
            <div className={`${styles.metCard} ${styles.metVence}`}>
              <span className={styles.metNum}>{metricasHoy.vence}</span>
              <span className={styles.metLabel}>Vencen hoy</span>
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
