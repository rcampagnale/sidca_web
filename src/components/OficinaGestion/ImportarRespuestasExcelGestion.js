// src/components/OficinaGestion/ImportarRespuestasExcelGestion.js

import React, { useEffect, useMemo, useRef, useState } from "react";
import * as XLSX from "xlsx";

import { Button } from "primereact/button";
import { Dropdown } from "primereact/dropdown";
import { Toast } from "primereact/toast";
import { ProgressSpinner } from "primereact/progressspinner";
import { Tag } from "primereact/tag";

import {
  collection,
  doc,
  getDocs,
  orderBy,
  query,
  serverTimestamp,
  where,
  writeBatch,
} from "firebase/firestore";

import { db } from "../../firebase/firebase-config";
import styles from "../../pages/Admin/OficinaGestion/OficinaGestionAdmin.module.css";

const BATCH_LIMIT = 450;

const normalizarTexto = (valor) => {
  return String(valor || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
};

const normalizarDni = (valor) => {
  return String(valor || "")
    .replace(/\D/g, "")
    .trim();
};

const buscarValor = (fila, posiblesNombres) => {
  const keys = Object.keys(fila || {});

  for (const nombre of posiblesNombres) {
    const nombreNormalizado = normalizarTexto(nombre);

    const keyEncontrada = keys.find(
      (key) => normalizarTexto(key) === nombreNormalizado
    );

    if (keyEncontrada) {
      return fila[keyEncontrada];
    }
  }

  return "";
};

const convertirSiNo = (valor) => {
  const v = normalizarTexto(valor);

  if (!v) return "Sí";

  if (["si", "sí", "s", "x", "ok", "true", "1"].includes(v)) {
    return "Sí";
  }

  if (["no", "n", "false", "0"].includes(v)) {
    return "No";
  }

  return String(valor).trim();
};

const dividirEnLotes = (array, size) => {
  const lotes = [];

  for (let i = 0; i < array.length; i += size) {
    lotes.push(array.slice(i, i + size));
  }

  return lotes;
};

const obtenerDniDesdeRespuestaRegistrada = (data = {}) => {
  const respuestas = data.respuestas || {};
  const respuestasPorCampo = data.respuestasPorCampo || {};

  const posiblesValores = [
    data.dni,
    respuestas.DNI,
    respuestas.Documento,
    respuestas["Nro DNI"],
    respuestas["N° DNI"],
    respuestas["Nº DNI"],
    respuestas["Número de DNI"],
    respuestas["Numero de DNI"],
    respuestas["Número documento"],
    respuestas["Numero documento"],
  ];

  Object.values(respuestasPorCampo).forEach((campo) => {
    const label = normalizarTexto(campo?.label || "");

    const esCampoDni =
      label === "dni" ||
      label === "documento" ||
      label === "nro dni" ||
      label === "n° dni" ||
      label === "nº dni" ||
      label === "numero de dni" ||
      label === "numero documento" ||
      label === "numero de documento";

    if (esCampoDni) {
      posiblesValores.push(campo?.valorLegible);
      posiblesValores.push(campo?.valor);
    }
  });

  const encontrado = posiblesValores.find((valor) => normalizarDni(valor));

  return normalizarDni(encontrado);
};

const ImportarRespuestasExcelGestion = () => {
  const toast = useRef(null);
  const inputFileRef = useRef(null);

  const [formularios, setFormularios] = useState([]);
  const [formularioSeleccionado, setFormularioSeleccionado] = useState(null);
  const [filasPreview, setFilasPreview] = useState([]);
  const [errores, setErrores] = useState([]);

  const [loadingFormularios, setLoadingFormularios] = useState(false);
  const [leyendoExcel, setLeyendoExcel] = useState(false);
  const [importando, setImportando] = useState(false);

  const opcionesFormularios = useMemo(() => {
    return formularios.map((formulario) => ({
      label: formulario.titulo || "Formulario sin título",
      value: formulario.id,
    }));
  }, [formularios]);

  const formularioActual = useMemo(() => {
    return formularios.find((item) => item.id === formularioSeleccionado);
  }, [formularios, formularioSeleccionado]);

  const cargarFormularios = async () => {
    setLoadingFormularios(true);

    try {
      const q = query(
        collection(db, "oficina_gestion_formularios"),
        orderBy("createdAt", "desc")
      );

      const snap = await getDocs(q);

      const data = snap.docs.map((docSnap) => ({
        id: docSnap.id,
        ...docSnap.data(),
      }));

      setFormularios(data);
    } catch (error) {
      console.error("Error al cargar formularios:", error);

      toast.current?.show({
        severity: "error",
        summary: "Error",
        detail: "No se pudieron cargar los formularios.",
        life: 3500,
      });
    } finally {
      setLoadingFormularios(false);
    }
  };

  useEffect(() => {
    cargarFormularios();
  }, []);

  const procesarArchivoExcel = async (event) => {
    const file = event.target.files?.[0];

    if (!file) return;

    setLeyendoExcel(true);
    setFilasPreview([]);
    setErrores([]);

    try {
      const data = await file.arrayBuffer();

      const workbook = XLSX.read(data, {
        type: "array",
      });

      const sheetName = workbook.SheetNames[0];

      if (!sheetName) {
        throw new Error("El archivo no contiene hojas.");
      }

      const sheet = workbook.Sheets[sheetName];

      const rows = XLSX.utils.sheet_to_json(sheet, {
        defval: "",
      });

      if (!rows.length) {
        throw new Error("El Excel no contiene datos.");
      }

      const erroresDetectados = [];
      const dnisEnExcel = new Set();

      const filasNormalizadas = rows
        .map((fila, index) => {
          const apellido = String(
            buscarValor(fila, ["Apellido", "Apellidos"])
          ).trim();

          const nombre = String(
            buscarValor(fila, ["Nombre", "Nombres"])
          ).trim();

          const dni = normalizarDni(
            buscarValor(fila, [
              "DNI",
              "Documento",
              "Nro DNI",
              "N° DNI",
              "Nº DNI",
              "Número de DNI",
              "Numero de DNI",
              "Número documento",
              "Numero documento",
            ])
          );

          const departamento = String(
            buscarValor(fila, [
              "Departamento",
              "Depto",
              "Dpto",
              "Departamento escolar",
              "Delegación",
              "Delegacion",
            ])
          ).trim();

          const documentacionRaw = buscarValor(fila, [
            "Documentacion",
            "Documentación",
            "Presentó documentación",
            "Presento documentacion",
            "Presentó documentación (SI)",
            "Documentacion SI",
          ]);

          const presentoDocumentacion = convertirSiNo(documentacionRaw);

          if (!apellido || !nombre || !dni) {
            erroresDetectados.push(
              `Fila ${index + 2}: falta Apellido, Nombre o DNI.`
            );
          }

          if (dni && dnisEnExcel.has(dni)) {
            erroresDetectados.push(
              `Fila ${index + 2}: el DNI ${dni} está repetido dentro del Excel.`
            );
          }

          dnisEnExcel.add(dni);

          return {
            filaExcel: index + 2,
            apellido,
            nombre,
            dni,
            departamento,
            presentoDocumentacion,
          };
        })
        .filter((fila) => fila.apellido && fila.nombre && fila.dni)
        .filter((fila, index, array) => {
          return array.findIndex((item) => item.dni === fila.dni) === index;
        });

      setFilasPreview(filasNormalizadas);
      setErrores(erroresDetectados);

      toast.current?.show({
        severity: "success",
        summary: "Excel leído",
        detail: `Se detectaron ${filasNormalizadas.length} filas válidas.`,
        life: 3500,
      });
    } catch (error) {
      console.error("Error al leer Excel:", error);

      toast.current?.show({
        severity: "error",
        summary: "Error",
        detail:
          error?.message ||
          "No se pudo leer el archivo. Verifique que sea un Excel válido.",
        life: 4500,
      });
    } finally {
      setLeyendoExcel(false);

      if (inputFileRef.current) {
        inputFileRef.current.value = "";
      }
    }
  };

  const obtenerDnisYaCargadosEnFormulario = async (formularioId) => {
    const q = query(
      collection(db, "oficina_gestion_respuestas"),
      where("formularioId", "==", formularioId)
    );

    const snap = await getDocs(q);

    const dnis = new Set();

    snap.docs.forEach((docSnap) => {
      const data = docSnap.data() || {};
      const dni = obtenerDniDesdeRespuestaRegistrada(data);

      if (dni) {
        dnis.add(dni);
      }
    });

    return dnis;
  };

  const importarRespuestas = async () => {
    if (!formularioSeleccionado || !formularioActual) {
      toast.current?.show({
        severity: "warn",
        summary: "Atención",
        detail: "Seleccione el formulario donde se importarán las respuestas.",
        life: 3500,
      });
      return;
    }

    if (!filasPreview.length) {
      toast.current?.show({
        severity: "warn",
        summary: "Atención",
        detail: "Primero debe seleccionar un archivo Excel válido.",
        life: 3500,
      });
      return;
    }

    setImportando(true);

    try {
      const dnisExistentes = await obtenerDnisYaCargadosEnFormulario(
        formularioSeleccionado
      );

      const filasNuevas = filasPreview.filter(
        (fila) => !dnisExistentes.has(normalizarDni(fila.dni))
      );

      const duplicados = filasPreview.length - filasNuevas.length;

      if (!filasNuevas.length) {
        toast.current?.show({
          severity: "warn",
          summary: "Sin datos nuevos",
          detail:
            "Todas las filas del Excel ya estaban cargadas para este formulario.",
          life: 4000,
        });
        return;
      }

      const lotes = dividirEnLotes(filasNuevas, BATCH_LIMIT);

      for (const lote of lotes) {
        const batch = writeBatch(db);

        lote.forEach((fila) => {
          const ref = doc(collection(db, "oficina_gestion_respuestas"));

          batch.set(ref, {
            // Identificador real del formulario.
            // Este valor es el que después debe verificar el formulario público.
            formularioId: formularioSeleccionado,
            formularioCodigo: formularioSeleccionado,
            formularioNumero: formularioSeleccionado,
            formularioTitulo: formularioActual.titulo || "",

            origen: "importacion_excel",

            apellido: fila.apellido,
            nombre: fila.nombre,
            dni: normalizarDni(fila.dni),
            departamento: fila.departamento || "",
            presentoDocumentacion: fila.presentoDocumentacion,

            respuestas: {
              Apellido: fila.apellido,
              Nombre: fila.nombre,
              DNI: normalizarDni(fila.dni),
              Departamento: fila.departamento || "",
              "Presentó documentación": fila.presentoDocumentacion,
            },

            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
        });

        await batch.commit();
      }

      toast.current?.show({
        severity: "success",
        summary: "Importación finalizada",
        detail: `Se importaron ${filasNuevas.length} respuestas. Duplicados omitidos: ${duplicados}.`,
        life: 5000,
      });

      setFilasPreview([]);
      setErrores([]);
    } catch (error) {
      console.error("Error al importar respuestas:", error);

      toast.current?.show({
        severity: "error",
        summary: "Error",
        detail: "No se pudieron importar las respuestas.",
        life: 4500,
      });
    } finally {
      setImportando(false);
    }
  };

  return (
    <div className={styles.formWrapper}>
      <Toast ref={toast} />

      <div className={styles.sectionTitle}>
        <div>
          <h2>Importar respuestas desde Excel</h2>

          <p>
            Subí un archivo Excel con Apellido, Nombre, DNI, Departamento y
            Presentó documentación. Cada fila se guardará como una respuesta del
            formulario seleccionado.
          </p>
        </div>

        <Button
          label="Actualizar formularios"
          icon="pi pi-refresh"
          severity="secondary"
          outlined
          onClick={cargarFormularios}
          loading={loadingFormularios}
        />
      </div>

      <div className={styles.formGrid}>
        <div className={styles.formRow}>
          <label>Formulario destino</label>

          <Dropdown
            value={formularioSeleccionado}
            options={opcionesFormularios}
            onChange={(e) => setFormularioSeleccionado(e.value)}
            placeholder={
              loadingFormularios
                ? "Cargando formularios..."
                : "Seleccione el formulario"
            }
            loading={loadingFormularios}
            filter
            showClear
            disabled={loadingFormularios || importando}
          />
        </div>
      </div>

      {formularioActual && (
        <div className={styles.selectedInfo}>
          <div>
            <strong>{formularioActual.titulo}</strong>
            <p>{formularioActual.descripcion || "Sin descripción cargada."}</p>
            <small>
              Código / ID del formulario: <strong>{formularioActual.id}</strong>
            </small>
          </div>

          <Tag
            value={formularioActual.publicado ? "Publicado" : "Borrador"}
            severity={formularioActual.publicado ? "success" : "warning"}
          />
        </div>
      )}

      <div className={styles.importBox}>
        <input
          ref={inputFileRef}
          type="file"
          accept=".xlsx,.xls,.csv"
          onChange={procesarArchivoExcel}
          style={{ display: "none" }}
        />

        <div>
          <h3>Archivo Excel</h3>

          <p>
            Columnas esperadas: <strong>Apellido</strong>,{" "}
            <strong>Nombre</strong>, <strong>DNI</strong>,{" "}
            <strong>Departamento</strong> y{" "}
            <strong>Presentó documentación</strong>.
          </p>
        </div>

        <div className={styles.importActions}>
          <Button
            label="Seleccionar Excel"
            icon="pi pi-file-excel"
            severity="success"
            outlined
            onClick={() => inputFileRef.current?.click()}
            disabled={leyendoExcel || importando}
          />

          <Button
            label="Importar respuestas"
            icon="pi pi-upload"
            severity="warning"
            onClick={importarRespuestas}
            disabled={
              !formularioSeleccionado ||
              !filasPreview.length ||
              leyendoExcel ||
              importando
            }
            loading={importando}
          />
        </div>
      </div>

      {leyendoExcel && (
        <div className={styles.loadingBox}>
          <ProgressSpinner />
          <span>Leyendo archivo Excel...</span>
        </div>
      )}

      {errores.length > 0 && (
        <div className={styles.errorBox}>
          <h3>Observaciones detectadas</h3>

          {errores.slice(0, 10).map((error, index) => (
            <p key={index}>{error}</p>
          ))}

          {errores.length > 10 && (
            <small>Hay más observaciones no mostradas.</small>
          )}
        </div>
      )}

      {filasPreview.length > 0 && (
        <div className={styles.previewExcelBox}>
          <div className={styles.previewExcelHeader}>
            <h3>Vista previa de importación</h3>

            <Tag
              value={`${filasPreview.length} filas válidas`}
              severity="success"
            />
          </div>

          <div className={styles.previewExcelTable}>
            <table>
              <thead>
                <tr>
                  <th>Fila</th>
                  <th>Apellido</th>
                  <th>Nombre</th>
                  <th>DNI</th>
                  <th>Departamento</th>
                  <th>Presentó documentación</th>
                </tr>
              </thead>

              <tbody>
                {filasPreview.slice(0, 30).map((fila) => (
                  <tr key={`${fila.filaExcel}-${fila.dni}`}>
                    <td>{fila.filaExcel}</td>
                    <td>{fila.apellido}</td>
                    <td>{fila.nombre}</td>
                    <td>{fila.dni}</td>
                    <td>{fila.departamento || "—"}</td>
                    <td>{fila.presentoDocumentacion}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {filasPreview.length > 30 && (
            <small>
              Se muestran las primeras 30 filas. Al importar, se procesarán
              todas.
            </small>
          )}
        </div>
      )}
    </div>
  );
};

export default ImportarRespuestasExcelGestion;