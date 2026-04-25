// src/components/OficinaGestion/CrearFormularioGestion.js

import React, { useRef, useState } from "react";
import { Button } from "primereact/button";
import { InputText } from "primereact/inputtext";
import { InputTextarea } from "primereact/inputtextarea";
import { Dropdown } from "primereact/dropdown";
import { MultiSelect } from "primereact/multiselect";
import { InputSwitch } from "primereact/inputswitch";
import { Toast } from "primereact/toast";
import { Editor } from "primereact/editor";

import { collection, doc, serverTimestamp, setDoc } from "firebase/firestore";
import {
  getDownloadURL,
  ref as storageRef,
  uploadBytes,
} from "firebase/storage";

import { db, storage } from "../../firebase/firebase-config";
import styles from "../../pages/Admin/OficinaGestion/OficinaGestionAdmin.module.css";

import {
  departamentosOptions,
  departamentosValues,
} from "./departamentos";

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

const ARCHIVOS_DEFAULT =
  ".pdf,.doc,.docx,.png,.jpg,.jpeg,.rar,.zip,image/png,image/jpeg";

const ARCHIVOS_DESCARGABLES_ACCEPT =
  ".pdf,.doc,.docx,.png,.jpg,.jpeg,.xlsx,.xls,.zip,.rar,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,image/png,image/jpeg";

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

  // Configuración para archivos
  archivoTipo: "tradicional",
  archivoAccept: ARCHIVOS_DEFAULT,
  permiteCamara: true,
  multiple: false,

  // Configuración para departamentos
  departamentoModo: "unico",
  departamentoMultiple: false,
  departamentosPermitidos: departamentosValues,

  // Configuración para validación por DNI
  validacionColecciones: ["usuarios", "nuevoAfiliado"],
  autocompletarDatosAfiliado: true,
};

const limpiarNombreArchivoDescarga = (nombre) => {
  return String(nombre || "archivo")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\w.-]+/g, "_");
};

const formatBytes = (bytes = 0) => {
  const size = Number(bytes || 0);

  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${Math.round(size / 1024)} KB`;

  return `${(size / (1024 * 1024)).toFixed(2)} MB`;
};

const htmlATextoPlano = (html = "") => {
  if (typeof document === "undefined") {
    return String(html || "").replace(/<[^>]+>/g, " ").trim();
  }

  const temp = document.createElement("div");
  temp.innerHTML = String(html || "");

  return (temp.textContent || temp.innerText || "").trim();
};

const normalizarDescripcionHtml = (html = "") => {
  const limpio = String(html || "").trim();
  const textoPlano = htmlATextoPlano(limpio);

  return textoPlano ? limpio : "";
};

const CrearFormularioGestion = ({ onCreated }) => {
  const toast = useRef(null);
  const archivoDescargaInputRef = useRef(null);

  const [titulo, setTitulo] = useState("");
  const [descripcionHtml, setDescripcionHtml] = useState("");
  const [activo, setActivo] = useState(true);

  const [
    permitirMultiplesRespuestasPorDni,
    setPermitirMultiplesRespuestasPorDni,
  ] = useState(false);

  const [archivoDescargaFormulario, setArchivoDescargaFormulario] =
    useState(null);

  const [
    descripcionArchivoDescargaFormulario,
    setDescripcionArchivoDescargaFormulario,
  ] = useState("");

  const [campos, setCampos] = useState([{ ...campoInicial }]);
  const [guardando, setGuardando] = useState(false);

  const agregarCampo = () => {
    setCampos((prevCampos) => [...prevCampos, { ...campoInicial }]);
  };

  const eliminarCampo = (index) => {
    setCampos((prevCampos) => prevCampos.filter((_, i) => i !== index));
  };

  const actualizarCampo = (index, propiedad, valor) => {
    setCampos((prevCampos) =>
      prevCampos.map((campo, i) => {
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
                campo.departamentoModo === "multiple" ? true : false,
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

  const limpiarFormulario = () => {
    setTitulo("");
    setDescripcionHtml("");
    setActivo(true);
    setPermitirMultiplesRespuestasPorDni(false);
    setArchivoDescargaFormulario(null);
    setDescripcionArchivoDescargaFormulario("");
    setCampos([{ ...campoInicial }]);

    if (archivoDescargaInputRef.current) {
      archivoDescargaInputRef.current.value = "";
    }
  };

  const validarFormulario = () => {
    if (!titulo.trim()) {
      toast.current?.show({
        severity: "warn",
        summary: "Atención",
        detail: "Ingrese el título del formulario.",
        life: 3000,
      });

      return false;
    }

    const descripcionTextoPlano = htmlATextoPlano(descripcionHtml);

    if (!descripcionTextoPlano) {
      toast.current?.show({
        severity: "warn",
        summary: "Atención",
        detail: "Ingrese una descripción para el formulario.",
        life: 3000,
      });

      return false;
    }

    if (campos.length === 0) {
      toast.current?.show({
        severity: "warn",
        summary: "Atención",
        detail: "Debe agregar al menos un campo.",
        life: 3000,
      });

      return false;
    }

    const existeCampoSinNombre = campos.some(
      (campo) => !campo.label || !campo.label.trim()
    );

    if (existeCampoSinNombre) {
      toast.current?.show({
        severity: "warn",
        summary: "Atención",
        detail: "Todos los campos deben tener una etiqueta o pregunta.",
        life: 3000,
      });

      return false;
    }

    const existeCampoSinTipo = campos.some((campo) => !campo.tipo);

    if (existeCampoSinTipo) {
      toast.current?.show({
        severity: "warn",
        summary: "Atención",
        detail: "Todos los campos deben tener un tipo seleccionado.",
        life: 3000,
      });

      return false;
    }

    const cantidadValidacionDni = campos.filter(
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

    const departamentoSinOpciones = campos.some(
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
    return campos.map((campo, index) => {
      const campoBase = {
        id: `campo_${index + 1}`,
        label: campo.label.trim(),
        tipo: campo.tipo,
        obligatorio: Boolean(campo.obligatorio),
        placeholder: campo.placeholder ? campo.placeholder.trim() : "",
        orden: index + 1,
      };

      if (campo.tipo === "validacion_dni") {
        return {
          ...campoBase,
          tipo: "validacion_dni",
          label: campo.label?.trim() || "Validación por DNI",
          obligatorio: true,
          placeholder: campo.placeholder?.trim() || "Ingrese su DNI",
          validacionColecciones: ["usuarios", "nuevoAfiliado"],
          autocompletarDatosAfiliado: true,
          descripcionInterna:
            "Campo especial: valida el DNI contra usuarios/nuevoAfiliado y verifica si ya existe una respuesta para este formulario.",
        };
      }

      if (campo.tipo === "departamento") {
        const modoDepartamento =
          campo.departamentoModo ||
          (campo.departamentoMultiple ? "multiple" : "unico");

        return {
          ...campoBase,
          tipo: "departamento",
          departamentoModo: modoDepartamento,
          departamentoMultiple: modoDepartamento === "multiple",
          departamentosPermitidos:
            campo.departamentosPermitidos?.length > 0
              ? campo.departamentosPermitidos
              : departamentosValues,
        };
      }

      if (campo.tipo === "archivo") {
        return {
          ...campoBase,
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

      return campoBase;
    });
  };

  const subirArchivoDescargaFormulario = async (formularioId) => {
    if (!archivoDescargaFormulario) return null;

    const safeName = limpiarNombreArchivoDescarga(
      archivoDescargaFormulario.name
    );

    const path = `oficina_gestion/formularios/${formularioId}/archivo_descarga/${Date.now()}_${safeName}`;

    const refArchivo = storageRef(storage, path);

    await uploadBytes(refArchivo, archivoDescargaFormulario);

    const url = await getDownloadURL(refArchivo);

    return {
      nombre: archivoDescargaFormulario.name,
      tipo: archivoDescargaFormulario.type || "",
      size: archivoDescargaFormulario.size || 0,
      path,
      url,
      descripcion: descripcionArchivoDescargaFormulario.trim(),
    };
  };

  const guardarFormulario = async () => {
    if (!validarFormulario()) return;

    setGuardando(true);

    try {
      const camposNormalizados = normalizarCamposParaGuardar();

      const docRef = doc(collection(db, "oficina_gestion_formularios"));

      const archivoDescarga = await subirArchivoDescargaFormulario(docRef.id);

      const descripcionTextoPlano = htmlATextoPlano(descripcionHtml);
      const descripcionHtmlNormalizada =
        normalizarDescripcionHtml(descripcionHtml);

      const payload = {
        titulo: titulo.trim(),

        // Texto plano para listados, búsquedas o compatibilidad.
        descripcion: descripcionTextoPlano,

        // HTML enriquecido para mostrar con formato en la vista pública.
        descripcionHtml: descripcionHtmlNormalizada,

        activo: Boolean(activo),
        publicado: false,

        permitirMultiplesRespuestasPorDni: Boolean(
          permitirMultiplesRespuestasPorDni
        ),

        archivoDescargaFormulario: archivoDescarga,

        // Código real del formulario. Se usa luego para validar formulario + DNI.
        codigoFormulario: docRef.id,
        formularioCodigo: docRef.id,
        formularioNumero: docRef.id,

        requiereValidacionDni: camposNormalizados.some(
          (campo) => campo.tipo === "validacion_dni"
        ),

        campos: camposNormalizados,
        cantidadCampos: camposNormalizados.length,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };

      await setDoc(docRef, payload);

      toast.current?.show({
        severity: "success",
        summary: "Formulario creado",
        detail:
          "El formulario fue guardado correctamente en borrador. Ahora podés publicarlo desde Gestionar formularios.",
        life: 4000,
      });

      limpiarFormulario();

      if (typeof onCreated === "function") {
        onCreated(docRef.id);
      }
    } catch (error) {
      console.error("Error al guardar formulario:", error);

      toast.current?.show({
        severity: "error",
        summary: "Error",
        detail: "No se pudo guardar el formulario.",
        life: 4000,
      });
    } finally {
      setGuardando(false);
    }
  };

  return (
    <div className={styles.formWrapper}>
      <Toast ref={toast} />

      <div className={styles.sectionTitle}>
        <div>
          <h2>Crear nuevo formulario</h2>

          <p>
            Desde aquí podés construir formularios administrativos para trámites,
            documentación, relevamientos o solicitudes institucionales. Al
            guardarlo, quedará en <strong>borrador</strong>.
          </p>
        </div>
      </div>

      <div className={styles.formGrid}>
        <div className={styles.formRow}>
          <label htmlFor="tituloFormulario">Título del formulario</label>

          <InputText
            id="tituloFormulario"
            value={titulo}
            onChange={(e) => setTitulo(e.target.value)}
            placeholder="Ej: Oficina de Gestión para Titularización Docente"
            disabled={guardando}
          />
        </div>

        <div className={styles.formRow}>
          <label htmlFor="descripcionFormulario">
            Descripción del formulario
          </label>

          <Editor
            id="descripcionFormulario"
            value={descripcionHtml}
            onTextChange={(e) => setDescripcionHtml(e.htmlValue || "")}
            style={{ height: "280px" }}
            readOnly={guardando}
            placeholder="Explique brevemente la finalidad del formulario."
          />

          <small className={styles.helpText}>
            Podés usar negrita, cursiva, subrayado, listas, viñetas, alineación
            y saltos de párrafo. Esta descripción se verá con formato en el
            formulario público.
          </small>
        </div>

        <div className={styles.switchRow}>
          <div>
            <strong>Formulario activo</strong>

            <p>
              Si está activo, luego podrá mostrarse del lado público cuando sea
              publicado.
            </p>
          </div>

          <InputSwitch
            checked={activo}
            onChange={(e) => setActivo(e.value)}
            disabled={guardando}
          />
        </div>

        <div className={styles.switchRow}>
          <div>
            <strong>Permitir varias cargas con el mismo DNI</strong>

            <p>
              Activá esta opción si una misma persona puede completar el mismo
              formulario más de una vez. Si queda desactivada, el sistema
              mantendrá el bloqueo de una sola respuesta por DNI.
            </p>
          </div>

          <InputSwitch
            checked={permitirMultiplesRespuestasPorDni}
            onChange={(e) => setPermitirMultiplesRespuestasPorDni(e.value)}
            disabled={guardando}
          />
        </div>

        <div className={styles.formRow}>
          <label>Archivo descargable para el afiliado</label>

          <input
            ref={archivoDescargaInputRef}
            type="file"
            accept={ARCHIVOS_DESCARGABLES_ACCEPT}
            disabled={guardando}
            onChange={(e) =>
              setArchivoDescargaFormulario(e.target.files?.[0] || null)
            }
          />

          {archivoDescargaFormulario ? (
            <div className={styles.selectedInfo}>
              <div>
                <strong>Archivo seleccionado</strong>

                <p>
                  {archivoDescargaFormulario.name} —{" "}
                  {formatBytes(archivoDescargaFormulario.size)}
                </p>

                <small>
                  Este archivo se subirá junto con el formulario y estará
                  disponible para descargar en la vista pública.
                </small>
              </div>

              <Button
                label="Quitar"
                icon="pi pi-times"
                severity="danger"
                outlined
                type="button"
                onClick={() => {
                  setArchivoDescargaFormulario(null);

                  if (archivoDescargaInputRef.current) {
                    archivoDescargaInputRef.current.value = "";
                  }
                }}
                disabled={guardando}
              />
            </div>
          ) : (
            <small className={styles.helpText}>
              Opcional. Este archivo se mostrará en el formulario público para
              que el afiliado lo pueda descargar antes de cargar sus datos.
              Podés subir PDF, Word, imagen, Excel o comprimido.
            </small>
          )}
        </div>

        <div className={styles.formRow}>
          <label>Descripción del archivo descargable</label>

          <InputTextarea
            value={descripcionArchivoDescargaFormulario}
            onChange={(e) =>
              setDescripcionArchivoDescargaFormulario(e.target.value)
            }
            rows={3}
            autoResize
            placeholder="Ej: Descargá este archivo, completalo, firmalo y luego adjuntalo en formato PDF."
            disabled={guardando}
          />

          <small className={styles.helpText}>
            Este texto se mostrará junto al botón de descarga en el formulario
            público.
          </small>
        </div>
      </div>

      <div className={styles.camposHeader}>
        <div>
          <h3>Campos del formulario</h3>
          <p>Agregá las preguntas o datos que deberá completar el afiliado.</p>
        </div>

        <Button
          label="Agregar campo"
          icon="pi pi-plus"
          severity="success"
          outlined
          onClick={agregarCampo}
          disabled={guardando}
        />
      </div>

      <div className={styles.camposList}>
        {campos.map((campo, index) => (
          <article key={`campo-${index}`} className={styles.campoCard}>
            <div className={styles.campoCardHeader}>
              <strong>Campo {index + 1}</strong>

              {campos.length > 1 && (
                <Button
                  icon="pi pi-trash"
                  severity="danger"
                  rounded
                  text
                  aria-label={`Eliminar campo ${index + 1}`}
                  onClick={() => eliminarCampo(index)}
                  disabled={guardando}
                />
              )}
            </div>

            <div className={styles.campoGrid}>
              <div className={styles.formRow}>
                <label>Etiqueta o pregunta</label>

                <InputText
                  value={campo.label}
                  onChange={(e) =>
                    actualizarCampo(index, "label", e.target.value)
                  }
                  placeholder="Ej: Validación por DNI / Departamento / Adjuntar DNI"
                  disabled={guardando || campo.tipo === "validacion_dni"}
                />
              </div>

              <div className={styles.formRow}>
                <label>Tipo de campo</label>

                <Dropdown
                  value={campo.tipo}
                  options={TIPOS_CAMPO}
                  onChange={(e) => actualizarCampo(index, "tipo", e.value)}
                  placeholder="Seleccione el tipo"
                  disabled={guardando}
                />
              </div>

              <div className={styles.formRow}>
                <label>Texto de ayuda</label>

                <InputText
                  value={campo.placeholder}
                  onChange={(e) =>
                    actualizarCampo(index, "placeholder", e.target.value)
                  }
                  placeholder="Ej: Ingrese su DNI"
                  disabled={guardando}
                />
              </div>

              <div className={styles.switchRowSmall}>
                <span>Obligatorio</span>

                <InputSwitch
                  checked={campo.obligatorio}
                  onChange={(e) =>
                    actualizarCampo(index, "obligatorio", e.value)
                  }
                  disabled={guardando || campo.tipo === "validacion_dni"}
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
                  <label>Control de duplicados</label>

                  <InputText
                    value={
                      permitirMultiplesRespuestasPorDni
                        ? "Permitirá varias respuestas con el mismo DNI"
                        : "Verificará formularioId + DNI antes de permitir cargar"
                    }
                    disabled
                  />
                </div>

                <small className={styles.helpText}>
                  Este campo se mostrará al inicio del formulario público. El
                  afiliado deberá ingresar su DNI y presionar “Validar DNI”. Si
                  la opción de múltiples cargas está desactivada, el sistema
                  bloqueará una nueva carga si ya existe una respuesta con ese
                  DNI para este formulario.
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
                      actualizarCampo(index, "departamentoModo", e.value)
                    }
                    placeholder="Seleccione el tipo de selección"
                    disabled={guardando}
                  />
                </div>

                <div className={styles.formRow}>
                  <label>Departamentos disponibles</label>

                  <MultiSelect
                    value={campo.departamentosPermitidos}
                    options={departamentosOptions}
                    onChange={(e) =>
                      actualizarCampo(
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
                    disabled={guardando}
                  />
                </div>

                <small className={styles.helpText}>
                  En “Una opción”, el afiliado podrá seleccionar un solo
                  departamento. En “Varias opciones”, podrá seleccionar más de un
                  departamento.
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
                      actualizarCampo(index, "archivoTipo", e.value)
                    }
                    placeholder="Seleccione qué archivos acepta"
                    disabled={guardando}
                  />
                </div>

                <div className={styles.switchRowSmall}>
                  <span>Permitir tomar foto con cámara</span>

                  <InputSwitch
                    checked={campo.permiteCamara}
                    onChange={(e) =>
                      actualizarCampo(index, "permiteCamara", e.value)
                    }
                    disabled={guardando}
                  />
                </div>

                <div className={styles.switchRowSmall}>
                  <span>Permitir varios archivos</span>

                  <InputSwitch
                    checked={campo.multiple}
                    onChange={(e) =>
                      actualizarCampo(index, "multiple", e.value)
                    }
                    disabled={guardando}
                  />
                </div>

                <small className={styles.helpText}>
                  Se aceptarán archivos PDF, Word, imágenes JPG/PNG/JPEG,
                  comprimidos RAR/ZIP y, si está habilitado, fotos tomadas desde
                  la cámara del celular.
                </small>
              </div>
            )}
          </article>
        ))}
      </div>

      <div className={styles.footerActions}>
        <Button
          label="Guardar formulario"
          icon="pi pi-save"
          severity="success"
          onClick={guardarFormulario}
          loading={guardando}
          disabled={guardando}
        />

        <Button
          label="Limpiar"
          icon="pi pi-refresh"
          severity="secondary"
          outlined
          onClick={limpiarFormulario}
          disabled={guardando}
        />
      </div>
    </div>
  );
};

export default CrearFormularioGestion;