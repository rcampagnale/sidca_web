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
        <div className={styles.container}>
            <form onSubmit={handleSubmit} className={styles.formAdmin}>
                <label className={styles.labelForm}>Admin</label>
                <input 
                    name="admin" 
                    id="admin" 
                    type="text" 
                    className={styles.inputForm}
                    onChange={(e)=>{handleInputChange(e)}}
                />
                <label className={styles.labelForm}>Contraseña</label>
                <input 
                    name="password" 
                    id="password" 
                    type="password"
                    className={styles.inputForm} 
                    onChange={(e)=>{handleInputChange(e)}}
                />
                <input type="submit" value='Ingresar' className={styles.submitButton}/>
            </form>
        </div>
    )
}

export default LoginAdmin;