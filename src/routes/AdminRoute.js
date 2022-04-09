import React from 'react';
import { Route, useHistory} from 'react-router-dom';
import PrivateLayout from '../components/PrivateLayout/PrivateLayout';

const AdminRoute = ({ component: Component, ...rest }) => {

    const history = useHistory();

    let token = sessionStorage.getItem('user') ? JSON.parse(sessionStorage.getItem('user')).access_token : undefined;
    const admin = sessionStorage.getItem('es_admin');

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