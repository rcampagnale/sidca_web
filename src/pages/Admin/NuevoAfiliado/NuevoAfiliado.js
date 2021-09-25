import React, { useEffect } from 'react'
import { useDispatch, useSelector } from 'react-redux';
import { useHistory } from 'react-router-dom';
import { useParams } from 'react-router';
import { useForm } from '../../../hooks/useForm';
import { clearStatus, nuevoAfiliado } from '../../../redux/reducers/afiliados/actions';
import styles from '../../../assets/styles/global.module.css'
import Swal from 'sweetalert2'
import { Spinner } from '../../../components/Spinner/Spinner';

const NuevoAfiliado = () => {

    const dispatch = useDispatch();
    
    const {id} = useParams();
    const history = useHistory();

    const initialform = {
        dni: '',
        nombre: '',
        apellido: ''
    };

    const afiliado = useSelector(state => state.afiliado)
    const [form, handleInputChange, reset] = useForm(initialform);

    //TODO agregar cargo y departamento

    const handleSubmit = async(e) => {
        e.preventDefault();
        if(form.nombre === '' || form.apellido === '' || form.dni === ''){
            Swal.fire({
                title: 'Error!',
                text: 'Tienes que llenar todos los datos',
                icon: 'error',
                confirmButtonText: 'OK'
            })
            return false
        }
        await dispatch(nuevoAfiliado(form));
    }   

    useEffect(() => {
        if(afiliado.status == 'SUCCESS'){
            Swal.fire({
                title: 'Solicitud Exitosa',
                text: afiliado.msg,
                icon: 'success',
                confirmButtonText: 'Continuar'
            })
            reset()
            dispatch(clearStatus())
        }if (afiliado.status == 'FAILURE'){
            Swal.fire({
                title: 'Error!',
                text: afiliado.msg,
                icon: 'error',
                confirmButtonText: 'Continuar'
            })
            dispatch(clearStatus())
        }
    }, [afiliado])

    return (
        <div className={styles.container}>
            <form onSubmit={handleSubmit} className={styles.formAdmin}>            
                <h2 className={styles.title}>{id ? 'Editar Usuario' : 'Agregar Usuario'}</h2>
                <label className={styles.labelForm}>Nombre</label>
                <input 
                    value={form.nombre} 
                    name="nombre" 
                    id="nombre" 
                    type="text" 
                    className={styles.inputForm}
                    onChange={(e)=>{handleInputChange(e)}}
                />
                <label className={styles.labelForm}>Apellido</label>
                <input 
                    value={form.apellido} 
                    name="apellido" 
                    id="apellido" 
                    type="text" 
                    className={styles.inputForm}
                    onChange={(e)=>{handleInputChange(e)}}
                />
                <label className={styles.labelForm}>DNI</label>
                <input 
                    value={form.dni} 
                    name="dni" 
                    id="dni" 
                    type="number" 
                    className={styles.inputForm}
                    onChange={(e)=>{handleInputChange(e)}}
                    maxLength={8}
                />
                <input type="submit" value={id ? 'Editar' : 'Agregar'} className={styles.submitButton}/>
            </form>
            {
                afiliado.processing 
                &&
                <Spinner />
            }
        </div>
    )
}

export default NuevoAfiliado;