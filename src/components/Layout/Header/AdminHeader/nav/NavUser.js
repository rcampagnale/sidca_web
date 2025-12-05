// src/pages/Admin/components/AdminHeader/nav/NavUser.js
import React, { useState } from "react";
import { Sidebar } from "primereact/sidebar";
import { useHistory } from "react-router-dom";
import styles from "./styles.module.css";
import { confirmDialog } from "primereact/confirmdialog";

const NavUser = ({ active, setActive }) => {
  const history = useHistory();

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

  // 🔹 Mismo esquema de grupos que el header de escritorio
  const NAV_SECTIONS = [
    {
      title: "Gestión",
      items: [
        { label: "Enlaces", path: "/admin/enlaces" },
        { label: "Usuarios", path: "/admin/usuarios" },
        { label: "Habilitar Botones", path: "/admin/botones" },
        { label: "Asesoramiento", path: "/admin/asesoramiento" },
        { label: "Novedades", path: "/admin/novedades" },
      ],
    },
    {
      title: "Afiliados",
      items: [
        { label: "Afiliado Adherentes", path: "/admin/Adherentes" },
        { label: "Afiliados", path: "/admin/nuevos-afiliados" },
        { label: "Afiliados Actualizados", path: "/admin/AfiliadoActualizado" },
        { label: "Dashboard de Afiliados", path: "/admin/AfiliadosDashboard" },
      ],
    },
    {
      title: "Cursos",
      items: [
        { label: "Asistencia", path: "/admin/ListaAsistencia" },
        { label: "Cursos", path: "/admin/cursos" },
      ],
    },
    {
      title: "Casa Docente",
      items: [
        {
          label: "Reserva Casa del Docente",
          path: "/admin/reserva-casa-docente",
        },
      ],
    },
  ];

  const [openSection, setOpenSection] = useState(null);

  const toggleSection = (title) => {
    setOpenSection((prev) => (prev === title ? null : title));
  };

  const handleItemClick = (path) => {
    history.push(path);
    setActive(false); // cierra el sidebar al navegar
  };

  return (
    <Sidebar
      className={"p-sidebar-top"}
      style={{ backgroundColor: "#3b3b3b", minHeight: "60vh" }}
      visible={active}
      onHide={() => setActive(false)}
    >
      <ul className={styles.navUl}>
        {NAV_SECTIONS.map((section) => {
          const isOpen = openSection === section.title;

          return (
            <li key={section.title} className={styles.section}>
              {/* Cabecera de la sección */}
              <button
                type="button"
                className={styles.sectionHeader}
                onClick={() => toggleSection(section.title)}
              >
                <span>{section.title}</span>
                <i
                  className={`pi ${
                    isOpen ? "pi-chevron-up" : "pi-chevron-down"
                  } ${styles.sectionIcon}`}
                />
              </button>

              {/* Opciones desplegables */}
              {isOpen && (
                <ul className={styles.submenu}>
                  {section.items.map((item) => (
                    <li
                      key={item.label}
                      className={styles.submenuItem}
                      onClick={() => handleItemClick(item.path)}
                    >
                      {item.label}
                    </li>
                  ))}
                </ul>
              )}
            </li>
          );
        })}

        <li className={styles.logOut} onClick={confirm}>
          Cerrar sesión
        </li>
      </ul>
    </Sidebar>
  );
};

export default NavUser;
