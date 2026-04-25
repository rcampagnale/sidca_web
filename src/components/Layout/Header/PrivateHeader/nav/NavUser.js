import React from "react";
import { Sidebar } from "primereact/sidebar";
import { useHistory } from "react-router";
import styles from "./navUser.module.scss";
import { confirmDialog } from "primereact/confirmdialog";

const NavUser = ({ active, setActive, user }) => {
  const history = useHistory();

  const confirm = () => {
    confirmDialog({
      message: "¿Está seguro de que quiere cerrar sesión?",
      header: "Cerrar Sesión",
      icon: "pi pi-exclamation-triangle",
      accept: () => history.push("/logout"),
      acceptLabel: "Si",
      rejectLabel: "No",
    });
  };

  const navigateTo = (path) => {
    setActive(false);
    history.push(path);
  };

  return (
    <Sidebar
      className={"p-sidebar-top"}
      style={{ backgroundColor: "#3b3b3b", minHeight: "60vh" }}
      visible={active}
      onHide={() => setActive(false)}
    >
      <ul className={styles.navUl}>
        <li onClick={() => navigateTo("/home")}>Inicio</li>

        <li onClick={() => navigateTo("/credencial")}>Credencial</li>

        <li onClick={() => navigateTo("/capacitaciones")}>Capacitaciones</li>

        <li onClick={() => navigateTo("/oficina-gestion")}>
          Oficina de Gestión
        </li>

        <li onClick={() => navigateTo("/nosotros")}>Nosotros</li>

        <li onClick={() => navigateTo("/Convenios")}>Convenios</li>

        <li onClick={() => navigateTo("/contacto")}>Contacto</li>

        {/* {user.profue.cotizante && } */}

        <li
          className={styles.logOut}
          onClick={() => {
            setActive(false);
            confirm();
          }}
        >
          Cerrar sesión
        </li>
      </ul>
    </Sidebar>
  );
};

export default NavUser;