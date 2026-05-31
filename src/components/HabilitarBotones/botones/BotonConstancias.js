// src/components/HabilitarBotones/botones/BotonConstancias.js

import React from "react";
import { Button } from "primereact/button";

const BotonConstancias = ({ label, icon, severity, loading, onClick }) => {
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

export default BotonConstancias;
