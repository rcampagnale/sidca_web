import React, { useEffect } from 'react';
import { useSelector } from 'react-redux';
import { useHistory } from 'react-router-dom';
import { Route } from 'react-router-dom';
import Layout from '../components/Layout/Layout';

const PublicRoute = ({ component: Component, ...rest }) => {

    const user = useSelector(state => state.user);
    const history = useHistory();

    useEffect(()=> {
        let token = sessionStorage.getItem('user') ? JSON.parse(sessionStorage.getItem('user')).id : undefined;
        if(token){
            history.push('/home');
        }
    },[user])

    return (
        <Route {...rest} render={props => (
                <Layout type='Public'>
                    <Component {...props} />
                </Layout>
        )} />                          
    )
}

export default PublicRoute;