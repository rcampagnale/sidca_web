import React, { useEffect } from 'react';
import { useDispatch } from 'react-redux';
import { ProgressSpinner } from 'primereact/progressspinner';
import { logout } from '../../redux/reducers/user/actions';

const Logout = () => {

    const dispatch = useDispatch();

    useEffect(() => {
        dispatch(logout())
        sessionStorage.removeItem('user');
    }, [])

    return (
        <ProgressSpinner />
    )
}

export default Logout