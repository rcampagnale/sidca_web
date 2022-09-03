import React, { useState } from 'react';
import { useHistory } from 'react-router';
import { useSelector } from 'react-redux';
import { Button } from 'primereact/button';
import { confirmDialog } from 'primereact/confirmdialog';
import NavUser from './nav/NavUser';
import styles from "./privateHeader.module.scss";
import logo from '../../../../assets/img/logo-01.png';

const PrivateHeader = () => {

    const history = useHistory();

    const [active, setActive] = useState(false);

    const user = useSelector(state => state.user)

    const confirm = () => {
        confirmDialog({
            message: '¿Está seguro de que quiere cerrar sesión?',
            header: 'Cerrar Sesión',
            icon: 'pi pi-exclamation-triangle',
            accept: () => history.push("/logout"),
        });
    };

    return (
        <>
            <a href='/home'>
                <img className={styles.headerLogo} src={logo} alt="SiDCa logo" />
            </a>
            <ul className={styles.headerNav}>
                <li onClick={() => history.push('/capacitaciones')}>Capacitaciones</li>
                {/* {user.profue.cotizante && } */}
                <li onClick={() => history.push('/cuotas')}>Cuotas</li>
                <li onClick={() => history.push('/nosotros')}>Nosotros</li>
                <li onClick={() => history.push('/contacto')}>Contacto</li>
            </ul>
            <div className={styles.btnExit}>
                <Button icon="pi pi-sign-out" className="p-button-rounded p-button-danger mr-2 mb-2" onClick={confirm} />
            </div>
            <div className={styles.hamburger} >
                <Button icon="pi pi-bars" className="p-button-rounded p-button-warning p-button-text" onClick={() => setActive(!active)} />
            </div>
            {
                active &&
                <NavUser active={active} setActive={setActive} user={user} />
            }
        </>
    )
}

export default PrivateHeader;

