// src/components/Layout/Header/ValidatorHeader/ValidatorHeader.js
//
// Header de la sesión de VALIDACIÓN de certificados.
//
// Visualmente es el mismo que ve el afiliado —mismo logo, misma barra negra,
// mismo botón rojo, mismo hamburger—: reutiliza privateHeader.module.scss en
// vez de duplicarlo. Lo que cambia es qué ofrece y a qué sesión pertenece.
//
// Deliberadamente NO importa Redux, Firestore, delegadosAutorizados,
// FEATURE_FLAGS ni DelegadoPantallaQR. El validador no tiene credencial, ni
// capacitaciones, ni oficina de gestión, ni permisos de delegado: pedir esos
// datos sería consultar Firestore para nada.
//
// Ojo con las dos primeras entradas, que es fácil confundirlas:
//   Inicio               -> /validar-certificados/inicio  (portada)
//   Gestión certificados -> /validar-certificados         (escáner QR)
// La raíz es la herramienta, no la portada.

import React, { useState } from "react";
import { useHistory, useLocation } from "react-router";
import { Button } from "primereact/button";
import { confirmDialog } from "primereact/confirmdialog";

import NavValidator from "./nav/NavValidator";
import styles from "../PrivateHeader/privateHeader.module.scss";
import propios from "./validatorHeader.module.css";
import logo from "../../../../assets/img/logo-01.png";
import { OPCIONES_VALIDADOR, esRutaActiva } from "./menuValidador";

const ValidatorHeader = ({ origenSesion = "validador", onSalir }) => {
  const history = useHistory();
  const location = useLocation();
  const [active, setActive] = useState(false);

  // Con la sesión del panel administrativo no se cierra nada: el botón sólo
  // devuelve al administrador a su módulo. Cerrarle la sesión principal desde
  // acá lo sacaría de su trabajo, que no es lo que esperaría.
  const esPrincipal = origenSesion === "principal";

  const etiquetaSalida = esPrincipal ? "Volver al panel" : "Cerrar sesión";

  const confirmarSalida = () => {
    if (esPrincipal) {
      // No hay nada que confirmar: es una navegación, no un cierre de sesión.
      history.push("/admin/certificados");
      return;
    }

    confirmDialog({
      message: "¿Está seguro de que quiere cerrar la sesión de validación?",
      header: "Cerrar sesión",
      icon: "pi pi-exclamation-triangle",
      accept: () => onSalir?.(),
      acceptLabel: "Si",
      rejectLabel: "No",
    });
  };

  return (
    <header className={styles.header}>
      <a
        href="/validar-certificados/inicio"
        onClick={(e) => {
          e.preventDefault();
          history.push("/validar-certificados/inicio");
        }}
      >
        <img className={styles.headerLogo} src={logo} alt="SiDCa logo" />
      </a>

      <ul className={styles.headerNav}>
        {OPCIONES_VALIDADOR.map((opcion) => {
          const activa = esRutaActiva(location.pathname, opcion.ruta);

          return (
            <li
              key={opcion.ruta}
              onClick={() => history.push(opcion.ruta)}
              className={`${propios.itemMenu} ${activa ? propios.activa : ""}`}
              aria-current={activa ? "page" : undefined}
            >
              {opcion.etiqueta}
            </li>
          );
        })}
      </ul>

      {/* Sólo icono, igual que en el header del afiliado. Sin `label` y sin
          `tooltip`: el tooltip de PrimeReact metía el rótulo dentro de la
          barra, y en un contenedor angosto terminaba partido en vertical.
          aria-label alcanza para lectores de pantalla y no ocupa espacio. */}
      <div className={styles.btnExit}>
        <Button
          icon={esPrincipal ? "pi pi-arrow-left" : "pi pi-sign-out"}
          className="p-button-rounded p-button-danger mr-2 mb-2"
          onClick={confirmarSalida}
          aria-label={etiquetaSalida}
        />
      </div>

      <div className={styles.hamburger}>
        <Button
          icon="pi pi-bars"
          className="p-button-rounded p-button-warning p-button-text"
          onClick={() => setActive(!active)}
          aria-label="Abrir menú"
        />
      </div>

      {active && (
        <NavValidator
          active={active}
          setActive={setActive}
          onCerrarSesion={confirmarSalida}
          etiquetaSalida={etiquetaSalida}
        />
      )}
    </header>
  );
};

export default ValidatorHeader;
