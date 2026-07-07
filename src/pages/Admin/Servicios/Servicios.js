// src/pages/Admin/Servicios/Servicios.js

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Dialog } from "primereact/dialog";
import { Toast } from "primereact/toast";
import { ProgressSpinner } from "primereact/progressspinner";
import { Button } from "primereact/button";
import { InputTextarea } from "primereact/inputtextarea";
import { InputText } from "primereact/inputtext";
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
  where,
  writeBatch,
} from "firebase/firestore";

import { db } from "../../../firebase/firebase-config";
import styles from "./servicios.module.css";

import {
  ServicioFormDialog,
  BusquedaGeneralServicios,
  DetalleServicioDialog,
  CuotasServicioDialog,
  AfiliadosMultiServicioPanel,
  CenaDocentePanel,
} from "../../../components/Servicios";
import AlertaAfiliadosDialog from "../../../components/Servicios/AlertaAfiliadosDialog";

const ESTADO_ACTIVO = "activo";
const ESTADO_INACTIVO = "inactivo";

const ESTADO_CUOTA_PENDIENTE = "pendiente";
const ESTADO_CUOTA_COBRADO = "cobrado";
const ESTADO_CUOTA_NO_COBRADO = "no_cobrado";
const ESTADO_CUOTA_DESCUENTO_PARCIAL = "descuento_parcial";
const ESTADO_CUOTA_CANCELADA = "cancelada";

const ESTADO_CONTRATACION_CANCELADA = "cancelada";

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

const obtenerCantidadPersonasContratacion = (contratacion) => {
  const posiblesCampos = [
    "cantidadLugares",
    "cantidadPersonas",
    "personas",
    "cantidadPasajeros",
    "lugaresReservados",
    "personasReservadas",
    "cantidadTarjetas",
  ];

  for (const campo of posiblesCampos) {
    const cantidad = parseNumeroEntero(contratacion?.[campo]);
    if (cantidad > 0) return cantidad;
  }

  return 1;
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

const parseDetalleCuotasExcel = (valor) => {
  const texto = limpiarTexto(valor);
  const textoLower = texto.toLowerCase();

  if (!texto) {
    return {
      cantidadCuotas: 0,
      valorCuota: 0,
      tipoPago: "cuotas",
      esContado: false,
    };
  }

  const esContado = /\bcontado\b|pago\s+total|cancelad[oa]\s+total/i.test(texto);
  const cantidadMatch = texto.match(/(\d+)\s*(?:cuota|cuotas|x)/i);
  const cantidadCuotasDetectada = cantidadMatch
    ? parseNumeroEntero(cantidadMatch[1])
    : 0;

  const importesEncontrados = texto.match(
    /\$?\s*(\d{1,3}(?:\.\d{3})+(?:,\d+)?|\d+(?:,\d+)?)/g
  );

  const posiblesImportes = (importesEncontrados || [])
    .map((item) => limpiarTexto(item))
    .filter((item) => {
      const soloNumero = parseNumeroEntero(item);
      return !(
        cantidadCuotasDetectada &&
        soloNumero === cantidadCuotasDetectada &&
        /^\D*\d+\D*$/.test(item)
      );
    })
    .map((item) => parseImporte(item))
    .filter((numero) => numero > 0);

  const valorCuota = posiblesImportes.length
    ? posiblesImportes[posiblesImportes.length - 1]
    : 0;

  return {
    cantidadCuotas: esContado ? 1 : cantidadCuotasDetectada,
    valorCuota,
    tipoPago: esContado ? "contado" : "cuotas",
    esContado,
    detalleNormalizado: textoLower,
  };
};

// Solo se usa para el servicio "Cena del Maestro" (también admite "Cena del
// Docente" por si cambia el nombre): parsea el texto libre del formulario de
// reserva, ej. "2 AFILIADO/A MÁS UN ACOMPAÑANTE - 7 CUOTAS DE $ 28.000" o
// "1 AFILIADO/A - 5 CUOTA DE $ 19.600", para determinar cuotas y valor real
// que eligió el afiliado (puede variar de un afiliado a otro).
const ES_SERVICIO_CENA = (servicio) =>
  servicio?.tipoEspecial === "cena_docente" ||
  /CENA\s+DEL\s+(MAESTRO|DOCENTE)/i.test(limpiarTexto(servicio?.nombre));

const parsePlanElegidoCena = (valor) => {
  const texto = limpiarTexto(valor);
  if (!texto) return null;

  const matchCuotas = texto.match(/(\d+)\s*CUOTAS?/i);
  const matchMonto = texto.match(/\$\s*([\d.,]+)/);

  if (!matchCuotas || !matchMonto) return null;

  const cantidadCuotas = parseNumeroEntero(matchCuotas[1]);
  const valorCuota = parseImporte(matchMonto[1]);

  if (cantidadCuotas <= 0 || valorCuota <= 0) return null;

  return { cantidadCuotas, valorCuota };
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
  const departamento = limpiarTexto(
    obtenerCampo(data, [
      "departamento",
      "Departamento",
      "departamentoLaboral",
      "depto",
      "Depto",
    ])
  );
  const telefono = limpiarTexto(
    obtenerCampo(data, [
      "celular",
      "Celular",
      "telefono",
      "Telefono",
      "tel",
      "telefonoContacto",
      "whatsapp",
    ])
  );

  return {
    dni,
    apellido,
    nombre,
    apellidoNombre,
    email,
    departamento,
    telefono,
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
  const [filtroEstadoContrataciones, setFiltroEstadoContrataciones] = useState(null);
  const [alertasServicios, setAlertasServicios] = useState({});
  const [visibleAlertaDialog, setVisibleAlertaDialog] = useState(false);
  const [alertaServicio, setAlertaServicio] = useState(null);
  const [alertaEstado, setAlertaEstado] = useState(null);
  const [filtroServicios, setFiltroServicios] = useState("");
  const [vistaServicios, setVistaServicios] = useState("panel");

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

  const [visibleParcial, setVisibleParcial] = useState(false);
  const [cuotaParaParcial, setCuotaParaParcial] = useState(null);
  const [importeParcial, setImporteParcial] = useState("");
  const [observacionParcial, setObservacionParcial] = useState("");

  const [eliminandoServicioId, setEliminandoServicioId] = useState(null);
  const [importandoAfiliados, setImportandoAfiliados] = useState(false);
  const [resultadoImportacionAfiliados, setResultadoImportacionAfiliados] =
    useState(null);
  const [importandoDescuentos, setImportandoDescuentos] = useState(false);

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

  const cargarAlertasServicios = useCallback(async () => {
    try {
      const snap = await getDocs(collectionGroup(db, "contrataciones"));
      const mapa = {};
      snap.docs.forEach((d) => {
        const data = d.data();
        if (data.esSubcontratacion) return;
        const svcId = data.servicioId;
        if (!svcId) return;
        if (!mapa[svcId]) mapa[svcId] = { parciales: 0, noCobrados: 0 };
        if (Number(data.cuotasParciales || 0) > 0) mapa[svcId].parciales += 1;
        if (Number(data.cuotasNoCobradas || 0) > 0) mapa[svcId].noCobrados += 1;
      });
      setAlertasServicios(mapa);
    } catch (error) {
      console.error("Error al cargar alertas:", error);
    }
  }, []);

  useEffect(() => {
    cargarServicios();
    cargarAlertasServicios();
  }, [cargarServicios, cargarAlertasServicios]);

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

      const principales = snap.docs.map((documento) => ({
        id: documento.id,
        esSubcontratacion: false,
        ...documento.data(),
      }));

      // Cargar subcontrataciones de cada contratacion principal
      const subcontratacionesCargadas = await Promise.all(
        principales.map(async (contratacion) => {
          try {
            const subSnap = await getDocs(
              collection(db, "servicios", servicioId, "contrataciones", contratacion.dni, "subcontrataciones")
            );
            return subSnap.docs.map((subDoc) => ({
              id: subDoc.id,
              subcontratacionId: subDoc.id,
              parentDni: contratacion.dni,
              esSubcontratacion: true,
              ...subDoc.data(),
            }));
          } catch {
            return [];
          }
        })
      );

      const todas = [
        ...principales,
        ...subcontratacionesCargadas.flat(),
      ].sort((a, b) =>
        limpiarTexto(a.apellidoNombre).localeCompare(limpiarTexto(b.apellidoNombre))
      );

      setContratacionesServicio(todas);
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

  const abrirDetalleConFiltroEstado = async (servicio, estado) => {
    setServicioSeleccionado(servicio);
    setVisibleDetalleServicio(true);
    setFiltroContrataciones("");
    setFiltroEstadoContrataciones(estado);
    setDniAfiliado("");
    setAfiliadoEncontrado(null);
    setPeriodoHaberInicial("");
    setResultadoImportacionAfiliados(null);
    await cargarContratacionesServicio(servicio.id);
  };

  const abrirDetalleServicio = async (servicio) => {
    setServicioSeleccionado(servicio);
    setVisibleDetalleServicio(true);
    setFiltroContrataciones("");
    setFiltroEstadoContrataciones(null);
    setDniAfiliado("");
    setAfiliadoEncontrado(null);
    setPeriodoHaberInicial("");
    setResultadoImportacionAfiliados(null);

    await cargarContratacionesServicio(servicio.id);
  };

  const seleccionarServicioDashboard = async (servicio) => {
    if (!servicio?.id) return;
    setServicioSeleccionado(servicio);
    setFiltroContrataciones("");
    setFiltroEstadoContrataciones(null);
    await cargarContratacionesServicio(servicio.id);
  };

  useEffect(() => {
    if (!servicioSeleccionado && servicios.length > 0) {
      const primerServicioPanel = servicios.find(
        (servicio) => !ES_SERVICIO_CENA(servicio)
      );
      if (primerServicioPanel) seleccionarServicioDashboard(primerServicioPanel);
    }
    // La selección inicial solo depende de la carga del catálogo.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [servicios, servicioSeleccionado]);

  const buscarAfiliadoEnColeccion = async (nombreColeccion, dni) => {
    // 1. Intento directo por ID de documento (más rápido, sin costo adicional)
    const docDirecto = await getDoc(doc(db, nombreColeccion, dni));
    if (docDirecto.exists()) {
      return construirAfiliadoDesdeDoc(docDirecto, dni, nombreColeccion);
    }

    // 2. Query indexada por cada variante de campo DNI (evita full-scan)
    const camposDni = ["dni", "DNI", "documento", "Documento", "cuil", "CUIL", "cuit", "CUIT"];
    const colRef = collection(db, nombreColeccion);

    for (const campo of camposDni) {
      try {
        const snap = await getDocs(query(colRef, where(campo, "==", dni)));
        if (!snap.empty) {
          return construirAfiliadoDesdeDoc(snap.docs[0], dni, nombreColeccion);
        }
      } catch {
        // El campo no existe o no tiene índice — continúa con el siguiente
      }
    }

    return null;
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

  // Devuelve el DocumentReference de una contratacion (principal o subcontratacion).
  // Usar en todas las funciones que necesiten acceder a cuotas/historial.
  const getContratacionRef = (contratacion) => {
    const { servicioId, dni, esSubcontratacion, subcontratacionId } = contratacion || {};
    if (esSubcontratacion && subcontratacionId) {
      return doc(db, "servicios", servicioId, "contrataciones", dni, "subcontrataciones", subcontratacionId);
    }
    return doc(db, "servicios", servicioId, "contrataciones", dni);
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
        importeDescontado: null,
        saldoPendiente: null,
        origenActualizacion: "inicial",
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
    datosImportacion = null,
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

    const datosExcel = datosImportacion || {};
    const detalleCuotasExcel = limpiarTexto(datosExcel.detalleCuotasExcel);
    const detalleCuotas = parseDetalleCuotasExcel(detalleCuotasExcel);

    // Solo para Cena del Docente: si el Excel trae "Plan elegido en formulario",
    // ese texto manda por sobre "Cuotas a descontar" y por sobre los valores
    // por defecto del servicio, porque cada afiliado puede haber elegido un
    // plan distinto (con o sin acompañante, 5 o 7 cuotas).
    const planCena = ES_SERVICIO_CENA(servicio)
      ? parsePlanElegidoCena(datosExcel.planElegidoFormulario)
      : null;

    const tipoPago = detalleCuotas.esContado ? "contado" : "cuotas";
    const cantidadCuotas = planCena
      ? planCena.cantidadCuotas
      : detalleCuotas.esContado
      ? 1
      : detalleCuotas.cantidadCuotas > 0
      ? detalleCuotas.cantidadCuotas
      : Number(servicio.cantidadCuotas || 0);

    const valorCuota = planCena
      ? planCena.valorCuota
      : detalleCuotas.valorCuota > 0
      ? detalleCuotas.valorCuota
      : Number(servicio.valorCuota || 0);

    if (cantidadCuotas <= 0 || valorCuota <= 0) {
      return {
        ok: false,
        estado: "error",
        dni,
        detalle:
          "No se pudo determinar la cantidad de cuotas o el valor de cuota.",
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
    const periodoCobroInicial = sumarMesesPeriodo(periodoHaber, 1);
    const cantidadPersonas = Math.max(
      1,
      parseNumeroEntero(datosExcel.cantidadPersonas)
    );

    const contratacionPayload = {
      dni,
      apellido: afiliado.apellido || datosExcel.apellido || "",
      nombre: afiliado.nombre || datosExcel.nombre || "",
      apellidoNombre:
        afiliado.apellidoNombre ||
        datosExcel.apellidoNombre ||
        "Sin nombre registrado",
      email: afiliado.email || "",
      origenAfiliado: afiliado.origen || "",
      registradoApp: afiliado.registradoApp !== false && afiliado.origen !== "no_registrado",
      origenApp: afiliado.origen || "no_registrado",

      servicioId: servicio.id,
      servicioNombre: servicio.nombre,

      cantidadCuotas,
      valorCuota,

      periodoHaberInicial: periodoHaber,
      periodoCobroInicial,
      periodoHaberInicialTexto: periodoHaberTexto(periodoHaber),
      periodoCobroInicialTexto: periodoCobroTexto(periodoCobroInicial),

      cuotasCobradas: tipoPago === "contado" ? 1 : 0,
      cuotasParciales: 0,
      cuotasNoCobradas: 0,
      cuotasCanceladas: 0,
      cuotasPendientes: tipoPago === "contado" ? 0 : cantidadCuotas,
      valorTotalContratacion: cantidadCuotas * valorCuota,
      totalDescontadoContratacion:
        tipoPago === "contado" ? valorCuota : 0,
      saldoPendienteContratacion: 0,

      estado: ESTADO_ACTIVO,
      estadoContratacion: tipoPago === "contado" ? "finalizada" : ESTADO_ACTIVO,
      cancelado: false,
      tipoPago,
      esPagoContado: tipoPago === "contado",
      observacionGeneral: limpiarTexto(observacionGeneral),

      importadoDesdeExcel: !!datosExcel.importadoDesdeExcel,
      filaExcel: datosExcel.fila || "",
      apellidoExcel: limpiarTexto(datosExcel.apellido),
      nombreExcel: limpiarTexto(datosExcel.nombre),
      apellidoNombreExcel: limpiarTexto(datosExcel.apellidoNombre),
      departamentoServicio:
        limpiarTexto(datosExcel.departamento) ||
        limpiarTexto(afiliado.departamento),
      telefonoContacto:
        limpiarTexto(datosExcel.telefonoContacto) ||
        limpiarTexto(afiliado.telefono),
      cantidadPersonas,
      cantidadLugares: cantidadPersonas,
      detalleCuotasExcel,
      cantidadCuotasExcel: detalleCuotas.cantidadCuotas || null,
      valorCuotaExcel: detalleCuotas.valorCuota || null,
      tipoPagoExcel: detalleCuotas.tipoPago || "cuotas",
      usaValoresDesdeExcel: detalleCuotas.valorCuota > 0 || !!planCena,
      planElegidoFormulario: limpiarTexto(datosExcel.planElegidoFormulario),
      usaPlanCena: !!planCena,
      observacionExcel: limpiarTexto(datosExcel.observacion),

      creadoEn: serverTimestamp(),
      actualizadoEn: serverTimestamp(),
    };

    const cuotasBase = generarCuotas({
      cantidadCuotas,
      valorCuota,
      periodoHaberInicial: periodoHaber,
    });

    const cuotas = tipoPago === "contado"
      ? cuotasBase.map((cuota, index) =>
          index === 0
            ? {
                ...cuota,
                estado: ESTADO_CUOTA_COBRADO,
                observacion: "Pago de contado registrado desde Excel.",
                importeDescontado: valorCuota,
                saldoPendiente: 0,
                origenActualizacion: "pago_contado_excel",
                fechaRegistroCobro: serverTimestamp(),
                actualizadoEn: serverTimestamp(),
              }
            : cuota
        )
      : cuotasBase;

    const batch = writeBatch(db);

    if (existente.exists()) {
      if (!datosExcel.importadoDesdeExcel) {
        return {
          ok: false,
          estado: "duplicado",
          dni,
          detalle: "El afiliado ya tiene contratado este servicio.",
        };
      }

      const tipoExistente = existente.data()?.tipoPago || "cuotas";

      // tipoPago diferente → manejar combinación cuotas + contado
      if (tipoExistente !== tipoPago) {
        const subColRef = collection(db, "servicios", servicio.id, "contrataciones", dni, "subcontrataciones");

        // Cuotas siempre es la contratación primaria. Si el primario actual es "contado"
        // y la nueva fila es "cuotas", hay que hacer un swap: mover contado a sub y
        // sobrescribir el primario con cuotas.
        if (tipoExistente === "contado" && tipoPago === "cuotas") {
          const subSnap = await getDocs(subColRef);
          const subContadoExistente = subSnap.docs.find((d) => (d.data()?.tipoPago || "cuotas") === "contado");
          const swapBatch = writeBatch(db);
          let subContadoRef;

          if (!subContadoExistente) {
            subContadoRef = doc(subColRef);
            swapBatch.set(subContadoRef, { ...existente.data(), esSubcontratacion: true, parentDni: dni });

            // Migrar las cuotas del contado al nuevo sub
            const cuotasContadoSnap = await getDocs(
              collection(db, "servicios", servicio.id, "contrataciones", dni, "cuotas")
            );
            cuotasContadoSnap.docs.forEach((cuotaDoc) => {
              swapBatch.set(doc(collection(subContadoRef, "cuotas"), cuotaDoc.id), cuotaDoc.data());
            });
          } else {
            subContadoRef = subContadoExistente.ref;
          }

          // Sobrescribir el primario con la contratación de cuotas
          swapBatch.set(contratacionRef, contratacionPayload);
          cuotas.forEach((cuota) => {
            swapBatch.set(doc(db, "servicios", servicio.id, "contrataciones", dni, "cuotas", cuota.id), cuota);
          });

          await swapBatch.commit();
          await recalcularResumenContratacion({ servicioId: servicio.id, dni });
          if (!subContadoExistente) {
            await recalcularResumenContratacion({
              servicioId: servicio.id,
              dni,
              esSubcontratacion: true,
              subcontratacionId: subContadoRef.id,
            });
          }

          return {
            ok: true,
            estado: "creado",
            dni,
            detalle: "Contratación de cuotas establecida como principal. El pago de contado fue registrado como contrato adicional.",
          };
        }

        // Caso normal: primario es "cuotas", nueva fila es "contado" → contado va como sub
        const subSnap = await getDocs(subColRef);
        const subExistente = subSnap.docs.find((d) => (d.data()?.tipoPago || "cuotas") === tipoPago);
        const subRef = subExistente ? subExistente.ref : doc(subColRef);

        const subPayload = { ...contratacionPayload, esSubcontratacion: true, parentDni: dni };
        const subBatch = writeBatch(db);

        if (subExistente) {
          const { creadoEn: _c, cuotasCobradas: _cb, cuotasParciales: _cp, cuotasNoCobradas: _cn,
                  cuotasCanceladas: _ca, cuotasPendientes: _pe, estado: _e, estadoContratacion: _ec,
                  cancelado: _can, ...payloadSubActualizacion } = subPayload;
          subBatch.update(subRef, payloadSubActualizacion);
        } else {
          subBatch.set(subRef, subPayload);
        }

        cuotas.forEach((cuota) => {
          const cuotaSubRef = doc(collection(subRef, "cuotas"), cuota.id);
          subBatch.set(cuotaSubRef, {
            numeroCuota: cuota.numeroCuota,
            etiquetaCuota: cuota.etiquetaCuota,
            periodoHaber: cuota.periodoHaber,
            periodoHaberTexto: cuota.periodoHaberTexto,
            periodoCobro: cuota.periodoCobro,
            periodoCobroTexto: cuota.periodoCobroTexto,
            valorCuota,
            ...(tipoPago === "contado"
              ? {
                  estado: ESTADO_CUOTA_COBRADO,
                  observacion: "Pago de contado registrado desde Excel.",
                  importeDescontado: valorCuota,
                  saldoPendiente: 0,
                  origenActualizacion: "pago_contado_excel",
                  fechaRegistroCobro: serverTimestamp(),
                }
              : {}),
            actualizadoEn: serverTimestamp(),
          }, { merge: !!subExistente });
        });

        await subBatch.commit();
        await recalcularResumenContratacion({
          servicioId: servicio.id,
          dni,
          esSubcontratacion: true,
          subcontratacionId: subRef.id,
        });

        return {
          ok: true,
          estado: subExistente ? "actualizado" : "creado",
          dni,
          detalle: subExistente
            ? `Subcontratación (${tipoPago}) actualizada con el detalle del Excel.`
            : `Subcontratación (${tipoPago}) creada correctamente para el afiliado.`,
        };
      }

      const {
        creadoEn,
        cuotasCobradas,
        cuotasParciales,
        cuotasNoCobradas,
        cuotasCanceladas,
        cuotasPendientes,
        estado,
        estadoContratacion,
        cancelado,
        ...payloadActualizacion
      } = contratacionPayload;

      batch.update(contratacionRef, payloadActualizacion);

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

        batch.set(
          cuotaRef,
          {
            numeroCuota: cuota.numeroCuota,
            etiquetaCuota: cuota.etiquetaCuota,
            periodoHaber: cuota.periodoHaber,
            periodoHaberTexto: cuota.periodoHaberTexto,
            periodoCobro: cuota.periodoCobro,
            periodoCobroTexto: cuota.periodoCobroTexto,
            valorCuota,
            ...(tipoPago === "contado"
              ? {
                  estado: ESTADO_CUOTA_COBRADO,
                  observacion: "Pago de contado registrado desde Excel.",
                  importeDescontado: valorCuota,
                  saldoPendiente: 0,
                  origenActualizacion: "pago_contado_excel",
                  fechaRegistroCobro: serverTimestamp(),
                }
              : {}),
            actualizadoEn: serverTimestamp(),
          },
          { merge: true }
        );
      });

      const cuotasExistentesSnap = await getDocs(
        collection(db, "servicios", servicio.id, "contrataciones", dni, "cuotas")
      );

      cuotasExistentesSnap.docs.forEach((cuotaExistenteDoc) => {
        const numeroCuotaExistente = Number(
          cuotaExistenteDoc.data()?.numeroCuota || cuotaExistenteDoc.id || 0
        );

        if (numeroCuotaExistente > cantidadCuotas) {
          batch.delete(cuotaExistenteDoc.ref);
        }
      });

      await batch.commit();
      await recalcularResumenContratacion({ servicioId: servicio.id, dni });

      return {
        ok: true,
        estado: "actualizado",
        dni,
        detalle: "La contratación existente fue actualizada con el detalle del Excel.",
      };
    }

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
    setResultadoImportacionAfiliados(null);

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
    let actualizados = 0;
    let duplicados = 0;
    let noEncontrados = 0;
    let errores = 0;

    const detallesImportacion = [];

    const registrarDetalle = ({
      fila,
      dni,
      apellido,
      nombre,
      apellidoNombre,
      estado,
      motivo,
    }) => {
      const apellidoLimpio = limpiarTexto(apellido);
      const nombreLimpio = limpiarTexto(nombre);
      const afiliadoLimpio =
        limpiarTexto(apellidoNombre) ||
        limpiarTexto(`${apellidoLimpio} ${nombreLimpio}`) ||
        "Sin nombre en Excel";

      detallesImportacion.push({
        fila: fila || "-",
        dni: dni || "-",
        apellido: apellidoLimpio || "-",
        nombre: nombreLimpio || "-",
        afiliado: afiliadoLimpio,
        estado,
        motivo,
      });
    };

    const procesarFila = async (fila) => {
      const dni = normalizarDni(fila.dni);
      const apellidoExcel = limpiarTexto(fila.apellido);
      const nombreExcel = limpiarTexto(fila.nombre);
      const apellidoNombreExcel =
        limpiarTexto(fila.apellidoNombre) ||
        limpiarTexto(`${apellidoExcel} ${nombreExcel}`);

      if (!dni) {
        return {
          tipo: "error",
          detalle: {
            fila: fila.fila,
            dni: "-",
            apellido: apellidoExcel,
            nombre: nombreExcel,
            apellidoNombre: apellidoNombreExcel,
            estado: "error",
            motivo: "Fila sin DNI. No se pudo validar el afiliado.",
          },
        };
      }

      const afiliado = await buscarAfiliadoPorDniValor(dni);

      const afiliadoAdministrativo = afiliado || {
        dni,
        apellido: apellidoExcel,
        nombre: nombreExcel,
        apellidoNombre:
          apellidoNombreExcel ||
          limpiarTexto(`${apellidoExcel} ${nombreExcel}`) ||
          "Sin nombre registrado",
        email: "",
        telefono: limpiarTexto(fila.telefonoContacto),
        departamento: limpiarTexto(fila.departamento),
        origen: "no_registrado",
        registradoApp: false,
      };

      const afiliadoParaGuardar = {
        ...afiliadoAdministrativo,
        apellido: afiliadoAdministrativo.apellido || apellidoExcel,
        nombre: afiliadoAdministrativo.nombre || nombreExcel,
        apellidoNombre:
          afiliadoAdministrativo.apellidoNombre &&
          afiliadoAdministrativo.apellidoNombre !== "Sin nombre registrado"
            ? afiliadoAdministrativo.apellidoNombre
            : apellidoNombreExcel || afiliadoAdministrativo.apellidoNombre,
      };

      const observacionGeneral = [
        limpiarTexto(fila.observacion),
        limpiarTexto(fila.detalleCuotasExcel)
          ? `Cuotas Excel: ${limpiarTexto(fila.detalleCuotasExcel)}`
          : "",
        limpiarTexto(fila.cantidadPersonas)
          ? `Personas que viajan: ${limpiarTexto(fila.cantidadPersonas)}`
          : "",
        limpiarTexto(fila.telefonoContacto)
          ? `Teléfono: ${limpiarTexto(fila.telefonoContacto)}`
          : "",
        limpiarTexto(fila.departamento)
          ? `Departamento: ${limpiarTexto(fila.departamento)}`
          : "",
      ]
        .filter(Boolean)
        .join(" | ");

      const resultado = await crearContratacionAfiliado({
        servicio,
        afiliado: afiliadoParaGuardar,
        periodoHaber,
        observacionGeneral,
        datosImportacion: {
          importadoDesdeExcel: true,
          fila: fila.fila || "",
          apellido: apellidoExcel,
          nombre: nombreExcel,
          apellidoNombre: apellidoNombreExcel,
          departamento: fila.departamento || "",
          telefonoContacto: fila.telefonoContacto || "",
          cantidadPersonas: fila.cantidadPersonas || "",
          detalleCuotasExcel: fila.detalleCuotasExcel || "",
          planElegidoFormulario: fila.planElegidoFormulario || "",
          observacion: fila.observacion || "",
        },
      });

      const afiliadoMostrado =
        afiliadoParaGuardar.apellidoNombre || apellidoNombreExcel || afiliado?.apellidoNombre;
      const apellidoResultado = limpiarTexto(afiliadoParaGuardar.apellido || apellidoExcel);
      const nombreResultado = limpiarTexto(afiliadoParaGuardar.nombre || nombreExcel);
      const esNoRegistradoApp =
        afiliadoParaGuardar.registradoApp === false ||
        afiliadoParaGuardar.origen === "no_registrado";

      return {
        tipo: resultado.estado,
        detalle: {
          fila: fila.fila,
          dni,
          apellido: apellidoResultado,
          nombre: nombreResultado,
          apellidoNombre: afiliadoMostrado,
          estado: resultado.estado === "creado" || resultado.estado === "actualizado"
            ? resultado.estado
            : resultado.estado === "duplicado"
            ? "duplicado"
            : "error",
          motivo:
            resultado.estado === "creado"
              ? esNoRegistradoApp
                ? "DNI no registrado en app, cargado para control administrativo."
                : "Afiliado cargado correctamente."
              : resultado.estado === "actualizado"
              ? esNoRegistradoApp
                ? "DNI no registrado en app, actualizado para control administrativo."
                : "Afiliado ya existente actualizado correctamente."
              : resultado.detalle || "No se pudo cargar el afiliado.",
        },
      };
    };

    try {
      // Agrupar por DNI: mismo DNI se procesa en secuencia para evitar race condition.
      // Dentro de cada grupo, las filas de "cuotas" van antes que las de "contado".
      const porDni = new Map();
      for (const fila of filas) {
        const dniKey = normalizarDni(fila.dni || "") || String(fila.dni || "");
        if (!porDni.has(dniKey)) porDni.set(dniKey, []);
        porDni.get(dniKey).push(fila);
      }
      const grupos = Array.from(porDni.values()).map((grupo) =>
        [...grupo].sort((a, b) => {
          const aCont = parseDetalleCuotasExcel(limpiarTexto(a.detalleCuotasExcel || "")).esContado ? 1 : 0;
          const bCont = parseDetalleCuotasExcel(limpiarTexto(b.detalleCuotasExcel || "")).esContado ? 1 : 0;
          return aCont - bCont;
        })
      );

      const TAMANO_LOTE = 10;
      for (let i = 0; i < grupos.length; i += TAMANO_LOTE) {
        const loteGrupos = grupos.slice(i, i + TAMANO_LOTE);
        const resultadosGrupos = await Promise.all(
          loteGrupos.map(async (grupo) => {
            const resGrupo = [];
            for (const fila of grupo) {
              resGrupo.push(await procesarFila(fila));
            }
            return resGrupo;
          })
        );
        for (const grupoRes of resultadosGrupos) {
          for (const res of grupoRes) {
            detallesImportacion.push(res.detalle);
            if (res.tipo === "creado") creados += 1;
            else if (res.tipo === "actualizado") actualizados += 1;
            else if (res.tipo === "duplicado") duplicados += 1;
            else if (res.tipo === "no_encontrado") noEncontrados += 1;
            else errores += 1;
          }
        }
      }

      setResultadoImportacionAfiliados({
        resumen: {
          totalProcesados: filas.length,
          creados,
          actualizados,
          duplicados,
          noEncontrados,
          errores,
        },
        detalles: detallesImportacion,
      });

      const huboObservaciones = duplicados > 0 || noEncontrados > 0 || errores > 0;
      const afiliadosNoCargadosToast = detallesImportacion.filter((item) =>
        ["no_encontrado", "duplicado", "error"].includes(item.estado)
      );
      const detalleAfiliadosNoCargados = afiliadosNoCargadosToast
        .slice(0, 5)
        .map((item) => {
          const nombreCompleto =
            limpiarTexto(`${item.apellido || ""} ${item.nombre || ""}`) ||
            limpiarTexto(item.afiliado);

          return `${nombreCompleto} - DNI ${item.dni}`;
        })
        .join(" | ");
      const textoAfiliadosNoCargados = detalleAfiliadosNoCargados
        ? ` No cargados: ${detalleAfiliadosNoCargados}${
            afiliadosNoCargadosToast.length > 5
              ? ` y ${afiliadosNoCargadosToast.length - 5} más.`
              : "."
          }`
        : "";

      toast.current?.show({
        severity: huboObservaciones ? "warn" : "success",
        summary: "Importación finalizada",
        detail: `Creados: ${creados}. Actualizados: ${actualizados}. Duplicados: ${duplicados}. No encontrados: ${noEncontrados}. Errores: ${errores}.${textoAfiliadosNoCargados}`,
        life: 15000,
      });

      await cargarContratacionesServicio(servicio.id);
      cargarAlertasServicios();
    } catch (error) {
      console.error("Error al importar Excel:", error);

      setResultadoImportacionAfiliados({
        resumen: {
          totalProcesados: filas.length,
          creados,
          actualizados,
          duplicados,
          noEncontrados,
          errores: errores + 1,
        },
        detalles: [
          ...detallesImportacion,
          {
            fila: "-",
            dni: "-",
            apellido: "-",
            nombre: "-",
            afiliado: "Error general de importación",
            estado: "error",
            motivo:
              "No se pudo completar la importación del Excel. Revisar consola o formato del archivo.",
          },
        ],
      });

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
      const snap = await getDocs(collection(getContratacionRef(contratacion), "cuotas"));

      let items = snap.docs
        .map((documento) => ({
          id: documento.id,
          ref: documento.ref,
          ...documento.data(),
        }))
        .sort((a, b) => Number(a.numeroCuota || 0) - Number(b.numeroCuota || 0));

      const extrasConPeriodoIncorrecto = items.filter((cuota) => {
        const esExtra =
          cuota.origenActualizacion === "manual_extra" ||
          cuota.esRegularizacionDeuda === true ||
          String(cuota.etiquetaCuota || "").toUpperCase() === "EXTRA";
        const periodoHaberCorrecto = sumarMesesPeriodo(
          cuota.periodoCobro,
          -1
        );

        return (
          esExtra &&
          periodoHaberCorrecto &&
          cuota.periodoHaber !== periodoHaberCorrecto
        );
      });

      if (extrasConPeriodoIncorrecto.length > 0) {
        const batchPeriodosExtra = writeBatch(db);

        extrasConPeriodoIncorrecto.forEach((cuota) => {
          const periodoHaber = sumarMesesPeriodo(cuota.periodoCobro, -1);
          batchPeriodosExtra.set(
            cuota.ref,
            {
              periodoHaber,
              periodoHaberTexto: periodoHaberTexto(periodoHaber),
              actualizadoEn: serverTimestamp(),
            },
            { merge: true }
          );
        });

        await batchPeriodosExtra.commit();
        items = items.map((cuota) => {
          const debeCorregirse = extrasConPeriodoIncorrecto.some(
            (extra) => extra.id === cuota.id
          );
          if (!debeCorregirse) return cuota;

          const periodoHaber = sumarMesesPeriodo(cuota.periodoCobro, -1);
          return {
            ...cuota,
            periodoHaber,
            periodoHaberTexto: periodoHaberTexto(periodoHaber),
          };
        });
      }

      const servicioCatalogo = servicios.find(
        (servicio) => servicio.id === contratacion.servicioId
      );
      const valorCatalogo = Number(servicioCatalogo?.valorCuota || 0);
      const candidatosUnitarios = items
        .map((cuota) => {
          const cantidadComponentes = Array.isArray(
            cuota.componentesLugares
          )
            ? cuota.componentesLugares.length
            : 0;

          if (cantidadComponentes <= 0) {
            return Number(cuota.valorCuota || 0);
          }

          return Number(cuota.valorCuota || 0) / cantidadComponentes;
        })
        .filter((valor) => valor > 0);
      const valorInferido =
        candidatosUnitarios.length > 0
          ? Math.min(...candidatosUnitarios)
          : 0;
      const valorPorLugar =
        valorCatalogo ||
        valorInferido ||
        Number(contratacion.valorCuotaBase || contratacion.valorCuota || 0);
      const requiereNormalizacion =
        valorPorLugar > 0 &&
        (Number(
          contratacion.valorCuotaBase || contratacion.valorCuota || 0
        ) !== valorPorLugar ||
          items.some((cuota) => {
            const componentes = Array.isArray(cuota.componentesLugares)
              ? cuota.componentesLugares
              : [];
            return (
              componentes.length > 0 &&
              Number(cuota.valorCuota || 0) !==
                componentes.length * valorPorLugar
            );
          }));

      if (requiereNormalizacion) {
        const batch = writeBatch(db);

        items = items.map((cuota) => {
          const componentes = Array.isArray(cuota.componentesLugares)
            ? cuota.componentesLugares
            : [];

          if (componentes.length === 0) return cuota;

          const componentesLugares = componentes.map((componente) => ({
            ...componente,
            valor: valorPorLugar,
          }));
          const valorCuota = componentesLugares.length * valorPorLugar;
          const importeDescontado = Number(cuota.importeDescontado || 0);
          const saldoActualizado =
            cuota.estado === ESTADO_CUOTA_DESCUENTO_PARCIAL ||
            cuota.estado === ESTADO_CUOTA_NO_COBRADO
              ? {
                  saldoPendiente: Math.max(
                    0,
                    valorCuota - importeDescontado
                  ),
                }
              : {};

          batch.set(
            cuota.ref,
            {
              valorCuota,
              componentesLugares,
              cantidadLugaresPeriodo: componentesLugares.length,
              ...saldoActualizado,
              actualizadoEn: serverTimestamp(),
            },
            { merge: true }
          );

          return {
            ...cuota,
            valorCuota,
            componentesLugares,
            ...saldoActualizado,
          };
        });

        batch.update(getContratacionRef(contratacion), {
          valorCuota: valorPorLugar,
          valorCuotaBase: valorPorLugar,
          actualizadoEn: serverTimestamp(),
        });
        await batch.commit();

        setContratacionSeleccionada((prev) =>
          prev?.id === contratacion.id
            ? {
                ...prev,
                valorCuota: valorPorLugar,
                valorCuotaBase: valorPorLugar,
              }
            : prev
        );
      }

      const cuotaExtraCobrada = items.find(
        (cuota) =>
          cuota.origenActualizacion === "manual_extra" &&
          cuota.estado === ESTADO_CUOTA_COBRADO
      );
      const deudasSinRegularizar = items.filter(
        (cuota) =>
          cuota.id !== cuotaExtraCobrada?.id &&
          !cuota.deudaRegularizada &&
          Number(cuota.saldoPendiente || 0) > 0 &&
          [
            ESTADO_CUOTA_DESCUENTO_PARCIAL,
            ESTADO_CUOTA_NO_COBRADO,
          ].includes(cuota.estado)
      );

      if (cuotaExtraCobrada && deudasSinRegularizar.length > 0) {
        const batchRegularizacion = writeBatch(db);

        deudasSinRegularizar.forEach((cuota) => {
          batchRegularizacion.update(cuota.ref, {
            saldoPendiente: 0,
            deudaRegularizada: true,
            regularizacionPendiente: false,
            cuotaRegularizacionId: cuotaExtraCobrada.id,
            observacionRegularizacion: `Saldo regularizado mediante la cuota extra ${cuotaExtraCobrada.numeroCuota || cuotaExtraCobrada.id}.`,
            saldoRegularizado: Number(cuota.saldoPendiente || 0),
            fechaRegularizacion: serverTimestamp(),
            actualizadoEn: serverTimestamp(),
          });
        });
        batchRegularizacion.set(
          doc(collection(getContratacionRef(contratacion), "historial")),
          {
            accion: "regularizar_saldos_pendientes_migracion",
            cuotaRegularizacionId: cuotaExtraCobrada.id,
            cuotasRegularizadas: deudasSinRegularizar.map(
              (cuota) => cuota.id
            ),
            fecha: serverTimestamp(),
          }
        );
        await batchRegularizacion.commit();

        items = items.map((cuota) =>
          deudasSinRegularizar.some((deuda) => deuda.id === cuota.id)
            ? {
                ...cuota,
                saldoPendiente: 0,
                deudaRegularizada: true,
                regularizacionPendiente: false,
                cuotaRegularizacionId: cuotaExtraCobrada.id,
              }
            : cuota
        );

        const resumen = await recalcularResumenContratacion(contratacion);
        setContratacionSeleccionada((prev) =>
          prev?.id === contratacion.id ? { ...prev, ...resumen } : prev
        );
        if (servicioSeleccionado?.id === contratacion.servicioId) {
          await cargarContratacionesServicio(contratacion.servicioId);
        }
        cargarAlertasServicios();
      }

      const resumenActualizado = await recalcularResumenContratacion(
        contratacion
      );
      setContratacionSeleccionada((prev) =>
        prev?.id === contratacion.id
          ? { ...prev, ...resumenActualizado }
          : prev
      );
      setContratacionesServicio((prev) =>
        prev.map((item) =>
          item.id === contratacion.id &&
          item.subcontratacionId === contratacion.subcontratacionId
            ? { ...item, ...resumenActualizado }
            : item
        )
      );

      setCuotasContratacion(
        items.map(({ ref: _ref, ...cuota }) => cuota)
      );
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
    const contRef = getContratacionRef(contratacion);
    const snap = await getDocs(collection(contRef, "cuotas"));

    let cuotasCobradas = 0;
    let cuotasParciales = 0;
    let cuotasNoCobradas = 0;
    let cuotasCanceladas = 0;
    let cuotasPendientes = 0;
    let valorTotalContratacion = 0;
    let totalDescontadoContratacion = 0;
    let saldoPendienteContratacion = 0;

    snap.docs.forEach((documento) => {
      const data = documento.data();
      const estado = data?.estado;
      const consolidada =
        data?.deudaRegularizada === true ||
        data?.regularizacionPendiente === true;
      const esCuotaRegularizacion =
        data?.origenActualizacion === "manual_extra" ||
        data?.esRegularizacionDeuda === true ||
        String(data?.etiquetaCuota || "").toUpperCase() === "EXTRA";

      if (!esCuotaRegularizacion) {
        valorTotalContratacion += Number(data?.valorCuota || 0);
      }
      totalDescontadoContratacion += Number(data?.importeDescontado || 0);
      if (!consolidada) {
        saldoPendienteContratacion += Number(data?.saldoPendiente || 0);
      }

      if (estado === ESTADO_CUOTA_COBRADO) cuotasCobradas += 1;
      else if (
        estado === ESTADO_CUOTA_DESCUENTO_PARCIAL &&
        !consolidada
      ) {
        cuotasParciales += 1;
      } else if (estado === ESTADO_CUOTA_NO_COBRADO && !consolidada) {
        cuotasNoCobradas += 1;
      }
      else if (estado === ESTADO_CUOTA_CANCELADA) cuotasCanceladas += 1;
      else if (!consolidada) cuotasPendientes += 1;
    });

    const resumen = {
      cuotasCobradas,
      cuotasParciales,
      cuotasNoCobradas,
      cuotasCanceladas,
      cuotasPendientes,
      valorTotalContratacion,
      totalDescontadoContratacion,
      saldoPendienteContratacion,
      actualizadoEn: serverTimestamp(),
    };

    await updateDoc(getContratacionRef(contratacion), resumen);

    return resumen;
  };

  const construirPayloadEstadoCuota = ({
    cuota,
    estadoNuevo,
    observacion = "",
    importeDescontado = null,
    origenActualizacion = "manual",
  }) => {
    const valorCuota = Number(cuota?.valorCuota || 0);
    const importe =
      importeDescontado === null || importeDescontado === undefined
        ? null
        : Number(importeDescontado || 0);

    if (estadoNuevo === ESTADO_CUOTA_COBRADO) {
      return {
        estado: estadoNuevo,
        observacion: limpiarTexto(observacion),
        importeDescontado: valorCuota,
        saldoPendiente: 0,
        origenActualizacion,
        fechaRegistroCobro: serverTimestamp(),
        actualizadoEn: serverTimestamp(),
      };
    }

    if (estadoNuevo === ESTADO_CUOTA_DESCUENTO_PARCIAL) {
      const importeParcialNumero = Number(importe || 0);

      return {
        estado: estadoNuevo,
        observacion: limpiarTexto(observacion),
        importeDescontado: importeParcialNumero,
        saldoPendiente: Math.max(valorCuota - importeParcialNumero, 0),
        origenActualizacion,
        fechaRegistroCobro: serverTimestamp(),
        actualizadoEn: serverTimestamp(),
      };
    }

    if (estadoNuevo === ESTADO_CUOTA_NO_COBRADO) {
      return {
        estado: estadoNuevo,
        observacion: limpiarTexto(observacion),
        importeDescontado: 0,
        saldoPendiente: valorCuota,
        origenActualizacion,
        fechaRegistroCobro: serverTimestamp(),
        actualizadoEn: serverTimestamp(),
      };
    }

    if (estadoNuevo === ESTADO_CUOTA_CANCELADA) {
      return {
        estado: estadoNuevo,
        observacion: limpiarTexto(observacion) || "Cancelado.",
        importeDescontado: Number(cuota?.importeDescontado || 0),
        saldoPendiente: 0,
        origenActualizacion,
        fechaRegistroCobro: null,
        fechaCancelacion: serverTimestamp(),
        actualizadoEn: serverTimestamp(),
      };
    }

    return {
      estado: ESTADO_CUOTA_PENDIENTE,
      observacion: "",
      importeDescontado: null,
      saldoPendiente: null,
      origenActualizacion,
      fechaRegistroCobro: null,
      actualizadoEn: serverTimestamp(),
    };
  };

  const actualizarEstadoCuota = async (
    contratacion,
    cuota,
    estadoNuevo,
    observacion = "",
    opciones = {}
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

    const importeDescontado = parseImporte(opciones.importeDescontado);

    if (
      estadoNuevo === ESTADO_CUOTA_DESCUENTO_PARCIAL &&
      importeDescontado <= 0
    ) {
      toast.current?.show({
        severity: "warn",
        summary: "Importe obligatorio",
        detail: "Ingrese el importe descontado parcialmente.",
      });
      return;
    }

    setGuardandoEstadoCuota(true);

    try {
      const estadoAnterior = cuota.estado || ESTADO_CUOTA_PENDIENTE;
      const esRegistroRegularizacion =
        cuota.origenActualizacion === "manual_extra" ||
        cuota.esRegularizacionDeuda === true ||
        String(cuota.etiquetaCuota || "").toUpperCase() === "EXTRA";
      const payloadEstado = construirPayloadEstadoCuota({
        cuota,
        estadoNuevo,
        observacion,
        importeDescontado:
          estadoNuevo === ESTADO_CUOTA_DESCUENTO_PARCIAL
            ? importeDescontado
            : null,
        origenActualizacion:
          esRegistroRegularizacion
            ? "manual_extra"
            : opciones.origenActualizacion || "manual",
      });

      const contRef = getContratacionRef(contratacion);
      const cuotaRef = doc(collection(contRef, "cuotas"), cuota.id);
      const esCuotaRegularizacion =
        esRegistroRegularizacion &&
        estadoNuevo === ESTADO_CUOTA_COBRADO;

      if (esCuotaRegularizacion) {
        const cuotasSnap = await getDocs(collection(contRef, "cuotas"));
        const idsVinculados = Array.isArray(cuota.regularizaCuotasIds)
          ? cuota.regularizaCuotasIds
          : [];
        const documentosPorId = new Map(
          cuotasSnap.docs.map((documento) => [documento.id, documento])
        );
        const fuentesPorId = new Map();
        const agregarFuenteYAntecedentes = (id) => {
          if (!id || id === cuota.id || fuentesPorId.has(id)) return;

          const documento = documentosPorId.get(id);
          if (!documento) return;

          fuentesPorId.set(id, documento);
          const idsAnteriores = Array.isArray(
            documento.data()?.regularizaCuotasIds
          )
            ? documento.data().regularizaCuotasIds
            : [];
          idsAnteriores.forEach(agregarFuenteYAntecedentes);
        };

        if (idsVinculados.length > 0) {
          idsVinculados.forEach(agregarFuenteYAntecedentes);
        } else {
          cuotasSnap.docs
            .filter((documento) => {
              if (documento.id === cuota.id) return false;
              const data = documento.data();
              return (
                !data.deudaRegularizada &&
                Number(data.saldoPendiente || 0) > 0 &&
                [
                  ESTADO_CUOTA_DESCUENTO_PARCIAL,
                  ESTADO_CUOTA_NO_COBRADO,
                ].includes(data.estado)
              );
            })
            .forEach((documento) =>
              agregarFuenteYAntecedentes(documento.id)
            );
        }
        const fuentes = Array.from(fuentesPorId.values());
        const fuentesDirectas = idsVinculados
          .map((id) => documentosPorId.get(id))
          .filter(Boolean);
        const batch = writeBatch(db);

        batch.update(cuotaRef, {
          ...payloadEstado,
          regularizacionCompletada: true,
          fechaRegularizacion: serverTimestamp(),
        });

        fuentes.forEach((documento) => {
          const data = documento.data();
          batch.update(documento.ref, {
            saldoPendiente: 0,
            deudaRegularizada: true,
            regularizacionPendiente: false,
            cuotaRegularizacionId: cuota.id,
            observacionRegularizacion: `Saldo regularizado mediante la cuota extra ${cuota.numeroCuota || cuota.id}.`,
            saldoRegularizado: Number(data.saldoPendiente || 0),
            fechaRegularizacion: serverTimestamp(),
            actualizadoEn: serverTimestamp(),
          });
        });

        batch.set(doc(collection(contRef, "historial")), {
          accion: "regularizar_saldos_pendientes",
          cuota: cuota.etiquetaCuota,
          cuotaRegularizacionId: cuota.id,
          cuotasRegularizadas: fuentes.map((documento) => documento.id),
          importeRegularizado: (
            fuentesDirectas.length > 0 ? fuentesDirectas : fuentes
          ).reduce(
            (total, documento) =>
              total + Number(documento.data().saldoPendiente || 0),
            0
          ),
          fecha: serverTimestamp(),
        });

        await batch.commit();
      } else {
        await updateDoc(cuotaRef, payloadEstado);

        await addDoc(collection(contRef, "historial"), {
          accion: `marcar_${estadoNuevo}`,
          cuota: cuota.etiquetaCuota,
          periodoCobro: cuota.periodoCobro,
          valorCuota: cuota.valorCuota,
          importeDescontado: payloadEstado.importeDescontado,
          saldoPendiente: payloadEstado.saldoPendiente,
          origenActualizacion: payloadEstado.origenActualizacion,
          estadoAnterior,
          estadoNuevo,
          observacion: limpiarTexto(observacion),
          fecha: serverTimestamp(),
        });
      }

      const resumen = await recalcularResumenContratacion(contratacion);

      setContratacionSeleccionada((prev) => ({
        ...prev,
        ...resumen,
      }));

      if (servicioSeleccionado?.id === contratacion.servicioId) {
        await cargarContratacionesServicio(contratacion.servicioId);
      }

      cargarAlertasServicios();

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


  const abrirParcial = (cuota) => {
    setCuotaParaParcial(cuota);
    setImporteParcial(
      cuota?.importeDescontado ? String(cuota.importeDescontado) : ""
    );
    setObservacionParcial(cuota?.observacion || "Descuento parcial registrado.");
    setVisibleParcial(true);
  };

  const guardarParcial = async () => {
    const importe = parseImporte(importeParcial);
    const valorCuota = Number(cuotaParaParcial?.valorCuota || 0);

    if (importe <= 0) {
      toast.current?.show({
        severity: "warn",
        summary: "Importe obligatorio",
        detail: "Ingrese el importe descontado parcialmente.",
      });
      return;
    }

    if (valorCuota > 0 && importe >= valorCuota) {
      toast.current?.show({
        severity: "warn",
        summary: "Importe completo",
        detail:
          "El importe ingresado es igual o superior al valor de la cuota. Use la opción Cobrado.",
      });
      return;
    }

    await actualizarEstadoCuota(
      contratacionSeleccionada,
      cuotaParaParcial,
      ESTADO_CUOTA_DESCUENTO_PARCIAL,
      observacionParcial || "Descuento parcial registrado.",
      {
        importeDescontado: importe,
        origenActualizacion: "manual",
      }
    );

    setVisibleParcial(false);
    setCuotaParaParcial(null);
    setImporteParcial("");
    setObservacionParcial("");
  };

  const cancelarContratacionDesdeCuota = async (cuotaInicio) => {
    if (!contratacionSeleccionada?.servicioId || !contratacionSeleccionada?.dni || !cuotaInicio?.id) {
      return;
    }

    const numeroDesde = Number(cuotaInicio.numeroCuota || 0);

    if (numeroDesde <= 0) {
      toast.current?.show({
        severity: "warn",
        summary: "Atención",
        detail: "No se pudo identificar desde qué cuota cancelar.",
      });
      return;
    }

    setGuardandoEstadoCuota(true);

    const esCenaDocente = ES_SERVICIO_CENA({ nombre: contratacionSeleccionada?.servicioNombre });

    try {
      const cuotasSnap = await getDocs(
        collection(getContratacionRef(contratacionSeleccionada), "cuotas")
      );

      let batch = writeBatch(db);
      let operaciones = 0;
      let canceladas = 0;

      const confirmarBatch = async () => {
        if (operaciones > 0) {
          await batch.commit();
          batch = writeBatch(db);
          operaciones = 0;
        }
      };

      for (const cuotaDoc of cuotasSnap.docs) {
        const cuota = { id: cuotaDoc.id, ...cuotaDoc.data() };
        const numeroCuota = Number(cuota.numeroCuota || 0);

        if (numeroCuota < numeroDesde || cuota.estado === ESTADO_CUOTA_COBRADO) {
          continue;
        }

        const observacion = esCenaDocente
          ? `Cena cancelada desde la cuota ${cuota.etiquetaCuota || cuota.id}. No debe descontarse.`
          : `Viaje cancelado desde la cuota ${cuota.etiquetaCuota || cuota.id}. No debe descontarse.`;
        const payloadEstado = construirPayloadEstadoCuota({
          cuota,
          estadoNuevo: ESTADO_CUOTA_CANCELADA,
          observacion,
          origenActualizacion: esCenaDocente ? "cancelacion_cena" : "cancelacion_viaje",
        });

        batch.update(cuotaDoc.ref, payloadEstado);
        operaciones += 1;
        canceladas += 1;

        const historialRef = doc(collection(getContratacionRef(contratacionSeleccionada), "historial"));

        batch.set(historialRef, {
          accion: esCenaDocente ? "cancelar_cena_desde_cuota" : "cancelar_viaje_desde_cuota",
          cuota: cuota.etiquetaCuota,
          periodoCobro: cuota.periodoCobro,
          valorCuota: cuota.valorCuota,
          importeDescontado: payloadEstado.importeDescontado,
          saldoPendiente: payloadEstado.saldoPendiente,
          origenActualizacion: esCenaDocente ? "cancelacion_cena" : "cancelacion_viaje",
          estadoAnterior: cuota.estado || ESTADO_CUOTA_PENDIENTE,
          estadoNuevo: ESTADO_CUOTA_CANCELADA,
          observacion,
          fecha: serverTimestamp(),
        });
        operaciones += 1;

        if (operaciones >= 420) {
          await confirmarBatch();
        }
      }

      const contratacionRef = doc(
        db,
        "servicios",
        contratacionSeleccionada.servicioId,
        "contrataciones",
        contratacionSeleccionada.dni
      );

      const motivoCancelacion = esCenaDocente
        ? "Cena cancelada por solicitud del afiliado."
        : "Viaje cancelado por solicitud del afiliado.";

      batch.update(contratacionRef, {
        estadoContratacion: ESTADO_CONTRATACION_CANCELADA,
        cancelado: true,
        periodoCancelacion: cuotaInicio.periodoCobro || "",
        cuotaCancelacion: cuotaInicio.etiquetaCuota || cuotaInicio.id,
        motivoCancelacion,
        fechaCancelacion: serverTimestamp(),
        actualizadoEn: serverTimestamp(),
      });
      operaciones += 1;

      await confirmarBatch();

      const resumen = await recalcularResumenContratacion(contratacionSeleccionada);

      setContratacionSeleccionada((prev) => ({
        ...prev,
        ...resumen,
        estadoContratacion: ESTADO_CONTRATACION_CANCELADA,
        cancelado: true,
        periodoCancelacion: cuotaInicio.periodoCobro || "",
        cuotaCancelacion: cuotaInicio.etiquetaCuota || cuotaInicio.id,
        motivoCancelacion,
      }));

      if (servicioSeleccionado?.id === contratacionSeleccionada.servicioId) {
        await cargarContratacionesServicio(contratacionSeleccionada.servicioId);
      }

      if (busquedaGeneralRealizada && busquedaGeneral.trim()) {
        await buscarServiciosPorAfiliado();
      }

      await cargarCuotasContratacion(contratacionSeleccionada);

      toast.current?.show({
        severity: "success",
        summary: esCenaDocente ? "Cena cancelada" : "Viaje cancelado",
        detail: esCenaDocente
          ? `Se marcaron ${canceladas} cuota(s) como cena cancelada.`
          : `Se marcaron ${canceladas} cuota(s) como viaje cancelado.`,
        life: 7000,
      });
    } catch (error) {
      console.error(esCenaDocente ? "Error al cancelar cena:" : "Error al cancelar viaje:", error);

      toast.current?.show({
        severity: "error",
        summary: "Error",
        detail: esCenaDocente
          ? "No se pudo cancelar la cena para esta contratación."
          : "No se pudo cancelar el viaje para esta contratación.",
      });
    } finally {
      setGuardandoEstadoCuota(false);
    }
  };

  const confirmarCancelarDesdeCuota = (cuota) => {
    const esCenaDocente = ES_SERVICIO_CENA({ nombre: contratacionSeleccionada?.servicioNombre });
    confirmDialog({
      header: esCenaDocente ? "Cancelar cena" : "Cancelar viaje",
      message: esCenaDocente
        ? `Se marcarán como CENA CANCELADA las cuotas desde ${cuota?.etiquetaCuota || "esta cuota"} en adelante. Las cuotas ya cobradas no se modifican. ¿Desea continuar?`
        : `Se marcarán como VIAJE CANCELADO las cuotas desde ${cuota?.etiquetaCuota || "esta cuota"} en adelante. Las cuotas ya cobradas no se modifican. ¿Desea continuar?`,
      icon: "pi pi-lock",
      acceptLabel: esCenaDocente ? "Sí, cancelar cena" : "Sí, cancelar viaje",
      rejectLabel: "Volver",
      acceptClassName: "p-button-warning",
      accept: () => cancelarContratacionDesdeCuota(cuota),
    });
  };

  const agregarCuotaExtra = async ({ periodoCobro, numeroCuotaAnterior }) => {
    if (!contratacionSeleccionada?.servicioId || !contratacionSeleccionada?.dni) return;

    setGuardandoEstadoCuota(true);

    try {
      const cuotaRegularizacionPendiente = cuotasContratacion.find(
        (cuota) =>
          (cuota.origenActualizacion === "manual_extra" ||
            cuota.esRegularizacionDeuda === true ||
            String(cuota.etiquetaCuota || "").toUpperCase() === "EXTRA") &&
          cuota.esRegularizacionDeuda !== false &&
          cuota.estado === ESTADO_CUOTA_PENDIENTE &&
          !cuota.deudaRegularizada &&
          !cuota.regularizacionPendiente
      );

      if (cuotaRegularizacionPendiente) {
        toast.current?.show({
          severity: "warn",
          summary: "Regularización existente",
          detail:
            "Ya existe una cuota extra para este saldo pendiente. No se generó una nueva.",
        });
        return;
      }

      const cuotasOrigen = cuotasContratacion.filter(
        (cuota) =>
          !cuota.deudaRegularizada &&
          !cuota.regularizacionPendiente &&
          Number(cuota.saldoPendiente || 0) > 0 &&
          [
            ESTADO_CUOTA_DESCUENTO_PARCIAL,
            ESTADO_CUOTA_NO_COBRADO,
          ].includes(cuota.estado)
      );

      if (cuotasOrigen.length === 0) {
        toast.current?.show({
          severity: "warn",
          summary: "Sin deuda activa",
          detail: "No hay cuotas con saldo pendiente para regularizar.",
        });
        return;
      }

      const importeRegularizacion = cuotasOrigen.reduce(
        (total, cuota) => total + Number(cuota.saldoPendiente || 0),
        0
      );
      const nuevoNumero = (numeroCuotaAnterior || 0) + 1;
      const cuotaId = `EX${pad2(nuevoNumero)}`;
      const contRef = getContratacionRef(contratacionSeleccionada);
      const cuotaRef = doc(collection(contRef, "cuotas"), cuotaId);
      const batch = writeBatch(db);
      const periodoHaber = sumarMesesPeriodo(periodoCobro, -1);

      batch.set(cuotaRef, {
        numeroCuota: nuevoNumero,
        etiquetaCuota: "EXTRA",
        periodoHaber,
        periodoHaberTexto: periodoHaberTexto(periodoHaber),
        periodoCobro,
        periodoCobroTexto: periodoCobroTexto(periodoCobro),
        valorCuota: importeRegularizacion,
        estado: ESTADO_CUOTA_PENDIENTE,
        observacion: "Cuota adicional por saldo pendiente.",
        importeDescontado: null,
        saldoPendiente: importeRegularizacion,
        origenActualizacion: "manual_extra",
        esRegularizacionDeuda: true,
        regularizaCuotasIds: cuotasOrigen.map((cuota) => cuota.id),
        regularizacionCompletada: false,
        fechaRegistroCobro: null,
        actualizadoEn: serverTimestamp(),
      });

      cuotasOrigen.forEach((cuota) => {
        batch.update(doc(collection(contRef, "cuotas"), cuota.id), {
          regularizacionPendiente: true,
          cuotaRegularizacionId: cuotaId,
          actualizadoEn: serverTimestamp(),
        });
      });

      batch.set(doc(collection(contRef, "historial")), {
        accion: "generar_cuota_regularizacion",
        cuotaRegularizacionId: cuotaId,
        cuotasOrigen: cuotasOrigen.map((cuota) => cuota.id),
        importe: importeRegularizacion,
        periodoCobro,
        fecha: serverTimestamp(),
      });

      await batch.commit();
      await recalcularResumenContratacion(contratacionSeleccionada);
      await cargarCuotasContratacion(contratacionSeleccionada);

      toast.current?.show({
        severity: "success",
        summary: "Cuota extra agregada",
        detail: `Se agregó una cuota de regularización de ${formatearMoneda(importeRegularizacion)} para ${periodoCobroTexto(periodoCobro)}.`,
        life: 6000,
      });
    } catch (error) {
      console.error("Error al agregar cuota extra:", error);

      toast.current?.show({
        severity: "error",
        summary: "Error",
        detail: "No se pudo agregar la cuota extra.",
      });
    } finally {
      setGuardandoEstadoCuota(false);
    }
  };

  const eliminarCuotaExtra = async (cuota) => {
    if (
      !contratacionSeleccionada?.servicioId ||
      !contratacionSeleccionada?.dni ||
      !cuota?.id
    ) {
      return;
    }

    const esCuotaExtra =
      cuota.origenActualizacion === "manual_extra" ||
      String(cuota.etiquetaCuota || "").toUpperCase() === "EXTRA";

    if (!esCuotaExtra || cuota.estado === ESTADO_CUOTA_COBRADO) {
      toast.current?.show({
        severity: "warn",
        summary: "No se puede eliminar",
        detail:
          "Solo pueden eliminarse cuotas extra manuales que todavía no fueron cobradas.",
      });
      return;
    }

    setGuardandoEstadoCuota(true);

    try {
      const contRef = getContratacionRef(contratacionSeleccionada);
      const batch = writeBatch(db);
      const numerosRestantes = cuotasContratacion
        .filter((item) => item.id !== cuota.id)
        .map((item) => Number(item.numeroCuota || 0))
        .filter((numero) => numero > 0);
      const cantidadPeriodosCobro =
        numerosRestantes.length > 0 ? Math.max(...numerosRestantes) : 0;

      batch.delete(doc(collection(contRef, "cuotas"), cuota.id));
      const idsVinculados = Array.isArray(cuota.regularizaCuotasIds)
        ? cuota.regularizaCuotasIds
        : [];

      cuotasContratacion
        .filter(
          (item) =>
            item.id !== cuota.id &&
            (idsVinculados.includes(item.id) ||
              item.cuotaRegularizacionId === cuota.id)
        )
        .forEach((item) => {
          batch.update(doc(collection(contRef, "cuotas"), item.id), {
            regularizacionPendiente: false,
            cuotaRegularizacionId: null,
            actualizadoEn: serverTimestamp(),
          });
        });

      batch.update(contRef, {
        cantidadPeriodosCobro,
        actualizadoEn: serverTimestamp(),
      });
      batch.set(doc(collection(contRef, "historial")), {
        accion: "eliminar_cuota_extra",
        cuota: cuota.etiquetaCuota || cuota.id,
        numeroCuota: Number(cuota.numeroCuota || 0),
        periodoCobro: cuota.periodoCobro || "",
        valorCuota: Number(cuota.valorCuota || 0),
        fecha: serverTimestamp(),
      });

      await batch.commit();
      const resumen = await recalcularResumenContratacion(
        contratacionSeleccionada
      );

      setContratacionSeleccionada((prev) => ({
        ...prev,
        ...resumen,
      }));
      await cargarCuotasContratacion(contratacionSeleccionada);

      if (
        servicioSeleccionado?.id ===
        contratacionSeleccionada.servicioId
      ) {
        await cargarContratacionesServicio(
          contratacionSeleccionada.servicioId
        );
      }

      toast.current?.show({
        severity: "success",
        summary: "Cuota extra eliminada",
        detail: "La cuota extra generada por error fue eliminada.",
      });
    } catch (error) {
      console.error("Error al eliminar cuota extra:", error);
      toast.current?.show({
        severity: "error",
        summary: "Error",
        detail: "No se pudo eliminar la cuota extra.",
      });
    } finally {
      setGuardandoEstadoCuota(false);
    }
  };

  const confirmarEliminarCuotaExtra = (cuota) => {
    confirmDialog({
      header: "Eliminar cuota extra",
      message: `Se eliminará definitivamente la cuota extra ${
        cuota?.numeroCuota || ""
      } de ${formatearMoneda(cuota?.valorCuota)}. ¿Desea continuar?`,
      icon: "pi pi-exclamation-triangle",
      acceptLabel: "Sí, eliminar",
      rejectLabel: "Cancelar",
      acceptClassName: "p-button-danger",
      accept: () => eliminarCuotaExtra(cuota),
    });
  };

  const eliminarContratacionIndividual = async (contratacion) => {
    if (!contratacion?.servicioId || !contratacion?.dni) return;

    setGuardandoEstadoCuota(true);

    try {
      const refsParaBorrar = [];
      const agregarSubcoleccion = async (ref, nombre) => {
        const snap = await getDocs(collection(ref, nombre));
        snap.docs.forEach((documento) => {
          refsParaBorrar.push(documento.ref);
        });
      };
      const contratacionRef = getContratacionRef(contratacion);

      await agregarSubcoleccion(contratacionRef, "cuotas");
      await agregarSubcoleccion(contratacionRef, "historial");

      if (!contratacion.esSubcontratacion) {
        const subSnap = await getDocs(
          collection(contratacionRef, "subcontrataciones")
        );

        for (const subDocumento of subSnap.docs) {
          await agregarSubcoleccion(subDocumento.ref, "cuotas");
          await agregarSubcoleccion(subDocumento.ref, "historial");
          refsParaBorrar.push(subDocumento.ref);
        }
      }

      refsParaBorrar.push(contratacionRef);
      await borrarEnLotes(refsParaBorrar);

      if (
        contratacionSeleccionada?.id === contratacion.id &&
        contratacionSeleccionada?.subcontratacionId ===
          contratacion.subcontratacionId
      ) {
        setVisibleCuotas(false);
        setContratacionSeleccionada(null);
        setCuotasContratacion([]);
      }

      await cargarContratacionesServicio(contratacion.servicioId);
      cargarAlertasServicios();

      if (busquedaGeneralRealizada && busquedaGeneral.trim()) {
        await buscarServiciosPorAfiliado();
      }

      toast.current?.show({
        severity: "success",
        summary: "Contratación eliminada",
        detail:
          "Se eliminó únicamente la contratación seleccionada, junto con sus cuotas e historial.",
      });
    } catch (error) {
      console.error("Error al eliminar contratación individual:", error);
      toast.current?.show({
        severity: "error",
        summary: "Error",
        detail: "No se pudo eliminar la contratación individual.",
      });
    } finally {
      setGuardandoEstadoCuota(false);
    }
  };

  const confirmarEliminarContratacion = (contratacion) => {
    confirmDialog({
      header: "Eliminar contratación individual",
      message: `Se eliminará la contratación de ${
        contratacion?.apellidoNombre || contratacion?.dni || "este afiliado"
      }, incluyendo sus cuotas e historial. El servicio general no será eliminado. ¿Desea continuar?`,
      icon: "pi pi-exclamation-triangle",
      acceptLabel: "Sí, eliminar contratación",
      rejectLabel: "Cancelar",
      acceptClassName: "p-button-danger",
      accept: () => eliminarContratacionIndividual(contratacion),
    });
  };

  const editarCantidadPersonas = async ({
    cantidadLugares,
    lugaresAnteriores,
    valorCuotaBase,
    desdeCuotaNumero,
  }) => {
    if (!contratacionSeleccionada?.servicioId || !contratacionSeleccionada?.dni) return;

    setGuardandoEstadoCuota(true);

    try {
      const contRef = getContratacionRef(contratacionSeleccionada);
      const cuotasSnap = await getDocs(collection(contRef, "cuotas"));
      const cuotasExistentes = cuotasSnap.docs
        .map((cuotaDoc) => ({
          id: cuotaDoc.id,
          ref: cuotaDoc.ref,
          ...cuotaDoc.data(),
        }))
        .sort(
          (a, b) =>
            Number(a.numeroCuota || 0) - Number(b.numeroCuota || 0)
        );
      const cuotaInicio = cuotasExistentes.find(
        (cuota) => Number(cuota.numeroCuota || 0) === desdeCuotaNumero
      );
      const totalCuotasPorLugar = Math.max(
        1,
        Number(contratacionSeleccionada.cantidadCuotas || 1)
      );
      const cantidadNuevosLugares =
        Number(cantidadLugares || 0) - Number(lugaresAnteriores || 0);
      const valorBase = Number(valorCuotaBase || 0);
      const normalizarComponentesExistentes = (cuota) => {
        if (
          Array.isArray(cuota?.componentesLugares) &&
          cuota.componentesLugares.length > 0
        ) {
          return cuota.componentesLugares;
        }

        const cantidadInferida = Math.max(
          1,
          Math.min(
            Number(lugaresAnteriores || 1),
            Math.round(Number(cuota?.valorCuota || valorBase) / valorBase)
          )
        );

        return Array.from({ length: cantidadInferida }, (_, index) => ({
          lugarNumero: index + 1,
          cuotaNumero: Math.min(
            Number(cuota?.numeroCuota || 1),
            totalCuotasPorLugar
          ),
          totalCuotas: totalCuotasPorLugar,
          valor: valorBase,
        }));
      };

      if (
        !cuotaInicio ||
        cantidadNuevosLugares === 0 ||
        Number(cantidadLugares || 0) < 1 ||
        valorBase <= 0
      ) {
        toast.current?.show({
          severity: "warn",
          summary: "Datos incompletos",
          detail:
            "No se pudo determinar el inicio, la cantidad de lugares o el valor por lugar.",
        });
        return;
      }

      if (cantidadNuevosLugares < 0) {
        const batchReduccion = writeBatch(db);
        const numerosEliminados = new Set();
        let cuotasActualizadas = 0;

        cuotasExistentes.forEach((cuota) => {
          const numeroCuota = Number(cuota.numeroCuota || 0);
          const componentesOriginales =
            normalizarComponentesExistentes(cuota);

          if (numeroCuota < desdeCuotaNumero) {
            if (!Array.isArray(cuota.componentesLugares)) {
              batchReduccion.set(
                cuota.ref,
                {
                  componentesLugares: componentesOriginales,
                  cantidadLugaresPeriodo: componentesOriginales.length,
                },
                { merge: true }
              );
            }
            return;
          }

          if (
            cuota.estado === ESTADO_CUOTA_COBRADO ||
            cuota.estado === ESTADO_CUOTA_CANCELADA
          ) {
            return;
          }

          const componentesLugares = componentesOriginales.filter(
            (componente) =>
              Number(componente.lugarNumero || 0) <=
              Number(cantidadLugares)
          );

          if (
            componentesLugares.length === componentesOriginales.length
          ) {
            return;
          }

          if (componentesLugares.length === 0) {
            batchReduccion.delete(cuota.ref);
            numerosEliminados.add(numeroCuota);
            cuotasActualizadas += 1;
            return;
          }

          const nuevoValorCuota = componentesLugares.reduce(
            (total, componente) =>
              total + Number(componente.valor || valorBase),
            0
          );
          const importeDescontado = Number(cuota.importeDescontado || 0);
          const actualizacionSaldo =
            cuota.estado === ESTADO_CUOTA_DESCUENTO_PARCIAL ||
            cuota.estado === ESTADO_CUOTA_NO_COBRADO
              ? {
                  saldoPendiente: Math.max(
                    0,
                    nuevoValorCuota - importeDescontado
                  ),
                }
              : {};

          batchReduccion.set(
            cuota.ref,
            {
              valorCuota: nuevoValorCuota,
              componentesLugares,
              cantidadLugaresPeriodo: componentesLugares.length,
              ...actualizacionSaldo,
              actualizadoEn: serverTimestamp(),
            },
            { merge: true }
          );
          cuotasActualizadas += 1;
        });

        const periodosRestantes = cuotasExistentes
          .map((cuota) => Number(cuota.numeroCuota || 0))
          .filter((numero) => !numerosEliminados.has(numero));
        const totalPeriodosCobro =
          periodosRestantes.length > 0
            ? Math.max(...periodosRestantes)
            : 0;
        const datosActualizados = {
          cantidadPersonas: cantidadLugares,
          cantidadLugares,
          valorCuota: valorBase,
          valorCuotaBase: valorBase,
          cantidadPeriodosCobro: totalPeriodosCobro,
        };

        batchReduccion.update(contRef, {
          ...datosActualizados,
          actualizadoEn: serverTimestamp(),
        });
        batchReduccion.set(doc(collection(contRef, "historial")), {
          accion: "reducir_lugares_reserva",
          lugaresAnteriores: Number(lugaresAnteriores || 1),
          cantidadLugares,
          cantidadRetirada: Math.abs(cantidadNuevosLugares),
          lugaresRetiradosDesde: Number(cantidadLugares) + 1,
          lugaresRetiradosHasta: Number(lugaresAnteriores || 1),
          desdeCuotaNumero,
          cuotasActualizadas,
          fecha: serverTimestamp(),
        });

        await batchReduccion.commit();
        await recalcularResumenContratacion(contratacionSeleccionada);
        await cargarCuotasContratacion(contratacionSeleccionada);
        setContratacionSeleccionada((prev) => ({
          ...prev,
          ...datosActualizados,
        }));
        setContratacionesServicio((prev) =>
          prev.map((item) =>
            item.id === contratacionSeleccionada.id &&
            item.subcontratacionId ===
              contratacionSeleccionada.subcontratacionId
              ? { ...item, ...datosActualizados }
              : item
          )
        );

        toast.current?.show({
          severity: "success",
          summary: "Reserva reducida",
          detail: `Se retiraron ${Math.abs(cantidadNuevosLugares)} ${
            Math.abs(cantidadNuevosLugares) === 1 ? "lugar" : "lugares"
          } desde la cuota ${desdeCuotaNumero}. Los cobros anteriores no fueron modificados.`,
          life: 8000,
        });
        return;
      }

      const numeroFinal = desdeCuotaNumero + totalCuotasPorLugar - 1;
      const estadosNoModificables = [
        ESTADO_CUOTA_COBRADO,
        ESTADO_CUOTA_CANCELADA,
      ];
      const periodoBloqueado = cuotasExistentes.find(
        (cuota) =>
          Number(cuota.numeroCuota || 0) >= desdeCuotaNumero &&
          Number(cuota.numeroCuota || 0) <= numeroFinal &&
          estadosNoModificables.includes(cuota.estado)
      );

      if (periodoBloqueado) {
        toast.current?.show({
          severity: "warn",
          summary: "Período no modificable",
          detail: `El descuento ${periodoBloqueado.numeroCuota} ya está cobrado o cancelado. Seleccione un período posterior.`,
        });
        return;
      }

      const cuotasPorNumero = new Map(
        cuotasExistentes.map((cuota) => [
          Number(cuota.numeroCuota || 0),
          cuota,
        ])
      );
      const batch = writeBatch(db);
      const nuevosLugares = Array.from(
        { length: cantidadNuevosLugares },
        (_, index) => Number(lugaresAnteriores || 0) + index + 1
      );
      const ampliacionActual = {
        lugaresDesde: Number(lugaresAnteriores || 0) + 1,
        lugaresHasta: cantidadLugares,
        cantidadAgregada: cantidadNuevosLugares,
        desdeCuotaNumero,
        totalCuotasPorLugar,
        valorPorLugar: valorBase,
      };
      const ampliacionesActualizadas = [
        ...(Array.isArray(contratacionSeleccionada.ampliacionesLugares)
          ? contratacionSeleccionada.ampliacionesLugares
          : []),
        ampliacionActual,
      ];
      const totalPeriodosCobro = Math.max(
        numeroFinal,
        ...cuotasExistentes.map((cuota) =>
          Number(cuota.numeroCuota || 0)
        )
      );
      cuotasExistentes.forEach((cuota) => {
        const numeroCuota = Number(cuota.numeroCuota || 0);
        if (
          numeroCuota >= desdeCuotaNumero &&
          numeroCuota <= numeroFinal
        ) {
          return;
        }

        const componentesLugares = normalizarComponentesExistentes(cuota);
        batch.set(
          cuota.ref,
          {
            componentesLugares,
            cantidadLugaresPeriodo: componentesLugares.length,
          },
          { merge: true }
        );
      });

      for (let desplazamiento = 0; desplazamiento < totalCuotasPorLugar; desplazamiento += 1) {
        const numeroCuota = desdeCuotaNumero + desplazamiento;
        const cuotaExistente = cuotasPorNumero.get(numeroCuota);
        const componentesExistentes = cuotaExistente
          ? normalizarComponentesExistentes(cuotaExistente)
          : [];
        const componentesNuevos = nuevosLugares.map((lugarNumero) => ({
          lugarNumero,
          cuotaNumero: desplazamiento + 1,
          totalCuotas: totalCuotasPorLugar,
          valor: valorBase,
        }));
        const componentesLugares = [
          ...componentesExistentes,
          ...componentesNuevos,
        ];
        const nuevoValorCuota = componentesLugares.reduce(
          (total, componente) => total + Number(componente.valor || 0),
          0
        );
        const periodoHaber = sumarMesesPeriodo(
          cuotaInicio.periodoHaber,
          desplazamiento
        );
        const periodoCobro = sumarMesesPeriodo(
          cuotaInicio.periodoCobro,
          desplazamiento
        );
        const cuotaRef = cuotaExistente
          ? cuotaExistente.ref
          : doc(collection(contRef, "cuotas"), `L${pad2(numeroCuota)}`);
        const estado =
          cuotaExistente?.estado || ESTADO_CUOTA_PENDIENTE;
        const importeDescontado = Number(
          cuotaExistente?.importeDescontado || 0
        );
        const actualizacionSaldo =
          estado === ESTADO_CUOTA_DESCUENTO_PARCIAL ||
          estado === ESTADO_CUOTA_NO_COBRADO
            ? { saldoPendiente: Math.max(0, nuevoValorCuota - importeDescontado) }
            : {};

        batch.set(
          cuotaRef,
          {
            numeroCuota,
            etiquetaCuota: `Descuento ${pad2(numeroCuota)}`,
            periodoHaber,
            periodoHaberTexto: periodoHaberTexto(periodoHaber),
            periodoCobro,
            periodoCobroTexto: periodoCobroTexto(periodoCobro),
            valorCuota: nuevoValorCuota,
            estado,
            observacion: cuotaExistente?.observacion || "",
            importeDescontado:
              cuotaExistente?.importeDescontado ?? null,
            saldoPendiente:
              cuotaExistente?.saldoPendiente ?? null,
            origenActualizacion:
              cuotaExistente?.origenActualizacion || "ampliacion_lugares",
            fechaRegistroCobro:
              cuotaExistente?.fechaRegistroCobro || null,
            componentesLugares,
            cantidadLugaresPeriodo: componentesLugares.length,
            ...actualizacionSaldo,
            actualizadoEn: serverTimestamp(),
          },
          { merge: true }
        );
      }

      batch.update(contRef, {
        cantidadPersonas: cantidadLugares,
        cantidadLugares,
        valorCuota: valorBase,
        valorCuotaBase: valorBase,
        cantidadPeriodosCobro: totalPeriodosCobro,
        ampliacionesLugares: ampliacionesActualizadas,
        actualizadoEn: serverTimestamp(),
      });

      const historialRef = doc(collection(contRef, "historial"));
      batch.set(historialRef, {
        accion: "ampliar_lugares_reserva",
        lugaresAnteriores: Number(lugaresAnteriores || 1),
        cantidadLugares,
        cantidadAgregada: cantidadNuevosLugares,
        valorPorLugar: valorBase,
        desdeCuotaNumero,
        hastaCuotaNumero: numeroFinal,
        totalCuotasPorLugar,
        fecha: serverTimestamp(),
      });

      await batch.commit();

      await recalcularResumenContratacion(contratacionSeleccionada);
      await cargarCuotasContratacion(contratacionSeleccionada);

      // Refrescar la contratación seleccionada con los nuevos valores
      setContratacionSeleccionada((prev) => ({
        ...prev,
        cantidadPersonas: cantidadLugares,
        cantidadLugares,
        valorCuota: valorBase,
        valorCuotaBase: valorBase,
        cantidadPeriodosCobro: totalPeriodosCobro,
        ampliacionesLugares: ampliacionesActualizadas,
      }));
      setContratacionesServicio((prev) =>
        prev.map((item) =>
          item.id === contratacionSeleccionada.id &&
          item.subcontratacionId ===
            contratacionSeleccionada.subcontratacionId
            ? {
                ...item,
                cantidadPersonas: cantidadLugares,
                cantidadLugares,
                valorCuota: valorBase,
                valorCuotaBase: valorBase,
                cantidadPeriodosCobro: totalPeriodosCobro,
                ampliacionesLugares: ampliacionesActualizadas,
              }
            : item
        )
      );

      toast.current?.show({
        severity: "success",
        summary: "Reserva ampliada",
        detail: `Se agregaron ${cantidadNuevosLugares} ${
          cantidadNuevosLugares === 1 ? "lugar" : "lugares"
        }. El nuevo plan comienza en el descuento ${desdeCuotaNumero} y finaliza en el ${numeroFinal}.`,
        life: 8000,
      });
    } catch (error) {
      console.error("Error al modificar lugares de la reserva:", error);
      toast.current?.show({
        severity: "error",
        summary: "Error",
        detail: "No se pudieron modificar los lugares de la reserva.",
      });
    } finally {
      setGuardandoEstadoCuota(false);
    }
  };

  const importarDescuentosExcel = async ({
    servicio,
    periodoCobro,
    periodosCobro = [],
    filas,
    marcarAusentesComoNoCobrados = true,
  }) => {
    if (!servicio?.id) return;

    if (!Array.isArray(filas) || filas.length === 0) {
      toast.current?.show({
        severity: "warn",
        summary: "Atención",
        detail: "No hay filas válidas para procesar.",
      });
      return;
    }

    const periodosDesdeParametro = Array.isArray(periodosCobro)
      ? periodosCobro.map((item) => limpiarTexto(item)).filter(Boolean)
      : [];

    const periodosDesdeFilas = filas
      .map((fila) => limpiarTexto(fila?.periodoCobro))
      .filter(Boolean);

    const periodosProcesar = Array.from(
      new Set([
        ...periodosDesdeParametro,
        ...periodosDesdeFilas,
        limpiarTexto(periodoCobro),
      ].filter(Boolean))
    ).sort((a, b) => String(a).localeCompare(String(b)));

    if (periodosProcesar.length === 0) {
      toast.current?.show({
        severity: "warn",
        summary: "Atención",
        detail:
          "No se detectó ningún mes de cobro en el Excel. Verifique que tenga columnas como ABRIL / IMPORTE DESCONTADO.",
      });
      return;
    }

    setImportandoDescuentos(true);

    const mapasExcelPorPeriodo = new Map();

    periodosProcesar.forEach((periodo) => {
      mapasExcelPorPeriodo.set(periodo, new Map());
    });

    filas.forEach((fila) => {
      const dni = normalizarDni(fila.dni);
      if (!dni) return;

      const periodoFila = limpiarTexto(fila.periodoCobro) ||
        (periodosProcesar.length === 1 ? periodosProcesar[0] : "");

      if (!periodoFila || !mapasExcelPorPeriodo.has(periodoFila)) return;

      const importe = Number(fila.importeDescontado || 0);
      const mapaPeriodo = mapasExcelPorPeriodo.get(periodoFila);
      const actual = mapaPeriodo.get(dni) || {
        dni,
        periodoCobro: periodoFila,
        importeDescontado: 0,
        filas: [],
        observaciones: [],
      };

      actual.importeDescontado += Number.isNaN(importe) ? 0 : importe;
      actual.filas.push(fila.fila);

      if (limpiarTexto(fila.observacion)) {
        actual.observaciones.push(limpiarTexto(fila.observacion));
      }

      mapaPeriodo.set(dni, actual);
    });

    let cobrados = 0;
    let parciales = 0;
    let noCobrados = 0;
    let omitidos = 0;
    let errores = 0;
    let sinCuotaDelMes = 0;

    const afectados = new Map();
    const periodosDisponibles = new Set();

    try {
      const servicioId = servicio.id;
      const contratacionesSnap = await getDocs(
        collection(db, "servicios", servicioId, "contrataciones")
      );

      let batch = writeBatch(db);
      let operaciones = 0;

      const confirmarBatch = async () => {
        if (operaciones > 0) {
          await batch.commit();
          batch = writeBatch(db);
          operaciones = 0;
        }
      };

      for (const contratacionDoc of contratacionesSnap.docs) {
        const contratacionData = contratacionDoc.data() || {};
        const dni = normalizarDni(contratacionData.dni || contratacionDoc.id);

        if (!dni) {
          errores += 1;
          continue;
        }

        if (
          contratacionData.esPagoContado === true ||
          contratacionData.tipoPago === "contado"
        ) {
          omitidos += periodosProcesar.length;
          continue;
        }

        const cuotasSnap = await getDocs(
          collection(
            db,
            "servicios",
            servicioId,
            "contrataciones",
            dni,
            "cuotas"
          )
        );

        const cuotasPorPeriodo = new Map();

        cuotasSnap.docs.forEach((documento) => {
          const periodoDisponible = documento.data()?.periodoCobro;
          if (periodoDisponible) {
            periodosDisponibles.add(periodoDisponible);
            cuotasPorPeriodo.set(periodoDisponible, documento);
          }
        });

        for (const periodoActual of periodosProcesar) {
          const cuotaDoc = cuotasPorPeriodo.get(periodoActual);

          if (!cuotaDoc) {
            sinCuotaDelMes += 1;
            continue;
          }

          const cuota = {
            id: cuotaDoc.id,
            ...cuotaDoc.data(),
          };

          if (
            cuota.estado === ESTADO_CUOTA_CANCELADA ||
            contratacionData.cancelado === true ||
            contratacionData.estadoContratacion === ESTADO_CONTRATACION_CANCELADA
          ) {
            omitidos += 1;
            continue;
          }

          const mapaPeriodo = mapasExcelPorPeriodo.get(periodoActual) || new Map();
          const filaExcel = mapaPeriodo.get(dni);

          if (!filaExcel && !marcarAusentesComoNoCobrados) {
            omitidos += 1;
            continue;
          }

          // No sobreescribir cuotas ya cobradas o parciales cuando el afiliado
          // no figura en este Excel. Puede ocurrir al importar planillas
          // parciales (ej: un segundo archivo con afiliados que arrancan desde
          // otro mes) sin que se pierda lo ya procesado anteriormente.
          if (
            !filaExcel &&
            (cuota.estado === ESTADO_CUOTA_COBRADO ||
              cuota.estado === ESTADO_CUOTA_DESCUENTO_PARCIAL)
          ) {
            omitidos += 1;
            continue;
          }

          const valorCuota = Number(cuota.valorCuota || 0);
          const importeDescontado = Number(filaExcel?.importeDescontado || 0);

          let estadoNuevo = ESTADO_CUOTA_NO_COBRADO;
          let observacion = `No figura en el Excel de descuentos del período ${cuota.periodoCobroTexto || periodoActual}.`;

          if (filaExcel) {
            if (importeDescontado >= valorCuota && valorCuota > 0) {
              estadoNuevo = ESTADO_CUOTA_COBRADO;
              observacion = `Cobro importado desde Excel. Importe descontado: ${formatearMoneda(importeDescontado)}.`;
              cobrados += 1;
            } else if (importeDescontado > 0) {
              estadoNuevo = ESTADO_CUOTA_DESCUENTO_PARCIAL;
              observacion = `Descuento parcial importado desde Excel. Importe descontado: ${formatearMoneda(importeDescontado)}. Saldo pendiente: ${formatearMoneda(Math.max(valorCuota - importeDescontado, 0))}.`;
              parciales += 1;
            } else {
              estadoNuevo = ESTADO_CUOTA_NO_COBRADO;
              observacion = `Figura en el Excel con importe cero para el período ${cuota.periodoCobroTexto || periodoActual}.`;
              noCobrados += 1;
            }

            if (filaExcel.observaciones.length > 0) {
              observacion = `${observacion} Observación Excel: ${filaExcel.observaciones.join(" | ")}`;
            }
          } else {
            noCobrados += 1;
          }

          const payloadEstado = construirPayloadEstadoCuota({
            cuota,
            estadoNuevo,
            observacion,
            importeDescontado:
              estadoNuevo === ESTADO_CUOTA_DESCUENTO_PARCIAL
                ? importeDescontado
                : null,
            origenActualizacion: "excel_mensual",
          });

          batch.update(cuotaDoc.ref, payloadEstado);
          operaciones += 1;

          const historialRef = doc(
            collection(
              db,
              "servicios",
              servicioId,
              "contrataciones",
              dni,
              "historial"
            )
          );

          batch.set(historialRef, {
            accion: `importar_excel_${estadoNuevo}`,
            cuota: cuota.etiquetaCuota,
            periodoCobro: cuota.periodoCobro,
            valorCuota: cuota.valorCuota,
            importeDescontado: payloadEstado.importeDescontado,
            saldoPendiente: payloadEstado.saldoPendiente,
            origenActualizacion: "excel_mensual",
            estadoAnterior: cuota.estado || ESTADO_CUOTA_PENDIENTE,
            estadoNuevo,
            observacion,
            filasExcel: filaExcel?.filas || [],
            fecha: serverTimestamp(),
          });
          operaciones += 1;

          afectados.set(dni, {
            servicioId,
            dni,
          });

          if (operaciones >= 420) {
            await confirmarBatch();
          }
        }
      }

      await confirmarBatch();

      const totalProcesados = cobrados + parciales + noCobrados;

      if (totalProcesados === 0 && sinCuotaDelMes > 0) {
        const mesesDisponiblesTexto = Array.from(periodosDisponibles)
          .sort((a, b) => String(a).localeCompare(String(b)))
          .map((periodo) => periodoTexto(periodo))
          .join(", ");

        toast.current?.show({
          severity: "warn",
          summary: "No se actualizó ninguna cuota",
          detail: mesesDisponiblesTexto
            ? `Los meses detectados (${periodosProcesar.map((periodo) => periodoTexto(periodo)).join(", ")}) no coinciden con las cuotas generadas. Meses disponibles: ${mesesDisponiblesTexto}.`
            : `No existen cuotas generadas para los meses detectados (${periodosProcesar.join(", ")}).`,
          life: 12000,
        });
        return;
      }

      for (const afectado of afectados.values()) {
        await recalcularResumenContratacion(afectado);
      }

      await cargarContratacionesServicio(servicio.id);
      cargarAlertasServicios();

      if (contratacionSeleccionada?.servicioId === servicio.id) {
        await cargarCuotasContratacion(contratacionSeleccionada);
      }

      if (busquedaGeneralRealizada && busquedaGeneral.trim()) {
        await buscarServiciosPorAfiliado();
      }

      toast.current?.show({
        severity: "success",
        summary: "Descuentos importados",
        detail: `Períodos: ${periodosProcesar.join(", ")}. Cobrados: ${cobrados}. Parciales: ${parciales}. No cobrados: ${noCobrados}. Omitidos: ${omitidos}. Sin cuota del mes: ${sinCuotaDelMes}. Errores: ${errores}.`,
        life: 9000,
      });
    } catch (error) {
      console.error("Error al importar descuentos mensuales:", error);

      toast.current?.show({
        severity: "error",
        summary: "Error",
        detail: "No se pudo procesar el Excel de descuentos mensuales.",
      });
    } finally {
      setImportandoDescuentos(false);
    }
  };

  const contratacionesFiltradas = useMemo(() => {
    const termino = limpiarTexto(filtroContrataciones).toLowerCase();
    const dniTermino = normalizarDni(filtroContrataciones);

    let resultado = contratacionesServicio;

    // Filtro por estado especial (parcial / no cobrado)
    if (filtroEstadoContrataciones === "parcial") {
      resultado = resultado.filter((item) => Number(item.cuotasParciales || 0) > 0);
    } else if (filtroEstadoContrataciones === "no_cobrado") {
      resultado = resultado.filter((item) => Number(item.cuotasNoCobradas || 0) > 0);
    }

    if (!termino && !dniTermino) return resultado;

    return resultado.filter((item) => {
      const texto = `${item.apellidoNombre || ""} ${item.nombre || ""} ${
        item.apellido || ""
      } ${item.departamentoServicio || ""} ${
        item.telefonoContacto || ""
      }`.toLowerCase();

      const dni = normalizarDni(item.dni);

      return (
        (dniTermino && dni.includes(dniTermino)) ||
        (termino && texto.includes(termino))
      );
    });
  }, [contratacionesServicio, filtroContrataciones, filtroEstadoContrataciones]);

  const serviciosPanel = servicios.filter((servicio) => !ES_SERVICIO_CENA(servicio));
  const totalServicios = serviciosPanel.length;
  const serviciosActivos = serviciosPanel.filter((s) => s?.activo !== false).length;
  const serviciosVisibles = serviciosPanel.filter((s) => s?.visibleEnApp === true).length;
  const totalParciales = serviciosPanel.reduce(
    (total, servicio) =>
      total + Number(alertasServicios[servicio.id]?.parciales || 0),
    0
  );
  const totalNoCobrados = serviciosPanel.reduce(
    (total, servicio) =>
      total + Number(alertasServicios[servicio.id]?.noCobrados || 0),
    0
  );
  const totalAlertas = totalParciales + totalNoCobrados;

  const serviciosFiltrados = serviciosPanel.filter((servicio) => {
    const termino = limpiarTexto(filtroServicios).toLowerCase();
    if (!termino) return true;
    return `${servicio?.nombre || ""} ${servicio?.descripcion || ""}`
      .toLowerCase()
      .includes(termino);
  });

  const resumenSeleccionado = contratacionesServicio.reduce(
    (resumen, item) => {
      resumen.cobradas += Number(item?.cuotasCobradas || 0);
      resumen.parciales += Number(item?.cuotasParciales || 0);
      resumen.noCobradas += Number(item?.cuotasNoCobradas || 0);
      resumen.canceladas += Number(item?.cuotasCanceladas || 0);
      resumen.pendientes += Number(item?.cuotasPendientes || 0);
      return resumen;
    },
    {
      cobradas: 0,
      parciales: 0,
      noCobradas: 0,
      canceladas: 0,
      pendientes: 0,
    }
  );

  const totalCuotasSeleccionado =
    resumenSeleccionado.cobradas +
    resumenSeleccionado.parciales +
    resumenSeleccionado.noCobradas +
    resumenSeleccionado.canceladas +
    resumenSeleccionado.pendientes;

  const cumplimientoSeleccionado =
    totalCuotasSeleccionado > 0
      ? Math.round(
          ((resumenSeleccionado.cobradas +
            resumenSeleccionado.parciales * 0.5) /
            totalCuotasSeleccionado) *
            100
        )
      : 0;

  // Cantidad total de personas/lugares (= tarjetas a descontar) entre todos
  // los afiliados contratados, sin contar subcontrataciones para no duplicar.
  // Además desglosamos por estado del CONTRATO (no de cada cuota individual):
  // "con incidencia" = tiene al menos una cuota parcial o sin cobrar;
  // "al día" = el resto (cobradas y/o pendientes futuras sin problema).
  const { totalPersonasSeleccionado, personasConIncidenciaSeleccionado, personasAlDiaSeleccionado } =
    contratacionesServicio.reduce(
      (acc, item) => {
        if (item?.esSubcontratacion) return acc;
        const lugares = obtenerCantidadPersonasContratacion(item);
        const tieneIncidencia =
          Number(item?.cuotasParciales || 0) > 0 ||
          Number(item?.cuotasNoCobradas || 0) > 0;

        acc.totalPersonasSeleccionado += lugares;
        if (tieneIncidencia) acc.personasConIncidenciaSeleccionado += lugares;
        else acc.personasAlDiaSeleccionado += lugares;
        return acc;
      },
      {
        totalPersonasSeleccionado: 0,
        personasConIncidenciaSeleccionado: 0,
        personasAlDiaSeleccionado: 0,
      }
    );

  // Si el servicio tiene afiliados con distintos planes (ej. Cena del Maestro,
  // donde cada uno eligió su propia cantidad de cuotas y valor), mostramos el
  // desglose real en vez de un único valor fijo del servicio.
  const planesContratacionesSeleccionado = [];
  const tieneVariosPlanes = false;

  const incidenciasSeleccionadas = contratacionesServicio
    .filter(
      (item) =>
        Number(item?.cuotasParciales || 0) > 0 ||
        Number(item?.cuotasNoCobradas || 0) > 0
    )
    .slice(0, 5);

  const abrirAlertaAfiliados = (servicio, estado) => {
    setAlertaServicio(servicio);
    setAlertaEstado(estado);
    setVisibleAlertaDialog(true);
  };

  return (
    <div className={styles.serviciosPage}>
      <Toast ref={toast} />

      <header className={styles.executiveHeader}>
        <div>
          <span className={styles.executiveEyebrow}>Gestión financiera</span>
          <h1>Servicios contratados</h1>
          <p>
            Seguimiento de contrataciones, cuotas, descuentos y alertas desde
            una única vista.
          </p>
        </div>
        <Button
          label="Nuevo servicio"
          icon="pi pi-plus"
          className="p-button-success"
          onClick={abrirNuevoServicio}
        />
      </header>

      <nav className={styles.serviciosTabs} aria-label="Vistas de servicios">
        <button
          type="button"
          className={vistaServicios === "panel" ? styles.serviciosTabActiva : ""}
          onClick={() => {
            setVistaServicios("panel");
            if (ES_SERVICIO_CENA(servicioSeleccionado)) {
              const primerServicioPanel = servicios.find(
                (servicio) => !ES_SERVICIO_CENA(servicio)
              );
              if (primerServicioPanel) seleccionarServicioDashboard(primerServicioPanel);
              else setServicioSeleccionado(null);
            }
          }}
        >
          <i className="pi pi-briefcase" />
          Panel de servicios
        </button>
        <button
          type="button"
          className={vistaServicios === "multi" ? styles.serviciosTabActiva : ""}
          onClick={() => setVistaServicios("multi")}
        >
          <i className="pi pi-users" />
          Afiliados con múltiples servicios
        </button>
        <button
          type="button"
          className={vistaServicios === "cenaDocente" ? styles.serviciosTabActiva : ""}
          onClick={() => setVistaServicios("cenaDocente")}
        >
          <i className="pi pi-calendar-plus" />
          Cena del docente
        </button>
      </nav>

      {vistaServicios === "multi" ? (
        <AfiliadosMultiServicioPanel
          servicios={servicios}
          onSeleccionarServicio={(servicio) => {
            setVistaServicios("panel");
            seleccionarServicioDashboard(servicio);
          }}
          onVerCuotas={abrirCuotas}
        />
      ) : vistaServicios === "cenaDocente" ? (
        <CenaDocentePanel
          onVerCuotas={abrirCuotas}
        />
      ) : (
        <>
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

      <section className={styles.executiveKpis}>
        <article className={styles.executiveKpiBlue}>
          <i className="pi pi-briefcase" />
          <div>
            <span>Servicios creados</span>
            <strong>{totalServicios}</strong>
            <small>Catálogo total</small>
          </div>
        </article>
        <article className={styles.executiveKpiGreen}>
          <i className="pi pi-check-circle" />
          <div>
            <span>Servicios activos</span>
            <strong>{serviciosActivos}</strong>
            <small>Disponibles para gestión</small>
          </div>
        </article>
        <article className={styles.executiveKpiOrange}>
          <i className="pi pi-mobile" />
          <div>
            <span>Visibles en app</span>
            <strong>{serviciosVisibles}</strong>
            <small>Publicados para afiliados</small>
          </div>
        </article>
        <article className={styles.executiveKpiRed}>
          <i className="pi pi-exclamation-triangle" />
          <div>
            <span>Alertas activas</span>
            <strong>{totalAlertas}</strong>
            <small>
              {totalParciales} parciales · {totalNoCobrados} sin cobrar
            </small>
          </div>
        </article>
      </section>

      <section className={styles.alertCenter}>
        <div className={styles.alertCenterHeader}>
          <div>
            <span>Centro de alertas</span>
            <h2>Situaciones que requieren atención</h2>
          </div>
        </div>
        <div className={styles.alertCenterGrid}>
          <div className={styles.alertCenterPartial}>
            <i className="pi pi-percentage" />
            <span>
              <strong>{totalParciales} pagos parciales</strong>
              <small>Con seguimiento disponible por servicio</small>
            </span>
          </div>
          <div className={styles.alertCenterUnpaid}>
            <i className="pi pi-ban" />
            <span>
              <strong>{totalNoCobrados} casos sin cobrar</strong>
              <small>Con seguimiento disponible por servicio</small>
            </span>
          </div>
          <div className={styles.alertCenterRule}>
            <i className="pi pi-info-circle" />
            <span>
              <strong>Regla administrativa</strong>
              <small>
                El administrador define la cantidad de cuotas y el valor de
                cuota. El haber inicial se define al agregar afiliados al
                servicio.
              </small>
            </span>
          </div>
        </div>
      </section>

      <section className={styles.masterDetail}>
        <aside className={styles.servicesMaster}>
          <div className={styles.servicesMasterHeader}>
            <div>
              <span>Servicios</span>
              <strong>{serviciosFiltrados.length} registrados</strong>
            </div>
          </div>
          <label className={styles.servicesSearch}>
            <i className="pi pi-search" />
            <input
              value={filtroServicios}
              onChange={(e) => setFiltroServicios(e.target.value)}
              placeholder="Buscar servicio"
            />
          </label>

          {loading ? (
            <div className={styles.loadingBox}>
              <ProgressSpinner />
              <span>Cargando servicios...</span>
            </div>
          ) : (
            <div className={styles.servicesList}>
              {serviciosFiltrados.map((servicio) => {
                const alertas = alertasServicios[servicio.id] || {};
                const seleccionado = servicioSeleccionado?.id === servicio.id;

                return (
                  <button
                    type="button"
                    key={servicio.id}
                    className={`${styles.serviceExecutiveCard} ${
                      seleccionado ? styles.serviceExecutiveCardActive : ""
                    }`}
                    onClick={() => seleccionarServicioDashboard(servicio)}
                  >
                    <span className={styles.serviceExecutiveIcon}>
                      <i className="pi pi-briefcase" />
                    </span>
                    <span className={styles.serviceExecutiveCopy}>
                      <small>
                        {servicio.activo !== false ? "Activo" : "Inactivo"}
                      </small>
                      <strong>{servicio.nombre}</strong>
                      <em>
                        {Number(servicio.cantidadCuotas || 0)} cuotas ·{" "}
                        {formatearMoneda(servicio.valorCuota)}
                      </em>
                    </span>
                    <span className={styles.serviceExecutiveAlerts}>
                      {Number(alertas.parciales || 0) > 0 && (
                        <b className={styles.serviceAlertPartial}>
                          {alertas.parciales} P
                        </b>
                      )}
                      {Number(alertas.noCobrados || 0) > 0 && (
                        <b className={styles.serviceAlertUnpaid}>
                          {alertas.noCobrados} NC
                        </b>
                      )}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </aside>

        <div className={styles.serviceDetail}>
          {servicioSeleccionado ? (
            <>
              <div className={styles.serviceDetailHeader}>
                <div>
                  <span>Servicio seleccionado</span>
                  <h2>{servicioSeleccionado.nombre}</h2>
                  <p>
                    {servicioSeleccionado.descripcion ||
                      "Sin descripción registrada."}
                  </p>
                </div>
                <div className={styles.serviceDetailActions}>
                  <Button
                    label="Editar"
                    icon="pi pi-pencil"
                    className="p-button-outlined p-button-secondary"
                    onClick={() => abrirEditarServicio(servicioSeleccionado)}
                  />
                  <Button
                    label="Administrar"
                    icon="pi pi-cog"
                    onClick={() => abrirDetalleServicio(servicioSeleccionado)}
                  />
                  <Button
                    label={
                      servicioSeleccionado.visibleEnApp
                        ? "Ocultar en app"
                        : "Ver en app"
                    }
                    icon={
                      servicioSeleccionado.visibleEnApp
                        ? "pi pi-eye-slash"
                        : "pi pi-eye"
                    }
                    className={
                      servicioSeleccionado.visibleEnApp
                        ? "p-button-outlined p-button-success"
                        : "p-button-success"
                    }
                    onClick={() =>
                      cambiarVisibleEnApp(servicioSeleccionado)
                    }
                  />
                  <Button
                    label="Eliminar servicio"
                    icon="pi pi-trash"
                    className="p-button-outlined p-button-danger"
                    loading={
                      eliminandoServicioId === servicioSeleccionado.id
                    }
                    onClick={() =>
                      confirmarEliminarServicio(servicioSeleccionado)
                    }
                  />
                </div>
              </div>

              <div className={styles.serviceMetrics}>
                <article>
                  <span>Afiliados contratados</span>
                  <strong>{contratacionesServicio.length}</strong>
                  <small>Incluye contratos adicionales</small>
                </article>
                <article>
                  <span>Personas (tarjetas)</span>
                  <strong>{totalPersonasSeleccionado}</strong>
                  <small>
                    {personasAlDiaSeleccionado} al día ·{" "}
                    {personasConIncidenciaSeleccionado} con incidencia
                  </small>
                </article>
                <article>
                  <span>Cumplimiento</span>
                  <strong>{cumplimientoSeleccionado}%</strong>
                  <div className={styles.serviceProgress}>
                    <i style={{ width: `${cumplimientoSeleccionado}%` }} />
                  </div>
                </article>
                <article>
                  <span>Cuotas cobradas</span>
                  <strong>{resumenSeleccionado.cobradas}</strong>
                  <small>{resumenSeleccionado.pendientes} pendientes</small>
                </article>
                <article>
                  <span>Incidencias</span>
                  <strong>
                    {resumenSeleccionado.parciales +
                      resumenSeleccionado.noCobradas}
                  </strong>
                  <small>
                    {resumenSeleccionado.parciales} parciales ·{" "}
                    {resumenSeleccionado.noCobradas} sin cobrar
                  </small>
                </article>
              </div>

              <div className={styles.serviceStatusGrid}>
                <section className={styles.monthlyStatus}>
                  <div className={styles.serviceSectionHeader}>
                    <div>
                      <span>Estado general</span>
                      <h3>Distribución de cuotas</h3>
                    </div>
                  </div>
                  {loadingContrataciones ? (
                    <div className={styles.inlineLoading}>
                      <ProgressSpinner
                        style={{ width: "34px", height: "34px" }}
                      />
                      <span>Cargando contrataciones...</span>
                    </div>
                  ) : (
                    <>
                      <div className={styles.statusStack}>
                        <i
                          className={styles.statusCobrado}
                          style={{ flex: resumenSeleccionado.cobradas }}
                        />
                        <i
                          className={styles.statusParcial}
                          style={{ flex: resumenSeleccionado.parciales }}
                        />
                        <i
                          className={styles.statusNoCobrado}
                          style={{ flex: resumenSeleccionado.noCobradas }}
                        />
                        <i
                          className={styles.statusPendiente}
                          style={{ flex: resumenSeleccionado.pendientes }}
                        />
                      </div>
                      <div className={styles.statusLegend}>
                        <span>
                          <i className={styles.dotCobrado} /> Cobradas
                          <b>{resumenSeleccionado.cobradas}</b>
                        </span>
                        <button
                          type="button"
                          className={styles.statusLegendAction}
                          disabled={resumenSeleccionado.parciales === 0}
                          onClick={() =>
                            abrirAlertaAfiliados(
                              servicioSeleccionado,
                              "parcial"
                            )
                          }
                          title="Ver afiliados con descuentos parciales"
                        >
                          <i className={styles.dotParcial} /> Parciales
                          <b>{resumenSeleccionado.parciales}</b>
                        </button>
                        <button
                          type="button"
                          className={styles.statusLegendAction}
                          disabled={resumenSeleccionado.noCobradas === 0}
                          onClick={() =>
                            abrirAlertaAfiliados(
                              servicioSeleccionado,
                              "no_cobrado"
                            )
                          }
                          title="Ver afiliados con cuotas sin cobrar"
                        >
                          <i className={styles.dotNoCobrado} /> No cobradas
                          <b>{resumenSeleccionado.noCobradas}</b>
                        </button>
                        <span>
                          <i className={styles.dotPendiente} /> Pendientes
                          <b>{resumenSeleccionado.pendientes}</b>
                        </span>
                      </div>
                    </>
                  )}
                </section>

                <section className={styles.serviceConfiguration}>
                  <div className={styles.serviceSectionHeader}>
                    <div>
                      <span>Configuración</span>
                      <h3>Condiciones del servicio</h3>
                    </div>
                  </div>
                  <dl>
                    {tieneVariosPlanes ? (
                      <div className={styles.planesMultiples}>
                        <dt>Planes vigentes (según Excel cargado)</dt>
                        <dd>
                          <ul className={styles.planesMultiplesLista}>
                            {planesContratacionesSeleccionado.map((plan) => (
                              <li key={`${plan.cantidadCuotas}-${plan.valorCuota}`}>
                                <strong>
                                  {plan.cantidadCuotas} cuotas de{" "}
                                  {formatearMoneda(plan.valorCuota)}
                                </strong>
                                <span>{plan.afiliados} afiliado(s)</span>
                              </li>
                            ))}
                          </ul>
                        </dd>
                      </div>
                    ) : (
                      <>
                        <div>
                          <dt>Cantidad de cuotas</dt>
                          <dd>
                            {planesContratacionesSeleccionado[0]?.cantidadCuotas ||
                              servicioSeleccionado.cantidadCuotas ||
                              0}
                          </dd>
                        </div>
                        <div>
                          <dt>Valor de cuota</dt>
                          <dd>
                            {formatearMoneda(
                              planesContratacionesSeleccionado[0]?.valorCuota ||
                                servicioSeleccionado.valorCuota
                            )}
                          </dd>
                        </div>
                      </>
                    )}
                    <div>
                      <dt>Estado</dt>
                      <dd>
                        {servicioSeleccionado.activo !== false
                          ? "Activo"
                          : "Inactivo"}
                      </dd>
                    </div>
                    <div>
                      <dt>Aplicación</dt>
                      <dd>
                        {servicioSeleccionado.visibleEnApp
                          ? "Visible"
                          : "Oculto"}
                      </dd>
                    </div>
                  </dl>
                </section>
              </div>

              <section className={styles.incidentsPreview}>
                <div className={styles.serviceSectionHeader}>
                  <div>
                    <span>Seguimiento</span>
                    <h3>Afiliados con incidencias</h3>
                  </div>
                  <button
                    type="button"
                    onClick={() => abrirDetalleServicio(servicioSeleccionado)}
                  >
                    Ver listado completo
                  </button>
                </div>
                {incidenciasSeleccionadas.length > 0 ? (
                  <div className={styles.incidentsTable}>
                    <div className={styles.incidentsTableHead}>
                      <span>Afiliado</span>
                      <span>DNI</span>
                      <span>Parciales</span>
                      <span>Sin cobrar</span>
                      <span>Acción</span>
                    </div>
                    {incidenciasSeleccionadas.map((item) => (
                      <div
                        key={`${item.dni}-${item.subcontratacionId || "p"}`}
                      >
                        <strong>
                          {item.apellidoNombre || "Sin nombre registrado"}
                        </strong>
                        <span>{item.dni || "-"}</span>
                        <span className={styles.incidentPartial}>
                          {item.cuotasParciales || 0}
                        </span>
                        <span className={styles.incidentUnpaid}>
                          {item.cuotasNoCobradas || 0}
                        </span>
                        <button type="button" onClick={() => abrirCuotas(item)}>
                          Ver cuotas
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className={styles.noIncidents}>
                    <i className="pi pi-check-circle" />
                    No hay incidencias registradas en este servicio.
                  </div>
                )}
              </section>
            </>
          ) : (
            <div className={styles.emptyServiceDetail}>
              <i className="pi pi-briefcase" />
              <h3>Seleccione un servicio</h3>
              <p>El detalle operativo aparecerá en este panel.</p>
            </div>
          )}
        </div>
      </section>
        </>
      )}

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
        filtroEstadoContrataciones={filtroEstadoContrataciones}
        onLimpiarFiltroEstado={() => setFiltroEstadoContrataciones(null)}
        contratacionesFiltradas={contratacionesFiltradas}
        contratacionesServicio={contratacionesServicio}
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
        onEliminarContratacion={confirmarEliminarContratacion}
        onImportarAfiliadosExcel={importarAfiliadosExcel}
        importandoAfiliados={importandoAfiliados}
        resultadoImportacionAfiliados={resultadoImportacionAfiliados}
        onLimpiarResultadoImportacionAfiliados={() =>
          setResultadoImportacionAfiliados(null)
        }
        onImportarDescuentosExcel={importarDescuentosExcel}
        importandoDescuentos={importandoDescuentos}
      />

      <AlertaAfiliadosDialog
        visible={visibleAlertaDialog}
        onHide={() => setVisibleAlertaDialog(false)}
        servicio={alertaServicio}
        estado={alertaEstado}
        onVerCuotas={(contratacion) => {
          setVisibleAlertaDialog(false);
          abrirCuotas(contratacion);
        }}
      />

      <CuotasServicioDialog
        visible={visibleCuotas}
        onHide={() => setVisibleCuotas(false)}
        contratacion={contratacionSeleccionada}
        cuotas={cuotasContratacion}
        loading={loadingCuotas}
        guardando={guardandoEstadoCuota}
        valorCuotaServicio={
          servicios.find(
            (servicio) =>
              servicio.id === contratacionSeleccionada?.servicioId
          )?.valorCuota ||
          contratacionSeleccionada?.valorCuota ||
          0
        }
        onMarcarCobrado={confirmarMarcarCobrado}
        onMarcarParcial={abrirParcial}
        onMarcarNoCobrado={abrirNoCobrado}
        onRevertirPendiente={confirmarRevertirPendiente}
        onCancelarDesdeCuota={confirmarCancelarDesdeCuota}
        onAgregarCuotaExtra={agregarCuotaExtra}
        onEliminarCuotaExtra={confirmarEliminarCuotaExtra}
        onEditarPersonas={editarCantidadPersonas}
      />

      <Dialog
        header="Marcar descuento parcial"
        visible={visibleParcial}
        style={{ width: "520px", maxWidth: "95vw" }}
        modal
        onHide={() => setVisibleParcial(false)}
      >
        <div className={styles.formGrid}>
          <div className={styles.notaImportante}>
            Use esta opción cuando el descuento fue menor al valor total de la
            cuota. La cuota quedará marcada en <strong>amarillo</strong> como
            descuento parcial.
          </div>

          <div className={styles.formRow}>
            <label>Importe descontado *</label>
            <InputText
              value={importeParcial}
              onChange={(e) => setImporteParcial(e.target.value)}
              placeholder="Ej: 77000"
              inputMode="decimal"
            />
          </div>

          <div className={styles.formRow}>
            <label>Observación</label>
            <InputTextarea
              value={observacionParcial}
              onChange={(e) => setObservacionParcial(e.target.value)}
              rows={3}
              autoResize
              placeholder="Ej: Se descontó solo una parte de la cuota."
            />
          </div>

          <div className={styles.dialogFooter}>
            <Button
              label="Cancelar"
              icon="pi pi-times"
              className="p-button-secondary"
              onClick={() => setVisibleParcial(false)}
              disabled={guardandoEstadoCuota}
            />

            <Button
              label="Guardar parcial"
              icon="pi pi-save"
              className="p-button-warning"
              onClick={guardarParcial}
              loading={guardandoEstadoCuota}
            />
          </div>
        </div>
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
