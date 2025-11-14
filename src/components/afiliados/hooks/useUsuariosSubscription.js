// src/components/afiliados/hooks/useUsuariosSubscription.js
import { useEffect, useState } from "react";
import {
  collection,
  onSnapshot,
  query,
  orderBy,
  limit,
  getDocs,
  documentId,
} from "firebase/firestore";
import { db } from "../../../firebase/firebase-config.js";
import { toRow, norm } from "..";

// Orden preferido: fecha+hora → updatedAt → createdAt → __name__ (fallback)
const ORDER_CANDIDATES = [
  ["fecha", "hora"],
  ["updatedAt"],
  ["createdAt"],
  ["__name__"],
];

const ob = (field) =>
  field === "__name__" ? orderBy(documentId(), "desc") : orderBy(field, "desc");

async function pickOrderSpec() {
  for (const spec of ORDER_CANDIDATES) {
    try {
      const constraints = spec.map(ob);
      const testQ = query(collection(db, "usuarios"), ...constraints, limit(1));
      const snap = await getDocs(testQ);
      if (!snap.empty) return spec; // usamos el primero que devuelva algo
    } catch {
      // sin índice o campo inexistente → probamos siguiente
    }
  }
  return ["__name__"];
}

export default function useUsuariosSubscription({ pageSize = 200 } = {}) {
  const [rows, setRows] = useState([]);

  useEffect(() => {
    let cancelled = false;
    let unsub = null;

    (async () => {
      const spec = await pickOrderSpec();
      if (cancelled) return;
      const constraints = spec.map(ob);
      const q = query(collection(db, "usuarios"), ...constraints, limit(pageSize));

      unsub = onSnapshot(
        q,
        (snap) => {
          const next = snap.docs.map((d) => {
            const base = { id: d.id, ...d.data() };
            const r = { ...toRow(base), origen: "usuarios" };
            const haystack = norm(
              `${r.apellido} ${r.nombre} ${String(r.dni || "")} ${r.email || ""} ${r.departamento || ""}`
            );
            return { ...r, haystack };
          });
          setRows(next);
        },
        (err) => console.error("onSnapshot(usuarios) error:", err)
      );
    })();

    return () => {
      cancelled = true;
      if (unsub) unsub();
    };
  }, [pageSize]);

  return rows;
}
