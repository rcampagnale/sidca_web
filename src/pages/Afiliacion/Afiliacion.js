import React from 'react'
import { useDispatch, useSelector } from 'react-redux';
import { useHistory } from 'react-router-dom';
import styles from './styles.module.css';
import Swal from 'sweetalert2'
import { Spinner } from '../../components/Spinner/Spinner';
import { InputText } from 'primereact/inputtext';
import { Button } from 'primereact/button';
import { Checkbox } from 'primereact/checkbox';
import { Dropdown } from 'primereact/dropdown';
import { Card } from 'primereact/card';
import { departamentos } from '../../constants/departamentos';
import { useFormik } from 'formik';
import { classNames } from 'primereact/utils';
import { afiliacion } from '../../redux/reducers/afiliados/actions';

const Afiliacion = () => {

    const dispatch = useDispatch();
    const history = useHistory();
    const afiliado = useSelector(state => state.afiliado)

    const formik = useFormik({
        initialValues: {
            nombre: '',
            apellido: '',
            dni: '',
            email: '',
            celular: '',
            departamento: '',
            establecimientos: '',
            descuento: false
        },
        validate: (data) => {
            let errors = {};

            if (!data.nombre) {
                errors.nombre = 'El nombre es requerido.';
            }

            if (!data.apellido) {
                errors.apellido = 'El apellido es requerido.';
            }

            if (!data.dni) {
                errors.dni = 'El dni es requerido.';
            }

            if (!data.celular) {
                errors.celular = 'El celular es requerido.';
            }

            if (!data.departamento) {
                errors.departamento = 'El departamento es requerido.';
            }

            if (!data.email) {
                errors.email = 'El Email es requerido.';
            } else if (!/^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,4}$/i.test(data.email)) {
                errors.email = 'Direccion de Email invalida. Ej: su@email.com';
            }

            if (!data.descuento) {
                errors.descuento = 'Tienes que autorizar el descuento de haberes';
            }

            return errors;
        },
        onSubmit: (data) => {
            dispatch(afiliacion(data))
        }
    });

    const isFormFieldValid = (name) => !!(formik.touched[name] && formik.errors[name]);
    const getFormErrorMessage = (name) => {
        return isFormFieldValid(name) && <small className="p-error">{formik.errors[name]}</small>;
    };

    return (
        <div className={styles.visibleContent}>
            <Card title="Afiliate a SiDCa" style={{ width: '25rem', marginBottom: '2em' }}>
                <form onSubmit={formik.handleSubmit} className="p-fluid p-mt-10">
                    <div className={styles.inputSection}>
                        <span className='p-float-label' >
                            <InputText className={classNames({ 'p-invalid': isFormFieldValid('nombre') })} value={formik.values.nombre} name="nombre" id="nombre" type="text" onChange={formik.handleChange} />
                            <label className={classNames({ 'p-error': isFormFieldValid('nombre') })} htmlFor="nombre">Nombre*</label>
                        </span>
                        {getFormErrorMessage('nombre')}
                    </div>
                    <div className={styles.inputSection}>
                        <span className='p-float-label'>
                            <InputText className={classNames({ 'p-invalid': isFormFieldValid('apellido') })} value={formik.values.apellido} name="apellido" id="apellido" type="text" onChange={formik.handleChange} />
                            <label className={classNames({ 'p-error': isFormFieldValid('apellido') })} htmlFor="apellido">Apellido*</label>
                        </span>
                        {getFormErrorMessage('apellido')}
                    </div>
                    <div className={styles.inputSection}>
                        <span className='p-float-label' >
                            <InputText className={classNames({ 'p-invalid': isFormFieldValid('dni') })} value={formik.values.dni} name="dni" id="dni" type="text" onChange={formik.handleChange} maxLength={8} />
                            <label className={classNames({ 'p-error': isFormFieldValid('dni') })} htmlFor="dni">DNI*</label>
                        </span>
                        {getFormErrorMessage('dni')}
                    </div>
                    <div className={styles.inputSection}>
                        <span className='p-float-label'>
                            <InputText className={classNames({ 'p-invalid': isFormFieldValid('email') })} value={formik.values.email} name="email" id="email" type="text" onChange={formik.handleChange} />
                            <label className={classNames({ 'p-error': isFormFieldValid('email') })} htmlFor="email">Email*</label>
                        </span>
                        {getFormErrorMessage('email')}
                    </div>
                    <div className={styles.inputSection}>
                        <span className='p-float-label'>
                            <InputText className={classNames({ 'p-invalid': isFormFieldValid('celular') })} value={formik.values.celular} name="celular" id="celular" type="text" onChange={formik.handleChange} />
                            <label className={classNames({ 'p-error': isFormFieldValid('celular') })} htmlFor="celular">Celular*</label>
                        </span>
                        {getFormErrorMessage('celular')}
                    </div>
                    <div className={styles.inputSection}>
                        <span className='p-float-label'>
                            <Dropdown className={classNames({ 'p-invalid': isFormFieldValid('departamento') })} inputId="dropdown" value={formik.values.departamento} name='departamento' id='departamento' onChange={formik.handleChange} options={departamentos} />
                            <label className={classNames({ 'p-error': isFormFieldValid('departamento') })} htmlFor="departamento">Departamento*</label>
                        </span>
                        {getFormErrorMessage('departamento')}
                    </div>
                    <div className={styles.inputSection}>
                        <span className='p-float-label'>
                            <InputText className={classNames({ 'p-invalid': isFormFieldValid('establecimientos') })} value={formik.values.establecimientos} name="establecimientos" id="establecimientos" type="text" onChange={formik.handleChange} />
                            <label className={classNames({ 'p-error': isFormFieldValid('establecimientos') })} htmlFor="establecimientos">Establecimientos</label>
                        </span>
                    </div>
                    <div className={styles.inputSection}>
                        <div className={`field-checkbox ${styles.inputSection}`}>
                            <Checkbox name="descuento" inputId="descuento" checked={formik.values.descuento} onChange={formik.handleChange} className={classNames({ 'p-invalid': isFormFieldValid('descuento') })} />
                            <label htmlFor="descuento" style={{ marginLeft: 10 }} className={classNames({ 'p-error': isFormFieldValid('descuento') })}>Autorizo realizar descuentos de mis haberes en concepto de cuotas y/o servicios sociales</label>
                        </div>
                    </div>

                    <Button type="submit" label="AFILIARME" className="mt-2" />
                </form>
            </Card>
            {
                afiliado.processing
                &&
                <Spinner />
            }
        </div>
    )
}

export default Afiliacion