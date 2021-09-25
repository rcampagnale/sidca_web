import React, { useEffect } from 'react'
import { useDispatch, useSelector } from 'react-redux';
import { useHistory } from 'react-router-dom';
import { useParams } from 'react-router';
import { useForm } from '../../../hooks/useForm';
import { clearStatus, nuevoEnlace } from '../../../redux/reducers/enlaces/actions';
import styles from '../../../assets/styles/global.module.css'
import Swal from 'sweetalert2'
import { Spinner } from '../../../components/Spinner/Spinner';

const NuevoEnlace = () => {

    const dispatch = useDispatch();
    const history = useHistory();
    const {id} = useParams();

    const initialform = {
        titulo: '',
        descripcion: '',
        link: '',
        prioridad: '',
    };

    const enlace = useSelector(state => state.enlace);
    const [form, handleInputChange, reset] = useForm(initialform);

    const handleSubmit = (e) => {
        e.preventDefault();
        if(form.titulo === '' || form.descripcion === '' || form.prioridad === '' || form.link === ''){
            Swal.fire({
                title: 'Error!',
                text: 'Todos los campos son obligatorios',
                icon: 'error',
                confirmButtonText: 'OK'
            })
            return false
        }
        dispatch(nuevoEnlace(form))
    }   

    //MESSAGE
    useEffect(() => {
        if(enlace.status == 'SUCCESS'){
            Swal.fire({
                title: 'Solicitud Exitosa',
                text: enlace.msg,
                icon: 'success',
                confirmButtonText: 'Continuar'
            })
            reset()
            dispatch(clearStatus())
        }if (enlace.status == 'FAILURE'){
            Swal.fire({
                title: 'Error!',
                text: enlace.msg,
                icon: 'error',
                confirmButtonText: 'Continuar'
            })
            dispatch(clearStatus())
        }
    }, [enlace])

    return (
        <div className={styles.container}>
            <form onSubmit={handleSubmit} className={styles.formAdmin}>
                <h2 className={styles.title}>{id ? 'Editar Enlace' : 'Nuevo Enlace'}</h2>
                <label className={styles.labelForm}>Titulo *</label>
                <input 
                    name="titulo" 
                    id="titulo" 
                    type="text" 
                    className={styles.inputForm}
                    onChange={(e)=>{handleInputChange(e)}} 
                    value={form.titulo}
                />
                <label className={styles.labelForm}>Descripcion *</label>
                <input 
                    name="descripcion" 
                    id="descripcion"
                    type="text" 
                    className={styles.inputForm}
                    onChange={(e)=>{handleInputChange(e)}}
                    value={form.descripcion}
                />
                <label className={styles.labelForm}>Link *</label>
                <input 
                    name="link" 
                    id="link" 
                    type="text" 
                    className={styles.inputForm}
                    onChange={(e)=>{handleInputChange(e)}}
                    value={form.link}
                />
                <label className={styles.labelForm}>Prioridad *</label>
                <input 
                    name="prioridad" 
                    id="prioridad" 
                    type="number" 
                    className={styles.inputForm}
                    onChange={(e)=>{handleInputChange(e)}}
                    value={form.prioridad}
                />
                <input type="submit" value={id ? 'Editar' : 'Agregar'} className={styles.submitButton}/>
            </form>
            {
                enlace.processing 
                &&
                <Spinner />
            }
        </div>
    )
}

export default NuevoEnlace;