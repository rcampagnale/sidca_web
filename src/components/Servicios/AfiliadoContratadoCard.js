import React from "react";
import { Button } from "primereact/button";

import styles from "./DetalleServicioDialog.module.css";

const MESES = [
  "enero",
  "febrero",
  "marzo",
  "abril",
  "mayo",
  "junio",
  "julio",
  "agosto",
  "septiembre",
  "octubre",
  "noviembre",
  "diciembre",
];

const periodoTexto = (periodo) => {
  if (!periodo) return "-";
  const [anio, mes] = String(periodo).split("-").map(Number);
  if (!anio || !mes) return "-";
  return `${MESES[mes - 1]} ${anio}`;
};

const formatearMoneda = (valor) =>
  new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(Number(valor || 0));

const obtenerCantidad = (rowData, campo) => Number(rowData?.[campo] || 0);

const obtenerCantidadPersonas = (rowData) =>
  Math.max(1, Number(rowData?.cantidadLugares || rowData?.cantidadPersonas || 1));

const estadoBadge = (rowData) => {
  if (rowData?.cancelado)
    return <span className={styles.estadoCancelado}>Viaje cancelado</span>;
  if (rowData?.esPagoContado || rowData?.tipoPago === "contado")
    return <span className={styles.estadoContado}>Contado</span>;
  return <span className={styles.estadoCuotas}>Cuotas</span>;
};

const esPagoCompleto = (rowData, servicioSeleccionado) => {
  const esPagoContado =
    rowData?.esPagoContado === true || rowData?.tipoPago === "contado";
  const sinIncidencias =
    obtenerCantidad(rowData, "cuotasParciales") === 0 &&
    obtenerCantidad(rowData, "cuotasNoCobradas") === 0 &&
    obtenerCantidad(rowData, "cuotasCanceladas") === 0 &&
    obtenerCantidad(rowData, "cuotasPendientes") === 0;
  const contadoCobrado =
    esPagoContado &&
    obtenerCantidad(rowData, "cuotasCobradas") >= 1 &&
    sinIncidencias;
  const valorTotal = Number(
    rowData?.valorTotalContratacion ||
      Number(rowData?.cantidadCuotas || servicioSeleccionado?.cantidadCuotas || 0) *
        Number(rowData?.valorCuota || 0)
  );
  const totalDescontado = Number(rowData?.totalDescontadoContratacion || 0);
  const saldoPendiente = Number(rowData?.saldoPendienteContratacion || 0);

  return (
    !rowData?.cancelado &&
    (contadoCobrado ||
      (valorTotal > 0 &&
        totalDescontado >= valorTotal &&
        saldoPendiente <= 0 &&
        sinIncidencias))
  );
};

const resumenBadges = (rowData) => {
  const items = [
    { label: "C", campo: "cuotasCobradas", cls: styles.badgeCobrado, title: "Cobradas" },
    { label: "P", campo: "cuotasParciales", cls: styles.badgeParcial, title: "Parciales" },
    { label: "NC", campo: "cuotasNoCobradas", cls: styles.badgeNoCobrado, title: "No cobradas" },
    { label: "CAN", campo: "cuotasCanceladas", cls: styles.badgeCancelado, title: "Canceladas" },
    { label: "PE", campo: "cuotasPendientes", cls: styles.badgePendiente, title: "Pendientes" },
  ];

  return (
    <div className={styles.resumenBadgesRow}>
      {items.map(({ label, campo, cls, title }) => (
        <span key={campo} className={`${styles.resumenBadge} ${cls}`} title={title}>
          <b>{label}</b> {obtenerCantidad(rowData, campo)}
        </span>
      ))}
    </div>
  );
};

const AfiliadoContratadoCard = ({
  rowData,
  servicioSeleccionado,
  onVerCuotas,
  onEliminarContratacion,
}) => {
  if (!rowData) return null;

  const personas = obtenerCantidadPersonas(rowData);
  const cancelado = !!rowData?.cancelado;
  const esSub = !!rowData?.esSubcontratacion;
  const pagoCompleto = esPagoCompleto(rowData, servicioSeleccionado);
  const esPagoContado =
    rowData?.esPagoContado === true || rowData?.tipoPago === "contado";
  const cantidadCuotas = Number(
    rowData?.cantidadCuotas || servicioSeleccionado?.cantidadCuotas || 0
  );
  const detallePlan =
    rowData?.detalleCuotasExcel ||
    rowData?.detalleCuotas ||
    (cantidadCuotas > 0
      ? `${String(cantidadCuotas).padStart(2, "0")} cuotas de ${formatearMoneda(
          rowData?.valorCuota
        )}`
      : "");

  return (
    <div
      className={`${styles.afiliadoCard} ${
        cancelado ? styles.afiliadoCardCancelado : ""
      } ${esSub ? styles.afiliadoCardSub : ""} ${
        pagoCompleto ? styles.afiliadoCardPagado : ""
      }`}
    >
      {pagoCompleto && (
        <div className={styles.pagoCompletoFranja}>
          <i className="pi pi-check-circle" />
          {esPagoContado ? "Pago de contado completado" : "Todas las cuotas pagadas"}
        </div>
      )}

      <div className={styles.cardTop}>
        <div className={styles.cardNombreBloque}>
          <div className={styles.cardNombreRow}>
            <strong className={styles.cardNombre}>
              {rowData?.apellidoNombre || "Sin nombre registrado"}
            </strong>
            {esSub && <span className={styles.subBadge}>Contrato adicional</span>}
          </div>
          <div className={styles.cardMeta}>
            <span>
              <b>DNI</b> {rowData?.dni || "-"}
            </span>
            {(rowData?.departamentoServicio || rowData?.departamento) && (
              <span>
                <b>Depto.</b> {rowData.departamentoServicio || rowData.departamento}
              </span>
            )}
            {(rowData?.telefonoContacto || rowData?.telefono) && (
              <span>
                <b>Tel</b> {rowData.telefonoContacto || rowData.telefono}
              </span>
            )}
            <span className={styles.personasBadge}>
              <i className="pi pi-user" style={{ fontSize: "0.75rem" }} />
              {personas} {personas === 1 ? "persona" : "personas"}
            </span>
          </div>
        </div>
        <div className={styles.cardEstadoBloque}>{estadoBadge(rowData)}</div>
      </div>

      <div className={styles.cardMiddle}>
        <div className={styles.cardDato}>
          <span>Valor cuota</span>
          <strong>{formatearMoneda(rowData?.valorCuota)}</strong>
        </div>
        <div className={styles.cardDato}>
          <span>Haber inicial</span>
          <strong>{periodoTexto(rowData?.periodoHaberInicial) || "-"}</strong>
        </div>
        <div className={styles.cardDato}>
          <span>1er cobro</span>
          <strong>{periodoTexto(rowData?.periodoCobroInicial) || "-"}</strong>
        </div>
        {detallePlan && (
          <div className={`${styles.cardDato} ${styles.cardDatoFull}`}>
            <span>Detalle</span>
            <strong>{detallePlan}</strong>
          </div>
        )}
      </div>

      <div className={styles.cardBottom}>
        {resumenBadges(rowData)}
        <div className={styles.cardAcciones}>
          <Button
            icon="pi pi-list"
            label="Ver cuotas"
            className={`p-button-sm p-button-info ${styles.cardBotonCuotas}`}
            onClick={() => onVerCuotas?.(rowData)}
          />
          {onEliminarContratacion && (
            <Button
              icon="pi pi-trash"
              label="Eliminar contratación"
              className="p-button-sm p-button-outlined p-button-danger"
              onClick={() => onEliminarContratacion(rowData)}
            />
          )}
        </div>
      </div>
    </div>
  );
};

export default AfiliadoContratadoCard;
