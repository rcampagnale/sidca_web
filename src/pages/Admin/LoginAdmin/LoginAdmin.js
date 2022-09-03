import React, { useEffect } from 'react'
import { useDispatch, useSelector } from 'react-redux';
import { useHistory } from 'react-router-dom';
import { useForm } from '../../../hooks/useForm';
import { adminLogin } from '../../../redux/reducers/user/actions';
import styles from './styles.module.css';

import { InputText } from 'primereact/inputtext';
import { Button } from 'primereact/button';
import { Spinner } from '../../../components/Spinner/Spinner';

const LoginAdmin = () => {

    const dispatch = useDispatch();
    const history = useHistory();
    const user = useSelector(state => state.user)

    const initialform = {
        admin: '',
        password: '',
    };

    const [form, handleInputChange, reset] = useForm(initialform);

    const handleSubmit = async (e) => {
        e.preventDefault();
        await dispatch(adminLogin(form));
        reset()
    }

    useEffect(() => {
        if (user.profile?.accessToken) {
            history.push('/admin');
        }
    }, [user.profile?.accessToken])


    return (
        <div className={styles.visibleContent}>
            <div className={styles.container}>
                <form onSubmit={handleSubmit} className={styles.formAdmin}>
                    <h2 className={styles.title}>Administradores</h2>

                    <span className={`p-float-label ${styles.inputSection}`}>
                        <InputText className={styles.inputForm} value={form.admin} name="admin" id="admin" type="text" onChange={(e) => { handleInputChange(e) }} />
                        <label className={styles.labelForm} htmlFor="admin">Email</label>
                    </span>

                    <span className={`p-float-label ${styles.inputSection}`}>
                        <InputText className={styles.inputForm} value={form.password} name="password" id="password" type="password" onChange={(e) => { handleInputChange(e) }} />
                        <label className={styles.labelForm} htmlFor="password">Contraseña</label>
                    </span>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '5px', marginTop: '5px' }}>
                        {user.processing && <Spinner />}
                        {user.status == 'AUTH_FAILURE' && <small className="p-error">{user.msg}</small>}
                    </div>
                    <Button type="submit" label='Ingresar' className={`p-button-raised p-button-warning ${styles.submitButton}`} />
                </form>
            </div>
        </div>
    )
}

export default LoginAdmin;