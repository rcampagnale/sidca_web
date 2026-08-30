import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import * as XLSX from "xlsx";
import CenaResumen from "../../../components/GestionCena/CenaResumen";
import CenaReservas from "../../../components/GestionCena/CenaReservas";
import CenaReservaDialog from "../../../components/GestionCena/CenaReservaDialog";
import CenaCargaMasiva from "../../../components/GestionCena/CenaCargaMasiva";
import CenaTarjetas from "../../../components/GestionCena/CenaTarjetas";
import CenaValidacion from "../../../components/GestionCena/CenaValidacion";
import CenaDatosEventoDialog from "../../../components/GestionCena/CenaDatosEventoDialog";
import { auth } from "../../../firebase/firebase-config";
import {
  anularReservaCena,
  anularTarjetaCena,
  asegurarEdicionCena,
  cargarGestionCena,
  esTarjetaVigenteCena,
  guardarReservaCena,
  guardarDatosEventoCena,
  formatearDniCena,
  importarReservasCena,
  normalizarDniCena,
  obtenerResumenVaciadoGestionCena,
  reemitirTarjetaCena,
  sincronizarTarjetasReserva,
  suscribirGestionCena,
  vaciarGestionCenaAnio,
} from "../../../services/gestionCenaService";
import { descargarPdfTarjetasCena, generarPdfMasivoPorLotesCena, MAX_TARJETAS_POR_PDF } from "../../../services/gestionCenaPdfService";
import styles from "./GestionCenaAdmin.module.css";

const tabs = [
  ["resumen", "RESUMEN"],
  ["reservas", "RESERVAS"],
  ["tarjetas", "TARJETAS / QR"],
  ["validacion", "VALIDACIÓN"],
];

const anioActual = new Date().getFullYear();

const normalizarNombreArchivo = (valor) => String(valor || "sin_dato")
  .normalize("NFD")
  .replace(/[\u0300-\u036f]/g, "")
  .replace(/[^a-zA-Z0-9]+/g, "_")
  .replace(/^_+|_+$/g, "") || "sin_dato";

const ordenarTarjetasPorPosicion = (lista) => [...lista].sort((primera, segunda) => {
  const posicion = Number(primera.numeroTarjeta || 0) - Number(segunda.numeroTarjeta || 0);
  if (posicion) return posicion;
  return Number(segunda.numeroReemision || 0) - Number(primera.numeroReemision || 0);
});

const compararReservasPorAfiliado = (primera, segunda) => {
  const datosPrimera = primera.afiliado || {};
  const datosSegunda = segunda.afiliado || {};
  const porApellido = String(datosPrimera.apellido || "").localeCompare(String(datosSegunda.apellido || ""), "es", { sensitivity: "base" });
  if (porApellido) return porApellido;
  const porNombre = String(datosPrimera.nombre || "").localeCompare(String(datosSegunda.nombre || ""), "es", { sensitivity: "base" });
  if (porNombre) return porNombre;
  return String(datosPrimera.dni || "").localeCompare(String(datosSegunda.dni || ""), "es", { numeric: true });
};

const ordenarTarjetasMasivas = (reservas, tarjetas) => {
  const activasPorReserva = new Map();
  tarjetas.filter(esTarjetaVigenteCena).forEach((tarjeta) => {
    const grupo = activasPorReserva.get(tarjeta.reservaId) || [];
    grupo.push(tarjeta);
    activasPorReserva.set(tarjeta.reservaId, grupo);
  });

  return reservas
    .filter((reserva) => reserva.estado !== "anulada")
    .sort(compararReservasPorAfiliado)
    .flatMap((reserva) => ordenarTarjetasPorPosicion(activasPorReserva.get(reserva.id) || []));
};

const esTitularElegibleSorteo = (tarjeta) => (
  tarjeta?.tipo === "titular" &&
  esTarjetaVigenteCena(tarjeta) &&
  (tarjeta.validada === true || tarjeta.estado === "validada")
);

export const obtenerAfiliadosElegiblesSorteoCena = (reservas = [], tarjetas = []) => {
  const titularesValidosPorReserva = new Map();
  tarjetas.filter(esTitularElegibleSorteo).forEach((tarjeta) => {
    if (!titularesValidosPorReserva.has(tarjeta.reservaId)) titularesValidosPorReserva.set(tarjeta.reservaId, tarjeta);
  });

  const dniIncluidos = new Set();
  return reservas
    .filter((reserva) => reserva?.estado !== "anulada" && reserva?.anulada !== true)
    .filter((reserva) => titularesValidosPorReserva.has(reserva.id))
    .map((reserva) => {
      const afiliado = reserva.afiliado || {};
      return {
        APELLIDO: String(afiliado.apellido || "").trim(),
        NOMBRE: String(afiliado.nombre || "").trim(),
        DNI: normalizarDniCena(afiliado.dni),
      };
    })
    .filter((afiliado) => {
      if (!afiliado.DNI || dniIncluidos.has(afiliado.DNI)) return false;
      dniIncluidos.add(afiliado.DNI);
      return true;
    })
    .sort((primero, segundo) => {
      const porApellido = primero.APELLIDO.localeCompare(segundo.APELLIDO, "es", { sensitivity: "base" });
      if (porApellido) return porApellido;
      const porNombre = primero.NOMBRE.localeCompare(segundo.NOMBRE, "es", { sensitivity: "base" });
      if (porNombre) return porNombre;
      return primero.DNI.localeCompare(segundo.DNI, "es", { numeric: true });
    });
};

const esperarFrame = () => new Promise((resolve) => {
  if (typeof window !== "undefined" && window.requestAnimationFrame) {
    window.requestAnimationFrame(resolve);
    return;
  }
  resolve();
});

const mensajeProgresoPdf = ({ procesadas, total, etapa }) => {
  if (etapa === "preparando") return `Preparando ${total} tarjetas...`;
  if (etapa === "documento") return "Armando documento PDF...";
  if (etapa === "descarga") return "Preparando descarga...";
  if (etapa === "completa") return "PDF generado correctamente.";
  return `Procesando tarjeta ${procesadas} de ${total}`;
};

const GestionCenaAdmin = ({ match }) => {
  const tokenInicial = match?.params?.token || "";
  const [anio, setAnio] = useState(Math.max(2026, anioActual));
  const [tab, setTab] = useState(tokenInicial ? "validacion" : "resumen");
  const [reservas, setReservas] = useState([]);
  const [tarjetas, setTarjetas] = useState([]);
  const [edicion, setEdicion] = useState(null);
  const [cargando, setCargando] = useState(false);
  const [mensaje, setMensaje] = useState("");
  const [error, setError] = useState("");
  const [dialogReserva, setDialogReserva] = useState(null);
  const [importar, setImportar] = useState(false);
  const [vaciado, setVaciado] = useState(null);
  const [confirmacionVaciado, setConfirmacionVaciado] = useState("");
  const [vaciando, setVaciando] = useState(false);
  const [editarDatosEvento, setEditarDatosEvento] = useState(false);
  const [reservaSeleccionada, setReservaSeleccionada] = useState(null);
  const [progresoPdf, setProgresoPdf] = useState({
    activo: false,
    tipo: null,
    titulo: "",
    afiliado: null,
    procesadas: 0,
    total: 0,
    porcentaje: 0,
    mensaje: "",
  });
  const generandoPdfRef = useRef(false);

  const usuario = useMemo(
    () => ({
      uid: auth.currentUser?.uid || "",
      email: auth.currentUser?.email || "",
    }),
    []
  );

  const titularesElegiblesSorteo = useMemo(
    () => obtenerAfiliadosElegiblesSorteoCena(reservas, tarjetas),
    [reservas, tarjetas]
  );

  const recargar = useCallback(async () => {
    setCargando(true);
    setError("");
    try {
      const data = await cargarGestionCena(anio);
      setEdicion(data.edicion || null);
      setReservas(data.reservas);
      setTarjetas(data.tarjetas);
    } catch (err) {
      setError("No se pudo cargar Gestión Cena.");
    } finally {
      setCargando(false);
    }
  }, [anio]);

  useEffect(() => {
    let activo = true;
    let desuscribir = () => {};

    setCargando(true);
    setError("");
    asegurarEdicionCena(anio)
      .then(() => {
        if (!activo) return;
        desuscribir = suscribirGestionCena(
          anio,
          (data) => {
            if (!activo) return;
            setEdicion(data.edicion || null);
            setReservas(data.reservas);
            setTarjetas(data.tarjetas);
            setCargando(false);
          },
          () => {
            if (!activo) return;
            setError("No se pudo actualizar Gestión Cena.");
            setCargando(false);
          }
        );
      })
      .catch(() => {
        if (!activo) return;
        setError("No se pudo cargar Gestión Cena.");
        setCargando(false);
      });

    return () => {
      activo = false;
      desuscribir();
    };
  }, [anio]);

  const urlParaTarjeta = (tarjeta) => `${window.location.origin}/validar-cena/${tarjeta.token}`;

  const tarjetasConUrl = (lista) => lista.map((tarjeta) => ({ ...tarjeta, urlValidacion: urlParaTarjeta(tarjeta) }));

  const guardarReserva = async ({ reservaId, afiliado, cantidadTarjetas }) => {
    setMensaje("");
    setError("");
    try {
      const reserva = await guardarReservaCena({ anio, afiliado, cantidadTarjetas, reservaId });
      await sincronizarTarjetasReserva({ anio, reservaId: reserva.id });
      setDialogReserva(null);
      setMensaje("Reserva guardada y tarjetas sincronizadas.");
      await recargar();
    } catch (err) {
      setError(err.message || "No se pudo guardar la reserva.");
    }
  };

  const anular = async (reserva) => {
    const lista = tarjetas.filter((t) => t.reservaId === reserva.id);
    const acreditadas = lista.filter((t) => t.validada === true || t.estado === "validada").length;
    const extra = acreditadas ? ` Tiene ${acreditadas} tarjeta(s) ya acreditada(s); no se borrará el historial.` : "";
    if (!window.confirm(`¿Anular la reserva de ${reserva.afiliado?.apellido} ${reserva.afiliado?.nombre}?${extra}`)) return;
    await anularReservaCena({ anio, reservaId: reserva.id, usuario });
    setMensaje("Reserva anulada. Los QR pendientes dejaron de ser válidos.");
    await recargar();
  };

  const anularTarjeta = async (tarjeta, motivo, observacion) => {
    setMensaje("");
    setError("");
    await anularTarjetaCena({
      anio,
      tarjetaId: tarjeta.id,
      motivo,
      observacion,
      usuario,
    });
    setMensaje(`Tarjeta ${tarjeta.codigoVisible} anulada. Su QR ya no es válido.`);
    await recargar();
  };

  const generarPdfConProgreso = async ({ lista, tipo, titulo, afiliado = null, nombreArchivo = null }) => {
    if (generandoPdfRef.current) return;
    const tarjetasActivas = lista.filter(esTarjetaVigenteCena);
    const nombreTipo = tipo === "afiliado" ? "PDF del afiliado" : tipo === "seleccion" ? "PDF de selección" : "PDF masivo";
    const mensajeError = tipo === "afiliado"
      ? "No se pudo generar el PDF del afiliado."
      : tipo === "seleccion"
        ? "No se pudo generar el PDF de selección."
        : "No se pudo generar el PDF masivo.";
    if (!tarjetasActivas.length) {
      setError("No hay tarjetas activas para generar.");
      return;
    }

    generandoPdfRef.current = true;
    setMensaje("");
    setError("");
    setProgresoPdf({
      activo: true,
      tipo,
      titulo,
      afiliado,
      procesadas: 0,
      total: tarjetasActivas.length,
      porcentaje: 0,
      mensaje: `Preparando ${tarjetasActivas.length} tarjetas...`,
    });
    let avanceActual = { procesadas: 0, total: tarjetasActivas.length };

    try {
      await esperarFrame();
      await descargarPdfTarjetasCena({
        tarjetas: tarjetasConUrl(tarjetasActivas),
        anio,
        edicion,
        nombreArchivo,
        onProgress: ({ procesadas, total, porcentaje, etapa }) => {
          avanceActual = { procesadas, total };
          setProgresoPdf({
            activo: true,
            tipo,
            titulo,
            afiliado,
            procesadas,
            total,
            porcentaje,
            mensaje: mensajeProgresoPdf({ procesadas, total, etapa }),
          });
        },
      });
      setMensaje("PDF generado correctamente.");
    } catch (err) {
      console.error(`No se pudo generar ${nombreTipo} de Gestión Cena.`, err);
      setError(`${mensajeError} Procesadas: ${avanceActual.procesadas} de ${avanceActual.total}.`);
    } finally {
      generandoPdfRef.current = false;
      setProgresoPdf((anterior) => ({ ...anterior, activo: false }));
    }
  };

  const pdfReserva = (reserva) => {
    const tarjetasActivas = ordenarTarjetasPorPosicion(
      tarjetas.filter((tarjeta) => tarjeta.reservaId === reserva.id && esTarjetaVigenteCena(tarjeta))
    );
    const apellido = normalizarNombreArchivo(reserva.afiliado?.apellido);
    const nombre = normalizarNombreArchivo(reserva.afiliado?.nombre);
    const dni = normalizarNombreArchivo(reserva.afiliado?.dni);
    return generarPdfConProgreso({
      lista: tarjetasActivas,
      tipo: "afiliado",
      titulo: "Generando PDF del afiliado",
      afiliado: reserva.afiliado || null,
      nombreArchivo: `Cena_${anio}_${apellido}_${nombre}_${dni}.pdf`,
    });
  };

  const pdfTarjetas = (lista) => descargarPdfTarjetasCena({ tarjetas: tarjetasConUrl(lista), anio, edicion });

  const pdfSeleccion = (lista) => (
    lista.length > 1
      ? generarPdfConProgreso({ lista, tipo: "seleccion", titulo: "Generando PDF de selección" })
      : pdfTarjetas(lista)
  );

  const pdfTarjetasMasivo = async () => {
    if (generandoPdfRef.current) return;
    const tarjetasActivas = ordenarTarjetasMasivas(reservas, tarjetas);
    if (!tarjetasActivas.length) {
      setError("No hay tarjetas activas para generar.");
      return;
    }

    const total = tarjetasActivas.length;
    const totalArchivos = Math.ceil(total / MAX_TARJETAS_POR_PDF);
    generandoPdfRef.current = true;
    setMensaje("");
    setError("");
    setProgresoPdf({
      activo: true,
      tipo: "masivo",
      titulo: `Generando PDF masivo ${anio}`,
      afiliado: null,
      procesadas: 0,
      total,
      porcentaje: 0,
      mensaje: `Archivo 1 de ${totalArchivos}. Preparando ${total} tarjetas...`,
    });

    try {
      await esperarFrame();
      const resultado = await generarPdfMasivoPorLotesCena({
        tarjetas: tarjetasConUrl(tarjetasActivas),
        anio,
        edicion,
        onProgress: ({ procesadas, total: totalGlobal, porcentaje, etapa, archivoActual, totalArchivos: archivos }) => {
          const detalle = mensajeProgresoPdf({ procesadas, total: totalGlobal, etapa });
          setProgresoPdf({
            activo: true,
            tipo: "masivo",
            titulo: `Generando PDF masivo ${anio}`,
            afiliado: null,
            procesadas,
            total: totalGlobal,
            porcentaje,
            mensaje: `Archivo ${archivoActual} de ${archivos}. ${detalle}`,
          });
        },
      });
      setMensaje(`Generación finalizada correctamente. ${resultado.total} tarjetas generadas en ${resultado.archivos} archivo(s) PDF.`);
    } catch (err) {
      console.error("No se pudo generar el PDF masivo de Gestión Cena.", err);
      setError("No se pudo generar el PDF masivo. Podés volver a intentarlo.");
    } finally {
      generandoPdfRef.current = false;
      setProgresoPdf((anterior) => ({ ...anterior, activo: false }));
    }
  };

  const exportarExcelSorteo = () => {
    if (!titularesElegiblesSorteo.length) {
      setMensaje("");
      setError("No hay afiliados titulares acreditados para el sorteo.");
      return;
    }

    const hoja = XLSX.utils.json_to_sheet(titularesElegiblesSorteo, { header: ["APELLIDO", "NOMBRE", "DNI"] });
    hoja["!cols"] = [{ wch: 24 }, { wch: 28 }, { wch: 14 }];
    const libro = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(libro, hoja, "Sorteo");
    XLSX.writeFile(libro, `Sorteo_Cena_Docente_${anio}.xlsx`);
    setError("");
    setMensaje(`Excel del sorteo generado con ${titularesElegiblesSorteo.length} afiliado(s) titular(es) acreditado(s).`);
  };

  const reemitirTarjeta = async (tarjeta) => {
    setMensaje("");
    setError("");
    const nuevaTarjeta = await reemitirTarjetaCena({ anio, tarjetaId: tarjeta.id, usuario });
    setMensaje(`Tarjeta reemitida con nuevo código administrativo ${nuevaTarjeta.codigoVisible}.`);
    await recargar();
  };

  const confirmarImportacion = async (filas, { omitidas = 0, onProgress = null } = {}) => {
    setMensaje("");
    setError("");
    const resultado = await importarReservasCena({ anio, filas, onProgress });
    const omitidasFinales = omitidas + resultado.omitidas;
    const erroresImportacion = resultado.errores.map(({ fila, error: errorImportacion }) => (
      `${fila.afiliado.dni}: ${errorImportacion.message || "no se pudo importar"}`
    ));

    setMensaje(`Importación finalizada: ${resultado.creadas} reserva(s) creadas correctamente; ${omitidasFinales} omitida(s); ${erroresImportacion.length} con error; ${resultado.pendientesGeneracion} pendiente(s) de generación de tarjetas.`);
    if (erroresImportacion.length) setError(`Errores de importación: ${erroresImportacion.join(" | ")}`);
    await recargar();
    setImportar(false);
    return {
      creadas: resultado.creadas,
      omitidas: omitidasFinales,
      errores: erroresImportacion.length,
      pendientesGeneracion: resultado.pendientesGeneracion,
      tarjetasGeneradas: resultado.tarjetasGeneradas,
    };
  };

  const crearEdicion = async () => {
    await asegurarEdicionCena(anio);
    setMensaje(`Edición Cena del Docente ${anio} lista.`);
    await recargar();
  };

  const guardarDatosEvento = async (datos) => {
    setMensaje("");
    setError("");
    try {
      await guardarDatosEventoCena(anio, datos);
      setEditarDatosEvento(false);
      setMensaje(`Datos de la Cena ${anio} actualizados.`);
      await recargar();
    } catch (err) {
      setError("No se pudieron guardar los datos de la Cena.");
    }
  };

  const solicitarVaciado = async () => {
    const anioObjetivo = anio;
    const confirmado = window.confirm(
      `Esta acción eliminará todas las reservas, tarjetas QR y validaciones de Gestión Cena correspondientes al año ${anioObjetivo}.`
    );
    if (!confirmado) return;

    setMensaje("");
    setError("");
    try {
      const resumen = await obtenerResumenVaciadoGestionCena(anioObjetivo);
      setConfirmacionVaciado("");
      setVaciado({ anio: anioObjetivo, resumen });
    } catch (err) {
      setError("No se pudieron calcular los datos a eliminar.");
    }
  };

  const confirmarVaciado = async () => {
    const anioObjetivo = vaciado?.anio;
    if (!anioObjetivo || confirmacionVaciado !== `ELIMINAR ${anioObjetivo}`) return;
    setVaciando(true);
    setError("");
    try {
      const resultado = await vaciarGestionCenaAnio(anioObjetivo);
      setVaciado(null);
      setConfirmacionVaciado("");
      setMensaje(`Datos ${anioObjetivo} eliminados: ${resultado.reservasEliminadas} reserva(s), ${resultado.tarjetasEliminadas} tarjeta(s) y ${resultado.validacionesEliminadas} validación(es).`);
      await recargar();
    } catch (err) {
      setError(err.message || "El vaciado no se completó. Revisá los datos eliminados antes de reintentar.");
    } finally {
      setVaciando(false);
    }
  };

  return (
    <main className={styles.gcPage}>
      <section className={styles.gcHeader}>
        <div className={styles.gcHeaderIntro}>
          <h1>Gestión Cena</h1>
          <p>Administración de reservas, tarjetas y acreditaciones de la Cena del Docente.</p>
        </div>
        <div className={styles.gcHeaderControls}>
          <label>
            Año de la Cena
            <select value={anio} onChange={(e) => { setReservaSeleccionada(null); setAnio(Number(e.target.value)); }}>
              {Array.from({ length: 8 }, (_, i) => 2026 + i).map((year) => (
                <option key={year} value={year}>{year}</option>
              ))}
            </select>
          </label>
          <button type="button" className={styles.primaryButton} onClick={crearEdicion}>Crear edición</button>
          <button type="button" className={styles.secondaryButton} onClick={() => setEditarDatosEvento(true)}>Editar datos de la Cena</button>
          <button type="button" className={styles.gcDangerButton} onClick={solicitarVaciado}>Vaciar datos {anio}</button>
        </div>
      </section>

      <nav className={styles.gcTabs}>
        {tabs.map(([key, label]) => (
          <button
            key={key}
            type="button"
            className={tab === key ? styles.gcActiveTab : ""}
            onClick={() => { if (key !== "tarjetas") setReservaSeleccionada(null); setTab(key); }}
          >
            {label}
          </button>
        ))}
      </nav>

      <section className={styles.gcContent}>
        {cargando && <p className={styles.notice}>Cargando...</p>}
        {mensaje && <p className={styles.notice}>{mensaje}</p>}
        {error && <p className={styles.error}>{error}</p>}

        {tab === "resumen" && <CenaResumen reservas={reservas} tarjetas={tarjetas} />}
        {tab === "reservas" && (
          <CenaReservas
            reservas={reservas}
            tarjetas={tarjetas}
            onNueva={() => setDialogReserva({})}
            onEditar={(reserva) => setDialogReserva(reserva)}
            onAnular={anular}
            onTarjetas={(reserva) => { setReservaSeleccionada(reserva); setTab("tarjetas"); }}
            onPdf={pdfReserva}
            onImportar={() => setImportar(true)}
            onExcelSorteo={exportarExcelSorteo}
            titularesElegiblesSorteo={titularesElegiblesSorteo.length}
          />
        )}
        {tab === "tarjetas" && (
          <CenaTarjetas
            tarjetas={tarjetas}
            anio={anio}
            edicion={edicion}
            reservaSeleccionada={reservaSeleccionada}
            onVolverTodas={() => setReservaSeleccionada(null)}
            onVolverReservas={() => { setReservaSeleccionada(null); setTab("reservas"); }}
            onAnularTarjeta={anularTarjeta}
            onReemitirTarjeta={reemitirTarjeta}
            onPdf={pdfSeleccion}
            onPdfReserva={pdfReserva}
            onPdfTodas={pdfTarjetasMasivo}
            generandoPdf={progresoPdf.activo}
            progresoPdf={progresoPdf}
            urlParaTarjeta={urlParaTarjeta}
          />
        )}
        {tab === "validacion" && <CenaValidacion anio={anio} usuario={usuario} tokenInicial={tokenInicial} />}
      </section>

      <CenaReservaDialog
        visible={Boolean(dialogReserva)}
        reserva={dialogReserva?.id ? dialogReserva : null}
        anio={anio}
        onClose={() => setDialogReserva(null)}
        onGuardar={guardarReserva}
      />
      <CenaCargaMasiva visible={importar} reservas={reservas} onClose={() => setImportar(false)} onConfirmar={confirmarImportacion} />
      <CenaDatosEventoDialog visible={editarDatosEvento} anio={anio} edicion={edicion} onClose={() => setEditarDatosEvento(false)} onGuardar={guardarDatosEvento} />
      {progresoPdf.activo && (
        <div className={styles.modalOverlay} role="dialog" aria-modal="true" aria-labelledby="titulo-progreso-pdf">
          <section className={`${styles.modal} ${styles.gcPdfProgressModal}`}>
            <h2 id="titulo-progreso-pdf">{progresoPdf.titulo}</h2>
            {progresoPdf.tipo === "afiliado" && progresoPdf.afiliado && (
              <p className={styles.gcPdfProgressAffiliate}>
                {progresoPdf.afiliado.apellido} {progresoPdf.afiliado.nombre}<br />
                DNI {formatearDniCena(progresoPdf.afiliado.dni)}
              </p>
            )}
            <p className={styles.gcPdfProgressMessage}>{progresoPdf.mensaje}</p>
            <div
              className={styles.gcPdfProgressTrack}
              role="progressbar"
              aria-valuemin="0"
              aria-valuemax="100"
              aria-valuenow={progresoPdf.porcentaje}
              aria-label="Progreso de generación del PDF"
            >
              <span style={{ width: `${progresoPdf.porcentaje}%` }} />
            </div>
            <strong className={styles.gcPdfProgressPercent}>{progresoPdf.porcentaje}%</strong>
            <p className={styles.gcPdfProgressDetails}>Procesando {progresoPdf.procesadas} de {progresoPdf.total} tarjetas</p>
            <p className={styles.gcPdfProgressDetails}>Hasta {Math.ceil(progresoPdf.total / 4)} página(s) A4.</p>
          </section>
        </div>
      )}
      {vaciado && (
        <div className={styles.gcDangerModalOverlay} role="dialog" aria-modal="true" aria-labelledby="titulo-vaciado-cena">
          <div className={styles.gcDangerModal}>
            <h2 id="titulo-vaciado-cena">Vaciar datos {vaciado.anio}</h2>
            <p>Esta acción eliminará las reservas, tarjetas QR y validaciones de la Cena {vaciado.anio}.</p>
            <div className={styles.gcDangerCounts}>
              <span>Reservas a eliminar <b>{vaciado.resumen.reservas}</b></span>
              <span>Tarjetas a eliminar <b>{vaciado.resumen.tarjetas}</b></span>
              <span>Validaciones a eliminar <b>{vaciado.resumen.validaciones}</b></span>
            </div>
            {vaciado.resumen.acreditadas > 0 && <p className={styles.gcDangerWarning}>Existen acreditaciones registradas. Esta operación eliminará también ese historial.</p>}
            <label>
              Escribí ELIMINAR {vaciado.anio} para confirmar
              <input value={confirmacionVaciado} onChange={(event) => setConfirmacionVaciado(event.target.value)} disabled={vaciando} />
            </label>
            <div className={styles.modalActions}>
              <button type="button" className={styles.secondaryButton} onClick={() => setVaciado(null)} disabled={vaciando}>Cancelar</button>
              <button type="button" className={styles.gcDangerButton} disabled={vaciando || confirmacionVaciado !== `ELIMINAR ${vaciado.anio}`} onClick={confirmarVaciado}>
                {vaciando ? "Vaciando datos..." : `Vaciar datos ${vaciado.anio}`}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
};

export default GestionCenaAdmin;
