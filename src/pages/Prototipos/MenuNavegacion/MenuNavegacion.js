import React from "react";
import logo from "../../../assets/img/logo-01.png";
import portada from "../../../assets/img/somos3.jpg";
import styles from "./MenuNavegacion.module.css";

const menuItems = [
  ["pi-home", "Inicio"],
  ["pi-id-card", "Credencial"],
  ["pi-book", "Capacitaciones"],
  ["pi-briefcase", "Oficina de Gestión"],
  ["pi-users", "Nosotros"],
  ["pi-star", "Convenios"],
  ["pi-envelope", "Contacto"],
];

const MenuItems = ({ mobile = false }) =>
  menuItems.map(([icon, label], index) => (
    <span
      className={`${styles.menuItem} ${
        index === 0 ? styles.activeItem : ""
      } ${mobile ? styles.mobileItem : ""}`}
      key={label}
    >
      <i className={`pi ${icon}`} aria-hidden="true" />
      <span>{label}</span>
    </span>
  ));

const MenuNavegacion = () => (
  <main className={styles.page}>
    <header className={styles.intro}>
      <span>Nueva simulación</span>
      <h1>Menú institucional flotante</h1>
      <p>
        Una alternativa más limpia, con mejor lectura, jerarquía clara y
        adaptación real para escritorio y celular.
      </p>
    </header>

    <section className={styles.desktopSection}>
      <div className={styles.sectionTitle}>
        <div>
          <small>VISTA DE ESCRITORIO</small>
          <strong>Menú completo sobre la página de inicio</strong>
        </div>
        <span>Propuesta 5</span>
      </div>

      <div className={styles.desktopFrame}>
        <header className={styles.desktopMenu}>
          <div className={styles.logoBlock}>
            <img src={logo} alt="SiDCa" />
            <div>
              <strong>SIDCA</strong>
              <small>Portal de afiliados</small>
            </div>
          </div>

          <nav>
            <MenuItems />
          </nav>

          <div className={styles.accountActions}>
            <button type="button" className={styles.profileButton}>
              <i className="pi pi-user" aria-hidden="true" />
              <span>Mi cuenta</span>
            </button>
            <button
              type="button"
              className={styles.logoutButton}
              aria-label="Cerrar sesión"
            >
              <i className="pi pi-sign-out" aria-hidden="true" />
            </button>
          </div>
        </header>

        <div className={styles.hero}>
          <div className={styles.heroCopy}>
            <span>Bienvenido al portal</span>
            <h2>Todo SIDCA en un solo lugar</h2>
            <p>
              Consultá tus servicios, beneficios, capacitaciones y gestiones.
            </p>
            <button type="button">Ver mi credencial</button>
          </div>
          <img src={portada} alt="Sindicato Docente de Catamarca" />
        </div>

        <div className={styles.quickGrid}>
          <article>
            <i className="pi pi-id-card" aria-hidden="true" />
            <div><strong>Credencial digital</strong><small>Acceso inmediato</small></div>
          </article>
          <article>
            <i className="pi pi-star" aria-hidden="true" />
            <div><strong>Convenios</strong><small>Beneficios vigentes</small></div>
          </article>
          <article>
            <i className="pi pi-book" aria-hidden="true" />
            <div><strong>Capacitaciones</strong><small>Cursos disponibles</small></div>
          </article>
        </div>
      </div>
    </section>

    <section className={styles.mobileSection}>
      <div className={styles.sectionTitle}>
        <div>
          <small>VISTA MÓVIL</small>
          <strong>El mismo menú adaptado a celular</strong>
        </div>
      </div>

      <div className={styles.phone}>
        <header className={styles.phoneHeader}>
          <img src={logo} alt="SiDCa" />
          <button type="button" aria-label="Abrir menú">
            <i className="pi pi-bars" aria-hidden="true" />
          </button>
        </header>
        <div className={styles.phoneMenu}>
          <div className={styles.phoneWelcome}>
            <div className={styles.avatar}>
              <i className="pi pi-user" aria-hidden="true" />
            </div>
            <div>
              <strong>Portal de afiliados</strong>
              <small>Accesos principales</small>
            </div>
          </div>
          <nav><MenuItems mobile /></nav>
          <button type="button" className={styles.mobileLogout}>
            <i className="pi pi-sign-out" aria-hidden="true" />
            Cerrar sesión
          </button>
        </div>
      </div>
    </section>
  </main>
);

export default MenuNavegacion;
