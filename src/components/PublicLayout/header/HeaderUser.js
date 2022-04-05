import React, { useState } from 'react';
import styles from "../styles.module.css";
import logo from '../../../assets/img/logo-01.png';
import { Button } from 'primereact/button';
import { useHistory } from 'react-router';
import NavUser from './nav/NavUser';

const HeaderUser = () => {

    const history = useHistory();

    const [active, setActive] = useState(false);

    return (
        <div>
            <div
                style={{height:'100%'}}
            >
                <div className={styles.header}>
                    <a href="https://play.google.com/store/apps/details?id=com.sidca&hl=es_419&gl=US"><div className={styles.headerText}>Abrir en app</div></a>
                    <div className={styles.menuIcon}>
                        <Button icon="pi pi-home" className="p-button-rounded p-button-warning" onClick={() => history.push('/')}/>
                    </div>
                </div>
            </div>
        </div>
    )
}

export default HeaderUser;

