import React from "react";
import styles from "./styles.module.css";
import { Button } from "primereact/button";
import { BsInstagram, BsMessenger } from "react-icons/bs";

const Contacto = () => {
  return (
    <div className={styles.mainSection}>
      <div className={styles.title}>Contáctanos</div>
      <div className={styles.contentFlex}>
        {/* Redes Sociales */}
        <div className={styles.firstSection}>
          <div className={styles.subTitle}>Redes Sociales</div>
          <a
            href="https://www.messenger.com/t/100021125296788"
            className={styles.messenger}
          >
            <Button
              label="Messenger"
              icon={BsMessenger}
              className="p-button-raised p-button-info"
            />
          </a>
          <a
            href="https://www.instagram.com/sidcagremio/?hl=es-la"
            className={styles.instagram}
          >
            <Button
              label="Instagram"
              icon={BsInstagram}
              className="p-button-raised p-button-help"
            />
          </a>
          <a
            href="https://www.sidcagremio.com.ar"
            className={styles.web}
            target="_blank"
            rel="noopener noreferrer"
          >
            <Button
              label="Página Web"
              icon="pi pi-globe"
              className="p-button-raised p-button-info"
            />
          </a>
        </div>

        {/* Números de WhatsApp */}
        <div className={styles.secondSection}>
          <div className={styles.subTitle}>Whatsapp</div>
          <a className={styles.whatsappBtn} href="https://wa.me/5493834051983">
            <Button
              icon="pi pi-phone"
              label="Asesoramiento General"
              className="p-button-raised p-button-success"
            />
          </a>
          <a className={styles.whatsappBtn} href="https://wa.me/5493834397239">
            <Button
              icon="pi pi-phone"
              label="Departamento Jurídico"
              className="p-button-raised p-button-success"
            />
          </a>
          <a className={styles.whatsappBtn} href="https://wa.me/5493834230813">
            <Button
              icon="pi pi-phone"
              label="SiDCa Gestión Expediente"
              className="p-button-raised p-button-success"
            />
          </a>
          <a className={styles.whatsappBtn} href="https://wa.me/5493834283151">
            <Button
              icon="pi pi-phone"
              label="SiDCa Turismo"
              className="p-button-raised p-button-success"
            />
          </a>
          <a className={styles.whatsappBtn} href="https://wa.me/5493834250139">
            <Button
              icon="pi pi-phone"
              label="Casa del Docente"
              className="p-button-raised p-button-success"
            />
          </a>
          <a className={styles.whatsappBtn} href="https://wa.me/5493834220295">
            <Button
              icon="pi pi-phone"
              label="SiDCa Radio"
              className="p-button-raised p-button-success"
            />
          </a>
          <a className={styles.whatsappBtn} href="https://wa.me/5493835406450">
            <Button
              icon="pi pi-phone"
              label="Hotelería Interprovincial"
              className="p-button-raised p-button-success"
            />
          </a>
          <a className={styles.whatsappBtn} href="https://wa.me/5493834012228">
            <Button
              icon="pi pi-phone"
              label="Secretaría de Capacitación"
              className="p-button-raised p-button-success"
            />
          </a>
          <a className={styles.whatsappBtn} href="https://wa.me/5493832437803">
            <Button
              icon="pi pi-phone"
              label="Soporte Técnico"
              className="p-button-raised p-button-success"
            />
          </a>
          <a className={styles.whatsappBtn} href="https://wa.me/5493834539754">
            <Button
              icon="pi pi-phone"
              label="Afiliado Adherente"
              className="p-button-raised p-button-success"
            />
          </a>
          <a className={styles.whatsappBtn} href="https://wa.me/5493834325816">
            <Button
              icon="pi pi-phone"
              label="Entrega de Certificados"
              className="p-button-raised p-button-success"
            />
          </a>
        </div>
      </div>

      <p className={styles.text}>
        Sede Central Ayacucho 227 1° piso, San Fernando del Valle de Catamarca,
        Catamarca CP 4700
      </p>
    </div>
  );
};

export default Contacto;
