// src/pages/Credencial/Credencial.js
import React, { useCallback, useEffect, useRef, useState, useMemo } from "react";
import { useSelector } from "react-redux";
import { Toast } from "primereact/toast";
import { ProgressSpinner } from "primereact/progressspinner";
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
// Toma el primer valor no vacío entre varias claves
const pick = (obj, keys) => {
  for (const k of keys) {
    const v = obj?.[k];
    if (v !== undefined && v !== null && String(v).trim() !== "") {
      return String(v).trim();
    }
  }
  return "";
};

// “Apellido, Nombre”
const nombreAfiliado = (apellido, nombre) => {
  const ap = (apellido || "").trim();
  const no = (nombre || "").trim();
  const combinado = ap && no ? `${ap}, ${no}` : ap || no;
  return combinado.replace(/\s*,\s*/g, ", ").replace(/\s+/g, " ").trim();
};

// Busca por DNI aceptando string/number/solo dígitos y campos "dni"/"DNI"
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

  /* =========================
     Resolver docId y dni del login
     (Redux -> localStorage -> ?dni=)
     ========================= */
  const resolveIds = useCallback(() => {
    // 1) Redux (como en MiRegistro)
    const docIdFromStore = user?.docId || "";
    const dniFromStore = user?.dni || "";

    // 2) localStorage (mismas claves que usa MiRegistro)
    const docIdLS =
      docIdFromStore || localStorage.getItem("sidca_user_docId") || "";
    const dniLS =
      dniFromStore || localStorage.getItem("sidca_user_dni") || "";

    // 3) QueryString opcional ?dni=
    let dniQS = "";
    try {
      const qs = new URLSearchParams(window.location.search);
      dniQS = qs.get("dni") || "";
    } catch {
      /* no-op */
    }

    return {
      docId: String(docIdLS || "").trim(),
      dni: String(dniQS || dniLS || "").trim(),
    };
  }, [user]);

  /* =========================
     Carga de perfil:
     1) usuarios por docId
     2) usuarios por dni
     3) nuevoAfiliado por dni (para completar depto si falta)
     ========================= */
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

      // 1) Intentar por docId en "usuarios"
      if (docId) {
        const ref = doc(db, "usuarios", docId);
        const snap = await getDoc(ref);
        if (snap.exists()) data = snap.data();
      }

      // 2) Si no hay, probar por dni en "usuarios"
      if (!data && dni) {
        const usuariosRef = collection(db, "usuarios");
        const foundUsr = await getByDni(usuariosRef, dni);
        if (foundUsr) data = foundUsr;
      }

      // 3) Si aún no hay, probar en "nuevoAfiliado" (o usarlo para completar depto)
      let depto = pick(data, ["departamento", "depto", "departamentoNombre"]);
      if (!data && dni) {
        const nuevoAfiliadoRef = collection(db, "nuevoAfiliado");
        const foundNA = await getByDni(nuevoAfiliadoRef, dni);
        if (foundNA) {
          data = foundNA;
          if (!depto) {
            depto = pick(foundNA, ["departamento", "depto", "departamentoNombre"]);
          }
        }
      } else if (data && !depto && dni) {
        // completar depto desde nuevoAfiliado si en usuarios no está
        const nuevoAfiliadoRef = collection(db, "nuevoAfiliado");
        const foundNA = await getByDni(nuevoAfiliadoRef, dni);
        if (foundNA) {
          const depFallback = pick(foundNA, [
            "departamento",
            "depto",
            "departamentoNombre",
          ]);
          if (depFallback) depto = depFallback;
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

      const dniFinal =
        data?.dni ??
        dni ??
        ""; // conserva el dni resuelto si el documento no trae el campo

      const perfilBase = {
        apellido: data?.apellido || "",
        nombre: data?.nombre || "",
        dni: String(dniFinal),
        departamento: depto || "Departamento",
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

  useEffect(() => {
    loadPerfil();
  }, [loadPerfil]);

  /* =========================
     Derivados para la UI
     ========================= */
  const displayName = useMemo(
    () =>
      perfil && (perfil.apellido || perfil.nombre)
        ? nombreAfiliado(perfil.apellido, perfil.nombre)
        : "APELLIDO NOMBRE",
    [perfil]
  );

  const displayDni = perfil?.dni || "xxxxxxx";
  const displayDepto = perfil?.departamento || "Departamento";

  return (
    <div className={styles.container}>
      <Toast ref={toastRef} />

      {loading && (
        <div className={styles.loader}>
          <ProgressSpinner />
          <p className={styles.muted}>Cargando credencial...</p>
        </div>
      )}

      <div className={styles.card}>
        <div className={styles.credencialPreview}>
          {/* Título */}
          <div className={`${styles.infoOverlay} ${styles.infoTitleOverlay}`}>
            <div className={styles.infoTitle}>Credencial de Afiliado</div>
          </div>

          {/* Datos a la izquierda */}
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
    </div>
  );
}

