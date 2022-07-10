import React, { useEffect, useState } from 'react'
import { useDispatch, useSelector } from 'react-redux';
import { useHistory } from 'react-router-dom';
import { useParams } from 'react-router';
import { useForm } from '../../../hooks/useForm';
import { clearStatus, nuevaCuota, uploadCuota } from '../../../redux/reducers/cuotas/actions';
import styles from './styles.module.css';
import Swal from 'sweetalert2'
import { Spinner } from '../../../components/Spinner/Spinner';

import { InputText } from 'primereact/inputtext';
import { Button } from 'primereact/button';
import { Dropdown } from 'primereact/dropdown';

const NuevaCuota = () => {

    const dispatch = useDispatch();
    const history = useHistory();
    const { id } = useParams();

    const initialform = {
        title: '',
        position: '',
        unit_price: '',
        categoria: ''
    };

    const cuotas = useSelector(state => state.cuotas);
    const categoriasCuotas = useSelector(state => state.categorias.categorias?.cuotas);

    const [categoriasDropDown, setCategoriasDropdown] = useState([]);
    const [form, handleInputChange, reset] = useForm(id ? cuotas.cuota : initialform);

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (form.title === '' || form.position === '' || form.unit_price === '') {
            Swal.fire({
                title: 'Error!',
                text: 'Todos los campos son obligatorios',
                icon: 'error',
                confirmButtonText: 'Ok'
            })
            return false
        }
        if (id) {
            await dispatch(uploadCuota(form, cuotas.cuota.id))
        } else {
            await dispatch(nuevaCuota(form))
        }
        history.push('/admin/cuotas')
    }

    useEffect(() => {
        if (id && cuotas.cuota) {
            Object.entries(cuotas.cuota).map(([key, value]) => {
                if (key && value) {
                    handleInputChange({ target: { name: key, value: value } })
                }
                console.log(key, value)
            })
        }
    }, [cuotas.cuota])

    useEffect(()=>{
        if(categoriasCuotas){

            Object.entries(categoriasCuotas).map(([key, value]) => setCategoriasDropdown(categoria => [...categoria, {label: value, value: key}]))
        }
    }, [categoriasCuotas])

    return (
        <div className={styles.visibleContent}>
            <div className={styles.container}>
                <form onSubmit={handleSubmit} className={styles.formAdmin}>
                    <h2 className={styles.title}>{id ? 'Editar cuota' : 'Nueva cuota'}</h2>

                    <span className={`p-float-label ${styles.inputSection}`}>
                        <InputText className={styles.inputForm} value={form.title} name="title" id="title" type="text" onChange={(e) => { handleInputChange(e) }} />
                        <label className={styles.labelForm} htmlFor="title">Titulo*</label>
                    </span>

                    <span className={`p-float-label ${styles.inputSection}`}>
                        <Dropdown className={styles.inputForm} inputId="dropdown" value={form.categoria} name='categoria' id='categoria' onChange={(e) => { handleInputChange(e) }} options={categoriasDropDown} />
                        <label className={styles.labelForm} htmlFor="categoria">Categoría*</label>
                    </span>

                    <span className={`p-float-label ${styles.inputSection}`}>
                        <InputText className={styles.inputForm} name="position" id="position" type="number" onChange={(e) => { handleInputChange(e) }} value={form.position} />
                        <label className={styles.labelForm} htmlFor="position">Posición*</label>
                    </span>

                    <span className={`p-float-label ${styles.inputSection}`}>
                        <InputText className={styles.inputForm} name="unit_price" id="unit_price" type="number" onChange={(e) => { handleInputChange(e) }} value={form.unit_price} />
                        <label className={styles.labelForm} htmlFor="unit_price">Precio*</label>
                    </span>

                    <Button type="submit" label={id ? 'Editar' : 'Agregar'} className={`p-button-raised p-button-warning ${styles.submitButton}`} />
                </form>
                {
                    cuotas.processing
                    &&
                    <Spinner />
                }
            </div>
        </div>
    )
}

export default NuevaCuota;