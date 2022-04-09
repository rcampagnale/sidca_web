import React from 'react';
import { Route, useHistory} from 'react-router-dom';
import Layout from '../components/Layout/Layout';

const AdminRoute = ({ component: Component, ...rest }) => {

    const history = useHistory();

    let token = sessionStorage.getItem('user') ? JSON.parse(sessionStorage.getItem('user')).access_token : undefined;
    const admin = sessionStorage.getItem('es_admin');

    if (!admin || !token) {
        history.push('/admin/login')
    } else {
        return (
            <Route {...rest} render={props => (
                <Layout type='Admin'>
                    <Component {...props} />
                </Layout>
            )} />
        )
    }

}

export default AdminRoute;