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

const normalizarSiNo = (valor) => {
  if (valor === true) return "Sí";
  if (valor === false) return "No";

  const texto = normalizarTexto(valor);

  if (texto === "si" || texto === "s" || texto === "true") {
    return "Sí";
  }

  if (texto === "no" || texto === "n" || texto === "false") {
    return "No";
  }

  return "";
};

const esValorSiNo = (valor) => {
  return Boolean(normalizarSiNo(valor));
};

const esCampoTipoSiNo = (campo = {}) => {
  const tipo = normalizarTexto(campo.tipo || "");

  return (
    tipo === "booleano" ||
    tipo === "si_no" ||
    tipo === "sí / no" ||
    tipo === "si / no" ||
    tipo.includes("boolean")
  );
};

const normalizarDni = (valor) => {
  return String(valor || "").replace(/\D/g, "").trim();
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

const esCampoApellidoNombrePorLabel = (label = "") => {
  const normalizado = normalizarTexto(label);
  return normalizado.includes("apellido") && normalizado.includes("nombre");
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

  return {
    apellido,
    nombre,
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

const convertirFecha = (valor) => {
  if (!valor) return null;

  if (valor?.toDate && typeof valor.toDate === "function") {
    return valor.toDate();
  }

  if (valor instanceof Date) {
    return valor;
  }

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
  return Boolean(valor && typeof valor === "object" && valor.url);
};

const esListaDeArchivos = (valor) => {
  return (
    Array.isArray(valor) &&
    valor.length > 0 &&
    valor.every((item) => esArchivoAdjunto(item))
  );
};

const obtenerDatoPorClaves = (data = {}, claves = []) => {
  for (const clave of claves) {
    if (data?.[clave] !== undefined && data?.[clave] !== null) {
      return data[clave];
    }
  }

  const keys = Object.keys(data || {});

  for (const clave of claves) {
    const claveNormalizada = normalizarTexto(clave);

    const keyEncontrada = keys.find(
      (key) => normalizarTexto(key) === claveNormalizada
    );

    if (keyEncontrada) {
      return data[keyEncontrada];
    }
  }

  return "";
};

const normalizarAfiliado = (data = {}, idDoc = "", origen = "") => {
  const nombreOriginal = String(
    obtenerDatoPorClaves(data, ["nombre", "Nombre", "nombres", "Nombres"])
  ).trim();

  const apellidoOriginal = String(
    obtenerDatoPorClaves(data, [
      "apellido",
      "Apellido",
      "apellidos",
      "Apellidos",
    ])
  ).trim();

  const personaNormalizada = separarApellidoNombrePersona(
    apellidoOriginal,
    nombreOriginal
  );

  const dni = normalizarDni(
    obtenerDatoPorClaves(data, [
      "dni",
      "DNI",
      "documento",
      "Documento",
      "nroDni",
      "Nro DNI",
      "N° DNI",
      "Nº DNI",
      "numeroDni",
      "Número de DNI",
      "Numero de DNI",
    ])
  );

  return {
    id: idDoc,
    origen,
    nombre: personaNormalizada.nombre,
    apellido: personaNormalizada.apellido,
    dni,
    raw: data,
  };
};

const FormularioGestionPublico = () => {
  const { id } = useParams();
  const history = useHistory();
  const toast = useRef(null);

  const [formulario, setFormulario] = useState(null);
  const [respuestas, setRespuestas] = useState({});
  const [archivos, setArchivos] = useState({});
  const [archivosExistentesPorCampo, setArchivosExistentesPorCampo] =
    useState({});

  const [loading, setLoading] = useState(true);
  const [enviando, setEnviando] = useState(false);
  const [validandoDni, setValidandoDni] = useState(false);
  const [verificandoDni, setVerificandoDni] = useState(false);

  const [estadoEnvio, setEstadoEnvio] = useState(null);
  const [errorCarga, setErrorCarga] = useState("");

  const [dniValidacion, setDniValidacion] = useState("");
  const [afiliadoValidado, setAfiliadoValidado] = useState(null);
  const [mensajeValidacionDni, setMensajeValidacionDni] = useState("");

  const [respuestaRegistrada, setRespuestaRegistrada] = useState(null);
  const [verDetalleRespuesta, setVerDetalleRespuesta] = useState(false);

  const [modoEdicionAfiliado, setModoEdicionAfiliado] = useState(false);
  const [fueActualizacionAfiliado, setFueActualizacionAfiliado] =
    useState(false);

  const enviado = Boolean(estadoEnvio);

  const localStorageKey = useMemo(() => {
    return id ? `oficina_gestion_formulario_enviado_${id}` : "";
  }, [id]);

  const localStorageRespuestaKey = useMemo(() => {
    return id ? `oficina_gestion_formulario_respuesta_${id}` : "";
  }, [id]);

  const camposOrdenados = useMemo(() => {
    return [...(formulario?.campos || [])].sort(
      (a, b) => Number(a.orden || 0) - Number(b.orden || 0)
    );
  }, [formulario]);

  const requiereValidacionDni = useMemo(() => {
    return Boolean(
      formulario?.requiereValidacionDni ||
        camposOrdenados.some((campo) => campo.tipo === "validacion_dni")
    );
  }, [formulario, camposOrdenados]);

  const permiteMultiplesRespuestasPorDni = useMemo(() => {
    return Boolean(formulario?.permitirMultiplesRespuestasPorDni);
  }, [formulario]);

  const soloConsultaDni = useMemo(() => {
    return Boolean(
      formulario?.soloConsultaDni ||
        formulario?.modoSoloConsultaDni ||
        formulario?.bloquearCargaRespuestas
    );
  }, [formulario]);

  const camposVisibles = useMemo(() => {
    return camposOrdenados.filter((campo) => campo.tipo !== "validacion_dni");
  }, [camposOrdenados]);

  const clavesDocumentacionPresentada = [
    "PRESENTO DOCUMENTACIÓN",
    "PRESENTO DOCUMENTACION",
    "Presentó documentación",
    "Presento documentacion",
    "Presento documentación",
    "Presentó documentación (SI)",
    "Presento documentacion (SI)",
    "Presento documentación (SI)",
    "DOCUMENTACIÓN PRESENTADA",
    "DOCUMENTACION PRESENTADA",
    "Documentación presentada",
    "Documentacion presentada",
    "Documentación",
    "Documentacion",
    "Declaro bajo conformidad que he cargado la totalidad de la documentación requerida, asumiendo la responsabilidad por la veracidad y completitud de la información presentada.",
    "Declaro bajo conformidad que he cargado la totalidad de la documentacion requerida, asumiendo la responsabilidad por la veracidad y completitud de la informacion presentada.",
    "Declaro bajo conformidad que ha cargado la totalidad de la documentación requerida, asumiendo la responsabilidad por la veracidad y completitud de la información presentada.",
    "Declaro bajo conformidad que ha cargado la totalidad de la documentacion requerida, asumiendo la responsabilidad por la veracidad y completitud de la informacion presentada.",
    "Declaro bajo conformidad",
    "He cargado la totalidad de la documentación requerida",
    "He cargado la totalidad de la documentacion requerida",
    "Ha cargado la totalidad de la documentación requerida",
    "Ha cargado la totalidad de la documentacion requerida",
    "Documentación requerida",
    "Documentacion requerida",
    "Veracidad y completitud",
  ];

  const clavesDepartamento = [
    "DEPARTAMENTO",
    "Departamento",
    "Depto",
    "Dpto",
    "Delegación",
    "Delegacion",
  ];

  const esCampoApellidoDetalle = (label = "") => {
    const normalizado = normalizarTexto(label);
    return normalizado === "apellido" || normalizado === "apellidos";
  };

  const esCampoNombreDetalle = (label = "") => {
    const normalizado = normalizarTexto(label);
    return normalizado === "nombre" || normalizado === "nombres";
  };

  const esCampoDniDetalle = (label = "") => {
    const normalizado = normalizarTexto(label);

    return (
      normalizado === "dni" ||
      normalizado === "documento" ||
      normalizado === "nro dni" ||
      normalizado === "n° dni" ||
      normalizado === "nº dni" ||
      normalizado === "numero de dni" ||
      normalizado === "número de dni"
    );
  };

  const esCampoDepartamentoDetalle = (label = "") => {
    const normalizado = normalizarTexto(label);

    return (
      normalizado === "departamento" ||
      normalizado === "depto" ||
      normalizado === "dpto" ||
      normalizado === "delegacion" ||
      normalizado === "delegación"
    );
  };

  const esCampoDocumentacionPresentadaDetalle = (label = "") => {
    const normalizado = normalizarTexto(label);

    return (
      normalizado === "documentacion presentada" ||
      normalizado === "documentación presentada" ||
      normalizado === "presento documentacion" ||
      normalizado === "presentó documentación" ||
      normalizado === "presento documentación" ||
      normalizado === "presentó documentación (si)" ||
      normalizado === "presento documentacion (si)" ||
      normalizado === "documentacion" ||
      normalizado === "documentación" ||
      normalizado.includes("declaro bajo conformidad") ||
      normalizado.includes("he cargado la totalidad de la documentacion") ||
      normalizado.includes("he cargado la totalidad de la documentación") ||
      normalizado.includes("ha cargado la totalidad de la documentacion") ||
      normalizado.includes("ha cargado la totalidad de la documentación") ||
      normalizado.includes("documentacion requerida") ||
      normalizado.includes("documentación requerida") ||
      normalizado.includes("veracidad y completitud")
    );
  };

  useEffect(() => {
    const cargarFormulario = async () => {
      setLoading(true);
      setErrorCarga("");

      try {
        if (!id) {
          setErrorCarga("No se encontró el identificador del formulario.");
          return;
        }

        const refFormulario = doc(db, "oficina_gestion_formularios", id);
        const snap = await getDoc(refFormulario);

        if (!snap.exists()) {
          setErrorCarga("El formulario solicitado no existe.");
          return;
        }

        const snapData = snap.data();

        const data = {
          id: snap.id,
          codigoFormulario: snapData?.codigoFormulario || snap.id,
          formularioCodigo: snapData?.formularioCodigo || snap.id,
          formularioNumero: snapData?.formularioNumero || snap.id,
          permitirMultiplesRespuestasPorDni: Boolean(
            snapData?.permitirMultiplesRespuestasPorDni
          ),
          soloConsultaDni: Boolean(
            snapData?.soloConsultaDni ||
              snapData?.modoSoloConsultaDni ||
              snapData?.bloquearCargaRespuestas
          ),
          archivoDescargaFormulario:
            snapData?.archivoDescargaFormulario || null,
          ...snapData,
        };

        if (!data.publicado) {
          setErrorCarga("Este formulario todavía no se encuentra publicado.");
          return;
        }

        if (!data.activo) {
          setErrorCarga("Este formulario no se encuentra activo.");
          return;
        }

        setFormulario(data);

        const requiereDni = Boolean(
          data?.requiereValidacionDni ||
            data?.campos?.some((campo) => campo.tipo === "validacion_dni")
        );

        const estaEnSoloConsulta = Boolean(
          data?.soloConsultaDni ||
            data?.modoSoloConsultaDni ||
            data?.bloquearCargaRespuestas
        );

        const yaEnviadoLocal =
          localStorageKey && localStorage.getItem(localStorageKey) === "true";

        if (
          yaEnviadoLocal &&
          !requiereDni &&
          !estaEnSoloConsulta &&
          !Boolean(data?.permitirMultiplesRespuestasPorDni)
        ) {
          setEstadoEnvio("local_existente");

          const respuestaIdGuardada =
            localStorageRespuestaKey &&
            localStorage.getItem(localStorageRespuestaKey);

          if (respuestaIdGuardada) {
            const refRespuesta = doc(
              db,
              "oficina_gestion_respuestas",
              respuestaIdGuardada
            );

            const snapRespuesta = await getDoc(refRespuesta);

            if (snapRespuesta.exists()) {
              const dataRespuesta = snapRespuesta.data();

              if (dataRespuesta?.formularioId === id) {
                setRespuestaRegistrada({
                  id: snapRespuesta.id,
                  ...dataRespuesta,
                });
              }
            }
          }
        }
      } catch (error) {
        console.error("Error al cargar formulario:", error);
        setErrorCarga("No se pudo cargar el formulario.");
      } finally {
        setLoading(false);
      }
    };

    cargarFormulario();
  }, [id, localStorageKey, localStorageRespuestaKey]);

  const volverOficinaGestion = () => {
    history.push("/oficina-gestion");
  };

  const actualizarRespuesta = (campo, valor) => {
    setRespuestas((prev) => ({
      ...prev,
      [campo.id]: valor,
    }));
  };

  const obtenerRespuesta = (campo) => {
    return respuestas[campo.id] ?? "";
  };

  const autocompletarDatosAfiliado = (afiliado) => {
    if (!afiliado) return;

    setRespuestas((prev) => {
      const nuevas = { ...prev };

      camposVisibles.forEach((campo) => {
        if (esCampoDniPorLabel(campo.label)) {
          nuevas[campo.id] = afiliado.dni;
        }

        if (esCampoNombrePorLabel(campo.label)) {
          nuevas[campo.id] = afiliado.nombre;
        }

        if (esCampoApellidoPorLabel(campo.label)) {
          nuevas[campo.id] = afiliado.apellido;
        }

        if (esCampoApellidoNombrePorLabel(campo.label)) {
          nuevas[campo.id] = `${afiliado.apellido} ${afiliado.nombre}`.trim();
        }
      });

      return nuevas;
    });
  };

  const actualizarArchivos = (campo, fileList) => {
    const files = Array.from(fileList || []);

    if (!files.length) return;

    const accept = campo.archivoAccept || ARCHIVOS_DEFAULT;

    const invalidos = files.filter(
      (file) => !acceptPermiteArchivo(accept, file)
    );

    if (invalidos.length > 0) {
      toast.current?.show({
        severity: "warn",
        summary: "Archivo no permitido",
        detail: `Verifique el tipo de archivo permitido para "${campo.label}".`,
        life: 4000,
      });

      return;
    }

    setArchivos((prev) => {
      const actuales = prev[campo.id] || [];

      return {
        ...prev,
        [campo.id]: campo.multiple
          ? [...actuales, ...files]
          : files.slice(0, 1),
      };
    });
  };

  const eliminarArchivo = (campoId, index) => {
    setArchivos((prev) => {
      const actuales = prev[campoId] || [];

      return {
        ...prev,
        [campoId]: actuales.filter((_, i) => i !== index),
      };
    });
  };

  const eliminarArchivoExistente = (campoId, index) => {
    setArchivosExistentesPorCampo((prev) => {
      const actuales = prev[campoId] || [];

      return {
        ...prev,
        [campoId]: actuales.filter((_, i) => i !== index),
      };
    });
  };

  const obtenerValorLegible = (campo, valor) => {
    if (valor === null || valor === undefined || valor === "") {
      return "";
    }

    if (campo.tipo === "departamento") {
      const valores = Array.isArray(valor) ? valor : [valor];

      const labels = valores.map((value) => {
        const encontrado = departamentosOptions.find(
          (item) => item.value === value
        );

        return encontrado?.label || value;
      });

      return campo.departamentoMultiple ? labels : labels[0] || "";
    }

    if (Array.isArray(valor)) {
      return valor.join(", ");
    }

    if (typeof valor === "boolean") {
      return valor ? "Sí" : "No";
    }

    return String(valor);
  };

  const validarFormulario = () => {
    if (soloConsultaDni) {
      toast.current?.show({
        severity: "warn",
        summary: "Carga no habilitada",
        detail:
          "Este formulario está habilitado solo para consultar información cargada.",
        life: 4500,
      });

      return false;
    }

    if (requiereValidacionDni && !afiliadoValidado) {
      toast.current?.show({
        severity: "warn",
        summary: "Validación requerida",
        detail: "Primero debe validar el DNI para completar este formulario.",
        life: 3500,
      });

      return false;
    }

    for (const campo of camposVisibles) {
      if (!campo.obligatorio) continue;

      if (campo.tipo === "archivo" || campo.tipo === "archivo_pdf") {
        const files = archivos[campo.id] || [];

        const archivosExistentes =
          modoEdicionAfiliado && archivosExistentesPorCampo?.[campo.id]
            ? archivosExistentesPorCampo[campo.id]
            : [];

        if (!files.length && !archivosExistentes.length) {
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

      if (
        valor === undefined ||
        valor === null ||
        valor === "" ||
        (Array.isArray(valor) && valor.length === 0)
      ) {
        toast.current?.show({
          severity: "warn",
          summary: "Campo obligatorio",
          detail: `Debe completar: ${campo.label}`,
          life: 3500,
        });

        return false;
      }
    }

    return true;
  };

  const subirArchivos = async (respuestaId) => {
    const archivosSubidosPorCampo = {};

    for (const campo of camposVisibles) {
      if (campo.tipo !== "archivo" && campo.tipo !== "archivo_pdf") continue;

      const files = archivos[campo.id] || [];

      if (!files.length) continue;

      const subidos = [];

      for (const file of files) {
        const safeName = limpiarNombreArchivo(file.name);

        const path = `oficina_gestion/formularios/${formulario.id}/respuestas/${respuestaId}/${campo.id}/${Date.now()}_${safeName}`;

        const storageRef = ref(storage, path);

        await uploadBytes(storageRef, file);

        const url = await getDownloadURL(storageRef);

        subidos.push({
          nombre: file.name,
          tipo: file.type || "",
          size: file.size,
          path,
          url,
        });
      }

      archivosSubidosPorCampo[campo.id] = subidos;
    }

    return archivosSubidosPorCampo;
  };

  const obtenerRespuestasDelFormularioActual = async () => {
    if (!formulario?.id) return [];

    const consultas = [
      ["formularioId", formulario.id],
      ["formularioCodigo", formulario.id],
      ["formularioNumero", formulario.id],
    ];

    const docsMap = new Map();

    for (const [campo, valor] of consultas) {
      const q = query(
        collection(db, "oficina_gestion_respuestas"),
        where(campo, "==", valor)
      );

      const snap = await getDocs(q);

      snap.docs.forEach((docSnap) => {
        docsMap.set(docSnap.id, {
          id: docSnap.id,
          ...docSnap.data(),
        });
      });
    }

    return Array.from(docsMap.values());
  };

  const verificarRespuestaExistentePorDni = async (
    dni,
    excluirRespuestaId = null
  ) => {
    const dniNormalizado = normalizarDni(dni);

    if (!dniNormalizado || !formulario?.id) return null;

    try {
      const respuestasFormulario = await obtenerRespuestasDelFormularioActual();

      const respuestaEncontrada = respuestasFormulario.find((respuesta) => {
        if (excluirRespuestaId && respuesta.id === excluirRespuestaId) {
          return false;
        }

        const dniRegistrado = obtenerDniDesdeRespuestaRegistrada(respuesta);
        return dniRegistrado === dniNormalizado;
      });

      return respuestaEncontrada || null;
    } catch (error) {
      console.error("Error al verificar DNI existente:", error);
      return null;
    }
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

      if (afiliado?.dni) {
        return afiliado;
      }
    }

    return null;
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
          setEstadoEnvio("solo_consulta");

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
        detail: `Datos encontrados: ${afiliadoNormalizado.apellido} ${afiliadoNormalizado.nombre}`,
        life: 4000,
      });
    } catch (error) {
      console.error("Error al validar DNI:", error);

      toast.current?.show({
        severity: "error",
        summary: "Error",
        detail: "No se pudo validar el DNI. Intente nuevamente.",
        life: 4500,
      });
    } finally {
      setValidandoDni(false);
    }
  };

  const cargarRespuestaParaEdicionAfiliado = () => {
    if (!respuestaRegistrada || soloConsultaDni) return;

    const datos = respuestaRegistrada.respuestas || {};
    const nuevasRespuestas = {};

    camposVisibles.forEach((campo) => {
      if (campo.tipo === "archivo" || campo.tipo === "archivo_pdf") return;

      const valorPorLabel = obtenerValorPorClaves(datos, [campo.label]);

      if (valorPorLabel !== "") {
        nuevasRespuestas[campo.id] = valorPorLabel;
        return;
      }

      const campoPorId = respuestaRegistrada.respuestasPorCampo?.[campo.id];

      if (campoPorId?.valor !== undefined) {
        nuevasRespuestas[campo.id] = campoPorId.valor;
        return;
      }

      if (campoPorId?.valorLegible !== undefined) {
        nuevasRespuestas[campo.id] = campoPorId.valorLegible;
      }
    });

    const nombreOriginal =
      respuestaRegistrada.nombre ||
      obtenerValorPorClaves(datos, ["Nombre", "Nombres"]);

    const apellidoOriginal =
      respuestaRegistrada.apellido ||
      obtenerValorPorClaves(datos, ["Apellido", "Apellidos"]);

    const personaNormalizada = separarApellidoNombrePersona(
      apellidoOriginal,
      nombreOriginal
    );

    const dni = normalizarDni(
      respuestaRegistrada.dni ||
        obtenerValorPorClaves(datos, [
          "DNI",
          "Documento",
          "Nro DNI",
          "N° DNI",
          "Nº DNI",
          "Número de DNI",
          "Numero de DNI",
        ])
    );

    const afiliado = {
      id: respuestaRegistrada.afiliadoId || "",
      origen: respuestaRegistrada.afiliadoOrigen || "",
      nombre: personaNormalizada.nombre,
      apellido: personaNormalizada.apellido,
      dni,
      raw: {},
    };

    setRespuestas(nuevasRespuestas);
    setAfiliadoValidado(afiliado);
    setDniValidacion(dni);
    setModoEdicionAfiliado(true);
    setFueActualizacionAfiliado(false);
    setEstadoEnvio(null);
    setMensajeValidacionDni("");
    setArchivos({});
    setArchivosExistentesPorCampo(respuestaRegistrada.archivos || {});

    toast.current?.show({
      severity: "success",
      summary: "Edición habilitada",
      detail: "Ya podés modificar la información del formulario.",
      life: 3500,
    });
  };

  const reiniciarValidacionDni = () => {
    setDniValidacion("");
    setAfiliadoValidado(null);
    setMensajeValidacionDni("");
    setRespuestas({});
    setArchivos({});
    setArchivosExistentesPorCampo({});
    setModoEdicionAfiliado(false);
    setFueActualizacionAfiliado(false);
  };

  const reiniciarFormularioParaNuevaCarga = () => {
    if (soloConsultaDni) return;

    setEstadoEnvio(null);
    setRespuestaRegistrada(null);
    setVerDetalleRespuesta(false);
    setRespuestas({});
    setArchivos({});
    setArchivosExistentesPorCampo({});
    setModoEdicionAfiliado(false);
    setFueActualizacionAfiliado(false);
    setMensajeValidacionDni("");

    if (requiereValidacionDni) {
      setDniValidacion("");
      setAfiliadoValidado(null);
    }

    toast.current?.show({
      severity: "info",
      summary: "Nueva carga",
      detail: "Ya podés completar nuevamente el formulario.",
      life: 3000,
    });
  };

  const verificarDniIngresado = async (dni) => {
    if (
      requiereValidacionDni ||
      modoEdicionAfiliado ||
      permiteMultiplesRespuestasPorDni ||
      soloConsultaDni
    ) {
      return;
    }

    const dniNormalizado = normalizarDni(dni);

    if (!dniNormalizado || dniNormalizado.length < 6 || !formulario?.id) {
      return;
    }

    setVerificandoDni(true);

    try {
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
      }
    } finally {
      setVerificandoDni(false);
    }
  };

  const enviarFormulario = async () => {
    if (!formulario || enviando || (enviado && !modoEdicionAfiliado)) return;

    if (soloConsultaDni) {
      toast.current?.show({
        severity: "warn",
        summary: "Carga no habilitada",
        detail:
          "Este formulario está disponible solo para consultar información cargada.",
        life: 4500,
      });

      return;
    }

    const yaEnviadoLocal =
      localStorageKey && localStorage.getItem(localStorageKey) === "true";

    if (
      yaEnviadoLocal &&
      !requiereValidacionDni &&
      !modoEdicionAfiliado &&
      !permiteMultiplesRespuestasPorDni
    ) {
      setEstadoEnvio("local_existente");

      toast.current?.show({
        severity: "warn",
        summary: "Formulario ya cargado",
        detail: "Este formulario ya fue enviado desde este dispositivo.",
        life: 4000,
      });

      return;
    }

    if (!validarFormulario()) return;

    setEnviando(true);

    try {
      const respuestasLegiblesPrevias = {};

      camposVisibles.forEach((campo) => {
        if (campo.tipo === "archivo" || campo.tipo === "archivo_pdf") return;

        const valor = respuestas[campo.id];

        respuestasLegiblesPrevias[campo.label] = obtenerValorLegible(
          campo,
          valor
        );
      });

      const dniPrevio =
        afiliadoValidado?.dni ||
        obtenerValorPorClaves(respuestasLegiblesPrevias, [
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
        ]);

      const dniNormalizado = normalizarDni(dniPrevio);

      if (dniNormalizado && !permiteMultiplesRespuestasPorDni) {
        const respuestaExistente = await verificarRespuestaExistentePorDni(
          dniNormalizado,
          modoEdicionAfiliado ? respuestaRegistrada?.id : null
        );

        if (respuestaExistente) {
          setRespuestaRegistrada(respuestaExistente);
          setEstadoEnvio("dni_existente");
          setModoEdicionAfiliado(false);
          setFueActualizacionAfiliado(false);

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

      const respuestaId =
        modoEdicionAfiliado && respuestaRegistrada?.id
          ? respuestaRegistrada.id
          : doc(collection(db, "oficina_gestion_respuestas")).id;

      const respuestaRef = doc(db, "oficina_gestion_respuestas", respuestaId);

      const archivosSubidosPorCampo = await subirArchivos(respuestaId);

      const archivosExistentes =
        modoEdicionAfiliado && archivosExistentesPorCampo
          ? archivosExistentesPorCampo
          : {};

      const archivosFinales = { ...archivosExistentes };

      camposVisibles.forEach((campo) => {
        if (campo.tipo !== "archivo" && campo.tipo !== "archivo_pdf") return;

        const archivosPrevios = archivosExistentes[campo.id] || [];
        const archivosNuevos = archivosSubidosPorCampo[campo.id] || [];

        if (campo.multiple) {
          archivosFinales[campo.id] = [...archivosPrevios, ...archivosNuevos];
        } else {
          archivosFinales[campo.id] = archivosNuevos.length
            ? archivosNuevos
            : archivosPrevios;
        }
      });

      const respuestasPorCampo = {};
      const respuestasLegibles = {};

      camposVisibles.forEach((campo) => {
        if (campo.tipo === "archivo" || campo.tipo === "archivo_pdf") {
          const archivosCampo = archivosFinales[campo.id] || [];

          respuestasPorCampo[campo.id] = {
            label: campo.label,
            tipo: campo.tipo,
            valor: archivosCampo,
          };

          respuestasLegibles[campo.label] = campo.multiple
            ? archivosCampo
            : archivosCampo[0] || null;

          return;
        }

        const valor = respuestas[campo.id];

        respuestasPorCampo[campo.id] = {
          label: campo.label,
          tipo: campo.tipo,
          valor,
          valorLegible: obtenerValorLegible(campo, valor),
        };

        respuestasLegibles[campo.label] = obtenerValorLegible(campo, valor);
      });

      const apellidoOriginal =
        afiliadoValidado?.apellido ||
        obtenerValorPorClaves(respuestasLegibles, ["Apellido", "Apellidos"]);

      const nombreOriginal =
        afiliadoValidado?.nombre ||
        obtenerValorPorClaves(respuestasLegibles, ["Nombre", "Nombres"]);

      const personaNormalizadaRespuesta = separarApellidoNombrePersona(
        apellidoOriginal,
        nombreOriginal
      );

      const apellido = personaNormalizadaRespuesta.apellido;
      const nombre = personaNormalizadaRespuesta.nombre;

      const dni = normalizarDni(
        afiliadoValidado?.dni ||
          obtenerValorPorClaves(respuestasLegibles, [
            "DNI",
            "Documento",
            "Nro DNI",
            "N° DNI",
            "Nº DNI",
            "Número de DNI",
            "Numero de DNI",
          ])
      );

      if (afiliadoValidado) {
        respuestasLegibles.Apellido = apellido;
        respuestasLegibles.Nombre = nombre;
        respuestasLegibles.DNI = dni;
      }

      const departamento = obtenerValorPorClaves(
        respuestasLegibles,
        clavesDepartamento
      );

      const presentoDocumentacion = normalizarSiNo(
        obtenerValorPorClaves(respuestasLegibles, clavesDocumentacionPresentada)
      );

      const payloadRespuesta = {
        formularioId: formulario.id,
        formularioCodigo: formulario.codigoFormulario || formulario.id,
        formularioNumero: formulario.formularioNumero || formulario.id,
        formularioTitulo: formulario.titulo || "",

        origen: respuestaRegistrada?.origen || "formulario_publico",

        validadoPorDni: Boolean(afiliadoValidado),
        afiliadoOrigen: afiliadoValidado?.origen || "",

        permiteMultiplesRespuestasPorDni: Boolean(
          permiteMultiplesRespuestasPorDni
        ),

        apellido,
        nombre,
        dni,
        departamento,
        presentoDocumentacion,

        respuestas: respuestasLegibles,
        respuestasPorCampo,
        archivos: archivosFinales,

        updatedAt: serverTimestamp(),
      };

      if (modoEdicionAfiliado && respuestaRegistrada?.id) {
        await updateDoc(respuestaRef, {
          ...payloadRespuesta,
          edicionAfiliadoHabilitada: false,
          edicionAfiliadoHabilitadaAt: null,
          edicionAfiliadoDeshabilitadaAt: serverTimestamp(),
          editadoPorAfiliado: true,
          editadoPorAfiliadoAt: serverTimestamp(),
        });

        setRespuestaRegistrada({
          ...respuestaRegistrada,
          ...payloadRespuesta,
          id: respuestaId,
          edicionAfiliadoHabilitada: false,
          editadoPorAfiliado: true,
          updatedAt: new Date(),
          editadoPorAfiliadoAt: new Date(),
        });

        setModoEdicionAfiliado(false);
        setFueActualizacionAfiliado(true);
        setEstadoEnvio("ok");

        toast.current?.show({
          severity: "success",
          summary: "Formulario actualizado",
          detail: "La información fue actualizada correctamente.",
          life: 4000,
        });

        return;
      }

      await setDoc(respuestaRef, {
        ...payloadRespuesta,
        createdAt: serverTimestamp(),
      });

      setRespuestaRegistrada({
        id: respuestaId,
        ...payloadRespuesta,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      if (!permiteMultiplesRespuestasPorDni) {
        if (localStorageKey) {
          localStorage.setItem(localStorageKey, "true");
        }

        if (localStorageRespuestaKey) {
          localStorage.setItem(localStorageRespuestaKey, respuestaId);
        }
      }

      setFueActualizacionAfiliado(false);
      setEstadoEnvio("ok");

      toast.current?.show({
        severity: "success",
        summary: "Formulario enviado",
        detail: "La respuesta fue registrada correctamente.",
        life: 4000,
      });
    } catch (error) {
      console.error("Error al enviar formulario:", error);

      toast.current?.show({
        severity: "error",
        summary: "Error",
        detail:
          "No se pudo guardar el formulario. Verifique su conexión e intente nuevamente.",
        life: 5000,
      });
    } finally {
      setEnviando(false);
    }
  };

  const renderValorDetalle = (value) => {
    if (value === null || value === undefined || value === "") {
      return <span className={styles.detalleEmpty}>—</span>;
    }

    if (esArchivoAdjunto(value)) {
      return (
        <div className={styles.detalleArchivosBox}>
          <div className={styles.detalleArchivoRow}>
            <i className="pi pi-paperclip" />

            <a href={value.url} target="_blank" rel="noreferrer">
              {value.nombre || "Ver archivo adjunto"}
            </a>
          </div>
        </div>
      );
    }

    if (esListaDeArchivos(value)) {
      return (
        <div className={styles.detalleArchivosBox}>
          {value.map((archivo, index) => (
            <div
              key={`${archivo.nombre || "archivo"}-${index}`}
              className={styles.detalleArchivoRow}
            >
              <i className="pi pi-paperclip" />

              <a href={archivo.url} target="_blank" rel="noreferrer">
                {archivo.nombre || `Archivo ${index + 1}`}
              </a>
            </div>
          ))}
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

    const obtenerValorDocumentacionPresentada = () => {
      const valorDirecto = normalizarSiNo(
        respuestaRegistrada.presentoDocumentacion
      );

      if (valorDirecto) return valorDirecto;

      const valorDesdeRespuestas = normalizarSiNo(
        obtenerValorPorClaves(respuestasGuardadas, clavesDocumentacionPresentada)
      );

      if (valorDesdeRespuestas) return valorDesdeRespuestas;

      const campoPorLabel = Object.values(respuestasPorCampo).find((campo) =>
        esCampoDocumentacionPresentadaDetalle(campo?.label)
      );

      if (campoPorLabel) {
        const valor = normalizarSiNo(
          campoPorLabel.valorLegible ??
            campoPorLabel.valor ??
            campoPorLabel.value ??
            ""
        );

        if (valor) return valor;
      }

      return "";
    };

    const obtenerValorDepartamento = () => {
      return (
        respuestaRegistrada.departamento ||
        obtenerValorPorClaves(respuestasGuardadas, clavesDepartamento)
      );
    };

    let detalle = [];

    if (camposVisibles.length > 0) {
      detalle = camposVisibles
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
            const valor = dato.valorLegible ?? dato.valor ?? "";

            if (esCampoTipoSiNo(campo) && !esValorSiNo(valor)) {
              return null;
            }

            return {
              id: campo.id,
              label: dato.label || campo.label,
              value: esCampoTipoSiNo(campo) ? normalizarSiNo(valor) : valor,
              tipo: campo.tipo,
            };
          }

          let clavesBusqueda = [campo.label];

          if (esCampoDocumentacionPresentadaDetalle(campo.label)) {
            clavesBusqueda = [campo.label, ...clavesDocumentacionPresentada];
          }

          if (esCampoDepartamentoDetalle(campo.label)) {
            clavesBusqueda = [campo.label, ...clavesDepartamento];
          }

          const valorPorLabel = obtenerValorPorClaves(
            respuestasGuardadas,
            clavesBusqueda
          );

          if (esCampoTipoSiNo(campo) && !esValorSiNo(valorPorLabel)) {
            return null;
          }

          return {
            id: campo.id,
            label: campo.label,
            value: esCampoTipoSiNo(campo)
              ? normalizarSiNo(valorPorLabel)
              : valorPorLabel || "—",
            tipo: campo.tipo,
          };
        })
        .filter(Boolean);
    } else {
      detalle = Object.entries(respuestasGuardadas)
        .map(([key, value]) => {
          if (esCampoDocumentacionPresentadaDetalle(key)) {
            const valorNormalizado = normalizarSiNo(value);

            if (!valorNormalizado) return null;

            return {
              id: key,
              label: key,
              value: valorNormalizado,
              tipo: "booleano",
            };
          }

          return {
            id: key,
            label: key,
            value,
          };
        })
        .filter(Boolean);
    }

    const apellidoDetalleOriginal =
      respuestaRegistrada.apellido ||
      obtenerValorPorClaves(respuestasGuardadas, ["Apellido", "Apellidos"]);

    const nombreDetalleOriginal =
      respuestaRegistrada.nombre ||
      obtenerValorPorClaves(respuestasGuardadas, ["Nombre", "Nombres"]);

    const personaDetalleNormalizada = separarApellidoNombrePersona(
      apellidoDetalleOriginal,
      nombreDetalleOriginal
    );

    actualizarOCrearCampoDetalle(
      detalle,
      "Apellido",
      personaDetalleNormalizada.apellido || "—"
    );

    actualizarOCrearCampoDetalle(
      detalle,
      "Nombre",
      personaDetalleNormalizada.nombre || "—"
    );

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
      obtenerValorDepartamento() || "—"
    );

    const existeCampoDocumentacionVisible = detalle.some((item) => {
      return (
        esCampoDocumentacionPresentadaDetalle(item.label) &&
        esValorSiNo(item.value)
      );
    });

    const valorDocumentacion = obtenerValorDocumentacionPresentada();

    if (!existeCampoDocumentacionVisible && valorDocumentacion) {
      actualizarOCrearCampoDetalle(
        detalle,
        "DOCUMENTACIÓN PRESENTADA",
        valorDocumentacion
      );
    }

    return detalle;
  };

  const valorTieneArchivosDetalle = (value) => {
    if (esArchivoAdjunto(value) || esListaDeArchivos(value)) return true;

    if (Array.isArray(value)) {
      return value.some((item) => esArchivoAdjunto(item));
    }

    return false;
  };

  const esCampoAdjuntoDetalle = (item) => {
    const labelNormalizado = normalizarTexto(item?.label);

    if (esCampoDocumentacionPresentadaDetalle(item?.label)) return false;

    return (
      labelNormalizado.includes("adjuntar") ||
      labelNormalizado.includes("archivo adjunto") ||
      valorTieneArchivosDetalle(item?.value)
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

    const apellido = tomarCampo((item) => esCampoApellidoDetalle(item.label));
    const nombre = tomarCampo((item) => esCampoNombreDetalle(item.label));
    const dni = tomarCampo((item) => esCampoDniDetalle(item.label));
    const departamento = tomarCampo((item) =>
      esCampoDepartamentoDetalle(item.label)
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
        esCampoApellidoDetalle(item.label) ||
        esCampoNombreDetalle(item.label) ||
        esCampoDniDetalle(item.label) ||
        esCampoDepartamentoDetalle(item.label) ||
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

    const esDocPresentada = esCampoDocumentacionPresentadaDetalle(item.label);
    const valorSiNo = normalizarSiNo(item.value);

    if (esDocPresentada && !valorSiNo) {
      return null;
    }

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
            renderCampoDetalleOrdenado(item, {
              full,
            })
          )}
        </div>
      </section>
    );
  };

  const renderDialogDetalleRespuesta = () => {
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
      <Dialog
        header="Información cargada"
        visible={verDetalleRespuesta}
        style={{ width: "960px", maxWidth: "95vw" }}
        modal
        onHide={() => setVerDetalleRespuesta(false)}
      >
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
                  {hayActualizacion
                    ? fechaActualizacion
                    : "Sin actualizaciones"}
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
      </Dialog>
    );
  };

  const renderDescripcionFormulario = () => {
    const html =
      formulario?.descripcionHtml ||
      textoPlanoAHtml(formulario?.descripcion || "");

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
            onChange={(e) => actualizarRespuesta(campo, e.target.value)}
            rows={4}
            autoResize
            placeholder={campo.placeholder || ""}
            disabled={enviando || verificandoDni}
          />
        );

      case "numero": {
        const esDni = esCampoDniPorLabel(campo.label);
        const esAutocompletado = afiliadoValidado && esDni;

        return (
          <InputText
            type="number"
            value={valor}
            onChange={(e) => actualizarRespuesta(campo, e.target.value)}
            onBlur={(e) => {
              if (esDni) {
                verificarDniIngresado(e.target.value);
              }
            }}
            placeholder={campo.placeholder || ""}
            disabled={enviando || verificandoDni || esAutocompletado}
          />
        );
      }

      case "fecha":
        return (
          <InputText
            type="date"
            value={valor}
            onChange={(e) => actualizarRespuesta(campo, e.target.value)}
            placeholder={campo.placeholder || ""}
            disabled={enviando || verificandoDni}
          />
        );

      case "email":
        return (
          <InputText
            type="email"
            value={valor}
            onChange={(e) => actualizarRespuesta(campo, e.target.value)}
            placeholder={campo.placeholder || ""}
            disabled={enviando || verificandoDni}
          />
        );

      case "booleano":
        return (
          <Dropdown
            value={valor}
            options={OPCIONES_SI_NO}
            onChange={(e) => actualizarRespuesta(campo, e.value)}
            placeholder={campo.placeholder || "Seleccione una opción"}
            disabled={enviando || verificandoDni}
          />
        );

      case "departamento": {
        const opcionesPermitidas = departamentosOptions.filter((opcion) =>
          (campo.departamentosPermitidos || departamentosValues).includes(
            opcion.value
          )
        );

        if (campo.departamentoMultiple) {
          return (
            <MultiSelect
              value={Array.isArray(valor) ? valor : []}
              options={opcionesPermitidas}
              onChange={(e) => actualizarRespuesta(campo, e.value)}
              optionLabel="label"
              optionValue="value"
              placeholder={campo.placeholder || "Seleccione departamentos"}
              display="chip"
              filter
              disabled={enviando || verificandoDni}
            />
          );
        }

        return (
          <Dropdown
            value={valor || null}
            options={opcionesPermitidas}
            onChange={(e) => actualizarRespuesta(campo, e.value)}
            optionLabel="label"
            optionValue="value"
            placeholder={campo.placeholder || "Seleccione departamento"}
            filter
            showClear
            disabled={enviando || verificandoDni}
          />
        );
      }

      case "archivo":
      case "archivo_pdf": {
        const files = archivos[campo.id] || [];
        const accept = campo.archivoAccept || ARCHIVOS_DEFAULT;

        const archivosExistentes =
          modoEdicionAfiliado && archivosExistentesPorCampo?.[campo.id]
            ? archivosExistentesPorCampo[campo.id]
            : [];

        return (
          <div className={styles.fileField}>
            {archivosExistentes.length > 0 && (
              <div className={styles.fileList}>
                <strong>Archivo/s cargado/s actualmente</strong>

                {archivosExistentes.map((archivo, index) => (
                  <div
                    key={`${archivo.nombre || "archivo"}-${index}`}
                    className={styles.fileItem}
                  >
                    <span>
                      <a href={archivo.url} target="_blank" rel="noreferrer">
                        {archivo.nombre || `Archivo ${index + 1}`}
                      </a>
                    </span>

                    <button
                      type="button"
                      onClick={() => eliminarArchivoExistente(campo.id, index)}
                      disabled={enviando || verificandoDni}
                    >
                      Quitar
                    </button>
                  </div>
                ))}

                <small className={styles.help}>
                  Podés quitar archivos cargados o seleccionar nuevos archivos.
                </small>
              </div>
            )}

            <div className={styles.fileActions}>
              <label className={styles.fileButton}>
                <i className="pi pi-upload" />
                <span>Seleccionar archivo</span>

                <input
                  type="file"
                  accept={accept}
                  multiple={Boolean(campo.multiple)}
                  disabled={enviando || verificandoDni}
                  onChange={(e) => {
                    actualizarArchivos(campo, e.target.files);
                    e.target.value = "";
                  }}
                />
              </label>

              {campo.permiteCamara && (
                <label className={styles.fileButtonAlt}>
                  <i className="pi pi-camera" />
                  <span>Tomar foto</span>

                  <input
                    type="file"
                    accept="image/*"
                    capture="environment"
                    multiple={Boolean(campo.multiple)}
                    disabled={enviando || verificandoDni}
                    onChange={(e) => {
                      actualizarArchivos(campo, e.target.files);
                      e.target.value = "";
                    }}
                  />
                </label>
              )}
            </div>

            <small className={styles.help}>Archivos permitidos: {accept}</small>

            {files.length > 0 && (
              <div className={styles.fileList}>
                {files.map((file, index) => (
                  <div
                    key={`${file.name}-${index}`}
                    className={styles.fileItem}
                  >
                    <span>
                      {file.name}{" "}
                      <small>({Math.round((file.size || 0) / 1024)} KB)</small>
                    </span>

                    <button
                      type="button"
                      onClick={() => eliminarArchivo(campo.id, index)}
                      disabled={enviando || verificandoDni}
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
      default: {
        const esDni = esCampoDniPorLabel(campo.label);
        const esNombre = esCampoNombrePorLabel(campo.label);
        const esApellido = esCampoApellidoPorLabel(campo.label);
        const esApellidoNombre = esCampoApellidoNombrePorLabel(campo.label);

        const esAutocompletado =
          afiliadoValidado &&
          (esDni || esNombre || esApellido || esApellidoNombre);

        return (
          <InputText
            value={valor}
            onChange={(e) => actualizarRespuesta(campo, e.target.value)}
            onBlur={(e) => {
              if (esDni) {
                verificarDniIngresado(e.target.value);
              }
            }}
            placeholder={campo.placeholder || ""}
            disabled={enviando || verificandoDni || esAutocompletado}
          />
        );
      }
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

            <small>
              Código del formulario: <strong>{formulario?.id}</strong>
            </small>
          </header>

          <Message
            severity={soloConsultaDni ? "warn" : "info"}
            text={
              soloConsultaDni
                ? "Este formulario está habilitado solo para consultar información cargada. Ingrese su DNI para verificar si existen datos registrados."
                : permiteMultiplesRespuestasPorDni
                ? "Para iniciar la carga, primero debe validar su DNI. Este formulario permite realizar más de una carga con el mismo DNI."
                : "Para iniciar la carga, primero debe validar su DNI. El sistema verificará si figura en usuarios o nuevoAfiliado y también controlará si ya existe una respuesta para este formulario."
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
              label={
                soloConsultaDni ? "Consultar información" : "Validar DNI"
              }
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

  if (enviado) {
    const esSoloConsulta = estadoEnvio === "solo_consulta";
    const esDuplicadoDni = estadoEnvio === "dni_existente";
    const esDuplicadoLocal = estadoEnvio === "local_existente";
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
            {esSoloConsulta
              ? "Información cargada encontrada"
              : esDuplicadoDni
              ? "Ya existe un registro con ese DNI"
              : esDuplicadoLocal
              ? "Formulario ya cargado"
              : fueActualizacionAfiliado
              ? "Formulario actualizado correctamente"
              : "Formulario enviado correctamente"}
          </h1>

          <p>
            {esSoloConsulta
              ? "El formulario está habilitado solo para consulta. Puede revisar la información cargada para el DNI ingresado."
              : esDuplicadoDni
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
              !soloConsultaDni &&
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

            {esSoloConsulta && (
              <Button
                label="Consultar otro DNI"
                icon="pi pi-search"
                severity="warning"
                outlined
                onClick={() => {
                  setEstadoEnvio(null);
                  setRespuestaRegistrada(null);
                  setVerDetalleRespuesta(false);
                  setDniValidacion("");
                  setMensajeValidacionDni("");
                }}
              />
            )}

            <Button
              label="Volver a Oficina de Gestión"
              icon="pi pi-arrow-left"
              severity={
                esDuplicadoDni || esDuplicadoLocal ? "warning" : "success"
              }
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
          {camposVisibles.map((campo) => (
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