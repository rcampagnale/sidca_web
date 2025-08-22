import React from "react";
import styles from "./styles.module.css";
import { useDispatch, useSelector } from "react-redux";
import { useForm } from "../../hooks/useForm";
import { authenticateUser } from "../../redux/reducers/user/actions";
import { InputText } from "primereact/inputtext";
import { Button } from "primereact/button";
import logo from "../../assets/img/logo-01.png";
import { Spinner } from "../../components/Spinner/Spinner";
import { useHistory } from "react-router-dom";
import "primeicons/primeicons.css";

const LoginUser = () => {
  const dispatch = useDispatch();
  const history = useHistory();
  const user = useSelector((state) => state.user);

  const initialform = { dni: "" };
  const [form, handleInputChange, reset] = useForm(initialform);

  const handleSubmit = async (e) => {
    e.preventDefault();
    await dispatch(authenticateUser(form));
    reset();
  };

  const handleAfiliarse = () => {
    history.push("/afiliacion"); // ajusta la ruta si corresponde
  };

  const handleSoporte = () => {
    // Reemplaza por el número real con código de país y área, sin signos
    window.open("https://wa.me/5493834000000", "_blank");
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

          <div style={{ display: "flex", justifyContent: "center", minHeight: 28 }}>
            {user.processing && <Spinner />}
            {user.status === "AUTH_FAILURE" && (
              <small className="p-error">{user.msg}</small>
            )}
          </div>

          {/* Grupo de botones con gap consistente */}
          <div className={styles.buttonGroup}>
            <Button type="submit" label="Ingresar" className={`${styles.btnBase} ${styles.btnIngresar}`} />

            <Button type="button" label="Afiliarse" onClick={handleAfiliarse}
              className={`${styles.btnBase} ${styles.btnAfiliarse}`} />

            <Button
              type="button"
              label="Soporte Técnico"
              icon="pi pi-whatsapp"
              iconPos="right"               // ícono a la derecha del texto
              onClick={handleSoporte}
              className={`${styles.btnBase} ${styles.btnSoporte}`}
            />
          </div>
        </form>
      </div>
    </div>
  );
};

export default LoginUser;

