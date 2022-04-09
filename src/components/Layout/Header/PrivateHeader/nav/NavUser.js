import React from 'react';
import { Sidebar } from 'primereact/sidebar';
import { useHistory } from 'react-router';
import styles from './styles.module.css';

const NavUser = ({active,setActive}) => {

    const history = useHistory();

    return(
        <Sidebar className={'p-sidebar-top'} style={{backgroundColor: '#3b3b3b', minHeight: '60vh'}} visible={active} onHide={() => setActive(false)}>
            <ul className={styles.navUl} onClick={() => setActive(false)} >
                <li onClick={() => history.push('/capacitaciones')}>Capacitaciones</li>
                <li onClick={() => history.push('/casa-del-docente')}>Casa del Docente</li>
                <li onClick={() => history.push('/contacto')}>Contacto</li>
                <li onClick={() => history.push('/nosotros')}>Nosotros</li>
                <li onClick={() => history.push('/novedades')}>Novedades</li>
                <li onClick={() => history.push('/predio')}>Predio</li>
                <li onClick={() => history.push('/turismo')}>Turismo</li>
            </ul>
        </Sidebar>
    )
}

export default NavUser;
