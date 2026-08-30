import React, { useCallback, useEffect, useRef, useState } from "react";
import { Dialog } from "primereact/dialog";
import { QrReader } from "react-qr-reader";
import "./ScannerCenaQR.css";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const INTERVALO_DEDUPLICACION_MS = 1800;

const vibrarError = () => {
  if (typeof navigator === "undefined" || !("vibrate" in navigator)) return;
  try { navigator.vibrate([55, 35, 55]); } catch (error) { /* El feedback háptico es opcional. */ }
};

export const extraerTokenCenaQr = (valor) => {
  const crudo = String(valor || "").trim();
  if (UUID.test(crudo)) return crudo.toLowerCase();

  let url;
  try {
    url = new URL(crudo);
  } catch (error) {
    return null;
  }
  if (!["http:", "https:"].includes(url.protocol)) return null;

  const partes = url.pathname.split("/").filter(Boolean);
  const esNuevaRuta = partes.length === 2 && partes[0] === "validar-cena";
  const esRutaAnterior =
    partes.length === 4 &&
    partes[0] === "admin" &&
    partes[1] === "gestion-cena" &&
    partes[2] === "validar";
  const token = esNuevaRuta || esRutaAnterior ? decodeURIComponent(partes[partes.length - 1] || "") : "";

  return UUID.test(token) ? token.toLowerCase() : null;
};

const ScannerCenaQR = ({ abierto, onCodigoValido, onCancelar }) => {
  const bloqueada = useRef(false);
  const ultimoToken = useRef("");
  const momentoUltimoEscaneo = useRef(0);
  const ultimoInvalido = useRef("");
  const [aviso, setAviso] = useState("");
  const [errorCamara, setErrorCamara] = useState("");

  useEffect(() => {
    if (!abierto) return;
    bloqueada.current = false;
    ultimoToken.current = "";
    momentoUltimoEscaneo.current = 0;
    ultimoInvalido.current = "";
    setAviso("");
    setErrorCamara("");
  }, [abierto]);

  const leer = useCallback(
    (result) => {
      if (!result || bloqueada.current) return;
      const texto = typeof result.getText === "function" ? result.getText() : String(result);
      const token = extraerTokenCenaQr(texto);
      if (!token) {
        if (texto !== ultimoInvalido.current) {
          ultimoInvalido.current = texto;
          setAviso("El código detectado no corresponde a una tarjeta de Cena SIDCA.");
          vibrarError();
        }
        return;
      }
      const ahora = Date.now();
      if (token === ultimoToken.current && ahora - momentoUltimoEscaneo.current < INTERVALO_DEDUPLICACION_MS) return;
      bloqueada.current = true;
      ultimoToken.current = token;
      momentoUltimoEscaneo.current = ahora;
      onCodigoValido(token);
    },
    [onCodigoValido]
  );

  return (
    <Dialog header="Escanear tarjeta de Cena" visible={abierto} modal onHide={onCancelar} className="cenaScannerDialog">
      <div className="cenaScanner">
        <QrReader
          onResult={leer}
          scanDelay={120}
          constraints={{ facingMode: { ideal: "environment" }, width: { ideal: 960 }, height: { ideal: 540 } }}
          containerStyle={{ width: "100%" }}
          videoContainerStyle={{ width: "100%", height: "100%" }}
          videoStyle={{ objectFit: "cover" }}
          onError={() => setErrorCamara("No se pudo acceder a la cámara. Habilitá el permiso de cámara para continuar.")}
        />
        <span className="cenaScannerGuia" aria-hidden="true" />
      </div>
      <p className="cenaScannerTexto">Ubicá el código QR dentro del recuadro.</p>
      {aviso && <p className="cenaScannerAviso" role="alert">{aviso}</p>}
      {errorCamara && <div className="cenaScannerError"><p>{errorCamara}</p><button type="button" onClick={() => setErrorCamara("")}>Reintentar cámara</button></div>}
    </Dialog>
  );
};

export default ScannerCenaQR;
