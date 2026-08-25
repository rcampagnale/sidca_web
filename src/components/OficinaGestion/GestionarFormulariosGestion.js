// src/components/OficinaGestion/GestionarFormulariosGestion.js

import React, { useEffect, useRef, useState } from "react";
import { Button } from "primereact/button";
import { Dialog } from "primereact/dialog";
import { Tag } from "primereact/tag";
import { Toast } from "primereact/toast";
import { ConfirmDialog, confirmDialog } from "primereact/confirmdialog";
import { ProgressSpinner } from "primereact/progressspinner";
import { InputText } from "primereact/inputtext";
import { InputTextarea } from "primereact/inputtextarea";
import { InputSwitch } from "primereact/inputswitch";
import { Dropdown } from "primereact/dropdown";
import { MultiSelect } from "primereact/multiselect";
import { Editor } from "primereact/editor";

import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  where,
  writeBatch,
} from "firebase/firestore";

import { db } from "../../firebase/firebase-config";
import styles from "../../pages/Admin/OficinaGestion/OficinaGestionAdmin.module.css";

import {
  departamentosOptions,
  departamentosValues,
} from "./departamentos";

import {
  htmlATextoPlano,
  normalizarDescripcionHtml,
  textoPlanoAHtml,
  sanearHtmlBasico,
} from "./richTextUtils";

import {
  COLOR_INICIAL_NO,
  COLOR_INICIAL_SI,
  MODO_COLOR,
  OPCIONES_COLOR,
  OPCIONES_MODO_COLOR,
  construirConfiguracionSello,
  construirConfiguracionTarjeta,
  obtenerConfiguracionSello,
  obtenerReglasTarjeta,
} from "../../services/configuracionVisualService";

const RUTA_PUBLICA_FORMULARIO = "/oficina-gestion/formulario";

const ARCHIVOS_DEFAULT =
  ".pdf,.doc,.docx,.png,.jpg,.jpeg,.rar,.zip,image/png,image/jpeg";

const TIPOS_CAMPO = [
  { label: "Validación por DNI", value: "validacion_dni" },
  { label: "Texto corto", value: "texto" },
  { label: "Texto largo", value: "textarea" },
  { label: "Número", value: "numero" },
  { label: "Fecha", value: "fecha" },
  { label: "Email", value: "email" },
  { label: "Departamento", value: "departamento" },
  { label: "Adjuntar archivo", value: "archivo" },
  { label: "Sí / No", value: "booleano" },
];

const OPCIONES_SELECCION_DEPARTAMENTO = [
  { label: "Una opción", value: "unico" },
  { label: "Varias opciones", value: "multiple" },
];

const OPCIONES_ARCHIVO = [
  {
    label: "PDF, Word, imágenes y comprimidos",
    value: "tradicional",
    accept: ARCHIVOS_DEFAULT,
  },
  {
    label: "Solo PDF",
    value: "pdf",
    accept: ".pdf",
  },
  {
    label: "Solo Word",
    value: "word",
    accept: ".doc,.docx",
  },
  {
    label: "Solo imágenes",
    value: "imagenes",
    accept: ".png,.jpg,.jpeg,image/png,image/jpeg",
  },
  {
    label: "Solo comprimidos",
    value: "comprimidos",
    accept: ".rar,.zip",
  },
];

const campoInicial = {
  label: "",
  tipo: "texto",
  obligatorio: false,
  placeholder: "",

  archivoTipo: "tradicional",
  archivoAccept: ARCHIVOS_DEFAULT,
  permiteCamara: true,
  multiple: false,

  departamentoModo: "unico",
  departamentoMultiple: false,
  departamentosPermitidos: departamentosValues,

  validacionColecciones: ["usuarios", "nuevoAfiliado"],
  autocompletarDatosAfiliado: true,
};

const GestionarFormulariosGestion = () => {
  const toast = useRef(null);

  const [formularios, setFormularios] = useState([]);
  const [loading, setLoading] = useState(false);
  const [formularioPreview, setFormularioPreview] = useState(null);
  const [procesandoId, setProcesandoId] = useState(null);

  // Configuración de color de tarjetas. Se edita aparte del formulario porque
  // es presentación: no toca la estructura de columnas ni las respuestas, y
  // por eso puede cambiarse en un formulario ya publicado y con datos.
  const [formularioColor, setFormularioColor] = useState(null);
  const [reglasColor, setReglasColor] = useState([]);
  const [selloHabilitado, setSelloHabilitado] = useState(false);
  const [textosSello, setTextosSello] = useState({ verde: "", amarillo: "", rojo: "" });
  const [guardandoColor, setGuardandoColor] = useState(false);

  const [formularioEditando, setFormularioEditando] = useState(null);
  const [editTitulo, setEditTitulo] = useState("");
  const [editDescripcion, setEditDescripcion] = useState("");
  const [editDescripcionHtml, setEditDescripcionHtml] = useState("");
  const [editActivo, setEditActivo] = useState(true);
  const [editSoloConsultaDni, setEditSoloConsultaDni] = useState(false);
  const [
    editPermitirMultiplesRespuestasPorDni,
    setEditPermitirMultiplesRespuestasPorDni,
  ] = useState(false);
  const [editCampos, setEditCampos] = useState([{ ...campoInicial }]);
  const [guardandoEdicion, setGuardandoEdicion] = useState(false);

  const obtenerCodigoFormulario = (formulario) => {
    return (
      formulario?.codigoFormulario ||
      formulario?.formularioCodigo ||
      formulario?.formularioNumero ||
      formulario?.id ||
      "—"
    );
  };

  const obtenerTipoFormulario = (formulario) => {
    const esExcelAgrupado =
      formulario?.tipoFormulario === "consulta_excel_agrupada" ||
      formulario?.configuracionExcel?.habilitado;
    return esExcelAgrupado ? "Excel agrupado" : "Manual";
  };

  const obtenerIdentificadorFormulario = (formulario) =>
    formulario?.configuracionExcel?.columnaAgrupacion?.label ||
    formulario?.configuracionExcel?.columnaAgrupacion?.sourceHeader ||
    formulario?.campos?.find((campo) => campo.tipo === "validacion_dni")?.label ||
    "—";

  const formularioTieneValidacionDni = (formulario) => {
    return Boolean(
      formulario?.requiereValidacionDni ||
        formulario?.campos?.some((campo) => campo.tipo === "validacion_dni")
    );
  };

  const formularioSoloConsultaDni = (formulario) => {
    return Boolean(
      formulario?.soloConsultaDni ||
        formulario?.modoSoloConsultaDni ||
        formulario?.bloquearCargaRespuestas
    );
  };

  const formularioPermiteMultiplesRespuestasPorDni = (formulario) => {
    if (formularioSoloConsultaDni(formulario)) return false;

    return Boolean(formulario?.permitirMultiplesRespuestasPorDni);
  };

  const cargarFormularios = async () => {
    setLoading(true);

    try {
      const q = query(
        collection(db, "oficina_gestion_formularios"),
        orderBy("createdAt", "desc")
      );

      const snap = await getDocs(q);

      const data = snap.docs.map((docSnap) => {
        const dataFormulario = docSnap.data();

        const soloConsulta = Boolean(
          dataFormulario.soloConsultaDni ||
            dataFormulario.modoSoloConsultaDni ||
            dataFormulario.bloquearCargaRespuestas
        );

        return {
          id: docSnap.id,
          ...dataFormulario,
          codigoFormulario: dataFormulario.codigoFormulario || docSnap.id,
          formularioCodigo: dataFormulario.formularioCodigo || docSnap.id,
          formularioNumero: dataFormulario.formularioNumero || docSnap.id,
          soloConsultaDni: soloConsulta,
          modoSoloConsultaDni: soloConsulta,
          bloquearCargaRespuestas: soloConsulta,
          permitirMultiplesRespuestasPorDni: soloConsulta
            ? false
            : Boolean(dataFormulario.permitirMultiplesRespuestasPorDni),
          requiereValidacionDni: Boolean(
            soloConsulta ||
              dataFormulario.requiereValidacionDni ||
              dataFormulario.campos?.some(
                (campo) => campo.tipo === "validacion_dni"
              )
          ),
        };
      });

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
      setLoading(false);
    }
  };

  useEffect(() => {
    cargarFormularios();
  }, []);

  const convertirFecha = (value) => {
    if (!value) return null;

    try {
      if (value.toDate) return value.toDate();

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

  const obtenerLinkFormulario = (id) => {
    return `${window.location.origin}${RUTA_PUBLICA_FORMULARIO}/${id}`;
  };

  const copiarTexto = async (texto, mensaje = "Texto copiado") => {
    try {
      await navigator.clipboard.writeText(texto);

      toast.current?.show({
        severity: "success",
        summary: "Copiado",
        detail: mensaje,
        life: 3000,
      });
    } catch (error) {
      console.error("Error al copiar:", error);

      toast.current?.show({
        severity: "error",
        summary: "Error",
        detail: "No se pudo copiar.",
        life: 3500,
      });
    }
  };

  const copiarCodigoFormulario = (formulario) => {
    const codigo = obtenerCodigoFormulario(formulario);
    copiarTexto(codigo, "El código del formulario fue copiado.");
  };

  const copiarLink = async (formulario) => {
    if (!formulario.publicado) {
      toast.current?.show({
        severity: "warn",
        summary: "Formulario no publicado",
        detail: "Debés publicar el formulario antes de copiar el link final.",
        life: 3500,
      });

      return;
    }

    const link = obtenerLinkFormulario(formulario.id);

    copiarTexto(link, "El link del formulario fue copiado al portapapeles.");
  };

  const abrirLinkFormulario = (formulario) => {
    if (!formulario.publicado) {
      toast.current?.show({
        severity: "warn",
        summary: "Formulario no publicado",
        detail: "Primero debés publicar el formulario para abrir el link final.",
        life: 3500,
      });

      return;
    }

    window.open(
      obtenerLinkFormulario(formulario.id),
      "_blank",
      "noopener,noreferrer"
    );
  };

  /**
   * Abre el editor de colores con lo que el formulario ya tiene guardado.
   * Un formulario sin `configuracionVisual` abre en "Sin color", que es
   * exactamente su comportamiento actual.
   */
  const abrirConfiguracionColor = (formulario) => {
    setFormularioColor(formulario);
    // Lee tanto reglas nuevas como la forma legacy de una sola regla.
    setReglasColor(obtenerReglasTarjeta(formulario));
    const sello = obtenerConfiguracionSello(formulario);
    setSelloHabilitado(sello.habilitado);
    setTextosSello(sello.textos);
  };

  const cerrarConfiguracionColor = () => {
    if (guardandoColor) return;
    setFormularioColor(null);
  };

  /** Columnas del formulario, para elegir cuál gobierna el color. */
  const columnasDelFormulario = (formulario) =>
    [...(formulario?.configuracionExcel?.camposSeleccionados || [])].sort(
      (a, b) => Number(a.orden || 0) - Number(b.orden || 0)
    );

  const agregarReglaColor = () => {
    const campo = columnasDelFormulario(formularioColor).find(
      (item) => !reglasColor.some((regla) => regla.campoKey === item.key)
    );

    if (!campo) {
      toast.current?.show({
        severity: "info",
        summary: "Sin campos disponibles",
        detail: "Todos los campos del formulario ya tienen una regla o no hay campos para configurar.",
        life: 4000,
      });
      return;
    }

    setReglasColor((actuales) => [...actuales, {
      campoKey: campo.key,
      campoLabel: campo.label,
      modo: MODO_COLOR.SEMAFORO_SI_NO,
      reglas: { si: COLOR_INICIAL_SI, no: COLOR_INICIAL_NO },
    }]);
  };

  const actualizarReglaColor = (campoKey, cambios) => {
    setReglasColor((actuales) => actuales.map((regla) => {
      if (regla.campoKey !== campoKey) return regla;
      const siguiente = { ...regla, ...cambios };
      if (cambios.reglas) return siguiente;
      if (cambios.modo === MODO_COLOR.SEMAFORO_SI_NO) {
        return {
          ...siguiente,
          modo: MODO_COLOR.SEMAFORO_SI_NO,
          reglas: regla.reglas || { si: COLOR_INICIAL_SI, no: COLOR_INICIAL_NO },
        };
      }
      return {
        ...siguiente,
        modo: MODO_COLOR.COLOR_SI_TIENE_VALOR,
        color: cambios.modo,
      };
    }));
  };

  const actualizarCampoRegla = (campoKey, nuevoCampoKey) => {
    const campo = columnasDelFormulario(formularioColor).find((item) => item.key === nuevoCampoKey);
    if (!campo) return;
    setReglasColor((actuales) => actuales.map((regla) =>
      regla.campoKey === campoKey
        ? { ...regla, campoKey: campo.key, campoLabel: campo.label }
        : regla
    ));
  };

  const quitarReglaColor = (campoKey) => {
    setReglasColor((actuales) => actuales.filter((regla) => regla.campoKey !== campoKey));
  };

  /**
   * Guarda SÓLO `configuracionVisual` sobre el documento del formulario.
   *
   * updateDoc con esa única clave: no se tocan las columnas, ni los campos, ni
   * ninguna de las respuestas ya importadas.
   */
  const guardarConfiguracionColor = async () => {
    if (!formularioColor) return;

    setGuardandoColor(true);

    try {
      await updateDoc(doc(db, "oficina_gestion_formularios", formularioColor.id), {
        configuracionVisual: {
          tarjeta: construirConfiguracionTarjeta({
            reglasCampos: reglasColor,
          }),
          detalle: {
            selloEstado: construirConfiguracionSello({
              habilitado: selloHabilitado,
              textos: textosSello,
            }),
          },
        },
        updatedAt: serverTimestamp(),
      });

      toast.current?.show({
        severity: "success",
        summary: "Colores actualizados",
        detail: reglasColor.length
          ? `${reglasColor.length} regla(s) de color actualizada(s).`
          : "Las tarjetas vuelven a mostrarse sin color.",
        life: 4500,
      });

      setFormularioColor(null);
      await cargarFormularios();
    } catch (error) {
      console.error("Error al guardar la configuración de color:", error);

      toast.current?.show({
        severity: "error",
        summary: "No se pudo guardar",
        detail: "Intentá nuevamente.",
        life: 5000,
      });
    } finally {
      setGuardandoColor(false);
    }
  };

  const cambiarPublicacion = async (formulario, publicar) => {
    setProcesandoId(formulario.id);

    try {
      const codigoFormulario = obtenerCodigoFormulario(formulario);
      const soloConsulta = formularioSoloConsultaDni(formulario);
      const requiereValidacionDni =
        soloConsulta || formularioTieneValidacionDni(formulario);

      await updateDoc(doc(db, "oficina_gestion_formularios", formulario.id), {
        publicado: publicar,
        codigoFormulario,
        formularioCodigo: codigoFormulario,
        formularioNumero: codigoFormulario,
        soloConsultaDni: soloConsulta,
        modoSoloConsultaDni: soloConsulta,
        bloquearCargaRespuestas: soloConsulta,
        permitirMultiplesRespuestasPorDni: soloConsulta
          ? false
          : formularioPermiteMultiplesRespuestasPorDni(formulario),
        requiereValidacionDni,
        updatedAt: serverTimestamp(),
      });

      toast.current?.show({
        severity: "success",
        summary: publicar ? "Formulario publicado" : "Formulario despublicado",
        detail: publicar
          ? "El formulario ya tiene su link final disponible."
          : "El formulario volvió a estado borrador y ahora puede editarse.",
        life: 3500,
      });

      await cargarFormularios();
    } catch (error) {
      console.error("Error al actualizar publicación:", error);

      toast.current?.show({
        severity: "error",
        summary: "Error",
        detail: "No se pudo actualizar el estado de publicación.",
        life: 3500,
      });
    } finally {
      setProcesandoId(null);
    }
  };

  const eliminarRespuestasDelFormulario = async (formularioId) => {
    const q = query(
      collection(db, "oficina_gestion_respuestas"),
      where("formularioId", "==", formularioId)
    );

    const snap = await getDocs(q);

    if (snap.empty) return;

    const batch = writeBatch(db);

    snap.docs.forEach((docSnap) => {
      batch.delete(docSnap.ref);
    });

    await batch.commit();
  };

  const eliminarFormulario = async (formulario) => {
    setProcesandoId(formulario.id);

    try {
      await eliminarRespuestasDelFormulario(formulario.id);

      await deleteDoc(doc(db, "oficina_gestion_formularios", formulario.id));

      toast.current?.show({
        severity: "success",
        summary: "Formulario eliminado",
        detail: "El formulario y sus respuestas fueron eliminados correctamente.",
        life: 3500,
      });

      if (formularioPreview?.id === formulario.id) {
        setFormularioPreview(null);
      }

      await cargarFormularios();
    } catch (error) {
      console.error("Error al eliminar formulario:", error);

      toast.current?.show({
        severity: "error",
        summary: "Error",
        detail: "No se pudo eliminar el formulario.",
        life: 3500,
      });
    } finally {
      setProcesandoId(null);
    }
  };

  const confirmarEliminacion = (formulario) => {
    confirmDialog({
      message: `¿Está seguro de eliminar el formulario "${formulario.titulo}"? También se eliminarán sus respuestas registradas.`,
      header: "Eliminar formulario",
      icon: "pi pi-exclamation-triangle",
      acceptLabel: "Sí, eliminar",
      rejectLabel: "Cancelar",
      acceptClassName: "p-button-danger",
      accept: () => eliminarFormulario(formulario),
    });
  };

  const obtenerArchivosPermitidos = (campo) => {
    if (campo?.archivoAccept) return campo.archivoAccept;

    if (campo?.tipo === "archivo_pdf") return ".pdf";

    return ARCHIVOS_DEFAULT;
  };

  const obtenerTextoTipoCampo = (campo) => {
    const tipos = {
      validacion_dni: "Validación por DNI",
      texto: "Texto corto",
      textarea: "Texto largo",
      numero: "Número",
      fecha: "Fecha",
      email: "Email",
      departamento: "Departamento",
      archivo: "Adjuntar archivo",
      archivo_pdf: "Archivo PDF",
      booleano: "Sí / No",
    };

    return tipos[campo?.tipo] || campo?.tipo || "Campo";
  };

  const abrirEditorFormulario = (formulario) => {
    if (formulario.publicado) {
      toast.current?.show({
        severity: "warn",
        summary: "Formulario publicado",
        detail:
          "Para editar este formulario primero debés despublicarlo. Esto evita modificar un formulario activo con respuestas en curso.",
        life: 4500,
      });

      return;
    }

    const camposNormalizados =
      formulario.campos && formulario.campos.length > 0
        ? formulario.campos.map((campo, index) => {
            const modoDepartamento =
              campo.departamentoModo ||
              (campo.departamentoMultiple ? "multiple" : "unico");

            return {
              id: campo.id || `campo_${index + 1}`,
              label:
                campo.tipo === "validacion_dni"
                  ? campo.label || "Validación por DNI"
                  : campo.label || "",
              tipo:
                campo.tipo === "archivo_pdf"
                  ? "archivo"
                  : campo.tipo || "texto",
              obligatorio:
                campo.tipo === "validacion_dni"
                  ? true
                  : Boolean(campo.obligatorio),
              placeholder:
                campo.tipo === "validacion_dni"
                  ? campo.placeholder || "Ingrese su DNI"
                  : campo.placeholder || "",
              orden: campo.orden || index + 1,

              archivoTipo: campo.archivoTipo || "tradicional",
              archivoAccept: campo.archivoAccept || ARCHIVOS_DEFAULT,
              permiteCamara:
                campo.permiteCamara === undefined
                  ? true
                  : Boolean(campo.permiteCamara),
              multiple: Boolean(campo.multiple),

              departamentoModo: modoDepartamento,
              departamentoMultiple: modoDepartamento === "multiple",
              departamentosPermitidos:
                campo.departamentosPermitidos?.length > 0
                  ? campo.departamentosPermitidos
                  : departamentosValues,

              validacionColecciones:
                campo.validacionColecciones?.length > 0
                  ? campo.validacionColecciones
                  : ["usuarios", "nuevoAfiliado"],
              autocompletarDatosAfiliado:
                campo.autocompletarDatosAfiliado === undefined
                  ? true
                  : Boolean(campo.autocompletarDatosAfiliado),
            };
          })
        : [{ ...campoInicial }];

    const descripcionHtmlInicial = formulario.descripcionHtml
      ? sanearHtmlBasico(formulario.descripcionHtml)
      : textoPlanoAHtml(formulario.descripcion || "");

    setFormularioEditando(formulario);
    setEditTitulo(formulario.titulo || "");
    setEditDescripcion(formulario.descripcion || "");
    setEditDescripcionHtml(descripcionHtmlInicial);
    setEditActivo(Boolean(formulario.activo));
    setEditSoloConsultaDni(formularioSoloConsultaDni(formulario));
    setEditPermitirMultiplesRespuestasPorDni(
      formularioSoloConsultaDni(formulario)
        ? false
        : Boolean(formulario.permitirMultiplesRespuestasPorDni)
    );
    setEditCampos(camposNormalizados);
  };

  const cerrarEditor = () => {
    if (guardandoEdicion) return;

    setFormularioEditando(null);
    setEditTitulo("");
    setEditDescripcion("");
    setEditDescripcionHtml("");
    setEditActivo(true);
    setEditSoloConsultaDni(false);
    setEditPermitirMultiplesRespuestasPorDni(false);
    setEditCampos([{ ...campoInicial }]);
  };

  const agregarCampoEdicion = () => {
    setEditCampos((prev) => [...prev, { ...campoInicial }]);
  };

  const eliminarCampoEdicion = (index) => {
    setEditCampos((prev) => prev.filter((_, i) => i !== index));
  };

  const actualizarCampoEdicion = (index, propiedad, valor) => {
    setEditCampos((prev) =>
      prev.map((campo, i) => {
        if (i !== index) return campo;

        if (propiedad === "tipo") {
          if (valor === "validacion_dni") {
            return {
              ...campo,
              tipo: valor,
              label: "Validación por DNI",
              placeholder: "Ingrese su DNI",
              obligatorio: true,
              validacionColecciones: ["usuarios", "nuevoAfiliado"],
              autocompletarDatosAfiliado: true,
            };
          }

          if (valor === "departamento") {
            return {
              ...campo,
              tipo: valor,
              label: campo.label || "Departamento",
              placeholder: campo.placeholder || "Seleccione departamento",
              departamentoModo: campo.departamentoModo || "unico",
              departamentoMultiple:
                (campo.departamentoModo || "unico") === "multiple",
              departamentosPermitidos:
                campo.departamentosPermitidos?.length > 0
                  ? campo.departamentosPermitidos
                  : departamentosValues,
            };
          }

          if (valor === "archivo") {
            return {
              ...campo,
              tipo: valor,
              archivoTipo: campo.archivoTipo || "tradicional",
              archivoAccept: campo.archivoAccept || ARCHIVOS_DEFAULT,
              permiteCamara:
                campo.permiteCamara === undefined
                  ? true
                  : Boolean(campo.permiteCamara),
              multiple: Boolean(campo.multiple),
            };
          }

          return {
            ...campo,
            tipo: valor,
          };
        }

        if (propiedad === "departamentoModo") {
          return {
            ...campo,
            departamentoModo: valor,
            departamentoMultiple: valor === "multiple",
          };
        }

        if (propiedad === "archivoTipo") {
          const opcion = OPCIONES_ARCHIVO.find((item) => item.value === valor);

          return {
            ...campo,
            archivoTipo: valor,
            archivoAccept: opcion?.accept || ARCHIVOS_DEFAULT,
          };
        }

        return {
          ...campo,
          [propiedad]: valor,
        };
      })
    );
  };

  const validarEdicion = () => {
    if (!editTitulo.trim()) {
      toast.current?.show({
        severity: "warn",
        summary: "Atención",
        detail: "Ingrese el título del formulario.",
        life: 3000,
      });

      return false;
    }

    const descripcionTextoPlano = htmlATextoPlano(editDescripcionHtml);

    if (!descripcionTextoPlano) {
      toast.current?.show({
        severity: "warn",
        summary: "Atención",
        detail: "Ingrese la descripción del formulario.",
        life: 3000,
      });

      return false;
    }

    if (!editCampos.length) {
      toast.current?.show({
        severity: "warn",
        summary: "Atención",
        detail: "El formulario debe tener al menos un campo.",
        life: 3000,
      });

      return false;
    }

    const campoSinNombre = editCampos.some(
      (campo) => !campo.label || !campo.label.trim()
    );

    if (campoSinNombre) {
      toast.current?.show({
        severity: "warn",
        summary: "Atención",
        detail: "Todos los campos deben tener una etiqueta o pregunta.",
        life: 3000,
      });

      return false;
    }

    const cantidadValidacionDni = editCampos.filter(
      (campo) => campo.tipo === "validacion_dni"
    ).length;

    if (cantidadValidacionDni > 1) {
      toast.current?.show({
        severity: "warn",
        summary: "Atención",
        detail:
          "El formulario solo puede tener un campo de Validación por DNI.",
        life: 3500,
      });

      return false;
    }

    const departamentoSinOpciones = editCampos.some(
      (campo) =>
        campo.tipo === "departamento" &&
        (!campo.departamentosPermitidos ||
          campo.departamentosPermitidos.length === 0)
    );

    if (departamentoSinOpciones) {
      toast.current?.show({
        severity: "warn",
        summary: "Atención",
        detail:
          "Los campos de tipo Departamento deben tener al menos una opción disponible.",
        life: 3500,
      });

      return false;
    }

    return true;
  };

  const normalizarCamposParaGuardar = () => {
    return editCampos.map((campo, index) => {
      const base = {
        id: campo.id || `campo_${index + 1}`,
        label: campo.label.trim(),
        tipo: campo.tipo || "texto",
        obligatorio: Boolean(campo.obligatorio),
        placeholder: campo.placeholder ? campo.placeholder.trim() : "",
        orden: index + 1,
      };

      if (base.tipo === "validacion_dni") {
        return {
          ...base,
          tipo: "validacion_dni",
          label: campo.label?.trim() || "Validación por DNI",
          obligatorio: true,
          placeholder: campo.placeholder?.trim() || "Ingrese su DNI",
          validacionColecciones: ["usuarios", "nuevoAfiliado"],
          autocompletarDatosAfiliado: true,
          descripcionInterna: editSoloConsultaDni
            ? "Campo especial: permite consultar una respuesta existente por DNI. No habilita nuevas cargas cuando el formulario está en modo solo consulta."
            : "Campo especial: valida el DNI contra usuarios/nuevoAfiliado y verifica si ya existe una respuesta para este formulario.",
        };
      }

      if (base.tipo === "departamento") {
        const modoDepartamento =
          campo.departamentoModo ||
          (campo.departamentoMultiple ? "multiple" : "unico");

        return {
          ...base,
          tipo: "departamento",
          departamentoModo: modoDepartamento,
          departamentoMultiple: modoDepartamento === "multiple",
          departamentosPermitidos:
            campo.departamentosPermitidos?.length > 0
              ? campo.departamentosPermitidos
              : departamentosValues,
        };
      }

      if (base.tipo === "archivo" || base.tipo === "archivo_pdf") {
        return {
          ...base,
          tipo: "archivo",
          archivoTipo: campo.archivoTipo || "tradicional",
          archivoAccept: campo.archivoAccept || ARCHIVOS_DEFAULT,
          permiteCamara: Boolean(campo.permiteCamara),
          multiple: Boolean(campo.multiple),
          extensionesPermitidas: [
            "pdf",
            "doc",
            "docx",
            "png",
            "jpg",
            "jpeg",
            "rar",
            "zip",
          ],
        };
      }

      return base;
    });
  };

  const guardarEdicionFormulario = async () => {
    if (!formularioEditando?.id) return;

    if (!validarEdicion()) return;

    setGuardandoEdicion(true);
    setProcesandoId(formularioEditando.id);

    try {
      const camposNormalizados = normalizarCamposParaGuardar();
      const codigoFormulario = obtenerCodigoFormulario(formularioEditando);

      const descripcionHtmlNormalizada =
        normalizarDescripcionHtml(editDescripcionHtml);

      const descripcionTextoPlano = htmlATextoPlano(
        descripcionHtmlNormalizada
      );

      const requiereValidacionDni =
        editSoloConsultaDni ||
        camposNormalizados.some((campo) => campo.tipo === "validacion_dni");

      await updateDoc(
        doc(db, "oficina_gestion_formularios", formularioEditando.id),
        {
          titulo: editTitulo.trim(),
          descripcion: descripcionTextoPlano,
          descripcionHtml: descripcionHtmlNormalizada,
          activo: Boolean(editActivo),
          publicado: false,
          soloConsultaDni: Boolean(editSoloConsultaDni),
          modoSoloConsultaDni: Boolean(editSoloConsultaDni),
          bloquearCargaRespuestas: Boolean(editSoloConsultaDni),
          permitirMultiplesRespuestasPorDni: editSoloConsultaDni
            ? false
            : Boolean(editPermitirMultiplesRespuestasPorDni),
          codigoFormulario,
          formularioCodigo: codigoFormulario,
          formularioNumero: codigoFormulario,
          requiereValidacionDni,
          campos: camposNormalizados,
          cantidadCampos: camposNormalizados.length,
          updatedAt: serverTimestamp(),
        }
      );

      toast.current?.show({
        severity: "success",
        summary: "Formulario actualizado",
        detail: "Los cambios fueron guardados correctamente.",
        life: 3500,
      });

      cerrarEditor();

      await cargarFormularios();
    } catch (error) {
      console.error("Error al editar formulario:", error);

      toast.current?.show({
        severity: "error",
        summary: "Error",
        detail: "No se pudo actualizar el formulario.",
        life: 3500,
      });
    } finally {
      setGuardandoEdicion(false);
      setProcesandoId(null);
    }
  };

  const renderPreviewCampo = (campo) => {
    switch (campo.tipo) {
      case "validacion_dni":
        return (
          <div className={styles.previewFileBox}>
            <InputText
              disabled
              value=""
              placeholder={campo.placeholder || "Ingrese su DNI"}
            />

            <Button
              label={
                formularioSoloConsultaDni(formularioPreview)
                  ? "Consultar información"
                  : "Validar DNI"
              }
              icon="pi pi-search"
              severity={
                formularioSoloConsultaDni(formularioPreview)
                  ? "warning"
                  : "success"
              }
              outlined
              disabled
            />

            <small>
              {formularioSoloConsultaDni(formularioPreview)
                ? "Modo solo consulta: buscará si existe una respuesta cargada para el DNI ingresado y no permitirá nuevas cargas."
                : "Primero buscará el DNI en usuarios y nuevoAfiliado. Luego verificará si ya existe una respuesta para este formulario."}
            </small>
          </div>
        );

      case "textarea":
        return (
          <InputText
            disabled
            value=""
            placeholder={campo.placeholder || "Respuesta del usuario"}
          />
        );

      case "booleano":
        return (
          <div className={styles.previewBooleanRow}>
            <span>Opción Sí / No</span>
            <InputSwitch checked={false} disabled />
          </div>
        );

      case "departamento": {
        const opcionesPermitidas = departamentosOptions.filter((opcion) =>
          (campo.departamentosPermitidos || departamentosValues).includes(
            opcion.value
          )
        );

        return (
          <div className={styles.previewFileBox}>
            {campo.departamentoMultiple ? (
              <MultiSelect
                value={[]}
                options={opcionesPermitidas}
                optionLabel="label"
                optionValue="value"
                placeholder="Seleccione uno o varios departamentos"
                display="chip"
                disabled
              />
            ) : (
              <Dropdown
                value={null}
                options={opcionesPermitidas}
                optionLabel="label"
                optionValue="value"
                placeholder="Seleccione departamento"
                disabled
              />
            )}

            <small>
              Modo:{" "}
              {campo.departamentoMultiple
                ? "selección múltiple"
                : "selección única"}
            </small>
          </div>
        );
      }

      case "archivo":
      case "archivo_pdf":
        return (
          <div className={styles.previewFileBox}>
            <Button
              label="Seleccionar archivo"
              icon="pi pi-upload"
              severity="secondary"
              outlined
              disabled
            />

            {campo.permiteCamara && (
              <Button
                label="Tomar foto"
                icon="pi pi-camera"
                severity="info"
                outlined
                disabled
              />
            )}

            <small>Archivos permitidos: {obtenerArchivosPermitidos(campo)}</small>

            {campo.multiple && <small>Permite cargar varios archivos.</small>}

            {campo.permiteCamara && (
              <small>
                En celulares compatibles, el usuario podrá tomar una foto con la
                cámara.
              </small>
            )}
          </div>
        );

      case "fecha":
        return (
          <InputText
            type="date"
            disabled
            value=""
            placeholder={campo.placeholder || "Seleccione una fecha"}
          />
        );

      case "numero":
        return (
          <InputText
            type="number"
            disabled
            value=""
            placeholder={campo.placeholder || "Ingrese un número"}
          />
        );

      case "email":
        return (
          <InputText
            type="email"
            disabled
            value=""
            placeholder={campo.placeholder || "Ingrese un correo electrónico"}
          />
        );

      case "texto":
      default:
        return (
          <InputText
            disabled
            value=""
            placeholder={campo.placeholder || "Respuesta del usuario"}
          />
        );
    }
  };

  return (
    <div className={styles.formWrapper}>
      <Toast ref={toast} />
      <ConfirmDialog />

      <div className={styles.sectionTitle}>
        <div>
          <h2>Gestionar formularios</h2>

          <p>
            Desde aquí podés previsualizar, editar formularios en borrador,
            publicarlos, despublicarlos, copiar el link final, abrirlos o
            eliminarlos. El código del formulario corresponde al ID real usado
            para verificar respuestas por formulario y DNI.
          </p>
        </div>

        <Button
          label="Actualizar"
          icon="pi pi-refresh"
          severity="secondary"
          outlined
          onClick={cargarFormularios}
          loading={loading}
        />
      </div>

      {loading ? (
        <div className={styles.loadingBox}>
          <ProgressSpinner />

          <span>Cargando formularios...</span>
        </div>
      ) : formularios.length === 0 ? (
        <div className={styles.emptyBox}>
          <i className="pi pi-file" />

          <h3>No hay formularios creados</h3>

          <p>
            Primero debés crear un formulario desde la pestaña “Crear
            formulario”.
          </p>
        </div>
      ) : (
        <div className={styles.manageList}>
          {formularios.map((formulario) => {
            const linkFinal = obtenerLinkFormulario(formulario.id);
            const codigoFormulario = obtenerCodigoFormulario(formulario);
            const requiereValidacionDni = formularioTieneValidacionDni(
              formulario
            );
            const soloConsulta = formularioSoloConsultaDni(formulario);
            const permiteMultiples =
              formularioPermiteMultiplesRespuestasPorDni(formulario);

            const cantidadCampos =
              formulario.cantidadCampos || formulario.campos?.length || 0;
            const tipoFormulario = obtenerTipoFormulario(formulario);
            const identificadorFormulario = obtenerIdentificadorFormulario(formulario);
            const idCorto = String(formulario.id || "").slice(0, 8).toUpperCase() || "—";

            return (
              <article key={formulario.id} className={styles.manageCard}>
                <div className={styles.manageCardHeader}>
                  <div>
                    <h3>{formulario.titulo || "Formulario sin título"}</h3>

                    <p>{formulario.descripcion || "Sin descripción."}</p>

                    <small>
                      Código / ID del formulario:{" "}
                      <strong>{codigoFormulario}</strong>
                    </small>
                  </div>

                  <div className={styles.tagGroup}>
                    <Tag
                      value={formulario.publicado ? "Publicado" : "Borrador"}
                      severity={formulario.publicado ? "success" : "warning"}
                    />

                    <Tag
                      value={formulario.activo ? "Activo" : "Inactivo"}
                      severity={formulario.activo ? "info" : "danger"}
                    />

                    {requiereValidacionDni && (
                      <Tag value="Valida DNI" severity="success" />
                    )}

                    {soloConsulta && (
                      <Tag value="Solo consulta por DNI" severity="help" />
                    )}

                    {permiteMultiples && (
                      <Tag value="Múltiples cargas" severity="warning" />
                    )}
                  </div>
                </div>

                <div className={styles.metaGrid}>
                  <div className={styles.metaItem}>
                    <span>Tipo</span>

                    <strong>{tipoFormulario}</strong>
                  </div>

                  <div className={styles.metaItem}>
                    <span>Identificador</span>

                    <strong>{identificadorFormulario}</strong>
                  </div>

                  <div className={styles.metaItem}>
                    <span>ID corto</span>

                    <strong>{idCorto}</strong>
                  </div>

                  <div className={styles.metaItem}>
                    <span>Código del formulario</span>

                    <strong>{codigoFormulario}</strong>
                  </div>

                  <div className={styles.metaItem}>
                    <span>ID Firebase</span>

                    <strong>{formulario.id}</strong>
                  </div>

                  <div className={styles.metaItem}>
                    <span>Cantidad de campos</span>

                    <strong>{cantidadCampos}</strong>
                  </div>

                  <div className={styles.metaItem}>
                    <span>Validación por DNI</span>

                    <strong>{requiereValidacionDni ? "Sí" : "No"}</strong>
                  </div>

                  <div className={styles.metaItem}>
                    <span>Solo consulta por DNI</span>

                    <strong>{soloConsulta ? "Sí" : "No"}</strong>
                  </div>

                  <div className={styles.metaItem}>
                    <span>Múltiples cargas por DNI</span>

                    <strong>{permiteMultiples ? "Sí" : "No"}</strong>
                  </div>

                  <div className={styles.metaItem}>
                    <span>Creado</span>

                    <strong>{formatearFecha(formulario.createdAt)}</strong>
                  </div>

                  <div className={styles.metaItem}>
                    <span>Actualizado</span>

                    <strong>{formatearFecha(formulario.updatedAt)}</strong>
                  </div>
                </div>

                <div className={styles.linkBox}>
                  <label>Link final del formulario</label>

                  <div className={styles.linkRow}>
                    <InputText
                      value={
                        formulario.publicado
                          ? linkFinal
                          : "Publicá el formulario para habilitar el link final."
                      }
                      readOnly
                    />

                    <Button
                      label="Copiar link"
                      icon="pi pi-copy"
                      severity="info"
                      outlined
                      onClick={() => copiarLink(formulario)}
                      disabled={!formulario.publicado}
                    />

                    <Button
                      label="Abrir"
                      icon="pi pi-external-link"
                      severity="secondary"
                      outlined
                      onClick={() => abrirLinkFormulario(formulario)}
                      disabled={!formulario.publicado}
                    />
                  </div>

                  <small>
                    La vista previa está disponible antes de publicar. El link
                    final solo se habilita cuando el formulario está publicado.
                  </small>
                </div>

                <div className={styles.manageActions}>
                  <Button
                    label="Copiar código"
                    icon="pi pi-hashtag"
                    severity="help"
                    outlined
                    onClick={() => copiarCodigoFormulario(formulario)}
                  />

                  <Button
                    label="Vista previa"
                    icon="pi pi-eye"
                    severity="secondary"
                    outlined
                    onClick={() => setFormularioPreview(formulario)}
                  />

                  {!formulario.publicado && (
                    <Button
                      label="Editar"
                      icon="pi pi-pencil"
                      severity="info"
                      outlined
                      onClick={() => abrirEditorFormulario(formulario)}
                    />
                  )}

                  {/* Disponible también con el formulario publicado y con
                      datos: cambia sólo la presentación, no la estructura ni
                      las respuestas. */}
                  {obtenerTipoFormulario(formulario) === "Excel agrupado" && (
                    <Button
                      label="Configurar colores"
                      icon="pi pi-palette"
                      severity="warning"
                      outlined
                      onClick={() => abrirConfiguracionColor(formulario)}
                    />
                  )}

                  {!formulario.publicado ? (
                    <Button
                      label="Publicar"
                      icon="pi pi-send"
                      severity="success"
                      onClick={() => cambiarPublicacion(formulario, true)}
                      loading={procesandoId === formulario.id}
                    />
                  ) : (
                    <Button
                      label="Despublicar"
                      icon="pi pi-ban"
                      severity="warning"
                      outlined
                      onClick={() => cambiarPublicacion(formulario, false)}
                      loading={procesandoId === formulario.id}
                    />
                  )}

                  <Button
                    label="Eliminar"
                    icon="pi pi-trash"
                    severity="danger"
                    outlined
                    onClick={() => confirmarEliminacion(formulario)}
                    loading={procesandoId === formulario.id}
                  />
                </div>
              </article>
            );
          })}
        </div>
      )}

      <Dialog
        header="Vista previa del formulario"
        visible={Boolean(formularioPreview)}
        style={{ width: "850px", maxWidth: "95vw" }}
        modal
        onHide={() => setFormularioPreview(null)}
      >
        {formularioPreview && (
          <div className={styles.previewWrapper}>
            <div className={styles.previewTop}>
              <div>
                <h2>{formularioPreview.titulo}</h2>

                <p>
                  {formularioPreview.descripcion || "Sin descripción cargada."}
                </p>

                <small>
                  Código / ID del formulario:{" "}
                  <strong>{obtenerCodigoFormulario(formularioPreview)}</strong>
                </small>
              </div>

              <div className={styles.tagGroup}>
                <Tag
                  value={formularioPreview.publicado ? "Publicado" : "Borrador"}
                  severity={formularioPreview.publicado ? "success" : "warning"}
                />

                <Tag
                  value={formularioPreview.activo ? "Activo" : "Inactivo"}
                  severity={formularioPreview.activo ? "info" : "danger"}
                />

                {formularioTieneValidacionDni(formularioPreview) && (
                  <Tag value="Valida DNI" severity="success" />
                )}

                {formularioSoloConsultaDni(formularioPreview) && (
                  <Tag value="Solo consulta por DNI" severity="help" />
                )}

                {formularioPermiteMultiplesRespuestasPorDni(
                  formularioPreview
                ) && <Tag value="Múltiples cargas" severity="warning" />}
              </div>
            </div>

            {formularioPreview.publicado && (
              <div className={styles.previewLinkAlert}>
                <strong>Link final:</strong>

                <span>{obtenerLinkFormulario(formularioPreview.id)}</span>
              </div>
            )}

            <div className={styles.previewFields}>
              {(formularioPreview.campos || []).length === 0 ? (
                <div className={styles.emptyBox}>
                  <i className="pi pi-inbox" />

                  <h3>Sin campos</h3>

                  <p>Este formulario no tiene campos cargados.</p>
                </div>
              ) : (
                (formularioPreview.campos || []).map((campo) => (
                  <div key={campo.id} className={styles.previewField}>
                    <label>
                      {campo.label}

                      {campo.obligatorio && (
                        <span className={styles.requiredMark}> *</span>
                      )}
                    </label>

                    <small>
                      Tipo de campo:{" "}
                      <strong>{obtenerTextoTipoCampo(campo)}</strong>
                    </small>

                    {renderPreviewCampo(campo)}
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </Dialog>

      <Dialog
        header="Editar formulario"
        visible={Boolean(formularioEditando)}
        style={{ width: "1000px", maxWidth: "96vw" }}
        modal
        onHide={cerrarEditor}
      >
        {formularioEditando && (
          <div className={styles.formWrapper}>
            <div className={styles.selectedInfo}>
              <div>
                <strong>Formulario en borrador</strong>

                <p>
                  Solo se permite editar formularios no publicados. Cuando
                  termines los cambios, podés volver a publicarlo.
                </p>

                <small>
                  Código / ID del formulario:{" "}
                  <strong>{obtenerCodigoFormulario(formularioEditando)}</strong>
                </small>
              </div>

              <Tag value="Borrador editable" severity="warning" />
            </div>

            <div className={styles.formGrid}>
              <div className={styles.formRow}>
                <label>Título del formulario</label>

                <InputText
                  value={editTitulo}
                  onChange={(e) => setEditTitulo(e.target.value)}
                  placeholder="Título del formulario"
                  disabled={guardandoEdicion}
                />
              </div>

              <div className={styles.formRow}>
                <label>Descripción</label>

                <Editor
                  value={editDescripcionHtml}
                  onTextChange={(e) => {
                    const html = e.htmlValue || "";
                    setEditDescripcionHtml(html);
                    setEditDescripcion(htmlATextoPlano(html));
                  }}
                  style={{ height: "280px" }}
                  readOnly={guardandoEdicion}
                  placeholder="Descripción del formulario"
                />

                <small className={styles.helpText}>
                  Podés usar negrita, cursiva, subrayado, listas, viñetas,
                  alineación y saltos de párrafo. Esta descripción se verá con
                  formato en el formulario público.
                </small>
              </div>

              <div className={styles.switchRow}>
                <div>
                  <strong>Formulario activo</strong>

                  <p>
                    Si está activo, podrá mostrarse cuando se publique el link
                    final.
                  </p>
                </div>

                <InputSwitch
                  checked={editActivo}
                  onChange={(e) => setEditActivo(e.value)}
                  disabled={guardandoEdicion}
                />
              </div>

              <div className={styles.switchRow}>
                <div>
                  <strong>Solo consulta por DNI</strong>

                  <p>
                    El formulario quedará activo para consultar información ya
                    cargada, pero no permitirá crear nuevas respuestas. El
                    afiliado ingresa su DNI y visualiza sus datos si existen.
                  </p>
                </div>

                <InputSwitch
                  checked={editSoloConsultaDni}
                  onChange={(e) => {
                    setEditSoloConsultaDni(e.value);

                    if (e.value) {
                      setEditPermitirMultiplesRespuestasPorDni(false);
                    }
                  }}
                  disabled={guardandoEdicion}
                />
              </div>

              <div className={styles.switchRow}>
                <div>
                  <strong>Permitir varias cargas con el mismo DNI</strong>

                  <p>
                    Si está activado, el mismo DNI podrá completar este
                    formulario más de una vez. Si está desactivado, se mantiene
                    una sola respuesta por DNI.
                  </p>
                </div>

                <InputSwitch
                  checked={editPermitirMultiplesRespuestasPorDni}
                  onChange={(e) =>
                    setEditPermitirMultiplesRespuestasPorDni(e.value)
                  }
                  disabled={guardandoEdicion || editSoloConsultaDni}
                />
              </div>
            </div>

            <div className={styles.camposHeader}>
              <div>
                <h3>Campos del formulario</h3>

                <p>Editá, agregá o eliminá campos del formulario.</p>
              </div>

              <Button
                label="Agregar campo"
                icon="pi pi-plus"
                severity="success"
                outlined
                onClick={agregarCampoEdicion}
                disabled={guardandoEdicion}
              />
            </div>

            <div className={styles.camposList}>
              {editCampos.map((campo, index) => (
                <article
                  key={`${campo.id}-${index}`}
                  className={styles.campoCard}
                >
                  <div className={styles.campoCardHeader}>
                    <strong>Campo {index + 1}</strong>

                    {editCampos.length > 1 && (
                      <Button
                        icon="pi pi-trash"
                        severity="danger"
                        rounded
                        text
                        aria-label={`Eliminar campo ${index + 1}`}
                        onClick={() => eliminarCampoEdicion(index)}
                        disabled={guardandoEdicion}
                      />
                    )}
                  </div>

                  <div className={styles.campoGrid}>
                    <div className={styles.formRow}>
                      <label>Etiqueta o pregunta</label>

                      <InputText
                        value={campo.label}
                        onChange={(e) =>
                          actualizarCampoEdicion(
                            index,
                            "label",
                            e.target.value
                          )
                        }
                        placeholder="Ej: Validación por DNI / Departamento / Apellido y nombre"
                        disabled={
                          guardandoEdicion || campo.tipo === "validacion_dni"
                        }
                      />
                    </div>

                    <div className={styles.formRow}>
                      <label>Tipo de campo</label>

                      <Dropdown
                        value={campo.tipo}
                        options={TIPOS_CAMPO}
                        onChange={(e) =>
                          actualizarCampoEdicion(index, "tipo", e.value)
                        }
                        placeholder="Seleccione el tipo"
                        disabled={guardandoEdicion}
                      />
                    </div>

                    <div className={styles.formRow}>
                      <label>Texto de ayuda</label>

                      <InputText
                        value={campo.placeholder}
                        onChange={(e) =>
                          actualizarCampoEdicion(
                            index,
                            "placeholder",
                            e.target.value
                          )
                        }
                        placeholder="Ej: Ingrese su DNI"
                        disabled={guardandoEdicion}
                      />
                    </div>

                    <div className={styles.switchRowSmall}>
                      <span>Obligatorio</span>

                      <InputSwitch
                        checked={campo.obligatorio}
                        onChange={(e) =>
                          actualizarCampoEdicion(
                            index,
                            "obligatorio",
                            e.value
                          )
                        }
                        disabled={
                          guardandoEdicion || campo.tipo === "validacion_dni"
                        }
                      />
                    </div>
                  </div>

                  {campo.tipo === "validacion_dni" && (
                    <div className={styles.archivoConfigBox}>
                      <div className={styles.formRow}>
                        <label>Validación del afiliado</label>

                        <InputText
                          value="Buscará primero en usuarios y luego en nuevoAfiliado"
                          disabled
                        />
                      </div>

                      <div className={styles.formRow}>
                        <label>Control de duplicados / consulta</label>

                        <InputText
                          value={
                            editSoloConsultaDni
                              ? "Solo consulta: no permitirá cargar respuestas nuevas"
                              : editPermitirMultiplesRespuestasPorDni
                              ? "Permitirá varias respuestas con el mismo DNI"
                              : "Verificará formularioId + DNI antes de permitir cargar"
                          }
                          disabled
                        />
                      </div>

                      <small className={styles.helpText}>
                        Este campo se mostrará al inicio del formulario público.
                        El afiliado deberá ingresar su DNI y presionar “Validar
                        DNI”. Si la opción de múltiples cargas está desactivada,
                        el sistema bloqueará una nueva carga si ya existe una
                        respuesta con ese DNI para este formulario. Si el modo
                        “Solo consulta por DNI” está activado, no se permitirá
                        cargar nuevas respuestas y solo se mostrarán datos ya
                        registrados.
                      </small>
                    </div>
                  )}

                  {campo.tipo === "departamento" && (
                    <div className={styles.departamentoConfigBox}>
                      <div className={styles.formRow}>
                        <label>Tipo de selección</label>

                        <Dropdown
                          value={campo.departamentoModo || "unico"}
                          options={OPCIONES_SELECCION_DEPARTAMENTO}
                          onChange={(e) =>
                            actualizarCampoEdicion(
                              index,
                              "departamentoModo",
                              e.value
                            )
                          }
                          placeholder="Seleccione el tipo de selección"
                          disabled={guardandoEdicion}
                        />
                      </div>

                      <div className={styles.formRow}>
                        <label>Departamentos disponibles</label>

                        <MultiSelect
                          value={campo.departamentosPermitidos}
                          options={departamentosOptions}
                          onChange={(e) =>
                            actualizarCampoEdicion(
                              index,
                              "departamentosPermitidos",
                              e.value
                            )
                          }
                          optionLabel="label"
                          optionValue="value"
                          placeholder="Seleccione departamentos disponibles"
                          display="chip"
                          filter
                          disabled={guardandoEdicion}
                        />
                      </div>

                      <small className={styles.helpText}>
                        En “Una opción”, el afiliado podrá seleccionar un solo
                        departamento. En “Varias opciones”, podrá seleccionar
                        más de un departamento.
                      </small>
                    </div>
                  )}

                  {campo.tipo === "archivo" && (
                    <div className={styles.archivoConfigBox}>
                      <div className={styles.formRow}>
                        <label>Archivos permitidos</label>

                        <Dropdown
                          value={campo.archivoTipo}
                          options={OPCIONES_ARCHIVO}
                          onChange={(e) =>
                            actualizarCampoEdicion(
                              index,
                              "archivoTipo",
                              e.value
                            )
                          }
                          placeholder="Seleccione qué archivos acepta"
                          disabled={guardandoEdicion}
                        />
                      </div>

                      <div className={styles.switchRowSmall}>
                        <span>Permitir tomar foto con cámara</span>

                        <InputSwitch
                          checked={campo.permiteCamara}
                          onChange={(e) =>
                            actualizarCampoEdicion(
                              index,
                              "permiteCamara",
                              e.value
                            )
                          }
                          disabled={guardandoEdicion}
                        />
                      </div>

                      <div className={styles.switchRowSmall}>
                        <span>Permitir varios archivos</span>

                        <InputSwitch
                          checked={campo.multiple}
                          onChange={(e) =>
                            actualizarCampoEdicion(index, "multiple", e.value)
                          }
                          disabled={guardandoEdicion}
                        />
                      </div>

                      <small className={styles.helpText}>
                        Se aceptarán archivos PDF, Word, imágenes JPG/PNG/JPEG,
                        comprimidos RAR/ZIP y, si está habilitado, fotos tomadas
                        desde la cámara del celular.
                      </small>
                    </div>
                  )}
                </article>
              ))}
            </div>

            <div className={styles.footerActions}>
              <Button
                label="Guardar cambios"
                icon="pi pi-save"
                severity="success"
                onClick={guardarEdicionFormulario}
                loading={guardandoEdicion}
              />

              <Button
                label="Cancelar"
                icon="pi pi-times"
                severity="secondary"
                outlined
                onClick={cerrarEditor}
                disabled={guardandoEdicion}
              />
            </div>
          </div>
        )}
      </Dialog>

      {/* Color de las tarjetas de la consulta pública.

          Escribe únicamente `configuracionVisual` sobre el formulario: no
          toca sus columnas ni ninguna de sus respuestas importadas, así que
          se puede cambiar cuantas veces haga falta sin reimportar el Excel. */}
      <Dialog
        header="Color de tarjetas"
        visible={Boolean(formularioColor)}
        className={styles.colorTarjetasDialog}
        style={{ width: "min(720px, 94vw)", maxWidth: "94vw" }}
        modal
        closable={!guardandoColor}
        closeOnEscape={!guardandoColor}
        onHide={cerrarConfiguracionColor}
      >
        {formularioColor && (
          <div className={styles.formGrid}>
            <p>
              Configurá una o varias reglas para <strong>{formularioColor.titulo || "este formulario"}</strong>.
              Los datos importados no se modifican: las tarjetas se recalculan al mostrarse.
            </p>

            <strong>Reglas configuradas</strong>
            {reglasColor.map((regla, index) => (
              <div className={styles.respuestaCard} key={regla.campoKey}>
                <div className={styles.manageActions}>
                  <strong>Regla {index + 1}</strong>
                  <Button label="Quitar" icon="pi pi-trash" severity="danger" text onClick={() => quitarReglaColor(regla.campoKey)} disabled={guardandoColor} />
                </div>
                <div className={styles.formRow}>
                  <label>Campo</label>
                  <Dropdown
                    value={regla.campoKey}
                    options={columnasDelFormulario(formularioColor)
                      .filter((campo) => campo.key === regla.campoKey || !reglasColor.some((item) => item.campoKey === campo.key))
                      .map((campo) => ({ label: campo.label, value: campo.key }))}
                    onChange={(event) => actualizarCampoRegla(regla.campoKey, event.value)}
                    filter
                    disabled={guardandoColor}
                  />
                </div>
                <div className={styles.formRow}>
                  <label>Color de tarjeta</label>
                  <Dropdown
                    value={regla.modo === MODO_COLOR.COLOR_SI_TIENE_VALOR ? regla.color : regla.modo}
                    options={OPCIONES_MODO_COLOR.filter((opcion) => opcion.value !== MODO_COLOR.SIN_COLOR)}
                    onChange={(event) => actualizarReglaColor(regla.campoKey, { modo: event.value })}
                    disabled={guardandoColor}
                  />
                </div>
                {regla.modo === MODO_COLOR.SEMAFORO_SI_NO && (
                  <>
                    <div className={styles.formRow}>
                      <label>Valor SI</label>
                      <Dropdown value={regla.reglas?.si || COLOR_INICIAL_SI} options={OPCIONES_COLOR} onChange={(event) => actualizarReglaColor(regla.campoKey, { reglas: { ...regla.reglas, si: event.value } })} disabled={guardandoColor} />
                    </div>
                    <div className={styles.formRow}>
                      <label>Valor NO</label>
                      <Dropdown value={regla.reglas?.no || COLOR_INICIAL_NO} options={OPCIONES_COLOR} onChange={(event) => actualizarReglaColor(regla.campoKey, { reglas: { ...regla.reglas, no: event.value } })} disabled={guardandoColor} />
                    </div>
                  </>
                )}
              </div>
            ))}

            <Button label="Agregar regla" icon="pi pi-plus" severity="warning" outlined onClick={agregarReglaColor} disabled={guardandoColor} />

            <section className={styles.selloConfigCard}>
              <h3 className={styles.selloConfigTitle}>Sello en el detalle</h3>
              <p className={styles.selloConfigHelp}>
                El sello usa el color final de la tarjeta y no modifica las respuestas importadas.
              </p>
              <div className={styles.selloConfigToggle}>
                <InputSwitch
                  inputId="sello-estado-detalle"
                  checked={selloHabilitado}
                  onChange={(event) => setSelloHabilitado(Boolean(event.value))}
                  disabled={guardandoColor}
                />
                <label htmlFor="sello-estado-detalle">Mostrar sello de estado</label>
              </div>
              {selloHabilitado && (
                <div className={styles.selloConfigFields}>
                  <div className={styles.selloTextField}>
                    <label>Texto para verde</label>
                    <InputText
                      value={textosSello.verde}
                      onChange={(event) => setTextosSello((actual) => ({ ...actual, verde: event.target.value }))}
                      disabled={guardandoColor}
                    />
                  </div>
                  <div className={styles.selloTextField}>
                    <label>Texto para amarillo</label>
                    <InputText
                      value={textosSello.amarillo}
                      onChange={(event) => setTextosSello((actual) => ({ ...actual, amarillo: event.target.value }))}
                      disabled={guardandoColor}
                    />
                  </div>
                  <div className={styles.selloTextField}>
                    <label>Texto para rojo</label>
                    <InputTextarea
                      value={textosSello.rojo}
                      rows={2}
                      autoResize
                      onChange={(event) => setTextosSello((actual) => ({ ...actual, rojo: event.target.value }))}
                      disabled={guardandoColor}
                    />
                  </div>
                </div>
              )}
            </section>

            <div className={styles.manageActions}>
              <Button
                label="Cancelar"
                outlined
                onClick={cerrarConfiguracionColor}
                disabled={guardandoColor}
              />

              <Button
                label="Guardar"
                icon="pi pi-check"
                severity="success"
                onClick={guardarConfiguracionColor}
                loading={guardandoColor}
                disabled={guardandoColor}
              />
            </div>
          </div>
        )}
      </Dialog>
    </div>
  );
};

export default GestionarFormulariosGestion;
