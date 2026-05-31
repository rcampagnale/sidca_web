// src/components/HabilitarBotones/botones/BotonSepelio.js

import React from "react";
import { Button } from "primereact/button";

const BotonSepelio = ({ label, icon, severity, loading, onClick }) => {
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

export default BotonSepelio;