// src/components/Servicios/AlertaAfiliadosDialog.js

import React, { useState, useEffect, useMemo } from "react";
import { Dialog } from "primereact/dialog";
import { Button } from "primereact/button";
import { InputText } from "primereact/inputtext";
import { ProgressSpinner } from "primereact/progressspinner";
import { collection, getDocs } from "firebase/firestore";
import { db } from "../../firebase/firebase-config";
import styles from "./DetalleServicioDialog.module.css";
import alertaStyles from "./AlertaAfiliadosDialog.module.css";

const MESES = [
  "enero","febrero","marzo","abril","mayo","junio",
  "julio","agosto","septiembre","octubre","noviembre","diciembre",
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

const limpiarTexto = (texto = "") =>
  texto
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim();

const CARDS_POR_PAGINA = 12;

const AlertaAfiliadosDialog = ({ visible, onHide, servicio, estado, onVerCuotas }) => {
  const [contrataciones, setContrataciones] = useState([]);
  const [loading, setLoading] = useState(false);
  const [filtro, setFiltro] = useState("");
  const [pagina, setPagina] = useState(1);

  useEffect(() => {
    if (!visible || !servicio?.id) return;
    setFiltro("");
    setPagina(1);
    cargar(servicio.id);
  }, [visible, servicio?.id]);

  const cargar = async (servicioId) => {
    setLoading(true);
    try {
      const snap = await getDocs(collection(db, "servicios", servicioId, "contrataciones"));
      const principales = snap.docs.map((d) => ({
        id: d.id,
        esSubcontratacion: false,
        ...d.data(),
      }));

      const subPromesas = await Promise.all(
        principales.map(async (c) => {
          try {
            const subSnap = await getDocs(
              collection(db, "servicios", servicioId, "contrataciones", c.dni, "subcontrataciones")
            );
            return subSnap.docs.map((sd) => ({
              id: sd.id,
              subcontratacionId: sd.id,
              parentDni: c.dni,
              esSubcontratacion: true,
              ...sd.data(),
            }));
          } catch {
            return [];
          }
        })
      );

      const todas = [...principales, ...subPromesas.flat()].sort((a, b) =>
        limpiarTexto(a.apellidoNombre).localeCompare(limpiarTexto(b.apellidoNombre))
      );

      setContrataciones(todas);
    } catch (err) {
      console.error("Error al cargar afiliados:", err);
    } finally {
      setLoading(false);
    }
  };

  const filtradas = useMemo(() => {
    const base =
      estado === "parcial"
        ? contrataciones.filter((c) => Number(c.cuotasParciales || 0) > 0)
        : contrataciones.filter((c) => Number(c.cuotasNoCobradas || 0) > 0);

    if (!filtro.trim()) return base;
    const termino = limpiarTexto(filtro);
    return base.filter((c) => {
      const texto = limpiarTexto(
        `${c.apellidoNombre || ""} ${c.nombre || ""} ${c.apellido || ""} ${c.dni || ""}`
      );
      return texto.includes(termino);
    });
  }, [contrataciones, estado, filtro]);

  const totalPaginas = Math.ceil(filtradas.length / CARDS_POR_PAGINA);
  const paginadas = useMemo(() => {
    const inicio = (pagina - 1) * CARDS_POR_PAGINA;
    return filtradas.slice(inicio, inicio + CARDS_POR_PAGINA);
  }, [filtradas, pagina]);

  const irAPagina = (p) => {
    if (p >= 1 && p <= totalPaginas) setPagina(p);
  };

  const handleFiltro = (val) => {
    setFiltro(val);
    setPagina(1);
  };

  const estadoBadge = (rowData) => {
    if (rowData?.cancelado) return <span className={styles.estadoCancelado}>Viaje cancelado</span>;
    if (rowData?.esPagoContado || rowData?.tipoPago === "contado")
      return <span className={styles.estadoContado}>Contado</span>;
    return <span className={styles.estadoCuotas}>Cuotas</span>;
  };

  const resumenBadges = (rowData) => {
    const items = [
      { label: "C",   campo: "cuotasCobradas",   cls: styles.badgeCobrado,   title: "Cobradas" },
      { label: "P",   campo: "cuotasParciales",   cls: styles.badgeParcial,   title: "Parciales" },
      { label: "NC",  campo: "cuotasNoCobradas",  cls: styles.badgeNoCobrado, title: "No cobradas" },
      { label: "CAN", campo: "cuotasCanceladas",  cls: styles.badgeCancelado, title: "Canceladas" },
      { label: "PE",  campo: "cuotasPendientes",  cls: styles.badgePendiente, title: "Pendientes" },
    ];
    return (
      <div className={styles.resumenBadgesRow}>
        {items.map(({ label, campo, cls, title }) => (
          <span key={campo} className={`${styles.resumenBadge} ${cls}`} title={title}>
            <b>{label}</b> {Number(rowData?.[campo] || 0)}
          </span>
        ))}
      </div>
    );
  };

  const AfiliadoCard = ({ rowData }) => {
    const personas = Number(rowData?.cantidadPersonas || 0);
    const cancelado = !!rowData?.cancelado;
    const esSub = !!rowData?.esSubcontratacion;
    return (
      <div className={`${styles.afiliadoCard} ${cancelado ? styles.afiliadoCardCancelado : ""} ${esSub ? styles.afiliadoCardSub : ""}`}>
        <div className={styles.cardTop}>
          <div className={styles.cardNombreBloque}>
            <div className={styles.cardNombreRow}>
              <strong className={styles.cardNombre}>
                {rowData?.apellidoNombre || "Sin nombre registrado"}
              </strong>
              {esSub && <span className={styles.subBadge}>Contrato adicional</span>}
            </div>
            <div className={styles.cardMeta}>
              <span><b>DNI</b> {rowData?.dni || "-"}</span>
              {rowData?.departamentoServicio && <span><b>Depto.</b> {rowData.departamentoServicio}</span>}
              {rowData?.telefonoContacto && <span><b>Tel</b> {rowData.telefonoContacto}</span>}
              {personas > 0 && (
                <span className={styles.personasBadge}>
                  <i className="pi pi-users" style={{ fontSize: "0.75rem" }} />
                  {personas} {personas === 1 ? "persona" : "personas"}
                </span>
              )}
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
          {rowData?.detalleCuotasExcel && (
            <div className={`${styles.cardDato} ${styles.cardDatoFull}`}>
              <span>Detalle</span>
              <strong>{rowData.detalleCuotasExcel}</strong>
            </div>
          )}
        </div>

        <div className={styles.cardBottom}>
          {resumenBadges(rowData)}
          <Button
            icon="pi pi-list"
            label="Ver cuotas"
            className={`p-button-sm p-button-info ${styles.cardBotonCuotas}`}
            onClick={() => onVerCuotas(rowData)}
          />
        </div>
      </div>
    );
  };

  const esParcial = estado === "parcial";

  const headerTitle = servicio
    ? `${servicio.nombre} — ${esParcial ? "Pagos parciales" : "Sin cobrar"}`
    : "";

  return (
    <Dialog
      header={headerTitle}
      visible={visible}
      style={{ width: "98vw", maxWidth: "1100px" }}
      modal
      onHide={onHide}
      className={styles.detalleDialog}
    >
      <div className={alertaStyles.contenedor}>
        <div className={esParcial ? alertaStyles.bannerParcial : alertaStyles.bannerNoCobrado}>
          <i className={esParcial ? "pi pi-percentage" : "pi pi-ban"} style={{ fontSize: "1.1rem" }} />
          <div>
            <strong>
              {esParcial
                ? "Afiliados con pago parcial"
                : "Afiliados sin cuotas cobradas"}
            </strong>
            <span>
              {loading
                ? "Cargando..."
                : `${filtradas.length} afiliado${filtradas.length !== 1 ? "s" : ""} encontrado${filtradas.length !== 1 ? "s" : ""}`}
            </span>
          </div>
        </div>

        <div className={alertaStyles.busqueda}>
          <InputText
            value={filtro}
            onChange={(e) => handleFiltro(e.target.value)}
            placeholder="Buscar por DNI, apellido o nombre"
          />
        </div>

        {loading ? (
          <div className={styles.loadingBox}>
            <ProgressSpinner />
            <span>Cargando afiliados...</span>
          </div>
        ) : filtradas.length === 0 ? (
          <div className={styles.sinResultados}>
            {filtro ? "No se encontraron afiliados con ese criterio." : "No hay afiliados en esta categoría."}
          </div>
        ) : (
          <>
            <div className={styles.cardsGrid}>
              {paginadas.map((rowData) => (
                <AfiliadoCard key={`${rowData.dni}-${rowData.subcontratacionId || "p"}`} rowData={rowData} />
              ))}
            </div>

            {totalPaginas > 1 && (
              <div className={styles.paginador}>
                <Button icon="pi pi-angle-double-left" className="p-button-text p-button-sm" onClick={() => irAPagina(1)} disabled={pagina === 1} />
                <Button icon="pi pi-angle-left" className="p-button-text p-button-sm" onClick={() => irAPagina(pagina - 1)} disabled={pagina === 1} />
                <span className={styles.paginadorInfo}>
                  {pagina} / {totalPaginas}
                  <small>({filtradas.length} afiliados)</small>
                </span>
                <Button icon="pi pi-angle-right" className="p-button-text p-button-sm" onClick={() => irAPagina(pagina + 1)} disabled={pagina === totalPaginas} />
                <Button icon="pi pi-angle-double-right" className="p-button-text p-button-sm" onClick={() => irAPagina(totalPaginas)} disabled={pagina === totalPaginas} />
              </div>
            )}
          </>
        )}
      </div>
    </Dialog>
  );
};

export default AlertaAfiliadosDialog;
