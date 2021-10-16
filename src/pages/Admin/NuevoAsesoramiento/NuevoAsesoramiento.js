import React, { useEffect } from 'react'
import { useDispatch, useSelector } from 'react-redux';
import { useHistory } from 'react-router-dom';
import { useParams } from 'react-router';
import { useForm } from '../../../hooks/useForm';
import styles from './styles.module.css';
import { clearStatus, nuevoAsesoramiento } from '../../../redux/reducers/asesoramiento/actions';
import Swal from 'sweetalert2'
import { Spinner } from '../../../components/Spinner/Spinner';

import { InputText } from 'primereact/inputtext';
import { InputTextarea } from 'primereact/inputtextarea';
import { Dropdown } from 'primereact/dropdown';
import { Button } from 'primereact/button';

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
        if(form.titulo === '' || form.categoria === ''){
            Swal.fire({
                title: 'Error!',
                text: 'Titulo y categoría son campos obligatorios',
                icon: 'error',
                confirmButtonText: 'Ok'
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

    const opciones = [
        {label: 'Si', value: 'si'},
        {label: 'No', value: 'no'},
    ];

    const categorias = [
        {label: 'Legal | Leyes', value: 'leyes'},
        {label: 'Legal | Decretos', value: 'decretos'},
        {label: 'Legal | Resolución', value: 'resoluciones'},
        {label: 'Legal | Otros', value: 'otros'},
        {label: 'Gremial | Paritarias', value: 'paritarias'},
        {label: 'Gremial | Escala Salarial', value: 'escala_salarial'},
        {label: 'Gremial | Novedades', value: 'novedades'},
    ]

    return (
        <div className={styles.visibleContent}>
            <div className={styles.container}>
            <form onSubmit={handleSubmit} className={styles.formAdmin}>
                <h2 className={styles.title}>{id ? 'Editar asesoramiento' : 'Nuevo asesoramiento'}</h2>
                
                <span className={`p-float-label ${styles.inputSection}`}>
                    <InputText className={styles.inputForm} value={form.titulo} name="titulo" id="titulo" type="text" onChange={(e)=>{handleInputChange(e)}} />
                    <label className={styles.labelForm} htmlFor="titulo">Titulo*</label>
                </span>

                <span className={`p-float-label ${styles.inputSection}`}>
                    <InputTextarea className={styles.inputForm} name="descripcion" id="descripcion" type="text" onChange={(e)=>{handleInputChange(e)}} value={form.descripcion} rows={3}/> 
                    <label className={styles.labelForm} htmlFor="descripcion">Descripción</label>
                </span>

                <span className={`p-float-label ${styles.inputSection}`}>
                    <Dropdown className={styles.inputForm} inputId="dropdown" value={form.categoria} name='categoria' id='categoria' onChange={(e)=>{handleInputChange(e)}} options={categorias}/>                    
                    <label className={styles.labelForm} htmlFor="categoria">Categoría*</label>
                </span>

                <span className={`p-float-label ${styles.inputSection}`}>
                    <InputText className={styles.inputForm} name="prioridad" id="prioridad" type="number" onChange={(e)=>{handleInputChange(e)}} value={form.prioridad}/>
                    <label className={styles.labelForm} htmlFor="prioridad">Prioridad</label>
                </span>

                <span className={`p-float-label ${styles.inputSection}`}>
                    <InputText className={styles.inputForm} value={form.link} name="link" id="link" type="text" onChange={(e)=>{handleInputChange(e)}} />
                    <label className={styles.labelForm} htmlFor="link">Link</label>
                </span>

                <span className={`p-float-label ${styles.inputSection}`}>
                    <Dropdown className={styles.inputForm} inputId="dropdown" value={form.descarga} name='descarga' id='descarga' onChange={(e)=>{handleInputChange(e)}} options={opciones}/>                    
                    <label className={styles.labelForm} htmlFor="descarga">¿Es un archivo descargable?</label>
                </span>

                <span className={`p-float-label ${styles.inputSection}`}>
                    <InputText className={styles.inputForm} value={form.imagen} name="imagen" id="imagen" type="text" onChange={(e)=>{handleInputChange(e)}} />
                    <label className={styles.labelForm} htmlFor="imagen">Imagen (link)</label>
                </span>
                
                <Button type="submit" label={id ? 'Editar' : 'Agregar'} className={`p-mt-2 ${styles.submitButton}`} />
            </form>
                {
                    asesoramiento.processing 
                    &&
                    <Spinner />
                }
        </div>
        </div>
    )
}

export default NuevoAsesoramiento;