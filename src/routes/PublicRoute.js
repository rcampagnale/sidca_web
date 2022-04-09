import React from 'react';
import { Route } from 'react-router-dom';
import Layout from '../components/Layout/Layout';

const PublicRoute = ({ component: Component, ...rest }) => {
    return (
        <Route {...rest} render={props => (
                <Layout type='Public'>
                    <Component {...props} />
                </Layout>
        )} />                          
    )
}

export default PublicRoute;