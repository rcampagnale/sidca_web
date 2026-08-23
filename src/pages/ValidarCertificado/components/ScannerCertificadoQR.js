import React, { useCallback, useEffect, useRef, useState } from "react";
import { Dialog } from "primereact/dialog";
import { QrReader } from "react-qr-reader";
import "./ScannerCertificadoQR.css";

const TOKEN = /^[a-f0-9]{48}$/i;

export const extraerQRValidador = (valor) => {
  const crudo = String(valor || "").trim();
  if (!crudo) return null;
  let url;
  try {
    url = new URL(crudo);
  } catch {
    return null;
  }
  if (url.protocol !== "https:" || !["sidcagremio.com", "www.sidcagremio.com"].includes(url.hostname)) return null;
  const partes = url.pathname.split("/").filter(Boolean);
  const indice = partes.indexOf("validar-certificado");
  const cursoId = indice >= 0 ? decodeURIComponent(partes[indice + 1] || "") : "";
  const token = indice >= 0 ? decodeURIComponent(partes[indice + 2] || "") : "";
  return cursoId && TOKEN.test(token) ? { cursoId, token } : null;
};

const ScannerCertificadoQR = ({ abierto, onCodigoValido, onCancelar }) => {
  const bloqueada = useRef(false);
  const ultimoInvalido = useRef("");
  const [aviso, setAviso] = useState("");
  const [errorCamara, setErrorCamara] = useState("");

  useEffect(() => {
    if (abierto) { bloqueada.current = false; ultimoInvalido.current = ""; setAviso(""); setErrorCamara(""); }
  }, [abierto]);

  const leer = useCallback((result) => {
    if (!result || bloqueada.current) return;
    const texto = typeof result.getText === "function" ? result.getText() : String(result);
    const datos = extraerQRValidador(texto);
    if (!datos) {
      if (texto !== ultimoInvalido.current) { ultimoInvalido.current = texto; setAviso("El código detectado no corresponde a un certificado SIDCA."); }
      return;
    }
    bloqueada.current = true;
    onCodigoValido(datos);
  }, [onCodigoValido]);

  return (
    <Dialog header="Escanear certificado" visible={abierto} modal onHide={onCancelar} className="validadorScannerDialog">
      <div className="validadorScanner">
        <QrReader
          onResult={leer}
          // 400ms->120ms: el bloqueo por ref (bloqueada.current) ya impide
          // procesar un segundo QR después de uno válido, así que bajar el
          // intervalo no puede disparar doble lectura, sólo detecta antes.
          // Resolución 1280x720->960x540: de sobra para leer un QR y arranca
          // la cámara más rápido en equipos modestos; "ideal" deja que el
          // navegador negocie si el dispositivo no la soporta.
          scanDelay={120}
          constraints={{ facingMode: { ideal: "environment" }, width: { ideal: 960 }, height: { ideal: 540 } }}
          containerStyle={{ width: "100%" }}
          videoContainerStyle={{ width: "100%", height: "100%" }}
          videoStyle={{ objectFit: "cover" }}
          onError={() => setErrorCamara("No se pudo acceder a la cámara. Habilitá el permiso de cámara para continuar con la validación.")}
        />
        <span className="validadorScannerGuia" aria-hidden="true" />
      </div>
      <p className="validadorScannerTexto">Ubicá el código QR dentro del recuadro.</p>
      {aviso && <p className="validadorScannerAviso">{aviso}</p>}
      {errorCamara && <div className="validadorScannerError"><p>{errorCamara}</p><button type="button" onClick={() => setErrorCamara("")}>Reintentar cámara</button></div>}
    </Dialog>
  );
};

export default ScannerCertificadoQR;
