import React from "react";
import { Button } from "primereact/button";
import { Dialog } from "primereact/dialog";
import { InputText } from "primereact/inputtext";
import { InputTextarea } from "primereact/inputtextarea";
import { InputSwitch } from "primereact/inputswitch";
import styles from "../../pages/Admin/Servicios/servicios.module.css";

const ServicioFormDialog = ({
  visible,
  servicioEditando,
  form,
  guardando,
  onHide,
  onChange,
  onGuardar,
}) => {
  const dialogFooter = (
    <div className={styles.dialogFooter}>
      <Button
        label="Cancelar"
        icon="pi pi-times"
        className="p-button-secondary"
        onClick={onHide}
        disabled={guardando}
      />

      <Button
        label={servicioEditando ? "Actualizar servicio" : "Guardar servicio"}
        icon="pi pi-save"
        className="p-button-success"
        onClick={onGuardar}
        loading={guardando}
      />
    </div>
  );

  return (
    <Dialog
      header={servicioEditando ? "Editar servicio" : "Nuevo servicio"}
      visible={visible}
      style={{ width: "620px", maxWidth: "95vw" }}
      modal
      footer={dialogFooter}
      onHide={onHide}
    >
      <div className={styles.formGrid}>
        <div className={styles.formRow}>
          <label>Nombre del servicio *</label>
          <InputText
            value={form.nombre}
            onChange={(e) => onChange("nombre", e.target.value)}
            placeholder="Ej: Cena del docente"
            disabled={guardando}
          />
        </div>

        <div className={styles.formRow}>
          <label>Descripción</label>
          <InputTextarea
            value={form.descripcion}
            onChange={(e) => onChange("descripcion", e.target.value)}
            placeholder="Ej: Cena del docente financiada en cuotas"
            rows={3}
            autoResize
            disabled={guardando}
          />
        </div>

        <div className={styles.formTwoColumns}>
          <div className={styles.formRow}>
            <label>Cantidad de cuotas *</label>
            <InputText
              value={form.cantidadCuotas}
              onChange={(e) =>
                onChange("cantidadCuotas", e.target.value.replace(/\D/g, ""))
              }
              placeholder="Ej: 9"
              inputMode="numeric"
              disabled={guardando}
            />
          </div>

          <div className={styles.formRow}>
            <label>Valor de cada cuota *</label>
            <InputText
              value={form.valorCuota}
              onChange={(e) => onChange("valorCuota", e.target.value)}
              placeholder="Ej: 15000"
              inputMode="decimal"
              disabled={guardando}
            />
          </div>
        </div>

        <div className={styles.switchGrid}>
          <div className={styles.switchItem}>
            <div>
              <strong>Servicio activo</strong>
              <small>Permite asignarlo a afiliados.</small>
            </div>

            <InputSwitch
              checked={form.activo}
              onChange={(e) => onChange("activo", e.value)}
              disabled={guardando}
            />
          </div>

          <div className={styles.switchItem}>
            <div>
              <strong>Visible en app</strong>
              <small>Más adelante el afiliado podrá verlo desde la app.</small>
            </div>

            <InputSwitch
              checked={form.visibleEnApp}
              onChange={(e) => onChange("visibleEnApp", e.value)}
              disabled={guardando}
            />
          </div>
        </div>
      </div>
    </Dialog>
  );
};

export default ServicioFormDialog;