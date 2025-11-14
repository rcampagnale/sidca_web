// src/pages/Admin/botones/habilitarbotones.js
import React, { useEffect, useRef, useState, useCallback, useMemo } from "react";
import { Button } from "primereact/button";
import { Dialog } from "primereact/dialog";
import { Toast } from "primereact/toast";
import { InputText } from "primereact/inputtext";
import { ProgressSpinner } from "primereact/progressspinner";
import { Dropdown } from "primereact/dropdown";
import { InputSwitch } from "primereact/inputswitch";
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
  limit,
  writeBatch,
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

/** ---------- Borrado masivo por lotes ---------- */
async function vaciarColeccion(path, batchSize = 400) {
  const colRef = collection(db, path);
  while (true) {
    const snap = await getDocs(query(colRef, orderBy("__name__"), limit(batchSize)));
    if (snap.empty) break;
    const batch = writeBatch(db);
    snap.docs.forEach((d) => batch.delete(d.ref));
    await batch.commit();
  }
}

/** ---------- Deshabilitar y borrar TODAS las sesiones ---------- */
async function deshabilitarYBorrarTodasLasSesiones() {
  await setDoc(
    doc(db, "cod", "asistencia"),
    {
      habilitada: false,
      sessionId: deleteField(),
      cursoId: deleteField(),
      cursoTitulo: deleteField(),
      modalidad: deleteField(),
      metodo: deleteField(),
    },
    { merge: true }
  );
  await vaciarColeccion("asistencia_sesiones");
}

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
    metodo: null, // 'qr_static'
    sessionId: null,
  });

  // ===== Cursos =====
  const [cursos, setCursos] = useState([]);
  const [loadingCursos, setLoadingCursos] = useState(false);
  const [selectedCursoId, setSelectedCursoId] = useState(null);

  // ===== Modalidad =====
  const [selectedModalidad, setSelectedModalidad] = useState(null);
  const opcionesModalidad = [
    { label: "Virtual", value: "virtual" },
    { label: "Presencial (QR estático)", value: "presencial" },
  ];

  // ===== Otros modales (Meet / valores) =====
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
  
  const [sesionActual, setSesionActual] = useState(null);
  const [desdeLocal, setDesdeLocal] = useState("");
  const [hastaLocal, setHastaLocal] = useState("");
  const [qrVisible, setQrVisible] = useState(false);
  const [loadingSesion, setLoadingSesion] = useState(false);
  const [renovandoCodigo, setRenovandoCodigo] = useState(false);
  const qrContainerRef = useRef(null);
  const [downloadingQR, setDownloadingQR] = useState(false);

  // ====== 🔔 Config actualización app (simple: solo 3 campos) ======
  const [latestVersion, setLatestVersion] = useState(0);
  const [forceUpdate, setForceUpdate] = useState(false);
  const [message, setMessage] = useState("");
  const [loadingUpdate, setLoadingUpdate] = useState(false);
  const [visibleDialogUpdate, setVisibleDialogUpdate] = useState(false);

  const CFG_REF = useMemo(() => doc(db, "config", "app"), []);

  /** Lee solo los 3 campos */
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
        setMessage('Hay una nueva versión disponible. Toca “Actualizar ahora” y te llevamos directo a Play Store para descargarla.');
      }
    } catch (e) {
      toast.current?.show({ severity: "error", summary: "Error", detail: String(e) });
    }
  }, [CFG_REF]);

  /** Guarda solo los 3 campos */
  const guardarCambiosActualizacion = useCallback(async () => {
    setLoadingUpdate(true);
    try {
      const payload = {
        latestAndroidVersionCode: Number(latestVersion) || 0,
        forceUpdate: !!forceUpdate,
        message: String(message ?? ""),
      };
      try {
        await updateDoc(CFG_REF, payload);
      } catch {
        await setDoc(CFG_REF, payload, { merge: true });
      }
      toast.current?.show({ severity: "success", summary: "Guardado", detail: "Se actualizaron los datos de la app." });
      await cargarConfigUpdate();
    } catch (e) {
      toast.current?.show({ severity: "error", summary: "Error", detail: String(e) });
    } finally {
      setLoadingUpdate(false);
    }
  }, [CFG_REF, latestVersion, forceUpdate, message, cargarConfigUpdate]);

  // ---------- Lecturas ----------
  const cargarAsistenciaFlag = async () => {
    try {
      const snap = await getDoc(doc(db, "cod", "boton"));
      if (snap.exists()) {
        const valor = snap.data()?.cargar;
        setAsistenciaHabilitada(valor === "si" || valor === "no" ? valor : null);
      } else {
        setAsistenciaHabilitada(null);
      }
    } catch (err) {
      console.error("Asistencia (leer flag):", err);
      toast.current?.show({ severity: "error", summary: "Error", detail: "No se pudo cargar Asistencia." });
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
      toast.current?.show({ severity: "error", summary: "Error", detail: "No se pudo cargar la configuración de asistencia." });
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
      toast.current?.show({ severity: "error", summary: "Error", detail: "No se pudo cargar la sesión activa." });
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
        const label = (data.titulo ?? data.nombre ?? `Curso ${d.id}`).toString();
        items.push({ value: d.id, label });
      });
      setCursos(items);
    } catch (err) {
      console.error("Cursos (leer):", err);
      toast.current?.show({ severity: "error", summary: "Error", detail: "No se pudieron cargar los cursos." });
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
        setDescripcionMeet(typeof data?.descripcion === "string" ? data.descripcion : "");
      } else {
        setLinkMeet("");
        setDescripcionMeet("");
      }
    } catch (err) {}
  };

  const cargarHsSec = async () => {
    try {
      const snap = await getDoc(doc(db, "cod", "secundaria"));
      setValorHsSec(snap.exists() && typeof snap.data()?.valor === "string" ? snap.data().valor : "");
    } catch (err) {}
  };

  const cargarHsSup = async () => {
    try {
      const snap = await getDoc(doc(db, "cod", "superior"));
      if (snap.exists()) {
        setValorAnualSup(typeof snap.data()?.anual === "string" ? snap.data().anual : "");
        setValorCuatrSup(typeof snap.data()?.cuatrimestral === "string" ? snap.data().cuatrimestral : "");
      } else {
        setValorAnualSup("");
        setValorCuatrSup("");
      }
    } catch (err) {}
  };

  const cargarSeguro = async () => {
    try {
      const snap = await getDoc(doc(db, "cod", "seguroVidaObligatorio"));
      setValorSeguro(snap.exists() && typeof snap.data()?.valor === "string" ? snap.data().valor : "");
    } catch (err) {}
  };

  const cargarSepelio = async () => {
    try {
      const snap = await getDoc(doc(db, "cod", "subsidioSepelio"));
      setValorSepelio(snap.exists() && typeof snap.data()?.valor === "string" ? snap.data().valor : "");
    } catch (err) {}
  };

  // ======= FUNCIONES Meet y valores =======
  const guardarLinkMeet = async () => {
    const link = (linkMeet ?? "").trim();
    const desc = (descripcionMeet ?? "").trim();
    if (!link) {
      toast.current?.show({ severity: "warn", summary: "Atención", detail: "Pegá un enlace de Meet." });
      return;
    }
    const meetRegex = /^https?:\/\/meet\.google\.com\/[^\s]+$/i;
    if (!meetRegex.test(link)) {
      toast.current?.show({
        severity: "warn",
        summary: "Formato",
        detail: "El enlace debe ser de Google Meet (https://meet.google.com/...).",
      });
      return;
    }
    setLoadingMeet(true);
    try {
      await setDoc(doc(db, "cuotas", "sala"), { link, descripcion: desc }, { merge: true });
      setLinkMeet(link);
      setDescripcionMeet(desc);
      toast.current?.show({ severity: "success", summary: "Guardado", detail: "Enlace de Meet guardado." });
      setVisibleDialogMeet(false);
    } catch (err) {
      toast.current?.show({ severity: "error", summary: "Error", detail: "No se pudo guardar el enlace." });
    } finally {
      setLoadingMeet(false);
    }
  };

  const borrarLinkMeet = async () => {
    setLoadingMeet(true);
    try {
      await setDoc(doc(db, "cuotas", "sala"), { link: "", descripcion: "" }, { merge: true });
      setLinkMeet("");
      setDescripcionMeet("");
      toast.current?.show({ severity: "success", summary: "Eliminado", detail: "Se borró el enlace y la descripción." });
      setVisibleDialogMeet(false);
    } catch (err) {
      toast.current?.show({ severity: "error", summary: "Error", detail: "No se pudo borrar el enlace." });
    } finally {
      setLoadingMeet(false);
    }
  };

  // 💾 Guardar valor Hora Cátedra Secundaria
const guardarValorHsSec = async () => {
  // Permitimos que el usuario use coma o punto
  const raw = (valorHsSec ?? "").toString().replace(",", ".");
  const num = parseFloat(raw);

  if (isNaN(num)) {
    toast.current?.show({
      severity: "warn",
      summary: "Atención",
      detail: "Ingrese un número válido.",
    });
    return;
  }

  const formateado = num.toFixed(2); // siempre 2 decimales

  setLoadingHsSec(true);
  try {
    await setDoc(
      doc(db, "cod", "secundaria"),
      { valor: formateado },
      { merge: true }
    );

    setValorHsSec(formateado); // actualizamos el estado con lo que se guardó
    toast.current?.show({
      severity: "success",
      summary: "Guardado",
      detail: "Valor guardado correctamente.",
    });
    setVisibleDialogHsSec(false);
  } catch (err) {
    toast.current?.show({
      severity: "error",
      summary: "Error",
      detail: "No se pudo guardar el valor.",
    });
  } finally {
    setLoadingHsSec(false);
  }
};


  // 💾 Guardar valores Hora Cátedra Superior (anual y cuatrimestral)
const guardarValorHsSup = async () => {
  const rawAnual = (valorAnualSup ?? "").toString().replace(",", ".");
  const rawCuatr = (valorCuatrSup ?? "").toString().replace(",", ".");

  const numAnual = parseFloat(rawAnual);
  const numCuatr = parseFloat(rawCuatr);

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
    toast.current?.show({
      severity: "error",
      summary: "Error",
      detail: "No se pudieron guardar los valores.",
    });
  } finally {
    setLoadingHsSup(false);
  }
};


  // 💾 Guardar Seguro de Vida
const guardarValorSeguro = async () => {
  const raw = (valorSeguro ?? "").toString().trim();
  if (!raw) {
    toast.current?.show({
      severity: "warn",
      summary: "Atención",
      detail: "Ingrese un valor.",
    });
    return;
  }

  // Permitimos "1000", "1.000", "1,000.50", etc.
  const num = parseFloat(raw.replace(/\./g, "").replace(",", "."));
  if (isNaN(num)) {
    toast.current?.show({
      severity: "warn",
      summary: "Atención",
      detail: "Ingrese un número válido.",
    });
    return;
  }

  const formateado = num.toLocaleString("es-AR"); // ej: 1.000 o 30.000

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
    toast.current?.show({
      severity: "error",
      summary: "Error",
      detail: "No se pudo guardar el valor.",
    });
  } finally {
    setLoadingSeguro(false);
  }
};

  // 💾 Guardar Subsidio por Sepelio
const guardarValorSepelio = async () => {
  const raw = (valorSepelio ?? "").toString().trim();
  if (!raw) {
    toast.current?.show({
      severity: "warn",
      summary: "Atención",
      detail: "Ingrese un valor.",
    });
    return;
  }

  const num = parseFloat(raw.replace(/\./g, "").replace(",", "."));
  if (isNaN(num)) {
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
    toast.current?.show({
      severity: "error",
      summary: "Error",
      detail: "No se pudo guardar el valor.",
    });
  } finally {
    setLoadingSepelio(false);
  }
};

  // ======= FIN funciones faltantes =======

  // Refresca QR y abre modal
  const abrirModalQR = async () => {
    if (asistenciaConfig?.sessionId) await cargarSesionActiva(asistenciaConfig.sessionId);
    setQrVisible(true);
  };

  const copiarCodigo = async () => {
    try {
      if (!sesionActual?.codigo) {
        toast.current?.show({ severity: "warn", summary: "Código", detail: "No hay código disponible." });
        return;
      }
      await navigator.clipboard.writeText(sesionActual.codigo);
      toast.current?.show({ severity: "success", summary: "Copiado", detail: "Código copiado al portapapeles." });
    } catch {
      toast.current?.show({ severity: "error", summary: "Error", detail: "No se pudo copiar el código." });
    }
  };

  const downloadQRAsPNG = async (scale = 4) => {
    setDownloadingQR(true);
    try {
      const svg = qrContainerRef.current?.querySelector("svg");
      if (!svg) throw new Error("No se encontró el SVG del QR.");
      const xml = new XMLSerializer().serializeToString(svg);
      const svgBlob = new Blob([xml], { type: "image/svg+xml;charset=utf-8" });
      const url = URL.createObjectURL(svgBlob);

      const img = new Image();
      const rect = svg.getBoundingClientRect();
      const base = Math.max(rect.width || 320, rect.height || 320);
      img.onload = () => {
        const canvas = document.createElement("canvas");
        canvas.width = base * scale;
        canvas.height = base * scale;
        const ctx = canvas.getContext("2d");
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        URL.revokeObjectURL(url);

        const pngUrl = canvas.toDataURL("image/png");
        const a = document.createElement("a");
        const safeCourse = (sesionActual?.cursoTitulo || "curso").replace(/[^\w\-]+/g, "_");
        const safeCode = (sesionActual?.codigo || "QR").replace(/[^\w\-]+/g, "_");
        a.download = `${safeCourse}-${safeCode}.png`;
        a.href = pngUrl;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);

        toast.current?.show({ severity: "success", summary: "Descargado", detail: "QR descargado como PNG." });
      };
      img.onerror = () => {
        URL.revokeObjectURL(url);
        toast.current?.show({ severity: "error", summary: "Error", detail: "No se pudo generar la imagen del QR." });
      };
      img.src = url;
    } catch (err) {
      toast.current?.show({ severity: "error", summary: "Error", detail: "No se pudo descargar el QR." });
    } finally {
      setDownloadingQR(false);
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
          cargarConfigUpdate(),
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
      await setDoc(
        doc(db, "cod", "boton"),
        { cargar: habilitar ? "si" : "no", cursoId: deleteField(), cursoTitulo: deleteField() },
        { merge: true }
      );

      if (habilitar) {
        if (!selectedCursoId) {
          toast.current?.show({ severity: "warn", summary: "Atención", detail: "Seleccioná un curso." });
          setLoadingAsistencia(false);
          return;
        }
        if (!selectedModalidad) {
          toast.current?.show({ severity: "warn", summary: "Atención", detail: "Seleccioná la modalidad." });
          setLoadingAsistencia(false);
          return;
        }

        const curso = cursos.find((c) => c.value === selectedCursoId);
        const cursoTitulo = curso?.label ?? "";

        if (selectedModalidad === "virtual") {
          const sessionId = asistenciaConfig?.sessionId;
          if (sessionId) {
            try {
              await updateDoc(doc(db, "asistencia_sesiones", sessionId), {
                estado: "cerrada",
                codigo: deleteField(),
                qrPayload: deleteField(),
              });
              await deleteDoc(doc(db, "asistencia_sesiones", sessionId));
            } catch {}
          }

          await setDoc(
            doc(db, "cod", "asistencia"),
            { habilitada: true, cursoId: selectedCursoId, cursoTitulo, modalidad: "virtual", metodo: deleteField(), sessionId: deleteField() },
            { merge: true }
          );

          setAsistenciaConfig({ habilitada: true, cursoId: selectedCursoId, cursoTitulo, modalidad: "virtual", metodo: null, sessionId: null });
          setSesionActual(null);
        } else {
          await setDoc(
            doc(db, "cod", "asistencia"),
            { habilitada: true, cursoId: selectedCursoId, cursoTitulo, modalidad: "presencial", metodo: "qr_static", sessionId: deleteField() },
            { merge: true }
          );

          setAsistenciaConfig((prev) => ({ ...prev, habilitada: true, cursoId: selectedCursoId, cursoTitulo, modalidad: "presencial", metodo: "qr_static", sessionId: null }));
        }
      } else {
        const sessionId = asistenciaConfig?.sessionId;
        if (sessionId) {
          try {
            await updateDoc(doc(db, "asistencia_sesiones", sessionId), {
              estado: "cerrada",
              codigo: deleteField(),
              qrPayload: deleteField(),
            });
          } catch {}
          try {
            await deleteDoc(doc(db, "asistencia_sesiones", sessionId));
          } catch {}
        }

        await deshabilitarYBorrarTodasLasSesiones();

        setQrVisible(false);
        setSesionActual(null);
        setAsistenciaConfig({ habilitada: false, cursoId: null, cursoTitulo: "", modalidad: null, metodo: null, sessionId: null });
        setSelectedCursoId(null);
        setSelectedModalidad(null);
      }

      setAsistenciaHabilitada(habilitar ? "si" : "no");
      toast.current?.show({ severity: "success", summary: "Guardado", detail: `Asistencia ${habilitar ? "habilitada" : "deshabilitada"}.` });
      setVisibleDialogAsistencia(false);
    } catch (err) {
      toast.current?.show({ severity: "error", summary: "Error", detail: "No se pudo guardar Asistencia." });
    } finally {
      setLoadingAsistencia(false);
    }
  };

  // ---------- Sesión QR ----------
  const abrirSesion = async () => {
    if (asistenciaHabilitada !== "si") {
      toast.current?.show({ severity: "warn", summary: "Atención", detail: "Primero habilitá la asistencia." });
      return;
    }
    if (asistenciaConfig?.modalidad !== "presencial") {
      toast.current?.show({ severity: "warn", summary: "Atención", detail: "La sesión QR es solo para Presencial." });
      return;
    }
    if (!selectedCursoId) {
      toast.current?.show({ severity: "warn", summary: "Atención", detail: "Seleccioná un curso." });
      return;
    }
    if (!desdeLocal || !hastaLocal) {
      toast.current?.show({ severity: "warn", summary: "Atención", detail: "Indicá 'desde' y 'hasta'." });
      return;
    }

    const curso = cursos.find((c) => c.value === selectedCursoId);
    const cursoTitulo = curso?.label ?? "";
    const codigo = genCodigo();
    const qrPayload = `sidca://asistencia?s=${encodeURIComponent("auto")}&c=${encodeURIComponent(codigo)}&v=1`;
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

      await setDoc(doc(db, "cod", "asistencia"), { sessionId: ref.id, cursoId: selectedCursoId, cursoTitulo, modalidad: "presencial", metodo: "qr_static" }, { merge: true });

      const sesion = { id: ref.id, cursoId: selectedCursoId, cursoTitulo, estado: "abierta", desde: desdeISO, hasta: hastaISO, codigo, qrPayload, metodo: "qr_static" };
      setSesionActual(sesion);
      setAsistenciaConfig((prev) => ({ ...prev, sessionId: ref.id, cursoId: selectedCursoId, cursoTitulo, modalidad: "presencial", metodo: "qr_static" }));

      toast.current?.show({ severity: "success", summary: "Sesión abierta", detail: `Código: ${codigo}` });
    } catch (err) {
      toast.current?.show({ severity: "error", summary: "Error", detail: "No se pudo abrir la sesión." });
    } finally {
      setLoadingSesion(false);
    }
  };

  const renovarCodigo = async () => {
    if (!sesionActual?.id) return;
    setRenovandoCodigo(true);
    try {
      const codigo = genCodigo();
      const qrPayload = `sidca://asistencia?s=${encodeURIComponent("auto")}&c=${encodeURIComponent(codigo)}&v=1`;
      await updateDoc(doc(db, "asistencia_sesiones", sesionActual.id), { codigo, qrPayload });
      setSesionActual((prev) => ({ ...prev, codigo, qrPayload }));
      toast.current?.show({ severity: "success", summary: "Código renovado", detail: `Nuevo código: ${codigo}` });
    } catch (err) {
      toast.current?.show({ severity: "error", summary: "Error", detail: "No se pudo renovar el código." });
    } finally {
      setRenovandoCodigo(false);
    }
  };

  const cerrarSesion = async () => {
    if (!sesionActual?.id) return;
    setLoadingSesion(true);
    try {
      await deleteDoc(doc(db, "asistencia_sesiones", sesionActual.id));
      await setDoc(doc(db, "cod", "asistencia"), { sessionId: deleteField() }, { merge: true });
      setQrVisible(false);
      setSesionActual(null);
      setAsistenciaConfig((prev) => ({ ...prev, sessionId: null }));
      toast.current?.show({ severity: "success", summary: "Sesión cerrada", detail: "La sesión fue cerrada y el documento se eliminó." });
    } catch (err) {
      toast.current?.show({ severity: "error", summary: "Error", detail: "No se pudo cerrar la sesión." });
    } finally {
      setLoadingSesion(false);
    }
  };

  // ---------- Labels / iconos ----------
  const botonLabelAsistencia =
    asistenciaHabilitada === null
      ? "Habilitar Asistencia"
      : asistenciaHabilitada === "si"
      ? `Asistencia: Sí${asistenciaConfig?.cursoTitulo ? ` (${asistenciaConfig.cursoTitulo})` : ""}`
      : "Asistencia: No";
  const botonIconAsistencia = asistenciaHabilitada === null ? "pi pi-check-square" : asistenciaHabilitada === "si" ? "pi pi-check" : "pi pi-times";
  const botonSeverityAsistencia = asistenciaHabilitada === null ? "secondary" : asistenciaHabilitada === "si" ? "success" : "danger";

  const hayLinkMeet = (linkMeet ?? "").trim() !== "";
  const botonLabelMeet = hayLinkMeet ? "Link Meet Cargado" : "Cargar Link de Meet";
  const botonIconMeet = hayLinkMeet ? "pi pi-link" : "pi pi-video";
  const botonSeverityMeet = hayLinkMeet ? "success" : "info";

  const hayValorHsSec = valorHsSec.trim() !== "";
  const botonLabelHsSec = hayValorHsSec ? `Hs Cát. Sec.: $ ${valorHsSec}` : "Valor de la Hs Cátedra Secundaria.";
  const botonIconHsSec = hayValorHsSec ? "pi pi-check-circle" : "pi pi-dollar";
  const botonSeverityHsSec = hayValorHsSec ? "success" : "warning";

  const hayValorHsSup = valorAnualSup.trim() !== "" && valorCuatrSup.trim() !== "";
  const botonLabelHsSup = hayValorHsSup ? `Hs Cát. Sup.: Anual $${valorAnualSup} / Cuatr. $${valorCuatrSup}` : "Valor de la Hs Cátedra Superior.";
  const botonIconHsSup = hayValorHsSup ? "pi pi-check-circle" : "pi pi-dollar";
  const botonSeverityHsSup = hayValorHsSup ? "success" : "warning";

  const hayValorSeguro = valorSeguro.trim() !== "";
  const botonLabelSeguro = hayValorSeguro ? `Seguro Vida: $ ${valorSeguro}` : "Seguro de Vida Obligatorio";
  const botonIconSeguro = hayValorSeguro ? "pi pi-check-circle" : "pi pi-shield";
  const botonSeveritySeguro = hayValorSeguro ? "success" : "help";

  const hayValorSepelio = valorSepelio.trim() !== "";
  const botonLabelSepelio = hayValorSepelio ? `Sepelio: $ ${valorSepelio}` : "Subsidio Sepelio";
  const botonIconSepelio = hayValorSepelio ? "pi pi-check-circle" : "pi pi-briefcase";
  const botonSeveritySepelio = hayValorSepelio ? "success" : "help";

  // Aviso actualización: etiqueta neutra
  const botonLabelUpdate = "Aviso de actualización de app";
  const botonIconUpdate = "pi pi-bell";
  const botonSeverityUpdate = "help";

  // ---------- Splash ----------
  if (bootLoading) {
    return (
      <div style={{ minHeight: 220, display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: "0.75rem", background: "rgba(255,255,255,0.6)", borderRadius: 12 }}>
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
        <Button label={botonLabelAsistencia} icon={botonIconAsistencia} severity={botonSeverityAsistencia} onClick={() => setVisibleDialogAsistencia(true)} loading={loadingAsistencia} />
        <Button label={botonLabelMeet} icon={botonIconMeet} severity={botonSeverityMeet} onClick={() => setVisibleDialogMeet(true)} loading={loadingMeet} />
        <Button label={botonLabelHsSec} icon={botonIconHsSec} severity={botonSeverityHsSec} onClick={() => setVisibleDialogHsSec(true)} loading={loadingHsSec} />
        <Button label={botonLabelHsSup} icon={botonIconHsSup} severity={botonSeverityHsSup} onClick={() => setVisibleDialogHsSup(true)} loading={loadingHsSup} />
        <Button label={botonLabelSeguro} icon={botonIconSeguro} severity={botonSeveritySeguro} onClick={() => setVisibleDialogSeguro(true)} loading={loadingSeguro} />
        <Button label={botonLabelSepelio} icon={botonIconSepelio} severity={botonSeveritySepelio} onClick={() => setVisibleDialogSepelio(true)} loading={loadingSepelio} />
        <Button label={botonLabelUpdate} icon={botonIconUpdate} severity={botonSeverityUpdate} onClick={() => setVisibleDialogUpdate(true)} loading={loadingUpdate} />
      </div>

      {/* Modal: aviso actualización (SIMPLE) */}
      <Dialog
        header="Aviso de actualización de la App (Android) — Edición simple"
        visible={visibleDialogUpdate}
        style={{ width: 560, maxWidth: "95vw" }}
        modal
        onHide={() => setVisibleDialogUpdate(false)}
      >
        <div className={styles.formGrid}>
          <div className={styles.formRow}>
            <label>Última versión (latestAndroidVersionCode)</label>
            <InputText
              value={String(latestVersion)}
              onChange={(e) => setLatestVersion(e.target.value.replace(/\D/g, ""))}
              placeholder="Ej: 18"
            />
          </div>

          <div className={styles.formRow}>
            <label>Forzar actualización (forceUpdate)</label>
            <div>
              <InputSwitch checked={forceUpdate} onChange={(e) => setForceUpdate(e.value)} />
            </div>
          </div>

          <div className={styles.formRow}>
            <label>Mensaje (message)</label>
            <InputText
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder='Ej: "Hay una nueva versión disponible..."'
            />
          </div>
        </div>

        <div style={{ display: "flex", gap: 8, marginTop: 12, flexWrap: "wrap", justifyContent: "center" }}>
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
            className="p-button-secondary"
            onClick={() => setVisibleDialogUpdate(false)}
            disabled={loadingUpdate}
          />
        </div>

        <small style={{ display: "block", marginTop: 8, opacity: 0.8 }}>
          Este panel solo edita <code>latestAndroidVersionCode</code>, <code>forceUpdate</code> y <code>message</code> en <code>config/app</code>.
        </small>
      </Dialog>

      {/* ===== Modal Asistencia ===== */}
      <Dialog header="Configurar Asistencia — Paso 1: Curso · Paso 2: Modalidad · Paso 3: Habilitar" visible={visibleDialogAsistencia} style={{ width: 620, maxWidth: "95vw" }} modal onHide={() => setVisibleDialogAsistencia(false)}>
        <div style={{ display: "grid", gap: 12 }}>
          <div>
            <label><strong>1) Curso:</strong></label>
            <Dropdown value={selectedCursoId} onChange={(e) => setSelectedCursoId(e.value)} options={cursos} optionLabel="label" optionValue="value" placeholder={loadingCursos ? "Cargando cursos..." : "Seleccioná un curso"} loading={loadingCursos} filter showClear style={{ width: "100%", marginTop: 6 }} disabled={asistenciaHabilitada === "si" && !!sesionActual?.id} />
            {asistenciaConfig?.cursoId && !selectedCursoId && <small style={{ color: "#64748b" }}>Último curso configurado: <b>{asistenciaConfig.cursoTitulo}</b></small>}
          </div>

          <div>
            <label><strong>2) Modalidad:</strong></label>
            <Dropdown value={selectedModalidad} onChange={(e) => setSelectedModalidad(e.value)} options={opcionesModalidad} optionLabel="label" optionValue="value" placeholder="Elegí la modalidad" style={{ width: "100%", marginTop: 6 }} disabled={asistenciaHabilitada === "si" && !!sesionActual?.id} />
            {selectedModalidad === "virtual" && <small style={{ color: "#64748b" }}>Modo virtual: se habilita sin sesión/QR.</small>}
            {selectedModalidad === "presencial" && <small style={{ color: "#64748b" }}>Modo presencial: vas a poder abrir una sesión con QR estático.</small>}
          </div>

          <div style={{ display: "flex", gap: 8, justifyContent: "center", flexWrap: "wrap" }}>
            <Button label="Habilitar" icon="pi pi-check" severity="success" onClick={() => seleccionarOpcionAsistencia(true)} disabled={!selectedCursoId || !selectedModalidad || loadingAsistencia || asistenciaHabilitada === "si"} />
            <Button label="Deshabilitar" icon="pi pi-times" severity="danger" onClick={() => seleccionarOpcionAsistencia(false)} disabled={loadingAsistencia || asistenciaHabilitada !== "si"} outlined />
          </div>

          {asistenciaHabilitada === "si" && asistenciaConfig?.modalidad === "presencial" && (
            <div className={styles.card_like} style={{ border: "1px solid #eee", borderRadius: 8, padding: 12 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                <strong>Sesión de Asistencia — QR estático</strong>
                {sesionActual?.estado === "abierta" ? <span className="p-tag p-tag-success">Abierta</span> : <span className="p-tag">Sin sesión</span>}
              </div>

              {!sesionActual?.id && (
                <>
                  <div style={{ display: "grid", gap: 8, marginTop: 8 }}>
                    <div>
                      <label><strong>Desde:</strong></label>
                      <input type="datetime-local" value={desdeLocal} onChange={(e) => setDesdeLocal(e.target.value)} style={{ width: "100%", padding: 8, borderRadius: 6, border: "1px solid #ddd" }} />
                    </div>
                    <div>
                      <label><strong>Hasta:</strong></label>
                      <input type="datetime-local" value={hastaLocal} onChange={(e) => setHastaLocal(e.target.value)} style={{ width: "100%", padding: 8, borderRadius: 6, border: "1px solid #ddd" }} />
                    </div>
                  </div>

                  {!desdeLocal && !hastaLocal && (
                    <div style={{ display: "flex", gap: 8, marginTop: 6 }}>
                      <Button label="Usar +90 min" icon="pi pi-clock" severity="secondary" outlined onClick={() => { const nowStr = nowPlusMinutesLocalStr(0); setDesdeLocal(nowStr); setHastaLocal(nowPlusMinutesLocalStr(90)); }} />
                    </div>
                  )}

                  <div style={{ display: "flex", gap: 8, justifyContent: "center", marginTop: 10, flexWrap: "wrap" }}>
                    <Button label="Abrir sesión" icon="pi pi-play" severity="success" onClick={abrirSesion} loading={loadingSesion} disabled={loadingSesion || !selectedCursoId || !desdeLocal || !hastaLocal} />
                  </div>
                </>
              )}

              {sesionActual?.id && (
                <>
                  <div style={{ marginTop: 10, fontSize: 14, color: "#475569" }}>
                    <div><b>Curso:</b> {sesionActual.cursoTitulo}</div>
                    <div><b>Desde:</b> {sesionActual.desde}</div>
                    <div><b>Hasta:</b> {sesionActual.hasta}</div>
                    <div><b>Código:</b> <span style={{ fontFamily: "monospace" }}>{sesionActual.codigo}</span></div>
                    <div><b>SessionId:</b> <span style={{ fontFamily: "monospace" }}>{sesionActual.id}</span></div>
                  </div>

                  <div style={{ display: "flex", gap: 8, justifyContent: "center", marginTop: 10, flexWrap: "wrap" }}>
                    <Button label="Mostrar QR" icon="pi pi-qrcode" onClick={() => setQrVisible(true)} severity="info" />
                    <Button label="Renovar código" icon="pi pi-refresh" onClick={renovarCodigo} loading={renovandoCodigo} severity="warning" outlined />
                    <Button label="Cerrar sesión" icon="pi pi-stop" onClick={cerrarSesion} loading={loadingSesion} severity="danger" />
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </Dialog>

      {/* ===== Modal QR ===== */}
      <Dialog header="QR de Asistencia (proyectá esta pantalla)" visible={qrVisible} style={{ width: 560, maxWidth: "95vw" }} modal onHide={() => setQrVisible(false)}>
        {sesionActual?.qrPayload ? (
          <div style={{ display: "grid", placeItems: "center", gap: 12 }}>
            <div ref={qrContainerRef}><QRCode value={sesionActual.qrPayload} size={320} /></div>
            <div style={{ textAlign: "center", color: "#111827" }}>
              <div style={{ fontSize: 18, marginBottom: 4 }}><b>Curso:</b> {sesionActual.cursoTitulo}</div>
              <div style={{ fontSize: 28, fontFamily: "monospace", letterSpacing: 2 }}>{sesionActual.codigo || "—"}</div>
              <small style={{ color: "#6b7280" }}>Si la cámara falla, ingresá el código manualmente en la app.</small>
            </div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "center" }}>
              <Button label="Descargar PNG" icon="pi pi-download" onClick={() => downloadQRAsPNG(4)} loading={downloadingQR} severity="success" />
              <Button label="Copiar código" icon="pi pi-copy" onClick={copiarCodigo} severity="info" outlined />
            </div>
          </div>
        ) : (
          <div style={{ display: "grid", placeItems: "center", minHeight: 220 }}>
            <span>No hay QR disponible.</span>
          </div>
        )}
      </Dialog>

      {/* ===== Otros modales (Meet, valores) ===== */}
      <Dialog header="Cargar Link de Meet" visible={visibleDialogMeet} style={{ width: "460px" }} modal onShow={() => linkInputRef.current?.focus?.()} onHide={() => setVisibleDialogMeet(false)}>
        <p>Pegá el enlace de Google Meet y una descripción opcional.</p>
        <div style={{ marginBottom: "1rem" }}>
          <label><strong>Enlace (https://meet.google.com/...):</strong></label>
          <InputText ref={linkInputRef} value={linkMeet} onChange={(e) => setLinkMeet(e.target.value)} placeholder="https://meet.google.com/abc-defg-hij" style={{ width: "100%" }} />
        </div>
        <div>
          <label><strong>Descripción:</strong></label>
          <InputText value={descripcionMeet} onChange={(e) => setDescripcionMeet(e.target.value)} placeholder="Reunión mensual / Docentes 3° año" style={{ width: "100%" }} />
        </div>
        <div style={{ display: "flex", gap: "0.75rem", justifyContent: "center", marginTop: "1.5rem", flexWrap: "wrap" }}>
          <Button label="Guardar" icon="pi pi-check" severity="success" onClick={guardarLinkMeet} disabled={loadingMeet} loading={loadingMeet} />
          <Button label="Borrar" icon="pi pi-trash" severity="warning" onClick={borrarLinkMeet} disabled={loadingMeet || (linkMeet.trim() === "" && descripcionMeet.trim() === "")} />
          <Button label="Cancelar" icon="pi pi-times" severity="danger" onClick={() => setVisibleDialogMeet(false)} disabled={loadingMeet} />
        </div>
      </Dialog>

      <Dialog header="Valor de la Hora Cátedra Secundaria" visible={visibleDialogHsSec} style={{ width: "420px" }} modal onHide={() => setVisibleDialogHsSec(false)}>
        <p>Ingrese el valor (se guardará como texto con 2 decimales, ej: 32706.56).</p>
        <InputText type="number" step="0.01" value={valorHsSec} onChange={(e) => setValorHsSec(e.target.value)} placeholder="Ej: 32706.56" style={{ width: "100%" }} />
        <div style={{ display: "flex", gap: "1rem", justifyContent: "center", marginTop: "1.5rem" }}>
          <Button label="Guardar" icon="pi pi-check" severity="success" onClick={guardarValorHsSec} disabled={valorHsSec.trim() === "" || loadingHsSec} loading={loadingHsSec} />
          <Button label="Cancelar" icon="pi pi-times" severity="danger" onClick={() => setVisibleDialogHsSec(false)} disabled={loadingHsSec} />
        </div>
      </Dialog>

      <Dialog header="Valor de la Hora Cátedra Superior" visible={visibleDialogHsSup} style={{ width: "460px" }} modal onHide={() => setVisibleDialogHsSup(false)}>
        <p>Ingrese los valores (se guardarán como texto con 2 decimales).</p>
        <div style={{ marginBottom: "1rem" }}>
          <label><strong>Anual:</strong></label>
          <InputText type="number" step="0.01" value={valorAnualSup} onChange={(e) => setValorAnualSup(e.target.value)} placeholder="Ej: 32706.56" style={{ width: "100%" }} />
        </div>
        <div>
          <label><strong>Cuatrimestral:</strong></label>
          <InputText type="number" step="0.01" value={valorCuatrSup} onChange={(e) => setValorCuatrSup(e.target.value)} placeholder="Ej: 16353.28" style={{ width: "100%" }} />
        </div>
        <div style={{ display: "flex", gap: "1rem", justifyContent: "center", marginTop: "1.5rem" }}>
          <Button label="Guardar" icon="pi pi-check" severity="success" onClick={guardarValorHsSup} disabled={valorAnualSup.trim() === "" || valorCuatrSup.trim() === "" || loadingHsSup} loading={loadingHsSup} />
          <Button label="Cancelar" icon="pi pi-times" severity="danger" onClick={() => setVisibleDialogHsSup(false)} disabled={loadingHsSup} />
        </div>
      </Dialog>

      <Dialog header="Seguro de Vida Obligatorio" visible={visibleDialogSeguro} style={{ width: "420px" }} modal onHide={() => setVisibleDialogSeguro(false)}>
        <p>Ingrese el valor (se guardará como texto con separador de miles, ej: 1.000).</p>
        <InputText value={valorSeguro} onChange={(e) => setValorSeguro(e.target.value)} placeholder="Ej: 1.000" style={{ width: "100%" }} />
        <div style={{ display: "flex", gap: "1rem", justifyContent: "center", marginTop: "1.5rem" }}>
          <Button label="Guardar" icon="pi pi-check" severity="success" onClick={guardarValorSeguro} disabled={valorSeguro.trim() === "" || loadingSeguro} loading={loadingSeguro} />
          <Button label="Cancelar" icon="pi pi-times" severity="danger" onClick={() => setVisibleDialogSeguro(false)} disabled={loadingSeguro} />
        </div>
      </Dialog>

      <Dialog header="Subsidio Sepelio" visible={visibleDialogSepelio} style={{ width: "420px" }} modal onHide={() => setVisibleDialogSepelio(false)}>
        <p>Ingrese el valor (se guardará como texto con separador de miles, ej: 30.000).</p>
        <InputText value={valorSepelio} onChange={(e) => setValorSepelio(e.target.value)} placeholder="Ej: 30.000" style={{ width: "100%" }} />
        <div style={{ display: "flex", gap: "1rem", justifyContent: "center", marginTop: "1.5rem" }}>
          <Button label="Guardar" icon="pi pi-check" severity="success" onClick={guardarValorSepelio} disabled={valorSepelio.trim() === "" || loadingSepelio} loading={loadingSepelio} />
          <Button label="Cancelar" icon="pi pi-times" severity="danger" onClick={() => setVisibleDialogSepelio(false)} disabled={loadingSepelio} />
        </div>
      </Dialog>
    </div>
  );
};

export default HabilitarBotones;
