import React from 'react';
import styles from "../styles.module.css";
import { Button } from 'primereact/button';
import { useHistory } from 'react-router';
import { BsInstagram } from "react-icons/bs";

const FooterUser = () => {

    const history = useHistory();
    return (
        <div className="button-demo">
            <div className="card">
                <div className="template">
                    <div className={styles.footer}>
                        <ul className={styles.footerList}>
                            <a href="https://www.youtube.com/channel/UCNckvC_ykXt4SuydlGiAo0w"><li><Button icon="pi pi-youtube" className="p-button-rounded p-button-danger" /></li></a>
                            <a href="https://www.facebook.com/sidca.catamarca.73"><li><Button icon="pi pi-facebook" className="p-button-rounded p-button-info" /></li></a>
                            <a href="https://twitter.com/sidcagremio"><li><Button icon="pi pi-twitter" className="p-button-rounded p-button-secondary" /></li></a>                          
                            <a href="https://www.instagram.com/sidcagremio/?hl=es-la"><li><Button icon={BsInstagram} className="p-button-rounded p-button-help" /></li></a>
                        </ul>
                        <div className={styles.footerText}><p>Obten la aplicación SiDCa</p></div>
                        <div className={styles.footerLinks}>
                            <img className={styles.appStore} src="https://miro.medium.com/max/270/1*Crl55Tm6yDNMoucPo1tvDg.png" alt="App Store"/>
                            <a href="https://play.google.com/store/apps/details?id=com.sidca&hl=es_419&gl=US"><img className={styles.playStore} src="https://miro.medium.com/max/270/1*W_RAPQ62h0em559zluJLdQ.png" alt="App Store"/></a>
                        </div>
                        {/* <div className={styles.footerDesktopLinks}>
                        <Button label="Youtube" icon="pi pi-youtube p-px-2" className="p-button-raised p-button-danger" />
                        <Button label="Facebook" icon="pi pi-youtube p-px-2" className="p-button-raised p-button-info" />
                        <Button label="Twitter" icon="pi pi-twitter p-px-2" className="p-button-raised p-button-info"/>
                        <Button label="Instagram" icon="pi pi-camera p-px-2" className="p-button-raised p-button-help"/>
                        <Button label="Escucha Radio SiDCa" icon="pi pi-volume-up p-px-2" className="p-button-raised p-button-warning"/>
                        </div> */}
                    </div>
                </div>
            </div>
        </div>
    )
}

export default FooterUser;