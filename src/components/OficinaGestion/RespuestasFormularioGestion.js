// src/components/OficinaGestion/RespuestasFormularioGestion.js

import React, { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "primereact/button";
import { Dropdown } from "primereact/dropdown";
import { InputText } from "primereact/inputtext";
import { Dialog } from "primereact/dialog";
import { ProgressSpinner } from "primereact/progressspinner";
import { Tag } from "primereact/tag";
import { Toast } from "primereact/toast";
import { ConfirmDialog, confirmDialog } from "primereact/confirmdialog";

import JSZip from "jszip";
import * as XLSX from "xlsx";

import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  query,
  serverTimestamp,
  updateDoc,
  where,
  writeBatch,
} from "firebase/firestore";

import { getDownloadURL, ref as storageRef } from "firebase/storage";
import { db, storage } from "../../firebase/firebase-config";

import {
  AFILIACION_ESTADO,
  camposAfiliacionParaRespuesta,
  estadoAfiliacionDeRespuesta,
  etiquetaAfiliacion,
  normalizarDniAfiliacion,
  resumirVerificacion,
  textoAfiliacionParaExcel,
  verificarAfiliacionesPorDni,
} from "../../services/verificacionAfiliacionService";
import {
  COLOR_TARJETA,
  obtenerSelloPorColor,
  resolverColorRegistro,
  resolverEstadoGeneralPersona,
} from "../../services/configuracionVisualService";

import styles from "../../pages/Admin/OficinaGestion/OficinaGestionAdmin.module.css";

const CLASE_REGISTRO_POR_COLOR = {
  [COLOR_TARJETA.VERDE]: "registroAgrupadoVerde",
  [COLOR_TARJETA.AMARILLO]: "registroAgrupadoAmarillo",
  [COLOR_TARJETA.ROJO]: "registroAgrupadoRojo",
};

const CLASE_SELLO_POR_COLOR = {
  [COLOR_TARJETA.VERDE]: "selloRegistroVerde",
  [COLOR_TARJETA.AMARILLO]: "selloRegistroAmarillo",
  [COLOR_TARJETA.ROJO]: "selloRegistroRojo",
};

const CLASE_RESPUESTA_GENERAL_POR_COLOR = {
  [COLOR_TARJETA.VERDE]: "respuestaGeneralVerde",
  [COLOR_TARJETA.AMARILLO]: "respuestaGeneralAmarilla",
  [COLOR_TARJETA.ROJO]: "respuestaGeneralRoja",
};

const CLASE_TAG_GENERAL_POR_COLOR = {
  [COLOR_TARJETA.VERDE]: "tagEstadoGeneralVerde",
  [COLOR_TARJETA.AMARILLO]: "tagEstadoGeneralAmarillo",
  [COLOR_TARJETA.ROJO]: "tagEstadoGeneralRojo",
};

const ICONO_ESTADO_POR_COLOR = {
  [COLOR_TARJETA.VERDE]: "pi pi-check-circle",
  [COLOR_TARJETA.AMARILLO]: "pi pi-clock",
  [COLOR_TARJETA.ROJO]: "pi pi-times-circle",
};

// El padrón se consulta una sola vez por sesión de esta pantalla. Las
// respuestas históricas conservan sus datos originales; este mapa sólo sirve
// para mostrar la identidad correcta cuando una respuesta pública fue
// validada por DNI.
let identidadesPorDniCache = null;
let identidadesPorDniEnCurso = null;

const CLAVES_DNI_NORMALIZADAS = new Set([
  "dni",
  "documento",
  "nro dni",
  "numero de dni",
]);

const normalizarClaveRespuesta = (valor) => {
  return String(valor || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
};

const obtenerDniCandidatoRespuesta = (respuesta) => {
  const fuentes = [
    respuesta || {},
    respuesta?.respuestas || {},
    respuesta?.datosPersona || {},
  ];

  for (const fuente of fuentes) {
    const entrada = Object.entries(fuente).find(([clave, valor]) => {
      return CLAVES_DNI_NORMALIZADAS.has(normalizarClaveRespuesta(clave)) && valor;
    });

    if (entrada) return normalizarDniAfiliacion(entrada[1]);
  }

  const campoDni = Object.values(respuesta?.respuestasPorCampo || {}).find(
    (campo) =>
      CLAVES_DNI_NORMALIZADAS.has(normalizarClaveRespuesta(campo?.label)) &&
      campo?.valor
  );

  return normalizarDniAfiliacion(
    campoDni?.valor || respuesta?.identificador || ""
  );
};

const obtenerIdentidadPadron = (data = {}) => {
  const dni = normalizarDniAfiliacion(
    data.dni ||
      data.DNI ||
      data.documento ||
      data.Documento ||
      data.nroDni ||
      data.numeroDni ||
      ""
  );

  if (!dni) return null;

  return {
    dni,
    apellido: String(
      data.apellido || data.Apellido || data.apellidos || data.Apellidos || ""
    ).trim(),
    nombre: String(
      data.nombre || data.Nombre || data.nombres || data.Nombres || ""
    ).trim(),
    departamento: String(
      data.departamento ||
        data.Departamento ||
        data.depto ||
        data.dpto ||
        data.delegacion ||
        data.Delegacion ||
        ""
    ).trim(),
  };
};

const cargarIdentidadesPorDni = async () => {
  if (identidadesPorDniCache) return identidadesPorDniCache;

  if (!identidadesPorDniEnCurso) {
    identidadesPorDniEnCurso = Promise.all([
      getDocs(collection(db, "usuarios")),
      getDocs(collection(db, "nuevoAfiliado")),
    ])
      .then((colecciones) => {
        const identidades = new Map();

        colecciones.forEach((snapshot) => {
          snapshot.docs.forEach((docSnap) => {
            const identidad = obtenerIdentidadPadron(docSnap.data());
            if (!identidad) return;

            const existente = identidades.get(identidad.dni) || {};

            identidades.set(identidad.dni, {
              dni: identidad.dni,
              apellido: existente.apellido || identidad.apellido,
              nombre: existente.nombre || identidad.nombre,
              departamento: existente.departamento || identidad.departamento,
            });
          });
        });

        identidadesPorDniCache = identidades;
        return identidades;
      })
      .finally(() => {
        identidadesPorDniEnCurso = null;
      });
  }

  return identidadesPorDniEnCurso;
};

const ETIQUETA_ESTADO_POR_COLOR = {
  [COLOR_TARJETA.VERDE]: "Verde",
  [COLOR_TARJETA.AMARILLO]: "Amarillo",
  [COLOR_TARJETA.ROJO]: "Rojo",
};

const clasesConEstado = (claseBase, claseColor) =>
  [claseBase, claseColor ? styles[claseColor] : null]
    .filter(Boolean)
    .join(" ");

const RespuestasFormularioGestion = () => {
  const toast = useRef(null);

  const [formularios, setFormularios] = useState([]);
  const [formularioSeleccionado, setFormularioSeleccionado] = useState(null);
  const [respuestas, setRespuestas] = useState([]);
  const [respuestaDetalle, setRespuestaDetalle] = useState(null);
  const [busquedaRespuestas, setBusquedaRespuestas] = useState("");
  const [identidadesPorDni, setIdentidadesPorDni] = useState(() => new Map());

  const [loadingFormularios, setLoadingFormularios] = useState(false);
  const [loadingRespuestas, setLoadingRespuestas] = useState(false);
  const [procesandoId, setProcesandoId] = useState(null);
  const [descargandoZip, setDescargandoZip] = useState(false);
  const [procesandoEdicionMasiva, setProcesandoEdicionMasiva] = useState(false);

  // Verificación de afiliación. `preview` guarda el resultado ya calculado
  // para poder mostrarlo y confirmarlo sin volver a consultar el padrón.
  const [verificandoAfiliacion, setVerificandoAfiliacion] = useState(false);
  const [guardandoAfiliacion, setGuardandoAfiliacion] = useState(false);
  const [progresoAfiliacion, setProgresoAfiliacion] = useState(0);
  const [previewAfiliacion, setPreviewAfiliacion] = useState(null);

  const opcionesFormularios = useMemo(() => {
    return formularios.map((formulario) => ({
      label: formulario.titulo || "Formulario sin título",
      value: formulario.id,
    }));
  }, [formularios]);

  const formularioActual = useMemo(() => {
    return formularios.find(
      (formulario) => formulario.id === formularioSeleccionado
    );
  }, [formularios, formularioSeleccionado]);

  const normalizarTexto = (valor) => {
    return String(valor || "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .trim();
  };

  const aTextoBusqueda = (valor) => {
    if (valor === null || valor === undefined) return "";
    if (typeof valor === "boolean") return valor ? "si" : "no";

    if (Array.isArray(valor)) {
      return valor.map((item) => aTextoBusqueda(item)).join(" ");
    }

    if (typeof valor === "object") {
      return Object.entries(valor)
        .map(([key, item]) => `${key} ${aTextoBusqueda(item)}`)
        .join(" ");
    }

    return String(valor);
  };

  const sanitizarNombreArchivo = (valor, fallback = "archivo") => {
    const limpio = String(valor || fallback)
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[\\/:*?"<>|]+/g, "_")
      .replace(/\s+/g, "_")
      .replace(/_+/g, "_")
      .trim();

    return limpio || fallback;
  };

  const limpiarValorPersona = (valor = "") => {
    const texto = String(valor || "").trim();

    if (!texto || texto === "—" || texto.toLowerCase() === "undefined") {
      return "";
    }

    return texto;
  };

  const separarApellidoNombrePersona = (apellidoValor = "", nombreValor = "") => {
    let apellido = limpiarValorPersona(apellidoValor);
    let nombre = limpiarValorPersona(nombreValor);

    if (!apellido && nombre.includes(",")) {
      const partes = nombre.split(",");
      const posibleApellido = partes.shift()?.trim() || "";
      const posibleNombre = partes.join(",").trim();

      if (posibleApellido && posibleNombre) {
        apellido = posibleApellido;
        nombre = posibleNombre;
      }
    }

    if (apellido.includes(",") && !nombre) {
      const partes = apellido.split(",");
      const posibleApellido = partes.shift()?.trim() || "";
      const posibleNombre = partes.join(",").trim();

      if (posibleApellido && posibleNombre) {
        apellido = posibleApellido;
        nombre = posibleNombre;
      }
    }

    return { apellido, nombre };
  };

  const normalizarValorPrincipal = (valor) => {
    if (valor === null || valor === undefined || valor === "") return "";

    if (typeof valor === "boolean") return valor ? "Sí" : "No";

    if (Array.isArray(valor)) {
      return valor
        .map((item) => normalizarValorPrincipal(item))
        .filter(Boolean)
        .join(", ");
    }

    if (typeof valor === "object") {
      if (valor.label !== undefined) return normalizarValorPrincipal(valor.label);
      if (valor.nombre !== undefined) return normalizarValorPrincipal(valor.nombre);
      if (valor.value !== undefined) return normalizarValorPrincipal(valor.value);
      if (valor.valor !== undefined) return normalizarValorPrincipal(valor.valor);
      return JSON.stringify(valor);
    }

    return String(valor).trim();
  };

  const obtenerExtensionDesdeNombre = (nombre = "") => {
    const limpio = String(nombre || "").split("?")[0].split("#")[0];
    const partes = limpio.split(".");
    if (partes.length <= 1) return "";
    return partes.pop().toLowerCase();
  };

  const obtenerExtensionDesdeMime = (mime = "") => {
    const mapa = {
      "application/pdf": "pdf",
      "application/msword": "doc",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document":
        "docx",
      "application/vnd.ms-excel": "xls",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet":
        "xlsx",
      "image/jpeg": "jpg",
      "image/jpg": "jpg",
      "image/png": "png",
      "image/webp": "webp",
      "application/zip": "zip",
      "application/x-zip-compressed": "zip",
      "application/vnd.rar": "rar",
      "application/x-rar-compressed": "rar",
    };

    return mapa[String(mime || "").toLowerCase()] || "";
  };

  const obtenerUrlArchivo = (valor) => {
    if (!valor || typeof valor !== "object") return "";

    return (
      valor.url ||
      valor.downloadURL ||
      valor.archivoUrl ||
      valor.fileUrl ||
      valor.link ||
      valor.href ||
      ""
    );
  };

  const obtenerNombreArchivo = (valor, fallback = "archivo_adjunto") => {
    if (!valor || typeof valor !== "object") return fallback;

    return (
      valor.nombre ||
      valor.name ||
      valor.filename ||
      valor.fileName ||
      valor.originalName ||
      valor.path?.split("/")?.pop() ||
      valor.fullPath?.split("/")?.pop() ||
      fallback
    );
  };

  const obtenerPathStorageArchivo = (archivo) => {
    const path = archivo?.path || archivo?.fullPath || "";

    if (!path) return "";
    if (String(path).startsWith("http")) return "";

    return String(path).replace(/^\/+/, "");
  };

  const obtenerNombreArchivoOriginal = (archivo, indice = 1) => {
    const nombreBaseOriginal =
      obtenerNombreArchivo(archivo, "") ||
      archivo?.path?.split("/")?.pop() ||
      archivo?.fullPath?.split("/")?.pop() ||
      `archivo_${indice}`;

    const nombreSanitizado = sanitizarNombreArchivo(
      nombreBaseOriginal,
      `archivo_${indice}`
    );

    const extensionActual = obtenerExtensionDesdeNombre(nombreSanitizado);

    if (extensionActual) return `${indice}_${nombreSanitizado}`;

    const extensionPorPath = obtenerExtensionDesdeNombre(
      archivo?.path || archivo?.fullPath || ""
    );

    const extensionPorUrl = obtenerExtensionDesdeNombre(obtenerUrlArchivo(archivo));

    const extensionPorMime = obtenerExtensionDesdeMime(
      archivo?.tipo || archivo?.type || archivo?.mimeType || ""
    );

    const extensionFinal = extensionPorPath || extensionPorUrl || extensionPorMime;

    if (!extensionFinal) return `${indice}_${nombreSanitizado}`;

    return `${indice}_${nombreSanitizado}.${extensionFinal}`;
  };

  const esArchivoAdjunto = (valor) => {
    if (!valor || typeof valor !== "object") return false;
    return Boolean(obtenerUrlArchivo(valor) || obtenerPathStorageArchivo(valor));
  };

  const esListaDeArchivos = (valor) => {
    return (
      Array.isArray(valor) &&
      valor.length > 0 &&
      valor.some((item) => esArchivoAdjunto(item))
    );
  };

  const obtenerValorRespuesta = (respuesta, posiblesClaves = []) => {
    const datos = respuesta?.respuestas || {};
    const datosPersona = respuesta?.datosPersona || {};

    for (const clave of posiblesClaves) {
      if (respuesta?.[clave] !== undefined && respuesta?.[clave] !== null) {
        return respuesta[clave];
      }

      if (datos?.[clave] !== undefined && datos?.[clave] !== null) {
        return datos[clave];
      }

      if (datosPersona?.[clave] !== undefined && datosPersona?.[clave] !== null) {
        return datosPersona[clave];
      }
    }

    const clavesDatos = Object.keys(datos);

    for (const claveBuscada of posiblesClaves) {
      const claveNormalizada = normalizarTexto(claveBuscada);

      const claveEncontrada = clavesDatos.find(
        (key) => normalizarTexto(key) === claveNormalizada
      );

      if (claveEncontrada) return datos[claveEncontrada];
    }

    const clavePersonaEncontrada = posiblesClaves
      .map((claveBuscada) => normalizarTexto(claveBuscada))
      .map((claveNormalizada) =>
        Object.keys(datosPersona).find(
          (key) => normalizarTexto(key) === claveNormalizada
        )
      )
      .find(Boolean);

    if (clavePersonaEncontrada) return datosPersona[clavePersonaEncontrada];

    return "";
  };

  const obtenerValorRespuestaExacto = (respuesta, posiblesClaves = []) => {
    const fuentes = [
      respuesta?.respuestas || {},
      respuesta?.datosPersona || {},
    ];
    const respuestasPorCampo = Object.values(respuesta?.respuestasPorCampo || {});

    for (const clave of posiblesClaves) {
      const claveNormalizada = normalizarTexto(clave);

      for (const fuente of fuentes) {
        const encontrada = Object.entries(fuente).find(([key, value]) => {
          return normalizarTexto(key) === claveNormalizada && value !== "";
        });

        if (encontrada) return encontrada[1];
      }

      const desdeCampo = respuestasPorCampo.find((campo) => {
        return (
          normalizarTexto(campo?.label) === claveNormalizada &&
          campo?.valor !== undefined &&
          campo?.valor !== null &&
          campo?.valor !== ""
        );
      });

      if (desdeCampo) {
        return desdeCampo.valorLegible ?? desdeCampo.valor;
      }
    }

    return "";
  };

  const obtenerDniRespuesta = (respuesta) => {
    return normalizarDniAfiliacion(
      obtenerValorRespuestaExacto(respuesta, [
        "DNI",
        "Documento",
        "Nro DNI",
        "Numero de DNI",
      ]) ||
        respuesta?.dni ||
        respuesta?.DNI ||
        respuesta?.identificador ||
        ""
    );
  };

  const esRespuestaPublicaValidadaPorDni = (respuesta) => {
    return Boolean(
      respuesta?.origen === "formulario_publico" &&
        (formularioActual?.requiereValidacionDni ||
          formularioActual?.campos?.some(
            (campo) => campo.tipo === "validacion_dni"
          ))
    );
  };

  const resolverDatosPersonaRespuesta = (respuesta) => {
    const dni = obtenerDniRespuesta(respuesta);
    const identidad = dni ? identidadesPorDni.get(dni) : null;

    const apellidoExacto = normalizarValorPrincipal(
      obtenerValorRespuestaExacto(respuesta, ["Apellido", "Apellidos"])
    );
    const nombreExacto = normalizarValorPrincipal(
      obtenerValorRespuestaExacto(respuesta, ["Nombre", "Nombres"])
    );
    const departamentoExacto = normalizarValorPrincipal(
      obtenerValorRespuestaExacto(respuesta, [
        "Departamento",
        "Depto",
        "Dpto",
        "Delegacion",
      ])
    );

    const apellidoHistorico = normalizarValorPrincipal(
      respuesta?.apellido || respuesta?.apellidos
    );
    const nombreHistorico = normalizarValorPrincipal(
      respuesta?.nombre || respuesta?.nombres
    );
    const departamentoHistorico = normalizarValorPrincipal(
      respuesta?.departamento || respuesta?.depto || respuesta?.dpto
    );

    const persona = separarApellidoNombrePersona(
      identidad?.apellido || apellidoExacto || apellidoHistorico,
      identidad?.nombre || nombreExacto || nombreHistorico
    );

    return {
      apellido: persona.apellido || "â€”",
      nombre: persona.nombre || "â€”",
      dni: dni || "â€”",
      departamento:
        identidad?.departamento || departamentoExacto || departamentoHistorico || "â€”",
    };
  };

  const obtenerOrigenRespuesta = (respuesta) => {
    const origen = respuesta?.origen || "sin_origen";

    const mapa = {
      importacion_excel: { label: "Excel", severity: "warning" },
      formulario_publico: { label: "Formulario público", severity: "success" },
      sin_origen: { label: "Sin origen", severity: "secondary" },
    };

    return mapa[origen] || { label: origen, severity: "info" };
  };

  const convertirFecha = (value) => {
    if (!value) return null;

    try {
      if (value.toDate) return value.toDate();

      if (typeof value === "object" && typeof value.seconds === "number") {
        return new Date(value.seconds * 1000);
      }

      return new Date(value);
    } catch {
      return null;
    }
  };

  const formatearFecha = (value) => {
    const fecha = convertirFecha(value);

    if (!fecha || Number.isNaN(fecha.getTime())) return "—";

    return fecha.toLocaleString("es-AR", {
      dateStyle: "short",
      timeStyle: "short",
    });
  };

  const ordenarPorFechaDesc = (items) => {
    return [...items].sort((a, b) => {
      const fechaA = convertirFecha(a.createdAt)?.getTime() || 0;
      const fechaB = convertirFecha(b.createdAt)?.getTime() || 0;
      return fechaB - fechaA;
    });
  };

  const descargarBlob = (blob, nombreArchivo) => {
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = url;
    link.download = nombreArchivo;

    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    setTimeout(() => window.URL.revokeObjectURL(url), 1000);
  };

  const cargarFormularios = async () => {
    setLoadingFormularios(true);

    try {
      const q = query(collection(db, "oficina_gestion_formularios"));
      const snap = await getDocs(q);

      const data = snap.docs.map((docSnap) => ({
        id: docSnap.id,
        ...docSnap.data(),
      }));

      const ordenados = ordenarPorFechaDesc(data);

      setFormularios(ordenados);

      if (ordenados.length > 0) {
        setFormularioSeleccionado((actual) => actual || ordenados[0].id);
      } else {
        setFormularioSeleccionado(null);
      }
    } catch (error) {
      console.error("Error al cargar formularios:", error);

      setFormularios([]);
      setFormularioSeleccionado(null);

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

  const cargarRespuestas = async (formularioId) => {
    if (!formularioId) {
      setRespuestas([]);
      return;
    }

    setLoadingRespuestas(true);

    try {
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
            ...docSnap.data(),
          });
        });
      }

      setRespuestas(ordenarPorFechaDesc(Array.from(respuestasMap.values())));
    } catch (error) {
      console.error("Error al cargar respuestas:", error);

      setRespuestas([]);

      toast.current?.show({
        severity: "error",
        summary: "Error",
        detail: "No se pudieron cargar las respuestas.",
        life: 3500,
      });
    } finally {
      setLoadingRespuestas(false);
    }
  };

  useEffect(() => {
    cargarFormularios();
  }, []);

  useEffect(() => {
    setBusquedaRespuestas("");
    cargarRespuestas(formularioSeleccionado);
  }, [formularioSeleccionado]);

  useEffect(() => {
    let activa = true;
    const requiereValidacionDni = Boolean(
      formularioActual?.requiereValidacionDni ||
        formularioActual?.campos?.some(
          (campo) => campo.tipo === "validacion_dni"
        )
    );
    const hayRespuestasPublicasConDni = respuestas.some(
      (respuesta) =>
        respuesta?.origen === "formulario_publico" &&
        Boolean(obtenerDniCandidatoRespuesta(respuesta))
    );

    if (!requiereValidacionDni || !hayRespuestasPublicasConDni) {
      setIdentidadesPorDni(new Map());
      return () => {
        activa = false;
      };
    }

    cargarIdentidadesPorDni()
      .then((identidades) => {
        if (activa) setIdentidadesPorDni(identidades);
      })
      .catch((error) => {
        console.error("No se pudo cargar el padrÃ³n para respuestas histÃ³ricas:", error);
        if (activa) setIdentidadesPorDni(new Map());
      });

    return () => {
      activa = false;
    };
  }, [formularioActual, respuestas]);

  const obtenerDatosPrincipales = (respuesta) => {
    if (esRespuestaPublicaValidadaPorDni(respuesta)) {
      const datosResueltos = resolverDatosPersonaRespuesta(respuesta);

      return {
        ...datosResueltos,
        presentoDocumentacion:
          obtenerValorRespuesta(respuesta, [
            "presentoDocumentacion",
            "PresentÃ³ documentaciÃ³n",
            "Presento documentacion",
            "PresentÃ³ documentaciÃ³n (SI)",
            "Documentacion",
            "DocumentaciÃ³n",
            "Documentacion SI",
            "DOCUMENTACIÃ“N PRESENTADA",
            "DOCUMENTACION PRESENTADA",
            "DocumentaciÃ³n presentada",
            "Documentacion presentada",
          ]) || "â€”",
      };
    }

    const apellidoOriginal = normalizarValorPrincipal(
      obtenerValorRespuesta(respuesta, ["apellido", "Apellido", "Apellidos"])
    );

    const nombreOriginal = normalizarValorPrincipal(
      obtenerValorRespuesta(respuesta, ["nombre", "Nombre", "Nombres"])
    );

    const personaNormalizada = separarApellidoNombrePersona(
      apellidoOriginal,
      nombreOriginal
    );

    const apellido = personaNormalizada.apellido || "—";
    const nombre = personaNormalizada.nombre || "—";

    const dni =
      obtenerValorRespuesta(respuesta, [
        "dni",
        "DNI",
        "Documento",
        "Nro DNI",
        "N° DNI",
        "Nº DNI",
        "Número de DNI",
        "Numero de DNI",
      ]) || "—";

    const departamento =
      obtenerValorRespuesta(respuesta, [
        "departamento",
        "Departamento",
        "Depto",
        "Dpto",
        "Delegación",
        "Delegacion",
      ]) || "—";

    const presentoDocumentacion =
      obtenerValorRespuesta(respuesta, [
        "presentoDocumentacion",
        "Presentó documentación",
        "Presento documentacion",
        "Presentó documentación (SI)",
        "Documentacion",
        "Documentación",
        "Documentacion SI",
        "DOCUMENTACIÓN PRESENTADA",
        "DOCUMENTACION PRESENTADA",
        "Documentación presentada",
        "Documentacion presentada",
      ]) || "—";

    return {
      apellido,
      nombre,
      dni,
      departamento,
      presentoDocumentacion,
    };
  };

  const armarNombrePersonaZip = (respuesta, index = 1) => {
    const datos = obtenerDatosPrincipales(respuesta);

    const dni = sanitizarNombreArchivo(datos.dni || "sin_dni");
    const apellido = sanitizarNombreArchivo(datos.apellido || "sin_apellido");
    const nombre = sanitizarNombreArchivo(datos.nombre || `respuesta_${index}`);

    return `${dni}_${apellido}_${nombre}.zip`;
  };

  const obtenerResumenRespuesta = (respuesta) => {
    const datos = obtenerDatosPrincipales(respuesta);

    return `Apellido: ${datos.apellido} | Nombre: ${datos.nombre} | DNI: ${datos.dni} | Departamento: ${datos.departamento} | Presentó documentación: ${datos.presentoDocumentacion}`;
  };

  const renderValorDetalle = (value) => {
    if (value === null || value === undefined || value === "") return "—";
    if (typeof value === "boolean") return value ? "Sí" : "No";

    if (esArchivoAdjunto(value)) {
      const url = obtenerUrlArchivo(value);

      return (
        <div className={styles.detalleArchivosBox || ""}>
          <div className={styles.detalleArchivoRow || ""}>
            <span>1.</span>

            {url ? (
              <a href={url} target="_blank" rel="noreferrer">
                {obtenerNombreArchivo(value, "Archivo adjunto")}
              </a>
            ) : (
              <span>{obtenerNombreArchivo(value, "Archivo adjunto")}</span>
            )}
          </div>
        </div>
      );
    }

    if (esListaDeArchivos(value)) {
      return (
        <div className={styles.detalleArchivosBox || ""}>
          {value
            .filter((archivo) => esArchivoAdjunto(archivo))
            .map((archivo, index) => {
              const url = obtenerUrlArchivo(archivo);

              return (
                <div
                  key={`${obtenerNombreArchivo(archivo)}-${index}`}
                  className={styles.detalleArchivoRow || ""}
                >
                  <span>{index + 1}.</span>

                  {url ? (
                    <a href={url} target="_blank" rel="noreferrer">
                      {obtenerNombreArchivo(archivo, `Archivo ${index + 1}`)}
                    </a>
                  ) : (
                    <span>
                      {obtenerNombreArchivo(archivo, `Archivo ${index + 1}`)}
                    </span>
                  )}
                </div>
              );
            })}
        </div>
      );
    }

    if (Array.isArray(value)) {
      if (value.length === 0) return "—";

      return (
        <div className={styles.detalleListaSimple || ""}>
          {value.map((item, index) => (
            <div key={index} className={styles.detalleListaRow || ""}>
              {index + 1}. {String(item)}
            </div>
          ))}
        </div>
      );
    }

    if (typeof value === "object") return JSON.stringify(value, null, 2);

    return String(value);
  };

  const obtenerCamposOrdenadosDetalle = (respuesta) => {
    const datos = respuesta?.respuestas || {};
    const archivos = respuesta?.archivos || {};
    const respuestasPorCampo = respuesta?.respuestasPorCampo || {};
    const principales = obtenerDatosPrincipales(respuesta);

    const camposPrincipales = [
      { label: "Apellido", value: principales.apellido },
      { label: "Nombre", value: principales.nombre },
      { label: "DNI", value: principales.dni },
      { label: "Departamento", value: principales.departamento },
      {
        label: "Presentó documentación",
        value: principales.presentoDocumentacion,
      },
    ];

    const clavesPrincipalesNormalizadas = [
      "apellido",
      "apellidos",
      "nombre",
      "nombres",
      "dni",
      "documento",
      "nro dni",
      "n° dni",
      "nº dni",
      "numero de dni",
      "número de dni",
      "departamento",
      "depto",
      "dpto",
      "delegacion",
      "presentodocumentacion",
      "presento documentacion",
      "presento documentacion (si)",
      "presentó documentación",
      "documentacion",
      "documentación",
      "documentacion si",
      "documentación presentada",
    ];

    const extrasDesdeRespuestas = Object.entries(datos)
      .filter(([key]) => {
        const keyNormalizada = normalizarTexto(key).replace(/\s+/g, " ");
        const keySinEspacios = keyNormalizada.replace(/\s+/g, "");

        return !clavesPrincipalesNormalizadas.some((principal) => {
          const principalNormalizado = normalizarTexto(principal);
          const principalSinEspacios = principalNormalizado.replace(/\s+/g, "");

          return (
            keyNormalizada === principalNormalizado ||
            keySinEspacios === principalSinEspacios
          );
        });
      })
      .filter(([key]) => normalizarTexto(key) !== "archivo adjunto")
      .map(([key, value]) => ({ label: key, value }));

    const archivosPlanos = [];
    const archivosMap = new Map();

    const agregarArchivoPlano = (archivo) => {
      if (!esArchivoAdjunto(archivo)) return;

      const clave =
        obtenerUrlArchivo(archivo) ||
        obtenerPathStorageArchivo(archivo) ||
        obtenerNombreArchivo(archivo);

      if (archivosMap.has(clave)) return;

      archivosMap.set(clave, true);
      archivosPlanos.push(archivo);
    };

    Object.values(archivos).forEach((archivosCampo) => {
      if (Array.isArray(archivosCampo)) {
        archivosCampo.forEach((archivo) => agregarArchivoPlano(archivo));
      } else {
        agregarArchivoPlano(archivosCampo);
      }
    });

    Object.values(respuestasPorCampo).forEach((campo) => {
      if (
        (campo?.tipo === "archivo" || campo?.tipo === "archivo_pdf") &&
        Array.isArray(campo?.valor)
      ) {
        campo.valor.forEach((archivo) => agregarArchivoPlano(archivo));
      }
    });

    const existeCampoAdjunto = extrasDesdeRespuestas.some((item) => {
      const label = normalizarTexto(item.label);

      return (
        label.includes("adjuntar") ||
        label.includes("documentacion") ||
        label.includes("documentación") ||
        esListaDeArchivos(item.value) ||
        esArchivoAdjunto(item.value)
      );
    });

    const extrasFinales = [...extrasDesdeRespuestas];

    if (archivosPlanos.length > 0 && !existeCampoAdjunto) {
      extrasFinales.push({
        label: "adjuntar documentación",
        value: archivosPlanos,
      });
    }

    return [...camposPrincipales, ...extrasFinales];
  };

  const extraerArchivosRespuesta = (respuesta) => {
    const archivosExtraidos = [];
    const archivosMap = new Map();

    const agregarArchivo = (archivo, campo = "adjuntar documentación") => {
      if (!archivo || typeof archivo !== "object") return;

      const url = obtenerUrlArchivo(archivo);
      const path = obtenerPathStorageArchivo(archivo);

      if (!url && !path) return;

      const nombre = obtenerNombreArchivo(archivo, "archivo_adjunto");
      const clave = url || path || nombre;

      if (archivosMap.has(clave)) return;

      archivosMap.set(clave, true);

      archivosExtraidos.push({
        campo,
        nombre,
        tipo: archivo.tipo || archivo.type || archivo.mimeType || "",
        size: archivo.size || archivo.tamano || archivo.tamaño || 0,
        path,
        fullPath: archivo.fullPath || "",
        url,
      });
    };

    const recorrerValor = (valor, campo = "adjuntar documentación") => {
      if (!valor) return;

      if (Array.isArray(valor)) {
        valor.forEach((item) => recorrerValor(item, campo));
        return;
      }

      if (typeof valor === "object") {
        if (esArchivoAdjunto(valor)) {
          agregarArchivo(valor, campo);
          return;
        }

        Object.entries(valor).forEach(([key, item]) => {
          recorrerValor(item, key || campo);
        });
      }
    };

    Object.entries(respuesta?.archivos || {}).forEach(([campoId, archivos]) => {
      recorrerValor(archivos, campoId);
    });

    Object.values(respuesta?.respuestasPorCampo || {}).forEach((campo) => {
      if (campo?.tipo === "archivo" || campo?.tipo === "archivo_pdf") {
        recorrerValor(campo?.valor, campo?.label || "adjuntar documentación");
      }
    });

    Object.entries(respuesta?.respuestas || {}).forEach(([key, value]) => {
      recorrerValor(value, key);
    });

    recorrerValor(respuesta, "adjuntar documentación");

    return archivosExtraidos;
  };

  const valorPlanoParaExcel = (value) => {
    if (value === null || value === undefined || value === "") return "";
    if (typeof value === "boolean") return value ? "Sí" : "No";

    if (esArchivoAdjunto(value)) {
      return `${obtenerNombreArchivo(value, "Archivo adjunto")} - ${
        obtenerUrlArchivo(value) || obtenerPathStorageArchivo(value)
      }`;
    }

    if (esListaDeArchivos(value)) {
      return value
        .filter((archivo) => esArchivoAdjunto(archivo))
        .map(
          (archivo, index) =>
            `${index + 1}. ${obtenerNombreArchivo(
              archivo,
              "Archivo adjunto"
            )} - ${obtenerUrlArchivo(archivo) || obtenerPathStorageArchivo(archivo)}`
        )
        .join("\n");
    }

    if (Array.isArray(value)) {
      return value
        .map((item, index) => {
          if (esArchivoAdjunto(item)) {
            return `${index + 1}. ${obtenerNombreArchivo(
              item,
              "Archivo adjunto"
            )} - ${obtenerUrlArchivo(item) || obtenerPathStorageArchivo(item)}`;
          }

          return String(item);
        })
        .join("\n");
    }

    if (typeof value === "object") return JSON.stringify(value);

    return String(value);
  };

  const construirFilaExcel = (respuesta, index) => {
    const origen = obtenerOrigenRespuesta(respuesta);
    const datosPrincipales = obtenerDatosPrincipales(respuesta);
    const camposDetalle = obtenerCamposOrdenadosDetalle(respuesta);
    const adjuntos = extraerArchivosRespuesta(respuesta);

    const fila = {
      "N°": index + 1,
      "ID respuesta": respuesta.id || "",
      Formulario: respuesta.formularioTitulo || formularioActual?.titulo || "",
      "Código / ID formulario":
        respuesta.formularioCodigo ||
        respuesta.formularioNumero ||
        respuesta.formularioId ||
        formularioActual?.id ||
        "",
      "Fecha de carga": formatearFecha(respuesta.createdAt),
      "Última actualización": formatearFecha(respuesta.updatedAt),
      Origen: origen.label,
      "Edición afiliado": respuesta.edicionAfiliadoHabilitada
        ? "Habilitada"
        : "No habilitada",
      "Editado por afiliado": respuesta.editadoPorAfiliado ? "Sí" : "No",
      "Fecha edición afiliado": respuesta.editadoPorAfiliadoAt
        ? formatearFecha(respuesta.editadoPorAfiliadoAt)
        : "",
      Apellido: datosPrincipales.apellido,
      Nombre: datosPrincipales.nombre,
      DNI: datosPrincipales.dni,
      // SI / NO / SIN VERIFICAR. Nunca `esAfiliado ? "SI" : "NO"`: eso
      // convertiría un campo ausente —todavía sin verificar— en un "NO".
      Afiliado: textoAfiliacionParaExcel(respuesta),
      Departamento: datosPrincipales.departamento,
      "Presentó documentación": datosPrincipales.presentoDocumentacion,
      "Cantidad de archivos adjuntos": adjuntos.length,
    };

    camposDetalle.forEach((campo) => {
      const nombreColumna = campo.label || "Campo sin nombre";

      if (fila[nombreColumna] === undefined || fila[nombreColumna] === "") {
        fila[nombreColumna] = valorPlanoParaExcel(campo.value);
      }
    });

    if (adjuntos.length > 0) {
      fila["Archivos adjuntos"] = adjuntos
        .map(
          (archivo, i) =>
            `${i + 1}. ${archivo.nombre} - ${archivo.url || archivo.path}`
        )
        .join("\n");
    }

    return fila;
  };

  const descargarUrlComoArrayBuffer = async (
    url,
    nombre = "archivo_adjunto"
  ) => {
    if (!url) throw new Error(`El archivo no tiene URL de descarga: ${nombre}`);

    try {
      const response = await fetch(url, {
        method: "GET",
        cache: "no-store",
      });

      if (!response.ok) throw new Error(`No se pudo descargar: ${nombre}`);

      return await response.arrayBuffer();
    } catch (fetchError) {
      return new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();

        xhr.open("GET", url, true);
        xhr.responseType = "arraybuffer";

        xhr.onload = () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            resolve(xhr.response);
          } else {
            reject(
              new Error(
                `No se pudo descargar ${nombre}. Estado HTTP: ${xhr.status}`
              )
            );
          }
        };

        xhr.onerror = () => reject(fetchError);
        xhr.send();
      });
    }
  };

  const descargarArchivoComoArrayBuffer = async (archivo) => {
    const nombre = archivo?.nombre || archivo?.name || "archivo_adjunto";
    const pathStorage = obtenerPathStorageArchivo(archivo);

    if (pathStorage) {
      try {
        const archivoRef = storageRef(storage, pathStorage);
        const urlDesdeStorage = await getDownloadURL(archivoRef);

        return await descargarUrlComoArrayBuffer(urlDesdeStorage, nombre);
      } catch (errorStorage) {
        console.warn(
          "No se pudo obtener/descargar por Firebase Storage path. Se intentará por URL guardada:",
          { nombre, pathStorage, error: errorStorage }
        );
      }
    }

    const url = obtenerUrlArchivo(archivo) || archivo?.url;

    return await descargarUrlComoArrayBuffer(url, nombre);
  };

  const agregarAdjuntosAlZip = async (carpetaAdjuntos, adjuntos) => {
    if (adjuntos.length === 0) {
      carpetaAdjuntos.file(
        "_sin_archivos.txt",
        "Esta respuesta no tiene archivos adjuntos."
      );

      return;
    }

    for (let i = 0; i < adjuntos.length; i += 1) {
      const archivo = adjuntos[i];
      const nombreArchivo = obtenerNombreArchivoOriginal(archivo, i + 1);

      try {
        const arrayBuffer = await descargarArchivoComoArrayBuffer(archivo);

        carpetaAdjuntos.file(nombreArchivo, arrayBuffer, { binary: true });
      } catch (error) {
        console.error("Error al descargar archivo adjunto:", error);

        carpetaAdjuntos.file(
          `${i + 1}_ERROR_DESCARGA_${nombreArchivo}.txt`,
          [
            "No se pudo descargar automáticamente este archivo.",
            `Nombre: ${archivo.nombre || archivo.name || "archivo_adjunto"}`,
            `Campo: ${archivo.campo || "adjuntar documentación"}`,
            `Path Storage: ${archivo.path || archivo.fullPath || "Sin path"}`,
            `URL: ${obtenerUrlArchivo(archivo) || archivo.url || "Sin URL"}`,
            "",
            "Si este error aparece, verifique que el archivo exista en Firebase Storage y que el path esté guardado correctamente en Firestore.",
          ].join("\n")
        );
      }
    }
  };

  const descargarRespuestaIndividual = async (respuesta, index = 0) => {
    if (!respuesta?.id) {
      toast.current?.show({
        severity: "warn",
        summary: "Sin respuesta",
        detail: "No se encontró la respuesta para descargar.",
        life: 3500,
      });

      return;
    }

    setProcesandoId(respuesta.id);

    try {
      const zip = new JSZip();

      const datos = obtenerDatosPrincipales(respuesta);
      const adjuntos = extraerArchivosRespuesta(respuesta);
      const camposDetalle = obtenerCamposOrdenadosDetalle(respuesta);
      const nombreZip = armarNombrePersonaZip(respuesta, index + 1);

      const filaExcel = construirFilaExcel(respuesta, index);

      const workbook = XLSX.utils.book_new();
      const worksheet = XLSX.utils.json_to_sheet([filaExcel]);

      XLSX.utils.book_append_sheet(workbook, worksheet, "Respuesta");

      const excelBuffer = XLSX.write(workbook, {
        bookType: "xlsx",
        type: "array",
      });

      zip.file("respuesta.xlsx", excelBuffer);

      zip.file(
        "respuesta.json",
        JSON.stringify(
          {
            id: respuesta.id,
            formulario:
              respuesta.formularioTitulo || formularioActual?.titulo || "",
            codigoFormulario:
              respuesta.formularioCodigo ||
              respuesta.formularioNumero ||
              respuesta.formularioId ||
              formularioActual?.id ||
              "",
            fechaCarga: formatearFecha(respuesta.createdAt),
            ultimaActualizacion: formatearFecha(respuesta.updatedAt),
            apellido: datos.apellido,
            nombre: datos.nombre,
            dni: datos.dni,
            departamento: datos.departamento,
            presentoDocumentacion: datos.presentoDocumentacion,
            campos: camposDetalle,
            adjuntos,
            raw: respuesta,
          },
          null,
          2
        )
      );

      const resumenTxt = [
        `Formulario: ${
          respuesta.formularioTitulo || formularioActual?.titulo || "Sin título"
        }`,
        `Código / ID formulario: ${
          respuesta.formularioCodigo ||
          respuesta.formularioNumero ||
          respuesta.formularioId ||
          formularioActual?.id ||
          "—"
        }`,
        `Apellido: ${datos.apellido}`,
        `Nombre: ${datos.nombre}`,
        `DNI: ${datos.dni}`,
        `Departamento: ${datos.departamento}`,
        `Presentó documentación: ${datos.presentoDocumentacion}`,
        `Fecha de carga: ${formatearFecha(respuesta.createdAt)}`,
        `Última actualización: ${formatearFecha(respuesta.updatedAt)}`,
        `Cantidad de archivos adjuntos: ${adjuntos.length}`,
        `Fecha de descarga: ${new Date().toLocaleString("es-AR")}`,
      ].join("\n");

      zip.file("resumen.txt", resumenTxt);

      const carpetaAdjuntos = zip.folder("archivos_adjuntos");

      await agregarAdjuntosAlZip(carpetaAdjuntos, adjuntos);

      const zipBlob = await zip.generateAsync({ type: "blob" });

      descargarBlob(zipBlob, nombreZip);

      toast.current?.show({
        severity: "success",
        summary: "Descarga generada",
        detail: `Se descargó el ZIP ${nombreZip}`,
        life: 4500,
      });
    } catch (error) {
      console.error("Error al descargar respuesta individual:", error);

      toast.current?.show({
        severity: "error",
        summary: "Error",
        detail: "No se pudo generar el ZIP de esta respuesta.",
        life: 5000,
      });
    } finally {
      setProcesandoId(null);
    }
  };

  const descargarFormularioCompleto = async () => {
    if (!formularioActual || respuestas.length === 0) {
      toast.current?.show({
        severity: "warn",
        summary: "Sin respuestas",
        detail: "No hay respuestas para descargar en este formulario.",
        life: 3500,
      });

      return;
    }

    setDescargandoZip(true);

    try {
      const zip = new JSZip();

      const nombreFormulario = sanitizarNombreArchivo(
        formularioActual.titulo || "formulario"
      );

      const carpetaFormulario = zip.folder(nombreFormulario);
      const carpetaAdjuntos = carpetaFormulario.folder("archivos_adjuntos");

      const filasExcel = respuestas.map((respuesta, index) =>
        construirFilaExcel(respuesta, index)
      );

      const workbook = XLSX.utils.book_new();
      const worksheet = XLSX.utils.json_to_sheet(filasExcel);

      XLSX.utils.book_append_sheet(workbook, worksheet, "Respuestas");

      const excelBuffer = XLSX.write(workbook, {
        bookType: "xlsx",
        type: "array",
      });

      carpetaFormulario.file("respuestas.xlsx", excelBuffer);

      carpetaFormulario.file(
        "respuestas.json",
        JSON.stringify(respuestas, null, 2)
      );

      const resumenTxt = [
        `Formulario: ${formularioActual.titulo || "Sin título"}`,
        `Código / ID: ${formularioActual.id}`,
        `Total de respuestas: ${respuestas.length}`,
        `Fecha de descarga: ${new Date().toLocaleString("es-AR")}`,
      ].join("\n");

      carpetaFormulario.file("resumen.txt", resumenTxt);

      for (let i = 0; i < respuestas.length; i += 1) {
        const respuesta = respuestas[i];
        const nombreZipPersona = armarNombrePersonaZip(respuesta, i + 1);
        const nombreCarpetaPersona = nombreZipPersona.replace(/\.zip$/i, "");
        const adjuntos = extraerArchivosRespuesta(respuesta);

        const carpetaRespuesta = carpetaAdjuntos.folder(nombreCarpetaPersona);

        await agregarAdjuntosAlZip(carpetaRespuesta, adjuntos);
      }

      const zipBlob = await zip.generateAsync({ type: "blob" });

      const nombreZip = sanitizarNombreArchivo(
        `respuestas_${nombreFormulario}_${new Date()
          .toISOString()
          .slice(0, 10)}.zip`
      );

      descargarBlob(zipBlob, nombreZip);

      toast.current?.show({
        severity: "success",
        summary: "Descarga generada",
        detail:
          "Se descargó un ZIP con el Excel de respuestas y los archivos adjuntos.",
        life: 5000,
      });
    } catch (error) {
      console.error("Error al generar ZIP:", error);

      toast.current?.show({
        severity: "error",
        summary: "Error",
        detail: "No se pudo generar la descarga del formulario.",
        life: 5000,
      });
    } finally {
      setDescargandoZip(false);
    }
  };

  const cambiarEstadoEdicionAfiliado = async (respuesta, habilitar) => {
    if (!respuesta?.id) return;

    setProcesandoId(respuesta.id);

    try {
      const payload = {
        edicionAfiliadoHabilitada: habilitar,
        updatedAt: serverTimestamp(),
      };

      if (habilitar) {
        payload.edicionAfiliadoHabilitadaAt = serverTimestamp();
        payload.edicionAfiliadoDeshabilitadaAt = null;
      } else {
        payload.edicionAfiliadoHabilitadaAt = null;
        payload.edicionAfiliadoDeshabilitadaAt = serverTimestamp();
      }

      await updateDoc(
        doc(db, "oficina_gestion_respuestas", respuesta.id),
        payload
      );

      toast.current?.show({
        severity: "success",
        summary: habilitar ? "Edición habilitada" : "Edición deshabilitada",
        detail: habilitar
          ? "El afiliado ya puede editar su formulario desde el link público."
          : "El afiliado ya no podrá editar su formulario.",
        life: 4000,
      });

      await cargarRespuestas(formularioSeleccionado);
    } catch (error) {
      console.error("Error al cambiar estado de edición:", error);

      toast.current?.show({
        severity: "error",
        summary: "Error",
        detail: "No se pudo actualizar el permiso de edición.",
        life: 3500,
      });
    } finally {
      setProcesandoId(null);
    }
  };

  const confirmarCambioEstadoEdicion = (respuesta) => {
    const datos = obtenerDatosPrincipales(respuesta);
    const habilitar = !respuesta.edicionAfiliadoHabilitada;

    confirmDialog({
      message: habilitar
        ? `¿Desea habilitar la edición para ${datos.apellido} ${datos.nombre} - DNI ${datos.dni}? El afiliado podrá modificar su formulario desde el link público.`
        : `¿Desea deshabilitar la edición para ${datos.apellido} ${datos.nombre} - DNI ${datos.dni}?`,
      header: habilitar ? "Habilitar edición" : "Deshabilitar edición",
      icon: "pi pi-exclamation-triangle",
      acceptLabel: habilitar ? "Sí, habilitar" : "Sí, deshabilitar",
      rejectLabel: "Cancelar",
      acceptClassName: habilitar ? "p-button-success" : "p-button-warning",
      accept: () => cambiarEstadoEdicionAfiliado(respuesta, habilitar),
    });
  };

  const cambiarEstadoEdicionMasiva = async (habilitar) => {
    if (!formularioSeleccionado || respuestas.length === 0) {
      toast.current?.show({
        severity: "warn",
        summary: "Sin respuestas",
        detail: "No hay respuestas para actualizar.",
        life: 3500,
      });

      return;
    }

    setProcesandoEdicionMasiva(true);

    try {
      const tamañoLote = 450;

      for (let i = 0; i < respuestas.length; i += tamañoLote) {
        const lote = respuestas.slice(i, i + tamañoLote);
        const batch = writeBatch(db);

        lote.forEach((respuesta) => {
          if (!respuesta?.id) return;

          const respuestaRef = doc(
            db,
            "oficina_gestion_respuestas",
            respuesta.id
          );

          batch.update(respuestaRef, {
            edicionAfiliadoHabilitada: habilitar,
            edicionAfiliadoHabilitadaAt: habilitar ? serverTimestamp() : null,
            edicionAfiliadoDeshabilitadaAt: habilitar
              ? null
              : serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
        });

        await batch.commit();
      }

      toast.current?.show({
        severity: "success",
        summary: habilitar
          ? "Edición masiva habilitada"
          : "Edición masiva deshabilitada",
        detail: habilitar
          ? `Se habilitó la edición para ${respuestas.length} respuesta(s).`
          : `Se deshabilitó la edición para ${respuestas.length} respuesta(s).`,
        life: 5000,
      });

      await cargarRespuestas(formularioSeleccionado);
    } catch (error) {
      console.error("Error al actualizar edición masiva:", error);

      toast.current?.show({
        severity: "error",
        summary: "Error",
        detail: "No se pudo actualizar la edición de forma masiva.",
        life: 5000,
      });
    } finally {
      setProcesandoEdicionMasiva(false);
    }
  };

  const confirmarCambioEstadoEdicionMasiva = (habilitar) => {
    confirmDialog({
      message: habilitar
        ? `¿Desea habilitar la edición para las ${respuestas.length} respuestas del formulario seleccionado?`
        : `¿Desea deshabilitar la edición para las ${respuestas.length} respuestas del formulario seleccionado?`,
      header: habilitar
        ? "Habilitar edición masiva"
        : "Deshabilitar edición masiva",
      icon: "pi pi-exclamation-triangle",
      acceptLabel: habilitar ? "Sí, habilitar todas" : "Sí, deshabilitar todas",
      rejectLabel: "Cancelar",
      acceptClassName: habilitar ? "p-button-success" : "p-button-warning",
      accept: () => cambiarEstadoEdicionMasiva(habilitar),
    });
  };

  // ==========================================================
  // VERIFICACIÓN DE AFILIACIÓN
  //
  // Dos pasos separados a propósito: primero se calcula y se muestra el
  // resultado, y sólo después de confirmarlo se escribe en Firestore. Así el
  // administrador ve contra qué números está aceptando.
  // ==========================================================

  /** DNI de una respuesta agrupada. El identificador es la fuente canónica. */
  const dniDeRespuesta = (respuesta) =>
    respuesta?.identificador ||
    respuesta?.dni ||
    obtenerDatosPrincipales(respuesta).dni ||
    "";

  const verificarAfiliacionFormulario = async () => {
    if (!formularioSeleccionado || respuestas.length === 0) return;

    setVerificandoAfiliacion(true);
    setPreviewAfiliacion(null);

    try {
      const dnis = respuestas.map(dniDeRespuesta);
      const verificaciones = await verificarAfiliacionesPorDni(dnis);
      const resumen = resumirVerificacion(dnis, verificaciones);

      setPreviewAfiliacion({ verificaciones, resumen });
    } catch (error) {
      console.error("Error al verificar afiliación:", error);

      // Un fallo NO se traduce en "no afiliado": no se toca ninguna respuesta.
      toast.current?.show({
        severity: "error",
        summary: "No se pudo completar la verificación de afiliación",
        detail: "No se realizaron cambios.",
        life: 6000,
      });
    } finally {
      setVerificandoAfiliacion(false);
    }
  };

  const guardarVerificacionAfiliacion = async () => {
    if (!previewAfiliacion || !formularioSeleccionado) return;

    const { verificaciones } = previewAfiliacion;

    setGuardandoAfiliacion(true);
    setProgresoAfiliacion(0);

    try {
      const tamañoLote = 400;

      for (let i = 0; i < respuestas.length; i += tamañoLote) {
        const lote = respuestas.slice(i, i + tamañoLote);
        const batch = writeBatch(db);
        let operaciones = 0;

        lote.forEach((respuesta) => {
          if (!respuesta?.id) return;

          const dni = normalizarDniAfiliacion(dniDeRespuesta(respuesta));
          const verificacion = verificaciones.get(dni);

          // Sin verificación para ese DNI no se escribe nada: la respuesta
          // conserva su estado anterior en lugar de quedar marcada por
          // omisión.
          if (!verificacion) return;

          batch.update(doc(db, "oficina_gestion_respuestas", respuesta.id), {
            ...camposAfiliacionParaRespuesta(verificacion),
            afiliacionVerificadaAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
          operaciones += 1;
        });

        if (operaciones > 0) await batch.commit();

        setProgresoAfiliacion(
          Math.round(
            (Math.min(i + tamañoLote, respuestas.length) / respuestas.length) * 100
          )
        );
      }

      toast.current?.show({
        severity: "success",
        summary: "Verificación guardada",
        detail: `${previewAfiliacion.resumen.afiliados} afiliado(s) y ${previewAfiliacion.resumen.noAfiliados} no afiliado(s) sobre ${previewAfiliacion.resumen.analizados} persona(s).`,
        life: 6000,
      });

      setPreviewAfiliacion(null);
      await cargarRespuestas(formularioSeleccionado);
    } catch (error) {
      console.error("Error al guardar la verificación de afiliación:", error);

      toast.current?.show({
        severity: "error",
        summary: "No se pudo guardar la verificación",
        detail: "Es posible que sólo una parte de las respuestas se haya actualizado. Volvé a ejecutar la verificación.",
        life: 7000,
      });
    } finally {
      setGuardandoAfiliacion(false);
      setProgresoAfiliacion(0);
    }
  };

  const eliminarRespuesta = async (respuesta) => {
    if (!respuesta?.id) return;

    setProcesandoId(respuesta.id);

    try {
      await deleteDoc(doc(db, "oficina_gestion_respuestas", respuesta.id));

      toast.current?.show({
        severity: "success",
        summary: "Respuesta eliminada",
        detail: "La respuesta fue eliminada correctamente.",
        life: 3500,
      });

      if (respuestaDetalle?.id === respuesta.id) setRespuestaDetalle(null);

      await cargarRespuestas(formularioSeleccionado);
    } catch (error) {
      console.error("Error al eliminar respuesta:", error);

      toast.current?.show({
        severity: "error",
        summary: "Error",
        detail: "No se pudo eliminar la respuesta.",
        life: 3500,
      });
    } finally {
      setProcesandoId(null);
    }
  };

  const confirmarEliminarRespuesta = (respuesta) => {
    const datos = obtenerDatosPrincipales(respuesta);

    confirmDialog({
      className: styles.confirmDialogGestion,
      message: `¿Está seguro de eliminar la respuesta de ${datos.apellido} ${datos.nombre} - DNI ${datos.dni}? Esta acción no se puede deshacer.`,
      header: "Eliminar respuesta",
      icon: "pi pi-exclamation-triangle",
      acceptLabel: "Sí, eliminar",
      rejectLabel: "Cancelar",
      acceptClassName: "p-button-danger",
      accept: () => eliminarRespuesta(respuesta),
    });
  };

  const respuestasFiltradas = useMemo(() => {
    const termino = normalizarTexto(busquedaRespuestas);

    if (!termino) return respuestas;

    return respuestas.filter((respuesta) => {
      const principales = obtenerDatosPrincipales(respuesta);
      const origen = obtenerOrigenRespuesta(respuesta);
      const estadoGeneral = resolverEstadoGeneralPersona(
        respuesta,
        formularioActual?.configuracionVisual
      );
      const selloEstado = obtenerSelloPorColor(
        estadoGeneral,
        formularioActual?.configuracionVisual
      );

      const textoBuscable = [
        respuesta.id,
        respuesta.formularioTitulo,
        respuesta.formularioId,
        respuesta.formularioCodigo,
        respuesta.formularioNumero,
        origen.label,
        principales.apellido,
        principales.nombre,
        principales.dni,
        principales.departamento,
        principales.presentoDocumentacion,
        obtenerResumenRespuesta(respuesta),
        respuesta.identificador,
        // Hace buscable "afiliado" / "no afiliado" / "sin verificar". Ojo con
        // el orden: "afiliado" es subcadena de "no afiliado", así que buscar
        // "afiliado" trae ambos y "no afiliado" trae sólo los negativos.
        etiquetaAfiliacion(respuesta),
        estadoGeneral || "sin estado",
        selloEstado?.texto || "",
        aTextoBusqueda(respuesta.respuestas),
        aTextoBusqueda(respuesta.respuestasPorCampo),
        aTextoBusqueda(respuesta.archivos),
      ].join(" ");

      return normalizarTexto(textoBuscable).includes(termino);
    });
  }, [respuestas, busquedaRespuestas, formularioActual]);

  const esFormularioAgrupado = Boolean(
    formularioActual?.tipoFormulario === "consulta_excel_agrupada" ||
      formularioActual?.configuracionExcel?.habilitado
  );

  /**
   * Totales de afiliación del formulario.
   *
   * Se calcula sobre las respuestas YA cargadas en memoria: abrir la pantalla
   * no vuelve a consultar usuarios ni nuevoAfiliado. Sólo cambia cuando se
   * recargan las respuestas.
   */
  const resumenAfiliacionFormulario = useMemo(() => {
    let afiliados = 0;
    let noAfiliados = 0;
    let sinVerificar = 0;

    respuestas.forEach((respuesta) => {
      const estado = estadoAfiliacionDeRespuesta(respuesta);
      if (estado === AFILIACION_ESTADO.AFILIADO) afiliados += 1;
      else if (estado === AFILIACION_ESTADO.NO_AFILIADO) noAfiliados += 1;
      else sinVerificar += 1;
    });

    return { afiliados, noAfiliados, sinVerificar };
  }, [respuestas]);

  const resumenEstadoVisualFormulario = useMemo(() => {
    const conteos = {
      [COLOR_TARJETA.VERDE]: 0,
      [COLOR_TARJETA.AMARILLO]: 0,
      [COLOR_TARJETA.ROJO]: 0,
    };

    respuestas.forEach((respuesta) => {
      const color = resolverEstadoGeneralPersona(
        respuesta,
        formularioActual?.configuracionVisual
      );
      if (color) conteos[color] += 1;
    });

    return conteos;
  }, [respuestas, formularioActual]);

  const renderDetalleAgrupado = (respuesta) => {
    const campos = [...(respuesta.camposSeleccionados || formularioActual?.configuracionExcel?.camposSeleccionados || [])].sort(
      (a, b) => Number(a.orden || 0) - Number(b.orden || 0)
    );
    const persona = respuesta.datosPersona || {};
    const registros = respuesta.registros || [];
    const registrosConEstado = registros.map((registro, index) => {
      // Algunas columnas de la regla pueden provenir de datosPersona. La
      // combinación sólo se usa para el cálculo visual; no altera lo
      // almacenado ni la información mostrada del registro.
      const registroCompleto = { ...persona, ...registro };
      const color = resolverColorRegistro(
        registroCompleto,
        formularioActual?.configuracionVisual
      );
      const sello = obtenerSelloPorColor(
        color,
        formularioActual?.configuracionVisual
      );

      return { registro, index, color, sello };
    });
    const conteosEstado = registrosConEstado.reduce(
      (conteos, { color }) => {
        if (color) conteos[color] = (conteos[color] || 0) + 1;
        return conteos;
      },
      {}
    );

    return (
      <div className={styles.detalleRespuesta}>
        <div className={styles.detalleMeta}>
          <strong>Identificador:</strong>
          <span>{respuesta.identificador || respuesta.dni || "—"}</span>
        </div>
        <div className={styles.detalleMeta}>
          <strong>Cantidad de registros:</strong>
          <span>{respuesta.cantidadRegistros || registros.length}</span>
        </div>
        {Object.keys(conteosEstado).length > 0 && (
          <div className={styles.resumenEstadosRegistros} aria-label="Resumen de estados visuales">
            {Object.entries(conteosEstado).map(([color, cantidad]) => (
              <span
                className={clasesConEstado(
                  styles.resumenEstadoRegistro,
                  CLASE_SELLO_POR_COLOR[color]
                )}
                key={color}
              >
                {cantidad} {ETIQUETA_ESTADO_POR_COLOR[color]}
              </span>
            ))}
          </div>
        )}
        <div className={styles.respuestasList}>
          {registrosConEstado.map(({ registro, index, color, sello }) => (
            <article
              className={clasesConEstado(
                styles.registroAgrupadoCard,
                CLASE_REGISTRO_POR_COLOR[color]
              )}
              key={`${respuesta.id}-detalle-${index}`}
            >
              <div className={styles.registroAgrupadoHeader}>
                <strong>Registro {index + 1}</strong>
                {sello ? (
                  <span
                    className={clasesConEstado(
                      styles.selloRegistro,
                      CLASE_SELLO_POR_COLOR[sello.color]
                    )}
                  >
                    <i className={ICONO_ESTADO_POR_COLOR[sello.color]} aria-hidden="true" />
                    {sello.texto}
                  </span>
                ) : color ? (
                  <span
                    className={clasesConEstado(
                      styles.estadoRegistroSimple,
                      CLASE_SELLO_POR_COLOR[color]
                    )}
                  >
                    {ETIQUETA_ESTADO_POR_COLOR[color]}
                  </span>
                ) : (
                  <span className={styles.estadoRegistroNeutro}>Sin estado visual</span>
                )}
              </div>
              <div className={styles.detalleCampos}>
                {campos.map((campo) => {
                  const valor =
                    campo.tipo === "IDENTIFICADOR"
                      ? respuesta.identificador
                      : campo.tipo === "DATO_PERSONA"
                      ? persona[campo.key]
                      : registro[campo.key];
                  return (
                    <div className={styles.detalleCampo} key={campo.key}>
                      <strong>{campo.label}</strong>
                      <span>{renderValorDetalle(valor || "—")}</span>
                    </div>
                  );
                })}
              </div>
            </article>
          ))}
        </div>
      </div>
    );
  };

  return (
    <div className={styles.formWrapper}>
      <Toast ref={toast} />
      <ConfirmDialog className={styles.confirmDialogGestion} />

      <div className={styles.sectionTitle}>
        <div>
          <h2>Respuestas de formularios</h2>

          <p>
            Seleccioná un formulario para consultar las respuestas, descargar el
            Excel con sus archivos adjuntos, habilitar la edición para el
            afiliado o eliminar una respuesta individual.
          </p>
        </div>

        <div className={styles.manageActions}>
          <Button
            label="Habilitar edición a todos"
            icon="pi pi-users"
            severity="success"
            outlined
            onClick={() => confirmarCambioEstadoEdicionMasiva(true)}
            disabled={
              !formularioSeleccionado ||
              loadingRespuestas ||
              respuestas.length === 0 ||
              procesandoEdicionMasiva
            }
            loading={procesandoEdicionMasiva}
          />

          <Button
            label="Deshabilitar edición a todos"
            icon="pi pi-lock"
            severity="warning"
            outlined
            onClick={() => confirmarCambioEstadoEdicionMasiva(false)}
            disabled={
              !formularioSeleccionado ||
              loadingRespuestas ||
              respuestas.length === 0 ||
              procesandoEdicionMasiva
            }
            loading={procesandoEdicionMasiva}
          />

          {/* Sólo en formularios Excel agrupados: los manuales no tienen un
              DNI por respuesta contra el cual verificar. */}
          {esFormularioAgrupado && (
            <Button
              label="Verificar afiliación"
              icon="pi pi-id-card"
              severity="help"
              outlined
              onClick={verificarAfiliacionFormulario}
              disabled={
                !formularioSeleccionado ||
                loadingRespuestas ||
                respuestas.length === 0 ||
                verificandoAfiliacion ||
                guardandoAfiliacion
              }
              loading={verificandoAfiliacion}
            />
          )}

          <Button
            label="Descargar todo"
            icon="pi pi-download"
            severity="success"
            outlined
            onClick={descargarFormularioCompleto}
            disabled={
              !formularioSeleccionado ||
              loadingRespuestas ||
              respuestas.length === 0 ||
              descargandoZip
            }
            loading={descargandoZip}
          />

          <Button
            label="Actualizar"
            icon="pi pi-refresh"
            severity="secondary"
            outlined
            onClick={() => cargarRespuestas(formularioSeleccionado)}
            disabled={!formularioSeleccionado || loadingRespuestas}
            loading={loadingRespuestas}
          />
        </div>
      </div>

      <div className={styles.formGrid}>
        <div className={styles.formRow}>
          <label htmlFor="selectorFormulario">Formulario</label>

          <Dropdown
            id="selectorFormulario"
            value={formularioSeleccionado}
            options={opcionesFormularios}
            onChange={(e) => {
              setFormularioSeleccionado(e.value);
              setBusquedaRespuestas("");
            }}
            placeholder={
              loadingFormularios
                ? "Cargando formularios..."
                : "Seleccione un formulario"
            }
            loading={loadingFormularios}
            filter
            showClear
            disabled={loadingFormularios}
          />
        </div>

        {formularioSeleccionado && respuestas.length > 0 && (
          <div className={styles.formRow}>
            <label htmlFor="buscadorRespuestas">Buscador</label>

            <span className="p-input-icon-left" style={{ width: "100%" }}>
              <i className="pi pi-search" />
              <InputText
                id="buscadorRespuestas"
                value={busquedaRespuestas}
                onChange={(e) => setBusquedaRespuestas(e.target.value)}
                placeholder="Buscar por DNI, apellido, nombre, departamento, expediente, código o cualquier dato cargado..."
                style={{ width: "100%" }}
                disabled={loadingRespuestas}
              />
            </span>

            {busquedaRespuestas.trim() && (
              <small style={{ display: "block", marginTop: "0.5rem" }}>
                Mostrando {respuestasFiltradas.length} resultado(s) de{" "}
                {respuestas.length} respuesta(s).
              </small>
            )}
          </div>
        )}
      </div>

      {formularioActual && (
        <div className={styles.selectedInfo}>
          <div>
            <strong>{formularioActual.titulo}</strong>

            <p>{formularioActual.descripcion || "Sin descripción cargada."}</p>

            <small>
              Código / ID del formulario:{" "}
              <strong>{formularioActual.id}</strong>
            </small>
          </div>

          <div className={styles.tagGroup}>
            <Tag
              value={formularioActual.activo ? "Activo" : "Inactivo"}
              severity={formularioActual.activo ? "success" : "danger"}
            />

            <Tag
              value={`${
                busquedaRespuestas.trim()
                  ? respuestasFiltradas.length
                  : respuestas.length
              } respuesta${
                (busquedaRespuestas.trim()
                  ? respuestasFiltradas.length
                  : respuestas.length) === 1
                  ? ""
                  : "s"
              }`}
              severity="info"
            />

            {/* Sólo para formularios Excel agrupados, y sólo una vez que
                existe alguna verificación: antes no hay nada que informar. */}
            {esFormularioAgrupado &&
              resumenAfiliacionFormulario.afiliados +
                resumenAfiliacionFormulario.noAfiliados >
                0 && (
                <>
                  <Tag
                    value={`${resumenAfiliacionFormulario.afiliados} afiliado${
                      resumenAfiliacionFormulario.afiliados === 1 ? "" : "s"
                    }`}
                    severity="success"
                  />

                  <Tag
                    value={`${resumenAfiliacionFormulario.noAfiliados} no afiliado${
                      resumenAfiliacionFormulario.noAfiliados === 1 ? "" : "s"
                    }`}
                    severity="danger"
                  />

                  {resumenAfiliacionFormulario.sinVerificar > 0 && (
                    <Tag
                      value={`${resumenAfiliacionFormulario.sinVerificar} sin verificar`}
                      severity="secondary"
                    />
                  )}
                </>
              )}

            {esFormularioAgrupado &&
              Object.entries(resumenEstadoVisualFormulario).map(([color, cantidad]) =>
                cantidad > 0 ? (
                  <Tag
                    className={clasesConEstado(
                      styles.tagEstadoGeneral,
                      CLASE_TAG_GENERAL_POR_COLOR[color]
                    )}
                    key={"resumen-estado-" + color}
                    value={
                      String(cantidad) +
                      " " +
                      ETIQUETA_ESTADO_POR_COLOR[color].toLowerCase() +
                      (cantidad === 1 ? "" : "s")
                    }
                  />
                ) : null
              )}
          </div>
        </div>
      )}

      {!loadingFormularios && formularios.length === 0 && (
        <div className={styles.emptyBox}>
          <i className="pi pi-file" />

          <h3>No hay formularios creados</h3>

          <p>
            Primero debés crear un formulario desde la opción “Crear
            formularios”.
          </p>
        </div>
      )}

      {loadingRespuestas && formularios.length > 0 && (
        <div className={styles.loadingBox}>
          <ProgressSpinner />
          <span>Cargando respuestas...</span>
        </div>
      )}

      {!loadingRespuestas &&
        formularios.length > 0 &&
        formularioSeleccionado &&
        respuestas.length === 0 && (
          <div className={styles.emptyBox}>
            <i className="pi pi-inbox" />

            <h3>Sin respuestas</h3>

            <p>
              Todavía no se registraron respuestas para el formulario
              seleccionado.
            </p>
          </div>
        )}

      {!loadingRespuestas &&
        formularioSeleccionado &&
        respuestas.length > 0 &&
        respuestasFiltradas.length === 0 && (
          <div className={styles.emptyBox}>
            <i className="pi pi-search" />

            <h3>Sin coincidencias</h3>

            <p>
              No se encontraron respuestas que coincidan con la búsqueda
              ingresada.
            </p>
          </div>
        )}

      {!loadingRespuestas && respuestasFiltradas.length > 0 && (
        <div className={styles.respuestasList}>
          {respuestasFiltradas.map((respuesta) => {
            const indexReal = respuestas.findIndex(
              (item) => item.id === respuesta.id
            );
            const numeroRespuesta = indexReal >= 0 ? indexReal + 1 : 1;
            const origen = obtenerOrigenRespuesta(respuesta);
            const edicionHabilitada = Boolean(
              respuesta.edicionAfiliadoHabilitada
            );

            if (esFormularioAgrupado) {
              const datos = obtenerDatosPrincipales(respuesta);
              const etiquetaIdentificador =
                formularioActual?.configuracionExcel?.columnaAgrupacion?.label ||
                "Identificador";
              const estadoGeneral = resolverEstadoGeneralPersona(
                respuesta,
                formularioActual?.configuracionVisual
              );
              const selloEstado = obtenerSelloPorColor(
                estadoGeneral,
                formularioActual?.configuracionVisual
              );
              const conteoRegistros = (respuesta.registros || []).reduce(
                (conteos, registro) => {
                  const color = resolverColorRegistro(
                    { ...(respuesta.datosPersona || {}), ...registro },
                    formularioActual?.configuracionVisual
                  );
                  if (color) conteos[color] += 1;
                  return conteos;
                },
                {
                  [COLOR_TARJETA.VERDE]: 0,
                  [COLOR_TARJETA.AMARILLO]: 0,
                  [COLOR_TARJETA.ROJO]: 0,
                }
              );
              return (
                <article
                  key={respuesta.id}
                  className={clasesConEstado(
                    styles.respuestaCard,
                    CLASE_RESPUESTA_GENERAL_POR_COLOR[estadoGeneral]
                  )}
                >
                  <div>
                    <div className={styles.respuestaHeader}>
                      <strong>{datos.apellido}, {datos.nombre}</strong>
                      <span>{formatearFecha(respuesta.updatedAt || respuesta.createdAt)}</span>
                    </div>
                    <p>{etiquetaIdentificador}: {respuesta.identificador || datos.dni} · {respuesta.cantidadRegistros || respuesta.registros?.length || 0} registro(s)</p>
                    <div className={styles.tagGroup}>
                      <Tag value="Excel agrupado" severity="warning" />
                      <Tag value={`Origen: ${obtenerOrigenRespuesta(respuesta).label}`} severity="info" />
                      {/* NO AFILIADO tiene que saltar a la vista; SIN
                          VERIFICAR va en gris para no confundirse con una
                          respuesta negativa. */}
                      <Tag
                        value={etiquetaAfiliacion(respuesta)}
                        severity={
                          estadoAfiliacionDeRespuesta(respuesta) === AFILIACION_ESTADO.AFILIADO
                            ? "success"
                            : estadoAfiliacionDeRespuesta(respuesta) === AFILIACION_ESTADO.NO_AFILIADO
                            ? "danger"
                            : "secondary"
                        }
                      />

                      {estadoGeneral && (
                        <Tag
                          className={clasesConEstado(
                            styles.tagEstadoGeneral,
                            CLASE_TAG_GENERAL_POR_COLOR[estadoGeneral]
                          )}
                          value={
                            selloEstado?.texto ||
                            ETIQUETA_ESTADO_POR_COLOR[estadoGeneral].toUpperCase()
                          }
                        />
                      )}
                    </div>

                    {Object.values(conteoRegistros).some(Boolean) && (
                      <small className={styles.desgloseEstadoRegistros}>
                        {Object.entries(conteoRegistros)
                          .filter(([, cantidad]) => cantidad > 0)
                          .map(
                            ([color, cantidad]) =>
                              String(cantidad) +
                              " " +
                              ETIQUETA_ESTADO_POR_COLOR[color].toLowerCase() +
                              (cantidad === 1 ? "" : "s")
                          )
                          .join(" · ")}
                      </small>
                    )}
                  </div>
                  <div className={styles.manageActions}>
                    <Button label="Ver registros" icon="pi pi-eye" severity="info" outlined onClick={() => setRespuestaDetalle(respuesta)} />
                    <Button label="Eliminar" icon="pi pi-trash" severity="danger" outlined loading={procesandoId === respuesta.id} onClick={() => confirmarEliminarRespuesta(respuesta)} />
                  </div>
                </article>
              );
            }

            return (
              <article key={respuesta.id} className={styles.respuestaCard}>
                <div>
                  <div className={styles.respuestaHeader}>
                    <strong>Respuesta #{numeroRespuesta}</strong>
                    <span>{formatearFecha(respuesta.createdAt)}</span>
                  </div>

                  <p>{obtenerResumenRespuesta(respuesta)}</p>

                  <div className={styles.tagGroup}>
                    <Tag
                      value={`Origen: ${origen.label}`}
                      severity={origen.severity}
                    />

                    <Tag
                      value={`Código: ${
                        respuesta.formularioCodigo ||
                        respuesta.formularioNumero ||
                        respuesta.formularioId ||
                        "—"
                      }`}
                      severity="info"
                    />

                    {edicionHabilitada && (
                      <Tag value="Edición habilitada" severity="success" />
                    )}

                    {respuesta.editadoPorAfiliado && (
                      <Tag value="Editado por afiliado" severity="warning" />
                    )}
                  </div>
                </div>

                <div className={styles.manageActions}>
                  <Button
                    label="Ver detalle"
                    icon="pi pi-eye"
                    severity="info"
                    outlined
                    onClick={() => setRespuestaDetalle(respuesta)}
                  />

                  <Button
                    label="Descargar"
                    icon="pi pi-download"
                    severity="secondary"
                    outlined
                    loading={procesandoId === respuesta.id}
                    onClick={() =>
                      descargarRespuestaIndividual(
                        respuesta,
                        indexReal >= 0 ? indexReal : 0
                      )
                    }
                  />

                  <Button
                    label={
                      edicionHabilitada
                        ? "Deshabilitar edición"
                        : "Habilitar edición"
                    }
                    icon={edicionHabilitada ? "pi pi-lock" : "pi pi-pencil"}
                    severity={edicionHabilitada ? "warning" : "success"}
                    outlined
                    loading={procesandoId === respuesta.id}
                    onClick={() => confirmarCambioEstadoEdicion(respuesta)}
                  />

                  <Button
                    label="Eliminar"
                    icon="pi pi-trash"
                    severity="danger"
                    outlined
                    loading={procesandoId === respuesta.id}
                    onClick={() => confirmarEliminarRespuesta(respuesta)}
                  />
                </div>
              </article>
            );
          })}
        </div>
      )}

      <Dialog
        header="Detalle de respuesta"
        visible={Boolean(respuestaDetalle) && !esFormularioAgrupado}
        style={{ width: "760px", maxWidth: "95vw" }}
        modal
        onHide={() => setRespuestaDetalle(null)}
      >
        {respuestaDetalle && (
          <div className={styles.detalleRespuesta}>
            <div className={styles.detalleMeta}>
              <strong>Fecha de carga:</strong>
              <span>{formatearFecha(respuestaDetalle.createdAt)}</span>
            </div>

            <div className={styles.detalleMeta}>
              <strong>Última actualización:</strong>
              <span>{formatearFecha(respuestaDetalle.updatedAt)}</span>
            </div>

            <div className={styles.detalleMeta}>
              <strong>Formulario:</strong>
              <span>{respuestaDetalle.formularioTitulo || "—"}</span>
            </div>

            <div className={styles.detalleMeta}>
              <strong>Código / ID del formulario:</strong>
              <span>
                {respuestaDetalle.formularioCodigo ||
                  respuestaDetalle.formularioNumero ||
                  respuestaDetalle.formularioId ||
                  "—"}
              </span>
            </div>

            <div className={styles.detalleMeta}>
              <strong>Origen:</strong>
              <span>{obtenerOrigenRespuesta(respuestaDetalle).label}</span>
            </div>

            <div className={styles.detalleMeta}>
              <strong>Edición del afiliado:</strong>
              <span>
                {respuestaDetalle.edicionAfiliadoHabilitada
                  ? "Habilitada"
                  : "No habilitada"}
              </span>
            </div>

            {respuestaDetalle.editadoPorAfiliado && (
              <div className={styles.detalleMeta}>
                <strong>Editado por afiliado:</strong>
                <span>
                  Sí - {formatearFecha(respuestaDetalle.editadoPorAfiliadoAt)}
                </span>
              </div>
            )}

            <div className={styles.detalleCampos}>
              {obtenerCamposOrdenadosDetalle(respuestaDetalle).map(
                (campo, index) => (
                  <div
                    key={`${campo.label}-${index}`}
                    className={styles.detalleCampo}
                  >
                    <strong>{campo.label}</strong>
                    <span>{renderValorDetalle(campo.value)}</span>
                  </div>
                )
              )}
            </div>

            <div className={styles.footerActions}>
              <Button
                label="Descargar ZIP"
                icon="pi pi-download"
                severity="secondary"
                outlined
                onClick={() =>
                  descargarRespuestaIndividual(
                    respuestaDetalle,
                    respuestas.findIndex(
                      (item) => item.id === respuestaDetalle.id
                    )
                  )
                }
                loading={procesandoId === respuestaDetalle.id}
              />

              <Button
                label={
                  respuestaDetalle.edicionAfiliadoHabilitada
                    ? "Deshabilitar edición"
                    : "Habilitar edición"
                }
                icon={
                  respuestaDetalle.edicionAfiliadoHabilitada
                    ? "pi pi-lock"
                    : "pi pi-pencil"
                }
                severity={
                  respuestaDetalle.edicionAfiliadoHabilitada
                    ? "warning"
                    : "success"
                }
                outlined
                onClick={() => confirmarCambioEstadoEdicion(respuestaDetalle)}
                loading={procesandoId === respuestaDetalle.id}
              />

              <Button
                label="Eliminar respuesta"
                icon="pi pi-trash"
                severity="danger"
                outlined
                onClick={() => confirmarEliminarRespuesta(respuestaDetalle)}
                loading={procesandoId === respuestaDetalle.id}
              />
            </div>
          </div>
        )}
      </Dialog>

      <Dialog
        header="Registros de la persona"
        visible={Boolean(respuestaDetalle) && esFormularioAgrupado}
        style={{ width: "960px", maxWidth: "95vw" }}
        modal
        onHide={() => setRespuestaDetalle(null)}
      >
        {respuestaDetalle && renderDetalleAgrupado(respuestaDetalle)}
      </Dialog>

      {/* Confirmación de la verificación de afiliación. Se muestran los
          números ANTES de escribir: nada se guarda sin que el administrador
          vea contra qué está aceptando. */}
      <Dialog
        header="Verificación de afiliación"
        visible={Boolean(previewAfiliacion)}
        style={{ width: "560px", maxWidth: "95vw" }}
        modal
        closable={!guardandoAfiliacion}
        closeOnEscape={!guardandoAfiliacion}
        onHide={() => {
          if (guardandoAfiliacion) return;
          setPreviewAfiliacion(null);
        }}
      >
        {previewAfiliacion && (
          <>
            <p>
              Se verificaron{" "}
              <strong>{previewAfiliacion.resumen.analizados}</strong> persona(s)
              contra los registros de afiliados de SIDCA (usuarios y
              nuevoAfiliado).
            </p>

            <div className={styles.metaGrid}>
              <div className={styles.metaItem}>
                <span>Personas analizadas</span>
                <strong>{previewAfiliacion.resumen.analizados}</strong>
              </div>

              <div className={styles.metaItem}>
                <span>Afiliados</span>
                <strong>{previewAfiliacion.resumen.afiliados}</strong>
              </div>

              <div className={styles.metaItem}>
                <span>No afiliados</span>
                <strong>{previewAfiliacion.resumen.noAfiliados}</strong>
              </div>

              <div className={styles.metaItem}>
                <span>De los cuales, bajas</span>
                <strong>{previewAfiliacion.resumen.bajas}</strong>
              </div>
            </div>

            <small style={{ display: "block", marginTop: "0.75rem" }}>
              «Bajas» son personas que sí figuran en el padrón pero con todos
              sus registros en <code>activo = false</code>. El resto de los no
              afiliados no aparece en ninguna de las dos colecciones.
            </small>

            {guardandoAfiliacion && (
              <p style={{ marginTop: "0.75rem" }}>
                Actualizando afiliación… {progresoAfiliacion}%
              </p>
            )}

            <div className={styles.manageActions} style={{ marginTop: "1rem" }}>
              <Button
                label="Cancelar"
                outlined
                onClick={() => setPreviewAfiliacion(null)}
                disabled={guardandoAfiliacion}
              />

              <Button
                label="Guardar verificación"
                icon="pi pi-check"
                severity="success"
                onClick={guardarVerificacionAfiliacion}
                loading={guardandoAfiliacion}
                disabled={guardandoAfiliacion}
              />
            </div>
          </>
        )}
      </Dialog>
    </div>
  );
};

export default RespuestasFormularioGestion;
