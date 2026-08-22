// src/pages/Admin/LoginAdmin/LoginAdmin.js
import React, { useEffect, useState } from 'react'
import { useDispatch, useSelector } from 'react-redux';
import { useHistory, Route } from 'react-router-dom';
import { useForm } from '../../../hooks/useForm';
import { adminLogin } from '../../../redux/reducers/user/actions';
import {
  MENSAJE_INACTIVIDAD,
  MOTIVO_INACTIVIDAD,
  consumirMotivoCierre,
} from '../../../utils/adminSession';
import styles from './styles.module.css';
import logo from '../../../assets/img/logo-01.png';
import '../../../styles/institutional.css';

import { InputText } from 'primereact/inputtext';
import { Button } from 'primereact/button';
import { Spinner } from '../../../components/Spinner/Spinner';

/**
 * Detecta si el mensaje corresponde a una cuenta
 * Afiliado en carácter de Adherente SUSPENDIDA.
 */
const isSuspendedMessage = (msg) => {
  if (typeof msg !== 'string') return false;
  const text = msg.toLowerCase();
  return (
    text.includes('afiliado en carácter de adherente') &&
    text.includes('suspendida')
  );
};

const LoginAdmin = () => {

  const dispatch = useDispatch();
  const history = useHistory();
  const user = useSelector(state => state.user);

  const initialform = {
    admin: '',
    password: '',
  };

  const [form, handleInputChange, reset] = useForm(initialform);

  // Motivo del último cierre. Se lee una sola vez y se borra, así el aviso no
  // reaparece al volver a esta pantalla.
  const [avisoCierre, setAvisoCierre] = useState('');

  useEffect(() => {
    if (consumirMotivoCierre() === MOTIVO_INACTIVIDAD) {
      setAvisoCierre(MENSAJE_INACTIVIDAD);
    }
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    await dispatch(adminLogin(form));
    reset();
  };

  useEffect(() => {
    if (user.profile?.accessToken) {
      history.push('/admin');
    }
  }, [user.profile?.accessToken, history]);

  // 🔎 Si el msg es de afiliado adherente suspendido, NO lo mostramos aquí
  const suspended = isSuspendedMessage(user.msg);

  return (
    <div className={styles.visibleContent}>
      <div className={styles.container}>
        <form onSubmit={handleSubmit} className={styles.formAdmin}>
          <div className={styles.loginBrand}>
            <img src={logo} alt="SiDCa" />
            <span>SIDCA</span>
            <strong>Bienvenido</strong>
          </div>
          <h2 className={styles.title}>Administrador de SiDCa</h2>
          <p className={styles.subtitle}>
            Ingresá con tus credenciales para acceder al sistema de administración de SiDCa.
          </p>

          {avisoCierre && (
            <div
              role="status"
              style={{
                marginBottom: '14px',
                padding: '10px 12px',
                fontSize: '0.86rem',
                lineHeight: 1.45,
                color: '#92400e',
                background: '#fffbeb',
                border: '1px solid #fde68a',
                borderRadius: '8px',
              }}
            >
              {avisoCierre}
            </div>
          )}

          <span className={`p-float-label ${styles.inputSection}`}>
            <InputText
              className={styles.inputForm}
              value={form.admin}
              name="admin"
              id="admin"
              type="text"
              onChange={handleInputChange}
            />
            <label className={styles.labelForm} htmlFor="admin">Email</label>
          </span>

          <span className={`p-float-label ${styles.inputSection}`}>
            <InputText
              className={styles.inputForm}
              value={form.password}
              name="password"
              id="password"
              type="password"
              onChange={handleInputChange}
            />
            <label className={styles.labelForm} htmlFor="password">Contraseña</label>
          </span>

          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: '5px',
              marginTop: '5px'
            }}
          >
            {user.processing && <Spinner />}
            {user.status === 'AUTH_FAILURE' && !suspended && (
              <small className="p-error">{user.msg}</small>
            )}
          </div>

          <Button
            type="submit"
            label='Ingresar'
            className={`p-button-raised p-button-warning ${styles.submitButton}`}
          />
        </form>
      </div>
      <button
        type="button"
        className={styles.backButton}
        onClick={() => history.push('/administracion')}
      >
        <i className="pi pi-arrow-left" aria-hidden="true" />
        Regresar
      </button>
    </div>
  );
};

export default LoginAdmin;
