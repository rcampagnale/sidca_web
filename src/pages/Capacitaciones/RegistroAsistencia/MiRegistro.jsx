// src/pages/Capacitaciones/RegistroAsistencia/MiRegistro.jsx
import React, { useEffect, useMemo, useState, useRef } from "react";
import { useSelector } from "react-redux";
import { useHistory } from "react-router-dom";
import {
  getFirestore,
  getDoc,
  doc,
  serverTimestamp,
  collection,
  query,
  where,
  limit,
  getDocs,
  addDoc,
  setDoc,
} from "firebase/firestore";
import { InputText } from "primereact/inputtext";
import { Dropdown } from "primereact/dropdown";
import { Button } from "primereact/button";
import { Card } from "primereact/card";
import { Message } from "primereact/message";
import { Dialog } from "primereact/dialog";
import { QrReader } from "react-qr-reader";
import styles from "./miRegistro.module.css";

/* =========================
   Helpers de fecha y formato
   ========================= */
const pad2 = (n) => String(n).padStart(2, "0");
const toDisplay = (d) =>
  `${pad2(d.getDate())}/${pad2(d.getMonth() + 1)}/${d.getFullYear()}`;
const parseDisplay = (s) => {
  if (!s) return null;
  const [dd, mm, yyyy] = s.split("/").map((n) => parseInt(n, 10));
  if (!Number.isFinite(dd) || !Number.isFinite(mm) || !Number.isFinite(yyyy))
    return null;
  return new Date(yyyy, mm - 1, dd);
};
const cap = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);
const nowIsBetween = (sinceISO, untilISO) => {
  const now = new Date();
  return now >= new Date(sinceISO) && now <= new Date(untilISO);
};

// Normaliza “Afiliado”
const nombreAfiliado = (apellido, nombre) => {
  const ap = (apellido || "").trim();
  const no = (nombre || "").trim();
  const combinado = ap && no ? `${ap}, ${no}` : ap || no;
  return combinado.replace(/\s*,\s*/g, ", ").replace(/\s+/g, " ").trim();
};

// Toma el primer valor disponible
const pick = (obj, keys) => {
  for (const k of keys) {
    const v = obj?.[k];
    if (v !== undefined && v !== null && String(v).trim() !== "")
      return String(v).trim();
  }
  return "";
};

// Parseo de URL QR: sidca://asistencia?s=auto&c=ABCD-EF12&v=1
const parseAsistenciaUrl = (urlStr) => {
  const raw = String(urlStr || "").trim();
  const qIndex = raw.indexOf("?");
  if (qIndex === -1) throw new Error("QR sin query");
  const queryStr = raw.slice(qIndex + 1);
  const params = new URLSearchParams(queryStr);
  const s = params.get("s") || "auto";
  const c = params.get("c") || "";
  if (!s || !c) throw new Error("Faltan parámetros en el QR");
  return { sessionParam: s, codeParam: c };
};

const NIVELES = [
  { label: "Nivel Inicial", value: "Nivel Inicial" },
  { label: "Nivel Primario", value: "Nivel Primario" },
  { label: "Nivel Secundario", value: "Nivel Secundario" },
  { label: "Nivel Superior", value: "Nivel Superior" },
  { label: "Educación Técnica (Técnica/Agro/FP)", value: "Educación Técnica (Técnica/Agro/FP)" },
];

export default function MiRegistro() {
  const db = getFirestore();
  const history = useHistory();

  const user = useSelector((s) => s.user);
  const docId = user?.docId || localStorage.getItem("sidca_user_docId") || "";
  const dni = user?.dni || localStorage.getItem("sidca_user_dni") || "";

  // Perfil
  const [perfil, setPerfil] = useState({
    apellido: "",
    nombre: "",
    dni: "",
    departamento: "",
  });
  const [cargandoPerfil, setCargandoPerfil] = useState(true);
  const [perfilNoEncontrado, setPerfilNoEncontrado] = useState(false);

  // Botón global y config de asistencia (como en la app)
  const [botonHabilitado, setBotonHabilitado] = useState(false);
  const [cargandoBoton, setCargandoBoton] = useState(true);

  const [selectedCourse, setSelectedCourse] = useState(""); // cursoTitulo desde cod/asistencia
  const [modalidad, setModalidad] = useState("virtual");     // "virtual" | "presencial"
  const [metodo, setMetodo] = useState(undefined);           // p.ej. "qr_static"
  const [sessionIdCfg, setSessionIdCfg] = useState(undefined);
  const [habilitadaCfg, setHabilitadaCfg] = useState(false);
  const [cargandoCfg, setCargandoCfg] = useState(true);

  // Selecciones
  const [nivel, setNivel] = useState("");

  // Asistencias
  const [asistencias, setAsistencias] = useState([]);
  const [cargandoAsistencias, setCargandoAsistencias] = useState(false);
  const [asisError, setAsisError] = useState("");

  // QR + Fallback manual
  const [qrVisible, setQrVisible] = useState(false);
  const scannedRef = useRef(false); // evita dobles lecturas
  const [codeInput, setCodeInput] = useState(""); // 👈 NUEVO: input manual
  const [manualLoading, setManualLoading] = useState(false);

  const hoy = useMemo(() => new Date(), []);
  const fechaDisplay = toDisplay(hoy);

  /* =========================
     Cargar Perfil (usuarios + fallback nuevoAfiliado)
     ========================= */
  useEffect(() => {
    (async () => {
      try {
        setCargandoPerfil(true);
        setPerfilNoEncontrado(false);
        let data = null;

        if (docId) {
          const ref = doc(db, "usuarios", docId);
          const snap = await getDoc(ref);
          if (snap.exists()) data = snap.data();
        }
        if (!data && dni) {
          const qUsr = query(
            collection(db, "usuarios"),
            where("dni", "==", dni),
            limit(1)
          );
          const snap = await getDocs(qUsr);
          if (!snap.empty) data = snap.docs[0].data();
        }
        if (!data) {
          setPerfilNoEncontrado(true);
          setPerfil({ apellido: "", nombre: "", dni: dni || "", departamento: "" });
          return;
        }
        let basePerfil = {
          apellido: data.apellido || "",
          nombre: data.nombre || "",
          dni: data.dni || dni || "",
          departamento: pick(data, ["departamento", "depto", "departamentoNombre"]),
        };
        if (!basePerfil.departamento && basePerfil.dni) {
          const qNA = query(
            collection(db, "nuevoAfiliado"),
            where("dni", "==", basePerfil.dni),
            limit(1)
          );
          const sNA = await getDocs(qNA);
          if (!sNA.empty) {
            const dNA = sNA.docs[0].data();
            const depFallback = pick(dNA, ["departamento", "depto", "departamentoNombre"]);
            if (depFallback) basePerfil.departamento = depFallback;
          }
        }
        setPerfil(basePerfil);
      } catch (e) {
        console.error("Error cargando perfil:", e);
        setPerfilNoEncontrado(true);
      } finally {
        setCargandoPerfil(false);
      }
    })();
  }, [db, docId, dni]);

  /* =========================
     Botón global (cod/boton.cargar)
     ========================= */
  useEffect(() => {
    (async () => {
      try {
        setCargandoBoton(true);
        const ref = doc(db, "cod", "boton");
        const snap = await getDoc(ref);
        setBotonHabilitado(
          snap.exists() && String(snap.data()?.cargar).trim().toLowerCase() === "si"
        );
      } catch (e) {
        console.error("Error consultando 'cod/boton.cargar':", e);
        setBotonHabilitado(false);
      } finally {
        setCargandoBoton(false);
      }
    })();
  }, [db]);

  /* =========================
     Config de asistencia (cod/asistencia)
     ========================= */
  useEffect(() => {
    (async () => {
      try {
        setCargandoCfg(true);
        const ref = doc(db, "cod", "asistencia");
        const snap = await getDoc(ref);
        if (snap.exists()) {
          const data = snap.data() || {};
          setSelectedCourse(data?.cursoTitulo || "");
          setModalidad(data?.modalidad || "virtual"); // "virtual" | "presencial"
          setMetodo(data?.metodo);
          setSessionIdCfg(data?.sessionId);
          setHabilitadaCfg(Boolean(data?.habilitada));
        } else {
          setSelectedCourse("");
          setModalidad("virtual");
          setMetodo(undefined);
          setSessionIdCfg(undefined);
          setHabilitadaCfg(false);
        }
      } catch (e) {
        console.error("Error leyendo cod/asistencia:", e);
        setSelectedCourse("");
        setModalidad("virtual");
        setMetodo(undefined);
        setSessionIdCfg(undefined);
        setHabilitadaCfg(false);
      } finally {
        setCargandoCfg(false);
      }
    })();
  }, [db]);

  /* =========================
     Cargar asistencias por DNI (historial)
     ========================= */
  const fetchAsistencias = async (dniValue) => {
    if (!dniValue) return;
    try {
      setCargandoAsistencias(true);
      setAsisError("");
      const qA = query(collection(db, "asistencia"), where("dni", "==", dniValue));
      const snap = await getDocs(qA);
      const items = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      items.sort((a, b) => {
        const da =
          a?.createdAt?.seconds != null
            ? new Date(a.createdAt.seconds * 1000)
            : parseDisplay(a.fecha);
        const dbb =
          b?.createdAt?.seconds != null
            ? new Date(b.createdAt.seconds * 1000)
            : parseDisplay(b.fecha);
        return (dbb?.getTime() || 0) - (da?.getTime() || 0);
      });
      setAsistencias(items);
    } catch (e) {
      console.error("Error cargando asistencias:", e);
      setAsisError("No se pudieron cargar tus asistencias.");
      setAsistencias([]);
    } finally {
      setCargandoAsistencias(false);
    }
  };
  useEffect(() => {
    if (perfil?.dni) fetchAsistencias(perfil.dni);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [perfil?.dni]);

  /* =========================
     Acciones: Registrar (Virtual)
     ========================= */
  const registrarVirtual = async () => {
    if (!perfil?.dni) return alert("No se encontró el DNI del usuario.");
    if (perfilNoEncontrado) return alert("No se encontró el usuario en 'usuarios'.");
    if (!nivel) return alert("Seleccione un nivel educativo.");
    if (!botonHabilitado) return alert("El registro de asistencia está deshabilitado.");
    if (!habilitadaCfg) return alert("La asistencia no está habilitada por el organizador.");
    if (!selectedCourse) return alert("No hay curso habilitado actualmente.");
    if (modalidad !== "virtual") return alert("El curso habilitado no es virtual.");

    try {
      // Evita duplicados: misma fecha + curso
      const qDup = query(
        collection(db, "asistencia"),
        where("dni", "==", perfil.dni),
        where("fecha", "==", fechaDisplay),
        where("curso", "==", selectedCourse)
      );
      const sDup = await getDocs(qDup);
      if (!sDup.empty) return alert("Ya registraste asistencia para este curso hoy.");

      await addDoc(collection(db, "asistencia"), {
        apellido: perfil.apellido || "Sin apellido",
        nombre: perfil.nombre || "Sin nombre",
        dni: perfil.dni || "Sin DNI",
        departamento: perfil.departamento || "Sin departamento",
        nivelEducativo: nivel,
        curso: selectedCourse,
        fecha: fechaDisplay,
        presencial: false,
        modalidad: "virtual",
        createdAt: serverTimestamp(),
      });

      alert("Asistencia registrada con éxito.");
      setNivel("");
      fetchAsistencias(perfil.dni);
    } catch (e) {
      console.error(e);
      alert("No se pudo registrar. Intente nuevamente.");
    }
  };

  /* =========================
     Acciones: Registrar (Presencial por QR + manual)
     ========================= */
  const abrirQR = () => {
    if (!nivel) return alert("Seleccione un nivel educativo antes de continuar.");
    if (!botonHabilitado || !habilitadaCfg)
      return alert("Asistencia deshabilitada por el organizador.");
    if (!selectedCourse) return alert("No hay curso habilitado actualmente.");
    if (modalidad !== "presencial" || metodo !== "qr_static")
      return alert("Este curso no utiliza registro por QR.");
    scannedRef.current = false;
    setCodeInput("");
    setQrVisible(true);
  };

  // Reutilizamos una función común para QR y manual
  const validarYRegistrarPresencial = async (sessionId, codeParam) => {
    // Validación de precondiciones
    if (!perfil?.dni) return alert("No se encontró el DNI del usuario.");
    if (perfilNoEncontrado) return alert("No se encontró el usuario en 'usuarios'.");
    if (!nivel) return alert("Seleccione un nivel educativo.");
    if (!botonHabilitado) return alert("El registro de asistencia está deshabilitado.");
    if (!habilitadaCfg) return alert("La asistencia no está habilitada por el organizador.");
    if (!selectedCourse) return alert("No hay curso habilitado actualmente.");
    if (modalidad !== "presencial") return alert("El curso habilitado no es presencial.");
    if (!sessionId) return alert("No se pudo resolver la sesión activa.");
    if (!codeParam) return alert("Debe ingresar un código válido.");

    // Validar sesión y ventana
    const sesRef = doc(db, "asistencia_sesiones", sessionId);
    const sesSnap = await getDoc(sesRef);
    if (!sesSnap.exists()) return alert("Sesión de asistencia no encontrada.");
    const s = sesSnap.data();
    if (s.estado !== "abierta") return alert("Sesión cerrada o vencida.");
    if (!nowIsBetween(s.desde, s.hasta))
      return alert("Fuera de la ventana horaria de asistencia.");
    if ((s.codigo || "").trim().toUpperCase() !== codeParam.trim().toUpperCase())
      return alert("Código inválido o no vigente.");

    // Idempotente: sessionId + "_" + DNI
    const idUser = perfil?.dni || "sin_dni";
    const idDoc = `${sessionId}_${idUser}`;
    const ref = doc(db, "asistencia", idDoc);
    const ex = await getDoc(ref);
    if (ex.exists()) {
      alert("Asistencia ya registrada.");
      return fetchAsistencias(perfil.dni);
    }
    await setDoc(ref, {
      sessionId,
      uid: idUser,
      dni: perfil?.dni ?? null,
      apellido: perfil?.apellido || "Sin apellido",
      nombre: perfil?.nombre || "Sin nombre",
      departamento: perfil?.departamento || "Sin departamento",
      nivelEducativo: nivel,
      curso: selectedCourse,
      cursoTitulo: selectedCourse,
      codigoUsado: codeParam,
      fecha: fechaDisplay,
      presencial: true,
      modalidad: "presencial",
      createdAt: serverTimestamp(),
    });

    alert("¡Asistencia presencial registrada con éxito!");
    fetchAsistencias(perfil.dni);
  };

  // Si el QR entrega URL => parseamos. Si es texto sin query => lo tratamos como CÓDIGO.
  const onQrResult = async (result, error) => {
    if (error) return; // ignoramos frames sin detección
    if (!result || scannedRef.current) return;

    const text = result?.text || result?.getText?.() || "";
    if (!text) return;

    scannedRef.current = true;
    setQrVisible(false);

    try {
      let sessionId = null;
      let codeParam = "";

      if (text.includes("?")) {
        // URL QR
        const { sessionParam, codeParam: cp } = parseAsistenciaUrl(text);
        codeParam = cp?.trim();
        sessionId = sessionParam === "auto" ? sessionIdCfg : sessionParam;
      } else {
        // Solo código
        codeParam = text.trim();
        sessionId = sessionIdCfg || null;
      }

      if (!sessionId) {
        // Resolver por código si no tenemos sessionId en config
        const qSes = query(
          collection(db, "asistencia_sesiones"),
          where("codigo", "==", codeParam),
          limit(1)
        );
        const sSnap = await getDocs(qSes);
        if (sSnap.empty) return alert("No se encontró una sesión para ese código.");
        sessionId = sSnap.docs[0].id;
      }

      await validarYRegistrarPresencial(sessionId, codeParam);
    } catch (e) {
      console.error("QR inválido o error en registro:", e);
      alert("QR inválido.");
    }
  };

  // 👇 NUEVO: validar código manual (acepta URL completa o solo código)
  const onManualCodeSubmit = async () => {
    if (!codeInput.trim()) return alert("Ingresá el código del QR.");
    try {
      setManualLoading(true);
      let sessionId = null;
      let codeParam = "";

      const raw = codeInput.trim();
      if (raw.includes("?")) {
        // URL QR completa
        const { sessionParam, codeParam: cp } = parseAsistenciaUrl(raw);
        codeParam = cp?.trim();
        sessionId = sessionParam === "auto" ? sessionIdCfg : sessionParam;
      } else {
        // Código puro
        codeParam = raw;
        sessionId = sessionIdCfg || null;
      }

      if (!sessionId) {
        // Resolver por código si no hay sessionId en config
        const qSes = query(
          collection(db, "asistencia_sesiones"),
          where("codigo", "==", codeParam),
          limit(1)
        );
        const sSnap = await getDocs(qSes);
        if (sSnap.empty) {
          setManualLoading(false);
          return alert("No se encontró una sesión para ese código.");
        }
        sessionId = sSnap.docs[0].id;
      }

      await validarYRegistrarPresencial(sessionId, codeParam);
      setQrVisible(false);
      setCodeInput("");
    } catch (e) {
      console.error("Error al validar código manual:", e);
      alert("Código inválido.");
    } finally {
      setManualLoading(false);
    }
  };

  /* =========================
     Flags de habilitación (idénticos a la app)
     ========================= */
  const levelSelected = !!nivel;
  const isVirtualActive =
    botonHabilitado && habilitadaCfg && !!selectedCourse && modalidad === "virtual" && levelSelected;
  const isPresencialQRActive =
    botonHabilitado &&
    habilitadaCfg &&
    !!selectedCourse &&
    modalidad === "presencial" &&
    metodo === "qr_static" &&
    levelSelected;

  /* =========================
     UI
     ========================= */
  const afiliadoLabel = useMemo(
    () => nombreAfiliado(perfil.apellido, perfil.nombre),
    [perfil.apellido, perfil.nombre]
  );
  const volver = () => history.push("/capacitaciones");

  return (
    <div className={styles.page}>
      <h2 className={styles.title}>Mi registro de asistencia</h2>

      {/* Perfil */}
      <Card className={styles.card}>
        <div className={`${styles.formGrid} ${styles.readonly}`}>
          <div className={`${styles.field} ${styles.colSpan2}`}>
            <label className={styles.label} htmlFor="afiliado">Afiliado</label>
            <InputText id="afiliado" value={afiliadoLabel} disabled />
          </div>
          <div className={styles.field}>
            <label className={styles.label} htmlFor="dni">DNI</label>
            <InputText id="dni" value={perfil.dni} disabled />
          </div>
          <div className={styles.field}>
            <label className={styles.label} htmlFor="depto">Departamento</label>
            <InputText id="depto" value={perfil.departamento} disabled />
          </div>
        </div>
        {cargandoPerfil && <Message severity="info" text="Cargando perfil..." />}
        {!cargandoPerfil && perfilNoEncontrado && (
          <Message severity="warn" text="No se encontró el usuario con el DNI provisto." />
        )}
      </Card>

      {/* Selección + curso habilitado (desde cod/asistencia) */}
      <Card className={styles.card}>
        <div className={styles.formGrid}>
          <div className={styles.field}>
            <label className={styles.label} htmlFor="nivel">Nivel Educativo</label>
            <Dropdown
              id="nivel"
              value={nivel}
              onChange={(e) => setNivel(e.value)}
              options={NIVELES}
              optionLabel="label"
              optionValue="value"
              placeholder="Seleccione un nivel educativo"
              className="w-full"
              disabled={perfilNoEncontrado}
            />
          </div>

          <div className={styles.field}>
            <label className={styles.label}>Curso habilitado</label>
            <div className={styles.asisItem}>
              <div className={styles.asisItemTitle}>
                {cargandoCfg ? "Cargando..." : (selectedCourse || "(no hay curso habilitado)")}
              </div>
              <div className={styles.asisItemMeta}>
                <span className={`${styles.chip} ${habilitadaCfg ? styles.chipOk : styles.chipWarn}`}>
                  {habilitadaCfg ? "Habilitado" : "Inactivo"}
                </span>
                <span className={`${styles.chip} ${styles.chipMode}`} style={{ marginLeft: 8 }}>
                  Modalidad: {cap(modalidad)}
                </span>
              </div>
              <div className={styles.date}>
                <small>Fecha: {fechaDisplay}</small>
              </div>
            </div>
          </div>
        </div>

        <div className={styles.actions}>
          <Button
            type="button"
            label="Regresar a capacitaciones"
            icon="pi pi-arrow-left"
            className={`p-button-outlined p-button-secondary ${styles.btnBack}`}
            onClick={volver}
          />

          {modalidad === "virtual" ? (
            <Button
              label={cargandoBoton ? "Verificando..." : "Registrar asistencia virtual"}
              onClick={registrarVirtual}
              loading={cargandoBoton || cargandoCfg}
              disabled={!isVirtualActive || cargandoCfg || cargandoBoton}
              className={styles.btnPrimary}
            />
          ) : (
            <Button
              label="Registrar asistencia Presencial QR"
              onClick={abrirQR}
              disabled={!isPresencialQRActive || cargandoCfg || cargandoBoton}
              className={styles.btnPrimary}
            />
          )}
        </div>
      </Card>

      {/* Asistencias cargadas */}
      <Card className={styles.card}>
        <h3 className={styles.sectionTitle}>Asistencias cargadas</h3>
        {cargandoAsistencias && <Message severity="info" text="Cargando asistencias..." />}
        {asisError && <Message severity="error" text={asisError} />}

        {!cargandoAsistencias && !asisError && asistencias.length === 0 && (
          <Message severity="warn" text="Aún no registraste asistencias." />
        )}

        {!cargandoAsistencias && asistencias.length > 0 && (
          <div className={styles.asisList}>
            {Object.entries(
              asistencias.reduce((acc, a) => {
                const curso = a.curso || "(Sin curso)";
                if (!acc[curso]) acc[curso] = [];
                acc[curso].push({ fecha: a.fecha || "-", modalidad: a.modalidad || "virtual" });
                return acc;
              }, {})
            ).map(([curso, items]) => (
              <div key={curso} className={styles.asisItem}>
                <div className={styles.asisItemTitle}>
                  Curso: <span className={styles.asisValue}>{curso}</span>
                </div>
                <div className={styles.asisItemMeta}>
                  Fechas:
                  <ul>
                    {items.map((it, i) => (
                      <li key={i}>{it.fecha} — Modalidad: {cap(it.modalidad)}</li>
                    ))}
                  </ul>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Modal QR + Fallback Manual */}
      <Dialog
        header="Escanear código QR"
        visible={qrVisible}
        style={{ width: "min(720px, 95vw)" }}
        modal
        onHide={() => setQrVisible(false)}
      >
        <div style={{ display: "grid", gap: 12 }}>
          <Message severity="info" text="Apuntá la cámara al QR entregado por la organización o ingresá el código manualmente." />
          <div style={{ width: "100%", aspectRatio: "1 / 1", background: "#000" }}>
            <QrReader
              constraints={{ facingMode: "environment" }}
              onResult={onQrResult}
              videoStyle={{ width: "100%", height: "100%", objectFit: "cover" }}
            />
          </div>

          {/* 👇 NUEVO: ingreso manual */}
          <div className={styles.formGrid}>
            <div className={styles.field}>
              <label className={styles.label} htmlFor="codigoManual">
                Código del QR (o pegá la URL completa)
              </label>
              <InputText
                id="codigoManual"
                value={codeInput}
                onChange={(e) => setCodeInput(e.target.value)}
                placeholder="Ej: ABCD-1234 o sidca://asistencia?s=auto&c=ABCD-1234"
              />
            </div>
          </div>
          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
            <Button
              label="Validar código manual"
              onClick={onManualCodeSubmit}
              loading={manualLoading}
              className={styles.btnPrimary}
            />
            <Button label="Cancelar" className="p-button-text" onClick={() => setQrVisible(false)} />
          </div>
        </div>
      </Dialog>
    </div>
  );
}

