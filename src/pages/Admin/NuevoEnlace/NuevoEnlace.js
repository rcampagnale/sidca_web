import React, { useEffect, useMemo } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useHistory } from 'react-router-dom';
import { useParams } from 'react-router';
import { useForm } from '../../../hooks/useForm';
import { clearStatus, nuevoEnlace, uploadEnlace } from '../../../redux/reducers/enlaces/actions';
import styles from './styles.module.css';
import Swal from 'sweetalert2';
import { Spinner } from '../../../components/Spinner/Spinner';

import { InputText } from 'primereact/inputtext';
import { InputTextarea } from 'primereact/inputtextarea';
import { Button } from 'primereact/button';

const NuevoEnlace = () => {
  const dispatch = useDispatch();
  const history = useHistory();
  const { id } = useParams();

  const initialform = { titulo: '', descripcion: '', link: '', prioridad: '' };
  const enlace = useSelector((state) => state.enlace);

  // Estado base para detección de cambios
  const baselineForm = useMemo(() => (id ? (enlace.enlace || initialform) : initialform), [id, enlace.enlace]);

  const [form, handleInputChange, reset] = useForm(id ? enlace.enlace : initialform);

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!form.titulo || !form.descripcion || !form.link || form.prioridad === '') {
      await Swal.fire({
        title: 'Error',
        text: 'Todos los campos son obligatorios',
        icon: 'error',
        confirmButtonText: 'Ok',
      });
      return;
    }

    const payload = { ...form, prioridad: Number(form.prioridad) };

    try {
      if (id) {
        await dispatch(uploadEnlace(payload, enlace.enlace.id));
      } else {
        await dispatch(nuevoEnlace(payload));
      }
      history.push('/admin/enlaces');
    } catch (_) {
      // Errores manejados por el reducer
    }
  };

  const handleCancelar = async () => {
    const hayCambios = JSON.stringify(form) !== JSON.stringify(baselineForm);
    if (hayCambios) {
      const res = await Swal.fire({
        title: 'Cancelar cambios',
        html: '<p>Tenés cambios sin guardar. ¿Querés salir igualmente?</p>',
        icon: 'warning',
        showCancelButton: true,
        confirmButtonText: 'Sí, salir',
        cancelButtonText: 'Seguir editando',
        reverseButtons: true,
        focusCancel: true,
      });
      if (!res.isConfirmed) return;
    }
    history.push('/admin/enlaces');
  };

  // Precarga cuando edito
  useEffect(() => {
    if (id && enlace.enlace) {
      Object.entries(enlace.enlace).forEach(([key, value]) => {
        if (key && value !== undefined) {
          handleInputChange({ target: { name: key, value } });
        }
      });
    }
  }, [id, enlace.enlace, handleInputChange]);

  // Limpieza de status al desmontar
  useEffect(() => {
    return () => {
      dispatch(clearStatus());
    };
  }, [dispatch]);

  return (
    <div className={styles.visibleContent}>
      <div className={styles.container}>
        <form onSubmit={handleSubmit} className={styles.formAdmin}>
          <h2 className={styles.title}>{id ? 'Editar enlace' : 'Nuevo enlace'}</h2>

          <span className={`p-float-label ${styles.inputSection}`}>
            <InputText
              className={styles.inputForm}
              value={form.titulo}
              name="titulo"
              id="titulo"
              type="text"
              onChange={handleInputChange}
            />
            <label className={styles.labelForm} htmlFor="titulo">Título*</label>
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
            <label className={styles.labelForm} htmlFor="descripcion">Descripción*</label>
          </span>

          <span className={`p-float-label ${styles.inputSection}`}>
            <InputText
              className={styles.inputForm}
              name="link"
              id="link"
              type="text"
              onChange={handleInputChange}
              value={form.link}
            />
            <label className={styles.labelForm} htmlFor="link">Link*</label>
          </span>

          <span className={`p-float-label ${styles.inputSection}`}>
            <InputText
              className={styles.inputForm}
              name="prioridad"
              id="prioridad"
              type="number"
              onChange={handleInputChange}
              value={form.prioridad}
            />
            <label className={styles.labelForm} htmlFor="prioridad">Prioridad*</label>
          </span>

          {/* Botonera */}
          <div className={styles.actions}>
            <Button
              type="button"
              label="Cancelar"
              icon="pi pi-times"
              className="p-button-outlined p-button-danger"
              onClick={handleCancelar}
              disabled={enlace.processing}
            />
            <Button
              type="submit"
              label={id ? 'Editar' : 'Agregar'}
              icon="pi pi-check"
              className="p-button-success"
              disabled={enlace.processing}
            />
          </div>
        </form>

        {enlace.processing && <Spinner />}
      </div>
    </div>
  );
};

export default NuevoEnlace;
