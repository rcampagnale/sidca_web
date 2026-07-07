// src/components/Servicios/ImportarAfiliadosServicio.js

import React, { useRef, useState } from "react";
import * as XLSX from "xlsx";
import { Button } from "primereact/button";
import { DataTable } from "primereact/datatable";
import { Column } from "primereact/column";
import styles from "./ImportarAfiliadosServicio.module.css";

const MESES = [
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

const normalizarDni = (valor) => {
  return String(valor || "").replace(/\D/g, "");
};

const limpiarTexto = (valor) => {
  return String(valor || "").trim().replace(/\s+/g, " ");
};

const limpiarTelefono = (valor) => {
  return String(valor || "").replace(/\D/g, "");
};

const normalizarClave = (valor) => {
  return String(valor || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
};

const pad2 = (valor) => String(valor).padStart(2, "0");

const sumarMesesPeriodo = (periodo, cantidadMeses) => {
  if (!periodo) return "";

  const [anio, mes] = periodo.split("-").map(Number);
  const fecha = new Date(anio, mes - 1 + cantidadMeses, 1);

  return `${fecha.getFullYear()}-${pad2(fecha.getMonth() + 1)}`;
};

const periodoTexto = (periodo) => {
  if (!periodo) return "-";

  const [anio, mes] = periodo.split("-").map(Number);
  if (!anio || !mes) return "-";

  return `${MESES[mes - 1]} ${anio}`;
};

const periodoCobroTexto = (periodo) => {
  return `A cobrar en ${periodoTexto(periodo)}`;
};

const obtenerValorFila = (fila, campos) => {
  for (const campo of campos) {
    if (fila[campo] !== undefined && fila[campo] !== null) {
      return fila[campo];
    }
  }

  return "";
};

const obtenerIndice = (encabezados, alternativas, soloExacto = false) => {
  const alternativasNormalizadas = alternativas.map(normalizarClave);

  const indiceExacto = encabezados.findIndex((encabezado) =>
    alternativasNormalizadas.includes(encabezado)
  );

  if (indiceExacto >= 0 || soloExacto) return indiceExacto;

  return encabezados.findIndex((encabezado) =>
    alternativasNormalizadas.some((alternativa) =>
      encabezado.includes(alternativa)
    )
  );
};

const obtenerValorPorIndice = (fila, indice) => {
  if (indice < 0) return "";
  return fila[indice] ?? "";
};

const filaEstaVacia = (fila) => {
  return !fila.some((celda) => limpiarTexto(celda));
};

const construirFilasDesdeMatriz = (matriz) => {
  const headerIndex = matriz.findIndex((fila) => {
    return fila.some((celda) => {
      const clave = normalizarClave(celda);
      return clave === "dni" || clave === "documento" || clave === "cuil";
    });
  });

  if (headerIndex < 0) {
    return {
      validas: [],
      invalidas: [
        {
          fila: "-",
          dni: "-",
          motivo:
            "No se encontró la fila de encabezados. El archivo debe tener una columna DNI.",
        },
      ],
    };
  }

  const encabezados = matriz[headerIndex].map(normalizarClave);

  const indices = {
    apellidoNombre: obtenerIndice(encabezados, [
      "apellido y nombre",
      "apellido nombre",
      "apellidoNombre",
      "nombre completo",
      "nombreCompleto",
    ]),
    apellido: obtenerIndice(encabezados, ["apellido", "apellidos"], true),
    nombre: obtenerIndice(encabezados, [
      "nombre (completos)",
      "nombre completo",
      "nombres",
      "nombre",
    ]),
    dni: obtenerIndice(encabezados, [
      "dni",
      "documento",
      "nro documento",
      "numero documento",
      "cuil",
      "cuit",
    ]),
    departamento: obtenerIndice(encabezados, [
      "departamento",
      "depto",
      "localidad",
    ]),
    telefonoContacto: obtenerIndice(encabezados, [
      "telefono de contacto",
      "telefono contacto",
      "telefono",
      "teléfono de contacto",
      "celular",
      "contacto",
    ]),
    cantidadPersonas: obtenerIndice(encabezados, [
      "cantidad de personas que viajan",
      "personas que viajan",
      "cantidad personas",
      "cantidad de personas",
      "cant.pers.",
      "cant. pers.",
      "cant pers",
      "personas",
    ]),
    detalleCuotasExcel: obtenerIndice(encabezados, [
      "cuotas a descontar desde junio",
      "cuotas a descontar",
      "cuotas desde",
      "cuotas",
      "plan de cuotas",
      "detalle cuotas",
    ]),
    // Solo se usa para el servicio Cena del Docente: texto libre del formulario
    // de reserva, ej. "2 AFILIADO/A MÁS UN ACOMPAÑANTE - 7 CUOTAS DE $ 28.000".
    planElegidoFormulario: obtenerIndice(encabezados, [
      "plan elegido en formulario",
      "plan elegido",
      "plan formulario",
      "opcion elegida",
      "opción elegida",
    ]),
    observacion: obtenerIndice(encabezados, [
      "observacion",
      "observación",
      "obs",
      "comentario",
      "comentarios",
    ]),
  };

  const validas = [];
  const invalidas = [];

  matriz.slice(headerIndex + 1).forEach((fila, index) => {
    const numeroFilaExcel = headerIndex + index + 2;

    if (filaEstaVacia(fila)) return;

    const apellido = limpiarTexto(obtenerValorPorIndice(fila, indices.apellido));
    const nombre = limpiarTexto(obtenerValorPorIndice(fila, indices.nombre));

    const apellidoNombreDesdeColumna = limpiarTexto(
      obtenerValorPorIndice(fila, indices.apellidoNombre)
    );

    const apellidoNombre =
      apellidoNombreDesdeColumna || limpiarTexto(`${apellido} ${nombre}`);

    const dni = normalizarDni(obtenerValorPorIndice(fila, indices.dni));

    const item = {
      fila: numeroFilaExcel,
      dni,
      apellido,
      nombre,
      apellidoNombre,
      departamento: limpiarTexto(
        obtenerValorPorIndice(fila, indices.departamento)
      ),
      telefonoContacto: limpiarTelefono(
        obtenerValorPorIndice(fila, indices.telefonoContacto)
      ),
      cantidadPersonas: limpiarTexto(
        obtenerValorPorIndice(fila, indices.cantidadPersonas)
      ),
      detalleCuotasExcel: limpiarTexto(
        obtenerValorPorIndice(fila, indices.detalleCuotasExcel)
      ),
      planElegidoFormulario: limpiarTexto(
        obtenerValorPorIndice(fila, indices.planElegidoFormulario)
      ),
      observacion: limpiarTexto(
        obtenerValorPorIndice(fila, indices.observacion)
      ),
    };

    if (!dni) {
      invalidas.push({
        ...item,
        motivo: "Fila sin DNI",
      });
      return;
    }

    validas.push(item);
  });

  return { validas, invalidas };
};

const construirFilasDesdeObjetos = (filas) => {
  const validas = [];
  const invalidas = [];

  filas.forEach((fila, index) => {
    const dni = normalizarDni(
      obtenerValorFila(fila, [
        "dni",
        "DNI",
        "Documento",
        "documento",
        "Dni",
        "Cuil",
        "CUIL",
        "cuil",
      ])
    );

    const apellido = limpiarTexto(
      obtenerValorFila(fila, ["Apellido", "apellido", "APELLIDO"])
    );

    const nombre = limpiarTexto(
      obtenerValorFila(fila, [
        "Nombre (completos)",
        "Nombre completos",
        "Nombre completo",
        "Nombre",
        "nombre",
        "NOMBRE",
      ])
    );

    const apellidoNombre =
      limpiarTexto(
        obtenerValorFila(fila, [
          "apellidoNombre",
          "Apellido y Nombre",
          "APELLIDO Y NOMBRE",
          "nombreCompleto",
          "Nombre completo",
        ])
      ) || limpiarTexto(`${apellido} ${nombre}`);

    const item = {
      fila: index + 2,
      dni,
      apellido,
      nombre,
      apellidoNombre,
      departamento: limpiarTexto(
        obtenerValorFila(fila, ["DEPARTAMENTO", "Departamento", "departamento"])
      ),
      telefonoContacto: limpiarTelefono(
        obtenerValorFila(fila, [
          "Teléfono de contacto",
          "Telefono de contacto",
          "Teléfono",
          "Telefono",
          "telefono",
        ])
      ),
      cantidadPersonas: limpiarTexto(
        obtenerValorFila(fila, [
          "Cantidad de personas que viajan",
          "cantidad de personas que viajan",
          "Cantidad de personas",
          "cantidad de personas",
          "Cant.Pers.",
          "CANTIDAD DE PERSONAS",
          "Personas",
          "personas",
        ])
      ),
      detalleCuotasExcel: limpiarTexto(
        obtenerValorFila(fila, [
          "Cuotas a descontar desde junio",
          "Cuotas a descontar",
          "cuotas",
          "Cuotas",
        ])
      ),
      planElegidoFormulario: limpiarTexto(
        obtenerValorFila(fila, [
          "Plan elegido en formulario",
          "plan elegido en formulario",
          "Plan elegido",
          "PLAN ELEGIDO EN FORMULARIO",
        ])
      ),
      observacion: limpiarTexto(
        obtenerValorFila(fila, [
          "observacion",
          "Observacion",
          "Observación",
          "OBSERVACION",
        ])
      ),
    };

    if (!dni) {
      invalidas.push({
        ...item,
        motivo: "Fila sin DNI",
      });
    } else {
      validas.push(item);
    }
  });

  return { validas, invalidas };
};

const ImportarAfiliadosServicio = ({
  servicio,
  loading = false,
  onImportar,
  resultadoImportacion = null,
  onLimpiarResultado,
}) => {
  const inputFileRef = useRef(null);

  const [archivoNombre, setArchivoNombre] = useState("");
  const [periodoHaberExcel, setPeriodoHaberExcel] = useState("");
  const [filasExcel, setFilasExcel] = useState([]);
  const [filasInvalidas, setFilasInvalidas] = useState([]);

  const limpiarImportacion = () => {
    setArchivoNombre("");
    setPeriodoHaberExcel("");
    setFilasExcel([]);
    setFilasInvalidas([]);
    onLimpiarResultado?.();

    if (inputFileRef.current) {
      inputFileRef.current.value = "";
    }
  };

  const procesarArchivo = async (event) => {
    const archivo = event.target.files?.[0];

    if (!archivo) return;

    setArchivoNombre(archivo.name);
    setFilasExcel([]);
    setFilasInvalidas([]);
    onLimpiarResultado?.();

    try {
      const data = await archivo.arrayBuffer();
      const workbook = XLSX.read(data, { type: "array" });
      const primeraHoja = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[primeraHoja];

      const matriz = XLSX.utils.sheet_to_json(worksheet, {
        header: 1,
        defval: "",
        blankrows: false,
      });

      const resultadoMatriz = construirFilasDesdeMatriz(matriz);

      if (
        resultadoMatriz.validas.length > 0 ||
        resultadoMatriz.invalidas.length > 0
      ) {
        setFilasExcel(resultadoMatriz.validas);
        setFilasInvalidas(resultadoMatriz.invalidas);
        return;
      }

      const filas = XLSX.utils.sheet_to_json(worksheet, {
        defval: "",
      });

      const resultadoObjetos = construirFilasDesdeObjetos(filas);
      setFilasExcel(resultadoObjetos.validas);
      setFilasInvalidas(resultadoObjetos.invalidas);
    } catch (error) {
      console.error("Error al procesar Excel:", error);

      setFilasExcel([]);
      setFilasInvalidas([
        {
          fila: "-",
          dni: "-",
          motivo: "No se pudo leer el archivo Excel.",
        },
      ]);
    }
  };

  const limpiarSoloArchivo = () => {
    setArchivoNombre("");
    setPeriodoHaberExcel("");
    setFilasExcel([]);
    setFilasInvalidas([]);
    if (inputFileRef.current) {
      inputFileRef.current.value = "";
    }
  };

  const handleImportar = async () => {
    if (!onImportar) return;

    await onImportar({
      servicio,
      periodoHaberInicial: periodoHaberExcel,
      periodoCobroInicial: sumarMesesPeriodo(periodoHaberExcel, 1),
      filas: filasExcel,
    });

    limpiarSoloArchivo();
  };

  const periodoCobroInicial = periodoHaberExcel
    ? sumarMesesPeriodo(periodoHaberExcel, 1)
    : "";

  const detallesImportacion = Array.isArray(resultadoImportacion?.detalles)
    ? resultadoImportacion.detalles
    : [];

  const resumenImportacion = resultadoImportacion?.resumen || null;

  const afiliadosNoCargados = detallesImportacion.filter((item) => {
    return ["no_encontrado", "duplicado", "error"].includes(item?.estado);
  });

  const estadoResultadoTemplate = (rowData) => {
    if (rowData.estado === "creado") {
      return <span className={styles.estadoCreado}>Cargado</span>;
    }

    if (rowData.estado === "actualizado") {
      return <span className={styles.estadoActualizado}>Actualizado</span>;
    }

    if (rowData.estado === "duplicado") {
      return <span className={styles.estadoDuplicado}>Duplicado</span>;
    }

    if (rowData.estado === "no_encontrado") {
      return <span className={styles.estadoNoEncontrado}>No encontrado</span>;
    }

    return <span className={styles.estadoError}>Error</span>;
  };

  const [expandido, setExpandido] = useState(false);

  return (
    <section className={styles.importBox}>
      <div
        className={`${styles.importHeader} ${styles.importHeaderClickable}`}
        onClick={() => setExpandido((v) => !v)}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => e.key === "Enter" && setExpandido((v) => !v)}
      >
        <div className={styles.importHeaderIcon}>
          <i className="pi pi-file-excel" />
        </div>
        <div style={{ flex: 1 }}>
          <h3>Importar Excel de afiliados</h3>
          <p>
            El Excel puede tener título superior. El sistema buscará
            automáticamente la fila de encabezados que contenga <strong>DNI</strong>.
            También leerá <strong>Apellido</strong>, <strong>Nombre</strong>,{" "}
            <strong>DEPARTAMENTO</strong>, <strong>Teléfono de contacto</strong>,{" "}
            <strong>Cantidad de personas que viajan</strong> y{" "}
            <strong>Cuotas a descontar</strong> si existen.
          </p>
        </div>
        <i className={`pi ${expandido ? "pi-chevron-up" : "pi-chevron-down"} ${styles.importChevron}`} />
      </div>

      {expandido && (<>

      <div className={styles.wizardBar}>
        <div className={`${styles.wizardStep} ${styles.wizardStepActive}`}>
          <span className={styles.wizardCircle}>1</span>
          <span className={styles.wizardLabel}>Configurar</span>
        </div>
        <div className={`${styles.wizardLine} ${filasExcel.length > 0 ? styles.wizardLineActive : ""}`} />
        <div className={`${styles.wizardStep} ${filasExcel.length > 0 ? styles.wizardStepActive : ""}`}>
          <span className={styles.wizardCircle}>2</span>
          <span className={styles.wizardLabel}>Revisar</span>
        </div>
        <div className={`${styles.wizardLine} ${periodoHaberExcel && filasExcel.length > 0 ? styles.wizardLineActive : ""}`} />
        <div className={`${styles.wizardStep} ${periodoHaberExcel && filasExcel.length > 0 ? styles.wizardStepActive : ""}`}>
          <span className={styles.wizardCircle}>3</span>
          <span className={styles.wizardLabel}>Importar</span>
        </div>
      </div>

      <div className={styles.stepPanel}>
        <p className={styles.stepTitle}>
          <span className={styles.stepNum}>1</span>
          Seleccioná el período y cargá el archivo
        </p>
        <div className={styles.importGrid}>
          <div className={styles.formRow}>
            <label>Haber inicial del descuento</label>
            <input
              type="month"
              value={periodoHaberExcel}
              onChange={(e) => setPeriodoHaberExcel(e.target.value)}
              className={styles.monthInput}
              disabled={loading}
            />
            {periodoHaberExcel && (
              <small>
                Se cobrará desde:{" "}
                <strong>{periodoCobroTexto(periodoCobroInicial)}</strong>
              </small>
            )}
          </div>

          <div className={styles.formRow}>
            <label>Archivo Excel</label>
            <input
              ref={inputFileRef}
              type="file"
              accept=".xlsx,.xls,.csv"
              onChange={procesarArchivo}
              className={styles.fileInput}
              disabled={loading}
            />
            {archivoNombre && <small>Archivo: {archivoNombre}</small>}
          </div>

          <div className={styles.importActions}>
            <Button
              label="Limpiar"
              icon="pi pi-times"
              className="p-button-secondary"
              onClick={limpiarImportacion}
              disabled={loading}
            />
          </div>
        </div>
      </div>

      {(filasExcel.length > 0 || filasInvalidas.length > 0) && (
        <div className={styles.stepPanel}>
          <p className={styles.stepTitle}>
            <span className={`${styles.stepNum} ${styles.stepNumActive}`}>2</span>
            Revisá los afiliados detectados
          </p>

          {filasExcel.length > 0 && (
            <div className={styles.previewBox}>
              <h4>Afiliados detectados: {filasExcel.length}</h4>
              <DataTable
                value={filasExcel}
                paginator
                rows={5}
                responsiveLayout="scroll"
                emptyMessage="No hay filas válidas."
                className={styles.previewTable}
              >
                <Column field="fila" header="Fila" />
                <Column field="dni" header="DNI" />
                <Column field="apellido" header="Apellido" />
                <Column field="nombre" header="Nombre" />
                <Column field="departamento" header="Departamento" />
                <Column field="telefonoContacto" header="Teléfono" />
                <Column field="cantidadPersonas" header="Personas" />
                <Column field="detalleCuotasExcel" header="Cuotas Excel" />
                <Column field="observacion" header="Observación" />
              </DataTable>
            </div>
          )}

          {filasInvalidas.length > 0 && (
            <div className={styles.errorBox}>
              <h4>Filas no válidas: {filasInvalidas.length}</h4>
              <DataTable
                value={filasInvalidas}
                paginator
                rows={5}
                responsiveLayout="scroll"
                emptyMessage="No hay errores."
                className={styles.previewTable}
              >
                <Column field="fila" header="Fila" />
                <Column field="dni" header="DNI" />
                <Column field="apellidoNombre" header="Afiliado" />
                <Column field="motivo" header="Motivo" />
              </DataTable>
            </div>
          )}
        </div>
      )}

      {filasExcel.length > 0 && (
        <div className={styles.stepPanel}>
          <p className={styles.stepTitle}>
            <span className={`${styles.stepNum} ${periodoHaberExcel ? styles.stepNumReady : ""}`}>3</span>
            Confirmá e importá
          </p>
          <div className={styles.importActions}>
            <Button
              label="Importar afiliados"
              icon="pi pi-upload"
              className="p-button-success"
              onClick={handleImportar}
              loading={loading}
              disabled={!periodoHaberExcel || filasExcel.length === 0 || loading}
            />
          </div>
          {!periodoHaberExcel && (
            <small className={styles.warningHint}>
              <i className="pi pi-exclamation-triangle" /> Seleccioná el haber inicial en el Paso 1 para poder importar.
            </small>
          )}
        </div>
      )}

      {resumenImportacion && (
        <div className={styles.resultBox}>
          <div className={styles.resultHeader}>
            <div>
              <h4>Resultado de la importación</h4>
              <p>
                Acá se detalla quién se cargó correctamente y, especialmente,
                quién no se cargó para poder corregir el padrón o el Excel.
              </p>
            </div>

            <div className={styles.resultBadges}>
              <span className={styles.badgeSuccess}>Creados: {resumenImportacion.creados || 0}</span>
              <span className={styles.badgeSuccess}>Actualizados: {resumenImportacion.actualizados || 0}</span>
              <span className={styles.badgeWarn}>Duplicados: {resumenImportacion.duplicados || 0}</span>
              <span className={styles.badgeError}>No encontrados: {resumenImportacion.noEncontrados || 0}</span>
              <span className={styles.badgeError}>Errores: {resumenImportacion.errores || 0}</span>
            </div>
          </div>

          {afiliadosNoCargados.length > 0 ? (
            <div className={styles.notLoadedBox}>
              <h4>Afiliados que no se cargaron: {afiliadosNoCargados.length}</h4>

              <DataTable
                value={afiliadosNoCargados}
                paginator
                rows={6}
                responsiveLayout="scroll"
                emptyMessage="No hay afiliados pendientes de corrección."
                className={styles.previewTable}
              >
                <Column field="fila" header="Fila Excel" />
                <Column field="apellido" header="Apellido" />
                <Column field="nombre" header="Nombre" />
                <Column field="dni" header="DNI" />
                <Column field="afiliado" header="Afiliado" />
                <Column header="Estado" body={estadoResultadoTemplate} />
                <Column field="motivo" header="Motivo" />
              </DataTable>
            </div>
          ) : (
            <div className={styles.okBox}>
              Todos los afiliados válidos del Excel fueron cargados o
              actualizados correctamente.
            </div>
          )}

          {detallesImportacion.length > 0 && (
            <div className={styles.fullResultBox}>
              <h4>Detalle completo procesado: {detallesImportacion.length}</h4>

              <DataTable
                value={detallesImportacion}
                paginator
                rows={6}
                responsiveLayout="scroll"
                emptyMessage="No hay resultados para mostrar."
                className={styles.previewTable}
              >
                <Column field="fila" header="Fila" />
                <Column field="apellido" header="Apellido" />
                <Column field="nombre" header="Nombre" />
                <Column field="dni" header="DNI" />
                <Column field="afiliado" header="Afiliado" />
                <Column header="Estado" body={estadoResultadoTemplate} />
                <Column field="motivo" header="Detalle" />
              </DataTable>
            </div>
          )}
        </div>
      )}
      </>)}
    </section>
  );
};

export default ImportarAfiliadosServicio;
