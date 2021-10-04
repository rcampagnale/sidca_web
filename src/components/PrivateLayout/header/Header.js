import React from 'react';
import styles from "../styles.module.css";
import logo from '../../../assets/img/logo-01.png';

const Header = () => {
    return (
        <div>
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
        </div>
    )
}

export default Header;

