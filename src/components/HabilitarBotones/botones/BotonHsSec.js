// src/components/HabilitarBotones/botones/BotonHsSec.js

import React from "react";
import { Button } from "primereact/button";

const BotonHsSec = ({ label, icon, severity, loading, onClick }) => {
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

export default BotonHsSec;