import React from 'react'
import styles from './styles.module.css';

export const Spinner = () => {
    return (
        <div className={styles.spinnerContainer}>
            <div className={styles.sk_chase}>
                <div className={styles.sk_chase_dot}></div>
                <div className={styles.sk_chase_dot}></div>
                <div className={styles.sk_chase_dot}></div>
                <div className={styles.sk_chase_dot}></div>
                <div className={styles.sk_chase_dot}></div>
                <div className={styles.sk_chase_dot}></div>
            </div>
        </div>
    )
}


