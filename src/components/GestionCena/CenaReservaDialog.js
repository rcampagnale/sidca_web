import React, { useEffect, useState } from "react";
import { buscarAfiliadoCenaPorDni, normalizarDniCena } from "../../services/gestionCenaService";
import styles from "../../pages/Admin/GestionCena/GestionCenaAdmin.module.css";

const CenaReservaDialog = ({ visible, reserva, anio, onClose, onGuardar }) => {
  const [dni, setDni] = useState("");
  const [afiliado, setAfiliado] = useState(null);
  const [cantidad, setCantidad] = useState(1);
  const [mensaje, setMensaje] = useState("");
  const [buscando, setBuscando] = useState(false);

  useEffect(() => {
    if (!visible) return;
    setDni(reserva?.afiliado?.dni || "");
    setAfiliado(reserva?.afiliado || null);
    setCantidad(reserva?.cantidadTarjetas || 1);
    setMensaje("");
  }, [visible, reserva]);

  if (!visible) return null;

  const buscar = async () => {
    const limpio = normalizarDniCena(dni);
    setMensaje("");
    if (!limpio) {
      setMensaje("Ingresá un DNI.");
      return;
    }
    setBuscando(true);
    try {
      const encontrado = await buscarAfiliadoCenaPorDni(limpio);
      if (!encontrado) {
        setAfiliado(null);
        setMensaje("No se encontró el DNI en usuarios ni en nuevoAfiliado.");
        return;
      }
      setDni(encontrado.dni);
      setAfiliado(encontrado);
      setMensaje(`Afiliado encontrado en ${encontrado.origen}.`);
    } catch (error) {
      setMensaje("No se pudo buscar el afiliado.");
    } finally {
      setBuscando(false);
    }
  };

  const guardar = (event) => {
    event.preventDefault();
    onGuardar({ reservaId: reserva?.id || null, afiliado, cantidadTarjetas: cantidad });
  };

  return (
    <div className={styles.modalOverlay} role="dialog" aria-modal="true">
      <form className={styles.modal} onSubmit={guardar}>
        <div className={styles.modalHeader}>
          <h2>{reserva ? "Editar reserva" : "Nueva reserva"} Cena {anio}</h2>
          <button type="button" className={styles.iconButton} onClick={onClose}>×</button>
        </div>
        <label>
          DNI
          <div className={styles.inlineControls}>
            <input
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              value={dni}
              disabled={Boolean(reserva)}
              onChange={(e) => setDni(normalizarDniCena(e.target.value))}
            />
            <button type="button" className={styles.secondaryButton} disabled={buscando || Boolean(reserva)} onClick={buscar}>
              {buscando ? "Buscando..." : "Buscar"}
            </button>
          </div>
        </label>
        {afiliado && (
          <div className={styles.foundBox}>
            <strong>{afiliado.apellido} {afiliado.nombre}</strong>
            <span>DNI {afiliado.dni}</span>
          </div>
        )}
        <label>
          Cantidad de tarjetas
          <input type="number" min="1" value={cantidad} onChange={(e) => setCantidad(Math.max(1, Number(e.target.value || 1)))} />
        </label>
        <p className={styles.helpText}>1 titular y {Math.max(0, Number(cantidad || 1) - 1)} acompañante(s).</p>
        {mensaje && <p className={styles.notice}>{mensaje}</p>}
        <div className={styles.modalActions}>
          <button type="button" className={styles.secondaryButton} onClick={onClose}>Cancelar</button>
          <button type="submit" className={styles.primaryButton} disabled={!afiliado}>Guardar</button>
        </div>
      </form>
    </div>
  );
};

export default CenaReservaDialog;
