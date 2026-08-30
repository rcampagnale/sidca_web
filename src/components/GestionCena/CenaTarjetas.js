import React, { useMemo, useState } from "react";
import {
  esTarjetaVigenteCena,
  estaTarjetaAcreditadaCena,
  formatearDniCena,
  resumirTarjetasVigentesCena,
} from "../../services/gestionCenaService";
import CenaTarjetaPreview from "./CenaTarjetaPreview";
import styles from "../../pages/Admin/GestionCena/GestionCenaAdmin.module.css";

const estadoTarjeta = (tarjeta) => (tarjeta.anulada ? "anulada" : estaTarjetaAcreditadaCena(tarjeta) ? "validada" : "pendiente");

const etiquetaTarjeta = (tarjeta) => (
  tarjeta.tipo === "titular"
    ? "TITULAR"
    : `ACOMPAÑANTE ${tarjeta.numeroAcompanante} DE ${tarjeta.totalAcompanantes}`
);

const etiquetaEstado = (tarjeta) => {
  if (tarjeta.anulada) return "ANULADA";
  if (estaTarjetaAcreditadaCena(tarjeta)) return "ACREDITADA";
  return "PENDIENTE";
};

const formatearFechaIngreso = (valor) => {
  if (!valor) return "";
  const fecha = valor?.toDate ? valor.toDate() : new Date(valor);
  if (Number.isNaN(fecha.getTime())) return "";
  const fechaTexto = fecha.toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit", year: "numeric" });
  const horaTexto = fecha.toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit", hour12: false });
  return `${fechaTexto} - ${horaTexto} hs`;
};

const usuarioIngreso = (tarjeta) => {
  if (tarjeta.validadoPorDisplay) return tarjeta.validadoPorDisplay;
  const usuario = tarjeta.validadoPor || {};
  const nombre = tarjeta.validadoPorNombre || usuario.nombre || "";
  const email = tarjeta.validadoPorEmail || usuario.email || usuario.correo || "";
  if (nombre && email && nombre !== email) return `${nombre} (${email})`;
  return nombre || email || usuario.uid || tarjeta.validadoPorUid || "Usuario no informado";
};

const CenaTarjetas = ({
  tarjetas,
  anio,
  edicion,
  reservaSeleccionada,
  onVolverTodas,
  onVolverReservas,
  onAnularTarjeta,
  onReemitirTarjeta,
  onPdf,
  onPdfReserva,
  onPdfTodas,
  generandoPdf,
  progresoPdf,
  urlParaTarjeta,
}) => {
  const [busqueda, setBusqueda] = useState("");
  const [tipo, setTipo] = useState("");
  const [estado, setEstado] = useState("");
  const [seleccion, setSeleccion] = useState([]);
  const [preview, setPreview] = useState(null);
  const [tarjetaAnular, setTarjetaAnular] = useState(null);
  const [motivoAnulacion, setMotivoAnulacion] = useState("extravío");
  const [observacionAnulacion, setObservacionAnulacion] = useState("");
  const [anulando, setAnulando] = useState(false);
  const [errorAnulacion, setErrorAnulacion] = useState("");
  const [tarjetaReemitir, setTarjetaReemitir] = useState(null);
  const [reemitiendo, setReemitiendo] = useState(false);
  const [errorReemision, setErrorReemision] = useState("");

  const esDetalleReserva = Boolean(reservaSeleccionada?.id);
  const tarjetasContexto = useMemo(
    () => {
      if (!esDetalleReserva) return tarjetas;
      return tarjetas
        .filter((tarjeta) => tarjeta.reservaId === reservaSeleccionada.id)
        .sort((primera, segunda) => {
          const posicion = Number(primera.numeroTarjeta || 0) - Number(segunda.numeroTarjeta || 0);
          if (posicion) return posicion;
          const activaPrimero = Number(primera.anulada) - Number(segunda.anulada);
          if (activaPrimero) return activaPrimero;
          return Number(segunda.numeroReemision || 0) - Number(primera.numeroReemision || 0);
        });
    },
    [esDetalleReserva, reservaSeleccionada, tarjetas]
  );

  const filtradas = useMemo(() => {
    const texto = busqueda.trim().toLowerCase();
    return tarjetasContexto.filter((tarjeta) => {
      const coincideTexto =
        !texto ||
        String(tarjeta.afiliadoDni || "").includes(texto.replace(/\D/g, "")) ||
        `${tarjeta.afiliadoApellido || ""} ${tarjeta.afiliadoNombre || ""}`.toLowerCase().includes(texto) ||
        String(tarjeta.codigoVisible || "").toLowerCase().includes(texto);
      const coincideTipo = !tipo || tarjeta.tipo === tipo;
      return coincideTexto && coincideTipo && (!estado || estadoTarjeta(tarjeta) === estado);
    });
  }, [busqueda, estado, tarjetasContexto, tipo]);

  const seleccionadas = tarjetasContexto.filter((tarjeta) => seleccion.includes(tarjeta.id));
  const resumenVigentes = resumirTarjetasVigentesCena(tarjetasContexto);
  const activas = resumenVigentes.vigentes;
  const acreditadas = resumenVigentes.acreditadas;
  const anuladas = tarjetasContexto.length - activas.length;
  const pendientes = resumenVigentes.pendientes;
  const estadoGeneral = reservaSeleccionada?.estado === "anulada"
    ? "ANULADA"
    : !activas.length
    ? "SIN TARJETAS ACTIVAS"
    : acreditadas === activas.length
      ? "ACREDITADA"
      : acreditadas
        ? "PARCIAL"
        : "PENDIENTE";

  const abrirAnulacion = (tarjeta) => {
    setTarjetaAnular(tarjeta);
    setMotivoAnulacion("extravío");
    setObservacionAnulacion("");
    setErrorAnulacion("");
  };

  const cerrarAnulacion = () => {
    if (!anulando) setTarjetaAnular(null);
  };

  const confirmarAnulacion = async () => {
    if (!tarjetaAnular || (motivoAnulacion === "otro" && !observacionAnulacion.trim())) return;
    setAnulando(true);
    setErrorAnulacion("");
    try {
      await onAnularTarjeta(tarjetaAnular, motivoAnulacion, observacionAnulacion);
      setTarjetaAnular(null);
    } catch (error) {
      setErrorAnulacion(error.message || "No se pudo anular la tarjeta.");
    } finally {
      setAnulando(false);
    }
  };

  const abrirReemision = (tarjeta) => {
    setTarjetaReemitir(tarjeta);
    setErrorReemision("");
  };

  const cerrarReemision = () => {
    if (!reemitiendo) setTarjetaReemitir(null);
  };

  const confirmarReemision = async () => {
    if (!tarjetaReemitir) return;
    setReemitiendo(true);
    setErrorReemision("");
    try {
      await onReemitirTarjeta(tarjetaReemitir);
      setTarjetaReemitir(null);
    } catch (error) {
      setErrorReemision(error.message || "No se pudo reemitir la tarjeta.");
    } finally {
      setReemitiendo(false);
    }
  };

  return (
    <section className={styles.gcPanel}>
      {esDetalleReserva ? (
        <>
          <div className={styles.gcDetailHeader}>
            <div>
              <p className={styles.gcDetailEyebrow}>Tarjetas de la reserva</p>
              <h2>{reservaSeleccionada.afiliado?.apellido} {reservaSeleccionada.afiliado?.nombre}</h2>
              <p className={styles.muted}>DNI {formatearDniCena(reservaSeleccionada.afiliado?.dni)}</p>
            </div>
            <div className={styles.actions}>
              <button type="button" className={styles.secondaryButton} onClick={() => onPdfReserva(reservaSeleccionada)} disabled={generandoPdf}>
                {generandoPdf && progresoPdf.tipo === "afiliado" ? `GENERANDO PDF... ${progresoPdf.porcentaje}%` : "GENERAR PDF DEL AFILIADO"}
              </button>
              <button type="button" className={styles.secondaryButton} onClick={onVolverTodas}>Volver a todas las tarjetas</button>
              <button type="button" className={styles.secondaryButton} onClick={onVolverReservas}>Volver a Reservas</button>
            </div>
          </div>
          <div className={styles.gcDetailCounts}>
            <span>Total de la reserva <strong>{reservaSeleccionada.cantidadTarjetas}</strong></span>
            <span>Emitidas <strong>{tarjetasContexto.length}</strong></span>
            <span>Activas <strong>{activas.length}</strong></span>
            <span>Acreditadas <strong>{acreditadas}</strong></span>
            <span>Pendientes <strong>{pendientes}</strong></span>
            <span>Anuladas <strong>{anuladas}</strong></span>
            <span>Estado general <strong>{estadoGeneral}</strong></span>
          </div>
        </>
      ) : (
        <>
          <div className={styles.gcPanelHeader}>
            <h2>Tarjetas / QR</h2>
            <div className={styles.actions}>
              <button type="button" className={styles.secondaryButton} disabled={!seleccionadas.length || generandoPdf} onClick={() => onPdf(seleccionadas)}>
                {generandoPdf && progresoPdf.tipo === "seleccion" ? `GENERANDO PDF... ${progresoPdf.porcentaje}%` : "PDF selección"}
              </button>
              <button type="button" className={styles.primaryButton} onClick={onPdfTodas} disabled={generandoPdf}>
                {generandoPdf ? `GENERANDO PDF... ${progresoPdf.porcentaje}%` : `GENERAR PDF MASIVO ${anio}`}
              </button>
            </div>
          </div>
          <div className={styles.filters}>
            <input value={busqueda} onChange={(e) => setBusqueda(e.target.value)} placeholder="Buscar DNI, apellido/nombre o código" />
            <select value={tipo} onChange={(e) => setTipo(e.target.value)}>
              <option value="">Todos los tipos</option>
              <option value="titular">Titular</option>
              <option value="acompanante">Acompañante</option>
            </select>
            <select value={estado} onChange={(e) => setEstado(e.target.value)}>
              <option value="">Todos los estados</option>
              <option value="pendiente">Pendiente</option>
              <option value="validada">Validada</option>
              <option value="anulada">Anulada</option>
            </select>
          </div>
        </>
      )}

      <div className={styles.ticketGrid}>
        {filtradas.map((tarjeta) => (
          <article key={tarjeta.id} className={styles.ticketCard}>
            {!esDetalleReserva && (
              <label className={styles.checkRow}>
                <input
                  type="checkbox"
                  checked={seleccion.includes(tarjeta.id)}
                  onChange={(e) =>
                    setSeleccion((prev) => e.target.checked ? [...prev, tarjeta.id] : prev.filter((id) => id !== tarjeta.id))
                  }
                />
                {tarjeta.codigoVisible}
              </label>
            )}
            <strong>{etiquetaTarjeta(tarjeta)}</strong>
            <span>{tarjeta.afiliadoApellido} {tarjeta.afiliadoNombre}</span>
            <span className={`${styles.ticketStatus} ${styles[`ticket${estadoTarjeta(tarjeta)}`]}`}>{etiquetaEstado(tarjeta)}</span>
            {estaTarjetaAcreditadaCena(tarjeta) && <>
              <span className={styles.gcTicketAudit}>Estado: INGRESÓ</span>
              {formatearFechaIngreso(tarjeta.fechaValidacion) && <span className={styles.gcTicketAudit}>Fecha: {formatearFechaIngreso(tarjeta.fechaValidacion)}</span>}
              <span className={styles.gcTicketAudit}>Registrado por: {usuarioIngreso(tarjeta)}</span>
            </>}
            {tarjeta.anulada && tarjeta.motivoAnulacion && <span className={styles.gcTicketAudit}>Motivo: {tarjeta.motivoAnulacion}</span>}
            {tarjeta.anulada && tarjeta.reemplazada && <span className={styles.gcTicketReplaced}>REEMPLAZADA POR NUEVA TARJETA</span>}
            {tarjeta.esReemision && <span className={styles.gcTicketReissued}>REEMISIÓN {tarjeta.numeroReemision}</span>}
            <div className={styles.rowActions}>
              <button type="button" onClick={() => setPreview(tarjeta)}>Ver QR</button>
              <button type="button" onClick={() => onPdf([tarjeta])}>PDF</button>
              {esTarjetaVigenteCena(tarjeta) && !estaTarjetaAcreditadaCena(tarjeta) && (
                <button type="button" className={styles.gcTicketCancelButton} onClick={() => abrirAnulacion(tarjeta)}>Anular tarjeta</button>
              )}
              {tarjeta.anulada && !tarjeta.reemplazada && !tarjeta.reemplazadaPor && (
                <button type="button" className={styles.gcTicketReissueButton} onClick={() => abrirReemision(tarjeta)}>Reemitir tarjeta</button>
              )}
            </div>
            {estaTarjetaAcreditadaCena(tarjeta) && <span className={styles.gcTicketLocked}>TARJETA YA ACREDITADA</span>}
          </article>
        ))}
      </div>
      {!filtradas.length && <p className={styles.empty}>No hay tarjetas para mostrar.</p>}

      {preview && (
        <div className={styles.modalOverlay} role="dialog" aria-modal="true">
          <div className={styles.modal}>
            <div className={styles.modalHeader}>
              <h2>QR</h2>
              <button type="button" className={styles.iconButton} onClick={() => setPreview(null)}>×</button>
            </div>
            <CenaTarjetaPreview tarjeta={preview} edicion={edicion} url={urlParaTarjeta(preview)} />
          </div>
        </div>
      )}

      {tarjetaAnular && (
        <div className={styles.modalOverlay} role="dialog" aria-modal="true" aria-labelledby="titulo-anular-tarjeta">
          <div className={styles.modal}>
            <div className={styles.modalHeader}>
              <h2 id="titulo-anular-tarjeta">Anular tarjeta</h2>
              <button type="button" className={styles.iconButton} onClick={cerrarAnulacion} disabled={anulando}>×</button>
            </div>
            <p className={styles.gcAnulacionIntro}>Está por anular esta tarjeta de ingreso. El QR dejará de ser válido y las demás tarjetas de la reserva seguirán activas.</p>
            <div className={styles.gcAnulacionData}>
              <span>Tipo <strong>{etiquetaTarjeta(tarjetaAnular)}</strong></span>
              <span>Titular <strong>{tarjetaAnular.afiliadoApellido} {tarjetaAnular.afiliadoNombre}</strong></span>
              <span>Código administrativo <strong>{tarjetaAnular.codigoVisible}</strong></span>
            </div>
            <label>
              Motivo
              <select value={motivoAnulacion} onChange={(event) => setMotivoAnulacion(event.target.value)} disabled={anulando}>
                <option value="extravío">Extravío</option>
                <option value="deterioro">Deterioro</option>
                <option value="error de emisión">Error de emisión</option>
                <option value="cancelación">Cancelación</option>
                <option value="otro">Otro</option>
              </select>
            </label>
            {motivoAnulacion === "otro" && (
              <label>
                Observación
                <textarea value={observacionAnulacion} onChange={(event) => setObservacionAnulacion(event.target.value)} disabled={anulando} />
              </label>
            )}
            {errorAnulacion && <p className={styles.error}>{errorAnulacion}</p>}
            <div className={styles.modalActions}>
              <button type="button" className={styles.secondaryButton} onClick={cerrarAnulacion} disabled={anulando}>Cancelar</button>
              <button
                type="button"
                className={styles.gcDangerButton}
                onClick={confirmarAnulacion}
                disabled={anulando || (motivoAnulacion === "otro" && !observacionAnulacion.trim())}
              >
                {anulando ? "Anulando tarjeta..." : "Confirmar anulación"}
              </button>
            </div>
          </div>
        </div>
      )}

      {tarjetaReemitir && (
        <div className={styles.modalOverlay} role="dialog" aria-modal="true" aria-labelledby="titulo-reemitir-tarjeta">
          <div className={styles.modal}>
            <div className={styles.modalHeader}>
              <h2 id="titulo-reemitir-tarjeta">Reemitir tarjeta</h2>
              <button type="button" className={styles.iconButton} onClick={cerrarReemision} disabled={reemitiendo}>×</button>
            </div>
            <div className={styles.gcAnulacionData}>
              <span>Tarjeta anulada <strong>{etiquetaTarjeta(tarjetaReemitir)}</strong></span>
              <span>Titular <strong>{tarjetaReemitir.afiliadoApellido} {tarjetaReemitir.afiliadoNombre}</strong></span>
              <span>Motivo de anulación <strong>{tarjetaReemitir.motivoAnulacion || "Sin motivo registrado"}</strong></span>
            </div>
            <p className={styles.gcAnulacionIntro}>Se generará una nueva tarjeta con un nuevo QR. La tarjeta anterior permanecerá anulada y no podrá volver a utilizarse. La cantidad de personas de la reserva no cambiará.</p>
            {errorReemision && <p className={styles.error}>{errorReemision}</p>}
            <div className={styles.modalActions}>
              <button type="button" className={styles.secondaryButton} onClick={cerrarReemision} disabled={reemitiendo}>Cancelar</button>
              <button type="button" className={styles.primaryButton} onClick={confirmarReemision} disabled={reemitiendo}>
                {reemitiendo ? "Reemitiendo tarjeta..." : "Confirmar reemisión"}
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
};

export default CenaTarjetas;
