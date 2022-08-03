import { Skeleton } from 'primereact/skeleton';
import styles from './cuotas.module.scss';

const SkeletonLoading = () => {
    return (
        <>
            <div className={styles.categories__cards_container}>
                <Skeleton shape="rectangle" height="40px" width="11rem" className={styles.title} />
            </div>
            <div className={styles.categories__cards_container}>
                <Skeleton shape="rectangle" height="190px" width="16.5em" className={styles.card} />
            </div>
        </>
    )
}

export default SkeletonLoading;
