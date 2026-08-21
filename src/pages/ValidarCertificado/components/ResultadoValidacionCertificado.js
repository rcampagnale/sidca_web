import React from "react";
import { Dialog } from "primereact/dialog";
import styles from "../../Admin/Certificados/ValidarCertificadoQR.module.css";
import adminStyles from "../../Admin/Certificados/CertificadosAdmin.module.css";

export const formatInstitucionCertificado = (valor) => {
  const normalizado = String(valor || "").trim().toLowerCase();
  if (
    normalizado === "itm" ||
    normalizado.includes("instituto tecnologico municipal") ||
    normalizado.includes("instituto tecnológico municipal")
  ) {
    return "ITM — Instituto Tecnológico Municipal";
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
    second: "2-digit",
  });
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
}) => {
  if (!resultado || !presentacion) return null;
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
        <div className={styles.accionesResultado}>
          {registroError && <p className={styles.mensajeError} role="alert">No se pudo registrar el curso. {registroError}</p>}
          {registroInfo && <p className={styles.registroAviso} role="status">Este curso ya fue registrado por {registroInfo.usuario || registroInfo.usuarioNombre || registroInfo.registradoPorNombre || "otro usuario"} el {formatRegistroFecha(registroInfo.fecha || registroInfo.registradoEn)}.</p>}
          {resultado.tipo === "vigente" && <button type="button" className={adminStyles.botonPrimario} onClick={onRegistrarCurso} disabled={!onRegistrarCurso || registrando || registrado || Boolean(registroInfo)}>{registrado || registroInfo ? "Curso registrado" : registrando ? "Registrando…" : "Registrar curso"}</button>}
          <button type="button" className={adminStyles.botonPrimario} onClick={onEscanearOtro}>Escanear otro certificado</button>
        </div>
      </section>
    </Dialog>
  );
};

export default ResultadoValidacionCertificado;
