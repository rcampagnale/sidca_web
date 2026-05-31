// src/components/HabilitarBotones/botones/BotonUpdateApp.js

import React from "react";
import { Button } from "primereact/button";

const BotonUpdateApp = ({ label, icon, severity, loading, onClick }) => {
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

export default BotonUpdateApp;