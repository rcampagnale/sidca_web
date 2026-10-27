import React, { useMemo, useState } from "react";
import { Button } from "primereact/button";
import { Column } from "primereact/column";
import { DataTable } from "primereact/datatable";
import { Dialog } from "primereact/dialog";
import { InputText } from "primereact/inputtext";
import { Tag } from "primereact/tag";

import {
  buildVisiblePersonName,
  normalizeSearchText,
} from "../../../services/titularizacion/titularizacionNormalizer";
import { AFILIACION_ESTADOS_TITULARIZACION } from "../../../services/titularizacion/titularizacionIdentityService";
import { TITULARIZACION_SOURCE_ROLE_LABELS } from "../../../services/titularizacion/titularizacionService";
import TitularizacionSituaciones from "./TitularizacionSituaciones";
import styles from "../../../pages/Admin/OficinaGestion/Titularizacion/TitularizacionPage.module.css";

const dash = (value) => value || "—";

const activityLabel = (activity = {}) =>
  TITULARIZACION_SOURCE_ROLE_LABELS[activity.rolFuente || activity.rol] ||
  (activity.importId ? "Presentación SIDCA" : "Actuación administrativa");

const activityItemsFor = (persona = {}) => {
  const fromSources = [
    ...(Array.isArray(persona.sourceRefs) ? persona.sourceRefs : []),
    ...(Array.isArray(persona.fuentes) ? persona.fuentes : []),
  ];
  const fromEvents = (Array.isArray(persona.eventos) ? persona.eventos : []).map((evento) => ({
    ...evento,
    rol: evento.rolFuente || evento.rol,
  }));
  const seen = new Set();

  return [...fromSources, ...fromEvents].filter((item) => {
    const key = [
      item.sourceId || item.formularioId,
      item.rolFuente || item.rol,
      item.respuestaId || "",
      item.importId || "",
    ].join("|");
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};

const PersonActivity = ({ persona, empty = false }) => {
  const activities = activityItemsFor(persona);
  const hasEvents = (persona.eventos || []).length > 0 || activities.some((item) => item.rol === "reclamo" || item.rol === "reapertura");

  return (
    <div className={styles.personActivity}>
      {empty && (
        <div className={styles.emptySituationNotice}>
          <strong>
            {persona.tieneSolicitudEstructurada
              ? "SIN SITUACIÓN ESTRUCTURADA"
              : "SIN SOLICITUD ESTRUCTURADA"}
          </strong>
          <span>
            {persona.tieneSolicitudEstructurada
              ? "La persona está identificada por DNI, pero la solicitud estructurada no contiene situaciones."
              : "La persona está identificada por DNI en una fuente de antecedente, pero no en la solicitud estructurada YHe."}
          </span>
        </div>
      )}
      {activities.length > 0 && (
        <div>
          <h4>{hasEvents ? "Antecedentes / actuaciones" : "Fuentes registradas"}</h4>
          <div className={styles.activityTags}>
            {activities.map((activity, index) => (
              <Tag
                key={`${activity.sourceId || activity.formularioId || "fuente"}-${activity.respuestaId || index}`}
                value={activityLabel(activity)}
                severity={activity.rol === "reclamo" || activity.rol === "reapertura" ? "warning" : "info"}
              />
            ))}
          </div>
        </div>
      )}
      {persona.identitySources?.length > 0 && (
        <div>
          <h4>Origen de identidad</h4>
          <div className={styles.identitySourcesList}>
            {persona.identitySources.map((source) => (
              <span key={source.sourceType}>
                {source.sourceType}: {(source.fields || []).join(", ")}
              </span>
            ))}
          </div>
        </div>
      )}
      {persona.identityConflicts?.length > 0 && (
        <div className={styles.identityConflictNotice}>
          <strong>Conflictos de identidad conservados para revisión</strong>
          {persona.identityConflicts.map((conflict) => (
            <span key={conflict.field}>
              {conflict.field}: {(conflict.values || []).map((value) => `${value.value} (${value.source})`).join(" · ")}
            </span>
          ))}
        </div>
      )}
    </div>
  );
};

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
      severity={
        persona.estadoInicial === "SOLICITUD REGISTRADA"
          ? "success"
          : persona.estadoInicial === "SIN SITUACIÓN ESTRUCTURADA"
            ? "info"
            : "warning"
      }
    />
  );

  const nombreTemplate = (persona) => (
    <div className={styles.personNameCell}>
      <strong>{dash(buildVisiblePersonName(persona))}</strong>
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

  const afiliacionTemplate = (persona) => {
    const estado = persona.estadoAfiliacion || AFILIACION_ESTADOS_TITULARIZACION.NO_VERIFICADO;
    return (
      <Tag
        value={estado}
        severity={
          estado === AFILIACION_ESTADOS_TITULARIZACION.AFILIADO
            ? "success"
            : estado === AFILIACION_ESTADOS_TITULARIZACION.NO_AFILIADO
              ? "danger"
              : "secondary"
        }
      />
    );
  };

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
      {persona.situaciones.length > 0 ? (
        <>
          <div className={styles.expandedTitle}>
            <strong>Situaciones solicitadas</strong>
            <span>{persona.situaciones.length}</span>
          </div>
          <TitularizacionSituaciones situaciones={persona.situaciones} />
          <PersonActivity persona={persona} />
        </>
      ) : (
        <PersonActivity persona={persona} empty />
      )}
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
        <Column header="Afiliación" body={afiliacionTemplate} />
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
                ["Apellido y nombre", buildVisiblePersonName(personaDetalle)],
                ["DNI", personaDetalle.dni],
                ["Departamento", personaDetalle.departamento],
                ["Contacto", personaDetalle.contacto || personaDetalle.telefono],
                ["Email", personaDetalle.email],
                ["Teléfono", personaDetalle.telefono],
              ].map(([label, value]) => (
                <div key={label}>
                  <span>{label}</span>
                  <strong>{dash(value)}</strong>
                </div>
              ))}
            </div>

            <div className={styles.affiliationDetail}>
              <h3>Afiliación SIDCA</h3>
              <div className={styles.affiliationDetailGrid}>
                <div><span>Estado</span>{afiliacionTemplate(personaDetalle)}</div>
                <div><span>Origen</span><strong>{dash(personaDetalle.afiliacionSource)}</strong></div>
              </div>
            </div>

            <div className={styles.affiliationDetail}>
              <h3>Solicitud estructurada</h3>
              <strong>{personaDetalle.tieneSolicitudEstructurada ? "Sí" : "No"}</strong>
            </div>

            {personaDetalle.situaciones.length > 0 ? (
              <>
                <h3>Situaciones solicitadas</h3>
                <TitularizacionSituaciones situaciones={personaDetalle.situaciones} />
                <PersonActivity persona={personaDetalle} />
              </>
            ) : (
              <PersonActivity persona={personaDetalle} empty />
            )}
          </div>
        )}
      </Dialog>
    </section>
  );
};

export default TitularizacionPersonasTable;
