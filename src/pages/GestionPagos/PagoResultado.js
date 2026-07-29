import React, { useEffect, useMemo, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { consultarEstadoPago } from "../../services/mercadoPagoService";
import styles from "./GestionPagos.module.css";

const getTitle = (pathname) => {
  if (pathname.includes("pendiente")) return "Pago pendiente";
  if (pathname.includes("error")) return "No se pudo completar el pago";
  return "Resultado del pago";
};

const getIntro = (pathname) => {
  if (pathname.includes("pendiente")) {
    return "Estamos verificando el estado del pago. Si Mercado Pago lo confirma, el comprobante aparecerá en tu historial.";
  }
  if (pathname.includes("error")) {
    return "El pago no fue aprobado o se interrumpió el proceso. Podés volver a Gestión de Pagos e intentarlo nuevamente.";
  }
  return "Estamos verificando el estado del pago con el backend de SIDCA.";
};

const PagoResultado = () => {
  const location = useLocation();
  const [estado, setEstado] = useState("verificando");
  const [mensaje, setMensaje] = useState("");

  const params = useMemo(() => new URLSearchParams(location.search), [location.search]);
  const pagoId = params.get("pagoId") || params.get("external_reference");

  useEffect(() => {
    if (!pagoId) {
      setEstado("pendiente");
      setMensaje(
        "No recibimos un identificador interno del pago. De todos modos, el webhook del backend puede actualizarlo cuando Mercado Pago confirme la operación."
      );
      return;
    }

    consultarEstadoPago(pagoId)
      .then((respuesta) => {
        const pago = respuesta?.pago || respuesta?.data || respuesta;
        setEstado(String(pago?.estado || "pendiente").toLowerCase());
        setMensaje(
          "La información fue consultada al backend. El estado final siempre depende de la confirmación de Mercado Pago."
        );
      })
      .catch((err) => {
        setEstado("pendiente");
        setMensaje(
          err.message ||
            "No pudimos consultar el estado en este momento. Revisá nuevamente desde Gestión de Pagos."
        );
      });
  }, [pagoId]);

  return (
    <main className={styles.page}>
      <section className={styles.hero}>
        <p className={styles.kicker}>Mercado Pago</p>
        <h1>{getTitle(location.pathname)}</h1>
        <p>{getIntro(location.pathname)}</p>
      </section>

      <section className={styles.panel}>
        <div className={styles.sectionTitle}>
          <div>
            <p className={styles.kicker}>Verificación segura</p>
            <h2>Estado: {estado}</h2>
          </div>
        </div>
        <p className={styles.empty}>{mensaje || "Estamos verificando el estado del pago."}</p>
        <div className={styles.modalActions}>
          <Link className={styles.secondaryButton} to="/gestion-pagos">
            Volver a Gestión de Pagos
          </Link>
        </div>
      </section>
    </main>
  );
};

export default PagoResultado;
