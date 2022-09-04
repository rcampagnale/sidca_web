import React, { useEffect } from "react";
import styles from "./layout.module.scss";
import Header from "./Header/Header";
import Footer from "./Footer/Footer";

const LayoutPage = ({ children, type }) => {

    return (
        <div className={styles.container} >
            <Header type={type} />
            <div className={styles.content}>
                {children}
            </div>
            <Footer type={type} />
        </div>
    );
};

export default LayoutPage
