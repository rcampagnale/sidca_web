import React from 'react';
import { useHistory } from 'react-router-dom';
import LayoutPage from './LayoutPage';
import { useSelector } from 'react-redux';

const Layout = ({ children, type}) => {

    return (
        <LayoutPage {...{ children, type }}></LayoutPage>
    );
}

export default Layout;