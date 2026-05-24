import React from "react";
import { useHistory, useLocation } from "react-router-dom";
import { signOut } from "firebase/auth";
import { auth } from "../../../../firebase/firebase-config";
import styles from "./PublicHeader.module.css";
import logo from "../../../../assets/img/logo-01.png";

const STORAGE_KEY_COMERCIO = "sidca_comercio_auth";

const PublicHeader = () => {
  const history = useHistory();
  const location = useLocation();

  const pathname = location.pathname.toLowerCase();

  const esLoginComercio = pathname === "/comercio-login";
  const esPaginaComercio = pathname === "/comercio";
  const esSectorComercio = esLoginComercio || esPaginaComercio;

  const cerrarSesionComercioYVolverInicio = async () => {
    try {
      await signOut(auth);
    } catch (error) {
      console.warn("No se pudo cerrar Firebase Auth comercio:", error);
    } finally {
      localStorage.removeItem(STORAGE_KEY_COMERCIO);
      history.push("/");
    }
  };

  const irInicio = () => {
    if (esSectorComercio) {
      cerrarSesionComercioYVolverInicio();
      return;
    }

    history.push("/");
  };

  const irComercio = () => {
    history.push("/comercio?consulta=1");
  };

  const irAdmin = () => {
    history.push("/admin");
  };

  return (
    <header className={styles.header}>
      <a
        href="/"
        onClick={(e) => {
          e.preventDefault();
          irInicio();
        }}
      >
        <img className={styles.headerLogo} src={logo} alt="SiDCa logo" />
      </a>

      {esLoginComercio ? null : (
        <ul className={styles.headerNav}>
          {esPaginaComercio ? (
            <li className={styles.exitItem}>
              <button
                type="button"
                className={styles.exitButton}
                onClick={cerrarSesionComercioYVolverInicio}
                title="Salir"
                aria-label="Salir"
              >
                <i className="pi pi-sign-out"></i>
              </button>
            </li>
          ) : (
            <>
              <li onClick={irComercio}>Comercio</li>

              <li className={styles.separator}>|</li>

              <li onClick={irAdmin}>Administración del Sitio</li>
            </>
          )}
        </ul>
      )}
    </header>
  );
};

export default PublicHeader;