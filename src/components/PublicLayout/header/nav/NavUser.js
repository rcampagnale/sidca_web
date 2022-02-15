import React from 'react';
import styles from './styles.module.css';
import { useHistory } from 'react-router';

const NavUser = ({setActive}) => {

    const history = useHistory();

    return(
        <div>
            <ul className={styles.navUl} onClick={() => setActive(false)}>
                <li onClick={() => history.push('/capacitaciones')}>Capacitaciones</li>
                <li onClick={() => history.push('/casa-del-docente')}>Casa del Docente</li>
                <li onClick={() => history.push('/contacto')}>Contacto</li>
                <li onClick={() => history.push('/nosotros')}>Nosotros</li>
                <li onClick={() => history.push('/novedades')}>Novedades</li>
                <li onClick={() => history.push('/predio')}>Predio</li>
                <li onClick={() => history.push('/turismo')}>Turismo</li>
            </ul>
        </div>
    )
}

export default NavUser;
