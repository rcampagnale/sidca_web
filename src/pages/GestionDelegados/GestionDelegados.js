import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSelector } from "react-redux";
import { Button } from "primereact/button";
import { Dialog } from "primereact/dialog";
import { Dropdown } from "primereact/dropdown";
import { InputText } from "primereact/inputtext";
import { InputTextarea } from "primereact/inputtextarea";
import { ProgressBar } from "primereact/progressbar";
import { ProgressSpinner } from "primereact/progressspinner";
import { Tag } from "primereact/tag";
import { Toast } from "primereact/toast";
import {
  addDoc,
  collection,
  collectionGroup,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from "firebase/firestore";
import * as XLSX from "xlsx";

import { db } from "../../firebase/firebase-config";
import styles from "./GestionDelegados.module.css";
import ExpedientesDashboard from "./ExpedientesDashboard";

const ESTADOS = ["ALTA_DE_SERVICIO", "RECLAMO", "DEUDA", "VARIOS", "SOLICITUD"];
const ESTADOS_SUELDO = ["ACTIVO", "INACTIVO"];
const OBSERVACION_ESTADO_SUELDO_ACTIVO =
  "CIRCUITO ADMINISTRATIVO COMPLETO, PENDIENTE DE RESOLUCIÓN";
const MESES_HABER = [
  { label: "Enero", value: "enero" },
  { label: "Febrero", value: "febrero" },
  { label: "Marzo", value: "marzo" },
  { label: "Abril", value: "abril" },
  { label: "Mayo", value: "mayo" },
  { label: "Junio", value: "junio" },
  { label: "Julio", value: "julio" },
  { label: "Agosto", value: "agosto" },
  { label: "Septiembre", value: "septiembre" },
  { label: "Octubre", value: "octubre" },
  { label: "Noviembre", value: "noviembre" },
  { label: "Diciembre", value: "diciembre" },
];
const DEPENDENCIAS_GRUPOS = [
  {
    label: "Direcciones de Educación",
    items: [
      "Dirección de Educación Inicial",
      "Dirección de Educación Primaria",
      "Dirección de Educación Secundaria",
      "Dirección de Educación Rural",
      "Dirección de Educación Superior",
    ],
  },
  {
    label: "Educación de Jóvenes y Adultos",
    items: ["Primaria EDJA", "Secundaria EDJA"],
  },
  {
    label: "Nivel Secundario",
    items: ["Secundaria Común", "Secundaria Rural", "Secundaria EDJA"],
  },
  {
    label: "Nivel Superior",
    items: ["Nivel Superior"],
  },
  {
    label: "Educación Técnico Profesional",
    items: ["Técnica", "Agrotécnica", "Formación Profesional"],
  },
  {
    label: "Otras Modalidades",
    items: [
      "Educación Especial",
      "Educación Artística",
      "Educación Domiciliaria y Hospitalaria",
      "Educación en Contexto de Privación de la Libertad",
    ],
  },
  {
    label: "Administración",
    items: [
      "LEGAL Y TECNICA",
      "JURIDICO",
      "SUMARIO",
      "Dirección de Educación Inicial",
      "Dirección de Educación Primaria",
      "Dirección de Educación Secundaria",
      "Dirección de Educación Rural",
      "Liquidación de haberes",
      "Dirección de Modalidades",
      "Sede Belén",
      "Sede Tinogasta",
    ],
  },
];

// Se conserva como referencia histórica de agrupación, pero los dropdowns usan
// DEPENDENCIA_OPCIONES_UNIFICADAS para evitar duplicados y nombres incompletos.
// eslint-disable-next-line no-unused-vars
const DEPENDENCIA_OPCIONES = DEPENDENCIAS_GRUPOS
  .filter((grupo) => !/^Nivel\s+/i.test(grupo.label))
  .map((grupo) => ({
    label: grupo.label,
    items: grupo.items
      .filter(
        (item) =>
          grupo.label !== "AdministraciÃ³n" ||
          !/^DirecciÃ³n de EducaciÃ³n/i.test(item)
      )
      .map((item) => ({ label: item, value: item })),
  }))
  .filter((grupo) => grupo.items.length > 0);

const DEPENDENCIA_OPCIONES_UNIFICADAS = [
  {
    label: "Direcciones de Educación",
    items: [
      "Dirección de Educación Inicial",
      "Dirección de Educación Primaria",
      "Dirección de Educación Secundaria",
      "Dirección de Educación Rural",
      "Dirección de Educación Superior",
    ].map((item) => ({ label: item, value: item })),
  },
  {
    label: "Educación de Jóvenes y Adultos",
    items: ["Primaria EDJA", "Secundaria EDJA"].map((item) => ({
      label: item,
      value: item,
    })),
  },
  {
    label: "Educación Técnico Profesional",
    items: ["Técnica", "Agrotécnica", "Formación Profesional"].map((item) => ({
      label: item,
      value: item,
    })),
  },
  {
    label: "Otras Modalidades",
    items: [
      "Educación Especial",
      "Educación Artística",
      "Educación Domiciliaria y Hospitalaria",
      "Educación en Contexto de Privación de la Libertad",
    ].map((item) => ({ label: item, value: item })),
  },
  {
    label: "Administración",
    items: [
      "LEGAL Y TECNICA",
      "JURIDICO",
      "SUMARIO",
      "Liquidación de haberes",
      "Dirección de Modalidades",
      "Sede Belén",
      "Sede Tinogasta",
    ].map((item) => ({ label: item, value: item })),
  },
];

const PERMISO_LABELS_RESUMEN = {
  ver: "Ver",
  agregarObservaciones: "Observaciones",
  cambiarEstado: "Cambiar estado",
  exportarExcel: "Exportar Excel",
  importarExcel: "Importar Excel",
  eliminar: "Eliminar",
};

const TIPO_MOVIMIENTO_LABELS = {
  observacion: "Observación",
  edicion_expediente: "Edición",
  cambio_dependencia: "Cambio de dependencia",
  cambio_estado_sueldo: "Cambio de estado de sueldo",
  importacion_excel: "Importación Excel",
  creacion_expediente: "Creación de expediente",
  finalizacion_expediente: "Finalización del expediente",
};

const estadoLabels = {
  ALTA_DE_SERVICIO: "Alta de servicio",
  RECLAMO: "Reclamo",
  DEUDA: "Deuda",
  VARIOS: "Varios",
  SOLICITUD: "Solicitud",
};

const estadoSeverity = {
  ALTA_DE_SERVICIO: "success",
  RECLAMO: "warning",
  DEUDA: "danger",
  VARIOS: "info",
  SOLICITUD: "info",
};

const estadoSueldoLabels = {
  ACTIVO: "Activo",
  INACTIVO: "Inactivo",
};

const estadoSueldoSeverity = {
  ACTIVO: "success",
  INACTIVO: "danger",
};

const CIRCUITO_ADMINISTRATIVO_FILTROS = {
  COMPLETO_PENDIENTE: "Completo / pendiente de resolución",
  EXPEDIENTE_FINALIZADO: "Completo / Expediente finalizado",
};

const permisosAdmin = {
  ver: true,
  agregarObservaciones: true,
  cambiarEstado: true,
  exportarExcel: true,
  importarExcel: true,
  eliminar: true,
};

const normalizarDni = (valor) => String(valor || "").replace(/\D/g, "");
const limpiarTexto = (valor) => String(valor || "").trim().replace(/\s+/g, " ");
const iniciales = (valor) => {
  const partes = limpiarTexto(valor).split(/[\s,]+/).filter(Boolean);
  if (partes.length === 0) return "?";
  if (partes.length === 1) return partes[0].slice(0, 2).toUpperCase();
  return (partes[0][0] + partes[1][0]).toUpperCase();
};
const slug = (valor) =>
  limpiarTexto(valor)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
const quitarAcentos = (valor) =>
  String(valor || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
const normalizarClave = (valor) =>
  quitarAcentos(valor).toLowerCase().replace(/[^a-z0-9]/g, "");
const nombreHojaExcel = (valor, fallback = "Resultado filtrado") => {
  const nombre = limpiarTexto(valor)
    .replace(/[\\/?*[\]:]/g, " ")
    .slice(0, 31)
    .trim();
  return nombre || fallback;
};
const tieneCircuitoAdministrativoCompleto = (item) =>
  quitarAcentos(limpiarTexto(item?.observacionActual))
    .toUpperCase()
    .includes("CIRCUITO ADMINISTRATIVO COMPLETO");
const obtenerCircuitoAdministrativo = (item) => {
  if (item?.finalizado) return "EXPEDIENTE_FINALIZADO";
  if (tieneCircuitoAdministrativoCompleto(item)) return "COMPLETO_PENDIENTE";
  return "";
};

const normalizarNivelFiltro = (valor) => {
  const texto = limpiarTexto(valor);
  const clave = quitarAcentos(texto).toUpperCase();
  if (clave === "SECUNDARIO" || clave === "SECUNDARIA") return "SECUNDARIA";
  return texto || "Sin definir";
};

const leerUsuarioSession = () => {
  try {
    return JSON.parse(sessionStorage.getItem("user") || "null");
  } catch {
    return null;
  }
};

const obtenerDniUsuario = (userRedux) => {
  const userSession = leerUsuarioSession();
  return normalizarDni(
    userRedux?.dni ||
      userRedux?.profile?.dni ||
      userSession?.dni ||
      localStorage.getItem("sidca_user_dni")
  );
};

const construirNombreUsuario = (datos = {}, fallback = "Usuario sin nombre registrado") => {
  const nombreCompleto =
    datos.apellidoNombre ||
    [datos.apellido, datos.nombre].filter(Boolean).join(", ") ||
    datos.nombreCompleto ||
    datos.displayName;

  return nombreCompleto || fallback;
};

const tienePermisoExpedienteSueldo = (delegado) =>
  delegado?.habilitado === true &&
  delegado?.herramientas?.expedienteSueldo?.habilitado === true &&
  delegado?.herramientas?.expedienteSueldo?.permisos?.ver === true;

const obtenerPermisos = (modo, delegado) => {
  if (modo === "admin") return permisosAdmin;
  return {
    ver: !!delegado?.herramientas?.expedienteSueldo?.permisos?.ver,
    agregarObservaciones:
      !!delegado?.herramientas?.expedienteSueldo?.permisos
        ?.agregarObservaciones,
    cambiarEstado:
      !!delegado?.herramientas?.expedienteSueldo?.permisos?.cambiarEstado,
    exportarExcel:
      !!delegado?.herramientas?.expedienteSueldo?.permisos?.exportarExcel,
    importarExcel:
      !!delegado?.herramientas?.expedienteSueldo?.permisos?.importarExcel,
    eliminar:
      !!delegado?.herramientas?.expedienteSueldo?.permisos?.eliminar,
  };
};

const obtenerCampo = (data, campos) => {
  for (const campo of campos) {
    if (data?.[campo] !== undefined && data?.[campo] !== null) return data[campo];
  }
  return "";
};

const normalizarPersona = (snap, origen) => {
  const data = snap?.data?.() || {};
  const apellido = limpiarTexto(
    obtenerCampo(data, ["apellido", "Apellido", "apellidos", "Apellidos"])
  );
  const nombre = limpiarTexto(
    obtenerCampo(data, ["nombre", "Nombre", "nombres", "Nombres"])
  );
  const apellidoNombre = limpiarTexto(
    obtenerCampo(data, [
      "apellidoNombre",
      "ApellidoNombre",
      "apellido_nombre",
      "nombreCompleto",
      "NombreCompleto",
    ])
  );

  return {
    id: snap.id,
    apellido,
    nombre,
    apellidoNombre:
      apellidoNombre || [apellido, nombre].filter(Boolean).join(", "),
    email: limpiarTexto(obtenerCampo(data, ["email", "correo", "mail", "Email", "Correo", "Mail"])),
    telefono: limpiarTexto(
      obtenerCampo(data, [
        "celular",
        "Celular",
        "telefono",
        "Telefono",
        "tel",
        "Tel",
        "telefonoContacto",
        "TelefonoContacto",
        "whatsapp",
        "Whatsapp",
      ])
    ),
    departamento: limpiarTexto(
      obtenerCampo(data, ["departamento", "Departamento", "depto", "Depto"])
    ),
    nivel: limpiarTexto(obtenerCampo(data, ["nivel", "Nivel"])),
    afiliacion: limpiarTexto(
      obtenerCampo(data, ["afiliacion", "Afiliacion", "afiliación", "Afiliación"])
    ),
    titulo: limpiarTexto(
      obtenerCampo(data, [
        "titulo",
        "Titulo",
        "título",
        "Título",
        "tituloGrado",
        "titulo_de_grado",
      ])
    ),
    descuento: limpiarTexto(obtenerCampo(data, ["descuento", "Descuento"])),
    establecimiento: limpiarTexto(
      obtenerCampo(data, [
        "establecimiento",
        "Establecimiento",
        "establecimientos",
        "Establecimientos",
      ])
    ),
    mesa: limpiarTexto(
      obtenerCampo(data, ["mesa", "Mesa", "mesaN", "mesaNumero", "mesa_n"])
    ),
    lugarVotacion: limpiarTexto(
      obtenerCampo(data, [
        "lugarVotacion",
        "LugarVotacion",
        "lugar_votacion",
        "lugar de votacion",
        "lugar de votación",
      ])
    ),
    observaciones: limpiarTexto(
      obtenerCampo(data, ["observaciones", "Observaciones", "observacion", "Observacion"])
    ),
    adherente: obtenerCampo(data, ["adherente", "Adherente"]),
    origen,
  };
};

const buscarPersonaEnColeccion = async (coleccion, dni) => {
  const directo = await getDoc(doc(db, coleccion, dni));
  if (directo.exists()) return normalizarPersona(directo, coleccion);

  const campos = ["dni", "DNI", "documento", "Documento", "cuil", "CUIL"];
  for (const campo of campos) {
    try {
      const snap = await getDocs(
        query(collection(db, coleccion), where(campo, "==", dni), limit(1))
      );
      if (!snap.empty) return normalizarPersona(snap.docs[0], coleccion);
      const dniNumero = Number(dni);
      if (!Number.isNaN(dniNumero)) {
        const snapNumero = await getDocs(
          query(collection(db, coleccion), where(campo, "==", dniNumero), limit(1))
        );
        if (!snapNumero.empty) return normalizarPersona(snapNumero.docs[0], coleccion);
      }
    } catch {
      // Continuar con variantes de campos sin indice.
    }
  }

  return null;
};

const buscarPersonaApp = async (dni) => {
  if (!dni) return { persona: null, registradoApp: false, origenApp: "no_registrado" };
  const [usuarios, nuevoAfiliado] = await Promise.all([
    buscarPersonaEnColeccion("usuarios", dni),
    buscarPersonaEnColeccion("nuevoAfiliado", dni),
  ]);
  const persona =
    usuarios && nuevoAfiliado
      ? {
          ...nuevoAfiliado,
          ...usuarios,
          telefono: usuarios.telefono || nuevoAfiliado.telefono || "",
          email: usuarios.email || nuevoAfiliado.email || "",
          departamento: usuarios.departamento || nuevoAfiliado.departamento || "",
          origen: "usuarios",
        }
      : usuarios || nuevoAfiliado;
  return {
    persona,
    registradoApp: !!persona,
    origenApp:
      usuarios && nuevoAfiliado
        ? "ambos"
        : nuevoAfiliado
        ? "nuevoAfiliado"
        : usuarios
        ? "usuarios"
        : "no_registrado",
  };
};

const completarExpedienteConPersona = (expediente, personaApp, origenApp) => {
  if (!personaApp) return expediente;

  return {
    ...expediente,
    apellido: personaApp.apellido || expediente.apellido || "",
    nombre: personaApp.nombre || expediente.nombre || "",
    apellidoNombre:
      personaApp.apellidoNombre || expediente.apellidoNombre || "",
    telefono: personaApp.telefono || expediente.telefono || "",
    email: personaApp.email || expediente.email || "",
    departamento: personaApp.departamento || expediente.departamento || "",
    nivel: personaApp.nivel || expediente.nivel || "",
    afiliacion: personaApp.afiliacion || expediente.afiliacion || "",
    titulo: personaApp.titulo || expediente.titulo || "",
    descuento: personaApp.descuento || expediente.descuento || "",
    establecimiento:
      personaApp.establecimiento || expediente.establecimiento || "",
    mesa: personaApp.mesa || expediente.mesa || "",
    lugarVotacion: personaApp.lugarVotacion || expediente.lugarVotacion || "",
    observacionesPersonales:
      personaApp.observaciones || expediente.observacionesPersonales || "",
    adherente:
      personaApp.adherente !== undefined && personaApp.adherente !== null
        ? personaApp.adherente
        : expediente.adherente,
    registradoApp: true,
    origenApp: origenApp || personaApp.origen || expediente.origenApp || "",
    datosPersonalesOrigen:
      origenApp || personaApp.origen || expediente.datosPersonalesOrigen || "",
  };
};

const normalizarEstado = (valor) => {
  const texto = quitarAcentos(limpiarTexto(valor)).toUpperCase();
  if (/RECLAMO/.test(texto)) return "RECLAMO";
  if (/DEUDA/.test(texto)) return "DEUDA";
  if (/VARIOS?/.test(texto)) return "VARIOS";
  if (/SOLICITUD|PEDIDO/.test(texto)) return "SOLICITUD";
  if (/ALTA|SERVICIO/.test(texto)) return "ALTA_DE_SERVICIO";
  if (ESTADOS.includes(texto)) return texto;
  return "ALTA_DE_SERVICIO";
};

const normalizarEstadoSueldo = (valor) => {
  const texto = quitarAcentos(limpiarTexto(valor)).toUpperCase();
  if (/INACTIVO|BAJA|NO ACTIVO/.test(texto)) return "INACTIVO";
  if (/ACTIVO|ALTA/.test(texto)) return "ACTIVO";
  return "";
};

const normalizarDependencia = (valor) => {
  const texto = quitarAcentos(limpiarTexto(valor)).toUpperCase();
  if (!texto) return "";

  if (/LEGAL/.test(texto)) return "LEGAL Y TECNICA";
  if (/JURIDIC/.test(texto)) return "JURIDICO";
  if (/SUMARIO/.test(texto)) return "SUMARIO";
  if (/INICIAL/.test(texto)) return "Dirección de Educación Inicial";
  if (/PRIMAR/.test(texto)) {
    if (/EDJA/.test(texto)) return "Primaria EDJA";
    return "Dirección de Educación Primaria";
  }
  if (/SECUNDAR/.test(texto)) {
    if (/RURAL/.test(texto)) return "Dirección de Educación Rural";
    if (/EDJA/.test(texto)) return "Secundaria EDJA";
    return "Dirección de Educación Secundaria";
  }
  if (/SUPERIOR/.test(texto)) return "Dirección de Educación Superior";
  if (/DIR|DIRECCION/.test(texto) && /EDUC/.test(texto) && /INICIAL/.test(texto)) {
    return "Dirección de Educación Inicial";
  }
  if (/DIR|DIRECCION/.test(texto) && /EDUC/.test(texto) && /PRIM/.test(texto)) {
    return "Dirección de Educación Primaria";
  }
  if (/DIR|DIRECCION/.test(texto) && /EDUC/.test(texto) && /RURAL/.test(texto)) {
    return "Dirección de Educación Rural";
  }
  if (/DIR|DIRECCION/.test(texto) && /EDUC/.test(texto) && /SEC/.test(texto)) {
    return "Dirección de Educación Secundaria";
  }
  if (/LIQUIDACION|HABERES/.test(texto)) return "Liquidación de haberes";
  if (/DIRECCION.*MODALIDAD|MODALIDADES/.test(texto)) return "Dirección de Modalidades";
  if (/SEDE.*BELEN|BELEN/.test(texto)) return "Sede Belén";
  if (/SEDE.*TINOGASTA|TINOGASTA/.test(texto)) return "Sede Tinogasta";

  if (/INICIAL/.test(texto)) return "DirecciÃ³n de EducaciÃ³n Inicial";

  if (/PRIMAR/.test(texto)) {
    if (/EDJA/.test(texto)) return "Primaria EDJA";
    return "DirecciÃ³n de EducaciÃ³n Primaria";
  }

  if (/SECUNDAR/.test(texto)) {
    if (/RURAL/.test(texto)) return "DirecciÃ³n de EducaciÃ³n Rural";
    if (/EDJA/.test(texto)) return "Secundaria EDJA";
    return "Secundaria Común";
  }

  if (/AGROTECNICA|AGROTECNICO/.test(texto)) return "Agrotécnica";
  if (/FORMACION PROFESIONAL/.test(texto)) return "Formación Profesional";
  if (/TECNIC/.test(texto)) return "Técnica";

  if (/ESPECIAL/.test(texto)) return "Educación Especial";
  if (/ARTISTIC/.test(texto)) return "Educación Artística";
  if (/DOMICILIARI|HOSPITALARI/.test(texto)) return "Educación Domiciliaria y Hospitalaria";
  if (/PRIVACION|CONTEXTO/.test(texto)) return "Educación en Contexto de Privación de la Libertad";

  return limpiarTexto(valor);
};

const parseFechaExcel = (valor) => {
  if (!valor) return "";
  if (valor instanceof Date && !Number.isNaN(valor.getTime())) {
    return valor.toISOString().slice(0, 10);
  }
  if (typeof valor === "number") {
    const parsed = XLSX.SSF.parse_date_code(valor);
    if (parsed) {
      return `${parsed.y}-${String(parsed.m).padStart(2, "0")}-${String(parsed.d).padStart(2, "0")}`;
    }
  }
  const texto = limpiarTexto(valor);
  const match = texto.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})$/);
  if (match) {
    const anio = match[3].length === 2 ? `20${match[3]}` : match[3];
    return `${anio}-${String(match[2]).padStart(2, "0")}-${String(match[1]).padStart(2, "0")}`;
  }
  const fecha = new Date(texto);
  return Number.isNaN(fecha.getTime()) ? texto : fecha.toISOString().slice(0, 10);
};

const fechaHoraTexto = (valor) => {
  const fecha = valor?.toDate?.() || (valor ? new Date(valor) : null);
  if (!fecha || Number.isNaN(fecha.getTime())) return "-";
  return new Intl.DateTimeFormat("es-AR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(fecha);
};

const mesTexto = (periodo) => {
  const [anio, mes] = String(periodo || "").split("-").map(Number);
  if (!anio || !mes) return periodo || "Sin fecha";
  return new Intl.DateTimeFormat("es-AR", {
    month: "long",
    year: "numeric",
  }).format(new Date(anio, mes - 1, 1));
};

const obtenerMesLabel = (value) =>
  MESES_HABER.find((mes) => mes.value === value)?.label.toLowerCase() || value || "";

const WHATSAPP_SINDICATO = "+54 9 383 423-0813";

const normalizarTelefonoWhatsapp = (value) => {
  let digits = String(value || "").replace(/\D/g, "");

  if (!digits) return "";

  if (digits.startsWith("00")) digits = digits.slice(2);
  if (digits.startsWith("0")) digits = digits.slice(1);

  if (digits.startsWith("54")) {
    if (!digits.startsWith("549") && digits.length >= 12) {
      digits = `549${digits.slice(2)}`;
    }
    return digits;
  }

  if (digits.length === 10) return `549${digits}`;
  if (digits.length === 11 && digits.startsWith("15")) return `549${digits.slice(2)}`;

  return digits;
};

const abrirWhatsapp = ({ telefono, mensaje }) => {
  const phone = normalizarTelefonoWhatsapp(telefono);
  if (!phone || !mensaje) return false;

  const url = `https://wa.me/${phone}?text=${encodeURIComponent(mensaje)}`;
  window.open(url, "_blank", "noopener,noreferrer");
  return true;
};

const obtenerMesCobroSiguiente = (value) => {
  const index = MESES_HABER.findIndex((mes) => mes.value === value);
  if (index < 0) return "";
  return MESES_HABER[(index + 1) % MESES_HABER.length].value;
};

const ESTADOS_CIERRE_CON_OBSERVACION = ["SOLICITUD", "RECLAMO", "VARIOS"];

const construirMensajeFinalizacion = ({
  afiliado,
  expediente,
  haberMes,
  cobroMes,
  estado,
  observacion,
}) => {
  if (ESTADOS_CIERRE_CON_OBSERVACION.includes(estado)) {
    return construirMensajeCierreConObservacion({
      afiliado,
      expediente,
      observacion,
    });
  }

  return construirMensajeCierreExpediente({ afiliado, expediente, haberMes, cobroMes });
};

const construirMensajeCierreConObservacion = ({ afiliado, expediente, observacion }) => {
  const nombre = afiliado || "Docente";
  const estadoTexto = "Finalizado";
  const expedienteTexto = limpiarTexto(expediente)
    ? ` N° ${limpiarTexto(expediente)}`
    : "";
  const observacionTexto = limpiarTexto(observacion) || "Sin observación cargada.";

  return (
    `Estimado/a docente ${nombre}:\n\n` +
    `Le informamos que su expediente${expedienteTexto} se encuentra actualmente en estado ${estadoTexto}.\n\n` +
    "Observación:\n" +
    `${observacionTexto}\n\n` +
    "Desde el Sindicato de Docentes de Catamarca quedamos a disposición para acompañarlo/a ante cualquier consulta o novedad.\n\n" +
    "Saludos cordiales."
  );
};

const construirMensajeCierreExpediente = ({ afiliado, expediente, haberMes, cobroMes }) => {
  const nombre = afiliado || "Docente";
  const expedienteTexto = limpiarTexto(expediente)
    ? ` N° ${limpiarTexto(expediente)}`
    : "";
  const haber = obtenerMesLabel(haberMes) || "julio";
  const cobro = obtenerMesLabel(cobroMes) || "agosto";

  return (
    `Estimado/a docente ${nombre}, le informamos que su expediente${expedienteTexto} se encuentra finalizado ` +
    `y que percibirá el haber correspondiente al mes de ${haber}, a cobrar en ${cobro}.\n\n` +
    "Desde el Sindicato de Docentes de Catamarca quedamos a disposición para acompañarlo/a ante cualquier consulta.\n\n" +
    "Saludos cordiales."
  );
};

const mapaColumnas = {
  orden: ["orden"],
  apellidoNombre: ["apellidoynombres", "apellidoynombre", "nombrecompleto"],
  dni: ["dni", "dni", "documento"],
  expediente: ["nexpediente", "nroexpediente", "expediente", "numeroexpediente"],
  fechaInicio: ["fechadeinicio", "fecha"],
  dependencia: ["dependencia", "escuela"],
  departamento: ["departamento"],
  nivel: ["nivel"],
  estado: ["estado"],
  estadoSueldo: ["estadodesueldo", "situaciondesueldo"],
  observacion: ["observacion", "observaciones"],
};

const detectarHeader = (filas) => {
  let mejor = { index: 0, score: 0, indices: {} };
  filas.slice(0, 6).forEach((fila, index) => {
    const normalizadas = (fila || []).map(normalizarClave);
    const indices = {};
    let score = 0;
    Object.entries(mapaColumnas).forEach(([campo, variantes]) => {
      const colIndex = normalizadas.findIndex((item) => variantes.includes(item));
      if (colIndex >= 0) {
        indices[campo] = colIndex;
        score += 1;
      }
    });
    if (score > mejor.score) mejor = { index, score, indices };
  });
  return mejor;
};

// El DNI ya es el segmento padre del path (expedientes/sueldo/registros/{dni}/expedientes/{id}),
// así que el id del expediente no necesita repetirlo.
const generarExpedienteId = ({ expediente, fila }) => {
  const expSlug = slug(expediente);
  if (expSlug) return expSlug;
  return `sin-expediente-${fila}`;
};

const refExpediente = (dni, expedienteId) =>
  doc(db, "expedientes", "sueldo", "registros", dni, "expedientes", expedienteId);

const refMovimientos = (dni, expedienteId) =>
  collection(
    db,
    "expedientes",
    "sueldo",
    "registros",
    dni,
    "expedientes",
    expedienteId,
    "movimientos"
  );

const AccesoDenegado = ({ dni }) => (
  <section className={styles.deniedCard}>
    <div className={styles.deniedIcon}>
      <i className="pi pi-lock" />
    </div>
    <div>
      <span>Acceso denegado</span>
      <h2>No tenés permisos para Gestión Delegados</h2>
      <p>
        Tu usuario {dni ? `DNI ${dni}` : ""} no está habilitado para acceder a
        la herramienta Expediente de sueldo. Si corresponde, solicitá la
        autorización administrativa.
      </p>
    </div>
  </section>
);

const GestionDelegados = ({ modo = "delegado" }) => {
  const toast = useRef(null);
  const fileRef = useRef(null);
  const userRedux = useSelector((state) => state.user);
  const [loading, setLoading] = useState(modo === "delegado");
  const [delegado, setDelegado] = useState(null);
  const [accesoPermitido, setAccesoPermitido] = useState(modo === "admin");
  const [error, setError] = useState("");

  const [expedientes, setExpedientes] = useState([]);
  const [loadingExpedientes, setLoadingExpedientes] = useState(false);
  const [importando, setImportando] = useState(false);
  const [progresoImport, setProgresoImport] = useState({ actual: 0, total: 0 });
  const [noRegistradosImport, setNoRegistradosImport] = useState([]);
  const [visibleNoRegistrados, setVisibleNoRegistrados] = useState(false);
  const [filtroTexto, setFiltroTexto] = useState("");
  const [filtroEstado, setFiltroEstado] = useState("");
  const [filtroEstadoSueldo, setFiltroEstadoSueldo] = useState("");
  const [filtroCircuitoAdministrativo, setFiltroCircuitoAdministrativo] = useState("");
  const [filtroDimension, setFiltroDimension] = useState("");
  const [filtroValor, setFiltroValor] = useState("");
  const [afiliadoSeleccionadoDni, setAfiliadoSeleccionadoDni] = useState(null);
  const [seleccionado, setSeleccionado] = useState(null);
  const [visibleDetalle, setVisibleDetalle] = useState(false);
  const [visibleObs, setVisibleObs] = useState(false);
  const [visibleEstado, setVisibleEstado] = useState(false);
  const [visibleFinalizar, setVisibleFinalizar] = useState(false);
  const [visibleHistorial, setVisibleHistorial] = useState(false);
  const [visibleEditarTelefono, setVisibleEditarTelefono] = useState(false);
  const [telefonoEdicion, setTelefonoEdicion] = useState("");
  const [guardandoTelefono, setGuardandoTelefono] = useState(false);
  const [observacion, setObservacion] = useState("");
  const [formEdicion, setFormEdicion] = useState({});
  const [mesHaberFinalizar, setMesHaberFinalizar] = useState("");
  const [historial, setHistorial] = useState([]);
  const [loadingHistorial, setLoadingHistorial] = useState(false);

  const [visibleNuevo, setVisibleNuevo] = useState(false);
  const [formNuevo, setFormNuevo] = useState({});
  const [personaNuevo, setPersonaNuevo] = useState(null);
  const [validandoDni, setValidandoDni] = useState(false);
  const [errorDniNuevo, setErrorDniNuevo] = useState("");
  const [guardandoNuevo, setGuardandoNuevo] = useState(false);
  const [finalizandoExpediente, setFinalizandoExpediente] = useState(false);
  const [mostrarHerramientas, setMostrarHerramientas] = useState(false);
  const [mostrarFiltrosMobile, setMostrarFiltrosMobile] = useState(false);
  const [visibleDuplicados, setVisibleDuplicados] = useState(false);
  const [exportando, setExportando] = useState(false);
  const [visibleExportar, setVisibleExportar] = useState(false);
  const dependenciasExport = [];
  const estadosSueldoExport = [];
  const textoExport = "";
  const estadoExport = "";
  const dimensionExport = "";
  const valorExport = "";
  const opcionesValorExport = [];
  const setDependenciasExport = () => {};
  const setEstadosSueldoExport = () => {};
  const setTextoExport = () => {};
  const setEstadoExport = () => {};
  const setDimensionExport = () => {};
  const setValorExport = () => {};

  const dniUsuario = useMemo(() => obtenerDniUsuario(userRedux), [userRedux]);
  const usuarioMovimiento = useMemo(() => {
    const session = leerUsuarioSession();
    // En modo delegado el nombre debe venir del registro de delegadosAutorizados,
    // no del perfil genérico de la sesión.
    const datosNombre =
      modo === "delegado" ? delegado || {} : userRedux?.profile || session || {};
    return {
      usuarioUid: session?.uid || userRedux?.uid || userRedux?.profile?.id || "",
      usuarioDni: dniUsuario,
      usuarioNombre: construirNombreUsuario(
        datosNombre,
        modo === "admin" ? "Usuario administrador" : "Usuario sin nombre registrado"
      ),
    };
  }, [dniUsuario, userRedux, modo, delegado]);

  const permisos = useMemo(
    () => obtenerPermisos(modo, delegado),
    [modo, delegado]
  );

  const cargarExpedientes = useCallback(async () => {
    if (!permisos.ver) return;
    setLoadingExpedientes(true);
    try {
      // Los expedientes viven en subcolecciones por DNI: registros/{dni}/expedientes/{id}.
      // collectionGroup junta todas esas subcolecciones llamadas "expedientes".
      const snap = await getDocs(
        query(collectionGroup(db, "expedientes"), orderBy("apellidoNombre", "asc"))
      );
      const personaCache = new Map();
      const expedientesBase = await Promise.all(
        snap.docs.map(async (item) => {
          const data = item.data();
          const dni = normalizarDni(data.dni || item.ref.parent.parent?.id || "");

          if (dni && !personaCache.has(dni)) {
            personaCache.set(dni, buscarPersonaApp(dni));
          }

          const resultadoPersona = dni ? await personaCache.get(dni) : null;
          const expediente = {
            id: item.id,
            ...data,
            dni: dni || data.dni || "",
            dependencia:
              normalizarDependencia(data.dependencia) ||
              limpiarTexto(data.dependencia),
          };

          return completarExpedienteConPersona(
            expediente,
            resultadoPersona?.persona,
            resultadoPersona?.origenApp
          );
        })
      );

      setExpedientes(expedientesBase);
    } catch (err) {
      console.error("[GestionDelegados] cargar expedientes:", err);
      toast.current?.show({
        severity: "error",
        summary: "Error",
        detail: "No se pudieron cargar los expedientes.",
      });
    } finally {
      setLoadingExpedientes(false);
    }
  }, [permisos.ver]);

  useEffect(() => {
    let cancelado = false;

    const validarDelegado = async () => {
      if (modo !== "delegado") {
        setAccesoPermitido(true);
        setLoading(false);
        return;
      }
      setLoading(true);
      setError("");
      if (!dniUsuario) {
        setDelegado(null);
        setAccesoPermitido(false);
        setLoading(false);
        setError("No se pudo identificar el DNI del usuario logueado.");
        return;
      }
      try {
        const snap = await getDoc(doc(db, "delegadosAutorizados", dniUsuario));
        const data = snap.exists() ? { id: snap.id, ...snap.data() } : null;
        if (cancelado) return;
        setDelegado(data);
        setAccesoPermitido(tienePermisoExpedienteSueldo(data));
      } catch (err) {
        console.error("[GestionDelegados] Error validando delegado:", err);
        if (!cancelado) {
          setDelegado(null);
          setAccesoPermitido(false);
          setError("No se pudo validar la autorización del delegado.");
        }
      } finally {
        if (!cancelado) setLoading(false);
      }
    };

    validarDelegado();
    return () => {
      cancelado = true;
    };
  }, [dniUsuario, modo]);

  useEffect(() => {
    if (accesoPermitido && permisos.ver) cargarExpedientes();
  }, [accesoPermitido, cargarExpedientes, permisos.ver]);

  const datosResumen = modo === "admin" ? userRedux?.profile || {} : delegado || {};

  // Duplicados: mismo DNI + mismo N° de expediente repetido, o registros
  // generados por el bug viejo (id "sin-expediente-N" por fila de Excel movida).
  const duplicados = useMemo(() => {
    const porClave = new Map();
    expedientes.forEach((item) => {
      const clave = `${item.dni}|${limpiarTexto(item.expediente).toLowerCase()}`;
      if (!porClave.has(clave)) porClave.set(clave, []);
      porClave.get(clave).push(item);
    });
    const exactos = Array.from(porClave.values()).filter((grupo) => grupo.length > 1);
    const legacy = expedientes.filter((item) => String(item.id).startsWith("sin-expediente-"));
    return { exactos, legacy };
  }, [expedientes]);

  const totalDuplicados = duplicados.exactos.reduce((acc, g) => acc + g.length, 0) + duplicados.legacy.length;

  const expedientesFiltrados = useMemo(() => {
    const texto = limpiarTexto(filtroTexto).toLowerCase();
    const dniFiltro = normalizarDni(filtroTexto);
    return expedientes.filter((item) => {
      if (filtroEstado && item.estado !== filtroEstado) return false;
      if (
        filtroEstadoSueldo &&
        (item.estadoSueldo || "SIN_DEFINIR") !== filtroEstadoSueldo
      ) return false;
      if (
        filtroCircuitoAdministrativo &&
        obtenerCircuitoAdministrativo(item) !== filtroCircuitoAdministrativo
      ) return false;
      if (
        filtroValor && filtroDimension === "estadoSueldo" &&
        (item.estadoSueldo || "SIN_DEFINIR") !== filtroValor
      ) return false;
      if (
        filtroValor && filtroDimension === "finalizacion" &&
        (item.finalizado ? "FINALIZADO" : "EN_TRAMITE") !== filtroValor
      ) return false;
      if (
        filtroValor &&
        filtroDimension === "circuitoAdministrativo" &&
        obtenerCircuitoAdministrativo(item) !== filtroValor
      ) return false;
      if (filtroValor && filtroDimension === "dependencia" && item.dependencia !== filtroValor) return false;
      if (filtroValor && filtroDimension === "departamento" && item.departamento !== filtroValor) return false;
      if (
        filtroValor &&
        filtroDimension === "nivel" &&
        normalizarNivelFiltro(item.nivel) !== filtroValor
      ) return false;
      if (
        filtroValor && filtroDimension === "fechaInicio" &&
        String(item.fechaInicio || "").slice(0, 7) !== filtroValor
      ) return false;
      if (
        filtroValor && filtroDimension === "fechaSueldoActivo" &&
        (item.estadoSueldo !== "ACTIVO" ||
          String(item.fechaInicio || "").slice(0, 7) !== filtroValor)
      ) return false;
      if (!texto && !dniFiltro) return true;
      const hayTexto = `${item.apellidoNombre || ""} ${item.apellido || ""} ${
        item.nombre || ""
      } ${item.expediente || ""} ${item.dependencia || ""} ${
        item.departamento || ""
      } ${item.nivel || ""} ${item.estadoSueldo || ""} ${
        item.observacionActual || ""
      }`.toLowerCase();
      const dni = normalizarDni(item.dni);
      return (
        (dniFiltro && dni.includes(dniFiltro)) || (texto && hayTexto.includes(texto))
      );
    });
  }, [
    expedientes,
    filtroDimension,
    filtroCircuitoAdministrativo,
    filtroEstado,
    filtroEstadoSueldo,
    filtroTexto,
    filtroValor,
  ]);

  const opcionesFiltroDimension = [
    { label: "Sin filtro adicional", value: "" },
    { label: "Estado del trámite", value: "finalizacion" },
    { label: "Por dependencia", value: "dependencia" },
    { label: "Por departamento", value: "departamento" },
    { label: "Por nivel", value: "nivel" },
    { label: "Expedientes por fecha de inicio (mes)", value: "fechaInicio" },
    {
      label: "Expedientes por fecha de sueldo activo",
      value: "fechaSueldoActivo",
    },
  ];

  const opcionesFiltroValor = useMemo(() => {
    if (!filtroDimension) return [];

    const valores = new Set();
    expedientes.forEach((item) => {
      if (filtroDimension === "estadoSueldo") {
        valores.add(item.estadoSueldo || "SIN_DEFINIR");
      } else if (filtroDimension === "finalizacion") {
        valores.add(item.finalizado ? "FINALIZADO" : "EN_TRAMITE");
      } else if (filtroDimension === "circuitoAdministrativo") {
        const circuito = obtenerCircuitoAdministrativo(item);
        if (circuito) valores.add(circuito);
      } else if (filtroDimension === "dependencia" && item.dependencia) {
        valores.add(item.dependencia);
      } else if (filtroDimension === "departamento" && item.departamento) {
        valores.add(item.departamento);
      } else if (filtroDimension === "nivel") {
        valores.add(normalizarNivelFiltro(item.nivel));
      } else if (filtroDimension === "fechaInicio") {
        const periodo = String(item.fechaInicio || "").slice(0, 7);
        if (periodo.length === 7) valores.add(periodo);
      } else if (
        filtroDimension === "fechaSueldoActivo" &&
        item.estadoSueldo === "ACTIVO"
      ) {
        const periodo = String(item.fechaInicio || "").slice(0, 7);
        if (periodo.length === 7) valores.add(periodo);
      }
    });

    const opciones = Array.from(valores)
      .sort()
      .map((value) => ({
        value,
        label:
          filtroDimension === "estadoSueldo"
            ? value === "SIN_DEFINIR"
              ? "Sin definir"
              : estadoSueldoLabels[value] || value
            : filtroDimension === "circuitoAdministrativo"
            ? CIRCUITO_ADMINISTRATIVO_FILTROS[value] || value
            : filtroDimension === "finalizacion"
            ? value === "FINALIZADO"
              ? "Finalizados"
              : "En trámite"
            : filtroDimension === "fechaInicio" ||
              filtroDimension === "fechaSueldoActivo"
            ? mesTexto(value)
            : value,
      }));

    return [{ label: "Todos", value: "" }, ...opciones];
  }, [expedientes, filtroDimension]);

  const reiniciarPagina = async () => {
    setFiltroTexto("");
    setFiltroEstado("");
    setFiltroEstadoSueldo("");
    setFiltroCircuitoAdministrativo("");
    setFiltroDimension("");
    setFiltroValor("");
    setAfiliadoSeleccionadoDni("");
    await cargarExpedientes();
  };

  const dependenciasDisponibles = useMemo(() => {
    const set = new Set();
    expedientes.forEach((item) => {
      if (item.dependencia) set.add(item.dependencia);
    });
    return Array.from(set)
      .sort()
      .map((d) => ({ label: d, value: d }));
  }, [expedientes]);

  const estadosSueldoDisponibles = useMemo(() => {
    const set = new Set();
    expedientes.forEach((item) => {
      set.add(item.estadoSueldo || "SIN_DEFINIR");
    });
    return Array.from(set)
      .sort()
      .map((v) => ({
        label: v === "SIN_DEFINIR" ? "Sin definir" : estadoSueldoLabels[v] || v,
        value: v,
      }));
  }, [expedientes]);

  const circuitosAdministrativosDisponibles = useMemo(
    () => [
      {
        label: CIRCUITO_ADMINISTRATIVO_FILTROS.COMPLETO_PENDIENTE,
        value: "COMPLETO_PENDIENTE",
      },
      {
        label: CIRCUITO_ADMINISTRATIVO_FILTROS.EXPEDIENTE_FINALIZADO,
        value: "EXPEDIENTE_FINALIZADO",
      },
    ],
    []
  );

  const afiliadosFiltrados = useMemo(() => {
    const mapa = new Map();
    expedientesFiltrados.forEach((item) => {
      const key = item.dni || "sin-dni";
      if (!mapa.has(key)) {
        mapa.set(key, {
          dni: item.dni,
          apellidoNombre: item.apellidoNombre,
          telefono: item.telefono || "",
          email: item.email || "",
          departamento: item.departamento || "",
          afiliacion: item.afiliacion || "",
          titulo: item.titulo || "",
          descuento: item.descuento || "",
          establecimiento: item.establecimiento || "",
          mesa: item.mesa || "",
          lugarVotacion: item.lugarVotacion || "",
          observacionesPersonales: item.observacionesPersonales || "",
          adherente: item.adherente,
          origenApp: item.origenApp || "",
          expedientes: [],
        });
      }
      const grupo = mapa.get(key);
      if (!grupo.telefono && item.telefono) grupo.telefono = item.telefono;
      if (!grupo.email && item.email) grupo.email = item.email;
      if (!grupo.departamento && item.departamento) grupo.departamento = item.departamento;
      if (!grupo.afiliacion && item.afiliacion) grupo.afiliacion = item.afiliacion;
      if (!grupo.titulo && item.titulo) grupo.titulo = item.titulo;
      if (!grupo.descuento && item.descuento) grupo.descuento = item.descuento;
      if (!grupo.establecimiento && item.establecimiento) grupo.establecimiento = item.establecimiento;
      if (!grupo.mesa && item.mesa) grupo.mesa = item.mesa;
      if (!grupo.lugarVotacion && item.lugarVotacion) grupo.lugarVotacion = item.lugarVotacion;
      if (!grupo.observacionesPersonales && item.observacionesPersonales) {
        grupo.observacionesPersonales = item.observacionesPersonales;
      }
      if (grupo.adherente === undefined && item.adherente !== undefined) {
        grupo.adherente = item.adherente;
      }
      if (!grupo.origenApp && item.origenApp) grupo.origenApp = item.origenApp;
      grupo.expedientes.push(item);
    });
    return Array.from(mapa.values()).sort((a, b) =>
      (a.apellidoNombre || "").localeCompare(b.apellidoNombre || "")
    );
  }, [expedientesFiltrados]);

  // Sin selección explícita no mostramos ningún afiliado por defecto:
  // el panel derecho muestra el dashboard general hasta que el usuario elija uno.
  const afiliadoActivo = useMemo(() => {
    if (!afiliadoSeleccionadoDni) return null;
    return afiliadosFiltrados.find((a) => a.dni === afiliadoSeleccionadoDni) || null;
  }, [afiliadosFiltrados, afiliadoSeleccionadoDni]);

  const resumen = useMemo(() => {
    const base = ESTADOS.reduce(
      (acc, estado) => {
        acc[estado] = 0;
        return acc;
      },
      {
        total: expedientes.length,
        noRegistrados: 0,
      }
    );
    expedientes.forEach((item) => {
      base[item.estado] = Number(base[item.estado] || 0) + 1;
      if (!item.registradoApp) base.noRegistrados += 1;
    });
    return base;
  }, [expedientes]);

  const registrarMovimiento = async ({
    expediente,
    tipo,
    observacion: obs,
    estadoAnterior,
    estadoNuevo: nuevo,
    dependenciaAnterior,
    dependenciaNueva,
    estadoSueldoAnterior,
    estadoSueldoNuevo,
  }) => {
    await addDoc(
      refMovimientos(expediente.dni, expediente.id),
      {
        tipo,
        observacion: obs || "",
        estadoAnterior: estadoAnterior || "",
        estadoNuevo: nuevo || "",
        dependenciaAnterior: dependenciaAnterior || "",
        dependenciaNueva: dependenciaNueva || "",
        estadoSueldoAnterior: estadoSueldoAnterior || "",
        estadoSueldoNuevo: estadoSueldoNuevo || "",
        fecha: serverTimestamp(),
        ...usuarioMovimiento,
      }
    );
  };

  const importarExcel = async (archivo) => {
    if (!archivo || !permisos.importarExcel) return;
    setImportando(true);
    setNoRegistradosImport([]);
    try {
      const buffer = await archivo.arrayBuffer();
      const workbook = XLSX.read(buffer, { type: "array", cellDates: true });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const filas = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "" });
      const header = detectarHeader(filas);
      if (header.score < 3) {
        throw new Error("No se detectaron encabezados válidos en el Excel.");
      }

      const filasValidas = [];
      for (let i = header.index + 1; i < filas.length; i += 1) {
        const fila = filas[i] || [];
        if (!fila.every((celda) => limpiarTexto(celda) === "")) {
          filasValidas.push(i);
        }
      }
      setProgresoImport({ actual: 0, total: filasValidas.length });

      const loteId = `lote-${Date.now()}`;
      const loteRef = doc(db, "expedientes", "sueldo", "lotes", loteId);
      await setDoc(loteRef, {
        loteId,
        archivoNombre: archivo.name,
        totalFilas: filasValidas.length,
        createdAt: serverTimestamp(),
        createdBy: usuarioMovimiento,
      });

      let procesados = 0;
      let registrados = 0;
      let filaActual = 0;
      const errores = [];
      const noRegistrados = [];
      let ultimoDniValido = "";
      let ultimoApellidoNombreValido = "";

      for (let i = header.index + 1; i < filas.length; i += 1) {
        const fila = filas[i] || [];
        if (fila.every((celda) => limpiarTexto(celda) === "")) continue;
        filaActual += 1;
        setProgresoImport({ actual: filaActual, total: filasValidas.length });
        const valor = (campo) => fila[header.indices[campo]] ?? "";
        const dniExcel = normalizarDni(valor("dni"));
        const expediente = limpiarTexto(valor("expediente"));
        const dni = dniExcel || (expediente ? ultimoDniValido : "");

        // Fila sin DNI: no hay forma de validar contra la colección, se omite.
        if (!dni) {
          errores.push(`Fila ${i + 1}: sin DNI, se omitió.`);
          continue;
        }

        const apellidoNombreExcel =
          limpiarTexto(valor("apellidoNombre")) || ultimoApellidoNombreValido;

        // Algunos Excel agrupan varios expedientes bajo un mismo afiliado y dejan
        // DNI/nombre vacíos en las filas siguientes. Si la fila trae expediente,
        // se toma el último DNI válido anterior para no perder esos registros.
        if (dniExcel) {
          ultimoDniValido = dniExcel;
          ultimoApellidoNombreValido = apellidoNombreExcel;
        }

        // Sin N° de expediente no hay forma estable de identificar el registro
        // entre distintas importaciones (la fila puede moverse y generar duplicados
        // huérfanos con datos viejos). Se omite igual que una fila sin DNI.
        if (!expediente) {
          errores.push(`Fila ${i + 1}: sin N° de expediente, se omitió (DNI ${dni}).`);
          continue;
        }

        const estado = normalizarEstado(valor("estado"));
        const estadoSueldo = normalizarEstadoSueldo(valor("estadoSueldo"));
        const expedienteId = generarExpedienteId({
          expediente,
          fila: i + 1,
        });
        try {
          const { persona, registradoApp, origenApp } = await buscarPersonaApp(dni);

          // DNI no validado en usuarios/nuevoAfiliado: no se carga el expediente.
          if (!registradoApp) {
            noRegistrados.push({
              dni,
              apellidoNombre: apellidoNombreExcel || "Sin nombre en Excel",
              dependencia: limpiarTexto(valor("dependencia")),
            });
            continue;
          }
          registrados += 1;

          const ref = refExpediente(dni, expedienteId);
          const anterior = await getDoc(ref);
          const anteriorData = anterior.exists() ? anterior.data() : {};
          const payload = {
            expedienteId,
            loteId,
            orden: limpiarTexto(valor("orden")),
            dni,
            apellido: persona.apellido,
            nombre: persona.nombre,
            apellidoNombre: persona.apellidoNombre,
            telefono: persona.telefono || "",
            expediente,
            fechaInicio: parseFechaExcel(valor("fechaInicio")),
            dependencia: normalizarDependencia(valor("dependencia")),
            departamento: persona.departamento || limpiarTexto(valor("departamento")),
            nivel: persona.nivel || limpiarTexto(valor("nivel")),
            estado,
            estadoExcel: limpiarTexto(valor("estado")),
            estadoSueldo,
            estadoSueldoExcel: limpiarTexto(valor("estadoSueldo")),
            registradoApp,
            origenApp,
            observacionActual:
              limpiarTexto(valor("observacion")) || anteriorData.observacionActual || "",
            updatedAt: serverTimestamp(),
            updatedBy: usuarioMovimiento,
          };
          if (!anterior.exists()) {
            payload.createdAt = serverTimestamp();
            payload.createdBy = usuarioMovimiento;
          }
          await setDoc(ref, payload, { merge: true });
          await registrarMovimiento({
            expediente: { id: expedienteId, dni },
            tipo: "importacion_excel",
            observacion: `Importado desde ${archivo.name}`,
            estadoAnterior: anteriorData.estado || "",
            estadoNuevo: estado,
          });
          procesados += 1;
        } catch (err) {
          errores.push(`Fila ${i + 1}: ${err.message}`);
        }
      }

      await setDoc(
        loteRef,
        {
          procesados,
          registradosApp: registrados,
          noRegistradosApp: noRegistrados.length,
          errores,
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );

      setNoRegistradosImport(noRegistrados);
      if (noRegistrados.length > 0) setVisibleNoRegistrados(true);

      toast.current?.show({
        severity: errores.length ? "warn" : "success",
        summary: "Importación finalizada",
        detail: `Procesados: ${procesados}. Errores: ${errores.length}.`,
        life: 7000,
      });
      await cargarExpedientes();
    } catch (err) {
      console.error("[GestionDelegados] importar excel:", err);
      toast.current?.show({
        severity: "error",
        summary: "No se pudo importar",
        detail: err.message || "Error al procesar el Excel.",
      });
    } finally {
      setImportando(false);
      setProgresoImport({ actual: 0, total: 0 });
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const abrirObservacion = (item) => {
    setSeleccionado(item);
    setObservacion("");
    setVisibleObs(true);
  };

  const guardarObservacion = async () => {
    if (!seleccionado || !permisos.agregarObservaciones) return;
    await updateDoc(refExpediente(seleccionado.dni, seleccionado.id), {
      observacionActual: limpiarTexto(observacion),
      updatedAt: serverTimestamp(),
      updatedBy: usuarioMovimiento,
    });
    await registrarMovimiento({
      expediente: seleccionado,
      tipo: "observacion",
      observacion,
      estadoAnterior: seleccionado.estado,
      estadoNuevo: seleccionado.estado,
    });
    setVisibleObs(false);
    await cargarExpedientes();
  };

  const abrirCambioEstado = (item) => {
    setSeleccionado(item);
    setFormEdicion({
      departamento: item.departamento || "",
      nivel: item.nivel || "",
      dependencia: item.dependencia || "",
      estado: item.estado || "ALTA_DE_SERVICIO",
      estadoSueldo: item.estadoSueldo || "",
      observacionActual: item.observacionActual || "",
    });
    setMesHaberFinalizar(item.haberFinalizacionMes || "");
    setVisibleEstado(true);
  };

  const guardarEstado = async () => {
    if (!seleccionado || !permisos.cambiarEstado) return;
    const payload = {
      departamento: limpiarTexto(formEdicion.departamento),
      nivel: limpiarTexto(formEdicion.nivel),
      dependencia: formEdicion.dependencia || "",
      estado: formEdicion.estado || "ALTA_DE_SERVICIO",
      estadoSueldo: formEdicion.estadoSueldo || "",
      observacionActual: limpiarTexto(formEdicion.observacionActual),
      updatedAt: serverTimestamp(),
      updatedBy: usuarioMovimiento,
    };
    await updateDoc(refExpediente(seleccionado.dni, seleccionado.id), {
      ...payload,
    });
    const cambioDependencia = (seleccionado.dependencia || "") !== payload.dependencia;
    const cambioEstadoSueldo = (seleccionado.estadoSueldo || "") !== payload.estadoSueldo;
    const tipo = cambioDependencia
      ? "cambio_dependencia"
      : cambioEstadoSueldo
      ? "cambio_estado_sueldo"
      : "edicion_expediente";
    await registrarMovimiento({
      expediente: seleccionado,
      tipo,
      observacion: payload.observacionActual,
      estadoAnterior: seleccionado.estado,
      estadoNuevo: payload.estado,
      dependenciaAnterior: seleccionado.dependencia,
      dependenciaNueva: payload.dependencia,
      estadoSueldoAnterior: seleccionado.estadoSueldo,
      estadoSueldoNuevo: payload.estadoSueldo,
    });
    setVisibleEstado(false);
    await cargarExpedientes();
  };

  const abrirEditarTelefono = () => {
    if (!afiliadoActivo) return;
    setTelefonoEdicion(afiliadoActivo.telefono || "");
    setVisibleEditarTelefono(true);
  };

  const guardarTelefonoAfiliado = async () => {
    if (!afiliadoActivo?.dni || guardandoTelefono) return;

    const telefonoLimpio = limpiarTexto(telefonoEdicion);
    if (!telefonoLimpio) {
      window.alert("Ingresá un número de celular.");
      return;
    }

    setGuardandoTelefono(true);
    try {
      await Promise.all(
        (afiliadoActivo.expedientes || []).map((exp) =>
          updateDoc(refExpediente(afiliadoActivo.dni, exp.id), {
            telefono: telefonoLimpio,
            celularEditadoManual: true,
            updatedAt: serverTimestamp(),
            updatedBy: usuarioMovimiento,
          })
        )
      );

      setExpedientes((actuales) =>
        actuales.map((exp) =>
          exp.dni === afiliadoActivo.dni
            ? {
                ...exp,
                telefono: telefonoLimpio,
                celularEditadoManual: true,
              }
            : exp
        )
      );

      if (seleccionado?.dni === afiliadoActivo.dni) {
        setSeleccionado((actual) =>
          actual
            ? {
                ...actual,
                telefono: telefonoLimpio,
                celularEditadoManual: true,
              }
            : actual
        );
      }

      toast.current?.show({
        severity: "success",
        summary: "Celular actualizado",
        detail: `Se guardó el celular ${telefonoLimpio} para ${afiliadoActivo.apellidoNombre || "el afiliado"}.`,
      });
      setVisibleEditarTelefono(false);
    } catch (err) {
      console.error("[GestionDelegados] guardar telefono:", err);
      toast.current?.show({
        severity: "error",
        summary: "No se pudo guardar",
        detail: "El celular no fue actualizado. Intentá nuevamente.",
      });
    } finally {
      setGuardandoTelefono(false);
    }
  };

  const abrirFinalizarExpediente = () => {
    if (!seleccionado || seleccionado.finalizado || finalizandoExpediente) return;
    setMesHaberFinalizar(seleccionado.haberFinalizacionMes || "");
    setVisibleFinalizar(true);
  };

  const finalizarExpediente = async () => {
    if (!seleccionado || !permisos.cambiarEstado || seleccionado.finalizado) return;
    const haberFinalizacionMes = mesHaberFinalizar || "";
    const cobroFinalizacionMes = obtenerMesCobroSiguiente(haberFinalizacionMes);
    const estadoFinalizacion = formEdicion.estado || seleccionado.estado;
    const requiereMesHaber =
      !ESTADOS_CIERRE_CON_OBSERVACION.includes(estadoFinalizacion);

    if (requiereMesHaber && !haberFinalizacionMes) {
      window.alert("Seleccioná el mes de haber antes de finalizar el expediente.");
      return;
    }

    const mensajeFinalizacion = construirMensajeFinalizacion({
      afiliado: seleccionado.apellidoNombre,
      expediente: seleccionado.expediente,
      haberMes: haberFinalizacionMes,
      cobroMes: cobroFinalizacionMes,
      estado: estadoFinalizacion,
      observacion:
        formEdicion.observacionActual || seleccionado.observacionActual || "",
    });
    const telefonoDestino = seleccionado.telefono || afiliadoActivo?.telefono || "";
    setFinalizandoExpediente(true);
    try {
      const payloadEdicion = {
        departamento: limpiarTexto(formEdicion.departamento),
        nivel: limpiarTexto(formEdicion.nivel),
        dependencia: formEdicion.dependencia || "",
        estado: formEdicion.estado || "ALTA_DE_SERVICIO",
        estadoSueldo: formEdicion.estadoSueldo || "",
      };
      await updateDoc(refExpediente(seleccionado.dni, seleccionado.id), {
        ...payloadEdicion,
        observacionActual: mensajeFinalizacion,
        finalizado: true,
        mensajeFinalizacion,
        whatsappEmisor: WHATSAPP_SINDICATO,
        whatsappDestino: normalizarTelefonoWhatsapp(telefonoDestino),
        haberFinalizacionMes,
        cobroFinalizacionMes,
        fechaFinalizacion: serverTimestamp(),
        finalizadoPor: usuarioMovimiento,
        updatedAt: serverTimestamp(),
        updatedBy: usuarioMovimiento,
      });
      await registrarMovimiento({
        expediente: seleccionado,
        tipo: "finalizacion_expediente",
        observacion: mensajeFinalizacion,
        estadoAnterior: seleccionado.estado,
        estadoNuevo: payloadEdicion.estado,
        dependenciaAnterior: seleccionado.dependencia,
        dependenciaNueva: payloadEdicion.dependencia,
        estadoSueldoAnterior: seleccionado.estadoSueldo,
        estadoSueldoNuevo: payloadEdicion.estadoSueldo,
      });
      const whatsappAbierto = abrirWhatsapp({
        telefono: telefonoDestino,
        mensaje: mensajeFinalizacion,
      });
      toast.current?.show({
        severity: whatsappAbierto ? "success" : "warn",
        summary: "Expediente finalizado",
        detail: `Se finalizó el trámite de ${seleccionado.apellidoNombre || "el afiliado"}.`,
      });
      if (!whatsappAbierto) {
        toast.current?.show({
          severity: "warn",
          summary: "WhatsApp no enviado",
          detail: "No se encontró un teléfono válido del afiliado para abrir el mensaje.",
        });
      }
      setVisibleFinalizar(false);
      setVisibleEstado(false);
      await cargarExpedientes();
    } catch (err) {
      console.error("[GestionDelegados] finalizar expediente:", err);
      toast.current?.show({
        severity: "error",
        summary: "No se pudo finalizar",
        detail: "El expediente no fue modificado. Intentá nuevamente.",
      });
    } finally {
      setFinalizandoExpediente(false);
    }
  };

  const handleEliminar = async (item) => {
    if (!permisos.eliminar) return;
    const confirmar = window.confirm(
      `¿Eliminar el expediente de "${item.apellidoNombre}" (DNI ${item.dni})?\n\nEsta acción no se puede deshacer.`
    );
    if (!confirmar) return;
    try {
      // Borrar primero el historial (subcolección movimientos) y luego el expediente.
      const movSnap = await getDocs(refMovimientos(item.dni, item.id));
      await Promise.all(movSnap.docs.map((m) => deleteDoc(m.ref)));
      await deleteDoc(refExpediente(item.dni, item.id));
      toast.current?.show({
        severity: "success",
        summary: "Expediente eliminado",
        detail: `Se eliminó el expediente de ${item.apellidoNombre}.`,
      });
      await cargarExpedientes();
    } catch (err) {
      console.error("[GestionDelegados] eliminar expediente:", err);
      toast.current?.show({
        severity: "error",
        summary: "Error",
        detail: "No se pudo eliminar el expediente.",
      });
    }
  };

  const abrirNuevoExpediente = () => {
    setFormNuevo({
      dni: "",
      expediente: "",
      fechaInicio: "",
      dependencia: "",
      estado: "ALTA_DE_SERVICIO",
      estadoSueldo: "",
      observacionActual: "",
    });
    setPersonaNuevo(null);
    setErrorDniNuevo("");
    setVisibleNuevo(true);
  };

  const validarDniNuevo = async () => {
    const dni = normalizarDni(formNuevo.dni);
    if (!dni) {
      setErrorDniNuevo("Ingresá un DNI válido.");
      return;
    }
    setValidandoDni(true);
    setErrorDniNuevo("");
    setPersonaNuevo(null);
    try {
      const { persona, registradoApp, origenApp } = await buscarPersonaApp(dni);
      if (!registradoApp) {
        setErrorDniNuevo(
          "Ese DNI no se encontró en usuarios ni nuevoAfiliado. No se puede crear el expediente."
        );
        return;
      }
      setPersonaNuevo({ ...persona, origenApp });
    } catch (err) {
      console.error("[GestionDelegados] validar dni:", err);
      setErrorDniNuevo("No se pudo validar el DNI. Intentalo nuevamente.");
    } finally {
      setValidandoDni(false);
    }
  };

  const guardarNuevoExpediente = async () => {
    if (!permisos.cambiarEstado || !personaNuevo) return;
    const dni = normalizarDni(formNuevo.dni);
    if (!dni) return;
    setGuardandoNuevo(true);
    try {
      const expedienteId = generarExpedienteId({
        expediente: formNuevo.expediente,
        fila: Date.now(),
      });
      const ref = refExpediente(dni, expedienteId);
      const existente = await getDoc(ref);
      if (existente.exists()) {
        toast.current?.show({
          severity: "warn",
          summary: "Expediente duplicado",
          detail: "Ya existe un expediente con ese número para este DNI.",
        });
        return;
      }
      const estado = formNuevo.estado || "ALTA_DE_SERVICIO";
      await setDoc(ref, {
        expedienteId,
        dni,
        apellido: personaNuevo.apellido,
        nombre: personaNuevo.nombre,
        apellidoNombre: personaNuevo.apellidoNombre,
        telefono: personaNuevo.telefono || "",
        expediente: limpiarTexto(formNuevo.expediente),
        fechaInicio: formNuevo.fechaInicio || "",
        dependencia: formNuevo.dependencia || "",
        departamento: personaNuevo.departamento || "",
        nivel: personaNuevo.nivel || "",
        estado,
        estadoSueldo: formNuevo.estadoSueldo || "",
        registradoApp: true,
        origenApp: personaNuevo.origenApp,
        observacionActual: limpiarTexto(formNuevo.observacionActual),
        createdAt: serverTimestamp(),
        createdBy: usuarioMovimiento,
        updatedAt: serverTimestamp(),
        updatedBy: usuarioMovimiento,
      });
      await registrarMovimiento({
        expediente: { id: expedienteId, dni },
        tipo: "creacion_expediente",
        observacion: limpiarTexto(formNuevo.observacionActual),
        estadoNuevo: estado,
        dependenciaNueva: formNuevo.dependencia,
      });
      toast.current?.show({
        severity: "success",
        summary: "Expediente creado",
        detail: `Se creó el expediente de ${personaNuevo.apellidoNombre}.`,
      });
      setVisibleNuevo(false);
      await cargarExpedientes();
    } catch (err) {
      console.error("[GestionDelegados] crear expediente:", err);
      toast.current?.show({
        severity: "error",
        summary: "Error",
        detail: "No se pudo crear el expediente.",
      });
    } finally {
      setGuardandoNuevo(false);
    }
  };

  const verHistorial = async (item) => {
    setSeleccionado(item);
    setVisibleHistorial(true);
    setLoadingHistorial(true);
    try {
      const snap = await getDocs(
        query(refMovimientos(item.dni, item.id), orderBy("fecha", "desc"))
      );
      setHistorial(snap.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() })));
    } catch (err) {
      console.error("[GestionDelegados] historial:", err);
      setHistorial([]);
    } finally {
      setLoadingHistorial(false);
    }
  };

  const abrirExportar = () => {
    if (!permisos.exportarExcel) return;
    setVisibleExportar(true);
  };

  const exportarExcel = () => {
    if (!permisos.exportarExcel) return;
    const datosBase = expedientesFiltrados;

    if (datosBase.length === 0) {
      toast.current?.show({
        severity: "warn",
        summary: "Nada para exportar",
        detail: "No hay expedientes que coincidan con la selección.",
      });
      return;
    }

    const filasBase = datosBase.map((item) => ({
      "Apellido y Nombres": item.apellidoNombre || [item.apellido, item.nombre].filter(Boolean).join(", "),
      DNI: item.dni || "",
      Departamento: item.departamento || "",
      Nivel: item.nivel || "",
      "N° expediente": item.expediente || "",
      "Fecha inicio": item.fechaInicio || "",
      Dependencia: item.dependencia || "",
      Estado: estadoLabels[item.estado] || item.estado || "",
      "Estado de sueldo": estadoSueldoLabels[item.estadoSueldo] || item.estadoSueldo || "",
      "Circuito administrativo":
        CIRCUITO_ADMINISTRATIVO_FILTROS[obtenerCircuitoAdministrativo(item)] ||
        "",
      "Trámite finalizado": item.finalizado ? "Sí" : "No",
      "Fecha finalización": item.finalizado ? fechaHoraTexto(item.fechaFinalizacion) : "",
      "Observación": item.observacionActual || "",
      "Registrado en app": item.registradoApp ? item.origenApp : "No",
      "Fecha carga": fechaHoraTexto(item.createdAt),
      "Última modificación": fechaHoraTexto(item.updatedAt),
    }));
    const wb = XLSX.utils.book_new();
    const addSheet = (name, rows) =>
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows), name);
    const resumenEstados = ESTADOS.map((estado) => {
      const label = estadoLabels[estado] || estado;
      return {
        Indicador: label,
        Valor: filasBase.filter((r) => r.Estado === label).length,
      };
    });
    const dimensionActiva =
      opcionesFiltroDimension.find((opt) => opt.value === filtroDimension)?.label ||
      "Sin filtro adicional";
    const valorActivo =
      opcionesFiltroValor.find((opt) => opt.value === filtroValor)?.label ||
      (filtroValor || "Todos");
    addSheet("Resumen", [
      { Indicador: "Total exportado", Valor: datosBase.length },
      { Indicador: "Búsqueda", Valor: filtroTexto || "Sin búsqueda" },
      { Indicador: "Estado", Valor: filtroEstado ? estadoLabels[filtroEstado] || filtroEstado : "Todos" },
      {
        Indicador: "Estado de sueldo",
        Valor: filtroEstadoSueldo
          ? filtroEstadoSueldo === "SIN_DEFINIR"
            ? "Sin definir"
            : estadoSueldoLabels[filtroEstadoSueldo] || filtroEstadoSueldo
          : "Todos",
      },
      {
        Indicador: "Circuito administrativo",
        Valor: filtroCircuitoAdministrativo
          ? CIRCUITO_ADMINISTRATIVO_FILTROS[filtroCircuitoAdministrativo] ||
            filtroCircuitoAdministrativo
          : "Todos",
      },
      { Indicador: "Filtro adicional", Valor: dimensionActiva },
      { Indicador: "Valor del filtro", Valor: filtroDimension ? valorActivo : "Todos" },
      ...resumenEstados,
      {
        Indicador: CIRCUITO_ADMINISTRATIVO_FILTROS.COMPLETO_PENDIENTE,
        Valor: filasBase.filter(
          (r) =>
            r["Circuito administrativo"] ===
            CIRCUITO_ADMINISTRATIVO_FILTROS.COMPLETO_PENDIENTE
        ).length,
      },
      {
        Indicador: CIRCUITO_ADMINISTRATIVO_FILTROS.EXPEDIENTE_FINALIZADO,
        Valor: filasBase.filter(
          (r) =>
            r["Circuito administrativo"] ===
            CIRCUITO_ADMINISTRATIVO_FILTROS.EXPEDIENTE_FINALIZADO
        ).length,
      },
      { Indicador: "No registrados en app", Valor: filasBase.filter((r) => r["Registrado en app"] === "No").length },
    ]);
    const filtroPrincipalHoja =
      filtroCircuitoAdministrativo
        ? CIRCUITO_ADMINISTRATIVO_FILTROS[filtroCircuitoAdministrativo]
        : filtroEstadoSueldo
        ? estadoSueldoLabels[filtroEstadoSueldo] || filtroEstadoSueldo
        : filtroDimension && valorActivo !== "Todos"
        ? valorActivo
        : "Resultado filtrado";
    const nombreHojaResultado = nombreHojaExcel(`Filtro ${filtroPrincipalHoja}`);
    addSheet(nombreHojaResultado, filasBase);
    const ahora = new Date();
    const fechaArchivo = `${ahora.getFullYear()}-${String(ahora.getMonth() + 1).padStart(2, "0")}-${String(ahora.getDate()).padStart(2, "0")}_${String(ahora.getHours()).padStart(2, "0")}${String(ahora.getMinutes()).padStart(2, "0")}`;
    XLSX.writeFile(wb, `expedientes_sueldo_${fechaArchivo}.xlsx`);

    toast.current?.show({
      severity: "success",
      summary: "Excel descargado",
      detail: `Se exportaron ${datosBase.length} expediente(s).`,
    });
  };

  const estadoBody = (row) => (
    <Tag value={estadoLabels[row.estado] || row.estado} severity={estadoSeverity[row.estado]} />
  );

  const estadoSueldoBody = (row) =>
    row.estadoSueldo ? (
      <Tag
        value={estadoSueldoLabels[row.estadoSueldo] || row.estadoSueldo}
        severity={estadoSueldoSeverity[row.estadoSueldo]}
      />
    ) : (
      "-"
    );

  const mesCobroFinalizar = obtenerMesCobroSiguiente(mesHaberFinalizar);
  const estadoFinalizacionPreview = formEdicion.estado || seleccionado?.estado;
  const requiereMesHaberPreview =
    !ESTADOS_CIERRE_CON_OBSERVACION.includes(estadoFinalizacionPreview);
  const puedePrevisualizarFinalizacion =
    !!seleccionado && (!requiereMesHaberPreview || !!mesHaberFinalizar);
  const mensajePreviewFinalizacion = puedePrevisualizarFinalizacion
    ? construirMensajeFinalizacion({
        afiliado: seleccionado?.apellidoNombre,
        expediente: seleccionado?.expediente,
        haberMes: mesHaberFinalizar,
        cobroMes: mesCobroFinalizar,
        estado: estadoFinalizacionPreview,
        observacion:
          formEdicion.observacionActual || seleccionado?.observacionActual || "",
      })
    : "";
  const dimensionFiltroActual =
    opcionesFiltroDimension.find((opt) => opt.value === filtroDimension)?.label ||
    "Sin filtro adicional";
  const valorFiltroActual =
    opcionesFiltroValor.find((opt) => opt.value === filtroValor)?.label ||
    (filtroValor || "Todos");

  if (loading) {
    return (
      <main className={styles.page}>
        <section className={styles.loadingBox}>
          <ProgressSpinner />
          <span>Validando autorización de delegado...</span>
        </section>
      </main>
    );
  }

  if (!accesoPermitido) {
    return (
      <main className={styles.page}>
        <AccesoDenegado dni={dniUsuario} />
        {error && <p className={styles.errorText}>{error}</p>}
      </main>
    );
  }

  return (
    <main className={styles.page}>
      <Toast ref={toast} />
      <header className={styles.hero}>
        <div>
          <span className={styles.eyebrow}>
            {modo === "admin" ? "Vista administrativa" : "Vista delegado"}
          </span>
          <h1>Gestión Delegados</h1>
          <p>
            Herramientas internas para delegados. Módulo activo: Expediente de
            sueldo.
          </p>
        </div>
      </header>

      <section className={styles.summaryBar}>
        <span className={styles.summaryItem}>
          <b>
            {construirNombreUsuario(
              datosResumen,
              modo === "admin" ? "Usuario administrador" : "Usuario sin nombre registrado"
            )}
          </b>
          <small>DNI {dniUsuario || datosResumen?.dni || "-"}</small>
        </span>
        <span className={styles.summaryDivider} />
        <span className={styles.summaryItem}>
          <b>{resumen.total} expedientes</b>
          <small>{resumen.noRegistrados} no registrados en app</small>
        </span>
        <span className={styles.summaryDivider} />
        <span className={styles.summaryItem}>
          <b>{modo === "admin" ? "Todos los permisos" : "Permisos de delegado"}</b>
          <small>
            {Object.entries(permisos)
              .filter(([, activo]) => activo)
              .map(([permiso]) => PERMISO_LABELS_RESUMEN[permiso] || permiso)
              .join(" · ")}
          </small>
        </span>
      </section>

      <section className={styles.toolsSection}>
        <div className={styles.sectionHeader}>
          <div>
            <span>Herramienta interna</span>
            <h2>Expediente de sueldo</h2>
          </div>
          <Button
            label={mostrarHerramientas ? "Ocultar acciones" : "Acciones"}
            icon={mostrarHerramientas ? "pi pi-chevron-up" : "pi pi-chevron-down"}
            className="p-button-text p-button-sm"
            onClick={() => setMostrarHerramientas((v) => !v)}
          />
        </div>

        {mostrarHerramientas && (
          <div className={styles.toolbar}>
            {permisos.cambiarEstado && (
              <Button
                label="Nuevo Expediente"
                icon="pi pi-plus"
                onClick={abrirNuevoExpediente}
              />
            )}
            {permisos.importarExcel && (
              <>
                <input
                  ref={fileRef}
                  type="file"
                  accept=".xlsx,.xls"
                  hidden
                  onChange={(e) => importarExcel(e.target.files?.[0])}
                />
                <Button
                  label="Subir Excel"
                  icon="pi pi-upload"
                  onClick={() => fileRef.current?.click()}
                  loading={importando}
                />
              </>
            )}
            {permisos.exportarExcel && (
              <Button
                label="Exportar Excel"
                icon="pi pi-file-excel"
                className="p-button-success"
                onClick={abrirExportar}
                disabled={expedientesFiltrados.length === 0}
              />
            )}
            <Button
              label="Recargar"
              icon="pi pi-refresh"
              className="p-button-text"
              onClick={cargarExpedientes}
              loading={loadingExpedientes}
            />
            {permisos.eliminar && (
              <Button
                label={`Detectar duplicados${totalDuplicados > 0 ? ` (${totalDuplicados})` : ""}`}
                icon="pi pi-exclamation-triangle"
                className={totalDuplicados > 0 ? "p-button-warning" : "p-button-text"}
                onClick={() => setVisibleDuplicados(true)}
              />
            )}
          </div>
        )}

        {importando && (
          <div className={styles.progresoImport}>
            <ProgressBar
              value={
                progresoImport.total > 0
                  ? Math.round((progresoImport.actual / progresoImport.total) * 100)
                  : 0
              }
            />
            <small>
              Procesando {progresoImport.actual} de {progresoImport.total} registros...
            </small>
          </div>
        )}

        <div className={styles.filters}>
          <span className="p-input-icon-left">
            <i className="pi pi-search" />
            <InputText
              value={filtroTexto}
              onChange={(e) => setFiltroTexto(e.target.value)}
              placeholder="Buscar por DNI, nombre, expediente o dependencia"
            />
          </span>
          <Button
            label={mostrarFiltrosMobile ? "Ocultar filtros" : "Filtros"}
            icon={mostrarFiltrosMobile ? "pi pi-chevron-up" : "pi pi-sliders-h"}
            className={`${styles.filterToggleMobile} p-button-outlined`}
            onClick={() => setMostrarFiltrosMobile((prev) => !prev)}
            type="button"
          />
          <div
            className={`${styles.filterControls} ${
              mostrarFiltrosMobile ? styles.filterControlsOpen : ""
            }`}
          >
          <Dropdown
            value={filtroEstado}
            options={[
              { label: "Todos los estados", value: "" },
              ...ESTADOS.map((estado) => ({
                label: estadoLabels[estado],
                value: estado,
              })),
            ]}
            onChange={(e) => setFiltroEstado(e.value)}
            placeholder="Estado"
          />
          <Dropdown
            value={filtroEstadoSueldo}
            options={[
              { label: "Todos los sueldos", value: "" },
              ...estadosSueldoDisponibles,
            ]}
            onChange={(e) => setFiltroEstadoSueldo(e.value)}
            placeholder="Estado de sueldo"
            showClear
          />
          <Dropdown
            value={filtroCircuitoAdministrativo}
            options={[
              { label: "Todos los circuitos", value: "" },
              ...circuitosAdministrativosDisponibles,
            ]}
            onChange={(e) => setFiltroCircuitoAdministrativo(e.value)}
            placeholder="Circuito administrativo"
            showClear
          />
          <Dropdown
            value={filtroDimension}
            options={opcionesFiltroDimension}
            onChange={(e) => {
              setFiltroDimension(e.value);
              setFiltroValor("");
            }}
            placeholder="Filtrar por"
          />
          <Dropdown
            value={filtroValor}
            options={opcionesFiltroValor}
            onChange={(e) => setFiltroValor(e.value)}
            placeholder={filtroDimension ? "Seleccionar valor" : "Elegí un filtro"}
            disabled={!filtroDimension}
            filter={opcionesFiltroValor.length > 8}
            showClear
          />
          <Button
            label="Reiniciar página"
            icon="pi pi-refresh"
            className="p-button-outlined"
            onClick={reiniciarPagina}
            loading={loadingExpedientes}
          />
          </div>
        </div>

        {loadingExpedientes && <p className={styles.emptyText}>Cargando expedientes...</p>}

        {!loadingExpedientes && (
          <>
            <div className={styles.mobileResultSummary}>
              <span>
                <strong>{afiliadosFiltrados.length}</strong> afiliado(s)
              </span>
              <span>
                <strong>{expedientesFiltrados.length}</strong> expediente(s)
              </span>
              <span>
                {afiliadoActivo
                  ? `Seleccionado: ${afiliadoActivo.apellidoNombre || afiliadoActivo.dni}`
                  : "Seleccioná un afiliado para ver el detalle"}
              </span>
            </div>

            <div className={styles.masterDetailWrap}>
              <div className={styles.afiliadosList}>
                {afiliadosFiltrados.length === 0 && (
                  <p className={styles.emptyText}>No hay afiliados para mostrar.</p>
                )}
                {afiliadosFiltrados.map((afiliado) => (
                  <button
                    key={afiliado.dni}
                    type="button"
                    className={`${styles.afiliadoItem} ${
                      afiliadoActivo?.dni === afiliado.dni ? styles.afiliadoItemActivo : ""
                    }`}
                    onClick={() => setAfiliadoSeleccionadoDni(afiliado.dni)}
                  >
                    <span className={styles.afiliadoNombre}>
                      {afiliado.apellidoNombre || "Sin nombre"}
                    </span>
                    <span className={styles.afiliadoDni}>DNI {afiliado.dni || "-"}</span>
                    <span className={styles.afiliadoCount}>{afiliado.expedientes.length}</span>
                  </button>
                ))}
              </div>

              <div className={styles.expedientesPanel}>
              {!afiliadoActivo && (
                <>
                  <p className={styles.dashboardHint}>
                    Seleccioná un afiliado para ver sus expedientes. Mientras tanto,
                    estadísticas generales de {expedientesFiltrados.length} expediente(s):
                  </p>
                  <ExpedientesDashboard expedientes={expedientesFiltrados} />
                </>
              )}
              {afiliadoActivo && (
                <>
                  <div className={styles.expedientesPanelHeader}>
                    <h3>{afiliadoActivo.apellidoNombre || "Sin nombre"}</h3>
                    <span>DNI {afiliadoActivo.dni || "-"}</span>
                    <span
                      className={`${styles.afiliadoTelefono} ${
                        !afiliadoActivo.telefono ? styles.afiliadoTelefonoVacio : ""
                      }`}
                    >
                      <i className="pi pi-phone" />{" "}
                      {afiliadoActivo.telefono || "Sin teléfono registrado"}
                    </span>
                    <Button
                      type="button"
                      icon="pi pi-pencil"
                      className={`p-button-text p-button-sm ${styles.telefonoEditButton}`}
                      tooltip={
                        afiliadoActivo.telefono
                          ? "Editar celular"
                          : "Agregar celular"
                      }
                      onClick={abrirEditarTelefono}
                    />
                  </div>
                  <div className={styles.expedienteRowList}>
                    {afiliadoActivo.expedientes.map((exp) => (
                      <div
                        key={exp.id}
                        className={styles.expedienteRow}
                        onClick={() => {
                          setSeleccionado(exp);
                          setVisibleDetalle(true);
                        }}
                      >
                        <span className={styles.expedienteNumero}>
                          {exp.expediente ? `Exp. N° ${exp.expediente}` : "Sin número"}
                        </span>
                        <span className={styles.expedienteDep}>
                          {exp.dependencia || "-"}
                        </span>
                        {estadoBody(exp)}
                        {estadoSueldoBody(exp)}
                        {exp.finalizado && (
                          <Tag
                            value="Trámite finalizado"
                            severity="success"
                            icon="pi pi-check-circle"
                          />
                        )}
                      </div>
                    ))}
                  </div>
                </>
              )}
              </div>
            </div>
          </>
        )}
      </section>

      <Dialog
        header="Afiliados no registrados en la app"
        visible={visibleNoRegistrados}
        style={{ width: 620, maxWidth: "95vw" }}
        modal
        onHide={() => setVisibleNoRegistrados(false)}
      >
        <p className={styles.noRegistradosIntro}>
          Estos DNI del Excel no se encontraron en las colecciones{" "}
          <strong>usuarios</strong> ni <strong>nuevoAfiliado</strong>:
        </p>
        <div className={styles.noRegistradosList}>
          {noRegistradosImport.map((item, idx) => (
            <div key={`${item.dni}-${idx}`} className={styles.noRegistradosItem}>
              <span className={styles.noRegistradosDni}>{item.dni || "Sin DNI"}</span>
              <span className={styles.noRegistradosNombre}>
                {item.apellidoNombre || "Sin nombre"}
              </span>
              {item.dependencia && (
                <span className={styles.noRegistradosDep}>{item.dependencia}</span>
              )}
            </div>
          ))}
        </div>
      </Dialog>

      <Dialog
        header="Exportar Excel"
        visible={visibleExportar}
        style={{ width: 520, maxWidth: "95vw" }}
        modal
        onHide={() => setVisibleExportar(false)}
      >
        <div className={styles.exportForm}>
          <span className={styles.exportLabel}>Vista filtrada actual</span>
          <div className={styles.exportSummaryBox}>
            <div>
              <span>Registros a exportar</span>
              <strong>{expedientesFiltrados.length}</strong>
            </div>
            <div>
              <span>Búsqueda</span>
              <strong>{filtroTexto || "Sin búsqueda"}</strong>
            </div>
            <div>
              <span>Estado</span>
              <strong>{filtroEstado ? estadoLabels[filtroEstado] || filtroEstado : "Todos"}</strong>
            </div>
            <div>
              <span>Estado de sueldo</span>
              <strong>
                {filtroEstadoSueldo
                  ? filtroEstadoSueldo === "SIN_DEFINIR"
                    ? "Sin definir"
                    : estadoSueldoLabels[filtroEstadoSueldo] || filtroEstadoSueldo
                  : "Todos"}
              </strong>
            </div>
            <div>
              <span>Circuito administrativo</span>
              <strong>
                {filtroCircuitoAdministrativo
                  ? CIRCUITO_ADMINISTRATIVO_FILTROS[filtroCircuitoAdministrativo] ||
                    filtroCircuitoAdministrativo
                  : "Todos"}
              </strong>
            </div>
            <div>
              <span>Filtro adicional</span>
              <strong>{dimensionFiltroActual}</strong>
            </div>
            <div>
              <span>Valor</span>
              <strong>{filtroDimension ? valorFiltroActual : "Todos"}</strong>
            </div>
          </div>
          <p className={styles.helpTextExport}>
            El Excel se descargará exactamente con los expedientes que estás viendo en
            los gráficos y en el listado filtrado.
          </p>
        </div>
        <div className={styles.dialogActions}>
          <Button
            label="Exportar vista filtrada"
            icon="pi pi-file-excel"
            className="p-button-success"
            loading={exportando}
            disabled={expedientesFiltrados.length === 0}
            onClick={async () => {
              setExportando(true);
              await new Promise((r) => setTimeout(r, 0));
              try {
                exportarExcel();
                setVisibleExportar(false);
              } finally {
                setExportando(false);
              }
            }}
          />
        </div>
      </Dialog>

      <Dialog
        header="Exportar Excel"
        visible={false}
        style={{ width: 540, maxWidth: "95vw" }}
        modal
        onHide={() => setVisibleExportar(false)}
      >
        <div className={styles.exportForm}>
          <span className={styles.exportLabel}>Filtros de la exportación</span>
          <span className="p-input-icon-left">
            <i className="pi pi-search" />
            <InputText
              value={textoExport}
              onChange={(e) => setTextoExport(e.target.value)}
              placeholder="Buscar por DNI, nombre, expediente o dependencia"
              style={{ width: "100%" }}
            />
          </span>
          <Dropdown
            value={estadoExport}
            options={[
              { label: "Todos los estados", value: "" },
              ...ESTADOS.map((estado) => ({
                label: estadoLabels[estado],
                value: estado,
              })),
            ]}
            onChange={(e) => setEstadoExport(e.value)}
            placeholder="Estado"
            style={{ width: "100%" }}
          />
          <Dropdown
            value={dimensionExport}
            options={opcionesFiltroDimension}
            onChange={(e) => {
              setDimensionExport(e.value);
              setValorExport("");
            }}
            placeholder="Filtrar por"
            style={{ width: "100%" }}
          />
          <Dropdown
            value={valorExport}
            options={opcionesValorExport}
            onChange={(e) => setValorExport(e.value)}
            placeholder={dimensionExport ? "Seleccionar valor" : "Elegí un filtro"}
            disabled={!dimensionExport}
            filter={opcionesValorExport.length > 8}
            showClear
            style={{ width: "100%" }}
          />

          <div className={styles.exportHeaderRow}>
            <span className={styles.exportLabel}>Dependencias a incluir</span>
            {dependenciasDisponibles.length > 0 && (
              <div className={styles.exportQuickActions}>
                <button
                  type="button"
                  className={styles.exportQuickBtn}
                  onClick={() =>
                    setDependenciasExport(dependenciasDisponibles.map((d) => d.value))
                  }
                >
                  Seleccionar todas
                </button>
                <button
                  type="button"
                  className={styles.exportQuickBtn}
                  onClick={() => setDependenciasExport([])}
                >
                  Limpiar
                </button>
              </div>
            )}
          </div>

          {dependenciasDisponibles.length === 0 ? (
            <p className={styles.helpTextExport}>
              No hay dependencias cargadas en los expedientes filtrados.
            </p>
          ) : (
            <div className={styles.dependenciaCheckList}>
              {dependenciasDisponibles.map((dep) => {
                const marcada = dependenciasExport.includes(dep.value);
                return (
                  <div
                    key={dep.value}
                    className={`${styles.dependenciaCheckItem} ${
                      marcada ? styles.dependenciaCheckItemActivo : ""
                    }`}
                    onClick={() =>
                      setDependenciasExport((prev) =>
                        marcada
                          ? prev.filter((d) => d !== dep.value)
                          : [...prev, dep.value]
                      )
                    }
                  >
                    <input
                      type="checkbox"
                      checked={marcada}
                      readOnly
                      className={styles.dependenciaCheckInput}
                    />
                    <span className={styles.dependenciaCheckLabel}>{dep.label}</span>
                  </div>
                );
              })}
            </div>
          )}

          <small className={styles.helpTextExport}>
            {dependenciasExport.length === 0
              ? "Sin selección: se exportan todas las dependencias."
              : `${dependenciasExport.length} de ${dependenciasDisponibles.length} dependencia(s) seleccionada(s).`}
          </small>

          <div className={styles.exportHeaderRow}>
            <span className={styles.exportLabel}>Estado de sueldo a incluir</span>
            {estadosSueldoDisponibles.length > 0 && (
              <div className={styles.exportQuickActions}>
                <button
                  type="button"
                  className={styles.exportQuickBtn}
                  onClick={() =>
                    setEstadosSueldoExport(estadosSueldoDisponibles.map((e) => e.value))
                  }
                >
                  Seleccionar todos
                </button>
                <button
                  type="button"
                  className={styles.exportQuickBtn}
                  onClick={() => setEstadosSueldoExport([])}
                >
                  Limpiar
                </button>
              </div>
            )}
          </div>

          <div className={styles.dependenciaCheckList}>
            {estadosSueldoDisponibles.map((opt) => {
              const marcada = estadosSueldoExport.includes(opt.value);
              return (
                <div
                  key={opt.value}
                  className={`${styles.dependenciaCheckItem} ${
                    marcada ? styles.dependenciaCheckItemActivo : ""
                  }`}
                  onClick={() =>
                    setEstadosSueldoExport((prev) =>
                      marcada
                        ? prev.filter((v) => v !== opt.value)
                        : [...prev, opt.value]
                    )
                  }
                >
                  <input
                    type="checkbox"
                    checked={marcada}
                    readOnly
                    className={styles.dependenciaCheckInput}
                  />
                  <span className={styles.dependenciaCheckLabel}>{opt.label}</span>
                </div>
              );
            })}
          </div>

          <small className={styles.helpTextExport}>
            {estadosSueldoExport.length === 0
              ? "Sin selección: se exportan todos los estados de sueldo."
              : `${estadosSueldoExport.length} de ${estadosSueldoDisponibles.length} estado(s) seleccionado(s).`}
          </small>
        </div>
        <div className={styles.dialogActions}>
          <Button
            label="Exportar"
            icon="pi pi-file-excel"
            className="p-button-success"
            loading={exportando}
            onClick={async () => {
              setExportando(true);
              await new Promise((r) => setTimeout(r, 0));
              try {
                exportarExcel(dependenciasExport, estadosSueldoExport, {
                  textoFiltro: textoExport,
                  estado: estadoExport,
                  dimension: dimensionExport,
                  valor: valorExport,
                });
                setVisibleExportar(false);
              } finally {
                setExportando(false);
              }
            }}
          />
        </div>
      </Dialog>

      <Dialog
        header="Posibles duplicados"
        visible={visibleDuplicados}
        style={{ width: 720, maxWidth: "95vw" }}
        modal
        onHide={() => setVisibleDuplicados(false)}
      >
        {totalDuplicados === 0 ? (
          <p className={styles.emptyText}>No se detectaron duplicados.</p>
        ) : (
          <>
            {duplicados.exactos.length > 0 && (
              <div className={styles.duplicadosSeccion}>
                <h4>Mismo N° de expediente repetido para el mismo DNI</h4>
                {duplicados.exactos.map((grupo, idx) => (
                  <div key={idx} className={styles.duplicadosGrupo}>
                    {grupo.map((item) => (
                      <div key={item.id} className={styles.duplicadosItem}>
                        <div className={styles.duplicadosInfo}>
                          <strong>{item.apellidoNombre || "Sin nombre"}</strong>
                          <span>DNI {item.dni}</span>
                          <span>Exp. N° {item.expediente || "Sin número"}</span>
                          <span>Fecha inicio: {item.fechaInicio || "-"}</span>
                          <span>Estado: {estadoLabels[item.estado] || item.estado}</span>
                          <span>Creado: {fechaHoraTexto(item.createdAt)}</span>
                        </div>
                        <Button
                          label="Eliminar"
                          icon="pi pi-trash"
                          className="p-button-outlined p-button-sm p-button-danger"
                          onClick={() => handleEliminar(item)}
                        />
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            )}

            {duplicados.legacy.length > 0 && (
              <div className={styles.duplicadosSeccion}>
                <h4>Generados antes del fix (sin N° de expediente en el Excel original)</h4>
                <p className={styles.helpTextExport}>
                  Estos registros se crearon con un ID basado en la posición de fila del
                  Excel. Si volviste a importar el archivo después, puede haber quedado
                  un duplicado con datos viejos junto al actual. Revisá cuál conservar.
                </p>
                {duplicados.legacy.map((item) => (
                  <div key={item.id} className={styles.duplicadosItem}>
                    <div className={styles.duplicadosInfo}>
                      <strong>{item.apellidoNombre || "Sin nombre"}</strong>
                      <span>DNI {item.dni}</span>
                      <span>Exp. N° {item.expediente || "Sin número"}</span>
                      <span>Fecha inicio: {item.fechaInicio || "-"}</span>
                      <span>Estado: {estadoLabels[item.estado] || item.estado}</span>
                      <span>Creado: {fechaHoraTexto(item.createdAt)}</span>
                    </div>
                    <Button
                      label="Eliminar"
                      icon="pi pi-trash"
                      className="p-button-outlined p-button-sm p-button-danger"
                      onClick={() => handleEliminar(item)}
                    />
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </Dialog>

      <Dialog
        header="Nuevo expediente"
        visible={visibleNuevo}
        style={{ width: 620, maxWidth: "95vw" }}
        modal
        onHide={() => setVisibleNuevo(false)}
      >
        <div className={styles.stateDialog}>
          <label>
            <span>DNI del afiliado</span>
            <div className={styles.dniValidator}>
              <InputText
                value={formNuevo.dni || ""}
                onChange={(e) => {
                  setFormNuevo((prev) => ({ ...prev, dni: e.target.value }));
                  setPersonaNuevo(null);
                  setErrorDniNuevo("");
                }}
                placeholder="Ej: 30123456"
                className={styles.fullInput}
              />
              <Button
                label="Validar DNI"
                icon="pi pi-search"
                onClick={validarDniNuevo}
                loading={validandoDni}
                className="p-button-outlined"
              />
            </div>
            {errorDniNuevo && <small className={styles.errorText}>{errorDniNuevo}</small>}
            {personaNuevo && (
              <div className={styles.personaPreview}>
                <i className="pi pi-check-circle" />
                <div>
                  <strong>{personaNuevo.apellidoNombre}</strong>
                  <span>
                    {personaNuevo.departamento || "Sin departamento"} ·{" "}
                    {personaNuevo.nivel || "Sin nivel"}
                  </span>
                </div>
              </div>
            )}
          </label>

          {personaNuevo && (
            <>
              <label>
                <span>N° expediente</span>
                <InputText
                  value={formNuevo.expediente || ""}
                  onChange={(e) =>
                    setFormNuevo((prev) => ({ ...prev, expediente: e.target.value }))
                  }
                  className={styles.fullInput}
                  placeholder="Ej: 1234567/26"
                />
              </label>
              <label>
                <span>Fecha inicio</span>
                <InputText
                  type="date"
                  value={formNuevo.fechaInicio || ""}
                  onChange={(e) =>
                    setFormNuevo((prev) => ({ ...prev, fechaInicio: e.target.value }))
                  }
                  className={styles.fullInput}
                />
              </label>
              <label>
                <span>Dependencia</span>
                <Dropdown
                  value={formNuevo.dependencia || ""}
                  options={DEPENDENCIA_OPCIONES_UNIFICADAS}
                  optionLabel="label"
                  optionGroupLabel="label"
                  optionGroupChildren="items"
                  onChange={(e) =>
                    setFormNuevo((prev) => ({ ...prev, dependencia: e.value }))
                  }
                  placeholder="Seleccionar dependencia"
                  filter
                  className={styles.fullInput}
                />
              </label>
              <label>
                <span>Estado</span>
                <Dropdown
                  value={formNuevo.estado || ""}
                  options={ESTADOS.map((estado) => ({
                    label: estadoLabels[estado],
                    value: estado,
                  }))}
                  onChange={(e) =>
                    setFormNuevo((prev) => ({ ...prev, estado: e.value }))
                  }
                  placeholder="Seleccionar estado"
                />
              </label>
              <label>
                <span>Estado de sueldo</span>
                <Dropdown
                  value={formNuevo.estadoSueldo || ""}
                  options={ESTADOS_SUELDO.map((estado) => ({
                    label: estadoSueldoLabels[estado],
                    value: estado,
                  }))}
                  onChange={(e) =>
                    setFormNuevo((prev) => ({ ...prev, estadoSueldo: e.value }))
                  }
                  placeholder="Seleccionar estado de sueldo"
                />
              </label>
              <label>
                <span>Observación</span>
                <InputTextarea
                  value={formNuevo.observacionActual || ""}
                  onChange={(e) =>
                    setFormNuevo((prev) => ({
                      ...prev,
                      observacionActual: e.target.value,
                    }))
                  }
                  rows={4}
                  autoResize
                  className={styles.fullInput}
                  placeholder="Escribí una observación (opcional)"
                />
              </label>
            </>
          )}
        </div>
        <div className={styles.dialogActions}>
          <Button
            label="Crear expediente"
            icon="pi pi-save"
            onClick={guardarNuevoExpediente}
            disabled={!personaNuevo}
            loading={guardandoNuevo}
          />
        </div>
      </Dialog>

      <Dialog
        header="Detalle del expediente"
        visible={visibleDetalle}
        style={{ width: 720, maxWidth: "95vw" }}
        modal
        onHide={() => setVisibleDetalle(false)}
      >
        {seleccionado && (
          <>
            <div className={styles.detailHeader}>
              <div className={styles.detailAvatar}>
                {iniciales(seleccionado.apellidoNombre)}
              </div>
              <div className={styles.detailHeaderInfo}>
                <h3>{seleccionado.apellidoNombre || "Sin nombre"}</h3>
                <span>DNI {seleccionado.dni || "-"}</span>
              </div>
              <div className={styles.detailHeaderBadges}>
                <Tag
                  value={estadoLabels[seleccionado.estado] || seleccionado.estado}
                  severity={estadoSeverity[seleccionado.estado]}
                />
                {seleccionado.estadoSueldo && (
                  <Tag
                    value={estadoSueldoLabels[seleccionado.estadoSueldo] || seleccionado.estadoSueldo}
                    severity={estadoSueldoSeverity[seleccionado.estadoSueldo]}
                  />
                )}
                {seleccionado.finalizado && (
                  <Tag value="Trámite finalizado" severity="success" icon="pi pi-check-circle" />
                )}
                <Tag
                  value={seleccionado.registradoApp ? seleccionado.origenApp : "No registrado"}
                  severity={seleccionado.registradoApp ? "success" : "warning"}
                />
              </div>
            </div>

            <div className={styles.detailGrid}>
              {[
                ["N° expediente", seleccionado.expediente],
                ["Fecha inicio", seleccionado.fechaInicio],
                ["Dependencia", seleccionado.dependencia],
                ["Departamento", seleccionado.departamento],
                ["Nivel", seleccionado.nivel],
                [
                  "Fecha de finalización",
                  seleccionado.finalizado
                    ? fechaHoraTexto(seleccionado.fechaFinalizacion)
                    : "En trámite",
                ],
              ].map(([label, value]) => (
                <div key={label} className={styles.detailField}>
                  <span>{label}</span>
                  <strong>{value || "-"}</strong>
                </div>
              ))}
              <div className={`${styles.detailField} ${styles.detailFieldFull}`}>
                <span>Observación</span>
                <strong>{seleccionado.observacionActual || "-"}</strong>
              </div>
            </div>

            <div className={styles.detailActions}>
              {permisos.agregarObservaciones && (
                <Button
                  label="Agregar observación"
                  icon="pi pi-comment"
                  className="p-button-outlined p-button-sm"
                  onClick={() => {
                    setVisibleDetalle(false);
                    abrirObservacion(seleccionado);
                  }}
                />
              )}
              {permisos.cambiarEstado && (
                <Button
                  label="Editar"
                  icon="pi pi-pencil"
                  className="p-button-outlined p-button-sm"
                  onClick={() => {
                    setVisibleDetalle(false);
                    abrirCambioEstado(seleccionado);
                  }}
                />
              )}
              <Button
                label="Ver historial"
                icon="pi pi-history"
                className="p-button-outlined p-button-sm"
                onClick={() => {
                  setVisibleDetalle(false);
                  verHistorial(seleccionado);
                }}
              />
              {permisos.eliminar && (
                <Button
                  label="Eliminar"
                  icon="pi pi-trash"
                  className="p-button-outlined p-button-sm p-button-danger"
                  onClick={() => {
                    setVisibleDetalle(false);
                    handleEliminar(seleccionado);
                  }}
                />
              )}
            </div>
          </>
        )}
      </Dialog>

      <Dialog
        header="Agregar observación"
        visible={visibleObs}
        style={{ width: 620, maxWidth: "95vw" }}
        modal
        onHide={() => setVisibleObs(false)}
      >
        <InputTextarea
          value={observacion}
          onChange={(e) => setObservacion(e.target.value)}
          rows={5}
          autoResize
          className={styles.fullInput}
          placeholder="Escribí la observación del expediente"
        />
        <div className={styles.dialogActions}>
          <Button label="Guardar observación" icon="pi pi-save" onClick={guardarObservacion} />
        </div>
      </Dialog>

      <Dialog
        header={afiliadoActivo?.telefono ? "Editar celular" : "Agregar celular"}
        visible={visibleEditarTelefono}
        style={{ width: 460, maxWidth: "95vw" }}
        modal
        onHide={() => setVisibleEditarTelefono(false)}
      >
        <div className={styles.stateDialog}>
          <p className={styles.emptyText}>
            {afiliadoActivo?.apellidoNombre || "Afiliado"} · DNI{" "}
            {afiliadoActivo?.dni || "-"}
          </p>
          <label>
            <span>Celular</span>
            <InputText
              value={telefonoEdicion}
              onChange={(e) => setTelefonoEdicion(e.target.value)}
              className={styles.fullInput}
              placeholder="Ej: 3834123456"
              inputMode="tel"
            />
          </label>
          <small className={styles.helpTextExport}>
            Se guardará en los expedientes de este afiliado para poder usarlo en
            los avisos por WhatsApp.
          </small>
        </div>
        <div className={styles.dialogActions}>
          <Button
            label="Cancelar"
            className="p-button-text"
            onClick={() => setVisibleEditarTelefono(false)}
            disabled={guardandoTelefono}
          />
          <Button
            label="Guardar celular"
            icon="pi pi-save"
            className="p-button-success"
            onClick={guardarTelefonoAfiliado}
            loading={guardandoTelefono}
          />
        </div>
      </Dialog>

      <Dialog
        header="Editar expediente"
        visible={visibleEstado}
        style={{ width: 620, maxWidth: "95vw" }}
        modal
        onHide={() => setVisibleEstado(false)}
      >
        <div className={styles.stateDialog}>
          <label>
            <span>Departamento</span>
            <InputText
              value={formEdicion.departamento || ""}
              onChange={(e) =>
                setFormEdicion((prev) => ({ ...prev, departamento: e.target.value }))
              }
              className={styles.fullInput}
            />
          </label>
          <label>
            <span>Nivel</span>
            <InputText
              value={formEdicion.nivel || ""}
              onChange={(e) =>
                setFormEdicion((prev) => ({ ...prev, nivel: e.target.value }))
              }
              className={styles.fullInput}
            />
          </label>
          <label>
            <span>Dependencia</span>
            <Dropdown
              value={formEdicion.dependencia || ""}
              options={DEPENDENCIA_OPCIONES_UNIFICADAS}
              optionLabel="label"
              optionGroupLabel="label"
              optionGroupChildren="items"
              onChange={(e) =>
                setFormEdicion((prev) => ({ ...prev, dependencia: e.value }))
              }
              placeholder="Seleccionar dependencia"
              filter
              className={styles.fullInput}
            />
          </label>
          <label>
            <span>Estado</span>
            <Dropdown
              value={formEdicion.estado || ""}
              options={ESTADOS.map((estado) => ({
                label: estadoLabels[estado],
                value: estado,
              }))}
              onChange={(e) =>
                setFormEdicion((prev) => ({ ...prev, estado: e.value }))
              }
              placeholder="Seleccionar estado"
            />
          </label>
          <label>
            <span>Estado de sueldo</span>
            <Dropdown
              value={formEdicion.estadoSueldo || ""}
              options={ESTADOS_SUELDO.map((estado) => ({
                label: estadoSueldoLabels[estado],
                value: estado,
              }))}
              onChange={(e) =>
                setFormEdicion((prev) => ({
                  ...prev,
                  estadoSueldo: e.value,
                  ...(e.value === "ACTIVO"
                    ? {
                        observacionActual: OBSERVACION_ESTADO_SUELDO_ACTIVO,
                      }
                    : {}),
                }))
              }
              placeholder="Seleccionar estado de sueldo"
            />
          </label>
          <label>
            <span>Observación</span>
            <InputTextarea
              value={formEdicion.observacionActual || ""}
              onChange={(e) =>
                setFormEdicion((prev) => ({
                  ...prev,
                  observacionActual: e.target.value,
                }))
              }
              rows={4}
              autoResize
              className={styles.fullInput}
              placeholder="Escribí una observación"
            />
          </label>
        </div>
        <div className={styles.dialogActions}>
          <Button
            label={seleccionado?.finalizado ? "Expediente finalizado" : "Finalizar expediente"}
            icon={seleccionado?.finalizado ? "pi pi-check-circle" : "pi pi-flag-fill"}
            className="p-button-success p-button-outlined"
            onClick={abrirFinalizarExpediente}
            loading={finalizandoExpediente}
            disabled={seleccionado?.finalizado || finalizandoExpediente}
          />
          <Button label="Guardar cambios" icon="pi pi-save" onClick={guardarEstado} />
        </div>
      </Dialog>

      <Dialog
        header="Finalizar expediente"
        visible={visibleFinalizar}
        style={{ width: 560, maxWidth: "95vw" }}
        modal
        onHide={() => setVisibleFinalizar(false)}
      >
        <div className={styles.stateDialog}>
          <p className={styles.emptyText}>
            {requiereMesHaberPreview
              ? "Seleccioná el mes de haber. El mes a cobrar se calcula automáticamente como el mes siguiente."
              : "Para este estado se enviará el mensaje con la observación cargada en el expediente."}
          </p>
          {requiereMesHaberPreview && (
            <label>
              <span>Mes de haber</span>
              <Dropdown
                value={mesHaberFinalizar || ""}
                options={MESES_HABER}
                onChange={(e) => setMesHaberFinalizar(e.value)}
                placeholder="Seleccionar mes de haber"
                className={styles.fullInput}
              />
            </label>
          )}
          {mensajePreviewFinalizacion && (
            <div className={styles.infoBox}>
              {requiereMesHaberPreview && (
                <span>
                  Haber de {obtenerMesLabel(mesHaberFinalizar)} · se cobra en{" "}
                  {obtenerMesLabel(mesCobroFinalizar)}
                </span>
              )}
              <p>{mensajePreviewFinalizacion}</p>
            </div>
          )}
        </div>
        <div className={styles.dialogActions}>
          <Button
            label="Cancelar"
            className="p-button-text"
            onClick={() => setVisibleFinalizar(false)}
            disabled={finalizandoExpediente}
          />
          <Button
            label="Confirmar cierre y enviar msj"
            icon="pi pi-send"
            className="p-button-success"
            onClick={finalizarExpediente}
            loading={finalizandoExpediente}
            disabled={
              (requiereMesHaberPreview && !mesHaberFinalizar) ||
              finalizandoExpediente
            }
          />
        </div>
      </Dialog>

      <Dialog
        header="Historial del expediente"
        visible={visibleHistorial}
        style={{ width: 800, maxWidth: "95vw" }}
        modal
        onHide={() => setVisibleHistorial(false)}
      >
        {loadingHistorial && <p className={styles.emptyText}>Cargando historial...</p>}
        {!loadingHistorial && historial.length === 0 && (
          <p className={styles.emptyText}>Sin movimientos registrados.</p>
        )}
        {!loadingHistorial && historial.length > 0 && (
          <div className={styles.timeline}>
            {historial.map((mov) => {
              const cambioDependencia =
                mov.dependenciaNueva && mov.dependenciaNueva !== mov.dependenciaAnterior;
              const cambioEstado =
                mov.estadoNuevo && mov.estadoNuevo !== mov.estadoAnterior;
              const cambioEstadoSueldo =
                mov.estadoSueldoNuevo && mov.estadoSueldoNuevo !== mov.estadoSueldoAnterior;
              return (
                <div key={mov.id} className={styles.timelineItem}>
                  <div className={styles.timelineDot} />
                  <div className={styles.timelineContent}>
                    <div className={styles.timelineHeader}>
                      <span className={styles.timelineTipo}>
                        {TIPO_MOVIMIENTO_LABELS[mov.tipo] || mov.tipo}
                      </span>
                      <span className={styles.timelineFecha}>
                        {fechaHoraTexto(mov.fecha)}
                      </span>
                    </div>
                    {cambioDependencia && (
                      <p className={styles.timelinePath}>
                        {mov.dependenciaAnterior || "Carga inicial"}
                        <i className="pi pi-arrow-right" />
                        {mov.dependenciaNueva}
                      </p>
                    )}
                    {cambioEstado && (
                      <p className={styles.timelinePath}>
                        {estadoLabels[mov.estadoAnterior] || mov.estadoAnterior || "Carga inicial"}
                        <i className="pi pi-arrow-right" />
                        {estadoLabels[mov.estadoNuevo] || mov.estadoNuevo}
                      </p>
                    )}
                    {cambioEstadoSueldo && (
                      <p className={styles.timelinePath}>
                        {estadoSueldoLabels[mov.estadoSueldoAnterior] || mov.estadoSueldoAnterior || "Carga inicial"}
                        <i className="pi pi-arrow-right" />
                        {estadoSueldoLabels[mov.estadoSueldoNuevo] || mov.estadoSueldoNuevo}
                      </p>
                    )}
                    {mov.observacion && (
                      <p className={styles.timelineObs}>{mov.observacion}</p>
                    )}
                    <span className={styles.timelineUsuario}>
                      <i className="pi pi-user" /> {mov.usuarioNombre || "Usuario sin nombre registrado"}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Dialog>
    </main>
  );
};

export default GestionDelegados;
