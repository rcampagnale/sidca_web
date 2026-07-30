// src/pages/GestionDelegados/CargaMasivaExpedientes.js
//
// Carga masiva de expedientes finalizados desde los PDF oficiales de anexos.
//
// Flujo (4 etapas dentro del mismo Dialog):
//   1) cargar     → se elige el PDF y se extraen las filas de la tabla
//   2) verificar  → se cruza contra Firestore y se muestra el detalle
//   3) procesando → finalización por lotes con barra de progreso
//   4) resumen    → totales + acceso a los mensajes de WhatsApp
//
// Nada se escribe en Firestore hasta que el administrador confirma en la
// etapa 2.

import React, { useCallback, useMemo, useRef, useState } from "react";
import { Button } from "primereact/button";
import { Checkbox } from "primereact/checkbox";
import { Column } from "primereact/column";
import { confirmDialog } from "primereact/confirmdialog";
import { DataTable } from "primereact/datatable";
import { Dialog } from "primereact/dialog";
import { Dropdown } from "primereact/dropdown";
import { InputTextarea } from "primereact/inputtextarea";
import { ProgressBar } from "primereact/progressbar";
import { Tag } from "primereact/tag";
import * as XLSX from "xlsx";

import styles from "./CargaMasivaExpedientes.module.css";
import { leerAnexoPdf, agruparFilasPdf } from "../../services/pdfAnexoExpedientes";
import {
  verificarRegistros,
  finalizarExpedientesMasivo,
  actualizarEstadoMensaje,
  resumirVerificacion,
  RESULTADO,
  RESULTADO_LABEL,
  RESULTADO_SEVERIDAD,
  ADVERTENCIA,
  ADVERTENCIA_LABEL,
  ESTADO_MENSAJE,
  EXPEDIENTES_POR_LOTE,
} from "../../services/cargaMasivaExpedientesService";
import {
  MESES_HABER,
  obtenerMesCobroSiguiente,
  obtenerMesLabel,
  requiereMesHaber,
  construirUrlWhatsapp,
} from "../../utils/expedienteFinalizacion";

const ETIQUETA_ESTADO_MENSAJE = {
  [ESTADO_MENSAJE.PENDIENTE]: "Pendiente",
  [ESTADO_MENSAJE.ABIERTO]: "Abierto en WhatsApp",
  [ESTADO_MENSAJE.ENVIADO]: "Enviado",
  [ESTADO_MENSAJE.OMITIDO]: "Omitido",
  [ESTADO_MENSAJE.SIN_TELEFONO]: "Sin teléfono",
};

const SEVERIDAD_ESTADO_MENSAJE = {
  [ESTADO_MENSAJE.PENDIENTE]: "warning",
  [ESTADO_MENSAJE.ABIERTO]: "info",
  [ESTADO_MENSAJE.ENVIADO]: "success",
  [ESTADO_MENSAJE.OMITIDO]: null,
  [ESTADO_MENSAJE.SIN_TELEFONO]: "danger",
};

const CargaMasivaExpedientes = ({
  visible,
  onHide,
  usuarioMovimiento,
  modoUsuario,
  onFinalizado,
  toast,
}) => {
  const inputRef = useRef(null);

  const [etapa, setEtapa] = useState("cargar");
  const [nombreArchivo, setNombreArchivo] = useState("");
  const [leyendo, setLeyendo] = useState(false);
  const [progresoLectura, setProgresoLectura] = useState(null);
  const [errorLectura, setErrorLectura] = useState("");
  const [datosPdf, setDatosPdf] = useState(null);

  const [resultados, setResultados] = useState([]);
  const [filtroResultado, setFiltroResultado] = useState("");
  const [haberMes, setHaberMes] = useState("");

  const [procesando, setProcesando] = useState(false);
  const [progresoProceso, setProgresoProceso] = useState(null);
  const [resultadoFinal, setResultadoFinal] = useState(null);

  const [visibleWhatsapp, setVisibleWhatsapp] = useState(false);
  const [mensajes, setMensajes] = useState([]);

  const resumen = useMemo(() => resumirVerificacion(resultados), [resultados]);

  const seleccionados = useMemo(
    () => resultados.filter((r) => r.procesar && r.puedeProcesar),
    [resultados]
  );

  // El mes de haber solo es obligatorio si algún expediente seleccionado lo
  // necesita (los estados SOLICITUD/RECLAMO/VARIOS se comunican con la
  // observación, sin haber).
  const necesitaMesHaber = useMemo(
    () =>
      seleccionados.some((r) =>
        requiereMesHaber(r.expedienteEncontrado?.estado)
      ),
    [seleccionados]
  );

  const puedeConfirmar =
    seleccionados.length > 0 && (!necesitaMesHaber || !!haberMes);

  const reiniciar = useCallback(() => {
    setEtapa("cargar");
    setNombreArchivo("");
    setLeyendo(false);
    setProgresoLectura(null);
    setErrorLectura("");
    setDatosPdf(null);
    setResultados([]);
    setFiltroResultado("");
    setHaberMes("");
    setProcesando(false);
    setProgresoProceso(null);
    setResultadoFinal(null);
    setMensajes([]);
    if (inputRef.current) inputRef.current.value = "";
  }, []);

  const cerrar = useCallback(() => {
    // No se puede cerrar mientras escribe en Firestore (spec 12)
    if (procesando) return;
    reiniciar();
    onHide?.();
  }, [procesando, reiniciar, onHide]);

  /* ══════════════════════════════════════════
   * ETAPA 1 · Leer el PDF
   * ══════════════════════════════════════════ */

  const procesarArchivo = async (event) => {
    const archivo = event.target.files?.[0];
    if (!archivo) return;

    const esPdf =
      archivo.type === "application/pdf" ||
      archivo.name?.toLowerCase().endsWith(".pdf");

    if (!esPdf) {
      setErrorLectura("El archivo debe ser un PDF (.pdf).");
      if (inputRef.current) inputRef.current.value = "";
      return;
    }

    setLeyendo(true);
    setErrorLectura("");
    setNombreArchivo(archivo.name);
    setProgresoLectura({ pagina: 0, totalPaginas: 0 });

    try {
      const lectura = await leerAnexoPdf(archivo, setProgresoLectura);

      if (lectura.filas.length === 0) {
        setErrorLectura(
          "No se encontraron filas de anexo en el PDF. Verificá que el archivo tenga la tabla con las columnas EXPEDIENTE, APELLIDO Y NOMBRES y CUIL."
        );
        setLeyendo(false);
        return;
      }

      const agrupado = agruparFilasPdf(lectura.filas);
      setDatosPdf({ ...lectura, ...agrupado });

      // Verificación contra Firestore
      const { resultados: res } = await verificarRegistros({
        registros: agrupado.registros,
        invalidas: agrupado.invalidas,
      });

      setResultados(res);
      setEtapa("verificar");
    } catch (error) {
      console.error("[CargaMasiva] Error al leer el PDF:", error);
      setErrorLectura(
        `No se pudo leer el PDF: ${error?.message || "error desconocido"}.`
      );
    } finally {
      setLeyendo(false);
      setProgresoLectura(null);
    }
  };

  /* ══════════════════════════════════════════
   * ETAPA 2 · Verificación
   * ══════════════════════════════════════════ */

  const alternarProcesar = (key) => {
    setResultados((prev) =>
      prev.map((r) =>
        r.key === key && r.puedeProcesar ? { ...r, procesar: !r.procesar } : r
      )
    );
  };

  const marcarTodos = (valor) => {
    setResultados((prev) =>
      prev.map((r) => (r.puedeProcesar ? { ...r, procesar: valor } : r))
    );
  };

  const resultadosFiltrados = useMemo(() => {
    if (!filtroResultado) return resultados;
    if (filtroResultado === "CON_ADVERTENCIAS") {
      return resultados.filter((r) => (r.advertencias || []).length > 0);
    }
    return resultados.filter((r) => r.resultado === filtroResultado);
  }, [resultados, filtroResultado]);

  const descargarVerificacion = () => {
    const filas = resultados.map((r) => ({
      Página: r.pagina || "",
      "Orden PDF": r.orden || "",
      DNI: r.dni || "",
      CUIL: r.cuilPdf || "",
      "Apellido y nombre (PDF)": r.apellidoNombrePdf || "",
      "Apellido y nombre (sistema)": r.expedienteEncontrado?.apellidoNombre || "",
      "Expediente (PDF)": r.expedientePdf || "",
      "Expediente normalizado": r.expedientePdfNormalizado || "",
      "Expediente (sistema)": r.expedienteEncontrado?.expediente || "",
      "Dependencia actual": r.expedienteEncontrado?.dependencia || "",
      "Estado de sueldo": r.expedienteEncontrado?.estadoSueldo || "",
      "Estado del expediente": r.expedienteEncontrado?.estado || "",
      Coincidencia: RESULTADO_LABEL[r.resultado] || r.resultado,
      Advertencias: (r.advertencias || [])
        .map((a) => ADVERTENCIA_LABEL[a])
        .join(" · "),
      Observación: r.observacion || "",
      "Filas agrupadas": r.filasAgrupadas || 1,
      "ID Cargo": (r.idsCargo || []).join(" / "),
      "ID Plaza": (r.idsPlaza || []).join(" / "),
      "Se procesa": r.procesar && r.puedeProcesar ? "Sí" : "No",
    }));

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(
      wb,
      XLSX.utils.json_to_sheet(filas),
      "Verificación"
    );
    const fecha = new Date().toISOString().slice(0, 10);
    XLSX.writeFile(wb, `verificacion_expedientes_${fecha}.xlsx`);
  };

  /* ══════════════════════════════════════════
   * ETAPA 3 · Confirmar y finalizar
   * ══════════════════════════════════════════ */

  const confirmarFinalizacion = () => {
    const conTelefono = seleccionados.filter(
      (r) => !(r.advertencias || []).includes(ADVERTENCIA.SIN_TELEFONO)
    ).length;

    confirmDialog({
      header: "Confirmar finalización",
      icon: "pi pi-exclamation-triangle",
      acceptLabel: "Sí, continuar",
      rejectLabel: "Cancelar",
      acceptClassName: "p-button-warning",
      message: (
        <div className={styles.confirmBody}>
          <p>
            Se finalizarán <strong>{seleccionados.length}</strong> expediente(s).
          </p>
          <p>
            Se generarán <strong>{conTelefono}</strong> mensaje(s) de WhatsApp
            pendientes.
          </p>
          {seleccionados.length - conTelefono > 0 && (
            <p>
              {seleccionados.length - conTelefono} quedarán{" "}
              <strong>sin teléfono</strong> para copiar manualmente.
            </p>
          )}
          {haberMes && (
            <p>
              Haber de <strong>{obtenerMesLabel(haberMes)}</strong>, a cobrar en{" "}
              <strong>{obtenerMesLabel(obtenerMesCobroSiguiente(haberMes))}</strong>.
            </p>
          )}
          <p className={styles.confirmNota}>
            Los registros no coincidentes no serán modificados.
          </p>
        </div>
      ),
      accept: ejecutarFinalizacion,
    });
  };

  const ejecutarFinalizacion = async () => {
    setEtapa("procesando");
    setProcesando(true);
    setProgresoProceso({
      loteActual: 0,
      totalLotes: Math.ceil(seleccionados.length / EXPEDIENTES_POR_LOTE),
      procesados: 0,
      total: seleccionados.length,
      errores: 0,
    });

    try {
      const resultado = await finalizarExpedientesMasivo({
        seleccionados,
        haberMes,
        usuarioMovimiento,
        modoUsuario,
        nombreArchivo,
        totalPaginasPdf: datosPdf?.totalPaginas || 0,
        totalFilasPdf: datosPdf?.totalFilas || 0,
        totalRegistrosUnicos: datosPdf?.totalRegistrosUnicos || 0,
        onProgreso: setProgresoProceso,
      });

      setResultadoFinal(resultado);
      setMensajes(
        resultado.finalizados.map((f) => ({
          ...f,
          batchId: resultado.batchId,
        }))
      );
      setEtapa("resumen");

      // Refresca la tabla principal de Gestión Delegados (spec 17)
      await onFinalizado?.();

      toast?.current?.show({
        severity: resultado.errores.length > 0 ? "warn" : "success",
        summary: "Carga masiva finalizada",
        detail: `Se finalizaron ${resultado.finalizados.length} expediente(s).`,
        life: 6000,
      });
    } catch (error) {
      console.error("[CargaMasiva] Error en la finalización masiva:", error);
      toast?.current?.show({
        severity: "error",
        summary: "Error en la carga masiva",
        detail: error?.message || "No se pudo completar el proceso.",
      });
      setEtapa("verificar");
    } finally {
      setProcesando(false);
    }
  };

  /* ══════════════════════════════════════════
   * ETAPA 4 · Mensajes de WhatsApp
   * ══════════════════════════════════════════ */

  const cambiarEstadoMensaje = (itemId, estadoMensaje) => {
    setMensajes((prev) =>
      prev.map((m) => (m.itemId === itemId ? { ...m, estadoMensaje } : m))
    );
    const item = mensajes.find((m) => m.itemId === itemId);
    actualizarEstadoMensaje({
      batchId: item?.batchId || resultadoFinal?.batchId,
      itemId,
      estadoMensaje,
    });
  };

  const editarMensaje = (itemId, texto) => {
    setMensajes((prev) =>
      prev.map((m) => (m.itemId === itemId ? { ...m, mensajeWhatsapp: texto } : m))
    );
  };

  const abrirWhatsappDe = (item) => {
    const url = construirUrlWhatsapp({
      telefono: item.telefono,
      mensaje: item.mensajeWhatsapp,
    });
    if (!url) {
      toast?.current?.show({
        severity: "warn",
        summary: "Sin teléfono",
        detail: "Copiá el mensaje y enviálo manualmente.",
      });
      return;
    }
    // Una sola ventana por vez: abrir todas de golpe hace que el navegador
    // bloquee los popups (spec 15).
    window.open(url, "_blank", "noopener,noreferrer");
    cambiarEstadoMensaje(item.itemId, ESTADO_MENSAJE.ABIERTO);
  };

  const copiarMensaje = async (item) => {
    try {
      await navigator.clipboard.writeText(item.mensajeWhatsapp || "");
      toast?.current?.show({
        severity: "success",
        summary: "Mensaje copiado",
        detail: item.apellidoNombre || item.dni,
        life: 2500,
      });
    } catch {
      toast?.current?.show({
        severity: "warn",
        summary: "No se pudo copiar",
        detail: "Seleccioná el texto del mensaje y copiálo manualmente.",
      });
    }
  };

  const abrirSiguientePendiente = () => {
    const pendiente = mensajes.find(
      (m) => m.estadoMensaje === ESTADO_MENSAJE.PENDIENTE
    );
    if (!pendiente) {
      toast?.current?.show({
        severity: "info",
        summary: "Sin pendientes",
        detail: "No quedan mensajes pendientes de abrir.",
      });
      return;
    }
    abrirWhatsappDe(pendiente);
  };

  const descargarMensajes = () => {
    const filas = mensajes.map((m) => ({
      DNI: m.dni || "",
      "Apellido y nombre": m.apellidoNombre || "",
      Expediente: m.expediente || "",
      Teléfono: m.telefono || "",
      "Teléfono normalizado": m.telefonoNormalizado || "",
      Estado: ETIQUETA_ESTADO_MENSAJE[m.estadoMensaje] || m.estadoMensaje,
      Mensaje: m.mensajeWhatsapp || "",
    }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(filas), "Mensajes");
    const fecha = new Date().toISOString().slice(0, 10);
    XLSX.writeFile(wb, `mensajes_whatsapp_${fecha}.xlsx`);
  };

  /* ══════════════════════════════════════════
   * Templates de la tabla de verificación
   * ══════════════════════════════════════════ */

  const bodyProcesar = (row) => (
    <Checkbox
      checked={!!row.procesar}
      disabled={!row.puedeProcesar}
      onChange={() => alternarProcesar(row.key)}
    />
  );

  const bodyCoincidencia = (row) => {
    const severidad = RESULTADO_SEVERIDAD[row.resultado];
    const clase =
      severidad === "ok"
        ? styles.pillOk
        : severidad === "info"
        ? styles.pillInfo
        : styles.pillError;
    // Si está listo pero tiene advertencias, se muestra en amarillo (spec 9)
    const claseFinal =
      row.resultado === RESULTADO.LISTO && (row.advertencias || []).length > 0
        ? styles.pillWarn
        : clase;
    return (
      <span className={`${styles.pill} ${claseFinal}`}>
        {RESULTADO_LABEL[row.resultado] || row.resultado}
      </span>
    );
  };

  const bodyObservacion = (row) => (
    <span className={styles.obsText}>
      {row.observacion || "—"}
      {(row.filasAgrupadas || 1) > 1 && (
        <em className={styles.obsExtra}>
          {" "}
          ({row.filasAgrupadas} filas · cargos {(row.idsCargo || []).join(", ")})
        </em>
      )}
    </span>
  );

  /* ══════════════════════════════════════════
   * Render
   * ══════════════════════════════════════════ */

  const footerVerificar = (
    <div className={styles.footerRow}>
      <div className={styles.footerLeft}>
        <Button
          label="Descargar resultado"
          icon="pi pi-download"
          className="p-button-text p-button-sm"
          onClick={descargarVerificacion}
        />
        <Button
          label="Otro PDF"
          icon="pi pi-refresh"
          className="p-button-text p-button-sm"
          onClick={reiniciar}
        />
      </div>
      <div className={styles.footerRight}>
        <Button
          label="Cerrar"
          className="p-button-text"
          onClick={cerrar}
        />
        <Button
          label={`Confirmar finalización (${seleccionados.length})`}
          icon="pi pi-check"
          onClick={confirmarFinalizacion}
          disabled={!puedeConfirmar}
        />
      </div>
    </div>
  );

  return (
    <>
      <Dialog
        header="Carga masiva de expedientes finalizados"
        visible={visible}
        style={{ width: "min(1400px, 96vw)" }}
        contentStyle={{ minHeight: "40vh" }}
        modal
        closable={!procesando}
        closeOnEscape={!procesando}
        onHide={cerrar}
        footer={etapa === "verificar" ? footerVerificar : null}
      >
        {/* ── Pasos ── */}
        <div className={styles.pasos}>
          {[
            { id: "cargar", label: "1 · Cargar PDF" },
            { id: "verificar", label: "2 · Verificar" },
            { id: "procesando", label: "3 · Finalizar" },
            { id: "resumen", label: "4 · Mensajes" },
          ].map((p) => (
            <span
              key={p.id}
              className={`${styles.paso} ${
                etapa === p.id ? styles.pasoActivo : ""
              }`}
            >
              {p.label}
            </span>
          ))}
        </div>

        {/* ══ ETAPA 1 ══ */}
        {etapa === "cargar" && (
          <div className={styles.etapaCargar}>
            <p className={styles.ayuda}>
              Seleccioná el PDF oficial del anexo (resolución de reconocimiento
              de servicios). Se leerán todas las páginas y se detectarán las
              filas con <strong>EXPEDIENTE</strong>,{" "}
              <strong>APELLIDO Y NOMBRES</strong> y <strong>CUIL</strong>. Los
              considerandos, artículos y firmas se ignoran automáticamente.
            </p>

            <input
              ref={inputRef}
              type="file"
              accept="application/pdf,.pdf"
              onChange={procesarArchivo}
              disabled={leyendo}
              className={styles.inputFile}
            />

            {leyendo && (
              <div className={styles.progresoBox}>
                <ProgressBar
                  mode={
                    progresoLectura?.totalPaginas ? "determinate" : "indeterminate"
                  }
                  value={
                    progresoLectura?.totalPaginas
                      ? Math.round(
                          (progresoLectura.pagina /
                            progresoLectura.totalPaginas) *
                            100
                        )
                      : 0
                  }
                />
                <small>
                  {progresoLectura?.totalPaginas
                    ? `Leyendo página ${progresoLectura.pagina} de ${progresoLectura.totalPaginas}...`
                    : "Analizando el PDF..."}
                </small>
              </div>
            )}

            {errorLectura && <p className={styles.error}>{errorLectura}</p>}
          </div>
        )}

        {/* ══ ETAPA 2 ══ */}
        {etapa === "verificar" && (
          <div className={styles.etapaVerificar}>
            <h4 className={styles.subtitulo}>Verificación de coincidencias</h4>

            {/* Indicadores */}
            <div className={styles.indicadores}>
              <Indicador label="Páginas" valor={datosPdf?.totalPaginas} />
              <Indicador label="Filas del PDF" valor={datosPdf?.totalFilas} />
              <Indicador
                label="Registros únicos"
                valor={datosPdf?.totalRegistrosUnicos}
              />
              <Indicador
                label="Duplicados agrupados"
                valor={datosPdf?.totalDuplicadosAgrupados}
              />
              <Indicador label="Listos" valor={resumen.listos} tono="ok" />
              <Indicador
                label="Ya finalizados"
                valor={resumen.yaFinalizados}
                tono="info"
              />
              <Indicador
                label="Docente no encontrado"
                valor={resumen.docentesNoEncontrados}
                tono="error"
              />
              <Indicador
                label="Exp. no encontrado"
                valor={resumen.expedientesNoEncontrados}
                tono="error"
              />
              <Indicador
                label="Dependencia ≠ Liquidación"
                valor={resumen.dependenciaNoValida}
                tono="warn"
              />
              <Indicador
                label="Estado inactivo"
                valor={resumen.estadoInactivo}
                tono="warn"
              />
              <Indicador
                label="Con advertencias"
                valor={resumen.conAdvertencias}
                tono="warn"
              />
              <Indicador
                label="Sin teléfono"
                valor={resumen.sinTelefono}
                tono="warn"
              />
            </div>

            {datosPdf?.paginasConError?.length > 0 && (
              <p className={styles.avisoPaginas}>
                No se pudieron leer {datosPdf.paginasConError.length} página(s):{" "}
                {datosPdf.paginasConError.map((p) => p.pagina).join(", ")}. El
                resto se procesó normalmente.
              </p>
            )}

            {/* Mes de haber */}
            <div className={styles.mesBox}>
              <label>
                <span>
                  Mes de haber {necesitaMesHaber ? "(obligatorio)" : "(opcional)"}
                </span>
                <Dropdown
                  value={haberMes}
                  options={MESES_HABER}
                  onChange={(e) => setHaberMes(e.value)}
                  placeholder="Seleccionar mes de haber"
                  className={styles.mesDropdown}
                />
              </label>
              {haberMes && (
                <span className={styles.mesInfo}>
                  Se informará: haber de <strong>{obtenerMesLabel(haberMes)}</strong>
                  , a cobrar en{" "}
                  <strong>
                    {obtenerMesLabel(obtenerMesCobroSiguiente(haberMes))}
                  </strong>
                  .
                </span>
              )}
              {necesitaMesHaber && !haberMes && (
                <span className={styles.error}>
                  Elegí el mes de haber para poder confirmar.
                </span>
              )}
            </div>

            {/* Filtros y selección */}
            <div className={styles.filtrosRow}>
              <Dropdown
                value={filtroResultado}
                options={[
                  { label: "Todos los resultados", value: "" },
                  ...Object.keys(RESULTADO_LABEL).map((k) => ({
                    label: RESULTADO_LABEL[k],
                    value: k,
                  })),
                  { label: "Con advertencias", value: "CON_ADVERTENCIAS" },
                ]}
                onChange={(e) => setFiltroResultado(e.value)}
                placeholder="Filtrar por estado"
              />
              <Button
                label="Marcar todos los válidos"
                icon="pi pi-check-square"
                className="p-button-text p-button-sm"
                onClick={() => marcarTodos(true)}
              />
              <Button
                label="Desmarcar todos"
                icon="pi pi-stop"
                className="p-button-text p-button-sm"
                onClick={() => marcarTodos(false)}
              />
              <span className={styles.contadorSel}>
                {seleccionados.length} seleccionado(s) de {resumen.listos} válido(s)
              </span>
            </div>

            <DataTable
              value={resultadosFiltrados}
              paginator
              rows={10}
              rowsPerPageOptions={[10, 25, 50, 100]}
              responsiveLayout="scroll"
              emptyMessage="No hay registros para mostrar."
              className={styles.tabla}
              rowClassName={(row) =>
                row.resultado === RESULTADO.LISTO &&
                (row.advertencias || []).length === 0
                  ? styles.filaOk
                  : row.resultado === RESULTADO.LISTO
                  ? styles.filaWarn
                  : row.resultado === RESULTADO.YA_FINALIZADO
                  ? styles.filaInfo
                  : styles.filaError
              }
            >
              <Column header="Proc." body={bodyProcesar} style={{ width: 60 }} />
              <Column field="pagina" header="Pág." style={{ width: 60 }} />
              <Column field="dni" header="DNI" style={{ width: 100 }} />
              <Column field="cuilPdf" header="CUIL" style={{ width: 120 }} />
              <Column
                field="apellidoNombrePdf"
                header="Nombre (PDF)"
                style={{ minWidth: 170 }}
              />
              <Column
                header="Nombre (sistema)"
                body={(r) => r.expedienteEncontrado?.apellidoNombre || "—"}
                style={{ minWidth: 170 }}
              />
              <Column
                header="Exp. (PDF)"
                body={(r) => r.expedientePdfNormalizado || r.expedientePdf || "—"}
                style={{ width: 120 }}
              />
              <Column
                header="Exp. (sistema)"
                body={(r) => r.expedienteEncontrado?.expediente || "—"}
                style={{ width: 120 }}
              />
              <Column
                header="Dependencia"
                body={(r) => r.expedienteEncontrado?.dependencia || "—"}
                style={{ minWidth: 150 }}
              />
              <Column
                header="Sueldo"
                body={(r) => r.expedienteEncontrado?.estadoSueldo || "—"}
                style={{ width: 90 }}
              />
              <Column
                header="Estado"
                body={(r) => r.expedienteEncontrado?.estado || "—"}
                style={{ width: 130 }}
              />
              <Column
                header="Coincidencia"
                body={bodyCoincidencia}
                style={{ width: 160 }}
              />
              <Column
                header="Observación"
                body={bodyObservacion}
                style={{ minWidth: 240 }}
              />
            </DataTable>
          </div>
        )}

        {/* ══ ETAPA 3 ══ */}
        {etapa === "procesando" && (
          <div className={styles.etapaProcesando}>
            <h4 className={styles.subtitulo}>Finalizando expedientes...</h4>
            <ProgressBar
              value={
                progresoProceso?.total
                  ? Math.round(
                      (progresoProceso.procesados / progresoProceso.total) * 100
                    )
                  : 0
              }
            />
            <div className={styles.progresoDetalle}>
              <span>
                Procesados: <strong>{progresoProceso?.procesados || 0}</strong> de{" "}
                {progresoProceso?.total || 0}
              </span>
              <span>
                Lote <strong>{progresoProceso?.loteActual || 0}</strong> de{" "}
                {progresoProceso?.totalLotes || 0}
              </span>
              <span>
                Errores: <strong>{progresoProceso?.errores || 0}</strong>
              </span>
            </div>
            <p className={styles.ayuda}>
              No cierres esta ventana hasta que termine el proceso.
            </p>
          </div>
        )}

        {/* ══ ETAPA 4 ══ */}
        {etapa === "resumen" && resultadoFinal && (
          <div className={styles.etapaResumen}>
            <h4 className={styles.subtitulo}>Resumen de la carga</h4>

            <div className={styles.indicadores}>
              <Indicador
                label="Finalizados"
                valor={resultadoFinal.finalizados.length}
                tono="ok"
              />
              <Indicador
                label="Ya estaban finalizados"
                valor={resumen.yaFinalizados}
                tono="info"
              />
              <Indicador
                label="No encontrados"
                valor={
                  resumen.docentesNoEncontrados + resumen.expedientesNoEncontrados
                }
                tono="error"
              />
              <Indicador
                label="Omitidos"
                valor={resultadoFinal.omitidos.length}
                tono="warn"
              />
              <Indicador
                label="Errores"
                valor={resultadoFinal.errores.length}
                tono="error"
              />
              <Indicador
                label="Mensajes pendientes"
                valor={
                  mensajes.filter(
                    (m) => m.estadoMensaje === ESTADO_MENSAJE.PENDIENTE
                  ).length
                }
                tono="warn"
              />
              <Indicador
                label="Sin teléfono"
                valor={
                  mensajes.filter(
                    (m) => m.estadoMensaje === ESTADO_MENSAJE.SIN_TELEFONO
                  ).length
                }
                tono="warn"
              />
            </div>

            {resultadoFinal.errores.length > 0 && (
              <div className={styles.listaErrores}>
                <strong>Expedientes con error:</strong>
                <ul>
                  {resultadoFinal.errores.slice(0, 20).map((e, i) => (
                    <li key={i}>
                      {e.dni} · {e.expedientePdfNormalizado || e.expedientePdf} —{" "}
                      {e.motivo}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div className={styles.resumenAcciones}>
              <Button
                label="Ver mensajes de WhatsApp"
                icon="pi pi-whatsapp"
                onClick={() => setVisibleWhatsapp(true)}
                disabled={mensajes.length === 0}
              />
              <Button
                label="Descargar resultado"
                icon="pi pi-download"
                className="p-button-outlined"
                onClick={descargarVerificacion}
              />
              <Button
                label="Nueva carga"
                icon="pi pi-refresh"
                className="p-button-outlined"
                onClick={reiniciar}
              />
              <Button
                label="Cerrar"
                className="p-button-text"
                onClick={cerrar}
              />
            </div>
          </div>
        )}
      </Dialog>

      {/* ══ Dialog de mensajes de WhatsApp ══ */}
      <Dialog
        header="Mensajes de WhatsApp"
        visible={visibleWhatsapp}
        style={{ width: "min(1100px, 96vw)" }}
        modal
        onHide={() => setVisibleWhatsapp(false)}
        footer={
          <div className={styles.footerRow}>
            <div className={styles.footerLeft}>
              <Button
                label="Abrir siguiente pendiente"
                icon="pi pi-external-link"
                className="p-button-sm"
                onClick={abrirSiguientePendiente}
              />
              <Button
                label="Descargar listado"
                icon="pi pi-download"
                className="p-button-text p-button-sm"
                onClick={descargarMensajes}
              />
            </div>
            <Button
              label="Cerrar"
              className="p-button-text"
              onClick={() => setVisibleWhatsapp(false)}
            />
          </div>
        }
      >
        <p className={styles.ayuda}>
          Los mensajes no se envían solos. Abrí cada uno, revisá el texto y
          marcálo como enviado cuando lo hayas mandado.
        </p>

        <div className={styles.listaMensajes}>
          {mensajes.map((m) => (
            <div key={m.itemId} className={styles.mensajeCard}>
              <div className={styles.mensajeHeader}>
                <div>
                  <strong>{m.apellidoNombre || "Sin nombre"}</strong>
                  <span className={styles.mensajeMeta}>
                    DNI {m.dni} · Exp. {m.expediente || "—"} ·{" "}
                    {m.telefono || "sin teléfono"}
                  </span>
                </div>
                <Tag
                  value={
                    ETIQUETA_ESTADO_MENSAJE[m.estadoMensaje] || m.estadoMensaje
                  }
                  severity={SEVERIDAD_ESTADO_MENSAJE[m.estadoMensaje]}
                />
              </div>

              <InputTextarea
                value={m.mensajeWhatsapp || ""}
                onChange={(e) => editarMensaje(m.itemId, e.target.value)}
                rows={4}
                autoResize
                className={styles.mensajeTexto}
              />

              <div className={styles.mensajeAcciones}>
                <Button
                  label="Copiar"
                  icon="pi pi-copy"
                  className="p-button-text p-button-sm"
                  onClick={() => copiarMensaje(m)}
                />
                <Button
                  label="Abrir WhatsApp"
                  icon="pi pi-whatsapp"
                  className="p-button-sm"
                  onClick={() => abrirWhatsappDe(m)}
                  disabled={!m.telefonoNormalizado}
                />
                <Button
                  label="Marcar como enviado"
                  icon="pi pi-check"
                  className="p-button-success p-button-sm"
                  onClick={() =>
                    cambiarEstadoMensaje(m.itemId, ESTADO_MENSAJE.ENVIADO)
                  }
                  disabled={m.estadoMensaje === ESTADO_MENSAJE.ENVIADO}
                />
                <Button
                  label="Omitir"
                  icon="pi pi-times"
                  className="p-button-text p-button-sm p-button-danger"
                  onClick={() =>
                    cambiarEstadoMensaje(m.itemId, ESTADO_MENSAJE.OMITIDO)
                  }
                  disabled={m.estadoMensaje === ESTADO_MENSAJE.OMITIDO}
                />
              </div>
            </div>
          ))}
        </div>
      </Dialog>
    </>
  );
};

const Indicador = ({ label, valor, tono }) => (
  <div
    className={`${styles.indicador} ${
      tono ? styles[`indicador_${tono}`] : ""
    }`}
  >
    <span className={styles.indicadorValor}>{valor ?? 0}</span>
    <span className={styles.indicadorLabel}>{label}</span>
  </div>
);

export default CargaMasivaExpedientes;
