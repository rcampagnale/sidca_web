import React, { useState } from "react";
import { InputText } from "primereact/inputtext";
import { InputTextarea } from "primereact/inputtextarea";
import { RadioButton } from "primereact/radiobutton";
import { Button } from "primereact/button";
import { ProgressSpinner } from "primereact/progressspinner";

import { enviarNotificacionPushPrueba } from "../../../services/pushNotificationsService";
import styles from "./styles.module.css";

const TITULO_INICIAL = "SiDCa - Tu Sindicato";

const NotificacionesPush = () => {
  const [titulo, setTitulo] = useState(TITULO_INICIAL);
  const [mensaje, setMensaje] = useState("");
  const [token, setToken] = useState("");
  const [destinatarios, setDestinatarios] = useState("prueba");
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState("");
  const [resultado, setResultado] = useState("");

  const enviarPrueba = async (event) => {
    event.preventDefault();
    const tituloLimpio = titulo.trim();
    const mensajeLimpio = mensaje.trim();
    const tokenLimpio = token.trim();

    if (!tituloLimpio || !mensajeLimpio || !tokenLimpio) {
      setResultado("");
      setError("Completá el título, el mensaje y el Expo Push Token.");
      return;
    }

    setError("");
    setResultado("");
    setEnviando(true);

    try {
      await enviarNotificacionPushPrueba({
        token: tokenLimpio,
        title: tituloLimpio,
        body: mensajeLimpio,
      });
      setResultado("Notificación enviada correctamente.");
      setToken("");
    } catch (requestError) {
      setError(requestError.message || "No se pudo enviar la notificación.");
    } finally {
      setEnviando(false);
    }
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
            <label className={`${styles.radioOption} ${styles.disabledOption}`} htmlFor="push-all-recipient">
              <RadioButton
                inputId="push-all-recipient"
                name="destinatarios"
                value="todos"
                onChange={(event) => setDestinatarios(event.value)}
                checked={destinatarios === "todos"}
                disabled
              />
              <span>
                Todos los usuarios con notificaciones habilitadas
                <small>Envío masivo pendiente de habilitación en el servidor.</small>
              </span>
            </label>
          </div>
        </div>

        {destinatarios === "prueba" && (
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
        )}

        {error && <p className={styles.error} role="alert">{error}</p>}
        {resultado && <p className={styles.success} role="status">{resultado}</p>}
      </form>
    </section>
  );
};

export default NotificacionesPush;
