import React, { useState } from 'react'
import { useDispatch, useSelector } from 'react-redux';
import { FileUpload } from 'primereact/fileupload';
import { ProgressSpinner } from 'primereact/progressspinner';
import {ExcelRenderer, OutTable} from 'react-excel-renderer';
import '../../../assets/styles/excel/excel-2007.css'
import styles from './styles.module.css';

import { uploadEnlaces } from '../../../redux/reducers/enlaces/actions';

const SubirCursosUsuarios = ({curso}) => {

    const dispatch = useDispatch();
    const enlace = useSelector(state => state.enlace)
    const [excelTable, setExcelTable] = useState({});

    const handleSelectExcel = (e) => {
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
        dispatch(uploadEnlaces(excelTable.rows))
    }

    console.log(curso)

    return (
        <>
            <h3 className={styles.title}>Subir Usuarios de: {curso.titulo}</h3>
            <FileUpload
                maxFileSize={1000000}
                mode='advanced'
                label="Subir"
                chooseLabel="Excel"
                uploadLabel='Subir'
                cancelLabel='Cacelar'
                className="mr-2 inline-block"
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
            {excelTable.rows && <OutTable data={excelTable.rows} columns={excelTable.cols} tableClassName="ExcelTable2007" tableHeaderRowClass="heading" />}
        </>
    )
}

export default SubirCursosUsuarios