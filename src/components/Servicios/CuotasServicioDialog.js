// src/components/Servicios/CuotasServicioDialog.js

import React, { useMemo, useState, useEffect } from "react";
import { Dialog } from "primereact/dialog";
import { Button } from "primereact/button";
import { ProgressSpinner } from "primereact/progressspinner";
import { DataTable } from "primereact/datatable";
import { Column } from "primereact/column";

import styles from "./CuotasServicioDialog.module.css";

const ESTADO_CUOTA_PENDIENTE = "pendiente";
const ESTADO_CUOTA_COBRADO = "cobrado";
const ESTADO_CUOTA_NO_COBRADO = "no_cobrado";
const ESTADO_CUOTA_DESCUENTO_PARCIAL = "descuento_parcial";
const ESTADO_CUOTA_CANCELADA = "cancelada";

const formatearMoneda = (valor) => {
  const numero = Number(valor || 0);

  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(numero);
};

const obtenerNumero = (valor) => {
  const numero = Number(valor || 0);
  return Number.isNaN(numero) ? 0 : numero;
};

const cuotaTemplate = (rowData) => {
  const componentes = Array.isArray(rowData?.componentesLugares)
    ? rowData.componentesLugares
    : [];

  return (
    <div className={styles.cuotaCell}>
      <strong>{String(rowData?.numeroCuota || "-").padStart(2, "0")}</strong>
      {componentes.length > 0 ? (
        <div className={styles.composicionLugares}>
          {componentes.map((componente) => (
            <span
              key={`${componente.lugarNumero}-${componente.cuotaNumero}`}
            >
              Lugar {componente.lugarNumero} · {componente.cuotaNumero}/
              {componente.totalCuotas}
            </span>
          ))}
        </div>
      ) : (
        <span>{rowData?.etiquetaCuota || "Cuota"}</span>
      )}
    </div>
  );
};

const periodosTemplate = (rowData) => {
  return (
    <div className={styles.periodosCell}>
      <div>
        <span>Haber</span>
        <strong>{rowData?.periodoHaberTexto || "-"}</strong>
      </div>

      <div>
        <span>Cobra en</span>
        <strong>{rowData?.periodoCobroTexto || "-"}</strong>
      </div>
    </div>
  );
};

const importesTemplate = (rowData) => {
  const importeDescontado = rowData?.importeDescontado;
  const saldoPendiente = rowData?.saldoPendiente;

  const tieneDescontado =
    importeDescontado !== null &&
    importeDescontado !== undefined &&
    importeDescontado !== "";

  const tieneSaldo =
    saldoPendiente !== null &&
    saldoPendiente !== undefined &&
    saldoPendiente !== "";

  const saldo = obtenerNumero(saldoPendiente);

  return (
    <div className={styles.importesCell}>
      <div>
        <span>Valor cuota</span>
        <strong>{formatearMoneda(rowData?.valorCuota)}</strong>
      </div>

      <div>
        <span>Descontado</span>
        <strong>{tieneDescontado ? formatearMoneda(importeDescontado) : "-"}</strong>
      </div>

      <div>
        <span>Saldo</span>
        <strong className={saldo > 0 ? styles.saldoDebe : styles.saldoOk}>
          {tieneSaldo ? formatearMoneda(saldoPendiente) : "-"}
        </strong>
      </div>
    </div>
  );
};

// Este diálogo se reutiliza tanto para Viajes como para Cena del docente;
// el texto debe reflejar el servicio real en cada caso.
const ES_CENA_DOCENTE_REGEX = /CENA\s+DEL\s+(MAESTRO|DOCENTE)/i;

const crearEstadoTemplate = (esCenaDocente) => (rowData) => {
  if (rowData?.deudaRegularizada === true) {
    return <span className={styles.estadoRegularizada}>Regularizada</span>;
  }

  if (rowData?.estado === ESTADO_CUOTA_COBRADO) {
    return <span className={styles.estadoCobrada}>Cobrado</span>;
  }

  if (rowData?.estado === ESTADO_CUOTA_DESCUENTO_PARCIAL) {
    return <span className={styles.estadoParcial}>Pago parcial</span>;
  }

  if (rowData?.estado === ESTADO_CUOTA_NO_COBRADO) {
    return <span className={styles.estadoNoCobrada}>No cobrado</span>;
  }

  if (rowData?.estado === ESTADO_CUOTA_CANCELADA) {
    return (
      <span className={styles.estadoCancelada}>
        {esCenaDocente ? "Cena cancelada" : "Viaje cancelado"}
      </span>
    );
  }

  return <span className={styles.estadoPendiente}>Pendiente</span>;
};

const observacionTemplate = (rowData) => {
  const observacion = String(rowData?.observacion || "").trim();
  const origen = String(rowData?.origenActualizacion || "").trim();

  if (!observacion && !origen) {
    return <span className={styles.sinDato}>Sin observación</span>;
  }

  return (
    <div className={styles.observacionBox}>
      {origen === "excel_mensual" && (
        <span className={styles.origenExcel}>Excel mensual</span>
      )}
      {origen === "manual" && (
        <span className={styles.origenManual}>Carga manual</span>
      )}
      {rowData?.deudaRegularizada === true && (
        <span className={styles.origenRegularizada}>Deuda saldada</span>
      )}
      {observacion && <p>{observacion}</p>}
    </div>
  );
};

const rowClassName = (rowData) => {
  if (rowData?.estado === ESTADO_CUOTA_COBRADO) {
    return styles.filaCobrada;
  }

  if (rowData?.estado === ESTADO_CUOTA_DESCUENTO_PARCIAL) {
    return styles.filaParcial;
  }

  if (rowData?.estado === ESTADO_CUOTA_NO_COBRADO) {
    return styles.filaNoCobrada;
  }

  if (rowData?.estado === ESTADO_CUOTA_CANCELADA) {
    return styles.filaCancelada;
  }

  return "";
};

const pad2 = (v) => String(v).padStart(2, "0");

const sumarMesesPeriodo = (periodo, meses) => {
  if (!periodo) return "";
  const [anio, mes] = String(periodo).split("-").map(Number);
  if (!anio || !mes) return "";
  const fecha = new Date(anio, mes - 1 + meses, 1);
  return `${fecha.getFullYear()}-${pad2(fecha.getMonth() + 1)}`;
};

const MESES_TEXTO = [
  "enero","febrero","marzo","abril","mayo","junio",
  "julio","agosto","septiembre","octubre","noviembre","diciembre",
];

const periodoATexto = (periodo) => {
  if (!periodo) return "-";
  const [anio, mes] = String(periodo).split("-").map(Number);
  if (!anio || !mes) return "-";
  return `${MESES_TEXTO[mes - 1]} ${anio}`;
};

const CuotasServicioDialog = ({
  visible,
  onHide,
  contratacion,
  cuotas = [],
  loading = false,
  guardando = false,
  valorCuotaServicio = 0,
  onMarcarCobrado,
  onMarcarParcial,
  onMarcarNoCobrado,
  onRevertirPendiente,
  onCancelarDesdeCuota,
  onAgregarCuotaExtra,
  onEliminarCuotaExtra,
  onEditarPersonas,
}) => {
  const esCenaDocente = ES_CENA_DOCENTE_REGEX.test(contratacion?.servicioNombre || "");
  const estadoTemplate = useMemo(
    () => crearEstadoTemplate(esCenaDocente),
    [esCenaDocente]
  );

  const resumen = useMemo(() => {
    return (cuotas || []).reduce(
      (acc, cuota) => {
        const estado = cuota?.estado || ESTADO_CUOTA_PENDIENTE;
        const consolidada =
          cuota?.deudaRegularizada === true ||
          cuota?.regularizacionPendiente === true;

        if (estado === ESTADO_CUOTA_COBRADO) acc.cobradas += 1;
        else if (
          estado === ESTADO_CUOTA_DESCUENTO_PARCIAL &&
          !consolidada
        ) {
          acc.parciales += 1;
        } else if (estado === ESTADO_CUOTA_NO_COBRADO && !consolidada) {
          acc.noCobradas += 1;
        }
        else if (estado === ESTADO_CUOTA_CANCELADA) acc.canceladas += 1;
        else if (!consolidada) acc.pendientes += 1;

        acc.totalValor += obtenerNumero(cuota?.valorCuota);
        acc.totalDescontado += obtenerNumero(cuota?.importeDescontado);
        if (!consolidada) {
          acc.totalSaldo += obtenerNumero(cuota?.saldoPendiente);
        }

        return acc;
      },
      {
        cobradas: 0,
        parciales: 0,
        noCobradas: 0,
        canceladas: 0,
        pendientes: 0,
        totalValor: 0,
        totalDescontado: 0,
        totalSaldo: 0,
      }
    );
  }, [cuotas]);

  const [mostrarFormExtra, setMostrarFormExtra] = useState(false);
  const [importeExtra, setImporteExtra] = useState("");
  const [periodoExtra, setPeriodoExtra] = useState("");

  const [editandoPersonas, setEditandoPersonas] = useState(false);
  const [nuevasPersonas, setNuevasPersonas] = useState("");
  const [desdeCuotaNum, setDesdeCuotaNum] = useState("");
  const lugaresActuales = Math.max(
    1,
    obtenerNumero(
      contratacion?.cantidadLugares || contratacion?.cantidadPersonas
    )
  );
  const valorPorLugar = obtenerNumero(
    valorCuotaServicio ||
      contratacion?.valorCuotaBase ||
      contratacion?.valorCuota
  );
  const diferenciaLugares = Number(nuevasPersonas || 0) - lugaresActuales;
  const lugaresAAgregar = Math.max(0, diferenciaLugares);
  const lugaresAQuitar = Math.max(0, -diferenciaLugares);

  const ultimoPeriodoCobro = useMemo(() => {
    const periodos = (cuotas || [])
      .map((c) => c?.periodoCobro)
      .filter(Boolean)
      .sort();
    return periodos[periodos.length - 1] || "";
  }, [cuotas]);

  const maximoNumeroCuota = useMemo(() => {
    return (cuotas || []).reduce((max, c) => Math.max(max, Number(c?.numeroCuota || 0)), 0);
  }, [cuotas]);
  const totalCuotasPorLugar = Math.max(
    1,
    obtenerNumero(contratacion?.cantidadCuotas)
  );
  const numeroInicioAmpliacion = Number(desdeCuotaNum || 0);
  const numeroFinAmpliacion =
    numeroInicioAmpliacion > 0
      ? numeroInicioAmpliacion + totalCuotasPorLugar - 1
      : 0;
  const finSuperposicion = Math.min(
    maximoNumeroCuota,
    numeroFinAmpliacion
  );
  const importeAgregadoMensual = lugaresAAgregar * valorPorLugar;
  const cuotaRegularizacionPendiente = (cuotas || []).find(
    (cuota) =>
      (cuota?.origenActualizacion === "manual_extra" ||
        cuota?.esRegularizacionDeuda === true ||
        String(cuota?.etiquetaCuota || "").toUpperCase() === "EXTRA") &&
      cuota?.esRegularizacionDeuda !== false &&
      cuota?.estado === ESTADO_CUOTA_PENDIENTE &&
      cuota?.deudaRegularizada !== true &&
      cuota?.regularizacionPendiente !== true
  );
  const hayRegularizacionCobrada = (cuotas || []).some(
    (cuota) =>
      (cuota?.origenActualizacion === "manual_extra" ||
        cuota?.esRegularizacionDeuda === true ||
        String(cuota?.etiquetaCuota || "").toUpperCase() === "EXTRA") &&
      cuota?.estado === ESTADO_CUOTA_COBRADO
  );
  const saldoRegularizado =
    resumen.totalSaldo <= 0 && hayRegularizacionCobrada;

  useEffect(() => {
    if (!visible) {
      setMostrarFormExtra(false);
      setImporteExtra("");
      setPeriodoExtra("");
      setEditandoPersonas(false);
      setNuevasPersonas("");
      setDesdeCuotaNum("");
    }
  }, [visible]);

  const handleAbrirEditarPersonas = () => {
    setNuevasPersonas(String(lugaresActuales));
    // Preseleccionar la primera cuota cuyo importe todavía puede modificarse.
    const primeraNoCobrada = [...(cuotas || [])]
      .sort((a, b) => Number(a.numeroCuota || 0) - Number(b.numeroCuota || 0))
      .find((c) =>
        [
          ESTADO_CUOTA_PENDIENTE,
          ESTADO_CUOTA_DESCUENTO_PARCIAL,
          ESTADO_CUOTA_NO_COBRADO,
        ].includes(c.estado)
      );
    setDesdeCuotaNum(String(primeraNoCobrada?.numeroCuota || 1));
    setEditandoPersonas(true);
  };

  const handleConfirmarEditarPersonas = () => {
    const cantidad = parseInt(nuevasPersonas, 10);
    const desdeCuota = parseInt(desdeCuotaNum, 10);
    if (
      !cantidad ||
      cantidad === lugaresActuales ||
      !desdeCuota ||
      desdeCuota <= 0
    ) {
      return;
    }

    onEditarPersonas?.({
      cantidadLugares: cantidad,
      lugaresAnteriores: lugaresActuales,
      valorCuotaBase: valorPorLugar,
      desdeCuotaNumero: desdeCuota,
    });
    setEditandoPersonas(false);
  };

  const handleAbrirFormExtra = () => {
    setImporteExtra(String(Math.round(resumen.totalSaldo)));
    setPeriodoExtra(sumarMesesPeriodo(ultimoPeriodoCobro, 1) || "");
    setMostrarFormExtra(true);
  };

  const handleConfirmarCuotaExtra = () => {
    const importe = Number(importeExtra);
    if (!importe || importe <= 0 || !periodoExtra) return;
    onAgregarCuotaExtra?.({
      importe,
      periodoCobro: periodoExtra,
      numeroCuotaAnterior: maximoNumeroCuota,
    });
    setMostrarFormExtra(false);
  };

  const accionesTemplate = (rowData) => {
    const estaCobrada = rowData?.estado === ESTADO_CUOTA_COBRADO;
    const estaParcial = rowData?.estado === ESTADO_CUOTA_DESCUENTO_PARCIAL;
    const estaNoCobrada = rowData?.estado === ESTADO_CUOTA_NO_COBRADO;
    const estaPendiente = rowData?.estado === ESTADO_CUOTA_PENDIENTE;
    const estaCancelada = rowData?.estado === ESTADO_CUOTA_CANCELADA;
    const esCuotaExtra =
      rowData?.origenActualizacion === "manual_extra" ||
      String(rowData?.etiquetaCuota || "").toUpperCase() === "EXTRA";

    return (
      <div className={styles.accionesPanel}>
        <Button
          icon="pi pi-check"
          className={`p-button-rounded p-button-success p-button-sm ${styles.accionIcono}`}
          tooltip="Marcar cobrado"
          tooltipOptions={{ position: "top" }}
          onClick={() => onMarcarCobrado?.(rowData)}
          disabled={guardando || estaCobrada || estaCancelada}
        />
        <Button
          icon="pi pi-percentage"
          className={`p-button-rounded p-button-warning p-button-sm ${styles.accionIcono}`}
          tooltip="Marcar pago parcial"
          tooltipOptions={{ position: "top" }}
          onClick={() => onMarcarParcial?.(rowData)}
          disabled={guardando || estaParcial || estaCancelada}
        />
        <Button
          icon="pi pi-times"
          className={`p-button-rounded p-button-danger p-button-sm ${styles.accionIcono}`}
          tooltip="Marcar no cobrado"
          tooltipOptions={{ position: "top" }}
          onClick={() => onMarcarNoCobrado?.(rowData)}
          disabled={guardando || estaNoCobrada || estaCancelada}
        />
        <Button
          icon="pi pi-lock"
          className={`p-button-rounded p-button-help p-button-sm ${styles.accionIcono}`}
          tooltip={esCenaDocente ? "Cancelar cena desde esta cuota" : "Cancelar viaje desde esta cuota"}
          tooltipOptions={{ position: "top" }}
          onClick={() => onCancelarDesdeCuota?.(rowData)}
          disabled={guardando || estaCobrada || estaCancelada}
        />
        <Button
          icon="pi pi-refresh"
          className={`p-button-rounded p-button-secondary p-button-sm ${styles.accionIcono}`}
          tooltip="Revertir a pendiente"
          tooltipOptions={{ position: "top" }}
          onClick={() => onRevertirPendiente?.(rowData)}
          disabled={guardando || estaPendiente}
        />
        {esCuotaExtra && (
          <Button
            icon="pi pi-trash"
            className={`p-button-rounded p-button-danger p-button-sm ${styles.accionIcono}`}
            tooltip="Eliminar cuota extra"
            tooltipOptions={{ position: "top" }}
            onClick={() => onEliminarCuotaExtra?.(rowData)}
            disabled={guardando || estaCobrada}
          />
        )}
      </div>
    );
  };

  return (
    <Dialog
      header={`Cuotas - ${contratacion?.apellidoNombre || ""}`}
      visible={visible}
      style={{ width: "97vw", maxWidth: "1600px" }}
      modal
      onHide={onHide}
      className={styles.cuotasDialog}
    >
      {contratacion && (
        <div className={styles.cuotasBody}>
          <section className={styles.headerCard}>
            <div className={styles.headerMain}>
              <span className={styles.headerLabel}>Servicio</span>
              <h3>{contratacion.servicioNombre || "Servicio sin nombre"}</h3>
              <p>{contratacion.apellidoNombre || "Afiliado sin nombre"}</p>
              <div className={styles.headerBadges}>
                {contratacion?.esPagoContado && (
                  <span className={styles.badgeContado}>Pago contado</span>
                )}
                {contratacion?.cancelado && (
                  <span className={styles.badgeCancelado}>
                    {esCenaDocente ? "Cena cancelada" : "Viaje cancelado"}
                  </span>
                )}
              </div>
            </div>

            <div className={styles.headerMeta}>
              <div>
                <span>DNI</span>
                <strong>{contratacion.dni || "-"}</strong>
              </div>
              <div>
                <span>Descuentos</span>
                <strong>{cuotas?.length || contratacion.cantidadCuotas || 0}</strong>
              </div>
              <div>
                <span>Valor por lugar</span>
                <strong>{formatearMoneda(valorPorLugar)}</strong>
              </div>
              <div className={styles.headerMetaPersonas}>
                <span>Lugares reservados</span>
                <div className={styles.editPersonasDisplay}>
                  <strong>{lugaresActuales}</strong>
                  <Button
                    icon="pi pi-pencil"
                    className={`p-button-rounded p-button-text p-button-sm ${styles.editPersonasBtn}`}
                    onClick={handleAbrirEditarPersonas}
                    disabled={guardando || loading || editandoPersonas}
                    tooltip="Modificar lugares de la reserva"
                    tooltipOptions={{ position: "top" }}
                  />
                </div>
              </div>
            </div>
          </section>

          {editandoPersonas && (
            <div className={styles.editPersonasPanel}>
              <p className={styles.editPersonasTitle}>
                <i className="pi pi-users" />
                Modificar lugares de la reserva
              </p>
              <div className={styles.editPersonasGrid}>
                <div className={styles.cuotaExtraField}>
                  <label>Nueva cantidad total de lugares</label>
                  <input
                    type="number"
                    value={nuevasPersonas}
                    onChange={(e) => setNuevasPersonas(e.target.value)}
                    className={styles.cuotaExtraInput}
                    min="1"
                    autoFocus
                    placeholder="Ej: 2"
                  />
                  <small>
                    Actualmente hay <strong>{lugaresActuales}</strong>{" "}
                    {lugaresActuales === 1 ? "lugar" : "lugares"}. Al indicar 2,
                    se agregará únicamente el Lugar 2.
                  </small>
                  {lugaresAAgregar > 0 && (
                    <small>
                      Se agregarán <strong>{lugaresAAgregar}</strong>{" "}
                      {lugaresAAgregar === 1 ? "lugar" : "lugares"} de{" "}
                      <strong>{formatearMoneda(valorPorLugar)}</strong> cada uno.
                    </small>
                  )}
                  {lugaresAQuitar > 0 && (
                    <small>
                      Se quitarán <strong>{lugaresAQuitar}</strong>{" "}
                      {lugaresAQuitar === 1 ? "lugar" : "lugares"}, comenzando
                      por el de numeración más alta.
                    </small>
                  )}
                </div>
                <div className={styles.cuotaExtraField}>
                  <label>
                    Aplicar el cambio desde este descuento
                  </label>
                  <select
                    value={desdeCuotaNum}
                    onChange={(e) => setDesdeCuotaNum(e.target.value)}
                    className={styles.cuotaExtraInput}
                  >
                    {[...(cuotas || [])]
                      .sort((a, b) => Number(a.numeroCuota || 0) - Number(b.numeroCuota || 0))
                      .filter((c) =>
                        [
                          ESTADO_CUOTA_PENDIENTE,
                          ESTADO_CUOTA_DESCUENTO_PARCIAL,
                          ESTADO_CUOTA_NO_COBRADO,
                        ].includes(c.estado)
                      )
                      .map((c) => (
                        <option key={c.id} value={c.numeroCuota}>
                          Descuento {c.numeroCuota} —{" "}
                          {c.periodoCobroTexto || c.periodoCobro}
                          {c.estado === ESTADO_CUOTA_DESCUENTO_PARCIAL
                            ? " (parcial)"
                            : c.estado === ESTADO_CUOTA_NO_COBRADO
                            ? " (no cobrado)"
                            : ""}
                        </option>
                      ))}
                  </select>
                  <small>
                    {diferenciaLugares > 0
                      ? `El lugar nuevo comenzará en 1/${totalCuotasPorLugar} y se crearán los meses necesarios hasta completar su plan.`
                      : "Los lugares retirados dejarán de formar parte del importe desde este descuento. Los cobros anteriores no se modificarán."}
                  </small>
                </div>
                <div className={styles.cuotaExtraActions}>
                  <Button
                    label="Confirmar"
                    icon="pi pi-check"
                    className="p-button-success p-button-sm"
                    onClick={handleConfirmarEditarPersonas}
                    loading={guardando}
                    disabled={
                      Number(nuevasPersonas) < 1 ||
                      Number(nuevasPersonas) === lugaresActuales ||
                      !desdeCuotaNum
                    }
                  />
                  <Button
                    label="Cancelar"
                    icon="pi pi-times"
                    className="p-button-secondary p-button-sm"
                    onClick={() => setEditandoPersonas(false)}
                    disabled={guardando}
                  />
                </div>
              </div>
              {diferenciaLugares !== 0 && numeroInicioAmpliacion > 0 && (
                <div className={styles.ampliacionPreview}>
                  <strong>
                    <i className="pi pi-info-circle" /> Cómo se aplicará
                  </strong>
                  {lugaresAAgregar > 0 &&
                    numeroInicioAmpliacion <= finSuperposicion && (
                    <p>
                      <b>
                        Descuentos {numeroInicioAmpliacion} a{" "}
                        {finSuperposicion}:
                      </b>{" "}
                      se sumarán {formatearMoneda(importeAgregadoMensual)} al
                      importe mensual existente.
                    </p>
                  )}
                  {lugaresAAgregar > 0 &&
                    numeroFinAmpliacion > maximoNumeroCuota && (
                    <p>
                      <b>
                        Descuentos {maximoNumeroCuota + 1} a{" "}
                        {numeroFinAmpliacion}:
                      </b>{" "}
                      continuarán únicamente las cuotas pendientes de los
                      nuevos lugares por{" "}
                      {formatearMoneda(importeAgregadoMensual)} mensuales.
                    </p>
                  )}
                  {lugaresAQuitar > 0 && (
                    <p>
                      Desde el descuento {numeroInicioAmpliacion} se retirarán{" "}
                      {lugaresAQuitar === 1
                        ? `el Lugar ${lugaresActuales}`
                        : `los Lugares ${
                            lugaresActuales - lugaresAQuitar + 1
                          } a ${lugaresActuales}`}
                      . Los importes anteriores conservarán su composición.
                    </p>
                  )}
                  <small>
                    Todos los importes continuarán descontándose al mismo
                    afiliado titular.
                  </small>
                </div>
              )}
            </div>
          )}

          <section className={styles.resumenGrid}>
            <div className={`${styles.resumenCard} ${styles.resumenCobradas}`}>
              <span>Cobradas</span>
              <strong>{resumen.cobradas}</strong>
            </div>

            <div className={`${styles.resumenCard} ${styles.resumenParciales}`}>
              <span>Pago parcial</span>
              <strong>{resumen.parciales}</strong>
            </div>

            <div className={`${styles.resumenCard} ${styles.resumenNoCobradas}`}>
              <span>No cobradas</span>
              <strong>{resumen.noCobradas}</strong>
            </div>

            <div className={`${styles.resumenCard} ${styles.resumenCanceladas}`}>
              <span>Canceladas</span>
              <strong>{resumen.canceladas}</strong>
            </div>

            <div className={`${styles.resumenCard} ${styles.resumenPendientes}`}>
              <span>Pendientes</span>
              <strong>{resumen.pendientes}</strong>
            </div>

            <div className={styles.resumenCard}>
              <span>Total descontado</span>
              <strong>{formatearMoneda(resumen.totalDescontado)}</strong>
            </div>

            <div className={styles.resumenCard}>
              <span>Saldo pendiente</span>
              <strong>{formatearMoneda(resumen.totalSaldo)}</strong>
            </div>
          </section>

          {!loading &&
            (resumen.totalSaldo > 0 || saldoRegularizado) && (
            <div className={styles.cuotaExtraPanel}>
              {!mostrarFormExtra ? (
                <Button
                  label={
                    saldoRegularizado
                      ? "Saldo regularizado"
                      : cuotaRegularizacionPendiente
                      ? "Cuota de regularización ya generada"
                      : `Agregar cuota por saldo pendiente (${formatearMoneda(
                          resumen.totalSaldo
                        )})`
                  }
                  icon={
                    saldoRegularizado
                      ? "pi pi-check-circle"
                      : "pi pi-plus-circle"
                  }
                  className={`p-button-outlined p-button-warning ${styles.cuotaExtraBtn}`}
                  onClick={handleAbrirFormExtra}
                  disabled={
                    guardando ||
                    loading ||
                    !!cuotaRegularizacionPendiente ||
                    resumen.totalSaldo <= 0
                  }
                />
              ) : (
                <div className={styles.cuotaExtraForm}>
                  <p className={styles.cuotaExtraTitle}>
                    <i className="pi pi-plus-circle" />
                    Nueva cuota por saldo pendiente
                  </p>
                  <div className={styles.cuotaExtraGrid}>
                    <div className={styles.cuotaExtraField}>
                      <label>Importe a cobrar</label>
                      <input
                        type="number"
                        value={importeExtra}
                        className={styles.cuotaExtraInput}
                        min="1"
                        readOnly
                        title="El importe corresponde al saldo pendiente total."
                      />
                      <small>
                        Se calcula automáticamente con las cuotas que tienen
                        deuda activa.
                      </small>
                    </div>
                    <div className={styles.cuotaExtraField}>
                      <label>Período de cobro</label>
                      <input
                        type="month"
                        value={periodoExtra}
                        onChange={(e) => setPeriodoExtra(e.target.value)}
                        className={styles.cuotaExtraInput}
                      />
                      {periodoExtra && (
                        <small>Se cobrará en {periodoATexto(periodoExtra)}</small>
                      )}
                    </div>
                    <div className={styles.cuotaExtraActions}>
                      <Button
                        label="Confirmar"
                        icon="pi pi-check"
                        className="p-button-success p-button-sm"
                        onClick={handleConfirmarCuotaExtra}
                        loading={guardando}
                        disabled={!importeExtra || !periodoExtra || Number(importeExtra) <= 0}
                      />
                      <Button
                        label="Cancelar"
                        icon="pi pi-times"
                        className="p-button-secondary p-button-sm"
                        onClick={() => setMostrarFormExtra(false)}
                        disabled={guardando}
                      />
                    </div>
                  </div>
                </div>
              )}
              {(cuotaRegularizacionPendiente || saldoRegularizado) &&
                !mostrarFormExtra && (
                <small className={styles.cuotaExtraAviso}>
                  {saldoRegularizado
                    ? "La deuda vinculada fue cobrada y sus saldos pendientes quedaron en cero."
                    : "Ya existe una cuota de regularización para este saldo. Al cobrarla, las cuotas vinculadas quedarán sin saldo pendiente."}
                </small>
              )}
            </div>
          )}

          {loading ? (
            <div className={styles.loadingBox}>
              <ProgressSpinner />
              <span>Cargando cuotas...</span>
            </div>
          ) : (
            <div className={styles.tableWrap}>
              <DataTable
                value={cuotas}
                emptyMessage="No hay cuotas generadas."
                responsiveLayout="scroll"
                rowClassName={rowClassName}
                className={styles.cuotasTable}
              >
                <Column
                  header="Cuota"
                  body={cuotaTemplate}
                  style={{ width: "90px", minWidth: "90px" }}
                />
                <Column
                  header="Períodos"
                  body={periodosTemplate}
                  style={{ width: "230px", minWidth: "230px" }}
                />
                <Column
                  header="Importes"
                  body={importesTemplate}
                  style={{ width: "265px", minWidth: "265px" }}
                />
                <Column
                  header="Estado"
                  body={estadoTemplate}
                  style={{ width: "165px", minWidth: "165px" }}
                />
                <Column
                  header="Observación"
                  body={observacionTemplate}
                  style={{ width: "285px", minWidth: "285px" }}
                />
                <Column
                  header="Acciones"
                  body={accionesTemplate}
                  style={{ width: "160px", minWidth: "160px" }}
                  bodyClassName={styles.accionesTd}
                />
              </DataTable>
            </div>
          )}
        </div>
      )}
    </Dialog>
  );
};

export default CuotasServicioDialog;
