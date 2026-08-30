import React from "react";
import { useHistory } from "react-router-dom";
import logo from "../../assets/img/logo-01.png";
import "../../styles/institutional.css";
import styles from "./SeleccionAccesoAdministracion.module.css";

const SeleccionAccesoAdministracion = () => {
  const history = useHistory();

  return (
    <main className={styles.pagina}>
      <div className={styles.contenido}>
        <header className={styles.encabezado}>
          <img className={styles.logo} src={logo} alt="SiDCa" />
          <span className={styles.etiqueta}>ACCESOS INSTITUCIONALES</span>
          <h1>Administración y Gestión Institucional</h1>
          <p>
            Seleccioná el tipo de acceso para ingresar a las herramientas de
            administración y gestión del Sindicato Docente de Catamarca.
          </p>
        </header>

        <section className={styles.tarjetas} aria-label="Opciones de acceso">
          <article className={styles.tarjeta}>
            <div className={styles.tarjetaContenido}>
              <span className={styles.tarjetaEtiqueta}>SISTEMA ADMINISTRATIVO</span>
              <h2>Administrador de SiDCa</h2>
              <p>Administración general del sistema y herramientas de gestión de SiDCa.</p>
              <button type="button" onClick={() => history.push("/admin/login")}>
                Ingresar <i className="pi pi-arrow-right" aria-hidden="true" />
              </button>
            </div>
          </article>

          <article className={styles.tarjeta}>
            <div className={styles.tarjetaContenido}>
              <span className={styles.tarjetaEtiqueta}>PERSONAL AUTORIZADO</span>
              <h2>Gestión Institucional</h2>
              <p>Acceso a las herramientas y procesos de gestión institucional.</p>
              <button type="button" onClick={() => history.push("/validar-cena")}>
                Ingresar <i className="pi pi-arrow-right" aria-hidden="true" />
              </button>
            </div>
          </article>
        </section>

        <button
          type="button"
          className={styles.regresar}
          onClick={() => history.push("/")}
        >
          <i className="pi pi-arrow-left" aria-hidden="true" />
          Regresar
        </button>

      </div>
    </main>
  );
};

export default SeleccionAccesoAdministracion;
