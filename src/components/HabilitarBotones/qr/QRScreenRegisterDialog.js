// src/components/HabilitarBotones/qr/QRScreenRegisterDialog.js

import React from "react";
import { Button } from "primereact/button";
import { Dialog } from "primereact/dialog";
import { InputText } from "primereact/inputtext";
import styles from "./qr.module.css";

const QRScreenRegisterDialog = ({
  visible,
  onHide,
  nombrePantalla,
  setNombrePantalla,
  deviceId,
  onGuardar,
}) => {
  return (
    <Dialog
      header="Registrar este dispositivo como pantalla QR"
      visible={visible}
      style={{ width: 560, maxWidth: "95vw" }}
      modal
      onHide={onHide}
    >
      <div className={styles.formGrid}>
        <div className={styles.formRowFull}>
          <label>Nombre de este dispositivo</label>
          <InputText
            value={nombrePantalla}
            onChange={(e) => setNombrePantalla(e.target.value)}
            placeholder="Ej: Celular delegado, Pantalla Salón, Notebook Secretaría"
          />
          <small className={styles.helpText}>
            Solo los dispositivos registrados y autorizados abrirán el QR automáticamente.
            Los demás celulares y computadoras seguirán trabajando normalmente.
          </small>
        </div>

        <div className={styles.infoBox}>
          <strong>ID de este dispositivo:</strong>
          <span>{deviceId || "Generando identificador..."}</span>
        </div>
      </div>

      <div className={styles.dialogActions}>
        <Button
          label="Guardar pantalla"
          icon="pi pi-save"
          severity="success"
          onClick={onGuardar}
        />

        <Button
          label="Cancelar"
          icon="pi pi-times"
          severity="danger"
          onClick={onHide}
        />
      </div>
    </Dialog>
  );
};

export default QRScreenRegisterDialog;
