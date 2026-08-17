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
  excluirUsuarioEmision,
  obtenerAprobadosCurso,
  obtenerConfiguracionCertificado,
  obtenerConfiguracionesCertificado,
  obtenerEmisionVigenteCertificado,
  reincluirUsuarioEmision,
} from "../../../services/certificadosService";
import CertificadoPreview from "./components/CertificadoPreview";
import SelectorConfiguracion from "./SelectorConfiguracion";
import styles from "./CertificadosAdmin.module.css";
import emitir from "./EmitirCertificados.module.css";

const DIACRITICOS = new RegExp("[\\u0300-\\u036f]", "g");

const normalizar = (valor) =>
  String(valor || "")
    .normalize("NFD")
    .replace(DIACRITICOS, "")
    .trim()
    .toLowerCase();

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

  const recordarEmision = useCallback((usuarioDocId, emision) => {
    setEmisionesSesion((previas) => {
      const siguiente = new Map(previas);
      siguiente.set(usuarioDocId, emision || null);
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
    (usuarioDocId) => Boolean(emisionesSesion.get(usuarioDocId)),
    [emisionesSesion]
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
      if (emisionesSesion.has(usuarioDocId)) return;

      setConsultandoEmisionUsuario(usuarioDocId);

      try {
        const emision = await obtenerEmisionVigenteCertificado(
          curso.id,
          usuarioDocId
        );

        // null = 404 controlado: todavía no emitido. Se registra igual para no
        // repetir la consulta cada vez que se abre el mismo preview.
        recordarEmision(usuarioDocId, emision);
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
      if (emisionesSesion.get(participante.usuarioDocId)) return;
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
        recordarEmision(participante.usuarioDocId, emision);

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
            if (existente) recordarEmision(participante.usuarioDocId, existente);
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
              Podés previsualizar y emitir certificados individuales. La
              generación del PDF y el QR gráfico se incorporará en la
              siguiente etapa.
            </p>

            <button
              type="button"
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
                                    className={emitir.botonQuitar}
                                    onClick={() =>
                                      quitarParticipante(participante)
                                    }
                                    disabled={
                                      quitandoUsuario ===
                                        participante.usuarioDocId ||
                                      estaEmitido(participante.usuarioDocId)
                                    }
                                    title={
                                      estaEmitido(participante.usuarioDocId)
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
                              className={emitir.botonQuitar}
                              onClick={() => quitarParticipante(participante)}
                              disabled={
                                quitandoUsuario === participante.usuarioDocId ||
                                estaEmitido(participante.usuarioDocId)
                              }
                              title={
                                estaEmitido(participante.usuarioDocId)
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
        emitido={estaEmitido(participantePreview?.usuarioDocId)}
        consultandoEmision={
          consultandoEmisionUsuario === participantePreview?.usuarioDocId
        }
        emision={emisionesSesion.get(participantePreview?.usuarioDocId) || null}
        onEmitir={() => emitirParticipante(participantePreview)}
        onCerrar={() => setParticipantePreview(null)}
      />
    </>
  );
};

export default EmitirCertificados;
