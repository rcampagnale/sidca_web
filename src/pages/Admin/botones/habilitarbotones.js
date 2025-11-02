// src/pages/Admin/HabilitarBotones/habilitarbotones.js
import React, { useEffect, useRef, useState } from "react";
import { Button } from "primereact/button";
import { Dialog } from "primereact/dialog";
import { Toast } from "primereact/toast";
import { InputText } from "primereact/inputtext";
import { ProgressSpinner } from "primereact/progressspinner";
import { Dropdown } from "primereact/dropdown";
import QRCode from "react-qr-code";
import {
  doc,
  getDoc,
  setDoc,
  addDoc,
  updateDoc,
  collection,
  getDocs,
  query,
  orderBy,
  deleteField,
  deleteDoc,
} from "firebase/firestore";
import { db } from "../../../firebase/firebase-config";
import styles from "./habilitarbotones.module.css";

/** Utilidades */
const genCodigo = () => {
  const a = Math.random().toString(36).slice(2, 6);
  const b = Math.random().toString(36).slice(2, 6);
  return `${a}-${b}`.toUpperCase();
};
const toISO = (localDateTimeStr) => {
  if (!localDateTimeStr) return null;
  const d = new Date(localDateTimeStr);
  return d.toISOString();
};
const nowPlusMinutesLocalStr = (mins) => {
  const d = new Date();
  d.setMinutes(d.getMinutes() + mins);
  const pad = (n) => String(n).padStart(2, "0");
  const yyyy = d.getFullYear();
  const MM = pad(d.getMonth() + 1);
  const dd = pad(d.getDate());
  const hh = pad(d.getHours());
  const mm = pad(d.getMinutes());
  return `${yyyy}-${MM}-${dd}T${hh}:${mm}`;
};

const HabilitarBotones = () => {
  const toast = useRef(null);

  // ===== Splash inicial =====
  const [bootLoading, setBootLoading] = useState(true);

  // ===== Flag simple en cod/boton =====
  const [asistenciaHabilitada, setAsistenciaHabilitada] = useState(null); // null|'si'|'no'
  const [visibleDialogAsistencia, setVisibleDialogAsistencia] = useState(false);
  const [loadingAsistencia, setLoadingAsistencia] = useState(false);

  // ===== Config extendida en cod/asistencia =====
  const [asistenciaConfig, setAsistenciaConfig] = useState({
    habilitada: false,
    cursoId: null,
    cursoTitulo: "",
    modalidad: null, // 'virtual' | 'presencial'
    metodo: null, // 'qr_static' (solo si presencial)
    sessionId: null,
  });

  // ===== Cursos =====
  const [cursos, setCursos] = useState([]); // [{ value, label }]
  const [loadingCursos, setLoadingCursos] = useState(false);
  const [selectedCursoId, setSelectedCursoId] = useState(null);

  // ===== Modalidad =====
  const [selectedModalidad, setSelectedModalidad] = useState(null); // 'virtual' | 'presencial'
  const opcionesModalidad = [
    { label: "Virtual", value: "virtual" },
    { label: "Presencial (QR estático)", value: "presencial" },
  ];

  // ===== Otros modales (Meet / valores) que ya tenías =====
  const [visibleDialogMeet, setVisibleDialogMeet] = useState(false);
  const [linkMeet, setLinkMeet] = useState("");
  const [descripcionMeet, setDescripcionMeet] = useState("");
  const [loadingMeet, setLoadingMeet] = useState(false);
  const linkInputRef = useRef(null);

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

  // ===== Sesión presencial (QR estático) =====
  const [sesionActual, setSesionActual] = useState(null); // {id, cursoId, cursoTitulo, estado, desde, hasta, codigo, qrPayload}
  const [desdeLocal, setDesdeLocal] = useState("");
  const [hastaLocal, setHastaLocal] = useState("");
  const [qrVisible, setQrVisible] = useState(false);
  const [loadingSesion, setLoadingSesion] = useState(false);
  const [renovandoCodigo, setRenovandoCodigo] = useState(false);
  // === QR: refs y estado de descarga ===
  const qrContainerRef = useRef(null);
  const [downloadingQR, setDownloadingQR] = useState(false);

  // ---------- Lecturas ----------
  const cargarAsistenciaFlag = async () => {
    try {
      const snap = await getDoc(doc(db, "cod", "boton"));
      if (snap.exists()) {
        const valor = snap.data()?.cargar;
        setAsistenciaHabilitada(
          valor === "si" || valor === "no" ? valor : null
        );
      } else {
        setAsistenciaHabilitada(null);
      }
    } catch (err) {
      console.error("Asistencia (leer flag):", err);
      toast.current?.show({
        severity: "error",
        summary: "Error",
        detail: "No se pudo cargar Asistencia.",
      });
    }
  };

  const cargarAsistenciaConfig = async () => {
    try {
      const snap = await getDoc(doc(db, "cod", "asistencia"));
      if (snap.exists()) {
        const data = snap.data() || {};
        const cfg = {
          habilitada: !!data.habilitada,
          cursoId: data.cursoId ?? null,
          cursoTitulo: data.cursoTitulo ?? "",
          modalidad: data.modalidad ?? null,
          metodo: data.metodo ?? null,
          sessionId: data.sessionId ?? null,
        };
        setAsistenciaConfig(cfg);
        setSelectedCursoId(cfg.cursoId || null);
        setSelectedModalidad(cfg.modalidad || null);

        if (cfg.sessionId) {
          await cargarSesionActiva(cfg.sessionId);
        } else {
          setSesionActual(null);
        }
      } else {
        setAsistenciaConfig({
          habilitada: false,
          cursoId: null,
          cursoTitulo: "",
          modalidad: null,
          metodo: null,
          sessionId: null,
        });
        setSelectedCursoId(null);
        setSelectedModalidad(null);
        setSesionActual(null);
      }
    } catch (err) {
      console.error("Asistencia (leer config):", err);
      toast.current?.show({
        severity: "error",
        summary: "Error",
        detail: "No se pudo cargar la configuración de asistencia.",
      });
    }
  };

  const cargarSesionActiva = async (sessionId) => {
    try {
      const snap = await getDoc(doc(db, "asistencia_sesiones", sessionId));
      if (snap.exists()) {
        const data = snap.data() || {};
        setSesionActual({ id: snap.id, ...data });
      } else {
        setSesionActual(null);
      }
    } catch (err) {
      console.error("Sesión (leer):", err);
      toast.current?.show({
        severity: "error",
        summary: "Error",
        detail: "No se pudo cargar la sesión activa.",
      });
    }
  };

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
          `Curso ${d.id}`
        ).toString();
        items.push({ value: d.id, label });
      });
      setCursos(items);
    } catch (err) {
      console.error("Cursos (leer):", err);
      toast.current?.show({
        severity: "error",
        summary: "Error",
        detail: "No se pudieron cargar los cursos.",
      });
    } finally {
      setLoadingCursos(false);
    }
  };

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
      console.error("Meet (leer):", err);
      toast.current?.show({
        severity: "error",
        summary: "Error",
        detail: "No se pudo cargar el enlace de Meet.",
      });
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
      console.error("Hs Secundaria (leer):", err);
      toast.current?.show({
        severity: "error",
        summary: "Error",
        detail: "No se pudo cargar Hs Cát. Secundaria.",
      });
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
      console.error("Hs Superior (leer):", err);
      toast.current?.show({
        severity: "error",
        summary: "Error",
        detail: "No se pudo cargar Hs Cát. Superior.",
      });
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
      console.error("Seguro Vida (leer):", err);
      toast.current?.show({
        severity: "error",
        summary: "Error",
        detail: "No se pudo cargar Seguro de Vida Obligatorio.",
      });
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
      console.error("Sepelio (leer):", err);
      toast.current?.show({
        severity: "error",
        summary: "Error",
        detail: "No se pudo cargar Subsidio Sepelio.",
      });
    }
  };

  // Refresca la sesión (por si el código cambió) y abre el modal de QR
  const abrirModalQR = async () => {
    if (asistenciaConfig?.sessionId) {
      await cargarSesionActiva(asistenciaConfig.sessionId);
    }
    setQrVisible(true);
  };

  // Copia el texto del código al portapapeles
  const copiarCodigo = async () => {
    try {
      if (!sesionActual?.codigo) {
        toast.current?.show({
          severity: "warn",
          summary: "Código",
          detail: "No hay código disponible.",
        });
        return;
      }
      await navigator.clipboard.writeText(sesionActual.codigo);
      toast.current?.show({
        severity: "success",
        summary: "Copiado",
        detail: "Código copiado al portapapeles.",
      });
    } catch {
      toast.current?.show({
        severity: "error",
        summary: "Error",
        detail: "No se pudo copiar el código.",
      });
    }
  };

  // Descarga el QR como PNG (imagen)
  const downloadQRAsPNG = async (scale = 4) => {
    setDownloadingQR(true);
    try {
      const svg = qrContainerRef.current?.querySelector("svg");
      if (!svg) throw new Error("No se encontró el SVG del QR.");

      // Serializar el SVG actual
      const xml = new XMLSerializer().serializeToString(svg);
      const svgBlob = new Blob([xml], { type: "image/svg+xml;charset=utf-8" });
      const url = URL.createObjectURL(svgBlob);

      // Crear imagen y dibujar en canvas
      const img = new Image();
      const rect = svg.getBoundingClientRect();
      const base = Math.max(rect.width || 320, rect.height || 320);
      img.onload = () => {
        const canvas = document.createElement("canvas");
        canvas.width = base * scale;
        canvas.height = base * scale;
        const ctx = canvas.getContext("2d");
        // Fondo blanco (opcional; queda bien para imprimir o enviar)
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        URL.revokeObjectURL(url);

        const pngUrl = canvas.toDataURL("image/png");
        const a = document.createElement("a");
        const safeCourse = (sesionActual?.cursoTitulo || "curso").replace(
          /[^\w\-]+/g,
          "_"
        );
        const safeCode = (sesionActual?.codigo || "QR").replace(
          /[^\w\-]+/g,
          "_"
        );
        a.download = `${safeCourse}-${safeCode}.png`;
        a.href = pngUrl;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);

        toast.current?.show({
          severity: "success",
          summary: "Descargado",
          detail: "QR descargado como PNG.",
        });
      };
      img.onerror = () => {
        URL.revokeObjectURL(url);
        toast.current?.show({
          severity: "error",
          summary: "Error",
          detail: "No se pudo generar la imagen del QR.",
        });
      };
      img.src = url;
    } catch (err) {
      console.error(err);
      toast.current?.show({
        severity: "error",
        summary: "Error",
        detail: "No se pudo descargar el QR.",
      });
    } finally {
      setDownloadingQR(false);
    }
  };

  // Descarga el QR como SVG (vector)
  const downloadQRAsSVG = () => {
    try {
      const svg = qrContainerRef.current?.querySelector("svg");
      if (!svg) throw new Error("No se encontró el SVG del QR.");
      const xml = new XMLSerializer().serializeToString(svg);
      const blob = new Blob([xml], { type: "image/svg+xml;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      const safeCourse = (sesionActual?.cursoTitulo || "curso").replace(
        /[^\w\-]+/g,
        "_"
      );
      const safeCode = (sesionActual?.codigo || "QR").replace(/[^\w\-]+/g, "_");
      a.download = `${safeCourse}-${safeCode}.svg`;
      a.href = url;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error(err);
      toast.current?.show({
        severity: "error",
        summary: "Error",
        detail: "No se pudo descargar el SVG del QR.",
      });
    }
  };

  // ---------- Carga inicial ----------
  useEffect(() => {
    const loadAll = async () => {
      setBootLoading(true);
      try {
        await Promise.all([
          cargarAsistenciaFlag(),
          cargarAsistenciaConfig(),
          cargarCursos(),
          cargarMeet(),
          cargarHsSec(),
          cargarHsSup(),
          cargarSeguro(),
          cargarSepelio(),
        ]);
      } finally {
        setBootLoading(false);
      }
    };
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const seleccionarOpcionAsistencia = async (habilitar) => {
    setLoadingAsistencia(true);
    try {
      // Siempre dejamos en 'cod/boton' SOLO el flag (y limpiamos restos viejos de curso)
      await setDoc(
        doc(db, "cod", "boton"),
        {
          cargar: habilitar ? "si" : "no",
          cursoId: deleteField(),
          cursoTitulo: deleteField(),
        },
        { merge: true }
      );

      if (habilitar) {
        // ===== HABILITAR =====
        // Validaciones: primero curso y modalidad
        if (!selectedCursoId) {
          toast.current?.show({
            severity: "warn",
            summary: "Atención",
            detail: "Seleccioná un curso.",
          });
          setLoadingAsistencia(false);
          return;
        }
        if (!selectedModalidad) {
          toast.current?.show({
            severity: "warn",
            summary: "Atención",
            detail: "Seleccioná la modalidad (virtual o presencial).",
          });
          setLoadingAsistencia(false);
          return;
        }

        const curso = cursos.find((c) => c.value === selectedCursoId);
        const cursoTitulo = curso?.label ?? "";

        if (selectedModalidad === "virtual") {
          // Si hubiese una sesión abierta de antes, la cierro y limpio QR
          const sessionId = asistenciaConfig?.sessionId;
          if (sessionId) {
            try {
              await updateDoc(doc(db, "asistencia_sesiones", sessionId), {
                estado: "cerrada",
                codigo: deleteField(),
                qrPayload: deleteField(),
              });
            } catch (_) {}
          }

          // Guardamos como antes: sin sesión, sin método
          await setDoc(
            doc(db, "cod", "asistencia"),
            {
              habilitada: true,
              cursoId: selectedCursoId,
              cursoTitulo,
              modalidad: "virtual",
              metodo: deleteField(),
              sessionId: deleteField(),
            },
            { merge: true }
          );

          setAsistenciaConfig({
            habilitada: true,
            cursoId: selectedCursoId,
            cursoTitulo,
            modalidad: "virtual",
            metodo: null,
            sessionId: null,
          });
          setSesionActual(null);
        } else {
          // presencial (QR estático), sin abrir sesión todavía
          await setDoc(
            doc(db, "cod", "asistencia"),
            {
              habilitada: true,
              cursoId: selectedCursoId,
              cursoTitulo,
              modalidad: "presencial",
              metodo: "qr_static",
              sessionId: deleteField(), // se setea al abrir sesión
            },
            { merge: true }
          );

          setAsistenciaConfig((prev) => ({
            ...prev,
            habilitada: true,
            cursoId: selectedCursoId,
            cursoTitulo,
            modalidad: "presencial",
            metodo: "qr_static",
            sessionId: null,
          }));
        }
      } else {
        // ===== DESHABILITAR =====
        // 1) Si hay sesión abierta: cerrar y BORRAR QR
        const sessionId = asistenciaConfig?.sessionId;
        if (sessionId) {
          try {
            await updateDoc(doc(db, "asistencia_sesiones", sessionId), {
              estado: "cerrada",
              codigo: deleteField(),
              qrPayload: deleteField(),
            });
          } catch (_) {
            // si no existe, seguimos
          }
        }

        // 2) Borrar por completo el REGISTRO de configuración (virtual o presencial)
        try {
          await deleteDoc(doc(db, "cod", "asistencia"));
        } catch (_) {
          // si no existía, seguimos
        }

        // 3) Reset visual de UI
        setQrVisible(false);
        setSesionActual(null);
        setAsistenciaConfig({
          habilitada: false,
          cursoId: null,
          cursoTitulo: "",
          modalidad: null,
          metodo: null,
          sessionId: null,
        });
        setSelectedCursoId(null);
        setSelectedModalidad(null);
      }

      setAsistenciaHabilitada(habilitar ? "si" : "no");
      toast.current?.show({
        severity: "success",
        summary: "Guardado",
        detail: `Asistencia ${habilitar ? "habilitada" : "deshabilitada"}.`,
      });
      setVisibleDialogAsistencia(false);
    } catch (err) {
      console.error("Asistencia (guardar):", err);
      toast.current?.show({
        severity: "error",
        summary: "Error",
        detail: "No se pudo guardar Asistencia.",
      });
    } finally {
      setLoadingAsistencia(false);
    }
  };

  // ---------- Sesión QR (solo presencial) ----------
  const abrirSesion = async () => {
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
        detail: "La sesión QR es solo para modalidad Presencial.",
      });
      return;
    }
    if (!selectedCursoId) {
      toast.current?.show({
        severity: "warn",
        summary: "Atención",
        detail: "Seleccioná un curso.",
      });
      return;
    }
    if (!desdeLocal || !hastaLocal) {
      toast.current?.show({
        severity: "warn",
        summary: "Atención",
        detail: "Indicá 'desde' y 'hasta'.",
      });
      return;
    }

    const curso = cursos.find((c) => c.value === selectedCursoId);
    const cursoTitulo = curso?.label ?? "";
    const codigo = genCodigo();
    // QR: la app puede leer el sessionId desde cod/asistencia; usamos s=auto para mantener payload simple
    const qrPayload = `sidca://asistencia?s=${encodeURIComponent(
      "auto"
    )}&c=${encodeURIComponent(codigo)}&v=1`;
    const desdeISO = toISO(desdeLocal);
    const hastaISO = toISO(hastaLocal);

    setLoadingSesion(true);
    try {
      const ref = await addDoc(collection(db, "asistencia_sesiones"), {
        cursoId: selectedCursoId,
        cursoTitulo,
        estado: "abierta",
        desde: desdeISO,
        hasta: hastaISO,
        codigo,
        qrPayload,
        metodo: "qr_static",
      });

      await setDoc(
        doc(db, "cod", "asistencia"),
        {
          sessionId: ref.id,
          cursoId: selectedCursoId,
          cursoTitulo,
          modalidad: "presencial",
          metodo: "qr_static",
        },
        { merge: true }
      );

      const sesion = {
        id: ref.id,
        cursoId: selectedCursoId,
        cursoTitulo,
        estado: "abierta",
        desde: desdeISO,
        hasta: hastaISO,
        codigo,
        qrPayload,
        metodo: "qr_static",
      };
      setSesionActual(sesion);
      setAsistenciaConfig((prev) => ({
        ...prev,
        sessionId: ref.id,
        cursoId: selectedCursoId,
        cursoTitulo,
        modalidad: "presencial",
        metodo: "qr_static",
      }));

      toast.current?.show({
        severity: "success",
        summary: "Sesión abierta",
        detail: `Código: ${codigo}`,
      });
    } catch (err) {
      console.error("Sesión (abrir):", err);
      toast.current?.show({
        severity: "error",
        summary: "Error",
        detail: "No se pudo abrir la sesión.",
      });
    } finally {
      setLoadingSesion(false);
    }
  };

  const renovarCodigo = async () => {
    if (!sesionActual?.id) return;
    setRenovandoCodigo(true);
    try {
      const codigo = genCodigo();
      const qrPayload = `sidca://asistencia?s=${encodeURIComponent(
        sesionActual.id
      )}&c=${encodeURIComponent(codigo)}&v=1`;
      await updateDoc(doc(db, "asistencia_sesiones", sesionActual.id), {
        codigo,
        qrPayload,
      });
      setSesionActual((prev) => ({ ...prev, codigo, qrPayload }));
      toast.current?.show({
        severity: "success",
        summary: "Código renovado",
        detail: `Nuevo código: ${codigo}`,
      });
    } catch (err) {
      console.error("Sesión (renovar código):", err);
      toast.current?.show({
        severity: "error",
        summary: "Error",
        detail: "No se pudo renovar el código.",
      });
    } finally {
      setRenovandoCodigo(false);
    }
  };

  const cerrarSesion = async () => {
    if (!sesionActual?.id) return;
    setLoadingSesion(true);
    try {
      await updateDoc(doc(db, "asistencia_sesiones", sesionActual.id), {
        estado: "cerrada",
        codigo: deleteField(),
        qrPayload: deleteField(),
      });
      await setDoc(
        doc(db, "cod", "asistencia"),
        { sessionId: deleteField() },
        { merge: true }
      );

      setQrVisible(false);
      setSesionActual(null);
      setAsistenciaConfig((prev) => ({ ...prev, sessionId: null }));

      toast.current?.show({
        severity: "success",
        summary: "Sesión cerrada",
        detail: "La sesión fue cerrada y los QR fueron eliminados.",
      });
    } catch (err) {
      console.error("Sesión (cerrar):", err);
      toast.current?.show({
        severity: "error",
        summary: "Error",
        detail: "No se pudo cerrar la sesión.",
      });
    } finally {
      setLoadingSesion(false);
    }
  };

  // ---------- Otros (Meet / valores) ----------
  const guardarLinkMeet = async () => {
    const link = (linkMeet ?? "").trim();
    const desc = (descripcionMeet ?? "").trim();
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
        detail:
          "El enlace debe ser de Google Meet (https://meet.google.com/...).",
      });
      return;
    }
    setLoadingMeet(true);
    try {
      await setDoc(
        doc(db, "cuotas", "sala"),
        { link, descripcion: desc },
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
      console.error("Meet (guardar):", err);
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
        { link: "", descripcion: "" },
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
      console.error("Meet (borrar):", err);
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
    const num = parseFloat(valorHsSec);
    if (isNaN(num)) {
      toast.current?.show({
        severity: "warn",
        summary: "Atención",
        detail: "Ingrese un número válido.",
      });
      return;
    }
    const formateado = num.toFixed(2);
    if (formateado === valorHsSec) {
      setVisibleDialogHsSec(false);
      return;
    }
    setLoadingHsSec(true);
    try {
      await setDoc(
        doc(db, "cod", "secundaria"),
        { valor: formateado },
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
      console.error("Hs Secundaria (guardar):", err);
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
    const numAnual = parseFloat(valorAnualSup);
    const numCuatr = parseFloat(valorCuatrSup);
    if (isNaN(numAnual) || isNaN(numCuatr)) {
      toast.current?.show({
        severity: "warn",
        summary: "Atención",
        detail: "Ingrese ambos valores numéricos.",
      });
      return;
    }
    const anualForm = numAnual.toFixed(2);
    const cuatrForm = numCuatr.toFixed(2);
    if (anualForm === valorAnualSup && cuatrForm === valorCuatrSup) {
      setVisibleDialogHsSup(false);
      return;
    }
    setLoadingHsSup(true);
    try {
      await setDoc(
        doc(db, "cod", "superior"),
        { anual: anualForm, cuatrimestral: cuatrForm },
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
      console.error("Hs Superior (guardar):", err);
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
    const num = parseFloat(valorSeguro.replace(/\./g, "").replace(",", "."));
    if (isNaN(num)) {
      toast.current?.show({
        severity: "warn",
        summary: "Atención",
        detail: "Ingrese un número válido.",
      });
      return;
    }
    const formateado = num.toLocaleString("es-AR");
    if (formateado === valorSeguro) {
      setVisibleDialogSeguro(false);
      return;
    }
    setLoadingSeguro(true);
    try {
      await setDoc(
        doc(db, "cod", "seguroVidaObligatorio"),
        { valor: formateado },
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
      console.error("Seguro Vida (guardar):", err);
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
    const num = parseFloat(valorSepelio.replace(/\./g, "").replace(",", "."));
    if (isNaN(num)) {
      toast.current?.show({
        severity: "warn",
        summary: "Atención",
        detail: "Ingrese un número válido.",
      });
      return;
    }
    const formateado = num.toLocaleString("es-AR");
    if (formateado === valorSepelio) {
      setVisibleDialogSepelio(false);
      return;
    }
    setLoadingSepelio(true);
    try {
      await setDoc(
        doc(db, "cod", "subsidioSepelio"),
        { valor: formateado },
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
      console.error("Sepelio (guardar):", err);
      toast.current?.show({
        severity: "error",
        summary: "Error",
        detail: "No se pudo guardar el valor.",
      });
    } finally {
      setLoadingSepelio(false);
    }
  };

  // ---------- Labels / iconos ----------
  const botonLabelAsistencia =
    asistenciaHabilitada === null
      ? "Habilitar Asistencia"
      : asistenciaHabilitada === "si"
      ? `Asistencia: Sí${
          asistenciaConfig?.cursoTitulo
            ? ` (${asistenciaConfig.cursoTitulo})`
            : ""
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

  const hayLinkMeet = (linkMeet ?? "").trim() !== "";
  const botonLabelMeet = hayLinkMeet
    ? "Link Meet Cargado"
    : "Cargar Link de Meet";
  const botonIconMeet = hayLinkMeet ? "pi pi-link" : "pi pi-video";
  const botonSeverityMeet = hayLinkMeet ? "success" : "info";

  const hayValorHsSec = valorHsSec.trim() !== "";
  const botonLabelHsSec = hayValorHsSec
    ? `Hs Cát. Sec.: $ ${valorHsSec}`
    : "Valor de la Hs Cátedra Secundaria.";
  const botonIconHsSec = hayValorHsSec ? "pi pi-check-circle" : "pi pi-dollar";
  const botonSeverityHsSec = hayValorHsSec ? "success" : "warning";

  const hayValorHsSup =
    valorAnualSup.trim() !== "" && valorCuatrSup.trim() !== "";
  const botonLabelHsSup = hayValorHsSup
    ? `Hs Cát. Sup.: Anual $${valorAnualSup} / Cuatr. $${valorCuatrSup}`
    : "Valor de la Hs Cátedra Superior.";
  const botonIconHsSup = hayValorHsSup ? "pi pi-check-circle" : "pi pi-dollar";
  const botonSeverityHsSup = hayValorHsSup ? "success" : "warning";

  const hayValorSeguro = valorSeguro.trim() !== "";
  const botonLabelSeguro = hayValorSeguro
    ? `Seguro Vida: $ ${valorSeguro}`
    : "Seguro de Vida Obligatorio";
  const botonIconSeguro = hayValorSeguro
    ? "pi pi-check-circle"
    : "pi pi-shield";
  const botonSeveritySeguro = hayValorSeguro ? "success" : "help";

  const hayValorSepelio = valorSepelio.trim() !== "";
  const botonLabelSepelio = hayValorSepelio
    ? `Sepelio: $ ${valorSepelio}`
    : "Subsidio Sepelio";
  const botonIconSepelio = hayValorSepelio
    ? "pi pi-check-circle"
    : "pi pi-briefcase";
  const botonSeveritySepelio = hayValorSepelio ? "success" : "help";

  // ---------- Splash ----------
  if (bootLoading) {
    return (
      <div
        style={{
          minHeight: 220,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexDirection: "column",
          gap: "0.75rem",
          background: "rgba(255,255,255,0.6)",
          borderRadius: 12,
        }}
      >
        <ProgressSpinner />
        <span style={{ color: "#64748b" }}>Cargando configuración…</span>
      </div>
    );
  }

  // ===================== RENDER =====================
  return (
    <div className={styles.habilitar_funciones}>
      <Toast ref={toast} />
      <h3 className={styles.habilitar_titulo}>🛠 Habilitar Botones</h3>

      <div className={styles.habilitar_botones}>
        {/* Asistencia */}
        <Button
          label={botonLabelAsistencia}
          icon={botonIconAsistencia}
          severity={botonSeverityAsistencia}
          onClick={() => setVisibleDialogAsistencia(true)}
          loading={loadingAsistencia}
        />

        {/* Otros botones que ya tenías */}
        <Button
          label={botonLabelMeet}
          icon={botonIconMeet}
          severity={botonSeverityMeet}
          onClick={() => setVisibleDialogMeet(true)}
          loading={loadingMeet}
        />
        <Button
          label={botonLabelHsSec}
          icon={botonIconHsSec}
          severity={botonSeverityHsSec}
          onClick={() => setVisibleDialogHsSec(true)}
          loading={loadingHsSec}
        />
        <Button
          label={botonLabelHsSup}
          icon={botonIconHsSup}
          severity={botonSeverityHsSup}
          onClick={() => setVisibleDialogHsSup(true)}
          loading={loadingHsSup}
        />
        <Button
          label={botonLabelSeguro}
          icon={botonIconSeguro}
          severity={botonSeveritySeguro}
          onClick={() => setVisibleDialogSeguro(true)}
          loading={loadingSeguro}
        />
        <Button
          label={botonLabelSepelio}
          icon={botonIconSepelio}
          severity={botonSeveritySepelio}
          onClick={() => setVisibleDialogSepelio(true)}
          loading={loadingSepelio}
        />
      </div>

      {/* ===== Modal Asistencia ===== */}
      <Dialog
        header="Configurar Asistencia — Paso 1: Curso · Paso 2: Modalidad · Paso 3: Habilitar"
        visible={visibleDialogAsistencia}
        style={{ width: 620, maxWidth: "95vw" }}
        modal
        onHide={() => setVisibleDialogAsistencia(false)}
      >
        <div style={{ display: "grid", gap: 12 }}>
          {/* Paso 1: Curso */}
          <div>
            <label>
              <strong>1) Curso:</strong>
            </label>
            <Dropdown
              value={selectedCursoId}
              onChange={(e) => setSelectedCursoId(e.value)}
              options={cursos}
              optionLabel="label"
              optionValue="value"
              placeholder={
                loadingCursos ? "Cargando cursos..." : "Seleccioná un curso"
              }
              loading={loadingCursos}
              filter
              showClear
              style={{ width: "100%", marginTop: 6 }}
              disabled={asistenciaHabilitada === "si" && !!sesionActual?.id}
            />
            {asistenciaConfig?.cursoId && !selectedCursoId && (
              <small style={{ color: "#64748b" }}>
                Último curso configurado: <b>{asistenciaConfig.cursoTitulo}</b>
              </small>
            )}
          </div>

          {/* Paso 2: Modalidad */}
          <div>
            <label>
              <strong>2) Modalidad:</strong>
            </label>
            <Dropdown
              value={selectedModalidad}
              onChange={(e) => setSelectedModalidad(e.value)}
              options={opcionesModalidad}
              optionLabel="label"
              optionValue="value"
              placeholder="Elegí la modalidad"
              style={{ width: "100%", marginTop: 6 }}
              disabled={asistenciaHabilitada === "si" && !!sesionActual?.id}
            />
            {selectedModalidad === "virtual" && (
              <small style={{ color: "#64748b" }}>
                Modo virtual: se habilita como antes (sin sesión/QR).
              </small>
            )}
            {selectedModalidad === "presencial" && (
              <small style={{ color: "#64748b" }}>
                Modo presencial: al habilitar, vas a poder abrir una sesión con
                QR estático.
              </small>
            )}
          </div>

          {/* Paso 3: Habilitar/Deshabilitar */}
          <div
            style={{
              display: "flex",
              gap: 8,
              justifyContent: "center",
              flexWrap: "wrap",
            }}
          >
            <Button
              label="Habilitar"
              icon="pi pi-check"
              severity="success"
              onClick={() => seleccionarOpcionAsistencia(true)}
              disabled={
                !selectedCursoId ||
                !selectedModalidad ||
                loadingAsistencia ||
                asistenciaHabilitada === "si"
              }
            />
            <Button
              label="Deshabilitar"
              icon="pi pi-times"
              severity="danger"
              onClick={() => seleccionarOpcionAsistencia(false)}
              disabled={loadingAsistencia || asistenciaHabilitada !== "si"}
              outlined
            />
          </div>

          {/* Gestión de sesión (solo si habilitada y modalidad presencial) */}
          {asistenciaHabilitada === "si" &&
            asistenciaConfig?.modalidad === "presencial" && (
              <div
                className={styles.card_like}
                style={{
                  border: "1px solid #eee",
                  borderRadius: 8,
                  padding: 12,
                }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: 8,
                  }}
                >
                  <strong>Sesión de Asistencia — QR estático</strong>
                  {sesionActual?.estado === "abierta" ? (
                    <span className="p-tag p-tag-success">Abierta</span>
                  ) : (
                    <span className="p-tag">Sin sesión</span>
                  )}
                </div>

                {!sesionActual?.id && (
                  <>
                    <div style={{ display: "grid", gap: 8, marginTop: 8 }}>
                      <div>
                        <label>
                          <strong>Desde:</strong>
                        </label>
                        <input
                          type="datetime-local"
                          value={desdeLocal}
                          onChange={(e) => setDesdeLocal(e.target.value)}
                          style={{
                            width: "100%",
                            padding: 8,
                            borderRadius: 6,
                            border: "1px solid #ddd",
                          }}
                        />
                      </div>
                      <div>
                        <label>
                          <strong>Hasta:</strong>
                        </label>
                        <input
                          type="datetime-local"
                          value={hastaLocal}
                          onChange={(e) => setHastaLocal(e.target.value)}
                          style={{
                            width: "100%",
                            padding: 8,
                            borderRadius: 6,
                            border: "1px solid #ddd",
                          }}
                        />
                      </div>
                    </div>

                    {!desdeLocal && !hastaLocal && (
                      <div style={{ display: "flex", gap: 8, marginTop: 6 }}>
                        <Button
                          label="Usar +90 min"
                          icon="pi pi-clock"
                          severity="secondary"
                          outlined
                          onClick={() => {
                            const nowStr = nowPlusMinutesLocalStr(0);
                            setDesdeLocal(nowStr);
                            setHastaLocal(nowPlusMinutesLocalStr(90));
                          }}
                        />
                      </div>
                    )}

                    <div
                      style={{
                        display: "flex",
                        gap: 8,
                        justifyContent: "center",
                        marginTop: 10,
                        flexWrap: "wrap",
                      }}
                    >
                      <Button
                        label="Abrir sesión"
                        icon="pi pi-play"
                        severity="success"
                        onClick={abrirSesion}
                        loading={loadingSesion}
                        disabled={
                          loadingSesion ||
                          !selectedCursoId ||
                          !desdeLocal ||
                          !hastaLocal
                        }
                      />
                    </div>
                  </>
                )}

                {sesionActual?.id && (
                  <>
                    <div
                      style={{ marginTop: 10, fontSize: 14, color: "#475569" }}
                    >
                      <div>
                        <b>Curso:</b> {sesionActual.cursoTitulo}
                      </div>
                      <div>
                        <b>Desde:</b> {sesionActual.desde}
                      </div>
                      <div>
                        <b>Hasta:</b> {sesionActual.hasta}
                      </div>
                      <div>
                        <b>Código:</b>{" "}
                        <span style={{ fontFamily: "monospace" }}>
                          {sesionActual.codigo}
                        </span>
                      </div>
                      <div>
                        <b>SessionId:</b>{" "}
                        <span style={{ fontFamily: "monospace" }}>
                          {sesionActual.id}
                        </span>
                      </div>
                    </div>

                    <div
                      style={{
                        display: "flex",
                        gap: 8,
                        justifyContent: "center",
                        marginTop: 10,
                        flexWrap: "wrap",
                      }}
                    >
                      <Button
                        label="Mostrar QR"
                        icon="pi pi-qrcode"
                        onClick={() => setQrVisible(true)}
                        severity="info"
                      />
                      <Button
                        label="Renovar código"
                        icon="pi pi-refresh"
                        onClick={renovarCodigo}
                        loading={renovandoCodigo}
                        severity="warning"
                        outlined
                      />
                      <Button
                        label="Cerrar sesión"
                        icon="pi pi-stop"
                        onClick={cerrarSesion}
                        loading={loadingSesion}
                        severity="danger"
                      />
                    </div>
                  </>
                )}
              </div>
            )}
        </div>
      </Dialog>

      {/* ===== Modal QR ===== */}
      <Dialog
        header="QR de Asistencia (proyectá esta pantalla)"
        visible={qrVisible}
        style={{ width: 560, maxWidth: "95vw" }}
        modal
        onHide={() => setQrVisible(false)}
      >
        {sesionActual?.qrPayload ? (
          <div style={{ display: "grid", placeItems: "center", gap: 12 }}>
            {/* Contenedor referenciado para tomar el SVG */}
            <div ref={qrContainerRef}>
              <QRCode value={sesionActual.qrPayload} size={320} />
            </div>

            {/* Texto grande del código (visible para leerlo a simple vista) */}
            <div style={{ textAlign: "center", color: "#111827" }}>
              <div style={{ fontSize: 18, marginBottom: 4 }}>
                <b>Curso:</b> {sesionActual.cursoTitulo}
              </div>
              <div
                style={{
                  fontSize: 28,
                  fontFamily: "monospace",
                  letterSpacing: 2,
                }}
              >
                {sesionActual.codigo || "—"}
              </div>
              <small style={{ color: "#6b7280" }}>
                Si la cámara falla, ingresá el código manualmente en la app.
              </small>
            </div>

            {/* Acciones de descarga */}
            <div
              style={{
                display: "flex",
                gap: 8,
                flexWrap: "wrap",
                justifyContent: "center",
              }}
            >
              <Button
                label="Descargar PNG"
                icon="pi pi-download"
                onClick={() => downloadQRAsPNG(4)}
                loading={downloadingQR}
                severity="success"
              />
             
              <Button
                label="Copiar código"
                icon="pi pi-copy"
                onClick={copiarCodigo}
                severity="info"
                outlined
              />
            </div>
          </div>
        ) : (
          <div
            style={{ display: "grid", placeItems: "center", minHeight: 220 }}
          >
            <span>No hay QR disponible.</span>
          </div>
        )}
      </Dialog>

      {/* ===== Otros modales existentes (Meet, valores) ===== */}
      <Dialog
        header="Cargar Link de Meet"
        visible={visibleDialogMeet}
        style={{ width: "460px" }}
        modal
        onShow={() => linkInputRef.current?.focus?.()}
        onHide={() => setVisibleDialogMeet(false)}
      >
        <p>Pegá el enlace de Google Meet y una descripción opcional.</p>
        <div style={{ marginBottom: "1rem" }}>
          <label>
            <strong>Enlace (https://meet.google.com/...):</strong>
          </label>
          <InputText
            ref={linkInputRef}
            value={linkMeet}
            onChange={(e) => setLinkMeet(e.target.value)}
            placeholder="https://meet.google.com/abc-defg-hij"
            style={{ width: "100%" }}
          />
        </div>
        <div>
          <label>
            <strong>Descripción:</strong>
          </label>
          <InputText
            value={descripcionMeet}
            onChange={(e) => setDescripcionMeet(e.target.value)}
            placeholder="Reunión mensual / Docentes 3° año"
            style={{ width: "100%" }}
          />
        </div>
        <div
          style={{
            display: "flex",
            gap: "0.75rem",
            justifyContent: "center",
            marginTop: "1.5rem",
            flexWrap: "wrap",
          }}
        >
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
              (linkMeet.trim() === "" && descripcionMeet.trim() === "")
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

      {/* Secundaria */}
      <Dialog
        header="Valor de la Hora Cátedra Secundaria"
        visible={visibleDialogHsSec}
        style={{ width: "420px" }}
        modal
        onHide={() => setVisibleDialogHsSec(false)}
      >
        <p>
          Ingrese el valor (se guardará como texto con 2 decimales, ej:
          32706.56).
        </p>
        <InputText
          type="number"
          step="0.01"
          value={valorHsSec}
          onChange={(e) => setValorHsSec(e.target.value)}
          placeholder="Ej: 32706.56"
          style={{ width: "100%" }}
        />
        <div
          style={{
            display: "flex",
            gap: "1rem",
            justifyContent: "center",
            marginTop: "1.5rem",
          }}
        >
          <Button
            label="Guardar"
            icon="pi pi-check"
            severity="success"
            onClick={guardarValorHsSec}
            disabled={valorHsSec.trim() === "" || loadingHsSec}
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

      {/* Superior */}
      <Dialog
        header="Valor de la Hora Cátedra Superior"
        visible={visibleDialogHsSup}
        style={{ width: "460px" }}
        modal
        onHide={() => setVisibleDialogHsSup(false)}
      >
        <p>Ingrese los valores (se guardarán como texto con 2 decimales).</p>
        <div style={{ marginBottom: "1rem" }}>
          <label>
            <strong>Anual:</strong>
          </label>
          <InputText
            type="number"
            step="0.01"
            value={valorAnualSup}
            onChange={(e) => setValorAnualSup(e.target.value)}
            placeholder="Ej: 32706.56"
            style={{ width: "100%" }}
          />
        </div>
        <div>
          <label>
            <strong>Cuatrimestral:</strong>
          </label>
          <InputText
            type="number"
            step="0.01"
            value={valorCuatrSup}
            onChange={(e) => setValorCuatrSup(e.target.value)}
            placeholder="Ej: 16353.28"
            style={{ width: "100%" }}
          />
        </div>
        <div
          style={{
            display: "flex",
            gap: "1rem",
            justifyContent: "center",
            marginTop: "1.5rem",
          }}
        >
          <Button
            label="Guardar"
            icon="pi pi-check"
            severity="success"
            onClick={guardarValorHsSup}
            disabled={
              valorAnualSup.trim() === "" ||
              valorCuatrSup.trim() === "" ||
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

      {/* Seguro Vida */}
      <Dialog
        header="Seguro de Vida Obligatorio"
        visible={visibleDialogSeguro}
        style={{ width: "420px" }}
        modal
        onHide={() => setVisibleDialogSeguro(false)}
      >
        <p>
          Ingrese el valor (se guardará como texto con separador de miles, ej:
          1.000).
        </p>
        <InputText
          value={valorSeguro}
          onChange={(e) => setValorSeguro(e.target.value)}
          placeholder="Ej: 1.000"
          style={{ width: "100%" }}
        />
        <div
          style={{
            display: "flex",
            gap: "1rem",
            justifyContent: "center",
            marginTop: "1.5rem",
          }}
        >
          <Button
            label="Guardar"
            icon="pi pi-check"
            severity="success"
            onClick={guardarValorSeguro}
            disabled={valorSeguro.trim() === "" || loadingSeguro}
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

      {/* Sepelio */}
      <Dialog
        header="Subsidio Sepelio"
        visible={visibleDialogSepelio}
        style={{ width: "420px" }}
        modal
        onHide={() => setVisibleDialogSepelio(false)}
      >
        <p>
          Ingrese el valor (se guardará como texto con separador de miles, ej:
          30.000).
        </p>
        <InputText
          value={valorSepelio}
          onChange={(e) => setValorSepelio(e.target.value)}
          placeholder="Ej: 30.000"
          style={{ width: "100%" }}
        />
        <div
          style={{
            display: "flex",
            gap: "1rem",
            justifyContent: "center",
            marginTop: "1.5rem",
          }}
        >
          <Button
            label="Guardar"
            icon="pi pi-check"
            severity="success"
            onClick={guardarValorSepelio}
            disabled={valorSepelio.trim() === "" || loadingSepelio}
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

export default HabilitarBotones;
