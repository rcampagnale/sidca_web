import React from "react";

import Home from "../Home/Home";
import ValidatorShell from "../ValidarCertificado/components/ValidatorShell";

const GestionInstitucionalInicio = () => (
  <ValidatorShell requiereLogin modulo={null}>
    <Home modoValidador />
  </ValidatorShell>
);

export default GestionInstitucionalInicio;
