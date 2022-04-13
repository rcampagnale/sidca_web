import React, { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Card } from 'primereact/card';
import { Button } from 'primereact/button';
import { Skeleton } from 'primereact/skeleton';
import { ProgressSpinner } from 'primereact/progressspinner';
import { Message } from 'primereact/message';
import styles from './Cuotas.module.css';
import PagarCuota from './PagarCuota';
import { getCuotas } from '../../redux/reducers/cuotas/actions';

const Cuotas = () => {

    const dispatch = useDispatch();

    const cuotas = useSelector(state => state.cuotas);
    const userProfile = useSelector(state => state.user.profile);
    const [loader, setLoader] = useState(false);
    const [payItem, setPayItem] = useState(undefined);
    const [payData, setPayData] = useState(undefined);

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
        dispatch(getCuotas());
    }, [])


    return (
        <>
            <div className={styles.cards_container}>
                {
                    cuotas.loading ?
                        <>
                            <Skeleton shape="rectangle" height="100px" width="300px" />
                            <Skeleton shape="rectangle" height="100px" width="300px" />
                            <Skeleton shape="rectangle" height="100px" width="300px" />
                            <Skeleton shape="rectangle" height="100px" width="300px" />
                        </>
                        :
                        !loader &&
                        <>
                            {
                                (cuotas.cuotas.length > 0) ? cuotas.cuotas.map(item => (
                                    <Card title={item.title} key={item.title} className={styles.card}>
                                        <Button onClick={() => hanldePostItem(item)} label="Seleccionar" icon="pi pi-check" style={{ marginRight: '.25em' }} />
                                    </Card>
                                ))
                                    :
                                    <Card title={cuotas.msg} className={styles.card}></Card>
                            }
                        </>
                }
            </div>
            {
                !loader && payItem &&
                <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center' }}>
                    <Message severity='warn' text='Para que registremos tu pago de forma inmediata deberás hacer click en "Volver al Sitio" una vez finalizado el pago' style={{ marginBottom: 10 }}></Message>
                    <img src='https://firebasestorage.googleapis.com/v0/b/sidca-a33f0.appspot.com/o/img%2Fvolver-al-sitio.png?alt=media&token=864ca477-f47e-481a-84c1-920cc2fb8e2e'
                        style={{ marginBottom: 10, maxWidth: 500, maxHeight: 400 }}
                    />
                    <PagarCuota item={payItem} payData={payData} />
                    <Message severity='info' text='Recuerda guardar tu comprobante' style={{ marginTop: 10 }}></Message>
                </div>
            }
            {
                loader &&
                <ProgressSpinner className='loader' />
            }
        </>
    )
}

export default Cuotas