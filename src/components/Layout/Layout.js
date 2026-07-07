import React from 'react';
import LayoutPage from './LayoutPage';

const Layout = ({ children, type, fullBleed = false }) => {

    return (
        <LayoutPage {...{ children, type, fullBleed }}></LayoutPage>
    );
}

export default Layout;
