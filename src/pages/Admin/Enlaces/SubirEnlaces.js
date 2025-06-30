import React, { useState } from 'react'
import { useDispatch, useSelector } from 'react-redux';
import { FileUpload } from 'primereact/fileupload';
import { ProgressSpinner } from 'primereact/progressspinner';
import * as XLSX from 'xlsx';
import '../../../assets/styles/excel/excel-2007.css'

import { uploadEnlaces } from '../../../redux/reducers/enlaces/actions';

const SubirEnlaces = () => {

    const dispatch = useDispatch();
    const enlace = useSelector(state => state.enlace)
    const [excelTable, setExcelTable] = useState({});

    const handleSelectExcel = (e) => {
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
        dispatch(uploadEnlaces(excelTable.rows))
    }

    return (
        <>
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
            {excelTable.rows && (
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
            )}
        </>
    )
}

export default SubirEnlaces