import React from 'react'
import { useDispatch } from 'react-redux';
import { useHistory } from 'react-router-dom';
import { useForm } from '../../../hooks/useForm';
import styles from '../../../assets/styles/global.module.css'
import { nuevoAsesoramiento } from '../../../redux/reducers/asesoramiento/actions';

const NuevoAsesoramiento = () => {

    const dispatch = useDispatch();

    const history = useHistory();

    const initialform = {
        titulo: '',
        descripcion: '',
        link: '',
        imagen: '',
        categoria: '',
        descarga: false,
        prioridad: 0,
    };

    const [form, handleInputChange, reset] = useForm(initialform);

    const handleSubmit = (e) => {
        e.preventDefault();
        dispatch(nuevoAsesoramiento(form));
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
                    <option value="leyes">Legal | leyes</option>
                    <option value="decretos">Legal | Decretos</option>
                    <option value="resoluciones">Legal | Resolución</option>
                    <option value="otros">Legal | Otros</option>
                    <option value="paritarias">Gremial | Paritarias</option>
                    <option value="escala_salarial">Gremial | Escala Salarial</option>
                    <option value="novedades">Gremial | Novedades</option>
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
                    <option value="no">Selecciona una opción</option>
                    <option value="si">Si</option>
                    <option value="no">No</option>
                </select>
                <label>Imagen (link)</label>
                <input name="imagen" id="imagen" type="text" onChange={(e)=>{handleInputChange(e)}} value={form.imagen}/>
                <input type="submit" value='Agregar'/>
            </form>
        </div>
    )
}

export default NuevoAsesoramiento;