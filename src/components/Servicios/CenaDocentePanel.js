import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Button } from "primereact/button";
import { Column } from "primereact/column";
import { DataTable } from "primereact/datatable";
import { Dropdown } from "primereact/dropdown";
import { InputText } from "primereact/inputtext";
import { ProgressSpinner } from "primereact/progressspinner";
import { Tag } from "primereact/tag";
import { Toast } from "primereact/toast";
import * as XLSX from "xlsx";
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  setDoc,
  where,
  writeBatch,
} from "firebase/firestore";

import { db } from "../../firebase/firebase-config";
import AfiliadosContratadosTabla, {
  normalizarContratacionKey,
} from "./AfiliadosContratadosTabla";
import AfiliadoContratadoCard from "./AfiliadoContratadoCard";
import styles from "../../pages/Admin/Servicios/servicios.module.css";

const NOMBRE_SERVICIO = "CENA DEL DOCENTE";
const TIPO_ESPECIAL = "cena_docente";
const CANTIDAD_CUOTAS = 7;
const ANIO_CENA = 2026;

const RESERVAS = [
  {
    value: "afiliado",
    label: "AFILIADO/A - 7 CUOTAS DE $ 14.000",
    cantidadPersonas: 1,
    valorCuota: 14000,
  },
  {
    value: "afiliado_acompanante",
    label: "AFILIADO/A MÁS UN ACOMPAÑANTE - 7 CUOTAS DE $ 28.000",
    cantidadPersonas: 2,
    valorCuota: 28000,
  },
];

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

const MESES_EXCEL = {
  ENERO: 1,
  FEBRERO: 2,
  MARZO: 3,
  ABRIL: 4,
  MAYO: 5,
  JUNIO: 6,
  JULIO: 7,
  AGOSTO: 8,
  SEPTIEMBRE: 9,
  SETIEMBRE: 9,
  OCTUBRE: 10,
  NOVIEMBRE: 11,
  DICIEMBRE: 12,
};

const formInicial = {
  dni: "",
  apellido: "",
  nombre: "",
  departamento: "",
  telefono: "",
  periodoHaberInicial: "",
  reserva: "personas_1",
  planElegido: "",
};

const nuevaCenaInicial = {
  nombre: "",
  anio: String(ANIO_CENA),
  cantidadCuotas: String(CANTIDAD_CUOTAS),
  valorCuota: String(RESERVAS[0].valorCuota),
};

const limpiarTexto = (valor) => String(valor || "").trim().replace(/\s+/g, " ");
const normalizarDni = (valor) => String(valor || "").replace(/\D/g, "");
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

const obtenerCantidadPersonasDesdePlan = (valor) => {
  const texto = normalizarClave(valor);
  if (!texto) return 0;

  const matchPersonas = texto.match(/(\d+)\s*(PERSONA|PERSONAS|PERS)/);
  if (matchPersonas) {
    const cantidad = parseNumeroEntero(matchPersonas[1]);
    if (cantidad > 0) return cantidad;
  }

  // Cubre variantes completas y abreviadas: "ACOMPAÑANTE", "ACOMPAÑANTES", "Acomp.", "ACOMP".
  if (texto.includes("ACOMP")) return 2;
  if (texto.includes("AFILIADO")) return 1;

  return 0;
};

const obtenerCantidadPersonasFila = (fila, idxPersonas, idxPlanElegido) => {
  const desdeCantidad =
    idxPersonas >= 0 ? parseNumeroEntero(fila[idxPersonas]) : 0;
  if (desdeCantidad > 0) return desdeCantidad;

  const desdePlan =
    idxPlanElegido >= 0 ? obtenerCantidadPersonasDesdePlan(fila[idxPlanElegido]) : 0;
  return desdePlan > 0 ? desdePlan : 1;
};

const formatearMoneda = (valor) =>
  new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(Number(valor || 0));

const parseImporte = (valor) => {
  if (valor === null || valor === undefined || valor === "") return 0;
  if (typeof valor === "number") {
    return valor > 0 && valor < 1000 ? valor * 1000 : valor;
  }

  const texto = limpiarTexto(valor);
  const coincidencias = texto.match(/\d+(?:[.,]\d{3})*(?:[.,]\d+)?/g);
  if (!coincidencias) return 0;

  const crudo = coincidencias[coincidencias.length - 1];
  let normalizado = crudo;
  if (normalizado.includes(".") && normalizado.includes(",")) {
    normalizado = normalizado.replace(/\./g, "").replace(",", ".");
  } else if (normalizado.includes(",")) {
    const partes = normalizado.split(",");
    normalizado =
      partes[1]?.length === 3 ? normalizado.replace(/,/g, "") : normalizado.replace(",", ".");
  } else {
    normalizado = normalizado.replace(/\./g, "");
  }

  const numero = Number(normalizado);
  if (Number.isNaN(numero)) return 0;
  return numero > 0 && numero < 1000 ? numero * 1000 : numero;
};

const normalizarClave = (valor) =>
  limpiarTexto(valor)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase();

const obtenerCampo = (data, campos) => {
  for (const campo of campos) {
    const valor = data?.[campo];
    if (valor !== undefined && valor !== null && String(valor).trim() !== "") {
      return valor;
    }
  }
  return "";
};

const periodoActual = () => {
  const fecha = new Date();
  return `${fecha.getFullYear()}-${pad2(fecha.getMonth() + 1)}`;
};

const periodoDesdeMes = (mes, anio = ANIO_CENA) => `${anio}-${pad2(mes)}`;

const sumarMesesPeriodo = (periodo, meses) => {
  const [anio, mes] = String(periodo || "").split("-").map(Number);
  if (!anio || !mes) return "";
  const fecha = new Date(anio, mes - 1 + meses, 1);
  return `${fecha.getFullYear()}-${pad2(fecha.getMonth() + 1)}`;
};

const periodoTexto = (periodo) => {
  const [anio, mes] = String(periodo || "").split("-").map(Number);
  if (!anio || !mes) return "";
  return `${MESES[mes - 1]} ${anio}`;
};

const periodoHaberTexto = (periodo) =>
  periodo ? `Haber de ${periodoTexto(periodo)}` : "";

const periodoCobroTexto = (periodo) =>
  periodo ? `A cobrar en ${periodoTexto(periodo)}` : "";

const obtenerPeriodoDesdeTexto = (valor) => {
  const texto = normalizarClave(valor);
  const entrada = Object.entries(MESES_EXCEL).find(([mes]) => texto.includes(mes));
  return entrada ? periodoDesdeMes(entrada[1]) : "";
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
  const apellidoNombre =
    limpiarTexto(`${apellido}, ${nombre}`).replace(/^,|,$/g, "") ||
    limpiarTexto(
      obtenerCampo(data, [
        "apellidoNombre",
        "nombreApellido",
        "nombreCompleto",
        "displayName",
        "fullName",
      ])
    );

  return {
    dni,
    apellido,
    nombre,
    apellidoNombre,
    email: limpiarTexto(obtenerCampo(data, ["email", "correo", "mail"])),
    telefono: limpiarTexto(
      obtenerCampo(data, ["celular", "telefono", "Telefono", "tel", "whatsapp"])
    ),
    departamento: limpiarTexto(
      obtenerCampo(data, ["departamento", "Departamento", "depto", "Depto"])
    ),
    origen,
  };
};

const buscarAfiliadoEnColeccion = async (nombreColeccion, dni) => {
  const directo = await getDoc(doc(db, nombreColeccion, dni));
  if (directo.exists()) return construirAfiliadoDesdeDoc(directo, dni, nombreColeccion);

  const camposDni = ["dni", "DNI", "documento", "Documento", "cuil", "CUIL", "cuit", "CUIT"];
  const colRef = collection(db, nombreColeccion);

  for (const campo of camposDni) {
    try {
      const snap = await getDocs(query(colRef, where(campo, "==", dni)));
      if (!snap.empty) return construirAfiliadoDesdeDoc(snap.docs[0], dni, nombreColeccion);
    } catch {
      // Algunas colecciones no tienen todos los campos o índices.
    }
  }

  return null;
};

const buscarAfiliadoPorDni = async (dniValor) => {
  const dni = normalizarDni(dniValor);
  if (!dni) return null;

  const enUsuarios = await buscarAfiliadoEnColeccion("usuarios", dni);
  if (enUsuarios) return enUsuarios;

  const enNuevoAfiliado = await buscarAfiliadoEnColeccion("nuevoAfiliado", dni);
  if (enNuevoAfiliado) return enNuevoAfiliado;

  return null;
};

const obtenerNombreCompleto = (item) =>
  limpiarTexto(item?.apellidoNombre) ||
  limpiarTexto(`${item?.apellido || ""}, ${item?.nombre || ""}`).replace(/^,|,$/g, "");

const construirOpcionesReservaCena = (servicioActual) => {
  const cantidadCuotas = Math.max(
    1,
    parseNumeroEntero(servicioActual?.cantidadCuotas) || CANTIDAD_CUOTAS
  );
  const valorBase = Number(servicioActual?.valorCuota || RESERVAS[0].valorCuota);

  return Array.from({ length: 10 }, (_, index) => {
    const cantidadPersonas = index + 1;
    const valorCuota = valorBase * cantidadPersonas;
    const descripcionPersonas =
      cantidadPersonas === 1
        ? "AFILIADO/A"
        : cantidadPersonas === 2
        ? "AFILIADO/A MÁS UN ACOMPAÑANTE"
        : `AFILIADO/A MÁS ${cantidadPersonas - 1} ACOMPAÑANTES`;

    return {
      value: `personas_${cantidadPersonas}`,
      label: `${descripcionPersonas} - ${cantidadCuotas} CUOTAS DE ${formatearMoneda(valorCuota)}`,
      cantidadPersonas,
      cantidadCuotas,
      valorCuota,
      valorCuotaBase: valorBase,
    };
  });
};

const construirReservaPorCantidad = (servicioActual, cantidad) => {
  const cantidadPersonas = Math.max(1, parseNumeroEntero(cantidad) || 1);
  const cantidadCuotas = Math.max(
    1,
    parseNumeroEntero(servicioActual?.cantidadCuotas) || CANTIDAD_CUOTAS
  );
  const valorBase = Number(servicioActual?.valorCuota || RESERVAS[0].valorCuota);
  const valorCuota = valorBase * cantidadPersonas;
  const descripcionPersonas =
    cantidadPersonas === 1
      ? "AFILIADO/A"
      : cantidadPersonas === 2
      ? "AFILIADO/A MÁS UN ACOMPAÑANTE"
      : `AFILIADO/A MÁS ${cantidadPersonas - 1} ACOMPAÑANTES`;

  return {
    value: `personas_${cantidadPersonas}`,
    label: `${descripcionPersonas} - ${cantidadCuotas} CUOTAS DE ${formatearMoneda(valorCuota)}`,
    cantidadPersonas,
    cantidadCuotas,
    valorCuota,
    valorCuotaBase: valorBase,
  };
};

// Parsea el texto real del Excel (columna "Plan elegido en formulario"), ej.
// "AFILIADO/A MÁS UN ACOMPAÑANTE - 7 CUOTAS DE $ 28.000" o
// "1 AFILIADO/A - 5 CUOTA DE $ 19.600". Cada afiliado puede tener su propia
// combinación de cuotas/monto (promos distintas), por eso esto tiene prioridad
// sobre el cálculo fijo de construirReservaPorCantidad.
//
// La cantidad de personas NO se adivina de este texto (variantes como
// "ACOMPAÑANTE" vs "Acomp." son frágiles de detectar) — siempre se toma de la
// columna explícita "CANTIDAD DE PERSONAS" del Excel, que es la fuente real.
const parsePlanElegidoCena = (texto, servicioActual) => {
  const limpio = limpiarTexto(texto);
  if (!limpio) return null;

  const matchCuotas = limpio.match(/(\d+)\s*CUOTAS?/i);
  const matchMonto = limpio.match(/\$\s*([\d.,]+)/);
  if (!matchCuotas || !matchMonto) return null;

  const cantidadCuotas = parseNumeroEntero(matchCuotas[1]);
  const valorCuota = parseImporte(matchMonto[1]);
  if (cantidadCuotas <= 0 || valorCuota <= 0) return null;

  return {
    value: `plan_excel_${cantidadCuotas}_${valorCuota}`,
    label: limpio,
    cantidadCuotas,
    valorCuota,
    valorCuotaBase: Number(servicioActual?.valorCuota || 0) || valorCuota,
  };
};

const CenaDocentePanel = ({ onVerCuotas }) => {
  const toast = useRef(null);
  const fileInputRef = useRef(null);
  const [servicio, setServicio] = useState(null);
  const [cenas, setCenas] = useState([]);
  const [contrataciones, setContrataciones] = useState([]);
  const [loading, setLoading] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [buscando, setBuscando] = useState(false);
  const [importando, setImportando] = useState(false);
  const [progresoProceso, setProgresoProceso] = useState(null);
  const [mostrarFormulario, setMostrarFormulario] = useState(false);
  const [resultadoImportacion, setResultadoImportacion] = useState(null);
  const [mostrarNuevaCena, setMostrarNuevaCena] = useState(false);
  const [nuevaCena, setNuevaCena] = useState(nuevaCenaInicial);
  const [busqueda, setBusqueda] = useState("");
  const [afiliadoSeleccionado, setAfiliadoSeleccionado] = useState(null);
  const [form, setForm] = useState({
    ...formInicial,
    periodoHaberInicial: periodoActual(),
  });

  const opcionesReserva = useMemo(
    () => construirOpcionesReservaCena(servicio),
    [servicio]
  );

  const reservaSeleccionada = useMemo(
    () => opcionesReserva.find((reserva) => reserva.value === form.reserva) || opcionesReserva[0],
    [form.reserva, opcionesReserva]
  );

  const cargarCenas = useCallback(async () => {
    const serviciosRef = collection(db, "servicios");
    const snap = await getDocs(
      query(serviciosRef, where("tipoEspecial", "==", TIPO_ESPECIAL))
    );
    const items = snap.docs
      .map((documento) => ({ id: documento.id, ...documento.data() }))
      .sort((a, b) =>
        String(b.anioCena || b.creadoEn?.seconds || "").localeCompare(
          String(a.anioCena || a.creadoEn?.seconds || "")
        )
      );
    setCenas(items);
    return items;
  }, []);

  const crearServicioCena = async () => {
    const anio = Number(String(nuevaCena.anio || "").replace(/\D/g, "")) || ANIO_CENA;
    const nombreBase = limpiarTexto(nuevaCena.nombre) || `${NOMBRE_SERVICIO} ${anio}`;
    const cantidadCuotas = parseNumeroEntero(nuevaCena.cantidadCuotas);
    const valorCuota = parseImporte(nuevaCena.valorCuota);

    if (cantidadCuotas <= 0 || valorCuota <= 0) {
      toast.current?.show({
        severity: "warn",
        summary: "Datos incompletos",
        detail: "Indicá la cantidad de cuotas y el importe base de cada cuota.",
      });
      return;
    }

    setGuardando(true);
    try {
      const serviciosRef = collection(db, "servicios");
      const nuevoRef = doc(serviciosRef);
      const payload = {
        nombre: nombreBase.toUpperCase(),
        descripcion: `Reserva especial Cena del docente ${anio}`,
        cantidadCuotas,
        valorCuota,
        activo: true,
        visibleEnApp: false,
        tipoEspecial: TIPO_ESPECIAL,
        anioCena: anio,
        creadoEn: serverTimestamp(),
        actualizadoEn: serverTimestamp(),
      };
      await setDoc(nuevoRef, payload);
      const creado = { id: nuevoRef.id, ...payload };
      const items = await cargarCenas();
      setServicio(creado);
      setCenas(items.some((item) => item.id === creado.id) ? items : [creado, ...items]);
      setContrataciones([]);
      setResultadoImportacion(null);
      setNuevaCena(nuevaCenaInicial);
      setMostrarNuevaCena(false);
      toast.current?.show({
        severity: "success",
        summary: "Cena creada",
        detail: "Ya podés cargar Excel o reservas dentro de esta cena.",
      });
    } catch (error) {
      console.error("Error al crear Cena del docente:", error);
      toast.current?.show({
        severity: "error",
        summary: "Error",
        detail: "No se pudo crear el servicio Cena del docente.",
      });
    } finally {
      setGuardando(false);
    }
  };

  const cargarContrataciones = useCallback(async (servicioActual) => {
    if (!servicioActual?.id) return;
    const snap = await getDocs(
      query(collection(db, "servicios", servicioActual.id, "contrataciones"))
    );
    const itemsBase = snap.docs.map((documento) => ({
        id: documento.id,
        servicioId: servicioActual.id,
        servicioNombre: servicioActual.nombre || NOMBRE_SERVICIO,
        ...documento.data(),
      }));

    const itemsConCuotas = await Promise.all(
      itemsBase.map(async (item) => {
        try {
          const cuotasSnap = await getDocs(
            collection(db, "servicios", servicioActual.id, "contrataciones", item.dni, "cuotas")
          );
          const cuotas = cuotasSnap.docs
            .map((cuotaDoc) => ({ id: cuotaDoc.id, ...cuotaDoc.data() }))
            .sort((a, b) => Number(a.numeroCuota || 0) - Number(b.numeroCuota || 0));
          return { ...item, cuotas };
        } catch {
          return { ...item, cuotas: [] };
        }
      })
    );

    const items = itemsConCuotas.sort((a, b) =>
      obtenerNombreCompleto(a).localeCompare(obtenerNombreCompleto(b))
    );

    setContrataciones(items);
  }, []);

  const cargarPanel = useCallback(async () => {
    setLoading(true);
    try {
      const cenasCargadas = await cargarCenas();
      const seleccionada =
        cenasCargadas.find((item) => item.id === servicio?.id) ||
        cenasCargadas[0] ||
        null;
      setServicio(seleccionada);
      if (seleccionada) {
        await cargarContrataciones(seleccionada);
      } else {
        setContrataciones([]);
      }
    } catch (error) {
      console.error("Error al cargar Cena del docente:", error);
      toast.current?.show({
        severity: "error",
        summary: "Error",
        detail: "No se pudo cargar la pestaña Cena del docente.",
      });
    } finally {
      setLoading(false);
    }
  }, [cargarCenas, cargarContrataciones, servicio?.id]);

  useEffect(() => {
    cargarPanel();
  }, [cargarPanel]);

  const actualizarCampo = (campo, valor) => {
    setForm((prev) => ({ ...prev, [campo]: valor }));
  };

  const actualizarProgreso = (actual, total, detalle = "") => {
    setProgresoProceso((prev) =>
      prev
        ? {
            ...prev,
            actual: Math.min(Number(actual || 0), Number(total || prev.total || 1)),
            total: Number(total || prev.total || 1),
            detalle: detalle || prev.detalle,
          }
        : prev
    );
  };

  const renderBarraProgreso = () => {
    if (!progresoProceso) return null;
    const total = Math.max(Number(progresoProceso.total || 1), 1);
    const actual = Math.min(Number(progresoProceso.actual || 0), total);
    const porcentaje = Math.min(Math.round((actual / total) * 100), 100);

    return (
      <div className={styles.cenaProgressBox}>
        <div className={styles.cenaProgressHeader}>
          <div>
            <span>{progresoProceso.titulo}</span>
            <strong>{progresoProceso.detalle}</strong>
          </div>
          <b>{porcentaje}%</b>
        </div>
        <div className={styles.cenaProgressTrack}>
          <i style={{ width: `${porcentaje}%` }} />
        </div>
        <small>
          {actual} de {total} procesados
        </small>
      </div>
    );
  };

  const seleccionarCena = async (item) => {
    setServicio(item);
    setBusqueda("");
    setResultadoImportacion(null);
    setMostrarFormulario(false);
    setAfiliadoSeleccionado(null);
    setContrataciones([]);
    await cargarContrataciones(item);
  };

  const eliminarServicioCena = async (item, event) => {
    event?.stopPropagation();
    if (!item?.id) return;
    const confirma = window.confirm(
      `¿Eliminar el servicio ${item.nombre || NOMBRE_SERVICIO} y todas sus reservas cargadas? Esta acción no afecta otros servicios.`
    );
    if (!confirma) return;

    setGuardando(true);
    setProgresoProceso({
      titulo: "Eliminando servicio",
      detalle: "Preparando reservas y cuotas...",
      actual: 0,
      total: 1,
    });
    try {
      const contratacionesRef = collection(db, "servicios", item.id, "contrataciones");
      const contratacionesSnap = await getDocs(contratacionesRef);
      const refsAEliminar = [];
      const totalContrataciones = Math.max(contratacionesSnap.docs.length, 1);

      for (let index = 0; index < contratacionesSnap.docs.length; index += 1) {
        const contratacionDoc = contratacionesSnap.docs[index];
        actualizarProgreso(
          index,
          totalContrataciones,
          `Revisando reserva ${index + 1} de ${contratacionesSnap.docs.length}`
        );
        const cuotasSnap = await getDocs(collection(contratacionDoc.ref, "cuotas"));
        const historialSnap = await getDocs(collection(contratacionDoc.ref, "historial"));

        cuotasSnap.docs.forEach((cuotaDoc) => refsAEliminar.push(cuotaDoc.ref));
        historialSnap.docs.forEach((historialDoc) => refsAEliminar.push(historialDoc.ref));
        refsAEliminar.push(contratacionDoc.ref);

        actualizarProgreso(
          index + 1,
          totalContrataciones,
          `Reserva ${index + 1} preparada para eliminar`
        );
      }

      refsAEliminar.push(doc(db, "servicios", item.id));
      const totalEliminaciones = Math.max(refsAEliminar.length, 1);
      let batch = writeBatch(db);
      let operaciones = 0;

      for (let index = 0; index < refsAEliminar.length; index += 1) {
        batch.delete(refsAEliminar[index]);
        operaciones += 1;
        actualizarProgreso(
          index + 1,
          totalEliminaciones,
          `Eliminando documentos ${index + 1} de ${totalEliminaciones}`
        );

        if (operaciones >= 430 || index === refsAEliminar.length - 1) {
          await batch.commit();
          batch = writeBatch(db);
          operaciones = 0;
        }
      }

      const restantes = await cargarCenas();
      const proximaSeleccion =
        servicio?.id === item.id ? restantes.find((cena) => cena.id !== item.id) || null : servicio;
      setServicio(proximaSeleccion);
      setContrataciones([]);
      setResultadoImportacion(null);
      setMostrarFormulario(false);
      if (proximaSeleccion) {
        await cargarContrataciones(proximaSeleccion);
      }
      toast.current?.show({
        severity: "success",
        summary: "Servicio eliminado",
        detail: "Se eliminaron la Cena seleccionada y todas sus reservas.",
      });
    } catch (error) {
      console.error("Error al eliminar servicio Cena del docente:", error);
      toast.current?.show({
        severity: "error",
        summary: "Error",
        detail: "No se pudo eliminar el servicio Cena del docente.",
      });
    } finally {
      setGuardando(false);
      setProgresoProceso(null);
    }
  };

  const buscarDni = async () => {
    const dni = normalizarDni(form.dni);
    if (!dni) {
      toast.current?.show({
        severity: "warn",
        summary: "DNI requerido",
        detail: "Ingresá el DNI para buscar al afiliado.",
      });
      return;
    }

    setBuscando(true);
    try {
      const afiliado = await buscarAfiliadoPorDni(dni);
      if (!afiliado) {
        setForm((prev) => ({ ...prev, dni }));
        toast.current?.show({
          severity: "info",
          summary: "No encontrado",
          detail: "Podés completar apellido y nombre manualmente.",
        });
        return;
      }

      setForm((prev) => ({
        ...prev,
        dni,
        apellido: afiliado.apellido || prev.apellido,
        nombre: afiliado.nombre || prev.nombre,
        departamento: afiliado.departamento || prev.departamento,
        telefono: afiliado.telefono || prev.telefono,
      }));
      toast.current?.show({
        severity: "success",
        summary: "Afiliado encontrado",
        detail: afiliado.apellidoNombre || `${afiliado.apellido} ${afiliado.nombre}`,
      });
    } catch (error) {
      console.error("Error al buscar DNI:", error);
      toast.current?.show({
        severity: "error",
        summary: "Error",
        detail: "No se pudo buscar el afiliado.",
      });
    } finally {
      setBuscando(false);
    }
  };

  const generarCuotas = (valorCuota, periodoHaberInicial, cantidadCuotas = CANTIDAD_CUOTAS) =>
    Array.from({ length: cantidadCuotas }, (_, index) => {
      const numeroCuota = index + 1;
      const periodoHaber = sumarMesesPeriodo(periodoHaberInicial, index);
      const periodoCobro = sumarMesesPeriodo(periodoHaberInicial, index + 1);
      return {
        id: pad2(numeroCuota),
        numeroCuota,
        etiquetaCuota: `${pad2(numeroCuota)}/${pad2(cantidadCuotas)}`,
        periodoHaber,
        periodoHaberTexto: periodoHaberTexto(periodoHaber),
        periodoCobro,
        periodoCobroTexto: periodoCobroTexto(periodoCobro),
        valorCuota,
        estado: "pendiente",
        observacion: "",
        importeDescontado: null,
        saldoPendiente: null,
        origenActualizacion: "cena_docente",
        fechaRegistroCobro: null,
        actualizadoEn: serverTimestamp(),
      };
    });

  const aplicarImportesACuotas = (cuotas, valorCuota, importesPorPeriodo = {}) =>
    cuotas.map((cuota) => {
      // Si el período no figura en el Excel (celda vacía), no se toca la cuota.
      const periodoExcel = cuota.periodoHaber || cuota.periodoCobro;
      const tieneDato = Object.prototype.hasOwnProperty.call(
        importesPorPeriodo,
        periodoExcel
      );
      if (!tieneDato) return cuota;

      const importe = Number(importesPorPeriodo[periodoExcel] || 0);
      const estado =
        importe <= 0
          ? "no_cobrado"
          : importe >= valorCuota
          ? "cobrado"
          : "descuento_parcial";
      const observacionPorEstado = {
        no_cobrado: "Sin descuento registrado en el Excel de Cena del docente (importe 0).",
        cobrado: "Descuento registrado desde Excel de Cena del docente.",
        descuento_parcial: "Descuento parcial registrado desde Excel de Cena del docente.",
      };

      return {
        ...cuota,
        estado,
        importeDescontado: importe,
        saldoPendiente: Math.max(0, valorCuota - importe),
        observacion: observacionPorEstado[estado],
        origenActualizacion: "excel_cena_docente",
        fechaRegistroCobro: serverTimestamp(),
        actualizadoEn: serverTimestamp(),
      };
    });

  const resumenCuotas = (cuotas, valorCuota) =>
    cuotas.reduce(
      (acc, cuota) => {
        const estado = cuota.estado;
        const importe = Number(cuota.importeDescontado || 0);
        acc.totalDescontado += importe;
        if (estado === "cobrado") acc.cobradas += 1;
        else if (estado === "descuento_parcial") {
          acc.parciales += 1;
          acc.saldoPendiente += Math.max(0, valorCuota - importe);
        } else if (estado === "no_cobrado") {
          acc.noCobradas += 1;
          acc.saldoPendiente += Number(cuota.saldoPendiente || valorCuota);
        } else if (estado === "cancelada") acc.canceladas += 1;
        else acc.pendientes += 1;
        return acc;
      },
      {
        cobradas: 0,
        parciales: 0,
        noCobradas: 0,
        canceladas: 0,
        pendientes: 0,
        totalDescontado: 0,
        saldoPendiente: 0,
      }
    );

  const guardarReservaDesdeDatos = async ({
    dni,
    apellido,
    nombre,
    departamento = "",
    telefono = "",
    periodoHaberInicial = "",
    periodoCobroInicial = "",
    reserva,
    planElegido = "",
    importesPorPeriodo = {},
    observacion = "",
    origenCarga = TIPO_ESPECIAL,
    permitirActualizar = false,
  }) => {
    const dniNormalizado = normalizarDni(dni);
    const apellidoLimpio = limpiarTexto(apellido);
    const nombreLimpio = limpiarTexto(nombre);
    const reservaConfig =
      reserva ||
      construirReservaPorCantidad(servicio, 1);
    const periodoHaber = periodoHaberInicial || sumarMesesPeriodo(periodoCobroInicial, -1) || periodoActual();
    const periodoCobro = periodoCobroInicial || sumarMesesPeriodo(periodoHaber, 1);

    if (!servicio?.id || !dniNormalizado || !apellidoLimpio || !nombreLimpio || !periodoHaber) {
      return {
        ok: false,
        estado: "error",
        detalle: "Datos incompletos para guardar la reserva.",
      };
    }

    const contratacionRef = doc(
      db,
      "servicios",
      servicio.id,
      "contrataciones",
      dniNormalizado
    );
    const existente = await getDoc(contratacionRef);
    if (existente.exists() && !permitirActualizar) {
      return {
        ok: false,
        estado: "duplicado",
        detalle: "Este DNI ya está cargado en Cena del docente.",
      };
    }

    const afiliado = (await buscarAfiliadoPorDni(dniNormalizado)) || null;
    const cantidadCuotas = Math.max(
      1,
      Number(reservaConfig.cantidadCuotas || servicio?.cantidadCuotas || CANTIDAD_CUOTAS)
    );
    const valorCuota = Number(reservaConfig.valorCuota || 0);
    const cuotas = aplicarImportesACuotas(
      generarCuotas(valorCuota, periodoHaber, cantidadCuotas),
      valorCuota,
      importesPorPeriodo
    );
    const resumen = resumenCuotas(cuotas, valorCuota);
    // Si el DNI está registrado en usuarios/nuevoAfiliado, sus datos personales
    // prevalecen sobre lo tipeado en el Excel. Si no está registrado, se guarda
    // tal cual viene del Excel.
    const apellidoFinal = afiliado?.apellido || apellidoLimpio;
    const nombreFinal = afiliado?.nombre || nombreLimpio;
    const apellidoNombre =
      afiliado?.apellidoNombre ||
      limpiarTexto(`${apellidoFinal}, ${nombreFinal}`);
    const batch = writeBatch(db);

    batch.set(
      contratacionRef,
      {
        dni: dniNormalizado,
        apellido: apellidoFinal,
        nombre: nombreFinal,
        apellidoNombre,
        email: afiliado?.email || existente.data()?.email || "",
        telefono: limpiarTexto(telefono) || afiliado?.telefono || existente.data()?.telefono || "",
        departamento:
          limpiarTexto(departamento) ||
          afiliado?.departamento ||
          existente.data()?.departamento ||
          "",
        registradoApp: Boolean(afiliado),
        origenApp: afiliado?.origen || "no_registrado",
        servicioId: servicio.id,
        servicioNombre: servicio.nombre || NOMBRE_SERVICIO,
        cantidadCuotas,
        valorCuota,
        valorCuotaBase: Number(reservaConfig.valorCuotaBase || servicio?.valorCuota || 0),
        cantidadPersonas: reservaConfig.cantidadPersonas,
        cantidadLugares: reservaConfig.cantidadPersonas,
        planElegido: limpiarTexto(planElegido) || reservaConfig.label,
        tipoReservaCenaDocente: reservaConfig.value,
        reservaCenaDocente: reservaConfig.label,
        detalleCuotas: reservaConfig.label,
        periodoHaberInicial: periodoHaber,
        periodoHaberInicialTexto: periodoHaberTexto(periodoHaber),
        periodoCobroInicial: periodoCobro,
        periodoCobroInicialTexto: periodoCobroTexto(periodoCobro),
        cuotasCobradas: resumen.cobradas,
        cuotasParciales: resumen.parciales,
        cuotasNoCobradas: resumen.noCobradas,
        cuotasCanceladas: resumen.canceladas,
        cuotasPendientes: resumen.pendientes,
        valorTotalContratacion: valorCuota * cantidadCuotas,
        totalDescontadoContratacion: resumen.totalDescontado,
        saldoPendienteContratacion: resumen.saldoPendiente,
        estado: "activo",
        estadoContratacion: "activo",
        cancelado: false,
        tipoPago: "cuotas",
        esPagoContado: false,
        observacionGeneral: limpiarTexto(observacion),
        origenCarga,
        ...(existente.exists() ? {} : { creadoEn: serverTimestamp() }),
        actualizadoEn: serverTimestamp(),
      },
      { merge: true }
    );

    cuotas.forEach((cuota) => {
      batch.set(doc(contratacionRef, "cuotas", cuota.id), cuota, { merge: true });
    });

    batch.set(doc(collection(contratacionRef, "historial")), {
      accion: existente.exists()
        ? "actualizar_reserva_cena_docente"
        : "crear_reserva_cena_docente",
        reserva: reservaConfig.label,
        cantidadPersonas: reservaConfig.cantidadPersonas,
        planElegido: limpiarTexto(planElegido) || reservaConfig.label,
        valorCuota,
        origenCarga,
      observacion: limpiarTexto(observacion),
      fecha: serverTimestamp(),
    });

    await batch.commit();

    return {
      ok: true,
      estado: existente.exists() ? "actualizado" : "creado",
      dni: dniNormalizado,
    };
  };

  const guardarReserva = async () => {
    const dni = normalizarDni(form.dni);
    const apellido = limpiarTexto(form.apellido);
    const nombre = limpiarTexto(form.nombre);
    const periodoHaberInicial = form.periodoHaberInicial || periodoActual();

    if (!servicio?.id || !dni || !apellido || !nombre || !periodoHaberInicial) {
      toast.current?.show({
        severity: "warn",
        summary: "Datos incompletos",
        detail: "Completá DNI, apellido, nombre y haber inicial.",
      });
      return;
    }

    setGuardando(true);
    try {
      const resultado = await guardarReservaDesdeDatos({
        dni,
        apellido,
        nombre,
        departamento: form.departamento,
        telefono: form.telefono,
        periodoHaberInicial,
        reserva: reservaSeleccionada,
        planElegido: reservaSeleccionada?.label,
      });

      if (!resultado.ok) {
        toast.current?.show({
          severity: "warn",
          summary: "Reserva existente",
          detail: resultado.detalle,
          life: 6000,
        });
        return;
      }
      setForm({ ...formInicial, periodoHaberInicial: periodoActual() });
      setMostrarFormulario(false);
      await cargarContrataciones(servicio);
      toast.current?.show({
        severity: "success",
        summary: "Reserva cargada",
        detail: `Se generaron ${reservaSeleccionada.cantidadCuotas} cuotas para Cena del docente.`,
      });
    } catch (error) {
      console.error("Error al guardar Cena del docente:", error);
      toast.current?.show({
        severity: "error",
        summary: "Error",
        detail: "No se pudo guardar la reserva.",
      });
    } finally {
      setGuardando(false);
    }
  };

  const importarExcelCena = async (archivo) => {
    if (!archivo || !servicio?.id) return;

    setImportando(true);
    setResultadoImportacion(null);
    setProgresoProceso({
      titulo: "Importando Excel",
      detalle: "Leyendo archivo...",
      actual: 0,
      total: 1,
    });
    try {
      const data = await archivo.arrayBuffer();
      const workbook = XLSX.read(data, { cellDates: true });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const filas = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "" });
      const encabezados = (filas[0] || []).map((header) => normalizarClave(header));
      const indice = (nombres) => {
        const nombresNormalizados = nombres.map(normalizarClave);
        const exacto = encabezados.findIndex((header) =>
          nombresNormalizados.includes(header)
        );
        if (exacto >= 0) return exacto;
        // Si no hay coincidencia exacta, probamos que el encabezado CONTENGA
        // alguno de los nombres buscados (ej. "Plan elegido en formulario"
        // contiene "plan elegido").
        return encabezados.findIndex((header) =>
          nombresNormalizados.some((nombre) => header.includes(nombre))
        );
      };

      const idxApellido = indice(["APELLIDO"]);
      const idxNombre = indice(["NOMBRE"]);
      const idxDni = indice(["DNI", "D.N.I.", "DOCUMENTO"]);
      const idxPersonas = indice([
        "Cant.Pers.",
        "CANT PERS",
        "CANTIDAD PERSONAS",
        "CANTIDAD DE PERSONAS",
        "PERSONAS",
        "CANTIDAD",
      ]);
      const idxPlanElegido = indice([
        "PLAN ELEGIDO",
        "PLAN",
        "RESERVA",
        "TIPO RESERVA",
        "TIPO DE RESERVA",
      ]);
      const idxDesde = indice(["CANT. CUOTAS DESDE", "CUOTAS DESDE", "DESDE"]);
      const idxObservacion = indice(["OBSERVACIÓN", "OBSERVACION"]);
      const indicesMeses = encabezados
        .map((header, index) => ({ header, index, mes: MESES_EXCEL[header] }))
        .filter((item) => item.mes);

      if (idxApellido < 0 || idxNombre < 0 || idxDni < 0 || indicesMeses.length === 0) {
        toast.current?.show({
          severity: "error",
          summary: "Excel no compatible",
          detail: "No se encontraron las columnas mínimas: apellido, nombre, DNI y meses.",
        });
        return;
      }

      let creados = 0;
      let actualizados = 0;
      let omitidos = 0;
      let errores = 0;

      const filasDatos = filas.slice(1);
      actualizarProgreso(0, Math.max(filasDatos.length, 1), "Preparando filas del Excel...");

      for (let index = 0; index < filasDatos.length; index += 1) {
        const fila = filasDatos[index];
        const dni = normalizarDni(fila[idxDni]);
        const apellido = limpiarTexto(fila[idxApellido]);
        const nombre = limpiarTexto(fila[idxNombre]);
        if (!dni || !apellido || !nombre) {
          omitidos += 1;
          actualizarProgreso(
            index + 1,
            Math.max(filasDatos.length, 1),
            `Fila ${index + 1} omitida por datos incompletos`
          );
          continue;
        }

        const planElegido = idxPlanElegido >= 0 ? limpiarTexto(fila[idxPlanElegido]) : "";
        // La cantidad de personas siempre sale de la columna "CANTIDAD DE PERSONAS"
        // (con fallback al texto del plan solo si esa columna no existe/está vacía).
        const cantidadPersonas = obtenerCantidadPersonasFila(
          fila,
          idxPersonas,
          idxPlanElegido
        );
        // Cuotas y monto sí pueden variar por promo, ahí el texto del plan manda;
        // si no se puede parsear, usamos el cálculo fijo del servicio. En ambos
        // casos, cantidadPersonas queda siempre fijada por la columna explícita.
        const planParseado = parsePlanElegidoCena(planElegido, servicio);
        const reserva = planParseado
          ? { ...planParseado, cantidadPersonas }
          : construirReservaPorCantidad(servicio, cantidadPersonas);

        // Una celda vacía significa "sin dato todavía" (no toca la cuota).
        // Una celda con 0 es un dato explícito: "no se descontó nada ese mes".
        const importesPorPeriodo = {};
        indicesMeses.forEach(({ index, mes }) => {
          const crudo = fila[index];
          const celdaVacia = crudo === "" || crudo === null || crudo === undefined;
          if (celdaVacia) return;
          importesPorPeriodo[periodoDesdeMes(mes)] = parseImporte(crudo);
        });

        const periodoDesdeTexto = obtenerPeriodoDesdeTexto(fila[idxDesde]);
        const primerMesConImporte = indicesMeses.find(({ index }) => {
          const crudo = fila[index];
          return !(crudo === "" || crudo === null || crudo === undefined);
        });
        const periodoHaberInicial =
          periodoDesdeTexto ||
          (primerMesConImporte ? periodoDesdeMes(primerMesConImporte.mes) : periodoDesdeMes(4));

        try {
          const resultado = await guardarReservaDesdeDatos({
            dni,
            apellido,
            nombre,
            periodoHaberInicial,
            reserva,
            planElegido,
            importesPorPeriodo,
            observacion: idxObservacion >= 0 ? fila[idxObservacion] : "",
            origenCarga: "excel_cena_docente",
            permitirActualizar: true,
          });

          if (resultado.estado === "creado") creados += 1;
          else if (resultado.estado === "actualizado") actualizados += 1;
          else omitidos += 1;
        } catch (error) {
          console.error("Error importando fila Cena del docente:", error);
          errores += 1;
        }

        actualizarProgreso(
          index + 1,
          Math.max(filasDatos.length, 1),
          `${apellido}, ${nombre} (${dni})`
        );
      }

      actualizarProgreso(Math.max(filasDatos.length, 1), Math.max(filasDatos.length, 1), "Actualizando listado...");
      await cargarContrataciones(servicio);
      setResultadoImportacion({ creados, actualizados, omitidos, errores });
      toast.current?.show({
        severity: errores ? "warn" : "success",
        summary: "Excel procesado",
        detail: `Creados: ${creados}. Actualizados: ${actualizados}. Omitidos: ${omitidos}. Errores: ${errores}.`,
        life: 8000,
      });
    } catch (error) {
      console.error("Error al importar Excel Cena del docente:", error);
      toast.current?.show({
        severity: "error",
        summary: "Error",
        detail: "No se pudo importar el Excel de Cena del docente.",
      });
    } finally {
      setImportando(false);
      setProgresoProceso(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const eliminarReserva = async (item) => {
    if (!servicio?.id || !item?.dni) return;
    const confirma = window.confirm(
      `¿Eliminar la autorización/reserva de ${obtenerNombreCompleto(item)} en Cena del docente?`
    );
    if (!confirma) return;

    setGuardando(true);
    setProgresoProceso({
      titulo: "Eliminando reserva",
      detalle: "Preparando cuotas de la reserva...",
      actual: 0,
      total: 1,
    });
    try {
      const contratacionRef = doc(db, "servicios", servicio.id, "contrataciones", item.dni);
      const cuotasSnap = await getDocs(collection(contratacionRef, "cuotas"));
      const historialSnap = await getDocs(collection(contratacionRef, "historial"));
      const totalEliminaciones = cuotasSnap.docs.length + historialSnap.docs.length + 1;
      const batch = writeBatch(db);
      let procesados = 0;
      cuotasSnap.docs.forEach((cuota) => {
        batch.delete(cuota.ref);
        procesados += 1;
        actualizarProgreso(procesados, totalEliminaciones, "Eliminando cuotas...");
      });
      historialSnap.docs.forEach((historial) => {
        batch.delete(historial.ref);
        procesados += 1;
        actualizarProgreso(procesados, totalEliminaciones, "Eliminando historial...");
      });
      await batch.commit();
      actualizarProgreso(totalEliminaciones, totalEliminaciones, "Eliminando reserva...");
      await deleteDoc(contratacionRef);
      if (
        afiliadoSeleccionado &&
        normalizarContratacionKey(afiliadoSeleccionado) ===
          normalizarContratacionKey(item)
      ) {
        setAfiliadoSeleccionado(null);
      }
      await cargarContrataciones(servicio);
      toast.current?.show({
        severity: "success",
        summary: "Reserva eliminada",
        detail: "La reserva fue eliminada correctamente.",
      });
    } catch (error) {
      console.error("Error al eliminar reserva Cena del docente:", error);
      toast.current?.show({
        severity: "error",
        summary: "Error",
        detail: "No se pudo eliminar la reserva.",
      });
    } finally {
      setGuardando(false);
      setProgresoProceso(null);
    }
  };

  const contratacionesFiltradas = useMemo(() => {
    const termino = limpiarTexto(busqueda).toLowerCase();
    const dni = normalizarDni(busqueda);
    if (!termino && !dni) return contrataciones;

    return contrataciones.filter((item) => {
      const texto = [
        item.apellido,
        item.nombre,
        item.apellidoNombre,
        item.departamento,
        item.reservaCenaDocente,
      ]
        .join(" ")
        .toLowerCase();
      return texto.includes(termino) || normalizarDni(item.dni).includes(dni);
    });
  }, [busqueda, contrataciones]);

  const afiliadoSeleccionadoKey = afiliadoSeleccionado
    ? normalizarContratacionKey(afiliadoSeleccionado)
    : "";

  const resumen = useMemo(
    () =>
      contrataciones.reduce(
        (acc, item) => {
          acc.reservas += 1;
          acc.personas += obtenerCantidadPersonasContratacion(item);
          acc.total += Number(item.valorTotalContratacion || 0);
          acc.pendiente += Number(item.saldoPendienteContratacion || 0);
          return acc;
        },
        { reservas: 0, personas: 0, total: 0, pendiente: 0 }
      ),
    [contrataciones]
  );

  const resumenCuotasPanel = useMemo(
    () =>
      contrataciones.reduce(
        (acc, item) => {
          acc.cobradas += Number(item.cuotasCobradas || 0);
          acc.parciales += Number(item.cuotasParciales || 0);
          acc.noCobradas += Number(item.cuotasNoCobradas || 0);
          acc.canceladas += Number(item.cuotasCanceladas || 0);
          acc.pendientes += Number(item.cuotasPendientes || 0);
          return acc;
        },
        { cobradas: 0, parciales: 0, noCobradas: 0, canceladas: 0, pendientes: 0 }
      ),
    [contrataciones]
  );

  const totalCuotasPanel =
    resumenCuotasPanel.cobradas +
    resumenCuotasPanel.parciales +
    resumenCuotasPanel.noCobradas +
    resumenCuotasPanel.canceladas +
    resumenCuotasPanel.pendientes;

  const cumplimientoPanel =
    totalCuotasPanel > 0
      ? Math.round(
          ((resumenCuotasPanel.cobradas + resumenCuotasPanel.parciales * 0.5) /
            totalCuotasPanel) *
            100
        )
      : 0;

  const personasConIncidencia = contrataciones.reduce((acc, item) => {
    const tieneIncidencia =
      Number(item.cuotasParciales || 0) > 0 || Number(item.cuotasNoCobradas || 0) > 0;
    return acc + (tieneIncidencia ? obtenerCantidadPersonasContratacion(item) : 0);
  }, 0);

  const personasAlDia = Math.max(0, resumen.personas - personasConIncidencia);

  const personasCanceladas = contrataciones.reduce((acc, item) => {
    const estaCancelada =
      item?.cancelado === true || item?.estadoContratacion === "cancelada";
    return acc + (estaCancelada ? obtenerCantidadPersonasContratacion(item) : 0);
  }, 0);
  const reservasCanceladas = contrataciones.filter(
    (item) => item?.cancelado === true || item?.estadoContratacion === "cancelada"
  ).length;

  const incidenciasCena = useMemo(
    () =>
      contrataciones
        .filter(
          (item) =>
            Number(item.cuotasParciales || 0) > 0 ||
            Number(item.cuotasNoCobradas || 0) > 0
        )
        .slice(0, 6),
    [contrataciones]
  );

  const reservaBody = (item) => (
    <div className={styles.cenaReservaCell}>
      <strong>{obtenerCantidadPersonasContratacion(item)} persona(s)</strong>
      <span>{item.reservaCenaDocente || item.detalleCuotas || "Reserva sin detalle"}</span>
    </div>
  );

  const estadoBody = (item) => {
    if (item.cancelado || item.estadoContratacion === "cancelada") {
      return <Tag severity="warning" value="Cancelada" />;
    }
    if (Number(item.saldoPendienteContratacion || 0) <= 0 && Number(item.totalDescontadoContratacion || 0) > 0) {
      return <Tag severity="success" value="Pagada" />;
    }
    return <Tag severity="info" value="Activa" />;
  };

  const accionesBody = (item) => (
    <div className={styles.cenaAcciones}>
      <Button
        label="Ver cuotas"
        icon="pi pi-list"
        className="p-button-sm p-button-info"
        onClick={() => onVerCuotas?.({ ...item, servicioId: servicio?.id })}
      />
      <Button
        icon="pi pi-trash"
        className="p-button-sm p-button-danger p-button-outlined"
        tooltip="Eliminar reserva"
        onClick={() => eliminarReserva(item)}
        disabled={guardando}
      />
    </div>
  );

  const renderExecutiveCena = () => (
    <section className={styles.multiServicioPanel}>
      <Toast ref={toast} />
      <input
        ref={fileInputRef}
        type="file"
        accept=".xlsx,.xls"
        style={{ display: "none" }}
        onChange={(e) => importarExcelCena(e.target.files?.[0])}
      />

      <div className={styles.cenaExecutiveHeader}>
        <div>
          <span>Servicio especial</span>
          <h2>Cena del docente</h2>
          <p>
            Administrá las ediciones de Cena del docente con el mismo tablero de
            control de servicios: reservas, personas, cuotas, incidencias y
            descuentos por mes.
          </p>
        </div>
        <div className={styles.cenaToolbar}>
          <Button
            label={mostrarNuevaCena ? "Cerrar nuevo servicio" : "Nuevo servicio cena"}
            icon={mostrarNuevaCena ? "pi pi-times" : "pi pi-plus"}
            className="p-button-warning"
            onClick={() => setMostrarNuevaCena((prev) => !prev)}
          />
          <Button
            label="Recargar"
            icon="pi pi-refresh"
            className="p-button-text p-button-warning"
            onClick={cargarPanel}
            disabled={guardando || importando}
          />
        </div>
      </div>

      {mostrarNuevaCena && (
        <section className={styles.cenaNuevaBox}>
          <div>
            <span>Nueva edición</span>
            <h3>Crear servicio Cena del docente</h3>
            <p>Usá el año o una descripción corta para distinguirlo de ediciones anteriores.</p>
          </div>
          <div className={styles.cenaNuevaForm}>
            <label>
              Año
              <InputText
                value={nuevaCena.anio}
                onChange={(e) =>
                  setNuevaCena((prev) => ({
                    ...prev,
                    anio: String(e.target.value || "").replace(/\D/g, "").slice(0, 4),
                  }))
                }
                placeholder="2026"
                inputMode="numeric"
              />
            </label>
            <label>
              Nombre / edición
              <InputText
                value={nuevaCena.nombre}
                onChange={(e) => setNuevaCena((prev) => ({ ...prev, nombre: e.target.value }))}
                placeholder="Cena del docente 2026"
              />
            </label>
            <label>
              Cantidad de cuotas
              <InputText
                value={nuevaCena.cantidadCuotas}
                onChange={(e) =>
                  setNuevaCena((prev) => ({
                    ...prev,
                    cantidadCuotas: String(e.target.value || "").replace(/\D/g, ""),
                  }))
                }
                placeholder="7"
                inputMode="numeric"
              />
            </label>
            <label>
              Importe cuota base
              <InputText
                value={nuevaCena.valorCuota}
                onChange={(e) =>
                  setNuevaCena((prev) => ({ ...prev, valorCuota: e.target.value }))
                }
                placeholder="14000"
                inputMode="decimal"
              />
            </label>
            <Button
              label="Crear servicio"
              icon="pi pi-check"
              className="p-button-success"
              onClick={crearServicioCena}
              loading={guardando}
            />
          </div>
        </section>
      )}

      <section className={styles.masterDetail}>
        <aside className={styles.servicesMaster}>
          <div className={styles.servicesMasterHeader}>
            <div>
              <span>Cenas creadas</span>
              <strong>{cenas.length} registradas</strong>
            </div>
          </div>

          {cenas.length > 0 ? (
            <div className={styles.servicesList}>
              {cenas.map((item) => (
                <button
                  type="button"
                  key={item.id}
                  className={`${styles.serviceExecutiveCard} ${
                    servicio?.id === item.id ? styles.serviceExecutiveCardActive : ""
                  }`}
                  onClick={() => seleccionarCena(item)}
                >
                  <span className={styles.serviceExecutiveIcon}>
                    <i className="pi pi-calendar-plus" />
                  </span>
                  <span className={styles.serviceExecutiveCopy}>
                    <small>{item.activo !== false ? "Activo" : "Inactivo"}</small>
                    <strong>{item.nombre || NOMBRE_SERVICIO}</strong>
                    <em>
                      {item.cantidadCuotas || CANTIDAD_CUOTAS} cuotas ·{" "}
                      {formatearMoneda(item.valorCuota || RESERVAS[0].valorCuota)} base
                    </em>
                  </span>
                </button>
              ))}
            </div>
          ) : (
            <div className={styles.cenaServicioEmpty}>
              <i className="pi pi-calendar-plus" />
              <strong>No hay servicios Cena del docente creados.</strong>
              <span>Crea el primero para empezar a cargar reservas.</span>
            </div>
          )}
        </aside>

        <div className={styles.serviceDetail}>
          {servicio ? (
            <>
              <div className={styles.serviceDetailHeader}>
                <div>
                  <span>Servicio seleccionado</span>
                  <h2>{servicio.nombre || NOMBRE_SERVICIO}</h2>
                  <p>
                    {servicio.descripcion ||
                      "Cargá reservas con 7 cuotas. El valor cambia según sea solo afiliado o afiliado con acompañante."}
                  </p>
                </div>
                <div className={styles.serviceDetailActions}>
                  <Button
                    label={importando ? "Importando..." : "Subir Excel"}
                    icon="pi pi-upload"
                    className="p-button-warning"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={guardando || importando}
                  />
                  <Button
                    label={mostrarFormulario ? "Ocultar individual" : "Reserva individual"}
                    icon={mostrarFormulario ? "pi pi-times" : "pi pi-user-plus"}
                    className="p-button-outlined p-button-secondary"
                    onClick={() => setMostrarFormulario((prev) => !prev)}
                    disabled={guardando || importando}
                  />
                  <Button
                    label="Eliminar servicio"
                    icon="pi pi-trash"
                    className="p-button-outlined p-button-danger"
                    onClick={(event) => eliminarServicioCena(servicio, event)}
                    disabled={guardando || importando}
                  />
                </div>
              </div>

              {resultadoImportacion && (
                <div className={styles.cenaImportResult}>
                  <strong>Importación Excel:</strong>
                  <span>{resultadoImportacion.creados} creados</span>
                  <span>{resultadoImportacion.actualizados} actualizados</span>
                  <span>{resultadoImportacion.omitidos} omitidos</span>
                  <span>{resultadoImportacion.errores} errores</span>
                </div>
              )}

              {renderBarraProgreso()}

              <div className={styles.serviceMetrics}>
                <article>
                  <span>Reservas</span>
                  <strong>{resumen.reservas}</strong>
                  <small>Afiliados cargados en esta cena</small>
                </article>
                <article>
                  <span>Personas (tarjetas)</span>
                  <strong>{resumen.personas}</strong>
                  <small>
                    {personasAlDia} al día · {personasConIncidencia} con incidencia
                  </small>
                </article>
                <article>
                  <span>Tarjetas canceladas</span>
                  <strong>{personasCanceladas}</strong>
                  <small>{reservasCanceladas} reserva(s) cancelada(s)</small>
                </article>
                <article>
                  <span>Cumplimiento</span>
                  <strong>{cumplimientoPanel}%</strong>
                  <div className={styles.serviceProgress}>
                    <i style={{ width: `${cumplimientoPanel}%` }} />
                  </div>
                </article>
                <article>
                  <span>Cuotas cobradas</span>
                  <strong>{resumenCuotasPanel.cobradas}</strong>
                  <small>{resumenCuotasPanel.pendientes} pendientes</small>
                </article>
                <article>
                  <span>Incidencias</span>
                  <strong>{resumenCuotasPanel.parciales + resumenCuotasPanel.noCobradas}</strong>
                  <small>
                    {resumenCuotasPanel.parciales} parciales ·{" "}
                    {resumenCuotasPanel.noCobradas} sin cobrar
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
                  <div className={styles.statusStack}>
                    <i className={styles.statusCobrado} style={{ flex: resumenCuotasPanel.cobradas }} />
                    <i className={styles.statusParcial} style={{ flex: resumenCuotasPanel.parciales }} />
                    <i className={styles.statusNoCobrado} style={{ flex: resumenCuotasPanel.noCobradas }} />
                    <i className={styles.statusPendiente} style={{ flex: resumenCuotasPanel.pendientes }} />
                  </div>
                  <div className={styles.statusLegend}>
                    <span>
                      <i className={styles.dotCobrado} /> Cobradas
                      <b>{resumenCuotasPanel.cobradas}</b>
                    </span>
                    <span>
                      <i className={styles.dotParcial} /> Parciales
                      <b>{resumenCuotasPanel.parciales}</b>
                    </span>
                    <span>
                      <i className={styles.dotNoCobrado} /> No cobradas
                      <b>{resumenCuotasPanel.noCobradas}</b>
                    </span>
                    <span>
                      <i className={styles.dotPendiente} /> Pendientes
                      <b>{resumenCuotasPanel.pendientes}</b>
                    </span>
                  </div>
                </section>

                <section className={styles.serviceConfiguration}>
                  <div className={styles.serviceSectionHeader}>
                    <div>
                      <span>Configuración</span>
                      <h3>Condiciones del servicio</h3>
                    </div>
                  </div>
                  <dl>
                    <div className={styles.planesMultiples}>
                      <dt>Cuota establecida</dt>
                      <dd>
                        <ul className={styles.planesMultiplesLista}>
                          {[
                            {
                              cantidadCuotas: servicio.cantidadCuotas || CANTIDAD_CUOTAS,
                              valorCuota: servicio.valorCuota || RESERVAS[0].valorCuota,
                              afiliados: resumen.reservas,
                            },
                          ].map((plan) => (
                              <li key={`${plan.cantidadCuotas}-${plan.valorCuota}`}>
                                <strong>
                                  {plan.cantidadCuotas} cuotas de{" "}
                                  {formatearMoneda(plan.valorCuota)}
                                </strong>
                                <span>cuota establecida</span>
                              </li>
                            ))}
                        </ul>
                      </dd>
                    </div>
                    <div>
                      <dt>Estado</dt>
                      <dd>{servicio.activo !== false ? "Activo" : "Inactivo"}</dd>
                    </div>
                    <div>
                      <dt>Aplicación</dt>
                      <dd>{servicio.visibleEnApp ? "Visible" : "Oculto"}</dd>
                    </div>
                  </dl>
                </section>
              </div>

              <section className={styles.incidentsPreview}>
                <div className={styles.serviceSectionHeader}>
                  <div>
                    <span>Seguimiento</span>
                    <h3>Reservas con incidencias</h3>
                  </div>
                </div>
                {incidenciasCena.length > 0 ? (
                  <div className={styles.incidentsTable}>
                    <div className={styles.incidentsTableHead}>
                      <span>Afiliado</span>
                      <span>DNI</span>
                      <span>Parciales</span>
                      <span>Sin cobrar</span>
                      <span>Acción</span>
                    </div>
                    {incidenciasCena.map((item) => (
                      <div key={item.dni}>
                        <strong>{obtenerNombreCompleto(item)}</strong>
                        <span>{item.dni}</span>
                        <span className={styles.incidentPartial}>{item.cuotasParciales || 0}</span>
                        <span className={styles.incidentUnpaid}>{item.cuotasNoCobradas || 0}</span>
                        <button
                          type="button"
                          onClick={() => onVerCuotas?.({ ...item, servicioId: servicio?.id })}
                        >
                          Ver cuotas
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className={styles.noIncidents}>
                    <i className="pi pi-check-circle" />
                    No hay incidencias registradas en esta cena.
                  </div>
                )}
              </section>

            </>
          ) : (
            <div className={styles.emptyServiceDetail}>
              <i className="pi pi-calendar-plus" />
              <h3>Seleccione o cree una Cena del docente</h3>
              <p>El tablero de control aparecerá en este panel.</p>
            </div>
          )}
        </div>
      </section>

      {servicio && mostrarFormulario && (
        <div className={styles.cenaFormCard}>
          <div>
            <span>Alta rápida</span>
            <h3>Nueva reserva</h3>
          </div>

          <div className={styles.cenaForm}>
            <label>
              DNI
              <span>
                <InputText
                  value={form.dni}
                  onChange={(e) => actualizarCampo("dni", normalizarDni(e.target.value))}
                  placeholder="DNI"
                  inputMode="numeric"
                />
                <Button
                  icon="pi pi-search"
                  label="Buscar"
                  className="p-button-warning"
                  onClick={buscarDni}
                  loading={buscando}
                />
              </span>
            </label>
            <label>
              Apellido
              <InputText
                value={form.apellido}
                onChange={(e) => actualizarCampo("apellido", e.target.value)}
                placeholder="Apellido"
              />
            </label>
            <label>
              Nombre
              <InputText
                value={form.nombre}
                onChange={(e) => actualizarCampo("nombre", e.target.value)}
                placeholder="Nombre"
              />
            </label>
            <label>
              Plan elegido
              <Dropdown
                value={form.reserva}
                options={opcionesReserva}
                onChange={(e) => actualizarCampo("reserva", e.value)}
                optionLabel="label"
                optionValue="value"
              />
            </label>
            <label>
              Haber inicial
              <InputText
                type="month"
                value={form.periodoHaberInicial}
                onChange={(e) => actualizarCampo("periodoHaberInicial", e.target.value)}
              />
            </label>
            <label>
              Departamento
              <InputText
                value={form.departamento}
                onChange={(e) => actualizarCampo("departamento", e.target.value)}
                placeholder="Opcional"
              />
            </label>
            <label>
              Teléfono
              <InputText
                value={form.telefono}
                onChange={(e) => actualizarCampo("telefono", e.target.value)}
                placeholder="Opcional"
              />
            </label>
          </div>

          <div className={styles.cenaResumenReserva}>
            <strong>{reservaSeleccionada.cantidadPersonas} persona(s)</strong>
            <span>
              {reservaSeleccionada.cantidadCuotas} cuotas de {formatearMoneda(reservaSeleccionada.valorCuota)}
            </span>
          </div>

          <Button
            label="Guardar reserva"
            icon="pi pi-check"
            className="p-button-success"
            onClick={guardarReserva}
            loading={guardando}
          />
        </div>
      )}

      {servicio && (
        <div className={styles.cenaTablaCard}>
          <div className={styles.cenaTablaHeader}>
            <div>
              <h3>Afiliados contratados</h3>
              <p>{contrataciones.length} afiliados en este servicio.</p>
            </div>
          </div>

          <div className={styles.multiServicioSearch}>
            <i className="pi pi-search" />
            <InputText
              value={busqueda}
              onChange={(e) => {
                setBusqueda(e.target.value);
                setAfiliadoSeleccionado(null);
              }}
              placeholder="Buscar por DNI, apellido, nombre o reserva"
            />
          </div>

          <AfiliadosContratadosTabla
            servicioId={servicio.id}
            contrataciones={contratacionesFiltradas}
            seleccionadoKey={afiliadoSeleccionadoKey}
            onSeleccionar={setAfiliadoSeleccionado}
            periodoColumna="periodoHaber"
            renderDetalle={(contratacion) => (
              <div className={styles.detalleAfiliadoSeleccionado}>
                <div className={styles.detalleAfiliadoHeader}>
                  <div>
                    <span>Detalle seleccionado</span>
                    <strong>{contratacion.apellidoNombre || contratacion.dni}</strong>
                  </div>
                  <Button
                    icon="pi pi-times"
                    className="p-button-rounded p-button-text p-button-sm"
                    onClick={() => setAfiliadoSeleccionado(null)}
                    tooltip="Cerrar detalle"
                    tooltipOptions={{ position: "top" }}
                  />
                </div>
                <AfiliadoContratadoCard
                  rowData={contratacion}
                  servicioSeleccionado={servicio}
                  onVerCuotas={(item) =>
                    onVerCuotas?.({ ...item, servicioId: servicio?.id })
                  }
                  onEliminarContratacion={eliminarReserva}
                />
              </div>
            )}
          />
        </div>
      )}
    </section>
  );

  if (loading) {
    return (
      <section className={styles.multiServicioPanel}>
        <div className={styles.loadingBox}>
          <ProgressSpinner style={{ width: 46, height: 46 }} />
          <span>Cargando Cena del docente...</span>
        </div>
      </section>
    );
  }

  if (servicio || !servicio) {
    return renderExecutiveCena();
  }

  return (
    <section className={styles.multiServicioPanel}>
      <Toast ref={toast} />
      <input
        ref={fileInputRef}
        type="file"
        accept=".xlsx,.xls"
        style={{ display: "none" }}
        onChange={(e) => importarExcelCena(e.target.files?.[0])}
      />

      <div className={styles.multiServicioHeader}>
        <div>
          <span>Servicio especial</span>
          <h2>Cena del docente</h2>
          <p>
            Cargá reservas con 7 cuotas. El valor cambia según sea solo afiliado
            o afiliado con acompañante.
          </p>
        </div>
        <div className={styles.multiServicioKpis}>
          <article>
            <span>Reservas</span>
            <strong>{resumen.reservas}</strong>
          </article>
          <article>
            <span>Personas</span>
            <strong>{resumen.personas}</strong>
          </article>
          <article>
            <span>Total planificado</span>
            <strong>{formatearMoneda(resumen.total)}</strong>
          </article>
        </div>
      </div>

      <div className={styles.cenaToolbar}>
        <Button
          label="Recargar"
          icon="pi pi-refresh"
          className="p-button-text p-button-warning"
          onClick={cargarPanel}
          disabled={guardando || importando}
        />
      </div>

      {false && mostrarNuevaCena && (
        <section className={styles.cenaNuevaBox}>
          <div>
            <span>Nueva edición</span>
            <h3>Crear servicio Cena del docente</h3>
            <p>Usá el año o una descripción corta para distinguirlo de ediciones anteriores.</p>
          </div>
          <div className={styles.cenaNuevaForm}>
            <label>
              Año
              <InputText
                value={nuevaCena.anio}
                onChange={(e) =>
                  setNuevaCena((prev) => ({
                    ...prev,
                    anio: String(e.target.value || "").replace(/\D/g, "").slice(0, 4),
                  }))
                }
                placeholder="2026"
                inputMode="numeric"
              />
            </label>
            <label>
              Nombre / edición
              <InputText
                value={nuevaCena.nombre}
                onChange={(e) =>
                  setNuevaCena((prev) => ({ ...prev, nombre: e.target.value }))
                }
                placeholder="Cena del docente 2026"
              />
            </label>
            <Button
              label="Crear servicio"
              icon="pi pi-check"
              className="p-button-success"
              onClick={crearServicioCena}
              loading={guardando}
            />
          </div>
        </section>
      )}

      <section className={styles.cenaServiciosBox}>
        <div className={styles.cenaTablaHeader}>
          <div>
            <span>Servicios creados</span>
            <h3>{cenas.length} Cena(s) del docente</h3>
          </div>
        </div>
        {cenas.length > 0 ? (
          <div className={styles.cenaServiciosGrid}>
            {cenas.map((item) => (
              <div
                key={item.id}
                role="button"
                tabIndex={0}
                className={`${styles.cenaServicioCard} ${
                  servicio?.id === item.id ? styles.cenaServicioCardActiva : ""
                }`}
                onClick={() => seleccionarCena(item)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") seleccionarCena(item);
                }}
              >
                <div className={styles.cenaServicioCardHeader}>
                  <span>{item.anioCena || "Edición"}</span>
                  <Button
                    icon="pi pi-trash"
                    label="Eliminar servicio"
                    className="p-button-sm p-button-danger p-button-outlined"
                    onClick={(event) => eliminarServicioCena(item, event)}
                    disabled={guardando || importando}
                  />
                </div>
                <strong>{item.nombre || NOMBRE_SERVICIO}</strong>
                <small>
                  {item.cantidadCuotas || CANTIDAD_CUOTAS} cuotas -{" "}
                  {formatearMoneda(item.valorCuota || RESERVAS[0].valorCuota)} base
                </small>
              </div>
            ))}
          </div>
        ) : (
          <div className={styles.cenaServicioEmpty}>
            <i className="pi pi-calendar-plus" />
            <strong>No hay servicios Cena del docente creados.</strong>
            <span>Crea el primero para empezar a cargar reservas.</span>
          </div>
        )}
      </section>

      {servicio ? (
        <>
          <div className={styles.cenaServicioSeleccionado}>
            <div>
              <span>Servicio seleccionado</span>
              <h3>{servicio.nombre || NOMBRE_SERVICIO}</h3>
              <p>
                Cargá reservas con 7 cuotas. El valor cambia según sea solo afiliado
                o afiliado con acompañante.
              </p>
            </div>
            <Tag severity="warning" value={servicio.anioCena || ANIO_CENA} />
          </div>

      <div className={styles.cenaToolbar}>
        <Button
          label={importando ? "Importando..." : "Subir Excel"}
          icon="pi pi-upload"
          className="p-button-warning"
          onClick={() => fileInputRef.current?.click()}
          disabled={guardando || importando}
        />
        <Button
          label={mostrarFormulario ? "Ocultar carga individual" : "Subir reserva individual"}
          icon={mostrarFormulario ? "pi pi-times" : "pi pi-user-plus"}
          className="p-button-outlined p-button-secondary"
          onClick={() => setMostrarFormulario((prev) => !prev)}
          disabled={guardando || importando}
        />
        <Button
          label="Recargar"
          icon="pi pi-refresh"
          className="p-button-text p-button-warning"
          onClick={cargarPanel}
          disabled={guardando || importando}
        />
      </div>

      {resultadoImportacion && (
        <div className={styles.cenaImportResult}>
          <strong>Importación Excel:</strong>
          <span>{resultadoImportacion.creados} creados</span>
          <span>{resultadoImportacion.actualizados} actualizados</span>
          <span>{resultadoImportacion.omitidos} omitidos</span>
          <span>{resultadoImportacion.errores} errores</span>
        </div>
      )}
      {renderBarraProgreso()}
      <div
        className={`${styles.cenaDocenteGrid} ${
          !mostrarFormulario ? styles.cenaDocenteGridSimple : ""
        }`}
      >
        {mostrarFormulario && (
        <div className={styles.cenaFormCard}>
          <div>
            <span>Alta rápida</span>
            <h3>Nueva reserva</h3>
          </div>

          <div className={styles.cenaForm}>
            <label>
              DNI
              <span>
                <InputText
                  value={form.dni}
                  onChange={(e) => actualizarCampo("dni", normalizarDni(e.target.value))}
                  placeholder="DNI"
                  inputMode="numeric"
                />
                <Button
                  icon="pi pi-search"
                  label="Buscar"
                  className="p-button-warning"
                  onClick={buscarDni}
                  loading={buscando}
                />
              </span>
            </label>

            <label>
              Apellido
              <InputText
                value={form.apellido}
                onChange={(e) => actualizarCampo("apellido", e.target.value)}
                placeholder="Apellido"
              />
            </label>

            <label>
              Nombre
              <InputText
                value={form.nombre}
                onChange={(e) => actualizarCampo("nombre", e.target.value)}
                placeholder="Nombre"
              />
            </label>

            <label>
              Plan elegido
              <Dropdown
                value={form.reserva}
                options={opcionesReserva}
                onChange={(e) => actualizarCampo("reserva", e.value)}
                optionLabel="label"
                optionValue="value"
              />
            </label>

            <label>
              Haber inicial
              <InputText
                type="month"
                value={form.periodoHaberInicial}
                onChange={(e) => actualizarCampo("periodoHaberInicial", e.target.value)}
              />
            </label>

            <label>
              Departamento
              <InputText
                value={form.departamento}
                onChange={(e) => actualizarCampo("departamento", e.target.value)}
                placeholder="Opcional"
              />
            </label>

            <label>
              Teléfono
              <InputText
                value={form.telefono}
                onChange={(e) => actualizarCampo("telefono", e.target.value)}
                placeholder="Opcional"
              />
            </label>
          </div>

          <div className={styles.cenaResumenReserva}>
            <strong>{reservaSeleccionada.cantidadPersonas} persona(s)</strong>
            <span>
              {reservaSeleccionada.cantidadCuotas} cuotas de {formatearMoneda(reservaSeleccionada.valorCuota)}
            </span>
          </div>

          <Button
            label="Guardar reserva"
            icon="pi pi-check"
            className="p-button-success"
            onClick={guardarReserva}
            loading={guardando}
          />
        </div>
        )}

        <div className={styles.cenaTablaCard}>
          <div className={styles.cenaTablaHeader}>
            <div>
              <span>Reservas registradas</span>
              <h3>{contrataciones.length} cargadas</h3>
            </div>
          </div>

          <div className={styles.multiServicioSearch}>
            <i className="pi pi-search" />
            <InputText
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              placeholder="Buscar por DNI, apellido, nombre o reserva"
            />
          </div>

          <DataTable
            value={contratacionesFiltradas}
            className={styles.serviciosTable}
            paginator
            rows={8}
            responsiveLayout="scroll"
            emptyMessage="No hay reservas cargadas."
          >
            <Column field="apellido" header="Apellido" sortable />
            <Column field="nombre" header="Nombre" sortable />
            <Column field="dni" header="DNI" sortable />
            <Column header="Cantidad / reserva" body={reservaBody} />
            <Column
              header="Valor cuota"
              body={(item) => formatearMoneda(item.valorCuota)}
              sortable
            />
            <Column header="Estado" body={estadoBody} />
            <Column header="Acciones" body={accionesBody} />
          </DataTable>
        </div>
      </div>
        </>
      ) : null}
    </section>
  );
};

export default CenaDocentePanel;
