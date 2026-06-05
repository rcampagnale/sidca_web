// src/components/Servicios/DetalleServicioDialog.js

import React from "react";
import { Dialog } from "primereact/dialog";
import { Button } from "primereact/button";
import { InputText } from "primereact/inputtext";
import { ProgressSpinner } from "primereact/progressspinner";
import { DataTable } from "primereact/datatable";
import { Column } from "primereact/column";

import ImportarAfiliadosServicio from "./ImportarAfiliadosServicio";
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

const pad2 = (valor) => String(valor).padStart(2, "0");

const sumarMesesPeriodo = (periodo, cantidadMeses) => {
  if (!periodo) return "";

  const [anio, mes] = periodo.split("-").map(Number);
  const fecha = new Date(anio, mes - 1 + cantidadMeses, 1);

  return `${fecha.getFullYear()}-${pad2(fecha.getMonth() + 1)}`;
};

const periodoTexto = (periodo) => {
  if (!periodo) return "-";

  const [anio, mes] = periodo.split("-").map(Number);
  if (!anio || !mes) return "-";

  return `${MESES[mes - 1]} ${anio}`;
};

const periodoCobroTexto = (periodo) => {
  return `A cobrar en ${periodoTexto(periodo)}`;
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

const DetalleServicioDialog = ({
  visible,
  onHide,
  servicioSeleccionado,

  filtroContrataciones,
  onChangeFiltroContrataciones,
  contratacionesFiltradas,
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

  onImportarAfiliadosExcel,
  importandoAfiliados = false,
}) => {
  const valorCuotaTemplate = (rowData) => {
    return <strong>{formatearMoneda(rowData?.valorCuota)}</strong>;
  };

  const accionesContratacionTemplate = (rowData) => {
    return (
      <Button
        icon="pi pi-list"
        label="Ver cuotas"
        className="p-button-sm p-button-info"
        onClick={() => onVerCuotas(rowData)}
      />
    );
  };

  const periodoCobroInicial = periodoHaberInicial
    ? sumarMesesPeriodo(periodoHaberInicial, 1)
    : "";

  return (
    <Dialog
      header={`Servicio: ${servicioSeleccionado?.nombre || ""}`}
      visible={visible}
      style={{ width: "95vw", maxWidth: "1450px" }}
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

          <section className={styles.card}>
            <div className={styles.cardHeader}>
              <div>
                <h3>Agregar afiliado individual</h3>
                <p>
                  Buscá el afiliado por DNI, seleccioná el haber inicial y luego
                  agregalo al servicio.
                </p>
              </div>
            </div>

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
                {afiliadoEncontrado.apellidoNombre} - DNI{" "}
                {afiliadoEncontrado.dni}
                {afiliadoEncontrado.email
                  ? ` - ${afiliadoEncontrado.email}`
                  : ""}
              </div>
            )}
          </section>

          <ImportarAfiliadosServicio
            servicio={servicioSeleccionado}
            loading={importandoAfiliados}
            onImportar={onImportarAfiliadosExcel}
          />

          <section className={styles.card}>
            <div className={styles.cardHeader}>
              <div>
                <h3>Afiliados contratados</h3>
                <p>
                  Buscá dentro de este servicio por DNI, apellido o nombre.
                </p>
              </div>
            </div>

            <div className={styles.busquedaInterna}>
              <InputText
                value={filtroContrataciones}
                onChange={(e) => onChangeFiltroContrataciones(e.target.value)}
                placeholder="Buscar dentro de este servicio"
              />
            </div>

            {loadingContrataciones ? (
              <div className={styles.loadingBox}>
                <ProgressSpinner />
                <span>Cargando afiliados contratados...</span>
              </div>
            ) : (
              <DataTable
                value={contratacionesFiltradas}
                emptyMessage="Este servicio aún no tiene afiliados contratados."
                responsiveLayout="scroll"
                paginator
                rows={8}
                rowsPerPageOptions={[8, 15, 30]}
                className={styles.detalleTable}
              >
                <Column field="apellidoNombre" header="Afiliado" sortable />
                <Column field="dni" header="DNI" sortable />
                <Column field="periodoHaberInicialTexto" header="Haber inicial" />
                <Column field="periodoCobroInicialTexto" header="Primer cobro" />
                <Column header="Valor cuota" body={valorCuotaTemplate} />
                <Column field="cuotasCobradas" header="Cobradas" />
                <Column field="cuotasNoCobradas" header="No cobradas" />
                <Column field="cuotasPendientes" header="Pendientes" />
                <Column header="Acciones" body={accionesContratacionTemplate} />
              </DataTable>
            )}
          </section>
        </div>
      )}
    </Dialog>
  );
};

export default DetalleServicioDialog;