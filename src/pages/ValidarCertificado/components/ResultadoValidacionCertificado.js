import React, { useState } from "react";
import { Dialog } from "primereact/dialog";
import styles from "../../Admin/Certificados/ValidarCertificadoQR.module.css";
import adminStyles from "../../Admin/Certificados/CertificadosAdmin.module.css";

export const formatInstitucionCertificado = (valor) => {
  const normalizado = String(valor || "").trim().toLowerCase();
  if (normalizado === "sidca") {
    return "SIDCA";
  }
  if (
    normalizado === "itm" ||
    normalizado.includes("instituto tecnologico municipal") ||
    normalizado.includes("instituto tecnológico municipal")
  ) {
    return "Instituto Tecnológico Municipal";
  }
  if (normalizado === "ministerio") {
    return "Ministerio de Educación y Trabajo";
  }
  return String(valor || "").trim();
};

const formatRegistroFecha = (valor) => {
  const texto = String(valor || "").trim();
  if (!texto) return "una fecha anterior";
  const fecha = new Date(texto);
  if (Number.isNaN(fecha.getTime())) return texto;
  return fecha.toLocaleString("es-AR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).replace(", ", " a las ");
};

/** Resultado compartido: conserva la misma composición visual del panel admin. */
const ResultadoValidacionCertificado = ({
  resultado,
  presentacion,
  filas,
  mostrarDatos = true,
  registrado = false,
  registrando = false,
  onRegistrarCurso,
  onEscanearOtro,
  onCerrar,
  registroInfo,
  registroError,
  mostrarRegistro = true,
}) => {
  const [modalRegistroVisible, setModalRegistroVisible] = useState(false);
  if (!resultado || !presentacion) return null;
  const verificacion = resultado.validacion?.verificacion || {};
  const niveles = (valor) => Array.isArray(valor) ? valor.filter(Boolean) : [];
  const chips = (valor) => niveles(valor).map((nivel) => <span className={styles.chip} key={nivel}>{nivel}</span>);
  const modoJunta = Boolean(verificacion.juntaValidador || verificacion.motivoNoRegistro);
  const yaRegistradoEnJunta = Boolean(verificacion.registroJuntaActual || registroInfo);
  const puedeRegistrar = verificacion.puedeRegistrarEnJunta === true || (!verificacion.juntaValidador && !verificacion.motivoNoRegistro && !registroInfo);
  const estadoRegistro = yaRegistradoEnJunta ? "Registrado en esta Junta" : puedeRegistrar ? "Registrar curso" : "No corresponde a tu Junta";
  const filasPresentacion = (filas || []).map(([etiqueta, valor]) => [
    etiqueta,
    String(etiqueta || "").toLowerCase().startsWith("instit")
      ? formatInstitucionCertificado(valor)
      : valor,
  ]);

  return (
    <Dialog header="Resultado de la validación" visible modal closable onHide={onCerrar} className={styles.dialogoResultado}>
      <section>
        <div className={`${styles.resultado} ${styles[presentacion.clase]}`} role="status" aria-live="polite">
          <span className={styles.resultadoIcono} aria-hidden="true">{presentacion.icono}</span>
          <div>
            <p className={styles.resultadoTitulo}>{presentacion.titulo}</p>
            <p className={styles.resultadoDetalle}>{presentacion.detalle}</p>
          </div>
        </div>
        {mostrarDatos && (
          <dl className={styles.datos}>
            {filasPresentacion.map(([etiqueta, valor]) => (
              <div key={etiqueta} className={`${styles.dato} ${String(etiqueta || "").toLowerCase().startsWith("instit") ? styles.datoAmplio : ""}`}>
                <dt className={styles.datoEtiqueta}>{etiqueta}</dt>
                <dd className={styles.datoValor}>{valor}</dd>
              </div>
            ))}
          </dl>
        )}
        {resultado.tipo === "vigente" && verificacion && (verificacion.juntaValidador || verificacion.motivoNoRegistro || niveles(verificacion.nivelesCertificado).length > 0) && (
          <section className={styles.bloqueInstitucional} aria-label="Información de Junta de Clasificación">
            <div className={styles.juntaSesion}><span className={styles.bloqueEtiqueta}>JUNTA DE CLASIFICACIÓN</span><strong>{verificacion.juntaValidadorEtiqueta || "Junta no asignada"}</strong></div>
            <div className={styles.nivelesGrid}>
              <div><span className={styles.bloqueEtiqueta}>NIVELES DEL CERTIFICADO</span><div className={styles.chips}>{chips(verificacion.nivelesCertificado)}</div></div>
              <div><span className={styles.bloqueEtiqueta}>NIVELES QUE HABILITAN ESTA JUNTA</span><div className={styles.chips}>{chips(verificacion.nivelesQueHabilitanJuntaActual)}</div></div>
            </div>
            {verificacion.motivoNoRegistro && !yaRegistradoEnJunta && <p className={styles.mensajeJunta}>{verificacion.motivoNoRegistro}</p>}
          </section>
        )}
        <div className={styles.accionesResultado}>
          {registroError && <p className={styles.mensajeError} role="alert">No se pudo registrar el curso. {registroError}</p>}
          {registroInfo && <p className={styles.registroAviso} role="status">Este curso ya fue registrado por {registroInfo.usuario || registroInfo.usuarioNombre || registroInfo.registradoPorNombre || "otro usuario"} el {formatRegistroFecha(registroInfo.fecha || registroInfo.registradoEn)}.</p>}
          {mostrarRegistro && resultado.tipo === "vigente" && <button type="button" className={adminStyles.botonPrimario} onClick={modoJunta ? () => setModalRegistroVisible(true) : onRegistrarCurso} disabled={!onRegistrarCurso || registrando || registrado || (modoJunta ? yaRegistradoEnJunta || !puedeRegistrar : Boolean(registroInfo))}>{registrado || yaRegistradoEnJunta ? estadoRegistro : registrando ? "Registrando…" : estadoRegistro}</button>}
          <button type="button" className={adminStyles.botonPrimario} onClick={onEscanearOtro}>Escanear otro certificado</button>
        </div>
        {modoJunta && <Dialog header="Registrar certificado" visible={modalRegistroVisible} modal closable onHide={() => setModalRegistroVisible(false)} className={styles.dialogoRegistro}>
          <div className={styles.confirmacionRegistro}>
            <div><span className={styles.bloqueEtiqueta}>CERTIFICADO</span><strong>{resultado.validacion?.certificado?.titulo || resultado.validacion?.certificado?.cursoTitulo || "Sin título"}</strong></div>
            <div><span className={styles.bloqueEtiqueta}>PARTICIPANTE</span><strong>{resultado.validacion?.participante?.apellidoNombre || "Sin dato"}</strong><span>DNI: {resultado.validacion?.participante?.dni || "Sin dato"}</span></div>
            <div className={styles.confirmacionNiveles}><span className={styles.bloqueEtiqueta}>NIVELES DEL CERTIFICADO</span><div className={styles.chips}>{chips(verificacion.nivelesCertificado)}</div></div>
            <div className={styles.confirmacionNiveles}><span className={styles.bloqueEtiqueta}>NIVELES QUE HABILITAN ESTA JUNTA</span><div className={styles.chips}>{chips(verificacion.nivelesQueHabilitanJuntaActual)}</div></div>
            <div><span className={styles.bloqueEtiqueta}>JUNTA EN LA QUE SE REGISTRARÁ</span><strong>{verificacion.juntaValidadorEtiqueta || "Junta no asignada"}</strong></div>
            <div><span className={styles.bloqueEtiqueta}>FECHA DEL CERTIFICADO</span><strong>{resultado.validacion?.certificado?.fecha || "Sin fecha"}</strong></div>
            <p>Este registro quedará asociado a tu Junta de Clasificación.</p>
            <div className={styles.confirmacionAcciones}><button type="button" className={adminStyles.botonSecundario} onClick={() => setModalRegistroVisible(false)}>Cancelar</button><button type="button" className={adminStyles.botonPrimario} onClick={() => { setModalRegistroVisible(false); onRegistrarCurso?.(); }} disabled={registrando}>{registrando ? "Registrando…" : "Confirmar registro"}</button></div>
          </div>
        </Dialog>}
      </section>
    </Dialog>
  );
};

export default ResultadoValidacionCertificado;
