import React from 'react';
import { useHistory } from 'react-router-dom';
import styles from "./PublicHeader.module.css";
import logo from '../../../../assets/img/logo-01.png';

const PublicHeader = () => {

    const history = useHistory();

    return (
        <>
            <a href='#' onClick={() => history.push("/")}>
                <img className={styles.headerLogo} src={logo} alt="SiDCa logo" />
            </a>
            <ul className={styles.headerNav}>
                <li onClick={() => history.push('/admin')}>Administración del Sitio</li>
            </ul>
        </>

    )
}

export default PublicHeader;
