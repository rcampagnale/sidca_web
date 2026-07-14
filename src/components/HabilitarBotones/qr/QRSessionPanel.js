// src/components/HabilitarBotones/qr/QRSessionPanel.js

import React from "react";
import { Button } from "primereact/button";
import { Dropdown } from "primereact/dropdown";
import { MultiSelect } from "primereact/multiselect";
import {
  INTERVALO_QR_OPTIONS,
  TIPO_REGISTRO_OPTIONS,
  formatFechaHoraAR,
  getTipoRegistroLabel,
  nowPlusMinutesLocalStr,
} from "./qrUtils.js";
import styles from "./qr.module.css";

const opcionesModalidad = [
  { label: "Virtual", value: "virtual" },
  { label: "Presencial (QR)", value: "presencial" },
];

const opcionesRequisitoPresencial = [
  { label: "No requiere presencial", value: "ninguno" },
  { label: "Al menos un encuentro presencial", value: "alguno" },
  { label: "Todos los encuentros presenciales", value: "todos" },
  { label: "Encuentros presenciales específicos", value: "especificos" },
];

const QRSessionPanel = ({
  asistenciaHabilitada,
  loadingAsistencia,
  asistenciaConfig,
  cursos,
  loadingCursos,
  selectedCursoId,
  setSelectedCursoId,
  selectedModalidad,
  setSelectedModalidad,
  requisitoPresencialVirtual,
  setRequisitoPresencialVirtual,
  encuentrosPresenciales,
  encuentrosPresencialesSeleccionados,
  setEncuentrosPresencialesSeleccionados,
  loadingEncuentrosPresenciales,
  tipoRegistro,
  setTipoRegistro,
  autoRefreshSeconds,
  setAutoRefreshSeconds,
  onHabilitar,
  desdeLocal,
  setDesdeLocal,
  hastaLocal,
  setHastaLocal,
  sesionActual,
  qrSync,
  onAbrirSesion,
  loadingSesion,
  onMostrarQR,
  onOpenSync,
  onRenovarCodigo,
  renovandoCodigo,
  onCerrarSesion,
}) => {
  const tipoActual = sesionActual?.tipoRegistro || sesionActual?.tipoMarcacion || tipoRegistro || "ingreso";

  return (
    <div className={styles.formGrid}>
      <div className={styles.formRowFull}>
        <label>1) Curso</label>
        <Dropdown
          value={selectedCursoId}
          onChange={(e) => setSelectedCursoId(e.value)}
          options={cursos}
          optionLabel="label"
          optionValue="value"
          placeholder={loadingCursos ? "Cargando cursos..." : "Seleccioná un curso"}
          panelClassName={styles.mobileDropdownPanel}
          loading={loadingCursos}
          filter
          showClear
          disabled={asistenciaHabilitada === "si" && !!sesionActual?.id}
        />
      </div>

      <div className={styles.formRowFull}>
        <label>2) Modalidad</label>
        <Dropdown
          value={selectedModalidad}
          onChange={(e) => setSelectedModalidad(e.value)}
          options={opcionesModalidad}
          optionLabel="label"
          optionValue="value"
          placeholder="Elegí la modalidad"
          panelClassName={styles.mobileDropdownPanel}
          disabled={asistenciaHabilitada === "si" && !!sesionActual?.id}
        />

        {selectedModalidad === "virtual" && (
          <small className={styles.helpText}>Modo virtual: se habilita asistencia sin QR.</small>
        )}

        {selectedModalidad === "presencial" && (
          <small className={styles.helpText}>
            Modo presencial: permite abrir una sesión QR sincronizada.
          </small>
        )}
      </div>

      {selectedModalidad === "virtual" && (
        <div className={styles.formRowFull}>
          <label>3) Requisito presencial</label>
          <Dropdown
            value={requisitoPresencialVirtual}
            onChange={(e) => setRequisitoPresencialVirtual(e.value)}
            options={opcionesRequisitoPresencial}
            optionLabel="label"
            optionValue="value"
            placeholder="Elegí el requisito presencial"
            panelClassName={styles.mobileDropdownPanel}
            disabled={
              loadingEncuentrosPresenciales ||
              (asistenciaHabilitada === "si" && !!asistenciaConfig?.habilitada)
            }
          />

          {loadingEncuentrosPresenciales && (
            <small className={styles.helpText}>
              Buscando encuentros presenciales completos...
            </small>
          )}

          {!loadingEncuentrosPresenciales && (
            <small className={styles.helpText}>
              Se encontraron {encuentrosPresenciales.length} encuentro(s)
              presencial(es) completos para este curso.
            </small>
          )}

          {requisitoPresencialVirtual === "especificos" && (
            <MultiSelect
              value={encuentrosPresencialesSeleccionados}
              onChange={(e) =>
                setEncuentrosPresencialesSeleccionados(e.value || [])
              }
              options={encuentrosPresenciales}
              optionLabel="label"
              optionValue="id"
              placeholder="Seleccioná los encuentros requeridos"
              panelClassName={styles.mobileDropdownPanel}
              display="chip"
              disabled={loadingEncuentrosPresenciales}
            />
          )}
        </div>
      )}

      <div className={styles.formRowFull}>
        <div className={styles.dialogActions}>
          <Button
            label="Habilitar"
            icon="pi pi-check"
            severity="success"
            onClick={() => onHabilitar(true)}
            disabled={
              !selectedCursoId ||
              !selectedModalidad ||
              loadingAsistencia ||
              asistenciaHabilitada === "si"
              || (selectedModalidad === "virtual" &&
                requisitoPresencialVirtual !== "ninguno" &&
                encuentrosPresenciales.length === 0)
              || (selectedModalidad === "virtual" &&
                requisitoPresencialVirtual === "especificos" &&
                encuentrosPresencialesSeleccionados.length === 0)
            }
            loading={loadingAsistencia}
          />

          <Button
            label="Deshabilitar"
            icon="pi pi-times"
            severity="danger"
            onClick={() => onHabilitar(false)}
            disabled={loadingAsistencia || asistenciaHabilitada !== "si"}
            loading={loadingAsistencia}
            outlined
          />
        </div>
      </div>

      {asistenciaHabilitada === "si" && asistenciaConfig?.modalidad === "presencial" && (
        <div className={styles.formRowFull}>
          <div className={styles.qrSessionCard}>
            <div className={styles.qrSessionHeader}>
              <strong>Sesión de Asistencia — QR presencial</strong>

              {sesionActual?.estado === "abierta" ? (
                <span className={styles.badgeSuccess}>
                  Abierta · {getTipoRegistroLabel(tipoActual)}
                </span>
              ) : (
                <span className={styles.badgeNeutral}>Sin sesión</span>
              )}
            </div>

            {!sesionActual?.id && (
              <>
                <div className={styles.formGrid}>
                  <div className={styles.formRow}>
                    <label>Tipo de registro</label>
                    <Dropdown
                      value={tipoRegistro}
                      onChange={(e) => setTipoRegistro(e.value)}
                      options={TIPO_REGISTRO_OPTIONS}
                      optionLabel="label"
                      optionValue="value"
                      placeholder="Ingreso o salida"
                    />
                  </div>

                  <div className={styles.formRow}>
                    <label>Actualizar QR cada</label>
                    <Dropdown
                      value={autoRefreshSeconds}
                      onChange={(e) => setAutoRefreshSeconds(e.value)}
                      options={INTERVALO_QR_OPTIONS}
                      optionLabel="label"
                      optionValue="value"
                      placeholder="Intervalo"
                    />
                  </div>

                  <div className={styles.formRow}>
                    <label>Desde</label>
                    <input
                      type="datetime-local"
                      value={desdeLocal}
                      onChange={(e) => setDesdeLocal(e.target.value)}
                      className={styles.nativeInput}
                    />
                  </div>

                  <div className={styles.formRow}>
                    <label>Hasta</label>
                    <input
                      type="datetime-local"
                      value={hastaLocal}
                      onChange={(e) => setHastaLocal(e.target.value)}
                      className={styles.nativeInput}
                    />
                  </div>
                </div>

                {!desdeLocal && !hastaLocal && (
                  <div className={styles.dialogActions}>
                    <Button
                      label="Usar +90 min"
                      icon="pi pi-clock"
                      severity="secondary"
                      outlined
                      onClick={() => {
                        setDesdeLocal(nowPlusMinutesLocalStr(0));
                        setHastaLocal(nowPlusMinutesLocalStr(90));
                      }}
                    />
                  </div>
                )}

                <div className={styles.dialogActions}>
                  <Button
                    label={`Abrir sesión de ${getTipoRegistroLabel(tipoRegistro).toLowerCase()}`}
                    icon="pi pi-play"
                    severity="success"
                    onClick={onAbrirSesion}
                    loading={loadingSesion}
                    disabled={
                      loadingSesion ||
                      !selectedCursoId ||
                      !tipoRegistro ||
                      !autoRefreshSeconds ||
                      !desdeLocal ||
                      !hastaLocal
                    }
                  />
                </div>
              </>
            )}

            {sesionActual?.id && (
              <>
                <div className={styles.sessionInfo}>
                  <div>
                    <b>Curso:</b> {sesionActual.cursoTitulo}
                  </div>
                  <div>
                    <b>Registro:</b>{" "}
                    <span>{getTipoRegistroLabel(tipoActual)}</span>
                  </div>
                  <div>
                    <b>Actualización automática:</b>{" "}
                    cada {sesionActual.autoRefreshSeconds || autoRefreshSeconds || 60} segundos
                  </div>
                  <div>
                    <b>Desde:</b> {formatFechaHoraAR(sesionActual.desde)}
                  </div>
                  <div>
                    <b>Hasta:</b> {formatFechaHoraAR(sesionActual.hasta)}
                  </div>
                  <div>
                    <b>Código:</b> <span>{sesionActual.codigo || "—"}</span>
                  </div>
                  <div>
                    <b>Sincronización:</b>{" "}
                    {qrSync?.habilitada ? (
                      <span className={styles.badgeSuccess}>Activa</span>
                    ) : (
                      <span className={styles.badgeNeutral}>Inactiva</span>
                    )}
                  </div>
                </div>

                <div className={styles.dialogActions}>
                  <Button
                    label="Mostrar QR en esta PC"
                    icon="pi pi-qrcode"
                    onClick={onMostrarQR}
                    severity="info"
                  />

                  <Button
                    label="Sincronización automática"
                    icon="pi pi-sync"
                    onClick={onOpenSync}
                    severity={qrSync?.habilitada ? "success" : "secondary"}
                  />

                  <Button
                    label="Renovar código ahora"
                    icon="pi pi-refresh"
                    onClick={onRenovarCodigo}
                    loading={renovandoCodigo}
                    severity="warning"
                    outlined
                  />

                  <Button
                    label="Cerrar sesión"
                    icon="pi pi-stop"
                    onClick={onCerrarSesion}
                    loading={loadingSesion}
                    severity="danger"
                  />
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default QRSessionPanel;
