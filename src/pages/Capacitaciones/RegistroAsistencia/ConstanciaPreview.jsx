// src/pages/Capacitaciones/RegistroAsistencia/ConstanciaPreview.jsx
import React, { useMemo, useRef, useState } from "react";
import { Dialog } from "primereact/dialog";
import { Button } from "primereact/button";
import { ProgressSpinner } from "primereact/progressspinner";
import html2canvas from "html2canvas";
import { jsPDF } from "jspdf";

import constanciaCapacitacionImg from "../../../assets/constancia/constancia_capacitacion.png";
import styles from "./ConstanciaPreview.module.css";

const pad2 = (n) => String(n).padStart(2, "0");

const limpiarTexto = (value) =>
  String(value || "")
    .replace(/\s+/g, " ")
    .trim();

const limpiarParaArchivo = (value) =>
  String(value || "constancia")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9_-]+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_|_$/g, "")
    .slice(0, 90) || "constancia";

const formatDateAR = (date = new Date()) => {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return "";
  return `${pad2(date.getDate())}/${pad2(date.getMonth() + 1)}/${date.getFullYear()}`;
};

const fechaEmisionLarga = (date = new Date()) => {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return "";

  const meses = [
    "enero",
    "febrero",
    "marzo",
    "abril",
    "mayo",
    "junio",
    "julio",
    "agosto",
    "septiembre",
    "octubre",
    "noviembre",
    "diciembre",
  ];

  return `${date.getDate()} días del mes de ${meses[date.getMonth()]} de ${date.getFullYear()}`;
};

const normalizarMayuscula = (value) => limpiarTexto(value).toUpperCase();

const clasePorLongitud = (value, limiteLargo, limiteMuyLargo) => {
  const longitud = limpiarTexto(value).length;
  if (longitud > limiteMuyLargo) return styles.textoMuyLargo;
  if (longitud > limiteLargo) return styles.textoLargo;
  return "";
};

const nombreCompleto = (perfil = {}) => {
  const apellido = limpiarTexto(perfil?.apellido);
  const nombre = limpiarTexto(perfil?.nombre);

  if (apellido && nombre) return `${apellido}, ${nombre}`;
  return apellido || nombre || "Afiliado/a";
};

const getCursoDesdeRegistro = ({ item, grupo, configCurso }) => {
  const dataOriginal = configCurso?.dataOriginal || {};
  return limpiarTexto(
    dataOriginal?.cursoNombre ||
      dataOriginal?.nombreCurso ||
      dataOriginal?.cursoTitulo ||
      dataOriginal?.curso ||
      dataOriginal?.titulo ||
      configCurso?.cursoNombre ||
      grupo?.curso ||
      item?.curso ||
      item?.cursoTitulo ||
      item?.original?.cursoTitulo ||
      item?.original?.curso ||
      "Curso de capacitación",
  );
};

const getFechasValidas = ({ item, grupo }) => {
  const fechas = (grupo?.items || [])
    .filter((asistencia) => asistencia?.asistenciaValidada)
    .map((asistencia) =>
      limpiarTexto(asistencia?.fecha || asistencia?.fechaVista),
    )
    .filter(Boolean);

  if (fechas.length > 0) return fechas.join(" - ");
  return (
    limpiarTexto(item?.fecha || item?.fechaVista) || formatDateAR(new Date())
  );
};

const getDatoConfig = (configCurso, keys, fallback = "") => {
  const dataOriginal = configCurso?.dataOriginal || {};

  for (const key of keys) {
    const value = dataOriginal?.[key] ?? configCurso?.[key];
    if (limpiarTexto(value)) return limpiarTexto(value);
  }

  return fallback;
};

export default function ConstanciaPreview({
  visible,
  onHide,
  perfil = {},
  item = null,
  grupo = null,
  configCurso = null,
}) {
  const previewRef = useRef(null);
  const [descargando, setDescargando] = useState(false);

  const datos = useMemo(() => {
    const dataOriginal = configCurso?.dataOriginal || {};

    const afiliado = nombreCompleto(perfil);
    const dni = limpiarTexto(perfil?.dni || item?.dni || item?.original?.dni);
    const departamento = limpiarTexto(
      perfil?.departamento ||
        item?.departamento ||
        item?.original?.departamento ||
        dataOriginal?.departamento ||
        "",
    );

    const curso = getCursoDesdeRegistro({ item, grupo, configCurso });

    const cursoConDepartamento = departamento
      ? `DPTO ${departamento.toUpperCase()} - ${curso.toUpperCase()}`
      : curso.toUpperCase();

    const diasCurso = getDatoConfig(
      configCurso,
      [
        "diasCurso",
        "dias",
        "fechaCurso",
        "fechasCurso",
        "fechas",
        "fechasAsistencia",
      ],
      getFechasValidas({ item, grupo }),
    );

    const fechaEmision = getDatoConfig(
      configCurso,
      ["fechaEmision", "fecha_emision", "emision", "emitidoEn"],
      fechaEmisionLarga(new Date()),
    );

    const lugarEmision = getDatoConfig(
      configCurso,
      ["lugarEmision", "lugar_emision", "lugar", "ciudadEmision"],
      "San Fernando del Valle de Catamarca",
    );

    const resolucion = getDatoConfig(
      configCurso,
      [
        "resolucion",
        "resolución",
        "nroResolucion",
        "numeroResolucion",
        "normativa",
      ],
      "",
    );

    return {
      afiliado,
      dni,
      departamento,
      curso,
      cursoConDepartamento,
      diasCurso,
      fechaEmision,
      lugarEmision,
      resolucion,
    };
  }, [perfil, item, grupo, configCurso]);

  const descargarPDF = async () => {
    if (!previewRef.current || descargando) return;

    setDescargando(true);
    const nodo = previewRef.current;

    try {
      nodo.classList.add(styles.exportMode);
      await new Promise((resolve) => setTimeout(resolve, 120));

      const canvas = await html2canvas(nodo, {
        scale: 2.5,
        useCORS: true,
        allowTaint: true,
        backgroundColor: "#ffffff",
        logging: false,
      });

      const imgData = canvas.toDataURL("image/png", 1.0);
      const pdf = new jsPDF({
        orientation: "portrait",
        unit: "mm",
        format: "a4",
        compress: true,
      });

      pdf.addImage(imgData, "PNG", 0, 0, 210, 297);

      const archivo = limpiarParaArchivo(
        `constancia_${datos.dni || "dni"}_${datos.afiliado}_${datos.curso}`,
      );

      pdf.save(`${archivo}.pdf`);
    } catch (error) {
      console.error("Error al descargar constancia:", error);
      alert("No se pudo descargar la constancia. Intente nuevamente.");
    } finally {
      nodo.classList.remove(styles.exportMode);
      setDescargando(false);
    }
  };

  const footer = (
    <div className={styles.footerActions}>
      <Button
        label="Cerrar"
        className={styles.closeButton}
        onClick={onHide}
        disabled={descargando}
      />

      <Button
        label={descargando ? "Generando PDF..." : "Descargar PDF"}
        onClick={descargarPDF}
        disabled={descargando}
        className={styles.downloadButton}
      />
    </div>
  );

  return (
    <Dialog
      header="Vista previa de constancia"
      visible={visible}
      modal
      onHide={descargando ? undefined : onHide}
      footer={footer}
      draggable={false}
      className={styles.dialog}
      style={{ width: "min(980px, 96vw)" }}
    >
      <div className={styles.wrapper}>
        {descargando && (
          <div className={styles.loadingOverlay}>
            <ProgressSpinner />
            <span>Generando constancia...</span>
          </div>
        )}

        <div className={styles.previewScroll}>
          <div ref={previewRef} className={styles.certificate}>
            <img
              src={constanciaCapacitacionImg}
              alt="Constancia de capacitación"
              className={styles.template}
            />

            <div className={styles.watermarkPreview}>DOCUMENTO NO VÁLIDO</div>

            <div
              className={`${styles.field} ${styles.afiliado} ${clasePorLongitud(
                datos.afiliado,
                28,
                45,
              )}`}
            >
              {datos.afiliado}
            </div>

            <div className={`${styles.field} ${styles.dni}`}>
              {datos.dni || "-"}
            </div>

            <div
              className={`${styles.field} ${styles.curso} ${clasePorLongitud(
                datos.cursoNombre || datos.curso,
                58,
                92,
              )}`}
            >
              {normalizarMayuscula(datos.cursoNombre || datos.curso)}
            </div>

            {datos.resolucion && (
              <div
                className={`${styles.field} ${styles.resolucion} ${clasePorLongitud(
                  datos.resolucion,
                  24,
                  42,
                )}`}
              >
                {datos.resolucion}
              </div>
            )}

            <div
              className={`${styles.field} ${styles.diasCurso} ${clasePorLongitud(
                datos.diasCurso,
                30,
                50,
              )}`}
            >
              {datos.diasCurso}
            </div>

            <div
              className={`${styles.field} ${styles.fechaEmision} ${clasePorLongitud(
                datos.fechaEmision,
                46,
                72,
              )}`}
            >
              {datos.fechaEmision}
            </div>
          </div>
        </div>
      </div>
    </Dialog>
  );
}
