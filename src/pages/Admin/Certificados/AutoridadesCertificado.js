// src/pages/Admin/Certificados/AutoridadesCertificado.js
//
// Autoridades que aparecen en el certificado, en TEXTO.
//
// Reemplaza al modelo anterior de firmas con imagen. Ya no hay agregar,
// eliminar, mover, subir archivo ni Cloudinary: son exactamente DOS
// posiciones fijas, porque la plantilla tiene dos lugares y no más.
//
// Cada autoridad puede llegar a cuatro renglones —nombre, cargo, organismo y
// referencia—, pero sólo se imprimen los que tengan contenido.
//
// Se pueden dejar incompletas: la configuración se guarda como borrador. La
// obligatoriedad la exige el backend al EMITIR, que es cuando el dato se
// vuelve irreversible, y sólo sobre nombre y cargo.

import React from "react";

import styles from "./CertificadosAdmin.module.css";

/**
 * Estado inicial: dos posiciones vacías.
 *
 * Se exporta para que la pantalla arranque siempre con las dos tarjetas, aun
 * sin configuración previa. Es una constante, así que se clona antes de usar
 * para no compartir referencias entre montajes.
 */
export const AUTORIDADES_VACIAS = [
  { nombre: "", cargo: "", organismo: "", referencia: "", orden: 1 },
  { nombre: "", cargo: "", organismo: "", referencia: "", orden: 2 },
];

/**
 * Campos de texto de una autoridad, en el mismo orden en que se imprimen.
 *
 * El formulario se genera desde acá para que agregar un renglón sea agregar
 * una entrada y no tocar el JSX.
 *
 * organismo y referencia son opcionales: no bloquean la emisión.
 */
export const CAMPOS_AUTORIDAD = [
  { nombre: "nombre", label: "Nombre y apellido", maxLength: 160 },
  { nombre: "cargo", label: "Cargo", maxLength: 200 },
  {
    nombre: "organismo",
    label: "Organismo / institución",
    maxLength: 300,
    ayuda:
      "Ej.: Sindicato de Docentes de Catamarca, Instituto Tecnológico Municipal.",
  },
  {
    nombre: "referencia",
    label: "Referencia / dependencia",
    maxLength: 300,
    ayuda: "Ej.: INSC. GREMIAL N° 2902, Ministerio de Educación y Trabajo.",
  },
];

/**
 * Devuelve siempre dos posiciones, completando lo que falte.
 *
 * Las configuraciones guardadas antes de que existieran organismo y
 * referencia no traen esos campos: quedan en "" y el certificado sencillamente
 * no dibuja ese renglón. No hay migración.
 */
export const normalizarDosAutoridades = (autoridades) => {
  const lista = Array.isArray(autoridades) ? autoridades : [];

  return [0, 1].map((indice) => ({
    nombre: String(lista[indice]?.nombre || ""),
    cargo: String(lista[indice]?.cargo || ""),
    organismo: String(lista[indice]?.organismo || ""),
    referencia: String(lista[indice]?.referencia || ""),
    orden: indice + 1,
  }));
};

const AutoridadesCertificado = ({ autoridades, onCambiar, deshabilitado }) => {
  const lista = normalizarDosAutoridades(autoridades);

  const cambiarCampo = (indice, campo, valor) => {
    const siguiente = lista.map((autoridad, i) =>
      i === indice ? { ...autoridad, [campo]: valor } : autoridad
    );

    onCambiar(siguiente);
  };

  // Sólo nombre y cargo cuentan para el aviso: son los dos que el backend
  // exige al emitir.
  const incompleta = lista.some(
    (autoridad) => !autoridad.nombre.trim() || !autoridad.cargo.trim()
  );

  return (
    <section className={styles.bloque}>
      <div className={styles.bloqueHeader}>
        <h2 className={styles.bloqueTitulo}>Autoridades del certificado</h2>
      </div>

      <p className={styles.ayuda}>
        Completá los datos de las dos autoridades que aparecerán en el
        certificado. Nombre y cargo son obligatorios para emitir; organismo y
        referencia son opcionales y se omiten si los dejás vacíos.
      </p>

      <div className={styles.listaAutoridades}>
        {lista.map((autoridad, indice) => (
          <div key={autoridad.orden} className={styles.autoridadCard}>
            <span className={styles.autoridadOrden}>
              Autoridad {autoridad.orden}
            </span>

            {CAMPOS_AUTORIDAD.map((campo) => (
              <label key={campo.nombre} className={styles.campo}>
                <span className={styles.campoLabel}>{campo.label}</span>
                <input
                  type="text"
                  className={styles.input}
                  value={autoridad[campo.nombre]}
                  onChange={(e) =>
                    cambiarCampo(indice, campo.nombre, e.target.value)
                  }
                  maxLength={campo.maxLength}
                  disabled={deshabilitado}
                  autoComplete="off"
                />
                {campo.ayuda && (
                  <span className={styles.campoAyuda}>{campo.ayuda}</span>
                )}
              </label>
            ))}
          </div>
        ))}
      </div>

      {/* Informativo, no error: guardar el borrador incompleto está permitido. */}
      {incompleta && (
        <p className={styles.avisoAutoridades}>
          El nombre y el cargo de las dos autoridades deberán estar completos
          antes de emitir el certificado.
        </p>
      )}
    </section>
  );
};

export default AutoridadesCertificado;
