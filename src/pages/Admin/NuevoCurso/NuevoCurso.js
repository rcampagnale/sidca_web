import React, { useEffect, useRef } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useParams } from 'react-router';
import { useHistory } from 'react-router-dom';
import { useForm } from '../../../hooks/useForm';
import {
  clearStatus,
  nuevoCurso,
  uploadCurso,
  uploadImg,
} from '../../../redux/reducers/cursos/actions';
import styles from './styles.module.css';
import global from '../../../assets/styles/global.module.css';
import Swal from 'sweetalert2';
import { Spinner } from '../../../components/Spinner/Spinner';

import { InputText } from 'primereact/inputtext';
import { InputTextarea } from 'primereact/inputtextarea';
import { Dropdown } from 'primereact/dropdown';
import { Button } from 'primereact/button';
import { FileUpload } from 'primereact/fileupload';
import { ProgressBar } from 'primereact/progressbar';

const NuevoCurso = () => {
  const dispatch = useDispatch();
  const history = useHistory();
  const { id } = useParams();

  const cursos = useSelector((state) => state.cursos);
  const { img, uploading, progress, processing, curso } = cursos;

  const initialform = {
    titulo: '',
    descripcion: '',
    link: '',
    imagen: '',
    estado: '',
    categoria: '',
  };

  // si hay id => editar, si no => nuevo
  const [form, handleInputChange, reset] = useForm(id ? curso : initialform);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (form.titulo === '' || form.estado === '' || form.categoria === '') {
      Swal.fire({
        title: 'Error!',
        text: 'Titulo, estado y categoría son campos obligatorios',
        icon: 'error',
        confirmButtonText: 'Ok',
      });
      return;
    }

    if (id) {
      await dispatch(uploadCurso(form, cursos.curso.id));
    } else {
      await dispatch(nuevoCurso(form));
    }

    history.push('/admin/cursos');
  };

  // 🔹 Botón Cancelar: limpio formulario + estado de cursos + vuelvo a lista
  const handleCancel = () => {
    reset();                // limpia los campos del form
    dispatch(clearStatus()); // limpia msg/status/noSubidos/subidos (y lo que tengas en CLEAR_STATUS)
    history.push('/admin/cursos');
  };

  // Cargar datos del curso cuando es edición
  useEffect(() => {
    if (id && curso) {
      Object.entries(curso).forEach(([key, value]) => {
        if (key && value !== undefined && value !== null) {
          handleInputChange({ target: { name: key, value } });
        }
      });
    }
  }, [id, curso]);

  const estados = [
    { label: 'Terminado', value: 'terminado' },
    { label: 'Inscripción Abierta', value: 'inscripcion_abierta' },
  ];

  const categorias = [
    { label: 'Nuevos', value: 'nuevos' },
    { label: '2021', value: '2021' },
    { label: '2020-2019', value: '20-19' },
  ];

  const fileUploader = useRef(null);

  const onUploadHandler = (e) => {
    const fileObj = e.files && e.files[0];
    if (!fileObj) return;

    // 🔸 dispara la subida a Firebase (PNG/JPG, etc.)
    dispatch(uploadImg(fileObj));

    // limpio el input para poder volver a subir el mismo archivo si quiero
    if (fileUploader.current) {
      fileUploader.current.clear();
    }
  };

  // 🔹 Truco: evitar que la imagen "vieja" se copie al abrir la pantalla
  // Solo queremos copiar img ➜ form.imagen cuando REALMENTE subimos algo nuevo.
  const firstImgEffect = useRef(true);

  useEffect(() => {
    // 1ª vez que se monta el componente: NO copiar img viejo
    if (firstImgEffect.current) {
      firstImgEffect.current = false;
      return;
    }

    // desde ahora, cada vez que img cambie (por un upload nuevo) sí lo copiamos
    if (img) {
      handleInputChange({ target: { name: 'imagen', value: img } });
    }
  }, [img]);

  return (
    <div className={styles.visibleContent}>
      <div className={styles.container}>
        <form onSubmit={handleSubmit} className={styles.formAdmin}>
          <h2 className={styles.title}>
            {id ? 'Editar curso' : 'Nuevo curso'}
          </h2>

          <span className={`p-float-label ${styles.inputSection}`}>
            <InputText
              className={styles.inputForm}
              value={form.titulo}
              name="titulo"
              id="titulo"
              type="text"
              onChange={handleInputChange}
            />
            <label className={styles.labelForm} htmlFor="titulo">
              Título*
            </label>
          </span>

          <span className={`p-float-label ${styles.inputSection}`}>
            <InputTextarea
              className={styles.inputForm}
              name="descripcion"
              id="descripcion"
              onChange={handleInputChange}
              value={form.descripcion}
              rows={3}
            />
            <label className={styles.labelForm} htmlFor="descripcion">
              Descripción
            </label>
          </span>

          <span className={`p-float-label ${styles.inputSection}`}>
            <Dropdown
              className={styles.inputForm}
              inputId="dropdown-estado"
              value={form.estado}
              name="estado"
              id="estado"
              onChange={handleInputChange}
              options={estados}
            />
            <label className={styles.labelForm} htmlFor="estado">
              Estado*
            </label>
          </span>

          <span className={`p-float-label ${styles.inputSection}`}>
            <Dropdown
              className={styles.inputForm}
              inputId="dropdown-categoria"
              value={form.categoria}
              name="categoria"
              id="categoria"
              onChange={handleInputChange}
              options={categorias}
            />
            <label className={styles.labelForm} htmlFor="categoria">
              Categoría*
            </label>
          </span>

          <span className={`p-float-label ${styles.inputSection}`}>
            <InputText
              className={styles.inputForm}
              value={form.link}
              name="link"
              id="link"
              type="text"
              onChange={handleInputChange}
            />
            <label className={styles.labelForm} htmlFor="link">
              Link
            </label>
          </span>

          <span className={`p-float-label ${styles.inputSection}`}>
            <FileUpload
              mode="basic"
              name="cargar_imagen"
              accept="image/*"            // PNG + JPG + otros
              maxFileSize={5 * 1024 * 1024}
              uploadHandler={onUploadHandler}
              customUpload
              auto
              chooseLabel={
                form.imagen === '' ? 'Subir Imagen' : 'Cambiar Imagen'
              }
              ref={fileUploader}
              className={global.mb_20}
            />

            {uploading && (
              <ProgressBar
                value={progress}
                className={global.mb_20}
              ></ProgressBar>
            )}

            {form.imagen !== '' && (
              <img src={form.imagen} alt="imagen" className={styles.img} />
            )}
          </span>

          {/* Botones de acción */}
          <div className={styles.buttonsRow}>
            <Button
              type="submit"
              label={id ? 'Editar' : 'Agregar'}
              className={`p-button-raised p-button-warning ${styles.submitButton}`}
            />
            <Button
              type="button"
              label="Cancelar"
              className={`p-button-raised p-button-secondary ${styles.submitButton}`}
              onClick={handleCancel}
            />
          </div>
        </form>

        {processing && <Spinner />}
      </div>
    </div>
  );
};

export default NuevoCurso;

