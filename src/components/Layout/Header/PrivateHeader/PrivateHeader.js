import React, { useState } from 'react';
import styles from "./PrivateHeader.module.css";
import logo from '../../../../assets/img/logo-01.png';
import { Button } from 'primereact/button';
import { useHistory } from 'react-router';
import NavUser from './nav/NavUser';

const PrivateHeader = () => {

    const history = useHistory();

    const [active, setActive] = useState(false);

    return (
        <>
            <a href='/home'>
                <img className={styles.headerLogo} src={logo} alt="SiDCa logo" />
            </a>
            <ul className={styles.headerNav}>
                <li onClick={() => history.push('/capacitaciones')}>Capacitaciones</li>
                <li onClick={() => history.push('/casa-del-docente')}>Casa del Docente</li>
                <li onClick={() => history.push('/contacto')}>Contacto</li>
                <li onClick={() => history.push('/nosotros')}>Nosotros</li>
                <li onClick={() => history.push('/novedades')}>Novedades</li>
                <li onClick={() => history.push('/predio')}>Predio</li>
                <li onClick={() => history.push('/turismo')}>Turismo</li>
            </ul>
            <div className={styles.hamburger} >
                <Button icon="pi pi-bars" className="p-button-rounded p-button-warning p-button-text" onClick={() => setActive(!active)} />
            </div>
            {
                active &&
                <NavUser active={active} setActive={setActive} />
            }
        </>
    )
}

export default PrivateHeader;

