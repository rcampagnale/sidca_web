// src/components/HabilitarBotones/qr/QRDisplayDialog.js

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Button } from "primereact/button";
import { Dialog } from "primereact/dialog";
import QRCode from "react-qr-code";
import { getTipoRegistroLabel } from "./qrUtils.js";
import logoSindicato from "../../../assets/img/logo-01.png";
import styles from "./qr.module.css";

const LOGO_POSITIONS = [
  { top: "50%", left: "50%" },
  { top: "38%", left: "50%" },
  { top: "62%", left: "50%" },
  { top: "50%", left: "38%" },
  { top: "50%", left: "62%" },
  { top: "42%", left: "42%" },
  { top: "58%", left: "58%" },
];

const hashString = (value = "") => {
  let hash = 0;

  for (let i = 0; i < value.length; i += 1) {
    hash = (hash << 5) - hash + value.charCodeAt(i);
    hash |= 0;
  }

  return Math.abs(hash);
};

const getDynamicLogoPosition = (seed = "") => {
  const index = hashString(seed) % LOGO_POSITIONS.length;
  return LOGO_POSITIONS[index];
};

const QRDisplayDialog = ({
  visible,
  onHide,
  sesionActual,
  qrSync,
  estaComputadoraAutorizada,
  qrContainerRef,
  onDownload,
  downloadingQR,
  onCopiarCodigo,
}) => {
  const surfaceRef = useRef(null);
  const [isBrowserFullscreen, setIsBrowserFullscreen] = useState(false);

  const tipoRegistro =
    sesionActual?.tipoRegistro || sesionActual?.tipoMarcacion || "ingreso";

  const esPantallaProyectada = estaComputadoraAutorizada;
  const tituloRegistro = `REGISTRO DE ${getTipoRegistroLabel(tipoRegistro)}`;

  const logoPosition = useMemo(() => {
    const seed = `${sesionActual?.codigo || ""}-${
      sesionActual?.updatedAt?.seconds || ""
    }-${sesionActual?.updatedAt?.nanoseconds || ""}`;

    return getDynamicLogoPosition(seed);
  }, [
    sesionActual?.codigo,
    sesionActual?.updatedAt?.seconds,
    sesionActual?.updatedAt?.nanoseconds,
  ]);

  useEffect(() => {
    const onFullscreenChange = () => {
      setIsBrowserFullscreen(Boolean(document.fullscreenElement));
    };

    document.addEventListener("fullscreenchange", onFullscreenChange);
    onFullscreenChange();

    return () => {
      document.removeEventListener("fullscreenchange", onFullscreenChange);
    };
  }, []);

  const toggleBrowserFullscreen = useCallback(async () => {
    try {
      if (!document.fullscreenElement) {
        const target = surfaceRef.current;

        if (!target) return;

        if (target.requestFullscreen) {
          await target.requestFullscreen();
        } else if (target.webkitRequestFullscreen) {
          target.webkitRequestFullscreen();
        }
      } else if (document.exitFullscreen) {
        await document.exitFullscreen();
      } else if (document.webkitExitFullscreen) {
        document.webkitExitFullscreen();
      }
    } catch (error) {
      console.error("No se pudo cambiar a pantalla completa:", error);
    }
  }, []);

  return (
    <Dialog
      header={esPantallaProyectada ? null : "QR de Asistencia"}
      visible={visible}
      style={{
        width: esPantallaProyectada ? "100vw" : 760,
        maxWidth: "100vw",
      }}
      contentStyle={{
        padding: esPantallaProyectada ? 0 : "1rem",
        height: esPantallaProyectada ? "100vh" : "auto",
        overflow: "hidden",
      }}
      className={
        esPantallaProyectada
          ? styles.qrFullscreenDialog
          : styles.qrStandardDialog
      }
      modal
      closable={!esPantallaProyectada}
      draggable={false}
      resizable={false}
      blockScroll
      onHide={onHide}
    >
      {sesionActual?.qrPayload ? (
        <div
          ref={surfaceRef}
          className={`${styles.qrModalContent} ${
            esPantallaProyectada ? styles.qrProjectionSurface : ""
          }`}
        >
          <div className={styles.qrTopBar}>
            <Button
              label={
                isBrowserFullscreen
                  ? "Salir de pantalla completa"
                  : "Pantalla completa"
              }
              icon={
                isBrowserFullscreen
                  ? "pi pi-window-minimize"
                  : "pi pi-window-maximize"
              }
              onClick={toggleBrowserFullscreen}
              severity="secondary"
              outlined
              size="small"
            />
          </div>

          <div className={styles.qrProjectionHeader}>
            <h2>{tituloRegistro}</h2>
            <h3>Curso: {sesionActual.cursoTitulo}</h3>
          </div>

          {!esPantallaProyectada && (
            <div className={styles.qrStatusLine}>
              <span className={styles.badgeInfo}>Vista administradora</span>

              {qrSync?.habilitada && (
                <span className={styles.badgeSuccess}>Sync activa</span>
              )}
            </div>
          )}

          <div className={styles.qrBox}>
            <div
              ref={qrContainerRef}
              className={`${styles.qrCodeStage} ${
                esPantallaProyectada ? styles.qrCodeStageProjection : ""
              }`}
            >
              <QRCode
                value={sesionActual.qrPayload}
                size={esPantallaProyectada ? 720 : 460}
                level="H"
              />

              <img
                src={logoSindicato}
                alt="Logo SiDCa"
                data-qr-logo="true"
                className={`${styles.qrMovingLogo} ${
                  esPantallaProyectada
                    ? styles.qrMovingLogoProjection
                    : ""
                }`}
                style={logoPosition}
              />
            </div>
          </div>

          {!esPantallaProyectada && (
            <>
              <div className={styles.qrInfo}>
                <div className={styles.qrCodeText}>
                  {sesionActual.codigo || "—"}
                </div>

                <small>
                  Si la cámara falla, el afiliado puede ingresar el código
                  manualmente en la app.
                </small>
              </div>

              <div className={styles.dialogActions}>
                <Button
                  label="Descargar PNG"
                  icon="pi pi-download"
                  onClick={() => onDownload(4)}
                  loading={downloadingQR}
                  severity="success"
                />

                <Button
                  label="Copiar código"
                  icon="pi pi-copy"
                  onClick={onCopiarCodigo}
                  severity="info"
                  outlined
                />

                <Button
                  label="Cerrar vista local"
                  icon="pi pi-times"
                  severity="danger"
                  onClick={onHide}
                />
              </div>
            </>
          )}
        </div>
      ) : (
        <div className={styles.emptyBox}>No hay QR disponible.</div>
      )}
    </Dialog>
  );
};

export default QRDisplayDialog;