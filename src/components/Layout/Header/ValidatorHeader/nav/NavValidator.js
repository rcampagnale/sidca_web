// src/components/Layout/Header/ValidatorHeader/nav/NavValidator.js
//
// Menú móvil de la sesión de validación.
//
// No se reutiliza NavUser: aquel trae Credencial, Capacitaciones, Oficina de
// Gestión, permisos condicionales de delegado y un cierre de sesión que empuja
// a /logout —la salida del afiliado—. Nada de eso corresponde acá.
//
// Sí se reutiliza su hoja de estilos, para que el panel desplegable se vea
// exactamente igual que el del usuario común.
//
// Las opciones salen de OPCIONES_VALIDADOR, la misma lista que dibuja el menú
// de escritorio: así no pueden quedar desincronizados.

import React, { useEffect, useRef } from "react";
import { useHistory, useLocation } from "react-router";

import styles from "../../PrivateHeader/nav/navUser.module.scss";
import propios from "../validatorHeader.module.css";
import { OPCIONES_VALIDADOR, esRutaActiva } from "../menuValidador";

const NavValidator = ({ active, setActive, onCerrarSesion, etiquetaSalida }) => {
  const history = useHistory();
  const location = useLocation();
  const menuRef = useRef(null);

  const navegarA = (ruta) => {
    setActive(false);
    history.push(ruta);
  };

  // Mismas interacciones que NavUser: se cierra al elegir una opción, al tocar
  // fuera del panel y al desplazar la página.
  useEffect(() => {
    if (!active) return undefined;

    const clickFuera = (evento) => {
      if (menuRef.current && menuRef.current.contains(evento.target)) return;
      setActive(false);
    };

    const alDesplazar = () => setActive(false);

    // El timeout evita que el mismo toque que abrió el menú lo cierre.
    const temporizador = window.setTimeout(() => {
      document.addEventListener("mousedown", clickFuera, true);
      document.addEventListener("touchstart", clickFuera, true);
      window.addEventListener("scroll", alDesplazar, { passive: true });
    }, 0);

    return () => {
      window.clearTimeout(temporizador);
      document.removeEventListener("mousedown", clickFuera, true);
      document.removeEventListener("touchstart", clickFuera, true);
      window.removeEventListener("scroll", alDesplazar);
    };
  }, [active, setActive]);

  return (
    <div className={styles.mobileMenuPanel} ref={menuRef}>
      <ul className={styles.navUl}>
        {OPCIONES_VALIDADOR.map((opcion) => {
          const activa = esRutaActiva(location.pathname, opcion.ruta);

          return (
            <li
              key={opcion.ruta}
              onClick={() => navegarA(opcion.ruta)}
              className={`${propios.itemMovil} ${
                activa ? propios.itemMovilActivo : ""
              }`}
              aria-current={activa ? "page" : undefined}
            >
              {opcion.etiqueta}
            </li>
          );
        })}

        <li
          className={styles.logOut}
          onClick={() => {
            // Se cierra el panel antes de abrir el diálogo: si no, el
            // ConfirmDialog queda debajo del menú desplegado.
            setActive(false);
            window.setTimeout(() => onCerrarSesion?.(), 0);
          }}
        >
          {etiquetaSalida}
        </li>
      </ul>
    </div>
  );
};

export default NavValidator;
