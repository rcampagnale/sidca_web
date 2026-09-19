import React, { useEffect, useRef, useMemo, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useParams } from 'react-router';
import { useHistory, useLocation } from 'react-router-dom';
import { useForm } from '../../../hooks/useForm';
import global from '../../../assets/styles/global.module.css';
import styles from './styles.module.css';
import { clearStatus, nuevaNovedad, uploadNovedad, uploadImg } from '../../../redux/reducers/novedades/actions';
import Swal from 'sweetalert2';
import { Spinner } from '../../../components/Spinner/Spinner';

import { InputText } from 'primereact/inputtext';
import { InputTextarea } from 'primereact/inputtextarea';
import { Dropdown } from 'primereact/dropdown';
import { MultiSelect } from 'primereact/multiselect';
import { Button } from 'primereact/button';
import { FileUpload } from 'primereact/fileupload';
import { ProgressBar } from 'primereact/progressbar';
import { departamentos as departamentosCatamarca } from '../../../constants/departamentos';

const NuevaNovedad = () => {
  const dispatch = useDispatch();
  const history = useHistory();
  const location = useLocation();
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
    departamentos: [],
    alcanceTodosDepartamentos: false,
  };

  const novedades = useSelector(state => state.novedades);
  const [form, handleInputChange, reset] = useForm(id ? novedades.novedad : initialform);
  const [departamentosSeleccionados, setDepartamentosSeleccionados] = useState([]);
  const [alcanceTodosDepartamentos, setAlcanceTodosDepartamentos] = useState(false);

  const [formBase, setFormBase] = useState(id ? (novedades.novedad || initialform) : initialform);
  const isDirty = useMemo(() => {
    const estadoActual = {
      ...form,
      departamentos: departamentosSeleccionados,
      alcanceTodosDepartamentos,
    };
    return JSON.stringify(estadoActual) !== JSON.stringify(formBase);
  }, [form, formBase, departamentosSeleccionados, alcanceTodosDepartamentos]);

  const opciones = [
    { label: 'Si', value: 'si' },
    { label: 'No', value: 'no' },
  ];

  const categoriasBase = [
    { label: 'Turismo', value: 'turismo' },
    { label: 'Casa del Docente', value: 'casa' },
    { label: 'Predio', value: 'predio' },
    { label: 'Convenio Comercio', value: 'convenio_comercio' },
    { label: 'Convenio Hoteles', value: 'convenio_hoteles' },
  ];

  const categorias = form.categoria && !categoriasBase.some((item) => item.value === form.categoria)
    ? [...categoriasBase, { label: form.categoria, value: form.categoria }]
    : categoriasBase;

  const departamentos = Object.values(departamentosCatamarca).map((nombre) => ({
    label: nombre,
    value: nombre,
  }));

  const esConvenio = ['convenio_comercio', 'convenio_hoteles'].includes(form.categoria);
  const normalizarFormulario = (novedad) => ({
    ...novedad,
    departamentos: Array.isArray(novedad?.departamentos)
      ? novedad.departamentos
      : novedad?.departamento
        ? [novedad.departamento]
        : [],
    alcanceTodosDepartamentos: novedad?.alcanceTodosDepartamentos === true,
  });

  // Helper: limpiar estado y forzar recarga de la lista
  const goToListAndHardReload = () => {
    dispatch(clearStatus());
    // Evita estado residual de Redux/inputs
    window.location.href = `/admin/novedades${location.search || ''}`;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if ((form.titulo || '').trim() === '' || (form.categoria || '').trim() === '') {
      Swal.fire({ title: 'Error', text: 'Titulo y categoría son campos obligatorios', icon: 'error' });
      return;
    }
    if (esConvenio && !alcanceTodosDepartamentos && departamentosSeleccionados.length === 0) {
      Swal.fire({
        title: 'Faltan departamentos',
        text: 'Seleccioná al menos un departamento donde está disponible el convenio.',
        icon: 'warning',
      });
      return;
    }

    const payload = {
      ...form,
      departamentos: esConvenio && !alcanceTodosDepartamentos
        ? departamentosSeleccionados
        : [],
      alcanceTodosDepartamentos: esConvenio && alcanceTodosDepartamentos,
      departamento: esConvenio && !alcanceTodosDepartamentos
        ? (departamentosSeleccionados[0] || '')
        : '',
    };

    if (id) {
      await dispatch(uploadNovedad(payload, novedades.novedad.id));
    } else {
      await dispatch(nuevaNovedad(payload));
    }

    // Recargar la página para no dejar restos
    goToListAndHardReload();
  };

  useEffect(() => {
    if (id && novedades.novedad) {
      const formularioNormalizado = normalizarFormulario(novedades.novedad);
      Object.entries(formularioNormalizado).forEach(([key, value]) => {
        if (key && value !== undefined) {
          handleInputChange({ target: { name: key, value } });
        }
      });
      setDepartamentosSeleccionados(
        formularioNormalizado.alcanceTodosDepartamentos
          ? []
          : formularioNormalizado.departamentos
      );
      setAlcanceTodosDepartamentos(formularioNormalizado.alcanceTodosDepartamentos);
      setFormBase(formularioNormalizado);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [novedades.novedad]);

  useEffect(() => {
    if (!esConvenio && (form.departamento || departamentosSeleccionados.length || alcanceTodosDepartamentos)) {
      handleInputChange({ target: { name: 'departamento', value: '' } });
      setDepartamentosSeleccionados([]);
      setAlcanceTodosDepartamentos(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.categoria]);

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

    // Subir
    dispatch(uploadImg(fileObj));
    fileUploader.current?.clear();
  };

  useEffect(() => {
    if (novedades.img) {
      handleInputChange({ target: { name: 'imagen', value: novedades.img } });
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
    // Recargar la página para no dejar restos
    goToListAndHardReload();
  };

  // Limpieza adicional al desmontar (por las dudas)
  useEffect(() => {
    return () => {
      dispatch(clearStatus());
      reset?.(); // limpia form local si tu hook lo soporta
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className={styles.visibleContent}>
      <div className={styles.container}>
        <form onSubmit={handleSubmit} className={styles.formAdmin}>
          <h2 className={styles.title}>{id ? 'Editar novedad' : 'Nueva novedad'}</h2>

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

          {esConvenio && (
            <div className={styles.departmentSection}>
              <label className={styles.departmentLabel} htmlFor="departamentos">
                Departamentos donde está disponible
              </label>
              <MultiSelect
                className={styles.inputForm}
                inputId="departamentos"
                value={departamentosSeleccionados}
                name="departamentos"
                options={departamentos}
                onChange={(event) => setDepartamentosSeleccionados(event.value || [])}
                placeholder="Seleccioná uno o más departamentos"
                display="chip"
                filter
                showClear
                disabled={alcanceTodosDepartamentos}
              />
              <label className={styles.allDepartmentsOption} htmlFor="alcanceTodosDepartamentos">
                <input
                  id="alcanceTodosDepartamentos"
                  name="alcanceTodosDepartamentos"
                  type="checkbox"
                  checked={alcanceTodosDepartamentos}
                  onChange={(event) => {
                    setAlcanceTodosDepartamentos(event.target.checked);
                    if (event.target.checked) setDepartamentosSeleccionados([]);
                  }}
                />
                Disponible en todos los departamentos
              </label>
            </div>
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
              accept=".png,.jpg,.jpeg"
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


