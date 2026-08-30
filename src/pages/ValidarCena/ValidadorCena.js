import React, { useCallback, useEffect, useRef, useState } from "react";
import { useHistory, useParams } from "react-router-dom";

import ValidatorHeader from "../../components/Layout/Header/ValidatorHeader/ValidatorHeader";
import LoginGestionInstitucional from "../../components/GestionInstitucional/LoginGestionInstitucional";
import useSesionValidador from "../ValidarCertificado/components/useSesionValidador";
import {
  cerrarSesionValidador,
  consultarReservaCenaPorDni,
  consultarTarjetaCenaQr,
  descartarSesionValidadorVencida,
  registrarActividadValidador,
  registrarTarjetaCena,
  sesionValidadorExpirada,
} from "../../services/cenaValidacionService";
import ScannerCenaQR from "./components/ScannerCenaQR";
import ReservaCenaValidador from "./components/ReservaCenaValidador";
import TarjetasReservaValidador from "./components/TarjetasReservaValidador";
import ResultadoCenaQR from "./components/ResultadoCenaQR";
import "../../styles/institutional.css";
import styles from "./ValidadorCena.module.css";
import "./ValidadorCenaShared.css";

const anioActual = String(new Date().getFullYear());
const INTERVALO_DEDUPLICACION_MS = 1800;

const vibrar = (patron) => {
  if (typeof navigator === "undefined" || !("vibrate" in navigator)) return;
  try { navigator.vibrate(patron); } catch (error) { /* El feedback háptico es opcional. */ }
};

const ValidadorCena = () => {
  const { token: tokenRuta } = useParams();
  const history = useHistory();
  const { cargando, validador, principal, origenSesion } = useSesionValidador();
  const [principalRechazada, setPrincipalRechazada] = useState(false);
  const [vista, setVista] = useState("qr");
  const [scannerAbierto, setScannerAbierto] = useState(false);
  const [validacion, setValidacion] = useState(null);
  const [resultadoRegistro, setResultadoRegistro] = useState("");
  const [tokenConsultado, setTokenConsultado] = useState("");
  const [dni, setDni] = useState("");
  const [anio, setAnio] = useState(anioActual);
  const [consultando, setConsultando] = useState(false);
  const [registrando, setRegistrando] = useState(false);
  const [error, setError] = useState("");
  const lecturaBloqueada = useRef(false);
  const consultaBloqueada = useRef(false);
  const registroBloqueado = useRef(false);
  const ultimoTokenEscaneado = useRef("");
  const momentoUltimoEscaneo = useRef(0);

  const sesion = validador || (!principalRechazada ? principal : null);
  const origen = validador ? "validador" : sesion ? "principal" : "";

  const manejarErrorSesion = useCallback(async (fallo, origenActual) => {
    const status = Number(fallo?.status || 0);
    if (origenActual === "principal" && (status === 401 || status === 403)) {
      setPrincipalRechazada(true);
      setValidacion(null);
      return true;
    }
    if (origenActual === "validador" && status === 401) {
      try { await cerrarSesionValidador(); } catch (errorCierre) { /* el formulario queda disponible */ }
    }
    return false;
  }, []);

  const liberarLectura = useCallback(() => {
    lecturaBloqueada.current = false;
    ultimoTokenEscaneado.current = "";
    momentoUltimoEscaneo.current = 0;
  }, []);

  const consultarQr = useCallback(async (token, usuario = sesion, origenActual = origen) => {
    if (!token || !usuario) return;
    if (consultaBloqueada.current) return;
    if (origenActual === "validador" && sesionValidadorExpirada()) {
      await descartarSesionValidadorVencida();
      return;
    }
    consultaBloqueada.current = true;
    setVista("qr");
    setConsultando(true);
    setError("");
    setValidacion(null);
    setResultadoRegistro("");
    try {
      const resultado = await consultarTarjetaCenaQr(token, { usuarioFirebase: usuario });
      setTokenConsultado(token);
      setValidacion(resultado);
      if (resultado?.estado === "validada") vibrar([35, 25, 35]);
      if (origenActual === "validador") registrarActividadValidador();
    } catch (fallo) {
      vibrar([55, 35, 55]);
      if (!(await manejarErrorSesion(fallo, origenActual))) setError(fallo?.message || "No se pudo consultar la tarjeta.");
    } finally {
      setConsultando(false);
      consultaBloqueada.current = false;
    }
  }, [manejarErrorSesion, origen, sesion]);

  useEffect(() => {
    if (!tokenRuta || cargando || !sesion) return;
    consultarQr(tokenRuta);
  }, [cargando, consultarQr, sesion, tokenRuta]);

  useEffect(() => {
    if (validador) setPrincipalRechazada(false);
  }, [validador]);

  const escanear = useCallback((token) => {
    const ahora = Date.now();
    if (lecturaBloqueada.current || (token === ultimoTokenEscaneado.current && ahora - momentoUltimoEscaneo.current < INTERVALO_DEDUPLICACION_MS)) return;
    lecturaBloqueada.current = true;
    ultimoTokenEscaneado.current = token;
    momentoUltimoEscaneo.current = ahora;
    setScannerAbierto(false);
    setVista("qr");
    setConsultando(true);
    setError("");
    setValidacion(null);
    setResultadoRegistro("");
    setTokenConsultado(token);
    history.push(`/validar-cena/${encodeURIComponent(token)}`);
  }, [history]);

  const cambiarVista = (siguienteVista) => {
    if (siguienteVista === vista) return;
    setVista(siguienteVista);
    setScannerAbierto(siguienteVista === "qr");
    liberarLectura();
    setError("");
    setValidacion(null);
    setResultadoRegistro("");
    setTokenConsultado("");
    history.replace("/validar-cena");
  };

  const buscarDni = async (evento) => {
    evento.preventDefault();
    if (!sesion) return;
    setConsultando(true);
    setError("");
    setValidacion(null);
    setTokenConsultado("");
    try {
      const resultado = await consultarReservaCenaPorDni(anio, dni, { usuarioFirebase: sesion });
      setValidacion(resultado);
      history.replace("/validar-cena");
      if (origen === "validador") registrarActividadValidador();
    } catch (fallo) {
      if (!(await manejarErrorSesion(fallo, origen))) setError(fallo?.message || "No se pudo consultar el DNI.");
    } finally {
      setConsultando(false);
    }
  };

  const registrar = async () => {
    if (!tokenConsultado || !sesion || registrando || registroBloqueado.current || !validacion?.puedeAcreditar) return;
    if (!window.confirm("¿Confirmás el ingreso de esta tarjeta? Esta acción quedará registrada.")) return;
    registroBloqueado.current = true;
    setRegistrando(true);
    setError("");
    try {
      const respuesta = await registrarTarjetaCena(tokenConsultado, { usuarioFirebase: sesion });
      setValidacion(respuesta.validacion);
      setResultadoRegistro(respuesta.resultado === "registrada" ? "registrada" : "ya_registrada");
      vibrar(respuesta.resultado === "registrada" ? [55] : [35, 25, 35]);
      if (origen === "validador") registrarActividadValidador();
    } catch (fallo) {
      vibrar([55, 35, 55]);
      if (!(await manejarErrorSesion(fallo, origen))) setError(fallo?.message || "No se pudo registrar el ingreso.");
    } finally {
      setRegistrando(false);
      registroBloqueado.current = false;
    }
  };

  const escanearSiguiente = () => {
    liberarLectura();
    setVista("qr");
    setValidacion(null);
    setResultadoRegistro("");
    setTokenConsultado("");
    setError("");
    history.replace("/validar-cena");
    setScannerAbierto(true);
  };

  const nuevaConsultaDni = () => {
    setDni("");
    setValidacion(null);
    setResultadoRegistro("");
    setTokenConsultado("");
    setError("");
    history.replace("/validar-cena");
  };

  const cancelarScanner = () => {
    setScannerAbierto(false);
    liberarLectura();
  };

  if (cargando) return <main className={styles.pagina}><p className={styles.cargando}>Verificando sesión…</p></main>;
  if (!sesion) return <LoginGestionInstitucional />;

  const esVistaQr = vista === "qr";

  return (
    <>
      <ValidatorHeader origenSesion={origenSesion || origen} onSalir={cerrarSesionValidador} />
      <main className={styles.pagina}>
        <section className={styles.panel}>
          <header className={styles.encabezado}>
            <div>
              <p className={styles.marca}>SIDCA</p>
              <h1>Validación de Cena</h1>
              <p>Control de ingreso y consulta de reservas de la Cena del Docente.</p>
            </div>
            <span>SESIÓN ACTIVA</span>
          </header>

          <div className={styles.selectorVistas} role="tablist" aria-label="Operaciones de Cena">
            <button type="button" role="tab" aria-selected={esVistaQr} className={esVistaQr ? styles.vistaActiva : ""} onClick={() => cambiarVista("qr")}>Escanear QR</button>
            <button type="button" role="tab" aria-selected={!esVistaQr} className={!esVistaQr ? styles.vistaActiva : ""} onClick={() => cambiarVista("consulta")}>Nueva consulta</button>
          </div>

          {esVistaQr ? (
            <section className={styles.vistaOperacion}>
              {!validacion && !consultando && !error && <div className={styles.accionQr}>
                <i className="pi pi-qrcode" aria-hidden="true" />
                <h2>Validar ingreso</h2>
                <p>Escaneá el código QR de la tarjeta para consultar su estado y registrar el ingreso.</p>
                <button type="button" onClick={() => setScannerAbierto(true)} disabled={registrando}><i className="pi pi-camera" aria-hidden="true" /> Escanear QR</button>
              </div>}
              {consultando && <p className={`${styles.cargando} ${styles.verificando}`}><i className="pi pi-spin pi-spinner" aria-hidden="true" /> VERIFICANDO TARJETA...</p>}
              {error && <p className={styles.error} role="alert"><i className="pi pi-times-circle" aria-hidden="true" /> {error}</p>}
              {validacion && <div className={styles.resultado}>
                <ResultadoCenaQR validacion={validacion} registroRecienRealizado={resultadoRegistro === "registrada"} registrando={registrando} onRegistrar={registrar} />
                <button type="button" className={styles.siguiente} onClick={escanearSiguiente} disabled={registrando}><i className="pi pi-camera" aria-hidden="true" /> Escanear siguiente</button>
                <ReservaCenaValidador reserva={validacion.reserva} resumen={validacion.resumen} />
                <TarjetasReservaValidador tarjetas={validacion.tarjetas} tarjetasHistoricas={validacion.tarjetasHistoricas} tarjetaSeleccionada={validacion.tarjeta} />
              </div>}
              {!validacion && !consultando && error && <button type="button" className={styles.siguiente} onClick={escanearSiguiente}><i className="pi pi-camera" aria-hidden="true" /> Escanear siguiente</button>}
            </section>
          ) : (
            <section className={styles.vistaOperacion}>
              <div className={styles.consultaEncabezado}>
                <h2>Consultar reserva</h2>
                <p>Buscá al afiliado por DNI para consultar su reserva y el estado de sus tarjetas.</p>
              </div>
              <form className={styles.buscarDni} onSubmit={buscarDni}>
                <label>Año<input inputMode="numeric" pattern="[0-9]{4}" value={anio} onChange={(event) => setAnio(event.target.value.replace(/\D/g, "").slice(0, 4))} required /></label>
                <label>DNI<input inputMode="numeric" value={dni} onChange={(event) => setDni(event.target.value.replace(/\D/g, "").slice(0, 9))} required placeholder="Ej. 36489684" /></label>
                <button type="submit" disabled={consultando || registrando}>Consultar DNI</button>
              </form>
              {consultando && <p className={styles.cargando}>Consultando reserva…</p>}
              {error && <p className={styles.error} role="alert"><i className="pi pi-times-circle" aria-hidden="true" /> {error}</p>}
              {validacion && <div className={styles.resultado}>
                <ReservaCenaValidador reserva={validacion.reserva} resumen={validacion.resumen} />
                <TarjetasReservaValidador tarjetas={validacion.tarjetas} tarjetasHistoricas={validacion.tarjetasHistoricas} tarjetaSeleccionada={validacion.tarjeta} />
                <button type="button" className={styles.siguiente} onClick={nuevaConsultaDni}>Nueva consulta</button>
              </div>}
            </section>
          )}
          <ScannerCenaQR abierto={scannerAbierto} onCodigoValido={escanear} onCancelar={cancelarScanner} />
        </section>
      </main>
    </>
  );
};

export default ValidadorCena;
