// src/components/afiliados/hooks/useUsuariosOnce.js
import { useEffect, useState } from "react";
import {
  collection,
  getDocs,
  query,
  orderBy,
  limit,
  documentId,
} from "firebase/firestore";
import { db } from "../../../firebase/firebase-config.js";
import { toRow, norm } from "../utils/shared.js";

/**
 * Carga única de la colección "usuarios" con cadena de fallbacks:
 * 1) orderBy(orderField, "desc") + limit
 * 2) sin orderBy (sólo limit)
 * 3) orderBy(documentId(), "desc") + limit
 */
export default function useUsuariosOnce({ orderField = "updatedAt", pageSize = 5000 } = {}) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;

    const mapDocs = (snap) =>
      snap.docs.map((d) => {
        const base = { id: d.id, ...d.data() };
        const r = { ...toRow(base), origen: "usuarios" };
        const haystack = norm(
          `${r.apellido} ${r.nombre} ${String(r.dni || "")} ${r.email || ""} ${r.departamento || ""}`
        );
        return { ...r, haystack };
      });

    (async () => {
      try {
        setLoading(true);

        // Try #1: orderBy(orderField)
        let snap;
        try {
          const q1 = query(collection(db, "usuarios"), orderBy(orderField, "desc"), limit(pageSize));
          snap = await getDocs(q1);
          if (!alive) return;
          if (!snap.empty) {
            setRows(mapDocs(snap));
            return;
          }
        } catch (err1) {
          // seguimos a fallback
          // console.warn("Fallback 1 (sin índice/field):", err1);
        }

        // Try #2: sin orderBy (sólo limit)
        try {
          const q2 = query(collection(db, "usuarios"), limit(pageSize));
          snap = await getDocs(q2);
          if (!alive) return;
          if (!snap.empty) {
            setRows(mapDocs(snap));
            return;
          }
        } catch (err2) {
          // seguimos a fallback
          // console.warn("Fallback 2 (sin orderBy) error:", err2);
        }

        // Try #3: orderBy(documentId())
        try {
          const q3 = query(
            collection(db, "usuarios"),
            orderBy(documentId(), "desc"),
            limit(pageSize)
          );
          snap = await getDocs(q3);
          if (!alive) return;
          setRows(snap.empty ? [] : mapDocs(snap));
        } catch (err3) {
          if (!alive) return;
          // Último fallback -> vacío
          // console.error("Fallback 3 (documentId) error:", err3);
          setRows([]);
        }
      } finally {
        if (alive) setLoading(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, [orderField, pageSize]);

  return [rows, loading];
}
