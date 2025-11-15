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

/** Normaliza el DNI: solo números, máx. 12 caracteres */
const normalizeDni = (dniRaw) =>
  String(dniRaw || "")
    .replace(/[^\d]/g, "")
    .slice(0, 12);

// Frase clave para detectar que el error es de suspensión
const SUSPENDED_PREFIX =
  "Estimado/a docente, su afiliación figura como Afiliado en carácter de Adherente";

const LoginUser = () => {
  const dispatch = useDispatch();
  const history = useHistory();
  const user = useSelector((state) => state.user);

  const initialform = { dni: "" };
  const [form, handleInputChange, reset] = useForm(initialform);

  // Estado del modal de suspensión
  const [showSuspendedDialog, setShowSuspendedDialog] = useState(false);
  const [suspendedMsg, setSuspendedMsg] = useState("");

  const isSuspendedMsg =
    typeof user.msg === "string" &&
    user.msg.startsWith(SUSPENDED_PREFIX);

  useEffect(() => {
    if (user.status === "AUTH_FAILURE" && isSuspendedMsg) {
      setSuspendedMsg(user.msg || "");
      setShowSuspendedDialog(true);
    }
  }, [user.status, user.msg, isSuspendedMsg]);

  const handleSubmit = async (e) => {
    e.preventDefault();

    const dniNormalizado = normalizeDni(form.dni);
    if (!dniNormalizado) {
      alert("Ingresá un DNI válido (solo números).");
      return;
    }

    const res = await dispatch(authenticateUser({ dni: dniNormalizado }));
    if (res?.ok) {
      history.push("/home"); // o la ruta que corresponda
      reset();
    }
  };

  const handleAfiliarse = () => {
    history.push("/afiliacion"); // ajusta la ruta si corresponde
  };

  const WHATSAPP_NUMBER = "5493834539754"; // Área Afiliado Adherente
const WHATSAPP_BASE_MESSAGE =
  "Estimados/as, solicito ayuda para normalizar mi situación de Afiliado Adherente y restablecer el acceso a la app/web SiDCa. Muchas gracias.";

const handleSoporte = () => {
  const url = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(
    WHATSAPP_BASE_MESSAGE
  )}`;
  window.open(url, "_blank");
};


  return (
    <div className={styles.visibleContent}>
      <div className={styles.container}>
        <div className={styles.imgContainer}>
          <img className={styles.img} src={logo} alt="Logo de SiDCa" />
        </div>

        <form onSubmit={handleSubmit} className={styles.formAdmin}>
          <h2 className={styles.title}>Iniciar sesión</h2>

          <span className={`p-float-label ${styles.inputSection}`}>
            <InputText
              className={styles.inputForm}
              value={form.dni}
              name="dni"
              id="dni"
              type="text"
              onChange={handleInputChange}
            />
            <label htmlFor="dni">DNI</label>
          </span>

          {/* Mensajes de error solo cuando NO es suspensión
              (la suspensión la mostramos en el modal) */}
          <div
            style={{ display: "flex", justifyContent: "center", minHeight: 28 }}
          >
            {user.processing && <Spinner />}
            {user.status === "AUTH_FAILURE" && !isSuspendedMsg && (
              <small className="p-error">{user.msg}</small>
            )}
          </div>

          {/* Grupo de botones */}
          <div className={styles.buttonGroup}>
            <Button
              type="submit"
              label="Ingresar"
              className={`${styles.btnBase} ${styles.btnIngresar}`}
            />

            <Button
              type="button"
              label="Afiliarse"
              onClick={handleAfiliarse}
              className={`${styles.btnBase} ${styles.btnAfiliarse}`}
            />

            <Button
              type="button"
              label="Soporte Técnico"
              icon="pi pi-whatsapp"
              iconPos="right"
              onClick={handleSoporte}
              className={`${styles.btnBase} ${styles.btnSoporte}`}
            />
          </div>
        </form>
      </div>

      {/* 🔔 Modal de cuenta suspendida */}
      <Dialog
        header="Cuenta suspendida"
        visible={showSuspendedDialog}
        style={{ width: "90%", maxWidth: "600px" }}
        modal
        onHide={() => setShowSuspendedDialog(false)}
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
            label="Afiliado Adherente"
            icon="pi pi-whatsapp"
            onClick={handleSoporte}
            className={styles.btnSoporte}
          />
          <Button
            type="button"
            label="Cerrar"
            className="p-button-secondary"
            onClick={() => setShowSuspendedDialog(false)}
          />
        </div>
      </Dialog>
    </div>
  );
};

export default LoginUser;

