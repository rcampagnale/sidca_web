import React, { useEffect, useRef } from 'react'
import { useDispatch, useSelector } from 'react-redux';
import { useParams } from 'react-router';
import { useHistory } from 'react-router-dom';
import { useForm } from '../../../hooks/useForm';
import { clearStatus, nuevoCurso, uploadCurso, uploadImg } from '../../../redux/reducers/cursos/actions';
import styles from './styles.module.css';
import global from '../../../assets/styles/global.module.css';
import Swal from 'sweetalert2'
import { Spinner } from '../../../components/Spinner/Spinner';

import { InputText } from 'primereact/inputtext';
import { InputTextarea } from 'primereact/inputtextarea';
import { Dropdown } from 'primereact/dropdown';
import { Button } from 'primereact/button';
import { FileUpload } from 'primereact/fileupload';
import { ProgressBar } from 'primereact/progressbar';

const NuevoCurso = () => {

    const dispatch = useDispatch();
    const history = useHistory();
    const { id } = useParams();

    const initialform = {
        titulo: '',
        descripcion: '',
        link: '',
        imagen: '',
        estado: '',
        categoria: ''
    };

    const cursos = useSelector(state => state.cursos)
    const [form, handleInputChange, reset] = useForm(id ? cursos.curso : initialform);

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (form.titulo === '' || form.estado === '' || form.categoria === '') {
            Swal.fire({
                title: 'Error!',
                text: 'Titulo, estado y categoría son campos obligatorios',
                icon: 'error',
                confirmButtonText: 'Ok'
            })
            return false
        }
        if (id) {
            await dispatch(uploadCurso(form, cursos.curso.id))
        } else {
            await dispatch(nuevoCurso(form))
        }
        history.push('/admin/cursos')
    }

    useEffect(() => {
        if (id && cursos.curso) {
            Object.entries(cursos.curso).map(([key, value]) => {
                if (key && value) {
                    handleInputChange({ target: { name: key, value: value } })
                }
            })
        }
    }, [cursos.curso])

    const estados = [
        { label: 'Terminado', value: 'terminado' },
        { label: 'Inscripción Abierta', value: 'inscripcion_abierta' },
    ];

    const categorias = [
        { label: 'Nuevos', value: 'nuevos' },
        { label: '2021', value: '2021' },
        { label: '2020-2019', value: '20-19' }
    ]

    const onUploadHandler = (e) => {
        let fileObj = e.files[0];
        dispatch(uploadImg(fileObj));
        fileUploader.current.clear()
    }

    const fileUploader = useRef()

    useEffect(() => {
        if (cursos.img) {
            handleInputChange({ target: { name: 'imagen', value: cursos.img } })
        }
    }, [cursos.img])

    return (
        <div className={styles.visibleContent}>
            <div className={styles.container}>
                <form onSubmit={handleSubmit} className={styles.formAdmin}>
                    <h2 className={styles.title}>{id ? 'Editar curso' : 'Nuevo curso'}</h2>

                    <span className={`p-float-label ${styles.inputSection}`}>
                        <InputText className={styles.inputForm} value={form.titulo} name="titulo" id="titulo" type="text" onChange={(e) => { handleInputChange(e) }} />
                        <label className={styles.labelForm} htmlFor="titulo">Titulo*</label>
                    </span>

                    <span className={`p-float-label ${styles.inputSection}`}>
                        <InputTextarea className={styles.inputForm} name="descripcion" id="descripcion" type="text" onChange={(e) => { handleInputChange(e) }} value={form.descripcion} rows={3} />
                        <label className={styles.labelForm} htmlFor="descripcion">Descripción</label>
                    </span>

                    <span className={`p-float-label ${styles.inputSection}`}>
                        <Dropdown className={styles.inputForm} inputId="dropdown" value={form.estado} name='estado' id='estado' onChange={(e) => { handleInputChange(e) }} options={estados} />
                        <label className={styles.labelForm} htmlFor="estado">Estado*</label>
                    </span>

                    <span className={`p-float-label ${styles.inputSection}`}>
                        <Dropdown className={styles.inputForm} inputId="dropdown" value={form.categoria} name='categoria' id='categoria' onChange={(e) => { handleInputChange(e) }} options={categorias} />
                        <label className={styles.labelForm} htmlFor="categoria">Categoría*</label>
                    </span>

                    <span className={`p-float-label ${styles.inputSection}`}>
                        <InputText className={styles.inputForm} value={form.link} name="link" id="link" type="text" onChange={(e) => { handleInputChange(e) }} />
                        <label className={styles.labelForm} htmlFor="link">Link</label>
                    </span>

                    <span className={`p-float-label ${styles.inputSection}`}>
                        <FileUpload
                            mode="basic"
                            name="cargar_imagen"
                            accept="image/*"
                            maxFileSize={1000000}
                            uploadHandler={onUploadHandler}
                            customUpload
                            auto
                            chooseLabel={form.imagen === '' ? "Subir Imagen" : "Cambiar Imagen"}
                            ref={fileUploader}
                            className={global.mb_20}
                        />
                        {
                            cursos.uploading && <ProgressBar value={cursos.progress} className={global.mb_20}></ProgressBar>
                        }
                        {
                            form.imagen !== '' && <img src={form.imagen} alt="imagen" className={styles.img} />
                        }
                        {/* <InputText className={styles.inputForm} value={form.imagen} name="imagen" id="imagen" type="text" onChange={(e)=>{handleInputChange(e)}} /> */}
                        {/* <label className={styles.labelForm} htmlFor="imagen">Imagen</label> */}
                    </span>

                    {/* <span className={`p-float-label ${styles.inputSection}`}>
                    <InputText className={styles.inputForm} value={form.imagen} name="imagen" id="imagen" type="text" onChange={(e)=>{handleInputChange(e)}} />
                    <label className={styles.labelForm} htmlFor="imagen">Imagen (link)</label>
                </span> */}

                    <Button type="submit" label={id ? 'Editar' : 'Agregar'} className={`p-button-raised p-button-warning ${styles.submitButton}`} />
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