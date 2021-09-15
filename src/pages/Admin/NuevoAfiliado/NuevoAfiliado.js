import React from 'react'
import { useDispatch } from 'react-redux';
import { useHistory } from 'react-router-dom';
import { useForm } from '../../../hooks/useForm';
import { nuevoAfiliado } from '../../../redux/reducers/afiliados/actions';
import styles from '../../../assets/styles/global.module.css'

const NuevoAfiliado = () => {

    const dispatch = useDispatch();
    
    const history = useHistory();

    const initialform = {
        dni: '',
        nombre: '',
        apellido: ''
    };

    const [form, handleInputChange, reset] = useForm(initialform);

    const handleSubmit = (e) => {
        e.preventDefault();
        dispatch(nuevoAfiliado(form));
        reset()
        history.push('/admin');
    }   

    return (
        <div>
            <form onSubmit={handleSubmit} className={styles.formAdmin}>
                <label>Nombre</label>
                <input name="nombre" id="nombre" type="text" onChange={(e)=>{handleInputChange(e)}}/>
                <label>Apellido</label>
                <input name="apellido" id="apellido" type="text" onChange={(e)=>{handleInputChange(e)}}/>
                <label>DNI</label>
                <input name="dni" id="dni" type="number" onChange={(e)=>{handleInputChange(e)}}/>
                <input type="submit" value='Agregar'/>
            </form>
        </div>
    )
}

export default NuevoAfiliado;