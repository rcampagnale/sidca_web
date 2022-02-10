import React from 'react';
import { useHistory } from 'react-router';
import styles from './styles.module.css';
import logo from '../../../assets/img/logo-01.png';

const Admin = () => {

    const history = useHistory();

    return (
        <div className={styles.container}>
            <h1 className={styles.title}>Página Administrativa de SiDCa</h1>
            <img className={styles.image} src={logo} alt="SidCa"></img>
        </div>
    )
}

export default Admin;