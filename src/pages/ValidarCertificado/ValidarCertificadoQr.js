//
// Pantalla pública a la que llega el QR de un certificado emitido:
//
//   /validar-certificado/:cursoId/:token
//
// El token identifica la emisión. La consulta es de sólo lectura y no
// depende de Firebase Auth: el endpoint devuelve un DTO seguro construido
// desde el snapshot inmutable del certificado.

import React, { useEffect, useState } from "react";
import { useHistory, useLocation, useParams } from "react-router-dom";

import { validarCertificadoPublico } from "../../services/certificadosValidacionService";
import styles from "./ValidarCertificadoQr.module.css";
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

const construirResultado = (validacion) => {
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
    tipo,
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
      ["Estado", ETIQUETA_ESTADO[estado] || estado.toUpperCase() || "—"],
      [
        "Institución",
        certificado.institucionValidacion || "—",
      ],
    ],
  };
};

const ValidarCertificadoQr = () => {
  const { cursoId, token: certificadoToken } = useParams();
  const history = useHistory();
  const location = useLocation();
  const [validando, setValidando] = useState(true);
  const [validacion, setValidacion] = useState(null);
  const [estadoError, setEstadoError] = useState(0);
  const modoValidador = Boolean(location.state?.modoValidador);

  useEffect(() => {
    let activa = true;

    const consultar = async () => {
      setValidando(true);
      setValidacion(null);
      setEstadoError(0);

      try {
        const resultado = await validarCertificadoPublico(cursoId, certificadoToken);
        if (!activa) return;

        // El escáner institucional reutiliza la misma consulta pública, pero
        // el resultado se muestra sobre su propia pantalla de gestión.
        if (modoValidador) {
          const resultadoConstruido = construirResultado(resultado);
          history.replace({
            pathname: "/validar-certificados",
            state: {
              resultadoValidacion: {
                resultado: { tipo: resultadoConstruido.tipo, validacion: resultado },
                cursoId,
                token: certificadoToken,
                presentacion: resultadoConstruido.presentacion,
                filas: resultadoConstruido.filas,
                registroInfo: resultado.registroCurso || null,
              },
            },
          });
          return;
        }

        setValidacion(resultado);
      } catch (error) {
        if (!activa) return;
        setEstadoError(Number(error?.status || 0));
      } finally {
        if (activa) setValidando(false);
      }
    };

    consultar();
    return () => {
      activa = false;
    };
  }, [certificadoToken, cursoId, history, modoValidador]);

  const encabezado = (
    <header className={styles.encabezado}>
      <span className={styles.marca}>SIDCA</span>
      <h1 className={styles.titulo}>Validación de Certificado SIDCA</h1>
    </header>
  );

  const resultado = validacion ? construirResultado(validacion) : null;

  return (
    <div className={styles.pagina}>
      <div className={styles.tarjeta}>
        {encabezado}

        {validando && (
          <p className={styles.estadoTexto}>Verificando certificado…</p>
        )}

        {!validando && !validacion && (
          <div className={styles.bloqueNoEncontrado}>
            <h2 className={styles.resultadoTitulo}>CERTIFICADO NO VÁLIDO</h2>
            <p className={styles.resultadoTexto}>
              {estadoError === 404 || estadoError === 400
                ? estadoError === 404
                  ? "No se encontró un certificado vigente asociado a este código."
                  : "El enlace de validación no es válido."
                : "No fue posible verificar el certificado en este momento."}
            </p>
          </div>
        )}

        {!validando && resultado && (
          <ResultadoValidacionCertificado
            resultado={{ tipo: resultado.tipo }}
            presentacion={resultado.presentacion}
            filas={resultado.filas}
            mostrarRegistro={false}
            onEscanearOtro={() => history.replace("/validar-certificados")}
            onCerrar={() => history.replace("/validar-certificados")}
          />
        )}
      </div>
    </div>
  );
};

export default ValidarCertificadoQr;
