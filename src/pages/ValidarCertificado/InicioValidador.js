// src/pages/ValidarCertificado/InicioValidador.js
//
// Inicio de la sesión de validación.
//
// No tiene contenido propio: muestra la MISMA portada que ve el afiliado en
// /home —imagen institucional, Convenios Comercio y Convenios Hoteles— con las
// mismas novedades. Nada se duplica; Home recibe `modoValidador` y con eso
// omite la lógica de cuotas y apunta "Leer más" a los convenios del validador.
//
// ValidatorShell pone el header y protege la ruta.

import React from "react";

import Home from "../Home/Home";
import ValidatorShell from "./components/ValidatorShell";

const InicioValidador = () => (
  <ValidatorShell>
    <Home modoValidador />
  </ValidatorShell>
);

export default InicioValidador;
