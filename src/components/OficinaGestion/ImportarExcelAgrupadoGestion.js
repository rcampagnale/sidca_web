import React, { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "primereact/button";
import { Dropdown } from "primereact/dropdown";
import { Message } from "primereact/message";
import { ProgressBar } from "primereact/progressbar";
import { Toast } from "primereact/toast";
import { collection, doc, getDoc, getDocs, query, serverTimestamp, where, writeBatch } from "firebase/firestore";
import { db } from "../../firebase/firebase-config";
import styles from "../../pages/Admin/OficinaGestion/OficinaGestionAdmin.module.css";
import {
  agruparFilasPorIdentificador,
  crearIdRespuestaAgrupada,
  generarPreviewImportacion,
  leerEstructuraExcel,
  normalizarFilasExcel,
  resolverHeader,
  transformarGrupoAFirestore,
} from "../../services/excelFormularioService";
import {
  camposAfiliacionParaRespuesta,
  resumirVerificacion,
  verificarAfiliacionesPorDni,
} from "../../services/verificacionAfiliacionService";

const TAMANO_BATCH = 400;

const convertirFechaFormulario = (valor) => {
  if (!valor) return null;
  if (typeof valor.toDate === "function") return valor.toDate();
  const fecha = new Date(valor);
  return Number.isNaN(fecha.getTime()) ? null : fecha;
};

const ordenarPorFechaCreacion = (a, b) => {
  const fechaA = convertirFechaFormulario(a.createdAt)?.getTime() || 0;
  const fechaB = convertirFechaFormulario(b.createdAt)?.getTime() || 0;
  return fechaB - fechaA;
};

const etiquetaFormularioExcel = (formulario) => {
  const fecha = convertirFechaFormulario(formulario.createdAt);
  const fechaTexto = fecha
    ? fecha.toLocaleString("es-AR", { dateStyle: "short", timeStyle: "short" })
    : `ID: ${String(formulario.id || "").slice(0, 6).toUpperCase()}`;
  const estado = formulario.tieneDatosImportados ? "Con datos importados" : "Sin importar";
  return `${formulario.titulo || "Formulario sin título"} — ${fechaTexto} · ${estado}`;
};

const ImportarExcelAgrupadoGestion = ({ formularioInicialId }) => {
  const toast = useRef(null);
  const inputRef = useRef(null);
  const [formularios, setFormularios] = useState([]);
  const [formularioId, setFormularioId] = useState(formularioInicialId || null);
  const [estructura, setEstructura] = useState(null);
  const [preview, setPreview] = useState(null);
  // Map DNI normalizado -> verificación. Se resuelve UNA vez al analizar y se
  // reutiliza al confirmar: no se vuelve a consultar el padrón al importar.
  const [verificaciones, setVerificaciones] = useState(() => new Map());
  const [analizando, setAnalizando] = useState(false);
  const [importando, setImportando] = useState(false);
  const [progreso, setProgreso] = useState(0);
  const [resultado, setResultado] = useState(null);

  const cargarFormularios = async () => {
    try {
      const snap = await getDocs(query(collection(db, "oficina_gestion_formularios")));
      const candidatos = snap.docs
        .map((item) => ({ id: item.id, ...item.data() }))
        .filter((item) => item.tipoFormulario === "consulta_excel_agrupada" || item.configuracionExcel?.habilitado);
      const agrupados = await Promise.all(
        candidatos.map(async (item) => {
          const respuestas = await getDocs(
            query(
              collection(db, "oficina_gestion_respuestas"),
              where("formularioId", "==", item.id)
            )
          );
          return { ...item, tieneDatosImportados: !respuestas.empty };
        })
      );
      agrupados.sort(ordenarPorFechaCreacion);
      setFormularios(agrupados);
      setFormularioId((actual) => actual || formularioInicialId || agrupados[0]?.id || null);
    } catch (error) {
      toast.current?.show({ severity: "error", summary: "Error", detail: "No se pudieron cargar los formularios Excel.", life: 4000 });
    }
  };

  useEffect(() => {
    cargarFormularios();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formularioInicialId]);

  const formulario = useMemo(() => formularios.find((item) => item.id === formularioId), [formularios, formularioId]);

  const contarExistentes = async (referencias) => {
    const estados = await Promise.all(
      referencias.map(({ ref }) => getDoc(ref))
    );
    return estados.map((snap) => snap.exists());
  };

  const analizarArchivo = async (file) => {
    if (!file || !formulario) return;
    setPreview(null);
    setResultado(null);
    setVerificaciones(new Map());
    setAnalizando(true);
    try {
      const configuracion = formulario.configuracionExcel || {};
      const estructuraLeida = await leerEstructuraExcel(file);
      const seleccionadas = configuracion.camposSeleccionados || [];
      const campoIdentificador = configuracion.columnaAgrupacion || {};
      const columnaIdentificador = resolverHeader(campoIdentificador, estructuraLeida.columnas);
      const mapeo = normalizarFilasExcel(
        estructuraLeida.filas,
        seleccionadas,
        estructuraLeida.columnas
      );
      const { filas, faltantes } = mapeo;
      const columnasPorConfig = mapeo.correspondencias
        .map(({ columna }) => columna)
        .filter(Boolean);
      const seleccionadasConTotal = [...seleccionadas];
      seleccionadasConTotal.__total = estructuraLeida.columnas.length;
      const diagnostico = {
        campoIdentificador: campoIdentificador.label || campoIdentificador.key || "Sin configurar",
        columnaEncontrada: columnaIdentificador?.sourceHeader || columnaIdentificador?.label || "",
      };

      if (!columnaIdentificador) {
        const resumenSinIdentificador = generarPreviewImportacion({
          grupos: new Map(),
          filasSinIdentificador: [],
          identificadoresInvalidos: [],
          columnasSeleccionadas: seleccionadasConTotal,
          totalFilas: filas.length,
        });
        setEstructura({
          ...estructuraLeida,
          filas: [],
          faltantes,
          columnasUtilizadas: columnasPorConfig,
          columnaIdentificadorResuelta: null,
        });
        setPreview({
          ...resumenSinIdentificador,
          filasProcesables: 0,
          identificadoresUnicos: 0,
          personasUnaFila: 0,
          personasMultiplesFilas: 0,
          maximoRegistros: 0,
          filasSinIdentificador: 0,
          identificadoresInvalidos: 0,
          faltantes,
          identificadorNoEncontrado: true,
          ...diagnostico,
        });
        return;
      }

      const agrupacion = agruparFilasPorIdentificador(filas, configuracion);
      const resumen = generarPreviewImportacion({
        ...agrupacion,
        columnasSeleccionadas: seleccionadasConTotal,
        totalFilas: filas.length,
      });

      // Verificación de afiliación sobre los DNI ÚNICOS ya agrupados: la
      // persona con 12 cargos se consulta una sola vez, igual que la de uno.
      const dnisUnicos = [...agrupacion.grupos.keys()];
      let verificacionesAfiliacion = new Map();
      let errorAfiliacion = "";

      try {
        verificacionesAfiliacion = await verificarAfiliacionesPorDni(dnisUnicos);
      } catch (fallo) {
        // No se convierte el fallo en "no afiliado". Se avisa y se deja el
        // dato sin escribir: la importación sigue siendo válida y la
        // afiliación puede resolverse después con "Verificar afiliación".
        errorAfiliacion =
          fallo?.message || "No se pudo verificar la afiliación contra el padrón.";
      }

      const resumenAfiliacion = resumirVerificacion(dnisUnicos, verificacionesAfiliacion);

      setVerificaciones(verificacionesAfiliacion);
      setEstructura({
        ...estructuraLeida,
        filas,
        faltantes,
        columnasUtilizadas: columnasPorConfig,
        columnaIdentificadorResuelta: columnaIdentificador,
      });
      setPreview({
        ...resumen,
        faltantes,
        ...diagnostico,
        identificadorNoEncontrado: false,
        afiliacion: resumenAfiliacion,
        errorAfiliacion,
      });
    } catch (error) {
      toast.current?.show({ severity: "error", summary: "No se pudo analizar el archivo", detail: error.message || "Revise el Excel.", life: 5000 });
    } finally {
      setAnalizando(false);
    }
  };

  const importar = async () => {
    if (!formulario || !estructura || !preview) return;
    setImportando(true);
    setProgreso(0);
    let nuevos = 0;
    let actualizados = 0;
    let errores = 0;
    const configuracion = formulario.configuracionExcel || {};
    const agrupacion = agruparFilasPorIdentificador(estructura.filas, configuracion);
    const grupos = Array.from(agrupacion.grupos.entries());
    try {
      for (let inicio = 0; inicio < grupos.length; inicio += TAMANO_BATCH) {
        const lote = grupos.slice(inicio, inicio + TAMANO_BATCH);
        const batch = writeBatch(db);
        const referencias = lote.map(([identificador, filas]) => {
          const id = crearIdRespuestaAgrupada(formulario.id, identificador);
          const verificacion = verificaciones.get(identificador);

          // Sólo se escriben los campos de afiliación cuando hay una
          // verificación real para ese DNI. Si la verificación falló, no se
          // tocan: la respuesta queda SIN VERIFICAR, nunca marcada como no
          // afiliada por un problema de red.
          //
          // En una reimportación esto se recalcula y pisa el valor anterior,
          // que es lo correcto: una persona puede haberse afiliado después.
          const afiliacion = verificacion
            ? {
                ...camposAfiliacionParaRespuesta(verificacion),
                afiliacionVerificadaAt: serverTimestamp(),
              }
            : {};

          return {
            ref: doc(db, "oficina_gestion_respuestas", id),
            payload: {
              ...transformarGrupoAFirestore({ formulario, grupo: filas, identificador }),
              ...afiliacion,
            },
          };
        });
        const existentes = await contarExistentes(referencias);
        for (let indice = 0; indice < referencias.length; indice += 1) {
          if (existentes[indice]) {
            actualizados += 1;
          } else {
            nuevos += 1;
          }
          const { ref, payload } = referencias[indice];
          batch.set(
            ref,
            existentes[indice]
              ? { ...payload, updatedAt: serverTimestamp() }
              : { ...payload, createdAt: serverTimestamp(), updatedAt: serverTimestamp() },
            { merge: true }
          );
        }
        await batch.commit();
        setProgreso(Math.round(((inicio + lote.length) / grupos.length) * 100));
      }
      setResultado({ personas: grupos.length, nuevos, actualizados, errores });
      toast.current?.show({ severity: "success", summary: "Importación completada", detail: `${grupos.length} personas procesadas correctamente.`, life: 5000 });
    } catch (error) {
      errores += 1;
      setResultado({ personas: nuevos + actualizados, nuevos, actualizados, errores });
      toast.current?.show({ severity: "error", summary: "Importación incompleta", detail: error.message || "No se pudo completar la importación.", life: 6000 });
    } finally {
      setImportando(false);
    }
  };

  return (
    <div className={styles.formWrapper}>
      <Toast ref={toast} />
      <div className={styles.sectionTitle}>
        <div>
          <h2>Importar información agrupada</h2>
          <p>Seleccioná un formulario creado desde Excel y cargá una sola persona por identificador, con todos sus registros asociados.</p>
        </div>
        <Button label="Actualizar" icon="pi pi-refresh" outlined onClick={cargarFormularios} />
      </div>

      {formularios.length === 0 ? (
        <Message severity="info" text="Todavía no hay formularios creados desde Excel." />
      ) : (
        <>
          <div className={styles.formRow}>
            <label>Formulario Excel</label>
            <Dropdown value={formularioId} options={formularios.map((item) => ({ label: etiquetaFormularioExcel(item), value: item.id }))} onChange={(event) => { setFormularioId(event.value); setPreview(null); setEstructura(null); setVerificaciones(new Map()); }} placeholder="Seleccione un formulario" filter />
          </div>
          <input ref={inputRef} type="file" accept=".xlsx,.xls" hidden onChange={(event) => analizarArchivo(event.target.files?.[0])} />
          <div className={styles.excelSelectActions}>
            <Button label="Seleccionar Excel" icon="pi pi-file-excel" severity="success" onClick={() => inputRef.current?.click()} disabled={!formulario || analizando || importando} />
          </div>
        </>
      )}

      {analizando && <div className={styles.loadingBox}><ProgressBar mode="indeterminate" /><span>Analizando archivo...</span></div>}

      {preview && estructura && (
        <section className={`${styles.selectedInfo} ${styles.excelImportPreview}`}>
          <div className={styles.excelPreviewHeader}>
            <div>
              <span className={styles.excelPreviewEyebrow}>Archivo analizado</span>
              <h3>Previsualización antes de importar</h3>
              <p>Revisá el resumen y la columna identificadora antes de confirmar la importación.</p>
            </div>
            <span className={styles.excelPreviewStatus}>Listo para revisar</span>
          </div>

          <div className={`${styles.metaGrid} ${styles.excelPreviewMetrics}`}>
            <div className={styles.metaItem}><span>Filas procesables</span><strong>{preview.filasProcesables}</strong></div>
            <div className={styles.metaItem}><span>Identificadores únicos</span><strong>{preview.identificadoresUnicos}</strong></div>
            <div className={styles.metaItem}><span>Afiliados</span><strong>{preview.afiliacion?.afiliados ?? 0}</strong></div>
            <div className={styles.metaItem}><span>No afiliados</span><strong>{preview.afiliacion?.noAfiliados ?? 0}</strong></div>
            <div className={styles.metaItem}><span>Sin verificar</span><strong>{preview.afiliacion?.sinVerificar ?? 0}</strong></div>
            <div className={styles.metaItem}><span>Personas con 1 registro</span><strong>{preview.personasUnaFila}</strong></div>
            <div className={styles.metaItem}><span>Personas con múltiples registros</span><strong>{preview.personasMultiplesFilas}</strong></div>
            <div className={styles.metaItem}><span>Mayor cantidad por persona</span><strong>{preview.maximoRegistros}</strong></div>
            <div className={styles.metaItem}><span>Columnas utilizadas</span><strong>{preview.columnasUtilizadas}</strong></div>
            <div className={styles.metaItem}><span>Columnas ignoradas</span><strong>{preview.columnasIgnoradas}</strong></div>
            <div className={styles.metaItem}><span>Filas sin identificador / inválidos</span><strong>{preview.filasSinIdentificador} / {preview.identificadoresInvalidos}</strong></div>
          </div>
          <div className={`${styles.metaGrid} ${styles.excelPreviewMapping}`}>
            <div className={styles.metaItem}><span>Campo identificador</span><strong>{preview.campoIdentificador}</strong></div>
            <div className={styles.metaItem}><span>Columna encontrada en Excel</span><strong>{preview.columnaEncontrada || "No encontrada"}</strong></div>
          </div>
          <div className={styles.excelPreviewFeedback}>
            {preview.identificadorNoEncontrado && <Message severity="error" text={`No se encontró la columna correspondiente a ${preview.campoIdentificador} en el Excel. Revise el encabezado o la configuración del formulario.`} />}
          {preview.errorAfiliacion && <Message severity="warn" text={`No se pudo verificar la afiliación: ${preview.errorAfiliacion} Se puede importar igualmente; las personas quedarán como "Sin verificar" y podés resolverlo después con "Verificar afiliación".`} />}
          {!preview.errorAfiliacion && preview.afiliacion?.bajas > 0 && <Message severity="info" text={`De los ${preview.afiliacion.noAfiliados} no afiliados, ${preview.afiliacion.bajas} figuran en el padrón con baja (activo = false); el resto no aparece en usuarios ni en nuevoAfiliado.`} />}
            {preview.faltantes.length > 0 && <Message severity="warn" text={`Faltan ${preview.faltantes.length} columnas configuradas; se ignorarán en esta importación.`} />}
            {importando && <><ProgressBar value={progreso} /><p>Importando información... {progreso}%</p></>}
          </div>

          <div className={styles.excelPreviewActions}>
            <Button label="Cancelar" outlined onClick={() => { setPreview(null); setEstructura(null); setVerificaciones(new Map()); }} disabled={importando} />
            <Button label="Confirmar importación" icon="pi pi-check" severity="success" onClick={importar} loading={importando} disabled={importando || preview.identificadorNoEncontrado || preview.identificadoresUnicos === 0} />
          </div>
        </section>
      )}

      {resultado && <Message severity={resultado.errores ? "warn" : "success"} text={`Importación completada · ${resultado.personas} personas procesadas · Nuevos: ${resultado.nuevos} · Actualizados: ${resultado.actualizados} · Errores: ${resultado.errores}`} />}
    </div>
  );
};

export default ImportarExcelAgrupadoGestion;
