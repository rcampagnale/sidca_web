// src/pages/Admin/Certificados/ValidarCertificadoQR.js
//
// Pestaña VALIDAR QR del módulo de certificados.
//
// Comprueba la autenticidad y la vigencia de un certificado emitido. Es una
// pantalla de SÓLO LECTURA: no emite, no edita, no anula y no escribe nada en
// Firestore. Lo único que hace es consultar el endpoint de validación.
//
// Seguridad: el QR NO decide nada. Del código escaneado sólo se extraen dos
// datos —cursoId y token— y la respuesta sobre si el certificado es auténtico
// viene siempre del backend. Que la URL tenga el formato correcto no alcanza
// para mostrar el resultado en verde.
//
// La cámara no se enciende al entrar: hay que pedirla. Así no se dispara el
// permiso del navegador sin que el operador lo haya solicitado.

import React, { useCallback, useEffect, useRef, useState } from "react";
import { QrReader } from "react-qr-reader";
import { Dialog } from "primereact/dialog";
import ResultadoValidacionCertificado from "../../ValidarCertificado/components/ResultadoValidacionCertificado";

import {
  validarCertificadoQR,
  registrarValidacionCertificado,
} from "../../../services/certificadosService";
import styles from "./CertificadosAdmin.module.css";
import validar from "./ValidarCertificadoQR.module.css";

/**
 * Token de validación tal como lo genera el backend: 48 caracteres
 * hexadecimales. Se comprueba acá para no molestar al servidor con códigos que
 * evidentemente no son nuestros.
 */
const TOKEN_REGEX = /^[a-f0-9]{48}$/i;

/** Segmento de la ruta que identifica una URL de validación SIDCA. */
const SEGMENTO_VALIDACION = "validar-certificado";

/**
 * Extrae cursoId y token de lo que venga en el QR.
 *
 * Acepta la URL completa —https://sidcagremio.com/validar-certificado/{curso}/{token}—
 * y también la ruta suelta /validar-certificado/{curso}/{token}, porque no
 * todos los lectores devuelven exactamente lo mismo.
 *
 * Devuelve null si el código no tiene la forma de un certificado SIDCA. En ese
 * caso NO se consulta al backend.
 */
export const extraerDatosValidacionQR = (valor) => {
  const crudo = String(valor || "").trim();
  if (!crudo) return null;

  // Se normaliza a una ruta: si es una URL absoluta se toma su pathname, y si
  // ya es una ruta se usa tal cual. La base de URL() es descartable, sólo
  // sirve para poder parsear rutas relativas.
  let ruta;
  try {
    ruta = new URL(crudo, "https://sidcagremio.com").pathname;
  } catch (error) {
    return null;
  }

  const partes = ruta
    .split("/")
    .map((parte) => parte.trim())
    .filter(Boolean);

  const indice = partes.indexOf(SEGMENTO_VALIDACION);
  if (indice === -1 || partes.length < indice + 3) return null;

  // decodeURIComponent por si el identificador viaja escapado.
  let cursoId;
  let token;
  try {
    cursoId = decodeURIComponent(partes[indice + 1]);
    token = decodeURIComponent(partes[indice + 2]);
  } catch (error) {
    return null;
  }

  if (!cursoId || !TOKEN_REGEX.test(token)) return null;

  return { cursoId, token };
};

/** Sólo para mostrar. El DNI original no se toca. */
const formatearDni = (dni) => {
  const limpio = String(dni || "").replace(/\D/g, "");
  if (!limpio) return "—";
  return limpio.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
};

/** Fecha ISO a un texto legible. Si no se puede interpretar, se muestra crudo. */
const formatearFecha = (valor) => {
  if (!valor) return "—";
  const fecha = new Date(valor);
  if (Number.isNaN(fecha.getTime())) return String(valor);
  return fecha.toLocaleDateString("es-AR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
};

const INSTITUCIONES = {
  sidca: "SIDCA — Sindicato de Docentes de Catamarca",
  itm: "ITM — Instituto Tecnológico Municipal",
};

/**
 * Presentación de cada desenlace.
 *
 * El estado nunca se comunica sólo por color: cada caso lleva su icono y su
 * texto, para que se entienda en blanco y negro o con daltonismo.
 */
const RESULTADOS = {
  vigente: {
    clase: "resultadoValido",
    icono: "✓",
    titulo: "CERTIFICADO VÁLIDO",
    detalle:
      "Este certificado fue emitido por el sistema de certificación SIDCA y se encuentra vigente.",
  },
  anulado: {
    clase: "resultadoAnulado",
    icono: "✕",
    titulo: "CERTIFICADO ANULADO",
    detalle:
      "Este certificado existe, pero fue anulado y actualmente no tiene validez.",
  },
  reemplazado: {
    clase: "resultadoReemplazado",
    icono: "!",
    titulo: "CERTIFICADO REEMPLAZADO",
    detalle:
      "Este certificado fue reemplazado por una emisión posterior y ya no se encuentra vigente.",
  },
  desconocido: {
    clase: "resultadoReemplazado",
    icono: "!",
    titulo: "CERTIFICADO SIN VIGENCIA CONFIRMADA",
    detalle:
      "El certificado existe, pero el servidor informó un estado que esta pantalla no puede interpretar como vigente.",
  },
  noEncontrado: {
    clase: "resultadoNoEncontrado",
    icono: "✕",
    titulo: "CERTIFICADO NO ENCONTRADO",
    detalle:
      "El código escaneado no corresponde a un certificado registrado o el código de validación es inválido.",
  },
};

/** Recuadro guía sobre el vídeo. */
const Mira = () => <span className={validar.mira} aria-hidden="true" />;

const ValidarCertificadoQR = ({ notificar }) => {
  const [camaraActiva, setCamaraActiva] = useState(false);
  const [validando, setValidando] = useState(false);
  const [resultado, setResultado] = useState(null);
  const [error, setError] = useState("");
  const [registrando, setRegistrando] = useState(false);
  const [registrado, setRegistrado] = useState(false);
  const [registroInfo, setRegistroInfo] = useState(null);

  /**
   * Un lector de QR entrega el mismo código muchas veces por segundo. Estas
   * dos referencias son las que impiden que eso se convierta en una ráfaga de
   * consultas al backend.
   *
   * Son refs y no estado a propósito: entre una lectura y el render siguiente
   * pueden llegar varios fotogramas, y un setState todavía no aplicado dejaría
   * pasar los duplicados.
   */
  const procesandoRef = useRef(false);
  const ultimoCodigoRef = useRef("");
  const montadoRef = useRef(true);

  useEffect(() => {
    montadoRef.current = true;
    return () => {
      montadoRef.current = false;
    };
  }, []);

  /**
   * Único camino de validación: lo invoca exclusivamente el lector QR.
   */
  const procesarCodigoQR = useCallback(
    async (valor) => {
      const crudo = String(valor || "").trim();
      if (!crudo || procesandoRef.current) return;

      // Mismo código que el anterior: ya se resolvió, no se vuelve a consultar.
      if (crudo === ultimoCodigoRef.current) return;

      procesandoRef.current = true;
      ultimoCodigoRef.current = crudo;

      const datos = extraerDatosValidacionQR(crudo);

      if (!datos) {
        // No se consulta al backend: el código ni siquiera tiene la forma de
        // un certificado nuestro.
        setResultado(null);
        setError("Este código QR no corresponde a un certificado SIDCA.");
        setCamaraActiva(false);
        procesandoRef.current = false;
        return;
      }

      setError("");
      setResultado(null);
      setValidando(true);
      // La cámara se apaga en cuanto hay una lectura utilizable: desmontar el
      // lector es lo que libera el stream.
      setCamaraActiva(false);

      try {
        const validacion = await validarCertificadoQR(datos.cursoId, datos.token);
        if (!montadoRef.current) return;

        if (!validacion) {
          setResultado({ tipo: "noEncontrado" });
          return;
        }

        const estado = String(validacion.estado || "").toLowerCase();

        let tipo = "desconocido";
        if (validacion.valido === true && estado === "vigente") tipo = "vigente";
        else if (estado === "anulado") tipo = "anulado";
        else if (estado === "reemplazado") tipo = "reemplazado";

        setResultado({
          tipo,
          validacion: { ...validacion, cursoId: datos.cursoId, token: datos.token },
        });
      } catch (e) {
        if (!montadoRef.current) return;

        // 404 es un desenlace previsto, no una falla: el código no existe.
        if (e?.status === 404) {
          setResultado({ tipo: "noEncontrado" });
        } else {
          setError(e?.message || "No se pudo validar el certificado.");
          notificar?.(
            "error",
            "No se pudo validar el certificado",
            e?.message || "Error inesperado."
          );
        }
      } finally {
        if (montadoRef.current) setValidando(false);
        procesandoRef.current = false;
      }
    },
    [notificar]
  );

  /** Callback del lector. Descarta los fotogramas sin código. */
  const alLeer = useCallback(
    (result) => {
      if (!result) return;
      const texto =
        typeof result.getText === "function" ? result.getText() : String(result);
      procesarCodigoQR(texto);
    },
    [procesarCodigoQR]
  );

  const activarCamara = useCallback(() => {
    setError("");
    setResultado(null);
    setRegistrado(false);
    setRegistroInfo(null);
    ultimoCodigoRef.current = "";
    setCamaraActiva(true);
  }, []);

  const registrarValidacion = useCallback(async () => {
    const datos = resultado?.validacion;
    if (!datos?.cursoId || !datos?.token || registrando || registrado) return;
    const curso = datos.certificado?.titulo || datos.certificado?.cursoTitulo || "Sin título";
    const fecha = datos.certificado?.fecha || "Sin fecha";
    const confirmar = window.confirm(
      `Vas a registrar el curso:\n\n${curso}\n\nFecha del certificado: ${fecha}\n\n¿Confirmás el registro?`
    );
    if (!confirmar) return;
    setRegistrando(true);
    try {
      await registrarValidacionCertificado(datos.cursoId, datos.token);
      setRegistrado(true);
      setRegistroInfo(null);
      notificar?.("success", "Validación registrada", "Se guardaron fecha, hora y usuario.");
    } catch (e) {
      if (e?.status === 409) {
        const existente = e?.datos?.validacion || e?.datos?.registro || {};
        setRegistroInfo({
          usuario: existente.usuarioNombre || existente.email || existente.validadoPor || "otro usuario",
          fecha: existente.fecha || existente.validadoEn || "una fecha anterior",
        });
      } else {
        setError(e?.message || "No se pudo registrar la validación.");
      }
    } finally {
      setRegistrando(false);
    }
  }, [resultado, registrando, registrado, notificar]);

  const cerrarCamara = useCallback(() => setCamaraActiva(false), []);

  /** Deja la pantalla como recién abierta, sin recargar nada. */
  const escanearOtro = useCallback(() => {
    setResultado(null);
    setError("");
    ultimoCodigoRef.current = "";
    procesandoRef.current = false;
    // Al elegir otro certificado, reabrimos el lector inmediatamente.
    setCamaraActiva(true);
  }, []);

  const cerrarResultado = useCallback(() => {
    setResultado(null);
    setError("");
  }, []);

  const presentacion = resultado ? RESULTADOS[resultado.tipo] : null;
  const datosCertificado = resultado?.validacion || null;
  const certificado = datosCertificado?.certificado || null;
  const participante = datosCertificado?.participante || null;

  // El certificado no encontrado no muestra datos: no hay nada real que
  // mostrar y no se inventa nada.
  const mostrarDatos = Boolean(
    presentacion && resultado.tipo !== "noEncontrado" && datosCertificado
  );

  const filas = mostrarDatos
    ? [
        ["Participante", participante?.apellidoNombre || "—"],
        ["DNI", formatearDni(participante?.dni)],
        ["Capacitación", certificado?.titulo || certificado?.cursoTitulo || "—"],
        ["Resolución", certificado?.resolucion || "—"],
        ["Modalidad", certificado?.modalidad || "—"],
        ["Carga horaria", certificado?.cargaHoraria || "—"],
        ["Período", certificado?.dias || "—"],
        ["Fecha del certificado", certificado?.fecha || "—"],
        ["Fecha de emisión", formatearFecha(datosCertificado?.emitidoEn)],
        ["Estado", datosCertificado?.estado || "—"],
        [
          "Institución",
          INSTITUCIONES[certificado?.institucionCertificado] ||
            INSTITUCIONES.sidca,
        ],
      ]
    : [];

  return (
    <>
      <section className={styles.bloque}>
        <div className={styles.bloqueHeader}>
          <h2 className={styles.bloqueTitulo}>Validación de certificados</h2>
        </div>
        <p className={styles.ayuda}>
          Escaneá el código QR de un certificado para comprobar su autenticidad
          y vigencia.
        </p>
      </section>

      <div className={validar.columnas}>
        {/* ---------- Cámara ---------- */}
        <section className={styles.bloque}>
          <div className={styles.bloqueHeader}>
            <h2 className={styles.bloqueTitulo}>Escanear código QR</h2>
          </div>

          {camaraActiva ? (
            <>
              <div className={validar.camara}>
                {/* Al desmontarse, react-qr-reader detiene el stream: por eso
                    la cámara se apaga sacando el componente del árbol y no
                    escondiéndolo con CSS. */}
                <QrReader
                  constraints={{
                    facingMode: { ideal: "environment" },
                    width: { ideal: 1280 },
                    height: { ideal: 720 },
                  }}
                  onResult={alLeer}
                  scanDelay={400}
                  ViewFinder={Mira}
                  videoId="validador-qr-video"
                  containerStyle={{ width: "100%" }}
                  videoContainerStyle={{ width: "100%", height: "100%" }}
                  videoStyle={{ objectFit: "cover" }}
                />
              </div>

              <p className={validar.instruccion}>
                Ubicá el código QR dentro del recuadro.
              </p>

              <button
                type="button"
                className={styles.botonSecundario}
                onClick={cerrarCamara}
              >
                Cerrar cámara
              </button>
            </>
          ) : (
            <>
              <div className={validar.camaraApagada}>
                <span className={validar.camaraIcono} aria-hidden="true">
                  ▢
                </span>
                <span>La cámara está apagada.</span>
              </div>

              <button
                type="button"
                className={styles.botonPrimario}
                onClick={activarCamara}
                disabled={validando}
              >
                Activar cámara
              </button>
            </>
          )}
        </section>

      </div>

      {/* ---------- Resultado ---------- */}
      {validando && (
        <section className={styles.bloque}>
          <p className={validar.cargando}>
            <span className={validar.spinner} aria-hidden="true" />
            Comprobando certificado…
          </p>
        </section>
      )}

      {!validando && error && (
        <section className={styles.bloque}>
          <p className={styles.mensajeError}>{error}</p>
          <button
            type="button"
            className={styles.botonSecundario}
            onClick={escanearOtro}
          >
            Escanear otro certificado
          </button>
        </section>
      )}

      {!validando && presentacion && <ResultadoValidacionCertificado
        resultado={resultado}
        presentacion={presentacion}
        datosCertificado={datosCertificado}
        filas={filas}
        mostrarDatos={mostrarDatos}
        registrado={registrado}
        registrando={registrando}
        onRegistrarCurso={resultado.tipo === "vigente" ? registrarValidacion : undefined}
        onEscanearOtro={escanearOtro}
        onCerrar={cerrarResultado}
        registroInfo={registroInfo || datosCertificado?.registroCurso}
      />}
      {false && !validando && presentacion && (
        <Dialog
          header="Resultado de la validación"
          visible
          modal
          closable
          onHide={cerrarResultado}
          className={validar.dialogoResultado}
        >
          <section>
          <div
            className={`${validar.resultado} ${validar[presentacion.clase]}`}
            role="status"
            aria-live="polite"
          >
            <span className={validar.resultadoIcono} aria-hidden="true">
              {presentacion.icono}
            </span>
            <div>
              <p className={validar.resultadoTitulo}>{presentacion.titulo}</p>
              <p className={validar.resultadoDetalle}>{presentacion.detalle}</p>
              {resultado.tipo === "desconocido" && (
                <p className={validar.resultadoDetalle}>
                  Estado informado:{" "}
                  <strong>{datosCertificado?.estado || "sin dato"}</strong>
                </p>
              )}
            </div>
          </div>

          {mostrarDatos && (
            <dl className={validar.datos}>
              {filas.map(([etiqueta, valor]) => (
                <div key={etiqueta} className={validar.dato}>
                  <dt className={validar.datoEtiqueta}>{etiqueta}</dt>
                  <dd className={validar.datoValor}>{valor}</dd>
                </div>
              ))}
            </dl>
          )}

          <div className={validar.accionesResultado}>
            {registroInfo && (
              <p className={validar.registroAviso} role="status">
                Este curso ya fue registrado por {registroInfo.usuario} el {registroInfo.fecha}.
              </p>
            )}
            {resultado.tipo === "vigente" && (
              <button
                type="button"
                className={styles.botonPrimario}
                onClick={registrarValidacion}
                disabled={registrando || registrado}
              >
                {registrado
                  ? "Curso registrado"
                  : registrando
                    ? "Registrando…"
                    : "Registrar curso"}
              </button>
            )}

            <button
              type="button"
              className={styles.botonPrimario}
              onClick={escanearOtro}
            >
              Escanear otro certificado
            </button>
          </div>
          </section>
        </Dialog>
      )}
    </>
  );
};

export default ValidarCertificadoQR;
