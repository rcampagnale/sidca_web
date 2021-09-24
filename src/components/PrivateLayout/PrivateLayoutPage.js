import React, { useEffect } from "react";
import styles from "./styles.module.css";
import logo from '../../assets/img/logo-01.png';
// import UserActionButton from "components/UserActionsButton/UserActionButton";
// import logoHeader from 'assets/images/logo-header.png'

export const PrivateLayoutPage = ({ history, children, user }) => {


    return (
        <div style={{ minHeight: "100vh" }}>
            <header
                style={{height:'100%'}}
            >
                <div className={styles.header}>
                    <img src={logo} className={styles.logo}/>
                </div>
                {/* <a onClick={()=>history.push('/')} className={styles.logo}>
                    <img src={logoHeader} alt="logo-catamarca" width="100%" height="100%" />    
                </a> */}
                {/* <UserActionButton
                    history={history}
                ></UserActionButton>      */}
            </header>
            <div
                className={styles.siteLayoutBackground}
                style={{
                    minHeight: "auto",
                }}
            >
                {children}
            </div>
            <footer style={{ textAlign: "center", backgroundColor: '#fcfcfc' }}>
                <p>
                    <b>SiDCa Gremio 2021</b>
                </p>
            </footer>
        </div>
    );
};
