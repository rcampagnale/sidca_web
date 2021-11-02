import React from 'react';
import { useHistory } from 'react-router-dom';
import PublicLayoutPage from './PublicLayoutPage';
import { useSelector } from 'react-redux';

const PublicLayout = ({ children }) => {

    const history = useHistory();
    const user = useSelector(state => state.user);

    return (
        <PublicLayoutPage {...{ history, children, user }}></PublicLayoutPage>
    );
}

export default PublicLayout;