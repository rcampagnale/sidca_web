import React, { useEffect } from 'react'
import { useHistory } from 'react-router'
import styles from './styles.module.css';
import { Button } from 'primereact/button';
import { InputText } from 'primereact/inputtext';
import { useDispatch, useSelector } from 'react-redux';
import { useForm } from '../../../hooks/useForm';
import { getUser, setUserEdit, clearStatus, deleteUser } from '../../../redux/reducers/afiliados/actions';
import { Spinner } from '../../../components/Spinner/Spinner';
import Swal from 'sweetalert2';
import { confirmDialog } from 'primereact/confirmdialog';

const Usuarios = () => {

    const afiliado = useSelector(state => state.afiliado)
    const history = useHistory();
    const dispatch = useDispatch();
    const user = useSelector(state => state.user.profile);

    const initialform = {
        dni: '',
    };

    const [form, handleInputChange, reset] = useForm(initialform);

    const handleSubmit = async (e) => {
        e.preventDefault();
        await dispatch(getUser(form));
        reset()
    }

    const handleEdit = async (id) => {
        dispatch(setUserEdit(id));
        history.push(`/admin/nuevo-usuario/${id}`)
    }

    const accept = (id) => {
        dispatch(deleteUser(id))
    }

    const confirm = (id) => {
        confirmDialog({
            message: 'Esta seguro que desea Eliminar?',
            header: 'Atención',
            icon: 'pi pi-exclamation-triangle',
            accept: () => accept(id),
            reject: () => { }
        });
    };

    useEffect(() => {
        if (afiliado.status == 'SUCCESS' ||  afiliado.status == 'SUCCESS_DELETE') {
            Swal.fire({
                title: 'Solicitud Exitosa',
                text: afiliado.msg,
                icon: 'success',
                confirmButtonText: 'Continuar'
            })
            reset()
            dispatch(clearStatus())
        } if (afiliado.status == 'FAILURE' || afiliado.status == 'FAILURE_DELETE') {
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
        <div className={styles.visibleContent}>
            <div className={styles.container}>
                <div className={styles.btn}>
                    <Button label="Nuevo usuario" icon="pi pi-plus" className="p-button-raised p-button-warning" onClick={() => history.push("/admin/nuevo-usuario")} />
                </div>
            </div>
            <div className={styles.searchContainer}>
                <form onSubmit={handleSubmit} className={styles.formAdmin}>
                    <h2 className={styles.title}>Buscar Usuario</h2>
                    <span className={`p-float-label ${styles.inputSection}`}>
                        <InputText className={styles.inputForm} value={form.dni} name="dni" id="dni" type="text" onChange={(e) => { handleInputChange(e) }} />
                        <label className={styles.labelForm} htmlFor="dni">DNI</label>
                    </span>
                    <Button type="submit" label='Ingresar' className={`p-button-raised p-button-warning ${styles.submitButton}`} />
                </form>
            </div>
            <div className={styles.cardsContainer}>
                {
                    afiliado.processing ?
                        <Spinner />
                        :
                        afiliado.user.map(item => (
                            <div className={styles.searchContainer} key={item.id}>

                                <h2 className={styles.title}>{item.apellido + ', ' + item.nombre}</h2>
                                <h2 className={styles.title}>{item.dni}</h2>
                                <div className={styles.actions}>
                                    <Button label='Editar' className={`p-button-raised`} onClick={() => handleEdit(item.id)} />
                                    {
                                        user?.uid === process.env.REACT_APP_ADMIN_ID &&
                                        <Button label="Eliminar" icon="pi pi-trash" className="p-button-raised p-button-danger" onClick={() => confirm(item.id)} />
                                    }
                                </div>
                            </div>
                        ))
                }
            </div>
        </div>
    )
}

export default Usuarios;