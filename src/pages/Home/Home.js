import React, { useState, useEffect } from 'react';
import { Carousel } from 'primereact/carousel';
import { Chip } from 'primereact/chip';
import styles from './styles.module.css';
import logo from '../../assets/img/logo-01.png';
import { useDispatch, useSelector } from 'react-redux';
import { postTransaction, setUserCuotas } from '../../redux/reducers/cuotas/actions';
import { getNovedades } from '../../redux/reducers/novedades/actions';

import { useLocation } from 'react-router-dom';
import Swal from 'sweetalert2';
import './CarouselDemo.css';

const Home = () => {

    const dispatch = useDispatch();
    const cuotas = useSelector(state => state.cuotas)
    const location = useLocation();

    const novedades = useSelector(state => state.novedades);

    useEffect(() => {
        dispatch(getNovedades())
    }, [])

    const [products, setProducts] = useState([]);

    novedades.novedades.forEach(e => {
        products.push(e);
    })

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
            breakpoint: '800px',
            numVisible: 1,
            numScroll: 1
        }
    ];

    console.log(products)

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
    } // onError={(e) => e.target.src = 'https://upload.wikimedia.org/wikipedia/commons/0/0a/No-image-available.png'}

    return (
        <div className={styles.visibleContent}>
            <div className={styles.container}>
                <div className={styles.imgContainer}>
                    <img className={styles.img} src={logo} alt="Logo de SiDCa"></img>
                </div>
            </div>

            <div className="carousel-demo">
                <div className="card">
                    <Carousel value={products} responsiveOptions={responsiveOptions}
                        itemTemplate={productTemplate} header={<h1 className={styles.h1}>Novedades</h1>} />
                </div>
            </div>
        </div>
    )
}

export default Home;