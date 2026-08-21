import React, { useState } from "react";
import { useHistory, useLocation } from "react-router-dom";
import ValidatorHeader from "../../components/Layout/Header/ValidatorHeader/ValidatorHeader";
import { cerrarSesionValidador, iniciarSesionValidador, registrarCursoValidado } from "../../services/certificadosValidacionService";
import { registrarValidacionCertificado } from "../../services/certificadosService";
import { validatorAuth } from "../../firebase/firebaseCertificadosValidator";
import { listarRegistroInscriptosValidador, descargarPlanillaRegistroInscriptos } from "../../services/registroInscriptosService";
import ScannerCertificadoQR from "./components/ScannerCertificadoQR";
import ResultadoValidacionCertificado from "./components/ResultadoValidacionCertificado";
import useSesionValidador from "./components/useSesionValidador";
import styles from "./ValidadorCertificados.module.css";

const ValidadorCertificados = () => {
  const history = useHistory();
  const location = useLocation();
  const { cargando, sesion, origenSesion } = useSesionValidador();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [abierto, setAbierto] = useState(false);
  const [scannerKey, setScannerKey] = useState(0);
  const [validacionActual, setValidacionActual] = useState(null);
  const [registrando, setRegistrando] = useState(false);
  const [registroError, setRegistroError] = useState("");
  const [vista, setVista] = useState("validar");
  const [registros, setRegistros] = useState([]);
  const [cargandoRegistros, setCargandoRegistros] = useState(false);
  const [descargando, setDescargando] = useState("");
  const [busquedaRegistro, setBusquedaRegistro] = useState("");
  const [cursoRegistroSeleccionado, setCursoRegistroSeleccionado] = useState(null);

  React.useEffect(() => {
    if (location.state?.resultadoValidacion) {
      const transferido = location.state.resultadoValidacion;
      setValidacionActual({ resultado: transferido.resultado, cursoId: location.state.cursoId || transferido.cursoId || transferido.resultado?.validacion?.cursoId, token: location.state.token || transferido.token || transferido.resultado?.validacion?.token, presentacion: transferido.presentacion, filas: transferido.filas, registroInfo: transferido.registroInfo || null });
      setAbierto(false);
      history.replace(location.pathname, {});
      return;
    }
    if (location.state?.autoOpenScanner) {
      setScannerKey((key) => key + 1);
      setAbierto(true);
      history.replace(location.pathname, {});
    }
  }, [history, location.pathname, location.state]);

  const registrarCurso = async () => {
    const datos = validacionActual?.resultado?.validacion;
    const cursoId = validacionActual?.cursoId;
    const tokenCertificado = validacionActual?.token;
    if (!cursoId || !tokenCertificado) return setRegistroError("No se pudo identificar el certificado para registrar el curso.");
    if (registrando || validacionActual?.registroInfo) return;
    const curso = datos.certificado?.titulo || datos.certificado?.cursoTitulo || "Sin título";
    const fecha = datos.certificado?.fecha || "Sin fecha";
    if (!window.confirm(`Vas a registrar el curso:\n\n${curso}\n\nFecha del certificado: ${fecha}\n\n¿Confirmás el registro?`)) return;
    if (origenSesion === "validador" && !validatorAuth.currentUser) return setRegistroError("La sesión del validador no está disponible.");
    setRegistrando(true);
    setRegistroError("");
    try {
      const registro = origenSesion === "principal" ? await registrarValidacionCertificado(cursoId, tokenCertificado) : await registrarCursoValidado(cursoId, tokenCertificado, { idToken: await validatorAuth.currentUser.getIdToken(true) });
      setValidacionActual((actual) => ({ ...actual, registroInfo: registro }));
    } catch (e) { setRegistroError(e?.message || "Error inesperado."); }
    finally { setRegistrando(false); }
  };

  const abrirScanner = () => {
    setValidacionActual(null);
    setRegistroError("");
    setScannerKey((key) => key + 1);
    setAbierto(true);
    history.replace("/validar-certificados", {});
  };

  const cambiarVista = async (siguiente) => {
    setVista(siguiente);
    setValidacionActual(null);
    setRegistroError("");
    if (siguiente === "registro") {
      setAbierto(false);
      setBusquedaRegistro("");
      setCursoRegistroSeleccionado(null);
      setCargandoRegistros(true);
      try { setRegistros(await listarRegistroInscriptosValidador()); }
      catch (e) { setRegistroError(e?.message || "No se pudieron cargar las planillas."); }
      finally { setCargandoRegistros(false); }
    } else {
      setScannerKey((key) => key + 1);
      setAbierto(true);
    }
  };

  const descargarPlanilla = async (cursoId, archivo) => {
    if (descargando) return;
    setDescargando(archivo.archivoId);
    try { await descargarPlanillaRegistroInscriptos(cursoId, archivo); }
    catch (e) { setRegistroError(e?.message || "No se pudo descargar la planilla."); }
    finally { setDescargando(""); }
  };

  const ingresar = async (e) => {
    e.preventDefault();
    setError("");
    try { await iniciarSesionValidador(email, password); setPassword(""); history.replace("/validar-certificados/inicio"); }
    catch { setError("No pudimos ingresar. Revisá el correo y la contraseña."); }
  };

  const escanear = ({ cursoId, token }) => {
    setAbierto(false);
    history.push(`/validar-certificado/${encodeURIComponent(cursoId)}/${encodeURIComponent(token)}`);
  };

  const encabezado = <header className={styles.encabezado}><div><span className={styles.marca}>SIDCA</span><h1>Validación de certificados</h1><p>Comprobá la autenticidad y vigencia de los certificados emitidos por SIDCA.</p></div><span className={styles.badge}>VALIDACIÓN QR</span></header>;

  if (cargando) return <main className={styles.pagina}><section className={styles.tarjeta}>Verificando sesión…</section></main>;
  if (!sesion) return <main className={styles.pagina}><section className={styles.tarjeta}>{encabezado}<div className={styles.loginBloque}><h2>Acceso para personal autorizado</h2><form onSubmit={ingresar}><label>Correo electrónico<input type="email" autoComplete="username" required value={email} onChange={(e) => setEmail(e.target.value)} /></label><label>Contraseña<input type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} /></label>{error && <p className={styles.error}>{error}</p>}<button>Ingresar</button></form><small>Acceso exclusivo para personal autorizado.</small></div></section></main>;

  const textoNormalizado = (valor) => String(valor || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
  const cursosFiltrados = registros.filter((curso) => curso.archivos?.length > 0 && textoNormalizado(curso.titulo).includes(textoNormalizado(busquedaRegistro)));
  const reintentarRegistros = () => cambiarVista("registro");

  return <><ValidatorHeader origenSesion={origenSesion} onSalir={cerrarSesionValidador} /><main className={styles.pagina}><section className={styles.tarjeta}>{encabezado}<div className={styles.selectorVistas} role="tablist" aria-label="Operaciones de certificados"><button type="button" className={vista === "validar" ? styles.vistaActiva : ""} onClick={() => cambiarVista("validar")}>Validar certificado</button><button type="button" className={vista === "registro" ? styles.vistaActiva : ""} onClick={() => cambiarVista("registro")}>Registro Inscriptos</button></div>
    {vista === "registro" ? <section className={styles.registroPanel}><h2>Registro Inscriptos</h2><p>Seleccioná una capacitación para descargar sus planillas de inscripción.</p>{cargandoRegistros ? <p>Cargando planillas disponibles…</p> : registroError ? <div className={styles.registroEstadoError}><p>No se pudieron cargar las planillas.</p><button type="button" className={styles.accion} onClick={reintentarRegistros}>Reintentar</button></div> : registros.length === 0 ? <p className={styles.vacio}>No hay planillas disponibles.</p> : <><label className={styles.registroBusqueda}>Buscar capacitación<input value={busquedaRegistro} onChange={(event) => setBusquedaRegistro(event.target.value)} placeholder="Buscar por título" /></label>{cursosFiltrados.length === 0 ? <p className={styles.vacio}>No hay capacitaciones que coincidan con la búsqueda.</p> : <div className={styles.registroLista}>{cursosFiltrados.map((curso) => { const cantidad = curso.cantidadArchivos || curso.archivos.length; const abiertoCurso = cursoRegistroSeleccionado === curso.cursoId; return <article className={styles.registroCurso} key={curso.cursoId}><div className={styles.registroCursoHeader}><div><h3>{curso.titulo}</h3><p>{cantidad} planilla{cantidad === 1 ? "" : "s"} disponible{cantidad === 1 ? "" : "s"}</p></div><button type="button" className={styles.accion} onClick={() => setCursoRegistroSeleccionado(abiertoCurso ? null : curso.cursoId)}>{abiertoCurso ? "Ocultar planillas" : "Ver planillas"}</button></div>{abiertoCurso && <div>{curso.archivos.map((archivo) => <div className={styles.registroArchivo} key={archivo.archivoId}><span><strong>{archivo.nombreOriginal}</strong><small>{archivo.size ? `${Math.max(1, Math.round(archivo.size / 1024))} KB` : ""}</small></span><button type="button" className={styles.accion} disabled={Boolean(descargando)} onClick={() => descargarPlanilla(curso.cursoId, archivo)}>{descargando === archivo.archivoId ? "Descargando…" : "Descargar"}</button></div>)}</div>}</article>; })}</div>}</>}</section> : <><div className={styles.scannerBloque}><i className="pi pi-qrcode" aria-hidden="true" /><h2>Escaneá el código QR del certificado</h2><p>Podés validar certificados impresos o mostrados desde otro dispositivo.</p><button type="button" className={styles.accion} onClick={() => setAbierto(true)}><i className="pi pi-camera" aria-hidden="true" /> Escanear certificado</button></div><p className={styles.seguridad}><i className="pi pi-shield" aria-hidden="true" /> Las validaciones se realizan de forma segura contra el registro oficial de SIDCA.</p><div className={styles.sesion}><div><small>SESIÓN DE VALIDACIÓN</small><span><i className="pi pi-user" aria-hidden="true" /> {sesion.email}</span></div></div><ScannerCertificadoQR key={scannerKey} abierto={abierto} onCodigoValido={escanear} onCancelar={() => setAbierto(false)} />{validacionActual && <ResultadoValidacionCertificado resultado={validacionActual.resultado} presentacion={validacionActual.presentacion} filas={validacionActual.filas} registroInfo={validacionActual.registroInfo} registrando={registrando} registrado={Boolean(validacionActual.registroInfo)} registroError={registroError} onRegistrarCurso={validacionActual.resultado?.tipo === "vigente" ? registrarCurso : undefined} onEscanearOtro={abrirScanner} onCerrar={abrirScanner} />}</>}</section></main></>;
};

export default ValidadorCertificados;
