import React from 'react'
import { useDispatch } from 'react-redux';
import { useHistory } from 'react-router-dom';
import { useForm } from '../../../hooks/useForm';
import { adminLogin } from '../../../redux/reducers/user/actions';
import styles from '../../../assets/styles/global.module.css'

const LoginAdmin = () => {

    const dispatch = useDispatch();
    const history = useHistory();

    const initialform = {
        admin: '',
        password: '',
    };

    const [form, handleInputChange, reset] = useForm(initialform);

    const handleSubmit = async(e) => {
        e.preventDefault();
        await dispatch(adminLogin(form));
        reset()
        history.push('/admin');
    }   

    return (
        <div>
            <form onSubmit={handleSubmit} className={styles.formAdmin}>
                <label>Admin</label>
                <input name="admin" id="admin" type="text" onChange={(e)=>{handleInputChange(e)}}/>
                <label>Contraseña</label>
                <input name="password" id="password" type="password" onChange={(e)=>{handleInputChange(e)}}/>
                <input type="submit" value='Ingresar'/>
            </form>
        </div>
    )
}

export default LoginAdmin;