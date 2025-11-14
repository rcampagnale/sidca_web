// src/components/afiliados/EditAfiliadoDialog.js
import React, { useEffect, useMemo, useState } from "react";
import { Dialog } from "primereact/dialog";
import { InputText } from "primereact/inputtext";
import { InputTextarea } from "primereact/inputtextarea";
import { InputSwitch } from "primereact/inputswitch";
import { Dropdown } from "primereact/dropdown";
import { Button } from "primereact/button";
import { normalizeDescuentoInput } from "./utils/shared.js";

export default function EditAfiliadoDialog({
  visible,
  initialForm,
  departamentosOptions = [],
  onCancel,
  onSave,
  saving = false,
}) {
  const [form, setForm] = useState({
    nombre: "",
    apellido: "",
    dni: "",
    email: "",
    celular: "",
    departamento: "",
    establecimientos: "",
    descuento: "",
    nroAfiliacion: "",
    observaciones: "",
    adherente: false,
    tituloGrado: "",
    activo: true,         // 👈 NUEVO toggle Activo
  });

  useEffect(() => {
    if (!initialForm) return;

    const descuentoNorm =
      normalizeDescuentoInput(
        initialForm.descuento ??
          (typeof initialForm.cotizante === "boolean"
            ? initialForm.cotizante
              ? "si"
              : "no"
            : "")
      ) || "";

    setForm({
      nombre: initialForm.nombre ?? "",
      apellido: initialForm.apellido ?? "",
      dni: initialForm.dni ?? "",
      email: initialForm.email ?? "",
      celular: initialForm.celular ?? "",
      departamento: (initialForm.departamento ?? "").toString().trim(),
      establecimientos: initialForm.establecimientos ?? "",
      descuento: descuentoNorm,
      nroAfiliacion:
        initialForm.nroAfiliacion != null && initialForm.nroAfiliacion !== ""
          ? String(initialForm.nroAfiliacion)
          : "",
      observaciones: initialForm.observaciones ?? "",
      adherente: !!initialForm.adherente,
      tituloGrado: initialForm.tituloGrado ?? "",
      activo: typeof initialForm.activo === "boolean" ? initialForm.activo : true, // 👈 por defecto true
    });
  }, [initialForm]);

  const descuentoOptions = useMemo(
    () => [
      { label: "—", value: "" },
      { label: "Sí", value: "si" },
      { label: "No", value: "no" },
    ],
    []
  );

  const footer = (
    <div className="p-d-flex p-ai-center p-jc-end" style={{ gap: 8 }}>
      <Button label="Cancelar" className="p-button-text" onClick={onCancel} disabled={saving} />
      <Button
        label={saving ? "Guardando..." : "Guardar"}
        icon={saving ? "pi pi-spin pi-spinner" : "pi pi-check"}
        onClick={() => {
          const descuentoStr = normalizeDescuentoInput(form.descuento) || "";
          const payload = {
            nombre: form.nombre.trim(),
            apellido: form.apellido.trim(),
            dni: String(form.dni || "").trim(),
            email: form.email.trim(),
            celular: form.celular.trim(),
            departamento: form.departamento,
            establecimientos: form.establecimientos.trim(),
            nroAfiliacion:
              form.nroAfiliacion !== "" && form.nroAfiliacion != null
                ? Number(form.nroAfiliacion)
                : "",
            observaciones: form.observaciones,
            tituloGrado: form.tituloGrado,
            adherente: !!form.adherente,   // ✅ boolean real
            activo: !!form.activo,         // ✅ boolean real
            descuento: descuentoStr,       // "si" | "no" | ""
          };
          if (descuentoStr === "si") payload.cotizante = true;
          else if (descuentoStr === "no") payload.cotizante = false;

          onSave({ payload });
        }}
        disabled={saving}
      />
    </div>
  );

  return (
    <Dialog
      header="Editar afiliado"
      visible={visible}
      modal
      style={{ width: "760px", maxWidth: "95vw" }}
      onHide={onCancel}
      footer={footer}
    >
      <div className="p-fluid p-formgrid p-grid" style={{ rowGap: 10 }}>
        <div className="p-field p-col-12 p-md-6">
          <label>Nombre</label>
          <InputText value={form.nombre} onChange={(e) => setForm((f) => ({ ...f, nombre: e.target.value }))} />
        </div>
        <div className="p-field p-col-12 p-md-6">
          <label>Apellido</label>
          <InputText value={form.apellido} onChange={(e) => setForm((f) => ({ ...f, apellido: e.target.value }))} />
        </div>

        <div className="p-field p-col-12 p-md-4">
          <label>DNI</label>
          <InputText value={form.dni} onChange={(e) => setForm((f) => ({ ...f, dni: e.target.value }))} />
        </div>
        <div className="p-field p-col-12 p-md-4">
          <label>Afiliación</label>
          <InputText
            key="nroAfiliacion"
            value={form.nroAfiliacion}
            onChange={(e) => setForm((f) => ({ ...f, nroAfiliacion: e.target.value }))}
          />
        </div>
        <div className="p-field p-col-12 p-md-4">
          <label>Descuento</label>
          <Dropdown
            value={form.descuento}
            options={descuentoOptions}
            onChange={(e) => setForm((f) => ({ ...f, descuento: e.value }))}
            placeholder="—"
          />
        </div>

        <div className="p-field p-col-12 p-md-6">
          <label>Email</label>
          <InputText value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} />
        </div>
        <div className="p-field p-col-12 p-md-6">
          <label>Celular</label>
          <InputText value={form.celular} onChange={(e) => setForm((f) => ({ ...f, celular: e.target.value }))} />
        </div>

        <div className="p-field p-col-12 p-md-6">
          <label>Departamento</label>
          <Dropdown
            value={form.departamento}
            options={departamentosOptions}
            onChange={(e) => setForm((f) => ({ ...f, departamento: e.value || "" }))}
            placeholder="Seleccione…"
            showClear
          />
        </div>
        <div className="p-field p-col-12 p-md-6">
          <label>Establecimientos</label>
          <InputText
            value={form.establecimientos}
            onChange={(e) => setForm((f) => ({ ...f, establecimientos: e.target.value }))}
          />
        </div>

        <div className="p-field p-col-12">
          <label>Título de grado</label>
          <InputText value={form.tituloGrado} onChange={(e) => setForm((f) => ({ ...f, tituloGrado: e.target.value }))} />
        </div>

        <div className="p-field p-col-12">
          <label>Observaciones</label>
          <InputTextarea
            autoResize
            rows={3}
            value={form.observaciones}
            onChange={(e) => setForm((f) => ({ ...f, observaciones: e.target.value }))}
          />
        </div>

        <div className="p-field p-col-12">
          <label style={{ marginRight: 8 }}>Adherente</label>
          <InputSwitch checked={!!form.adherente} onChange={(e) => setForm((f) => ({ ...f, adherente: !!e.value }))} />
        </div>

       
      </div>
    </Dialog>
  );
}

