import React from 'react';
import styles from "../styles.module.css";
import logo from '../../../assets/img/logo-01.png';
import { Avatar } from 'primereact/avatar';

const Header = () => {
    return (
        <div>
            <div
                style={{height:'100%'}}
            >
                <header>
                    <div className={styles.avatar}>
                        <div>
                            <Avatar icon="pi pi-user" className="p-mr-2" size="large" shape="circle" />
                        </div>
                        <p className={styles.textIcon}>Admin</p>
                    </div>
                    <p className={styles.adminPanel}>Admin Panel</p>
                    {/* <img src={logo} className={styles.logo}/> */}
                </header>
                {/* <a onClick={()=>history.push('/')} className={styles.logo}>
                    <img src={logoHeader} alt="logo-catamarca" width="100%" height="100%" />    
                </a> */}
                {/* <UserActionButton
                    history={history}
                ></UserActionButton>      */}
            </div>
        </div>
    )
}

export default Header;

