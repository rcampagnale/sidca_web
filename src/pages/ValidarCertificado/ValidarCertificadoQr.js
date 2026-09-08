//
// Pantalla pública a la que llega el QR de un certificado emitido:
//
//   /validar-certificado/:cursoId/:token
//
// El token identifica la emisión. La consulta es de sólo lectura y no
// depende de Firebase Auth: el endpoint devuelve un DTO seguro construido
// desde el snapshot inmutable del certificado.

import React, { useEffect, useState } from "react";
import { useHistory, useParams } from "react-router-dom";

import {
  validarCertificadoPublico,
  validarCertificadoQr,
} from "../../services/certificadosValidacionService";
import useSesionValidador from "./components/useSesionValidador";
import VistaCertificadoPublico from "./VistaCertificadoPublico";
import styles from "./VistaCertificadoPublico.module.css";

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
  const {
    cargando: sesionCargando,
    sesion,
    validador,
    principal,
    origenSesion,
    permisos,
    permisosCargando,
  } = useSesionValidador();
  const [validando, setValidando] = useState(true);
  const [validacion, setValidacion] = useState(null);

  useEffect(() => {
    let activa = true;

    const consultar = async () => {
      if (sesionCargando || permisosCargando) return;

      setValidando(true);
      setValidacion(null);

      try {
        const esInstitucional = Boolean(
          sesion && permisos.certificados === true
        );
        const usuarioInstitucional =
          origenSesion === "validador" ? validador : principal;
        const resultado = esInstitucional
          ? await validarCertificadoQr(cursoId, certificadoToken, {
              usuarioFirebase: usuarioInstitucional,
            })
          : await validarCertificadoPublico(cursoId, certificadoToken);
        if (!activa) return;

        // La interfaz institucional existente sigue siendo la única que
        // muestra auditoría, registro y acciones administrativas.
        if (esInstitucional) {
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
      } catch {
        if (!activa) return;
        setValidacion({ valido: false, estado: "desconocido" });
      } finally {
        if (activa) setValidando(false);
      }
    };

    consultar();
    return () => {
      activa = false;
    };
  }, [
    certificadoToken,
    cursoId,
    history,
    origenSesion,
    permisos,
    permisosCargando,
    principal,
    sesion,
    sesionCargando,
    validador,
  ]);

  if (sesionCargando || permisosCargando || validando) {
    return (
      <main className={styles.pagina}>
        <p className={styles.estadoTexto}>Verificando certificado…</p>
      </main>
    );
  }

  return (
    <VistaCertificadoPublico
      validacion={validacion || { valido: false, estado: "desconocido" }}
    />
  );
};

export default ValidarCertificadoQr;
