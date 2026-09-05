import React, { useEffect, useMemo, useState } from "react";
import { FileUpload } from "primereact/fileupload";
import { InputSwitch } from "primereact/inputswitch";

import styles from "./CertificadosAdmin.module.css";

export const FIRMANTES_MINISTERIO_INICIALES = [
  {
    id: "firmante_1",
    orden: 1,
    nombre: "Lic. Carlos Alejandro Ortiz",
    cargo: "SECRETARIO DE INNOVACION Y CALIDAD EDUCATIVA",
    organismo: "MINISTERIO DE EDUCACION Y TRABAJO",
    activo: true,
    imagenStoragePath: "",
    imagenVersion: 0,
    imagenSha256: "",
  },
  {
    id: "firmante_2",
    orden: 2,
    nombre: "David Sánchez S.",
    cargo:
      "DIRECTOR PROVINCIAL DE MONITOREO DE TRAYECTORIAS Y DESARROLLO PROFESIONAL.",
    organismo:
      "SECRETARIA DE INNOVACION Y CALIDAD EDUCATIVA. MINISTERIO DE EDUCACION Y TRABAJO",
    activo: true,
    imagenStoragePath: "",
    imagenVersion: 0,
    imagenSha256: "",
  },
  {
    id: "firmante_3",
    orden: 3,
    nombre: "Dr. Sergio Guillamondegui",
    cargo: "SECRETARIO GENERAL",
    organismo: "SINDICATO DE DOCENTES DE CATAMARCA",
    activo: true,
    imagenStoragePath: "",
    imagenVersion: 0,
    imagenSha256: "",
  },
];

export const normalizarFirmantesMinisterio = (firmantes) => {
  const porId = new Map(
    (Array.isArray(firmantes) ? firmantes : []).map((firmante) => [
      firmante?.id,
      firmante,
    ])
  );

  return FIRMANTES_MINISTERIO_INICIALES.map((inicial) => {
    const existente = porId.get(inicial.id) || {};

    return {
      ...inicial,
      nombre: String(existente.nombre ?? inicial.nombre),
      cargo: String(existente.cargo ?? inicial.cargo),
      organismo: String(existente.organismo ?? inicial.organismo),
      activo: existente.activo !== false,
      imagenStoragePath: String(existente.imagenStoragePath || ""),
      imagenVersion: Number(existente.imagenVersion || 0),
      imagenSha256: String(existente.imagenSha256 || ""),
    };
  });
};

const FirmantesMinisterioCertificado = ({
  cursoId,
  firmantes,
  onCambiar,
  onSubirImagen,
  obtenerImagen,
  deshabilitado,
  subiendoFirmanteId,
}) => {
  const lista = useMemo(
    () => normalizarFirmantesMinisterio(firmantes),
    [firmantes]
  );
  const [previsualizaciones, setPrevisualizaciones] = useState({});

  useEffect(() => {
    let activo = true;
    const urls = [];

    const cargar = async () => {
      if (!cursoId || !obtenerImagen) {
        if (activo) setPrevisualizaciones({});
        return;
      }

      const siguientes = {};

      for (const firmante of lista) {
        if (!firmante.imagenStoragePath) continue;

        try {
          const imagen = await obtenerImagen(cursoId, firmante.id);
          const url = URL.createObjectURL(imagen);
          urls.push(url);
          siguientes[firmante.id] = url;
        } catch (_) {
          // La carga se puede reintentar desde el botón; no se interrumpe la edición.
        }
      }

      if (activo) setPrevisualizaciones(siguientes);
    };

    cargar();

    return () => {
      activo = false;
      urls.forEach((url) => URL.revokeObjectURL(url));
    };
  }, [cursoId, obtenerImagen, lista]);

  const cambiarFirmante = (id, campo, valor) => {
    onCambiar(
      lista.map((firmante) =>
        firmante.id === id ? { ...firmante, [campo]: valor } : firmante
      )
    );
  };

  return (
    <section className={styles.bloque}>
      <div className={styles.bloqueHeader}>
        <h3 className={styles.bloqueTitulo}>Firmantes del Ministerio</h3>
      </div>

      <p className={styles.ayuda}>
        Las firmas se guardan en versiones inmutables. Guardá primero la
        configuración para poder cargar o reemplazar una imagen.
      </p>

      <div className={styles.firmantesGrid}>
        {lista.map((firmante) => {
          const subiendo = subiendoFirmanteId === firmante.id;
          const imagen = previsualizaciones[firmante.id];

          return (
            <article key={firmante.id} className={styles.firmanteMinisterioCard}>
              <div className={styles.firmanteHeader}>
                <span className={styles.firmaOrden}>Firmante {firmante.orden}</span>
                <label className={styles.interruptorFirmante}>
                  <InputSwitch
                    checked={firmante.activo}
                    onChange={(event) =>
                      cambiarFirmante(firmante.id, "activo", event.value)
                    }
                    disabled={deshabilitado}
                  />
                  <span>{firmante.activo ? "Activo" : "Inactivo"}</span>
                </label>
              </div>

              <label className={styles.campo}>
                <span className={styles.campoLabel}>Nombre y apellido</span>
                <input
                  className={styles.input}
                  value={firmante.nombre}
                  onChange={(event) =>
                    cambiarFirmante(firmante.id, "nombre", event.target.value)
                  }
                  maxLength={160}
                  disabled={deshabilitado}
                />
              </label>

              <label className={styles.campo}>
                <span className={styles.campoLabel}>Cargo</span>
                <textarea
                  className={styles.textarea}
                  value={firmante.cargo}
                  onChange={(event) =>
                    cambiarFirmante(firmante.id, "cargo", event.target.value)
                  }
                  maxLength={300}
                  rows={3}
                  disabled={deshabilitado}
                />
              </label>

              <label className={styles.campo}>
                <span className={styles.campoLabel}>Organismo</span>
                <textarea
                  className={styles.textarea}
                  value={firmante.organismo}
                  onChange={(event) =>
                    cambiarFirmante(firmante.id, "organismo", event.target.value)
                  }
                  maxLength={400}
                  rows={3}
                  disabled={deshabilitado}
                />
              </label>

              <div className={styles.firmaMinisterioPreview}>
                {imagen ? (
                  <img src={imagen} alt={`Firma de ${firmante.nombre || firmante.id}`} />
                ) : (
                  <span className={styles.firmaMinisterioPlaceholder}>
                    Sin firma cargada
                  </span>
                )}
              </div>

              <div className={styles.firmaMinisterioAcciones}>
                <FileUpload
                  mode="basic"
                  name="imagen"
                  accept="image/png,image/jpeg"
                  chooseLabel={subiendo ? "Subiendo..." : "Subir o reemplazar"}
                  customUpload
                  auto
                  uploadHandler={(event) =>
                    onSubirImagen?.(firmante.id, event.files?.[0])
                  }
                  disabled={deshabilitado || !cursoId || subiendo}
                />
                {firmante.imagenVersion > 0 && (
                  <span className={styles.firmaVersion}>
                    Versión {firmante.imagenVersion}
                  </span>
                )}
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
};

export default FirmantesMinisterioCertificado;
