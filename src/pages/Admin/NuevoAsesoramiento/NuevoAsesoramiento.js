import React, { useEffect } from 'react'
import { useDispatch, useSelector } from 'react-redux';
import { useHistory } from 'react-router-dom';
import { useParams } from 'react-router';
import { useForm } from '../../../hooks/useForm';
import styles from '../../../assets/styles/global.module.css'
import { clearStatus, nuevoAsesoramiento } from '../../../redux/reducers/asesoramiento/actions';
import Swal from 'sweetalert2'
import { Spinner } from '../../../components/Spinner/Spinner';

const NuevoAsesoramiento = () => {

    const dispatch = useDispatch();
    const {id} = useParams();
    const history = useHistory();

    const asesoramiento = useSelector(state => state.asesoramiento)

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
        if(form.titulo === '' || form.estado === '' || form.categoria === ''){
            Swal.fire({
                title: 'Error!',
                text: 'Titulo, estado y categoría son campos obligatorios',
                icon: 'error',
                confirmButtonText: 'OK'
            })
            return false
        }
        dispatch(nuevoAsesoramiento(form));
    }

    useEffect(() => {
        if(asesoramiento.status == 'SUCCESS'){
            Swal.fire({
                title: 'Solicitud Exitosa',
                text: asesoramiento.msg,
                icon: 'success',
                confirmButtonText: 'Continuar'
            })
            reset()
            dispatch(clearStatus())
        }if (asesoramiento.status == 'FAILURE'){
            Swal.fire({
                title: 'Error!',
                text: asesoramiento.msg,
                icon: 'error',
                confirmButtonText: 'Continuar'
            })
            dispatch(clearStatus())
        }
    }, [asesoramiento])

    return (
        <div className={styles.container}>
            <form onSubmit={handleSubmit} className={styles.formAdmin}>
                <h2 className={styles.title}>{id ? 'Editar Asesoramiento' : 'Nuevo Asesoramiento'}</h2>
                <label className={styles.labelForm}>Titulo</label>
                <input 
                    className={styles.inputForm}
                    name="titulo" 
                    id="titulo" 
                    type="text"
                    onChange={(e)=>{handleInputChange(e)}} 
                    value={form.titulo}
                />
                <label className={styles.labelForm}>Descripcion</label>
                <input 
                    className={styles.inputForm}
                    name="descripcion" 
                    id="descripcion" 
                    type="text" 
                    onChange={(e)=>{handleInputChange(e)}} 
                    value={form.descripcion}
                />
                <label className={styles.labelForm}>Categoría</label>
                <select 
                    className={styles.inputForm}
                    name='categoria' 
                    id='categoria' 
                    onChange={(e)=>{handleInputChange(e)}} 
                    value={form.categoria}
                >
                    <option value="">Selecciona una Categoria</option>
                    <option value="leyes">Legal | leyes</option>
                    <option value="decretos">Legal | Decretos</option>
                    <option value="resoluciones">Legal | Resolución</option>
                    <option value="otros">Legal | Otros</option>
                    <option value="paritarias">Gremial | Paritarias</option>
                    <option value="escala_salarial">Gremial | Escala Salarial</option>
                    <option value="novedades">Gremial | Novedades</option>
                </select>
                <label className={styles.labelForm}>Prioridad</label>
                <input 
                    className={styles.inputForm}
                    name="prioridad" 
                    id="prioridad" 
                    type="number" 
                    onChange={(e)=>{handleInputChange(e)}}
                    value={form.prioridad}
                />
                <label className={styles.labelForm}>Link</label>
                <input 
                    className={styles.inputForm} 
                    name="link" 
                    id="link" 
                    type="text" 
                    onChange={(e)=>{handleInputChange(e)}} 
                    value={form.link}
                />
                <label className={styles.labelForm}>¿Es un archivo descargable?</label>
                <select 
                    className={styles.inputForm} 
                    name='descarga' 
                    id='descarga' 
                    onChange={(e)=>{handleInputChange(e)}} 
                    value={form.descarga}
                >
                    <option value="no">Selecciona una opción</option>
                    <option value="si">Si</option>
                    <option value="no">No</option>
                </select>
                <label className={styles.labelForm}>Imagen (link)</label>
                <input 
                    className={styles.inputForm} 
                    name="imagen" 
                    id="imagen" 
                    type="text" 
                    onChange={(e)=>{handleInputChange(e)}} 
                    value={form.imagen}
                />
                <input className={styles.submitButton} type="submit" value={id ? 'Editar' : 'Agregar'}/>
                {
                    asesoramiento.processing 
                    &&
                    <Spinner />
                }
            </form>
        </div>
    )
}

export default NuevoAsesoramiento;