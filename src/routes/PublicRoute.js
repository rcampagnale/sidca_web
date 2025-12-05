import React, { useEffect } from 'react';
import { useSelector } from 'react-redux';
import { useHistory, Route } from 'react-router-dom';
import Layout from '../components/Layout/Layout';

const PublicRoute = ({ 
  component: Component, 
  allowAuthenticated = false,   // 🔹 NUEVO: controla si dejamos pasar usuarios logueados
  ...rest 
}) => {

  const user = useSelector(state => state.user);
  const history = useHistory();

  useEffect(() => {
    // Leemos el token desde sessionStorage como ya venías haciendo
    const storedUser = sessionStorage.getItem('user');
    const token = storedUser ? JSON.parse(storedUser).id : undefined;

    // 🔹 Comportamiento:
    // - Si hay token y NO se permite autenticado -> redirige a /home (como antes)
    // - Si allowAuthenticated === true -> NO redirigimos, la ruta es pública real
    if (token && !allowAuthenticated) {
      history.push('/home');
    }
  }, [user, history, allowAuthenticated]);

  return (
    <Route
      {...rest}
      render={props => (
        <Layout type="Public">
          <Component {...props} />
        </Layout>
      )}
    />
  );
};

export default PublicRoute;
