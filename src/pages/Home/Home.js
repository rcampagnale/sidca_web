import React, { useState, useEffect } from 'react';
import styles from './home.module.scss';
import logo from '../../assets/img/somos3.jpg';
import { useDispatch, useSelector } from 'react-redux';
import { setUserCuotas } from '../../redux/reducers/cuotas/actions';
import { getNovedades } from '../../redux/reducers/novedades/actions';
import { useLocation } from 'react-router-dom';
import Swal from 'sweetalert2';
import  "./CarouselDemo.scss";
import { Carousel } from 'primereact/carousel';
import { Chip } from 'primereact/chip';

const Home = () => {

    const dispatch = useDispatch();
    const cuotas = useSelector(state => state.cuotas)
    const location = useLocation();

    const novedades = useSelector(state => state.novedades);

    useEffect(() => {
        dispatch(getNovedades())
    }, [])

    useEffect(() => {
        if (location.search) {
            const search = {}
            location.search.slice(1).split('&').map(param => { const data = param.split('='); search[data[0]] = data[1] })
            dispatch(setUserCuotas(search))
        }
    }, [location]);

    useEffect(() => {
        if (cuotas.setTransaccion === 'SUCCESS_SET') {
            Swal.fire({
                title: 'Transferencia recibida',
                text: 'Se han cargado los datos de su pago.',
                icon: 'success',
                confirmButtonText: 'Ok'
            })
        } else if (cuotas.setTransaccion === 'FAILURE_SET') {
            Swal.fire({
                title: 'No se ha guardado la transferencia',
                text: 'Si no intentaste hacer un pago de cuota ignora este mensaje.',
                icon: 'error',
                confirmButtonText: 'Ok'
            })
        }
    }, [cuotas.setTransaccion]);

    const responsiveOptions = [
        {
            breakpoint: '2000px',
            numVisible: 3,
            numScroll: 3
        },
        {
            breakpoint: '1400px',
            numVisible: 2,
            numScroll: 2
        },
        {
            breakpoint: '500px',
            numVisible: 1,
            numScroll: 1
        }
    ];

    function productTemplate(product) {
        return (
            <div className="product-item">
                <div className="product-item-content">
                    <div>
                        <h4 className="mb-1">{product.titulo}</h4>
                        <Chip className={styles.chip} label={product.categoria[0].toUpperCase() + product.categoria.slice(1)} />
                    </div>
                    <div className="mb-3">
                        <img src={product.imagen} alt={product.titulo} className="product-image" />
                    </div>
                    <div className="mb-3" style={{ 'margin': '20px' }}>
                        <p>{product.descripcion}</p>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className={styles.componentContainer}>
            <div className={styles.container}>
                <div className={styles.container__imgContainer}>
                    <img className={styles.container__imgContainer__img} src={logo} alt="Logo de SiDCa"></img>
                </div>
            </div>
            {
                novedades?.novedades?.length > 0 &&
                <div className="carousel-demo">
                    <div className="card">
                        <Carousel
                            value={novedades?.novedades}
                            responsiveOptions={responsiveOptions}
                            itemTemplate={productTemplate}
                            header={<h1 className={styles.h1}>Novedades</h1>}
                        />
                    </div>
                </div>
            }
        </div>
    )
}

export default Home;
