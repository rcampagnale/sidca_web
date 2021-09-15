import React from "react";
import {
    BrowserRouter,
    Route,
    Switch
} from "react-router-dom";
// import PublicRoute from './PublicRoute';
// import PrivateRoute from './PrivateRoute';
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
import Usuarios from "../pages/Admin/Usuarios/Usuarios";

const AppRouter = () => {

    //useFetchUser();
    //useFetchUserProfile();

    return (
        <BrowserRouter basename={'/'}>
            {/* <ScrollToTop></ScrollToTop> */}
            <Switch>
                <Route exact path="/admin/login" component={LoginAdmin}/>
                <AdminRoute exact path="/admin" component={Admin}/>

                <AdminRoute exact path="/admin/enlaces" component={Enlaces}/>
                <AdminRoute exact path="/admin/nuevo-enlace/" component={NuevoEnlace}/>

                <AdminRoute exact path="/admin/usuarios" component={Usuarios}/>
                <AdminRoute exact path="/admin/nuevo-usuario" component={NuevoAfiliado}/>
                <AdminRoute exact path="/admin/nuevos-afiliados" component={AfiliadosNuevos}/>

                <AdminRoute exact path="/admin/cursos" component={Cursos}/>
                <AdminRoute exact path="/admin/nuevo-curso" component={NuevoCurso}/>

                <AdminRoute exact path="/admin/asesoramiento" component={Asesoramiento}/>
                <AdminRoute exact path="/admin/nuevo-asesoramiento" component={NuevoAsesoramiento}/>
                
                <AdminRoute exact path="/admin/novedades" component={Novedades}/>
                <AdminRoute exact path="/admin/nueva-novedad" component={NuevaNovedad}/>

                {/* <Route exact path="/" component={Landing} />
                <Route exact path="/activar-cuenta/:user_id/:token" component={ActivarCuenta} />
                <PrivateRoute exact path="/login" component={Login} />
                <PublicRoute exact path="/ofertas-laborales" component={OfertasLaborales} />
                <PublicRoute path="/ofertas-laborales/:id" component={DetalleOferta} />
                <EmpresaRoute exact path="/empresa/entrevistas" component={EntrevistasEmpresa} /> */}
                <Route component={NotFound} path="*" />
            </Switch>
        </BrowserRouter>
    );
};

export default AppRouter;