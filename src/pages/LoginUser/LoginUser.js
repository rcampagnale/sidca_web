import React from 'react';
import styles from './styles.module.css';
// import { useDispatch } from 'react-redux';
// import { useHistory } from 'react-router-dom';
// import { useForm } from '../../../hooks/useForm';
// import { adminLogin } from '../../../redux/reducers/user/actions';
import { InputText } from 'primereact/inputtext';
import { Button } from 'primereact/button';

const LoginUser = () => {

    // const dispatch = useDispatch();
    // const history = useHistory();

    // const initialform = {
    //     admin: '',
    //     password: '',
    // };

    // const [form, handleInputChange, reset] = useForm(initialform);

    // const handleSubmit = async(e) => {
    //     e.preventDefault();
    //     await dispatch(adminLogin(form));
    //     reset()
    //     history.push('/admin');
    // }   

    return(
        <div className={styles.visibleContent}>
            <div className={styles.container}>
            <form /*onSubmit={handleSubmit}*/ className={styles.formAdmin}>
                <h2 className={styles.title}>Iniciar sesión</h2>
                
                <span className={`p-float-label ${styles.inputSection}`}>
                    <InputText className={styles.inputForm} /*value={form.usuario}*/ name="usuario" id="usuario" type="text" /*onChange={(e)=>{handleInputChange(e)}}*/ />
                    <label className={styles.labelForm} htmlFor="usuario">Usuario</label>
                </span>

                <span className={`p-float-label ${styles.inputSection}`}>
                    <InputText className={styles.inputForm} /*value={form.contraseña}*/ name="contraseña" id="contraseña" type="password" /*onChange={(e)=>{handleInputChange(e)}}*/ />
                    <label className={styles.labelForm} htmlFor="contraseña">Contraseña</label>
                </span>

                <Button type="submit" label='Ingresar' className={`p-button-raised p-button-warning ${styles.submitButton}`} />
            </form>
        </div>
        </div>
    )
}

export default LoginUser;