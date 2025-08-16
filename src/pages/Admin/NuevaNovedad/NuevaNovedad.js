import React, { useEffect, useRef, useMemo, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useParams } from 'react-router';
import { useHistory } from 'react-router-dom';
import { useForm } from '../../../hooks/useForm';
import global from '../../../assets/styles/global.module.css';
import styles from './styles.module.css';
import { nuevaNovedad, uploadNovedad, uploadImg } from '../../../redux/reducers/novedades/actions';
import Swal from 'sweetalert2';
import { Spinner } from '../../../components/Spinner/Spinner';

import { InputText } from 'primereact/inputtext';
import { InputTextarea } from 'primereact/inputtextarea';
import { Dropdown } from 'primereact/dropdown';
import { Button } from 'primereact/button';
import { FileUpload } from 'primereact/fileupload';
import { ProgressBar } from 'primereact/progressbar';

const NuevaNovedad = () => {
  const dispatch = useDispatch();
  const history = useHistory();
  const { id } = useParams();

  const initialform = {
    titulo: '',
    descripcion: '',
    link: '',
    imagen: '',
    categoria: '',
    descarga: false,
    prioridad: 0,
    departamento: '',
  };

  const novedades = useSelector(state => state.novedades);
  const [form, handleInputChange, reset] = useForm(id ? novedades.novedad : initialform);

  const [formBase, setFormBase] = useState(id ? (novedades.novedad || initialform) : initialform);
  const isDirty = useMemo(() => JSON.stringify(form) !== JSON.stringify(formBase), [form, formBase]);

  const opciones = [
    { label: 'Si', value: 'si' },
    { label: 'No', value: 'no' },
  ];

  const categorias = [
    { label: 'Turismo', value: 'turismo' },
    { label: 'Casa del Docente', value: 'casa' },
    { label: 'Predio', value: 'predio' },
    { label: 'Convenio Comercio', value: 'convenio_comercio' },
    { label: 'Convenio Hoteles', value: 'convenio_hoteles' }
  ];

  const departamentos = [
    { label: 'Ambato', value: 'Ambato' },
    { label: 'Ancasti', value: 'Ancasti' },
    { label: 'Andalgalá', value: 'Andalgalá' },
    { label: 'Antofagasta de la Sierra', value: 'Antofagasta de la Sierra' },
    { label: 'Belén', value: 'Belén' },
    { label: 'Capayán', value: 'Capayán' },
    { label: 'Capital', value: 'Capital' },
    { label: 'El Alto', value: 'El Alto' },
    { label: 'Fray Mamerto Esquiú', value: 'Fray Mamerto Esquiú' },
    { label: 'La Paz', value: 'La Paz' },
    { label: 'Paclín', value: 'Paclín' },
    { label: 'Pomán', value: 'Pomán' },
    { label: 'Santa María', value: 'Santa María' },
    { label: 'Santa Rosa', value: 'Santa Rosa' },
    { label: 'Tinogasta', value: 'Tinogasta' },
    { label: 'Valle Viejo', value: 'Valle Viejo' },
  ];

  const esConvenioComercio = form.categoria === 'convenio_comercio';

  const handleSubmit = async (e) => {
    e.preventDefault();
    if ((form.titulo || '').trim() === '' || (form.categoria || '').trim() === '') {
      Swal.fire({ title: 'Error', text: 'Titulo y categoría son campos obligatorios', icon: 'error' });
      return;
    }
    if (esConvenioComercio && !form.departamento) {
      Swal.fire({ title: 'Falta departamento', text: 'Seleccioná el departamento para Convenio Comercio.', icon: 'warning' });
      return;
    }

    const payload = {
      ...form,
      departamento: esConvenioComercio ? form.departamento : '',
    };

    if (id) {
      await dispatch(uploadNovedad(payload, novedades.novedad.id));
    } else {
      await dispatch(nuevaNovedad(payload));
    }
    history.push('/admin/novedades');
  };

  useEffect(() => {
    if (id && novedades.novedad) {
      Object.entries(novedades.novedad).forEach(([key, value]) => {
        if (key && value !== undefined) {
          handleInputChange({ target: { name: key, value } });
        }
      });
      setFormBase(novedades.novedad);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [novedades.novedad]);

  // limpiar departamento si cambia la categoría
  useEffect(() => {
    if (!esConvenioComercio && form.departamento) {
      handleInputChange({ target: { name: 'departamento', value: '' } });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.categoria]);

  // ====== Subida de imagen con validación local ======
  const fileUploader = useRef();
  const MAX_SIZE = 1_000_000; // 1MB
  const ALLOWED = ['image/png','image/jpg','image/jpeg'];

  const onUploadHandler = (e) => {
    const fileObj = e.files?.[0];
    if (!fileObj) return;

    if (!ALLOWED.includes(fileObj.type)) {
      Swal.fire({ title: 'Formato no permitido', text: 'Solo PNG, JPG o JPEG.', icon: 'error' });
      fileUploader.current?.clear();
      return;
    }
    if (fileObj.size > MAX_SIZE) {
      Swal.fire({ title: 'Archivo muy grande', text: 'El tamaño máximo es 1 MB.', icon: 'error' });
      fileUploader.current?.clear();
      return;
    }

    dispatch(uploadImg(fileObj));
    fileUploader.current?.clear();
  };

  useEffect(() => {
    if (novedades.img) {
      handleInputChange({ target: { name: 'imagen', value: novedades.img } }); // novedades.img es URL string
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [novedades.img]);

  const handleCancel = async () => {
    if (isDirty) {
      const res = await Swal.fire({
        title: 'Cancelar cambios',
        text: 'Tenés cambios sin guardar. ¿Deseás salir igualmente?',
        icon: 'question',
        showCancelButton: true,
        confirmButtonText: 'Sí, salir',
        cancelButtonText: 'Seguir editando',
        reverseButtons: true,
      });
      if (!res.isConfirmed) return;
    }
    history.push('/admin/novedades');
  };

  return (
    <div className={styles.visibleContent}>
      <div className={styles.container}>
        <form onSubmit={handleSubmit} className={styles.formAdmin}>
          <h2 className={styles.title}>{id ? 'Editar Novedad' : 'Nueva Novedad'}</h2>

          <span className={`p-float-label ${styles.inputSection}`}>
            <InputText className={styles.inputForm} value={form.titulo || ''} name="titulo" id="titulo" type="text" onChange={handleInputChange} />
            <label className={styles.labelForm} htmlFor="titulo">Titulo*</label>
          </span>

          <span className={`p-float-label ${styles.inputSection}`}>
            <InputTextarea className={styles.inputForm} name="descripcion" id="descripcion" type="text" onChange={handleInputChange} value={form.descripcion || ''} rows={3} autoResize />
            <label className={styles.labelForm} htmlFor="descripcion">Descripción*</label>
          </span>

          <span className={`p-float-label ${styles.inputSection}`}>
            <Dropdown className={styles.inputForm} inputId="categoria" value={form.categoria || ''} name='categoria' id='categoria' onChange={handleInputChange} options={categorias} placeholder="Seleccioná una categoría" />
            <label className={styles.labelForm} htmlFor="categoria">Categoría*</label>
          </span>

          {esConvenioComercio && (
            <span className={`p-float-label ${styles.inputSection}`}>
              <Dropdown
                className={styles.inputForm}
                inputId="departamento"
                value={form.departamento || ''}
                name="departamento"
                id="departamento"
                onChange={handleInputChange}
                options={departamentos}
                placeholder="Seleccioná un departamento"
                showClear
              />
              <label className={styles.labelForm} htmlFor="departamento">Departamento*</label>
            </span>
          )}

          <span className={`p-float-label ${styles.inputSection}`}>
            <InputText className={styles.inputForm} name="prioridad" id="prioridad" type="number" onChange={handleInputChange} value={form.prioridad ?? 0} />
            <label className={styles.labelForm} htmlFor="prioridad">Prioridad</label>
          </span>

          <span className={`p-float-label ${styles.inputSection}`}>
            <InputText className={styles.inputForm} value={form.link || ''} name="link" id="link" type="text" onChange={handleInputChange} />
            <label className={styles.labelForm} htmlFor="link">Link</label>
          </span>

          <span className={`p-float-label ${styles.inputSection}`}>
            <Dropdown className={styles.inputForm} inputId="descarga" value={form.descarga} name='descarga' id='descarga' onChange={handleInputChange} options={opciones} placeholder="¿Archivo descargable?" />
            <label className={styles.labelForm} htmlFor="descarga">¿Es un archivo descargable?</label>
          </span>

          <span className={`p-float-label ${styles.inputSection}`}>
            <FileUpload
              mode="basic"
              name="cargar_imagen"
              accept=".png,.jpg,.jpeg"   // 👈 Restringimos formatos
              maxFileSize={1000000}
              uploadHandler={onUploadHandler}
              customUpload
              auto
              chooseLabel={form.imagen === '' ? "Subir Imagen" : "Cambiar Imagen"}
              ref={fileUploader}
              className={global.mb_20}
            />
            {novedades.uploading && <ProgressBar value={novedades.progress} className={global.mb_20} />}

            {typeof form.imagen === 'string' && form.imagen !== '' ? (
              <img src={form.imagen} alt="imagen" className={styles.img} />
            ) : null}
          </span>

          <div className={styles.buttonsRow}>
            <Button
              type="submit"
              label={id ? 'Editar' : 'Agregar'}
              className={`p-button-raised p-button-warning ${styles.submitButton}`}
              disabled={novedades.uploading || novedades.processing}
            />
            <Button
              type="button"
              label="Cancelar"
              className={`p-button-raised p-button-secondary ${styles.cancelButton}`}
              onClick={handleCancel}
              disabled={novedades.processing}
            />
          </div>
        </form>

        {novedades.processing && <Spinner />}
      </div>
    </div>
  );
};

export default NuevaNovedad;

