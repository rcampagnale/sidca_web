import React from 'react';
import { Route } from 'react-router-dom';
import Layout from '../components/Layout/Layout';
import LoginAdmin from '../pages/Admin/LoginAdmin/LoginAdmin';
import { sesionAdminExpirada } from '../utils/adminSession';

/**
 * Ruta administrativa.
 *
 * Además de exigir la sesión en storage, comprueba que no haya vencido por
 * inactividad. Sin esa comprobación, entrar directo a una URL administrativa
 * podría renderizar el panel durante el instante previo a que el guard
 * complete el cierre.
 *
 * Esto es una barrera de interfaz, no de seguridad: quien autoriza de verdad
 * es el backend, que verifica el Firebase ID Token en cada request.
 */
const AdminRoute = ({ component: Component, ...rest }) => {
  const token = sessionStorage.getItem('user')
    ? JSON.parse(sessionStorage.getItem('user')).accessToken
    : undefined;

  const admin = sessionStorage.getItem('es_admin') === 'true';

  const vencida = sesionAdminExpirada();

  if (!admin || !token || vencida) {
    return (
      <Route
        {...rest}
        render={(props) => (
          <Layout type="Public">
            <LoginAdmin {...props} />
          </Layout>
        )}
      />
    );
  }

  return (
    <Route
      {...rest}
      render={(props) => (
        <Layout type="Admin">
          <Component {...props} />
        </Layout>
      )}
    />
  );
};

export default AdminRoute;
