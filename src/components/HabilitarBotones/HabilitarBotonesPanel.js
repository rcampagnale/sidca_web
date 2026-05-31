// src/components/HabilitarBotones/HabilitarBotonesPanel.js

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Button } from "primereact/button";
import { Dialog } from "primereact/dialog";
import { Toast } from "primereact/toast";
import { InputText } from "primereact/inputtext";
import { ProgressSpinner } from "primereact/progressspinner";
import { InputSwitch } from "primereact/inputswitch";
import {
  collection,
  deleteField,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  setDoc,
} from "firebase/firestore";

import { db } from "../../firebase/firebase-config";
import styles from "./habilitarbotones.module.css";

import ModalConstanciasCertificados from "./modales/ModalConstanciasCertificados";

import { useQRSync } from "./qr/useQRSync.js";
import QRSessionPanel from "./qr/QRSessionPanel.js";
import QRScreenRegisterDialog from "./qr/QRScreenRegisterDialog.js";
import QRSyncDialog from "./qr/QRSyncDialog.js";
import QRDisplayDialog from "./qr/QRDisplayDialog.js";

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
  }, [
    asistenciaConfig?.cursoId,
    asistenciaConfig?.modalidad,
    asistenciaConfig?.tipoRegistro,
    asistenciaConfig?.autoRefreshSeconds,
  ]);

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

      await actualizarConfigAsistencia({
        habilitar,
        selectedCursoId,
        selectedModalidad,
        cursoTitulo,
      });

      if (!habilitar) {
        setSelectedCursoId(null);
        setSelectedModalidad(null);
        setDesdeLocal("");
        setHastaLocal("");
        setTipoRegistro("ingreso");
        setAutoRefreshSeconds(60);
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
      </div>

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