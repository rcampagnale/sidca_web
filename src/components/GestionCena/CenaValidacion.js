import React, { useCallback, useEffect, useState } from "react";
import { QrReader } from "react-qr-reader";
import { esTarjetaVigenteCena, estaTarjetaAcreditadaCena, formatearDniCena, obtenerTarjetaPorToken, validarIngresoCena } from "../../services/gestionCenaService";
import styles from "../../pages/Admin/GestionCena/GestionCenaAdmin.module.css";

const estadoDe = (tarjeta) => {
  if (!tarjeta) return "no-valido";
  if (!esTarjetaVigenteCena(tarjeta)) return "anulada";
  if (estaTarjetaAcreditadaCena(tarjeta)) return "ya-utilizada";
  return "valida";
};

const titulos = {
  valida: "✓ TARJETA VÁLIDA",
  registrada: "✓ INGRESO REGISTRADO",
  "ya-utilizada": "⚠ TARJETA YA UTILIZADA",
  anulada: "⛔ TARJETA ANULADA",
  "no-valido": "✕ QR NO VÁLIDO",
};

const CenaValidacion = ({ anio, usuario, tokenInicial = "" }) => {
  const [token, setToken] = useState(tokenInicial);
  const [tarjeta, setTarjeta] = useState(null);
  const [estado, setEstado] = useState("");
  const [escaneando, setEscaneando] = useState(false);
  const [cargando, setCargando] = useState(false);

  const consultar = useCallback(async (valor) => {
    const limpio = String(valor || "").trim().split("/").filter(Boolean).pop();
    if (!limpio) return;
    setToken(limpio);
    setCargando(true);
    try {
      const encontrada = await obtenerTarjetaPorToken(anio, limpio);
      setTarjeta(encontrada);
      setEstado(estadoDe(encontrada));
      setEscaneando(false);
    } finally {
      setCargando(false);
    }
  }, [anio]);

  const validar = async () => {
    setCargando(true);
    try {
      const registrada = await validarIngresoCena({ anio, token, usuario });
      setTarjeta(registrada);
      setEstado("registrada");
    } catch (error) {
      setTarjeta(error.tarjeta || tarjeta);
      setEstado(error.code || "no-valido");
    } finally {
      setCargando(false);
    }
  };

  const nombre = `${tarjeta?.afiliadoApellido || ""} ${tarjeta?.afiliadoNombre || ""}`.trim();

  useEffect(() => {
    if (tokenInicial) consultar(tokenInicial);
  }, [consultar, tokenInicial]);

  return (
    <section className={`${styles.gcPanel} ${styles.validationPanel}`}>
      <div className={styles.gcPanelHeader}>
        <h2>Validación</h2>
        <button type="button" className={`${styles.primaryButton} ${styles.scanButton}`} onClick={() => setEscaneando((v) => !v)}>
          {escaneando ? "Detener cámara" : "Escanear QR"}
        </button>
      </div>
      {escaneando && (
        <div className={styles.readerBox}>
          <QrReader
            constraints={{ facingMode: "environment" }}
            scanDelay={500}
            onResult={(result) => {
              if (result?.getText) consultar(result.getText());
            }}
          />
        </div>
      )}
      <div className={styles.inlineControls}>
        <input value={token} onChange={(e) => setToken(e.target.value)} placeholder="Token o URL del QR" />
        <button type="button" className={styles.secondaryButton} disabled={cargando} onClick={() => consultar(token)}>
          Consultar
        </button>
      </div>
      {estado && (
        <div className={`${styles.validationResult} ${styles[`qr${estado.replace("-", "")}`]}`}>
          <h3>{titulos[estado] || titulos["no-valido"]}</h3>
          {tarjeta && (
            <>
            <strong>{tarjeta.tipo === "titular" ? "AFILIADO/A" : `ACOMPAÑANTE ${tarjeta.numeroAcompanante} DE ${tarjeta.totalAcompanantes}`}</strong>
              <p>{nombre}</p>
              <p>DNI {formatearDniCena(tarjeta.afiliadoDni)}</p>
              <p>{tarjeta.codigoVisible}</p>
              {estado === "anulada" && tarjeta.motivoAnulacion && <p>Motivo: {tarjeta.motivoAnulacion}</p>}
              {tarjeta.fechaValidacion && <small>Primera validación registrada previamente.</small>}
            </>
          )}
          {estado === "valida" && (
            <button type="button" className={styles.validateButton} disabled={cargando} onClick={validar}>
              VALIDAR INGRESO
            </button>
          )}
          {estado === "registrada" && (
            <button type="button" className={styles.secondaryButton} onClick={() => { setToken(""); setTarjeta(null); setEstado(""); setEscaneando(true); }}>
              ESCANEAR SIGUIENTE
            </button>
          )}
        </div>
      )}
    </section>
  );
};

export default CenaValidacion;
