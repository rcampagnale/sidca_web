import React from 'react';
import styles from "../styles.module.css";
import logo from '../../../assets/img/logo-01.png';
import { Button } from 'primereact/button';
import { useHistory } from 'react-router';
import NavUser from './nav/NavUser';

const HeaderUser = () => {

    const history = useHistory();

    return (
        <div>
            <div
                style={{height:'100%'}}
            >
                <div className={styles.upperHeader}>
                    <a href='/'><img className={styles.headerLogo} src={logo} alt="SiDCa logo"/></a>
                    <a href="https://play.google.com/store/apps/details?id=com.sidca&hl=es_419&gl=US"><div className={styles.headerText}>Abrir en app</div></a>
                </div>
                <div className={styles.header}>
                    <div className={styles.hamburger}>
                        <Button icon="pi pi-bars" className="p-button-rounded p-button-warning p-button-text" />
                    </div>
                    <div className={styles.menuIcon}>
                        <Button icon="pi pi-home" className="p-button-rounded p-button-warning" onClick={() => history.push('/')}/>
                    </div>
                    <ul className={styles.headerNav}>
                        <li onClick={() => history.push('/capacitaciones')}>Capacitaciones</li>
                        <li onClick={() => history.push('/casa-del-docente')}>Casa del Docente</li>
                        <li onClick={() => history.push('/contacto')}>Contacto</li>
                        <li onClick={() => history.push('/nosotros')}>Nosotros</li>
                        <li onClick={() => history.push('/novedades')}>Novedades</li>
                        <li onClick={() => history.push('/predio')}>Predio</li>
                        <li onClick={() => history.push('/turismo')}>Turismo</li>
                    </ul>
                    <div className={styles.btnExit}>
                        <Button icon="pi pi-sign-out" className="p-button-rounded p-button-danger mr-2 mb-2" onClick={()=>history.push("/login")}/>
                    </div>
                </div>
                <NavUser />
            </div>
        </div>
    )
}

export default HeaderUser;

