// src/components/HabilitarBotones/botones/BotonVotoCredencial.js

import React from "react";
import { Button } from "primereact/button";

const BotonVotoCredencial = ({ label, icon, severity, loading, onClick }) => {
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

export default BotonVotoCredencial;