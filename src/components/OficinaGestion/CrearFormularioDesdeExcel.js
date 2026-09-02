import React, { useMemo, useState } from "react";
import { Button } from "primereact/button";
import { Checkbox } from "primereact/checkbox";
import { Dropdown } from "primereact/dropdown";
import { InputText } from "primereact/inputtext";
import { InputTextarea } from "primereact/inputtextarea";
import { Message } from "primereact/message";
import { Dialog } from "primereact/dialog";
import { ProgressSpinner } from "primereact/progressspinner";
import { Toast } from "primereact/toast";
import { useRef } from "react";
import { addDoc, collection, getDocs, query, serverTimestamp, where } from "firebase/firestore";
import { db } from "../../firebase/firebase-config";
import styles from "../../pages/Admin/OficinaGestion/OficinaGestionAdmin.module.css";
import {
  detectarColumnaAgrupacion,
  inferirTipoCampo,
  leerEstructuraExcel,
  TIPOS_CAMPO_EXCEL,
} from "../../services/excelFormularioService";
import {
  COLOR_INICIAL_NO,
  COLOR_INICIAL_SI,
  MODO_COLOR,
  OPCIONES_COLOR,
  OPCIONES_MODO_COLOR,
  construirConfiguracionSello,
  construirConfiguracionTarjeta,
} from "../../services/configuracionVisualService";

const opcionesTipo = [
  { label: "Dato de persona", value: TIPOS_CAMPO_EXCEL.DATO_PERSONA },
  { label: "Detalle", value: TIPOS_CAMPO_EXCEL.DETALLE },
];

const normalizarTituloFormulario = (valor) =>
  String(valor || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();

const convertirFechaFormulario = (valor) => {
  if (!valor) return null;
  if (typeof valor.toDate === "function") return valor.toDate();
  const fecha = new Date(valor);
  return Number.isNaN(fecha.getTime()) ? null : fecha;
};

const formatearFechaFormulario = (valor, id) => {
  const fecha = convertirFechaFormulario(valor);
  if (!fecha) return `ID: ${String(id || "").slice(0, 6).toUpperCase()}`;
  return fecha.toLocaleString("es-AR", { dateStyle: "short", timeStyle: "short" });
};

const CrearFormularioDesdeExcel = ({ onCreated, onCancel }) => {
  const toast = useRef(null);
  const inputRef = useRef(null);
  const [titulo, setTitulo] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [estructura, setEstructura] = useState(null);
  const [seleccionadas, setSeleccionadas] = useState([]);
  const [agrupador, setAgrupador] = useState(null);
  const [guardando, setGuardando] = useState(false);
  const [creado, setCreado] = useState(null);
  const [duplicados, setDuplicados] = useState(null);

  // Cada campo puede aportar su propia regla. Las reglas se guardan en el
  // formulario y nunca en las respuestas ya importadas.
  const [reglasCampos, setReglasCampos] = useState([]);
  const [selloHabilitado, setSelloHabilitado] = useState(false);
  const [textosSello, setTextosSello] = useState({
    verde: "",
    amarillo: "",
    rojo: "",
  });

  const columnasConfiguradas = useMemo(
    () =>
      [...seleccionadas]
        .sort((a, b) => Number(a.orden || 0) - Number(b.orden || 0))
        .map((columna, index) => ({
        ...columna,
        orden: index,
        tipo:
          columna.key === agrupador?.key
            ? TIPOS_CAMPO_EXCEL.IDENTIFICADOR
            : columna.tipo || inferirTipoCampo(columna, agrupador?.key),
        })),
    [seleccionadas, agrupador]
  );

  const seleccionarArchivo = async (file) => {
    if (!file) return;
    try {
      const resultado = await leerEstructuraExcel(file);
      const agrupadorDetectado = detectarColumnaAgrupacion(resultado.columnas);
      const iniciales = resultado.columnas.map((columna) => ({
        ...columna,
        seleccionada: true,
        tipo: inferirTipoCampo(columna, agrupadorDetectado?.key),
      }));
      setEstructura(resultado);
      setAgrupador(agrupadorDetectado);
      setSeleccionadas(iniciales);
      toast.current?.show({
        severity: "success",
        summary: "Excel analizado",
        detail: `Se detectaron ${resultado.columnas.length} columnas y ${resultado.filas.length} filas.`,
        life: 3500,
      });
    } catch (error) {
      setEstructura(null);
      setSeleccionadas([]);
      toast.current?.show({
        severity: "error",
        summary: "No se pudo leer el Excel",
        detail: error.message || "Revise el archivo seleccionado.",
        life: 5000,
      });
    }
  };

  const alternarColumna = (columna, checked) => {
    if (columna.key === agrupador?.key && !checked) return;
    setSeleccionadas((actuales) => {
      if (checked) {
        if (actuales.some((item) => item.key === columna.key)) return actuales;
        return [
          ...actuales,
          {
            ...columna,
            seleccionada: true,
            tipo: inferirTipoCampo(columna, agrupador?.key),
          },
        ];
      }
      return actuales.filter((item) => item.key !== columna.key);
    });
  };

  const seleccionarTodas = () => {
    setSeleccionadas(
      (estructura?.columnas || []).map((columna) => ({
        ...columna,
        seleccionada: true,
        tipo: inferirTipoCampo(columna, agrupador?.key),
      }))
    );
  };

  const deseleccionarOpcionales = () => {
    setSeleccionadas((actuales) =>
      actuales.filter((columna) => columna.key === agrupador?.key)
    );
  };

  const cambiarTipo = (key, tipo) => {
    setSeleccionadas((actuales) =>
      actuales.map((columna) =>
        columna.key === key ? { ...columna, tipo } : columna
      )
    );
  };

  /**
   * Asigna (o quita) la regla de color a una columna.
   *
   * Sólo puede haber un campo de color por formulario. Si ya hay otro
   * configurado, se pide confirmación antes de reemplazarlo en lugar de
   * cambiarlo en silencio.
   */
  const cambiarModoColor = (columna, modo) => {
    setReglasCampos((actuales) => {
      const anterior = actuales.find((regla) => regla.campoKey === columna.key);
      const sinEstaColumna = actuales.filter((regla) => regla.campoKey !== columna.key);
      if (!modo || modo === MODO_COLOR.SIN_COLOR) return sinEstaColumna;

      if (modo === MODO_COLOR.SEMAFORO_SI_NO) {
        return [...sinEstaColumna, {
          campoKey: columna.key,
          campoLabel: columna.label,
          modo,
          reglas: {
            si: anterior?.reglas?.si || COLOR_INICIAL_SI,
            no: anterior?.reglas?.no || COLOR_INICIAL_NO,
          },
        }];
      }

      return [...sinEstaColumna, {
        campoKey: columna.key,
        campoLabel: columna.label,
        modo: MODO_COLOR.COLOR_SI_TIENE_VALOR,
        color: modo,
      }];
    });
  };

  const reglaColorDeColumna = (columna) =>
    reglasCampos.find((regla) => regla.campoKey === columna.key);

  /** Modo que muestra el desplegable de una columna. */
  const modoColorDeColumna = (columna) => {
    const regla = reglaColorDeColumna(columna);
    if (!regla) return MODO_COLOR.SIN_COLOR;
    return regla.modo === MODO_COLOR.COLOR_SI_TIENE_VALOR ? regla.color : regla.modo;
  };

  const cambiarColorSemaforo = (columna, valor, color) => {
    setReglasCampos((actuales) => actuales.map((regla) =>
      regla.campoKey === columna.key
        ? { ...regla, reglas: { ...regla.reglas, [valor]: color } }
        : regla
    ));
  };

  const cambiarAgrupador = (columna) => {
    setAgrupador(columna);
    setSeleccionadas((actuales) => {
      const actualizadas = actuales.map((item) => ({
        ...item,
        tipo: inferirTipoCampo(item, columna?.key),
      }));
      if (actualizadas.some((item) => item.key === columna?.key)) {
        return actualizadas;
      }
      return [
        ...actualizadas,
        {
          ...columna,
          seleccionada: true,
          tipo: TIPOS_CAMPO_EXCEL.IDENTIFICADOR,
        },
      ];
    });
  };

  const buscarFormulariosDuplicados = async () => {
    const snap = await getDocs(
      query(
        collection(db, "oficina_gestion_formularios"),
        where("tipoFormulario", "==", "consulta_excel_agrupada")
      )
    );
    const tituloNormalizado = normalizarTituloFormulario(titulo);
    const coincidencias = snap.docs
      .map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }))
      .filter((formulario) => normalizarTituloFormulario(formulario.titulo) === tituloNormalizado);

    return Promise.all(
      coincidencias.map(async (formulario) => {
        const respuestas = await getDocs(
          query(
            collection(db, "oficina_gestion_respuestas"),
            where("formularioId", "==", formulario.id)
          )
        );
        return { ...formulario, tieneDatosImportados: !respuestas.empty };
      })
    );
  };

  const guardarFormulario = async () => {
    if (!titulo.trim() || !estructura || !agrupador || columnasConfiguradas.length === 0) {
      toast.current?.show({
        severity: "warn",
        summary: "Datos incompletos",
        detail: "Complete el título, seleccione un Excel, un identificador y al menos una columna.",
        life: 4500,
      });
      return;
    }

    setGuardando(true);
    try {
      const ref = await addDoc(collection(db, "oficina_gestion_formularios"), {
        titulo: titulo.trim(),
        descripcion: descripcion.trim(),
        descripcionHtml: descripcion.trim(),
        activo: true,
        publicado: false,
        tipoFormulario: "consulta_excel_agrupada",
        tipoRespuesta: "excel_agrupada",
        soloConsultaDni: true,
        modoSoloConsultaDni: true,
        bloquearCargaRespuestas: true,
        modoEdicionPorDni: false,
        requiereValidacionDni: true,
        permitirMultiplesRespuestasPorDni: false,
        configuracionExcel: {
          habilitado: true,
          columnaAgrupacion: {
            key: agrupador.key,
            label: agrupador.label,
            sourceHeader: agrupador.sourceHeader || agrupador.label,
            index: agrupador.index,
          },
          camposSeleccionados: columnasConfiguradas,
          nombreArchivoOrigen: estructura.nombreArchivo,
          hojaOrigen: estructura.hoja,
        },
        // Presentación, separada de la estructura de datos: se puede cambiar
        // después sin reimportar el Excel ni tocar una sola respuesta.
        configuracionVisual: {
          tarjeta: construirConfiguracionTarjeta({
            reglasCampos,
          }),
          detalle: {
            selloEstado: construirConfiguracionSello({
              habilitado: selloHabilitado,
              textos: textosSello,
            }),
          },
        },
        campos: columnasConfiguradas.map((campo) => ({
          id: campo.key,
          key: campo.key,
          label: campo.label,
          tipo: "texto",
          orden: campo.orden,
          obligatorio: false,
          excelTipo: campo.tipo,
        })),
        cantidadCampos: columnasConfiguradas.length,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      const formulario = { id: ref.id, titulo: titulo.trim(), tipoFormulario: "consulta_excel_agrupada" };
      setCreado(formulario);
    } catch (error) {
      toast.current?.show({
        severity: "error",
        summary: "No se pudo crear el formulario",
        detail: error.message || "Intente nuevamente.",
        life: 5000,
      });
    } finally {
      setGuardando(false);
    }
  };

  const crearFormulario = async () => {
    if (!titulo.trim() || !estructura || !agrupador || columnasConfiguradas.length === 0) {
      toast.current?.show({
        severity: "warn",
        summary: "Datos incompletos",
        detail: "Complete el título, seleccione un Excel, un identificador y al menos una columna.",
        life: 4500,
      });
      return;
    }

    setGuardando(true);
    try {
      const coincidencias = await buscarFormulariosDuplicados();
      if (coincidencias.length > 0) {
        setDuplicados(coincidencias);
        return;
      }
    } catch (error) {
      toast.current?.show({
        severity: "error",
        summary: "No se pudo verificar duplicados",
        detail: error.message || "Intente nuevamente.",
        life: 5000,
      });
      return;
    } finally {
      setGuardando(false);
    }

    await guardarFormulario();
  };

  const crearOtroFormulario = () => {
    setCreado(null);
    setTitulo("");
    setDescripcion("");
    setEstructura(null);
    setSeleccionadas([]);
    setAgrupador(null);
    setReglasCampos([]);
    setSelloHabilitado(false);
    setTextosSello({ verde: "", amarillo: "", rojo: "" });
    if (inputRef.current) inputRef.current.value = "";
  };

  if (creado) {
    return (
      <div className={styles.successCard}>
        <i className="pi pi-check-circle" />
        <h2>Formulario creado correctamente</h2>
        <p>Ahora podés importar la información agrupada por {agrupador?.label}.</p>
        <div className={styles.successActions}>
          <Button label="Importar información" icon="pi pi-upload" severity="success" onClick={() => onCreated?.(creado)} />
          <Button label="Crear otro" icon="pi pi-plus" outlined onClick={crearOtroFormulario} />
        </div>
      </div>
    );
  }

  return (
    <div className={styles.formWrapper}>
      <Toast ref={toast} />
      <div className={styles.sectionTitle}>
        <div>
          <h2>Crear formulario desde Excel</h2>
          <p>Definí la estructura primero. Los datos se importan en un segundo paso, después de confirmar la previsualización.</p>
        </div>
        {onCancel && <Button label="Volver a creación manual" icon="pi pi-arrow-left" outlined onClick={onCancel} />}
      </div>

      <div className={styles.formGrid}>
        <div className={styles.formRow}>
          <label htmlFor="excelTitulo">Título del formulario</label>
          <InputText id="excelTitulo" value={titulo} onChange={(event) => setTitulo(event.target.value)} placeholder="Ej.: Titularización 2026" />
        </div>
        <div className={styles.formRow}>
          <label htmlFor="excelDescripcion">Descripción</label>
          <InputTextarea id="excelDescripcion" value={descripcion} onChange={(event) => setDescripcion(event.target.value)} rows={3} autoResize placeholder="Información visible para la consulta pública" />
        </div>
      </div>

      <div className={styles.actions}>
        <input ref={inputRef} type="file" accept=".xlsx,.xls" hidden onChange={(event) => seleccionarArchivo(event.target.files?.[0])} />
        <Button label="Seleccionar Excel" icon="pi pi-file-excel" severity="success" onClick={() => inputRef.current?.click()} />
      </div>

      {estructura && (
        <>
          <Message severity="info" text={`Archivo: ${estructura.nombreArchivo} · Hoja: ${estructura.hoja} · ${estructura.columnas.length} columnas · ${estructura.filas.length} filas`} />
          {estructura.encabezadosDuplicados?.length > 0 && (
            <Message severity="warn" text={`Se detectaron encabezados duplicados. Se generaron claves internas únicas para conservar todos los campos.`} />
          )}
          <div className={styles.formRow}>
            <label>Campo identificador / agrupador</label>
            <Dropdown value={agrupador} options={estructura.columnas} optionLabel="label" onChange={(event) => cambiarAgrupador(event.value)} placeholder="Seleccione un campo" />
          </div>
          <div className={styles.manageActions}>
            <Button label="Seleccionar todos" icon="pi pi-check-square" outlined onClick={seleccionarTodas} />
            <Button label="Deseleccionar opcionales" icon="pi pi-minus-circle" outlined onClick={deseleccionarOpcionales} />
            <span>{seleccionadas.length} de {estructura.columnas.length} columnas seleccionadas</span>
          </div>
          <div className={styles.respuestasList}>
            {estructura.columnas.map((columna) => {
              const activa = seleccionadas.find((item) => item.key === columna.key);
              const esAgrupador = columna.key === agrupador?.key;
              return (
                <div className={styles.respuestaCard} key={columna.key}>
                  <div className={styles.manageActions}>
                    <Checkbox inputId={`col-${columna.key}`} checked={Boolean(activa)} onChange={(event) => alternarColumna(columna, event.checked)} disabled={esAgrupador} />
                    <label htmlFor={`col-${columna.key}`}><strong>{columna.label}</strong>{esAgrupador && " · Campo identificador"}</label>
                  </div>
                  {activa && !esAgrupador && (
                    <div className={styles.campoOpciones}>
                      <label className={styles.campoOpcion}>
                        <span>Tipo</span>
                        <Dropdown value={activa.tipo} options={opcionesTipo} onChange={(event) => cambiarTipo(columna.key, event.value)} />
                      </label>

                      <label className={styles.campoOpcion}>
                        <span>Color de tarjeta</span>
                        <Dropdown
                          value={modoColorDeColumna(columna)}
                          options={OPCIONES_MODO_COLOR}
                          onChange={(event) => cambiarModoColor(columna, event.value)}
                        />
                      </label>

                      {/* Sólo el semáforo necesita elegir un color por valor;
                          el modo amarillo pinta todo el formulario igual. */}
                      {modoColorDeColumna(columna) === MODO_COLOR.SEMAFORO_SI_NO && (
                        <>
                          <label className={styles.campoOpcion}>
                            <span>Valor SI</span>
                            <Dropdown value={reglaColorDeColumna(columna)?.reglas?.si || COLOR_INICIAL_SI} options={OPCIONES_COLOR} onChange={(event) => cambiarColorSemaforo(columna, "si", event.value)} />
                          </label>

                          <label className={styles.campoOpcion}>
                            <span>Valor NO</span>
                            <Dropdown value={reglaColorDeColumna(columna)?.reglas?.no || COLOR_INICIAL_NO} options={OPCIONES_COLOR} onChange={(event) => cambiarColorSemaforo(columna, "no", event.value)} />
                          </label>
                        </>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          <div className={styles.respuestaCard}>
            <strong>Sello en el detalle</strong>
            <p>Se muestra según el color final de las reglas configuradas.</p>
            <div className={styles.manageActions}>
              <Checkbox
                inputId="sello-estado"
                checked={selloHabilitado}
                onChange={(event) => setSelloHabilitado(Boolean(event.checked))}
              />
              <label htmlFor="sello-estado">Mostrar sello de estado</label>
            </div>
            {selloHabilitado && (
              <div className={styles.campoOpciones}>
                <label className={styles.campoOpcion}>
                  <span>Texto para verde</span>
                  <InputText
                    value={textosSello.verde}
                    onChange={(event) => setTextosSello((actual) => ({ ...actual, verde: event.target.value }))}
                  />
                </label>
                <label className={styles.campoOpcion}>
                  <span>Texto para amarillo</span>
                  <InputText
                    value={textosSello.amarillo}
                    onChange={(event) => setTextosSello((actual) => ({ ...actual, amarillo: event.target.value }))}
                  />
                </label>
                <label className={styles.campoOpcion}>
                  <span>Texto para rojo</span>
                  <InputTextarea
                    value={textosSello.rojo}
                    rows={2}
                    autoResize
                    onChange={(event) => setTextosSello((actual) => ({ ...actual, rojo: event.target.value }))}
                  />
                </label>
              </div>
            )}
          </div>
          <div className={styles.actions}>
            <Button label="Crear formulario" icon="pi pi-save" severity="success" onClick={crearFormulario} loading={guardando} disabled={guardando || !titulo.trim()} />
          </div>
        </>
      )}

      {guardando && <ProgressSpinner />}

      <Dialog
        header="Formulario Excel existente"
        visible={Boolean(duplicados)}
        modal
        style={{ width: "620px", maxWidth: "95vw" }}
        onHide={() => setDuplicados(null)}
      >
        <Message
          severity="warn"
          text="Ya existe un formulario Excel con este título. Podés cancelar o crear uno nuevo igualmente."
        />
        <div className={styles.respuestasList}>
          {(duplicados || []).map((formulario) => (
            <div className={styles.respuestaCard} key={formulario.id}>
              <strong>{formulario.titulo || "Formulario sin título"}</strong>
              <small>Creado: {formatearFechaFormulario(formulario.createdAt, formulario.id)}</small>
              <small>Cantidad de campos: {formulario.cantidadCampos || formulario.campos?.length || 0}</small>
              <small>Identificador: {formulario.configuracionExcel?.columnaAgrupacion?.label || "Sin configurar"}</small>
              <small>{formulario.tieneDatosImportados ? "Con información importada" : "Sin información importada"}</small>
              <small>ID: {formulario.id}</small>
            </div>
          ))}
        </div>
        <div className={styles.actions}>
          <Button label="Cancelar" outlined onClick={() => setDuplicados(null)} />
          <Button
            label="Crear igualmente"
            severity="success"
            icon="pi pi-check"
            onClick={() => {
              setDuplicados(null);
              guardarFormulario();
            }}
          />
        </div>
      </Dialog>
    </div>
  );
};

export default CrearFormularioDesdeExcel;
