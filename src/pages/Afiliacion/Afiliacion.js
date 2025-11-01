// src/pages/Afiliacion/Afiliacion.js
import React, { useRef, useEffect, useMemo, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useHistory } from 'react-router-dom';
import { InputText } from 'primereact/inputtext';
import { Button } from 'primereact/button';
import { Checkbox } from 'primereact/checkbox';
import { Dropdown } from 'primereact/dropdown';
import { Card } from 'primereact/card';
import { Toast } from 'primereact/toast';
import { classNames } from 'primereact/utils';
import { useFormik } from 'formik';
import { Dialog } from 'primereact/dialog';
import { InputTextarea } from 'primereact/inputtextarea';

import { Spinner } from '../../components/Spinner/Spinner';
import { afiliacion, clearStatus } from '../../redux/reducers/afiliados/actions';
import { departamentos } from '../../constants/departamentos';
import styles from './styles.module.scss';
import PublicHeader from '../../components/Layout/Header/PublicHeader/PublicHeader';

const PLAY_STORE_URL = 'https://play.google.com/store/apps/details?id=com.jakiro12.one&pcampaignid=web_share';

// —————————— Helpers de mensaje ——————————
const buildShareText = ({ nombre, apellido, dni }) => {
  const fullName = [nombre, apellido].filter(Boolean).join(' ');
  return (
`¡Afiliación exitosa a SiDCa! ✅

${fullName ? `Titular: ${fullName}\n` : ''}DNI: ${dni}

Descargá la app desde Play Store:
${PLAY_STORE_URL}

Ya podés ingresar a tu cuenta usando tu DNI.`
  );
};

const Afiliacion = () => {
  const dispatch = useDispatch();
  const history = useHistory();
  const afiliado = useSelector(state => state.afiliado);

  const toast = useRef(null);
  const firstInputRef = useRef(null);

  const dptos = useMemo(
    () => Object.entries(departamentos).map(([key, value]) => ({ label: value, value: key })),
    []
  );

  // Estado del diálogo de éxito
  const [showSuccessDialog, setShowSuccessDialog] = useState(false);

  // Estado para (si querés) mostrar el texto editable dentro del diálogo
  const [dniShare, setDniShare] = useState('');
  const [shareMsg, setShareMsg] = useState('');

  const INITIAL_VALUES = {
    nombre: '',
    apellido: '',
    dni: '',
    email: '',
    celular: '',
    tituloGrado: '',
    departamento: '',
    establecimientos: '',
    descuento: false
  };

  const formik = useFormik({
    initialValues: INITIAL_VALUES,
    validate: (data) => {
      let errors = {};
      if (!data.nombre) errors.nombre = 'El nombre es requerido.';
      if (!data.apellido) errors.apellido = 'El apellido es requerido.';
      if (!data.dni) errors.dni = 'El DNI es requerido.';
      if (!data.celular) errors.celular = 'El celular es requerido.';
      if (!data.departamento) errors.departamento = 'El departamento es requerido.';
      if (!data.email) {
        errors.email = 'El Email es requerido.';
      } else if (!/^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,4}$/i.test(data.email)) {
        errors.email = 'Dirección de Email inválida. Ej: su@email.com';
      }
      // ——— Requerido: Título de grado ———
      if (!data.tituloGrado || !data.tituloGrado.trim()) {
        errors.tituloGrado = 'El título de grado (nombre de la carrera) es requerido.';
      }
      // ——— Requerido: Descuento ———
      if (!data.descuento) {
        errors.descuento = 'Debes autorizar el descuento para continuar.';
      }
      return errors;
    },
    onSubmit: (data) => {
      const clean = {
        ...data,
        tituloGrado: data.tituloGrado.trim(),
      };
      dispatch(afiliacion(clean));
    }
  });

  const isFormFieldValid = (name) => !!(formik.touched[name] && formik.errors[name]);
  const getFormErrorMessage = (name) =>
    isFormFieldValid(name) && <small className="p-error">{formik.errors[name]}</small>;

  // —————————— Reiniciar pantalla para nueva carga ——————————
  const resetAfiliacionScreen = () => {
    formik.resetForm({ values: INITIAL_VALUES });
    setShowSuccessDialog(false);
    setDniShare('');
    setShareMsg('');
    dispatch(clearStatus());
    setTimeout(() => firstInputRef.current?.focus(), 0);
  };

  // —————————— Éxito / Error ——————————
  useEffect(() => {
    if (afiliado.status === 'SUCCESS_AF') {
      toast.current?.show({ severity: 'success', summary: '¡Afiliación exitosa!', detail: afiliado.msg, life: 3500 });

      const mensaje = buildShareText({
        nombre: formik.values.nombre,
        apellido: formik.values.apellido,
        dni: formik.values.dni
      });
      setDniShare(formik.values.dni);
      setShareMsg(mensaje);

      setShowSuccessDialog(true);
      dispatch(clearStatus());
    }

    if (afiliado.status === 'FAILURE_AF') {
      toast.current?.show({ severity: 'error', summary: 'Hubo un error', detail: afiliado.msg, life: 5000 });
      dispatch(clearStatus());
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [afiliado.status]);

  // —————————— Acciones del diálogo ——————————
  const handleDownloadAndReset = () => {
    window.open(PLAY_STORE_URL, '_blank', 'noopener,noreferrer');
    resetAfiliacionScreen();
  };

  const handleCloseDialog = () => {
    resetAfiliacionScreen();
  };

  const successFooter = (
    <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
      <Button label="Descargar la App" icon="pi pi-download" onClick={handleDownloadAndReset} />
      <Button label="Cerrar" icon="pi pi-times" className="p-button-text" onClick={handleCloseDialog} />
    </div>
  );

  return (
    <div className={styles.visibleContent} style={{ paddingTop: "70px" }}>
      <PublicHeader />
      <Toast ref={toast} />
      <Card title="Formulario de Afiliación a SiDCa" style={styles.container}>
        <form onSubmit={formik.handleSubmit} className="p-fluid p-mt-10">

          {/* Nombre */}
          <div className={styles.inputSection}>
            <span className="p-float-label">
              <InputText
                ref={firstInputRef}
                className={classNames({ 'p-invalid': isFormFieldValid('nombre') })}
                value={formik.values.nombre}
                name="nombre"
                id="nombre"
                type="text"
                onChange={formik.handleChange}
              />
              <label className={classNames({ 'p-error': isFormFieldValid('nombre') })} htmlFor="nombre">Nombre*</label>
            </span>
            {getFormErrorMessage('nombre')}
          </div>

          {/* Apellido */}
          <div className={styles.inputSection}>
            <span className="p-float-label">
              <InputText
                className={classNames({ 'p-invalid': isFormFieldValid('apellido') })}
                value={formik.values.apellido}
                name="apellido"
                id="apellido"
                type="text"
                onChange={formik.handleChange}
              />
              <label className={classNames({ 'p-error': isFormFieldValid('apellido') })} htmlFor="apellido">Apellido*</label>
            </span>
            {getFormErrorMessage('apellido')}
          </div>

          {/* DNI */}
          <div className={styles.inputSection}>
            <span className="p-float-label">
              <InputText
                className={classNames({ 'p-invalid': isFormFieldValid('dni') })}
                value={formik.values.dni}
                name="dni"
                id="dni"
                type="text"
                onChange={formik.handleChange}
                maxLength={8}
              />
              <label className={classNames({ 'p-error': isFormFieldValid('dni') })} htmlFor="dni">DNI*</label>
            </span>
            {getFormErrorMessage('dni')}
          </div>

          {/* Email */}
          <div className={styles.inputSection}>
            <span className="p-float-label">
              <InputText
                className={classNames({ 'p-invalid': isFormFieldValid('email') })}
                value={formik.values.email}
                name="email"
                id="email"
                type="text"
                onChange={formik.handleChange}
              />
              <label className={classNames({ 'p-error': isFormFieldValid('email') })} htmlFor="email">Email*</label>
            </span>
            {getFormErrorMessage('email')}
          </div>

          {/* Celular */}
          <div className={styles.inputSection}>
            <span className="p-float-label">
              <InputText
                className={classNames({ 'p-invalid': isFormFieldValid('celular') })}
                value={formik.values.celular}
                name="celular"
                id="celular"
                type="text"
                onChange={formik.handleChange}
              />
              <label className={classNames({ 'p-error': isFormFieldValid('celular') })} htmlFor="celular">Celular*</label>
            </span>
            {getFormErrorMessage('celular')}
          </div>

          {/* ——— OBLIGATORIO: Título de grado ——— */}
          <div className={styles.inputSection}>
            <span className="p-float-label">
              <InputText
                className={classNames({ 'p-invalid': isFormFieldValid('tituloGrado') })}
                value={formik.values.tituloGrado}
                name="tituloGrado"
                id="tituloGrado"
                type="text"
                onChange={formik.handleChange}
                required
                aria-required="true"
              />
              <label
                className={classNames({ 'p-error': isFormFieldValid('tituloGrado') })}
                htmlFor="tituloGrado"
              >
                Título de grado (nombre de la carrera)*
              </label>
            </span>
            {getFormErrorMessage('tituloGrado')}
          </div>

          {/* Departamento */}
          <div className={styles.inputSection}>
            <span className="p-float-label">
              <Dropdown
                className={classNames({ 'p-invalid': isFormFieldValid('departamento') })}
                inputId="dropdown"
                value={formik.values.departamento}
                name="departamento"
                id="departamento"
                onChange={formik.handleChange}
                options={dptos}
              />
              <label className={classNames({ 'p-error': isFormFieldValid('departamento') })} htmlFor="departamento">
                Departamento (domicilio real)*
              </label>
            </span>
            {getFormErrorMessage('departamento')}
          </div>

          {/* Establecimientos */}
          <div className={styles.inputSection}>
            <span className="p-float-label">
              <InputText
                className={classNames({ 'p-invalid': isFormFieldValid('establecimientos') })}
                value={formik.values.establecimientos}
                name="establecimientos"
                id="establecimientos"
                type="text"
                onChange={formik.handleChange}
              />
              <label className={classNames({ 'p-error': isFormFieldValid('establecimientos') })} htmlFor="establecimientos">Establecimientos</label>
            </span>
          </div>

          {/* Descuento (OBLIGATORIO) */}
          <div className={styles.inputSection}>
            <div className={`field-checkbox ${styles.inputSection}`}>
              <Checkbox
                name="descuento"
                inputId="descuento"
                checked={formik.values.descuento}
                onChange={(e) => {
                  formik.setFieldValue('descuento', e.checked);
                  formik.setFieldTouched('descuento', true, true);
                }}
                className={classNames({ 'p-invalid': isFormFieldValid('descuento') })}
                required
                aria-required="true"
                aria-invalid={isFormFieldValid('descuento')}
                aria-describedby="descuento_error"
              />
              <label
                htmlFor="descuento"
                style={{ marginLeft: 10 }}
                className={classNames({ 'p-error': isFormFieldValid('descuento') })}
              >
                Autorizo realizar descuentos de mis haberes en concepto de cuotas y/o servicios sociales
                <span aria-hidden="true"> *</span>
              </label>
            </div>
            {isFormFieldValid('descuento') && (
              <small id="descuento_error" className="p-error">
                {formik.errors.descuento}
              </small>
            )}
          </div>

          <Button type="submit" label="AFILIARME" className="mt-2" />
        </form>
      </Card>

      {afiliado.processing && <Spinner />}

      {/* ——— Diálogo de éxito minimalista ——— */}
      <Dialog
        header="¡Afiliación exitosa!"
        visible={showSuccessDialog}
        style={{ width: 'min(620px, 96vw)' }}
        modal
        onHide={handleCloseDialog}
        footer={successFooter}
      >
        <div className="p-message p-message-success" role="alert" style={{ padding: 12, marginBottom: 12 }}>
          <span className="p-message-text">
            Ya podés <b>descargar la App</b> e <b>ingresar a tu cuenta usando tu DNI</b>.
          </span>
        </div>
      </Dialog>
    </div>
  );
};

export default Afiliacion;
