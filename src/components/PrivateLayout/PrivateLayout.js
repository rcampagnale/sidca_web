import React from 'react';
import { useHistory } from 'react-router-dom';
import { PrivateLayoutPage } from './PrivateLayoutPage';
import { useSelector } from 'react-redux';

const PrivateLayout = ({ children }) => {

    const history = useHistory();
    const user = useSelector(state => state.user);

    return (
        <PrivateLayoutPage {...{ history, children, user }}></PrivateLayoutPage>
    );
}

export default PrivateLayout;