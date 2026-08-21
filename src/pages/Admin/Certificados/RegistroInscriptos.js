import React, { useCallback, useEffect, useState } from "react";
import { ConfirmDialog, confirmDialog } from "primereact/confirmdialog";
import { Dialog } from "primereact/dialog";
import SelectorCurso from "./SelectorCurso";
import {
  listarRegistroInscriptosAdmin,
  listarRegistroInscriptosGlobalAdmin,
  subirPlanillasRegistroInscriptos,
  eliminarPlanillaRegistroInscriptos,
  descargarPlanillaRegistroInscriptosAdmin,
} from "../../../services/certificadosService";
import styles from "./RegistroInscriptos.module.css";

const MAX_MB = 15;
const esExcel = (file) => /\.(xls|xlsx)$/i.test(file?.name || "");
const fecha = (value) => value ? new Date(value).toLocaleString("es-AR", { dateStyle: "short", timeStyle: "short" }) : "Fecha no disponible";
const tamano = (bytes) => bytes >= 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`;

const RegistroInscriptos = ({ notificar }) => {
  const [curso, setCurso] = useState(null);
  const [modalPlanillasVisible, setModalPlanillasVisible] = useState(false);
  const [archivos, setArchivos] = useState([]);
  const [cargando, setCargando] = useState(false);
  const [subiendo, setSubiendo] = useState(false);
  const [descargando, setDescargando] = useState("");
  const [cursosConPlanillas, setCursosConPlanillas] = useState([]);
  const [cargandoGlobal, setCargandoGlobal] = useState(true);
  const [errorGlobal, setErrorGlobal] = useState("");

  const cargarGlobal = useCallback(async () => {
    setCargandoGlobal(true);
    setErrorGlobal("");
    try {
      setCursosConPlanillas(await listarRegistroInscriptosGlobalAdmin());
    } catch (error) {
      setErrorGlobal("No se pudieron cargar los cursos con planillas.");
      notificar?.("error", "No se pudo actualizar el listado", error.message);
    } finally {
      setCargandoGlobal(false);
    }
  }, [notificar]);

  useEffect(() => { cargarGlobal(); }, [cargarGlobal]);

  const cargar = useCallback(async () => {
    if (!curso) return setArchivos([]);
    setCargando(true);
    try {
      setArchivos(await listarRegistroInscriptosAdmin(curso.id));
    } catch (error) {
      notificar?.("error", "No se pudieron cargar las planillas", error.message);
    } finally {
      setCargando(false);
    }
  }, [curso, notificar]);

  useEffect(() => { cargar(); }, [cargar]);

  const abrirModalPlanillas = (cursoSeleccionado) => {
    setCurso(cursoSeleccionado);
    setArchivos([]);
    setModalPlanillasVisible(true);
  };

  const cerrarModalPlanillas = () => {
    if (subiendo) return;
    setModalPlanillasVisible(false);
    setCurso(null);
    setArchivos([]);
  };

  const subir = async (event) => {
    const seleccionados = Array.from(event.target.files || []);
    event.target.value = "";
    if (!seleccionados.length || !curso) return;
    if (seleccionados.length > 10 || seleccionados.some((file) => !esExcel(file) || file.size > MAX_MB * 1024 * 1024)) {
      notificar?.("warn", "Archivos no válidos", `Elegí hasta 10 archivos .xls/.xlsx de ${MAX_MB} MB como máximo cada uno.`);
      return;
    }
    setSubiendo(true);
    try {
      const nuevos = await subirPlanillasRegistroInscriptos(curso.id, seleccionados);
      setArchivos((actuales) => [...actuales, ...nuevos]);
      await cargarGlobal();
      notificar?.("success", "Planillas cargadas", `${nuevos.length} planilla${nuevos.length === 1 ? "" : "s"} cargada${nuevos.length === 1 ? "" : "s"} correctamente.`);
    } catch (error) {
      notificar?.("error", "No se pudieron subir las planillas", error.message);
    } finally {
      setSubiendo(false);
    }
  };

  const eliminar = (archivo) => confirmDialog({
    header: "Eliminar planilla",
    message: "Los validadores dejarán de tener acceso a este archivo.",
    acceptLabel: "Eliminar",
    rejectLabel: "Cancelar",
    acceptClassName: styles.peligro,
    accept: async () => {
      try {
        await eliminarPlanillaRegistroInscriptos(curso.id, archivo.archivoId);
        setArchivos((xs) => xs.filter((x) => x.archivoId !== archivo.archivoId));
        await cargarGlobal();
        notificar?.("success", "Planilla eliminada", "El archivo ya no está disponible para validadores.");
      } catch (error) {
        notificar?.("error", "No se pudo eliminar la planilla", error.message);
      }
    },
  });

  const descargar = async (archivo) => {
    setDescargando(archivo.archivoId);
    try {
      await descargarPlanillaRegistroInscriptosAdmin(curso.id, archivo);
    } catch (error) {
      notificar?.("error", "No se pudo descargar la planilla", error.message);
    } finally {
      setDescargando("");
    }
  };

  const dialogHeader = <div className={styles.dialogHeader}>
    <span>GESTIÓN DE PLANILLAS</span>
    <strong>{curso?.titulo || "Capacitación"}</strong>
    <small>Planillas de inscriptos</small>
  </div>;

  const dialogFooter = <div className={styles.dialogFooter}>
    <button type="button" className={styles.secundario} onClick={cerrarModalPlanillas} disabled={subiendo}>Cerrar</button>
  </div>;

  return <section className={styles.contenedor}>
    <ConfirmDialog />
    <h2>Registro Inscriptos</h2>
    <p>Adjuntá las planillas de inscripción correspondientes a cada capacitación. Los validadores autorizados podrán descargarlas desde Gestión de certificados.</p>

    <section className={styles.globalPanel}>
      <div className={styles.globalHeader}>
        <div><h3>Cursos con planillas cargadas</h3><p>Capacitaciones que actualmente tienen archivos de inscripción disponibles.</p></div>
        <button type="button" className={styles.secundario} onClick={cargarGlobal} disabled={cargandoGlobal}>Actualizar</button>
      </div>
      {cargandoGlobal ? <p>Cargando cursos con planillas…</p> : errorGlobal ? <div className={styles.estadoError}><p>{errorGlobal}</p><button type="button" className={styles.secundario} onClick={cargarGlobal}>Reintentar</button></div> : cursosConPlanillas.length === 0 ? <p className={styles.vacio}>Todavía no hay cursos con planillas cargadas.</p> : <div className={styles.cursosGrid}>{cursosConPlanillas.map((item) => { const cantidad = Number(item.cantidadArchivos || item.archivos?.length || 0); return <article className={styles.cursoCard} key={item.cursoId}><div><h4>{item.titulo}</h4><p>{cantidad} planilla{cantidad === 1 ? "" : "s"} cargada{cantidad === 1 ? "" : "s"}</p></div><button type="button" className={styles.primario} onClick={() => abrirModalPlanillas({ id: item.cursoId, titulo: item.titulo })}>Ver planillas</button></article>; })}</div>}
    </section>

    <div className={styles.selector}><SelectorCurso cursoSeleccionado={curso} onSeleccionar={abrirModalPlanillas} deshabilitado={subiendo} /></div>

    <Dialog
      visible={modalPlanillasVisible}
      onHide={cerrarModalPlanillas}
      modal
      header={dialogHeader}
      footer={dialogFooter}
      className={styles.dialogPlanillas}
      contentClassName={styles.dialogContenido}
      draggable={false}
      resizable={false}
    >
      <div className={styles.dialogAcciones}>
        <label className={styles.primario}><input type="file" accept=".xls,.xlsx" multiple onChange={subir} disabled={subiendo} />{subiendo ? "Subiendo…" : "+ Adjuntar planilla Excel"}</label>
      </div>
      {cargando ? <p>Cargando planillas…</p> : archivos.length === 0 ? <p className={styles.vacio}>No hay planillas cargadas para esta capacitación.</p> : <div className={styles.lista}>{archivos.map((archivo) => <article className={styles.archivo} key={archivo.archivoId}><div><strong>{archivo.nombreOriginal}</strong><span>Subido: {fecha(archivo.subidoEn)} · {tamano(Number(archivo.size || 0))}</span></div><div className={styles.acciones}><button type="button" className={styles.secundario} disabled={Boolean(descargando)} onClick={() => descargar(archivo)}>{descargando === archivo.archivoId ? "Descargando…" : "Descargar"}</button><button type="button" className={styles.peligro} onClick={() => eliminar(archivo)}>Eliminar</button></div></article>)}</div>}
    </Dialog>
  </section>;
};

export default RegistroInscriptos;
