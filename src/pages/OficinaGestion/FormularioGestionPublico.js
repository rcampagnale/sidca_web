// src/pages/OficinaGestion/FormularioGestionPublico.js

import React, { useEffect, useMemo, useRef, useState } from "react";
import { useHistory, useParams } from "react-router-dom";

import { Button } from "primereact/button";
import { Dialog } from "primereact/dialog";
import { Dropdown } from "primereact/dropdown";
import { MultiSelect } from "primereact/multiselect";
import { InputText } from "primereact/inputtext";
import { InputTextarea } from "primereact/inputtextarea";
import { Toast } from "primereact/toast";
import { ProgressSpinner } from "primereact/progressspinner";
import { Message } from "primereact/message";

import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from "firebase/firestore";

import { getDownloadURL, ref, uploadBytes } from "firebase/storage";

import { db, storage } from "../../firebase/firebase-config";

import {
  departamentosOptions,
  departamentosValues,
} from "../../components/OficinaGestion/departamentos";

import styles from "./FormularioGestionPublico.module.css";

const OPCIONES_SI_NO = [
  { label: "Sí", value: "Sí" },
  { label: "No", value: "No" },
];

const ARCHIVOS_DEFAULT =
  ".pdf,.doc,.docx,.png,.jpg,.jpeg,.rar,.zip,image/png,image/jpeg";

const COLECCIONES_VALIDACION_DNI = ["usuarios", "nuevoAfiliado"];

const normalizarTexto = (valor) => {
  return String(valor || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
};

const normalizarDni = (valor) => {
  return String(valor || "").replace(/\D/g, "").trim();
};

const valorVacio = (valor) => {
  if (valor === null || valor === undefined) return true;

  const texto = String(valor).trim();

  return (
    texto === "" ||
    texto === "—" ||
    texto === "-" ||
    texto.toLowerCase() === "undefined" ||
    texto.toLowerCase() === "null"
  );
};

const limpiarNombreArchivo = (nombre) => {
  return String(nombre || "archivo")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\w.-]+/g, "_");
};

const obtenerExtension = (fileName = "") => {
  const partes = String(fileName).split(".");
  return partes.length > 1 ? partes.pop().toLowerCase() : "";
};

const acceptPermiteArchivo = (accept = ARCHIVOS_DEFAULT, file) => {
  if (!file) return false;

  const acceptTokens = String(accept || ARCHIVOS_DEFAULT)
    .split(",")
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);

  if (acceptTokens.length === 0) return true;

  const extension = obtenerExtension(file.name);
  const mime = String(file.type || "").toLowerCase();

  return acceptTokens.some((token) => {
    if (token.startsWith(".")) {
      return token.replace(".", "") === extension;
    }

    if (token.endsWith("/*")) {
      const base = token.replace("/*", "");
      return mime.startsWith(`${base}/`);
    }

    return token === mime;
  });
};

const htmlATextoPlano = (html = "") => {
  if (typeof document === "undefined") {
    return String(html || "").replace(/<[^>]+>/g, " ").trim();
  }

  const temp = document.createElement("div");
  temp.innerHTML = String(html || "");

  return (temp.textContent || temp.innerText || "").trim();
};

const escaparHtml = (texto = "") => {
  return String(texto || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
};

const textoPlanoAHtml = (texto = "") => {
  const limpio = String(texto || "").trim();

  if (!limpio) return "";

  return limpio
    .split(/\n{2,}/)
    .map((bloque) => `<p>${escaparHtml(bloque).replace(/\n/g, "<br />")}</p>`)
    .join("");
};

const sanearHtmlBasico = (html = "") => {
  return String(html || "")
    .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?>[\s\S]*?<\/style>/gi, "")
    .replace(/\son\w+="[^"]*"/gi, "")
    .replace(/\son\w+='[^']*'/gi, "")
    .replace(/javascript:/gi, "");
};

const normalizarSiNo = (valor) => {
  if (valor === true) return "Sí";
  if (valor === false) return "No";

  const texto = normalizarTexto(valor);

  if (["si", "sí", "s", "true", "1"].includes(texto)) return "Sí";
  if (["no", "n", "false", "0"].includes(texto)) return "No";

  return "";
};

const convertirFecha = (valor) => {
  if (!valor) return null;

  if (valor?.toDate && typeof valor.toDate === "function") {
    return valor.toDate();
  }

  if (valor instanceof Date) return valor;

  if (typeof valor === "string" || typeof valor === "number") {
    const fecha = new Date(valor);
    return Number.isNaN(fecha.getTime()) ? null : fecha;
  }

  if (typeof valor === "object" && typeof valor.seconds === "number") {
    return new Date(valor.seconds * 1000);
  }

  return null;
};

const formatearFechaHora = (valor) => {
  const fecha = convertirFecha(valor);

  if (!fecha) return "—";

  return fecha.toLocaleString("es-AR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

const esArchivoAdjunto = (valor) => {
  return Boolean(
    valor &&
      typeof valor === "object" &&
      (valor.url || valor.downloadURL || valor.path || valor.fullPath)
  );
};

const esListaDeArchivos = (valor) => {
  return (
    Array.isArray(valor) &&
    valor.length > 0 &&
    valor.some((item) => esArchivoAdjunto(item))
  );
};

const obtenerUrlArchivo = (archivo) => {
  if (!archivo || typeof archivo !== "object") return "";

  return (
    archivo.url ||
    archivo.downloadURL ||
    archivo.archivoUrl ||
    archivo.fileUrl ||
    ""
  );
};

const obtenerNombreArchivo = (archivo, fallback = "Archivo adjunto") => {
  if (!archivo || typeof archivo !== "object") return fallback;

  return (
    archivo.nombre ||
    archivo.name ||
    archivo.filename ||
    archivo.fileName ||
    archivo.originalName ||
    fallback
  );
};

const obtenerValorPorClaves = (respuestas, claves = []) => {
  const entries = Object.entries(respuestas || {});

  for (const clave of claves) {
    const normalizada = normalizarTexto(clave);

    const encontrada = entries.find(([key, value]) => {
      return normalizarTexto(key) === normalizada && !valorVacio(value);
    });

    if (encontrada) return encontrada[1];
  }

  for (const clave of claves) {
    const claveNormalizada = normalizarTexto(clave);

    const encontrada = entries.find(([key, value]) => {
      const keyNormalizada = normalizarTexto(key);

      if (valorVacio(value)) return false;

      return (
        keyNormalizada.includes(claveNormalizada) ||
        claveNormalizada.includes(keyNormalizada)
      );
    });

    if (encontrada) return encontrada[1];
  }

  return "";
};

const esCampoDniPorLabel = (label = "") => {
  const normalizado = normalizarTexto(label);

  return (
    normalizado === "dni" ||
    normalizado === "documento" ||
    normalizado === "nro dni" ||
    normalizado === "n° dni" ||
    normalizado === "nº dni" ||
    normalizado === "numero de dni" ||
    normalizado === "número de dni" ||
    normalizado === "numero documento" ||
    normalizado === "numero de documento" ||
    normalizado === "número documento" ||
    normalizado === "número de documento"
  );
};

const esCampoNombrePorLabel = (label = "") => {
  const normalizado = normalizarTexto(label);
  return normalizado === "nombre" || normalizado === "nombres";
};

const esCampoApellidoPorLabel = (label = "") => {
  const normalizado = normalizarTexto(label);
  return normalizado === "apellido" || normalizado === "apellidos";
};

const esCampoDepartamentoPorLabel = (label = "") => {
  const normalizado = normalizarTexto(label);

  return (
    normalizado === "departamento" ||
    normalizado === "depto" ||
    normalizado === "dpto" ||
    normalizado.includes("departamento")
  );
};

const esCampoDocumentacionPorLabel = (label = "") => {
  const normalizado = normalizarTexto(label).replace(/\s+/g, "");

  return (
    normalizado.includes("presentodocumentacion") ||
    normalizado.includes("documentacionpresentada") ||
    normalizado.includes("documentaciónpresentada") ||
    normalizado === "documentacion" ||
    normalizado === "documentación"
  );
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
    respuestas["Número de documento"],
    respuestas["Numero de documento"],
  ];

  Object.values(respuestasPorCampo).forEach((campo) => {
    if (esCampoDniPorLabel(campo?.label)) {
      posiblesValores.push(campo?.valorLegible);
      posiblesValores.push(campo?.valor);
    }
  });

  const encontrado = posiblesValores.find((valor) => normalizarDni(valor));

  return normalizarDni(encontrado);
};

const normalizarAfiliado = (data = {}, idDoc = "", origen = "") => {
  const apellidoOriginal = String(
    data.apellido || data.Apellido || data.apellidos || data.Apellidos || ""
  ).trim();

  const nombreOriginal = String(
    data.nombre || data.Nombre || data.nombres || data.Nombres || ""
  ).trim();

  const personaNormalizada = separarApellidoNombrePersona(
    apellidoOriginal,
    nombreOriginal
  );

  return {
    id: idDoc,
    origen,
    apellido: personaNormalizada.apellido,
    nombre: personaNormalizada.nombre,
    dni: normalizarDni(
      data.dni ||
        data.DNI ||
        data.documento ||
        data.Documento ||
        data.nroDni ||
        data.numeroDni ||
        ""
    ),
    departamento:
      data.departamento ||
      data.Departamento ||
      data.depto ||
      data.dpto ||
      data.Delegacion ||
      data.delegacion ||
      "",
    raw: data,
  };
};

const obtenerValorPlano = (valor) => {
  if (valor === null || valor === undefined) return "";
  if (typeof valor === "boolean") return valor ? "Sí" : "No";
  if (Array.isArray(valor)) return valor.map(obtenerValorPlano).join(", ");
  if (typeof valor === "object") {
    if (esArchivoAdjunto(valor)) return obtenerNombreArchivo(valor);
    return JSON.stringify(valor);
  }
  return String(valor).trim();
};

const FormularioGestionPublico = () => {
  const { id } = useParams();
  const history = useHistory();
  const toast = useRef(null);

  const [formulario, setFormulario] = useState(null);
  const [loading, setLoading] = useState(true);
  const [errorCarga, setErrorCarga] = useState("");

  const [respuestas, setRespuestas] = useState({});
  const [archivos, setArchivos] = useState({});
  const [enviando, setEnviando] = useState(false);
  const [verificandoDni, setVerificandoDni] = useState(false);

  const [validandoDni, setValidandoDni] = useState(false);
  const [dniValidacion, setDniValidacion] = useState("");
  const [afiliadoValidado, setAfiliadoValidado] = useState(null);
  const [mensajeValidacionDni, setMensajeValidacionDni] = useState("");

  const [estadoEnvio, setEstadoEnvio] = useState(null);
  const [respuestaRegistrada, setRespuestaRegistrada] = useState(null);
  const [verDetalleRespuesta, setVerDetalleRespuesta] = useState(false);

  const [modoEdicionAfiliado, setModoEdicionAfiliado] = useState(false);
  const [respuestaEditandoId, setRespuestaEditandoId] = useState(null);

  const enviado = Boolean(estadoEnvio);

  const camposVisibles = useMemo(() => {
    const campos = formulario?.campos || [];

    return [...campos]
      .map((campo, index) => ({
        ...campo,
        id: campo.id || `campo_${index + 1}`,
        orden: campo.orden || index + 1,
        label: campo.label || `Campo ${index + 1}`,
      }))
      .sort((a, b) => Number(a.orden || 0) - Number(b.orden || 0));
  }, [formulario]);

  const camposFormulario = useMemo(() => {
    return camposVisibles.filter((campo) => campo.tipo !== "validacion_dni");
  }, [camposVisibles]);

  const soloConsultaDni = useMemo(() => {
    return Boolean(
      formulario?.soloConsultaDni ||
        formulario?.modoSoloConsultaDni ||
        formulario?.bloquearCargaRespuestas
    );
  }, [formulario]);

  const requiereValidacionDni = useMemo(() => {
    return Boolean(
      soloConsultaDni ||
        formulario?.requiereValidacionDni ||
        camposVisibles.some((campo) => campo.tipo === "validacion_dni")
    );
  }, [formulario, camposVisibles, soloConsultaDni]);

  const permiteMultiplesRespuestasPorDni = useMemo(() => {
    if (soloConsultaDni) return false;
    return Boolean(formulario?.permitirMultiplesRespuestasPorDni);
  }, [formulario, soloConsultaDni]);

  const storageKeyFormularioEnviado = useMemo(() => {
    return id ? `oficina_gestion_formulario_enviado_${id}` : "";
  }, [id]);

  const volverOficinaGestion = () => {
    history.push("/oficina-gestion");
  };

  const cargarFormulario = async () => {
    setLoading(true);
    setErrorCarga("");

    try {
      if (!id) {
        setErrorCarga("No se recibió el ID del formulario.");
        setFormulario(null);
        return;
      }

      const refFormulario = doc(db, "oficina_gestion_formularios", id);
      const snap = await getDoc(refFormulario);

      if (!snap.exists()) {
        setErrorCarga("El formulario solicitado no existe.");
        setFormulario(null);
        return;
      }

      const data = {
        id: snap.id,
        ...snap.data(),
      };

      if (!data.publicado) {
        setErrorCarga("El formulario no está publicado.");
        setFormulario(null);
        return;
      }

      if (!data.activo) {
        setErrorCarga("El formulario no se encuentra activo.");
        setFormulario(null);
        return;
      }

      setFormulario(data);

      const yaEnviadoLocal =
        storageKeyFormularioEnviado &&
        localStorage.getItem(storageKeyFormularioEnviado) === "true";

      const soloConsulta = Boolean(
        data.soloConsultaDni ||
          data.modoSoloConsultaDni ||
          data.bloquearCargaRespuestas
      );

      const requiereDniEnFormulario = Boolean(
        soloConsulta ||
          data.requiereValidacionDni ||
          data.campos?.some((campo) => campo.tipo === "validacion_dni")
      );

      const permiteMultiples = Boolean(data.permitirMultiplesRespuestasPorDni);

      /*
        No bloqueamos por localStorage cuando el formulario valida por DNI.
        Así el afiliado puede ingresar su DNI y, si el administrador habilitó
        la edición, podrá ver y editar su respuesta existente.
      */
      if (yaEnviadoLocal && !permiteMultiples && !requiereDniEnFormulario) {
        setEstadoEnvio("local_existente");
      }
    } catch (error) {
      console.error("Error al cargar formulario:", error);
      setErrorCarga("No se pudo cargar el formulario.");
      setFormulario(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    cargarFormulario();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const actualizarRespuesta = (campoId, valor) => {
    setRespuestas((prev) => ({
      ...prev,
      [campoId]: valor,
    }));
  };

  const actualizarArchivos = (campo, filesSeleccionados) => {
    const files = Array.from(filesSeleccionados || []);

    if (files.length === 0) return;

    const accept = campo.archivoAccept || ARCHIVOS_DEFAULT;
    const invalidos = files.filter((file) => !acceptPermiteArchivo(accept, file));

    if (invalidos.length > 0) {
      toast.current?.show({
        severity: "warn",
        summary: "Archivo no permitido",
        detail: `Hay archivos con formato no permitido. Revise las extensiones aceptadas: ${accept}`,
        life: 4500,
      });

      return;
    }

    setArchivos((prev) => {
      const actuales = prev[campo.id] || [];
      const nuevos = campo.multiple ? [...actuales, ...files] : files.slice(0, 1);

      return {
        ...prev,
        [campo.id]: nuevos,
      };
    });
  };

  const eliminarArchivoSeleccionado = (campoId, index) => {
    setArchivos((prev) => {
      const actuales = prev[campoId] || [];

      return {
        ...prev,
        [campoId]: actuales.filter((_, i) => i !== index),
      };
    });
  };

  const obtenerRespuesta = (campo) => {
    return respuestas[campo.id] ?? "";
  };

  const autocompletarDatosAfiliado = (afiliado) => {
    if (!afiliado) return;

    setRespuestas((prev) => {
      const next = { ...prev };

      camposFormulario.forEach((campo) => {
        const label = campo.label || "";

        if (esCampoApellidoPorLabel(label)) {
          next[campo.id] = afiliado.apellido || "";
        }

        if (esCampoNombrePorLabel(label)) {
          next[campo.id] = afiliado.nombre || "";
        }

        if (esCampoDniPorLabel(label)) {
          next[campo.id] = afiliado.dni || "";
        }

        if (esCampoDepartamentoPorLabel(label)) {
          next[campo.id] = afiliado.departamento || "";
        }
      });

      return next;
    });
  };

  const buscarAfiliadoPorDniEnColeccion = async (nombreColeccion, dni) => {
    const dniNormalizado = normalizarDni(dni);

    if (!dniNormalizado) return null;

    const camposBusqueda = [
      "dni",
      "DNI",
      "documento",
      "Documento",
      "nroDni",
      "numeroDni",
    ];

    const valoresBusqueda = [dniNormalizado];
    const dniNumerico = Number(dniNormalizado);

    if (!Number.isNaN(dniNumerico)) {
      valoresBusqueda.push(dniNumerico);
    }

    for (const campo of camposBusqueda) {
      for (const valor of valoresBusqueda) {
        try {
          const q = query(
            collection(db, nombreColeccion),
            where(campo, "==", valor)
          );

          const snap = await getDocs(q);

          if (!snap.empty) {
            const docSnap = snap.docs[0];

            return normalizarAfiliado(
              docSnap.data(),
              docSnap.id,
              nombreColeccion
            );
          }
        } catch (error) {
          console.error(
            `Error al buscar DNI en ${nombreColeccion}.${campo}:`,
            error
          );
        }
      }
    }

    return null;
  };

  const buscarAfiliadoPorDni = async (dni) => {
    for (const nombreColeccion of COLECCIONES_VALIDACION_DNI) {
      const afiliado = await buscarAfiliadoPorDniEnColeccion(
        nombreColeccion,
        dni
      );

      if (afiliado?.dni) return afiliado;
    }

    return null;
  };

  const verificarRespuestaExistentePorDni = async (dni) => {
    const dniNormalizado = normalizarDni(dni);

    if (!dniNormalizado || !id) return null;

    try {
      const consultas = [
        ["formularioId", id],
        ["formularioCodigo", id],
        ["formularioNumero", id],
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

      const respuestaEncontrada = Array.from(respuestasMap.values()).find(
        (respuesta) => {
          const dniRegistrado = obtenerDniDesdeRespuestaRegistrada(respuesta);
          return dniRegistrado === dniNormalizado;
        }
      );

      return respuestaEncontrada || null;
    } catch (error) {
      console.error("Error al verificar DNI existente:", error);
      return null;
    }
  };

  const validarDniAntesDeCargar = async () => {
    const dniNormalizado = normalizarDni(dniValidacion);

    setMensajeValidacionDni("");

    if (!dniNormalizado || dniNormalizado.length < 6) {
      toast.current?.show({
        severity: "warn",
        summary: "DNI inválido",
        detail: "Ingrese un DNI válido para continuar.",
        life: 3500,
      });

      return;
    }

    setValidandoDni(true);

    try {
      if (soloConsultaDni) {
        const respuestaExistente = await verificarRespuestaExistentePorDni(
          dniNormalizado
        );

        if (respuestaExistente) {
          setRespuestaRegistrada(respuestaExistente);
          setVerDetalleRespuesta(true);
          setEstadoEnvio(null);

          toast.current?.show({
            severity: "success",
            summary: "Información encontrada",
            detail: "Se encontraron datos cargados para el DNI ingresado.",
            life: 4500,
          });

          return;
        }

        setMensajeValidacionDni(
          "No se encontraron datos cargados para el DNI ingresado."
        );

        toast.current?.show({
          severity: "warn",
          summary: "Sin datos cargados",
          detail:
            "El formulario está disponible solo para consulta, pero no se encontró información cargada para ese DNI.",
          life: 5000,
        });

        return;
      }

      if (!permiteMultiplesRespuestasPorDni) {
        const respuestaExistente = await verificarRespuestaExistentePorDni(
          dniNormalizado
        );

        if (respuestaExistente) {
          setRespuestaRegistrada(respuestaExistente);
          setEstadoEnvio("dni_existente");

          toast.current?.show({
            severity: "warn",
            summary: "Registro existente",
            detail:
              "Ya existe un registro cargado con ese DNI para este formulario.",
            life: 5000,
          });

          return;
        }
      }

      const afiliado = await buscarAfiliadoPorDni(dniNormalizado);

      if (!afiliado) {
        setMensajeValidacionDni(
          "No se encontró el DNI ingresado en usuarios ni en nuevoAfiliado."
        );

        toast.current?.show({
          severity: "warn",
          summary: "DNI no encontrado",
          detail:
            "No se encontró el DNI ingresado en usuarios ni en nuevoAfiliado.",
          life: 5000,
        });

        return;
      }

      const afiliadoNormalizado = {
        ...afiliado,
        dni: dniNormalizado,
      };

      setAfiliadoValidado(afiliadoNormalizado);
      autocompletarDatosAfiliado(afiliadoNormalizado);

      toast.current?.show({
        severity: "success",
        summary: "DNI validado",
        detail: `${afiliadoNormalizado.apellido || ""} ${
          afiliadoNormalizado.nombre || ""
        } - DNI ${afiliadoNormalizado.dni}`,
        life: 4500,
      });
    } catch (error) {
      console.error("Error al validar DNI:", error);

      toast.current?.show({
        severity: "error",
        summary: "Error",
        detail: "No se pudo validar el DNI.",
        life: 4500,
      });
    } finally {
      setValidandoDni(false);
    }
  };

  const reiniciarValidacionDni = () => {
    setDniValidacion("");
    setAfiliadoValidado(null);
    setMensajeValidacionDni("");
    setRespuestas({});
    setArchivos({});
  };

  const cargarRespuestaParaEdicionAfiliado = () => {
    if (!respuestaRegistrada?.id) return;

    const respuestasGuardadas = respuestaRegistrada.respuestas || {};
    const respuestasPorCampo = respuestaRegistrada.respuestasPorCampo || {};

    const respuestasIniciales = {};

    camposFormulario.forEach((campo) => {
      const dato = respuestasPorCampo[campo.id];

      if (dato) {
        respuestasIniciales[campo.id] = dato.valor ?? dato.valorLegible ?? "";
        return;
      }

      const valorPorLabel = obtenerValorPorClaves(respuestasGuardadas, [
        campo.label,
      ]);

      if (!valorVacio(valorPorLabel)) {
        respuestasIniciales[campo.id] = valorPorLabel;
      }
    });

    setRespuestas(respuestasIniciales);
    setArchivos({});
    setModoEdicionAfiliado(true);
    setRespuestaEditandoId(respuestaRegistrada.id);
    setEstadoEnvio(null);
    setVerDetalleRespuesta(false);

    setAfiliadoValidado({
      apellido: respuestaRegistrada.apellido || "",
      nombre: respuestaRegistrada.nombre || "",
      dni: respuestaRegistrada.dni || dniValidacion,
      departamento: respuestaRegistrada.departamento || "",
    });
  };

  const validarCampos = () => {
    for (const campo of camposFormulario) {
      if (!campo.obligatorio) continue;

      if (campo.tipo === "archivo" || campo.tipo === "archivo_pdf") {
        const archivosCampo = archivos[campo.id] || [];

        if (
          archivosCampo.length === 0 &&
          !modoEdicionAfiliado &&
          !respuestaRegistrada?.archivos?.[campo.id]
        ) {
          toast.current?.show({
            severity: "warn",
            summary: "Campo obligatorio",
            detail: `Debe adjuntar archivo en: ${campo.label}`,
            life: 3500,
          });

          return false;
        }

        continue;
      }

      const valor = respuestas[campo.id];

      if (valorVacio(valor)) {
        toast.current?.show({
          severity: "warn",
          summary: "Campo obligatorio",
          detail: `Complete el campo: ${campo.label}`,
          life: 3500,
        });

        return false;
      }
    }

    return true;
  };

  const subirArchivosRespuesta = async (respuestaId) => {
    const archivosSubidos = {};

    for (const campo of camposFormulario) {
      if (campo.tipo !== "archivo" && campo.tipo !== "archivo_pdf") continue;

      const files = archivos[campo.id] || [];

      if (files.length === 0) continue;

      archivosSubidos[campo.id] = [];

      for (const file of files) {
        const timestamp = Date.now();
        const nombreLimpio = limpiarNombreArchivo(file.name);
        const path = `oficina_gestion/formularios/${id}/respuestas/${respuestaId}/${campo.id}/${timestamp}_${nombreLimpio}`;
        const archivoRef = ref(storage, path);

        await uploadBytes(archivoRef, file);

        const url = await getDownloadURL(archivoRef);

        archivosSubidos[campo.id].push({
          nombre: file.name,
          name: file.name,
          tipo: file.type,
          type: file.type,
          size: file.size,
          path,
          fullPath: path,
          url,
          downloadURL: url,
          campoId: campo.id,
          campoLabel: campo.label,
        });
      }
    }

    return archivosSubidos;
  };

  const obtenerDatosPrincipalesDesdeRespuesta = (respuestasPlanos) => {
    const apellidoOriginal =
      obtenerValorPorClaves(respuestasPlanos, ["Apellido", "Apellidos"]) ||
      afiliadoValidado?.apellido ||
      "";

    const nombreOriginal =
      obtenerValorPorClaves(respuestasPlanos, ["Nombre", "Nombres"]) ||
      afiliadoValidado?.nombre ||
      "";

    const persona = separarApellidoNombrePersona(apellidoOriginal, nombreOriginal);

    const dni =
      normalizarDni(
        obtenerValorPorClaves(respuestasPlanos, [
          "DNI",
          "Documento",
          "Nro DNI",
          "N° DNI",
          "Nº DNI",
          "Número de DNI",
          "Numero de DNI",
        ])
      ) ||
      normalizarDni(afiliadoValidado?.dni) ||
      normalizarDni(dniValidacion);

    const departamento =
      obtenerValorPorClaves(respuestasPlanos, [
        "Departamento",
        "Depto",
        "Dpto",
      ]) ||
      afiliadoValidado?.departamento ||
      "";

    const presentoDocumentacion =
      normalizarSiNo(
        obtenerValorPorClaves(respuestasPlanos, [
          "Presentó documentación",
          "Presento documentacion",
          "Documentación",
          "Documentacion",
          "Documentación presentada",
          "Documentacion presentada",
        ])
      ) ||
      obtenerValorPorClaves(respuestasPlanos, [
        "Presentó documentación",
        "Presento documentacion",
        "Documentación",
        "Documentacion",
        "Documentación presentada",
        "Documentacion presentada",
      ]) ||
      "";

    return {
      apellido: persona.apellido,
      nombre: persona.nombre,
      dni,
      departamento,
      presentoDocumentacion,
    };
  };

  const construirPayloadRespuesta = async (respuestaId) => {
    const archivosSubidos = await subirArchivosRespuesta(respuestaId);

    const respuestasPlanos = {};
    const respuestasPorCampo = {};

    camposFormulario.forEach((campo) => {
      if (campo.tipo === "archivo" || campo.tipo === "archivo_pdf") {
        const archivosCampo =
          archivosSubidos[campo.id] ||
          respuestaRegistrada?.archivos?.[campo.id] ||
          [];

        respuestasPlanos[campo.label] = archivosCampo;

        respuestasPorCampo[campo.id] = {
          id: campo.id,
          label: campo.label,
          tipo: campo.tipo,
          obligatorio: Boolean(campo.obligatorio),
          orden: campo.orden || 0,
          valor: archivosCampo,
          valorLegible:
            archivosCampo.length > 0
              ? archivosCampo.map((archivo) => archivo.nombre).join(", ")
              : "",
        };

        return;
      }

      let valor = respuestas[campo.id];

      if (campo.tipo === "booleano") {
        valor = normalizarSiNo(valor);
      }

      respuestasPlanos[campo.label] = valor || "";

      respuestasPorCampo[campo.id] = {
        id: campo.id,
        label: campo.label,
        tipo: campo.tipo || "texto",
        obligatorio: Boolean(campo.obligatorio),
        orden: campo.orden || 0,
        valor: valor || "",
        valorLegible: obtenerValorPlano(valor),
      };
    });

    const principales = obtenerDatosPrincipalesDesdeRespuesta(respuestasPlanos);

    return {
      formularioId: id,
      formularioCodigo: id,
      formularioNumero: id,
      formularioTitulo: formulario?.titulo || "",
      origen: "formulario_publico",

      apellido: principales.apellido,
      nombre: principales.nombre,
      dni: principales.dni,
      departamento: principales.departamento,
      presentoDocumentacion: principales.presentoDocumentacion,

      respuestas: respuestasPlanos,
      respuestasPorCampo,
      archivos: {
        ...(respuestaRegistrada?.archivos || {}),
        ...archivosSubidos,
      },

      cantidadCampos: camposFormulario.length,
      updatedAt: serverTimestamp(),
    };
  };

  const enviarFormulario = async () => {
    if (!formulario || enviando || (enviado && !modoEdicionAfiliado)) return;

    if (soloConsultaDni) {
      toast.current?.show({
        severity: "warn",
        summary: "Solo consulta",
        detail: "Este formulario está habilitado solo para consulta por DNI.",
        life: 3500,
      });

      return;
    }

    if (requiereValidacionDni && !afiliadoValidado && !modoEdicionAfiliado) {
      toast.current?.show({
        severity: "warn",
        summary: "Validación requerida",
        detail: "Debe validar el DNI antes de completar el formulario.",
        life: 3500,
      });

      return;
    }

    if (!validarCampos()) return;

    setEnviando(true);
    setVerificandoDni(true);

    try {
      const dniFinal =
        normalizarDni(afiliadoValidado?.dni) || normalizarDni(dniValidacion);

      if (
        !modoEdicionAfiliado &&
        requiereValidacionDni &&
        !permiteMultiplesRespuestasPorDni
      ) {
        const existente = await verificarRespuestaExistentePorDni(dniFinal);

        if (existente) {
          setRespuestaRegistrada(existente);
          setEstadoEnvio("dni_existente");
          return;
        }
      }

      const refRespuesta = modoEdicionAfiliado
        ? doc(db, "oficina_gestion_respuestas", respuestaEditandoId)
        : doc(collection(db, "oficina_gestion_respuestas"));

      const payload = await construirPayloadRespuesta(refRespuesta.id);

      if (modoEdicionAfiliado) {
        await updateDoc(refRespuesta, {
          ...payload,
          editadoPorAfiliado: true,
          editadoPorAfiliadoAt: serverTimestamp(),
          edicionAfiliadoHabilitada: false,
          edicionAfiliadoDeshabilitadaAt: serverTimestamp(),
        });

        setEstadoEnvio("actualizado");
      } else {
        await setDoc(refRespuesta, {
          id: refRespuesta.id,
          ...payload,
          createdAt: serverTimestamp(),
        });

        if (storageKeyFormularioEnviado) {
          localStorage.setItem(storageKeyFormularioEnviado, "true");
        }

        setEstadoEnvio("ok");
      }

      toast.current?.show({
        severity: "success",
        summary: modoEdicionAfiliado
          ? "Formulario actualizado"
          : "Formulario enviado",
        detail: modoEdicionAfiliado
          ? "La información fue actualizada correctamente."
          : "La información fue registrada correctamente.",
        life: 4500,
      });
    } catch (error) {
      console.error("Error al enviar formulario:", error);

      toast.current?.show({
        severity: "error",
        summary: "Error",
        detail: "No se pudo guardar la información.",
        life: 4500,
      });
    } finally {
      setEnviando(false);
      setVerificandoDni(false);
    }
  };

  const reiniciarFormularioParaNuevaCarga = () => {
    setRespuestas({});
    setArchivos({});
    setEstadoEnvio(null);
    setRespuestaRegistrada(null);
    setVerDetalleRespuesta(false);
    setModoEdicionAfiliado(false);
    setRespuestaEditandoId(null);

    if (requiereValidacionDni) {
      setDniValidacion("");
      setAfiliadoValidado(null);
      setMensajeValidacionDni("");
    }
  };

  const renderValorDetalle = (value) => {
    if (value === null || value === undefined || value === "") {
      return <span className={styles.detalleEmpty}>—</span>;
    }

    if (typeof value === "boolean") {
      return <span>{value ? "Sí" : "No"}</span>;
    }

    if (esArchivoAdjunto(value)) {
      const url = obtenerUrlArchivo(value);

      return (
        <div className={styles.detalleArchivosBox}>
          <div className={styles.detalleArchivoRow}>
            <i className="pi pi-paperclip" />

            {url ? (
              <a href={url} target="_blank" rel="noreferrer">
                {obtenerNombreArchivo(value)}
              </a>
            ) : (
              <span>{obtenerNombreArchivo(value)}</span>
            )}
          </div>
        </div>
      );
    }

    if (esListaDeArchivos(value)) {
      return (
        <div className={styles.detalleArchivosBox}>
          {value
            .filter((archivo) => esArchivoAdjunto(archivo))
            .map((archivo, index) => {
              const url = obtenerUrlArchivo(archivo);

              return (
                <div
                  key={`${obtenerNombreArchivo(archivo)}-${index}`}
                  className={styles.detalleArchivoRow}
                >
                  <i className="pi pi-paperclip" />

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
      if (value.length === 0) {
        return <span className={styles.detalleEmpty}>—</span>;
      }

      return (
        <div className={styles.detalleListaSimple}>
          {value.map((item, index) => (
            <div key={index} className={styles.detalleListaRow}>
              {String(item)}
            </div>
          ))}
        </div>
      );
    }

    if (typeof value === "object") {
      return <span>{JSON.stringify(value)}</span>;
    }

    return <span>{String(value)}</span>;
  };

  const actualizarOCrearCampoDetalle = (lista, label, value) => {
    if (value === undefined || value === null || value === "") return;

    const index = lista.findIndex(
      (item) => normalizarTexto(item.label) === normalizarTexto(label)
    );

    if (index >= 0) {
      lista[index] = {
        ...lista[index],
        value,
      };

      return;
    }

    lista.push({
      id: `extra_${normalizarTexto(label).replace(/\s+/g, "_")}`,
      label,
      value,
    });
  };

  const obtenerCamposDetalleRespuesta = () => {
    if (!respuestaRegistrada) return [];

    const respuestasPorCampo = respuestaRegistrada.respuestasPorCampo || {};
    const respuestasGuardadas = respuestaRegistrada.respuestas || {};
    const archivosGuardados = respuestaRegistrada.archivos || {};

    let detalle = [];

    if (camposVisibles.length > 0) {
      detalle = camposVisibles
        .filter((campo) => campo.tipo !== "validacion_dni")
        .map((campo) => {
          const dato = respuestasPorCampo[campo.id];

          if (campo.tipo === "archivo" || campo.tipo === "archivo_pdf") {
            const archivosDesdeCampo = dato?.valor || [];
            const archivosDesdeRespuesta = archivosGuardados[campo.id] || [];

            return {
              id: campo.id,
              label: dato?.label || campo.label,
              value:
                archivosDesdeCampo.length > 0
                  ? archivosDesdeCampo
                  : archivosDesdeRespuesta,
              tipo: campo.tipo,
            };
          }

          if (dato) {
            return {
              id: campo.id,
              label: dato.label || campo.label,
              value: dato.valorLegible ?? dato.valor ?? "",
              tipo: campo.tipo,
            };
          }

          return {
            id: campo.id,
            label: campo.label,
            value: obtenerValorPorClaves(respuestasGuardadas, [campo.label]),
            tipo: campo.tipo,
          };
        });
    } else {
      detalle = Object.entries(respuestasGuardadas).map(([key, value]) => ({
        id: key,
        label: key,
        value,
      }));
    }

    const apellidoOriginal =
      respuestaRegistrada.apellido ||
      obtenerValorPorClaves(respuestasGuardadas, ["Apellido", "Apellidos"]);

    const nombreOriginal =
      respuestaRegistrada.nombre ||
      obtenerValorPorClaves(respuestasGuardadas, ["Nombre", "Nombres"]);

    const persona = separarApellidoNombrePersona(apellidoOriginal, nombreOriginal);

    actualizarOCrearCampoDetalle(detalle, "Apellido", persona.apellido || "—");
    actualizarOCrearCampoDetalle(detalle, "Nombre", persona.nombre || "—");

    actualizarOCrearCampoDetalle(
      detalle,
      "DNI",
      respuestaRegistrada.dni ||
        obtenerValorPorClaves(respuestasGuardadas, [
          "DNI",
          "Documento",
          "Nro DNI",
          "N° DNI",
          "Nº DNI",
          "Número de DNI",
          "Numero de DNI",
        ])
    );

    actualizarOCrearCampoDetalle(
      detalle,
      "Departamento",
      respuestaRegistrada.departamento ||
        obtenerValorPorClaves(respuestasGuardadas, [
          "Departamento",
          "Depto",
          "Dpto",
        ]) ||
        "—"
    );

    const valorDocumentacion =
      normalizarSiNo(respuestaRegistrada.presentoDocumentacion) ||
      normalizarSiNo(
        obtenerValorPorClaves(respuestasGuardadas, [
          "Presentó documentación",
          "Presento documentacion",
          "Documentación",
          "Documentacion",
          "Documentación presentada",
          "Documentacion presentada",
        ])
      );

    if (valorDocumentacion) {
      actualizarOCrearCampoDetalle(
        detalle,
        "DOCUMENTACIÓN PRESENTADA",
        valorDocumentacion
      );
    }

    return detalle.filter((item) => item && !valorVacio(item.value));
  };

  const esCampoAdjuntoDetalle = (item) => {
    const labelNormalizado = normalizarTexto(item?.label);

    return (
      labelNormalizado.includes("adjuntar") ||
      labelNormalizado.includes("archivo") ||
      esArchivoAdjunto(item?.value) ||
      esListaDeArchivos(item?.value)
    );
  };

  const ordenarCamposDetallePorSecciones = (detalleCampos = []) => {
    const usados = new Set();

    const tomarCampo = (condicion) => {
      const encontrado = detalleCampos.find((item) => {
        if (!item?.id || usados.has(item.id)) return false;
        return condicion(item);
      });

      if (encontrado) usados.add(encontrado.id);

      return encontrado || null;
    };

    const apellido = tomarCampo((item) => esCampoApellidoPorLabel(item.label));
    const nombre = tomarCampo((item) => esCampoNombrePorLabel(item.label));
    const dni = tomarCampo((item) => esCampoDniPorLabel(item.label));
    const departamento = tomarCampo((item) =>
      esCampoDepartamentoPorLabel(item.label)
    );

    const adjuntos = detalleCampos.filter((item) => {
      if (!item?.id || usados.has(item.id)) return false;

      if (esCampoAdjuntoDetalle(item)) {
        usados.add(item.id);
        return true;
      }

      return false;
    });

    const otrosCampos = detalleCampos.filter((item) => {
      if (!item?.id || usados.has(item.id)) return false;

      if (
        esCampoApellidoPorLabel(item.label) ||
        esCampoNombrePorLabel(item.label) ||
        esCampoDniPorLabel(item.label) ||
        esCampoDepartamentoPorLabel(item.label) ||
        esCampoAdjuntoDetalle(item)
      ) {
        return false;
      }

      usados.add(item.id);
      return true;
    });

    return {
      datosPersonales: [apellido, nombre, dni].filter(Boolean),
      departamento: departamento ? [departamento] : [],
      otrosCampos,
      adjuntos,
    };
  };

  const renderCampoDetalleOrdenado = (item, opciones = {}) => {
    const { full = false } = opciones;

    if (!item) return null;

    const esDocPresentada = esCampoDocumentacionPorLabel(item.label);
    const valorSiNo = normalizarSiNo(item.value);

    return (
      <div
        key={item.id}
        className={`${styles.detalleCampoCard || ""} ${
          full ? styles.detalleCampoCardFull || "" : ""
        }`}
      >
        <div className={styles.detalleCampoLabel}>{item.label}</div>

        <div className={styles.detalleCampoValue}>
          {esDocPresentada && valorSiNo === "Sí" ? (
            <span className={styles.detalleEstadoSi}>
              <i className="pi pi-check-circle" />
              Sí
            </span>
          ) : esDocPresentada && valorSiNo === "No" ? (
            <span className={styles.detalleEstadoNo}>
              <i className="pi pi-times-circle" />
              No
            </span>
          ) : (
            renderValorDetalle(item.value)
          )}
        </div>
      </div>
    );
  };

  const renderSeccionDetalle = (titulo, icono, campos, opciones = {}) => {
    const { full = false } = opciones;
    const camposValidos = (campos || []).filter(Boolean);

    if (camposValidos.length === 0) return null;

    return (
      <section className={styles.detalleSection}>
        <h3 className={styles.detalleSectionTitle}>
          <i className={icono} />
          {titulo}
        </h3>

        <div className={styles.detalleCamposGrid}>
          {camposValidos.map((item) =>
            renderCampoDetalleOrdenado(item, { full })
          )}
        </div>
      </section>
    );
  };

  const renderContenidoDetalleRespuesta = () => {
    if (!respuestaRegistrada) return null;

    const detalleCampos = obtenerCamposDetalleRespuesta();

    const { datosPersonales, departamento, otrosCampos, adjuntos } =
      ordenarCamposDetallePorSecciones(detalleCampos);

    const fechaCarga = formatearFechaHora(
      respuestaRegistrada.createdAt || respuestaRegistrada.updatedAt
    );

    const fechaActualizacion = formatearFechaHora(
      respuestaRegistrada.editadoPorAfiliadoAt || respuestaRegistrada.updatedAt
    );

    const hayActualizacion = Boolean(
      respuestaRegistrada.editadoPorAfiliadoAt || respuestaRegistrada.updatedAt
    );

    return (
      <div className={styles.detalleRespuesta}>
        <section className={styles.detalleSection}>
          <h3 className={styles.detalleSectionTitle}>
            <i className="pi pi-file-edit" />
            1. Datos del formulario
          </h3>

          <div className={styles.detalleMetaGrid}>
            <div className={styles.detalleMetaCard}>
              <span className={styles.detalleMetaLabel}>Formulario</span>
              <span className={styles.detalleMetaValue}>
                {respuestaRegistrada.formularioTitulo ||
                  formulario?.titulo ||
                  "—"}
              </span>
            </div>

            <div className={styles.detalleMetaCard}>
              <span className={styles.detalleMetaLabel}>
                N° / Código de formulario
              </span>
              <span className={styles.detalleMetaValue}>
                {respuestaRegistrada.formularioNumero ||
                  respuestaRegistrada.formularioCodigo ||
                  respuestaRegistrada.formularioId ||
                  "—"}
              </span>
            </div>

            <div className={styles.detalleMetaCard}>
              <span className={styles.detalleMetaLabel}>
                Fecha y hora de carga
              </span>
              <span className={styles.detalleMetaValue}>{fechaCarga}</span>
            </div>

            <div className={styles.detalleMetaCard}>
              <span className={styles.detalleMetaLabel}>
                Fecha y hora de actualización
              </span>
              <span className={styles.detalleMetaValue}>
                {hayActualizacion ? fechaActualizacion : "Sin actualizaciones"}
              </span>
            </div>
          </div>
        </section>

        {renderSeccionDetalle(
          "2. Datos personales",
          "pi pi-user",
          datosPersonales
        )}

        {renderSeccionDetalle(
          "3. Departamento",
          "pi pi-map-marker",
          departamento,
          { full: true }
        )}

        {renderSeccionDetalle(
          "4. Otros datos cargados",
          "pi pi-list",
          otrosCampos
        )}

        {renderSeccionDetalle(
          "5. Documentación adjunta",
          "pi pi-paperclip",
          adjuntos,
          { full: true }
        )}

        {detalleCampos.length === 0 && (
          <section className={styles.detalleSection}>
            <div className={styles.detalleCampoCard}>
              <div className={styles.detalleCampoLabel}>Sin datos</div>
              <div className={styles.detalleCampoValue}>
                No se encontraron datos para mostrar.
              </div>
            </div>
          </section>
        )}
      </div>
    );
  };

  const renderDialogDetalleRespuesta = () => {
    if (!respuestaRegistrada) return null;

    return (
      <Dialog
        header="Información cargada"
        visible={verDetalleRespuesta}
        style={{ width: "960px", maxWidth: "95vw" }}
        modal
        onHide={() => setVerDetalleRespuesta(false)}
      >
        {renderContenidoDetalleRespuesta()}
      </Dialog>
    );
  };

  const renderVistaConsultaDirecta = () => {
    if (!respuestaRegistrada) return null;

    return (
      <main className={styles.page}>
        <Toast ref={toast} />

        <section className={styles.formCard}>
          <header className={styles.header}>
            <div className={styles.headerTop}>
              <span className={styles.badge}>Oficina de Gestión</span>

              <Button
                label="Cerrar y volver a Oficina de Gestión"
                icon="pi pi-times"
                severity="secondary"
                outlined
                onClick={volverOficinaGestion}
              />
            </div>

            <h1>Información cargada</h1>

            <p>
              Se encontró información registrada para el DNI ingresado en este
              formulario.
            </p>
          </header>

          <Message
            severity="success"
            text="Información encontrada correctamente. Revise los datos cargados a continuación."
          />

          {renderContenidoDetalleRespuesta()}

          <div className={styles.successActions}>
            <Button
              label="Cerrar y volver a Oficina de Gestión"
              icon="pi pi-arrow-left"
              severity="warning"
              onClick={volverOficinaGestion}
            />
          </div>
        </section>
      </main>
    );
  };

  const renderDescripcionFormulario = () => {
    const html =
      formulario?.descripcionHtml || textoPlanoAHtml(formulario?.descripcion || "");

    if (!htmlATextoPlano(html)) return null;

    return (
      <div
        className={styles.descripcionFormularioPublica}
        dangerouslySetInnerHTML={{
          __html: sanearHtmlBasico(html),
        }}
      />
    );
  };

  const renderArchivoDescargableFormulario = () => {
    const archivo =
      formulario?.archivoDescargaFormulario ||
      formulario?.archivoDescarga ||
      null;

    if (!archivo?.url) return null;

    return (
      <div className={styles.archivoDescargableBox}>
        <div>
          <strong>Archivo disponible para descargar</strong>

          <p className={styles.archivoDescargableDescripcion}>
            {archivo.descripcion ||
              "Antes de completar el formulario, podés descargar este archivo de referencia."}
          </p>
        </div>

        <a
          href={archivo.url}
          target="_blank"
          rel="noreferrer"
          download={archivo.nombre || true}
          className={styles.archivoDescargableLink}
        >
          <i className="pi pi-download" />
          {archivo.nombre || "Descargar archivo"}
        </a>
      </div>
    );
  };

  const renderCampo = (campo) => {
    const valor = obtenerRespuesta(campo);

    switch (campo.tipo) {
      case "validacion_dni":
        return null;

      case "textarea":
        return (
          <InputTextarea
            value={valor}
            onChange={(e) => actualizarRespuesta(campo.id, e.target.value)}
            placeholder={campo.placeholder || "Ingrese su respuesta"}
            rows={4}
            autoResize
            disabled={enviando}
          />
        );

      case "numero":
        return (
          <InputText
            type="number"
            value={valor}
            onChange={(e) => actualizarRespuesta(campo.id, e.target.value)}
            placeholder={campo.placeholder || "Ingrese un número"}
            disabled={enviando}
          />
        );

      case "fecha":
        return (
          <InputText
            type="date"
            value={valor}
            onChange={(e) => actualizarRespuesta(campo.id, e.target.value)}
            disabled={enviando}
          />
        );

      case "email":
        return (
          <InputText
            type="email"
            value={valor}
            onChange={(e) => actualizarRespuesta(campo.id, e.target.value)}
            placeholder={campo.placeholder || "Ingrese correo electrónico"}
            disabled={enviando}
          />
        );

      case "departamento": {
        const opcionesPermitidas = departamentosOptions.filter((opcion) =>
          (campo.departamentosPermitidos || departamentosValues).includes(
            opcion.value
          )
        );

        if (campo.departamentoMultiple || campo.departamentoModo === "multiple") {
          return (
            <MultiSelect
              value={Array.isArray(valor) ? valor : []}
              options={opcionesPermitidas}
              optionLabel="label"
              optionValue="value"
              placeholder={
                campo.placeholder || "Seleccione uno o varios departamentos"
              }
              display="chip"
              filter
              disabled={enviando}
              onChange={(e) => actualizarRespuesta(campo.id, e.value)}
            />
          );
        }

        return (
          <Dropdown
            value={valor || null}
            options={opcionesPermitidas}
            optionLabel="label"
            optionValue="value"
            placeholder={campo.placeholder || "Seleccione departamento"}
            filter
            disabled={enviando}
            onChange={(e) => actualizarRespuesta(campo.id, e.value)}
          />
        );
      }

      case "booleano":
        return (
          <Dropdown
            value={valor || null}
            options={OPCIONES_SI_NO}
            optionLabel="label"
            optionValue="value"
            placeholder={campo.placeholder || "Seleccione una opción"}
            disabled={enviando}
            onChange={(e) => actualizarRespuesta(campo.id, e.value)}
          />
        );

      case "archivo":
      case "archivo_pdf": {
        const accept = campo.archivoAccept || ARCHIVOS_DEFAULT;
        const files = archivos[campo.id] || [];

        return (
          <div className={styles.fileField}>
            <div className={styles.fileActions}>
              <label className={styles.fileButton}>
                <i className="pi pi-upload" />
                Seleccionar archivo
                <input
                  type="file"
                  accept={accept}
                  multiple={Boolean(campo.multiple)}
                  disabled={enviando}
                  onChange={(e) => actualizarArchivos(campo, e.target.files)}
                />
              </label>

              {campo.permiteCamara && (
                <label className={styles.fileButtonAlt}>
                  <i className="pi pi-camera" />
                  Tomar foto
                  <input
                    type="file"
                    accept="image/*"
                    capture="environment"
                    disabled={enviando}
                    onChange={(e) => actualizarArchivos(campo, e.target.files)}
                  />
                </label>
              )}
            </div>

            <small className={styles.help}>Formatos permitidos: {accept}</small>

            {files.length > 0 && (
              <div className={styles.fileList}>
                {files.map((file, index) => (
                  <div
                    key={`${file.name}-${index}`}
                    className={styles.fileItem}
                  >
                    <span>{file.name}</span>

                    <button
                      type="button"
                      onClick={() => eliminarArchivoSeleccionado(campo.id, index)}
                      disabled={enviando}
                    >
                      Quitar
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      }

      case "texto":
      default:
        return (
          <InputText
            value={valor}
            onChange={(e) => actualizarRespuesta(campo.id, e.target.value)}
            placeholder={campo.placeholder || "Ingrese su respuesta"}
            disabled={enviando}
          />
        );
    }
  };

  const renderPantallaValidacionDni = () => {
    return (
      <main className={styles.page}>
        <Toast ref={toast} />

        <section className={styles.formCard}>
          <header className={styles.header}>
            <div className={styles.headerTop}>
              <span className={styles.badge}>Oficina de Gestión</span>

              <Button
                label="Volver"
                icon="pi pi-arrow-left"
                severity="secondary"
                outlined
                onClick={volverOficinaGestion}
              />
            </div>

            <h1>{formulario?.titulo}</h1>

            {renderDescripcionFormulario()}

            {renderArchivoDescargableFormulario()}
          </header>

          <Message
            severity={soloConsultaDni ? "warn" : "info"}
            text={
              soloConsultaDni
                ? "Este formulario está habilitado solo para consultar información ya cargada. Ingrese su DNI para buscar los datos registrados."
                : "Para completar este formulario, primero debe validar su DNI."
            }
          />

          <div className={styles.fields}>
            <div className={styles.field}>
              <label>DNI</label>

              <InputText
                value={dniValidacion}
                onChange={(e) => setDniValidacion(e.target.value)}
                placeholder="Ingrese su DNI"
                keyfilter="int"
                disabled={validandoDni}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    validarDniAntesDeCargar();
                  }
                }}
              />

              {mensajeValidacionDni && (
                <small className={styles.help}>{mensajeValidacionDni}</small>
              )}
            </div>
          </div>

          <div className={styles.actions}>
            <Button
              label={soloConsultaDni ? "Consultar información" : "Validar DNI"}
              icon={soloConsultaDni ? "pi pi-search" : "pi pi-check"}
              severity={soloConsultaDni ? "warning" : "success"}
              onClick={validarDniAntesDeCargar}
              loading={validandoDni}
              disabled={validandoDni}
            />
          </div>
        </section>
      </main>
    );
  };

  if (loading) {
    return (
      <main className={styles.page}>
        <div className={styles.loadingBox}>
          <ProgressSpinner />
          <span>Cargando formulario...</span>
        </div>
      </main>
    );
  }

  if (errorCarga) {
    return (
      <main className={styles.page}>
        <section className={styles.errorCard}>
          <i className="pi pi-exclamation-triangle" />

          <h1>Formulario no disponible</h1>

          <p>{errorCarga}</p>

          <Button
            label="Volver"
            icon="pi pi-arrow-left"
            severity="secondary"
            outlined
            onClick={volverOficinaGestion}
          />
        </section>
      </main>
    );
  }

  if (soloConsultaDni && respuestaRegistrada && verDetalleRespuesta) {
    return renderVistaConsultaDirecta();
  }

  if (enviado) {
    const esDuplicadoDni = estadoEnvio === "dni_existente";
    const esDuplicadoLocal = estadoEnvio === "local_existente";
    const fueActualizacionAfiliado = estadoEnvio === "actualizado";

    const puedeEditar =
      !soloConsultaDni &&
      esDuplicadoDni &&
      respuestaRegistrada?.edicionAfiliadoHabilitada;

    return (
      <main className={styles.page}>
        <Toast ref={toast} />

        <section
          className={
            esDuplicadoDni || esDuplicadoLocal
              ? styles.warningCard
              : styles.successCard
          }
        >
          <i
            className={
              esDuplicadoDni || esDuplicadoLocal
                ? "pi pi-exclamation-triangle"
                : "pi pi-check-circle"
            }
          />

          <h1>
            {esDuplicadoDni
              ? "Ya existe un registro con ese DNI"
              : esDuplicadoLocal
              ? "Formulario ya cargado"
              : fueActualizacionAfiliado
              ? "Formulario actualizado correctamente"
              : "Formulario enviado correctamente"}
          </h1>

          <p>
            {esDuplicadoDni
              ? puedeEditar
                ? "El administrador habilitó la edición de este formulario. Puede revisar la información cargada o modificarla."
                : "No se puede volver a cargar este formulario porque ya existe una respuesta registrada con el DNI ingresado para este formulario."
              : esDuplicadoLocal
              ? "Este formulario ya fue enviado desde este dispositivo."
              : "La información fue registrada correctamente."}
          </p>

          <div className={styles.successActions}>
            {respuestaRegistrada && (
              <Button
                label="Ver información cargada"
                icon="pi pi-eye"
                severity="info"
                outlined
                onClick={() => setVerDetalleRespuesta(true)}
              />
            )}

            {puedeEditar && (
              <Button
                label="Editar mi formulario"
                icon="pi pi-pencil"
                severity="success"
                onClick={cargarRespuestaParaEdicionAfiliado}
              />
            )}

            {permiteMultiplesRespuestasPorDni &&
              !esDuplicadoDni &&
              !esDuplicadoLocal && (
                <Button
                  label="Cargar otra respuesta"
                  icon="pi pi-plus"
                  severity="success"
                  outlined
                  onClick={reiniciarFormularioParaNuevaCarga}
                />
              )}

            <Button
              label="Volver a Oficina de Gestión"
              icon="pi pi-arrow-left"
              severity={esDuplicadoDni || esDuplicadoLocal ? "warning" : "success"}
              onClick={volverOficinaGestion}
            />

            <Button
              label="Ir al inicio"
              icon="pi pi-home"
              severity="secondary"
              outlined
              onClick={() => history.push("/home")}
            />
          </div>
        </section>

        {renderDialogDetalleRespuesta()}
      </main>
    );
  }

  if ((requiereValidacionDni || soloConsultaDni) && !afiliadoValidado) {
    return renderPantallaValidacionDni();
  }

  return (
    <main className={styles.page}>
      <Toast ref={toast} />

      <section className={styles.formCard}>
        <header className={styles.header}>
          <div className={styles.headerTop}>
            <span className={styles.badge}>Oficina de Gestión</span>

            <Button
              label="Volver"
              icon="pi pi-arrow-left"
              severity="secondary"
              outlined
              onClick={volverOficinaGestion}
            />
          </div>

          <h1>{formulario?.titulo}</h1>

          {renderDescripcionFormulario()}

          {renderArchivoDescargableFormulario()}

          <small>
            Código del formulario: <strong>{formulario?.id}</strong>
          </small>
        </header>

        {modoEdicionAfiliado && (
          <Message
            severity="warn"
            text="Edición habilitada por administración. Al guardar, se actualizará la respuesta existente y la edición volverá a quedar cerrada."
          />
        )}

        {afiliadoValidado && (
          <Message
            severity="success"
            text={`DNI validado correctamente: ${afiliadoValidado.apellido} ${afiliadoValidado.nombre} - DNI ${afiliadoValidado.dni}`}
          />
        )}

        {permiteMultiplesRespuestasPorDni && (
          <Message
            severity="info"
            text="Este formulario permite realizar más de una carga con el mismo DNI."
          />
        )}

        {afiliadoValidado && (
          <div className={styles.fileList}>
            <div className={styles.fileItem}>
              <span>
                <strong>Apellido:</strong> {afiliadoValidado.apellido || "—"}
              </span>
            </div>

            <div className={styles.fileItem}>
              <span>
                <strong>Nombre:</strong> {afiliadoValidado.nombre || "—"}
              </span>
            </div>

            <div className={styles.fileItem}>
              <span>
                <strong>DNI:</strong> {afiliadoValidado.dni || "—"}
              </span>
            </div>

            {!modoEdicionAfiliado && (
              <div className={styles.actions}>
                <Button
                  label="Cambiar DNI"
                  icon="pi pi-refresh"
                  severity="danger"
                  outlined
                  onClick={reiniciarValidacionDni}
                />
              </div>
            )}
          </div>
        )}

        <Message
          severity="info"
          text="Complete los datos solicitados. Los campos marcados con * son obligatorios."
        />

        {verificandoDni && (
          <div className={styles.loadingBox}>
            <ProgressSpinner />
            <span>Verificando si el DNI ya fue cargado...</span>
          </div>
        )}

        <div className={styles.fields}>
          {camposFormulario.map((campo) => (
            <div key={campo.id} className={styles.field}>
              <label>
                {campo.label}

                {campo.obligatorio && (
                  <span className={styles.required}> *</span>
                )}
              </label>

              {renderCampo(campo)}
            </div>
          ))}
        </div>

        <div className={styles.actions}>
          <Button
            label={
              modoEdicionAfiliado
                ? "Guardar actualización"
                : "Enviar formulario"
            }
            icon={modoEdicionAfiliado ? "pi pi-save" : "pi pi-send"}
            severity="success"
            onClick={enviarFormulario}
            loading={enviando || verificandoDni}
            disabled={enviando || verificandoDni}
          />
        </div>
      </section>
    </main>
  );
};

export default FormularioGestionPublico;