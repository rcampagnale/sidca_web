import React from 'react';
import styles from "./PublicHeader.module.css";
import logo from '../../../../assets/img/logo-01.png';

const PublicHeader = () => {

    return (
        <a href='/'>
            <img className={styles.headerLogo} src={logo} alt="SiDCa logo" />
        </a>
    )
}

export default PublicHeader;
