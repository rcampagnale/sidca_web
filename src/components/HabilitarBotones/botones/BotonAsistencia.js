// src/components/HabilitarBotones/botones/BotonAsistencia.js

import React from "react";
import { Button } from "primereact/button";

const BotonAsistencia = ({ label, icon, severity, loading, onClick }) => {
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

export default BotonAsistencia;