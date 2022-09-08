import React, {useRef, useEffect} from 'react'
import { useDispatch, useSelector } from 'react-redux';
import { useHistory } from 'react-router-dom';
import { InputText } from 'primereact/inputtext';
import { Button } from 'primereact/button';
import { Checkbox } from 'primereact/checkbox';
import { Dropdown } from 'primereact/dropdown';
import { Card } from 'primereact/card';
import { Toast } from 'primereact/toast';
import { classNames } from 'primereact/utils';
import { useFormik } from 'formik';
import { Spinner } from '../../components/Spinner/Spinner';
import { afiliacion, clearStatus } from '../../redux/reducers/afiliados/actions';
import { departamentos } from '../../constants/departamentos';
import styles from './styles.module.scss';
import { useMemo } from 'react';

const Afiliacion = () => {

    const dispatch = useDispatch();
    const history = useHistory();
    const afiliado = useSelector(state => state.afiliado)
    const toast = useRef(null);
    
    const dptos = useMemo(()=> Object.entries(departamentos).map(([key, value]) => ({label: value, value: key})), [departamentos])
    
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

    useEffect(() => {
        if (afiliado.status == 'SUCCESS_AF') {
            toast.current.show({ severity: 'success', summary: 'Operación Exitosa', detail: afiliado.msg, life: 5000 });
            dispatch(clearStatus())
            setTimeout(()=>history.push('/'), 5000)
        } if (afiliado.status == 'FAILURE_AF') {
            toast.current.show({ severity: 'error', summary: 'Hubo un error', detail: afiliado.msg, life: 5000 });
            dispatch(clearStatus())
        }
    }, [afiliado.status])

    return (
        <div className={styles.visibleContent}>
            <Toast ref={toast} />
            <Card title="Afiliate a SiDCa" style={styles.container}>
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
                            <Dropdown className={classNames({ 'p-invalid': isFormFieldValid('departamento') })} inputId="dropdown" value={formik.values.departamento} name='departamento' id='departamento' onChange={formik.handleChange} options={dptos} />
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