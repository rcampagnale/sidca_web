import React, { useState } from "react";
import { useHistory } from "react-router-dom";

import logo from "../../assets/img/logo-01.png";
import PublicHeader from "../Layout/Header/PublicHeader/PublicHeader";
import { iniciarSesionValidador } from "../../services/certificadosValidacionService";
import "../../styles/institutional.css";
import styles from "./LoginGestionInstitucional.module.css";

// El componente autentica, pero no decide el destino: la ruta que lo renderiza
// conserva su URL y useSesionValidador actualiza la pantalla al restaurar auth.
const LoginGestionInstitucional = ({ onIngresado, mostrarRegresar = true }) => {
  const history = useHistory();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [ingresando, setIngresando] = useState(false);

  const ingresar = async (evento) => {
    evento.preventDefault();
    setIngresando(true);
    setError("");

    try {
      const usuario = await iniciarSesionValidador(email, password);
      setPassword("");
      if (onIngresado) onIngresado(usuario);
    } catch (fallo) {
      setError("No pudimos ingresar. Revisá el correo y la contraseña.");
    } finally {
      setIngresando(false);
    }
  };

  return (
    <main className={styles.pagina}>
      <section className={styles.tarjeta}>
        <PublicHeader />
        <header className={styles.encabezado}>
          <img className={styles.logo} src={logo} alt="SiDCa" />
          <span className={styles.marca}>SIDCA</span>
          <p className={styles.bienvenida}>Bienvenido</p>
          <h1>Gestión Institucional</h1>
          <p className={styles.subtitulo}>
            Ingresá con tus credenciales para acceder a las herramientas de gestión institucional.
          </p>
        </header>
        <div className={styles.loginBloque}>
          <form onSubmit={ingresar}>
            <label>Correo electrónico<input type="email" autoComplete="username" required value={email} onChange={(evento) => setEmail(evento.target.value)} /></label>
            <label>Contraseña<input type="password" autoComplete="current-password" required value={password} onChange={(evento) => setPassword(evento.target.value)} /></label>
            {error && <p className={styles.error} role="alert">{error}</p>}
            <button type="submit" disabled={ingresando}>{ingresando ? "Ingresando..." : "Ingresar"}</button>
          </form>
          <small>Acceso exclusivo para personal autorizado.</small>
        </div>
      </section>
      {mostrarRegresar && <button type="button" className={styles.botonRegresar} onClick={() => history.push("/administracion")}><i className="pi pi-arrow-left" aria-hidden="true" />Regresar</button>}
    </main>
  );
};

export default LoginGestionInstitucional;
