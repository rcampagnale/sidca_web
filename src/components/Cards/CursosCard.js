import React from 'react';
import { Card } from 'primereact/card';
import { Button } from 'primereact/button';
import { Skeleton } from 'primereact/skeleton';

const CursosCard = ({ curso, miCurso }) => {
    // onError={(e) => e.target.src='https://www.primefaces.org/wp-content/uploads/2020/05/placeholder.png'}
    const header = curso.imagen.includes('https://') ? (
        <img alt="Card" src={curso.imagen} />

    ) : <Skeleton width="15rem" height="20rem"></Skeleton>;
    const footer = miCurso ? curso.aprobo ?
        (<span>
            Aprobaste este curso
        </span>
        ) : curso.estado !== 'terminado' ? (<span>
            Curso aún dictandose
        </span>) :
            (<span>
                Desaprobaste el Curso
            </span>)
        :
        curso.estado !== 'terminado' ? (<span>
            <Button label="Inscribirse" icon="pi pi-check" onClick={() => window.location = curso.link} />
        </span>)
            :
            (<span>
                Curso Finalizado
            </span>)

    return (
        <Card title={curso.titulo} style={{ width: '25em' }} footer={footer} header={header}>
            <p className="m-0" style={{ lineHeight: '1.5' }}>{curso.descripcion}</p>
        </Card>
    )
}

export default CursosCard