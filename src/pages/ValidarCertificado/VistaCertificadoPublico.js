import React from "react";
import styles from "./VistaCertificadoPublico.module.css";

const texto = (valor) => String(valor || "").trim() || "—";

const formatearFecha = (valor) => {
  const crudo = String(valor || "").trim();
  if (!crudo) return "";

  const partes = crudo.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (partes) return `${partes[3]}/${partes[2]}/${partes[1].slice(-2)}`;

  const diaMesAnio = crudo.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})$/);
  if (diaMesAnio) {
    const anio = diaMesAnio[3].length === 4 ? diaMesAnio[3].slice(-2) : diaMesAnio[3];
    return `${diaMesAnio[1].padStart(2, "0")}/${diaMesAnio[2].padStart(2, "0")}/${anio}`;
  }

  return crudo;
};

const formatearFechaCursado = (certificado) => {
  const inicio = formatearFecha(certificado?.fechaInicio);
  const fin = formatearFecha(certificado?.fechaFin);
  if (inicio && fin) return `${inicio}-${fin}`;

  const historico = String(certificado?.dias || certificado?.fecha || "").trim();
  const fechas = historico.match(/\d{1,2}[/-]\d{1,2}[/-]\d{2,4}/g);
  if (fechas?.length >= 2) {
    return `${formatearFecha(fechas[0])}-${formatearFecha(fechas[1])}`;
  }

  return formatearFecha(historico) || "—";
};

const campoTipoCertificado = (certificado) =>
  String(
    certificado?.tipoCertificado ||
      certificado?.tipo_certificado ||
      certificado?.condicion ||
      certificado?.tipoParticipacion ||
      "ALUMNO/A - REQUISITOS COMPLETOS"
  ).trim();

const VistaCertificadoPublico = ({ validacion }) => {
  const estado = String(validacion?.estado || "").toLowerCase();
  const certificado = validacion?.certificado || {};
  const participante = validacion?.participante || {};
  const vigente = validacion?.valido === true && estado === "vigente";

  if (!vigente) {
    const estadoVisible =
      estado === "anulado" || estado === "reemplazado"
        ? `El certificado se encuentra ${estado.toUpperCase()}.`
        : "El código QR no corresponde a un certificado vigente.";

    return (
      <main className={styles.pagina}>
        <section className={styles.documento}>
          <h1>CERTIFICADO NO VÁLIDO</h1>
          <p>{estadoVisible}</p>
        </section>
      </main>
    );
  }

  const filas = [
    ["Apellido y Nombre:", texto(participante.apellidoNombre)],
    ["Documento:", String(participante.dni || "").replace(/\D/g, "") || "—"],
    ["Proyecto:", texto(certificado.cursoTitulo || certificado.titulo)],
    ["Tipo Certificado:", campoTipoCertificado(certificado)],
    ["Fecha Cursado", formatearFechaCursado(certificado)],
  ];

  return (
    <main className={styles.pagina}>
      <section className={styles.documento} aria-label="Datos del certificado">
        {filas.map(([etiqueta, valor]) => (
          <p className={styles.linea} key={etiqueta}>
            <span className={styles.etiqueta}>{etiqueta}</span>
            <span>{valor}</span>
          </p>
        ))}
      </section>
    </main>
  );
};

export default VistaCertificadoPublico;
