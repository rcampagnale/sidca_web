import React, { useEffect, useRef, useState } from "react";
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
  crearNotificacionProgramada,
  listarNotificacionesProgramadas,
  editarNotificacionProgramada,
  cancelarNotificacionProgramada,
  enviarNotificacionProgramadaAhora,
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
const ZONA_HORARIA = "America/Argentina/Buenos_Aires";

const partesFechaArgentina = (valor = new Date()) => {
  const fecha = valor?.toDate?.() || new Date(valor);
  const partes = new Intl.DateTimeFormat("en-CA", {
    timeZone: ZONA_HORARIA,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(fecha);
  return Object.fromEntries(partes.filter((parte) => parte.type !== "literal").map((parte) => [parte.type, parte.value]));
};

const fechaActualArgentina = () => {
  const partes = partesFechaArgentina();
  return `${partes.year}-${partes.month}-${partes.day}`;
};

const isoDesdeArgentina = (fecha, hora) => {
  if (!fecha || !hora) return "";
  return new Date(`${fecha}T${hora}:00-03:00`).toISOString();
};

const fechaHoraArgentinaDesdeIso = (valor) => {
  const partes = partesFechaArgentina(valor);
  return {
    fecha: `${partes.year}-${partes.month}-${partes.day}`,
    hora: `${partes.hour}:${partes.minute}`,
  };
};

const formatearFechaHoraArgentina = (valor) => {
  const fecha = valor?.toDate?.() || (valor ? new Date(valor) : null);
  if (!fecha || Number.isNaN(fecha.getTime())) return "—";
  return new Intl.DateTimeFormat("es-AR", {
    timeZone: ZONA_HORARIA,
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(fecha);
};

const destinoLabel = (type) => DESTINOS.find((opcion) => opcion.type === type)?.label || type || "—";

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
  const [modoEnvio, setModoEnvio] = useState("ahora");
  const [fechaProgramada, setFechaProgramada] = useState(fechaActualArgentina);
  const [horaProgramada, setHoraProgramada] = useState("");
  const [programadaEditandoId, setProgramadaEditandoId] = useState("");
  const [programadas, setProgramadas] = useState([]);
  const [cargandoProgramadas, setCargandoProgramadas] = useState(true);
  const [actualizandoProgramadas, setActualizandoProgramadas] = useState(false);
  const actualizandoProgramadasRef = useRef(false);
  const montadoRef = useRef(true);

  const cargarProgramadas = async ({ silencioso = false } = {}) => {
    if (actualizandoProgramadasRef.current) return;
    actualizandoProgramadasRef.current = true;
    setActualizandoProgramadas(true);
    if (!silencioso) setCargandoProgramadas(true);
    try {
      const respuesta = await listarNotificacionesProgramadas();
      if (montadoRef.current) {
        setProgramadas(Array.isArray(respuesta?.notificaciones) ? respuesta.notificaciones : []);
      }
    } catch (requestError) {
      if (silencioso) {
        console.error("[NotificacionesPush] No se pudo actualizar el historial programado.", requestError);
      } else if (montadoRef.current) {
        setError(requestError.message || "No se pudieron cargar las notificaciones programadas.");
      }
    } finally {
      actualizandoProgramadasRef.current = false;
      if (montadoRef.current) {
        setActualizandoProgramadas(false);
        setCargandoProgramadas(false);
      }
    }
  };

  useEffect(() => {
    void cargarProgramadas();
    return () => {
      montadoRef.current = false;
    };
  }, []);

  useEffect(() => {
    const actualizarSiVisible = () => {
      if (document.visibilityState === "visible") {
        void cargarProgramadas({ silencioso: true });
      }
    };

    const intervalo = window.setInterval(actualizarSiVisible, 15000);
    const manejarVisibilidad = () => {
      if (document.visibilityState === "visible") actualizarSiVisible();
    };

    document.addEventListener("visibilitychange", manejarVisibilidad);
    window.addEventListener("focus", actualizarSiVisible);

    return () => {
      window.clearInterval(intervalo);
      document.removeEventListener("visibilitychange", manejarVisibilidad);
      window.removeEventListener("focus", actualizarSiVisible);
    };
  }, []);

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

    if (urlLimpia && !/^https?:\/\/\S+$/i.test(urlLimpia)) {
      setResultado("");
      setResumen(null);
      setError("El enlace debe comenzar con http:// o https://.");
      return null;
    }

    if (destino === "external_url" && !urlLimpia) {
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
        ...(urlLimpia ? { url: urlLimpia } : {}),
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

  const prepararProgramacion = () => {
    const datos = prepararNotificacion(false);
    if (!datos) return null;
    if (!fechaProgramada || !horaProgramada) {
      setError("Completá la fecha y la hora de programación.");
      return null;
    }
    const programadaParaIso = isoDesdeArgentina(fechaProgramada, horaProgramada);
    if (!programadaParaIso || new Date(programadaParaIso).getTime() <= Date.now() - 10000) {
      setError("La fecha y hora deben ser futuras según el horario de Argentina.");
      return null;
    }
    return { ...datos, programadaParaIso };
  };

  const confirmarProgramacion = () => {
    const datos = prepararProgramacion();
    if (!datos) return;
    const fechaVisible = `${fechaProgramada.split("-").reverse().join("/")} ${horaProgramada}`;
    confirmDialog({
      header: "Confirmar programación",
      message: (
        <div className={styles.confirmContent}>
          <strong>Fecha: {fechaVisible}</strong>
          <span>Horario: Argentina</span>
          <span>Título: {datos.title}</span>
          <span>Mensaje: {datos.body}</span>
          <span>Destino: {datos.destinoLabel}</span>
          {datos.url && <span>Enlace: {datos.url}</span>}
        </div>
      ),
      acceptLabel: "Programar",
      rejectLabel: "Cancelar",
      accept: async () => {
        setEnviando(true);
        setError("");
        setResultado("");
        try {
          if (programadaEditandoId) {
            await editarNotificacionProgramada(programadaEditandoId, {
              title: datos.title,
              body: datos.body,
              data: datos.data,
              programadaParaIso: datos.programadaParaIso,
            });
            setResultado("Notificación programada actualizada correctamente.");
          } else {
            await crearNotificacionProgramada({
              title: datos.title,
              body: datos.body,
              data: datos.data,
              programadaParaIso: datos.programadaParaIso,
              tipoOrigen: "push",
              origenId: null,
            });
            setResultado("Notificación programada correctamente.");
          }
          setProgramadaEditandoId("");
          await cargarProgramadas();
        } catch (requestError) {
          setError(requestError.message || "No se pudo guardar la programación.");
        } finally {
          setEnviando(false);
        }
      },
    });
  };

  const editarProgramada = (notificacion) => {
    const fechaHora = fechaHoraArgentinaDesdeIso(notificacion.programadaPara);
    setProgramadaEditandoId(notificacion.id);
    setTitulo(notificacion.title || "");
    setMensaje(notificacion.body || "");
    setDestino(notificacion.data?.type || "open_app");
    setUrlDestino(notificacion.data?.url || "");
    setFechaProgramada(fechaHora.fecha);
    setHoraProgramada(fechaHora.hora);
    setDestinatarios("todos");
    setModoEnvio("programar");
    setResultado("Editando notificación pendiente.");
    setError("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const confirmarEnviarAhora = (notificacion) => {
    confirmDialog({
      header: "Enviar notificación ahora",
      message: `Esta notificación está programada para ${formatearFechaHoraArgentina(notificacion.programadaPara)}. ¿Deseás enviarla ahora?`,
      acceptLabel: "Enviar ahora",
      rejectLabel: "Cancelar",
      accept: async () => {
        setEnviando(true);
        setError("");
        try {
          const respuesta = await enviarNotificacionProgramadaAhora(notificacion.id);
          setResumen(respuesta?.estadisticas || null);
          setResultado("Notificación programada enviada correctamente.");
          await cargarProgramadas();
        } catch (requestError) {
          setError(requestError.message || "No se pudo enviar la notificación.");
        } finally {
          setEnviando(false);
        }
      },
    });
  };

  const confirmarCancelar = (notificacion) => {
    confirmDialog({
      header: "Cancelar notificación programada",
      message: "¿Deseás cancelar esta notificación programada?",
      acceptLabel: "Cancelar envío",
      rejectLabel: "Volver",
      accept: async () => {
        setEnviando(true);
        try {
          await cancelarNotificacionProgramada(notificacion.id);
          setResultado("Notificación programada cancelada.");
          await cargarProgramadas();
        } catch (requestError) {
          setError(requestError.message || "No se pudo cancelar la notificación.");
        } finally {
          setEnviando(false);
        }
      },
    });
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
          {datos.url && <span>Enlace: {datos.url}</span>}
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
              onChange={(event) => setDestino(event.value)}
              disabled={enviando}
              className={styles.destinationDropdown}
            />
            <small>{DESTINOS.find((opcion) => opcion.type === destino)?.descripcion}</small>
          </label>

          <label className={styles.field} htmlFor="push-destination-url">
            <span>{destino === "external_url" ? "Enlace de destino" : "Enlace opcional"}</span>
            <InputText
              id="push-destination-url"
              value={urlDestino}
              onChange={(event) => setUrlDestino(event.target.value)}
              placeholder="https://..."
              disabled={enviando}
              required={destino === "external_url"}
            />
            <small>Si indicás un enlace, tendrá prioridad al tocar la notificación. Si lo dejás vacío, se abrirá el destino seleccionado en la APP.</small>
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
                onChange={(event) => {
                  setDestinatarios(event.value);
                  setModoEnvio("ahora");
                  setProgramadaEditandoId("");
                }}
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
          {destinatarios === "todos" && (
            <div className={styles.sendMode}>
              <span className={styles.modeTitle}>Enviar</span>
              <label className={styles.radioOption} htmlFor="push-send-now">
                <RadioButton
                  inputId="push-send-now"
                  name="modo-envio"
                  value="ahora"
                  onChange={(event) => {
                    setModoEnvio(event.value);
                    setProgramadaEditandoId("");
                  }}
                  checked={modoEnvio === "ahora"}
                  disabled={enviando}
                />
                <span>Ahora</span>
              </label>
              <label className={styles.radioOption} htmlFor="push-send-scheduled">
                <RadioButton
                  inputId="push-send-scheduled"
                  name="modo-envio"
                  value="programar"
                  onChange={(event) => setModoEnvio(event.value)}
                  checked={modoEnvio === "programar"}
                  disabled={enviando}
                />
                <span>Programar envío</span>
              </label>
            </div>
          )}
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
            <h3>{modoEnvio === "programar" ? "Programar notificación" : "Enviar a todos"}</h3>
            <p className={styles.massiveHint}>{modoEnvio === "programar" ? "Horario de Argentina" : "Se enviará la notificación a todos los dispositivos con notificaciones habilitadas."}</p>
            {modoEnvio === "programar" && (
              <div className={styles.scheduleFields}>
                <label className={styles.field} htmlFor="push-scheduled-date">
                  <span>Fecha</span>
                  <InputText
                    id="push-scheduled-date"
                    type="date"
                    min={fechaActualArgentina()}
                    value={fechaProgramada}
                    onChange={(event) => setFechaProgramada(event.target.value)}
                    disabled={enviando}
                  />
                </label>
                <label className={styles.field} htmlFor="push-scheduled-time">
                  <span>Hora</span>
                  <InputText
                    id="push-scheduled-time"
                    type="time"
                    value={horaProgramada}
                    onChange={(event) => setHoraProgramada(event.target.value)}
                    disabled={enviando}
                  />
                </label>
              </div>
            )}
            <Button
              type="button"
              label={enviando ? "Enviando..." : modoEnvio === "programar" ? (programadaEditandoId ? "Guardar cambios" : "Programar notificación") : "Enviar a todos"}
              icon={enviando ? undefined : modoEnvio === "programar" ? "pi pi-calendar-plus" : "pi pi-send"}
              disabled={enviando}
              onClick={modoEnvio === "programar" ? confirmarProgramacion : confirmarEnvioMasivo}
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
            {typeof resumen.tokensDepurados === "number" && <span>Tokens depurados: {resumen.tokensDepurados}</span>}
          </div>
        )}
      </form>

      <section className={styles.scheduledSection} aria-labelledby="scheduled-title">
        <div className={styles.sectionHeading}>
          <h3 id="scheduled-title">Notificaciones programadas</h3>
          <Button type="button" label={actualizandoProgramadas ? "Actualizando..." : "Actualizar"} icon="pi pi-refresh" className="p-button-text" onClick={() => cargarProgramadas()} disabled={enviando || actualizandoProgramadas} />
        </div>
        {cargandoProgramadas ? <p className={styles.muted}>Cargando programaciones...</p> : !programadas.length ? <p className={styles.muted}>Todavía no hay notificaciones programadas.</p> : (
          <div className={styles.scheduledList}>
            {programadas.map((notificacion) => (
              <article className={styles.scheduledItem} key={notificacion.id}>
                <div className={styles.scheduledInfo}>
                  <strong>{notificacion.title}</strong>
                  <span>{formatearFechaHoraArgentina(notificacion.programadaPara)} · {destinoLabel(notificacion.data?.type)}</span>
                  <span className={`${styles.statusBadge} ${styles[`status${String(notificacion.estado || "")[0]?.toUpperCase()}${String(notificacion.estado || "").slice(1)}`]}`}>{String(notificacion.estado || "").toUpperCase()}</span>
                </div>
                <div className={styles.scheduledActions}>
                  {notificacion.estado === "pendiente" && <>
                    <Button type="button" label="Editar" icon="pi pi-pencil" onClick={() => editarProgramada(notificacion)} disabled={enviando} />
                    <Button type="button" label="Enviar ahora" icon="pi pi-send" onClick={() => confirmarEnviarAhora(notificacion)} disabled={enviando} />
                    <Button type="button" label="Cancelar" icon="pi pi-ban" severity="secondary" onClick={() => confirmarCancelar(notificacion)} disabled={enviando} />
                  </>}
                  {notificacion.estado === "enviada" && notificacion.estadisticas && <span>Enviados: {notificacion.estadisticas.enviados} · Fallidos: {notificacion.estadisticas.fallidos}</span>}
                  {notificacion.estado === "error" && <span className={styles.errorText}>{notificacion.ultimoError || "Error al procesar"}</span>}
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </section>
  );
};

export default NotificacionesPush;
