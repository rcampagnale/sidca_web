import React, { useEffect } from 'react'
import { useDispatch, useSelector } from 'react-redux';
import { useParams } from 'react-router';
import { useHistory } from 'react-router-dom';
import { useForm } from '../../../hooks/useForm';
import styles from '../../../assets/styles/global.module.css'
import { clearStatus, nuevaNovedad } from '../../../redux/reducers/novedades/actions';
import Swal from 'sweetalert2'
import { Spinner } from '../../../components/Spinner/Spinner';

const NuevaNovedad = () => {

    const dispatch = useDispatch();
    const history = useHistory();
    const {id} = useParams();

    const initialform = {
        titulo: '',
        descripcion: '',
        link: false,
        imagen: false,
        categoria: '',
        descarga: false,
        prioridad: 0,
    };

    const novedades = useSelector(state => state.novedades)
    const [form, handleInputChange, reset] = useForm(initialform);

    const handleSubmit = (e) => {
        e.preventDefault();
        if(form.titulo === '' || form.descripcion === '' || form.categoria === ''){
            Swal.fire({
                title: 'Error!',
                text: 'Titulo, descripcion y categoria son campos obligatorios',
                icon: 'error',
                confirmButtonText: 'OK'
            })
            return false
        }
        dispatch(nuevaNovedad(form));
    }

    useEffect(() => {
        if(novedades.status == 'SUCCESS'){
            Swal.fire({
                title: 'Solicitud Exitosa',
                text: novedades.msg,
                icon: 'success',
                confirmButtonText: 'Continuar'
            })
            reset()
            dispatch(clearStatus())
        }if (novedades.status == 'FAILURE'){
            Swal.fire({
                title: 'Error!',
                text: novedades.msg,
                icon: 'error',
                confirmButtonText: 'Continuar'
            })
            dispatch(clearStatus())
        }
    }, [novedades])

    return (
        <div className={styles.container}>
            <form onSubmit={handleSubmit} className={styles.formAdmin}>
                <h2 className={styles.title}>{id ? 'Editar Novedad' : 'Agregar Novedad'}</h2>
                <label className={styles.labelForm}>Titulo</label>
                <input 
                    name="titulo" 
                    id="titulo" 
                    type="text" 
                    className={styles.inputForm}
                    onChange={(e)=>{handleInputChange(e)}} 
                    value={form.titulo}
                />
                <label className={styles.labelForm}>Descripcion</label>
                <input 
                    name="descripcion" 
                    id="descripcion" 
                    type="text" 
                    className={styles.inputForm}
                    onChange={(e)=>{handleInputChange(e)}} 
                    value={form.descripcion}
                />
                <label className={styles.labelForm}>Categoría</label>
                <select 
                    name='categoria' 
                    id='categoria' 
                    className={styles.inputForm}
                    onChange={(e)=>{handleInputChange(e)}} 
                    value={form.categoria}
                >
                    <option value="">Selecciona una Categoria</option>
                    <option value="turismo">Turismo</option>
                    <option value="casa">Casa del Docente</option>
                    <option value="predio">Predio</option>
                </select>
                <label className={styles.labelForm}>Prioridad</label>
                <input 
                    name="prioridad" 
                    id="prioridad" 
                    type="number" 
                    className={styles.inputForm}
                    onChange={(e)=>{handleInputChange(e)}}
                />
                <label className={styles.labelForm}>Link</label>
                <input 
                    name="link" 
                    id="link" 
                    type="text" 
                    className={styles.inputForm}
                    onChange={(e)=>{handleInputChange(e)}} 
                    value={form.link}
                />
                <label className={styles.labelForm}>¿Es un archivo descargable?</label>
                <select 
                    name='estado' 
                    id='estado' 
                    onChange={(e)=>{handleInputChange(e)}} 
                    className={styles.inputForm}
                    value={form.estado}
                >
                    <option value="">Selecciona una opción</option>
                    <option value="si">Si</option>
                    <option value="">No</option>
                </select>
                <label className={styles.labelForm}>Imagen (link)</label>
                <input 
                    name="imagen" 
                    id="imagen" 
                    type="text" 
                    className={styles.inputForm}
                    onChange={(e)=>{handleInputChange(e)}} 
                    value={form.imagen}
                />
                <input type="submit" value={id ? 'Editar' : 'Agregar'} className={styles.submitButton}/>
            </form>
            {
                novedades.processing 
                &&
                <Spinner />
            }
        </div>
    )
}

export default NuevaNovedad;