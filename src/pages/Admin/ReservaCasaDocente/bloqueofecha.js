// src/pages/Admin/ReservaCasaDocente/bloqueofecha.js
import React, { useState, useEffect } from "react";
import styles from "./ReservaCasaDocenteAdmin.module.css";

import { dbReservas } from "../../../firebase/firebaseReservas";
import {
  collection,
  onSnapshot,
  query,
  orderBy,
  addDoc,
  deleteDoc,
} from "firebase/firestore";

const TIPO_BLOQUEO_OPCIONES = [
  { value: "todos", label: "Todas las habitaciones" },
  { value: "simple", label: "Habitación simple" },
  { value: "doble", label: "Habitación doble" },
  { value: "triple", label: "Habitación triple" },
  { value: "cuadruple", label: "Habitación cuádruple" },
  { value: "departamento", label: "Departamento" },
];

const BloqueoFecha = () => {
  const [bloqueos, setBloqueos] = useState([]);
  const [cargandoBloqueos, setCargandoBloqueos] = useState(true);

  const [bloqueoDesde, setBloqueoDesde] = useState("");
  const [bloqueoHasta, setBloqueoHasta] = useState("");
  const [bloqueoTipo, setBloqueoTipo] = useState("todos");
  const [bloqueoMotivo, setBloqueoMotivo] = useState("");
  const [guardandoBloqueo, setGuardandoBloqueo] = useState(false);

  // Cargar bloqueos desde Firestore en tiempo real
  useEffect(() => {
    const colRef = collection(dbReservas, "bloqueosCasaDocente");
    const q = query(colRef, orderBy("fechaIngreso", "desc"));

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const data = snapshot.docs.map((docSnap) => ({
          id: docSnap.id,
          ...docSnap.data(),
        }));
        setBloqueos(data);
        setCargandoBloqueos(false);
      },
      (error) => {
        console.error(
          "[BloqueoFecha] Error al cargar bloqueos:",
          error
        );
        setCargandoBloqueos(false);
      }
    );

    return () => unsubscribe();
  }, []);

  const handleCrearBloqueo = async () => {
    if (!bloqueoDesde || !bloqueoHasta) {
      alert("Seleccioná fecha de inicio y final del bloqueo.");
      return;
    }
    if (bloqueoDesde > bloqueoHasta) {
      alert("La fecha de inicio no puede ser posterior a la de fin.");
      return;
    }

    try {
      setGuardandoBloqueo(true);
      const colRef = collection(dbReservas, "bloqueosCasaDocente");

      await addDoc(colRef, {
        fechaIngreso: bloqueoDesde,
        fechaEgreso: bloqueoHasta,
        tipo: bloqueoTipo, // "todos" o tipo de habitación
        motivo: bloqueoMotivo.trim() || "",
        fechaCreacion: new Date().toISOString(),
      });

      setBloqueoDesde("");
      setBloqueoHasta("");
      setBloqueoTipo("todos");
      setBloqueoMotivo("");
    } catch (error) {
      console.error("[BloqueoFecha] Error al crear bloqueo:", error);
      alert(
        "Ocurrió un error al crear el bloqueo. Revisá la consola para más detalles."
      );
    } finally {
      setGuardandoBloqueo(false);
    }
  };

  const handleEliminarBloqueo = async (bloqueo) => {
    if (
      !window.confirm(
        `¿Quitar el bloqueo del ${bloqueo.fechaIngreso} al ${bloqueo.fechaEgreso}?`
      )
    ) {
      return;
    }

    try {
      const ref = collection(dbReservas, "bloqueosCasaDocente");
      await deleteDoc(
        // docId viene en bloqueo.id
        // usamos la referencia completa: dbReservas / bloqueosCasaDocente / id
        require("firebase/firestore").doc(dbReservas, "bloqueosCasaDocente", bloqueo.id)
      );
    } catch (error) {
      console.error("[BloqueoFecha] Error al eliminar bloqueo:", error);
      alert(
        "Ocurrió un error al eliminar el bloqueo. Revisá la consola para más detalles."
      );
    }
  };

  // Versión sin require (más limpia) – si preferís, reemplazá el deleteDoc por esto:
  // import { doc } arriba y usa:
  // const ref = doc(dbReservas, "bloqueosCasaDocente", bloqueo.id);
  // await deleteDoc(ref);

  return (
    <section className={styles.tableSection}>
      <div className={styles.tableHeader}>
        <h2 className={styles.tableTitle}>Bloqueo de fechas</h2>
      </div>

      {/* Formulario de nuevo bloqueo */}
      <div className={styles.filters}>
        <div className={styles.filterGroup}>
          <label className={styles.label} htmlFor="bloqueoDesde">
            Desde
          </label>
          <input
            id="bloqueoDesde"
            type="date"
            className={styles.input}
            value={bloqueoDesde}
            onChange={(e) => setBloqueoDesde(e.target.value)}
          />
        </div>

        <div className={styles.filterGroup}>
          <label className={styles.label} htmlFor="bloqueoHasta">
            Hasta
          </label>
          <input
            id="bloqueoHasta"
            type="date"
            className={styles.input}
            value={bloqueoHasta}
            onChange={(e) => setBloqueoHasta(e.target.value)}
          />
        </div>

        <div className={styles.filterGroup}>
          <label className={styles.label} htmlFor="bloqueoTipo">
            Tipo / alcance
          </label>
          <select
            id="bloqueoTipo"
            className={styles.input}
            value={bloqueoTipo}
            onChange={(e) => setBloqueoTipo(e.target.value)}
          >
            {TIPO_BLOQUEO_OPCIONES.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>

        <div className={styles.filterGroup} style={{ flex: 2 }}>
          <label className={styles.label} htmlFor="bloqueoMotivo">
            Motivo / comentario
          </label>
          <input
            id="bloqueoMotivo"
            type="text"
            className={styles.input}
            value={bloqueoMotivo}
            onChange={(e) => setBloqueoMotivo(e.target.value)}
            placeholder="Ej.: mantenimiento, evento institucional, etc."
          />
        </div>

        <div className={styles.filterActions}>
          <button
            type="button"
            className={styles.primaryButton}
            onClick={handleCrearBloqueo}
            disabled={guardandoBloqueo}
          >
            {guardandoBloqueo ? "Guardando..." : "Agregar bloqueo"}
          </button>
        </div>
      </div>

      <p className={styles.subtitle}>
        Los bloqueos registrados se tendrán en cuenta al momento de realizar
        reservas desde la web pública. Podés bloquear todas las habitaciones, o
        solo un tipo concreto (simple, doble, etc.).
      </p>

      {/* Lista de bloqueos */}
      <div className={styles.tableWrapper}>
        {cargandoBloqueos ? (
          <p className={styles.emptyText}>Cargando bloqueos...</p>
        ) : bloqueos.length === 0 ? (
          <p className={styles.emptyText}>
            No hay bloqueos de fechas registrados.
          </p>
        ) : (
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Desde</th>
                <th>Hasta</th>
                <th>Tipo / alcance</th>
                <th>Motivo</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {bloqueos.map((b) => {
                const tipoLabel =
                  TIPO_BLOQUEO_OPCIONES.find((t) => t.value === b.tipo)?.label ||
                  b.tipo;

                return (
                  <tr key={b.id}>
                    <td>{b.fechaIngreso}</td>
                    <td>{b.fechaEgreso}</td>
                    <td>{tipoLabel}</td>
                    <td>{b.motivo}</td>
                    <td>
                      <button
                        type="button"
                        className={styles.linkButton}
                        onClick={() => handleEliminarBloqueo(b)}
                      >
                        Quitar bloqueo
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </section>
  );
};

export default BloqueoFecha;
