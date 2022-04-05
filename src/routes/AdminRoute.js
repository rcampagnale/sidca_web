import React from 'react';
import { Route, useHistory} from 'react-router-dom';
import PrivateLayout from '../components/PrivateLayout/PrivateLayout';

const AdminRoute = ({ component: Component, ...rest }) => {

    const history = useHistory();

    let token = localStorage.getItem('user') ? JSON.parse(localStorage.getItem('user')).access_token : undefined;
    const admin = localStorage.getItem('es_admin');

    if (!admin || !token) {
        history.push('/admin/login')
    } else {
        return (
            <Route {...rest} render={props => (
                <PrivateLayout>
                    <Component {...props} />
                </PrivateLayout>
            )} />
        )
    }
}

export default AdminRoute;