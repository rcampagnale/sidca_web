import React, { useMemo } from "react";
import { Button } from "primereact/button";
import { InputText } from "primereact/inputtext";
import { DataTable } from "primereact/datatable";
import { Column } from "primereact/column";
import styles from "../../pages/Admin/Servicios/servicios.module.css";

const ESTADO_CUOTA_COBRADO = "cobrado";
const ESTADO_CUOTA_DESCUENTO_PARCIAL = "descuento_parcial";
const ESTADO_CUOTA_NO_COBRADO = "no_cobrado";

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

const pad2 = (valor) => String(valor).padStart(2, "0");

const sumarMesesPeriodo = (periodo, cantidadMeses) => {
  if (!periodo) return "";

  const [anio, mes] = String(periodo).split("-").map(Number);

  if (!anio || !mes) return "";

  const fecha = new Date(anio, mes - 1 + cantidadMeses, 1);

  return `${fecha.getFullYear()}-${pad2(fecha.getMonth() + 1)}`;
};

const capitalizar = (texto) => {
  const limpio = String(texto || "").trim();

  if (!limpio) return "";

  return limpio.charAt(0).toUpperCase() + limpio.slice(1);
};

const periodoTexto = (periodo) => {
  if (!periodo) return "Sin mes definido";

  const [anio, mes] = String(periodo).split("-").map(Number);

  if (!anio || !mes) return "Sin mes definido";

  return capitalizar(`${MESES[mes - 1]} ${anio}`);
};

const formatearMoneda = (valor) => {
  const numero = Number(valor || 0);

  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(numero);
};

const obtenerMontoDescontadoCuota = (cuota, valorCuotaServicio = 0) => {
  const estado = cuota?.estado;

  if (estado === ESTADO_CUOTA_DESCUENTO_PARCIAL) {
    return Number(cuota?.importeDescontado || 0);
  }

  if (estado === ESTADO_CUOTA_COBRADO) {
    return Number(cuota?.importeDescontado || cuota?.valorCuota || valorCuotaServicio || 0);
  }

  return 0;
};

const esCuotaRegularizacion = (cuota) =>
  cuota?.origenActualizacion === "manual_extra" ||
  cuota?.esRegularizacionDeuda === true ||
  String(cuota?.etiquetaCuota || "").toUpperCase() === "EXTRA";

const obtenerDetalleRegularizacion = (cuota, cuotas) => {
  const cuotasPorId = new Map(
    (cuotas || []).map((item) => [String(item.id), item])
  );
  const fuentes = [];
  const visitadas = new Set();

  const agregarFuentes = (cuotaActual) => {
    if (!cuotaActual || visitadas.has(cuotaActual.id)) return;
    visitadas.add(cuotaActual.id);

    const idsVinculados = Array.isArray(cuotaActual.regularizaCuotasIds)
      ? cuotaActual.regularizaCuotasIds
      : [];
    let vinculadas = idsVinculados
      .map((id) => cuotasPorId.get(String(id)))
      .filter(Boolean);
    if (vinculadas.length === 0 && esCuotaRegularizacion(cuotaActual)) {
      vinculadas = (cuotas || []).filter(
        (item) =>
          String(item?.cuotaRegularizacionId || "") ===
          String(cuotaActual.id)
      );
    }

    if (esCuotaRegularizacion(cuotaActual) && vinculadas.length > 0) {
      vinculadas.forEach(agregarFuentes);
      return;
    }

    if (!esCuotaRegularizacion(cuotaActual)) {
      fuentes.push(cuotaActual);
    }
  };

  agregarFuentes(cuota);

  if (fuentes.length === 0) return "Cuota extra por saldo pendiente";

  const detalleFuentes = fuentes
    .map((fuente) => {
      const cuotaTexto =
        fuente?.etiquetaCuota || fuente?.numeroCuota || fuente?.id || "-";
      const motivo =
        fuente?.estado === ESTADO_CUOTA_DESCUENTO_PARCIAL
          ? "pago parcial"
          : fuente?.estado === ESTADO_CUOTA_NO_COBRADO
          ? "no cobrada"
          : "saldo pendiente";

      return `Cuota ${cuotaTexto} · ${motivo}`;
    })
    .join(" + ");

  return `Cuota extra por saldo pendiente · ${detalleFuentes}`;
};

const obtenerMovimientosMensualesDelServicio = (servicio) => {
  const valorCuotaServicio = Number(servicio?.valorCuota || 0);
  const servicioKey =
    servicio?.path ||
    `${servicio?.servicioId || servicio?.servicioNombre || "servicio"}-${
      servicio?.subcontratacionId || servicio?.id || servicio?.dni || ""
    }`;
  const servicioNombre = servicio?.servicioNombre || "Servicio";
  const esPagoContado =
    servicio?.esPagoContado === true || servicio?.tipoPago === "contado";

  if (Array.isArray(servicio?.cuotas) && servicio.cuotas.length > 0) {
    const cuotas = servicio.cuotas;

    return cuotas
      .filter((cuota) =>
        [
          ESTADO_CUOTA_COBRADO,
          ESTADO_CUOTA_DESCUENTO_PARCIAL,
          ESTADO_CUOTA_NO_COBRADO,
        ].includes(cuota?.estado)
      )
      .map((cuota) => ({
        periodo: cuota?.periodoCobro || "",
        periodoTexto: periodoTexto(cuota?.periodoCobro),
        valorDescontado: obtenerMontoDescontadoCuota(cuota, valorCuotaServicio),
        servicioKey,
        servicioNombre,
        cuotaTexto: esCuotaRegularizacion(cuota)
            ? obtenerDetalleRegularizacion(cuota, cuotas)
            : esPagoContado
            ? "Pago único"
            : `Cuota ${
                cuota?.etiquetaCuota || cuota?.numeroCuota || "-"
              }`,
        estado: cuota?.estado,
        descuentoRealizado: [
          ESTADO_CUOTA_COBRADO,
          ESTADO_CUOTA_DESCUENTO_PARCIAL,
        ].includes(cuota?.estado),
      }))
      .filter((item) => item.periodo);
  }

  const cuotasCobradas = Number(servicio?.cuotasCobradas || 0);
  const periodoCobroInicial = servicio?.periodoCobroInicial || "";

  const meses = [];

  for (let i = 0; i < cuotasCobradas; i++) {
    const periodo = sumarMesesPeriodo(periodoCobroInicial, i);

    if (periodo) {
      meses.push({
        periodo,
        periodoTexto: periodoTexto(periodo),
        valorDescontado: valorCuotaServicio,
        servicioKey,
        servicioNombre,
        cuotaTexto: esPagoContado ? "Pago único" : `Cuota ${i + 1}`,
        estado: ESTADO_CUOTA_COBRADO,
        descuentoRealizado: true,
      });
    }
  }

  return meses;
};

const BusquedaGeneralServicios = ({
  busquedaGeneral,
  onChangeBusquedaGeneral,
  onBuscar,
  onLimpiar,
  loadingBusquedaGeneral,
  busquedaGeneralRealizada,
  resultadosBusquedaGeneral,
  onVerCuotas,
}) => {
  const resumenMensual = useMemo(() => {
    const mapa = new Map();

    (resultadosBusquedaGeneral || []).forEach((servicio) => {
      const movimientosMensuales =
        obtenerMovimientosMensualesDelServicio(servicio);

      movimientosMensuales.forEach((item) => {
        const actual = mapa.get(item.periodo) || {
          periodo: item.periodoTexto,
          periodoOrden: item.periodo,
          totalMensual: 0,
          serviciosSet: new Set(),
          serviciosDescontadosSet: new Set(),
          movimientos: [],
        };

        actual.totalMensual += Number(item.valorDescontado || 0);
        actual.serviciosSet.add(item.servicioKey);
        if (item.descuentoRealizado) {
          actual.serviciosDescontadosSet.add(item.servicioKey);
        }
        actual.movimientos.push(item);

        mapa.set(item.periodo, actual);
      });
    });

    return Array.from(mapa.values())
      .sort((a, b) =>
        String(b.periodoOrden).localeCompare(String(a.periodoOrden))
      )
      .map((item) => ({
        periodo: item.periodo,
        periodoOrden: item.periodoOrden,
        cantidadServicios: item.serviciosSet.size,
        cantidadServiciosDescontados: item.serviciosDescontadosSet.size,
        totalMensual: item.totalMensual,
        movimientos: item.movimientos.sort((a, b) =>
          String(a.servicioNombre).localeCompare(
            String(b.servicioNombre),
            "es"
          )
        ),
      }));
  }, [resultadosBusquedaGeneral]);

  const afiliadoTemplate = (rowData) => {
    return (
      <div className={styles.busquedaAfiliadoCell}>
        <strong>{rowData?.apellidoNombre || "Sin nombre registrado"}</strong>
        <span>DNI {rowData?.dni || "-"}</span>
      </div>
    );
  };

  const servicioTemplate = (rowData) => {
    const cancelado = rowData?.cancelado === true || rowData?.estadoContratacion === "cancelada";
    const contado = rowData?.esPagoContado === true || rowData?.tipoPago === "contado";

    return (
      <div className={styles.busquedaServicioCell}>
        <strong>{rowData?.servicioNombre || "Servicio"}</strong>
        <span
          className={
            cancelado
              ? styles.busquedaBadgeCancelado
              : contado
              ? styles.busquedaBadgeContado
              : styles.busquedaBadgeCuotas
          }
        >
          {cancelado ? "Viaje cancelado" : contado ? "Contado" : "Cuotas"}
        </span>
      </div>
    );
  };

  const periodosTemplate = (rowData) => {
    return (
      <div className={styles.busquedaPeriodosCell}>
        <span>
          <b>Haber:</b> {rowData?.periodoHaberInicialTexto || "-"}
        </span>
        <span>
          <b>Primer cobro:</b> {rowData?.periodoCobroInicialTexto || "-"}
        </span>
      </div>
    );
  };

  const importeResumenTemplate = (rowData) => {
    const cobradas = Number(rowData?.cuotasCobradas || 0);
    const parciales = Number(rowData?.cuotasParciales || 0);
    const noCobradas = Number(rowData?.cuotasNoCobradas || 0);
    const canceladas = Number(rowData?.cuotasCanceladas || 0);
    const pendientes = Number(rowData?.cuotasPendientes || 0);

    return (
      <div className={styles.busquedaImporteResumenCell}>
        <strong>{formatearMoneda(rowData?.valorCuota)}</strong>
        <div className={styles.busquedaResumenBadges}>
          <span className={styles.busquedaBadgeCobrado}>C {cobradas}</span>
          <span className={styles.busquedaBadgeParcial}>P {parciales}</span>
          <span className={styles.busquedaBadgeNoCobrado}>NC {noCobradas}</span>
          <span className={styles.busquedaBadgeCanceladoMini}>CAN {canceladas}</span>
          <span className={styles.busquedaBadgePendiente}>PE {pendientes}</span>
        </div>
      </div>
    );
  };

  const totalMensualTemplate = (rowData) => {
    const sinDescuento =
      Number(rowData?.totalMensual || 0) <= 0 &&
      Number(rowData?.cantidadServicios || 0) > 0;

    return (
      <div className={styles.totalMensualServicioCelda}>
        <strong
          className={
            sinDescuento
              ? styles.totalMensualSinDescuento
              : styles.totalMensualServicio
          }
        >
          {formatearMoneda(rowData?.totalMensual)}
        </strong>
        {sinDescuento && <small>No se realizó el descuento</small>}
      </div>
    );
  };

  const estadoMovimiento = (movimiento) => {
    if (movimiento?.estado === ESTADO_CUOTA_NO_COBRADO) {
      return {
        texto: "No descontado",
        clase: styles.movimientoEstadoRechazado,
      };
    }
    if (movimiento?.estado === ESTADO_CUOTA_DESCUENTO_PARCIAL) {
      return {
        texto: "Pago parcial",
        clase: styles.movimientoEstadoParcial,
      };
    }
    return {
      texto: "Cobrado",
      clase: styles.movimientoEstadoCobrado,
    };
  };

  const accionesTemplate = (rowData) => {
    return (
      <Button
        icon="pi pi-list"
        label="Ver cuotas"
        className="p-button-sm p-button-info"
        onClick={() => onVerCuotas(rowData)}
      />
    );
  };

  return (
    <>
      <div className={styles.busquedaGeneralBox}>
        <div>
          <h3>Buscar afiliado en servicios contratados</h3>
          <p>
            Buscá por DNI, apellido o nombre para ver todos los servicios
            contratados por un afiliado.
          </p>
        </div>

        <div className={styles.busquedaGeneralControls}>
          <InputText
            value={busquedaGeneral}
            onChange={(e) => onChangeBusquedaGeneral(e.target.value)}
            placeholder="DNI, apellido o nombre"
          />

          <Button
            label="Buscar"
            icon="pi pi-search"
            onClick={onBuscar}
            loading={loadingBusquedaGeneral}
          />

          <Button
            label="Limpiar"
            icon="pi pi-times"
            className="p-button-secondary"
            onClick={onLimpiar}
            disabled={loadingBusquedaGeneral}
          />
        </div>
      </div>

      {busquedaGeneralRealizada && (
        <div className={styles.tableContainer}>
          <h3 className={styles.sectionTitle}>Resultado de búsqueda general</h3>

          <DataTable
            value={resultadosBusquedaGeneral}
            emptyMessage="No se encontraron servicios contratados para la búsqueda."
            responsiveLayout="scroll"
            paginator
            rows={5}
            rowsPerPageOptions={[5, 10, 20]}
            className={styles.busquedaGeneralTable}
          >
            <Column header="Afiliado" body={afiliadoTemplate} sortable style={{ minWidth: "220px" }} />
            <Column header="Servicio" body={servicioTemplate} sortable style={{ minWidth: "260px" }} />
            <Column header="Períodos" body={periodosTemplate} style={{ minWidth: "260px" }} />
            <Column header="Valor y resumen" body={importeResumenTemplate} style={{ minWidth: "320px" }} />
            <Column header="Acciones" body={accionesTemplate} style={{ minWidth: "130px" }} />
          </DataTable>

          {resultadosBusquedaGeneral?.length > 0 && (
            <div className={styles.resumenTotalMensualBox}>
              <div className={styles.resumenTotalMensualTabla}>
                <h4>Movimientos por mes de cobro</h4>

                <div className={styles.movimientosMensuales}>
                  {resumenMensual.length === 0 && (
                    <div className={styles.movimientosVacios}>
                      Todavía no hay cobros procesados.
                    </div>
                  )}

                  {resumenMensual.map((mes) => (
                    <section
                      key={mes.periodoOrden}
                      className={styles.movimientoMes}
                    >
                      <header className={styles.movimientoMesHeader}>
                        <div>
                          <strong>{mes.periodo}</strong>
                          <span>
                            {mes.cantidadServicios}{" "}
                            {mes.cantidadServicios === 1
                              ? "servicio"
                              : "servicios"}
                          </span>
                        </div>
                        {totalMensualTemplate(mes)}
                      </header>

                      <div className={styles.movimientoLista}>
                        {mes.movimientos.map((movimiento, index) => {
                          const estado = estadoMovimiento(movimiento);
                          const sinDescuento =
                            Number(movimiento.valorDescontado || 0) <= 0;

                          return (
                            <div
                              key={`${movimiento.servicioKey}-${index}`}
                              className={styles.movimientoFila}
                            >
                              <div className={styles.movimientoServicio}>
                                <span className={styles.movimientoIcono}>
                                  <i className="pi pi-briefcase" />
                                </span>
                                <div>
                                  <strong>{movimiento.servicioNombre}</strong>
                                  <span>{movimiento.cuotaTexto}</span>
                                </div>
                              </div>

                              <span className={estado.clase}>
                                {estado.texto}
                              </span>

                              <div className={styles.movimientoImporte}>
                                <strong
                                  className={
                                    sinDescuento
                                      ? styles.movimientoImporteCero
                                      : ""
                                  }
                                >
                                  {sinDescuento ? "" : "-"}
                                  {formatearMoneda(
                                    movimiento.valorDescontado
                                  )}
                                </strong>
                                {sinDescuento && (
                                  <small>No se realizó el descuento</small>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </section>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </>
  );
};

export default BusquedaGeneralServicios;
