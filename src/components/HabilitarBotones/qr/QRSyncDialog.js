// src/components/HabilitarBotones/qr/QRSyncDialog.js

import React, { useEffect, useState } from "react";
import { Button } from "primereact/button";
import { Dialog } from "primereact/dialog";
import { InputSwitch } from "primereact/inputswitch";
import { formatFechaHoraAR } from "./qrUtils.js";
import styles from "./qr.module.css";

const QRSyncDialog = ({
  visible,
  onHide,
  pantallasArray,
  deviceId,
  estaComputadoraRegistrada,
  sesionActual,
  asistenciaConfig,
  qrSync,
  onGuardarSeleccion,
  onActivarSync,
  onCerrarQRPantallas,
  onBorrarPantalla,
}) => {
  const [pantallasSeleccionadas, setPantallasSeleccionadas] = useState([]);

  useEffect(() => {
    if (visible) {
      setPantallasSeleccionadas(qrSync?.pantallasAutorizadas || []);
    }
  }, [visible, qrSync?.pantallasAutorizadas]);

  const togglePantalla = (id) => {
    setPantallasSeleccionadas((prev) => {
      if (prev.includes(id)) return prev.filter((x) => x !== id);
      return [...prev, id];
    });
  };

  const guardar = async () => {
    await onGuardarSeleccion(pantallasSeleccionadas);
  };

  const activar = async () => {
    await onActivarSync(pantallasSeleccionadas);
    onHide();
  };

  const cerrar = async () => {
    await onCerrarQRPantallas(pantallasSeleccionadas);
  };

  const borrar = async (id) => {
    await onBorrarPantalla(id, pantallasSeleccionadas);
    setPantallasSeleccionadas((prev) => prev.filter((x) => x !== id));
  };

  return (
    <Dialog
      header="Sincronización automática de QR"
      visible={visible}
      style={{ width: 780, maxWidth: "95vw" }}
      modal
      onHide={onHide}
    >
      <div className={styles.syncResumen}>
        <div>
          <strong>Estado:</strong>{" "}
          {qrSync?.habilitada ? (
            <span className={styles.badgeSuccess}>Activa</span>
          ) : (
            <span className={styles.badgeNeutral}>Inactiva</span>
          )}
        </div>

        <div>
          <strong>Sesión:</strong>{" "}
          {sesionActual?.id ? (
            <span className={styles.badgeSuccess}>Abierta</span>
          ) : (
            <span className={styles.badgeNeutral}>Sin sesión QR</span>
          )}
        </div>

        <div>
          <strong>Curso:</strong>{" "}
          {sesionActual?.cursoTitulo || asistenciaConfig?.cursoTitulo || "—"}
        </div>

        <div>
          <strong>Esta computadora:</strong>{" "}
          {estaComputadoraRegistrada ? (
            <span className={styles.badgeSuccess}>Registrada</span>
          ) : (
            <span className={styles.badgeWarn}>No registrada</span>
          )}
        </div>
      </div>

      <div className={styles.helpPanel}>
        Las pantallas seleccionadas abrirán el QR automáticamente cuando actives la
        sincronización. Si otro empleado usa la web en una PC no registrada como pantalla QR,
        no se le abrirá nada.
      </div>

      <h4 className={styles.sectionTitle}>Pantallas registradas</h4>

      {pantallasArray.length === 0 ? (
        <div className={styles.emptyBox}>
          No hay pantallas registradas. Abrí la web en cada computadora secundaria y presioná
          “Registrar esta PC como pantalla QR”.
        </div>
      ) : (
        <div className={styles.pantallasGrid}>
          {pantallasArray.map((pantalla) => {
            const checked = pantallasSeleccionadas.includes(pantalla.id);
            const esEstaPc = pantalla.id === deviceId;

            return (
              <div
                key={pantalla.id}
                className={`${styles.pantallaCard} ${
                  checked ? styles.pantallaCardSelected : ""
                }`}
              >
                <div className={styles.pantallaTop}>
                  <div>
                    <strong>{pantalla.nombre}</strong>
                    {esEstaPc && <span className={styles.badgeInfo}>Esta PC</span>}
                  </div>

                  <InputSwitch checked={checked} onChange={() => togglePantalla(pantalla.id)} />
                </div>

                <small>ID: {pantalla.id}</small>
                <small>Último acceso: {formatFechaHoraAR(pantalla.ultimoAcceso)}</small>

                <div className={styles.pantallaActions}>
                  <Button
                    label="Quitar"
                    icon="pi pi-trash"
                    severity="danger"
                    text
                    onClick={() => borrar(pantalla.id)}
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div className={styles.dialogActions}>
        <Button
          label="Guardar selección"
          icon="pi pi-save"
          severity="secondary"
          onClick={guardar}
          disabled={pantallasArray.length === 0}
        />

        <Button
          label="Activar y abrir QR en pantallas"
          icon="pi pi-play"
          severity="success"
          onClick={activar}
          disabled={
            !sesionActual?.id ||
            sesionActual?.estado !== "abierta" ||
            pantallasSeleccionadas.length === 0
          }
        />

        <Button
          label="Cerrar QR en pantallas"
          icon="pi pi-times"
          severity="warning"
          onClick={cerrar}
          disabled={pantallasSeleccionadas.length === 0}
        />

        <Button label="Cerrar" icon="pi pi-times" severity="danger" onClick={onHide} />
      </div>
    </Dialog>
  );
};

export default QRSyncDialog;