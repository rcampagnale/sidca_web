import React from 'react';
import './styles.css'
import { Skeleton } from 'primereact/skeleton';

const CursosSkeleton = () => {
    return (
        <>
            {
                [1, 2, 3].map(item => <div className='containerExample1'>
                    <Skeleton width="15rem" height="20rem"></Skeleton>
                    <Skeleton className="p-mb-2"></Skeleton>
                    <Skeleton height="2rem" width="10rem" className="p-mb-2"></Skeleton>
                </div>)
            }

        </>

    )
}

export default CursosSkeleton