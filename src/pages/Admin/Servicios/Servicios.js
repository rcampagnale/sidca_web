// src/pages/Admin/Servicios/Servicios.js

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Dialog } from "primereact/dialog";
import { Toast } from "primereact/toast";
import { ProgressSpinner } from "primereact/progressspinner";
import { DataTable } from "primereact/datatable";
import { Column } from "primereact/column";
import { Button } from "primereact/button";
import { InputTextarea } from "primereact/inputtextarea";
import { confirmDialog } from "primereact/confirmdialog";

import {
  addDoc,
  collection,
  collectionGroup,
  doc,
  getDoc,
  getDocs,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  writeBatch,
} from "firebase/firestore";

import { db } from "../../../firebase/firebase-config";
import styles from "./servicios.module.css";

import {
  ServicioHeader,
  ServicioAccionesTabla,
  ServicioFormDialog,
  BusquedaGeneralServicios,
  DetalleServicioDialog,
} from "../../../components/Servicios";

const ESTADO_ACTIVO = "activo";
const ESTADO_INACTIVO = "inactivo";

const ESTADO_CUOTA_PENDIENTE = "pendiente";
const ESTADO_CUOTA_COBRADO = "cobrado";
const ESTADO_CUOTA_NO_COBRADO = "no_cobrado";

const formInicial = {
  nombre: "",
  descripcion: "",
  cantidadCuotas: "",
  valorCuota: "",
  activo: true,
  visibleEnApp: true,
};

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

const limpiarTexto = (valor) => {
  return String(valor || "").trim().replace(/\s+/g, " ");
};

const normalizarDni = (valor) => {
  return String(valor || "").replace(/\D/g, "");
};

const pad2 = (valor) => String(valor).padStart(2, "0");

const parseNumeroEntero = (valor) => {
  const limpio = String(valor || "").replace(/\D/g, "");
  const numero = parseInt(limpio, 10);
  return Number.isNaN(numero) ? 0 : numero;
};

const parseImporte = (valor) => {
  if (valor === null || valor === undefined) return 0;

  const limpio = String(valor)
    .trim()
    .replace(/\$/g, "")
    .replace(/\s/g, "")
    .replace(/\./g, "")
    .replace(",", ".");

  const numero = parseFloat(limpio);
  return Number.isNaN(numero) ? 0 : numero;
};

const formatearMoneda = (valor) => {
  const numero = Number(valor || 0);

  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(numero);
};

const formatearFecha = (valor) => {
  if (!valor) return "-";

  try {
    const fecha = valor?.toDate ? valor.toDate() : new Date(valor);

    return new Intl.DateTimeFormat("es-AR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(fecha);
  } catch {
    return "-";
  }
};

const obtenerCampo = (data, campos) => {
  for (const campo of campos) {
    if (data?.[campo] !== undefined && data?.[campo] !== null) {
      return data[campo];
    }
  }

  return "";
};

const sumarMesesPeriodo = (periodo, cantidadMeses) => {
  if (!periodo) return "";

  const [anio, mes] = String(periodo).split("-").map(Number);

  if (!anio || !mes) return "";

  const fecha = new Date(anio, mes - 1 + cantidadMeses, 1);

  return `${fecha.getFullYear()}-${pad2(fecha.getMonth() + 1)}`;
};

const periodoTexto = (periodo) => {
  if (!periodo) return "-";

  const [anio, mes] = String(periodo).split("-").map(Number);

  if (!anio || !mes) return "-";

  return `${MESES[mes - 1]} ${anio}`;
};

const periodoHaberTexto = (periodo) => {
  return `Haber de ${periodoTexto(periodo)}`;
};

const periodoCobroTexto = (periodo) => {
  return `A cobrar en ${periodoTexto(periodo)}`;
};

const construirAfiliadoDesdeDoc = (documento, dniBuscado, origen) => {
  const data = documento.data() || {};

  const dni =
    normalizarDni(
      obtenerCampo(data, [
        "dni",
        "DNI",
        "documento",
        "Documento",
        "cuil",
        "CUIL",
        "cuit",
        "CUIT",
      ])
    ) ||
    normalizarDni(documento.id) ||
    dniBuscado;

  const apellido = limpiarTexto(
    obtenerCampo(data, ["apellido", "Apellido", "lastName", "lastname"])
  );

  const nombre = limpiarTexto(
    obtenerCampo(data, ["nombre", "Nombre", "firstName", "firstname"])
  );

  const nombreCompleto = limpiarTexto(
    obtenerCampo(data, [
      "apellidoNombre",
      "nombreApellido",
      "nombreCompleto",
      "displayName",
      "fullname",
      "fullName",
    ])
  );

  const apellidoNombre =
    limpiarTexto(`${apellido} ${nombre}`) ||
    nombreCompleto ||
    "Sin nombre registrado";

  const email = limpiarTexto(
    obtenerCampo(data, ["email", "correo", "mail", "Email", "Correo"])
  );

  return {
    dni,
    apellido,
    nombre,
    apellidoNombre,
    email,
    origen,
  };
};

const Servicios = () => {
  const toast = useRef(null);

  const [servicios, setServicios] = useState([]);
  const [loading, setLoading] = useState(true);
  const [guardando, setGuardando] = useState(false);

  const [visibleDialog, setVisibleDialog] = useState(false);
  const [servicioEditando, setServicioEditando] = useState(null);
  const [form, setForm] = useState(formInicial);

  const [visibleDetalleServicio, setVisibleDetalleServicio] = useState(false);
  const [servicioSeleccionado, setServicioSeleccionado] = useState(null);
  const [contratacionesServicio, setContratacionesServicio] = useState([]);
  const [loadingContrataciones, setLoadingContrataciones] = useState(false);
  const [filtroContrataciones, setFiltroContrataciones] = useState("");

  const [dniAfiliado, setDniAfiliado] = useState("");
  const [buscandoAfiliado, setBuscandoAfiliado] = useState(false);
  const [afiliadoEncontrado, setAfiliadoEncontrado] = useState(null);
  const [periodoHaberInicial, setPeriodoHaberInicial] = useState("");
  const [agregandoAfiliado, setAgregandoAfiliado] = useState(false);

  const [busquedaGeneral, setBusquedaGeneral] = useState("");
  const [resultadosBusquedaGeneral, setResultadosBusquedaGeneral] = useState([]);
  const [loadingBusquedaGeneral, setLoadingBusquedaGeneral] = useState(false);
  const [busquedaGeneralRealizada, setBusquedaGeneralRealizada] =
    useState(false);

  const [visibleCuotas, setVisibleCuotas] = useState(false);
  const [contratacionSeleccionada, setContratacionSeleccionada] =
    useState(null);
  const [cuotasContratacion, setCuotasContratacion] = useState([]);
  const [loadingCuotas, setLoadingCuotas] = useState(false);
  const [guardandoEstadoCuota, setGuardandoEstadoCuota] = useState(false);

  const [visibleNoCobrado, setVisibleNoCobrado] = useState(false);
  const [cuotaParaNoCobrar, setCuotaParaNoCobrar] = useState(null);
  const [observacionNoCobrado, setObservacionNoCobrado] = useState("");

  const [eliminandoServicioId, setEliminandoServicioId] = useState(null);
  const [importandoAfiliados, setImportandoAfiliados] = useState(false);

  const serviciosRef = useMemo(() => collection(db, "servicios"), []);

  const cargarServicios = useCallback(async () => {
    setLoading(true);

    try {
      const q = query(serviciosRef, orderBy("nombre", "asc"));
      const snap = await getDocs(q);

      const items = snap.docs.map((documento) => ({
        id: documento.id,
        ...documento.data(),
      }));

      setServicios(items);
    } catch (error) {
      console.error("Error al cargar servicios:", error);

      toast.current?.show({
        severity: "error",
        summary: "Error",
        detail: "No se pudieron cargar los servicios.",
      });
    } finally {
      setLoading(false);
    }
  }, [serviciosRef]);

  useEffect(() => {
    cargarServicios();
  }, [cargarServicios]);

  const abrirNuevoServicio = () => {
    setServicioEditando(null);
    setForm(formInicial);
    setVisibleDialog(true);
  };

  const abrirEditarServicio = (servicio) => {
    setServicioEditando(servicio);

    setForm({
      nombre: servicio?.nombre || "",
      descripcion: servicio?.descripcion || "",
      cantidadCuotas: String(servicio?.cantidadCuotas || ""),
      valorCuota: String(servicio?.valorCuota || ""),
      activo: servicio?.estado !== ESTADO_INACTIVO,
      visibleEnApp: servicio?.visibleEnApp === true,
    });

    setVisibleDialog(true);
  };

  const cerrarDialog = () => {
    if (guardando) return;

    setVisibleDialog(false);
    setServicioEditando(null);
    setForm(formInicial);
  };

  const actualizarCampo = (campo, valor) => {
    setForm((prev) => ({
      ...prev,
      [campo]: valor,
    }));
  };

  const validarFormulario = () => {
    const nombre = limpiarTexto(form.nombre);
    const cantidadCuotas = parseNumeroEntero(form.cantidadCuotas);
    const valorCuota = parseImporte(form.valorCuota);

    if (!nombre) {
      toast.current?.show({
        severity: "warn",
        summary: "Atención",
        detail: "Ingrese el nombre del servicio.",
      });
      return false;
    }

    if (cantidadCuotas <= 0) {
      toast.current?.show({
        severity: "warn",
        summary: "Atención",
        detail: "Ingrese una cantidad de cuotas válida.",
      });
      return false;
    }

    if (valorCuota <= 0) {
      toast.current?.show({
        severity: "warn",
        summary: "Atención",
        detail: "Ingrese un valor de cuota válido.",
      });
      return false;
    }

    return true;
  };

  const guardarServicio = async () => {
    if (!validarFormulario()) return;

    const nombre = limpiarTexto(form.nombre);
    const descripcion = limpiarTexto(form.descripcion);
    const cantidadCuotas = parseNumeroEntero(form.cantidadCuotas);
    const valorCuota = parseImporte(form.valorCuota);

    const payload = {
      nombre,
      descripcion,
      cantidadCuotas,
      valorCuota,
      estado: form.activo ? ESTADO_ACTIVO : ESTADO_INACTIVO,
      activo: !!form.activo,
      visibleEnApp: !!form.visibleEnApp,
      actualizadoEn: serverTimestamp(),
    };

    setGuardando(true);

    try {
      if (servicioEditando?.id) {
        await updateDoc(doc(db, "servicios", servicioEditando.id), payload);

        toast.current?.show({
          severity: "success",
          summary: "Servicio actualizado",
          detail: "Los datos del servicio fueron actualizados correctamente.",
        });
      } else {
        await addDoc(serviciosRef, {
          ...payload,
          creadoEn: serverTimestamp(),
        });

        toast.current?.show({
          severity: "success",
          summary: "Servicio creado",
          detail: "El servicio fue creado correctamente.",
        });
      }

      await cargarServicios();
      cerrarDialog();
    } catch (error) {
      console.error("Error al guardar servicio:", error);

      toast.current?.show({
        severity: "error",
        summary: "Error",
        detail: "No se pudo guardar el servicio.",
      });
    } finally {
      setGuardando(false);
    }
  };

  const cambiarEstadoServicio = async (servicio) => {
    if (!servicio?.id) return;

    const nuevoActivo = !(servicio?.activo !== false);
    const nuevoEstado = nuevoActivo ? ESTADO_ACTIVO : ESTADO_INACTIVO;

    try {
      await updateDoc(doc(db, "servicios", servicio.id), {
        activo: nuevoActivo,
        estado: nuevoEstado,
        actualizadoEn: serverTimestamp(),
      });

      toast.current?.show({
        severity: "success",
        summary: "Estado actualizado",
        detail: nuevoActivo
          ? "El servicio fue activado."
          : "El servicio fue desactivado.",
      });

      await cargarServicios();

      if (servicioSeleccionado?.id === servicio.id) {
        setServicioSeleccionado((prev) => ({
          ...prev,
          activo: nuevoActivo,
          estado: nuevoEstado,
        }));
      }
    } catch (error) {
      console.error("Error al cambiar estado del servicio:", error);

      toast.current?.show({
        severity: "error",
        summary: "Error",
        detail: "No se pudo cambiar el estado del servicio.",
      });
    }
  };

  const cambiarVisibleEnApp = async (servicio) => {
    if (!servicio?.id) return;

    const nuevoValor = !(servicio?.visibleEnApp === true);

    try {
      await updateDoc(doc(db, "servicios", servicio.id), {
        visibleEnApp: nuevoValor,
        actualizadoEn: serverTimestamp(),
      });

      toast.current?.show({
        severity: "success",
        summary: "Visibilidad actualizada",
        detail: nuevoValor
          ? "El servicio será visible en la app."
          : "El servicio no será visible en la app.",
      });

      await cargarServicios();

      if (servicioSeleccionado?.id === servicio.id) {
        setServicioSeleccionado((prev) => ({
          ...prev,
          visibleEnApp: nuevoValor,
        }));
      }
    } catch (error) {
      console.error("Error al cambiar visibilidad:", error);

      toast.current?.show({
        severity: "error",
        summary: "Error",
        detail: "No se pudo actualizar la visibilidad.",
      });
    }
  };

  const borrarEnLotes = async (refs) => {
    const bloques = [];

    for (let i = 0; i < refs.length; i += 450) {
      bloques.push(refs.slice(i, i + 450));
    }

    for (const bloque of bloques) {
      const batch = writeBatch(db);
      bloque.forEach((ref) => batch.delete(ref));
      await batch.commit();
    }
  };

  const eliminarServicioCompleto = async (servicio) => {
    if (!servicio?.id) return;

    setEliminandoServicioId(servicio.id);

    try {
      const refsParaBorrar = [];

      const contratacionesSnap = await getDocs(
        collection(db, "servicios", servicio.id, "contrataciones")
      );

      for (const contratacionDoc of contratacionesSnap.docs) {
        const cuotasSnap = await getDocs(
          collection(
            db,
            "servicios",
            servicio.id,
            "contrataciones",
            contratacionDoc.id,
            "cuotas"
          )
        );

        cuotasSnap.docs.forEach((cuotaDoc) => {
          refsParaBorrar.push(cuotaDoc.ref);
        });

        const historialSnap = await getDocs(
          collection(
            db,
            "servicios",
            servicio.id,
            "contrataciones",
            contratacionDoc.id,
            "historial"
          )
        );

        historialSnap.docs.forEach((historialDoc) => {
          refsParaBorrar.push(historialDoc.ref);
        });

        refsParaBorrar.push(contratacionDoc.ref);
      }

      refsParaBorrar.push(doc(db, "servicios", servicio.id));

      await borrarEnLotes(refsParaBorrar);

      toast.current?.show({
        severity: "success",
        summary: "Servicio eliminado",
        detail:
          "Se eliminó el servicio completo con sus afiliados, cuotas e historial.",
      });

      if (servicioSeleccionado?.id === servicio.id) {
        setVisibleDetalleServicio(false);
        setServicioSeleccionado(null);
      }

      await cargarServicios();
    } catch (error) {
      console.error("Error al eliminar servicio:", error);

      toast.current?.show({
        severity: "error",
        summary: "Error",
        detail: "No se pudo eliminar el servicio.",
      });
    } finally {
      setEliminandoServicioId(null);
    }
  };

  const confirmarEliminarServicio = (servicio) => {
    confirmDialog({
      message:
        "Esta acción eliminará el servicio completo. Si tiene afiliados contratados, también se eliminarán sus cuotas e historial. ¿Desea continuar?",
      header: "Eliminar servicio completo",
      icon: "pi pi-exclamation-triangle",
      acceptLabel: "Sí, eliminar",
      rejectLabel: "Cancelar",
      acceptClassName: "p-button-danger",
      accept: () => eliminarServicioCompleto(servicio),
    });
  };

  const cargarContratacionesServicio = async (servicioId) => {
    if (!servicioId) return;

    setLoadingContrataciones(true);

    try {
      const snap = await getDocs(
        collection(db, "servicios", servicioId, "contrataciones")
      );

      const items = snap.docs
        .map((documento) => ({
          id: documento.id,
          ...documento.data(),
        }))
        .sort((a, b) =>
          limpiarTexto(a.apellidoNombre).localeCompare(
            limpiarTexto(b.apellidoNombre)
          )
        );

      setContratacionesServicio(items);
    } catch (error) {
      console.error("Error al cargar contrataciones:", error);

      toast.current?.show({
        severity: "error",
        summary: "Error",
        detail: "No se pudieron cargar los afiliados contratados.",
      });
    } finally {
      setLoadingContrataciones(false);
    }
  };

  const abrirDetalleServicio = async (servicio) => {
    setServicioSeleccionado(servicio);
    setVisibleDetalleServicio(true);
    setFiltroContrataciones("");
    setDniAfiliado("");
    setAfiliadoEncontrado(null);
    setPeriodoHaberInicial("");

    await cargarContratacionesServicio(servicio.id);
  };

  const buscarAfiliadoEnColeccion = async (nombreColeccion, dni) => {
    const docDirecto = await getDoc(doc(db, nombreColeccion, dni));

    if (docDirecto.exists()) {
      return construirAfiliadoDesdeDoc(docDirecto, dni, nombreColeccion);
    }

    const snap = await getDocs(collection(db, nombreColeccion));

    const encontrado = snap.docs.find((documento) => {
      const data = documento.data() || {};

      const dniData = normalizarDni(
        obtenerCampo(data, [
          "dni",
          "DNI",
          "documento",
          "Documento",
          "cuil",
          "CUIL",
          "cuit",
          "CUIT",
        ])
      );

      return dniData === dni || normalizarDni(documento.id) === dni;
    });

    if (!encontrado) return null;

    return construirAfiliadoDesdeDoc(encontrado, dni, nombreColeccion);
  };

  const buscarAfiliadoPorDniValor = async (dniValor) => {
    const dni = normalizarDni(dniValor);

    if (!dni) return null;

    const enUsuarios = await buscarAfiliadoEnColeccion("usuarios", dni);
    if (enUsuarios) return enUsuarios;

    const enNuevoAfiliado = await buscarAfiliadoEnColeccion("nuevoAfiliado", dni);
    if (enNuevoAfiliado) return enNuevoAfiliado;

    return null;
  };

  const buscarAfiliadoPorDni = async () => {
    const dni = normalizarDni(dniAfiliado);

    if (!dni) {
      toast.current?.show({
        severity: "warn",
        summary: "Atención",
        detail: "Ingrese un DNI para buscar.",
      });
      return;
    }

    setBuscandoAfiliado(true);
    setAfiliadoEncontrado(null);

    try {
      const afiliado = await buscarAfiliadoPorDniValor(dni);

      if (!afiliado) {
        toast.current?.show({
          severity: "warn",
          summary: "No encontrado",
          detail: "El DNI no existe en usuarios ni en nuevoAfiliado.",
        });
        return;
      }

      setAfiliadoEncontrado(afiliado);

      toast.current?.show({
        severity: "success",
        summary: "Afiliado encontrado",
        detail: afiliado.apellidoNombre,
      });
    } catch (error) {
      console.error("Error al buscar afiliado:", error);

      toast.current?.show({
        severity: "error",
        summary: "Error",
        detail: "No se pudo buscar el afiliado.",
      });
    } finally {
      setBuscandoAfiliado(false);
    }
  };

  const generarCuotas = ({ cantidadCuotas, valorCuota, periodoHaberInicial }) => {
    const cuotas = [];

    for (let i = 1; i <= cantidadCuotas; i++) {
      const periodoHaber = sumarMesesPeriodo(periodoHaberInicial, i - 1);
      const periodoCobro = sumarMesesPeriodo(periodoHaberInicial, i);

      cuotas.push({
        id: pad2(i),
        numeroCuota: i,
        etiquetaCuota: `${pad2(i)}/${pad2(cantidadCuotas)}`,
        periodoHaber,
        periodoHaberTexto: periodoHaberTexto(periodoHaber),
        periodoCobro,
        periodoCobroTexto: periodoCobroTexto(periodoCobro),
        valorCuota,
        estado: ESTADO_CUOTA_PENDIENTE,
        observacion: "",
        fechaRegistroCobro: null,
        actualizadoEn: serverTimestamp(),
      });
    }

    return cuotas;
  };

  const crearContratacionAfiliado = async ({
    servicio,
    afiliado,
    periodoHaber,
    observacionGeneral = "",
  }) => {
    const dni = normalizarDni(afiliado?.dni);

    if (!servicio?.id || !dni || !periodoHaber) {
      return {
        ok: false,
        estado: "error",
        dni,
        detalle: "Datos incompletos para crear la contratación.",
      };
    }

    const cantidadCuotas = Number(servicio.cantidadCuotas || 0);
    const valorCuota = Number(servicio.valorCuota || 0);

    if (cantidadCuotas <= 0 || valorCuota <= 0) {
      return {
        ok: false,
        estado: "error",
        dni,
        detalle: "El servicio no tiene cuotas o valor de cuota válido.",
      };
    }

    const contratacionRef = doc(
      db,
      "servicios",
      servicio.id,
      "contrataciones",
      dni
    );

    const existente = await getDoc(contratacionRef);

    if (existente.exists()) {
      return {
        ok: false,
        estado: "duplicado",
        dni,
        detalle: "El afiliado ya tiene contratado este servicio.",
      };
    }

    const periodoCobroInicial = sumarMesesPeriodo(periodoHaber, 1);

    const contratacionPayload = {
      dni,
      apellido: afiliado.apellido || "",
      nombre: afiliado.nombre || "",
      apellidoNombre: afiliado.apellidoNombre || "",
      email: afiliado.email || "",
      origenAfiliado: afiliado.origen || "",

      servicioId: servicio.id,
      servicioNombre: servicio.nombre,

      cantidadCuotas,
      valorCuota,

      periodoHaberInicial: periodoHaber,
      periodoCobroInicial,
      periodoHaberInicialTexto: periodoHaberTexto(periodoHaber),
      periodoCobroInicialTexto: periodoCobroTexto(periodoCobroInicial),

      cuotasCobradas: 0,
      cuotasNoCobradas: 0,
      cuotasPendientes: cantidadCuotas,

      estado: ESTADO_ACTIVO,
      observacionGeneral: limpiarTexto(observacionGeneral),

      creadoEn: serverTimestamp(),
      actualizadoEn: serverTimestamp(),
    };

    const cuotas = generarCuotas({
      cantidadCuotas,
      valorCuota,
      periodoHaberInicial: periodoHaber,
    });

    const batch = writeBatch(db);

    batch.set(contratacionRef, contratacionPayload);

    cuotas.forEach((cuota) => {
      const cuotaRef = doc(
        db,
        "servicios",
        servicio.id,
        "contrataciones",
        dni,
        "cuotas",
        cuota.id
      );

      batch.set(cuotaRef, cuota);
    });

    await batch.commit();

    return {
      ok: true,
      estado: "creado",
      dni,
      detalle: "Afiliado agregado correctamente.",
    };
  };

  const agregarAfiliadoAlServicio = async () => {
    if (!servicioSeleccionado?.id) return;

    if (!afiliadoEncontrado?.dni) {
      toast.current?.show({
        severity: "warn",
        summary: "Atención",
        detail: "Primero busque y valide un afiliado por DNI.",
      });
      return;
    }

    if (!periodoHaberInicial) {
      toast.current?.show({
        severity: "warn",
        summary: "Atención",
        detail: "Seleccione el haber inicial del descuento.",
      });
      return;
    }

    setAgregandoAfiliado(true);

    try {
      const resultado = await crearContratacionAfiliado({
        servicio: servicioSeleccionado,
        afiliado: afiliadoEncontrado,
        periodoHaber: periodoHaberInicial,
      });

      if (!resultado.ok) {
        toast.current?.show({
          severity: resultado.estado === "duplicado" ? "warn" : "error",
          summary: resultado.estado === "duplicado" ? "Ya existe" : "Error",
          detail: resultado.detalle,
        });
        return;
      }

      toast.current?.show({
        severity: "success",
        summary: "Afiliado agregado",
        detail: "Se generaron automáticamente las cuotas del servicio.",
      });

      setDniAfiliado("");
      setAfiliadoEncontrado(null);
      setPeriodoHaberInicial("");

      await cargarContratacionesServicio(servicioSeleccionado.id);
    } catch (error) {
      console.error("Error al agregar afiliado:", error);

      toast.current?.show({
        severity: "error",
        summary: "Error",
        detail: "No se pudo agregar el afiliado al servicio.",
      });
    } finally {
      setAgregandoAfiliado(false);
    }
  };

  const importarAfiliadosExcel = async ({
    servicio,
    periodoHaberInicial: periodoHaber,
    filas,
  }) => {
    if (!servicio?.id) return;

    if (!periodoHaber) {
      toast.current?.show({
        severity: "warn",
        summary: "Atención",
        detail: "Seleccione el haber inicial para importar el Excel.",
      });
      return;
    }

    if (!Array.isArray(filas) || filas.length === 0) {
      toast.current?.show({
        severity: "warn",
        summary: "Atención",
        detail: "No hay afiliados válidos para importar.",
      });
      return;
    }

    setImportandoAfiliados(true);

    let creados = 0;
    let duplicados = 0;
    let noEncontrados = 0;
    let errores = 0;

    try {
      for (const fila of filas) {
        const dni = normalizarDni(fila.dni);

        if (!dni) {
          errores += 1;
          continue;
        }

        const afiliado = await buscarAfiliadoPorDniValor(dni);

        if (!afiliado) {
          noEncontrados += 1;
          continue;
        }

        const resultado = await crearContratacionAfiliado({
          servicio,
          afiliado,
          periodoHaber,
          observacionGeneral: fila.observacion || "",
        });

        if (resultado.estado === "creado") creados += 1;
        else if (resultado.estado === "duplicado") duplicados += 1;
        else errores += 1;
      }

      toast.current?.show({
        severity: "success",
        summary: "Importación finalizada",
        detail: `Creados: ${creados}. Duplicados: ${duplicados}. No encontrados: ${noEncontrados}. Errores: ${errores}.`,
        life: 8000,
      });

      await cargarContratacionesServicio(servicio.id);
    } catch (error) {
      console.error("Error al importar Excel:", error);

      toast.current?.show({
        severity: "error",
        summary: "Error",
        detail: "No se pudo completar la importación del Excel.",
      });
    } finally {
      setImportandoAfiliados(false);
    }
  };

  const buscarServiciosPorAfiliado = async () => {
    const termino = limpiarTexto(busquedaGeneral).toLowerCase();
    const dniTermino = normalizarDni(busquedaGeneral);

    if (!termino && !dniTermino) {
      toast.current?.show({
        severity: "warn",
        summary: "Atención",
        detail: "Ingrese DNI, apellido o nombre para buscar.",
      });
      return;
    }

    setLoadingBusquedaGeneral(true);
    setBusquedaGeneralRealizada(true);

    try {
      const snap = await getDocs(collectionGroup(db, "contrataciones"));

      const itemsBase = snap.docs.map((documento) => ({
        id: documento.id,
        ref: documento.ref,
        path: documento.ref.path,
        ...documento.data(),
      }));

      const filtradosBase = itemsBase.filter((item) => {
        const texto = `${item.apellidoNombre || ""} ${item.nombre || ""} ${
          item.apellido || ""
        } ${item.servicioNombre || ""}`.toLowerCase();

        const dniItem = normalizarDni(item.dni);

        return (
          (dniTermino && dniItem.includes(dniTermino)) ||
          (termino && texto.includes(termino))
        );
      });

      const filtradosConCuotas = await Promise.all(
        filtradosBase.map(async (item) => {
          let cuotas = [];

          try {
            const cuotasSnap = await getDocs(collection(item.ref, "cuotas"));

            cuotas = cuotasSnap.docs
              .map((cuotaDoc) => ({
                id: cuotaDoc.id,
                ...cuotaDoc.data(),
              }))
              .sort(
                (a, b) =>
                  Number(a.numeroCuota || 0) - Number(b.numeroCuota || 0)
              );
          } catch (errorCuotas) {
            console.error(
              "Error al cargar cuotas de búsqueda general:",
              errorCuotas
            );
          }

          const { ref, ...itemSinRef } = item;

          return {
            ...itemSinRef,
            cuotas,
          };
        })
      );

      setResultadosBusquedaGeneral(filtradosConCuotas);
    } catch (error) {
      console.error("Error en búsqueda general:", error);

      toast.current?.show({
        severity: "error",
        summary: "Error",
        detail: "No se pudo realizar la búsqueda general.",
      });
    } finally {
      setLoadingBusquedaGeneral(false);
    }
  };

  const limpiarBusquedaGeneral = () => {
    setBusquedaGeneral("");
    setResultadosBusquedaGeneral([]);
    setBusquedaGeneralRealizada(false);
  };

  const cargarCuotasContratacion = async (contratacion) => {
    if (!contratacion?.servicioId || !contratacion?.dni) return;

    setLoadingCuotas(true);

    try {
      const snap = await getDocs(
        collection(
          db,
          "servicios",
          contratacion.servicioId,
          "contrataciones",
          contratacion.dni,
          "cuotas"
        )
      );

      const items = snap.docs
        .map((documento) => ({
          id: documento.id,
          ...documento.data(),
        }))
        .sort((a, b) => Number(a.numeroCuota || 0) - Number(b.numeroCuota || 0));

      setCuotasContratacion(items);
    } catch (error) {
      console.error("Error al cargar cuotas:", error);

      toast.current?.show({
        severity: "error",
        summary: "Error",
        detail: "No se pudieron cargar las cuotas.",
      });
    } finally {
      setLoadingCuotas(false);
    }
  };

  const abrirCuotas = async (contratacion) => {
    setContratacionSeleccionada(contratacion);
    setVisibleCuotas(true);

    await cargarCuotasContratacion(contratacion);
  };

  const recalcularResumenContratacion = async (contratacion) => {
    const snap = await getDocs(
      collection(
        db,
        "servicios",
        contratacion.servicioId,
        "contrataciones",
        contratacion.dni,
        "cuotas"
      )
    );

    let cuotasCobradas = 0;
    let cuotasNoCobradas = 0;
    let cuotasPendientes = 0;

    snap.docs.forEach((documento) => {
      const estado = documento.data()?.estado;

      if (estado === ESTADO_CUOTA_COBRADO) cuotasCobradas += 1;
      else if (estado === ESTADO_CUOTA_NO_COBRADO) cuotasNoCobradas += 1;
      else cuotasPendientes += 1;
    });

    const resumen = {
      cuotasCobradas,
      cuotasNoCobradas,
      cuotasPendientes,
      actualizadoEn: serverTimestamp(),
    };

    await updateDoc(
      doc(
        db,
        "servicios",
        contratacion.servicioId,
        "contrataciones",
        contratacion.dni
      ),
      resumen
    );

    return resumen;
  };

  const actualizarEstadoCuota = async (
    contratacion,
    cuota,
    estadoNuevo,
    observacion = ""
  ) => {
    if (!contratacion?.servicioId || !contratacion?.dni || !cuota?.id) return;

    if (estadoNuevo === ESTADO_CUOTA_NO_COBRADO && !limpiarTexto(observacion)) {
      toast.current?.show({
        severity: "warn",
        summary: "Observación obligatoria",
        detail: "Debe detallar por qué la cuota no fue cobrada.",
      });
      return;
    }

    setGuardandoEstadoCuota(true);

    try {
      const estadoAnterior = cuota.estado || ESTADO_CUOTA_PENDIENTE;

      const cuotaRef = doc(
        db,
        "servicios",
        contratacion.servicioId,
        "contrataciones",
        contratacion.dni,
        "cuotas",
        cuota.id
      );

      await updateDoc(cuotaRef, {
        estado: estadoNuevo,
        observacion:
          estadoNuevo === ESTADO_CUOTA_NO_COBRADO ? limpiarTexto(observacion) : "",
        fechaRegistroCobro:
          estadoNuevo === ESTADO_CUOTA_PENDIENTE ? null : serverTimestamp(),
        actualizadoEn: serverTimestamp(),
      });

      await addDoc(
        collection(
          db,
          "servicios",
          contratacion.servicioId,
          "contrataciones",
          contratacion.dni,
          "historial"
        ),
        {
          accion: `marcar_${estadoNuevo}`,
          cuota: cuota.etiquetaCuota,
          periodoCobro: cuota.periodoCobro,
          valorCuota: cuota.valorCuota,
          estadoAnterior,
          estadoNuevo,
          observacion: limpiarTexto(observacion),
          fecha: serverTimestamp(),
        }
      );

      const resumen = await recalcularResumenContratacion(contratacion);

      setContratacionSeleccionada((prev) => ({
        ...prev,
        ...resumen,
      }));

      if (servicioSeleccionado?.id === contratacion.servicioId) {
        await cargarContratacionesServicio(contratacion.servicioId);
      }

      if (busquedaGeneralRealizada && busquedaGeneral.trim()) {
        await buscarServiciosPorAfiliado();
      }

      await cargarCuotasContratacion(contratacion);

      toast.current?.show({
        severity: "success",
        summary: "Cuota actualizada",
        detail: "El estado de la cuota fue actualizado correctamente.",
      });
    } catch (error) {
      console.error("Error al actualizar cuota:", error);

      toast.current?.show({
        severity: "error",
        summary: "Error",
        detail: "No se pudo actualizar la cuota.",
      });
    } finally {
      setGuardandoEstadoCuota(false);
    }
  };

  const confirmarMarcarCobrado = (cuota) => {
    confirmDialog({
      header: "Marcar cuota como cobrada",
      message: `¿Confirma que la cuota ${cuota.etiquetaCuota} fue cobrada?`,
      icon: "pi pi-check-circle",
      acceptLabel: "Sí, marcar cobrada",
      rejectLabel: "Cancelar",
      acceptClassName: "p-button-success",
      accept: () =>
        actualizarEstadoCuota(
          contratacionSeleccionada,
          cuota,
          ESTADO_CUOTA_COBRADO,
          ""
        ),
    });
  };

  const confirmarRevertirPendiente = (cuota) => {
    confirmDialog({
      header: "Revertir cuota a pendiente",
      message: `¿Desea volver la cuota ${cuota.etiquetaCuota} al estado pendiente?`,
      icon: "pi pi-refresh",
      acceptLabel: "Sí, revertir",
      rejectLabel: "Cancelar",
      accept: () =>
        actualizarEstadoCuota(
          contratacionSeleccionada,
          cuota,
          ESTADO_CUOTA_PENDIENTE,
          ""
        ),
    });
  };

  const abrirNoCobrado = (cuota) => {
    setCuotaParaNoCobrar(cuota);
    setObservacionNoCobrado(cuota?.observacion || "");
    setVisibleNoCobrado(true);
  };

  const guardarNoCobrado = async () => {
    if (!limpiarTexto(observacionNoCobrado)) {
      toast.current?.show({
        severity: "warn",
        summary: "Observación obligatoria",
        detail: "Debe escribir el motivo por el cual no se cobró la cuota.",
      });
      return;
    }

    await actualizarEstadoCuota(
      contratacionSeleccionada,
      cuotaParaNoCobrar,
      ESTADO_CUOTA_NO_COBRADO,
      observacionNoCobrado
    );

    setVisibleNoCobrado(false);
    setCuotaParaNoCobrar(null);
    setObservacionNoCobrado("");
  };

  const contratacionesFiltradas = useMemo(() => {
    const termino = limpiarTexto(filtroContrataciones).toLowerCase();
    const dniTermino = normalizarDni(filtroContrataciones);

    if (!termino && !dniTermino) return contratacionesServicio;

    return contratacionesServicio.filter((item) => {
      const texto = `${item.apellidoNombre || ""} ${item.nombre || ""} ${
        item.apellido || ""
      }`.toLowerCase();

      const dni = normalizarDni(item.dni);

      return (
        (dniTermino && dni.includes(dniTermino)) ||
        (termino && texto.includes(termino))
      );
    });
  }, [contratacionesServicio, filtroContrataciones]);

  const totalServicios = servicios.length;
  const serviciosActivos = servicios.filter((s) => s?.activo !== false).length;
  const serviciosVisibles = servicios.filter((s) => s?.visibleEnApp === true).length;

  const descripcionTemplate = (rowData) => {
    return (
      <div className={styles.descripcionTabla}>
        {rowData?.descripcion || "Sin descripción registrada."}
      </div>
    );
  };

  const estadoTemplate = (rowData) => {
    const activo = rowData?.activo !== false;

    return (
      <span className={activo ? styles.estadoActivo : styles.estadoInactivo}>
        {activo ? "Activo" : "Inactivo"}
      </span>
    );
  };

  const visibleTemplate = (rowData) => {
    const visible = rowData?.visibleEnApp === true;

    return (
      <span className={visible ? styles.estadoVisible : styles.estadoOculto}>
        {visible ? "Visible" : "Oculto"}
      </span>
    );
  };

  const valorCuotaTemplate = (rowData) => {
    return <strong>{formatearMoneda(rowData?.valorCuota)}</strong>;
  };

  const cuotasTemplate = (rowData) => {
    const cantidad = Number(rowData?.cantidadCuotas || 0);

    return (
      <span className={styles.badgeCuotas}>
        {cantidad} {cantidad === 1 ? "cuota" : "cuotas"}
      </span>
    );
  };

  const fechaTemplate = (rowData) => {
    return (
      <span>{formatearFecha(rowData?.actualizadoEn || rowData?.creadoEn)}</span>
    );
  };

  const accionesTemplate = (rowData) => {
    return (
      <ServicioAccionesTabla
        servicio={rowData}
        eliminandoServicioId={eliminandoServicioId}
        onVer={abrirDetalleServicio}
        onEditar={abrirEditarServicio}
        onCambiarEstado={cambiarEstadoServicio}
        onCambiarVisibleEnApp={cambiarVisibleEnApp}
        onEliminar={confirmarEliminarServicio}
      />
    );
  };

  const estadoCuotaTemplate = (rowData) => {
    if (rowData.estado === ESTADO_CUOTA_COBRADO) {
      return <span className={styles.cuotaCobrada}>Cobrado</span>;
    }

    if (rowData.estado === ESTADO_CUOTA_NO_COBRADO) {
      return <span className={styles.cuotaNoCobrada}>No cobrado</span>;
    }

    return <span className={styles.cuotaPendiente}>Pendiente</span>;
  };

  const accionesCuotaTemplate = (rowData) => {
    return (
      <div className={styles.accionesTabla}>
        <Button
          icon="pi pi-check"
          className="p-button-rounded p-button-success p-button-sm"
          tooltip="Marcar cobrado"
          tooltipOptions={{ position: "top" }}
          onClick={() => confirmarMarcarCobrado(rowData)}
          disabled={
            guardandoEstadoCuota || rowData.estado === ESTADO_CUOTA_COBRADO
          }
        />

        <Button
          icon="pi pi-times"
          className="p-button-rounded p-button-danger p-button-sm"
          tooltip="Marcar no cobrado"
          tooltipOptions={{ position: "top" }}
          onClick={() => abrirNoCobrado(rowData)}
          disabled={
            guardandoEstadoCuota || rowData.estado === ESTADO_CUOTA_NO_COBRADO
          }
        />

        <Button
          icon="pi pi-refresh"
          className="p-button-rounded p-button-secondary p-button-sm"
          tooltip="Revertir a pendiente"
          tooltipOptions={{ position: "top" }}
          onClick={() => confirmarRevertirPendiente(rowData)}
          disabled={
            guardandoEstadoCuota || rowData.estado === ESTADO_CUOTA_PENDIENTE
          }
        />
      </div>
    );
  };

  return (
    <div className={styles.serviciosPage}>
      <Toast ref={toast} />

      <ServicioHeader onNuevoServicio={abrirNuevoServicio} />

      <div className={styles.resumenGrid}>
        <div className={styles.resumenCard}>
          <span className={styles.resumenLabel}>Servicios creados</span>
          <strong>{totalServicios}</strong>
        </div>

        <div className={styles.resumenCard}>
          <span className={styles.resumenLabel}>Servicios activos</span>
          <strong>{serviciosActivos}</strong>
        </div>

        <div className={styles.resumenCard}>
          <span className={styles.resumenLabel}>Visibles en app</span>
          <strong>{serviciosVisibles}</strong>
        </div>
      </div>

      <div className={styles.infoBox}>
        <strong>Regla administrativa:</strong> el administrador define la cantidad
        de cuotas y el valor de cuota. El haber inicial se define al agregar
        afiliados al servicio.
      </div>

      <BusquedaGeneralServicios
        busquedaGeneral={busquedaGeneral}
        onChangeBusquedaGeneral={setBusquedaGeneral}
        onBuscar={buscarServiciosPorAfiliado}
        onLimpiar={limpiarBusquedaGeneral}
        loadingBusquedaGeneral={loadingBusquedaGeneral}
        busquedaGeneralRealizada={busquedaGeneralRealizada}
        resultadosBusquedaGeneral={resultadosBusquedaGeneral}
        onVerCuotas={abrirCuotas}
      />

      <div className={styles.tableContainer}>
        {loading ? (
          <div className={styles.loadingBox}>
            <ProgressSpinner />
            <span>Cargando servicios...</span>
          </div>
        ) : (
          <DataTable
            value={servicios}
            paginator
            rows={10}
            rowsPerPageOptions={[10, 20, 50]}
            emptyMessage="No hay servicios cargados."
            responsiveLayout="scroll"
            className={styles.serviciosTable}
          >
            <Column
              field="nombre"
              header="Servicio"
              sortable
              style={{ minWidth: "220px" }}
            />

            <Column
              header="Descripción"
              body={descripcionTemplate}
              style={{ minWidth: "420px", maxWidth: "650px" }}
            />

            <Column header="Cuotas" body={cuotasTemplate} sortable />
            <Column header="Valor de cuota" body={valorCuotaTemplate} sortable />
            <Column header="Estado" body={estadoTemplate} sortable />
            <Column header="App" body={visibleTemplate} sortable />
            <Column header="Última actualización" body={fechaTemplate} />
            <Column header="Acciones" body={accionesTemplate} />
          </DataTable>
        )}
      </div>

      <ServicioFormDialog
        visible={visibleDialog}
        servicioEditando={servicioEditando}
        form={form}
        guardando={guardando}
        onHide={cerrarDialog}
        onChange={actualizarCampo}
        onGuardar={guardarServicio}
      />

      <DetalleServicioDialog
        visible={visibleDetalleServicio}
        onHide={() => setVisibleDetalleServicio(false)}
        servicioSeleccionado={servicioSeleccionado}
        filtroContrataciones={filtroContrataciones}
        onChangeFiltroContrataciones={setFiltroContrataciones}
        contratacionesFiltradas={contratacionesFiltradas}
        loadingContrataciones={loadingContrataciones}
        dniAfiliado={dniAfiliado}
        onChangeDniAfiliado={(value) => {
          setDniAfiliado(value);
          setAfiliadoEncontrado(null);
        }}
        buscandoAfiliado={buscandoAfiliado}
        afiliadoEncontrado={afiliadoEncontrado}
        periodoHaberInicial={periodoHaberInicial}
        onChangePeriodoHaberInicial={setPeriodoHaberInicial}
        agregandoAfiliado={agregandoAfiliado}
        onBuscarAfiliadoPorDni={buscarAfiliadoPorDni}
        onAgregarAfiliado={agregarAfiliadoAlServicio}
        onVerCuotas={abrirCuotas}
        onImportarAfiliadosExcel={importarAfiliadosExcel}
        importandoAfiliados={importandoAfiliados}
      />

      <Dialog
        header={`Cuotas - ${contratacionSeleccionada?.apellidoNombre || ""}`}
        visible={visibleCuotas}
        style={{ width: "95vw", maxWidth: "1200px" }}
        modal
        onHide={() => setVisibleCuotas(false)}
      >
        {contratacionSeleccionada && (
          <div className={styles.cuotasHeader}>
            <strong>{contratacionSeleccionada.servicioNombre}</strong>
            <span>DNI: {contratacionSeleccionada.dni}</span>
          </div>
        )}

        {loadingCuotas ? (
          <div className={styles.loadingBox}>
            <ProgressSpinner />
            <span>Cargando cuotas...</span>
          </div>
        ) : (
          <DataTable
            value={cuotasContratacion}
            emptyMessage="No hay cuotas generadas."
            responsiveLayout="scroll"
            rowClassName={(rowData) =>
              rowData.estado === ESTADO_CUOTA_NO_COBRADO
                ? styles.filaNoCobrada
                : ""
            }
          >
            <Column field="etiquetaCuota" header="Cuota" />
            <Column field="periodoHaberTexto" header="Haber" />
            <Column field="periodoCobroTexto" header="Cobra en" />
            <Column header="Valor" body={valorCuotaTemplate} />
            <Column header="Estado" body={estadoCuotaTemplate} />
            <Column field="observacion" header="Observación" />
            <Column header="Acciones" body={accionesCuotaTemplate} />
          </DataTable>
        )}
      </Dialog>

      <Dialog
        header="Marcar cuota como no cobrada"
        visible={visibleNoCobrado}
        style={{ width: "520px", maxWidth: "95vw" }}
        modal
        onHide={() => setVisibleNoCobrado(false)}
      >
        <div className={styles.formGrid}>
          <div className={styles.notaImportante}>
            Para marcar una cuota como <strong>no cobrada</strong>, debe dejar una
            descripción del motivo.
          </div>

          <div className={styles.formRow}>
            <label>Motivo / descripción *</label>
            <InputTextarea
              value={observacionNoCobrado}
              onChange={(e) => setObservacionNoCobrado(e.target.value)}
              rows={4}
              autoResize
              placeholder="Ej: No figuró en la planilla de descuento del mes."
            />
          </div>

          <div className={styles.dialogFooter}>
            <Button
              label="Cancelar"
              icon="pi pi-times"
              className="p-button-secondary"
              onClick={() => setVisibleNoCobrado(false)}
              disabled={guardandoEstadoCuota}
            />

            <Button
              label="Guardar no cobrado"
              icon="pi pi-save"
              className="p-button-danger"
              onClick={guardarNoCobrado}
              loading={guardandoEstadoCuota}
            />
          </div>
        </div>
      </Dialog>
    </div>
  );
};

export default Servicios;