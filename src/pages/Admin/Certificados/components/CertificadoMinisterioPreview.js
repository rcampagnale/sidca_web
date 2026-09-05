import React, { useEffect, useRef, useState } from "react";
import { Dialog } from "primereact/dialog";
import QRCode from "react-qr-code";

import marcoMinisterio from "../../../../assets/certificados/ministerio/marco_ministerio.png";
import logoMinisterio from "../../../../assets/certificados/ministerio/logo_ministerio.png";
import { ministerioLayout } from "../layouts/ministerioLayout";
import {
  calcularLayoutMinisterio,
  validarConfiguracionMinisterio,
} from "../utils/ministerioCertificado";
import styles from "./CertificadoMinisterioPreview.module.css";

const texto = (valor) => String(valor || "").trim();

const organismoEnLineas = (valor) =>
  texto(valor).replace(/\.\s+/g, ".\n").split("\n").filter(Boolean);

const firmantesActivos = (certificado) =>
  (Array.isArray(certificado?.firmantesMinisterio)
    ? certificado.firmantesMinisterio
    : []
  )
    .filter((firmante) => firmante?.activo !== false)
    .sort((a, b) => Number(a?.orden || 0) - Number(b?.orden || 0));

const CertificadoMinisterioPreview = ({
  abierto,
  participante,
  configuracion,
  emision,
  firmas = {},
  puedeEmitir,
  motivoNoEmitir,
  onEmitir,
  onCerrar,
  emitiendo,
  emitido,
  consultandoEmision,
}) => {
  const viewportRef = useRef(null);
  const [escala, setEscala] = useState(1);
  const certificado =
    emision?.certificado?.institucionCertificado === "ministerio"
      ? emision.certificado
      : configuracion || {};
  const participanteEfectivo = emision?.participante || participante || {};
  const validacion = validarConfiguracionMinisterio({
    certificado,
    participante: participanteEfectivo,
  });
  const layout = validacion.layout || calcularLayoutMinisterio({
    certificado,
    participante: participanteEfectivo,
  });
  const { page, marco, logo, encabezado, certifica, participante: cajaParticipante, actividad, firmas: zonaFirmas, qr, fonts, tituloBox } = ministerioLayout;

  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport || typeof ResizeObserver === "undefined") return undefined;
    const actualizar = () => setEscala(viewport.clientWidth / page.width);
    actualizar();
    const observador = new ResizeObserver(actualizar);
    observador.observe(viewport);
    return () => observador.disconnect();
  }, [page.width]);

  if (
    (!participante && !emision?.participante) ||
    (!configuracion && !emision)
  ) {
    return null;
  }

  const urlValidacion = texto(emision?.urlValidacion);
  const firmantes = firmantesActivos(certificado);
  const alturaLineaTitulo =
    layout.tituloFit?.lineHeight ||
    fonts.title.initial * fonts.title.lineHeightFactor;
  const alturaTitulo = layout.tituloFit?.height || alturaLineaTitulo;
  // Una segunda línea empuja “Dictado…” hacia abajo. La caja acompaña la
  // mitad de esa altura extra para conservar el bloque centrado en la banda.
  const desplazamientoTitulo = Math.max(
    0,
    (alturaTitulo - alturaLineaTitulo) / 2
  );
  const tituloTop = tituloBox.top + (desplazamientoTitulo / page.height) * 100;
  const bloqueaEmision = !puedeEmitir || !validacion.valid;
  const razon = validacion.errores[0] || motivoNoEmitir;
  const textoBoton = emitiendo
    ? "Emitiendo..."
    : emitido
    ? "Certificado emitido"
    : consultandoEmision
    ? "Verificando emisión..."
    : "Emitir certificado";

  const renderBloque = (bloque, indice) => (
    <p
      key={`${bloque.y}-${indice}`}
      className={styles.cuerpoLinea}
      style={{
        left: ministerioLayout.cuerpo.x,
        top: bloque.y,
        width: ministerioLayout.cuerpo.width,
        fontSize: `${bloque.fontSize}px`,
        lineHeight: `${bloque.lineHeight}px`,
        whiteSpace: bloque.lines.length === 1 ? "nowrap" : "normal",
      }}
    >
      {bloque.lines.map((linea, lineaIndice) => (
        <React.Fragment key={`${linea}-${lineaIndice}`}>
          {linea}
          {lineaIndice < bloque.lines.length - 1 && <br />}
        </React.Fragment>
      ))}
    </p>
  );

  return (
    <Dialog
      visible={Boolean(abierto)}
      onHide={() => !emitiendo && onCerrar?.()}
      modal
      blockScroll
      draggable={false}
      dismissableMask={!emitiendo}
      closeOnEscape={!emitiendo}
      className={styles.dialogo}
      style={{ width: "min(920px, 96vw)" }}
      header="Vista previa - Modelo Ministerio"
      footer={
        <div className={styles.pie}>
          <p className={styles.notaPie}>{razon || (emision ? "Esta vista utiliza el snapshot de la emisión." : "Vista previa: todavía no se emitió el certificado.")}</p>
          <div className={styles.pieBotones}>
            <button type="button" className={styles.botonEmitir} onClick={onEmitir} disabled={bloqueaEmision || emitiendo || emitido || consultandoEmision}>
              {textoBoton}
            </button>
            <button type="button" className={styles.botonCerrar} onClick={onCerrar} disabled={emitiendo}>
              Cerrar
            </button>
          </div>
        </div>
      }
    >
      {!validacion.valid && (
        <section className={styles.advertencia} aria-live="polite">
          <strong>Configuración incompleta para emitir</strong>
          <ul>{validacion.errores.map((error) => <li key={error}>{error}</li>)}</ul>
        </section>
      )}
      <div ref={viewportRef} className={styles.viewport} style={{ height: page.height * escala }}>
        <div
          className={styles.certificado}
          data-certificado-preview="true"
          data-certificado-modelo="ministerio"
          style={{ width: page.width, height: page.height, transform: `scale(${escala})` }}
        >
          <img className={styles.marco} src={marcoMinisterio} alt="" aria-hidden="true" style={{ left: marco.x, top: marco.y, width: marco.width, height: marco.height }} />
          <img className={styles.logo} src={logoMinisterio} alt="Emblema Ministerio de Educación y Trabajo" style={{ left: logo.x, top: logo.y, width: logo.width, height: logo.height }} />
          <p className={styles.ministerio} style={{ left: encabezado.ministerio.x, top: encabezado.ministerio.y, width: encabezado.ministerio.width }}>Ministerio de<br />Educación y Trabajo</p>
          <p className={styles.gobierno} style={{ left: encabezado.gobierno.x, top: encabezado.gobierno.y, width: encabezado.gobierno.width }}>Catamarca Gobierno</p>
          <p className={styles.secretaria} style={{ left: encabezado.secretaria.x, top: encabezado.secretaria.y, width: encabezado.secretaria.width }}>SECRETARIA DE INNOVACION Y CALIDAD EDUCATIVA</p>
          <p className={styles.certifica} style={{ left: certifica.x, top: certifica.y, width: certifica.width }}>CERTIFICA</p>
          <p className={styles.participante} style={{ left: cajaParticipante.x, top: cajaParticipante.y, width: cajaParticipante.width, fontSize: `${layout.participanteFit?.fontSize || fonts.participant.initial}px`, lineHeight: `${layout.participanteFit?.lineHeight || fonts.participant.initial * fonts.participant.lineHeightFactor}px` }}>
            {(layout.participanteFit?.lines || ["Que [APELLIDO Y NOMBRE] D.N.I. N° [DNI]"]).map((linea, indice) => <React.Fragment key={`${linea}-${indice}`}>{linea}{indice < (layout.participanteFit?.lines || []).length - 1 && <br />}</React.Fragment>)}
          </p>
          <p className={styles.actividad} style={{ left: actividad.x, top: actividad.y, width: actividad.width, fontSize: `${fonts.activity.size}px`, lineHeight: `${fonts.activity.size * fonts.activity.lineHeightFactor}px` }}>{layout.textos?.actividad}</p>
          <p className={styles.tituloBox} style={{ fontSize: `${layout.tituloFit?.fontSize || fonts.title.initial}px`, "--titulo-top": `${tituloTop}%`, "--titulo-left": `${tituloBox.left}%`, "--titulo-width": `${tituloBox.width}%`, "--titulo-height": `${tituloBox.height}%` }}>
            {(layout.tituloFit?.lines || ["“[TÍTULO DE LA CAPACITACIÓN]”"]).map((linea, indice, lineas) => <React.Fragment key={`${linea}-${indice}`}>{linea}{indice < lineas.length - 1 && <br />}</React.Fragment>)}
          </p>
          {(layout.cuerpo || []).map(renderBloque)}
          {firmantes.map((firmante, indice) => {
            const ancho = zonaFirmas.imageWidths[Math.min(indice, zonaFirmas.imageWidths.length - 1)];
            const x = zonaFirmas.positions[Math.min(indice, zonaFirmas.positions.length - 1)];
            const anchoColumna = zonaFirmas.columnWidths[Math.min(indice, zonaFirmas.columnWidths.length - 1)];
            return (
              <section key={firmante.id} className={styles.firmante} style={{ left: x, width: anchoColumna }}>
                <div className={styles.firmaImagen} style={{ left: (anchoColumna - ancho) / 2, top: zonaFirmas.startY, width: ancho, height: zonaFirmas.imageHeight }}>
                  {firmante.imagenUrl || firmas[firmante.id] ? (
                    <img
                      src={firmante.imagenUrl || firmas[firmante.id]}
                      alt={`Firma de ${firmante.nombre}`}
                    />
                  ) : <span>FIRMA PENDIENTE</span>}
                </div>
                <div className={styles.firmanteTexto} style={{ top: zonaFirmas.textY, height: zonaFirmas.textHeight }}>
                  <strong>{firmante.nombre}</strong>
                  <span className={styles.cargo}>{firmante.cargo}</span>
                  <span className={styles.organismo}>
                    {organismoEnLineas(firmante.organismo).map((linea, lineaIndice, lineas) => (
                      <React.Fragment key={`${linea}-${lineaIndice}`}>
                        {linea}
                        {lineaIndice < lineas.length - 1 && <br />}
                      </React.Fragment>
                    ))}
                  </span>
                </div>
              </section>
            );
          })}
          <div className={styles.qr} style={{ left: qr.x, top: qr.y, width: qr.width, height: qr.height }}>
            {urlValidacion ? <QRCode value={urlValidacion} size={qr.width} level="M" bgColor="#fff" fgColor="#000" title="Código QR de validación" /> : <span>QR de validación</span>}
          </div>
        </div>
      </div>
    </Dialog>
  );
};

export default CertificadoMinisterioPreview;
