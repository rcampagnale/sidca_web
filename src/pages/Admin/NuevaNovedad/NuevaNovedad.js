import React from 'react'
import { useDispatch } from 'react-redux';
import { useHistory } from 'react-router-dom';
import { useForm } from '../../../hooks/useForm';
import { nuevoCurso } from '../../../redux/reducers/cursos/actions';
import styles from '../../../assets/styles/global.module.css'

const NuevaNovedad = () => {

    const dispatch = useDispatch();
    const history = useHistory();

    const initialform = {
        titulo: '',
        descripcion: '',
        link: false,
        imagen: false,
        categoria: '',
        descarga: false,
        prioridad: 0,
    };

    const [form, handleInputChange, reset] = useForm(initialform);

    const handleSubmit = (e) => {
        e.preventDefault();
        dispatch(nuevoCurso(form));
        reset()
        history.push('/admin');
    }   

    return (
        <div>
            <form onSubmit={handleSubmit} className={styles.formAdmin}>
                <label>Titulo</label>
                <input name="titulo" id="titulo" type="text" onChange={(e)=>{handleInputChange(e)}} value={form.titulo}/>
                <label>Descripcion</label>
                <input name="descripcion" id="descripcion" type="text" onChange={(e)=>{handleInputChange(e)}} value={form.descripcion}/>
                <label>Categoría</label>
                <select name='categoria' id='categoria' onChange={(e)=>{handleInputChange(e)}} value={form.categoria}>
                    <option value="">Selecciona una Categoria</option>
                    <option value="turismo">Turismo</option>
                    <option value="casa">Casa del Docente</option>
                    <option value="predio">Predio</option>
                </select>
                <label>Prioridad</label>
                <input 
                    name="prioridad" 
                    id="prioridad" 
                    type="number" 
                    onChange={(e)=>{handleInputChange(e)}}
                />
                <label>Link</label>
                <input name="link" id="link" type="text" onChange={(e)=>{handleInputChange(e)}}  value={form.link}/>
                <label>¿Es un archivo descargable?</label>
                <select name='estado' id='estado' onChange={(e)=>{handleInputChange(e)}} value={form.estado}>
                    <option value="">Selecciona una opción</option>
                    <option value="si">Si</option>
                    <option value="">No</option>
                </select>
                <label>Imagen (link)</label>
                <input name="imagen" id="imagen" type="text" onChange={(e)=>{handleInputChange(e)}} value={form.imagen}/>
                <input type="submit" value='Agregar'/>
            </form>
        </div>
    )
}

export default NuevaNovedad;