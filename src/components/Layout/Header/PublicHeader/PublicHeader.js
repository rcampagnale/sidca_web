import React, { useState } from "react";
import { useHistory, useLocation } from "react-router-dom";
import { signOut } from "firebase/auth";
import { confirmDialog } from "primereact/confirmdialog";
import { auth } from "../../../../firebase/firebase-config";
import styles from "./PublicHeader.module.css";
import logo from "../../../../assets/img/logo-01.png";

const STORAGE_KEY_COMERCIO = "sidca_comercio_auth";

const MENU_AFILIADO = [
  { label: "Inicio", path: "/home" },
  { label: "Credencial", path: "/credencial" },
  { label: "Capacitaciones", path: "/capacitaciones" },
  { label: "Oficina de Gestión", path: "/oficina-gestion" },
  { label: "Nosotros", path: "/nosotros" },
  { label: "Convenios", path: "/convenios" },
  { label: "Contacto", path: "/contacto" },
];

const RUTAS_CON_MENU_AFILIADO = [
  "/home",
  "/credencial",
  "/capacitaciones",
  "/oficina-gestion",
  "/nosotros",
  "/convenios",
  "/contacto",
];

const PublicHeader = () => {
  const history = useHistory();
  const location = useLocation();

  const [menuOpen, setMenuOpen] = useState(false);

  const pathname = location.pathname.toLowerCase();

  const esLoginComercio = pathname === "/comercio-login";
  const esPaginaComercio = pathname === "/comercio";
  const esSectorComercio = esLoginComercio || esPaginaComercio;

  const mostrarMenuAfiliado = RUTAS_CON_MENU_AFILIADO.some(
    (ruta) => pathname === ruta || pathname.startsWith(`${ruta}/`)
  );

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

  const cerrarSesionAfiliado = () => {
    confirmDialog({
      message: "¿Está seguro de que quiere cerrar sesión?",
      header: "Cerrar Sesión",
      icon: "pi pi-exclamation-triangle",
      accept: () => history.push("/logout"),
      acceptLabel: "Si",
      rejectLabel: "No",
    });
  };

  const irInicio = () => {
    if (esSectorComercio) {
      cerrarSesionComercioYVolverInicio();
      return;
    }

    if (mostrarMenuAfiliado) {
      history.push("/home");
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

  const navegarAfiliado = (path) => {
    setMenuOpen(false);
    history.push(path);
  };

  const renderMenuAfiliado = () => (
    <>
      <button
        type="button"
        className={styles.menuButton}
        onClick={() => setMenuOpen((prev) => !prev)}
        aria-label="Abrir menú"
        title="Menú"
      >
        <i className={`pi ${menuOpen ? "pi-times" : "pi-bars"}`} />
      </button>

      <ul
        className={`${styles.headerNav} ${styles.affiliateNav} ${
          menuOpen ? styles.navOpen : ""
        }`}
      >
        {MENU_AFILIADO.map((item) => (
          <li
            key={item.path}
            className={pathname === item.path ? styles.activeItem : ""}
            onClick={() => navegarAfiliado(item.path)}
          >
            {item.label}
          </li>
        ))}

        <li className={styles.exitItem}>
          <button
            type="button"
            className={styles.exitButton}
            onClick={cerrarSesionAfiliado}
            title="Cerrar sesión"
            aria-label="Cerrar sesión"
          >
            <i className="pi pi-sign-out"></i>
          </button>
        </li>
      </ul>
    </>
  );

  const renderMenuPublico = () => (
    <ul className={styles.headerNav}>
      <li onClick={irComercio}>Comercio</li>

      <li className={styles.separator}>|</li>

      <li onClick={irAdmin}>Administración del Sitio</li>
    </ul>
  );

  const renderMenuComercio = () => (
    <ul className={styles.headerNav}>
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
    </ul>
  );

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

      {esLoginComercio
        ? null
        : esPaginaComercio
          ? renderMenuComercio()
          : mostrarMenuAfiliado
            ? renderMenuAfiliado()
            : renderMenuPublico()}
    </header>
  );
};

export default PublicHeader;