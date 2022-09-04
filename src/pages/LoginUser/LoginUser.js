import React, { useEffect } from 'react';
import styles from './styles.module.css';
import { useDispatch, useSelector } from 'react-redux';
import { useForm } from '../../hooks/useForm';
import { authenticateUser } from '../../redux/reducers/user/actions';
import { InputText } from 'primereact/inputtext';
import { Button } from 'primereact/button';
import logo from '../../assets/img/logo-01.png';
import { Spinner } from '../../components/Spinner/Spinner';

const LoginUser = () => {

    const dispatch = useDispatch();
    const user = useSelector(state => state.user)

    const initialform = {
        dni: '',
    };

    const [form, handleInputChange, reset] = useForm(initialform);

    const handleSubmit = async (e) => {
        e.preventDefault();
        await dispatch(authenticateUser(form));
        reset()
    }

    return (
        <div className={styles.visibleContent}>
            <div className={styles.container}>
                <div className={styles.imgContainer}>
                    <img className={styles.img} src={logo} alt="Logo de SiDCa"></img>
                </div>
                <form onSubmit={handleSubmit} className={styles.formAdmin}>
                    <h2 className={styles.title}>Iniciar sesión</h2>
                    <span className={`p-float-label ${styles.inputSection}`}>
                        <InputText className={styles.inputForm} value={form.dni} name="dni" id="dni" type="text" onChange={(e) => { handleInputChange(e) }} />
                        <label className={styles.labelForm} htmlFor="dni">DNI</label>
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

export default LoginUser;