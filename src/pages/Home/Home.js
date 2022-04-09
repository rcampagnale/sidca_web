import React from 'react';
import styles from './styles.module.css';
import logo from '../../assets/img/logo-01.png';

const Home = () => {
    return (
        <div className={styles.visibleContent}>
            <div className={styles.container}>
                <div className={styles.imgContainer}>
                    <img className={styles.img} src={logo} alt="Logo de SiDCa"></img>
                </div>
            </div>
        </div>
    )
}

export default Home;