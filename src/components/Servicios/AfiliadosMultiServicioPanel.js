import React, { useEffect, useMemo, useState } from "react";
import { Button } from "primereact/button";
import { InputText } from "primereact/inputtext";
import { Dropdown } from "primereact/dropdown";
import { ProgressSpinner } from "primereact/progressspinner";
import { collectionGroup, getDocs } from "firebase/firestore";

import { db } from "../../firebase/firebase-config";
import styles from "../../pages/Admin/Servicios/servicios.module.css";

const limpiarTexto = (valor) => String(valor || "").trim().replace(/\s+/g, " ");
const normalizarDni = (valor) => String(valor || "").replace(/\D/g, "");

const formatearMoneda = (valor) =>
  new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(Number(valor || 0));

const MESES = [
  "enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
];

const formatearPeriodo = (periodo) => {
  const [anio, mes] = String(periodo || "").split("-").map(Number);
  return anio && mes >= 1 && mes <= 12 ? `${MESES[mes - 1]} ${anio}` : "Sin período";
};

const restarUnMes = (periodo) => {
  const [anio, mes] = String(periodo || "").split("-").map(Number);
  if (!anio || !mes) return "";
  const fecha = new Date(anio, mes - 2, 1);
  return `${fecha.getFullYear()}-${String(fecha.getMonth() + 1).padStart(2, "0")}`;
};

const sumarUnMes = (periodo) => {
  const [anio, mes] = String(periodo || "").split("-").map(Number);
  if (!anio || !mes) return "";
  const fecha = new Date(anio, mes, 1);
  return `${fecha.getFullYear()}-${String(fecha.getMonth() + 1).padStart(2, "0")}`;
};

const periodoActual = () => {
  const fecha = new Date();
  return `${fecha.getFullYear()}-${String(fecha.getMonth() + 1).padStart(2, "0")}`;
};

const obtenerServicioIdDesdePath = (path = "") => {
  const partes = String(path).split("/");
  const indiceServicios = partes.indexOf("servicios");
  return indiceServicios >= 0 ? partes[indiceServicios + 1] || "" : "";
};

const obtenerNombreAfiliado = (contrato) =>
  limpiarTexto(
    contrato?.apellidoNombre ||
      [contrato?.apellido, contrato?.nombre].filter(Boolean).join(", ")
  ) || "Sin nombre registrado";

const construirContrato = (docSnap, serviciosMap) => {
  const data = docSnap.data() || {};
  const servicioId =
    data.servicioId || obtenerServicioIdDesdePath(docSnap.ref.path);
  const servicio = serviciosMap.get(servicioId);
  const dni = normalizarDni(data.dni || docSnap.id);

  return {
    id: docSnap.id,
    path: docSnap.ref.path,
    ...data,
    dni,
    servicioId,
    servicioNombre:
      data.servicioNombre || data.nombreServicio || servicio?.nombre || "Servicio sin nombre",
    servicioValorCuota: Number(data.valorCuota || servicio?.valorCuota || 0),
  };
};

const resumenEstado = (contratos) =>
  contratos.reduce(
    (acc, contrato) => {
      acc.cobradas += Number(contrato?.cuotasCobradas || 0);
      acc.parciales += Number(contrato?.cuotasParciales || 0);
      acc.noCobradas += Number(contrato?.cuotasNoCobradas || 0);
      acc.canceladas += Number(contrato?.cuotasCanceladas || 0);
      acc.pendientes += Number(contrato?.cuotasPendientes || 0);
      acc.saldoPendiente += Number(contrato?.saldoPendienteContratacion || 0);
      acc.totalDescontado += Number(contrato?.totalDescontadoContratacion || 0);
      return acc;
    },
    {
      cobradas: 0,
      parciales: 0,
      noCobradas: 0,
      canceladas: 0,
      pendientes: 0,
      saldoPendiente: 0,
      totalDescontado: 0,
    }
  );

const agruparDescuentosPorMes = (contratos) => {
  const descuentos = new Map();
  const periodoCobroActual = periodoActual();
  contratos.forEach((contrato) => {
    (contrato.cuotas || []).forEach((cuota) => {
      const importe = Number(cuota?.importeDescontado || 0);
      const periodoCobro = cuota?.periodoCobro || "";
      const periodoHaber = cuota?.periodoHaber || restarUnMes(periodoCobro);
      if (!periodoCobro && !periodoHaber) return;
      if (periodoCobro && periodoCobro > periodoCobroActual) return;
      const clave = periodoCobro || periodoHaber || "sin-periodo";
      const actual = descuentos.get(clave) || { periodoCobro, periodoHaber, importe: 0 };
      actual.importe += importe;
      descuentos.set(clave, actual);
    });
  });
  return Array.from(descuentos.values()).sort((a, b) =>
    String(b.periodoCobro || b.periodoHaber).localeCompare(
      String(a.periodoCobro || a.periodoHaber)
    )
  );
};

const obtenerUltimoHaberDescontado = (contratos) =>
  agruparDescuentosPorMes(contratos)[0] || null;

const obtenerPeriodoCuota = (cuota) => {
  const periodoCobro = cuota?.periodoCobro || sumarUnMes(cuota?.periodoHaber);
  const periodoHaber = cuota?.periodoHaber || restarUnMes(periodoCobro);
  return { periodoHaber, periodoCobro };
};

const obtenerDescuentoPorHaber = (contratos, periodoSeleccionado) => {
  if (!periodoSeleccionado) return obtenerUltimoHaberDescontado(contratos);

  let encontroCuota = false;
  let importe = 0;
  let periodoCobro = sumarUnMes(periodoSeleccionado);

  contratos.forEach((contrato) => {
    (contrato.cuotas || []).forEach((cuota) => {
      const periodo = obtenerPeriodoCuota(cuota);
      if (periodo.periodoHaber !== periodoSeleccionado) return;
      encontroCuota = true;
      importe += Number(cuota?.importeDescontado || 0);
      periodoCobro = periodo.periodoCobro || periodoCobro;
    });
  });

  return encontroCuota
    ? { periodoHaber: periodoSeleccionado, periodoCobro, importe }
    : null;
};

const cuotaFueCargada = (cuota) => {
  const importe = cuota?.importeDescontado;
  return importe !== null && importe !== undefined && importe !== "";
};

const obtenerHaberFaltante = (contrato, periodoSeleccionado) => {
  if (!periodoSeleccionado || contratoCancelado(contrato)) return null;

  const cuotasPeriodo = (contrato.cuotas || []).filter(
    (cuota) => obtenerPeriodoCuota(cuota).periodoHaber === periodoSeleccionado
  );
  if (cuotasPeriodo.length === 0 || cuotasPeriodo.some(cuotaFueCargada)) return null;

  const periodo = obtenerPeriodoCuota(cuotasPeriodo[0]);
  return {
    periodoHaber: periodoSeleccionado,
    periodoCobro: periodo.periodoCobro || sumarUnMes(periodoSeleccionado),
  };
};

const obtenerResumenReserva = (contrato, servicio) => {
  const cantidad = Math.max(
    1,
    Number(
      contrato?.cantidadLugares ||
        contrato?.cantidadPersonas ||
        contrato?.cantidadReservas ||
        1
    )
  );
  const valorBase = Number(
    contrato?.valorCuotaBase ||
      contrato?.valorPorLugar ||
      servicio?.valorCuota ||
      0
  );
  const valorReserva =
    valorBase > 0
      ? valorBase * cantidad
      : Number(contrato?.valorCuota || servicio?.valorCuota || 0);

  return `${cantidad} ${cantidad === 1 ? "reserva" : "reservas"} · ${formatearMoneda(valorReserva)}`;
};

const contratoCancelado = (contrato) =>
  contrato?.cancelado === true ||
  String(contrato?.estadoContratacion || "").toLowerCase() === "cancelada" ||
  Number(contrato?.cuotasCanceladas || 0) > 0;

const contratoPagadoCompleto = (contrato) => {
  if (contratoCancelado(contrato)) return false;

  const sinIncidencias =
    Number(contrato?.cuotasParciales || 0) === 0 &&
    Number(contrato?.cuotasNoCobradas || 0) === 0 &&
    Number(contrato?.cuotasPendientes || 0) === 0;
  const saldoPendiente = Number(contrato?.saldoPendienteContratacion || 0);
  const totalDescontado = Number(contrato?.totalDescontadoContratacion || 0);
  const cuotasCobradas = Number(contrato?.cuotasCobradas || 0);
  const cantidadCuotas = Number(contrato?.cantidadCuotas || 0);
  const esContado =
    contrato?.esPagoContado === true || contrato?.tipoPago === "contado";

  return (
    sinIncidencias &&
    saldoPendiente <= 0 &&
    totalDescontado > 0 &&
    (esContado || cantidadCuotas === 0 || cuotasCobradas >= cantidadCuotas)
  );
};

const obtenerLeyendaContrato = (contrato) => {
  if (contratoCancelado(contrato)) {
    return {
      texto: "Servicio cancelado",
      detalle:
        contrato?.cuotaCancelacion || contrato?.periodoCancelacion
          ? `Cierre registrado desde ${contrato.cuotaCancelacion || contrato.periodoCancelacion}.`
          : "Contratación cerrada por cancelación.",
      clase: "multiServicioLeyendaCancelado",
      icono: "pi pi-ban",
    };
  }

  if (contratoPagadoCompleto(contrato)) {
    return {
      texto: "Pagado en su totalidad",
      detalle: "No registra saldo pendiente.",
      clase: "multiServicioLeyendaPagado",
      icono: "pi pi-check-circle",
    };
  }

  const saldoPendiente = Number(contrato?.saldoPendienteContratacion || 0);
  if (saldoPendiente > 0) {
    return {
      texto: "Con saldo pendiente",
      detalle: `Falta regularizar ${formatearMoneda(saldoPendiente)}.`,
      clase: "multiServicioLeyendaPendiente",
      icono: "pi pi-exclamation-triangle",
    };
  }

  return null;
};

const AfiliadosMultiServicioPanel = ({
  servicios = [],
  onSeleccionarServicio,
  onVerCuotas,
}) => {
  const [contratos, setContratos] = useState([]);
  const [loading, setLoading] = useState(false);
  const [filtro, setFiltro] = useState("");
  const [dniSeleccionado, setDniSeleccionado] = useState("");
  const [periodoHaberSeleccionado, setPeriodoHaberSeleccionado] = useState("");

  const serviciosMap = useMemo(
    () => new Map((servicios || []).map((servicio) => [servicio.id, servicio])),
    [servicios]
  );

  useEffect(() => {
    let cancelado = false;

    const cargarContratos = async () => {
      setLoading(true);
      try {
        const [contratacionesSnap, cuotasSnap] = await Promise.all([
          getDocs(collectionGroup(db, "contrataciones")),
          getDocs(collectionGroup(db, "cuotas")),
        ]);
        const cuotasPorContratacion = new Map();
        cuotasSnap.docs.forEach((cuotaSnap) => {
          const contratacionPath = cuotaSnap.ref.parent.parent?.path;
          if (!contratacionPath) return;
          const cuotas = cuotasPorContratacion.get(contratacionPath) || [];
          cuotas.push({ id: cuotaSnap.id, ...cuotaSnap.data() });
          cuotasPorContratacion.set(contratacionPath, cuotas);
        });

        const items = contratacionesSnap.docs
          .map((docSnap) => construirContrato(docSnap, serviciosMap))
          .map((contrato) => ({
            ...contrato,
            cuotas: cuotasPorContratacion.get(contrato.path) || [],
          }))
          .filter((contrato) => contrato.dni && contrato.servicioId);

        if (!cancelado) setContratos(items);
      } catch (error) {
        console.error("Error al cargar afiliados con multiples servicios:", error);
        if (!cancelado) setContratos([]);
      } finally {
        if (!cancelado) setLoading(false);
      }
    };

    cargarContratos();

    return () => {
      cancelado = true;
    };
  }, [serviciosMap]);

  const periodosHaber = useMemo(() => {
    const periodos = new Map();
    const cobroActual = periodoActual();

    contratos.forEach((contrato) => {
      (contrato.cuotas || []).forEach((cuota) => {
        const periodo = obtenerPeriodoCuota(cuota);
        if (!periodo.periodoHaber) return;
        if (periodo.periodoCobro && periodo.periodoCobro > cobroActual) return;
        periodos.set(periodo.periodoHaber, {
          value: periodo.periodoHaber,
          periodoCobro: periodo.periodoCobro || sumarUnMes(periodo.periodoHaber),
          label: `Haber ${formatearPeriodo(periodo.periodoHaber)} · se descuenta en ${formatearPeriodo(
            periodo.periodoCobro || sumarUnMes(periodo.periodoHaber)
          )}`,
        });
      });
    });

    return Array.from(periodos.values()).sort((a, b) =>
      b.value.localeCompare(a.value)
    );
  }, [contratos]);

  useEffect(() => {
    if (periodosHaber.length === 0) {
      setPeriodoHaberSeleccionado("");
      return;
    }
    setPeriodoHaberSeleccionado((actual) => {
      if (periodosHaber.some((periodo) => periodo.value === actual)) return actual;
      const haberEnCurso = restarUnMes(periodoActual());
      return (
        periodosHaber.find((periodo) => periodo.value === haberEnCurso)?.value ||
        periodosHaber[0].value
      );
    });
  }, [periodosHaber]);

  const afiliadosMultiServicio = useMemo(() => {
    const mapa = new Map();

    contratos.forEach((contrato) => {
      const correspondeAlHaber =
        !periodoHaberSeleccionado ||
        (contrato.cuotas || []).some(
          (cuota) =>
            obtenerPeriodoCuota(cuota).periodoHaber ===
            periodoHaberSeleccionado
        );
      if (!correspondeAlHaber) return;

      const dni = contrato.dni;
      const actual = mapa.get(dni) || {
        dni,
        apellidoNombre: obtenerNombreAfiliado(contrato),
        departamento: contrato.departamentoServicio || contrato.departamento || "",
        telefono: contrato.telefonoContacto || contrato.telefono || "",
        contratos: [],
      };

      actual.contratos.push(contrato);
      if (
        actual.apellidoNombre === "Sin nombre registrado" &&
        obtenerNombreAfiliado(contrato) !== "Sin nombre registrado"
      ) {
        actual.apellidoNombre = obtenerNombreAfiliado(contrato);
      }

      mapa.set(dni, actual);
    });

    return Array.from(mapa.values())
      .map((afiliado) => {
        const serviciosUnicos = new Map();
        afiliado.contratos.forEach((contrato) => {
          if (!serviciosUnicos.has(contrato.servicioId)) {
            serviciosUnicos.set(contrato.servicioId, contrato);
          }
        });

        return {
          ...afiliado,
          cantidadServicios: serviciosUnicos.size,
          servicios: Array.from(serviciosUnicos.values()).sort((a, b) =>
            limpiarTexto(a.servicioNombre).localeCompare(
              limpiarTexto(b.servicioNombre)
            )
          ),
          resumen: resumenEstado(afiliado.contratos),
          ultimoHaberDescontado: obtenerUltimoHaberDescontado(afiliado.contratos),
        };
      })
      .filter((afiliado) => afiliado.cantidadServicios >= 2)
      .sort((a, b) => {
        if (b.cantidadServicios !== a.cantidadServicios) {
          return b.cantidadServicios - a.cantidadServicios;
        }
        return limpiarTexto(a.apellidoNombre).localeCompare(
          limpiarTexto(b.apellidoNombre)
        );
      });
  }, [contratos, periodoHaberSeleccionado]);

  const afiliadosFiltrados = useMemo(() => {
    const termino = limpiarTexto(filtro).toLowerCase();
    const dniFiltro = normalizarDni(filtro);

    if (!termino && !dniFiltro) return afiliadosMultiServicio;

    return afiliadosMultiServicio.filter((afiliado) => {
      const texto = `${afiliado.apellidoNombre} ${afiliado.departamento} ${
        afiliado.telefono
      } ${afiliado.servicios.map((servicio) => servicio.servicioNombre).join(" ")}`.toLowerCase();

      return (
        (dniFiltro && afiliado.dni.includes(dniFiltro)) ||
        (termino && texto.includes(termino))
      );
    });
  }, [afiliadosMultiServicio, filtro]);

  const afiliadoSeleccionado = useMemo(
    () =>
      afiliadosFiltrados.find((afiliado) => afiliado.dni === dniSeleccionado) ||
      afiliadosFiltrados[0] ||
      null,
    [afiliadosFiltrados, dniSeleccionado]
  );

  const totalServiciosRelacionados = afiliadosMultiServicio.reduce(
    (total, afiliado) => total + afiliado.cantidadServicios,
    0
  );
  const totalConIncidencias = afiliadosMultiServicio.filter(
    (afiliado) =>
      Number(afiliado.resumen.parciales || 0) > 0 ||
      Number(afiliado.resumen.noCobradas || 0) > 0 ||
      Number(afiliado.resumen.pendientes || 0) > 0
  ).length;

  return (
    <section className={styles.multiServicioPanel}>
      <div className={styles.multiServicioHeader}>
        <div>
          <span>Reporte cruzado</span>
          <h2>Afiliados con dos o más servicios</h2>
          <p>
            Vista administrativa para detectar afiliados con varias
            contrataciones activas o históricas.
          </p>
        </div>
        <div className={styles.multiServicioKpis}>
          <article>
            <span>Afiliados</span>
            <strong>{afiliadosMultiServicio.length}</strong>
          </article>
          <article>
            <span>Servicios vinculados</span>
            <strong>{totalServiciosRelacionados}</strong>
          </article>
          <article>
            <span>Con incidencias</span>
            <strong>{totalConIncidencias}</strong>
          </article>
        </div>
      </div>

      <div className={styles.multiServicioFiltros}>
        <label className={styles.multiServicioSearch}>
          <i className="pi pi-search" />
          <InputText
            value={filtro}
            onChange={(e) => {
              setFiltro(e.target.value);
              setDniSeleccionado("");
            }}
            placeholder="Buscar por DNI, apellido, nombre o servicio"
          />
        </label>
        <label className={styles.multiServicioPeriodoFiltro}>
          <span>Haber</span>
          <Dropdown
            value={periodoHaberSeleccionado}
            options={periodosHaber}
            onChange={(e) => setPeriodoHaberSeleccionado(e.value)}
            placeholder="Seleccionar haber"
          />
        </label>
      </div>

      {loading ? (
        <div className={styles.loadingBox}>
          <ProgressSpinner />
          <span>Cargando afiliados con múltiples servicios...</span>
        </div>
      ) : afiliadosFiltrados.length === 0 ? (
        <div className={styles.emptyServiceDetail}>
          <i className="pi pi-users" />
          <h3>No hay afiliados para mostrar</h3>
          <p>No se encontraron afiliados con dos o más servicios.</p>
        </div>
      ) : (
        <div className={styles.multiServicioLayout}>
          <div className={styles.multiServicioTablaWrap}>
            <table className={styles.multiServicioTabla}>
              <thead>
                <tr>
                  <th>Afiliado</th>
                  <th>DNI</th>
                  <th>Servicios</th>
                  <th>Estado</th>
                  <th>Haber descontado / mes de descuento</th>
                </tr>
              </thead>
              <tbody>
                {afiliadosFiltrados.map((afiliado) => {
                  const seleccionado = afiliadoSeleccionado?.dni === afiliado.dni;
                  const descuento = obtenerDescuentoPorHaber(
                    afiliado.contratos,
                    periodoHaberSeleccionado
                  );
                  return (
                    <tr
                      key={afiliado.dni}
                      className={seleccionado ? styles.multiServicioFilaActiva : ""}
                      onClick={() => setDniSeleccionado(afiliado.dni)}
                    >
                      <td>
                        <strong>{afiliado.apellidoNombre}</strong>
                        {afiliado.departamento && <small>{afiliado.departamento}</small>}
                      </td>
                      <td>{afiliado.dni}</td>
                      <td>
                        <span className={styles.multiServicioCantidad}>
                          {afiliado.cantidadServicios} servicios
                        </span>
                      </td>
                      <td>
                        <div className={styles.multiServicioBadges}>
                          <span className={styles.badgeCobrado}>C {afiliado.resumen.cobradas}</span>
                          <span className={styles.badgeParcial}>P {afiliado.resumen.parciales}</span>
                          <span className={styles.badgeNoCobrado}>NC {afiliado.resumen.noCobradas}</span>
                          <span className={styles.badgePendiente}>PE {afiliado.resumen.pendientes}</span>
                        </div>
                      </td>
                      <td>
                        {descuento ? (
                          <div className={styles.multiServicioDescuentosMes}>
                            <div>
                                <strong>{formatearMoneda(descuento.importe)}</strong>
                                <small>
                                  Haber {formatearPeriodo(descuento.periodoHaber)} · se descuenta en {formatearPeriodo(descuento.periodoCobro)}
                                </small>
                              </div>
                          </div>
                        ) : (
                          <small>Sin descuentos registrados</small>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {afiliadoSeleccionado && (
            <aside className={styles.multiServicioDetalle}>
              <div className={styles.multiServicioDetalleHeader}>
                <span>Detalle seleccionado</span>
                <h3>{afiliadoSeleccionado.apellidoNombre}</h3>
                <p>DNI {afiliadoSeleccionado.dni}</p>
              </div>

              <div className={styles.multiServicioResumen}>
                <span>
                  <b>{afiliadoSeleccionado.cantidadServicios}</b>
                  servicios
                </span>
                <span>
                  <b>{formatearMoneda(afiliadoSeleccionado.resumen.saldoPendiente)}</b>
                  saldo pendiente
                </span>
              </div>

              <div className={styles.multiServicioContratos}>
                {afiliadoSeleccionado.servicios.map((contrato) => {
                  const servicio = serviciosMap.get(contrato.servicioId);
                  const leyendaContrato = obtenerLeyendaContrato(contrato);
                  const haberFaltante = obtenerHaberFaltante(
                    contrato,
                    periodoHaberSeleccionado
                  );
                  return (
                    <article
                      key={`${contrato.servicioId}-${contrato.id}`}
                      className={
                        leyendaContrato
                          ? styles[leyendaContrato.clase]
                          : ""
                      }
                    >
                      <div>
                        <strong>{contrato.servicioNombre}</strong>
                        <small>{obtenerResumenReserva(contrato, servicio)}</small>
                      </div>
                      {leyendaContrato && (
                        <div className={styles.multiServicioLeyenda}>
                          <i className={leyendaContrato.icono} />
                          <span>
                            <b>{leyendaContrato.texto}</b>
                            <small>{leyendaContrato.detalle}</small>
                          </span>
                        </div>
                      )}
                      {haberFaltante && (
                        <div className={styles.multiServicioHaberFaltante}>
                          <i className="pi pi-exclamation-triangle" />
                          <span>
                            Falta cargar el haber de {formatearPeriodo(haberFaltante.periodoHaber)},
                            que se cobra en {formatearPeriodo(haberFaltante.periodoCobro)}.
                          </span>
                        </div>
                      )}
                      <div className={styles.multiServicioBadges}>
                        <span className={styles.badgeCobrado}>C {contrato.cuotasCobradas || 0}</span>
                        <span className={styles.badgeParcial}>P {contrato.cuotasParciales || 0}</span>
                        <span className={styles.badgeNoCobrado}>NC {contrato.cuotasNoCobradas || 0}</span>
                        <span className={styles.badgePendiente}>PE {contrato.cuotasPendientes || 0}</span>
                      </div>
                      <div className={styles.multiServicioAcciones}>
                        <Button
                          label="Ver servicio"
                          icon="pi pi-briefcase"
                          className="p-button-sm p-button-outlined"
                          onClick={() => servicio && onSeleccionarServicio?.(servicio)}
                          disabled={!servicio}
                        />
                        <Button
                          label="Ver cuotas"
                          icon="pi pi-list"
                          className="p-button-sm p-button-info"
                          onClick={() => onVerCuotas?.(contrato)}
                        />
                      </div>
                    </article>
                  );
                })}
              </div>
            </aside>
          )}
        </div>
      )}
    </section>
  );
};

export default AfiliadosMultiServicioPanel;
