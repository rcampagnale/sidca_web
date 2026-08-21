// src/pages/ValidarCertificado/ValidarCertificadoQr.js
//
// Pantalla a la que llega el QR de un certificado emitido:
//
//   /validar-certificado/:cursoId/:token
//
// El acceso NO es público. El token del QR es difícil de adivinar, pero eso no
// reemplaza autenticación: sin sesión no se muestra ni un dato del
// certificado, sólo el formulario de ingreso.
//
// QUÉ SESIÓN SE USA, EN ORDEN
//   1. validatorAuth  — si un validador ya ingresó acá, esa es su identidad
//                       explícita para validar y tiene prioridad.
//   2. auth principal — la sesión del panel. Un administrador que escanea un
//                       QR no debería tener que loguearse una segunda vez.
//   3. formulario     — sin ninguna sesión.
//
// Quién tiene permiso lo decide el BACKEND, que acepta administrador O usuario
// con validarCertificados === true. Acá no se comprueban roles.
//
// La sesión principal sólo se LEE. Esta pantalla nunca hace signIn ni signOut
// sobre ella: si no tiene permiso, se ofrece el formulario del validador y la
// sesión del panel queda intacta.
//
// Todos los datos que se muestran vienen del snapshot que devuelve el backend.
// No se consulta Firestore desde acá, ni usuarios, ni cursos.
//
// Pensada para celular: el uso principal es escanear el QR con el teléfono.

import React, { useCallback, useEffect, useState } from "react";
import { useHistory, useParams } from "react-router-dom";
import { Dialog } from "primereact/dialog";

import { auth } from "../../firebase/firebase-config";
import { validatorAuth } from "../../firebase/firebaseCertificadosValidator";
import {
  cerrarSesionValidador,
  descartarSesionValidadorVencida,
  iniciarSesionValidador,
  registrarActividadValidador,
  sesionValidadorExpirada,
  validarCertificadoQr,
  registrarCursoValidado,
} from "../../services/certificadosValidacionService";
import { registrarValidacionCertificado } from "../../services/certificadosService";
import styles from "./ValidarCertificadoQr.module.css";
import ValidatorHeader from "../../components/Layout/Header/ValidatorHeader/ValidatorHeader";
import ResultadoValidacionCertificado from "./components/ResultadoValidacionCertificado";

/** Sólo para mostrar. El valor original no se toca. */
const formatearDni = (dni) => {
  const limpio = String(dni || "").replace(/\D/g, "");
  if (!limpio) return "—";
  return limpio.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
};

/** La fecha de emisión llega como timestamp ISO desde Firestore. */
const formatearFechaEmision = (valor) => {
  const texto = String(valor || "").trim();
  if (!texto) return "—";

  const fecha = new Date(texto);
  if (Number.isNaN(fecha.getTime())) return texto;

  return fecha.toLocaleDateString("es-AR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
};

const ETIQUETA_ESTADO = {
  vigente: "VIGENTE",
  anulado: "ANULADO",
  reemplazado: "REEMPLAZADO",
};

const ValidarCertificadoQr = () => {
  const { cursoId, token: certificadoToken } = useParams();
  const history = useHistory();

  // undefined = Firebase todavía no terminó de restaurar esa sesión.
  const [usuarioValidador, setUsuarioValidador] = useState(undefined);
  const [usuarioPrincipal, setUsuarioPrincipal] = useState(undefined);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [ingresando, setIngresando] = useState(false);
  const [errorLogin, setErrorLogin] = useState("");

  const [validando, setValidando] = useState(false);
  const [validacion, setValidacion] = useState(null);
  const [errorValidacion, setErrorValidacion] = useState("");
  const [estadoError, setEstadoError] = useState(0);
  const [registrando, setRegistrando] = useState(false);
  const [registrado, setRegistrado] = useState(false);
  const [registroError, setRegistroError] = useState("");

  /** Origen de la sesión con la que se validó: "validador" | "principal". */
  const [origenSesion, setOrigenSesion] = useState("");

  /**
   * La sesión principal no sirvió (403 o 401): hay que pedir una cuenta
   * autorizada. Se fuerza el formulario SIN tocar esa sesión, que sigue siendo
   * válida para el panel administrativo.
   */
  const [principalRechazada, setPrincipalRechazada] = useState(false);

  /**
   * Consulta la validez del certificado con la sesión indicada.
   *
   * La reacción ante un rechazo depende de QUÉ sesión se usó:
   *
   *   principal → nunca se cierra desde acá. Se pasa al formulario del
   *               validador con un aviso. Puede ser simplemente un usuario sin
   *               permiso de validación, y su sesión del panel es legítima.
   *
   *   validador → es la cuenta elegida explícitamente para validar, así que un
   *               403 sí se muestra como "Usuario no autorizado", y un 401 la
   *               cierra y vuelve al formulario.
   */
  const validarCon = useCallback(
    async (usuarioFirebase, origen) => {
      // La sesión del validador persiste entre pestañas, así que puede llegar
      // acá ya vencida. Se comprueba antes de gastar el request; el signOut
      // dispara onAuthStateChanged y la pantalla vuelve al formulario.
      if (origen === "validador" && sesionValidadorExpirada()) {
        await descartarSesionValidadorVencida();
        return;
      }

      setValidando(true);
      setErrorValidacion("");
      setEstadoError(0);
      setValidacion(null);
      setRegistrado(false);
      setRegistroError("");
      setOrigenSesion(origen);

      try {
        const resultado = await validarCertificadoQr(cursoId, certificadoToken, {
          usuarioFirebase,
        });
        setValidacion(resultado);

        // Validación exitosa = actividad. Así el plazo son 5 horas de
        // INACTIVIDAD y no 5 horas absolutas desde el login: cada QR
        // verificado durante el turno renueva la sesión.
        if (origen === "validador") registrarActividadValidador();
      } catch (e) {
        const status = Number(e?.status || 0);

        if (origen === "principal" && (status === 403 || status === 401)) {
          setPrincipalRechazada(true);
          setValidando(false);
          return;
        }

        setEstadoError(status);
        setErrorValidacion(e?.message || "No se pudo validar el certificado.");

        if (origen === "validador" && status === 401) {
          try {
            await cerrarSesionValidador();
          } catch (errorCierre) {
            /* si falla el cierre, el formulario aparece igual */
          }
        }
      } finally {
        setValidando(false);
      }
    },
    [cursoId, certificadoToken]
  );

  // Se escuchan las DOS sesiones. Son instancias independientes: un cambio en
  // una no afecta a la otra.
  useEffect(() => {
    const desuscribirValidador = validatorAuth.onAuthStateChanged((usuario) => {
      setUsuarioValidador(usuario || null);
    });

    const desuscribirPrincipal = auth.onAuthStateChanged((usuario) => {
      setUsuarioPrincipal(usuario || null);
    });

    return () => {
      desuscribirValidador();
      desuscribirPrincipal();
    };
  }, []);

  const inicializando =
    usuarioValidador === undefined || usuarioPrincipal === undefined;

  // Prioridad: validador explícito, después sesión principal.
  const sesionElegida = usuarioValidador
    ? { usuario: usuarioValidador, origen: "validador" }
    : usuarioPrincipal && !principalRechazada
    ? { usuario: usuarioPrincipal, origen: "principal" }
    : null;

  // Se valida al resolverse las sesiones y cada vez que cambia la elegida.
  // La dependencia es el uid, no el objeto: Firebase reemplaza la instancia de
  // User al renovar el token y eso no debe disparar otra consulta.
  const uidElegido = sesionElegida?.usuario?.uid || "";
  const origenElegido = sesionElegida?.origen || "";

  useEffect(() => {
    if (inicializando) return;
    if (!sesionElegida) return;

    validarCon(sesionElegida.usuario, sesionElegida.origen);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inicializando, uidElegido, origenElegido]);

  // Si el validador ingresa después de un rechazo de la sesión principal, se
  // limpia la marca para que su resultado se muestre normalmente.
  useEffect(() => {
    if (usuarioValidador) setPrincipalRechazada(false);
  }, [usuarioValidador]);

  // El resultado de un QR directo se entrega a la pantalla operativa. Se
  // transporta el snapshot ya resuelto: la ruta destino no vuelve a consultar.
  useEffect(() => {
    if (!validacion || validando) return;
    const estadoActual = String(validacion.estado || "").toLowerCase();
    const tipo = validacion.valido === true && estadoActual === "vigente"
      ? "vigente"
      : estadoActual === "anulado"
      ? "anulado"
      : estadoActual === "reemplazado"
      ? "reemplazado"
      : "desconocido";
    const certificadoActual = validacion.certificado || {};
    const participanteActual = validacion.participante || {};
    const presentacion = {
      clase: tipo === "vigente" ? "resultadoValido" : "resultadoReemplazado",
      icono: tipo === "vigente" ? "✓" : "!",
      titulo: tipo === "vigente" ? "CERTIFICADO VÁLIDO" : "CERTIFICADO NO VIGENTE",
      detalle: tipo === "vigente"
        ? "Este certificado fue emitido por el sistema de certificación SIDCA y se encuentra vigente."
        : `Este certificado fue emitido por SIDCA, pero su estado actual es ${ETIQUETA_ESTADO[estadoActual] || estadoActual.toUpperCase()}.`,
    };
    const filas = [
      ["Participante", participanteActual.apellidoNombre || "—"],
      ["DNI", formatearDni(participanteActual.dni)],
      ["Capacitación", certificadoActual.titulo || certificadoActual.cursoTitulo || "—"],
      ["Resolución", certificadoActual.resolucion || "—"],
      ["Modalidad", certificadoActual.modalidad || "—"],
      ["Carga horaria", certificadoActual.cargaHoraria || "—"],
      ["Período", certificadoActual.dias || "—"],
      ["Fecha del certificado", certificadoActual.fecha || "—"],
      ["Fecha de emisión", formatearFechaEmision(validacion.emitidoEn)],
      ["Estado", ETIQUETA_ESTADO[estadoActual] || estadoActual.toUpperCase() || "—"],
      ["Institución", certificadoActual.institucionCertificado || "SIDCA — Sindicato de Docentes de Catamarca"],
    ];
    history.replace({
      pathname: "/validar-certificados",
      state: {
        resultadoValidacion: {
          resultado: { tipo, validacion },
          cursoId,
          token: certificadoToken,
          presentacion,
          filas,
          registroInfo: validacion.registroCurso || null,
        },
      },
    });
  }, [certificadoToken, cursoId, history, validacion, validando]);

  const manejarIngreso = async (evento) => {
    evento.preventDefault();

    setIngresando(true);
    setErrorLogin("");

    try {
      await iniciarSesionValidador(email, password);
      setPassword("");
      // onAuthStateChanged dispara la validación.
    } catch (e) {
      setErrorLogin("No pudimos ingresar. Revisá el correo y la contraseña.");
    } finally {
      setIngresando(false);
    }
  };

  const registrarCurso = async () => {
    const datos = validacion;
    if (!datos?.cursoId || !datos?.token || registrando || registrado) return;
    const curso = datos.certificado?.titulo || datos.certificado?.cursoTitulo || "Sin título";
    const fecha = datos.certificado?.fecha || "Sin fecha";
    if (!window.confirm(`Vas a registrar el curso:\n\n${curso}\n\nFecha del certificado: ${fecha}\n\n¿Confirmás el registro?`)) return;
    if (origenSesion === "validador" && !validatorAuth.currentUser) {
      setRegistroError("La sesión del validador no está disponible.");
      return;
    }
    setRegistrando(true);
    setRegistroError("");
    try {
      const registro = origenSesion === "principal"
        ? await registrarValidacionCertificado(datos.cursoId, datos.token)
        : await registrarCursoValidado(datos.cursoId, datos.token, {
            idToken: await validatorAuth.currentUser.getIdToken(true),
          });
      setRegistrado(true);
      setValidacion((actual) => ({ ...actual, registroCurso: registro }));
    } catch (e) {
      if (e?.status === 409) {
        setValidacion((actual) => ({ ...actual, registroCurso: e?.datos?.registro || e?.datos?.validacion || null }));
      } else {
        setRegistroError(e?.message || "Error inesperado.");
      }
    } finally {
      setRegistrando(false);
    }
  };

  const manejarCierre = async () => {
    try {
      await cerrarSesionValidador();
    } finally {
      setValidacion(null);
      setErrorValidacion("");
      setEstadoError(0);
      setEmail("");
      setPassword("");
    }
  };

  const encabezado = (
    <header className={styles.encabezado}>
      <span className={styles.marca}>SIDCA</span>
      <h1 className={styles.titulo}>Validación de Certificado SIDCA</h1>
    </header>
  );

  // ---- Firebase todavía restaurando alguna de las dos sesiones ----
  if (inicializando) {
    return (
      <div className={styles.pagina}>
        <div className={styles.tarjeta}>
          {encabezado}
          <p className={styles.estadoTexto}>Cargando…</p>
        </div>
      </div>
    );
  }

  // ---- Sin sesión utilizable: no se muestra NINGÚN dato del certificado ----
  if (!sesionElegida) {
    return (
      <div className={styles.pagina}>
        <div className={styles.tarjeta}>
          {encabezado}

          {principalRechazada ? (
            <p className={styles.avisoSesion}>
              La sesión actual no tiene permiso para validar certificados.
              Ingresá con una cuenta autorizada.
            </p>
          ) : (
            <p className={styles.introduccion}>
              Para verificar este certificado debés ingresar con una cuenta
              autorizada.
            </p>
          )}

          <form onSubmit={manejarIngreso} className={styles.formulario}>
            <label className={styles.campo}>
              <span className={styles.campoLabel}>Correo electrónico</span>
              <input
                type="email"
                className={styles.input}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="username"
                required
                disabled={ingresando}
              />
            </label>

            <label className={styles.campo}>
              <span className={styles.campoLabel}>Contraseña</span>
              <input
                type="password"
                className={styles.input}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                required
                disabled={ingresando}
              />
            </label>

            {errorLogin && <p className={styles.mensajeError}>{errorLogin}</p>}

            <button
              type="submit"
              className={styles.botonPrimario}
              disabled={ingresando}
            >
              {ingresando ? "Ingresando…" : "Ingresar y validar"}
            </button>
          </form>

          <p className={styles.notaAcceso}>
            Acceso exclusivo para personal autorizado.
          </p>
        </div>
      </div>
    );
  }

  // ---- Con sesión ----
  const estado = String(validacion?.estado || "").toLowerCase();
  const participante = validacion?.participante || {};
  const certificado = validacion?.certificado || {};
  const registroInfo = validacion?.registroCurso || null;

  return (
    <>
      <ValidatorHeader origenSesion={origenSesion} onSalir={cerrarSesionValidador} />
      <div className={styles.pagina}>
       <div className={styles.tarjeta}>
        {encabezado}

        {validando && (
          <p className={styles.estadoTexto}>Verificando certificado…</p>
        )}

        {!validando && estadoError === 404 && (
          <div className={styles.bloqueNoEncontrado}>
            <h2 className={styles.resultadoTitulo}>Certificado no encontrado</h2>
            <p className={styles.resultadoTexto}>
              El código QR no corresponde a un certificado emitido por SIDCA o
              el enlace es inválido.
            </p>
          </div>
        )}

        {!validando && estadoError === 403 && (
          <div className={styles.bloqueNoAutorizado}>
            <h2 className={styles.resultadoTitulo}>Usuario no autorizado</h2>
            <p className={styles.resultadoTexto}>
              Tu cuenta no tiene permiso para validar certificados SIDCA.
            </p>
          </div>
        )}

        {!validando &&
          estadoError !== 0 &&
          estadoError !== 404 &&
          estadoError !== 403 && (
            <div className={styles.bloqueNoEncontrado}>
              <h2 className={styles.resultadoTitulo}>
                No se pudo validar el certificado
              </h2>
              <p className={styles.resultadoTexto}>{errorValidacion}</p>
            </div>
          )}

        {!validando && validacion && <ResultadoValidacionCertificado
          resultado={{ tipo: validacion.valido ? "vigente" : "reemplazado" }}
          presentacion={{ clase: validacion.valido ? "resultadoValido" : "resultadoReemplazado", icono: validacion.valido ? "✓" : "!", titulo: validacion.valido ? "CERTIFICADO VÁLIDO" : "CERTIFICADO NO VIGENTE", detalle: validacion.valido ? "Este certificado fue emitido por el sistema de certificación SIDCA y se encuentra vigente." : `Este certificado fue emitido por SIDCA, pero su estado actual es ${ETIQUETA_ESTADO[estado] || estado.toUpperCase()}.` }}
          filas={[["Participante", participante.apellidoNombre || "—"], ["DNI", formatearDni(participante.dni)], ["Capacitación", certificado.titulo || certificado.cursoTitulo || "—"], ["Resolución", certificado.resolucion || "—"], ["Modalidad", certificado.modalidad || "—"], ["Carga horaria", certificado.cargaHoraria || "—"], ["Período", certificado.dias || "—"], ["Fecha del certificado", certificado.fecha || "—"], ["Fecha de emisión", formatearFechaEmision(validacion.emitidoEn)], ["Estado", ETIQUETA_ESTADO[estado] || estado.toUpperCase() || "—"], ["Institución", certificado.institucionCertificado || "SIDCA — Sindicato de Docentes de Catamarca"]]}
          onEscanearOtro={() => history.replace("/validar-certificados", { autoOpenScanner: true })}
          onCerrar={() => history.replace("/validar-certificados/inicio")}
          onRegistrarCurso={validacion.valido ? registrarCurso : undefined}
          registrado={registrado || Boolean(registroInfo)}
          registrando={registrando}
          registroInfo={registroInfo ? {
            usuario: registroInfo.usuarioNombre || registroInfo.email || registroInfo.registradoPorNombre || "otro usuario",
            fecha: registroInfo.fecha || registroInfo.registradoEn || "una fecha anterior",
          } : null}
          registroError={registroError}
        />}
        {false && !validando && validacion && (
          <Dialog header="Resultado de validación" visible modal closable onHide={() => history.replace("/validar-certificados/inicio")} className={styles.dialogoResultado}>
          <>
            {validacion.valido ? (
              <div className={styles.bloqueValido}>
                <span className={styles.iconoResultado} aria-hidden="true">
                  ✓
                </span>
                <h2 className={styles.resultadoTitulo}>CERTIFICADO VÁLIDO</h2>
              </div>
            ) : (
              <div className={styles.bloqueNoVigente}>
                <h2 className={styles.resultadoTitulo}>
                  CERTIFICADO NO VIGENTE
                </h2>
                <p className={styles.resultadoTexto}>
                  Este certificado fue emitido por SIDCA, pero su estado actual
                  es{" "}
                  <strong>{ETIQUETA_ESTADO[estado] || estado.toUpperCase()}</strong>
                  .
                </p>
              </div>
            )}

            <dl className={styles.datos}>
              <div className={styles.dato}>
                <dt className={styles.datoLabel}>Apellido y nombre</dt>
                <dd className={styles.datoValor}>
                  {participante.apellidoNombre || "—"}
                </dd>
              </div>

              <div className={styles.dato}>
                <dt className={styles.datoLabel}>DNI</dt>
                <dd className={styles.datoValor}>
                  {formatearDni(participante.dni)}
                </dd>
              </div>

              <div className={styles.dato}>
                <dt className={styles.datoLabel}>Capacitación</dt>
                <dd className={styles.datoValor}>
                  {certificado.titulo || certificado.cursoTitulo || "—"}
                </dd>
              </div>

              <div className={styles.dato}>
                <dt className={styles.datoLabel}>Resolución</dt>
                <dd className={styles.datoValor}>
                  {certificado.resolucion || "—"}
                </dd>
              </div>

              <div className={styles.dato}>
                <dt className={styles.datoLabel}>Carga horaria</dt>
                <dd className={styles.datoValor}>
                  {certificado.cargaHoraria || "—"}
                </dd>
              </div>

              <div className={styles.dato}>
                <dt className={styles.datoLabel}>Modalidad</dt>
                <dd className={styles.datoValor}>
                  {certificado.modalidad || "—"}
                </dd>
              </div>

              <div className={styles.dato}>
                <dt className={styles.datoLabel}>Días</dt>
                <dd className={styles.datoValor}>{certificado.dias || "—"}</dd>
              </div>

              <div className={styles.dato}>
                <dt className={styles.datoLabel}>Fecha del certificado</dt>
                <dd className={styles.datoValor}>{certificado.fecha || "—"}</dd>
              </div>

              <div className={styles.dato}>
                <dt className={styles.datoLabel}>Fecha de emisión</dt>
                <dd className={styles.datoValor}>
                  {formatearFechaEmision(validacion.emitidoEn)}
                </dd>
              </div>

              <div className={styles.dato}>
                <dt className={styles.datoLabel}>Estado</dt>
                <dd
                  className={`${styles.datoValor} ${
                    validacion.valido ? styles.estadoVigente : styles.estadoNoVigente
                  }`}
                >
                  {ETIQUETA_ESTADO[estado] || estado.toUpperCase() || "—"}
                </dd>
              </div>
            </dl>
            {validacion.verificacion && (
              <section className={styles.auditoria}>
                <strong>VALIDACIÓN REALIZADA POR</strong>
                <span>{validacion.verificacion.validador?.nombre || "—"}</span>
                <span>{validacion.verificacion.validador?.email || "—"}</span>
                <strong>FECHA Y HORA DE VALIDACIÓN</strong>
                <span>{formatearFechaEmision(validacion.verificacion.validadoEn)}</span>
              </section>
            )}
            <div className={styles.accionesDialogo}>
              <button type="button" className={styles.botonPrimario} onClick={() => history.push("/validar-certificados")}>Validar otro certificado</button>
              <button type="button" className={styles.botonSecundario} onClick={() => history.replace("/validar-certificados/inicio")}>Ir al inicio</button>
            </div>
          </>
          </Dialog>
        )}

        <div className={styles.pie}>
          <span className={styles.sesion}>
            {origenSesion === "principal"
              ? `Validado con tu sesión de SIDCA: ${
                  sesionElegida.usuario.email || "cuenta autorizada"
                }`
              : `Sesión: ${sesionElegida.usuario.email || "cuenta autorizada"}`}
          </span>

          {/* Sólo se ofrece cerrar la sesión del VALIDADOR. Con la sesión
              principal no se muestra: cerrarla desde acá sacaría al
              administrador del panel, que no es lo que esperaría. */}
          {origenSesion === "validador" && (
            <button
              type="button"
              className={styles.botonSecundario}
              onClick={manejarCierre}
            >
              Cerrar sesión
            </button>
          )}

          {/* Con la sesión principal se ofrece validar con otra cuenta, sin
              tocar la del panel. */}
          {origenSesion === "principal" && (
            <button
              type="button"
              className={styles.botonSecundario}
              onClick={() => setPrincipalRechazada(true)}
            >
              Usar otra cuenta
            </button>
          )}
        </div>
       </div>
      </div>
    </>
  );
};

export default ValidarCertificadoQr;
