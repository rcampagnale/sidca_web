import React from 'react'
import styles from './styles.module.css';
import { Button } from 'primereact/button';
import { BsInstagram, BsMessenger } from "react-icons/bs";

const Contacto = () => {
    return (
        <div className={styles.mainSection}>
            <div className={styles.title}>Contáctanos</div>
            <div className={styles.contentFlex}>
                <div className={styles.firstSection}>
                    <div className={styles.subTitle}>Redes Sociales</div>
                    <a href="https://www.messenger.com/t/100021125296788" className={styles.messenger}><Button label="Messenger" icon={BsMessenger} className="p-button-raised p-button-info" /></a>
                    <a href="https://www.instagram.com/sidcagremio/?hl=es-la" className={styles.instagram}><Button label="Instagram" icon={BsInstagram} className="p-button-raised p-button-help" /></a>
                    <a href="https://twitter.com/sidcagremio" className={styles.twitter}><Button label="Twitter" icon="pi pi-twitter p-px-2" className="p-button-raised p-button-info" /></a>
                </div>
                <div>
                    <div className={styles.secondSection}>
                        <div className={styles.subTitle}>Whatsapp</div>
                        <a className={styles.whatsappBtn} href="https://wa.link/7dz542"><Button icon="pi pi-code" label="Asesoramiento Gremial" className="p-button-raised p-button-success" /></a>
                        <a className={styles.whatsappBtn} href="https://wa.link/wptmns"><Button icon="pi pi-phone" label="Departamento Jurídico" className="p-button-raised p-button-success" /></a>
                        <a className={styles.whatsappBtn} href="https://wa.link/dl2c8j"><Button icon="pi pi-phone" label="SiDCa Gestión" className="p-button-raised p-button-success" /></a>
                        <a className={styles.whatsappBtn} href="https://wa.link/7a9p1d"><Button icon="pi pi-phone" label="SiDCa Turismo" className="p-button-raised p-button-success" /></a>
                        <a className={styles.whatsappBtn} href="https://wa.link/7a9p1d"><Button icon="pi pi-phone" label="Casa del Docente" className="p-button-raised p-button-success" /></a>
                        <a className={styles.whatsappBtn} href="https://wa.link/kmlie3"><Button icon="pi pi-phone" label="SiDCa Radio" className="p-button-raised p-button-success" /></a>
                    </div>
                </div>
            </div>
            <p className={styles.text}>Sede Central Ayacucho 227 1° piso, San Fernando del Valle de Catamarca, Catamarca CP 4700</p>
        </div>
    )
}

export default Contacto;