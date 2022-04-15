import React, { useEffect } from 'react';
import styles from './styles.module.css';
import logo from '../../assets/img/logo-01.png';
import { useDispatch, useSelector } from 'react-redux';
import { postTransaction, setUserCuotas } from '../../redux/reducers/cuotas/actions';
import { useLocation } from 'react-router-dom';
import Swal from 'sweetalert2';

const Home = () => {

    const dispatch = useDispatch();

    const location = useLocation();

    useEffect(() => {
        if (location.search) {
            const search = {}
            location.search.slice(1).split('&').map(param => { const data = param.split('='); search[data[0]] = data[1] })
            if (search.status == 'approved') {
                dispatch(postTransaction(search));
                dispatch(setUserCuotas(search.external_reference, search))
                Swal.fire({
                    title: 'Transferencia recibida',
                    text: 'Se han cargado los datos de su pago.',
                    icon: 'success',
                    confirmButtonText: 'Ok'
                })
            }else if(search.status){
                Swal.fire({
                    title: 'No se ha guardado la transferencia',
                    text: 'Si no intentaste hacer un pago de cuota ignora este mensaje.',
                    icon: 'error',
                    confirmButtonText: 'Ok'
                })
            }
        }
    }, [location]);

    return (
        <div className={styles.visibleContent}>
            <div className={styles.container}>
                <div className={styles.imgContainer}>
                    <img className={styles.img} src={logo} alt="Logo de SiDCa"></img>
                </div>
            </div>
        </div>
    )
}

export default Home;