import React, {
  forwardRef,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import { Toast } from "primereact/toast";

import { useQRSync } from "./useQRSync";
import QRDisplayDialog from "./QRDisplayDialog";
import QRScreenRegisterDialog from "./QRScreenRegisterDialog";

const DelegadoPantallaQR = forwardRef((_, ref) => {
  const toast = useRef(null);
  const [visibleRegistro, setVisibleRegistro] = useState(false);
  const [nombrePantalla, setNombrePantalla] = useState("");

  const {
    deviceId,
    deviceName,
    sesionActual,
    qrSync,
    qrVisible,
    setQrVisible,
    downloadingQR,
    qrContainerRef,
    estaComputadoraAutorizada,
    registrarPantallaActual,
    copiarCodigo,
    downloadQRAsPNG,
  } = useQRSync({ toastRef: toast });

  useImperativeHandle(
    ref,
    () => ({
      abrirRegistro: () => {
        setNombrePantalla(deviceName || "");
        setVisibleRegistro(true);
      },
    }),
    [deviceName]
  );

  const guardarPantalla = async () => {
    try {
      const guardada = await registrarPantallaActual(nombrePantalla);
      if (guardada) setVisibleRegistro(false);
    } catch (error) {
      console.error("Registrar pantalla QR del delegado:", error);
      toast.current?.show({
        severity: "error",
        summary: "Error",
        detail: "No se pudo registrar este dispositivo como pantalla QR.",
      });
    }
  };

  return (
    <>
      <Toast ref={toast} />

      <QRScreenRegisterDialog
        visible={visibleRegistro}
        onHide={() => setVisibleRegistro(false)}
        nombrePantalla={nombrePantalla}
        setNombrePantalla={setNombrePantalla}
        deviceId={deviceId}
        onGuardar={guardarPantalla}
      />

      <QRDisplayDialog
        visible={qrVisible}
        onHide={() => setQrVisible(false)}
        sesionActual={sesionActual}
        qrSync={qrSync}
        estaComputadoraAutorizada={estaComputadoraAutorizada}
        qrContainerRef={qrContainerRef}
        onDownload={downloadQRAsPNG}
        downloadingQR={downloadingQR}
        onCopiarCodigo={copiarCodigo}
      />
    </>
  );
});

DelegadoPantallaQR.displayName = "DelegadoPantallaQR";

export default DelegadoPantallaQR;
