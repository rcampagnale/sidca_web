import React, { useState } from 'react';
import styles from "../styles.module.css";
import logo from '../../../assets/img/logo-01.png';
import { useHistory } from 'react-router';

const HeaderUser = () => {

    const history = useHistory();

    const [active, setActive] = useState(false);

    return (
        <div>
            <div
                style={{ height: '100%' }}
            >
                <div className={styles.header}>
                    <div className={styles.upperHeader}>
                        <a href='/'><img className={styles.headerLogo} src={logo} alt="SiDCa logo" /></a>
                        <a href="https://play.google.com/store/apps/details?id=com.sidca&hl=es_419&gl=US"><div className={styles.headerText}>Abrir en app</div></a>
                    </div>
                </div>
            </div>
        </div>
    )
}

export default HeaderUser;

