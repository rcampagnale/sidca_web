// src/components/OficinaGestion/ImportarRespuestasExcelGestion.js

import React, { useEffect, useMemo, useRef, useState } from "react";
import * as XLSX from "xlsx";

import { Button } from "primereact/button";
import { Dropdown } from "primereact/dropdown";
import { Toast } from "primereact/toast";
import { ProgressSpinner } from "primereact/progressspinner";
import { Tag } from "primereact/tag";
import { Dialog } from "primereact/dialog";

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

const CAMPOS_NO_IMPORTABLES_DESDE_EXCEL = ["archivo", "archivo_pdf"];

const normalizarTexto = (valor) => {
  return String(valor || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[º°]/g, "")
    .replace(/[().,:;¿?¡!|/\\_\-]+/g, " ")
    .replace(/\s+/g, " ")
    .toLowerCase()
    .trim();
};

const normalizarClave = (valor) => {
  return normalizarTexto(valor).replace(/\s+/g, "");
};

const normalizarDni = (valor) => {
  return String(valor || "")
    .replace(/\D/g, "")
    .trim();
};

const estaVacio = (valor) => {
  return (
    valor === null ||
    valor === undefined ||
    String(valor).trim() === "" ||
    String(valor).trim() === "—"
  );
};

const dividirEnLotes = (array, size) => {
  const lotes = [];

  for (let i = 0; i < array.length; i += size) {
    lotes.push(array.slice(i, i + size));
  }

  return lotes;
};

const convertirSiNo = (valor) => {
  const v = normalizarTexto(valor);

  if (!v) return "";

  if (["si", "s", "x", "ok", "true", "1"].includes(v)) {
    return "Sí";
  }

  if (["no", "n", "false", "0"].includes(v)) {
    return "No";
  }

  return String(valor).trim();
};

const formatearValorCampo = (valor, campo) => {
  if (valor === null || valor === undefined) return "";

  if (campo?.tipo === "booleano") {
    return convertirSiNo(valor);
  }

  if (campo?.tipo === "validacion_dni") {
    return normalizarDni(valor);
  }

  if (Array.isArray(valor)) {
    return valor.join(", ");
  }

  if (typeof valor === "object") {
    return JSON.stringify(valor);
  }

  return String(valor).trim();
};

const obtenerAliasesCampo = (campo) => {
  const label = String(campo?.label || "").trim();
  const tipo = campo?.tipo || "";

  const aliases = new Set();

  if (label) {
    aliases.add(label);
  }

  const labelNormalizado = normalizarTexto(label);
  const labelClave = normalizarClave(label);

  if (tipo === "validacion_dni" || labelClave.includes("dni")) {
    [
      "DNI",
      "Documento",
      "Nro DNI",
      "N° DNI",
      "Nº DNI",
      "Número de DNI",
      "Numero de DNI",
      "Número documento",
      "Numero documento",
      "Número de documento",
      "Numero de documento",
    ].forEach((item) => aliases.add(item));
  }

  if (tipo === "departamento" || labelClave.includes("departamento")) {
    [
      "Departamento",
      "Depto",
      "Dpto",
      "Departamento escolar",
      "Delegación",
      "Delegacion",
    ].forEach((item) => aliases.add(item));
  }

  if (labelClave.includes("apellido") || labelClave.includes("apellidos")) {
    ["Apellido", "Apellidos", "APELLIDO", "APELLIDOS"].forEach((item) =>
      aliases.add(item)
    );
  }

  if (labelClave === "nombre" || labelClave.includes("nombres")) {
    ["Nombre", "Nombres", "NOMBRE", "NOMBRES"].forEach((item) =>
      aliases.add(item)
    );
  }

  if (labelNormalizado.includes("documentacion")) {
    [
      "Presentó documentación",
      "Presento documentacion",
      "Presentó documentación (SI)",
      "Documentación",
      "Documentacion",
      "Documentación presentada",
      "Documentacion presentada",
      "PRESENTO DOCUMENTACIÓN",
      "PRESENTÓ DOCUMENTACIÓN",
    ].forEach((item) => aliases.add(item));
  }

  if (
    labelNormalizado.includes("expediente") &&
    (labelNormalizado.includes("n") ||
      labelNormalizado.includes("numero") ||
      labelNormalizado.includes("nro"))
  ) {
    [
      "N° de expediente",
      "Nº de expediente",
      "Nro de expediente",
      "Numero de expediente",
      "Número de expediente",
      "N° expediente",
      "Nº expediente",
      "Nro expediente",
      "Numero expediente",
      "Número expediente",
      "Expediente",
    ].forEach((item) => aliases.add(item));
  }

  if (
    labelNormalizado.includes("estado") &&
    labelNormalizado.includes("expediente")
  ) {
    [
      "Estado de expediente",
      "Estado del expediente",
      "Estado expediente",
      "Estado",
    ].forEach((item) => aliases.add(item));
  }

  return Array.from(aliases);
};

const buscarValorEnFila = (fila, aliases = []) => {
  const keys = Object.keys(fila || {});

  for (const alias of aliases) {
    const aliasNormalizado = normalizarTexto(alias);
    const aliasClave = normalizarClave(alias);

    const keyEncontrada = keys.find((key) => {
      const keyNormalizado = normalizarTexto(key);
      const keyClave = normalizarClave(key);

      return keyNormalizado === aliasNormalizado || keyClave === aliasClave;
    });

    if (keyEncontrada) {
      return {
        valor: fila[keyEncontrada],
        encabezado: keyEncontrada,
      };
    }
  }

  return {
    valor: "",
    encabezado: "",
  };
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
    const labelClave = normalizarClave(campo?.label || "");

    const esCampoDni =
      labelClave === "dni" ||
      labelClave === "documento" ||
      labelClave === "nrodni" ||
      labelClave === "numerodni" ||
      labelClave === "numerodedni" ||
      labelClave === "numerodocumento" ||
      labelClave === "numerodedocumento";

    if (esCampoDni || campo?.tipo === "validacion_dni") {
      posiblesValores.push(campo?.valorLegible);
      posiblesValores.push(campo?.valor);
    }
  });

  const encontrado = posiblesValores.find((valor) => normalizarDni(valor));

  return normalizarDni(encontrado);
};

const obtenerValorPorLabel = (respuestas = {}, aliases = []) => {
  const keys = Object.keys(respuestas || {});

  for (const alias of aliases) {
    const aliasClave = normalizarClave(alias);

    const keyEncontrada = keys.find(
      (key) => normalizarClave(key) === aliasClave
    );

    if (keyEncontrada) {
      return respuestas[keyEncontrada];
    }
  }

  return "";
};

const esCampoDni = (campo) => {
  return (
    campo?.tipo === "validacion_dni" ||
    normalizarClave(campo?.label || "").includes("dni")
  );
};

const esCampoImportable = (campo) => {
  return !CAMPOS_NO_IMPORTABLES_DESDE_EXCEL.includes(campo?.tipo);
};

const campoCoincideConAliases = (campo, aliases = []) => {
  const aliasesCampo = obtenerAliasesCampo(campo).map(normalizarClave);
  const aliasesObjetivo = aliases.map(normalizarClave);

  return aliasesObjetivo.some((alias) => aliasesCampo.includes(alias));
};

const ImportarRespuestasExcelGestion = () => {
  const toast = useRef(null);
  const inputFileRef = useRef(null);

  const [formularios, setFormularios] = useState([]);
  const [formularioSeleccionado, setFormularioSeleccionado] = useState(null);
  const [filasPreview, setFilasPreview] = useState([]);
  const [errores, setErrores] = useState([]);
  const [advertencias, setAdvertencias] = useState([]);
  const [encabezadosExcel, setEncabezadosExcel] = useState([]);

  const [previewVisible, setPreviewVisible] = useState(false);

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

  const camposImportables = useMemo(() => {
    const campos = formularioActual?.campos || [];

    return campos
      .filter(esCampoImportable)
      .map((campo, index) => ({
        ...campo,
        id: campo.id || `campo_${index + 1}`,
        orden: campo.orden || index + 1,
        label: campo.label || `Campo ${index + 1}`,
      }))
      .sort((a, b) => Number(a.orden || 0) - Number(b.orden || 0));
  }, [formularioActual]);

  const campoDniFormulario = useMemo(() => {
    return camposImportables.find(esCampoDni) || null;
  }, [camposImportables]);

  const columnasPrincipalesPreview = useMemo(() => {
    const tieneApellido = camposImportables.some((campo) =>
      campoCoincideConAliases(campo, ["Apellido", "Apellidos"])
    );

    const tieneNombre = camposImportables.some((campo) =>
      campoCoincideConAliases(campo, ["Nombre", "Nombres"])
    );

    const columnas = [];

    if (!tieneApellido) {
      columnas.push({
        id: "__apellido",
        label: "Apellido",
        obtenerValor: (fila) => fila.apellido || "—",
      });
    }

    if (!tieneNombre) {
      columnas.push({
        id: "__nombre",
        label: "Nombre",
        obtenerValor: (fila) => fila.nombre || "—",
      });
    }

    return columnas;
  }, [camposImportables]);

  const resumenPreview = useMemo(() => {
    const totalValidas = filasPreview.length;
    const totalErrores = errores.length;
    const totalAdvertencias = advertencias.length;

    const dnis = filasPreview.map((fila) => fila.dni).filter(Boolean);

    const cantidadConDni = dnis.length;

    return {
      totalValidas,
      totalErrores,
      totalAdvertencias,
      cantidadConDni,
    };
  }, [filasPreview, errores, advertencias]);

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

  useEffect(() => {
    setFilasPreview([]);
    setErrores([]);
    setAdvertencias([]);
    setEncabezadosExcel([]);
    setPreviewVisible(false);

    if (inputFileRef.current) {
      inputFileRef.current.value = "";
    }
  }, [formularioSeleccionado]);

  const obtenerRespuestasRegistradasPorDni = async (formularioId) => {
    const consultas = [
      ["formularioId", formularioId],
      ["formularioCodigo", formularioId],
      ["formularioNumero", formularioId],
    ];

    const respuestasMap = new Map();

    for (const [campo, valor] of consultas) {
      const q = query(
        collection(db, "oficina_gestion_respuestas"),
        where(campo, "==", valor)
      );

      const snap = await getDocs(q);

      snap.docs.forEach((docSnap) => {
        respuestasMap.set(docSnap.id, {
          id: docSnap.id,
          ref: docSnap.ref,
          data: docSnap.data() || {},
        });
      });
    }

    const porDni = new Map();

    respuestasMap.forEach((item) => {
      const dni = obtenerDniDesdeRespuestaRegistrada(item.data);

      if (dni && !porDni.has(dni)) {
        porDni.set(dni, item);
      }
    });

    return porDni;
  };

  const construirFilaNormalizada = (filaExcel, index, encabezadosDisponibles) => {
    const respuestas = {};
    const respuestasPorCampo = {};
    const encabezadosUsados = {};
    const erroresFila = [];
    const advertenciasFila = [];

    camposImportables.forEach((campo) => {
      const aliases = obtenerAliasesCampo(campo);
      const resultado = buscarValorEnFila(filaExcel, aliases);

      const valorLegible = formatearValorCampo(resultado.valor, campo);

      respuestas[campo.label] = valorLegible;

      respuestasPorCampo[campo.id] = {
        id: campo.id,
        label: campo.label,
        tipo: campo.tipo || "texto",
        obligatorio: Boolean(campo.obligatorio),
        orden: campo.orden || 0,
        valor: valorLegible,
        valorLegible,
        encabezadoExcel: resultado.encabezado || "",
      };

      if (resultado.encabezado) {
        encabezadosUsados[campo.id] = resultado.encabezado;
      }

      if (campo.obligatorio && estaVacio(valorLegible)) {
        erroresFila.push(
          `Fila ${index + 2}: falta el campo obligatorio "${campo.label}".`
        );
      }
    });

    const apellidoDirecto = formatearValorCampo(
      buscarValorEnFila(filaExcel, ["Apellido", "Apellidos", "APELLIDO"]).valor,
      { tipo: "texto" }
    );

    const nombreDirecto = formatearValorCampo(
      buscarValorEnFila(filaExcel, ["Nombre", "Nombres", "NOMBRE"]).valor,
      { tipo: "texto" }
    );

    const apellido =
      obtenerValorPorLabel(respuestas, ["Apellido", "Apellidos"]) ||
      apellidoDirecto;

    const nombre =
      obtenerValorPorLabel(respuestas, ["Nombre", "Nombres"]) || nombreDirecto;

    const dniDesdeCampoFormulario = campoDniFormulario
      ? respuestas[campoDniFormulario.label]
      : "";

    const dni =
      normalizarDni(dniDesdeCampoFormulario) ||
      normalizarDni(
        obtenerValorPorLabel(respuestas, [
          "DNI",
          "Documento",
          "Número de DNI",
          "Numero de DNI",
        ])
      );

    if (campoDniFormulario && !dni) {
      erroresFila.push(
        `Fila ${index + 2}: falta DNI. Es necesario para crear o actualizar la respuesta.`
      );
    }

    const encabezadosFormularioNormalizados = new Set();

    camposImportables.forEach((campo) => {
      obtenerAliasesCampo(campo).forEach((alias) => {
        encabezadosFormularioNormalizados.add(normalizarClave(alias));
      });
    });

    [
      "Apellido",
      "Apellidos",
      "Nombre",
      "Nombres",
      "APELLIDO",
      "NOMBRE",
    ].forEach((alias) => {
      encabezadosFormularioNormalizados.add(normalizarClave(alias));
    });

    const encabezadosExtra = encabezadosDisponibles.filter((encabezado) => {
      const clave = normalizarClave(encabezado);
      return clave && !encabezadosFormularioNormalizados.has(clave);
    });

    if (index === 0 && encabezadosExtra.length > 0) {
      advertenciasFila.push(
        `El Excel tiene columnas que no pertenecen al formulario seleccionado: ${encabezadosExtra.join(
          ", "
        )}. Se ignorarán.`
      );
    }

    const departamento = obtenerValorPorLabel(respuestas, [
      "Departamento",
      "Depto",
      "Dpto",
    ]);

    const presentoDocumentacion = obtenerValorPorLabel(respuestas, [
      "Presentó documentación",
      "Presento documentacion",
      "Documentación",
      "Documentacion",
      "Documentación presentada",
      "Documentacion presentada",
    ]);

    return {
      filaExcel: index + 2,
      dni,
      apellido,
      nombre,
      departamento,
      presentoDocumentacion,
      respuestas,
      respuestasPorCampo,
      encabezadosUsados,
      erroresFila,
      advertenciasFila,
    };
  };

  const procesarArchivoExcel = async (event) => {
    const file = event.target.files?.[0];

    if (!file) return;

    if (!formularioSeleccionado || !formularioActual) {
      toast.current?.show({
        severity: "warn",
        summary: "Seleccione un formulario",
        detail: "Primero debe seleccionar el formulario destino.",
        life: 3500,
      });

      if (inputFileRef.current) {
        inputFileRef.current.value = "";
      }

      return;
    }

    if (!camposImportables.length) {
      toast.current?.show({
        severity: "warn",
        summary: "Formulario sin campos",
        detail:
          "El formulario seleccionado no tiene campos importables desde Excel.",
        life: 4000,
      });

      if (inputFileRef.current) {
        inputFileRef.current.value = "";
      }

      return;
    }

    setLeyendoExcel(true);
    setFilasPreview([]);
    setErrores([]);
    setAdvertencias([]);
    setEncabezadosExcel([]);
    setPreviewVisible(false);

    try {
      const data = await file.arrayBuffer();

      const workbook = XLSX.read(data, {
        type: "array",
        cellDates: false,
      });

      const sheetName = workbook.SheetNames[0];

      if (!sheetName) {
        throw new Error("El archivo no contiene hojas.");
      }

      const sheet = workbook.Sheets[sheetName];

      const rows = XLSX.utils.sheet_to_json(sheet, {
        defval: "",
        raw: false,
      });

      if (!rows.length) {
        throw new Error("El Excel no contiene datos.");
      }

      const encabezados = Array.from(
        new Set(rows.flatMap((fila) => Object.keys(fila || {})))
      );

      const camposSinColumna = camposImportables.filter((campo) => {
        const resultado = buscarValorEnFila(
          Object.fromEntries(encabezados.map((encabezado) => [encabezado, "x"])),
          obtenerAliasesCampo(campo)
        );

        return !resultado.encabezado;
      });

      const erroresDetectados = [];
      const advertenciasDetectadas = [];
      const dnisEnExcel = new Set();

      camposSinColumna.forEach((campo) => {
        const mensaje = campo.obligatorio
          ? `El Excel no tiene una columna para el campo obligatorio "${campo.label}".`
          : `El Excel no tiene una columna para el campo opcional "${campo.label}". Se cargará vacío.`;

        if (campo.obligatorio) {
          erroresDetectados.push(mensaje);
        } else {
          advertenciasDetectadas.push(mensaje);
        }
      });

      const filasNormalizadas = rows
        .map((fila, index) => {
          const normalizada = construirFilaNormalizada(fila, index, encabezados);

          normalizada.erroresFila.forEach((error) =>
            erroresDetectados.push(error)
          );

          normalizada.advertenciasFila.forEach((advertencia) =>
            advertenciasDetectadas.push(advertencia)
          );

          if (normalizada.dni) {
            if (dnisEnExcel.has(normalizada.dni)) {
              erroresDetectados.push(
                `Fila ${index + 2}: el DNI ${normalizada.dni} está repetido dentro del Excel. Se tomará la primera aparición.`
              );

              return {
                ...normalizada,
                repetidaEnExcel: true,
              };
            }

            dnisEnExcel.add(normalizada.dni);
          }

          return normalizada;
        })
        .filter((fila) => !fila.repetidaEnExcel)
        .filter((fila) => fila.erroresFila.length === 0);

      setEncabezadosExcel(encabezados);
      setFilasPreview(filasNormalizadas);
      setErrores(Array.from(new Set(erroresDetectados)));
      setAdvertencias(Array.from(new Set(advertenciasDetectadas)));

      setPreviewVisible(true);

      toast.current?.show({
        severity: filasNormalizadas.length ? "info" : "warn",
        summary: "Revisión generada",
        detail: filasNormalizadas.length
          ? `Se detectaron ${filasNormalizadas.length} filas válidas. Revisá la ventana antes de confirmar.`
          : "No se encontraron filas válidas. Revisá las observaciones.",
        life: 4500,
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

  const construirPayloadRespuesta = (fila) => {
    const respuestas = fila.respuestas || {};
    const respuestasPorCampo = fila.respuestasPorCampo || {};
    const dniNormalizado = normalizarDni(fila.dni);

    const apellido = fila.apellido || "";
    const nombre = fila.nombre || "";
    const departamento = fila.departamento || "";
    const presentoDocumentacion = fila.presentoDocumentacion || "";

    return {
      formularioId: formularioSeleccionado,
      formularioCodigo: formularioSeleccionado,
      formularioNumero: formularioSeleccionado,
      formularioTitulo: formularioActual?.titulo || "",

      origen: "importacion_excel",

      apellido,
      nombre,
      dni: dniNormalizado,
      departamento,
      presentoDocumentacion,

      respuestas,
      respuestasPorCampo,

      cantidadCampos: Object.keys(respuestasPorCampo).length,
      updatedAt: serverTimestamp(),
    };
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
        detail:
          "No hay filas válidas para importar. Revise el Excel y vuelva a cargarlo.",
        life: 3500,
      });
      return;
    }

    setImportando(true);

    try {
      const respuestasExistentesPorDni =
        await obtenerRespuestasRegistradasPorDni(formularioSeleccionado);

      const operaciones = filasPreview.map((fila) => {
        const dni = normalizarDni(fila.dni);
        const existente = dni ? respuestasExistentesPorDni.get(dni) : null;

        return {
          tipo: existente ? "actualizar" : "crear",
          fila,
          existente,
        };
      });

      const lotes = dividirEnLotes(operaciones, BATCH_LIMIT);

      let creadas = 0;
      let actualizadas = 0;

      for (const lote of lotes) {
        const batch = writeBatch(db);

        lote.forEach((operacion) => {
          const payload = construirPayloadRespuesta(operacion.fila);

          if (operacion.tipo === "actualizar" && operacion.existente?.ref) {
            batch.update(operacion.existente.ref, {
              ...payload,
              updatedAt: serverTimestamp(),
            });

            actualizadas += 1;
          } else {
            const refNueva = doc(collection(db, "oficina_gestion_respuestas"));

            batch.set(refNueva, {
              ...payload,
              createdAt: serverTimestamp(),
              updatedAt: serverTimestamp(),
            });

            creadas += 1;
          }
        });

        await batch.commit();
      }

      toast.current?.show({
        severity: "success",
        summary: "Importación finalizada",
        detail: `Se crearon ${creadas} respuesta(s) y se actualizaron ${actualizadas} respuesta(s).`,
        life: 5500,
      });

      setFilasPreview([]);
      setErrores([]);
      setAdvertencias([]);
      setEncabezadosExcel([]);
      setPreviewVisible(false);
    } catch (error) {
      console.error("Error al importar respuestas:", error);

      toast.current?.show({
        severity: "error",
        summary: "Error",
        detail: "No se pudieron importar o actualizar las respuestas.",
        life: 4500,
      });
    } finally {
      setImportando(false);
    }
  };

  const renderCamposEsperados = () => {
    if (!formularioActual) return null;

    if (!camposImportables.length) {
      return (
        <div className={styles.errorBox}>
          <h3>Formulario sin campos importables</h3>
          <p>
            Este formulario no tiene campos compatibles para importar desde
            Excel.
          </p>
        </div>
      );
    }

    return (
      <div className={styles.previewExcelBox}>
        <div className={styles.previewExcelHeader}>
          <h3>Campos esperados según el formulario</h3>
          <Tag
            value={`${camposImportables.length} campo${
              camposImportables.length === 1 ? "" : "s"
            }`}
            severity="info"
          />
        </div>

        <div className={styles.previewExcelTable}>
          <table>
            <thead>
              <tr>
                <th>Orden</th>
                <th>Campo del formulario</th>
                <th>Tipo</th>
                <th>Obligatorio</th>
              </tr>
            </thead>

            <tbody>
              {camposImportables.map((campo, index) => (
                <tr key={campo.id || index}>
                  <td>{campo.orden || index + 1}</td>
                  <td>{campo.label}</td>
                  <td>{campo.tipo || "texto"}</td>
                  <td>{campo.obligatorio ? "Sí" : "No"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <small>
          El Excel debe tener encabezados iguales o equivalentes a estos campos.
          Se ignoran los campos de tipo archivo, porque no pueden cargarse desde
          Excel.
        </small>
      </div>
    );
  };

  const cerrarPreview = () => {
    if (importando) return;
    setPreviewVisible(false);
  };

  const previewFooter = (
    <div
      style={{
        display: "flex",
        justifyContent: "flex-end",
        gap: 10,
        flexWrap: "wrap",
      }}
    >
      <Button
        label="Cancelar"
        icon="pi pi-times"
        severity="secondary"
        outlined
        onClick={cerrarPreview}
        disabled={importando}
      />

      <Button
        label="Confirmar e importar"
        icon="pi pi-check"
        severity="success"
        onClick={importarRespuestas}
        loading={importando}
        disabled={importando || filasPreview.length === 0}
      />
    </div>
  );

  return (
    <div className={styles.formWrapper}>
      <Toast ref={toast} />

      <div className={styles.sectionTitle}>
        <div>
          <h2>Importar respuestas desde Excel</h2>

          <p>
            Seleccioná un formulario y subí un Excel con columnas equivalentes a
            los campos creados. El sistema verificará los encabezados del Excel,
            cargará los datos correspondientes y actualizará la respuesta si el
            DNI ya existe para ese formulario. Antes de guardar, se mostrará una
            ventana de revisión para confirmar la importación.
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

      {formularioActual && renderCamposEsperados()}

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
            El Excel debe tener como encabezados los mismos campos del formulario
            seleccionado. Además, puede incluir <strong>Apellido</strong> y{" "}
            <strong>Nombre</strong> para mejorar la identificación de cada
            respuesta en la revisión.
          </p>
        </div>

        <div className={styles.importActions}>
          <Button
            label="Seleccionar Excel"
            icon="pi pi-file-excel"
            severity="success"
            outlined
            onClick={() => inputFileRef.current?.click()}
            disabled={
              !formularioSeleccionado ||
              leyendoExcel ||
              importando ||
              !camposImportables.length
            }
          />

          <Button
            label="Ver revisión"
            icon="pi pi-eye"
            severity="info"
            outlined
            onClick={() => setPreviewVisible(true)}
            disabled={
              leyendoExcel ||
              importando ||
              (!filasPreview.length && !errores.length && !advertencias.length)
            }
          />
        </div>
      </div>

      {leyendoExcel && (
        <div className={styles.loadingBox}>
          <ProgressSpinner />
          <span>Leyendo archivo Excel y verificando campos...</span>
        </div>
      )}

      <Dialog
        header="Revisión previa de importación"
        visible={previewVisible}
        style={{ width: "96vw", maxWidth: "1280px" }}
        modal
        footer={previewFooter}
        onHide={cerrarPreview}
      >
        <div className={styles.previewWrapper}>
          <div className={styles.selectedInfo}>
            <div>
              <strong>Formulario seleccionado</strong>
              <p>{formularioActual?.titulo || "—"}</p>
              <small>
                Código / ID del formulario:{" "}
                <strong>{formularioActual?.id || "—"}</strong>
              </small>
            </div>

            <div className={styles.tagGroup}>
              <Tag
                value={`${resumenPreview.totalValidas} filas válidas`}
                severity={resumenPreview.totalValidas ? "success" : "danger"}
              />
              <Tag
                value={`${resumenPreview.totalErrores} observaciones`}
                severity={resumenPreview.totalErrores ? "danger" : "success"}
              />
              <Tag
                value={`${resumenPreview.totalAdvertencias} advertencias`}
                severity={resumenPreview.totalAdvertencias ? "warning" : "info"}
              />
            </div>
          </div>

          {encabezadosExcel.length > 0 && (
            <div className={styles.previewExcelBox}>
              <div className={styles.previewExcelHeader}>
                <h3>Encabezados detectados en el Excel</h3>

                <Tag
                  value={`${encabezadosExcel.length} columna${
                    encabezadosExcel.length === 1 ? "" : "s"
                  }`}
                  severity="secondary"
                />
              </div>

              <p style={{ margin: 0, lineHeight: 1.6 }}>
                {encabezadosExcel.join(" | ")}
              </p>
            </div>
          )}

          {advertencias.length > 0 && (
            <div className={styles.errorBox}>
              <h3>Advertencias</h3>

              {advertencias.slice(0, 12).map((advertencia, index) => (
                <p key={index}>{advertencia}</p>
              ))}

              {advertencias.length > 12 && (
                <small>Hay más advertencias no mostradas.</small>
              )}
            </div>
          )}

          {errores.length > 0 && (
            <div className={styles.errorBox}>
              <h3>Observaciones detectadas</h3>

              {errores.slice(0, 16).map((error, index) => (
                <p key={index}>{error}</p>
              ))}

              {errores.length > 16 && (
                <small>Hay más observaciones no mostradas.</small>
              )}
            </div>
          )}

          {filasPreview.length > 0 ? (
            <div className={styles.previewExcelBox}>
              <div className={styles.previewExcelHeader}>
                <h3>Información que se va a cargar o actualizar</h3>

                <Tag
                  value={`${filasPreview.length} fila${
                    filasPreview.length === 1 ? "" : "s"
                  } válida${filasPreview.length === 1 ? "" : "s"}`}
                  severity="success"
                />
              </div>

              <div className={styles.previewExcelTable}>
                <table>
                  <thead>
                    <tr>
                      <th>Fila Excel</th>

                      {columnasPrincipalesPreview.map((columna) => (
                        <th key={columna.id}>{columna.label}</th>
                      ))}

                      {camposImportables.map((campo) => (
                        <th key={campo.id}>{campo.label}</th>
                      ))}
                    </tr>
                  </thead>

                  <tbody>
                    {filasPreview.slice(0, 50).map((fila, index) => (
                      <tr key={`${fila.filaExcel}-${fila.dni || index}`}>
                        <td>{fila.filaExcel}</td>

                        {columnasPrincipalesPreview.map((columna) => (
                          <td key={columna.id}>
                            {columna.obtenerValor(fila) || "—"}
                          </td>
                        ))}

                        {camposImportables.map((campo) => (
                          <td key={campo.id}>
                            {fila.respuestas?.[campo.label] || "—"}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {filasPreview.length > 50 && (
                <small>
                  Se muestran las primeras 50 filas. Al confirmar, se procesarán
                  todas las filas válidas.
                </small>
              )}
            </div>
          ) : (
            <div className={styles.emptyBox}>
              <i className="pi pi-exclamation-triangle" />
              <h3>No hay filas válidas para importar</h3>
              <p>
                Revisá las observaciones, corregí el Excel y volvé a subirlo.
              </p>
            </div>
          )}
        </div>
      </Dialog>
    </div>
  );
};

export default ImportarRespuestasExcelGestion;