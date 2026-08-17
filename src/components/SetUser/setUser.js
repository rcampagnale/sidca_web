import React, { useEffect } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { setProfile } from '../../redux/reducers/user/actions';
import {
    esSesionAdmin,
    limpiarSesionAdminStorage,
    sesionAdminExpirada,
} from '../../utils/adminSession';

/**
 * Restaura la sesión guardada en sessionStorage al montar la app.
 *
 * Para el ADMINISTRADOR hay una condición extra: sólo se restaura si la
 * sesión no venció por inactividad. Si pasaron las 5 horas se limpia el
 * storage y NO se toca Redux, así el panel queda cerrado y AdminRoute manda
 * a LoginAdmin.
 *
 * El signOut de Firebase lo ejecuta AdminSessionGuard, que corre en paralelo
 * y detecta el mismo vencimiento. Acá se limpia el storage de inmediato para
 * que ningún render intermedio llegue a leer datos de una sesión ya vencida.
 *
 * El usuario normal que ingresa por DNI no pasa por esta comprobación.
 */
const SetUser = ({ children }) => {

    const dispatch = useDispatch();
    const user = useSelector(state => state.user.profile)
    const userStorage = sessionStorage.getItem('user') ? JSON.parse(sessionStorage.getItem('user')) : undefined;

    useEffect(()=>{
        if (esSesionAdmin() && sesionAdminExpirada()) {
            limpiarSesionAdminStorage();
            return;
        }

        if(!user && userStorage){
            dispatch(setProfile(userStorage))
        }
    }, [])

    return (
        <>
            {children}
        </>
    )
}

export default SetUser
