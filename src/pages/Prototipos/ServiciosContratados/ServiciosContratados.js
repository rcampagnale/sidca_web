import React, { useState } from "react";
import styles from "./ServiciosContratados.module.css";

const servicios = [
  {
    id: 1,
    nombre: "Viaje a Termas de Río Hondo",
    categoria: "Turismo",
    afiliados: 148,
    cuota: 77000,
    cuotas: 4,
    cobrado: 82,
    parciales: 11,
    sinCobrar: 17,
    pendiente: 38,
    visible: true,
    color: "orange",
  },
  {
    id: 2,
    nombre: "Casa del Docente",
    categoria: "Alojamiento",
    afiliados: 84,
    cuota: 45000,
    cuotas: 6,
    cobrado: 91,
    parciales: 4,
    sinCobrar: 5,
    pendiente: 0,
    visible: true,
    color: "green",
  },
  {
    id: 3,
    nombre: "Kit tecnológico docente",
    categoria: "Equipamiento",
    afiliados: 216,
    cuota: 38500,
    cuotas: 10,
    cobrado: 74,
    parciales: 18,
    sinCobrar: 23,
    pendiente: 101,
    visible: false,
    color: "blue",
  },
];

const money = (value) =>
  new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    maximumFractionDigits: 0,
  }).format(value);

const ServiciosContratados = () => {
  const [seleccionado, setSeleccionado] = useState(servicios[0]);
  const totalEstados =
    seleccionado.cobrado +
    seleccionado.parciales +
    seleccionado.sinCobrar +
    seleccionado.pendiente;
  const cumplimiento = Math.round(
    ((seleccionado.cobrado + seleccionado.parciales * 0.5) / totalEstados) *
      100
  );

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <div>
          <span className={styles.eyebrow}>Gestión financiera</span>
          <h1>Servicios contratados</h1>
          <p>
            Seguimiento de contrataciones, cuotas, descuentos y alertas desde
            una única vista.
          </p>
        </div>
        <div className={styles.headerActions}>
          <button type="button" className={styles.secondaryButton}>
            <i className="pi pi-file-excel" /> Conciliar Excel
          </button>
          <button type="button" className={styles.primaryButton}>
            <i className="pi pi-plus" /> Nuevo servicio
          </button>
        </div>
      </header>

      <section className={styles.kpiGrid}>
        <article className={`${styles.kpi} ${styles.kpiBlue}`}>
          <span className={styles.kpiIcon}><i className="pi pi-users" /></span>
          <div>
            <small>Afiliados con servicios</small>
            <strong>448</strong>
            <span>+32 este mes</span>
          </div>
        </article>
        <article className={`${styles.kpi} ${styles.kpiGreen}`}>
          <span className={styles.kpiIcon}><i className="pi pi-wallet" /></span>
          <div>
            <small>Cobro esperado · junio</small>
            <strong>{money(22158400)}</strong>
            <span>507 cuotas emitidas</span>
          </div>
        </article>
        <article className={`${styles.kpi} ${styles.kpiOrange}`}>
          <span className={styles.kpiIcon}><i className="pi pi-chart-line" /></span>
          <div>
            <small>Tasa de cobranza</small>
            <strong>84%</strong>
            <span>+6% respecto a mayo</span>
          </div>
        </article>
        <article className={`${styles.kpi} ${styles.kpiRed}`}>
          <span className={styles.kpiIcon}><i className="pi pi-exclamation-triangle" /></span>
          <div>
            <small>Saldo pendiente</small>
            <strong>{money(3547200)}</strong>
            <span>56 casos requieren revisión</span>
          </div>
        </article>
      </section>

      <section className={styles.alertCenter}>
        <div className={styles.sectionHeading}>
          <div>
            <span>Centro de alertas</span>
            <h2>Situaciones que requieren atención</h2>
          </div>
          <button type="button">Ver todas las alertas</button>
        </div>
        <div className={styles.alertGrid}>
          <article className={styles.alertDanger}>
            <i className="pi pi-ban" />
            <div><strong>45 cuotas sin cobrar</strong><span>Distribuidas en 3 servicios</span></div>
            <button type="button">Revisar</button>
          </article>
          <article className={styles.alertWarning}>
            <i className="pi pi-percentage" />
            <div><strong>33 descuentos parciales</strong><span>Importe menor a la cuota</span></div>
            <button type="button">Revisar</button>
          </article>
          <article className={styles.alertInfo}>
            <i className="pi pi-file-excel" />
            <div><strong>12 afiliados no encontrados</strong><span>Última importación de junio</span></div>
            <button type="button">Corregir</button>
          </article>
        </div>
      </section>

      <section className={styles.workspace}>
        <aside className={styles.masterPanel}>
          <div className={styles.masterHeader}>
            <div><span>Servicios</span><strong>{servicios.length} registrados</strong></div>
            <button type="button" aria-label="Filtrar"><i className="pi pi-filter" /></button>
          </div>
          <label className={styles.search}>
            <i className="pi pi-search" />
            <input placeholder="Buscar servicio" />
          </label>
          <div className={styles.serviceList}>
            {servicios.map((servicio) => {
              const active = seleccionado.id === servicio.id;
              return (
                <button
                  type="button"
                  key={servicio.id}
                  className={`${styles.serviceCard} ${
                    active ? styles.serviceCardActive : ""
                  }`}
                  onClick={() => setSeleccionado(servicio)}
                >
                  <span className={`${styles.serviceMark} ${styles[servicio.color]}`}>
                    <i className="pi pi-briefcase" />
                  </span>
                  <div className={styles.serviceCopy}>
                    <span>{servicio.categoria}</span>
                    <strong>{servicio.nombre}</strong>
                    <small>{servicio.afiliados} afiliados · {servicio.cuotas} cuotas</small>
                  </div>
                  <span className={servicio.visible ? styles.visible : styles.hidden}>
                    {servicio.visible ? "Visible" : "Oculto"}
                  </span>
                </button>
              );
            })}
          </div>
        </aside>

        <div className={styles.detailPanel}>
          <div className={styles.detailHeader}>
            <div>
              <span>{seleccionado.categoria}</span>
              <h2>{seleccionado.nombre}</h2>
              <p>
                {seleccionado.afiliados} afiliados · {seleccionado.cuotas} cuotas
                de {money(seleccionado.cuota)}
              </p>
            </div>
            <div className={styles.detailActions}>
              <button type="button"><i className="pi pi-pencil" /> Editar</button>
              <button type="button" className={styles.primaryButton}>
                <i className="pi pi-user-plus" /> Agregar afiliados
              </button>
            </div>
          </div>

          <div className={styles.performanceGrid}>
            <article>
              <span>Cumplimiento</span>
              <strong>{cumplimiento}%</strong>
              <div className={styles.progress}><i style={{ width: `${cumplimiento}%` }} /></div>
            </article>
            <article><span>Cobradas</span><strong>{seleccionado.cobrado}</strong><small>Cuotas completas</small></article>
            <article><span>Parciales</span><strong>{seleccionado.parciales}</strong><small>Requieren seguimiento</small></article>
            <article><span>Sin cobrar</span><strong>{seleccionado.sinCobrar}</strong><small>Con alerta activa</small></article>
          </div>

          <div className={styles.detailBody}>
            <section className={styles.statusPanel}>
              <div className={styles.subheading}>
                <div><span>Estado mensual</span><h3>Distribución de cuotas</h3></div>
                <select defaultValue="2026-06"><option value="2026-06">Junio 2026</option></select>
              </div>
              <div className={styles.stackBar}>
                <i className={styles.stackGreen} style={{ flex: seleccionado.cobrado }} />
                <i className={styles.stackYellow} style={{ flex: seleccionado.parciales }} />
                <i className={styles.stackRed} style={{ flex: seleccionado.sinCobrar }} />
                <i className={styles.stackGray} style={{ flex: seleccionado.pendiente }} />
              </div>
              <div className={styles.legend}>
                <span><i className={styles.dotGreen} />Cobradas <b>{seleccionado.cobrado}</b></span>
                <span><i className={styles.dotYellow} />Parciales <b>{seleccionado.parciales}</b></span>
                <span><i className={styles.dotRed} />No cobradas <b>{seleccionado.sinCobrar}</b></span>
                <span><i className={styles.dotGray} />Pendientes <b>{seleccionado.pendiente}</b></span>
              </div>
            </section>

            <section className={styles.reconciliation}>
              <div className={styles.subheading}>
                <div><span>Conciliación mensual</span><h3>Última importación</h3></div>
                <span className={styles.processed}>Procesada</span>
              </div>
              <div className={styles.fileRow}>
                <span><i className="pi pi-file-excel" /></span>
                <div><strong>descuentos_junio_2026.xlsx</strong><small>13/06/2026 · 10:42</small></div>
              </div>
              <div className={styles.reconciliationStats}>
                <span><b>119</b> procesados</span>
                <span><b>11</b> parciales</span>
                <span><b>7</b> diferencias</span>
              </div>
              <button type="button" className={styles.reportButton}>
                <i className="pi pi-download" /> Descargar informe
              </button>
            </section>
          </div>

          <section className={styles.peoplePreview}>
            <div className={styles.subheading}>
              <div><span>Seguimiento</span><h3>Afiliados con incidencias</h3></div>
              <button type="button">Ver listado completo</button>
            </div>
            <div className={styles.peopleTable}>
              <div className={styles.tableHead}><span>Afiliado</span><span>DNI</span><span>Estado</span><span>Importe</span><span>Acción</span></div>
              <div><strong>María Elena Carrizo</strong><span>24.581.902</span><em className={styles.partialBadge}>Parcial</em><span>{money(54000)}</span><button type="button">Ver cuotas</button></div>
              <div><strong>Carlos Alberto Díaz</strong><span>28.330.771</span><em className={styles.unpaidBadge}>Sin cobrar</em><span>{money(0)}</span><button type="button">Ver cuotas</button></div>
              <div><strong>Ana Patricia Vega</strong><span>31.827.410</span><em className={styles.partialBadge}>Parcial</em><span>{money(63000)}</span><button type="button">Ver cuotas</button></div>
            </div>
          </section>
        </div>
      </section>
    </main>
  );
};

export default ServiciosContratados;
