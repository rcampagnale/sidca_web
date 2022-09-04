import React, { useState } from 'react';
import styles from "./AdminHeader.module.css";
import logo from '../../../../assets/img/logo-01.png';
import { Button } from 'primereact/button';
import { useHistory } from 'react-router';
import NavUser from './nav/NavUser';
import { confirmDialog } from 'primereact/confirmdialog';

const AdminHeader = () => {

    const history = useHistory();

    const [active, setActive] = useState(false);

    const confirm = () => {
        confirmDialog({
            message: '¿Está seguro de que quiere cerrar sesión?',
            header: 'Cerrar Sesión',
            icon: 'pi pi-exclamation-triangle',
            accept: () => history.push("/admin/logout"),
        });
    };

    return (
        <>
            <a href='#' onClick={()=>history.push("/admin")}>
                <img className={styles.headerLogo} src={logo} alt="SiDCa logo" />
            </a>
            <ul className={styles.headerNav}>
                <li onClick={() => history.push('/admin/enlaces')}>Enlaces</li>
                <li onClick={() => history.push('/admin/usuarios')}>Usuarios</li>
                <li onClick={() => history.push('/admin/cursos')}>Cursos</li>
                <li onClick={() => history.push('/admin/asesoramiento')}>Asesoramiento</li>
                <li onClick={() => history.push('/admin/novedades')}>Novedades</li>
                <li onClick={() => history.push('/admin/nuevos-afiliados')}>Afiliados</li>
            </ul>
            <div className={styles.btnExit}>
                <Button icon="pi pi-sign-out" className="p-button-rounded p-button-danger mr-2 mb-2" onClick={confirm} />
            </div>
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

export default AdminHeader;

