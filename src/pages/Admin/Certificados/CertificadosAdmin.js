// src/pages/Admin/Certificados/CertificadosAdmin.js
//
// Gestión de Certificados SIDCA — etapa 1: CONFIGURAR CERTIFICADO.
//
// Flujo:
//   1. Elegir la capacitación (colección "cursos", lectura directa).
//   2. Buscar la configuración existente en el backend.
//        200 -> se carga el borrador guardado.
//        404 -> formulario nuevo con el título precargado.
//   3. Elegir la institución, completar los datos documentales y las dos
//      autoridades (nombre y cargo, en texto — ya no hay firmas con imagen).
//   4. Guardar mediante PUT; el documento queda en certificados/{cursoId}.
//
// Toda escritura pasa por sidca-chatbot-backend, que verifica el Firebase ID
// Token y exige permiso administrativo. Estar debajo de /admin no autoriza
// nada por sí solo.
//
// EMITIR está habilitada en modo preparación: lista los aprobados reales del
// curso y permite previsualizar el certificado. Todavía no emite (sin QR, sin
// token, sin PDF, sin escribir en Firestore).
//
// Las áreas Emitidos / Validadores / Validar QR se muestran deshabilitadas:
// sólo anticipan la arquitectura, no tienen lógica todavía.

import React, { useCallback, useEffect, useRef, useState } from "react";
import { Dialog } from "primereact/dialog";
import { Toast } from "primereact/toast";

import {
  guardarConfiguracionCertificado,
  obtenerConfiguracionCertificado,
} from "../../../services/certificadosService";
import AutoridadesCertificado, {
  AUTORIDADES_VACIAS,
  normalizarDosAutoridades,
} from "./AutoridadesCertificado";
import EmitirCertificados from "./EmitirCertificados";
import FormularioCertificado, {
  CAMPOS_CERTIFICADO,
} from "./FormularioCertificado";
import InstitucionCertificado, {
  normalizarInstitucion,
} from "./InstitucionCertificado";
import SelectorCurso from "./SelectorCurso";
import ValidarCertificadoQR from "./ValidarCertificadoQR";
import ValidadoresCertificados from "./ValidadoresCertificados";
import RegistroInscriptos from "./RegistroInscriptos";
import styles from "./CertificadosAdmin.module.css";

const SECCIONES = [
  { id: "configurar", label: "Configurar", habilitada: true },
  { id: "emitir", label: "Emitir", habilitada: true },
  { id: "emitidos", label: "Emitidos", habilitada: false },
  { id: "validadores", label: "Validadores", habilitada: true },
  { id: "registro", label: "Registro Inscriptos", habilitada: true },
  { id: "validar", label: "Validar QR", habilitada: true },
];

const FORM_VACIO = {
  titulo: "",
  resolucion: "",
  cargaHoraria: "",
  dias: "",
  fecha: "",
  modalidad: "",
};

const CertificadosAdmin = () => {
  const toast = useRef(null);

  const [seccion, setSeccion] = useState("configurar");
  const [curso, setCurso] = useState(null);
  const [modalConfigurarVisible, setModalConfigurarVisible] = useState(false);

  const [form, setForm] = useState(FORM_VACIO);

  // Institución y autoridades viven fuera de `form` porque no son campos de
  // texto del formulario: una es una elección entre dos, la otra una lista.
  const [institucionCertificado, setInstitucionCertificado] = useState("sidca");
  const [autoridades, setAutoridades] = useState(AUTORIDADES_VACIAS);

  const [errores, setErrores] = useState({});

  const [configuracion, setConfiguracion] = useState(null);
  const [cargandoConfig, setCargandoConfig] = useState(false);
  const [guardando, setGuardando] = useState(false);

  const notificar = useCallback((severity, summary, detail) => {
    toast.current?.show({ severity, summary, detail, life: 5000 });
  }, []);

  /**
   * Al elegir un curso se consulta su configuración.
   * Si no existe todavía, se arma un formulario nuevo con el título
   * precargado: es el único dato que puede venir del curso.
   */
  const seleccionarCurso = useCallback(
    async (cursoElegido) => {
      setCurso(cursoElegido);
      setErrores({});
      setConfiguracion(null);
      // El modal se abre de inmediato y muestra "Consultando configuración…"
      // mientras llega la respuesta, en vez de dejar el listado congelado.
      setModalConfigurarVisible(true);
      setCargandoConfig(true);

      try {
        const existente = await obtenerConfiguracionCertificado(cursoElegido.id);

        if (existente) {
          setConfiguracion(existente);
          setForm({
            titulo: existente.titulo || "",
            resolucion: existente.resolucion || "",
            cargaHoraria: existente.cargaHoraria || "",
            dias: existente.dias || "",
            fecha: existente.fecha || "",
            modalidad: existente.modalidad || "",
          });
          // Configuraciones anteriores no traen institución: caen en "sidca".
          setInstitucionCertificado(
            normalizarInstitucion(existente.institucionCertificado)
          );

          // El backend ya resolvió el fallback desde las firmas legacy; acá
          // sólo se completan las dos posiciones fijas.
          setAutoridades(normalizarDosAutoridades(existente.autoridades));

          notificar(
            "info",
            "Configuración existente",
            "Se cargó el borrador guardado para esta capacitación."
          );
        } else {
          setForm({ ...FORM_VACIO, titulo: cursoElegido.titulo || "" });
          setInstitucionCertificado("sidca");
          setAutoridades(normalizarDosAutoridades([]));
        }
      } catch (error) {
        // No se deja el formulario a medio cargar: se vuelve al estado neutro.
        setForm({ ...FORM_VACIO, titulo: cursoElegido.titulo || "" });
        setInstitucionCertificado("sidca");
        setAutoridades(normalizarDosAutoridades([]));
        notificar(
          "error",
          "No se pudo consultar la configuración",
          error.message
        );
      } finally {
        setCargandoConfig(false);
      }
    },
    [notificar]
  );

  const cambiarCampo = useCallback((campo, valor) => {
    setForm((previo) => ({ ...previo, [campo]: valor }));
    setErrores((previos) => {
      if (!previos[campo]) return previos;
      const siguiente = { ...previos };
      delete siguiente[campo];
      return siguiente;
    });
  }, []);

  /**
   * Validación en el cliente para dar feedback inmediato.
   * La validación real es la del backend (Zod): esta sólo evita viajes.
   */
  const validar = useCallback(() => {
    const nuevos = {};

    CAMPOS_CERTIFICADO.forEach((campo) => {
      if (!String(form[campo.nombre] || "").trim()) {
        nuevos[campo.nombre] = "Este dato es obligatorio.";
      }
    });

    // Las autoridades NO se validan acá: la configuración se guarda como
    // borrador y puede quedar incompleta. Quien exige las dos completas es el
    // backend, al emitir. AutoridadesCertificado muestra un aviso informativo.

    setErrores(nuevos);
    return Object.keys(nuevos).length === 0;
  }, [form]);

  const guardar = useCallback(async () => {
    if (!curso) return;

    if (!validar()) {
      notificar(
        "warn",
        "Faltan datos",
        "Revisá los campos marcados antes de guardar."
      );
      return;
    }

    setGuardando(true);

    try {
      const guardada = await guardarConfiguracionCertificado(curso.id, {
        ...form,
        institucionCertificado,
        autoridades,
      });

      setConfiguracion(guardada);

      if (guardada) {
        setInstitucionCertificado(
          normalizarInstitucion(guardada.institucionCertificado)
        );
        setAutoridades(normalizarDosAutoridades(guardada.autoridades));
      }

      notificar(
        "success",
        "Configuración guardada correctamente",
        `Certificado ${guardada?.cursoId || curso.id}`
      );

      // Sólo se cierra tras un guardado exitoso: si falla, el modal queda
      // abierto con los datos cargados para poder corregir.
      setModalConfigurarVisible(false);
    } catch (error) {
      notificar("error", "No se pudo guardar", error.message);
    } finally {
      setGuardando(false);
    }
  }, [curso, form, institucionCertificado, autoridades, validar, notificar]);

  /**
   * Cierra el modal y vuelve al listado. No se limpia el curso: así el ítem
   * seleccionado sigue resaltado y reabrirlo es inmediato.
   * Mientras se guarda no se permite cerrar, para no dejar el guardado a
   * medias sin feedback.
   */
  const cerrarModalConfigurar = useCallback(() => {
    if (guardando) return;
    setModalConfigurarVisible(false);
  }, [guardando]);

  // Al cambiar de capacitación se limpian los errores previos.
  useEffect(() => {
    setErrores({});
  }, [curso?.id]);

  const bloqueado = guardando || cargandoConfig;

  return (
    <div className={styles.pagina}>
      <Toast ref={toast} />

      <div className={styles.contenedor}>
        <header className={styles.encabezado}>
          <h1 className={styles.titulo}>Gestión de Certificados SIDCA</h1>
          <p className={styles.subtitulo}>
            Configuración documental de los certificados por capacitación.
          </p>
        </header>

        <nav className={styles.secciones} aria-label="Secciones del módulo">
          {SECCIONES.map((item) => (
            <button
              key={item.id}
              type="button"
              className={`${styles.seccionBoton} ${
                seccion === item.id ? styles.seccionBotonActiva : ""
              }`}
              onClick={() => item.habilitada && setSeccion(item.id)}
              disabled={!item.habilitada}
              title={item.habilitada ? item.label : "Próximamente"}
            >
              {item.label}
              {!item.habilitada && (
                <span className={styles.seccionPendiente}>Próximamente</span>
              )}
            </button>
          ))}
        </nav>

        {seccion === "configurar" && (
          <>
            <section className={styles.bloque}>
              <div className={styles.bloqueHeader}>
                <h2 className={styles.bloqueTitulo}>
                  1. Elegí la capacitación
                </h2>
              </div>

              <SelectorCurso
                cursoSeleccionado={curso}
                onSeleccionar={seleccionarCurso}
                deshabilitado={bloqueado}
              />
            </section>

            <Dialog
              visible={modalConfigurarVisible}
              onHide={cerrarModalConfigurar}
              modal
              blockScroll
              closeOnEscape={!guardando}
              dismissableMask={false}
              draggable={false}
              className={styles.modal}
              style={{ width: "min(900px, 94vw)" }}
              contentClassName={styles.modalContenido}
              breakpoints={{ "768px": "96vw" }}
              header={
                <div className={styles.modalHeader}>
                  <span className={styles.modalTitulo}>
                    Configurar certificado
                  </span>
                  <span className={styles.modalSubtitulo}>
                    {curso?.titulo || "Sin título"}
                  </span>
                  {configuracion && (
                    <span className={styles.modalMeta}>
                      Estado: <strong>{configuracion.estadoConfiguracion}</strong>
                    </span>
                  )}
                </div>
              }
              footer={
                <div className={styles.modalPie}>
                  <button
                    type="button"
                    className={styles.botonSecundario}
                    onClick={cerrarModalConfigurar}
                    disabled={guardando}
                  >
                    Cancelar
                  </button>

                  <button
                    type="button"
                    className={styles.botonPrimario}
                    onClick={guardar}
                    disabled={bloqueado}
                  >
                    {guardando ? "Guardando…" : "Guardar configuración"}
                  </button>
                </div>
              }
            >
              {cargandoConfig ? (
                <p className={styles.estadoTexto}>Consultando configuración…</p>
              ) : (
                curso && (
                  <>
                    {!configuracion && (
                      <p className={styles.resumenEstado}>
                        Todavía no tiene configuración de certificado.
                      </p>
                    )}

                    {/* La institución va primero: define la plantilla, así que
                        conviene decidirla antes de cargar los datos. */}
                    <InstitucionCertificado
                      valor={institucionCertificado}
                      onCambiar={setInstitucionCertificado}
                      deshabilitado={guardando}
                    />

                    <FormularioCertificado
                      valores={form}
                      errores={errores}
                      onCambiar={cambiarCampo}
                      deshabilitado={guardando}
                    />

                    <AutoridadesCertificado
                      autoridades={autoridades}
                      onCambiar={setAutoridades}
                      deshabilitado={guardando}
                    />

                    <p className={styles.notaGuardado}>
                      Se guarda como <strong>borrador</strong>. Podés guardar
                      aunque falten autoridades: se exigen completas al emitir.
                    </p>
                  </>
                )
              )}
            </Dialog>
          </>
        )}

        {seccion === "emitir" && <EmitirCertificados notificar={notificar} />}

        {seccion === "validar" && <ValidarCertificadoQR notificar={notificar} />}
        {seccion === "validadores" && <ValidadoresCertificados notificar={notificar} />}
        {seccion === "registro" && <RegistroInscriptos notificar={notificar} />}
      </div>
    </div>
  );
};

export default CertificadosAdmin;
