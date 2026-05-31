import React from "react";
import styles from "./styles.module.css";
import { Button } from "primereact/button";
import { BsInstagram, BsMessenger } from "react-icons/bs";

const redesSociales = [
  {
    label: "Messenger",
    href: "https://www.messenger.com/t/100021125296788",
    icon: <BsMessenger />,
    className: "messengerButton",
  },
  {
    label: "Instagram",
    href: "https://www.instagram.com/sidcagremio/?hl=es-la",
    icon: <BsInstagram />,
    className: "instagramButton",
  },
  {
    label: "Página Web",
    href: "https://www.sidcagremio.com.ar",
    icon: "pi pi-globe",
    className: "webButton",
  },
];

const contactosWhatsapp = [
  {
    label: "Asesoramiento General",
    href: "https://wa.me/5493834051983",
  },
  {
    label: "Departamento Jurídico",
    href: "https://wa.me/5493834397239",
  },
  {
    label: "SiDCa Gestión Expediente",
    href: "https://wa.me/5493834230813",
  },
  {
    label: "SiDCa Turismo",
    href: "https://wa.me/5493834283151",
  },
  {
    label: "Casa del Docente",
    href: "https://wa.me/5493834250139",
  },
  {
    label: "SiDCa Radio",
    href: "https://wa.me/5493834220295",
  },
  {
    label: "Hotelería Interprovincial",
    href: "https://wa.me/5493835406450",
  },
  {
    label: "Secretaría de Capacitación",
    href: "https://wa.me/5493834012228",
  },
  {
    label: "Soporte Técnico",
    href: "https://wa.me/5493832437803",
  },
  {
    label: "Afiliado Adherente",
    href: "https://wa.me/5493834539754",
  },
  {
    label: "Entrega de Certificados",
    href: "https://wa.me/5493834325816",
  },
];

const Contacto = () => {
  return (
    <main className={styles.mainSection}>
      <section className={styles.hero}>
        <span className={styles.badge}>Canales oficiales de atención</span>

        <h1 className={styles.title}>Contáctanos</h1>

        <p className={styles.lead}>
          Elegí el área correspondiente para comunicarte con SiDCa de manera
          rápida y directa.
        </p>
      </section>

      <section className={styles.contentFlex}>
        {/* Redes Sociales */}
        <article className={styles.panel}>
          <div className={styles.panelHeader}>
            <div className={styles.iconCircle}>
              <i className="pi pi-share-alt" />
            </div>

            <div>
              <h2 className={styles.subTitle}>Redes Sociales</h2>
              <p className={styles.sectionDescription}>
                Seguinos y accedé a las novedades institucionales.
              </p>
            </div>
          </div>

          <div className={styles.socialGrid}>
            {redesSociales.map((red) => (
              <a
                key={red.label}
                href={red.href}
                className={styles.socialLink}
                target="_blank"
                rel="noopener noreferrer"
              >
                <Button
                  label={red.label}
                  icon={red.icon}
                  className={`${styles.socialButton} ${styles[red.className]}`}
                />
              </a>
            ))}
          </div>
        </article>

        {/* WhatsApp */}
        <article className={styles.panel}>
          <div className={styles.panelHeader}>
            <div className={`${styles.iconCircle} ${styles.whatsappCircle}`}>
              <i className="pi pi-phone" />
            </div>

            <div>
              <h2 className={styles.subTitle}>WhatsApp</h2>
              <p className={styles.sectionDescription}>
                Contactos por área para una atención más ordenada.
              </p>
            </div>
          </div>

          <div className={styles.whatsappGrid}>
            {contactosWhatsapp.map((contacto) => (
              <a
                key={contacto.label}
                className={styles.whatsappBtn}
                href={contacto.href}
                target="_blank"
                rel="noopener noreferrer"
              >
                <Button
                  icon="pi pi-whatsapp"
                  label={contacto.label}
                  className={styles.whatsappButton}
                />
              </a>
            ))}
          </div>
        </article>
      </section>

      <section className={styles.addressCard}>
        <div className={styles.addressIcon}>
          <i className="pi pi-map-marker" />
        </div>

        <div className={styles.addressContent}>
          <h3>Sede Central</h3>
          <p>
            Ayacucho 227, 1° piso, San Fernando del Valle de Catamarca,
            Catamarca CP 4700
          </p>
        </div>

        <a
          className={styles.mapLink}
          href="https://www.google.com/maps/search/?api=1&query=Ayacucho+227+San+Fernando+del+Valle+de+Catamarca"
          target="_blank"
          rel="noopener noreferrer"
        >
          <Button
            label="Ver ubicación"
            icon="pi pi-map"
            className={styles.mapButton}
          />
        </a>
      </section>
    </main>
  );
};

export default Contacto;