// src/pages/Admin/OficinaGestion/OficinaGestionAdmin.js

import React, { useState } from "react";
import { Button } from "primereact/button";
import { TabView, TabPanel } from "primereact/tabview";
import styles from "./OficinaGestionAdmin.module.css";

import CrearFormularioGestion from "../../../components/OficinaGestion/CrearFormularioGestion";
import CrearFormularioDesdeExcel from "../../../components/OficinaGestion/CrearFormularioDesdeExcel";
import GestionarFormulariosGestion from "../../../components/OficinaGestion/GestionarFormulariosGestion";
import ImportarRespuestasExcelGestion from "../../../components/OficinaGestion/ImportarRespuestasExcelGestion";
import ImportarExcelAgrupadoGestion from "../../../components/OficinaGestion/ImportarExcelAgrupadoGestion";
import RespuestasFormularioGestion from "../../../components/OficinaGestion/RespuestasFormularioGestion";

const OficinaGestionAdmin = () => {
  const [activeIndex, setActiveIndex] = useState(0);
  const [modoCreacion, setModoCreacion] = useState("manual");
  const [formularioExcelCreado, setFormularioExcelCreado] = useState(null);

  const handleFormularioCreado = () => {
    // Cuando se crea un formulario, pasa automáticamente a Gestionar formularios
    setActiveIndex(1);
  };

  const handleFormularioExcelCreado = (formulario) => {
    setFormularioExcelCreado(formulario || null);
    setActiveIndex(2);
  };

  return (
    <div className={styles.page}>
      {/* ENCABEZADO SUPERIOR */}
      <section className={styles.headerCompact}>
        <div className={styles.headerText}>
          <span className={styles.badge}>Gestión administrativa</span>

          <h1 className={styles.title}>Oficina de Gestión</h1>

          <p className={styles.subtitle}>
            Espacio destinado a crear formularios institucionales,
            administrarlos, obtener el link final, previsualizarlos antes de
            publicar, importar respuestas desde Excel y consultar las respuestas
            cargadas por los afiliados.
          </p>
        </div>
      </section>

      {/* PESTAÑAS */}
      <section className={styles.panel}>
        <TabView
          activeIndex={activeIndex}
          onTabChange={(e) => setActiveIndex(e.index)}
          className={styles.tabView}
        >
          <TabPanel header="Crear formulario" leftIcon="pi pi-file-edit mr-2">
            <div className={styles.manageActions}>
              <Button
                label="Crear formulario manual"
                icon="pi pi-file-edit"
                severity={modoCreacion === "manual" ? "success" : "secondary"}
                outlined={modoCreacion !== "manual"}
                onClick={() => setModoCreacion("manual")}
              />
              <Button
                label="Crear formulario desde Excel"
                icon="pi pi-file-excel"
                severity={modoCreacion === "excel" ? "success" : "secondary"}
                outlined={modoCreacion !== "excel"}
                onClick={() => setModoCreacion("excel")}
              />
            </div>

            {modoCreacion === "excel" ? (
              <CrearFormularioDesdeExcel
                onCreated={handleFormularioExcelCreado}
                onCancel={() => setModoCreacion("manual")}
              />
            ) : (
              <CrearFormularioGestion onCreated={handleFormularioCreado} />
            )}
          </TabPanel>

          <TabPanel header="Gestionar formularios" leftIcon="pi pi-cog mr-2">
            <GestionarFormulariosGestion />
          </TabPanel>

          <TabPanel header="Importar Excel" leftIcon="pi pi-file-excel mr-2">
            <ImportarExcelAgrupadoGestion formularioInicialId={formularioExcelCreado?.id} />
            <ImportarRespuestasExcelGestion />
          </TabPanel>

          <TabPanel header="Ver respuestas" leftIcon="pi pi-list-check mr-2">
            <RespuestasFormularioGestion />
          </TabPanel>
        </TabView>
      </section>
    </div>
  );
};

export default OficinaGestionAdmin;
