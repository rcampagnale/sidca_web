import React, { useEffect, useRef } from "react";
import { useHistory } from "react-router";
import styles from "./navUser.module.scss";
import { confirmDialog } from "primereact/confirmdialog";

const NavUser = ({
  active,
  setActive,
  mostrarGestionDelegados = false,
  mostrarPantallaQR = false,
  onRegistrarPantallaQR,
}) => {
  const history = useHistory();
  const menuRef = useRef(null);

  const confirm = () => {
    setActive(false);

    window.setTimeout(() => {
      confirmDialog({
        message: "¿Está seguro de que quiere cerrar sesión?",
        header: "Cerrar Sesión",
        icon: "pi pi-exclamation-triangle",
        accept: () => history.push("/logout"),
        acceptLabel: "Si",
        rejectLabel: "No",
      });
    }, 0);
  };

  const navigateTo = (path) => {
    setActive(false);
    history.push(path);
  };

  useEffect(() => {
    if (!active) return undefined;

    const handleOutsideClick = (event) => {
      if (menuRef.current && menuRef.current.contains(event.target)) {
        return;
      }

      setActive(false);
    };

    const handlePageScroll = () => {
      setActive(false);
    };

    const timer = window.setTimeout(() => {
      document.addEventListener("mousedown", handleOutsideClick, true);
      document.addEventListener("touchstart", handleOutsideClick, true);
      window.addEventListener("scroll", handlePageScroll, { passive: true });
    }, 0);

    return () => {
      window.clearTimeout(timer);
      document.removeEventListener("mousedown", handleOutsideClick, true);
      document.removeEventListener("touchstart", handleOutsideClick, true);
      window.removeEventListener("scroll", handlePageScroll);
    };
  }, [active, setActive]);

  return (
    <div className={styles.mobileMenuPanel} ref={menuRef}>
      <ul className={styles.navUl}>
        <li onClick={() => navigateTo("/home")}>Inicio</li>

        <li onClick={() => navigateTo("/credencial")}>Credencial</li>

        <li onClick={() => navigateTo("/capacitaciones")}>Capacitaciones</li>

        <li onClick={() => navigateTo("/oficina-gestion")}>
          Oficina de Gestión
        </li>

        {mostrarGestionDelegados && (
          <li onClick={() => navigateTo("/delegado/gestion-delegados")}>
            Gestión Delegados
          </li>
        )}

        {mostrarPantallaQR && (
          <li
            onClick={() => {
              setActive(false);
              onRegistrarPantallaQR?.();
            }}
          >
            Pantalla QR
          </li>
        )}

        <li onClick={() => navigateTo("/nosotros")}>Nosotros</li>

        <li onClick={() => navigateTo("/Convenios")}>Convenios</li>

        <li onClick={() => navigateTo("/contacto")}>Contacto</li>

        <li className={styles.logOut} onClick={confirm}>
          Cerrar sesión
        </li>
      </ul>
    </div>
  );
};

export default NavUser;
