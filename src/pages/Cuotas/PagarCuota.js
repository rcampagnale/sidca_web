import React, { useEffect, useState } from "react";
import useScript from "./useScript";

const PagarCuota = ({ item, payData }) => {

    const { MercadoPago } = useScript(
        "https://sdk.mercadopago.com/js/v2",
        "MercadoPago"
    );

    useEffect(() => {
        if (MercadoPago && payData) {
            const mp = new MercadoPago(process.env.REACT_APP_PUBLIC_KEY_MP, { locale: "es-AR" });

            mp.checkout({
                preference: {
                    id: payData.id
                },
                render: {
                    container: ".cho-container", // Indica el nombre de la clase donde se mostrará el botón de pago
                    label: `Pagar ${item.title}`, // Cambia el texto del botón de pago (opcional)
                },
                theme: {
                    elementsColor: "#fea200"
                }
            });
        }
    }, [MercadoPago]);

    return (<>
        {
            payData ?
                <div className="cho-container"></div>
                :
                <div>No se pudo cargar la Informacion de Pago, contacta a un administrador</div>
        }
    </>
    )
}

export default PagarCuota