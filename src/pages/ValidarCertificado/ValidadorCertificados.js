import React, { useRef, useState } from "react";
import * as XLSX from "xlsx";
import { useHistory, useLocation } from "react-router-dom";
import ValidatorHeader from "../../components/Layout/Header/ValidatorHeader/ValidatorHeader";
import { cerrarSesionValidador, registrarCursoValidado, validarCertificadoQr } from "../../services/certificadosValidacionService";
import { registrarValidacionCertificado } from "../../services/certificadosService";
import { validatorAuth } from "../../firebase/firebaseCertificadosValidator";
import { listarRegistroInscriptosValidador, descargarPlanillaRegistroInscriptos } from "../../services/registroInscriptosService";
import { listarRegistroAprobados, obtenerRegistroAprobadosCurso } from "../../services/registroAprobadosService";
import ScannerCertificadoQR from "./components/ScannerCertificadoQR";
import ResultadoValidacionCertificado from "./components/ResultadoValidacionCertificado";
import useSesionValidador from "./components/useSesionValidador";
import LoginGestionInstitucional from "../../components/GestionInstitucional/LoginGestionInstitucional";
import "../../styles/institutional.css";
import styles from "./ValidadorCertificados.module.css";

const formatearDni = (dni) => {
  const limpio = String(dni || "").replace(/\D/g, "");
  return limpio ? limpio.replace(/\B(?=(\d{3})+(?!\d))/g, ".") : "—";
};

const formatearFechaEmision = (valor) => {
  const fecha = new Date(String(valor || ""));
  return Number.isNaN(fecha.getTime())
    ? String(valor || "—")
    : fecha.toLocaleDateString("es-AR", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
      });
};

const prepararResultadoValidacion = (validacion) => {
  const estado = String(validacion?.estado || "").toLowerCase();
  const certificado = validacion?.certificado || {};
  const participante = validacion?.participante || {};
  const vigente = validacion?.valido === true && estado === "vigente";
  const tipo = vigente
    ? "vigente"
    : estado === "anulado"
    ? "anulado"
    : estado === "reemplazado"
    ? "reemplazado"
    : "desconocido";

  return {
    resultado: { tipo, validacion },
    presentacion: {
      clase: vigente ? "resultadoValido" : "resultadoReemplazado",
      icono: vigente ? "✓" : "!",
      titulo: vigente ? "CERTIFICADO VÁLIDO" : "CERTIFICADO NO VÁLIDO",
      detalle: vigente
        ? "Este certificado fue emitido por el sistema de certificación SIDCA y se encuentra vigente."
        : "El código QR corresponde a un certificado que no se encuentra vigente.",
    },
    filas: [
      ["Participante", participante.apellidoNombre || "—"],
      ["DNI", formatearDni(participante.dni)],
      ["Capacitación", certificado.titulo || certificado.cursoTitulo || "—"],
      ["Resolución", certificado.resolucion || "—"],
      ["Modalidad", certificado.modalidad || "—"],
      ["Carga horaria", certificado.cargaHoraria || "—"],
      ["Período", certificado.dias || "—"],
      ["Fecha del certificado", certificado.fecha || "—"],
      ["Fecha de emisión", formatearFechaEmision(validacion.emitidoEn)],
      ["Estado", estado.toUpperCase() || "—"],
      ["Institución", certificado.institucionValidacion || "—"],
    ],
  };
};

const ValidadorCertificados = () => {
  const history = useHistory();
  const location = useLocation();
  const { cargando, sesion, origenSesion, principal, validador } = useSesionValidador();
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
  const [cursosAprobados, setCursosAprobados] = useState([]);
  const [cargandoAprobados, setCargandoAprobados] = useState(false);
  const [errorAprobados, setErrorAprobados] = useState("");
  const [busquedaAprobados, setBusquedaAprobados] = useState("");
  const [busquedaPersonasAprobados, setBusquedaPersonasAprobados] = useState("");
  const [cursoAprobadosSeleccionado, setCursoAprobadosSeleccionado] = useState(null);
  const [detalleAprobados, setDetalleAprobados] = useState(null);
  const [cargandoDetalleAprobados, setCargandoDetalleAprobados] = useState(false);
  const [descargandoAprobados, setDescargandoAprobados] = useState("");

  // Cuándo se cargó por última vez cada pestaña. En un ref, no en estado: no
  // debe disparar un render, sólo decidir si el próximo cambio de pestaña
  // repite el pedido o reutiliza lo que ya está en memoria.
  const registrosCargadosEnRef = useRef(0);
  const aprobadosCargadosEnRef = useRef(0);
  const DATOS_TTL_MS = 60_000;

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
      // registrarCursoValidado ya pide el token en caché y reintenta UNA vez
      // con refresco forzado ante un 401: no hace falta forzarlo acá antes de
      // llamarlo, ese refresco previo era un round-trip de más en el camino
      // normal (token todavía válido).
      const registro = origenSesion === "principal" ? await registrarValidacionCertificado(cursoId, tokenCertificado) : await registrarCursoValidado(cursoId, tokenCertificado, { usuarioFirebase: validatorAuth.currentUser });
      setValidacionActual((actual) => ({ ...actual, registroInfo: registro }));
    } catch (e) { setRegistroError(e?.message || "Error inesperado."); }
    finally { setRegistrando(false); }
  };

  const abrirScanner = () => {
    setValidacionActual(null);
    setRegistroError("");
    setRegistrando(false);
    setScannerKey((key) => key + 1);
    setAbierto(true);
    history.replace("/validar-certificados", {});
  };

  const cerrarResultado = () => {
    setValidacionActual(null);
    setRegistroError("");
    setRegistrando(false);
    setAbierto(false);
    history.replace("/validar-certificados", {});
  };

  /**
   * `forzar` salta el TTL: lo usa el botón "Actualizar" y, siempre, el
   * reintento después de un error (aprobadosCargadosEnRef sigue en 0 cuando
   * la carga anterior falló, así que igual reintenta aunque no se pida
   * forzar). Sin forzar y con datos vigentes, no dispara ningún pedido: es lo
   * que hace instantáneo volver a esta pestaña.
   */
  const cargarAprobados = async (forzar = false) => {
    if (!forzar && aprobadosCargadosEnRef.current && Date.now() - aprobadosCargadosEnRef.current < DATOS_TTL_MS) {
      return;
    }
    setCargandoAprobados(true);
    setErrorAprobados("");
    try {
      setCursosAprobados(await listarRegistroAprobados(origenSesion));
      aprobadosCargadosEnRef.current = Date.now();
    }
    catch (e) { setErrorAprobados(e?.message || "No se pudieron cargar los aprobados."); }
    finally { setCargandoAprobados(false); }
  };

  const abrirDetalleAprobados = async (curso) => {
    const abierto = cursoAprobadosSeleccionado === curso.cursoId;
    if (abierto) {
      setCursoAprobadosSeleccionado(null);
      setDetalleAprobados(null);
      return;
    }
    setCursoAprobadosSeleccionado(curso.cursoId);
    setDetalleAprobados(null);
    setBusquedaPersonasAprobados("");
    setCargandoDetalleAprobados(true);
    setErrorAprobados("");
    try { setDetalleAprobados(await obtenerRegistroAprobadosCurso(curso.cursoId, origenSesion)); }
    catch (e) { setErrorAprobados(e?.message || "No se pudo cargar el detalle del curso."); }
    finally { setCargandoDetalleAprobados(false); }
  };

  const nombreArchivoSeguro = (valor) => String(valor || "curso").normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-zA-Z0-9]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 90) || "curso";

  const descargarAprobados = async (curso) => {
    if (descargandoAprobados) return;
    setDescargandoAprobados(curso.cursoId);
    setErrorAprobados("");
    try {
      const datos = await obtenerRegistroAprobadosCurso(curso.cursoId, origenSesion);
      const filas = datos.aprobados.map((aprobado) => ({
        "Apellido y nombre": aprobado.apellidoNombre || "",
        DNI: String(aprobado.dni || ""),
        Departamento: aprobado.departamento?.crudo || aprobado.departamento?.canonico || "",
      }));
      const hoja = XLSX.utils.json_to_sheet(filas, { header: ["Apellido y nombre", "DNI", "Departamento"] });
      hoja["!cols"] = [{ wch: 40 }, { wch: 15 }, { wch: 30 }];
      for (let fila = 2; fila <= filas.length + 1; fila += 1) {
        const celda = hoja[`B${fila}`];
        if (celda) { celda.t = "s"; celda.v = String(celda.v || ""); }
      }
      const libro = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(libro, hoja, "Aprobados");
      XLSX.writeFile(libro, `Registro_Aprobados_${nombreArchivoSeguro(datos.curso?.titulo || curso.titulo)}.xlsx`);
    } catch (e) { setErrorAprobados(e?.message || "No se pudo descargar el registro."); }
    finally { setDescargandoAprobados(""); }
  };

  /** Misma lógica de TTL que cargarAprobados; ver ese comentario. */
  const cargarRegistros = async (forzar = false) => {
    if (!forzar && registrosCargadosEnRef.current && Date.now() - registrosCargadosEnRef.current < DATOS_TTL_MS) {
      return;
    }
    setCargandoRegistros(true);
    setRegistroError("");
    try {
      setRegistros(await listarRegistroInscriptosValidador(forzar));
      registrosCargadosEnRef.current = Date.now();
    }
    catch (e) { setRegistroError(e?.message || "No se pudieron cargar las planillas."); }
    finally { setCargandoRegistros(false); }
  };

  const cambiarVista = async (siguiente) => {
    setVista(siguiente);
    setValidacionActual(null);
    setRegistroError("");
    if (siguiente === "registro") {
      setAbierto(false);
      setBusquedaRegistro("");
      setCursoRegistroSeleccionado(null);
      await cargarRegistros();
    } else if (siguiente === "aprobados") {
      setAbierto(false);
      setBusquedaAprobados("");
      setCursoAprobadosSeleccionado(null);
      setDetalleAprobados(null);
      await cargarAprobados();
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

  const escanear = async ({ cursoId, token }) => {
    setAbierto(false);
    setValidacionActual(null);
    setRegistroError("");
    setRegistrando(false);

    try {
      const validacion = await validarCertificadoQr(cursoId, token, {
        usuarioFirebase: origenSesion === "validador" ? validador : principal,
      });
      const resultado = prepararResultadoValidacion(validacion);
      setValidacionActual({
        ...resultado,
        cursoId,
        token,
        registroInfo: validacion?.registroCurso || null,
      });
    } catch (error) {
      setRegistroError(
        error?.message || "No se pudo validar el certificado escaneado."
      );
    }
  };

  const encabezado = <header className={styles.encabezado}><div><span className={styles.marca}>SIDCA</span><h1>Validación de certificados</h1><p>Comprobá la autenticidad y vigencia de los certificados emitidos por SIDCA.</p></div><span className={styles.badge}>VALIDACIÓN QR</span></header>;

  if (cargando) return <main className={styles.pagina}><section className={styles.tarjeta}>Verificando sesión…</section></main>;
  if (!sesion) return <LoginGestionInstitucional />;

  const textoNormalizado = (valor) => String(valor || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
  const cursosFiltrados = registros.filter((curso) => curso.archivos?.length > 0 && textoNormalizado(curso.titulo).includes(textoNormalizado(busquedaRegistro)));
  // Un reintento posterior a un error debe ir al backend aunque el TTL local
  // todavía conserve una marca de carga anterior.
  const reintentarRegistros = () => cargarRegistros(true);

  const soloDigitos = (valor) => String(valor || "").replace(/\D/g, "");
  const cursosAprobadosFiltrados = cursosAprobados.filter((curso) => textoNormalizado(curso.titulo).includes(textoNormalizado(busquedaAprobados)));
  const aprobadosVisibles = (detalleAprobados?.aprobados || []).filter((aprobado) => {
    const termino = textoNormalizado(busquedaPersonasAprobados);
    const terminoDni = soloDigitos(busquedaPersonasAprobados);
    return !termino || textoNormalizado(aprobado.apellidoNombre).includes(termino) || Boolean(terminoDni && soloDigitos(aprobado.dni).includes(terminoDni));
  });
  const reintentarAprobados = () => cargarAprobados(true);
  const panelAprobados = <section className={styles.aprobadosPanel}>
    <div className={styles.aprobadosEncabezado}><div><h2>Registro de Aprobados</h2><p>Seleccioná una capacitación para consultar y descargar su registro actualizado de aprobados.</p></div><button type="button" className={styles.accion} onClick={() => cargarAprobados(true)} disabled={cargandoAprobados}><i className="pi pi-refresh" aria-hidden="true" /> {cargandoAprobados ? "Actualizando…" : "Actualizar"}</button></div>
    {cargandoAprobados ? <p className={styles.vacio}>Cargando capacitaciones…</p> : errorAprobados && !detalleAprobados ? <div className={styles.registroEstadoError}><p>{errorAprobados}</p><button type="button" className={styles.accion} onClick={reintentarAprobados}>Reintentar</button></div> : cursosAprobados.length === 0 ? <p className={styles.vacio}>No hay registros de aprobados disponibles.</p> : <>
      <label className={styles.registroBusqueda}>Buscar capacitación<input value={busquedaAprobados} onChange={(event) => setBusquedaAprobados(event.target.value)} placeholder="Buscar por título" /></label>
      {cursosAprobadosFiltrados.length === 0 ? <p className={styles.vacio}>No hay cursos que coincidan con la búsqueda.</p> : <div className={styles.aprobadosLista}>{cursosAprobadosFiltrados.map((curso) => {
        const seleccionado = cursoAprobadosSeleccionado === curso.cursoId;
        return <article className={styles.aprobadosCurso} key={curso.cursoId}>
          <div className={styles.aprobadosCursoHeader}><div><h3>{curso.titulo}</h3><p>{curso.resolucion ? `Resolución Ministerial: ${curso.resolucion}` : "Resolución Ministerial: Sin dato"}</p><p>{curso.cantidadAprobados} aprobado{curso.cantidadAprobados === 1 ? "" : "s"}</p></div><div className={styles.aprobadosAcciones}><button type="button" className={styles.accion} onClick={() => abrirDetalleAprobados(curso)}>{seleccionado ? "Ocultar aprobados" : "Ver aprobados"}</button><button type="button" className={styles.accionSecundaria} disabled={Boolean(descargandoAprobados)} onClick={() => descargarAprobados(curso)}>{descargandoAprobados === curso.cursoId ? "Generando…" : "Descargar Excel"}</button></div></div>
          {seleccionado && <div className={styles.aprobadosDetalle}>{cargandoDetalleAprobados ? <p className={styles.vacio}>Cargando aprobados…</p> : errorAprobados ? <p className={styles.error}>{errorAprobados}</p> : <><label className={`${styles.registroBusqueda} ${styles.aprobadosBusqueda}`}>Buscar aprobado<input value={busquedaPersonasAprobados} onChange={(event) => setBusquedaPersonasAprobados(event.target.value)} placeholder="Buscar por apellido o DNI" /></label>{aprobadosVisibles.length === 0 ? <p className={styles.vacio}>{detalleAprobados?.aprobados?.length ? "No hay personas que coincidan con la búsqueda." : "No hay aprobados actualmente para esta capacitación."}</p> : <div className={styles.aprobadosPersonas}><div className={styles.aprobadosEncabezadoFila}><span>Apellido y nombre</span><span>DNI</span><span>Departamento</span></div>{aprobadosVisibles.map((aprobado) => <div className={styles.aprobadoFila} key={aprobado.usuarioDocId || `${aprobado.dni}-${aprobado.apellidoNombre}`}><strong>{aprobado.apellidoNombre}</strong><span>{aprobado.dni}</span><span>{aprobado.departamento?.canonico || aprobado.departamento?.crudo || "Departamento no informado"}</span></div>)}</div>}</>}</div>}
        </article>;
      })}</div>}
    </>}
  </section>;

  if (vista === "aprobados") return <><ValidatorHeader origenSesion={origenSesion} onSalir={cerrarSesionValidador} /><main className={styles.pagina}><section className={styles.tarjeta}>{encabezado}<div className={styles.selectorVistas} role="tablist" aria-label="Operaciones de certificados"><button type="button" className={vista === "validar" ? styles.vistaActiva : ""} onClick={() => cambiarVista("validar")}>Validar certificado</button><button type="button" className={vista === "registro" ? styles.vistaActiva : ""} onClick={() => cambiarVista("registro")}>Registro Inscriptos</button><button type="button" className={styles.vistaActiva}>Registro de Aprobados</button></div>{panelAprobados}</section></main></>;

  return <><ValidatorHeader origenSesion={origenSesion} onSalir={cerrarSesionValidador} /><main className={styles.pagina}><section className={styles.tarjeta}>{encabezado}<div className={styles.selectorVistas} role="tablist" aria-label="Operaciones de certificados"><button type="button" className={vista === "validar" ? styles.vistaActiva : ""} onClick={() => cambiarVista("validar")}>Validar certificado</button><button type="button" className={vista === "registro" ? styles.vistaActiva : ""} onClick={() => cambiarVista("registro")}>Registro Inscriptos</button><button type="button" className={vista === "aprobados" ? styles.vistaActiva : ""} onClick={() => cambiarVista("aprobados")}>Registro de Aprobados</button></div>
    {vista === "registro" ? <section className={styles.registroPanel}><div className={styles.registroEncabezado}><div><h2>Registro Inscriptos</h2><p>Seleccioná una capacitación para descargar sus planillas de inscripción.</p></div><button type="button" className={styles.accion} onClick={() => cargarRegistros(true)} disabled={cargandoRegistros}><i className="pi pi-refresh" aria-hidden="true" /> {cargandoRegistros ? "Actualizando…" : "Actualizar"}</button></div>{cargandoRegistros ? <p>Cargando planillas disponibles…</p> : registroError ? <div className={styles.registroEstadoError}><p>No se pudieron cargar las planillas.</p><button type="button" className={styles.accion} onClick={reintentarRegistros}>Reintentar</button></div> : registros.length === 0 ? <p className={styles.vacio}>No hay planillas disponibles.</p> : <><label className={styles.registroBusqueda}>Buscar capacitación<input value={busquedaRegistro} onChange={(event) => setBusquedaRegistro(event.target.value)} placeholder="Buscar por título" /></label>{cursosFiltrados.length === 0 ? <p className={styles.vacio}>No hay capacitaciones que coincidan con la búsqueda.</p> : <div className={styles.registroLista}>{cursosFiltrados.map((curso) => { const cantidad = curso.cantidadArchivos || curso.archivos.length; const abiertoCurso = cursoRegistroSeleccionado === curso.cursoId; return <article className={styles.registroCurso} key={curso.cursoId}><div className={styles.registroCursoHeader}><div><h3>{curso.titulo}</h3><p>{cantidad} planilla{cantidad === 1 ? "" : "s"} disponible{cantidad === 1 ? "" : "s"}</p></div><button type="button" className={styles.accion} onClick={() => setCursoRegistroSeleccionado(abiertoCurso ? null : curso.cursoId)}>{abiertoCurso ? "Ocultar planillas" : "Ver planillas"}</button></div>{abiertoCurso && <div>{curso.archivos.map((archivo) => <div className={styles.registroArchivo} key={archivo.archivoId}><span><strong>{archivo.nombreOriginal}</strong><small>{archivo.size ? `${Math.max(1, Math.round(archivo.size / 1024))} KB` : ""}</small></span><button type="button" className={styles.accion} disabled={Boolean(descargando)} onClick={() => descargarPlanilla(curso.cursoId, archivo)}>{descargando === archivo.archivoId ? "Descargando…" : "Descargar"}</button></div>)}</div>}</article>; })}</div>}</>}</section> : <><div className={styles.scannerBloque}><i className="pi pi-qrcode" aria-hidden="true" /><h2>Escaneá el código QR del certificado</h2><p>Podés validar certificados impresos o mostrados desde otro dispositivo.</p><button type="button" className={styles.accion} onClick={() => setAbierto(true)}><i className="pi pi-camera" aria-hidden="true" /> Escanear certificado</button></div><p className={styles.seguridad}><i className="pi pi-shield" aria-hidden="true" /> Las validaciones se realizan de forma segura contra el registro oficial de SIDCA.</p><div className={styles.sesion}><div><small>SESIÓN DE VALIDACIÓN</small><span><i className="pi pi-user" aria-hidden="true" /> {sesion.email}</span></div></div><ScannerCertificadoQR key={scannerKey} abierto={abierto} onCodigoValido={escanear} onCancelar={() => setAbierto(false)} />{validacionActual && <ResultadoValidacionCertificado resultado={validacionActual.resultado} presentacion={validacionActual.presentacion} filas={validacionActual.filas} registroInfo={validacionActual.registroInfo} registrando={registrando} registrado={Boolean(validacionActual.registroInfo)} registroError={registroError} onRegistrarCurso={validacionActual.resultado?.tipo === "vigente" ? registrarCurso : undefined} onEscanearOtro={abrirScanner} onCerrar={cerrarResultado} />}</>}</section></main></>;
};

export default ValidadorCertificados;
