// src/pages/Admin/Certificados/EmitirCertificados.js
//
// Pestaña EMITIR.
//
// Flujo:
//   1. Elegir entre los certificados YA CONFIGURADOS.
//   2. GET configuración -> datos documentales para el preview.
//   3. GET aprobados      -> lista real, resuelta por el backend.
//   4. Buscar, previsualizar y EMITIR el certificado de un participante.
//
// La fuente NO es la colección "cursos": eso es lo que usa Configurar, cuya
// finalidad es justamente elegir qué curso configurar. Emitir sólo puede
// trabajar sobre capacitaciones que ya tienen certificado configurado, así
// que parte de "certificados" filtrado por el backend. Los documentos
// históricos de esa colección (sin cursoId) quedan fuera.
//
//   CONFIGURAR -> cursos
//   EMITIR     -> certificados configurados
//   EMITIDOS   -> certificados con emitidos (etapa futura)
//
// Los aprobados NO se cargan a mano: salen del importador de Excel existente
// (usuarios/{usuarioDocId}/cursos con aprobo:true). El frontend no envía DNI
// ni decide quién está aprobado; sólo muestra lo que responde el backend
// autenticado.
//
// La EMISIÓN ya es real: POST /admin/emision/:cursoId/emitir registra el
// certificado en Firestore a través del backend, que vuelve a verificar todo
// por su cuenta (aprobación, exclusión, datos, doble emisión) y arma el
// snapshot con lo que él mismo lee. El frontend sólo envía usuarioDocId.
// Todavía NO se genera PDF ni QR gráfico: eso llega en la etapa siguiente.

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Dialog } from "primereact/dialog";

import {
  eliminarConfiguracionCertificado,
  emitirCertificado,
  emitirCertificadosMasivamente,
  excluirUsuarioEmision,
  obtenerAprobadosCurso,
  obtenerConfiguracionCertificado,
  obtenerConfiguracionesCertificado,
  obtenerEmisionVigenteCertificado,
  iniciarPdfMasivo,
  obtenerEstadoPdfMasivo,
  obtenerPdfMasivoActual,
  descargarPdfMasivo as descargarPdfMasivoArchivo,
  reincluirUsuarioEmision,
} from "../../../services/certificadosService";
import CertificadoPreview from "./components/CertificadoPreview";
import SelectorConfiguracion from "./SelectorConfiguracion";
import styles from "./CertificadosAdmin.module.css";
import emitir from "./EmitirCertificados.module.css";
// La descarga MASIVA ya no se arma en el navegador: la resuelve el Cloud Run
// Job. Estos helpers siguen en uso para la descarga INDIVIDUAL, que captura el
// preview en pantalla y no pasa por el Job.
import {
  agregarCanvasAPdf,
  capturarCertificado,
  crearPdfA4Horizontal,
  sanitizarNombreArchivo,
} from "./utils/certificadoPdf";

const DIACRITICOS = new RegExp("[\\u0300-\\u036f]", "g");

const normalizar = (valor) =>
  String(valor || "")
    .normalize("NFD")
    .replace(DIACRITICOS, "")
    .trim()
    .toLowerCase();

const claveEmision = (cursoId, usuarioDocId) => {
  const curso = String(cursoId || "").trim();
  const usuario = String(usuarioDocId || "").trim();
  if (!curso || !usuario) return "";
  return `${curso}::${usuario}`;
};

/** Sólo para mostrar. El DNI almacenado no se modifica. */
const formatearDni = (dni) => {
  const limpio = String(dni || "").replace(/\D/g, "");
  if (!limpio) return "—";
  return limpio.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
};

const ETIQUETA_ESTADO = {
  aprobado: "Aprobado",
  sin_usuario: "Sin usuario asociado",
  datos_incompletos: "Datos incompletos",
};

const CLASE_ESTADO = {
  aprobado: emitir.estadoAprobado,
  sin_usuario: emitir.estadoSinUsuario,
  datos_incompletos: emitir.estadoIncompleto,
};

const RESUMEN_VACIO = {
  documentosAprobacion: 0,
  aprobados: 0,
  disponibles: 0,
  identificados: 0,
  sinUsuario: 0,
  datosIncompletos: 0,
  duplicados: 0,
  excluidos: 0,
};

/* ============================================================
   PDF MASIVO — estado del trabajo
   ============================================================ */

/** Cada cuánto se pregunta por el trabajo. Dos segundos, no doscientos ms. */
const PDF_POLLING_MS = 2000;

/**
 * ¿El trabajo sigue corriendo?
 *
 * Se aceptan también los estados del vocabulario anterior para que un trabajo
 * que quedó en vuelo no se muestre como colgado.
 */
const pdfEnCurso = (trabajo) =>
  ["pendiente", "procesando", "preparando", "generando", "finalizando"].includes(
    String(trabajo?.estado || "")
  );

const pdfCompletado = (trabajo) =>
  ["completado", "listo"].includes(String(trabajo?.estado || ""));

const pdfConError = (trabajo) => String(trabajo?.estado || "") === "error";

/** Milisegundos a mm:ss (o h:mm:ss si pasa de la hora). */
const formatearDuracion = (ms) => {
  const total = Math.max(0, Math.round(Number(ms || 0) / 1000));
  const horas = Math.floor(total / 3600);
  const minutos = Math.floor((total % 3600) / 60);
  const segundos = total % 60;
  const dosDigitos = (valor) => String(valor).padStart(2, "0");

  return horas > 0
    ? `${horas}:${dosDigitos(minutos)}:${dosDigitos(segundos)}`
    : `${dosDigitos(minutos)}:${dosDigitos(segundos)}`;
};

/** Marca de tiempo a "13:21 hs". Devuelve vacío si el backend no la mandó. */
const formatearHora = (valor) => {
  if (!valor) return "";
  const fecha = new Date(valor);
  if (Number.isNaN(fecha.getTime())) return "";
  return `${String(fecha.getHours()).padStart(2, "0")}:${String(
    fecha.getMinutes()
  ).padStart(2, "0")} hs`;
};

/**
 * Un registro es gestionable sólo si su usuario existe realmente.
 *
 * Los "sin usuario asociado" son aprobaciones cuyo documento de usuario ya
 * no existe: no se pueden previsualizar (no hay nombre ni DNI que imprimir)
 * y no tiene sentido apartarlos de la emisión, porque ya son no emitibles.
 */
const esGestionable = (participante) =>
  Boolean(participante?.usuarioDocId) && participante?.estado !== "sin_usuario";

const MOTIVO_NO_GESTIONABLE =
  "No se puede gestionar la emisión porque este registro no está asociado a un usuario.";

/**
 * Para EMITIR el criterio es más estricto que para previsualizar.
 *
 * Un registro con datos incompletos se puede mirar, pero no se puede emitir:
 * saldría un certificado oficial sin DNI o sin nombre. El backend lo rechaza
 * igual con 409; acá se evita el viaje y se explica el motivo.
 */
const esEmitible = (participante) =>
  Boolean(participante?.usuarioDocId) && participante?.estado === "aprobado";

const MOTIVO_DATOS_INCOMPLETOS =
  "No se puede emitir porque los datos del participante están incompletos.";

const MOTIVO_YA_EMITIDO =
  "Este participante ya tiene un certificado emitido. La anulación se gestionará desde Emitidos.";

/** Mensaje del backend que indica inequívocamente una emisión ya existente. */
const esErrorYaEmitido = (error) =>
  error?.status === 409 &&
  String(error?.message || "")
    .toLowerCase()
    .includes("ya tiene un certificado vigente");

const EmitirCertificados = ({ notificar }) => {
  const [configuraciones, setConfiguraciones] = useState([]);
  const [cargandoLista, setCargandoLista] = useState(true);
  const [errorLista, setErrorLista] = useState("");
  const [busquedaCurso, setBusquedaCurso] = useState("");

  const [curso, setCurso] = useState(null);
  const [modalEmitirVisible, setModalEmitirVisible] = useState(false);
  const [configuracion, setConfiguracion] = useState(null);
  const [sinConfiguracion, setSinConfiguracion] = useState(false);

  const [resumen, setResumen] = useState(RESUMEN_VACIO);
  const [participantes, setParticipantes] = useState([]);

  // Apartados de la emisión. Conservan su aprobación: se listan aparte para
  // poder recuperarlos, no para emitirles.
  const [participantesExcluidos, setParticipantesExcluidos] = useState([]);

  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState("");
  const [busqueda, setBusqueda] = useState("");

  const [participantePreview, setParticipantePreview] = useState(null);

  // Fila del listado que se abrió: aporta resolución y estado al encabezado
  // del modal sin esperar a que llegue la configuración completa.
  const [seleccion, setSeleccion] = useState(null);

  const [quitandoUsuario, setQuitandoUsuario] = useState("");
  const [recuperandoUsuario, setRecuperandoUsuario] = useState("");
  const [quitandoCurso, setQuitandoCurso] = useState(false);

  // Emisión en curso. Sirve para el estado del botón y para que un doble
  // click no dispare dos POST.
  const [emitiendoUsuario, setEmitiendoUsuario] = useState("");

  // Consulta de emisión en curso. Evita pedidos duplicados y bloquea el botón
  // Emitir mientras todavía no sabemos si ya existe un certificado.
  const [consultandoEmisionUsuario, setConsultandoEmisionUsuario] = useState("");

  /**
   * Emisiones conocidas en esta pantalla: usuarioDocId -> emisión completa.
   *
   * Un Map y no un Set porque el QR necesita la urlValidacion, y más adelante
   * el PDF necesitará el token y el snapshot. Tener la clave alcanza para
   * saber que está emitido, así que no hace falta un segundo estado.
   *
   * Se llena por dos vías: la respuesta del POST al emitir, y el GET al abrir
   * el preview de alguien ya emitido. La autoridad sigue siendo el backend.
   */
  const [emisionesSesion, setEmisionesSesion] = useState(() => new Map());
  const [descargandoUsuario, setDescargandoUsuario] = useState("");
  const [descargandoMasivo, setDescargandoMasivo] = useState(false);

  // PDF masivo. El trabajo vive en Firestore, no en esta pestaña: por eso se
  // guarda el documento completo del trabajo y no un progreso local. El texto
  // del botón y el del diálogo salen de ahí.
  const [trabajoPdf, setTrabajoPdf] = useState(null);
  const [dialogoPdfVisible, setDialogoPdfVisible] = useState(false);
  const [bajandoArchivoPdf, setBajandoArchivoPdf] = useState(false);

  // Emisión masiva. Crea certificados oficiales; no tiene nada que ver con la
  // descarga masiva, que sólo lee lo que ya está emitido.
  const [emitiendoMasivo, setEmitiendoMasivo] = useState(false);
  const [confirmarEmisionMasivaVisible, setConfirmarEmisionMasivaVisible] =
    useState(false);
  const [resultadoEmisionMasiva, setResultadoEmisionMasiva] = useState(null);

  const recordarEmision = useCallback((cursoId, usuarioDocId, emision) => {
    const clave = claveEmision(cursoId, usuarioDocId);
    if (!clave) return;
    setEmisionesSesion((previas) => {
      const siguiente = new Map(previas);
      siguiente.set(clave, emision || null);
      return siguiente;
    });
  }, []);

  /**
   * ¿Este participante tiene certificado emitido?
   *
   * Ojo con la semántica del Map: una clave presente con valor null significa
   * "ya consultamos y NO está emitido". Por eso se mira el valor y no has().
   */
  const estaEmitido = useCallback(
    (participante) => {
      if (participante?.certificadoEmitido === true) return true;
      const clave = claveEmision(curso?.id, participante?.usuarioDocId);
      return clave ? Boolean(emisionesSesion.get(clave)) : false;
    },
    [curso?.id, emisionesSesion]
  );

  // Lista de certificados configurados. Se pide una sola vez al abrir la
  // pestaña; el filtrado del selector es en memoria.
  useEffect(() => {
    let activo = true;

    const cargar = async () => {
      try {
        const lista = await obtenerConfiguracionesCertificado();
        if (!activo) return;
        setConfiguraciones(lista);
        setErrorLista("");
      } catch (e) {
        if (!activo) return;
        setErrorLista(
          e?.message || "No se pudieron cargar los certificados configurados."
        );
      } finally {
        if (activo) setCargandoLista(false);
      }
    };

    cargar();

    return () => {
      activo = false;
    };
  }, []);

  const limpiar = useCallback(() => {
    setConfiguracion(null);
    setSinConfiguracion(false);
    setResumen(RESUMEN_VACIO);
    setParticipantes([]);
    setParticipantesExcluidos([]);
    setBusqueda("");
    setError("");
  }, []);

  /**
   * Vuelve a pedir los aprobados y reemplaza resumen y listas con lo que
   * responde el backend.
   *
   * Se usa después de apartar o recuperar a alguien. Recalcular los contadores
   * a mano sería frágil: son seis valores relacionados entre sí —aprobados,
   * disponibles, identificados, datosIncompletos, sinUsuario, excluidos— y
   * cualquier ajuste parcial los desincroniza. El backend es la única fuente
   * que los deja coherentes.
   */
  const recargarAprobados = useCallback(async () => {
    if (!curso) return;

    const datos = await obtenerAprobadosCurso(curso.id);

    setResumen(datos.resumen || RESUMEN_VACIO);
    setParticipantes(datos.participantes || []);
    setParticipantesExcluidos(datos.participantesExcluidos || []);
  }, [curso]);

  /**
   * Configuración y aprobados se piden en paralelo: son independientes y así
   * la pantalla no espera dos viajes encadenados.
   *
   * Se vuelve a pedir la configuración completa aunque el listado ya traiga
   * algunos campos: el selector sólo recibe los livianos y el preview
   * necesita cargaHoraria, dias y fecha.
   */
  const seleccionarCurso = useCallback(
    async (configuracionElegida) => {
      const cursoElegido = {
        id: configuracionElegida.cursoId,
        titulo:
          configuracionElegida.cursoTitulo || configuracionElegida.titulo || "",
        cursoId: configuracionElegida.cursoId,
      };

      setCurso(cursoElegido);
      setSeleccion(configuracionElegida);
      limpiar();
      // Se abre de inmediato y muestra el estado de carga adentro.
      setModalEmitirVisible(true);
      setCargando(true);

      const [resConfig, resAprobados] = await Promise.allSettled([
        obtenerConfiguracionCertificado(cursoElegido.id),
        obtenerAprobadosCurso(cursoElegido.id),
      ]);

      if (resConfig.status === "fulfilled") {
        setConfiguracion(resConfig.value);
        setSinConfiguracion(!resConfig.value);
      } else {
        setSinConfiguracion(true);
        notificar?.(
          "error",
          "No se pudo consultar la configuración",
          resConfig.reason?.message || "Error inesperado."
        );
      }

      if (resAprobados.status === "fulfilled") {
        setResumen(resAprobados.value.resumen || RESUMEN_VACIO);
        setParticipantes(resAprobados.value.participantes || []);
        setParticipantesExcluidos(
          resAprobados.value.participantesExcluidos || []
        );
      } else {
        const fallo = resAprobados.reason;

        // 404 acá es "el curso no existe", no "no hay aprobados": sin
        // aprobados el backend responde 200 con lista vacía.
        setError(fallo?.message || "No se pudieron cargar los aprobados.");
        notificar?.(
          "error",
          "No se pudieron cargar los aprobados",
          fallo?.message || "Error inesperado."
        );
      }

      setCargando(false);
    },
    [limpiar, notificar]
  );

  // Filtrado en memoria: no se vuelve a consultar el backend por cada tecla.
  const visibles = useMemo(() => {
    const termino = normalizar(busqueda);
    if (!termino) return participantes;

    const soloDigitos = termino.replace(/\D/g, "");

    return participantes.filter((participante) => {
      if (normalizar(participante.apellidoNombre).includes(termino)) return true;
      if (soloDigitos && String(participante.dni || "").includes(soloDigitos)) {
        return true;
      }
      return false;
    });
  }, [participantes, busqueda]);

  /**
   * Participantes a los que la emisión masiva les crearía un certificado.
   *
   * La autoridad es `certificadoEmitido`, que viene del backend: es lo que
   * sabe si existe una emisión vigente, incluso una hecha por otro
   * administrador en otra pestaña. `emisionesSesion` no sirve como fuente
   * porque sólo conoce lo que pasó por esta pantalla.
   *
   * Los apartados no se cuentan porque ni siquiera están en `participantes`:
   * viven en `participantesExcluidos`.
   *
   * Es una estimación para el botón y la confirmación. Quién se emite de
   * verdad lo decide el backend releyendo el padrón.
   */
  const participantesPendientesEmision = useMemo(
    () =>
      participantes.filter(
        (participante) =>
          participante?.estado === "aprobado" &&
          Boolean(participante?.usuarioDocId) &&
          participante?.certificadoEmitido !== true
      ),
    [participantes]
  );

  const cantidadPendientesEmision = participantesPendientesEmision.length;

  const cantidadYaEmitidos = useMemo(
    () =>
      participantes.filter(
        (participante) => participante?.certificadoEmitido === true
      ).length,
    [participantes]
  );

  // El botón refleja el trabajo real, no un contador local: después de un F5
  // vuelve a decir el porcentaje que va.
  const textoBotonPdfMasivo = pdfEnCurso(trabajoPdf)
    ? `Generando PDF… ${Number(trabajoPdf?.porcentaje || 0)} %`
    : "Descarga masiva PDF";

  const textoBotonEmisionMasiva = emitiendoMasivo
    ? "Emitiendo certificados…"
    : cantidadPendientesEmision === 0
    ? "Certificados emitidos"
    : cantidadPendientesEmision === 1
    ? "Emitir 1 certificado"
    : `Emitir ${cantidadPendientesEmision} certificados`;

  /**
   * Cierra el modal de Emitir y vuelve al listado.
   *
   * No se limpian configuraciones ni busquedaCurso: el listado y el texto del
   * buscador principal quedan como estaban. Sí se cierra el preview, para que
   * reabrir no arrastre un participante de la selección anterior.
   */
  const cerrarModalEmitir = useCallback(() => {
    setModalEmitirVisible(false);
    setParticipantePreview(null);
  }, []);

  const puedePrevisualizar = Boolean(configuracion);

  /**
   * Abre el preview y averigua si ese participante ya tiene certificado.
   *
   * El certificado se muestra de inmediato; la consulta va después y en
   * paralelo, así abrir el preview nunca se siente lento. Es una consulta
   * LAZY, por participante: nunca se piden las emisiones de toda la tabla.
   *
   * Es lo que hace que el QR siga apareciendo después de un F5: el Map en
   * memoria se pierde, pero la emisión sigue en Firestore.
   */
  const abrirPreview = useCallback(
    async (participante) => {
      if (!puedePrevisualizar) {
        notificar?.(
          "warn",
          "Falta la configuración",
          "Configurá el certificado de esta capacitación antes de previsualizar."
        );
        return;
      }

      setParticipantePreview(participante);

      const usuarioDocId = participante?.usuarioDocId;

      // Sin usuario no hay emisión posible; y si ya la conocemos, no se
      // vuelve a preguntar.
      if (!curso || !usuarioDocId) return;
      const clave = claveEmision(curso.id, usuarioDocId);
      if (clave && emisionesSesion.has(clave)) return;

      setConsultandoEmisionUsuario(usuarioDocId);

      try {
        const emision = await obtenerEmisionVigenteCertificado(
          curso.id,
          usuarioDocId
        );

        // null = 404 controlado: todavía no emitido. Se registra igual para no
        // repetir la consulta cada vez que se abre el mismo preview.
        recordarEmision(curso.id, usuarioDocId, emision);
      } catch (e) {
        // Error real de red o servidor. No se cierra el preview: el
        // certificado se sigue viendo, sólo no sabemos si está emitido.
        notificar?.(
          "error",
          "No se pudo consultar la emisión",
          e?.message || "Error inesperado."
        );
      } finally {
        setConsultandoEmisionUsuario("");
      }
    },
    [puedePrevisualizar, curso, emisionesSesion, recordarEmision, notificar]
  );

  const descargarPdfIndividual = useCallback(async (participante) => {
    if (!curso || !estaEmitido(participante) || descargandoUsuario) return;
    setDescargandoUsuario(participante.usuarioDocId);
    try {
      let emision = emisionesSesion.get(claveEmision(curso.id, participante.usuarioDocId));
      if (!emision) {
        emision = await obtenerEmisionVigenteCertificado(curso.id, participante.usuarioDocId);
        recordarEmision(curso.id, participante.usuarioDocId, emision);
      }
      setParticipantePreview(participante);
      await new Promise((resolve) => setTimeout(resolve, 350));
      const elemento = document.querySelector(`.${emitir.certificado}`) || document.querySelector("[class*='certificado']");
      if (!elemento) throw new Error("No se encontró el lienzo del certificado.");
      const canvas = await capturarCertificado(elemento);
      const pdf = crearPdfA4Horizontal();
      agregarCanvasAPdf(pdf, canvas, true);
      pdf.save(`Certificado - ${sanitizarNombreArchivo(emision?.participante?.apellidoNombre || participante.apellidoNombre)} - ${sanitizarNombreArchivo(emision?.participante?.dni || participante.dni)}.pdf`);
    } catch (error) {
      notificar?.("error", "No se pudo generar el PDF", error?.message || "Error inesperado.");
    } finally {
      setDescargandoUsuario("");
    }
  }, [curso, emisionesSesion, descargandoUsuario, estaEmitido, recordarEmision, notificar]);

  /**
   * Descarga el archivo ya generado y lo entrega al navegador.
   *
   * El objeto de Storage nunca se nombra desde acá: el backend lo lee del
   * documento del trabajo. Lo único que viaja es cursoId y jobId.
   */
  const bajarArchivoPdf = useCallback(
    async (trabajo) => {
      if (!curso?.id || !trabajo?.jobId) return;

      const blob = await descargarPdfMasivoArchivo(curso.id, trabajo.jobId);
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");

      anchor.href = url;
      anchor.download =
        trabajo.nombreArchivo ||
        `Certificados - ${sanitizarNombreArchivo(curso.titulo)}.pdf`;
      anchor.click();

      URL.revokeObjectURL(url);
    },
    [curso]
  );

  /**
   * Lanza la generación. No espera acá: sólo deja el trabajo registrado y
   * abre el diálogo. El seguimiento lo hace el efecto de polling, que
   * sobrevive a que este handler termine.
   *
   * Pulsar de nuevo con un trabajo en curso no duplica nada: el backend
   * devuelve el que ya está corriendo.
   */
  const descargarPdfMasivo = useCallback(async () => {
    if (!curso?.id || descargandoMasivo) return;

    setDescargandoMasivo(true);

    try {
      const trabajo = await iniciarPdfMasivo(curso.id);

      if (!trabajo?.jobId) {
        throw new Error("No se pudo iniciar la generación del PDF.");
      }

      setTrabajoPdf(trabajo);
      setDialogoPdfVisible(true);
    } catch (error) {
      setDescargandoMasivo(false);
      notificar?.(
        "error",
        "No se pudo iniciar la descarga masiva",
        error?.message || "Error inesperado."
      );
    }
  }, [curso, descargandoMasivo, notificar]);

  /**
   * Recuperación: al abrir un curso se pregunta si tiene un trabajo vigente.
   *
   * La generación no vive en la pestaña. Si el administrador recargó, cerró el
   * navegador o perdió la conexión, al volver encuentra el progreso donde
   * estaba, o el PDF terminado listo para bajar.
   */
  useEffect(() => {
    if (!curso?.id) {
      setTrabajoPdf(null);
      setDialogoPdfVisible(false);
      return undefined;
    }

    let activo = true;

    obtenerPdfMasivoActual(curso.id)
      .then((trabajo) => {
        if (!activo || !trabajo) return;

        setTrabajoPdf(trabajo);

        if (pdfEnCurso(trabajo)) {
          setDescargandoMasivo(true);
          setDialogoPdfVisible(true);
        }
      })
      // Silencioso a propósito: no poder consultar un trabajo previo no es
      // motivo para molestar al administrador que recién entra al curso.
      .catch(() => undefined);

    return () => {
      activo = false;
    };
  }, [curso?.id]);

  /**
   * Polling del trabajo en curso.
   *
   * Vive en un efecto y no dentro del handler: así el seguimiento no depende
   * de que una función siga viva, se limpia solo al desmontar y no puede
   * dejar dos temporizadores encadenados. Se detiene en cuanto el trabajo
   * termina, falla o el componente se va.
   */
  useEffect(() => {
    const jobId = trabajoPdf?.jobId;

    if (!curso?.id || !jobId || !pdfEnCurso(trabajoPdf)) return undefined;

    let activo = true;
    let temporizador = null;

    const consultar = async () => {
      try {
        const actualizado = await obtenerEstadoPdfMasivo(curso.id, jobId);
        if (!activo) return;

        if (actualizado) setTrabajoPdf(actualizado);

        // Reprograma sólo si sigue en curso: nada de intervalos que corren
        // por su cuenta después de terminar.
        if (activo && pdfEnCurso(actualizado)) {
          temporizador = setTimeout(consultar, PDF_POLLING_MS);
        } else if (activo) {
          setDescargandoMasivo(false);
        }
      } catch (e) {
        if (!activo) return;
        // Un fallo puntual de red no cancela el seguimiento: se reintenta.
        temporizador = setTimeout(consultar, PDF_POLLING_MS);
      }
    };

    temporizador = setTimeout(consultar, PDF_POLLING_MS);

    return () => {
      activo = false;
      if (temporizador) clearTimeout(temporizador);
    };
  }, [curso?.id, trabajoPdf]);

  /** Descarga el PDF terminado desde el diálogo. */
  const bajarPdfTerminado = useCallback(async () => {
    if (!trabajoPdf || bajandoArchivoPdf) return;

    setBajandoArchivoPdf(true);

    try {
      await bajarArchivoPdf(trabajoPdf);
      setDialogoPdfVisible(false);
    } catch (error) {
      notificar?.(
        "error",
        "No se pudo descargar el PDF",
        error?.message || "Error inesperado."
      );
    } finally {
      setBajandoArchivoPdf(false);
    }
  }, [trabajoPdf, bajandoArchivoPdf, bajarArchivoPdf, notificar]);

  /**
   * Reintento tras un fallo. Crea un trabajo NUEVO: el que falló queda como
   * está, con su mensaje, en lugar de sobrescribirse.
   */
  const reintentarPdfMasivo = useCallback(async () => {
    setTrabajoPdf(null);
    setDescargandoMasivo(false);
    await descargarPdfMasivo();
  }, [descargarPdfMasivo]);

  /**
   * Emite el certificado del participante.
   *
   * Registra la emisión REAL en Firestore a través del backend. Todavía no
   * genera PDF ni QR gráfico: eso llega en la etapa siguiente.
   *
   * Las comprobaciones de acá son de UX —evitan viajes inútiles y explican el
   * motivo—. La seguridad real está en el backend, que vuelve a verificar
   * aprobación, exclusiones, datos y doble emisión por su cuenta.
   */
  const emitirParticipante = useCallback(
    async (participante) => {
      if (!curso || !configuracion || !participante) return;
      if (!esEmitible(participante)) return;
      const clave = claveEmision(curso.id, participante.usuarioDocId);
      if (clave && emisionesSesion.get(clave)) return;
      if (emitiendoUsuario) return;
      // Todavía no sabemos si ya existe un certificado: esperar la consulta
      // evita un 409 innecesario.
      if (consultandoEmisionUsuario === participante.usuarioDocId) return;

      const confirmado = window.confirm(
        `¿Emitir el certificado de "${participante.apellidoNombre}"?\n\n` +
          `DNI: ${formatearDni(participante.dni)}\n\n` +
          "Esta acción registrará un certificado oficial SIDCA para esta capacitación.\n\n" +
          "Todavía no se generará el PDF ni la descarga; en esta etapa se registrará " +
          "la emisión y su código de validación.\n\n¿Continuar?"
      );

      if (!confirmado) return;

      setEmitiendoUsuario(participante.usuarioDocId);

      try {
        const emision = await emitirCertificado(
          curso.id,
          participante.usuarioDocId
        );

        if (!emision?.certificadoId || !emision?.token || !emision?.urlValidacion) {
          throw new Error(
            "El servidor no devolvió los datos de la emisión. Verificá en Emitidos antes de reintentar."
          );
        }

        // Se guarda la emisión COMPLETA, no sólo la marca: el QR necesita
        // urlValidacion y así aparece de inmediato, sin un GET extra.
        recordarEmision(curso.id, participante.usuarioDocId, emision);

        notificar?.(
          "success",
          "Certificado emitido",
          `El certificado de ${participante.apellidoNombre} fue registrado correctamente.`
        );
      } catch (e) {
        // Si el backend avisa que YA existe un certificado vigente, se
        // recupera esa emisión para poder mostrar su QR: el certificado
        // existe, sólo no lo teníamos en memoria. No se hace ante cualquier
        // 409 — excluido, curso apartado o datos incompletos son situaciones
        // distintas y corregibles.
        if (esErrorYaEmitido(e)) {
          try {
            const existente = await obtenerEmisionVigenteCertificado(
              curso.id,
              participante.usuarioDocId
            );
            if (existente) recordarEmision(curso.id, participante.usuarioDocId, existente);
          } catch (errorConsulta) {
            /* si tampoco se puede consultar, queda el mensaje de error */
          }
        }

        notificar?.(
          "error",
          "No se pudo emitir el certificado",
          e?.message || "Error inesperado."
        );
      } finally {
        setEmitiendoUsuario("");
      }
    },
    [
      curso,
      configuracion,
      emisionesSesion,
      emitiendoUsuario,
      consultandoEmisionUsuario,
      recordarEmision,
      notificar,
    ]
  );

  /**
   * Aparta a un participante de la emisión.
   *
   * NO elimina al usuario ni su aprobación: el backend sólo agrega su
   * usuarioDocId a certificados/{cursoId}.usuariosExcluidos.
   *
   * Al terminar se recargan los aprobados en lugar de ajustar la lista y los
   * contadores a mano. Antes se hacía así, pero ahora la persona tiene que
   * aparecer en el bloque de apartados, y reconstruir las dos listas más los
   * seis contadores en memoria es exactamente donde se cuelan las
   * inconsistencias.
   */
  const quitarParticipante = useCallback(
    async (participante) => {
      if (!curso) return;

      // Defensa: los registros sin usuario ya son no emitibles y no tiene
      // sentido apartarlos. La UI no ofrece el botón, esto cubre el resto.
      if (!esGestionable(participante)) {
        notificar?.("warn", "Registro no gestionable", MOTIVO_NO_GESTIONABLE);
        return;
      }

      const confirmado = window.confirm(
        `¿Quitar a ${participante.apellidoNombre || "este participante"} de la emisión de certificados?\n\n` +
          "No se elimina el usuario, ni su aprobación, ni ningún dato académico. " +
          "Solamente deja de aparecer para emitir certificados de esta capacitación, y se puede revertir."
      );

      if (!confirmado) return;

      setQuitandoUsuario(participante.usuarioDocId);

      try {
        await excluirUsuarioEmision(curso.id, participante.usuarioDocId);

        // Si estaba abierto su preview, se cierra.
        setParticipantePreview((previo) =>
          previo?.usuarioDocId === participante.usuarioDocId ? null : previo
        );

        await recargarAprobados();

        notificar?.(
          "success",
          "Participante quitado de la emisión",
          "Su aprobación y sus datos siguen intactos. Podés recuperarlo desde el bloque de apartados."
        );
      } catch (e) {
        notificar?.(
          "error",
          "No se pudo quitar el participante",
          e?.message || "Error inesperado."
        );
      } finally {
        setQuitandoUsuario("");
      }
    },
    [curso, recargarAprobados, notificar]
  );

  /**
   * Recupera a un participante apartado para que vuelva a estar disponible.
   *
   * Es la inversa exacta de apartarlo: el backend sólo saca su usuarioDocId de
   * certificados/{cursoId}.usuariosExcluidos. No restaura nada — la aprobación
   * nunca se borró — ni crea ni anula certificados emitidos.
   *
   * Se permite también para registros sin usuario asociado: la acción sólo
   * revierte la exclusión, y seguirán sin poder emitirse por su estado.
   */
  const recuperarParticipante = useCallback(
    async (participante) => {
      if (!curso || !participante?.usuarioDocId) return;
      if (recuperandoUsuario) return;

      const confirmado = window.confirm(
        `¿Recuperar a "${participante.apellidoNombre || "este participante"}" para la emisión de certificados?\n\n` +
          "Su aprobación nunca fue eliminada. Volverá a estar disponible para emitir este certificado."
      );

      if (!confirmado) return;

      setRecuperandoUsuario(participante.usuarioDocId);

      try {
        await reincluirUsuarioEmision(curso.id, participante.usuarioDocId);

        await recargarAprobados();

        notificar?.(
          "success",
          "Participante recuperado",
          "Volvió a estar disponible para la emisión de certificados. Su aprobación se mantuvo intacta."
        );
      } catch (e) {
        notificar?.(
          "error",
          "No se pudo recuperar el participante",
          e?.message || "Error inesperado."
        );
      } finally {
        setRecuperandoUsuario("");
      }
    },
    [curso, recuperandoUsuario, recargarAprobados, notificar]
  );

  /**
   * Emite certificados oficiales para todos los pendientes del curso.
   *
   * No manda la lista de participantes: sólo el cursoId. El backend reconstruye
   * el padrón y decide a quién emitir, así que lo que esta pantalla tenga
   * cargado —o desactualizado— no puede provocar una emisión indebida.
   *
   * No genera PDF. Eso es la descarga masiva, que sólo lee lo ya emitido.
   */
  const emitirMasivamente = useCallback(async () => {
    if (!curso?.id || emitiendoMasivo) return;

    setEmitiendoMasivo(true);

    try {
      const resultado = await emitirCertificadosMasivamente(curso.id);

      setResultadoEmisionMasiva(resultado);
      setConfirmarEmisionMasivaVisible(false);

      // La verdad la tiene el backend: se recarga en vez de marcar a mano
      // certificadoEmitido, que dejaría la pantalla creyendo cosas que quizá
      // no ocurrieron. Después de esto los recién emitidos ya vienen con
      // certificadoEmitido en true, sin necesidad de recargar la página.
      await recargarAprobados();

      if (resultado.errores.length) {
        notificar?.(
          "warn",
          "Emisión masiva con errores",
          `Se emitieron ${resultado.emitidos} certificados y ${resultado.errores.length} no pudieron emitirse.`
        );
      } else if (resultado.emitidos === 0) {
        notificar?.(
          "info",
          "No había certificados pendientes",
          "Todos los participantes elegibles ya tenían su certificado emitido."
        );
      } else {
        notificar?.(
          "success",
          "Emisión masiva completada",
          `Se emitieron ${resultado.emitidos} certificados.`
        );
      }
    } catch (e) {
      notificar?.(
        "error",
        "No se pudo completar la emisión masiva",
        e?.message || "Error inesperado."
      );
    } finally {
      setEmitiendoMasivo(false);
    }
  }, [curso, emitiendoMasivo, recargarAprobados, notificar]);

  /**
   * Elimina la configuración de certificado del curso.
   *
   * Borra únicamente certificados/{cursoId}. El curso académico, los usuarios
   * y sus aprobaciones NO se tocan: el curso sigue disponible en Configurar,
   * ahora como curso sin configurar.
   *
   * Es una acción destructiva y no reversible: se pierden los datos
   * documentales cargados (título, resolución, carga horaria, firmas…).
   */
  const quitarCurso = useCallback(async () => {
    if (!curso) return;

    const confirmado = window.confirm(
      "Se eliminará la configuración de este certificado.\n\n" +
        "El curso, sus participantes y sus aprobaciones no serán eliminados. " +
        "Podrás volver a configurar el certificado desde la pestaña Configurar.\n\n" +
        `¿Eliminar la configuración de "${curso.titulo}"?`
    );

    if (!confirmado) return;

    setQuitandoCurso(true);

    try {
      await eliminarConfiguracionCertificado(curso.id);

      setConfiguraciones((previas) =>
        previas.filter((c) => c.cursoId !== curso.id)
      );

      setModalEmitirVisible(false);
      setParticipantePreview(null);

      notificar?.(
        "success",
        "Configuración de certificado eliminada",
        "El curso, sus participantes y sus aprobaciones siguen intactos."
      );
    } catch (e) {
      notificar?.(
        "error",
        "No se pudo eliminar la configuración",
        e?.message || "Error inesperado."
      );
    } finally {
      setQuitandoCurso(false);
    }
  }, [curso, notificar]);

  return (
    <>
      <section className={styles.bloque}>
        <div className={styles.bloqueHeader}>
          <h2 className={styles.bloqueTitulo}>
            Seleccioná el certificado configurado
          </h2>
        </div>

        {cargandoLista ? (
          <p className={styles.estadoTexto}>
            Cargando certificados configurados…
          </p>
        ) : errorLista ? (
          <p className={styles.mensajeError}>{errorLista}</p>
        ) : (
          <SelectorConfiguracion
            configuraciones={configuraciones}
            configuracionSeleccionada={curso}
            onSeleccionar={seleccionarCurso}
            deshabilitado={cargando}
            busqueda={busquedaCurso}
            onBuscar={setBusquedaCurso}
          />
        )}
      </section>

      <Dialog
        visible={modalEmitirVisible}
        onHide={cerrarModalEmitir}
        modal
        blockScroll
        draggable={false}
        dismissableMask={false}
        className={styles.modal}
        style={{ width: "min(1200px, 96vw)" }}
        contentClassName={styles.modalContenido}
        breakpoints={{ "768px": "96vw" }}
        header={
          <div className={styles.modalHeader}>
            <span className={styles.modalTitulo}>Emitir certificados</span>
            <span className={styles.modalSubtitulo}>
              {curso?.titulo || "Sin título"}
            </span>
            <span className={styles.modalMeta}>
              {(seleccion?.resolucion || configuracion?.resolucion) && (
                <>Resolución: {seleccion?.resolucion || configuracion?.resolucion} · </>
              )}
              Estado:{" "}
              <strong>
                {configuracion?.estadoConfiguracion ||
                  seleccion?.estadoConfiguracion ||
                  "borrador"}
              </strong>
            </span>
          </div>
        }
        footer={
          <div className={styles.modalPie}>
            <p className={styles.notaGuardado}>
              Podés emitir certificados individualmente o de forma masiva y
              descargar en PDF los certificados que ya fueron emitidos.
            </p>

            {/* Acción primaria. No emite al pulsarlo: abre la confirmación. */}
            <button
              type="button"
              className={styles.botonPrimario}
              onClick={() => setConfirmarEmisionMasivaVisible(true)}
              disabled={
                emitiendoMasivo || cargando || cantidadPendientesEmision === 0
              }
              title="Crea los certificados oficiales de los participantes aprobados que todavía no tienen uno. No genera el PDF."
            >
              {textoBotonEmisionMasiva}
            </button>

            <button
              type="button"
              className={styles.botonSecundario}
              onClick={
                // Con una generación en curso, el botón vuelve a abrir el
                // progreso en vez de intentar lanzar otra. Terminada, sí
                // inicia una nueva: el conjunto de emitidos pudo cambiar y un
                // PDF viejo ya no lo representaría.
                pdfEnCurso(trabajoPdf)
                  ? () => setDialogoPdfVisible(true)
                  : descargarPdfMasivo
              }
              disabled={descargandoMasivo && !pdfEnCurso(trabajoPdf)}
              title="Genera el PDF con los certificados ya emitidos. No emite a nadie."
            >
              {textoBotonPdfMasivo}
            </button>

            <button
              className={emitir.botonQuitarCurso}
              onClick={quitarCurso}
              disabled={quitandoCurso || cargando}
              title="Elimina la configuración del certificado. El curso, los participantes y sus aprobaciones no se tocan."
            >
              {quitandoCurso ? "Eliminando…" : "Quitar curso de emisión"}
            </button>

            <button
              type="button"
              className={styles.botonSecundario}
              onClick={cerrarModalEmitir}
            >
              Cerrar
            </button>
          </div>
        }
      >
        {cargando && <p className={styles.estadoTexto}>Consultando…</p>}

        {!cargando && sinConfiguracion && (
          <p className={emitir.avisoBloqueante}>
            Este curso todavía no tiene configuración de certificado.
            Completala en la pestaña <strong>Configurar</strong> para poder
            previsualizar.
          </p>
        )}

        {error && <p className={styles.mensajeError}>{error}</p>}

        {!cargando && !error && (
          <>
            <div className={emitir.indicadores}>
            <div className={emitir.indicador}>
              <span className={emitir.indicadorNumero}>{resumen.aprobados}</span>
              <span className={emitir.indicadorEtiqueta}>Aprobados</span>
            </div>
            <div className={emitir.indicador}>
              <span className={emitir.indicadorNumero}>
                {resumen.identificados}
              </span>
              <span className={emitir.indicadorEtiqueta}>Identificados</span>
            </div>
            <div className={emitir.indicador}>
              <span className={emitir.indicadorNumero}>
                {resumen.sinUsuario}
              </span>
              <span className={emitir.indicadorEtiqueta}>Sin usuario</span>
            </div>
            <div className={emitir.indicador}>
              <span className={emitir.indicadorNumero}>
                {resumen.excluidos}
              </span>
              <span className={emitir.indicadorEtiqueta}>Excluidos</span>
            </div>
          </div>

          <p className={emitir.notaIndicadores}>
            <strong>Aprobados</strong> es el total de aprobaciones académicas
            del curso y no cambia al quitar participantes de la emisión.
            Quitar a alguien sólo lo aparta de esta pantalla: su aprobación
            queda intacta.
          </p>

          {resumen.duplicados > 0 && (
            <p className={emitir.advertencia}>
              Se encontraron {resumen.documentosAprobacion} registros de
              aprobación para {resumen.aprobados}{" "}
              {resumen.aprobados === 1 ? "persona" : "personas"}. Cada persona
              aparece una sola vez en la lista.
            </p>
          )}

          {resumen.truncado && (
            <p className={emitir.advertencia}>
              Se alcanzó el máximo de registros consultados. Puede haber
              aprobados sin mostrar.
            </p>
          )}

          {resumen.excluidos > 0 && (
            <p className={emitir.advertencia}>
              {resumen.excluidos}{" "}
              {resumen.excluidos === 1
                ? "participante fue apartado"
                : "participantes fueron apartados"}{" "}
              de la emisión de esta capacitación. Su aprobación y sus datos
              siguen intactos.
            </p>
          )}

          {/* Sin aprobados y "todos apartados" son situaciones distintas: la
              primera es que no se cargó el Excel, la segunda que alguien los
              quitó de la emisión. Decir lo primero cuando pasa lo segundo
              mandaría a buscar el problema al lugar equivocado. */}
          {participantes.length === 0 ? (
            <p className={styles.estadoTexto}>
              {resumen.aprobados === 0
                ? "Esta capacitación todavía no tiene aprobados cargados."
                : "No hay participantes disponibles para emitir. Todos los aprobados están apartados de la emisión."}
            </p>
          ) : (
            <>
              <label className={styles.campo}>
                <span className={styles.campoLabel}>Buscar participante</span>
                <input
                  type="search"
                  className={styles.input}
                  value={busqueda}
                  onChange={(e) => setBusqueda(e.target.value)}
                  placeholder="Apellido, nombre o DNI…"
                />
              </label>

              <p className={styles.ayuda}>
                {visibles.length} de {participantes.length}{" "}
                {participantes.length === 1 ? "participante" : "participantes"}.
              </p>

              {visibles.length === 0 ? (
                <p className={styles.estadoTexto}>
                  Ningún participante coincide con la búsqueda.
                </p>
              ) : (
                <>
                  {/* Escritorio: tabla. Móvil: tarjetas. Se alternan por CSS. */}
                  <div className={emitir.tablaWrap}>
                    <table className={emitir.tabla}>
                      <thead>
                        <tr>
                          <th>Apellido y nombre</th>
                          <th>DNI</th>
                          <th>Estado</th>
                          <th>Acciones</th>
                        </tr>
                      </thead>
                      <tbody>
                        {visibles.map((participante) => (
                          <tr key={participante.usuarioDocId}>
                            <td className={emitir.celdaNombre}>
                              {participante.apellidoNombre || "—"}
                            </td>
                            <td>{formatearDni(participante.dni)}</td>
                            <td>
                              <span
                                className={`${emitir.estado} ${
                                  CLASE_ESTADO[participante.estado] || ""
                                }`}
                              >
                                {ETIQUETA_ESTADO[participante.estado] ||
                                  participante.estado}
                              </span>
                            </td>
                            <td>
                              {esGestionable(participante) ? (
                                <div className={emitir.acciones}>
                                  <button
                                    type="button"
                                    className={emitir.botonPreview}
                                    onClick={() => abrirPreview(participante)}
                                    disabled={!puedePrevisualizar}
                                    title={
                                      puedePrevisualizar
                                        ? "Ver vista previa"
                                        : "Configurá el certificado primero"
                                    }
                                  >
                                    Preview certificado
                                  </button>

                                  <button
                                    type="button"
                                    className={emitir.botonPreview}
                                    onClick={() => descargarPdfIndividual(participante)}
                                    disabled={!estaEmitido(participante) || descargandoUsuario === participante.usuarioDocId}
                                  >
                                    {descargandoUsuario === participante.usuarioDocId ? "Descargando…" : "Descargar PDF"}
                                  </button>

                                  <button
                                    type="button"
                                    className={emitir.botonQuitar}
                                    onClick={() =>
                                      quitarParticipante(participante)
                                    }
                                    disabled={
                                      quitandoUsuario ===
                                        participante.usuarioDocId ||
                                      estaEmitido(participante)
                                    }
                                    title={
                                      estaEmitido(participante)
                                        ? MOTIVO_YA_EMITIDO
                                        : "Deja de aparecer para emitir. No borra al usuario ni su aprobación."
                                    }
                                  >
                                    {quitandoUsuario ===
                                    participante.usuarioDocId
                                      ? "Quitando…"
                                      : "Quitar de emisión"}
                                  </button>
                                </div>
                              ) : (
                                <span
                                  className={emitir.sinAcciones}
                                  title={MOTIVO_NO_GESTIONABLE}
                                >
                                  No gestionable
                                </span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <ul className={emitir.tarjetas}>
                    {visibles.map((participante) => (
                      <li
                        key={participante.usuarioDocId}
                        className={emitir.tarjeta}
                      >
                        <span className={emitir.tarjetaNombre}>
                          {participante.apellidoNombre || "—"}
                        </span>

                        <span className={emitir.tarjetaDato}>
                          DNI: {formatearDni(participante.dni)}
                        </span>

                        <span
                          className={`${emitir.estado} ${
                            CLASE_ESTADO[participante.estado] || ""
                          }`}
                        >
                          {ETIQUETA_ESTADO[participante.estado] ||
                            participante.estado}
                        </span>

                        {esGestionable(participante) ? (
                          <div className={emitir.acciones}>
                            <button
                              type="button"
                              className={emitir.botonPreview}
                              onClick={() => abrirPreview(participante)}
                              disabled={!puedePrevisualizar}
                            >
                              Preview certificado
                            </button>

                            <button
                              type="button"
                              className={emitir.botonPreview}
                              onClick={() => descargarPdfIndividual(participante)}
                              disabled={!estaEmitido(participante) || descargandoUsuario === participante.usuarioDocId}
                            >
                              {descargandoUsuario === participante.usuarioDocId ? "Descargando…" : "Descargar PDF"}
                            </button>

                            <button
                              type="button"
                              className={emitir.botonQuitar}
                              onClick={() => quitarParticipante(participante)}
                              disabled={
                                quitandoUsuario === participante.usuarioDocId ||
                                estaEmitido(participante)
                              }
                              title={
                                estaEmitido(participante)
                                  ? MOTIVO_YA_EMITIDO
                                  : undefined
                              }
                            >
                              {quitandoUsuario === participante.usuarioDocId
                                ? "Quitando…"
                                : "Quitar de emisión"}
                            </button>
                          </div>
                        ) : (
                          <p className={emitir.sinAccionesTarjeta}>
                            {MOTIVO_NO_GESTIONABLE}
                          </p>
                        )}
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </>
          )}

          {/* ---- Apartados de la emisión ----
              Bloque separado a propósito: no son candidatos a emitir, son
              personas cuya aprobación sigue vigente y que pueden reincorporarse.
              Mezclarlos con los disponibles invitaría a intentar emitirles. */}
          {participantesExcluidos.length > 0 && (
            <section className={emitir.bloqueApartados}>
              <h3 className={emitir.apartadosTitulo}>
                Participantes apartados de la emisión
              </h3>

              <p className={emitir.apartadosTexto}>
                Estos participantes conservan su aprobación. Podés recuperarlos
                para que vuelvan a estar disponibles para emitir.
              </p>

              <div className={emitir.tablaWrap}>
                <table className={emitir.tabla}>
                  <thead>
                    <tr>
                      <th>Apellido y nombre</th>
                      <th>DNI</th>
                      <th>Estado</th>
                      <th>Acción</th>
                    </tr>
                  </thead>
                  <tbody>
                    {participantesExcluidos.map((participante) => (
                      <tr key={participante.usuarioDocId}>
                        <td className={emitir.celdaNombre}>
                          {participante.apellidoNombre || "—"}
                        </td>
                        <td>{formatearDni(participante.dni)}</td>
                        <td>
                          <span
                            className={`${emitir.estado} ${emitir.estadoApartado}`}
                          >
                            {ETIQUETA_ESTADO[participante.estado] ||
                              participante.estado}
                          </span>
                        </td>
                        <td>
                          <button
                            type="button"
                            className={emitir.botonRecuperar}
                            onClick={() => recuperarParticipante(participante)}
                            disabled={
                              recuperandoUsuario === participante.usuarioDocId
                            }
                            title="Vuelve a estar disponible para emitir. Su aprobación nunca se eliminó."
                          >
                            {recuperandoUsuario === participante.usuarioDocId
                              ? "Recuperando…"
                              : "Recuperar para emisión"}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <ul className={emitir.tarjetas}>
                {participantesExcluidos.map((participante) => (
                  <li key={participante.usuarioDocId} className={emitir.tarjeta}>
                    <span className={emitir.tarjetaNombre}>
                      {participante.apellidoNombre || "—"}
                    </span>

                    <span className={emitir.tarjetaDato}>
                      DNI: {formatearDni(participante.dni)}
                    </span>

                    <span className={`${emitir.estado} ${emitir.estadoApartado}`}>
                      {ETIQUETA_ESTADO[participante.estado] ||
                        participante.estado}
                    </span>

                    <button
                      type="button"
                      className={emitir.botonRecuperar}
                      onClick={() => recuperarParticipante(participante)}
                      disabled={
                        recuperandoUsuario === participante.usuarioDocId
                      }
                    >
                      {recuperandoUsuario === participante.usuarioDocId
                        ? "Recuperando…"
                        : "Recuperar para emisión"}
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          )}
          </>
        )}
      </Dialog>

      <CertificadoPreview
        abierto={Boolean(participantePreview)}
        participante={participantePreview}
        configuracion={configuracion}
        puedeEmitir={esEmitible(participantePreview)}
        motivoNoEmitir={
          participantePreview?.estado === "datos_incompletos"
            ? MOTIVO_DATOS_INCOMPLETOS
            : ""
        }
        emitiendo={emitiendoUsuario === participantePreview?.usuarioDocId}
        emitido={estaEmitido(participantePreview)}
        consultandoEmision={
          consultandoEmisionUsuario === participantePreview?.usuarioDocId
        }
        emision={
          curso?.id && participantePreview?.usuarioDocId
            ? emisionesSesion.get(
                claveEmision(curso.id, participantePreview.usuarioDocId)
              ) || null
            : null
        }
        onEmitir={() => emitirParticipante(participantePreview)}
        onCerrar={() => setParticipantePreview(null)}
      />

      {/* Progreso del PDF masivo. Los tiempos los calcula el Job y viajan en
          el documento del trabajo: acá no se inventa ninguna estimación. */}
      <Dialog
        visible={dialogoPdfVisible}
        onHide={() => setDialogoPdfVisible(false)}
        modal
        blockScroll
        draggable={false}
        style={{ width: "min(520px, 94vw)" }}
        breakpoints={{ "768px": "96vw" }}
        header={
          pdfConError(trabajoPdf)
            ? "No se pudo generar el PDF masivo"
            : pdfCompletado(trabajoPdf)
            ? "PDF masivo listo"
            : "Generando PDF masivo"
        }
        footer={
          <div className={emitir.pieConfirmacion}>
            <button
              type="button"
              className={styles.botonSecundario}
              onClick={() => setDialogoPdfVisible(false)}
            >
              {pdfEnCurso(trabajoPdf) ? "Seguir en segundo plano" : "Cerrar"}
            </button>

            {pdfConError(trabajoPdf) && (
              <button
                type="button"
                className={styles.botonPrimario}
                onClick={reintentarPdfMasivo}
              >
                Reintentar
              </button>
            )}

            {pdfCompletado(trabajoPdf) && (
              <button
                type="button"
                className={styles.botonPrimario}
                onClick={bajarPdfTerminado}
                disabled={bajandoArchivoPdf}
              >
                {bajandoArchivoPdf ? "Descargando…" : "Descargar PDF"}
              </button>
            )}
          </div>
        }
      >
        {pdfConError(trabajoPdf) ? (
          <p className={styles.mensajeError}>
            {trabajoPdf?.error ||
              "La generación falló. Podés reintentarla; se creará un trabajo nuevo."}
          </p>
        ) : (
          <>
            <div
              className={emitir.barraProgreso}
              role="progressbar"
              aria-valuenow={Number(trabajoPdf?.porcentaje || 0)}
              aria-valuemin={0}
              aria-valuemax={100}
            >
              <span
                className={emitir.barraProgresoRelleno}
                style={{ width: `${Number(trabajoPdf?.porcentaje || 0)}%` }}
              />
            </div>

            <p className={emitir.progresoCifras}>
              <strong>{Number(trabajoPdf?.porcentaje || 0)} %</strong>
              <span>
                {Number(trabajoPdf?.procesados || 0)} de{" "}
                {Number(trabajoPdf?.total || 0)} certificados
              </span>
            </p>

            <dl className={emitir.resumenConfirmacion}>
              <div>
                <dt>Tiempo transcurrido</dt>
                <dd>{formatearDuracion(trabajoPdf?.transcurridoMs)}</dd>
              </div>

              {/* El Job no informa tiempo restante hasta tener muestra
                  suficiente; hasta entonces no se muestra la fila. */}
              {trabajoPdf?.restanteEstimadoMs !== null &&
                trabajoPdf?.restanteEstimadoMs !== undefined && (
                  <div>
                    <dt>Tiempo restante aproximado</dt>
                    <dd>{formatearDuracion(trabajoPdf.restanteEstimadoMs)}</dd>
                  </div>
                )}

              {formatearHora(trabajoPdf?.finalizacionEstimada) && (
                <div>
                  <dt>Finalización estimada</dt>
                  <dd>{formatearHora(trabajoPdf.finalizacionEstimada)}</dd>
                </div>
              )}
            </dl>

            {pdfEnCurso(trabajoPdf) && (
              <p className={styles.notaGuardado}>
                Podés cerrar esta ventana: la generación sigue en el servidor y
                al volver al curso vas a encontrar el progreso donde está.
              </p>
            )}
          </>
        )}
      </Dialog>

      {/* Confirmación. La emisión crea documentos irreversibles, así que nunca
          se dispara con un solo clic. */}
      <Dialog
        visible={confirmarEmisionMasivaVisible}
        onHide={() => {
          if (emitiendoMasivo) return;
          setConfirmarEmisionMasivaVisible(false);
        }}
        modal
        blockScroll
        closeOnEscape={!emitiendoMasivo}
        dismissableMask={false}
        draggable={false}
        style={{ width: "min(520px, 94vw)" }}
        breakpoints={{ "768px": "96vw" }}
        header="Confirmar emisión masiva"
        footer={
          <div className={emitir.pieConfirmacion}>
            <button
              type="button"
              className={styles.botonSecundario}
              onClick={() => setConfirmarEmisionMasivaVisible(false)}
              disabled={emitiendoMasivo}
            >
              Cancelar
            </button>
            <button
              type="button"
              className={styles.botonPrimario}
              onClick={emitirMasivamente}
              disabled={emitiendoMasivo || cantidadPendientesEmision === 0}
            >
              {textoBotonEmisionMasiva}
            </button>
          </div>
        }
      >
        <dl className={emitir.resumenConfirmacion}>
          <div>
            <dt>Curso</dt>
            <dd>{curso?.titulo || "Sin título"}</dd>
          </div>
          <div>
            <dt>Pendientes de emitir</dt>
            <dd>{cantidadPendientesEmision}</dd>
          </div>
          <div>
            <dt>Ya emitidos</dt>
            <dd>{cantidadYaEmitidos}</dd>
          </div>
        </dl>

        <p className={styles.notaGuardado}>
          Se emitirán certificados oficiales para todos los participantes
          aprobados y elegibles que todavía no tengan una emisión vigente. Cada
          certificado tendrá su propio código de validación.
        </p>
      </Dialog>

      {/* Resumen posterior. Se muestra siempre, incluso sin errores, para que
          quede claro qué pasó con cada grupo. */}
      <Dialog
        visible={Boolean(resultadoEmisionMasiva)}
        onHide={() => setResultadoEmisionMasiva(null)}
        modal
        blockScroll
        draggable={false}
        style={{ width: "min(560px, 94vw)" }}
        breakpoints={{ "768px": "96vw" }}
        header="Emisión masiva completada"
        footer={
          <div className={emitir.pieConfirmacion}>
            <button
              type="button"
              className={styles.botonSecundario}
              onClick={() => setResultadoEmisionMasiva(null)}
            >
              Cerrar
            </button>
          </div>
        }
      >
        {resultadoEmisionMasiva && (
          <>
            <dl className={emitir.resumenConfirmacion}>
              <div>
                <dt>Emitidos ahora</dt>
                <dd>{resultadoEmisionMasiva.emitidos}</dd>
              </div>
              <div>
                <dt>Ya emitidos previamente</dt>
                <dd>{resultadoEmisionMasiva.yaEmitidos}</dd>
              </div>
              <div>
                <dt>Omitidos</dt>
                <dd>
                  {resultadoEmisionMasiva.omitidos.apartados +
                    resultadoEmisionMasiva.omitidos.datosIncompletos +
                    resultadoEmisionMasiva.omitidos.sinUsuario}
                </dd>
              </div>
              <div>
                <dt>Errores</dt>
                <dd>{resultadoEmisionMasiva.errores.length}</dd>
              </div>
            </dl>

            {resultadoEmisionMasiva.errores.length > 0 && (
              <section className={emitir.erroresMasiva}>
                <h3 className={emitir.erroresMasivaTitulo}>
                  No se pudieron emitir
                </h3>
                <ul className={emitir.erroresMasivaLista}>
                  {resultadoEmisionMasiva.errores.map((fallo) => (
                    <li key={fallo.usuarioDocId}>
                      <strong>
                        {fallo.apellidoNombre || fallo.usuarioDocId}
                      </strong>
                      <span>{fallo.mensaje}</span>
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </>
        )}
      </Dialog>
    </>
  );
};

export default EmitirCertificados;
