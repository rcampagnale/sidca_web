// src/components/HabilitarBotones/botones/BotonSeguroVida.js

import React from "react";
import { Button } from "primereact/button";

const BotonSeguroVida = ({ label, icon, severity, loading, onClick }) => {
  return (
    <Button
      label={label}
      icon={icon}
      severity={severity}
      onClick={onClick}
      loading={loading}
    />
  );
};

export default BotonSeguroVida;