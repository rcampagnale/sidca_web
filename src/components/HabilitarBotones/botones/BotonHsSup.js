// src/components/HabilitarBotones/botones/BotonHsSup.js

import React from "react";
import { Button } from "primereact/button";

const BotonHsSup = ({ label, icon, severity, loading, onClick }) => {
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

export default BotonHsSup;