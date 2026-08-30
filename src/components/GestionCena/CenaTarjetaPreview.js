import React from "react";
import QRCode from "react-qr-code";
import tarjetaAcompananteBase from "../../assets/gestion-cena/tarjeta-acompanante-base.png";
import tarjetaTitularBase from "../../assets/gestion-cena/tarjeta-titular-base.png";
import { formatearDniCena, obtenerDatosEventoCena } from "../../services/gestionCenaService";
import styles from "../../pages/Admin/GestionCena/GestionCenaAdmin.module.css";

const CenaTarjetaPreview = ({ tarjeta, edicion, url, modoPdf = false }) => {
  if (!tarjeta) return null;

  const evento = obtenerDatosEventoCena(edicion, tarjeta.anio);
  const nombre = `${tarjeta.afiliadoApellido || ""} ${tarjeta.afiliadoNombre || ""}`.trim();
  const qrValue = url || tarjeta.urlValidacion || tarjeta.token;
  const esTitular = tarjeta.tipo === "titular";
  const totalTarjetas = (tarjeta.totalAcompanantes || 0) + 1;
  const fechaHora = [evento.fechaTexto, evento.horaTexto].filter(Boolean).join(" - ");
  const ubicacion = [evento.direccion, evento.localidad].filter(Boolean).join(" | ");
  const claseNombre = nombre.length > 28 ? styles.gcTicketLongName : "";

  return (
    <article className={`${styles.gcOfficialTicket} ${modoPdf ? styles.gcOfficialTicketPdf : ""} ${esTitular ? "" : styles.gcCompanionTicket}`}>
      <img
        className={styles.gcTicketTemplate}
        src={esTitular ? tarjetaTitularBase : tarjetaAcompananteBase}
        alt=""
        aria-hidden="true"
      />
      <div className={styles.gcTicketDynamic}>
        <h3 className={styles.gcTicketEventName}>{evento.nombreEvento}</h3>
        <section className={styles.gcTicketInfo}>
          <p className={`${styles.gcTicketType} ${esTitular ? "" : styles.gcTicketCompanionType}`}>{esTitular ? "AFILIADO/A" : "ACOMPAÑANTE"}</p>
          {esTitular ? (
            <>
              <h4 className={claseNombre}>{nombre}</h4>
              <p className={styles.gcTicketDni}>DNI {formatearDniCena(tarjeta.afiliadoDni)}</p>
              <p className={styles.gcTicketNumber}>TARJETA {tarjeta.numeroTarjeta} DE {totalTarjetas}</p>
            </>
          ) : (
            <>
              <p className={styles.gcTicketLinked}>Vinculado a:</p>
              <h4 className={claseNombre}>{nombre}</h4>
              <p className={styles.gcTicketDni}>DNI {formatearDniCena(tarjeta.afiliadoDni)}</p>
              <p className={`${styles.gcTicketNumber} ${styles.gcTicketCompanionNumber}`}>ACOMPAÑANTE {tarjeta.numeroAcompanante} DE {tarjeta.totalAcompanantes}</p>
            </>
          )}
          <div className={styles.gcTicketEventData}>
            {evento.lugar && <strong>{evento.lugar}</strong>}
            {fechaHora && <span>{fechaHora}</span>}
          </div>
          <p className={styles.gcTicketLegend}>{esTitular ? evento.leyendaTitular : evento.leyendaAcompanante}</p>
        </section>
        <aside className={styles.gcTicketAccess}>
          <div className={styles.gcTicketQr}>
            <QRCode value={qrValue} size={160} bgColor="#ffffff" fgColor="#000000" />
          </div>
        </aside>
        <footer className={styles.gcTicketFooter}>
          <span>{evento.organizadorTexto}</span>
          <span>{evento.sitioWeb}</span>
          {ubicacion && <small>{ubicacion}</small>}
        </footer>
      </div>
    </article>
  );
};

export default CenaTarjetaPreview;
