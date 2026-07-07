// src/components/HabilitarBotones/HabilitarBotonesPanel.js

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Button } from "primereact/button";
import { Dialog } from "primereact/dialog";
import { Toast } from "primereact/toast";
import { InputText } from "primereact/inputtext";
import { ProgressSpinner } from "primereact/progressspinner";
import { InputSwitch } from "primereact/inputswitch";
import { DataTable } from "primereact/datatable";
import { Column } from "primereact/column";
import { Tag } from "primereact/tag";
import {
  collection,
  deleteDoc,
  deleteField,
  doc,
  getDoc,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  where,
} from "firebase/firestore";

import { db } from "../../firebase/firebase-config";
import styles from "./habilitarbotones.module.css";

import ModalConstanciasCertificados from "./modales/ModalConstanciasCertificados";

import { useQRSync } from "./qr/useQRSync.js";
import QRSessionPanel from "./qr/QRSessionPanel.js";
import QRScreenRegisterDialog from "./qr/QRScreenRegisterDialog.js";
import QRSyncDialog from "./qr/QRSyncDialog.js";
import QRDisplayDialog from "./qr/QRDisplayDialog.js";

const normalizarDni = (valor) => String(valor || "").replace(/\D/g, "");

const PERMISO_LABELS = {
  ver: "Ver",
  agregarObservaciones: "Observaciones",
  cambiarEstado: "Cambiar estado",
  exportarExcel: "Exportar Excel",
  importarExcel: "Importar Excel",
  eliminar: "Eliminar",
};

const delegadoFormInicial = {
  dni: "",
  apellido: "",
  nombre: "",
  apellidoNombre: "",
  email: "",
  telefono: "",
  departamento: "",
  registradoApp: false,
  origenApp: "no_registrado",
  habilitado: true,
  pantallaQrHabilitada: false,
  expedienteSueldoHabilitado: true,
  permisos: {
    ver: true,
    agregarObservaciones: false,
    cambiarEstado: false,
    exportarExcel: false,
    importarExcel: false,
    eliminar: false,
  },
  observaciones: "",
};

const camposDni = ["dni", "DNI", "documento", "Documento", "cuil", "CUIL"];

const obtenerCampo = (data, campos) => {
  for (const campo of campos) {
    if (data?.[campo] !== undefined && data?.[campo] !== null) {
      return data[campo];
    }
  }
  return "";
};

const normalizarPersona = (docSnap, origen) => {
  const data = docSnap?.data?.() || {};
  const apellido = String(
    obtenerCampo(data, ["apellido", "Apellido", "apellidos", "Apellidos"])
  ).trim();
  const nombre = String(
    obtenerCampo(data, ["nombre", "Nombre", "nombres", "Nombres"])
  ).trim();
  const apellidoNombre = String(
    obtenerCampo(data, [
      "apellidoNombre",
      "ApellidoNombre",
      "apellido_nombre",
      "nombreCompleto",
      "NombreCompleto",
    ])
  ).trim();

  return {
    id: docSnap.id,
    apellido,
    nombre,
    apellidoNombre:
      apellidoNombre || [apellido, nombre].filter(Boolean).join(", "),
    email: String(
      obtenerCampo(data, ["email", "correo", "mail", "Email", "Correo"])
    ).trim(),
    telefono: String(
      obtenerCampo(data, [
        "telefono",
        "tel",
        "celular",
        "whatsapp",
        "Telefono",
        "Celular",
      ])
    ).trim(),
    departamento: String(
      obtenerCampo(data, ["departamento", "Departamento", "depto", "Depto"])
    ).trim(),
    origen,
  };
};

const formatearFecha = (valor) => {
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

const tieneDatoAsistencia = (valor) =>
  valor !== undefined &&
  valor !== null &&
  valor !== "" &&
  valor !== false;

const tieneIngresoCompleto = (data = {}) =>
  data.ingreso?.registrado === true ||
  tieneDatoAsistencia(data.codigoIngreso) ||
  tieneDatoAsistencia(data.ingresoFechaHora) ||
  tieneDatoAsistencia(data.horaIngreso) ||
  tieneDatoAsistencia(data.fechaIngreso) ||
  tieneDatoAsistencia(data.entrada) ||
  tieneDatoAsistencia(data.checkIn) ||
  (typeof data.ingreso !== "object" && tieneDatoAsistencia(data.ingreso));

const tieneSalidaCompleta = (data = {}) =>
  data.salida?.registrado === true ||
  tieneDatoAsistencia(data.codigoSalida) ||
  tieneDatoAsistencia(data.salidaFechaHora) ||
  tieneDatoAsistencia(data.horaSalida) ||
  tieneDatoAsistencia(data.fechaSalida) ||
  tieneDatoAsistencia(data.egreso) ||
  tieneDatoAsistencia(data.checkOut) ||
  (typeof data.salida !== "object" && tieneDatoAsistencia(data.salida));

const HabilitarBotonesPanel = () => {
  const toast = useRef(null);
  const linkInputRef = useRef(null);

  const [bootLoading, setBootLoading] = useState(true);

  /* =====================================================
     QR / ASISTENCIA
     ===================================================== */

  const {
    deviceId,
    deviceName,
    asistenciaConfig,
    sesionActual,
    pantallasArray,
    qrSync,
    qrVisible,
    setQrVisible,
    loadingSesion,
    renovandoCodigo,
    downloadingQR,
    qrContainerRef,
    estaComputadoraRegistrada,
    estaComputadoraAutorizada,
    registrarPantallaActual,
    borrarPantallaRegistrada,
    actualizarConfigAsistencia,
    abrirSesion,
    renovarCodigo,
    cerrarSesion,
    guardarSeleccionPantallas,
    activarSincronizacionQR,
    cerrarQREnPantallas,
    copiarCodigo,
    downloadQRAsPNG,
  } = useQRSync({ toastRef: toast });

  const [asistenciaHabilitada, setAsistenciaHabilitada] = useState(null);
  const [visibleDialogAsistencia, setVisibleDialogAsistencia] = useState(false);
  const [loadingAsistencia, setLoadingAsistencia] = useState(false);

  const [cursos, setCursos] = useState([]);
  const [loadingCursos, setLoadingCursos] = useState(false);
  const [selectedCursoId, setSelectedCursoId] = useState(null);
  const [selectedModalidad, setSelectedModalidad] = useState(null);
  const [requisitoPresencialVirtual, setRequisitoPresencialVirtual] =
    useState("ninguno");
  const [encuentrosPresenciales, setEncuentrosPresenciales] = useState([]);
  const [encuentrosPresencialesSeleccionados, setEncuentrosPresencialesSeleccionados] =
    useState([]);
  const [loadingEncuentrosPresenciales, setLoadingEncuentrosPresenciales] =
    useState(false);

  const [desdeLocal, setDesdeLocal] = useState("");
  const [hastaLocal, setHastaLocal] = useState("");
  const [tipoRegistro, setTipoRegistro] = useState("ingreso");
  const [autoRefreshSeconds, setAutoRefreshSeconds] = useState(60);

  const [visibleDialogRegistrarPantalla, setVisibleDialogRegistrarPantalla] =
    useState(false);
  const [nombrePantalla, setNombrePantalla] = useState("");

  const [visibleDialogSyncQR, setVisibleDialogSyncQR] = useState(false);

  /* =====================================================
     CONSTANCIAS / CERTIFICADOS
     ===================================================== */

  const [visibleDialogConstancias, setVisibleDialogConstancias] =
    useState(false);

  /* =====================================================
     MEET / VALORES / ACTUALIZACIÓN APP
     ===================================================== */

  const [visibleDialogMeet, setVisibleDialogMeet] = useState(false);
  const [linkMeet, setLinkMeet] = useState("");
  const [descripcionMeet, setDescripcionMeet] = useState("");
  const [loadingMeet, setLoadingMeet] = useState(false);

  const [visibleDialogHsSec, setVisibleDialogHsSec] = useState(false);
  const [valorHsSec, setValorHsSec] = useState("");
  const [loadingHsSec, setLoadingHsSec] = useState(false);

  const [visibleDialogHsSup, setVisibleDialogHsSup] = useState(false);
  const [valorAnualSup, setValorAnualSup] = useState("");
  const [valorCuatrSup, setValorCuatrSup] = useState("");
  const [loadingHsSup, setLoadingHsSup] = useState(false);

  const [visibleDialogSeguro, setVisibleDialogSeguro] = useState(false);
  const [valorSeguro, setValorSeguro] = useState("");
  const [loadingSeguro, setLoadingSeguro] = useState(false);

  const [visibleDialogSepelio, setVisibleDialogSepelio] = useState(false);
  const [valorSepelio, setValorSepelio] = useState("");
  const [loadingSepelio, setLoadingSepelio] = useState(false);

  const [latestVersion, setLatestVersion] = useState(0);
  const [forceUpdate, setForceUpdate] = useState(false);
  const [message, setMessage] = useState("");
  const [loadingUpdate, setLoadingUpdate] = useState(false);
  const [visibleDialogUpdate, setVisibleDialogUpdate] = useState(false);

  const CFG_REF = useMemo(() => doc(db, "config", "app"), []);

  /* =====================================================
     GESTION DELEGADOS
     ===================================================== */

  const [visibleDialogDelegados, setVisibleDialogDelegados] = useState(false);
  const [delegadosAutorizados, setDelegadosAutorizados] = useState([]);
  const [loadingDelegados, setLoadingDelegados] = useState(false);
  const [savingDelegado, setSavingDelegado] = useState(false);
  const [searchingDelegado, setSearchingDelegado] = useState(false);
  const [editingDelegadoId, setEditingDelegadoId] = useState(null);
  const [delegadoForm, setDelegadoForm] = useState(delegadoFormInicial);

  const adminActual = useMemo(() => {
    try {
      const user = JSON.parse(sessionStorage.getItem("user") || "{}");
      return user?.email || user?.uid || user?.dni || "admin";
    } catch {
      return "admin";
    }
  }, []);

  const actualizarDelegadoCampo = (campo, valor) => {
    setDelegadoForm((prev) => ({
      ...prev,
      [campo]: valor,
      ...(campo === "apellido" || campo === "nombre"
        ? {
            apellidoNombre: [
              campo === "apellido" ? valor : prev.apellido,
              campo === "nombre" ? valor : prev.nombre,
            ]
              .filter(Boolean)
              .join(", "),
          }
        : {}),
    }));
  };

  const actualizarPermisoDelegado = (permiso, valor) => {
    setDelegadoForm((prev) => ({
      ...prev,
      permisos: {
        ...prev.permisos,
        [permiso]: valor,
      },
    }));
  };

  const cargarDelegadosAutorizados = useCallback(async () => {
    setLoadingDelegados(true);
    try {
      const snap = await getDocs(
        query(collection(db, "delegadosAutorizados"), orderBy("apellidoNombre", "asc"))
      );
      setDelegadosAutorizados(
        snap.docs.map((item) => ({
          id: item.id,
          ...item.data(),
        }))
      );
    } catch (error) {
      console.error("Error al cargar delegados autorizados:", error);
      toast.current?.show({
        severity: "error",
        summary: "Error",
        detail: "No se pudieron cargar los delegados autorizados.",
      });
    } finally {
      setLoadingDelegados(false);
    }
  }, []);

  const abrirDialogDelegados = () => {
    setVisibleDialogDelegados(true);
    cargarDelegadosAutorizados();
  };

  const limpiarDelegadoForm = () => {
    setEditingDelegadoId(null);
    setDelegadoForm(delegadoFormInicial);
  };

  const buscarPersonaPorDniEnColeccion = async (coleccion, dni) => {
    const directo = await getDoc(doc(db, coleccion, dni));
    if (directo.exists()) return normalizarPersona(directo, coleccion);

    for (const campo of camposDni) {
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
          if (!snapNumero.empty) {
            return normalizarPersona(snapNumero.docs[0], coleccion);
          }
        }
      } catch {
        // Algunos campos pueden no existir o no tener indice. Seguimos con el siguiente.
      }
    }

    return null;
  };

  const buscarDelegadoPorDni = async () => {
    const dni = normalizarDni(delegadoForm.dni);
    if (!dni) {
      toast.current?.show({
        severity: "warn",
        summary: "DNI requerido",
        detail: "Ingresá un DNI válido para buscar.",
      });
      return;
    }

    setSearchingDelegado(true);
    try {
      const [enUsuarios, enNuevoAfiliado] = await Promise.all([
        buscarPersonaPorDniEnColeccion("usuarios", dni),
        buscarPersonaPorDniEnColeccion("nuevoAfiliado", dni),
      ]);

      const encontrado = enNuevoAfiliado || enUsuarios;
      const origenApp =
        enUsuarios && enNuevoAfiliado
          ? "ambos"
          : enNuevoAfiliado
          ? "nuevoAfiliado"
          : enUsuarios
          ? "usuarios"
          : "no_registrado";

      setDelegadoForm((prev) => ({
        ...prev,
        dni,
        apellido: encontrado?.apellido || prev.apellido,
        nombre: encontrado?.nombre || prev.nombre,
        apellidoNombre:
          encontrado?.apellidoNombre ||
          [prev.apellido, prev.nombre].filter(Boolean).join(", "),
        email: encontrado?.email || prev.email,
        telefono: encontrado?.telefono || prev.telefono,
        departamento: encontrado?.departamento || prev.departamento,
        registradoApp: !!encontrado,
        origenApp,
      }));

      toast.current?.show({
        severity: encontrado ? "success" : "info",
        summary: encontrado ? "Delegado encontrado" : "No registrado en app",
        detail: encontrado
          ? `Datos cargados desde ${origenApp}.`
          : "Podés cargar apellido y nombre manualmente.",
      });
    } catch (error) {
      console.error("Error al buscar delegado:", error);
      toast.current?.show({
        severity: "error",
        summary: "Error",
        detail: "No se pudo buscar el DNI.",
      });
    } finally {
      setSearchingDelegado(false);
    }
  };

  const guardarDelegadoAutorizado = async () => {
    const dni = normalizarDni(delegadoForm.dni);
    const apellido = String(delegadoForm.apellido || "").trim();
    const nombre = String(delegadoForm.nombre || "").trim();
    const apellidoNombre =
      String(delegadoForm.apellidoNombre || "").trim() ||
      [apellido, nombre].filter(Boolean).join(", ");

    if (!dni) {
      toast.current?.show({
        severity: "warn",
        summary: "DNI requerido",
        detail: "Ingresá el DNI del delegado.",
      });
      return;
    }

    if (!apellidoNombre) {
      toast.current?.show({
        severity: "warn",
        summary: "Nombre requerido",
        detail: "Completá apellido y nombre del delegado.",
      });
      return;
    }

    setSavingDelegado(true);
    try {
      const ref = doc(db, "delegadosAutorizados", dni);
      const existente = await getDoc(ref);
      const payload = {
        dni,
        apellido,
        nombre,
        apellidoNombre,
        email: String(delegadoForm.email || "").trim(),
        telefono: String(delegadoForm.telefono || "").trim(),
        departamento: String(delegadoForm.departamento || "").trim(),
        registradoApp: !!delegadoForm.registradoApp,
        origenApp: delegadoForm.origenApp || "no_registrado",
        habilitado: !!delegadoForm.habilitado,
        herramientas: {
          pantallaQr: {
            habilitado: !!delegadoForm.pantallaQrHabilitada,
          },
          expedienteSueldo: {
            habilitado: !!delegadoForm.expedienteSueldoHabilitado,
            permisos: {
              ver: !!delegadoForm.permisos.ver,
              agregarObservaciones: !!delegadoForm.permisos.agregarObservaciones,
              cambiarEstado: !!delegadoForm.permisos.cambiarEstado,
              exportarExcel: !!delegadoForm.permisos.exportarExcel,
              importarExcel: !!delegadoForm.permisos.importarExcel,
              eliminar: !!delegadoForm.permisos.eliminar,
            },
          },
        },
        observaciones: String(delegadoForm.observaciones || "").trim(),
        updatedAt: serverTimestamp(),
        updatedBy: adminActual,
      };

      if (!existente.exists()) {
        payload.createdAt = serverTimestamp();
        payload.createdBy = adminActual;
      }

      await setDoc(ref, payload, { merge: true });

      toast.current?.show({
        severity: "success",
        summary: existente.exists() ? "Delegado actualizado" : "Delegado creado",
        detail: "La autorización fue guardada correctamente.",
      });

      limpiarDelegadoForm();
      await cargarDelegadosAutorizados();
    } catch (error) {
      console.error("Error al guardar delegado:", error);
      toast.current?.show({
        severity: "error",
        summary: "Error",
        detail: "No se pudo guardar la autorización.",
      });
    } finally {
      setSavingDelegado(false);
    }
  };

  const editarDelegado = (delegado) => {
    setEditingDelegadoId(delegado.dni || delegado.id);
    setDelegadoForm({
      ...delegadoFormInicial,
      dni: delegado.dni || delegado.id || "",
      apellido: delegado.apellido || "",
      nombre: delegado.nombre || "",
      apellidoNombre: delegado.apellidoNombre || "",
      email: delegado.email || "",
      telefono: delegado.telefono || "",
      departamento: delegado.departamento || "",
      registradoApp: !!delegado.registradoApp,
      origenApp: delegado.origenApp || "no_registrado",
      habilitado: delegado.habilitado === true,
      pantallaQrHabilitada:
        delegado.herramientas?.pantallaQr?.habilitado === true,
      expedienteSueldoHabilitado:
        delegado.herramientas?.expedienteSueldo?.habilitado === true,
      permisos: {
        ...delegadoFormInicial.permisos,
        ...(delegado.herramientas?.expedienteSueldo?.permisos || {}),
      },
      observaciones: delegado.observaciones || "",
    });
  };

  const toggleDelegadoHabilitado = async (delegado) => {
    const dni = delegado.dni || delegado.id;
    if (!dni) return;
    try {
      await setDoc(
        doc(db, "delegadosAutorizados", dni),
        {
          habilitado: !(delegado.habilitado === true),
          updatedAt: serverTimestamp(),
          updatedBy: adminActual,
        },
        { merge: true }
      );
      await cargarDelegadosAutorizados();
    } catch (error) {
      console.error("Error al cambiar estado del delegado:", error);
      toast.current?.show({
        severity: "error",
        summary: "Error",
        detail: "No se pudo cambiar el estado del delegado.",
      });
    }
  };

  const eliminarDelegadoAutorizado = async (delegado) => {
    const dni = delegado.dni || delegado.id;
    if (!dni) return;

    if (!window.confirm(`¿Eliminar la autorización de ${delegado.apellidoNombre || dni}?`)) {
      return;
    }

    try {
      await deleteDoc(doc(db, "delegadosAutorizados", dni));
      if (editingDelegadoId === dni) limpiarDelegadoForm();
      await cargarDelegadosAutorizados();
      toast.current?.show({
        severity: "success",
        summary: "Autorización eliminada",
        detail: "El delegado fue eliminado de delegadosAutorizados.",
      });
    } catch (error) {
      console.error("Error al eliminar delegado:", error);
      toast.current?.show({
        severity: "error",
        summary: "Error",
        detail: "No se pudo eliminar la autorización.",
      });
    }
  };

  /* =====================================================
     SINCRONIZAR SELECCIÓN ACTUAL CON cod/asistencia
     ===================================================== */

  useEffect(() => {
    if (asistenciaConfig?.cursoId) {
      setSelectedCursoId(asistenciaConfig.cursoId);
    }

    if (asistenciaConfig?.modalidad) {
      setSelectedModalidad(asistenciaConfig.modalidad);
    }

    if (asistenciaConfig?.tipoRegistro) {
      setTipoRegistro(asistenciaConfig.tipoRegistro);
    }

    if (asistenciaConfig?.autoRefreshSeconds) {
      setAutoRefreshSeconds(Number(asistenciaConfig.autoRefreshSeconds) || 60);
    }

    setRequisitoPresencialVirtual(
      asistenciaConfig?.requisitoPresencialVirtual || "ninguno"
    );
    setEncuentrosPresencialesSeleccionados(
      Array.isArray(asistenciaConfig?.encuentrosPresencialesRequeridos)
        ? asistenciaConfig.encuentrosPresencialesRequeridos.map(
            (encuentro) => encuentro.id
          )
        : []
    );
  }, [
    asistenciaConfig?.cursoId,
    asistenciaConfig?.modalidad,
    asistenciaConfig?.tipoRegistro,
    asistenciaConfig?.autoRefreshSeconds,
    asistenciaConfig?.requisitoPresencialVirtual,
    asistenciaConfig?.encuentrosPresencialesRequeridos,
  ]);

  useEffect(() => {
    const cargarEncuentrosPresenciales = async () => {
      if (selectedModalidad !== "virtual" || !selectedCursoId) {
        setEncuentrosPresenciales([]);
        return;
      }

      setLoadingEncuentrosPresenciales(true);
      try {
        const curso = cursos.find((item) => item.value === selectedCursoId);
        const consultas = [
          query(
            collection(db, "asistencia"),
            where("cursoId", "==", selectedCursoId)
          ),
        ];

        if (curso?.label) {
          consultas.push(
            query(
              collection(db, "asistencia"),
              where("cursoTitulo", "==", curso.label)
            )
          );
          consultas.push(
            query(
              collection(db, "asistencia"),
              where("curso", "==", curso.label)
            )
          );
          consultas.push(
            query(
              collection(db, "asistencia"),
              where("cursoNombre", "==", curso.label)
            )
          );
        }

        const snapshots = await Promise.all(
          consultas.map((consulta) => getDocs(consulta))
        );
        const documentos = new Map();
        snapshots.forEach((snap) =>
          snap.docs.forEach((documento) =>
            documentos.set(documento.ref.path, documento)
          )
        );

        const encuentros = new Map();
        documentos.forEach((documento) => {
          const data = documento.data() || {};
          const esPresencial =
            data.presencial === true ||
            String(data.modalidad || data.modalidadDb || "").toLowerCase() ===
              "presencial";
          const ingresoCompleto = tieneIngresoCompleto(data);
          const salidaCompleta = tieneSalidaCompleta(data);

          if (
            !esPresencial ||
            !ingresoCompleto ||
            !salidaCompleta
          ) {
            return;
          }

          const id =
            data.sessionId ||
            data.sessionIdIngreso ||
            `${selectedCursoId}-${data.fecha || "sin-fecha"}`;
          if (!id || encuentros.has(id)) return;

          encuentros.set(id, {
            id,
            label: data.fecha
              ? `Encuentro presencial ${data.fecha}`
              : `Encuentro presencial ${encuentros.size + 1}`,
            fecha: data.fecha || "",
          });
        });

        const encuentrosDisponibles = Array.from(encuentros.values());
        setEncuentrosPresenciales(encuentrosDisponibles);
        setEncuentrosPresencialesSeleccionados((actuales) =>
          actuales.filter((id) =>
            encuentrosDisponibles.some((encuentro) => encuentro.id === id)
          )
        );
      } catch (error) {
        console.error("Cargar encuentros presenciales:", error);
        setEncuentrosPresenciales([]);
      } finally {
        setLoadingEncuentrosPresenciales(false);
      }
    };

    cargarEncuentrosPresenciales();
  }, [selectedCursoId, selectedModalidad, cursos]);

  /* =====================================================
     ESCUCHA FLAG SIMPLE cod/boton
     ===================================================== */

  useEffect(() => {
    const ref = doc(db, "cod", "boton");

    const unsub = onSnapshot(
      ref,
      (snap) => {
        if (!snap.exists()) {
          setAsistenciaHabilitada(null);
          return;
        }

        const valor = snap.data()?.cargar;
        setAsistenciaHabilitada(
          valor === "si" || valor === "no" ? valor : null
        );
      },
      (err) => {
        console.error("cod/boton onSnapshot:", err);
      }
    );

    return () => unsub();
  }, []);

  /* =====================================================
     CARGAS INICIALES
     ===================================================== */

  const cargarCursos = async () => {
    setLoadingCursos(true);

    try {
      const qry = query(collection(db, "cursos"), orderBy("titulo", "asc"));
      const snap = await getDocs(qry);
      const items = [];

      snap.forEach((d) => {
        const data = d.data() || {};
        const label = (
          data.titulo ??
          data.nombre ??
          data.name ??
          data.curso ??
          `Curso ${d.id}`
        ).toString();

        items.push({
          value: d.id,
          label,
        });
      });

      setCursos(items);
    } catch (err) {
      console.error("Cursos leer:", err);

      toast.current?.show({
        severity: "error",
        summary: "Error",
        detail: "No se pudieron cargar los cursos.",
      });
    } finally {
      setLoadingCursos(false);
    }
  };

  const cargarConfigUpdate = useCallback(async () => {
    try {
      const snap = await getDoc(CFG_REF);

      if (snap.exists()) {
        const d = snap.data() || {};

        setLatestVersion(Number(d.latestAndroidVersionCode || 0));
        setForceUpdate(!!d.forceUpdate);
        setMessage(
          typeof d.message === "string" && d.message.trim()
            ? d.message
            : 'Hay una nueva versión disponible. Toca “Actualizar ahora” y te llevamos directo a Play Store para descargarla.'
        );
      } else {
        setLatestVersion(0);
        setForceUpdate(false);
        setMessage(
          'Hay una nueva versión disponible. Toca “Actualizar ahora” y te llevamos directo a Play Store para descargarla.'
        );
      }
    } catch (e) {
      toast.current?.show({
        severity: "error",
        summary: "Error",
        detail: String(e),
      });
    }
  }, [CFG_REF]);

  const cargarMeet = async () => {
    try {
      const snap = await getDoc(doc(db, "cuotas", "sala"));

      if (snap.exists()) {
        const data = snap.data();

        setLinkMeet(typeof data?.link === "string" ? data.link : "");
        setDescripcionMeet(
          typeof data?.descripcion === "string" ? data.descripcion : ""
        );
      } else {
        setLinkMeet("");
        setDescripcionMeet("");
      }
    } catch (err) {
      console.error("Meet leer:", err);
    }
  };

  const cargarHsSec = async () => {
    try {
      const snap = await getDoc(doc(db, "cod", "secundaria"));

      setValorHsSec(
        snap.exists() && typeof snap.data()?.valor === "string"
          ? snap.data().valor
          : ""
      );
    } catch (err) {
      console.error("Hs secundaria leer:", err);
    }
  };

  const cargarHsSup = async () => {
    try {
      const snap = await getDoc(doc(db, "cod", "superior"));

      if (snap.exists()) {
        setValorAnualSup(
          typeof snap.data()?.anual === "string" ? snap.data().anual : ""
        );

        setValorCuatrSup(
          typeof snap.data()?.cuatrimestral === "string"
            ? snap.data().cuatrimestral
            : ""
        );
      } else {
        setValorAnualSup("");
        setValorCuatrSup("");
      }
    } catch (err) {
      console.error("Hs superior leer:", err);
    }
  };

  const cargarSeguro = async () => {
    try {
      const snap = await getDoc(doc(db, "cod", "seguroVidaObligatorio"));

      setValorSeguro(
        snap.exists() && typeof snap.data()?.valor === "string"
          ? snap.data().valor
          : ""
      );
    } catch (err) {
      console.error("Seguro leer:", err);
    }
  };

  const cargarSepelio = async () => {
    try {
      const snap = await getDoc(doc(db, "cod", "subsidioSepelio"));

      setValorSepelio(
        snap.exists() && typeof snap.data()?.valor === "string"
          ? snap.data().valor
          : ""
      );
    } catch (err) {
      console.error("Sepelio leer:", err);
    }
  };

  useEffect(() => {
    const loadAll = async () => {
      setBootLoading(true);

      try {
        await Promise.all([
          cargarCursos(),
          cargarMeet(),
          cargarHsSec(),
          cargarHsSup(),
          cargarSeguro(),
          cargarSepelio(),
          cargarConfigUpdate(),
        ]);
      } finally {
        setBootLoading(false);
      }
    };

    loadAll();
  }, [cargarConfigUpdate]);

  /* =====================================================
     ACCIONES QR
     ===================================================== */

  const abrirRegistrarPantalla = () => {
    setNombrePantalla(deviceName || "");
    setVisibleDialogRegistrarPantalla(true);
  };

  const guardarPantallaActual = async () => {
    try {
      const ok = await registrarPantallaActual(nombrePantalla);

      if (ok) {
        setVisibleDialogRegistrarPantalla(false);
      }
    } catch (err) {
      console.error("Guardar pantalla actual:", err);

      toast.current?.show({
        severity: "error",
        summary: "Error",
        detail: "No se pudo registrar esta computadora como pantalla QR.",
      });
    }
  };

  const seleccionarOpcionAsistencia = async (habilitar) => {
    setLoadingAsistencia(true);

    try {
      if (habilitar) {
        if (!selectedCursoId) {
          toast.current?.show({
            severity: "warn",
            summary: "Atención",
            detail: "Seleccioná un curso.",
          });
          return;
        }

        if (!selectedModalidad) {
          toast.current?.show({
            severity: "warn",
            summary: "Atención",
            detail: "Seleccioná la modalidad.",
          });
          return;
        }

        if (
          selectedModalidad === "virtual" &&
          requisitoPresencialVirtual !== "ninguno" &&
          encuentrosPresenciales.length === 0
        ) {
          toast.current?.show({
            severity: "warn",
            summary: "Sin encuentros presenciales",
            detail:
              "No se encontraron encuentros presenciales completos para este curso.",
          });
          return;
        }

        if (
          selectedModalidad === "virtual" &&
          requisitoPresencialVirtual === "especificos" &&
          encuentrosPresencialesSeleccionados.length === 0
        ) {
          toast.current?.show({
            severity: "warn",
            summary: "Seleccioná encuentros",
            detail: "Elegí al menos un encuentro presencial requerido.",
          });
          return;
        }
      }

      await setDoc(
        doc(db, "cod", "boton"),
        {
          cargar: habilitar ? "si" : "no",
          cursoId: deleteField(),
          cursoTitulo: deleteField(),
        },
        { merge: true }
      );

      const curso = cursos.find((c) => c.value === selectedCursoId);

      const cursoTitulo = curso?.label || asistenciaConfig?.cursoTitulo || "";
      const encuentrosRequeridos =
        selectedModalidad !== "virtual" ||
        requisitoPresencialVirtual === "ninguno" ||
        requisitoPresencialVirtual === "alguno"
          ? []
          : requisitoPresencialVirtual === "todos"
          ? encuentrosPresenciales
          : encuentrosPresenciales.filter((encuentro) =>
              encuentrosPresencialesSeleccionados.includes(encuentro.id)
            );

      await actualizarConfigAsistencia({
        habilitar,
        selectedCursoId,
        selectedModalidad,
        cursoTitulo,
        requisitoPresencialVirtual:
          selectedModalidad === "virtual"
            ? requisitoPresencialVirtual
            : "ninguno",
        encuentrosPresencialesRequeridos: encuentrosRequeridos,
      });

      if (!habilitar) {
        setSelectedCursoId(null);
        setSelectedModalidad(null);
        setDesdeLocal("");
        setHastaLocal("");
        setTipoRegistro("ingreso");
        setAutoRefreshSeconds(60);
        setRequisitoPresencialVirtual("ninguno");
        setEncuentrosPresencialesSeleccionados([]);
      }

      toast.current?.show({
        severity: "success",
        summary: "Guardado",
        detail: `Asistencia ${habilitar ? "habilitada" : "deshabilitada"}.`,
      });

      setVisibleDialogAsistencia(false);
    } catch (err) {
      console.error("Guardar asistencia:", err);

      toast.current?.show({
        severity: "error",
        summary: "Error",
        detail: "No se pudo guardar Asistencia.",
      });
    } finally {
      setLoadingAsistencia(false);
    }
  };

  const abrirSesionQR = async () => {
    if (asistenciaHabilitada !== "si") {
      toast.current?.show({
        severity: "warn",
        summary: "Atención",
        detail: "Primero habilitá la asistencia.",
      });
      return;
    }

    if (asistenciaConfig?.modalidad !== "presencial") {
      toast.current?.show({
        severity: "warn",
        summary: "Atención",
        detail: "La sesión QR es solo para modalidad presencial.",
      });
      return;
    }

    const curso = cursos.find((c) => c.value === selectedCursoId);
    const cursoTitulo = curso?.label || asistenciaConfig?.cursoTitulo || "";

    await abrirSesion({
      selectedCursoId,
      cursoTitulo,
      desdeLocal,
      hastaLocal,
      tipoRegistro,
      autoRefreshSeconds,
    });
  };

  const mostrarQRLocal = () => {
    if (!sesionActual?.qrPayload) {
      toast.current?.show({
        severity: "warn",
        summary: "Sin QR",
        detail: "Primero abrí una sesión QR.",
      });
      return;
    }

    setQrVisible(true);
  };

  /* =====================================================
     GUARDADOS GENERALES
     ===================================================== */

  const guardarCambiosActualizacion = useCallback(async () => {
    setLoadingUpdate(true);

    try {
      const payload = {
        latestAndroidVersionCode: Number(latestVersion) || 0,
        forceUpdate: !!forceUpdate,
        message: String(message ?? ""),
      };

      await setDoc(CFG_REF, payload, { merge: true });

      toast.current?.show({
        severity: "success",
        summary: "Guardado",
        detail: "Se actualizaron los datos de la app.",
      });

      await cargarConfigUpdate();
    } catch (e) {
      toast.current?.show({
        severity: "error",
        summary: "Error",
        detail: String(e),
      });
    } finally {
      setLoadingUpdate(false);
    }
  }, [CFG_REF, cargarConfigUpdate, forceUpdate, latestVersion, message]);

  const guardarLinkMeet = async () => {
    const link = String(linkMeet ?? "").trim();
    const desc = String(descripcionMeet ?? "").trim();

    if (!link) {
      toast.current?.show({
        severity: "warn",
        summary: "Atención",
        detail: "Pegá un enlace de Meet.",
      });
      return;
    }

    const meetRegex = /^https?:\/\/meet\.google\.com\/[^\s]+$/i;

    if (!meetRegex.test(link)) {
      toast.current?.show({
        severity: "warn",
        summary: "Formato",
        detail: "El enlace debe ser de Google Meet.",
      });
      return;
    }

    setLoadingMeet(true);

    try {
      await setDoc(
        doc(db, "cuotas", "sala"),
        {
          link,
          descripcion: desc,
        },
        { merge: true }
      );

      setLinkMeet(link);
      setDescripcionMeet(desc);

      toast.current?.show({
        severity: "success",
        summary: "Guardado",
        detail: "Enlace de Meet guardado.",
      });

      setVisibleDialogMeet(false);
    } catch (err) {
      console.error("Guardar Meet:", err);

      toast.current?.show({
        severity: "error",
        summary: "Error",
        detail: "No se pudo guardar el enlace.",
      });
    } finally {
      setLoadingMeet(false);
    }
  };

  const borrarLinkMeet = async () => {
    setLoadingMeet(true);

    try {
      await setDoc(
        doc(db, "cuotas", "sala"),
        {
          link: "",
          descripcion: "",
        },
        { merge: true }
      );

      setLinkMeet("");
      setDescripcionMeet("");

      toast.current?.show({
        severity: "success",
        summary: "Eliminado",
        detail: "Se borró el enlace y la descripción.",
      });

      setVisibleDialogMeet(false);
    } catch (err) {
      console.error("Borrar Meet:", err);

      toast.current?.show({
        severity: "error",
        summary: "Error",
        detail: "No se pudo borrar el enlace.",
      });
    } finally {
      setLoadingMeet(false);
    }
  };

  const guardarValorHsSec = async () => {
    const raw = (valorHsSec ?? "").toString().replace(",", ".");
    const num = parseFloat(raw);

    if (Number.isNaN(num)) {
      toast.current?.show({
        severity: "warn",
        summary: "Atención",
        detail: "Ingrese un número válido.",
      });
      return;
    }

    const formateado = num.toFixed(2);

    setLoadingHsSec(true);

    try {
      await setDoc(
        doc(db, "cod", "secundaria"),
        {
          valor: formateado,
        },
        { merge: true }
      );

      setValorHsSec(formateado);

      toast.current?.show({
        severity: "success",
        summary: "Guardado",
        detail: "Valor guardado correctamente.",
      });

      setVisibleDialogHsSec(false);
    } catch (err) {
      console.error("Guardar Hs secundaria:", err);

      toast.current?.show({
        severity: "error",
        summary: "Error",
        detail: "No se pudo guardar el valor.",
      });
    } finally {
      setLoadingHsSec(false);
    }
  };

  const guardarValorHsSup = async () => {
    const rawAnual = (valorAnualSup ?? "").toString().replace(",", ".");
    const rawCuatr = (valorCuatrSup ?? "").toString().replace(",", ".");

    const numAnual = parseFloat(rawAnual);
    const numCuatr = parseFloat(rawCuatr);

    if (Number.isNaN(numAnual) || Number.isNaN(numCuatr)) {
      toast.current?.show({
        severity: "warn",
        summary: "Atención",
        detail: "Ingrese ambos valores numéricos.",
      });
      return;
    }

    const anualForm = numAnual.toFixed(2);
    const cuatrForm = numCuatr.toFixed(2);

    setLoadingHsSup(true);

    try {
      await setDoc(
        doc(db, "cod", "superior"),
        {
          anual: anualForm,
          cuatrimestral: cuatrForm,
        },
        { merge: true }
      );

      setValorAnualSup(anualForm);
      setValorCuatrSup(cuatrForm);

      toast.current?.show({
        severity: "success",
        summary: "Guardado",
        detail: "Valores guardados correctamente.",
      });

      setVisibleDialogHsSup(false);
    } catch (err) {
      console.error("Guardar Hs superior:", err);

      toast.current?.show({
        severity: "error",
        summary: "Error",
        detail: "No se pudieron guardar los valores.",
      });
    } finally {
      setLoadingHsSup(false);
    }
  };

  const guardarValorSeguro = async () => {
    const raw = String(valorSeguro ?? "").trim();

    if (!raw) {
      toast.current?.show({
        severity: "warn",
        summary: "Atención",
        detail: "Ingrese un valor.",
      });
      return;
    }

    const num = parseFloat(raw.replace(/\./g, "").replace(",", "."));

    if (Number.isNaN(num)) {
      toast.current?.show({
        severity: "warn",
        summary: "Atención",
        detail: "Ingrese un número válido.",
      });
      return;
    }

    const formateado = num.toLocaleString("es-AR");

    setLoadingSeguro(true);

    try {
      await setDoc(
        doc(db, "cod", "seguroVidaObligatorio"),
        {
          valor: formateado,
        },
        { merge: true }
      );

      setValorSeguro(formateado);

      toast.current?.show({
        severity: "success",
        summary: "Guardado",
        detail: "Valor guardado correctamente.",
      });

      setVisibleDialogSeguro(false);
    } catch (err) {
      console.error("Guardar Seguro:", err);

      toast.current?.show({
        severity: "error",
        summary: "Error",
        detail: "No se pudo guardar el valor.",
      });
    } finally {
      setLoadingSeguro(false);
    }
  };

  const guardarValorSepelio = async () => {
    const raw = String(valorSepelio ?? "").trim();

    if (!raw) {
      toast.current?.show({
        severity: "warn",
        summary: "Atención",
        detail: "Ingrese un valor.",
      });
      return;
    }

    const num = parseFloat(raw.replace(/\./g, "").replace(",", "."));

    if (Number.isNaN(num)) {
      toast.current?.show({
        severity: "warn",
        summary: "Atención",
        detail: "Ingrese un número válido.",
      });
      return;
    }

    const formateado = num.toLocaleString("es-AR");

    setLoadingSepelio(true);

    try {
      await setDoc(
        doc(db, "cod", "subsidioSepelio"),
        {
          valor: formateado,
        },
        { merge: true }
      );

      setValorSepelio(formateado);

      toast.current?.show({
        severity: "success",
        summary: "Guardado",
        detail: "Valor guardado correctamente.",
      });

      setVisibleDialogSepelio(false);
    } catch (err) {
      console.error("Guardar Sepelio:", err);

      toast.current?.show({
        severity: "error",
        summary: "Error",
        detail: "No se pudo guardar el valor.",
      });
    } finally {
      setLoadingSepelio(false);
    }
  };

  /* =====================================================
     LABELS BOTONES
     ===================================================== */

  const botonLabelAsistencia =
    asistenciaHabilitada === null
      ? "Habilitar Asistencia"
      : asistenciaHabilitada === "si"
      ? `Asistencia: Sí${
          asistenciaConfig?.cursoTitulo ? ` (${asistenciaConfig.cursoTitulo})` : ""
        }`
      : "Asistencia: No";

  const botonIconAsistencia =
    asistenciaHabilitada === null
      ? "pi pi-check-square"
      : asistenciaHabilitada === "si"
      ? "pi pi-check"
      : "pi pi-times";

  const botonSeverityAsistencia =
    asistenciaHabilitada === null
      ? "secondary"
      : asistenciaHabilitada === "si"
      ? "success"
      : "danger";

  const hayLinkMeet = String(linkMeet ?? "").trim() !== "";
  const hayValorHsSec = String(valorHsSec ?? "").trim() !== "";
  const hayValorHsSup =
    String(valorAnualSup ?? "").trim() !== "" &&
    String(valorCuatrSup ?? "").trim() !== "";
  const hayValorSeguro = String(valorSeguro ?? "").trim() !== "";
  const hayValorSepelio = String(valorSepelio ?? "").trim() !== "";

  if (bootLoading) {
    return (
      <div className={styles.bootLoading}>
        <ProgressSpinner />
        <span>Cargando configuración…</span>
      </div>
    );
  }

  return (
    <div className={styles.habilitar_funciones}>
      <Toast ref={toast} />

      <h3 className={styles.habilitar_titulo}>🛠 Habilitar Botones</h3>

      <div className={styles.habilitar_botones}>
        <Button
          label={botonLabelAsistencia}
          icon={botonIconAsistencia}
          severity={botonSeverityAsistencia}
          onClick={() => setVisibleDialogAsistencia(true)}
          loading={loadingAsistencia}
        />

        <Button
          label={
            estaComputadoraRegistrada
              ? `Pantalla QR: ${deviceName || "Registrada"}`
              : "Registrar esta PC como pantalla QR"
          }
          icon={estaComputadoraRegistrada ? "pi pi-desktop" : "pi pi-plus-circle"}
          severity={estaComputadoraRegistrada ? "success" : "secondary"}
          onClick={abrirRegistrarPantalla}
        />

        <Button
          label={
            qrSync?.habilitada
              ? "Sincronización QR activa"
              : "Sincronización automática QR"
          }
          icon="pi pi-sync"
          severity={qrSync?.habilitada ? "success" : "info"}
          onClick={() => setVisibleDialogSyncQR(true)}
        />

        <Button
          label="Constancias / Certificados"
          icon="pi pi-file-pdf"
          severity="success"
          onClick={() => setVisibleDialogConstancias(true)}
        />

        <Button
          label={hayLinkMeet ? "Link Meet Cargado" : "Cargar Link de Meet"}
          icon={hayLinkMeet ? "pi pi-link" : "pi pi-video"}
          severity={hayLinkMeet ? "success" : "info"}
          onClick={() => setVisibleDialogMeet(true)}
          loading={loadingMeet}
        />

        <Button
          label={
            hayValorHsSec
              ? `Hs Cát. Sec.: $ ${valorHsSec}`
              : "Valor de la Hs Cátedra Secundaria."
          }
          icon={hayValorHsSec ? "pi pi-check-circle" : "pi pi-dollar"}
          severity={hayValorHsSec ? "success" : "warning"}
          onClick={() => setVisibleDialogHsSec(true)}
          loading={loadingHsSec}
        />

        <Button
          label={
            hayValorHsSup
              ? `Hs Cát. Sup.: Anual $${valorAnualSup} / Cuatr. $${valorCuatrSup}`
              : "Valor de la Hs Cátedra Superior."
          }
          icon={hayValorHsSup ? "pi pi-check-circle" : "pi pi-dollar"}
          severity={hayValorHsSup ? "success" : "warning"}
          onClick={() => setVisibleDialogHsSup(true)}
          loading={loadingHsSup}
        />

        <Button
          label={
            hayValorSeguro
              ? `Seguro Vida: $ ${valorSeguro}`
              : "Seguro de Vida Obligatorio"
          }
          icon={hayValorSeguro ? "pi pi-check-circle" : "pi pi-shield"}
          severity={hayValorSeguro ? "success" : "help"}
          onClick={() => setVisibleDialogSeguro(true)}
          loading={loadingSeguro}
        />

        <Button
          label={hayValorSepelio ? `Sepelio: $ ${valorSepelio}` : "Subsidio Sepelio"}
          icon={hayValorSepelio ? "pi pi-check-circle" : "pi pi-briefcase"}
          severity={hayValorSepelio ? "success" : "help"}
          onClick={() => setVisibleDialogSepelio(true)}
          loading={loadingSepelio}
        />

        <Button
          label="Aviso de actualización de app"
          icon="pi pi-bell"
          severity="help"
          onClick={() => setVisibleDialogUpdate(true)}
          loading={loadingUpdate}
        />

        <Button
          label="Gestión Delegados"
          icon="pi pi-users"
          severity="info"
          onClick={abrirDialogDelegados}
        />
      </div>

      {/* MODAL GESTION DELEGADOS */}
      <Dialog
        header="Gestión de Delegados Autorizados"
        visible={visibleDialogDelegados}
        style={{ width: "95vw", maxWidth: 1200 }}
        modal
        onHide={() => setVisibleDialogDelegados(false)}
      >
        <section className={styles.delegadosPanel}>
          <div className={styles.delegadosFormCard}>
            <div className={styles.delegadosFormHeader}>
              <div>
                <span>{editingDelegadoId ? "Editar delegado" : "Nuevo delegado"}</span>
                <h4>Autorización de acceso</h4>
              </div>
              {editingDelegadoId && (
                <Button
                  label="Nuevo"
                  icon="pi pi-plus"
                  className="p-button-text"
                  onClick={limpiarDelegadoForm}
                />
              )}
            </div>

            <div className={styles.delegadosFormGrid}>
              <div className={styles.formRow}>
                <label>DNI</label>
                <div className={styles.dniSearchRow}>
                  <InputText
                    value={delegadoForm.dni}
                    onChange={(e) =>
                      actualizarDelegadoCampo("dni", normalizarDni(e.target.value))
                    }
                    placeholder="DNI sin puntos"
                  />
                  <Button
                    icon="pi pi-search"
                    label="Buscar"
                    onClick={buscarDelegadoPorDni}
                    loading={searchingDelegado}
                  />
                </div>
              </div>

              <div className={styles.formRow}>
                <label>Registrado en app</label>
                <Tag
                  value={
                    delegadoForm.registradoApp
                      ? `Si - ${delegadoForm.origenApp}`
                      : "No registrado"
                  }
                  severity={delegadoForm.registradoApp ? "success" : "warning"}
                />
              </div>

              <div className={styles.formRow}>
                <label>Apellido</label>
                <InputText
                  value={delegadoForm.apellido}
                  onChange={(e) => actualizarDelegadoCampo("apellido", e.target.value)}
                  placeholder="Apellido"
                />
              </div>

              <div className={styles.formRow}>
                <label>Nombre</label>
                <InputText
                  value={delegadoForm.nombre}
                  onChange={(e) => actualizarDelegadoCampo("nombre", e.target.value)}
                  placeholder="Nombre"
                />
              </div>

              <div className={styles.formRow}>
                <label>Email</label>
                <InputText
                  value={delegadoForm.email}
                  onChange={(e) => actualizarDelegadoCampo("email", e.target.value)}
                  placeholder="correo@ejemplo.com"
                />
              </div>

              <div className={styles.formRow}>
                <label>Teléfono</label>
                <InputText
                  value={delegadoForm.telefono}
                  onChange={(e) => actualizarDelegadoCampo("telefono", e.target.value)}
                  placeholder="Teléfono"
                />
              </div>

              <div className={styles.formRow}>
                <label>Departamento</label>
                <InputText
                  value={delegadoForm.departamento}
                  onChange={(e) => actualizarDelegadoCampo("departamento", e.target.value)}
                  placeholder="Departamento"
                />
              </div>

              <div className={styles.formRow}>
                <label>Delegado habilitado</label>
                <InputSwitch
                  checked={delegadoForm.habilitado}
                  onChange={(e) => actualizarDelegadoCampo("habilitado", e.value)}
                />
              </div>

              <div className={styles.formRow}>
                <label>Pantalla QR</label>
                <InputSwitch
                  checked={delegadoForm.pantallaQrHabilitada}
                  onChange={(e) =>
                    actualizarDelegadoCampo("pantallaQrHabilitada", e.value)
                  }
                />
                <small>Permite registrar su celular o computadora para visualizar el QR.</small>
              </div>

              <div className={styles.formRow}>
                <label>Expediente de sueldo</label>
                <InputSwitch
                  checked={delegadoForm.expedienteSueldoHabilitado}
                  onChange={(e) =>
                    actualizarDelegadoCampo("expedienteSueldoHabilitado", e.value)
                  }
                />
              </div>

              <div className={styles.formRowFull}>
                <label>Permisos expediente de sueldo</label>
                <div className={styles.permisosGrid}>
                  {[
                    ["ver", "Ver"],
                    ["agregarObservaciones", "Agregar observaciones"],
                    ["cambiarEstado", "Cambiar estado"],
                    ["exportarExcel", "Exportar Excel"],
                    ["importarExcel", "Importar Excel"],
                    ["eliminar", "Eliminar expedientes"],
                  ].map(([permiso, label]) => (
                    <span
                      key={permiso}
                      className={`${styles.permisoItem} ${
                        permiso === "eliminar" ? styles.permisoItemPeligroso : ""
                      }`}
                    >
                      <InputSwitch
                        checked={!!delegadoForm.permisos[permiso]}
                        onChange={(e) => actualizarPermisoDelegado(permiso, e.value)}
                      />
                      <b>{label}</b>
                    </span>
                  ))}
                </div>
              </div>

              <div className={styles.formRowFull}>
                <label>Observaciones</label>
                <InputText
                  value={delegadoForm.observaciones}
                  onChange={(e) =>
                    actualizarDelegadoCampo("observaciones", e.target.value)
                  }
                  placeholder="Observaciones internas"
                />
              </div>
            </div>

            <div className={styles.dialogActions}>
              <Button
                label={editingDelegadoId ? "Actualizar delegado" : "Guardar delegado"}
                icon="pi pi-save"
                onClick={guardarDelegadoAutorizado}
                loading={savingDelegado}
              />
              <Button
                label="Limpiar"
                icon="pi pi-refresh"
                className="p-button-text"
                onClick={limpiarDelegadoForm}
                disabled={savingDelegado}
              />
            </div>
          </div>

          <div className={styles.delegadosTableCard}>
            <div className={styles.delegadosFormHeader}>
              <div>
                <span>Delegados existentes</span>
                <h4>{delegadosAutorizados.length} autorizaciones</h4>
              </div>
              <Button
                icon="pi pi-refresh"
                label="Recargar"
                className="p-button-text"
                onClick={cargarDelegadosAutorizados}
                loading={loadingDelegados}
              />
            </div>

            <DataTable
              value={delegadosAutorizados}
              loading={loadingDelegados}
              paginator
              rows={8}
              responsiveLayout="scroll"
              emptyMessage="No hay delegados autorizados."
            >
              <Column field="dni" header="DNI" sortable />
              <Column
                header="Apellido y nombre"
                sortable
                sortField="apellidoNombre"
                body={(row) => row.apellidoNombre || "-"}
              />
              <Column field="departamento" header="Departamento" sortable />
              <Column
                header="Registrado en app"
                body={(row) => (
                  <Tag
                    value={row.registradoApp ? row.origenApp || "si" : "no"}
                    severity={row.registradoApp ? "success" : "warning"}
                  />
                )}
              />
              <Column
                header="Estado"
                body={(row) => (
                  <Tag
                    value={row.habilitado ? "Habilitado" : "Deshabilitado"}
                    severity={row.habilitado ? "success" : "danger"}
                  />
                )}
              />
              <Column
                header="Expediente sueldo"
                body={(row) => (
                  <Tag
                    value={
                      row.herramientas?.expedienteSueldo?.habilitado
                        ? "Activo"
                        : "Inactivo"
                    }
                    severity={
                      row.herramientas?.expedienteSueldo?.habilitado
                        ? "success"
                        : "warning"
                    }
                  />
                )}
              />
              <Column
                header="Permisos"
                body={(row) => {
                  const permisos = row.herramientas?.expedienteSueldo?.permisos || {};
                  return (
                    <div className={styles.permisosTags}>
                      {Object.entries(permisos)
                        .filter(([, activo]) => activo)
                        .map(([permiso]) => (
                          <Tag
                            key={permiso}
                            value={PERMISO_LABELS[permiso] || permiso}
                            severity={permiso === "eliminar" ? "danger" : "info"}
                          />
                        ))}
                    </div>
                  );
                }}
              />
              <Column
                header="Última modificación"
                body={(row) => formatearFecha(row.updatedAt)}
              />
              <Column
                header="Acciones"
                body={(row) => (
                  <div className={styles.tableActions}>
                    <Button
                      icon="pi pi-pencil"
                      className="p-button-rounded p-button-text p-button-sm"
                      tooltip="Editar"
                      onClick={() => editarDelegado(row)}
                    />
                    <Button
                      icon={row.habilitado ? "pi pi-ban" : "pi pi-check"}
                      className="p-button-rounded p-button-text p-button-sm"
                      tooltip={row.habilitado ? "Deshabilitar" : "Habilitar"}
                      onClick={() => toggleDelegadoHabilitado(row)}
                    />
                    <Button
                      icon="pi pi-trash"
                      className="p-button-rounded p-button-text p-button-danger p-button-sm"
                      tooltip="Eliminar autorización"
                      onClick={() => eliminarDelegadoAutorizado(row)}
                    />
                  </div>
                )}
              />
            </DataTable>
          </div>
        </section>
      </Dialog>

      {/* MODAL ASISTENCIA / QR */}
      <Dialog
        header="Configurar Asistencia"
        visible={visibleDialogAsistencia}
        style={{ width: 720, maxWidth: "95vw" }}
        modal
        onHide={() => setVisibleDialogAsistencia(false)}
      >
        <QRSessionPanel
          asistenciaHabilitada={asistenciaHabilitada}
          loadingAsistencia={loadingAsistencia}
          asistenciaConfig={asistenciaConfig}
          cursos={cursos}
          loadingCursos={loadingCursos}
          selectedCursoId={selectedCursoId}
          setSelectedCursoId={setSelectedCursoId}
          selectedModalidad={selectedModalidad}
          setSelectedModalidad={setSelectedModalidad}
          requisitoPresencialVirtual={requisitoPresencialVirtual}
          setRequisitoPresencialVirtual={setRequisitoPresencialVirtual}
          encuentrosPresenciales={encuentrosPresenciales}
          encuentrosPresencialesSeleccionados={
            encuentrosPresencialesSeleccionados
          }
          setEncuentrosPresencialesSeleccionados={
            setEncuentrosPresencialesSeleccionados
          }
          loadingEncuentrosPresenciales={loadingEncuentrosPresenciales}
          tipoRegistro={tipoRegistro}
          setTipoRegistro={setTipoRegistro}
          autoRefreshSeconds={autoRefreshSeconds}
          setAutoRefreshSeconds={setAutoRefreshSeconds}
          onHabilitar={seleccionarOpcionAsistencia}
          desdeLocal={desdeLocal}
          setDesdeLocal={setDesdeLocal}
          hastaLocal={hastaLocal}
          setHastaLocal={setHastaLocal}
          sesionActual={sesionActual}
          qrSync={qrSync}
          onAbrirSesion={abrirSesionQR}
          loadingSesion={loadingSesion}
          onMostrarQR={mostrarQRLocal}
          onOpenSync={() => setVisibleDialogSyncQR(true)}
          onRenovarCodigo={renovarCodigo}
          renovandoCodigo={renovandoCodigo}
          onCerrarSesion={cerrarSesion}
        />
      </Dialog>

      <QRScreenRegisterDialog
        visible={visibleDialogRegistrarPantalla}
        onHide={() => setVisibleDialogRegistrarPantalla(false)}
        nombrePantalla={nombrePantalla}
        setNombrePantalla={setNombrePantalla}
        deviceId={deviceId}
        onGuardar={guardarPantallaActual}
      />

      <QRSyncDialog
        visible={visibleDialogSyncQR}
        onHide={() => setVisibleDialogSyncQR(false)}
        pantallasArray={pantallasArray}
        deviceId={deviceId}
        estaComputadoraRegistrada={estaComputadoraRegistrada}
        sesionActual={sesionActual}
        asistenciaConfig={asistenciaConfig}
        qrSync={qrSync}
        onGuardarSeleccion={guardarSeleccionPantallas}
        onActivarSync={activarSincronizacionQR}
        onCerrarQRPantallas={cerrarQREnPantallas}
        onBorrarPantalla={borrarPantallaRegistrada}
      />

      <QRDisplayDialog
        visible={qrVisible}
        onHide={() => setQrVisible(false)}
        sesionActual={sesionActual}
        qrSync={qrSync}
        estaComputadoraAutorizada={estaComputadoraAutorizada}
        qrContainerRef={qrContainerRef}
        onDownload={downloadQRAsPNG}
        downloadingQR={downloadingQR}
        onCopiarCodigo={copiarCodigo}
      />

      <ModalConstanciasCertificados
        visible={visibleDialogConstancias}
        onHide={() => setVisibleDialogConstancias(false)}
      />

      {/* MODAL ACTUALIZACIÓN APP */}
      <Dialog
        header="Aviso de actualización de la App (Android)"
        visible={visibleDialogUpdate}
        style={{ width: 560, maxWidth: "95vw" }}
        modal
        onHide={() => setVisibleDialogUpdate(false)}
      >
        <div className={styles.formGrid}>
          <div className={styles.formRow}>
            <label>Última versión</label>
            <InputText
              value={String(latestVersion)}
              onChange={(e) => setLatestVersion(e.target.value.replace(/\D/g, ""))}
              placeholder="Ej: 18"
            />
          </div>

          <div className={styles.formRow}>
            <label>Forzar actualización</label>
            <div>
              <InputSwitch
                checked={forceUpdate}
                onChange={(e) => setForceUpdate(e.value)}
              />
            </div>
          </div>

          <div className={styles.formRowFull}>
            <label>Mensaje</label>
            <InputText
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder='Ej: "Hay una nueva versión disponible..."'
            />
          </div>
        </div>

        <div className={styles.dialogActions}>
          <Button
            label="Guardar cambios"
            icon="pi pi-save"
            onClick={guardarCambiosActualizacion}
            loading={loadingUpdate}
          />

          <Button
            label="Recargar"
            icon="pi pi-refresh"
            className="p-button-text"
            onClick={cargarConfigUpdate}
            disabled={loadingUpdate}
          />

          <Button
            label="Cerrar"
            icon="pi pi-times"
            severity="secondary"
            onClick={() => setVisibleDialogUpdate(false)}
            disabled={loadingUpdate}
          />
        </div>
      </Dialog>

      {/* MODAL MEET */}
      <Dialog
        header="Cargar Link de Meet"
        visible={visibleDialogMeet}
        style={{ width: 460, maxWidth: "95vw" }}
        modal
        onShow={() => linkInputRef.current?.focus?.()}
        onHide={() => setVisibleDialogMeet(false)}
      >
        <p>Pegá el enlace de Google Meet y una descripción opcional.</p>

        <div className={styles.formGrid}>
          <div className={styles.formRowFull}>
            <label>Enlace</label>
            <InputText
              ref={linkInputRef}
              value={linkMeet}
              onChange={(e) => setLinkMeet(e.target.value)}
              placeholder="https://meet.google.com/abc-defg-hij"
            />
          </div>

          <div className={styles.formRowFull}>
            <label>Descripción</label>
            <InputText
              value={descripcionMeet}
              onChange={(e) => setDescripcionMeet(e.target.value)}
              placeholder="Reunión mensual / Docentes"
            />
          </div>
        </div>

        <div className={styles.dialogActions}>
          <Button
            label="Guardar"
            icon="pi pi-check"
            severity="success"
            onClick={guardarLinkMeet}
            disabled={loadingMeet}
            loading={loadingMeet}
          />

          <Button
            label="Borrar"
            icon="pi pi-trash"
            severity="warning"
            onClick={borrarLinkMeet}
            disabled={
              loadingMeet ||
              (!String(linkMeet).trim() && !String(descripcionMeet).trim())
            }
          />

          <Button
            label="Cancelar"
            icon="pi pi-times"
            severity="danger"
            onClick={() => setVisibleDialogMeet(false)}
            disabled={loadingMeet}
          />
        </div>
      </Dialog>

      {/* MODAL HORA CÁTEDRA SECUNDARIA */}
      <Dialog
        header="Valor de la Hora Cátedra Secundaria"
        visible={visibleDialogHsSec}
        style={{ width: 420, maxWidth: "95vw" }}
        modal
        onHide={() => setVisibleDialogHsSec(false)}
      >
        <p>Ingrese el valor. Se guardará con 2 decimales.</p>

        <InputText
          type="number"
          step="0.01"
          value={valorHsSec}
          onChange={(e) => setValorHsSec(e.target.value)}
          placeholder="Ej: 32706.56"
          style={{ width: "100%" }}
        />

        <div className={styles.dialogActions}>
          <Button
            label="Guardar"
            icon="pi pi-check"
            severity="success"
            onClick={guardarValorHsSec}
            disabled={!String(valorHsSec).trim() || loadingHsSec}
            loading={loadingHsSec}
          />

          <Button
            label="Cancelar"
            icon="pi pi-times"
            severity="danger"
            onClick={() => setVisibleDialogHsSec(false)}
            disabled={loadingHsSec}
          />
        </div>
      </Dialog>

      {/* MODAL HORA CÁTEDRA SUPERIOR */}
      <Dialog
        header="Valor de la Hora Cátedra Superior"
        visible={visibleDialogHsSup}
        style={{ width: 460, maxWidth: "95vw" }}
        modal
        onHide={() => setVisibleDialogHsSup(false)}
      >
        <p>Ingrese los valores. Se guardarán con 2 decimales.</p>

        <div className={styles.formGrid}>
          <div className={styles.formRowFull}>
            <label>Anual</label>
            <InputText
              type="number"
              step="0.01"
              value={valorAnualSup}
              onChange={(e) => setValorAnualSup(e.target.value)}
              placeholder="Ej: 32706.56"
            />
          </div>

          <div className={styles.formRowFull}>
            <label>Cuatrimestral</label>
            <InputText
              type="number"
              step="0.01"
              value={valorCuatrSup}
              onChange={(e) => setValorCuatrSup(e.target.value)}
              placeholder="Ej: 16353.28"
            />
          </div>
        </div>

        <div className={styles.dialogActions}>
          <Button
            label="Guardar"
            icon="pi pi-check"
            severity="success"
            onClick={guardarValorHsSup}
            disabled={
              !String(valorAnualSup).trim() ||
              !String(valorCuatrSup).trim() ||
              loadingHsSup
            }
            loading={loadingHsSup}
          />

          <Button
            label="Cancelar"
            icon="pi pi-times"
            severity="danger"
            onClick={() => setVisibleDialogHsSup(false)}
            disabled={loadingHsSup}
          />
        </div>
      </Dialog>

      {/* MODAL SEGURO */}
      <Dialog
        header="Seguro de Vida Obligatorio"
        visible={visibleDialogSeguro}
        style={{ width: 420, maxWidth: "95vw" }}
        modal
        onHide={() => setVisibleDialogSeguro(false)}
      >
        <p>Ingrese el valor. Se guardará con separador de miles.</p>

        <InputText
          value={valorSeguro}
          onChange={(e) => setValorSeguro(e.target.value)}
          placeholder="Ej: 1.000"
          style={{ width: "100%" }}
        />

        <div className={styles.dialogActions}>
          <Button
            label="Guardar"
            icon="pi pi-check"
            severity="success"
            onClick={guardarValorSeguro}
            disabled={!String(valorSeguro).trim() || loadingSeguro}
            loading={loadingSeguro}
          />

          <Button
            label="Cancelar"
            icon="pi pi-times"
            severity="danger"
            onClick={() => setVisibleDialogSeguro(false)}
            disabled={loadingSeguro}
          />
        </div>
      </Dialog>

      {/* MODAL SEPELIO */}
      <Dialog
        header="Subsidio Sepelio"
        visible={visibleDialogSepelio}
        style={{ width: 420, maxWidth: "95vw" }}
        modal
        onHide={() => setVisibleDialogSepelio(false)}
      >
        <p>Ingrese el valor. Se guardará con separador de miles.</p>

        <InputText
          value={valorSepelio}
          onChange={(e) => setValorSepelio(e.target.value)}
          placeholder="Ej: 30.000"
          style={{ width: "100%" }}
        />

        <div className={styles.dialogActions}>
          <Button
            label="Guardar"
            icon="pi pi-check"
            severity="success"
            onClick={guardarValorSepelio}
            disabled={!String(valorSepelio).trim() || loadingSepelio}
            loading={loadingSepelio}
          />

          <Button
            label="Cancelar"
            icon="pi pi-times"
            severity="danger"
            onClick={() => setVisibleDialogSepelio(false)}
            disabled={loadingSepelio}
          />
        </div>
      </Dialog>
    </div>
  );
};

export default HabilitarBotonesPanel;
