import React from 'react';
import { useHistory } from 'react-router-dom';
import { NotFoundPage } from './NotFoundPage';

const NotFound = () => {
    const history = useHistory();
    return (
        <NotFoundPage {...{history}}></NotFoundPage>
    );
}

export default NotFound;