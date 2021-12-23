import React from 'react';
import logo from '../../assets/img/logo-01.png';
import styles from "./styles.module.css";

const Home = () => {
    return (
        <div className={styles.imgContainer}>
            <img className={styles.img} src={logo} alt="Logo de SiDCa"></img>
        </div> 
    )
}

export default Home