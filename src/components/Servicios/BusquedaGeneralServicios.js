import React, { useMemo } from "react";
import { Button } from "primereact/button";
import { InputText } from "primereact/inputtext";
import { DataTable } from "primereact/datatable";
import { Column } from "primereact/column";
import styles from "../../pages/Admin/Servicios/servicios.module.css";

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

const obtenerMesesCobradosDelServicio = (servicio) => {
  const valorCuotaServicio = Number(servicio?.valorCuota || 0);
  const servicioKey =
    servicio?.servicioId || servicio?.id || servicio?.servicioNombre || "";

  if (Array.isArray(servicio?.cuotas) && servicio.cuotas.length > 0) {
    return servicio.cuotas
      .filter((cuota) => cuota?.estado === "cobrado")
      .map((cuota) => ({
        periodo: cuota?.periodoCobro || "",
        periodoTexto: periodoTexto(cuota?.periodoCobro),
        valorCuota: Number(cuota?.valorCuota || valorCuotaServicio || 0),
        servicioKey,
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
        valorCuota: valorCuotaServicio,
        servicioKey,
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
      const mesesCobrados = obtenerMesesCobradosDelServicio(servicio);

      mesesCobrados.forEach((item) => {
        const actual = mapa.get(item.periodo) || {
          periodo: item.periodoTexto,
          periodoOrden: item.periodo,
          totalMensual: 0,
          serviciosSet: new Set(),
        };

        actual.totalMensual += Number(item.valorCuota || 0);
        actual.serviciosSet.add(item.servicioKey);

        mapa.set(item.periodo, actual);
      });
    });

    return Array.from(mapa.values())
      .sort((a, b) =>
        String(a.periodoOrden).localeCompare(String(b.periodoOrden))
      )
      .map((item) => ({
        periodo: item.periodo,
        periodoOrden: item.periodoOrden,
        cantidadServicios: item.serviciosSet.size,
        totalMensual: item.totalMensual,
      }));
  }, [resultadosBusquedaGeneral]);

  const totalDescontadoRegistrado = useMemo(() => {
    return resumenMensual.reduce((acumulado, item) => {
      return acumulado + Number(item?.totalMensual || 0);
    }, 0);
  }, [resumenMensual]);

  const valorCuotaTemplate = (rowData) => {
    return <strong>{formatearMoneda(rowData?.valorCuota)}</strong>;
  };

  const noCobradasTemplate = (rowData) => {
    const cantidad = Number(rowData?.cuotasNoCobradas || 0);

    if (cantidad > 0) {
      return <span className={styles.noCobradasAlerta}>{cantidad}</span>;
    }

    return <span className={styles.noCobradasNormal}>{cantidad}</span>;
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

  const totalMensualTemplate = (rowData) => {
    return (
      <strong className={styles.totalMensualServicio}>
        {formatearMoneda(rowData?.totalMensual)}
      </strong>
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
          >
            <Column field="apellidoNombre" header="Afiliado" sortable />
            <Column field="dni" header="DNI" sortable />
            <Column field="servicioNombre" header="Servicio" sortable />
            <Column header="Valor cuota mensual" body={valorCuotaTemplate} />
            <Column field="periodoHaberInicialTexto" header="Haber inicial" />
            <Column field="periodoCobroInicialTexto" header="Primer cobro" />
            <Column field="cuotasCobradas" header="Cobradas" />
            <Column header="No cobradas" body={noCobradasTemplate} />
            <Column field="cuotasPendientes" header="Pendientes" />
            <Column header="Acciones" body={accionesTemplate} />
          </DataTable>

          {resultadosBusquedaGeneral?.length > 0 && (
            <div className={styles.resumenTotalMensualBox}>
              <div className={styles.resumenTotalMensualPrincipal}>
                <span>Total descontado registrado en meses cobrados</span>
                <strong>{formatearMoneda(totalDescontadoRegistrado)}</strong>
              </div>

              <div className={styles.resumenTotalMensualTabla}>
                <h4>Resumen de meses descontados</h4>

                <DataTable
                  value={resumenMensual}
                  emptyMessage="Todavía no hay cuotas marcadas como cobradas."
                  responsiveLayout="scroll"
                >
                  <Column field="periodo" header="Mes descontado" />
                  <Column field="cantidadServicios" header="Servicios" />
                  <Column
                    header="Total descontado"
                    body={totalMensualTemplate}
                  />
                </DataTable>
              </div>
            </div>
          )}
        </div>
      )}
    </>
  );
};

export default BusquedaGeneralServicios;