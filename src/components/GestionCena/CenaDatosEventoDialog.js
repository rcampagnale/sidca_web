import React, { useEffect, useState } from "react";
import { obtenerDatosEventoCena } from "../../services/gestionCenaService";
import styles from "../../pages/Admin/GestionCena/GestionCenaAdmin.module.css";

const campos = [
  ["nombreEvento", "Nombre de la Cena"],
  ["lugar", "Lugar"],
  ["fechaTexto", "Fecha"],
  ["horaTexto", "Hora"],
  ["direccion", "Dirección"],
  ["localidad", "Localidad"],
  ["organizadorTexto", "Texto organizador"],
  ["sitioWeb", "Sitio web"],
];

const CenaDatosEventoDialog = ({ visible, anio, edicion, onClose, onGuardar }) => {
  const [datos, setDatos] = useState(obtenerDatosEventoCena(edicion, anio));

  useEffect(() => {
    if (visible) setDatos(obtenerDatosEventoCena(edicion, anio));
  }, [anio, edicion, visible]);

  if (!visible) return null;

  const actualizar = (campo, valor) => setDatos((previo) => ({ ...previo, [campo]: valor }));

  return (
    <div className={styles.gcEventModalOverlay} role="dialog" aria-modal="true" aria-labelledby="titulo-datos-cena">
      <form className={styles.gcEventModal} onSubmit={(event) => { event.preventDefault(); onGuardar(datos); }}>
        <div className={styles.gcEventModalHeader}>
          <h2 id="titulo-datos-cena">Datos de la Cena {anio}</h2>
          <button type="button" className={styles.iconButton} onClick={onClose}>×</button>
        </div>
        <div className={styles.gcEventFormGrid}>
          {campos.map(([campo, etiqueta]) => (
            <label key={campo}>
              {etiqueta}
              <input value={datos[campo] || ""} onChange={(event) => actualizar(campo, event.target.value)} />
            </label>
          ))}
          <label className={styles.gcEventFullField}>
            Leyenda tarjeta titular
            <textarea rows="3" value={datos.leyendaTitular || ""} onChange={(event) => actualizar("leyendaTitular", event.target.value)} />
          </label>
          <label className={styles.gcEventFullField}>
            Leyenda tarjeta acompañante
            <textarea rows="3" value={datos.leyendaAcompanante || ""} onChange={(event) => actualizar("leyendaAcompanante", event.target.value)} />
          </label>
        </div>
        <div className={styles.modalActions}>
          <button type="button" className={styles.secondaryButton} onClick={onClose}>Cancelar</button>
          <button type="submit" className={styles.primaryButton}>Guardar datos</button>
        </div>
      </form>
    </div>
  );
};

export default CenaDatosEventoDialog;
