// src/pages/OficinaGestion/OficinaGestion.js

import React, { useEffect, useMemo, useState } from "react";
import { useHistory } from "react-router-dom";
import { Button } from "primereact/button";
import { ProgressSpinner } from "primereact/progressspinner";
import { Tag } from "primereact/tag";

import { collection, getDocs, query } from "firebase/firestore";
import { db } from "../../firebase/firebase-config";

import styles from "./OficinaGestion.module.css";

const LOGO_SINDICATO = "/logo192.png";

const htmlATextoPlano = (html = "") => {
  if (typeof document === "undefined") {
    return String(html || "").replace(/<[^>]+>/g, " ").trim();
  }

  const temp = document.createElement("div");
  temp.innerHTML = String(html || "");

  return (temp.textContent || temp.innerText || "").trim();
};

const escaparHtml = (texto = "") => {
  return String(texto || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
};

const sanearHtmlBasico = (html = "") => {
  return String(html || "")
    .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?>[\s\S]*?<\/style>/gi, "")
    .replace(/\son\w+="[^"]*"/gi, "")
    .replace(/\son\w+='[^']*'/gi, "")
    .replace(/javascript:/gi, "");
};

/**
 * Convierte texto plano con puntos a), b), c), d), e)
 * en una lista prolija.
 *
 * Esto corrige formularios viejos que quedaron guardados
 * como texto corrido en Firestore.
 */
const textoPlanoAHtmlConListas = (texto = "") => {
  const limpio = String(texto || "").trim();

  if (!limpio) return "";

  const markerRegex = /\b([a-z])\)\s*/gi;
  const matches = [...limpio.matchAll(markerRegex)];

  if (matches.length < 2) {
    return limpio
      .split(/\n{2,}/)
      .map((bloque) => `<p>${escaparHtml(bloque).replace(/\n/g, "<br />")}</p>`)
      .join("");
  }

  const primeraMarca = matches[0];
  const intro = limpio.slice(0, primeraMarca.index).trim();

  const items = [];
  let cierre = "";

  matches.forEach((match, index) => {
    const inicioContenido = match.index + match[0].length;
    const finContenido =
      index + 1 < matches.length ? matches[index + 1].index : limpio.length;

    let contenido = limpio.slice(inicioContenido, finContenido).trim();

    if (index === matches.length - 1) {
      const cierreMatch = contenido.match(
        /(Agradecemos su colaboración\.?|Muchas gracias\.?|Importante:.*)$/i
      );

      if (cierreMatch?.index > 0) {
        cierre = contenido.slice(cierreMatch.index).trim();
        contenido = contenido.slice(0, cierreMatch.index).trim();
      }
    }

    if (contenido) {
      items.push({
        letra: match[1].toLowerCase(),
        contenido,
      });
    }
  });

  const htmlIntro = intro ? `<p>${escaparHtml(intro)}</p>` : "";

  const htmlLista = items.length
    ? `<ol class="listaAlfabetica">${items
        .map((item) => `<li>${escaparHtml(item.contenido)}</li>`)
        .join("")}</ol>`
    : "";

  const htmlCierre = cierre ? `<p>${escaparHtml(cierre)}</p>` : "";

  return `${htmlIntro}${htmlLista}${htmlCierre}`;
};

/**
 * Ajusta imágenes incrustadas en el editor enriquecido para que no
 * se salgan de la tarjeta pública.
 *
 * Importante:
 * - La imagen se adapta al ancho disponible.
 * - Se limita la altura para que no rompa la tarjeta.
 * - Se mantiene el contenido dentro del card.
 */
const adaptarImagenesHtmlParaTarjeta = (html = "") => {
  const htmlSeguro = sanearHtmlBasico(html);

  if (typeof document === "undefined") {
    return htmlSeguro;
  }

  const contenedor = document.createElement("div");
  contenedor.innerHTML = htmlSeguro;

  const imagenes = contenedor.querySelectorAll("img");

  imagenes.forEach((img) => {
    img.removeAttribute("width");
    img.removeAttribute("height");

    img.setAttribute("loading", "lazy");
    img.setAttribute("decoding", "async");

    img.style.display = "block";
    img.style.width = "100%";
    img.style.maxWidth = "100%";
    img.style.height = "230px";
    img.style.maxHeight = "230px";
    img.style.objectFit = "contain";
    img.style.objectPosition = "center";
    img.style.margin = "14px auto";
    img.style.borderRadius = "16px";
    img.style.background = "#f1f5f9";
    img.style.border = "1px solid #e2e8f0";
    img.style.overflow = "hidden";
  });

  return contenedor.innerHTML;
};

const obtenerDescripcionHtml = (formulario) => {
  const descripcionHtml = formulario?.descripcionHtml || "";

  if (htmlATextoPlano(descripcionHtml)) {
    return adaptarImagenesHtmlParaTarjeta(descripcionHtml);
  }

  return adaptarImagenesHtmlParaTarjeta(
    textoPlanoAHtmlConListas(formulario?.descripcion || "")
  );
};

const OficinaGestion = () => {
  const history = useHistory();

  const [formularios, setFormularios] = useState([]);
  const [loading, setLoading] = useState(true);
  const [logoError, setLogoError] = useState(false);

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

  const renderLogo = () => {
    if (logoError) {
      return (
        <div className={styles.logoFallback}>
          <i className="pi pi-file-edit" />
        </div>
      );
    }

    return (
      <img
        src={LOGO_SINDICATO}
        alt="Logo del Sindicato de Docentes de Catamarca"
        className={styles.logoSindicato}
        onError={() => setLogoError(true)}
      />
    );
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
          {formulariosDisponibles.map((formulario) => {
            const descripcionHtml = obtenerDescripcionHtml(formulario);
            const cantidadCampos =
              formulario.cantidadCampos || formulario.campos?.length || 0;

            return (
              <article key={formulario.id} className={styles.card}>
                <div className={styles.cardHeader}>
                  <div className={styles.logoBox}>{renderLogo()}</div>

                  <Tag value="Disponible" severity="success" />
                </div>

                <h2>{formulario.titulo || "Formulario sin título"}</h2>

                {descripcionHtml ? (
                  <div
                    className={styles.cardDescription}
                    dangerouslySetInnerHTML={{ __html: descripcionHtml }}
                  />
                ) : (
                  <div className={styles.cardDescription}>
                    <p>Sin descripción disponible.</p>
                  </div>
                )}

                <div className={styles.meta}>
                  <span>
                    <i className="pi pi-list" />
                    {cantidadCampos} {cantidadCampos === 1 ? "campo" : "campos"}
                  </span>
                </div>

                <Button
                  label="Completar formulario"
                  icon="pi pi-send"
                  severity="success"
                  onClick={() => abrirFormulario(formulario.id)}
                />
              </article>
            );
          })}
        </section>
      )}
    </div>
  );
};

export default OficinaGestion;