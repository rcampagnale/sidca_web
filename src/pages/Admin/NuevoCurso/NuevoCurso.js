import React, { useEffect } from 'react'
import { useDispatch, useSelector } from 'react-redux';
import { useParams } from 'react-router';
import { useHistory } from 'react-router-dom';
import { useForm } from '../../../hooks/useForm';
import { clearStatus, nuevoCurso } from '../../../redux/reducers/cursos/actions';
import styles from '../../../assets/styles/global.module.css'
import Swal from 'sweetalert2'
import { Spinner } from '../../../components/Spinner/Spinner';

const NuevoCurso = () => {

    const {id} = useParams();
    const dispatch = useDispatch();
    const history = useHistory();
    const cursos = useSelector(state => state.cursos)

    const initialform = {
        titulo: '',
        descripcion: '',
        link: '',
        imagen: '',
        estado: '',
        categoria: ''
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
        dispatch(nuevoCurso(form));
    } 

    // useEffect(() => {
    //     if(id){

    //     }
    // }, [input])

    //MESSAGE
    useEffect(() => {
        if(cursos.status == 'SUCCESS'){
            Swal.fire({
                title: 'Solicitud Exitosa',
                text: cursos.msg,
                icon: 'success',
                confirmButtonText: 'Continuar'
            })
            reset()
            dispatch(clearStatus())
        }if (cursos.status == 'FAILURE'){
            Swal.fire({
                title: 'Error!',
                text: cursos.msg,
                icon: 'error',
                confirmButtonText: 'Continuar'
            })
            dispatch(clearStatus())
        }
    }, [cursos])

    return (
        <div className={styles.container}>
            <form onSubmit={handleSubmit} className={styles.formAdmin}>
                <h2 className={styles.title}>{id ? 'Editar Curso' : 'Agregar Nuevo Curso'}</h2>
                <label className={styles.labelForm}>Titulo *</label>
                <input className={styles.inputForm} value={form.titulo} name="titulo" id="titulo" type="text" onChange={(e)=>{handleInputChange(e)}} value={form.titulo}/>
                <label className={styles.labelForm}>Descripcion</label>
                <input className={styles.inputForm} value={form.descripcion} name="descripcion" id="descripcion" type="text" onChange={(e)=>{handleInputChange(e)}} value={form.descripcion}/>
                <label className={styles.labelForm}>Estado *</label>
                <select className={styles.inputForm} value={form.estado} name='estado' id='estado' onChange={(e)=>{handleInputChange(e)}} value={form.estado}>
                    <option value="">Selecciona un Estado</option>
                    <option value="terminado">Terminado</option>
                    <option value="inscripcion_abierta">Inscripción Abierta</option>
                </select>
                <label className={styles.labelForm}>Categoría *</label>
                <select className={styles.inputForm} value={form.categoria} name='categoria' id='categoria' onChange={(e)=>{handleInputChange(e)}} value={form.categoria}>
                    <option value="">Selecciona una Categoria</option>
                    <option value="nuevos">Nuevos</option>
                    <option value="2021">2021</option>
                    <option value="20-19">2020-2019</option>
                </select>
                <label className={styles.labelForm}>Link</label>
                <input className={styles.inputForm} value={form.link} name="link" id="link" type="text" onChange={(e)=>{handleInputChange(e)}}  value={form.link}/>
                <label className={styles.labelForm}>Imagen (link)</label>
                <input className={styles.inputForm} value={form.imagen} name="imagen" id="imagen" type="text" onChange={(e)=>{handleInputChange(e)}} value={form.imagen}/>
                <input className={styles.submitButton} type="submit" value={id ? 'Editar' : 'Agregar'}/>
            </form>
                {
                    cursos.processing 
                    &&
                    <Spinner />
                }
        </div>
    )
}

export default NuevoCurso;