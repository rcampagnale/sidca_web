import React from 'react';
import { Sidebar } from 'primereact/sidebar';
import { useHistory } from 'react-router';
import styles from './styles.module.css';

const NavUser = ({active,setActive}) => {

    const history = useHistory();

    return(
        <Sidebar className={'p-sidebar-top'} style={{backgroundColor: '#3b3b3b', minHeight: '60vh'}} visible={active} onHide={() => setActive(false)}>
            <ul className={styles.navUl} onClick={() => setActive(false)} >
                <li onClick={() => history.push('/admin/enlaces')}>Enlaces</li>
                <li onClick={() => history.push('/admin/usuarios')}>Usuarios</li>
                <li onClick={() => history.push('/admin/cursos')}>Cursos</li>
                <li onClick={() => history.push('/admin/asesoramiento')}>Asesoramiento</li>
                <li onClick={() => history.push('/admin/novedades')}>Novedades</li>
                <li onClick={() => history.push('/admin/nuevos-afiliados')}>Afiliados</li>
            </ul>
        </Sidebar>
    )
}

export default NavUser;
