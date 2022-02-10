import React from 'react';
import { Skeleton } from 'primereact/skeleton';
import styles from './styles.module.css';

const Nuevos2021 = () => {
    return(
        <div className={styles.boxContainer}>
            <div className={styles.container}>
                <div className={styles.containerExample1}>
                    <Skeleton height="2rem" className="p-mb-2"></Skeleton>
                    <Skeleton width="15rem" height="20rem"></Skeleton>
                    <Skeleton className="p-mb-2"></Skeleton>
                    <Skeleton height="2rem" width="10rem" className="p-mb-2"></Skeleton>
                </div>
                <div className={styles.containerExample2}>
                    <Skeleton height="2rem" className="p-mb-2"></Skeleton>
                    <Skeleton width="15rem" height="20rem"></Skeleton>
                    <Skeleton className="p-mb-2"></Skeleton>
                    <Skeleton height="2rem" width="10rem" className="p-mb-2"></Skeleton>
                </div>
            </div>     
        </div>
    )
}

export default Nuevos2021;