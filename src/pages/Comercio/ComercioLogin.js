// src/pages/Comercio/ComercioLogin.js

import React, { useState } from "react";
import { useHistory, useLocation } from "react-router-dom";
import {
  browserSessionPersistence,
  setPersistence,
  signInWithEmailAndPassword,
} from "firebase/auth";
import { auth } from "../../firebase/firebase-config";
import styles from "./ComercioLogin.module.css";
import logo from "../../assets/img/logo-01.png";

const STORAGE_KEY_COMERCIO = "sidca_comercio_auth";
const COMERCIO_USUARIO = "comercio";
const COMERCIO_EMAIL = "comercio@sidca.com";

const ComercioLogin = () => {
  const history = useHistory();
  const location = useLocation();

  const [usuario, setUsuario] = useState("");
  const [password, setPassword] = useState("");
  const [mensaje, setMensaje] = useState("");
  const [loading, setLoading] = useState(false);

  const params = new URLSearchParams(location.search);
  const redirect = params.get("redirect") || "/comercio?consulta=1";

  const obtenerMensajeError = (code) => {
    if (code === "auth/invalid-credential") {
      return "Usuario o contraseña incorrectos.";
    }

    if (code === "auth/user-not-found") {
      return "El usuario de comercio no existe en Firebase Authentication.";
    }

    if (code === "auth/wrong-password") {
      return "Contraseña incorrecta.";
    }

    if (code === "auth/too-many-requests") {
      return "Demasiados intentos. Espere unos minutos e intente nuevamente.";
    }

    if (code === "auth/network-request-failed") {
      return "Problema de conexión. Verifique internet e intente nuevamente.";
    }

    return "No se pudo iniciar sesión. Intente nuevamente.";
  };

  const iniciarSesion = async (e) => {
    e.preventDefault();

    const usuarioLimpio = usuario.trim().toLowerCase();
    const passwordLimpio = password.trim();

    setMensaje("");

    if (!usuarioLimpio || !passwordLimpio) {
      setMensaje("Ingrese usuario y contraseña.");
      return;
    }

    if (usuarioLimpio !== COMERCIO_USUARIO) {
      setMensaje("Usuario o contraseña incorrectos.");
      return;
    }

    setLoading(true);

    try {
      /*
        Usamos persistencia de sesión.
        Esto evita dejar la sesión abierta permanentemente en el navegador.
      */
      await setPersistence(auth, browserSessionPersistence);

      const userCredential = await signInWithEmailAndPassword(
        auth,
        COMERCIO_EMAIL,
        passwordLimpio
      );

      const user = userCredential.user;

      localStorage.setItem(
        STORAGE_KEY_COMERCIO,
        JSON.stringify({
          logged: true,
          uid: user.uid,
          email: user.email,
          usuario: usuarioLimpio,
          fecha: new Date().toISOString(),
        })
      );

      history.replace(redirect);
    } catch (error) {
      console.error("Error login comercio:", error);
      setMensaje(obtenerMensajeError(error.code));
    } finally {
      setLoading(false);
    }
  };

  const volver = () => {
    localStorage.removeItem(STORAGE_KEY_COMERCIO);
    history.push("/");
  };

  return (
    <main className={styles.loginPage}>
      <section className={styles.loginCard}>
        <div className={styles.logoBox}>
          <img src={logo} alt="SiDCa logo" />
        </div>

        <h1>Acceso Comercio</h1>

        <p className={styles.descripcion}>
          Sector exclusivo para comercios adheridos. Ingrese las credenciales
          autorizadas para consultar la credencial del afiliado.
        </p>

        <form className={styles.form} onSubmit={iniciarSesion}>
          <div className={styles.formGroup}>
            <label htmlFor="usuario">Usuario</label>

            <input
              id="usuario"
              type="text"
              value={usuario}
              onChange={(e) => setUsuario(e.target.value)}
              placeholder="Ingrese usuario"
              autoComplete="username"
              disabled={loading}
            />
          </div>

          <div className={styles.formGroup}>
            <label htmlFor="password">Contraseña</label>

            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Ingrese contraseña"
              autoComplete="current-password"
              disabled={loading}
            />
          </div>

          {mensaje && <div className={styles.errorBox}>{mensaje}</div>}

          <button type="submit" className={styles.loginButton} disabled={loading}>
            {loading ? "Ingresando..." : "Ingresar"}
          </button>

          <button
            type="button"
            className={styles.backButton}
            onClick={volver}
            disabled={loading}
          >
            Regresar
          </button>
        </form>
      </section>
    </main>
  );
};

export default ComercioLogin;