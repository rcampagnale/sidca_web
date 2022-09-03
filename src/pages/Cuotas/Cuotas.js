import React, { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Card } from 'primereact/card';
import { Button } from 'primereact/button';
import SkeletonLoading from './SkeletonLoading';
import { ProgressSpinner } from 'primereact/progressspinner';
import { Message } from 'primereact/message';
import styles from './cuotas.module.scss';
import { getAllCuotas } from '../../redux/reducers/cuotas/actions';

const Cuotas = () => {

    const dispatch = useDispatch();

    const cuotas = useSelector(state => state.cuotas);
    const cuotasCategories = useSelector(state => state.categorias.categorias?.cuotas);
    const userProfile = useSelector(state => state.user.profile);
    const [loader, setLoader] = useState(false);
    const [payItem, setPayItem] = useState(undefined);
    const [payData, setPayData] = useState(undefined);
    const [categorias, setCategorias] = useState(undefined);

    const hanldePostItem = async (item) => {
        setLoader(true);
        await fetch(
            `${process.env.REACT_APP_URL_PAYMENT_MP}/preference-item`,
            {
                method: "POST",
                headers: {
                    "Access-Control-Allow-Origin": "*",
                    "Access-Control-Request-Method":
                        "GET, POST, DELETE, PUT, OPTIONS",
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    ...item,
                    userId: userProfile.id
                }),
            }
        )
            .then((res) => res.json())
            .then((data) => { setPayData(data); setLoader(false); setPayItem(item) })
            .catch((err) => {
                setPayItem(item);
                setLoader(false)
            });
    }

    useEffect(() => {
        dispatch(getAllCuotas());
    }, [])

    useEffect(() => {
        setCategorias(cuotasCategories);

    }, [cuotasCategories])

    let counter = 0;

    return (
        <div className={styles.container}>
            {
                !loader && payItem &&
                <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', paddingTop: 10 }}>
                    <Message severity='warn' text='Para que registremos tu pago de forma inmediata deberás hacer click en "Volver al Sitio" una vez finalizado la transacción.' style={{ marginBottom: 10 }}></Message>
                    <img src='https://firebasestorage.googleapis.com/v0/b/sidca-a33f0.appspot.com/o/img%2Fvolver-al-sitio.png?alt=media&token=864ca477-f47e-481a-84c1-920cc2fb8e2e'
                        style={{ marginBottom: 10, maxWidth: 500, maxHeight: 400 }}
                    />
                    <Button onClick={() => { window.location.href = payData.data }} label={`Pagar ${payItem.title}`} icon="pi pi-credit-card" style={{ marginRight: '.25em' }} />
                    {/* <PagarCuota item={payItem} payData={payData} /> */}
                    <Message severity='info' text='Recuerda guardar tu comprobante' style={{ marginTop: 10 }}></Message>
                </div>
            }
            {
                cuotas.loading ?
                    <div className={styles.categories}>
                        <SkeletonLoading />
                        <SkeletonLoading />
                        <SkeletonLoading />
                    </div>
                    :
                    !loader && categorias && Object.entries(categorias).map(([key, value]) => (
                        <div className={styles.categories}>
                            <h1 className={styles.categories__title}>{value}</h1>
                            <div className={styles.categories__cards_container}>
                                {
                                    (cuotas.cuotas.length > 0) ?
                                        cuotas.cuotas.filter(item => item.categoria == key).map(item => (
                                            <Card title={item.title} key={item.title} className={styles.categories__cards_container__card}>
                                                <Button onClick={() => hanldePostItem(item)} label="Seleccionar" icon="pi pi-check" style={{ marginRight: '.25em' }} />
                                            </Card>

                                        ))
                                        :
                                        <Card title={cuotas.msg} className={styles.card}></Card>
                                }
                            </div>
                        </div>
                    ))
            }
            {
                loader &&
                <ProgressSpinner className='loader' />
            }
        </div >
    )
}

export default Cuotas