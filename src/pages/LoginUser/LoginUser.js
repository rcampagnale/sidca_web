import React from 'react';
import styles from './styles.module.css';
import { useDispatch } from 'react-redux';
import { useHistory } from 'react-router-dom';
import { useForm } from '../../hooks/useForm';
import { authenticateUser } from '../../redux/reducers/user/actions';
import { InputText } from 'primereact/inputtext';
import { Button } from 'primereact/button';
import logo from '../../assets/img/logo-01.png';

const LoginUser = () => {

    const dispatch = useDispatch();
    const history = useHistory();

    const initialform = {
        dni: '',
    };

    const [form, handleInputChange, reset] = useForm(initialform);

    const handleSubmit = async(e) => {
        e.preventDefault();
        await dispatch(authenticateUser(form));
        reset()
        // history.push('/nosotros');
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

                    {/* <span className={`p-float-label ${styles.inputSection}`}>
                    <InputText className={styles.inputForm} value={form.contraseña} name="contraseña" id="contraseña" type="password" onChange={(e)=>{handleInputChange(e)}} />
                    <label className={styles.labelForm} htmlFor="contraseña">Contraseña</label>
                </span> 
                */}
                    <Button type="submit" label='Ingresar' className={`p-button-raised p-button-warning ${styles.submitButton}`} />
                </form>
            </div>
        </div>
    )
}

export default LoginUser;