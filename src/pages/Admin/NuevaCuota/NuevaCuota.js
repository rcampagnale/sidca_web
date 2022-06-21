import React, { useEffect } from 'react'
import { useDispatch, useSelector } from 'react-redux';
import { useHistory } from 'react-router-dom';
import { useParams } from 'react-router';
import { useForm } from '../../../hooks/useForm';
import { clearStatus, nuevoEnlace, uploadEnlace } from '../../../redux/reducers/enlaces/actions';
import styles from './styles.module.css';
import Swal from 'sweetalert2'
import { Spinner } from '../../../components/Spinner/Spinner';

import { InputText } from 'primereact/inputtext';
import { InputTextarea } from 'primereact/inputtextarea';
import { Dropdown } from 'primereact/dropdown';
import { Button } from 'primereact/button';

const NuevaCuota = () => {

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
    const [form, handleInputChange, reset] = useForm(id ? enlace.enlace : initialform);

    const handleSubmit = async (e) => {
        e.preventDefault();
        if(form.titulo === '' || form.descripcion === '' || form.prioridad === '' || form.link === ''){
            Swal.fire({
                title: 'Error!',
                text: 'Todos los campos son obligatorios',
                icon: 'error',
                confirmButtonText: 'Ok'
            })
            return false
        }
        if(id){
            await dispatch(uploadEnlace(form, enlace.enlace.id))
        }else {
            await dispatch(nuevoEnlace(form))
        }
        history.push('/admin/enlaces')
    }

    useEffect(() => {
        if(id && enlace.enlace){
            Object.entries(enlace.enlace).map(([key, value]) => {
                if(key && value){
                    handleInputChange({target: {name: key, value: value}})
                }
            })
        }
    }, [enlace.enlace])

    return (
        <div className={styles.visibleContent}>
            <div className={styles.container}>
            <form onSubmit={handleSubmit} className={styles.formAdmin}>
                <h2 className={styles.title}>{id ? 'Editar enlace' : 'Nuevo enlace'}</h2>
                
                <span className={`p-float-label ${styles.inputSection}`}>
                    <InputText className={styles.inputForm} value={form.titulo} name="titulo" id="titulo" type="text" onChange={(e)=>{handleInputChange(e)}} />
                    <label className={styles.labelForm} htmlFor="titulo">Titulo*</label>
                </span>

                <span className={`p-float-label ${styles.inputSection}`}>
                    <InputTextarea className={styles.inputForm} name="descripcion" id="descripcion" type="text" onChange={(e)=>{handleInputChange(e)}} value={form.descripcion} rows={3}/> 
                    <label className={styles.labelForm} htmlFor="descripcion">Descripción*</label>
                </span>

                <span className={`p-float-label ${styles.inputSection}`}>
                    <InputText className={styles.inputForm} name="link" id="link" type="text" onChange={(e)=>{handleInputChange(e)}} value={form.link} />
                    <label className={styles.labelForm} htmlFor="link">Link*</label>
                </span>

                <span className={`p-float-label ${styles.inputSection}`}>
                    <InputText className={styles.inputForm} name="prioridad" id="prioridad" type="number" onChange={(e)=>{handleInputChange(e)}} value={form.prioridad}/>
                    <label className={styles.labelForm} htmlFor="prioridad">Prioridad*</label>
                </span>
                
                <Button type="submit" label={id ? 'Editar' : 'Agregar'} className={`p-button-raised p-button-warning ${styles.submitButton}`} />
            </form>
                {
                    enlace.processing 
                    &&
                    <Spinner />
                }
        </div>
        </div>
    )
}

export default NuevaCuota;