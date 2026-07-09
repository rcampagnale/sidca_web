import React, {
  forwardRef,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from "react";
import { Toast } from "primereact/toast";

import { useQRSync } from "./useQRSync";
import QRDisplayDialog from "./QRDisplayDialog";
import QRScreenRegisterDialog from "./QRScreenRegisterDialog";

const limpiarTexto = (valor) => String(valor || "").trim();

const construirNombreDelegado = (delegado, usuarioSesion) => {
  const candidatos = [
    delegado?.apellidoNombre,
    delegado?.nombreCompleto,
    delegado?.displayName,
    [delegado?.apellido, delegado?.nombre].filter(Boolean).join(", "),
    [delegado?.apellidos, delegado?.nombres].filter(Boolean).join(", "),
    usuarioSesion?.apellidoNombre,
    usuarioSesion?.nombreCompleto,
    usuarioSesion?.displayName,
    [usuarioSesion?.apellido, usuarioSesion?.nombre].filter(Boolean).join(", "),
    [usuarioSesion?.profile?.apellido, usuarioSesion?.profile?.nombre]
      .filter(Boolean)
      .join(", "),
    usuarioSesion?.user?.displayName,
  ];

  return limpiarTexto(candidatos.find((valor) => limpiarTexto(valor))) || "";
};

const DelegadoPantallaQR = forwardRef(({ delegado, usuarioSesion }, ref) => {
  const toast = useRef(null);
  const [visibleRegistro, setVisibleRegistro] = useState(false);
  const [nombrePantalla, setNombrePantalla] = useState("");

  const nombreDelegado = useMemo(
    () => construirNombreDelegado(delegado, usuarioSesion),
    [delegado, usuarioSesion]
  );

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
        setNombrePantalla(nombreDelegado || deviceName || "");
        setVisibleRegistro(true);
      },
    }),
    [deviceName, nombreDelegado]
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
        nombreAutomatico
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
