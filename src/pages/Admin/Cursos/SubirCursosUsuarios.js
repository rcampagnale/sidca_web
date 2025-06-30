import React, { useEffect, useState } from 'react'
import { useDispatch, useSelector } from 'react-redux';
import { FileUpload } from 'primereact/fileupload';
import { ProgressSpinner } from 'primereact/progressspinner';
import * as XLSX from 'xlsx';
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
        const reader = new FileReader();
        reader.onload = (evt) => {
            const bstr = evt.target.result;
            const wb = XLSX.read(bstr, { type: 'binary' });
            const wsname = wb.SheetNames[0];
            const rows = XLSX.utils.sheet_to_json(wb.Sheets[wsname], { header: 1 });
            const cols = rows.shift().map(name => ({ name, key: name }));
            setExcelTable({ cols, rows });
        };
        reader.readAsBinaryString(fileObj);
    }

    const handleUploadData = (e) => {
        //TODO diferenciar aprobados de no aprobados
        dispatch(uploadUserCursosInfo(curso, excelTable.rows))
    }

    useEffect(()=>{
        setNoSubidosFinal(noSubidos)
    }, [noSubidos])

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
            {
                //TODO ver como hacer para que se muestren los noSubidos
                noSubidosFinal?.length > 0 ?
                <table>
                    <th><tr>DNI no subidos</tr></th>
                    <tbody>
                        <td>
                            {
                                noSubidosFinal?.map(nosubido => (
                                    <tr>
                                        {nosubido}
                                    </tr>
                                ))}
                        </td>
                    </tbody>
                </table>
                : excelTable.rows && (
                    <table className="ExcelTable2007">
                        <thead className="heading">
                            <tr>
                                {excelTable.cols.map((c, i) => <th key={i}>{c.name}</th>)}
                            </tr>
                        </thead>
                        <tbody>
                            {excelTable.rows.map((row, idx) => (
                                <tr key={idx}>
                                    {row.map((cell, cidx) => <td key={cidx}>{cell}</td>)}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )
            }
        </>
    )
}

export default SubirCursosUsuarios