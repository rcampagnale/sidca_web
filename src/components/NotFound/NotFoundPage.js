import React from 'react';
import styles from './styles.module.css';
import { Button } from 'primereact/button';

export const NotFoundPage = ({ history }) => {
    return (
        <div className={styles.errorContainer}>
            <div className={styles.errorBox}>
                <img className={styles.errorImg} src='https://cdn.discordapp.com/attachments/857665384684322836/899831506694971402/pngkit_404-png_9306658.png' alt='404 Error' />
                <Button label="Volver" className="p-button-info" onClick={() => (history.goBack())}/>
            </div>
        </div>
    )
}
