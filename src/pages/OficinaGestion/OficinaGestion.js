// src/pages/OficinaGestion/OficinaGestion.js

import React, { useEffect, useMemo, useState } from "react";
import { useHistory } from "react-router-dom";
import { Button } from "primereact/button";
import { ProgressSpinner } from "primereact/progressspinner";
import { Tag } from "primereact/tag";

import { collection, getDocs, query } from "firebase/firestore";
import { db } from "../../firebase/firebase-config";

import styles from "./OficinaGestion.module.css";

const OficinaGestion = () => {
  const history = useHistory();

  const [formularios, setFormularios] = useState([]);
  const [loading, setLoading] = useState(true);

  const formulariosDisponibles = useMemo(() => {
    return formularios
      .filter((formulario) => formulario.activo && formulario.publicado)
      .sort((a, b) => {
        const fechaA = a.createdAt?.toDate?.()?.getTime?.() || 0;
        const fechaB = b.createdAt?.toDate?.()?.getTime?.() || 0;

        return fechaB - fechaA;
      });
  }, [formularios]);

  const cargarFormularios = async () => {
    setLoading(true);

    try {
      const q = query(collection(db, "oficina_gestion_formularios"));

      const snap = await getDocs(q);

      const data = snap.docs.map((docSnap) => ({
        id: docSnap.id,
        ...docSnap.data(),
      }));

      setFormularios(data);
    } catch (error) {
      console.error("Error al cargar formularios:", error);
      setFormularios([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    cargarFormularios();
  }, []);

  const abrirFormulario = (formularioId) => {
    history.push(`/oficina-gestion/formulario/${formularioId}`);
  };

  return (
    <div className={styles.page}>
      <section className={styles.header}>
        <div>
          <span className={styles.badge}>Oficina de Gestión</span>

          <h1>Formularios disponibles</h1>

          <p>
            Desde este espacio podrás completar formularios institucionales,
            presentar documentación y realizar trámites habilitados por el
            Sindicato de Docentes de Catamarca.
          </p>
        </div>

      
      </section>

      {loading ? (
        <section className={styles.loadingBox}>
          <ProgressSpinner />
          <span>Cargando formularios disponibles...</span>
        </section>
      ) : formulariosDisponibles.length === 0 ? (
        <section className={styles.emptyBox}>
          <i className="pi pi-inbox" />

          <h2>No hay formularios disponibles</h2>

          <p>
            Actualmente no existen formularios publicados para completar. Cuando
            se habilite uno nuevo, aparecerá en este espacio.
          </p>
        </section>
      ) : (
        <section className={styles.grid}>
          {formulariosDisponibles.map((formulario) => (
            <article key={formulario.id} className={styles.card}>
              <div className={styles.cardHeader}>
                <div className={styles.iconBox}>
                  <i className="pi pi-file-edit" />
                </div>

                <Tag value="Disponible" severity="success" />
              </div>

              <h2>{formulario.titulo || "Formulario sin título"}</h2>

              <p>{formulario.descripcion || "Sin descripción disponible."}</p>

              <div className={styles.meta}>
                <span>
                  <i className="pi pi-list" />
                  {formulario.cantidadCampos || formulario.campos?.length || 0}{" "}
                  campos
                </span>
              </div>

              <Button
                label="Completar formulario"
                icon="pi pi-send"
                severity="success"
                onClick={() => abrirFormulario(formulario.id)}
              />
            </article>
          ))}
        </section>
      )}
    </div>
  );
};

export default OficinaGestion;