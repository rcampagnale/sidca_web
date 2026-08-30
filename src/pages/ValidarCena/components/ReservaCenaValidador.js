import React from "react";

const formatearDni = (valor) => {
  const dni = String(valor || "").replace(/\D/g, "");
  return dni ? dni.replace(/\B(?=(\d{3})+(?!\d))/g, ".") : "Sin DNI";
};

const ReservaCenaValidador = ({ reserva, resumen }) => {
  if (!reserva) return null;
  const afiliado = reserva.afiliado || {};
  const nombre = [afiliado.apellido, afiliado.nombre].filter(Boolean).join(", ") || "Afiliado sin identificar";
  return (
    <section className="gcCenaReserva" aria-label="Resumen de la reserva">
      <p className="gcCenaEyebrow">RESERVA CENA {reserva.anio || ""}</p>
      <h2>{nombre}</h2>
      <p className="gcCenaDni">DNI {formatearDni(afiliado.dni)}</p>
      <dl className="gcCenaConteos">
        <div><dt>Total</dt><dd>{resumen?.total ?? reserva.cantidadTarjetas}</dd></div>
        <div><dt>Acreditadas</dt><dd>{resumen?.acreditadas ?? 0}</dd></div>
        <div><dt>Pendientes</dt><dd>{resumen?.pendientes ?? reserva.cantidadTarjetas}</dd></div>
      </dl>
    </section>
  );
};

export default ReservaCenaValidador;
