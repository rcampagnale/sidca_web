// src/pages/Credencial/Credencial.js
import React, {
  useCallback,
  useEffect,
  useRef,
  useState,
  useMemo,
} from "react";
import { useSelector } from "react-redux";
import { Toast } from "primereact/toast";
import { ProgressSpinner } from "primereact/progressspinner";
import { Button } from "primereact/button";
import { Dialog } from "primereact/dialog";
import {
  collection,
  getDocs,
  query,
  where,
  doc,
  getDoc,
  limit,
} from "firebase/firestore";
import { db } from "../../firebase/firebase-config";
import styles from "./credencial.module.css";
import credencialImg from "../../assets/credencial/credencial.jpg";

/* =========================
   Utilidades compartidas
   ========================= */

const pick = (obj, keys) => {
  for (const k of keys) {
    const v = obj?.[k];
    if (v !== undefined && v !== null && String(v).trim() !== "") {
      return String(v).trim();
    }
  }
  return "";
};

const nombreAfiliado = (apellido, nombre) => {
  const ap = (apellido || "").trim();
  const no = (nombre || "").trim();
  const combinado = ap && no ? `${ap}, ${no}` : ap || no;
  return combinado
    .replace(/\s*,\s*/g, ", ")
    .replace(/\s+/g, " ")
    .trim();
};

const getByDni = async (colRef, dniRaw) => {
  const valuesToTry = [];
  const rawStr = String(dniRaw ?? "").trim();
  if (rawStr) valuesToTry.push(rawStr);
  const onlyDigits = rawStr.replace(/[^\d]/g, "");
  if (onlyDigits && onlyDigits !== rawStr) valuesToTry.push(onlyDigits);
  const dniNum = Number(onlyDigits || rawStr);
  if (!Number.isNaN(dniNum)) valuesToTry.push(dniNum);

  const fields = ["dni", "DNI"];
  for (const field of fields) {
    for (const v of valuesToTry) {
      const qs = await getDocs(query(colRef, where(field, "==", v), limit(1)));
      if (!qs.empty) return { id: qs.docs[0].id, ...qs.docs[0].data() };
    }
  }
  return null;
};

export default function Credencial() {
  const toastRef = useRef(null);
  const user = useSelector((s) => s.user);

  const [loading, setLoading] = useState(true);
  const [perfil, setPerfil] = useState(null);
  const [showWhereVote, setShowWhereVote] = useState(false);

  // 🗳 Configuración de voto en credencial (cod/votoCredencial)
  const [votoConfig, setVotoConfig] = useState({
    habilitado: false,
    link: "",
    texto: "",
  });

  const resolveIds = useCallback(() => {
    const docIdFromStore = user?.docId || "";
    const dniFromStore = user?.dni || "";

    const docIdLS =
      docIdFromStore || localStorage.getItem("sidca_user_docId") || "";
    const dniLS = dniFromStore || localStorage.getItem("sidca_user_dni") || "";

    let dniQS = "";
    try {
      const qs = new URLSearchParams(window.location.search);
      dniQS = qs.get("dni") || "";
    } catch {}

    return {
      docId: String(docIdLS || "").trim(),
      dni: String(dniQS || dniLS || "").trim(),
    };
  }, [user]);

  const loadPerfil = useCallback(async () => {
    setLoading(true);
    try {
      const { docId, dni } = resolveIds();

      if (!docId && !dni) {
        setPerfil(null);
        toastRef.current?.show({
          severity: "warn",
          summary: "Credencial",
          detail:
            "No se encontró el DNI del usuario actual. Inicie sesión para ver su credencial.",
          life: 4500,
        });
        return;
      }

      let data = null;

      if (docId) {
        const ref = doc(db, "usuarios", docId);
        const snap = await getDoc(ref);
        if (snap.exists()) data = snap.data();
      }

      if (!data && dni) {
        const usuariosRef = collection(db, "usuarios");
        const foundUsr = await getByDni(usuariosRef, dni);
        if (foundUsr) data = foundUsr;
      }

      let depto = pick(data, ["departamento", "depto", "departamentoNombre"]);
      let mesa = pick(data, ["mesaNro", "mesa", "MesaNro"]);
      let lugarVotacion = pick(data, [
        "lugarVotacion",
        "lugar_de_votacion",
        "lugarVotacionNombre",
      ]);

      if (!data && dni) {
        const nuevoAfiliadoRef = collection(db, "nuevoAfiliado");
        const foundNA = await getByDni(nuevoAfiliadoRef, dni);
        if (foundNA) {
          data = foundNA;

          if (!depto) {
            depto = pick(foundNA, [
              "departamento",
              "depto",
              "departamentoNombre",
            ]);
          }
          if (!mesa) {
            mesa = pick(foundNA, ["mesaNro", "mesa", "MesaNro"]);
          }
          if (!lugarVotacion) {
            lugarVotacion = pick(foundNA, [
              "lugarVotacion",
              "lugar_de_votacion",
              "lugarVotacionNombre",
            ]);
          }
        }
      } else if (data && dni && (!depto || !mesa || !lugarVotacion)) {
        const nuevoAfiliadoRef = collection(db, "nuevoAfiliado");
        const foundNA = await getByDni(nuevoAfiliadoRef, dni);
        if (foundNA) {
          if (!depto) {
            const depFallback = pick(foundNA, [
              "departamento",
              "depto",
              "departamentoNombre",
            ]);
            if (depFallback) depto = depFallback;
          }
          if (!mesa) {
            const mesaFallback = pick(foundNA, ["mesaNro", "mesa", "MesaNro"]);
            if (mesaFallback) mesa = mesaFallback;
          }
          if (!lugarVotacion) {
            const lugarFallback = pick(foundNA, [
              "lugarVotacion",
              "lugar_de_votacion",
              "lugarVotacionNombre",
            ]);
            if (lugarFallback) lugarVotacion = lugarFallback;
          }
        }
      }

      if (!data) {
        setPerfil(null);
        toastRef.current?.show({
          severity: "info",
          summary: "Sin resultados",
          detail: `No se encontró una credencial para el DNI ${dni}.`,
          life: 4000,
        });
        return;
      }

      const dniFinal = data?.dni ?? dni ?? "";

      const perfilBase = {
        apellido: data?.apellido || "",
        nombre: data?.nombre || "",
        dni: String(dniFinal),
        departamento: depto || "Departamento",
        mesa: mesa || "",
        lugarVotacion: lugarVotacion || "",
      };

      setPerfil(perfilBase);
    } catch (e) {
      console.error("[Credencial] loadPerfil error:", e);
      setPerfil(null);
      toastRef.current?.show({
        severity: "error",
        summary: "Error",
        detail: e?.message || "No se pudo cargar la credencial.",
        life: 5000,
      });
    } finally {
      setLoading(false);
    }
  }, [resolveIds]);

  // 🗳 Cargar configuración de voto (cod/votoCredencial)
  useEffect(() => {
    const loadVotoConfig = async () => {
      try {
        const snap = await getDoc(doc(db, "cod", "votoCredencial"));
        if (snap.exists()) {
          const d = snap.data() || {};
          setVotoConfig({
            habilitado: !!d.habilitado,
            link: typeof d.link === "string" ? d.link : "",
            texto: typeof d.texto === "string" ? d.texto : "",
          });
        } else {
          setVotoConfig({
            habilitado: false,
            link: "",
            texto: "",
          });
        }
      } catch (err) {
        console.error("[Credencial] Error cargando votoCredencial:", err);
        setVotoConfig((prev) => ({ ...prev, habilitado: false }));
      }
    };

    loadVotoConfig();
  }, []);

  useEffect(() => {
    loadPerfil();
  }, [loadPerfil]);

  const displayName = useMemo(
    () =>
      perfil && (perfil.apellido || perfil.nombre)
        ? nombreAfiliado(perfil.apellido, perfil.nombre)
        : "APELLIDO NOMBRE",
    [perfil]
  );

  const displayDni = perfil?.dni || "xxxxxxx";
  const displayDepto = perfil?.departamento || "Departamento";
  const displayMesa = perfil?.mesa || "Sin dato";
  const displayLugarVotacion =
    perfil?.lugarVotacion || "Sin información de lugar";

  // Label del botón: usa texto opcional si está configurado, si no, usa el default
  const whereVoteLabel = useMemo(() => {
    const txt = (votoConfig.texto || "").trim();
    return txt || "¿Dónde voto?";
  }, [votoConfig.texto]);

  return (
    <div className={styles.container}>
      <Toast ref={toastRef} />

      <div className={styles.titleRow}>
        <h1 className={styles.title}>Mi credencial</h1>
      </div>

      {loading && (
        <div className={styles.loader}>
          <ProgressSpinner />
          <p className={styles.muted}>Cargando credencial...</p>
        </div>
      )}

      <div className={styles.card}>
        <div className={styles.credencialPreview}>
          {/* Título vertical */}
          <div className={`${styles.infoOverlay} ${styles.infoTitleOverlay}`}>
            <div className={styles.infoTitle}>Credencial de Afiliado</div>
          </div>

          {/* Datos: Departamento / DNI / Afiliado */}
          <div
            className={`${styles.infoOverlay} ${styles.infoDataOverlay} ${styles.overlayLeft}`}
          >
            <div className={styles.infoUnit}>
              <span className={styles.infoLabel}>Departamento:</span>
              <span className={styles.infoValue}>{displayDepto}</span>
            </div>

            <div className={styles.infoUnit}>
              <span className={styles.infoLabel}>DNI:</span>
              <span className={styles.infoValue}>{displayDni}</span>
            </div>

            <div className={styles.infoUnit}>
              <span className={styles.infoLabel}>Afiliado:</span>
              <span className={styles.infoValue}>{displayName}</span>
            </div>
          </div>

          {/* 👉 Botón "Dónde voto" SOLO si está habilitado en cod/votoCredencial */}
          {votoConfig.habilitado && (
            <div className={`${styles.infoOverlay} ${styles.whereVoteOverlay}`}>
              <Button
                label={whereVoteLabel}
                icon="pi pi-map-marker"
                className={`${styles.whereVoteButton} p-button-sm`}
                onClick={() => setShowWhereVote(true)}
                disabled={!perfil}
              />
            </div>
          )}

          <img
            src={credencialImg}
            alt="Credencial"
            className={styles.credencialImg}
            loading="lazy"
          />
        </div>
      </div>

      <p className={styles.helper}>
        Si algún dato no coincide, comunícate con Soporte Técnico.
      </p>

      <Dialog
        header="¿Dónde voto?"
        visible={showWhereVote}
        style={{ width: "90%", maxWidth: "420px" }}
        modal
        onHide={() => setShowWhereVote(false)}
      >
        {perfil ? (
          <div className={styles.whereVoteContent}>
            <p>
              <strong>Mesa N°:</strong> {displayMesa}
            </p>
            <p>
              <strong>Lugar de votación:</strong> {displayLugarVotacion}
            </p>
            <p className={styles.whereVoteHint}>
              Si la mesa o el lugar de votación que figuran aquí no coinciden
              con tu domicilio actual, Sin dato, Sin información de luga, o querés solicitar un cambio, comunicate
              con SIDCA al siguiente número.
            </p>

            
            {/* Botón de WhatsApp SIDCA */}
            <div
              style={{
                marginTop: "1rem",
                display: "flex",
                justifyContent: "flex-start",
              }}
            >
              <Button
                label="SIDCA WhatsApp"
                icon="pi pi-comments" // 👈 nuevo ícono de chat
                className={`${styles.whatsappButton} p-button-sm`}
                onClick={() =>
                  window.open("https://wa.me/543834250139", "_blank")
                }
              />
            </div>
          </div>
        ) : (
          <p>No se encontraron datos de votación para este afiliado.</p>
        )}
      </Dialog>
    </div>
  );
}
