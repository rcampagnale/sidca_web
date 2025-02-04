import React, { useEffect } from 'react';
import { useDispatch } from 'react-redux';
import { ProgressSpinner } from 'primereact/progressspinner';
import { logout } from '../../redux/reducers/user/actions';
import { useHistory } from 'react-router-dom';

const Logout = () => {

    const dispatch = useDispatch();

    const history = useHistory();

    const hanldeLogOut = async() => {
        await dispatch(logout())
        sessionStorage.removeItem('user');
        history.push('/')
    }

    useEffect(() => {
        hanldeLogOut()
    }, [])

    return (
        <ProgressSpinner />
    )
}

export default Logout