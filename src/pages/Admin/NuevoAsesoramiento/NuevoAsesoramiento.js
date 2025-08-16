import React, { useEffect, useRef, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { useParams } from "react-router";
import { useHistory } from "react-router-dom";
import { useForm } from "../../../hooks/useForm";
import global from "../../../assets/styles/global.module.css";
import styles from "./styles.module.css";
import {
  clearStatus,
  nuevoAsesoramiento,
  uploadAsesoramiento,
  uploadImg,
  uploadPdf, // <-- necesitamos esta acción para subir el PDF
} from "../../../redux/reducers/asesoramiento/actions";
import Swal from "sweetalert2";
import { Spinner } from "../../../components/Spinner/Spinner";

import { InputText } from "primereact/inputtext";
import { InputTextarea } from "primereact/inputtextarea";
import { Dropdown } from "primereact/dropdown";
import { Button } from "primereact/button";
import { FileUpload } from "primereact/fileupload";
import { ProgressBar } from "primereact/progressbar";

const NuevoAsesoramiento = () => {
  const dispatch = useDispatch();
  const { id } = useParams();
  const history = useHistory();

  const asesoramiento = useSelector((state) => state.asesoramiento);

  const initialform = {
  titulo: '',
  descripcion: '',
  categoria: '',
  estado: 'activo',
  imagen: '',
  pdf: '',        // <--- ahora usamos pdf
  // link: '',    // opcional: ya no se edita
  descarga: 'no',
  prioridad: 0,
};


  const [form, handleInputChange, reset] = useForm(
    id ? asesoramiento.asesoramiento : initialform
  );

  // Para detectar si hubo cambios (para el botón Cancelar)
  const [dirty, setDirty] = useState(false);
  const markDirty = () => setDirty(true);

  // ---- Handlers de subida ----
  const fileUploaderImg = useRef();
  const fileUploaderPdf = useRef();

  const onUploadImgHandler = (e) => {
    const fileObj = e.files?.[0];
    if (!fileObj) return;
    dispatch(uploadImg(fileObj));
    fileUploaderImg.current?.clear();
  };

  const onUploadPdfHandler = (e) => {
    const fileObj = e.files?.[0];
    if (!fileObj) return;
    if (fileObj.type !== "application/pdf") {
      Swal.fire({
        title: "Formato inválido",
        text: "Solo se permite PDF.",
        icon: "warning",
        confirmButtonText: "Ok",
      });
      fileUploaderPdf.current?.clear();
      return;
    }
    dispatch(uploadPdf(fileObj));
    fileUploaderPdf.current?.clear();
  };

  // Actualizar form.imagen cuando termine la subida de imagen
  useEffect(() => {
    if (asesoramiento.img) {
      handleInputChange({
        target: { name: "imagen", value: asesoramiento.img },
      });
      setDirty(true);
    }
  }, [asesoramiento.img]); // eslint-disable-line react-hooks/exhaustive-deps

  // Actualizar form.link cuando termine la subida de PDF
  // NuevoAsesoramiento.jsx
  // al subir PDF (desde Redux):
useEffect(() => {
  if (asesoramiento.pdf) {
    handleInputChange({ target: { name: 'pdf', value: asesoramiento.pdf } });
  }
}, [asesoramiento.pdf]); // eslint-disable-line

// en modo edición, precargar:
useEffect(() => {
  if (id && asesoramiento.asesoramiento) {
    Object.entries(asesoramiento.asesoramiento).forEach(([key, value]) => {
      if (key) handleInputChange({ target: { name: key, value } });
    });
    // compatibilidad: si no trae pdf pero sí link, usar link como pdf
    const legacyLink = asesoramiento.asesoramiento?.link;
    if (!asesoramiento.asesoramiento?.pdf && typeof legacyLink === 'string' && legacyLink.trim()) {
      handleInputChange({ target: { name: 'pdf', value: legacyLink } });
    }
  }
}, [id, asesoramiento.asesoramiento]); // eslint-disable-line

  const opcionesDescarga = [
    { label: "Si", value: "si" },
    { label: "No", value: "no" },
  ];

  const categorias = [
    { label: "Legal | Leyes", value: "leyes" },
    { label: "Legal | Decretos", value: "decretos" },
    { label: "Legal | Resolución", value: "resoluciones" },
    { label: "Legal | Otros", value: "otros" },
    { label: "Gremial | Paritarias", value: "paritarias" },
    { label: "Gremial | Escala Salarial", value: "escala_salarial" },
    { label: "Gremial | Novedades", value: "novedades" },
  ];

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!form.titulo?.trim() || !form.categoria) {
      Swal.fire({
        title: "Error",
        text: "Título y Categoría son obligatorios.",
        icon: "error",
        confirmButtonText: "Ok",
      });
      return;
    }

    // Si marcó "descarga = si", exigimos PDF
    if (form.descarga === "si" && !form.link) {
      Swal.fire({
        title: "PDF requerido",
        text: "Marcaste como descargable. Debes subir un PDF.",
        icon: "warning",
        confirmButtonText: "Ok",
      });
      return;
    }

    if (id) {
      await dispatch(uploadAsesoramiento(form, asesoramiento.asesoramiento.id));
    } else {
      await dispatch(nuevoAsesoramiento(form));
    }
    history.push("/admin/asesoramiento");
  };

  const handleCancel = async () => {
    if (!dirty) {
      history.push("/admin/asesoramiento");
      return;
    }
    const result = await Swal.fire({
      title: "Cancelar cambios",
      text: "Hay cambios sin guardar. ¿Deseas salir igualmente?",
      icon: "question",
      showCancelButton: true,
      confirmButtonText: "Sí, salir",
      cancelButtonText: "Seguir editando",
      reverseButtons: true,
    });
    if (result.isConfirmed) {
      history.push("/admin/asesoramiento");
    }
  };

  // Cuando se cambian inputs, marcamos el formulario como sucio
  const onChangeWithDirty = (e) => {
    markDirty();
    handleInputChange(e);
  };

  return (
    <div className={styles.visibleContent}>
      <div className={styles.container}>
        <form onSubmit={handleSubmit} className={styles.formAdmin}>
          <h2 className={styles.title}>
            {id ? "Editar asesoramiento" : "Nuevo asesoramiento"}
          </h2>

          {/* Título */}
          <span className={`p-float-label ${styles.inputSection}`}>
            <InputText
              className={styles.inputForm}
              value={form.titulo}
              name="titulo"
              id="titulo"
              type="text"
              onChange={onChangeWithDirty}
            />
            <label className={styles.labelForm} htmlFor="titulo">
              Titulo*
            </label>
          </span>

          {/* Descripción */}
          <span className={`p-float-label ${styles.inputSection}`}>
            <InputTextarea
              className={styles.inputForm}
              name="descripcion"
              id="descripcion"
              type="text"
              onChange={onChangeWithDirty}
              value={form.descripcion}
              rows={3}
            />
            <label className={styles.labelForm} htmlFor="descripcion">
              Descripción
            </label>
          </span>

          {/* Categoría */}
          <span className={`p-float-label ${styles.inputSection}`}>
            <Dropdown
              className={styles.inputForm}
              inputId="categoria"
              value={form.categoria}
              name="categoria"
              id="categoria"
              onChange={onChangeWithDirty}
              options={categorias}
              optionLabel="label"
              optionValue="value"
              placeholder="Seleccionar..."
            />
            <label className={styles.labelForm} htmlFor="categoria">
              Categoría*
            </label>
          </span>

          {/* Prioridad */}
          <span className={`p-float-label ${styles.inputSection}`}>
            <InputText
              className={styles.inputForm}
              name="prioridad"
              id="prioridad"
              type="number"
              onChange={onChangeWithDirty}
              value={form.prioridad}
            />
            <label className={styles.labelForm} htmlFor="prioridad">
              Prioridad
            </label>
          </span>

          {/* Descargable */}
          <span className={`p-float-label ${styles.inputSection}`}>
            <Dropdown
              className={styles.inputForm}
              inputId="descarga"
              value={form.descarga}
              name="descarga"
              id="descarga"
              onChange={onChangeWithDirty}
              options={opcionesDescarga}
              optionLabel="label"
              optionValue="value"
              placeholder="Seleccionar..."
            />
            <label className={styles.labelForm} htmlFor="descarga">
              ¿Es un archivo descargable?
            </label>
          </span>

          {/* PDF (reemplaza el input de link) */}
          <div className={styles.inputSection}>
            <label className={styles.labelTop}>Archivo PDF</label>
            <FileUpload
              mode="basic"
              name="cargar_pdf"
              accept="application/pdf"
              maxFileSize={20 * 1024 * 1024} // 20MB
              uploadHandler={onUploadPdfHandler}
              customUpload
              auto
              chooseLabel={form.link ? "Cambiar PDF" : "Subir PDF"}
              ref={fileUploaderPdf}
              className={global.mb_20}
            />
            {asesoramiento.uploading && (
              <ProgressBar
                value={asesoramiento.progress}
                className={global.mb_20}
              />
            )}
            {form.link && (
              <div className={styles.fileInfo}>
                <i className="pi pi-file-pdf" style={{ marginRight: 8 }} />
                <a href={form.link} target="_blank" rel="noopener noreferrer">
                  Ver PDF
                </a>
              </div>
            )}
          </div>

          {/* Imagen (opcional) */}
          <div className={styles.inputSection}>
            <label className={styles.labelTop}>Imagen (opcional)</label>
            <FileUpload
              mode="basic"
              name="cargar_imagen"
              accept="image/*"
              maxFileSize={2 * 1024 * 1024} // 2MB
              uploadHandler={onUploadImgHandler}
              customUpload
              auto
              chooseLabel={form.imagen ? "Cambiar Imagen" : "Subir Imagen"}
              ref={fileUploaderImg}
              className={global.mb_20}
            />
            {asesoramiento.uploading && (
              <ProgressBar
                value={asesoramiento.progress}
                className={global.mb_20}
              />
            )}
            {form.imagen && (
              <img src={form.imagen} alt="imagen" className={styles.img} />
            )}
          </div>

          {/* Botones de acción */}
          <div className={styles.actionsRow}>
            <Button
              type="button"
              label="Cancelar"
              className="p-button-outlined p-button-secondary"
              onClick={handleCancel}
            />
            <Button
              type="submit"
              label={id ? "Guardar cambios" : "Agregar"}
              className={`p-button-raised p-button-warning ${styles.submitButton}`}
            />
          </div>
        </form>

        {asesoramiento.processing && <Spinner />}
      </div>
    </div>
  );
};

export default NuevoAsesoramiento;
