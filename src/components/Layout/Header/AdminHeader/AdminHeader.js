import React, { useState } from "react";
import styles from "./AdminHeader.module.css";
import logo from "../../../../assets/img/logo-01.png";
import { Button } from "primereact/button";
import { useHistory } from "react-router-dom";
import NavUser from "./nav/NavUser";
import { confirmDialog } from "primereact/confirmdialog";

// 🔹 Grupos de navegación (Gestión, Afiliados, Cursos, Casa Docente)
const NAV_GROUPS = [
  {
    label: "Gestión",
    items: [
      { label: "Enlaces", path: "/admin/enlaces" },
      { label: "Usuarios", path: "/admin/usuarios" },
      { label: "Habilitar Botones", path: "/admin/botones" },
      { label: "Oficina de Gestión", path: "/admin/oficina-gestion" }, // ✅ NUEVA PÁGINA
      { label: "Asesoramiento", path: "/admin/asesoramiento" },
      { label: "Novedades", path: "/admin/novedades" },
    ],
  },
  {
    label: "Afiliados",
    items: [
      { label: "Afiliado Adherentes", path: "/admin/Adherentes" },
      { label: "Afiliados", path: "/admin/nuevos-afiliados" },
      { label: "Afiliados Actualizados", path: "/admin/AfiliadoActualizado" },
      { label: "Dashboard de Afiliados", path: "/admin/AfiliadosDashboard" },
    ],
  },
  {
    label: "Cursos",
    items: [
      { label: "Asistencia", path: "/admin/ListaAsistencia" },
      { label: "Cursos", path: "/admin/cursos" },
    ],
  },
  {
    label: "Casa Docente",
    items: [
      {
        label: "Reserva Casa del Docente",
        path: "/admin/reserva-casa-docente",
      },
    ],
  },
];

const AdminHeader = () => {
  const history = useHistory();
  const [active, setActive] = useState(false);

  const confirm = () => {
    confirmDialog({
      message: "¿Está seguro de que quiere cerrar sesión?",
      header: "Cerrar Sesión",
      icon: "pi pi-exclamation-triangle",
      accept: () => history.push("/admin/logout"),
      acceptLabel: "Si",
      rejectLabel: "No",
    });
  };

  const handleNavigate = (path) => {
    history.push(path);
  };

  return (
    <>
      {/* Logo: vuelve al panel admin */}
      <a
        href="#"
        onClick={(e) => {
          e.preventDefault();
          history.push("/admin");
        }}
      >
        <img className={styles.headerLogo} src={logo} alt="SiDCa logo" />
      </a>

      {/* Menú de escritorio: agrupado en dropdowns */}
      <ul className={styles.headerNav}>
        {NAV_GROUPS.map((group) => (
          <li key={group.label} className={styles.navGroup}>
            <button type="button" className={styles.navGroupButton}>
              {group.label}
            </button>

            <ul className={styles.dropdown}>
              {group.items.map((item) => (
                <li
                  key={item.label}
                  className={styles.dropdownItem}
                  onClick={() => handleNavigate(item.path)}
                >
                  {item.label}
                </li>
              ))}
            </ul>
          </li>
        ))}
      </ul>

      {/* Botón salir con confirmDialog */}
      <div className={styles.btnExit}>
        <Button
          icon="pi pi-sign-out"
          className="p-button-rounded p-button-danger mr-2 mb-2"
          onClick={confirm}
        />
      </div>

      {/* Menú hamburguesa celular */}
      <div className={styles.hamburger}>
        <Button
          icon="pi pi-bars"
          className="p-button-rounded p-button-warning p-button-text"
          onClick={() => setActive(!active)}
        />
      </div>

      {active && <NavUser active={active} setActive={setActive} />}
    </>
  );
};

export default AdminHeader;