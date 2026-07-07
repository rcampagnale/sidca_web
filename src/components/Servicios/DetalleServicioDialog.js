// src/components/Servicios/DetalleServicioDialog.js

import React, { useEffect, useMemo, useRef, useState } from "react";
import { Dialog } from "primereact/dialog";
import { Button } from "primereact/button";
import { InputText } from "primereact/inputtext";
import { ProgressSpinner } from "primereact/progressspinner";

import ImportarAfiliadosServicio from "./ImportarAfiliadosServicio";
import ImportarDescuentosServicio from "./ImportarDescuentosServicio";
import AfiliadosContratadosTabla, {
  normalizarContratacionKey,
} from "./AfiliadosContratadosTabla";
import styles from "./DetalleServicioDialog.module.css";

const MESES = [
  "enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
];

const pad2 = (valor) => String(valor).padStart(2, "0");

const sumarMesesPeriodo = (periodo, cantidadMeses) => {
  if (!periodo) return "";
  const [anio, mes] = String(periodo).split("-").map(Number);
  if (!anio || !mes) return "";
  const fecha = new Date(anio, mes - 1 + cantidadMeses, 1);
  return `${fecha.getFullYear()}-${pad2(fecha.getMonth() + 1)}`;
};

const periodoTexto = (periodo) => {
  if (!periodo) return "-";
  const [anio, mes] = String(periodo).split("-").map(Number);
  if (!anio || !mes) return "-";
  return `${MESES[mes - 1]} ${anio}`;
};

const periodoCobroTexto = (periodo) => `A cobrar en ${periodoTexto(periodo)}`;

const formatearMoneda = (valor) =>
  new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(Number(valor || 0));

const obtenerCantidad = (rowData, campo) => Number(rowData?.[campo] || 0);

const CARDS_POR_PAGINA = 10;

const DetalleServicioDialog = ({
  visible,
  onHide,
  servicioSeleccionado,

  filtroContrataciones,
  onChangeFiltroContrataciones,
  contratacionesFiltradas,
  contratacionesServicio,
  loadingContrataciones,

  dniAfiliado,
  onChangeDniAfiliado,
  buscandoAfiliado,
  afiliadoEncontrado,
  periodoHaberInicial,
  onChangePeriodoHaberInicial,
  agregandoAfiliado,
  onBuscarAfiliadoPorDni,
  onAgregarAfiliado,

  onVerCuotas,
  onEliminarContratacion,

  onImportarAfiliadosExcel,
  importandoAfiliados = false,
  resultadoImportacionAfiliados = null,
  onLimpiarResultadoImportacionAfiliados,
  onImportarDescuentosExcel,
  importandoDescuentos = false,
  filtroEstadoContrataciones = null,
  onLimpiarFiltroEstado,
}) => {
  const [paginaActual, setPaginaActual] = useState(1);
  const [expandidoAltaAfiliado, setExpandidoAltaAfiliado] = useState(false);
  const [afiliadoSeleccionado, setAfiliadoSeleccionado] = useState(null);
  const contextoDetalleRef = useRef("");

  const periodoCobroInicial = periodoHaberInicial
    ? sumarMesesPeriodo(periodoHaberInicial, 1)
    : "";

  const contratacionesPaginadas = useMemo(() => {
    const inicio = (paginaActual - 1) * CARDS_POR_PAGINA;
    return (contratacionesFiltradas || []).slice(inicio, inicio + CARDS_POR_PAGINA);
  }, [contratacionesFiltradas, paginaActual]);

  const afiliadoSeleccionadoKey = afiliadoSeleccionado
    ? normalizarContratacionKey(afiliadoSeleccionado)
    : "";

  const afiliadoSeleccionadoVisible = useMemo(() => {
    if (!afiliadoSeleccionadoKey) return null;
    return (
      contratacionesPaginadas.find(
        (contratacion) =>
          normalizarContratacionKey(contratacion) === afiliadoSeleccionadoKey
      ) || null
    );
  }, [afiliadoSeleccionadoKey, contratacionesPaginadas]);

  const totalPaginas = Math.ceil(
    (contratacionesFiltradas?.length || 0) / CARDS_POR_PAGINA
  );

  useEffect(() => {
    const contextoActual = visible
      ? servicioSeleccionado?.id || "sin-servicio"
      : "cerrado";

    if (contextoDetalleRef.current === contextoActual) return;

    contextoDetalleRef.current = contextoActual;
    setPaginaActual(1);
    setAfiliadoSeleccionado(null);
    setExpandidoAltaAfiliado(false);
    onChangeFiltroContrataciones?.("");
  }, [visible, servicioSeleccionado?.id, onChangeFiltroContrataciones]);

  const irAPagina = (pagina) => {
    if (pagina >= 1 && pagina <= totalPaginas) {
      setPaginaActual(pagina);
      setAfiliadoSeleccionado(null);
    }
  };

  const handleFiltroChange = (valor) => {
    setPaginaActual(1);
    setAfiliadoSeleccionado(null);
    onChangeFiltroContrataciones(valor);
  };

  const estadoBadge = (rowData) => {
    if (rowData?.cancelado)
      return <span className={styles.estadoCancelado}>Viaje cancelado</span>;
    if (rowData?.esPagoContado || rowData?.tipoPago === "contado")
      return <span className={styles.estadoContado}>Contado</span>;
    return <span className={styles.estadoCuotas}>Cuotas</span>;
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
          <span
            key={campo}
            className={`${styles.resumenBadge} ${cls}`}
            title={title}
          >
            <b>{label}</b> {obtenerCantidad(rowData, campo)}
          </span>
        ))}
      </div>
    );
  };

  const esPagoCompleto = (rowData) => {
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
        Number(
          rowData?.cantidadCuotas ||
            servicioSeleccionado?.cantidadCuotas ||
            0
        ) * Number(rowData?.valorCuota || 0)
    );
    const totalDescontado = Number(
      rowData?.totalDescontadoContratacion || 0
    );
    const saldoPendiente = Number(
      rowData?.saldoPendienteContratacion || 0
    );

    return (
      !rowData?.cancelado &&
      (contadoCobrado ||
        (valorTotal > 0 &&
          totalDescontado >= valorTotal &&
          saldoPendiente <= 0 &&
          sinIncidencias))
    );
  };

  const AfiliadoCard = ({ rowData }) => {
    const personas = Math.max(
      1,
      Number(rowData?.cantidadLugares || rowData?.cantidadPersonas || 1)
    );
    const cancelado = !!rowData?.cancelado;
    const esSub = !!rowData?.esSubcontratacion;
    const pagoCompleto = esPagoCompleto(rowData);
    const esPagoContado =
      rowData?.esPagoContado === true || rowData?.tipoPago === "contado";
    const cantidadCuotas = Number(
      rowData?.cantidadCuotas ||
        servicioSeleccionado?.cantidadCuotas ||
        0
    );
    const detallePlan =
      rowData?.detalleCuotasExcel ||
      (cantidadCuotas > 0
        ? `${pad2(cantidadCuotas)} cuotas de ${formatearMoneda(
            rowData?.valorCuota
          )}`
        : "");

    return (
      <div className={`${styles.afiliadoCard} ${cancelado ? styles.afiliadoCardCancelado : ""} ${esSub ? styles.afiliadoCardSub : ""} ${pagoCompleto ? styles.afiliadoCardPagado : ""}`}>
        {pagoCompleto && (
          <div className={styles.pagoCompletoFranja}>
            <i className="pi pi-check-circle" />
            {esPagoContado
              ? "Pago de contado completado"
              : "Todas las cuotas pagadas"}
          </div>
        )}
        <div className={styles.cardTop}>
          <div className={styles.cardNombreBloque}>
            <div className={styles.cardNombreRow}>
              <strong className={styles.cardNombre}>
                {rowData?.apellidoNombre || "Sin nombre registrado"}
              </strong>
              {esSub && (
                <span className={styles.subBadge}>Contrato adicional</span>
              )}
            </div>
            <div className={styles.cardMeta}>
              <span><b>DNI</b> {rowData?.dni || "-"}</span>
              {rowData?.departamentoServicio && (
                <span><b>Depto.</b> {rowData.departamentoServicio}</span>
              )}
              {rowData?.telefonoContacto && (
                <span><b>Tel</b> {rowData.telefonoContacto}</span>
              )}
              <span className={styles.personasBadge}>
                <i className="pi pi-user" style={{ fontSize: "0.75rem" }} />
                {personas} {personas === 1 ? "persona" : "personas"}
              </span>
            </div>
          </div>
          <div className={styles.cardEstadoBloque}>
            {estadoBadge(rowData)}
          </div>
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
              onClick={() => onVerCuotas(rowData)}
            />
            <Button
              icon="pi pi-trash"
              label="Eliminar contratación"
              className="p-button-sm p-button-outlined p-button-danger"
              onClick={() => onEliminarContratacion?.(rowData)}
            />
          </div>
        </div>
      </div>
    );
  };

  return (
    <Dialog
      header={`Servicio: ${servicioSeleccionado?.nombre || ""}`}
      visible={visible}
      style={{ width: "98vw", maxWidth: "1200px" }}
      modal
      onHide={onHide}
      className={styles.detalleDialog}
    >
      {servicioSeleccionado && (
        <div className={styles.detalleServicio}>
          <section className={styles.servicioHeaderCard}>
            <div>
              <h3>{servicioSeleccionado.nombre}</h3>
              <p>{servicioSeleccionado.descripcion || "Sin descripción."}</p>
            </div>
            <div className={styles.servicioResumen}>
              <div>
                <span>Cuotas</span>
                <strong>{servicioSeleccionado.cantidadCuotas}</strong>
              </div>
              <div>
                <span>Valor cuota</span>
                <strong>{formatearMoneda(servicioSeleccionado.valorCuota)}</strong>
              </div>
            </div>
          </section>

          {!filtroEstadoContrataciones && <section className={styles.card}>
            <div
              className={styles.cardHeaderClickable}
              onClick={() => setExpandidoAltaAfiliado((v) => !v)}
            >
              <div className={styles.cardHeaderIcon}>
                <i className="pi pi-user-plus" />
              </div>
              <div className={styles.cardHeaderTexto}>
                <h3>Agregar afiliado individual</h3>
                <p>
                  Buscá el afiliado por DNI, seleccioná el haber inicial y luego
                  agregalo al servicio.
                </p>
              </div>
              <i
                className={`pi ${expandidoAltaAfiliado ? "pi-chevron-up" : "pi-chevron-down"} ${styles.cardChevron}`}
              />
            </div>

            {expandidoAltaAfiliado && (
              <>
                <div className={styles.altaAfiliadoGrid}>
                  <div className={styles.formRow}>
                    <label>DNI del afiliado</label>
                    <InputText
                      value={dniAfiliado}
                      onChange={(e) => onChangeDniAfiliado(e.target.value)}
                      placeholder="Ingrese DNI sin puntos"
                    />
                  </div>

                  <div className={styles.formRow}>
                    <label>Haber inicial del descuento</label>
                    <input
                      type="month"
                      value={periodoHaberInicial}
                      onChange={(e) => onChangePeriodoHaberInicial(e.target.value)}
                      className={styles.monthInput}
                    />
                    {periodoHaberInicial && (
                      <small>
                        Se cobrará desde:{" "}
                        <strong>{periodoCobroTexto(periodoCobroInicial)}</strong>
                      </small>
                    )}
                  </div>

                  <div className={styles.botonesAltaAfiliado}>
                    <Button
                      label="Buscar DNI"
                      icon="pi pi-search"
                      onClick={onBuscarAfiliadoPorDni}
                      loading={buscandoAfiliado}
                    />
                    <Button
                      label="Agregar"
                      icon="pi pi-user-plus"
                      className="p-button-success"
                      onClick={onAgregarAfiliado}
                      loading={agregandoAfiliado}
                      disabled={!afiliadoEncontrado || !periodoHaberInicial}
                    />
                  </div>
                </div>

                {afiliadoEncontrado && (
                  <div className={styles.afiliadoEncontrado}>
                    <strong>Afiliado encontrado:</strong>{" "}
                    {afiliadoEncontrado.apellidoNombre} - DNI {afiliadoEncontrado.dni}
                    {afiliadoEncontrado.email ? ` - ${afiliadoEncontrado.email}` : ""}
                  </div>
                )}
              </>
            )}
          </section>}

          {!filtroEstadoContrataciones && <ImportarAfiliadosServicio
            servicio={servicioSeleccionado}
            loading={importandoAfiliados}
            onImportar={onImportarAfiliadosExcel}
            resultadoImportacion={resultadoImportacionAfiliados}
            onLimpiarResultado={onLimpiarResultadoImportacionAfiliados}
          />}

          {!filtroEstadoContrataciones && <ImportarDescuentosServicio
            servicio={servicioSeleccionado}
            contrataciones={contratacionesServicio || []}
            loading={loadingContrataciones}
            procesando={importandoDescuentos}
            onProcesar={onImportarDescuentosExcel}
          />}

          <section className={styles.card}>
            <div className={styles.cardHeader}>
              <div>
                <h3>Afiliados contratados</h3>
                <p>
                  {contratacionesServicio?.length
                    ? `${contratacionesServicio.length} afiliado${contratacionesServicio.length !== 1 ? "s" : ""} en este servicio.`
                    : "Sin afiliados contratados aún."}
                </p>
              </div>
            </div>

            {filtroEstadoContrataciones && (
              <div className={
                filtroEstadoContrataciones === "parcial"
                  ? styles.filtroEstadoBannerParcial
                  : styles.filtroEstadoBannerNoCobrado
              }>
                <i className={filtroEstadoContrataciones === "parcial" ? "pi pi-percentage" : "pi pi-ban"} />
                <span>
                  {filtroEstadoContrataciones === "parcial"
                    ? "Mostrando solo afiliados con pago parcial"
                    : "Mostrando solo afiliados con cuotas no cobradas"}
                </span>
                <Button
                  icon="pi pi-times"
                  className="p-button-rounded p-button-text p-button-sm"
                  onClick={onLimpiarFiltroEstado}
                  tooltip="Quitar filtro"
                  tooltipOptions={{ position: "top" }}
                />
              </div>
            )}

            <div className={styles.busquedaInterna}>
              <InputText
                value={filtroContrataciones}
                onChange={(e) => handleFiltroChange(e.target.value)}
                placeholder="Buscar por DNI, apellido o nombre"
              />
            </div>

            {loadingContrataciones ? (
              <div className={styles.loadingBox}>
                <ProgressSpinner />
                <span>Cargando afiliados contratados...</span>
              </div>
            ) : contratacionesFiltradas?.length === 0 ? (
              <div className={styles.sinResultados}>
                {filtroContrataciones
                  ? "No se encontraron afiliados con ese criterio."
                  : "Este servicio aún no tiene afiliados contratados."}
              </div>
            ) : (
              <>
                <AfiliadosContratadosTabla
                  servicioId={servicioSeleccionado?.id}
                  contrataciones={contratacionesPaginadas}
                  seleccionadoKey={afiliadoSeleccionadoKey}
                  onSeleccionar={setAfiliadoSeleccionado}
                />

                {afiliadoSeleccionadoVisible && (
                  <div className={styles.detalleAfiliadoSeleccionado}>
                    <div className={styles.detalleAfiliadoHeader}>
                      <div>
                        <span>Detalle seleccionado</span>
                        <strong>
                          {afiliadoSeleccionadoVisible.apellidoNombre ||
                            afiliadoSeleccionadoVisible.dni}
                        </strong>
                      </div>
                      <Button
                        icon="pi pi-times"
                        className="p-button-rounded p-button-text p-button-sm"
                        onClick={() => setAfiliadoSeleccionado(null)}
                        tooltip="Cerrar detalle"
                        tooltipOptions={{ position: "top" }}
                      />
                    </div>
                    <AfiliadoCard rowData={afiliadoSeleccionadoVisible} />
                  </div>
                )}

                {totalPaginas > 1 && (
                  <div className={styles.paginador}>
                    <Button
                      icon="pi pi-angle-double-left"
                      className="p-button-text p-button-sm"
                      onClick={() => irAPagina(1)}
                      disabled={paginaActual === 1}
                    />
                    <Button
                      icon="pi pi-angle-left"
                      className="p-button-text p-button-sm"
                      onClick={() => irAPagina(paginaActual - 1)}
                      disabled={paginaActual === 1}
                    />
                    <span className={styles.paginadorInfo}>
                      {paginaActual} / {totalPaginas}
                      <small>
                        ({contratacionesFiltradas.length} afiliados)
                      </small>
                    </span>
                    <Button
                      icon="pi pi-angle-right"
                      className="p-button-text p-button-sm"
                      onClick={() => irAPagina(paginaActual + 1)}
                      disabled={paginaActual === totalPaginas}
                    />
                    <Button
                      icon="pi pi-angle-double-right"
                      className="p-button-text p-button-sm"
                      onClick={() => irAPagina(totalPaginas)}
                      disabled={paginaActual === totalPaginas}
                    />
                  </div>
                )}
              </>
            )}
          </section>
        </div>
      )}
    </Dialog>
  );
};

export default DetalleServicioDialog;
