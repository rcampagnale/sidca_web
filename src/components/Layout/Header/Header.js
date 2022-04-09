import React from 'react';
import styles from "../styles.module.css";
import AdminHeader from './AdminHeader/AdminHeader';
import PrivateHeader from './PrivateHeader/PrivateHeader';
import PublicHeader from './PublicHeader/PublicHeader';

const HeaderUser = ({ type }) => {

    return (
        <div
            className={styles.header}
        >
            {
                type === "Public" &&
                <PublicHeader />
            }
            {
                type === "Private" &&
                <PrivateHeader />
            }
            {
                type === "Admin" &&
                <AdminHeader />
            }
        </div>
    )
}

export default HeaderUser;
