import React from 'react'
import { useDispatch } from 'react-redux';
import { useHistory } from 'react-router-dom';
import { useForm } from '../../../hooks/useForm';
import { nuevoEnlace } from '../../../redux/reducers/enlaces/actions';
import styles from '../../../assets/styles/global.module.css'

const NuevoEnlace = () => {

    const dispatch = useDispatch();
    const history = useHistory();

    const initialform = {
        titulo: '',
        descripcion: '',
        link: '',
        prioridad: 1,
    };

    const [form, handleInputChange, reset] = useForm(initialform);

    const handleSubmit = (e) => {
        e.preventDefault();
        dispatch(nuevoEnlace(form))
        reset()
        history.push('/admin');
    }   

    return (
        <div>
            <form onSubmit={handleSubmit} className={styles.formAdmin}>
                <label>Titulo</label>
                <input 
                    name="titulo" 
                    id="titulo" 
                    type="text" 
                    onChange={(e)=>{handleInputChange(e)}} 
                    value={form.titulo}
                />
                <label>Descripcion</label>
                <input 
                    name="descripcion" 
                    id="descripcion"
                    type="text" 
                    onChange={(e)=>{handleInputChange(e)}}
                />
                <label>Link</label>
                <input 
                    name="link" 
                    id="link" 
                    type="text" 
                    onChange={(e)=>{handleInputChange(e)}}
                />
                <label>Prioridad</label>
                <input 
                    name="prioridad" 
                    id="prioridad" 
                    type="number" 
                    onChange={(e)=>{handleInputChange(e)}}
                />
                <input type="submit" value='Agregar'/>
            </form>
        </div>
    )
}

export default NuevoEnlace;