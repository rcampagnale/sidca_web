import React from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Route } from 'react-router-dom';
import Layout from '../components/Layout/Layout';
import PrivateLayout from '../components/PrivateLayout/PrivateLayout';
import { setUserSession } from '../redux/reducers/user/actions';

const ignoreLayout = [
    '/login',
    '/logout'
];

const PrivateRoute = ({ component: Component, ...rest }) => {
    const dispatch = useDispatch();
    const user = useSelector(state => state.user);

    let token = sessionStorage.getItem('user') ? JSON.parse(sessionStorage.getItem('user')).id : undefined;

    if (!token) {
        window.location.href = process.env.PUBLIC_URL + '/';
    } {

        if(!user.profile){
            dispatch(setUserSession(JSON.parse(sessionStorage.getItem('user'))));
        }

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