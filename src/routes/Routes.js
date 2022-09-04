import React, { useEffect } from "react";
import {
    BrowserRouter,
    Route,
    Switch
} from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import PublicRoute from './PublicRoute';
import PrivateRoute from './PrivateRoute';
import AdminRoute from './AdminRoute';

import LoginAdmin from '../pages/Admin/LoginAdmin/LoginAdmin';
import NotFound from '../components/NotFound/NotFound';
import NuevoAfiliado from "../pages/Admin/NuevoAfiliado/NuevoAfiliado";
import NuevoCurso from "../pages/Admin/NuevoCurso/NuevoCurso";
import NuevoEnlace from "../pages/Admin/NuevoEnlace/NuevoEnlace";
import NuevoAsesoramiento from "../pages/Admin/NuevoAsesoramiento/NuevoAsesoramiento";
import NuevaNovedad from "../pages/Admin/NuevaNovedad/NuevaNovedad";
import Admin from "../pages/Admin/Admin/Admin";
import Enlaces from "../pages/Admin/Enlaces/Enlaces";
import AfiliadosNuevos from "../pages/Admin/AfiliadosNuevos/AfiliadosNuevos";
import Cursos from "../pages/Admin/Cursos/Cursos";
import Asesoramiento from "../pages/Admin/Asesoramiento/Asesoramiento";
import Novedades from "../pages/Admin/Novedades/Novedades";
import NovedadesUser from "../pages/Novedades/Novedades";
import Usuarios from "../pages/Admin/Usuarios/Usuarios";
import Nosotros from "../pages/Nosotros/Nosotros";
import Contacto from "../pages/Contacto/Contacto";
import Capacitaciones from "../pages/Capacitaciones/Capacitaciones";
import CasaDelDocente from "../pages/CasaDelDocente/CasaDelDocente";
import Turismo from "../pages/Turismo/Turismo";
import Predio from "../pages/Predio/Predio";
import LoginUser from "../pages/LoginUser/LoginUser";
import Home from "../pages/Home/Home";
import Cuotas from "../pages/Cuotas/Cuotas";
import CuotasAdmin from "../pages/Admin/Cuotas/Cuotas";
import Logout from "../pages/Logout/Logout";
import NuevaCuota from "../pages/Admin/NuevaCuota/NuevaCuota";
import Transacciones from "../pages/Admin/Transacciones/Transacciones";
import TransaccionesUsuario from "../pages/Admin/TransaccionesUsuario/TransaccionesUsuario";
import LogoutAdmin from "../pages/Admin/LogoutAdmin/LogoutAdmin";
import CursosUser from "../pages/Capacitaciones/Cursos/Cursos";

import { getCategories } from "../redux/reducers/categorias/actions";

const AppRouter = () => {

    const categorias = useSelector(state => state.categorias);
    const dispatch = useDispatch();

    useEffect(()=> {
        if(!categorias.categorias){
            dispatch(getCategories())
        }
    }, [categorias.categorias])

    return (
        <BrowserRouter basename={'/'}>
            {/* <ScrollToTop></ScrollToTop> */}
            <Switch>

                {/* WEB */}
                <PublicRoute exact path="/" component={LoginUser} />
                <PrivateRoute exact path="/logout" component={Logout} />
                <PrivateRoute exact path="/home/" component={Home} />
                <PrivateRoute exact path="/nosotros" component={Nosotros} />
                <PrivateRoute exact path="/contacto" component={Contacto} />
                <PrivateRoute exact path="/novedades" component={NovedadesUser} />
                <PrivateRoute exact path="/capacitaciones" component={Capacitaciones} />
                <PrivateRoute exact path="/capacitaciones/cursos/:type" component={CursosUser} />
                <PrivateRoute exact path="/casa-del-docente" component={CasaDelDocente} />
                <PrivateRoute exact path="/turismo" component={Turismo} />
                <PrivateRoute exact path="/predio" component={Predio} />
                <PrivateRoute exact path="/cuotas" component={Cuotas} />

                {/* ADMIN */}
                <PublicRoute exact path="/admin/login" component={LoginAdmin} />
                <AdminRoute exact path="/admin" component={Admin} />

                <AdminRoute exact path="/admin/enlaces" component={Enlaces} />
                <AdminRoute exact path="/admin/nuevo-enlace/" component={NuevoEnlace} />
                <AdminRoute exact path="/admin/nuevo-enlace/:id" component={NuevoEnlace} />

                <AdminRoute exact path="/admin/cuotas" component={CuotasAdmin} />
                <AdminRoute exact path="/admin/nueva-cuota/" component={NuevaCuota} />
                <AdminRoute exact path="/admin/nueva-cuota/:id" component={NuevaCuota} />

                <AdminRoute exact path="/admin/usuarios" component={Usuarios} />
                <AdminRoute exact path="/admin/nuevo-usuario" component={NuevoAfiliado} />
                <AdminRoute exact path="/admin/nuevo-usuario/:id" component={NuevoAfiliado} />
                <AdminRoute exact path="/admin/nuevos-afiliados" component={AfiliadosNuevos} />

                <AdminRoute exact path="/admin/cursos" component={Cursos} />
                <AdminRoute exact path="/admin/nuevo-curso" component={NuevoCurso} />
                <AdminRoute exact path="/admin/nuevo-curso/:id" component={NuevoCurso} />

                <AdminRoute exact path="/admin/asesoramiento" component={Asesoramiento} />
                <AdminRoute exact path="/admin/nuevo-asesoramiento" component={NuevoAsesoramiento} />
                <AdminRoute exact path="/admin/nuevo-asesoramiento/:id" component={NuevoAsesoramiento} />

                <AdminRoute exact path="/admin/novedades" component={Novedades} />
                <AdminRoute exact path="/admin/nueva-novedad" component={NuevaNovedad} />
                <AdminRoute exact path="/admin/nueva-novedad/:id" component={NuevaNovedad} />

                <AdminRoute exact path="/admin/transacciones" component={Transacciones} />
                <AdminRoute exact path="/admin/nueva-transaccion" component={NuevaNovedad} />
                <AdminRoute exact path="/admin/transacciones/usuario/:id" component={TransaccionesUsuario} />

                <AdminRoute exact path="/admin/logout" component={LogoutAdmin} />

                <Route component={NotFound} path="*" />
            </Switch>
        </BrowserRouter>
    );
};

export default AppRouter;