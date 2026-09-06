// src/pages/ValidarCertificado/components/ValidatorShell.js
//
// Envoltorio de las páginas internas de la sesión de validación.
//
// Pone el header arriba y protege la ruta: sin sesión utilizable no se muestra
// el contenido, se vuelve a /validar-certificados para que aparezca el login.
// Que la URL exista no alcanza.
//
// NO se usa <Layout type="Validator">. Se evaluó agregar ese tipo a Header.js,
// pero LayoutPage monta también el Footer, y hoy la pantalla de validación no
// tiene ninguno: usarlo habría metido un pie de página nuevo sin pedirlo. Con
// este envoltorio el header queda idéntico —reutiliza la misma hoja de estilos
// que PrivateHeader— y Public, Private y Admin siguen intactos.

import React from "react";
import { Redirect } from "react-router-dom";

import ValidatorHeader from "../../../components/Layout/Header/ValidatorHeader/ValidatorHeader";
import { cerrarSesionValidador } from "../../../services/certificadosValidacionService";
import LoginGestionInstitucional from "../../../components/GestionInstitucional/LoginGestionInstitucional";
import useSesionValidador from "./useSesionValidador";
import estilos from "./ValidatorShell.module.css";

const ValidatorShell = ({ children, modulo = "certificados", requiereLogin = false }) => {
  const { cargando, sesion, origenSesion, permisos, permisosCargando } = useSesionValidador();

  // Mientras Firebase restaura la sesión no se decide nada: redirigir acá
  // expulsaría a alguien que sí está autenticado.
  if (cargando) {
    return (
      <main style={{ padding: "2rem", textAlign: "center" }}>
        Verificando sesión…
      </main>
    );
  }

  if (!sesion) return requiereLogin ? <LoginGestionInstitucional mostrarRegresar /> : <Redirect to="/gestion-institucional" />;
  if (permisosCargando) return <main style={{ padding: "2rem", textAlign: "center" }}>Verificando permisos…</main>;
  if (modulo && !permisos[modulo]) return <main style={{ padding: "2rem", textAlign: "center" }}>No tenés permisos para acceder a este módulo.</main>;

  return (
    <>
      <ValidatorHeader
        origenSesion={origenSesion}
        onSalir={cerrarSesionValidador}
        permisos={permisos}
      />
      <main className={estilos.contenido}>{React.isValidElement(children) ? React.cloneElement(children, { permisos, permisosCargando, sesion }) : children}</main>
    </>
  );
};

export default ValidatorShell;
