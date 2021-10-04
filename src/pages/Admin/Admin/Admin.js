import React from 'react'
// import { useHistory } from 'react-router'
import global from '../../../assets/styles/global.module.css';
import styles from './styles.module.css';
import logo from '../../../assets/img/logo-01.png';

const Admin = () => {

    // const history = useHistory();

    return (
        <div className={global.container}>
            <h1 className={styles.title}>Página Administrativa de SiDCa</h1>
            <img src={logo} className={styles.logo}/>
        </div>
        // <div className={global.container}>
        //      <h1 className={global.title}>Página Administrativa de SiDCa</h1>
        //     <h3 className={global.subTitle}>Agregar</h3>
        //     <div className={styles.container}>
                
        //         <button 
        //             onClick={()=>history.push("/admin/nueva-novedad")}
        //             className={global.btn}
        //         >
        //             Novedad
        //         </button>
        //     </div>
        // </div>
    )
}

export default Admin;