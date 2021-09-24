import React, { useEffect } from 'react'
import { useDispatch, useSelector } from 'react-redux';
import { useHistory } from 'react-router-dom';
import { useForm } from '../../../hooks/useForm';
import { clearStatus, nuevoAfiliado } from '../../../redux/reducers/afiliados/actions';
import globalStyles from '../../../assets/styles/global.module.css'
import Swal from 'sweetalert2'
import { Spinner } from '../../../components/Spinner/Spinner';

const NuevoAfiliado = () => {

    const dispatch = useDispatch();
    
    const history = useHistory();

    const initialform = {
        dni: '',
        nombre: '',
        apellido: ''
    };

    const afiliado = useSelector(state => state.afiliado)
    const [form, handleInputChange, reset] = useForm(initialform);

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
        <div className={globalStyles.container}>
            <form onSubmit={handleSubmit} className={globalStyles.formAdmin}>
                <label>Nombre</label>
                <input value={form.nombre} name="nombre" id="nombre" type="text" onChange={(e)=>{handleInputChange(e)}}/>
                <label>Apellido</label>
                <input value={form.apellido} name="apellido" id="apellido" type="text" onChange={(e)=>{handleInputChange(e)}}/>
                <label>DNI</label>
                <input value={form.dni} name="dni" id="dni" type="number" onChange={(e)=>{handleInputChange(e)}} maxLength={8}/>
                <input type="submit" value='Agregar'/>
                {
                    afiliado.processing 
                    &&
                    <Spinner />
                }
            </form>
        </div>
    )
}

export default NuevoAfiliado;