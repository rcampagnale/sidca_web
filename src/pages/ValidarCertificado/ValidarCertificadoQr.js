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
// La sesión es la de validatorAuth, una instancia Firebase aislada. Ingresar o
// cerrar sesión acá NO afecta la sesión administrativa del panel, que puede
// estar abierta en otra pestaña.
//
// Todos los datos que se muestran vienen del snapshot que devuelve el backend.
// No se consulta Firestore desde acá, ni usuarios, ni cursos.
//
// Pensada para celular: el uso principal es escanear el QR con el teléfono.

import React, { useCallback, useEffect, useState } from "react";
import { useParams } from "react-router-dom";

import { validatorAuth } from "../../firebase/firebaseCertificadosValidator";
import {
  cerrarSesionValidador,
  iniciarSesionValidador,
  validarCertificadoQr,
} from "../../services/certificadosValidacionService";
import styles from "./ValidarCertificadoQr.module.css";

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

  // null = Firebase todavía no terminó de restaurar la sesión.
  const [usuario, setUsuario] = useState(undefined);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [ingresando, setIngresando] = useState(false);
  const [errorLogin, setErrorLogin] = useState("");

  const [validando, setValidando] = useState(false);
  const [validacion, setValidacion] = useState(null);
  const [errorValidacion, setErrorValidacion] = useState("");
  const [estadoError, setEstadoError] = useState(0);

  /**
   * Consulta la validez del certificado.
   *
   * Un 401 que sobrevive al reintento del servicio significa que la sesión ya
   * no sirve: se cierra y la pantalla vuelve al formulario.
   */
  const validar = useCallback(async () => {
    setValidando(true);
    setErrorValidacion("");
    setEstadoError(0);
    setValidacion(null);

    try {
      const resultado = await validarCertificadoQr(cursoId, certificadoToken);
      setValidacion(resultado);
    } catch (e) {
      const status = Number(e?.status || 0);

      setEstadoError(status);
      setErrorValidacion(e?.message || "No se pudo validar el certificado.");

      if (status === 401) {
        try {
          await cerrarSesionValidador();
        } catch (errorCierre) {
          /* si falla el cierre, el formulario aparece igual */
        }
      }
    } finally {
      setValidando(false);
    }
  }, [cursoId, certificadoToken]);

  // Estado de la sesión del validador. Si ya hay usuario, se valida solo: no
  // se vuelve a pedir correo y contraseña.
  useEffect(() => {
    const desuscribir = validatorAuth.onAuthStateChanged((usuarioActual) => {
      setUsuario(usuarioActual || null);
    });

    return desuscribir;
  }, []);

  useEffect(() => {
    if (usuario) validar();
  }, [usuario, validar]);

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

  // ---- Firebase todavía restaurando la sesión ----
  if (usuario === undefined) {
    return (
      <div className={styles.pagina}>
        <div className={styles.tarjeta}>
          {encabezado}
          <p className={styles.estadoTexto}>Cargando…</p>
        </div>
      </div>
    );
  }

  // ---- Sin sesión: no se muestra NINGÚN dato del certificado ----
  if (!usuario) {
    return (
      <div className={styles.pagina}>
        <div className={styles.tarjeta}>
          {encabezado}

          <p className={styles.introduccion}>
            Para verificar este certificado debés ingresar con una cuenta
            autorizada.
          </p>

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

  return (
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

        {!validando && validacion && (
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
          </>
        )}

        <div className={styles.pie}>
          <span className={styles.sesion}>
            Sesión: {usuario.email || "cuenta autorizada"}
          </span>

          <button
            type="button"
            className={styles.botonSecundario}
            onClick={manejarCierre}
          >
            Cerrar sesión
          </button>
        </div>
      </div>
    </div>
  );
};

export default ValidarCertificadoQr;
