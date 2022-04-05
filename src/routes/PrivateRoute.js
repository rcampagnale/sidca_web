import React from 'react';
import { Route } from 'react-router-dom';
import PrivateLayout from '../components/PrivateLayout/PrivateLayout';

const ignoreLayout = [
    '/login',
    '/logout'
];

const PrivateRoute = ({ component: Component, ...rest }) => {

    let token = localStorage.getItem('user') ? JSON.parse(localStorage.getItem('user')).user : undefined;

    if (!token) {
        window.location.href = process.env.PUBLIC_URL + '/';
    } {
        return (
            <Route {...rest} render={props => (
                ignoreLayout.includes(rest.location.pathname) ?
                    <Component {...props} />
                    :
                    <PrivateLayout>
                        <Component {...props} />
                    </PrivateLayout>
            )} />
        )
    }

}

export default PrivateRoute;