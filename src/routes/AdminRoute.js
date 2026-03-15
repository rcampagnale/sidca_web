import React from 'react';
import { Route } from 'react-router-dom';
import Layout from '../components/Layout/Layout';
import LoginAdmin from '../pages/Admin/LoginAdmin/LoginAdmin';

const AdminRoute = ({ component: Component, ...rest }) => {
  const token = sessionStorage.getItem('user')
    ? JSON.parse(sessionStorage.getItem('user')).accessToken
    : undefined;

  const admin = sessionStorage.getItem('es_admin');

  if (!admin || !token) {
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