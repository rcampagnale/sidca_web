import React from "react";
import { etiquetaTarjetaCena, fechaAnulacionCena, fechaValidacionCena, usuarioAnulacionCena, usuarioValidacionCena } from "./cenaTrazabilidad";

const estadoTarjeta = (tarjeta) => {
  if (tarjeta.anulada) return "ANULADA";
  if (tarjeta.validada || tarjeta.estado === "validada") return "INGRESÓ";
  return "PENDIENTE";
};

const TarjetasReservaValidador = ({ tarjetas = [], tarjetasHistoricas = [], tarjetaSeleccionada, modoSeleccion = false, seleccionadas = [], onCambiarSeleccion }) => {
  const vigentes = tarjetas.filter((tarjeta) => tarjeta.anulada !== true && tarjeta.reemplazada !== true);
  const historicas = tarjetasHistoricas.length ? tarjetasHistoricas : tarjetas.filter((tarjeta) => tarjeta.anulada === true || tarjeta.reemplazada === true);
  const renderTarjeta = (tarjeta) => {
    const seleccionada = tarjetaSeleccionada && tarjeta.id === tarjetaSeleccionada.id;
    const estado = estadoTarjeta(tarjeta);
    const esSeleccionable = modoSeleccion && estado === "PENDIENTE";
    const id = tarjeta.id;
    const seleccionadaPorId = seleccionadas.includes(id);
    return (
      <li key={tarjeta.id} className={`gcCenaTarjeta ${esSeleccionable ? "gcCenaTarjetaConSeleccion" : ""} ${seleccionada || seleccionadaPorId ? "gcCenaTarjetaSeleccionada" : ""}`}>
        {esSeleccionable && <input type="checkbox" aria-label={`Seleccionar ${etiquetaTarjetaCena(tarjeta)}`} checked={seleccionadaPorId} onChange={() => onCambiarSeleccion?.(id)} />}
        <div>
          <strong>{etiquetaTarjetaCena(tarjeta)}</strong>
          {tarjeta.esReemision && <small>Reemisión {tarjeta.numeroReemision || 1}</small>}
          {estado === "INGRESÓ" && <>
            {fechaValidacionCena(tarjeta) && <small>Ingreso {fechaValidacionCena(tarjeta)}</small>}
            <small>Registrado por: {usuarioValidacionCena(tarjeta)}</small>
          </>}
          {estado === "ANULADA" && <>
            {fechaAnulacionCena(tarjeta) && <small>Anulada {fechaAnulacionCena(tarjeta)}</small>}
            <small>Usuario: {usuarioAnulacionCena(tarjeta)}</small>
            {tarjeta.motivoAnulacion && <small>Motivo: {tarjeta.motivoAnulacion}</small>}
            {tarjeta.reemplazada && <small>Reemplazada por nueva tarjeta.</small>}
          </>}
        </div>
        <span className={`gcCenaEstado ${estado === "INGRESÓ" ? "gcCenaEstadoingreso" : `gcCenaEstado${estado.toLowerCase()}`}`}>{estado}</span>
      </li>
    );
  };

  return (
    <section className="gcCenaTarjetas" aria-label="Tarjetas de la reserva">
      <div className="gcCenaSeccionTitulo"><h2>Tarjetas de la reserva</h2><span>{vigentes.length}</span></div>
      {modoSeleccion && vigentes.some((tarjeta) => estadoTarjeta(tarjeta) === "PENDIENTE") && <div className="gcCenaSeleccionControles">
        <button type="button" onClick={() => onCambiarSeleccion?.("__todas__")}>
          {vigentes.filter((tarjeta) => estadoTarjeta(tarjeta) === "PENDIENTE").every((tarjeta) => seleccionadas.includes(tarjeta.id)) ? "Quitar selección" : "Seleccionar pendientes"}
        </button>
        <span>{seleccionadas.length} seleccionadas de {vigentes.filter((tarjeta) => estadoTarjeta(tarjeta) === "PENDIENTE").length} pendientes</span>
      </div>}
      {vigentes.length ? <ul>{vigentes.map(renderTarjeta)}</ul> : <p className="gcCenaVacio">No hay tarjetas vigentes para esta reserva.</p>}
      {historicas.length > 0 && <><div className="gcCenaSeccionTitulo gcCenaHistoricoTitulo"><h2>Historial de tarjetas</h2><span>{historicas.length}</span></div><ul>{historicas.map(renderTarjeta)}</ul></>}
    </section>
  );
};

export default TarjetasReservaValidador;
