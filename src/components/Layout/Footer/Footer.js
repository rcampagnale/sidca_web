import React from 'react';
import styles from "./Footer.module.css";
import { Button } from 'primereact/button';
import { useHistory } from 'react-router';
import { BsInstagram } from "react-icons/bs";
import { BiRadio } from "react-icons/bi";

const Footer = () => {

    const history = useHistory();
    return (
        <div className={styles.footer}>
            <ul className={styles.footerList}>
                <a href="https://www.youtube.com/channel/UCNckvC_ykXt4SuydlGiAo0w"><li><Button icon="pi pi-youtube" className="p-button-rounded p-button-danger" /></li></a>
                <a href="https://www.facebook.com/sidca.catamarca.73"><li><Button icon="pi pi-facebook" className="p-button-rounded p-button-info" /></li></a>
                <a href="https://twitter.com/sidcagremio"><li><Button icon="pi pi-twitter" className="p-button-rounded p-button-secondary" /></li></a>
                <a href="https://www.instagram.com/sidcagremio/?hl=es-la"><li><Button icon={BsInstagram} className="p-button-rounded p-button-help" /></li></a>
                <a href="http://server.gostreaming.com.ar:8025/stream.aac"><li><Button icon={BiRadio} className="p-button-rounded p-button-warning" /></li></a>
            </ul>
            <div className={styles.footerText}>
                <p>Sidca Gremio &#169; 2022</p>
                {/* <div className={styles.footerLinks}>
                                <img className={styles.appStore} src="https://miro.medium.com/max/270/1*Crl55Tm6yDNMoucPo1tvDg.png" alt="App Store"/>
                                <a href="https://play.google.com/store/apps/details?id=com.sidca&hl=es_419&gl=US"><img className={styles.playStore} src="https://miro.medium.com/max/270/1*W_RAPQ62h0em559zluJLdQ.png" alt="App Store"/></a>
                            </div> */}
            </div>
        </div>
    )
}

export default Footer;