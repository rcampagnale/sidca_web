// src/pages/Admin/Certificados/FirmasCertificado.js
//
// Bloque de firmas del certificado.
//
// Cada firma es una tarjeta vertical (nunca una tabla) para que en móvil
// nada se superponga ni obligue a scroll horizontal.
//
// Las imágenes se suben a Cloudinary y en Firestore sólo se guardan la URL
// y el public_id. Nunca base64.

import React, { useState } from "react";

import {
  PROVEEDOR_CLOUDINARY,
  TAMANIO_MAXIMO_MB,
  subirImagenCloudinary,
  validarImagen,
} from "../../../utils/cloudinaryUpload";
import styles from "./CertificadosAdmin.module.css";

export const crearFirmaVacia = (orden) => ({
  nombre: "",
  cargo: "",
  imagenUrl: "",
  imagenPublicId: "",
  proveedor: PROVEEDOR_CLOUDINARY,
  orden,
});

const FirmasCertificado = ({ firmas, onCambiar, deshabilitado, onError }) => {
  // Índice de la firma cuya imagen se está subiendo, para bloquear sólo esa.
  const [subiendo, setSubiendo] = useState(null);

  /** Reasigna orden 1..n. El backend lo hace también, pero así la UI ya es coherente. */
  const reordenar = (lista) =>
    lista.map((firma, indice) => ({ ...firma, orden: indice + 1 }));

  const actualizarCampo = (indice, campo, valor) => {
    const siguiente = firmas.map((firma, i) =>
      i === indice ? { ...firma, [campo]: valor } : firma
    );
    onCambiar(reordenar(siguiente));
  };

  const agregarFirma = () => {
    onCambiar(reordenar([...firmas, crearFirmaVacia(firmas.length + 1)]));
  };

  const eliminarFirma = (indice) => {
    onCambiar(reordenar(firmas.filter((_, i) => i !== indice)));
  };

  const moverFirma = (indice, direccion) => {
    const destino = indice + direccion;
    if (destino < 0 || destino >= firmas.length) return;

    const siguiente = [...firmas];
    [siguiente[indice], siguiente[destino]] = [
      siguiente[destino],
      siguiente[indice],
    ];
    onCambiar(reordenar(siguiente));
  };

  const subirImagen = async (indice, file) => {
    if (!file) return;

    const errorValidacion = validarImagen(file);
    if (errorValidacion) {
      onError(errorValidacion);
      return;
    }

    setSubiendo(indice);

    try {
      const resultado = await subirImagenCloudinary(file, "sidca-certificados");

      const siguiente = firmas.map((firma, i) =>
        i === indice
          ? {
              ...firma,
              imagenUrl: resultado.url,
              imagenPublicId: resultado.publicId,
              proveedor: resultado.proveedor,
            }
          : firma
      );

      onCambiar(reordenar(siguiente));
    } catch (e) {
      onError(e.message || "No se pudo subir la imagen de la firma.");
    } finally {
      setSubiendo(null);
    }
  };

  return (
    <section className={styles.bloque}>
      <div className={styles.bloqueHeader}>
        <h3 className={styles.bloqueTitulo}>Firmas</h3>
        <span className={styles.bloqueContador}>
          {firmas.length} {firmas.length === 1 ? "firma" : "firmas"}
        </span>
      </div>

      <p className={styles.ayuda}>
        Se guardan la URL y el identificador de la imagen. Formatos JPG, PNG o
        WEBP, hasta {TAMANIO_MAXIMO_MB} MB.
      </p>

      {firmas.length === 0 && (
        <p className={styles.estadoTexto}>
          Todavía no cargaste ninguna firma.
        </p>
      )}

      <div className={styles.listaFirmas}>
        {firmas.map((firma, indice) => (
          <article key={indice} className={styles.firmaCard}>
            <header className={styles.firmaHeader}>
              <span className={styles.firmaOrden}>Firma {indice + 1}</span>

              <div className={styles.firmaAccionesOrden}>
                <button
                  type="button"
                  className={styles.botonIcono}
                  onClick={() => moverFirma(indice, -1)}
                  disabled={deshabilitado || indice === 0}
                  aria-label={`Subir la firma ${indice + 1}`}
                  title="Subir"
                >
                  <i className="pi pi-arrow-up" />
                </button>

                <button
                  type="button"
                  className={styles.botonIcono}
                  onClick={() => moverFirma(indice, 1)}
                  disabled={deshabilitado || indice === firmas.length - 1}
                  aria-label={`Bajar la firma ${indice + 1}`}
                  title="Bajar"
                >
                  <i className="pi pi-arrow-down" />
                </button>

                <button
                  type="button"
                  className={`${styles.botonIcono} ${styles.botonIconoPeligro}`}
                  onClick={() => eliminarFirma(indice)}
                  disabled={deshabilitado}
                  aria-label={`Eliminar la firma ${indice + 1}`}
                  title="Eliminar"
                >
                  <i className="pi pi-trash" />
                </button>
              </div>
            </header>

            <label className={styles.campo}>
              <span className={styles.campoLabel}>Nombre y apellido</span>
              <input
                type="text"
                className={styles.input}
                value={firma.nombre}
                onChange={(e) =>
                  actualizarCampo(indice, "nombre", e.target.value)
                }
                disabled={deshabilitado}
                placeholder="Ej.: María López"
              />
            </label>

            <label className={styles.campo}>
              <span className={styles.campoLabel}>Cargo</span>
              <input
                type="text"
                className={styles.input}
                value={firma.cargo}
                onChange={(e) =>
                  actualizarCampo(indice, "cargo", e.target.value)
                }
                disabled={deshabilitado}
                placeholder="Ej.: Secretaria General"
              />
            </label>

            <label className={styles.campo}>
              <span className={styles.campoLabel}>Imagen de la firma</span>
              <input
                type="file"
                className={styles.inputArchivo}
                accept="image/jpeg,image/jpg,image/png,image/webp"
                disabled={deshabilitado || subiendo === indice}
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  // Se limpia el input para poder volver a elegir el mismo archivo.
                  e.target.value = "";
                  subirImagen(indice, file);
                }}
              />
            </label>

            {subiendo === indice && (
              <p className={styles.estadoTexto}>Subiendo imagen…</p>
            )}

            {firma.imagenUrl ? (
              <div className={styles.firmaPreview}>
                <img
                  src={firma.imagenUrl}
                  alt={`Firma de ${firma.nombre || "sin nombre"}`}
                />
                <button
                  type="button"
                  className={styles.botonTextoPeligro}
                  disabled={deshabilitado}
                  onClick={() => {
                    const siguiente = firmas.map((f, i) =>
                      i === indice
                        ? { ...f, imagenUrl: "", imagenPublicId: "" }
                        : f
                    );
                    onCambiar(reordenar(siguiente));
                  }}
                >
                  Quitar imagen
                </button>
              </div>
            ) : (
              <p className={styles.estadoTexto}>
                Sin imagen. Podés cargarla más adelante: el borrador se guarda
                igual.
              </p>
            )}
          </article>
        ))}
      </div>

      <button
        type="button"
        className={styles.botonSecundario}
        onClick={agregarFirma}
        disabled={deshabilitado || firmas.length >= 10}
      >
        <i className="pi pi-plus" /> Agregar firma
      </button>
    </section>
  );
};

export default FirmasCertificado;
