import React from 'react';
import { Route } from 'react-router-dom';
import Layout from '../components/Layout/Layout';
import PrivateLayout from '../components/PrivateLayout/PrivateLayout';

const ignoreLayout = [
    '/login',
    '/logout'
];

const PrivateRoute = ({ component: Component, ...rest }) => {

    let token = sessionStorage.getItem('user') ? JSON.parse(sessionStorage.getItem('user')).id : undefined;

    if (!token) {
        window.location.href = process.env.PUBLIC_URL + '/';
    } {
        return (
            <Route {...rest} render={props => (
                ignoreLayout.includes(rest.location.pathname) ?
                    <Component {...props} />
                    :
                    <Layout type='Private'>
                        <Component {...props} />
                    </Layout>
            )} />
        )
    }

}

export default PrivateRoute;