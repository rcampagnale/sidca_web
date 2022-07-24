import React, { useEffect, useMemo } from 'react'
import { useDispatch, useSelector } from 'react-redux';
import { useHistory } from 'react-router-dom';
import { useParams } from 'react-router';
import { useForm } from '../../../hooks/useForm';
import { nuevoAfiliado, updateUser } from '../../../redux/reducers/afiliados/actions';
import styles from './styles.module.css';
import Swal from 'sweetalert2'
import { Spinner } from '../../../components/Spinner/Spinner';

import { InputText } from 'primereact/inputtext';
import { Button } from 'primereact/button';

const NuevoAfiliado = () => {

    const dispatch = useDispatch();

    const { id } = useParams();
    const history = useHistory();

    const initialform = {
        dni: '',
        nombre: '',
        apellido: '',
    };

    const afiliado = useSelector(state => state.afiliado)
    const [form, handleInputChange, reset] = useForm(initialform);

    //TODO agregar cargo y departamento

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (form.nombre === '' || form.apellido === '' || form.dni === '') {
            Swal.fire({
                title: 'Error!',
                text: 'Todos los campos son obligatorios',
                icon: 'error',
                confirmButtonText: 'Ok'
            })
            return false
        }
        if (id) {
            await dispatch(updateUser(form, id))
        } else {
            await dispatch(nuevoAfiliado(form))
        }
        history.push('/admin/usuarios')
    }

    useEffect(() => {
        if (id && afiliado.userEdit) {
            Object.entries(afiliado.userEdit).map(([key, value]) => {
                if (key && value) {
                    handleInputChange({ target: { name: key, value: value } })
                }
            })
        }
    }, [afiliado.userEdit])

    return (
        <div className={styles.visibleContent}>
            <div className={styles.container}>
                <form onSubmit={handleSubmit} className={styles.formAdmin}>
                    <h2 className={styles.title}>{id ? 'Editar usuario' : 'Agregar usuario'}</h2>

                    <span className={`p-float-label ${styles.inputSection}`}>
                        <InputText className={styles.inputForm} value={form.nombre} name="nombre" id="nombre" type="text" onChange={(e) => { handleInputChange(e) }} />
                        <label className={styles.labelForm} htmlFor="nombre">Nombre*</label>
                    </span>

                    <span className={`p-float-label ${styles.inputSection}`}>
                        <InputText className={styles.inputForm} value={form.apellido} name="apellido" id="apellido" type="text" onChange={(e) => { handleInputChange(e) }} />
                        <label className={styles.labelForm} htmlFor="apellido">Apellido*</label>
                    </span>

                    <span className={`p-float-label ${styles.inputSection}`}>
                        <InputText className={styles.inputForm} value={form.dni} name="dni" id="dni" type="text" onChange={(e) => { handleInputChange(e) }} maxLength={8} />
                        <label className={styles.labelForm} htmlFor="dni">DNI*</label>
                    </span>

                    <Button type="submit" label={id ? 'Editar' : 'Agregar'} className={`p-button-raised p-button-warning ${styles.submitButton}`} />
                </form>
                {
                    afiliado.processing
                    &&
                    <Spinner />
                }
                {
                    id && afiliado.userEdit
                    &&
                    <div className={styles.searchContainer}>
                        <h2 className={styles.title}>{afiliado.userEdit.apellido + ', ' + afiliado.userEdit.nombre}</h2>
                        <h2 className={styles.title}>{afiliado.userEdit.dni}</h2>
                    </div>
                }
            </div>
        </div>
    )
}

export default NuevoAfiliado;