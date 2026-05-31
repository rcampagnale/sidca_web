// src/components/HabilitarBotones/BotoneraFunciones.js

import React from "react";
import styles from "../../pages/Admin/botones/habilitarbotones.module.css";

import BotonAsistencia from "./botones/BotonAsistencia";
import BotonMeet from "./botones/BotonMeet";
import BotonHsSec from "./botones/BotonHsSec";
import BotonHsSup from "./botones/BotonHsSup";
import BotonSeguroVida from "./botones/BotonSeguroVida";
import BotonSepelio from "./botones/BotonSepelio";
import BotonUpdateApp from "./botones/BotonUpdateApp";
import BotonVotoCredencial from "./botones/BotonVotoCredencial";
import BotonConstancias from "./botones/BotonConstancias";

const BotoneraFunciones = ({
  botonLabelAsistencia,
  botonIconAsistencia,
  botonSeverityAsistencia,
  loadingAsistencia,
  onAbrirAsistencia,

  botonLabelMeet,
  botonIconMeet,
  botonSeverityMeet,
  loadingMeet,
  onAbrirMeet,

  botonLabelHsSec,
  botonIconHsSec,
  botonSeverityHsSec,
  loadingHsSec,
  onAbrirHsSec,

  botonLabelHsSup,
  botonIconHsSup,
  botonSeverityHsSup,
  loadingHsSup,
  onAbrirHsSup,

  botonLabelSeguro,
  botonIconSeguro,
  botonSeveritySeguro,
  loadingSeguro,
  onAbrirSeguro,

  botonLabelSepelio,
  botonIconSepelio,
  botonSeveritySepelio,
  loadingSepelio,
  onAbrirSepelio,

  botonLabelUpdate,
  botonIconUpdate,
  botonSeverityUpdate,
  loadingUpdate,
  onAbrirUpdate,

  botonLabelVoto,
  botonIconVoto,
  botonSeverityVoto,
  loadingVoto,
  onAbrirVoto,

  botonLabelConstancias,
  botonIconConstancias,
  botonSeverityConstancias,
  loadingConstancias,
  onAbrirConstancias,
}) => {
  return (
    <div className={styles.habilitar_botones}>
      <BotonAsistencia
        label={botonLabelAsistencia}
        icon={botonIconAsistencia}
        severity={botonSeverityAsistencia}
        loading={loadingAsistencia}
        onClick={onAbrirAsistencia}
      />

      <BotonMeet
        label={botonLabelMeet}
        icon={botonIconMeet}
        severity={botonSeverityMeet}
        loading={loadingMeet}
        onClick={onAbrirMeet}
      />

      <BotonHsSec
        label={botonLabelHsSec}
        icon={botonIconHsSec}
        severity={botonSeverityHsSec}
        loading={loadingHsSec}
        onClick={onAbrirHsSec}
      />

      <BotonHsSup
        label={botonLabelHsSup}
        icon={botonIconHsSup}
        severity={botonSeverityHsSup}
        loading={loadingHsSup}
        onClick={onAbrirHsSup}
      />

      <BotonSeguroVida
        label={botonLabelSeguro}
        icon={botonIconSeguro}
        severity={botonSeveritySeguro}
        loading={loadingSeguro}
        onClick={onAbrirSeguro}
      />

      <BotonSepelio
        label={botonLabelSepelio}
        icon={botonIconSepelio}
        severity={botonSeveritySepelio}
        loading={loadingSepelio}
        onClick={onAbrirSepelio}
      />

      <BotonUpdateApp
        label={botonLabelUpdate}
        icon={botonIconUpdate}
        severity={botonSeverityUpdate}
        loading={loadingUpdate}
        onClick={onAbrirUpdate}
      />

      <BotonVotoCredencial
        label={botonLabelVoto}
        icon={botonIconVoto}
        severity={botonSeverityVoto}
        loading={loadingVoto}
        onClick={onAbrirVoto}
      />

      <BotonConstancias
        label={botonLabelConstancias}
        icon={botonIconConstancias}
        severity={botonSeverityConstancias}
        loading={loadingConstancias}
        onClick={onAbrirConstancias}
      />
    </div>
  );
};

export default BotoneraFunciones;