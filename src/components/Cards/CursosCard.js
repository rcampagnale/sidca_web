import React from 'react';
import { Card } from 'primereact/card';
import { Button } from 'primereact/button';
import { Skeleton } from 'primereact/skeleton';
import { useHistory } from 'react-router-dom'; // 👈 importamos history

const CursosCard = ({ curso, miCurso }) => {
    const history = useHistory();

    const header = curso.imagen.includes('https://') ? (
        <img alt="Card" src={curso.imagen} />
    ) : (
        <Skeleton width="15rem" height="20rem"></Skeleton>
    );

    const footer = miCurso
        ? curso.aprobo
            ? <span>Aprobaste este curso</span>
            : curso.estado !== 'terminado'
                ? <span>Curso aún dictándose</span>
                : <span>Desaprobaste el Curso</span>
        : curso.estado !== 'terminado'
            ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', alignItems: 'center' }}>
                    <Button
                        label="Inscribirse"
                        icon="pi pi-check"
                        className="p-button-success"
                        onClick={() => window.location = curso.link}
                    />
                    {/* 👇 Botón regresar debajo de inscribirse */}
                    <Button
                        label="Regresar a Capacitaciones"
                        icon="pi pi-arrow-left"
                        className="p-button-secondary"
                        onClick={() => history.push('/capacitaciones')}
                    />
                </div>
            )
            : <span>Curso Finalizado</span>;

    return (
        <Card title={curso.titulo} footer={footer} header={header}>
            <p className="m-0" style={{ lineHeight: '1.5', textAlign: 'justify' }}>
                {curso.descripcion}
            </p>
        </Card>
    );
};

export default CursosCard;
