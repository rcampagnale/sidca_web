// src/pages/LoginUser/LoginUser.js
import React, { useEffect, useState } from "react";
import styles from "./styles.module.css";
import { useDispatch, useSelector } from "react-redux";
import { useForm } from "../../hooks/useForm";
import { authenticateUser } from "../../redux/reducers/user/actions";
import { InputText } from "primereact/inputtext";
import { Button } from "primereact/button";
import { Dialog } from "primereact/dialog";
import logo from "../../assets/img/logo-01.png";
import { Spinner } from "../../components/Spinner/Spinner";
import { useHistory } from "react-router-dom";
import "primeicons/primeicons.css";
import whatsappLogo from "../../assets/logos/logo wsp.png";

/** Normaliza el DNI: solo números, máx. 12 caracteres */
const normalizeDni = (dniRaw) =>
  String(dniRaw || "")
    .replace(/[^\d]/g, "")
    .slice(0, 12);

/**
 * Detecta si el mensaje corresponde a una cuenta
 * Afiliado en carácter de Adherente SUSPENDIDA.
 */
const isSuspendedMessage = (msg) => {
  if (typeof msg !== "string") return false;
  const text = msg.toLowerCase();
  return (
    text.includes("afiliado en carácter de adherente") &&
    text.includes("suspendida")
  );
};

// Datos de WhatsApp del Área Afiliado Adherente
const WHATSAPP_NUMBER = "5493832437803";
const WHATSAPP_BASE_MESSAGE =
  "Estimados/as, solicito ayuda para normalizar mi situación de Afiliado Adherente y restablecer el acceso a la app/web SiDCa. Muchas gracias.";

const LoginUser = () => {
  const dispatch = useDispatch();
  const history = useHistory();
  const user = useSelector((state) => state.user);

  const initialform = { dni: "" };
  const [form, handleInputChange, reset] = useForm(initialform);

  // Estado del modal de suspensión
  const [showSuspendedDialog, setShowSuspendedDialog] = useState(false);
  const [suspendedMsg, setSuspendedMsg] = useState("");

  // ✅ Nuevo: solo abrimos modal si hubo intento de login en esta visita
  const [hasAttemptedLogin, setHasAttemptedLogin] = useState(false);

  const suspended = isSuspendedMessage(user.msg);

  useEffect(() => {
    // Si todavía no hubo intento de login en esta visita, no mostramos nada
    if (!hasAttemptedLogin) return;

    if (user.status === "AUTH_FAILURE" && suspended) {
      setSuspendedMsg(user.msg || "");
      setShowSuspendedDialog(true);
    }
  }, [user.status, user.msg, suspended, hasAttemptedLogin]);

  const handleSubmit = async (e) => {
    e.preventDefault();

    const dniNormalizado = normalizeDni(form.dni);
    if (!dniNormalizado) {
      alert("Ingresá un DNI válido (solo números).");
      return;
    }

    // Marcamos que hubo un intento de login en esta visita
    setHasAttemptedLogin(true);

    const res = await dispatch(authenticateUser({ dni: dniNormalizado }));
    if (res?.ok) {
      history.push("/home"); // Ruta de inicio del afiliado
      reset();
    }
  };

  const handleAfiliarse = () => {
    history.push("/afiliacion"); // ajusta la ruta si corresponde
  };

  const handleSoporte = () => {
    const url = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(
      WHATSAPP_BASE_MESSAGE
    )}`;
    window.open(url, "_blank");
  };

  const handleCloseSuspendedDialog = () => {
    setShowSuspendedDialog(false);
    // opcional: si querés, podés resetear el flag local
    // setHasAttemptedLogin(false);
  };

  return (
    <div className={styles.visibleContent}>
      <div className={styles.container}>
        <section className={styles.brandPanel}>
          <div className={styles.brandGlowTop} />
          <div className={styles.brandGlowBottom} />
          <div className={styles.brandContent}>
            <img className={styles.brandLogo} src={logo} alt="Logo de SiDCa" />

            <div className={styles.brandCopy}>
              <span className={styles.eyebrow}>Portal de afiliados</span>
              <h1>Tu espacio sindical, siempre cerca.</h1>
              <p>
                Accedé a tu credencial, convenios, beneficios y servicios del
                Sindicato Docente de Catamarca.
              </p>
            </div>

            <div className={styles.benefits}>
              <span>
                <i className="pi pi-id-card" aria-hidden="true" />
                Credencial digital
              </span>
              <span>
                <i className="pi pi-star" aria-hidden="true" />
                Convenios y beneficios
              </span>
              <span>
                <i className="pi pi-briefcase" aria-hidden="true" />
                Oficina de gestión
              </span>
              <span>
                <i className="pi pi-book" aria-hidden="true" />
                Capacitaciones
              </span>
            </div>
          </div>
        </section>

        <section className={styles.accessPanel}>
          <form onSubmit={handleSubmit} className={styles.formAdmin}>
            <div className={styles.mobileLogo}>
              <img src={logo} alt="Logo de SiDCa" />
            </div>

            <span className={styles.formEyebrow}>Acceso seguro</span>
            <h2 className={styles.title}>Ingresar a mi cuenta</h2>
            <p className={styles.formSubtitle}>
              Escribí tu DNI para acceder al portal de afiliados.
            </p>

            <label className={styles.inputLabel} htmlFor="dni">
              Documento Nacional de Identidad
            </label>
            <span className={`p-input-icon-left ${styles.inputSection}`}>
              <i className="pi pi-id-card" aria-hidden="true" />
              <InputText
                className={styles.inputForm}
                value={form.dni}
                name="dni"
                id="dni"
                type="text"
                inputMode="numeric"
                placeholder="DNI sin puntos"
                onChange={handleInputChange}
              />
            </span>

            <div className={styles.messageArea}>
              {user.processing && <Spinner />}
              {user.status === "AUTH_FAILURE" && !suspended && (
                <small className="p-error">{user.msg}</small>
              )}
            </div>

            <Button
              type="submit"
              label="Ingresar"
              icon="pi pi-arrow-right"
              iconPos="right"
              className={`${styles.btnBase} ${styles.btnIngresar}`}
            />

            <div className={styles.secondaryActions}>
              <button
                type="button"
                className={styles.secondaryButton}
                onClick={handleAfiliarse}
              >
                <i className="pi pi-user-plus" aria-hidden="true" />
                <span>
                  <strong>Quiero afiliarme</strong>
                  <small>Iniciar solicitud</small>
                </span>
              </button>

              <button
                type="button"
                className={`${styles.secondaryButton} ${styles.supportButton}`}
                onClick={handleSoporte}
              >
                <img
                  className={styles.whatsappLogo}
                  src={whatsappLogo}
                  alt=""
                  aria-hidden="true"
                />
                <span>
                  <strong>Soporte técnico</strong>
                  <small>Ayuda por WhatsApp</small>
                </span>
              </button>
            </div>

            <div className={styles.securityNote}>
              <i className="pi pi-shield" aria-hidden="true" />
              Acceso exclusivo para afiliados SIDCA
            </div>
          </form>
        </section>
      </div>

      {/* 🔔 Modal de cuenta suspendida */}
      <Dialog
        header="Cuenta suspendida"
        visible={showSuspendedDialog}
        style={{ width: "90%", maxWidth: "600px" }}
        modal
        onHide={handleCloseSuspendedDialog}
      >
        <div style={{ whiteSpace: "pre-line", marginBottom: 16 }}>
          {suspendedMsg}
        </div>

        <div
          style={{
            display: "flex",
            justifyContent: "flex-end",
            gap: 8,
            marginTop: 8,
          }}
        >
          <Button
            type="button"
            label="Soporte técnico"
            icon="pi pi-whatsapp"
            onClick={handleSoporte}
            className={styles.btnSoporte}
          />
          <Button
            type="button"
            label="Cerrar"
            className="p-button-secondary"
            onClick={handleCloseSuspendedDialog}
          />
        </div>
      </Dialog>
    </div>
  );
};

export default LoginUser;
