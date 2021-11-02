import React, { useEffect } from "react";
import styles from "./styles.module.css";
import logo from '../../assets/img/logo-01.png';
import Admin from "../../pages/Admin/Admin/Admin";
// import UserActionButton from "components/UserActionsButton/UserActionButton";
// import logoHeader from 'assets/images/logo-header.png'
import Header from "./header/Header";
import Footer from "./footer/Footer";

const PublicLayoutPage = ({ history, children, user }) => {

    return (
        <body style={{ minHeight: "100vh" }}>
            <Header />
            <div className={styles.mainContent}>
                <main>
                    <div className={styles.visibleContent}>
                        {children}
                    </div>
                </main>
            </div>
            <Footer className={styles.footer}/>
        </body>
    );
};

export default PublicLayoutPage