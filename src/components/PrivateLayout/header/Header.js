import React from 'react';
import styles from "../styles.module.css";
import logo from '../../../assets/img/logo-01.png';
import { Avatar } from 'primereact/avatar';
import { Button } from 'primereact/button';
import { useHistory } from 'react-router';
import Nav from './nav/Nav';

const Header = () => {
    const history = useHistory();
    return (
        <div>
            <div
                style={{height:'100%'}}
            >
                <header>
                    <div className={styles.avatar}>
                        <button className={styles.adminPanel} onClick={()=>history.push('/admin')}>Admin Panel</button>
                    </div>
                    <Nav />
                    <div className={styles.btnExit}>
                        <Button label="Salir" className="p-button-rounded p-button-danger" onClick={()=>history.push("/admin/login")}/>
                    </div>
                    
                </header>

                {/* <img src={logo} className={styles.logo}/> */}

                {/* <a onClick={()=>history.push('/')} className={styles.logo}>
                    <img src={logoHeader} alt="logo-catamarca" width="100%" height="100%" />    
                </a>
                <UserActionButton
                    history={history}
                ></UserActionButton>      */}
            </div>
        </div>
    )
}

export default Header;

