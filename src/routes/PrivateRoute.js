import React from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useParams } from 'react-router-dom';
import { useLocation } from 'react-router-dom';
import { Route } from 'react-router-dom';
import Layout from '../components/Layout/Layout';
import PrivateLayout from '../components/PrivateLayout/PrivateLayout';
import { setUserSession } from '../redux/reducers/user/actions';

const ignoreLayout = [
    '/home',
    '/logout'
];

const PrivateRoute = ({ component: Component, ...rest }) => {

    const dispatch = useDispatch();
    const location = useLocation();
    const user = useSelector(state => state.user);

    let token = sessionStorage.getItem('user') ? JSON.parse(sessionStorage.getItem('user')).id : undefined;

    if (!token) {
        if (ignoreLayout.includes(rest.location.pathname) || location.search !== '') {
            return (
                <Route {...rest} render={props => (
                    <Layout type='Public'>
                        <Component {...props} />
                    </Layout>
                )} />
            )
        } else {
            window.location.href = process.env.PUBLIC_URL + '/';
        }
    } else {
        if (!user.profile) {
            dispatch(setUserSession(JSON.parse(sessionStorage.getItem('user'))));
        }
        return (
            <Route {...rest} render={props => (
                <Layout type='Private'>
                    <Component {...props} />
                </Layout>
            )} />
        )
    }
}

export default PrivateRoute;