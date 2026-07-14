// src/pages/Admin/components/AdminHeader/nav/NavUser.js

import React, { useEffect, useRef, useState } from "react";
import { useHistory } from "react-router-dom";
import styles from "./styles.module.css";
import { confirmDialog } from "primereact/confirmdialog";

const NavUser = ({ active, setActive }) => {
  const history = useHistory();
  const menuRef = useRef(null);
  const [menuTop, setMenuTop] = useState(60);

  const confirm = () => {
    setActive(false);

    window.setTimeout(() => {
      confirmDialog({
      message: "¿Está seguro de que quiere cerrar sesión?",
      header: "Cerrar Sesión",
      icon: "pi pi-exclamation-triangle",
      accept: () => history.push("/admin/logout"),
      acceptLabel: "Si",
        rejectLabel: "No",
      });
    }, 0);
  };

  // 🔹 Mismo esquema de grupos que el header de escritorio
  const NAV_SECTIONS = [
    {
      title: "Gestión",
      items: [
        { label: "Enlaces", path: "/admin/enlaces" },
        { label: "Usuarios", path: "/admin/usuarios" },
        { label: "Habilitar Botones", path: "/admin/botones" },
        { label: "Oficina de Gestión", path: "/admin/oficina-gestion" },
        { label: "Gestión Delegados", path: "/admin/gestion-delegados" },
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

        // ✅ Nueva página administrativa
        { label: "Servicios Contratados", path: "/admin/servicios" },
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

  useEffect(() => {
    if (!active) return undefined;

    const updateMenuPosition = () => {
      const trigger = menuRef.current?.parentElement;
      const header = trigger?.parentElement;
      const rect =
        header?.getBoundingClientRect() || trigger?.getBoundingClientRect();
      const top = rect ? rect.bottom : 60;

      setMenuTop(Math.max(0, Math.round(top)));
    };

    const handleOutsideClick = (event) => {
      if (menuRef.current && menuRef.current.contains(event.target)) {
        return;
      }

      setActive(false);
    };

    const handlePageScroll = () => {
      setActive(false);
    };

    updateMenuPosition();
    window.addEventListener("resize", updateMenuPosition);
    window.addEventListener("scroll", handlePageScroll, { passive: true });

    const timer = window.setTimeout(() => {
      document.addEventListener("mousedown", handleOutsideClick, true);
      document.addEventListener("touchstart", handleOutsideClick, true);
    }, 0);

    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("resize", updateMenuPosition);
      window.removeEventListener("scroll", handlePageScroll);
      document.removeEventListener("mousedown", handleOutsideClick, true);
      document.removeEventListener("touchstart", handleOutsideClick, true);
    };
  }, [active, setActive]);

  return (
    <div
      className={styles.mobileSidebar}
      ref={menuRef}
      style={{ "--admin-mobile-menu-top": `${menuTop}px` }}
    >
      <div className={styles.menuHeader}>
        <div>
          <p className={styles.menuKicker}>Panel administrativo</p>
          <h2 className={styles.menuTitle}>Menú principal</h2>
        </div>
      </div>

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
          <i className="pi pi-sign-out" />
          <span>Cerrar sesión</span>
        </li>
      </ul>
    </div>
  );
};

export default NavUser;
