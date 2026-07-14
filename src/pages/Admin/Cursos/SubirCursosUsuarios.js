import React, { useEffect, useState } from 'react'
import { useDispatch, useSelector } from 'react-redux';
import { FileUpload } from 'primereact/fileupload';
import { ProgressSpinner } from 'primereact/progressspinner';
import { ExcelRenderer, OutTable } from 'react-excel-renderer';
import '../../../assets/styles/excel/excel-2007.css'
import styles from './styles.module.css';
import { clearStatus, uploadUserCursosInfo } from '../../../redux/reducers/cursos/actions';

const SubirCursosUsuarios = ({ curso, noSubidos }) => {

    const dispatch = useDispatch();
    const enlace = useSelector(state => state.enlace)
    const [excelTable, setExcelTable] = useState({});
    const [noSubidosFinal, setNoSubidosFinal] = useState(noSubidos);

    const handleSelectExcel = (e) => {
        dispatch(clearStatus());
        let fileObj = e.files[0];

        //just pass the fileObj as parameter
        ExcelRenderer(fileObj, (err, resp) => {
            if (err) {
                console.log(err);
            }
            else {
                setExcelTable({ cols: resp.cols, rows: resp.rows })
                console.log(resp)
            }
        });
    }

    const handleUploadData = (e) => {
        //TODO diferenciar aprobados de no aprobados
        dispatch(uploadUserCursosInfo(curso, excelTable.rows))
    }

    useEffect(()=>{
        setNoSubidosFinal(noSubidos)
    }, [noSubidos])

    return (
        <section className={styles.uploadUsersPanel}>
            <div className={styles.uploadUsersHeader}>
                <span className={styles.uploadUsersEyebrow}>Carga de usuarios</span>
                <h3 className={styles.uploadUsersTitle}>Subir usuarios</h3>
                <p className={styles.uploadUsersCourse}>{curso.titulo}</p>
            </div>

            <FileUpload
                maxFileSize={1000000}
                mode='advanced'
                label="Subir"
                chooseLabel="Excel"
                uploadLabel='Subir'
                cancelLabel='Cancelar'
                className={styles.uploadUsersFile}
                multiple={false}
                customUpload
                onSelect={handleSelectExcel}
                uploadHandler={handleUploadData}
                onClear={() => setExcelTable({})}
            />
            {
                enlace.uploading && <div>
                    <ProgressSpinner />
                    <p>{enlace.msg}</p>
                </div>
            }
            {
                //TODO ver como hacer para que se muestren los noSubidos
                noSubidosFinal?.length > 0 ?
                <table className={styles.notUploadedTable}>
                    <thead>
                        <tr>
                            <th>DNI no subidos</th>
                        </tr>
                    </thead>
                    <tbody>
                        {noSubidosFinal?.map(nosubido => (
                            <tr key={nosubido}>
                                <td>{nosubido}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
                : excelTable.rows && (
                    <div className={styles.excelPreviewWrap}>
                        <OutTable data={excelTable.rows} columns={excelTable.cols} tableClassName="ExcelTable2007" tableHeaderRowClass="heading" />
                    </div>
                )
            }
        </section>
    )
}

export default SubirCursosUsuarios
