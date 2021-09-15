import React from 'react'
import { useDispatch } from 'react-redux';
// import { useParams } from 'react-router';
import { useHistory } from 'react-router-dom';
import { useForm } from '../../../hooks/useForm';
import { nuevoCurso } from '../../../redux/reducers/cursos/actions';
import styles from '../../../assets/styles/global.module.css'

const NuevoCurso = () => {

    // const {id} = useParams();
    const dispatch = useDispatch();
    const history = useHistory();

    const initialform = {
        titulo: '',
        descripcion: '',
        link: false,
        imagen: false,
        estado: '',
        categoria: ''
    };

    const [form, handleInputChange, reset] = useForm(initialform);

    const handleSubmit = (e) => {
        e.preventDefault();
        dispatch(nuevoCurso(form));
        reset()
        history.push('/admin');
    } 

    // useEffect(() => {
    //     if(id){

    //     }
    // }, [input])

    return (
        <div>
            <form onSubmit={handleSubmit} className={styles.formAdmin}>
                <label>Titulo</label>
                <input name="titulo" id="titulo" type="text" onChange={(e)=>{handleInputChange(e)}} value={form.titulo}/>
                <label>Descripcion</label>
                <input name="descripcion" id="descripcion" type="text" onChange={(e)=>{handleInputChange(e)}} value={form.descripcion}/>
                <label>Estado</label>
                <select name='estado' id='estado' onChange={(e)=>{handleInputChange(e)}} value={form.estado}>
                    <option value="">Selecciona un Estado</option>
                    <option value="terminado">Terminado</option>
                    <option value="inscripcion_abierta">Inscripción Abierta</option>
                </select>
                <label>Categoría</label>
                <select name='categoria' id='categoria' onChange={(e)=>{handleInputChange(e)}} value={form.categoria}>
                    <option value="">Selecciona una Categoria</option>
                    <option value="nuevos">Nuevos</option>
                    <option value="2021">2021</option>
                    <option value="20-19">2020-2019</option>
                </select>
                <label>Link</label>
                <input name="link" id="link" type="text" onChange={(e)=>{handleInputChange(e)}}  value={form.link}/>
                <label>Imagen (link)</label>
                <input name="imagen" id="imagen" type="text" onChange={(e)=>{handleInputChange(e)}} value={form.imagen}/>
                <input type="submit" value='Agregar'/>
            </form>
        </div>
    )
}

export default NuevoCurso;