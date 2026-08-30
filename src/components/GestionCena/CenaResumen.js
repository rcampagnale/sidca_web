import React, { useMemo } from "react";
import { estadoAcreditacionReservaCena, resumirTarjetasVigentesCena } from "../../services/gestionCenaService";
import styles from "../../pages/Admin/GestionCena/GestionCenaAdmin.module.css";

export const calcularResumenCena = (reservas = [], tarjetas = []) => {
  const resumenTarjetas = resumirTarjetasVigentesCena(tarjetas);
  const porReserva = new Map();
  tarjetas.forEach((tarjeta) => {
    const lista = porReserva.get(tarjeta.reservaId) || [];
    lista.push(tarjeta);
    porReserva.set(tarjeta.reservaId, lista);
  });

  return {
    afiliados: reservas.filter((r) => r.estado !== "anulada").length,
    tarjetas: resumenTarjetas.total,
    titulares: resumenTarjetas.vigentes.filter((t) => t.tipo === "titular").length,
    acompanantes: resumenTarjetas.vigentes.filter((t) => t.tipo === "acompanante").length,
    acreditadas: resumenTarjetas.acreditadas,
    pendientes: resumenTarjetas.pendientes,
    porcentaje: resumenTarjetas.total ? Math.round((resumenTarjetas.acreditadas / resumenTarjetas.total) * 100) : 0,
    sinAcreditar: reservas.filter((r) => estadoAcreditacionReservaCena(r, porReserva.get(r.id) || []) === "SIN ACREDITAR").length,
    parciales: reservas.filter((r) => estadoAcreditacionReservaCena(r, porReserva.get(r.id) || []) === "PARCIAL").length,
    completas: reservas.filter((r) => estadoAcreditacionReservaCena(r, porReserva.get(r.id) || []) === "ACREDITADA").length,
  };
};

const CenaResumen = ({ reservas, tarjetas }) => {
  const resumen = useMemo(() => calcularResumenCena(reservas, tarjetas), [reservas, tarjetas]);
  const items = [
    ["AFILIADOS CON RESERVA", resumen.afiliados],
    ["TOTAL TARJETAS VIGENTES", resumen.tarjetas],
    ["TITULARES", resumen.titulares],
    ["ACOMPAÑANTES", resumen.acompanantes],
    ["ACREDITADAS", resumen.acreditadas],
    ["PENDIENTES", resumen.pendientes],
    ["PORCENTAJE DE ACREDITACIÓN", `${resumen.porcentaje}%`],
    ["Reservas sin acreditar", resumen.sinAcreditar],
    ["Reservas parciales", resumen.parciales],
    ["Reservas completas", resumen.completas],
  ];

  return (
    <section className={styles.gcSummaryGrid}>
      {items.map(([label, value]) => (
        <article key={label} className={styles.gcMetric}>
          <span>{label}</span>
          <strong>{value}</strong>
        </article>
      ))}
    </section>
  );
};

export default CenaResumen;
