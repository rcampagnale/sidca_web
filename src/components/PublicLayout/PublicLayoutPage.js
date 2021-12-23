import React, { useEffect } from "react";
import styles from "./styles.module.css";
import logo from '../../assets/img/logo-01.png';
import Admin from "../../pages/Admin/Admin/Admin";
// import UserActionButton from "components/UserActionsButton/UserActionButton";
// import logoHeader from 'assets/images/logo-header.png'
import HeaderUser from "./header/HeaderUser";
import FooterUser from "./footer/FooterUser";

const PublicLayoutPage = ({ history, children, user }) => {

    return (
        <body style={{ minHeight: "100vh"}}>
            <HeaderUser className={styles.header}/>
            <div className={styles.mainContent}>
                <main>
                    <div className={styles.visibleContent}>
                        {children}
                    </div>
                </main>
            </div>
            <FooterUser className={styles.footer}/>
        </body>
    );
};

export default PublicLayoutPage