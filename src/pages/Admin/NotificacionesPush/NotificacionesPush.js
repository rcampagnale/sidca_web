import React, { useState } from "react";
import { InputText } from "primereact/inputtext";
import { InputTextarea } from "primereact/inputtextarea";
import { RadioButton } from "primereact/radiobutton";
import { Dropdown } from "primereact/dropdown";
import { Button } from "primereact/button";
import { ProgressSpinner } from "primereact/progressspinner";
import { confirmDialog } from "primereact/confirmdialog";

import {
  enviarNotificacionPushMasiva,
  enviarNotificacionPushPrueba,
} from "../../../services/pushNotificationsService";
import styles from "./styles.module.css";

const TITULO_INICIAL = "SiDCa - Tu Sindicato";

const DESTINOS = [
  { type: "open_app", label: "Información general", descripcion: "Al tocar la notificación se abrirá la APP SIDCA." },
  { type: "training", label: "Capacitaciones", descripcion: "Al tocarla se abrirá la sección de capacitaciones." },
  { type: "course_registration", label: "Inscripciones", descripcion: "Al tocarla se mostrarán los cursos disponibles para inscripción." },
  { type: "approved_courses", label: "Cursos aprobados", descripcion: "Al tocarla se abrirá la sección de cursos realizados/aprobados." },
  { type: "tourism", label: "Turismo", descripcion: "Al tocarla se abrirá Turismo." },
  { type: "agreements", label: "Red de Convenios", descripcion: "Al tocarla se abrirá la Red de Convenios." },
  { type: "office_management", label: "Oficina de Gestión", descripcion: "Al tocarla se abrirá la Oficina de Gestión." },
  { type: "external_url", label: "Enlace externo / YouTube", descripcion: "Al tocarla se abrirá el enlace indicado." },
];

const NotificacionesPush = () => {
  const [titulo, setTitulo] = useState(TITULO_INICIAL);
  const [mensaje, setMensaje] = useState("");
  const [destino, setDestino] = useState("open_app");
  const [urlDestino, setUrlDestino] = useState("");
  const [token, setToken] = useState("");
  const [destinatarios, setDestinatarios] = useState("prueba");
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState("");
  const [resultado, setResultado] = useState("");
  const [resumen, setResumen] = useState(null);

  const prepararNotificacion = (requiereToken) => {
    const tituloLimpio = titulo.trim();
    const mensajeLimpio = mensaje.trim();
    const tokenLimpio = token.trim();
    const urlLimpia = urlDestino.trim();
    const destinoSeleccionado = DESTINOS.find((opcion) => opcion.type === destino);

    if (!tituloLimpio || !mensajeLimpio || !destinoSeleccionado || (requiereToken && !tokenLimpio)) {
      setResultado("");
      setResumen(null);
      setError(requiereToken
        ? "Completá el título, el mensaje, el destino y el Expo Push Token."
        : "Completá el título, el mensaje y el destino.");
      return null;
    }

    if (destino === "external_url" && !/^https?:\/\/\S+$/i.test(urlLimpia)) {
      setResultado("");
      setResumen(null);
      setError("Completá una URL válida que comience con http:// o https://.");
      return null;
    }

    return {
      token: tokenLimpio,
      title: tituloLimpio,
      body: mensajeLimpio,
      data: {
        type: destino,
        ...(destino === "external_url" ? { url: urlLimpia } : {}),
      },
      destinoLabel: destinoSeleccionado.label,
      url: urlLimpia,
    };
  };

  const enviarPrueba = async (event) => {
    event.preventDefault();
    const datos = prepararNotificacion(true);
    if (!datos) return;

    setError("");
    setResultado("");
    setResumen(null);
    setEnviando(true);

    try {
      await enviarNotificacionPushPrueba({
        token: datos.token,
        title: datos.title,
        body: datos.body,
        data: datos.data,
      });
      setResultado("Notificación de prueba enviada correctamente.");
      setToken("");
    } catch (requestError) {
      setError(requestError.message || "No se pudo enviar la notificación.");
    } finally {
      setEnviando(false);
    }
  };

  const enviarMasivo = async (datos) => {
    setError("");
    setResultado("");
    setResumen(null);
    setEnviando(true);
    try {
      const respuesta = await enviarNotificacionPushMasiva(datos);
      setResumen(respuesta?.estadisticas || null);
      setResultado("Envío masivo completado correctamente.");
    } catch (requestError) {
      setError(requestError.message || "No se pudo enviar la notificación masiva.");
    } finally {
      setEnviando(false);
    }
  };

  const confirmarEnvioMasivo = () => {
    const datos = prepararNotificacion(false);
    if (!datos) return;

    confirmDialog({
      header: "Confirmar envío masivo",
      message: (
        <div className={styles.confirmContent}>
          <p>Esta notificación será enviada a todos los usuarios con notificaciones habilitadas. ¿Deseás continuar?</p>
          <strong>Título: {datos.title}</strong>
          <span>Mensaje: {datos.body}</span>
          <span>Destino: {datos.destinoLabel}</span>
          {datos.data.type === "external_url" && <span>URL: {datos.url}</span>}
        </div>
      ),
      acceptLabel: "Enviar a todos",
      rejectLabel: "Cancelar",
      accept: () => void enviarMasivo(datos),
    });
  };

  return (
    <section className={styles.container} aria-labelledby="push-title">
      <header className={styles.header}>
        <div>
          <h2 id="push-title">Notificaciones Push</h2>
          <p>Enviá notificaciones a los usuarios de la APP SIDCA.</p>
        </div>
        <i className="pi pi-bell" aria-hidden="true" />
      </header>

      <form className={styles.form} onSubmit={enviarPrueba}>
        <div className={styles.card}>
          <h3>Nueva notificación</h3>

          <label className={styles.field} htmlFor="push-title-input">
            <span>Título de la notificación</span>
            <InputText
              id="push-title-input"
              value={titulo}
              onChange={(event) => setTitulo(event.target.value)}
              disabled={enviando}
              required
            />
          </label>

          <label className={styles.field} htmlFor="push-message-input">
            <span>Mensaje</span>
            <InputTextarea
              id="push-message-input"
              value={mensaje}
              onChange={(event) => setMensaje(event.target.value)}
              rows={5}
              autoResize
              disabled={enviando}
              required
            />
            <small>{mensaje.length} caracteres</small>
          </label>

          <label className={styles.field} htmlFor="push-destination-input">
            <span>Destino al tocar la notificación</span>
            <Dropdown
              inputId="push-destination-input"
              value={destino}
              options={DESTINOS}
              optionLabel="label"
              optionValue="type"
              onChange={(event) => {
                setDestino(event.value);
                if (event.value !== "external_url") setUrlDestino("");
              }}
              disabled={enviando}
              className={styles.destinationDropdown}
            />
            <small>{DESTINOS.find((opcion) => opcion.type === destino)?.descripcion}</small>
          </label>

          {destino === "external_url" && (
            <label className={styles.field} htmlFor="push-destination-url">
              <span>URL de destino</span>
              <InputText
                id="push-destination-url"
                value={urlDestino}
                onChange={(event) => setUrlDestino(event.target.value)}
                placeholder="https://www.youtube.com/..."
                disabled={enviando}
                required
              />
            </label>
          )}
        </div>

        <div className={styles.card}>
          <h3>Destinatarios</h3>
          <div className={styles.radioGroup}>
            <label className={styles.radioOption} htmlFor="push-test-recipient">
              <RadioButton
                inputId="push-test-recipient"
                name="destinatarios"
                value="prueba"
                onChange={(event) => setDestinatarios(event.value)}
                checked={destinatarios === "prueba"}
                disabled={enviando}
              />
              <span>Envío de prueba</span>
            </label>
            <label className={styles.radioOption} htmlFor="push-all-recipient">
              <RadioButton
                inputId="push-all-recipient"
                name="destinatarios"
                value="todos"
                onChange={(event) => setDestinatarios(event.value)}
                checked={destinatarios === "todos"}
                disabled={enviando}
              />
              <span>
                Todos los usuarios con notificaciones habilitadas
                <small>La notificación se enviará desde el servidor sin exponer los tokens.</small>
              </span>
            </label>
          </div>
        </div>

        {destinatarios === "prueba" ? (
          <div className={styles.card}>
            <h3>Enviar prueba</h3>
            <label className={styles.field} htmlFor="expo-push-token">
              <span>Expo Push Token</span>
              <InputText
                id="expo-push-token"
                value={token}
                onChange={(event) => setToken(event.target.value)}
                placeholder="ExponentPushToken[...]"
                disabled={enviando}
                autoComplete="off"
                required
              />
            </label>
            <Button
              type="submit"
              label={enviando ? "Enviando..." : "Enviar prueba"}
              icon={enviando ? undefined : "pi pi-send"}
              disabled={enviando}
              className={styles.submitButton}
            />
            {enviando && <ProgressSpinner className={styles.spinner} />}
          </div>
        ) : (
          <div className={styles.card}>
            <h3>Enviar a todos</h3>
            <p className={styles.massiveHint}>Se enviará la notificación a todos los dispositivos con notificaciones habilitadas.</p>
            <Button
              type="button"
              label={enviando ? "Enviando..." : "Enviar a todos"}
              icon={enviando ? undefined : "pi pi-send"}
              disabled={enviando}
              onClick={confirmarEnvioMasivo}
              className={styles.submitButton}
            />
            {enviando && <ProgressSpinner className={styles.spinner} />}
          </div>
        )}

        {error && <p className={styles.error} role="alert">{error}</p>}
        {resultado && <p className={styles.success} role="status">{resultado}</p>}
        {resumen && (
          <div className={styles.summary} role="status">
            <h3>Envío completado</h3>
            <span>Usuarios consultados: {resumen.usuariosConsultados}</span>
            <span>Usuarios con notificaciones: {resumen.usuariosConTokens}</span>
            <span>Tokens válidos: {resumen.tokensValidos}</span>
            <span>Enviados: {resumen.enviados}</span>
            <span>Fallidos: {resumen.fallidos}</span>
            <span>Dispositivos no registrados: {resumen.deviceNotRegistered}</span>
          </div>
        )}
      </form>
    </section>
  );
};

export default NotificacionesPush;
