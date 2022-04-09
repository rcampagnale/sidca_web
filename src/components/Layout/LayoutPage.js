import React, { useEffect } from "react";
import styles from "./styles.module.css";
import Header from "./Header/Header";
import Footer from "./Footer/Footer";

const LayoutPage = ({ children, type }) => {

    return (
        <div className={styles.container} >
            <Header type={type}/>
            <div className={styles.mainContent}>
                <main>
                    <div className={styles.visibleContent}>
                        {children}
                    </div>
                </main>
            </div>
            <Footer className={styles.footer} type={type}/>
        </div>
    );
};

export default LayoutPage