// src/components/HabilitarBotones/qr/useQRSync.js

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  addDoc,
  collection,
  deleteDoc,
  deleteField,
  doc,
  onSnapshot,
  setDoc,
  updateDoc,
} from "firebase/firestore";
import { db } from "../../../firebase/firebase-config";
import {
  DEVICE_ID_KEY,
  DEVICE_NAME_KEY,
  crearQrPayload,
  deshabilitarYBorrarTodasLasSesiones,
  genCodigo,
  genDeviceId,
  normalizarPantallasRegistradas,
  normalizarQrSync,
  toISO,
} from "./qrUtils.js";

const normalizarTipoRegistro = (value) => {
  if (value === "salida") return "salida";
  return "ingreso";
};

const normalizarIntervalo = (value) => {
  const seconds = Number(value) || 60;

  if (seconds < 30) return 60;

  return seconds;
};

export function useQRSync({ toastRef }) {
  const asistenciaDocRef = useMemo(() => doc(db, "cod", "asistencia"), []);
  const qrContainerRef = useRef(null);

  const [deviceId, setDeviceId] = useState("");
  const [deviceName, setDeviceName] = useState("");

  const [asistenciaConfig, setAsistenciaConfig] = useState({
    habilitada: false,
    cursoId: null,
    cursoTitulo: "",
    modalidad: null,
    metodo: null,
    sessionId: null,
    tipoRegistro: "ingreso",
    autoRefreshSeconds: 60,
  });

  const [sesionActual, setSesionActual] = useState(null);
  const [pantallasRegistradas, setPantallasRegistradas] = useState({});
  const [qrSync, setQrSync] = useState(normalizarQrSync({}));

  const [qrVisible, setQrVisible] = useState(false);
  const [loadingSesion, setLoadingSesion] = useState(false);
  const [renovandoCodigo, setRenovandoCodigo] = useState(false);
  const [downloadingQR, setDownloadingQR] = useState(false);

  /*
    Identificador único de esta computadora.
    Importante:
    - PC normal: tiene un deviceId.
    - Ventana incógnito: genera otro deviceId.
    - Otra computadora: genera otro deviceId.
  */
  useEffect(() => {
    let id = localStorage.getItem(DEVICE_ID_KEY);
    const nombre = localStorage.getItem(DEVICE_NAME_KEY) || "";

    if (!id) {
      id = genDeviceId();
      localStorage.setItem(DEVICE_ID_KEY, id);
    }

    setDeviceId(id);
    setDeviceName(nombre);
  }, []);

  /*
    Escucha en tiempo real de cod/asistencia.
    Acá queda la configuración global de asistencia y sincronización QR.
  */
  useEffect(() => {
    const unsub = onSnapshot(
      asistenciaDocRef,
      (snap) => {
        if (!snap.exists()) {
          setAsistenciaConfig({
            habilitada: false,
            cursoId: null,
            cursoTitulo: "",
            modalidad: null,
            metodo: null,
            sessionId: null,
            tipoRegistro: "ingreso",
            autoRefreshSeconds: 60,
          });

          setPantallasRegistradas({});
          setQrSync(normalizarQrSync({}));
          setSesionActual(null);
          setQrVisible(false);

          return;
        }

        const data = snap.data() || {};

        setAsistenciaConfig({
          habilitada: !!data.habilitada,
          cursoId: data.cursoId ?? null,
          cursoTitulo: data.cursoTitulo ?? "",
          modalidad: data.modalidad ?? null,
          metodo: data.metodo ?? null,
          sessionId: data.sessionId ?? null,
          tipoRegistro: normalizarTipoRegistro(data.tipoRegistro),
          autoRefreshSeconds: normalizarIntervalo(data.autoRefreshSeconds),
        });

        setPantallasRegistradas(
          normalizarPantallasRegistradas(data.pantallasRegistradas)
        );

        setQrSync(normalizarQrSync(data.qrSync));
      },
      (err) => {
        console.error("cod/asistencia onSnapshot:", err);

        toastRef.current?.show({
          severity: "error",
          summary: "Error",
          detail: "No se pudo sincronizar la configuración QR.",
        });
      }
    );

    return () => unsub();
  }, [asistenciaDocRef, toastRef]);

  /*
    Escucha en tiempo real de la sesión QR activa.
    Si otra PC renueva el código, todas las pantallas reciben el nuevo QR.
  */
  useEffect(() => {
    if (!asistenciaConfig?.sessionId) {
      setSesionActual(null);
      return undefined;
    }

    const sesionRef = doc(db, "asistencia_sesiones", asistenciaConfig.sessionId);

    const unsub = onSnapshot(
      sesionRef,
      (snap) => {
        if (!snap.exists()) {
          setSesionActual(null);
          setQrVisible(false);
          return;
        }

        setSesionActual({
          id: snap.id,
          ...snap.data(),
        });
      },
      (err) => {
        console.error("asistencia_sesiones onSnapshot:", err);

        toastRef.current?.show({
          severity: "error",
          summary: "Error",
          detail: "No se pudo sincronizar la sesión QR.",
        });
      }
    );

    return () => unsub();
  }, [asistenciaConfig?.sessionId, toastRef]);

  const estaComputadoraRegistrada = useMemo(() => {
    if (!deviceId) return false;

    return !!pantallasRegistradas?.[deviceId];
  }, [deviceId, pantallasRegistradas]);

  const estaComputadoraAutorizada = useMemo(() => {
    if (!deviceId) return false;

    return (
      Array.isArray(qrSync?.pantallasAutorizadas) &&
      qrSync.pantallasAutorizadas.includes(deviceId)
    );
  }, [deviceId, qrSync]);

  const pantallasArray = useMemo(() => {
    return Object.entries(pantallasRegistradas || {})
      .map(([id, data]) => ({
        id,
        nombre: data?.nombre || id,
        activa: data?.activa !== false,
        ultimoAcceso: data?.ultimoAcceso || null,
        registradaEn: data?.registradaEn || null,
      }))
      .sort((a, b) => a.nombre.localeCompare(b.nombre));
  }, [pantallasRegistradas]);

  /*
    Apertura y cierre automático del modal QR en pantallas autorizadas.
    Las computadoras de empleados no registradas no reciben la apertura.
  */
  useEffect(() => {
    const haySesion = !!asistenciaConfig?.sessionId && !!sesionActual?.id;
    const sesionAbierta = sesionActual?.estado === "abierta";
    const tieneQR = !!sesionActual?.qrPayload;

    const debeAbrir =
      estaComputadoraAutorizada &&
      qrSync?.habilitada &&
      qrSync?.abrirQr &&
      haySesion &&
      sesionAbierta &&
      tieneQR;

    const debeCerrar =
      estaComputadoraAutorizada &&
      (!qrSync?.habilitada ||
        qrSync?.cerrarQr ||
        !haySesion ||
        sesionActual?.estado === "cerrada" ||
        !tieneQR);

    if (debeAbrir) {
      setQrVisible(true);
    }

    if (debeCerrar) {
      setQrVisible(false);
    }
  }, [
    asistenciaConfig?.sessionId,
    estaComputadoraAutorizada,
    qrSync?.habilitada,
    qrSync?.abrirQr,
    qrSync?.cerrarQr,
    sesionActual?.id,
    sesionActual?.estado,
    sesionActual?.qrPayload,
  ]);

  const registrarPantallaActual = useCallback(
    async (nombrePantalla) => {
      const nombre = String(nombrePantalla || "").trim();

      if (!nombre) {
        toastRef.current?.show({
          severity: "warn",
          summary: "Falta nombre",
          detail: "Indicá un nombre para identificar esta computadora.",
        });

        return false;
      }

      if (!deviceId) {
        toastRef.current?.show({
          severity: "error",
          summary: "Error",
          detail: "No se pudo identificar esta computadora.",
        });

        return false;
      }

      localStorage.setItem(DEVICE_NAME_KEY, nombre);
      setDeviceName(nombre);

      await setDoc(
        asistenciaDocRef,
        {
          pantallasRegistradas: {
            [deviceId]: {
              nombre,
              activa: true,
              tipo: "pantalla_qr",
              deviceId,
              registradaEn:
                pantallasRegistradas?.[deviceId]?.registradaEn || new Date(),
              ultimoAcceso: new Date(),
            },
          },
        },
        { merge: true }
      );

      toastRef.current?.show({
        severity: "success",
        summary: "Pantalla registrada",
        detail: `Esta computadora quedó registrada como "${nombre}".`,
      });

      return true;
    },
    [asistenciaDocRef, deviceId, pantallasRegistradas, toastRef]
  );

  const borrarPantallaRegistrada = useCallback(
    async (id, pantallasSeleccionadas = []) => {
      if (!id) return;

      const nuevasSeleccionadas = pantallasSeleccionadas.filter((x) => x !== id);

      await updateDoc(asistenciaDocRef, {
        [`pantallasRegistradas.${id}`]: deleteField(),
        "qrSync.pantallasAutorizadas": nuevasSeleccionadas,
        "qrSync.updatedAt": new Date(),
      });

      if (id === deviceId) {
        localStorage.removeItem(DEVICE_NAME_KEY);
        setDeviceName("");
      }

      toastRef.current?.show({
        severity: "success",
        summary: "Pantalla eliminada",
        detail: "La pantalla fue quitada de la sincronización.",
      });
    },
    [asistenciaDocRef, deviceId, toastRef]
  );

  const cerrarSesionPorId = useCallback(async (sessionId) => {
    if (!sessionId) return;

    try {
      await updateDoc(doc(db, "asistencia_sesiones", sessionId), {
        estado: "cerrada",
        codigo: deleteField(),
        qrPayload: deleteField(),
        updatedAt: new Date(),
      });
    } catch (err) {
      console.error("No se pudo marcar sesión como cerrada:", err);
    }

    try {
      await deleteDoc(doc(db, "asistencia_sesiones", sessionId));
    } catch (err) {
      console.error("No se pudo eliminar sesión:", err);
    }
  }, []);

  const actualizarConfigAsistencia = useCallback(
    async ({ habilitar, selectedCursoId, selectedModalidad, cursoTitulo }) => {
      if (habilitar) {
        if (selectedModalidad === "virtual") {
          if (asistenciaConfig?.sessionId) {
            await cerrarSesionPorId(asistenciaConfig.sessionId);
          }

          await setDoc(
            asistenciaDocRef,
            {
              habilitada: true,
              cursoId: selectedCursoId,
              cursoTitulo,
              modalidad: "virtual",
              metodo: deleteField(),
              sessionId: deleteField(),
              tipoRegistro: deleteField(),
              autoRefreshSeconds: deleteField(),
              qrSync: {
                habilitada: false,
                abrirQr: false,
                cerrarQr: true,
                sessionId: null,
                pantallasAutorizadas: qrSync?.pantallasAutorizadas || [],
                updatedAt: new Date(),
              },
            },
            { merge: true }
          );

          setQrVisible(false);

          return;
        }

        await setDoc(
          asistenciaDocRef,
          {
            habilitada: true,
            cursoId: selectedCursoId,
            cursoTitulo,
            modalidad: "presencial",
            metodo: "qr_static",
            sessionId: deleteField(),
            qrSync: {
              habilitada: false,
              abrirQr: false,
              cerrarQr: true,
              sessionId: null,
              pantallasAutorizadas: qrSync?.pantallasAutorizadas || [],
              updatedAt: new Date(),
            },
          },
          { merge: true }
        );

        setQrVisible(false);
        setSesionActual(null);

        return;
      }

      if (asistenciaConfig?.sessionId) {
        await cerrarSesionPorId(asistenciaConfig.sessionId);
      }

      await deshabilitarYBorrarTodasLasSesiones(
        qrSync?.pantallasAutorizadas || []
      );

      setQrVisible(false);
      setSesionActual(null);
    },
    [
      asistenciaConfig?.sessionId,
      asistenciaDocRef,
      cerrarSesionPorId,
      qrSync?.pantallasAutorizadas,
    ]
  );

  const abrirSesion = useCallback(
    async ({
      selectedCursoId,
      cursoTitulo,
      desdeLocal,
      hastaLocal,
      tipoRegistro = "ingreso",
      autoRefreshSeconds = 60,
    }) => {
      if (!selectedCursoId || !cursoTitulo || !desdeLocal || !hastaLocal) {
        toastRef.current?.show({
          severity: "warn",
          summary: "Datos incompletos",
          detail: "Seleccioná curso, horario desde y horario hasta.",
        });

        return;
      }

      const tipoNormalizado = normalizarTipoRegistro(tipoRegistro);
      const intervaloNormalizado = normalizarIntervalo(autoRefreshSeconds);

      const codigo = genCodigo();
      const qrPayload = crearQrPayload(codigo, tipoNormalizado);
      const desdeISO = toISO(desdeLocal);
      const hastaISO = toISO(hastaLocal);

      setLoadingSesion(true);

      try {
        if (asistenciaConfig?.sessionId) {
          await cerrarSesionPorId(asistenciaConfig.sessionId);
        }

        const ref = await addDoc(collection(db, "asistencia_sesiones"), {
          cursoId: selectedCursoId,
          cursoTitulo,
          estado: "abierta",
          desde: desdeISO,
          hasta: hastaISO,
          codigo,
          qrPayload,
          metodo: "qr_static",

          tipoRegistro: tipoNormalizado,
          tipoMarcacion: tipoNormalizado,
          marca: tipoNormalizado,

          autoRefreshSeconds: intervaloNormalizado,
          autoRefreshEnabled: true,

          /*
            Solo esta computadora renueva automáticamente.
            Las pantallas proyectadas escuchan el cambio, pero no renuevan.
          */
          autoRefreshOwnerDeviceId: deviceId || null,
          autoRefreshOwnerDeviceName: deviceName || "PC administradora",

          createdAt: new Date(),
          updatedAt: new Date(),
        });

        await setDoc(
          asistenciaDocRef,
          {
            habilitada: true,
            sessionId: ref.id,
            cursoId: selectedCursoId,
            cursoTitulo,
            modalidad: "presencial",
            metodo: "qr_static",
            tipoRegistro: tipoNormalizado,
            autoRefreshSeconds: intervaloNormalizado,
            qrSync: {
              habilitada: false,
              abrirQr: false,
              cerrarQr: true,
              sessionId: ref.id,
              pantallasAutorizadas: qrSync?.pantallasAutorizadas || [],
              updatedAt: new Date(),
            },
          },
          { merge: true }
        );

        toastRef.current?.show({
          severity: "success",
          summary: "Sesión abierta",
          detail: `QR de ${
            tipoNormalizado === "salida" ? "salida" : "ingreso"
          } · Código: ${codigo}`,
        });
      } catch (err) {
        console.error("Abrir sesión QR:", err);

        toastRef.current?.show({
          severity: "error",
          summary: "Error",
          detail: "No se pudo abrir la sesión.",
        });
      } finally {
        setLoadingSesion(false);
      }
    },
    [
      asistenciaConfig?.sessionId,
      asistenciaDocRef,
      cerrarSesionPorId,
      deviceId,
      deviceName,
      qrSync?.pantallasAutorizadas,
      toastRef,
    ]
  );

  const renovarCodigo = useCallback(
    async (options = {}) => {
      const silent = !!options?.silent;

      if (!sesionActual?.id) {
        if (!silent) {
          toastRef.current?.show({
            severity: "warn",
            summary: "Sin sesión",
            detail: "No hay una sesión QR activa.",
          });
        }

        return;
      }

      setRenovandoCodigo(true);

      try {
        const tipoRegistro = normalizarTipoRegistro(
          sesionActual?.tipoRegistro || sesionActual?.tipoMarcacion
        );

        const codigo = genCodigo();
        const qrPayload = crearQrPayload(codigo, tipoRegistro);

        await updateDoc(doc(db, "asistencia_sesiones", sesionActual.id), {
          codigo,
          qrPayload,
          tipoRegistro,
          tipoMarcacion: tipoRegistro,
          marca: tipoRegistro,
          updatedAt: new Date(),
        });

        await setDoc(
          asistenciaDocRef,
          {
            tipoRegistro,
            qrSync: {
              ...qrSync,
              sessionId: sesionActual.id,
              updatedAt: new Date(),
            },
          },
          { merge: true }
        );

        if (!silent) {
          toastRef.current?.show({
            severity: "success",
            summary: "Código renovado",
            detail: `Nuevo código: ${codigo}`,
          });
        }
      } catch (err) {
        console.error("Renovar código:", err);

        if (!silent) {
          toastRef.current?.show({
            severity: "error",
            summary: "Error",
            detail: "No se pudo renovar el código.",
          });
        }
      } finally {
        setRenovandoCodigo(false);
      }
    },
    [asistenciaDocRef, qrSync, sesionActual, toastRef]
  );

  /*
    Renovación automática.

    Regla fundamental:
    Solo renueva automáticamente la computadora que abrió la sesión.
    Las pantallas proyectadas solo muestran el QR actualizado.
  */
  useEffect(() => {
    if (!sesionActual?.id) return undefined;
    if (sesionActual?.estado !== "abierta") return undefined;
    if (!sesionActual?.autoRefreshEnabled) return undefined;

    const ownerDeviceId = sesionActual?.autoRefreshOwnerDeviceId;

    if (!ownerDeviceId || ownerDeviceId !== deviceId) {
      return undefined;
    }

    const seconds = normalizarIntervalo(sesionActual?.autoRefreshSeconds);

    const interval = setInterval(() => {
      renovarCodigo({ silent: true });
    }, seconds * 1000);

    return () => clearInterval(interval);
  }, [
    deviceId,
    renovarCodigo,
    sesionActual?.id,
    sesionActual?.estado,
    sesionActual?.autoRefreshEnabled,
    sesionActual?.autoRefreshSeconds,
    sesionActual?.autoRefreshOwnerDeviceId,
  ]);

  const cerrarSesion = useCallback(async () => {
    if (!sesionActual?.id) {
      toastRef.current?.show({
        severity: "warn",
        summary: "Sin sesión",
        detail: "No hay una sesión QR activa.",
      });

      return;
    }

    setLoadingSesion(true);

    try {
      await setDoc(
        asistenciaDocRef,
        {
          qrSync: {
            habilitada: false,
            abrirQr: false,
            cerrarQr: true,
            sessionId: sesionActual.id,
            pantallasAutorizadas: qrSync?.pantallasAutorizadas || [],
            updatedAt: new Date(),
          },
        },
        { merge: true }
      );

      await cerrarSesionPorId(sesionActual.id);

      await setDoc(
        asistenciaDocRef,
        {
          sessionId: deleteField(),
        },
        { merge: true }
      );

      setQrVisible(false);
      setSesionActual(null);

      toastRef.current?.show({
        severity: "success",
        summary: "Sesión cerrada",
        detail: "La sesión fue cerrada y las pantallas sincronizadas cerrarán el QR.",
      });
    } catch (err) {
      console.error("Cerrar sesión:", err);

      toastRef.current?.show({
        severity: "error",
        summary: "Error",
        detail: "No se pudo cerrar la sesión.",
      });
    } finally {
      setLoadingSesion(false);
    }
  }, [
    asistenciaDocRef,
    cerrarSesionPorId,
    qrSync?.pantallasAutorizadas,
    sesionActual?.id,
    toastRef,
  ]);

  const guardarSeleccionPantallas = useCallback(
    async (pantallasSeleccionadas = []) => {
      await setDoc(
        asistenciaDocRef,
        {
          qrSync: {
            ...qrSync,
            pantallasAutorizadas: pantallasSeleccionadas,
            updatedAt: new Date(),
          },
        },
        { merge: true }
      );

      toastRef.current?.show({
        severity: "success",
        summary: "Guardado",
        detail: "Se guardó la selección de pantallas.",
      });
    },
    [asistenciaDocRef, qrSync, toastRef]
  );

  const activarSincronizacionQR = useCallback(
    async (pantallasSeleccionadas = []) => {
      if (!sesionActual?.id || sesionActual?.estado !== "abierta") {
        toastRef.current?.show({
          severity: "warn",
          summary: "Sin sesión abierta",
          detail: "Primero abrí una sesión QR presencial.",
        });

        return;
      }

      if (!pantallasSeleccionadas.length) {
        toastRef.current?.show({
          severity: "warn",
          summary: "Sin pantallas",
          detail: "Seleccioná al menos una pantalla para sincronizar.",
        });

        return;
      }

      await setDoc(
        asistenciaDocRef,
        {
          qrSync: {
            habilitada: true,
            abrirQr: true,
            cerrarQr: false,
            sessionId: sesionActual.id,
            pantallasAutorizadas: pantallasSeleccionadas,
            updatedAt: new Date(),
          },
        },
        { merge: true }
      );

      toastRef.current?.show({
        severity: "success",
        summary: "Sincronización activa",
        detail: "Las pantallas seleccionadas mostrarán el QR automáticamente.",
      });
    },
    [asistenciaDocRef, sesionActual?.estado, sesionActual?.id, toastRef]
  );

  const cerrarQREnPantallas = useCallback(
    async (pantallasSeleccionadas = []) => {
      await setDoc(
        asistenciaDocRef,
        {
          qrSync: {
            habilitada: false,
            abrirQr: false,
            cerrarQr: true,
            sessionId: sesionActual?.id || asistenciaConfig?.sessionId || null,
            pantallasAutorizadas: pantallasSeleccionadas,
            updatedAt: new Date(),
          },
        },
        { merge: true }
      );

      toastRef.current?.show({
        severity: "success",
        summary: "QR cerrado",
        detail: "Se envió la orden de cierre a las pantallas seleccionadas.",
      });
    },
    [asistenciaConfig?.sessionId, asistenciaDocRef, sesionActual?.id, toastRef]
  );

  const copiarCodigo = useCallback(async () => {
    try {
      if (!sesionActual?.codigo) {
        toastRef.current?.show({
          severity: "warn",
          summary: "Código",
          detail: "No hay código disponible.",
        });

        return;
      }

      await navigator.clipboard.writeText(sesionActual.codigo);

      toastRef.current?.show({
        severity: "success",
        summary: "Copiado",
        detail: "Código copiado al portapapeles.",
      });
    } catch {
      toastRef.current?.show({
        severity: "error",
        summary: "Error",
        detail: "No se pudo copiar el código.",
      });
    }
  }, [sesionActual?.codigo, toastRef]);

  const downloadQRAsPNG = useCallback(
    async (scale = 4) => {
      setDownloadingQR(true);

      try {
        const svg = qrContainerRef.current?.querySelector("svg");

        if (!svg) {
          throw new Error("No se encontró el SVG del QR.");
        }

        const xml = new XMLSerializer().serializeToString(svg);
        const svgBlob = new Blob([xml], {
          type: "image/svg+xml;charset=utf-8",
        });

        const url = URL.createObjectURL(svgBlob);

        await new Promise((resolve, reject) => {
          const img = new Image();
          const rect = svg.getBoundingClientRect();
          const base = Math.max(rect.width || 460, rect.height || 460);

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

            const safeCourse = (sesionActual?.cursoTitulo || "curso").replace(
              /[^\w-]+/g,
              "_"
            );

            const safeCode = (sesionActual?.codigo || "QR").replace(
              /[^\w-]+/g,
              "_"
            );

            a.download = `${safeCourse}-${safeCode}.png`;
            a.href = pngUrl;

            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);

            resolve();
          };

          img.onerror = () => {
            URL.revokeObjectURL(url);
            reject(new Error("No se pudo generar la imagen del QR."));
          };

          img.src = url;
        });

        toastRef.current?.show({
          severity: "success",
          summary: "Descargado",
          detail: "QR descargado como PNG.",
        });
      } catch (err) {
        console.error("Descargar QR:", err);

        toastRef.current?.show({
          severity: "error",
          summary: "Error",
          detail: "No se pudo descargar el QR.",
        });
      } finally {
        setDownloadingQR(false);
      }
    },
    [sesionActual?.codigo, sesionActual?.cursoTitulo, toastRef]
  );

  return {
    deviceId,
    deviceName,
    asistenciaConfig,
    sesionActual,
    pantallasRegistradas,
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
  };
}