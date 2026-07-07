import React from "react";
import styles from "./layout.module.scss";
import Header from "./Header/Header";
import Footer from "./Footer/Footer";

const LayoutPage = ({ children, type, fullBleed = false }) => {

    return (
        <div className={styles.container} >
            <Header type={type} />
            <div
                className={`${styles.content} ${
                    fullBleed ? styles.fullBleedContent : ""
                }`}
            >
                {children}
            </div>
            <Footer type={type} />
        </div>
    );
};

export default LayoutPage
