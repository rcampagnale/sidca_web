import React, { useMemo, useState } from "react";
import { Button } from "primereact/button";
import { Column } from "primereact/column";
import { DataTable } from "primereact/datatable";
import { Dialog } from "primereact/dialog";
import { InputText } from "primereact/inputtext";
import { Tag } from "primereact/tag";

import { normalizeSearchText } from "../../../services/titularizacion/titularizacionNormalizer";
import TitularizacionSituaciones from "./TitularizacionSituaciones";
import styles from "../../../pages/Admin/OficinaGestion/Titularizacion/TitularizacionPage.module.css";

const dash = (value) => value || "—";

const TitularizacionPersonasTable = ({ personas = [] }) => {
  const [busqueda, setBusqueda] = useState("");
  const [expandedRows, setExpandedRows] = useState(null);
  const [personaDetalle, setPersonaDetalle] = useState(null);

  const personasFiltradas = useMemo(() => {
    const termino = normalizeSearchText(busqueda);
    if (!termino) return personas;

    return personas.filter((persona) => persona.searchable.includes(termino));
  }, [busqueda, personas]);

  const estadoTemplate = (persona) => (
    <Tag
      value={persona.estadoInicial}
      severity={persona.estadoInicial === "SOLICITUD REGISTRADA" ? "success" : "warning"}
    />
  );

  const nombreTemplate = (persona) => (
    <div className={styles.personNameCell}>
      <strong>{dash(persona.nombreCompleto)}</strong>
      {persona.razonesRevision.length > 0 && (
        <small
          title={persona.razonesRevision.join(" · ")}
          aria-label={persona.razonesRevision.join(" · ")}
        >
          {persona.razonesRevision.join(" · ")}
        </small>
      )}
    </div>
  );

  const actionsTemplate = (persona) => (
    <Button
      label="Ver detalle"
      icon="pi pi-eye"
      outlined
      onClick={() => setPersonaDetalle(persona)}
      className={styles.actionButton}
    />
  );

  const rowExpansionTemplate = (persona) => (
    <div className={styles.expandedContent}>
      <div className={styles.expandedTitle}>
        <strong>Situaciones presentadas</strong>
        <span>{persona.situaciones.length}</span>
      </div>
      <TitularizacionSituaciones situaciones={persona.situaciones} />
    </div>
  );

  return (
    <section className={styles.tableSection}>
      <div className={styles.tableToolbar}>
        <div>
          <h2>Personas por DNI</h2>
          <p>Una fila por persona. Expandí cada fila para revisar todas sus situaciones.</p>
        </div>
        <span className="p-input-icon-left">
          <i className="pi pi-search" aria-hidden="true" />
          <InputText
            value={busqueda}
            onChange={(event) => setBusqueda(event.target.value)}
            placeholder="Buscar por DNI, apellido o nombre"
            aria-label="Buscar por DNI, apellido o nombre"
          />
        </span>
      </div>

      <DataTable
        value={personasFiltradas}
        dataKey="id"
        expandedRows={expandedRows}
        onRowToggle={(event) => setExpandedRows(event.data)}
        rowExpansionTemplate={rowExpansionTemplate}
        responsiveLayout="stack"
        breakpoint="768px"
        emptyMessage="No hay personas que coincidan con la búsqueda."
        className={styles.peopleTable}
      >
        <Column expander style={{ width: "3rem" }} />
        <Column field="dni" header="DNI" body={(persona) => dash(persona.dni)} />
        <Column header="Apellido y nombre" body={nombreTemplate} />
        <Column
          field="departamento"
          header="Departamento"
          body={(persona) => dash(persona.departamento)}
        />
        <Column
          header="Situaciones"
          body={(persona) => persona.situaciones.length}
        />
        <Column header="Estado inicial" body={estadoTemplate} />
        <Column header="Acciones" body={actionsTemplate} />
      </DataTable>

      <Dialog
        header="Detalle de persona"
        visible={Boolean(personaDetalle)}
        onHide={() => setPersonaDetalle(null)}
        modal
        style={{ width: "900px", maxWidth: "95vw" }}
      >
        {personaDetalle && (
          <div className={styles.personDetail}>
            <div className={styles.personDetailGrid}>
              {[
                ["Apellido y nombre", personaDetalle.nombreCompleto],
                ["DNI", personaDetalle.dni],
                ["Departamento", personaDetalle.departamento],
                ["Email", personaDetalle.email],
                ["Teléfono", personaDetalle.telefono],
              ].map(([label, value]) => (
                <div key={label}>
                  <span>{label}</span>
                  <strong>{dash(value)}</strong>
                </div>
              ))}
            </div>

            <h3>Todas las situaciones</h3>
            <TitularizacionSituaciones situaciones={personaDetalle.situaciones} />
          </div>
        )}
      </Dialog>
    </section>
  );
};

export default TitularizacionPersonasTable;
