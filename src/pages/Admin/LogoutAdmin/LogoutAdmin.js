import React, { useEffect } from 'react';
import { useDispatch } from 'react-redux';
import { ProgressSpinner } from 'primereact/progressspinner';
import { adminLogout } from '../../../redux/reducers/user/actions';
import { useHistory } from 'react-router-dom';

const LogoutAdmin = () => {

    const dispatch = useDispatch();
    const history = useHistory();

    const hanldeLogOut = async() => {
        await dispatch(adminLogout())
        history.push('/')
    }

    useEffect(() => {
        hanldeLogOut()
    }, [])

    return (
        <ProgressSpinner />
    )
}

export default LogoutAdmin