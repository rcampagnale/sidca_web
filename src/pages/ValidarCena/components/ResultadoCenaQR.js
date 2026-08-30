import React from "react";
import { etiquetaTarjetaCena, fechaAnulacionCena, fechaValidacionCena, usuarioAnulacionCena, usuarioValidacionCena } from "./cenaTrazabilidad";

const MENSAJES = {
  pendiente: ["Tarjeta pendiente", "La tarjeta puede acreditarse cuando confirmes el ingreso."],
  validada: ["TARJETA REGISTRADA", "Ingreso registrado correctamente. No se realizará un segundo registro."],
  anulada: ["TARJETA ANULADA", "Esta tarjeta no puede registrar ingreso."],
  reemplazada: ["TARJETA REEMPLAZADA", "Esta tarjeta fue reemplazada y no puede registrar ingreso."],
  reserva_anulada: ["Reserva anulada", "La reserva se encuentra anulada y no puede acreditarse."],
  consulta_reserva: ["Consulta de reserva", "La búsqueda por DNI sólo informa el estado; no acredita ninguna tarjeta."],
};

const ResultadoCenaQR = ({ validacion, registroRecienRealizado, registrando, onRegistrar }) => {
  if (!validacion) return null;
  const mensajeValidada = registroRecienRealizado
    ? ["TARJETA REGISTRADA CON ÉXITO", "Ingreso registrado correctamente."]
    : ["INGRESO YA REGISTRADO", "Esta tarjeta ya registra un ingreso."];
  const [titulo, detalle] = validacion.estado === "validada"
    ? mensajeValidada
    : MENSAJES[validacion.estado] || ["Estado de la tarjeta", "Revisá los datos de la reserva."];
  const clase = validacion.estado === "pendiente"
    ? "gcCenaResultadoPendiente"
    : validacion.estado === "validada"
      ? registroRecienRealizado ? "gcCenaResultadoExito" : "gcCenaResultadoYaRegistrado"
      : validacion.estado === "consulta_reserva" ? "gcCenaResultadoConsulta" : "gcCenaResultadoBloqueado";
  const icono = validacion.estado === "pendiente"
    ? "pi-exclamation-circle"
    : validacion.estado === "validada"
      ? registroRecienRealizado ? "pi-check-circle" : "pi-history"
      : validacion.estado === "consulta_reserva" ? "pi-info-circle" : "pi-times-circle";
  const tarjeta = validacion.tarjeta;
  const fechaIngreso = validacion.estado === "validada" ? fechaValidacionCena(tarjeta) : "";
  const fechaAnulacion = ["anulada", "reemplazada"].includes(validacion.estado) ? fechaAnulacionCena(tarjeta) : "";

  return (
    <section className={`gcCenaResultado ${clase}`} role="status" aria-live="polite">
      <div>
        <p><i className={`pi ${icono}`} aria-hidden="true" /> {titulo}</p>
        <span>{detalle}</span>
        {validacion.estado === "validada" && <><span>Tarjeta: {etiquetaTarjetaCena(tarjeta)}</span>{fechaIngreso && <span>Fecha y hora: {fechaIngreso}</span>}<span>Registrado por: {usuarioValidacionCena(tarjeta)}</span></>}
        {["anulada", "reemplazada"].includes(validacion.estado) && <>
          {fechaAnulacion && <span>Fecha: {fechaAnulacion}</span>}
          <span>Usuario: {usuarioAnulacionCena(tarjeta)}</span>
          {tarjeta?.motivoAnulacion && <span>Motivo: {tarjeta.motivoAnulacion}</span>}
          {validacion.tarjetaReemplazo && <span>Esta tarjeta fue reemplazada. Nueva tarjeta vigente: {etiquetaTarjetaCena(validacion.tarjetaReemplazo)}.</span>}
        </>}
      </div>
      {validacion.puedeAcreditar && <button type="button" onClick={onRegistrar} disabled={registrando}>{registrando ? "Registrando ingreso..." : "Registrar ingreso"}</button>}
    </section>
  );
};

export default ResultadoCenaQR;
