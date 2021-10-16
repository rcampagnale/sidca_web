import React, { useEffect } from 'react'
import { useDispatch, useSelector } from 'react-redux';
import { useParams } from 'react-router';
import { useHistory } from 'react-router-dom';
import { useForm } from '../../../hooks/useForm';
import { clearStatus, nuevoCurso } from '../../../redux/reducers/cursos/actions';
import styles from './styles.module.css';
import Swal from 'sweetalert2'
import { Spinner } from '../../../components/Spinner/Spinner';

import { InputText } from 'primereact/inputtext';
import { InputTextarea } from 'primereact/inputtextarea';
import { Dropdown } from 'primereact/dropdown';
import { Button } from 'primereact/button';

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
                confirmButtonText: 'Ok'
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

    const estados = [
        {label: 'Terminado', value: 'terminado'},
        {label: 'Inscripción Abierta', value: 'inscripcion_abierta'},
    ];

    const categorias = [
        {label: 'Nuevos', value: 'nuevos'},
        {label: '2021', value: '2021'},
        {label: '2020-2019', value: '20-19'}
    ]

    return (
        <div className={styles.visibleContent}>
            <div className={styles.container}>
            <form onSubmit={handleSubmit} className={styles.formAdmin}>
                <h2 className={styles.title}>{id ? 'Editar curso' : 'Nuevo curso'}</h2>
                
                <span className={`p-float-label ${styles.inputSection}`}>
                    <InputText className={styles.inputForm} value={form.titulo} name="titulo" id="titulo" type="text" onChange={(e)=>{handleInputChange(e)}} />
                    <label className={styles.labelForm} htmlFor="titulo">Titulo*</label>
                </span>

                <span className={`p-float-label ${styles.inputSection}`}>
                    <InputTextarea className={styles.inputForm} name="descripcion" id="descripcion" type="text" onChange={(e)=>{handleInputChange(e)}} value={form.descripcion} rows={3}/> 
                    <label className={styles.labelForm} htmlFor="descripcion">Descripción</label>
                </span>

                <span className={`p-float-label ${styles.inputSection}`}>
                    <Dropdown className={styles.inputForm} inputId="dropdown" value={form.estado} name='estado' id='estado' onChange={(e)=>{handleInputChange(e)}} options={estados} />                    
                    <label className={styles.labelForm} htmlFor="estado">Estado*</label>
                </span>

                <span className={`p-float-label ${styles.inputSection}`}>
                    <Dropdown className={styles.inputForm} inputId="dropdown" value={form.categoria} name='categoria' id='categoria' onChange={(e)=>{handleInputChange(e)}} options={categorias}/>                    
                    <label className={styles.labelForm} htmlFor="categoria">Categoría*</label>
                </span>

                <span className={`p-float-label ${styles.inputSection}`}>
                    <InputText className={styles.inputForm} value={form.link} name="link" id="link" type="text" onChange={(e)=>{handleInputChange(e)}} />
                    <label className={styles.labelForm} htmlFor="link">Link</label>
                </span>

                <span className={`p-float-label ${styles.inputSection}`}>
                    <InputText className={styles.inputForm} value={form.imagen} name="imagen" id="imagen" type="text" onChange={(e)=>{handleInputChange(e)}} />
                    <label className={styles.labelForm} htmlFor="imagen">Imagen (link)</label>
                </span>
                
                <Button type="submit" label={id ? 'Editar' : 'Agregar'} className={`p-mt-2 ${styles.submitButton}`} />
            </form>
                {
                    cursos.processing 
                    &&
                    <Spinner />
                }
        </div>
        </div>
    )
}

export default NuevoCurso;