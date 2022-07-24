import React, { useEffect } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { setProfile } from '../../redux/reducers/user/actions';

const SetUser = ({ children }) => {

    const dispatch = useDispatch();
    const user = useSelector(state => state.user.profile)
    const userStorage = sessionStorage.getItem('user') ? JSON.parse(sessionStorage.getItem('user')) : undefined;

    useEffect(()=>{
        if(!user && userStorage){
            dispatch(setProfile(userStorage))
        }
    }, [])

    return (
        <>
            {children}
        </>
    )
}

export default SetUser