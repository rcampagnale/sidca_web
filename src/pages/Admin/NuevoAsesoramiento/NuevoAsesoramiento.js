import React, { useEffect, useRef } from 'react'
import { useDispatch, useSelector } from 'react-redux';
import { useParams } from 'react-router';
import { useHistory } from 'react-router-dom';
import { useForm } from '../../../hooks/useForm';
import global from '../../../assets/styles/global.module.css';
import styles from './styles.module.css';
import { clearStatus, nuevoAsesoramiento, uploadAsesoramiento, uploadImg, } from '../../../redux/reducers/asesoramiento/actions';
import Swal from 'sweetalert2'
import { Spinner } from '../../../components/Spinner/Spinner';

import { InputText } from 'primereact/inputtext';
import { InputTextarea } from 'primereact/inputtextarea';
import { Dropdown } from 'primereact/dropdown';
import { Button } from 'primereact/button';
import { FileUpload } from 'primereact/fileupload';
import { ProgressBar } from 'primereact/progressbar';

const NuevoAsesoramiento = () => {

    const dispatch = useDispatch();
    const { id } = useParams();
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

    const [form, handleInputChange, reset] = useForm(id ? asesoramiento.asesoramiento : initialform);

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (form.titulo === '' || form.categoria === '') {
            Swal.fire({
                title: 'Error!',
                text: 'Titulo y categoría son campos obligatorios',
                icon: 'error',
                confirmButtonText: 'Ok'
            })
            return false
        }
        if (id) {
            await dispatch(uploadAsesoramiento(form, asesoramiento.asesoramiento.id))
        } else {
            await dispatch(nuevoAsesoramiento(form))
        }
        history.push('/admin/asesoramiento')
    }

    useEffect(() => {
        if (id && asesoramiento.asesoramiento) {
            Object.entries(asesoramiento.asesoramiento).map(([key, value]) => {
                if (key && value) {
                    handleInputChange({ target: { name: key, value: value } })
                }
            })
        }
    }, [asesoramiento.asesoramiento])

    const opciones = [
        { label: 'Si', value: 'si' },
        { label: 'No', value: 'no' },
    ];

    const categorias = [
        { label: 'Legal | Leyes', value: 'leyes' },
        { label: 'Legal | Decretos', value: 'decretos' },
        { label: 'Legal | Resolución', value: 'resoluciones' },
        { label: 'Legal | Otros', value: 'otros' },
        { label: 'Gremial | Paritarias', value: 'paritarias' },
        { label: 'Gremial | Escala Salarial', value: 'escala_salarial' },
        { label: 'Gremial | Novedades', value: 'novedades' },
    ]

    const onUploadHandler = (e) => {
        let fileObj = e.files[0];
        dispatch(uploadImg(fileObj));
        fileUploader.current.clear()
    }

    const fileUploader = useRef()

    useEffect(() => {
        if (asesoramiento.img) {
            handleInputChange({ target: { name: 'imagen', value: asesoramiento.img } })
        }
    }, [asesoramiento.img])

    return (
        <div className={styles.visibleContent}>
            <div className={styles.container}>
                <form onSubmit={handleSubmit} className={styles.formAdmin}>
                    <h2 className={styles.title}>{id ? 'Editar asesoramiento' : 'Nuevo asesoramiento'}</h2>

                    <span className={`p-float-label ${styles.inputSection}`}>
                        <InputText className={styles.inputForm} value={form.titulo} name="titulo" id="titulo" type="text" onChange={(e) => { handleInputChange(e) }} />
                        <label className={styles.labelForm} htmlFor="titulo">Titulo*</label>
                    </span>

                    <span className={`p-float-label ${styles.inputSection}`}>
                        <InputTextarea className={styles.inputForm} name="descripcion" id="descripcion" type="text" onChange={(e) => { handleInputChange(e) }} value={form.descripcion} rows={3} />
                        <label className={styles.labelForm} htmlFor="descripcion">Descripción</label>
                    </span>

                    <span className={`p-float-label ${styles.inputSection}`}>
                        <Dropdown className={styles.inputForm} inputId="dropdown" value={form.categoria} name='categoria' id='categoria' onChange={(e) => { handleInputChange(e) }} options={categorias} />
                        <label className={styles.labelForm} htmlFor="categoria">Categoría*</label>
                    </span>

                    <span className={`p-float-label ${styles.inputSection}`}>
                        <InputText className={styles.inputForm} name="prioridad" id="prioridad" type="number" onChange={(e) => { handleInputChange(e) }} value={form.prioridad} />
                        <label className={styles.labelForm} htmlFor="prioridad">Prioridad</label>
                    </span>

                    <span className={`p-float-label ${styles.inputSection}`}>
                        <InputText className={styles.inputForm} value={form.link} name="link" id="link" type="text" onChange={(e) => { handleInputChange(e) }} />
                        <label className={styles.labelForm} htmlFor="link">Link</label>
                    </span>

                    <span className={`p-float-label ${styles.inputSection}`}>
                        <Dropdown className={styles.inputForm} inputId="dropdown" value={form.descarga} name='descarga' id='descarga' onChange={(e) => { handleInputChange(e) }} options={opciones} />
                        <label className={styles.labelForm} htmlFor="descarga">¿Es un archivo descargable?</label>
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
                            asesoramiento.uploading && <ProgressBar value={asesoramiento.progress} className={global.mb_20}></ProgressBar>
                        }
                        {
                            form.imagen !== '' && <img src={form.imagen} alt="imagen" className={styles.img} />
                        }
                        {/* <InputText className={styles.inputForm} value={form.imagen} name="imagen" id="imagen" type="text" onChange={(e)=>{handleInputChange(e)}} /> */}
                        {/* <label className={styles.labelForm} htmlFor="imagen">Imagen</label> */}
                    </span>

                    <Button type="submit" label={id ? 'Editar' : 'Agregar'} className={`p-button-raised p-button-warning ${styles.submitButton}`} />
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