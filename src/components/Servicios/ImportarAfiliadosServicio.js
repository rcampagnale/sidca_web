// src/components/Servicios/ImportarAfiliadosServicio.js

import React, { useRef, useState } from "react";
import * as XLSX from "xlsx";
import { Button } from "primereact/button";
import { DataTable } from "primereact/datatable";
import { Column } from "primereact/column";
import styles from "./ImportarAfiliadosServicio.module.css";

const MESES = [
  "enero",
  "febrero",
  "marzo",
  "abril",
  "mayo",
  "junio",
  "julio",
  "agosto",
  "septiembre",
  "octubre",
  "noviembre",
  "diciembre",
];

const normalizarDni = (valor) => {
  return String(valor || "").replace(/\D/g, "");
};

const limpiarTexto = (valor) => {
  return String(valor || "").trim().replace(/\s+/g, " ");
};

const pad2 = (valor) => String(valor).padStart(2, "0");

const sumarMesesPeriodo = (periodo, cantidadMeses) => {
  if (!periodo) return "";

  const [anio, mes] = periodo.split("-").map(Number);
  const fecha = new Date(anio, mes - 1 + cantidadMeses, 1);

  return `${fecha.getFullYear()}-${pad2(fecha.getMonth() + 1)}`;
};

const periodoTexto = (periodo) => {
  if (!periodo) return "-";

  const [anio, mes] = periodo.split("-").map(Number);
  if (!anio || !mes) return "-";

  return `${MESES[mes - 1]} ${anio}`;
};

const periodoCobroTexto = (periodo) => {
  return `A cobrar en ${periodoTexto(periodo)}`;
};

const obtenerValorFila = (fila, campos) => {
  for (const campo of campos) {
    if (fila[campo] !== undefined && fila[campo] !== null) {
      return fila[campo];
    }
  }

  return "";
};

const ImportarAfiliadosServicio = ({ servicio, loading = false, onImportar }) => {
  const inputFileRef = useRef(null);

  const [archivoNombre, setArchivoNombre] = useState("");
  const [periodoHaberExcel, setPeriodoHaberExcel] = useState("");
  const [filasExcel, setFilasExcel] = useState([]);
  const [filasInvalidas, setFilasInvalidas] = useState([]);

  const limpiarImportacion = () => {
    setArchivoNombre("");
    setPeriodoHaberExcel("");
    setFilasExcel([]);
    setFilasInvalidas([]);

    if (inputFileRef.current) {
      inputFileRef.current.value = "";
    }
  };

  const procesarArchivo = async (event) => {
    const archivo = event.target.files?.[0];

    if (!archivo) return;

    setArchivoNombre(archivo.name);
    setFilasExcel([]);
    setFilasInvalidas([]);

    try {
      const data = await archivo.arrayBuffer();
      const workbook = XLSX.read(data, { type: "array" });
      const primeraHoja = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[primeraHoja];

      const filas = XLSX.utils.sheet_to_json(worksheet, {
        defval: "",
      });

      const validas = [];
      const invalidas = [];

      filas.forEach((fila, index) => {
        const dni = normalizarDni(
          obtenerValorFila(fila, [
            "dni",
            "DNI",
            "Documento",
            "documento",
            "Dni",
            "Cuil",
            "CUIL",
            "cuil",
          ])
        );

        const apellidoNombre = limpiarTexto(
          obtenerValorFila(fila, [
            "apellidoNombre",
            "Apellido y Nombre",
            "APELLIDO Y NOMBRE",
            "nombreCompleto",
            "Nombre completo",
          ])
        );

        const observacion = limpiarTexto(
          obtenerValorFila(fila, [
            "observacion",
            "Observacion",
            "Observación",
            "OBSERVACION",
          ])
        );

        const item = {
          fila: index + 2,
          dni,
          apellidoNombre,
          observacion,
        };

        if (!dni) {
          invalidas.push({
            ...item,
            motivo: "Fila sin DNI",
          });
        } else {
          validas.push(item);
        }
      });

      setFilasExcel(validas);
      setFilasInvalidas(invalidas);
    } catch (error) {
      console.error("Error al procesar Excel:", error);

      setFilasExcel([]);
      setFilasInvalidas([
        {
          fila: "-",
          dni: "-",
          motivo: "No se pudo leer el archivo Excel.",
        },
      ]);
    }
  };

  const handleImportar = () => {
    if (!onImportar) return;

    onImportar({
      servicio,
      periodoHaberInicial: periodoHaberExcel,
      periodoCobroInicial: sumarMesesPeriodo(periodoHaberExcel, 1),
      filas: filasExcel,
    });
  };

  const periodoCobroInicial = periodoHaberExcel
    ? sumarMesesPeriodo(periodoHaberExcel, 1)
    : "";

  return (
    <section className={styles.importBox}>
      <div className={styles.importHeader}>
        <div>
          <h3>Importar Excel de afiliados</h3>
          <p>
            El Excel debe contener al menos una columna llamada{" "}
            <strong>DNI</strong>. Cada DNI será validado contra{" "}
            <strong>usuarios</strong> y <strong>nuevoAfiliado</strong>.
          </p>
        </div>
      </div>

      <div className={styles.importGrid}>
        <div className={styles.formRow}>
          <label>Haber inicial del descuento</label>
          <input
            type="month"
            value={periodoHaberExcel}
            onChange={(e) => setPeriodoHaberExcel(e.target.value)}
            className={styles.monthInput}
            disabled={loading}
          />

          {periodoHaberExcel && (
            <small>
              Se cobrará desde:{" "}
              <strong>{periodoCobroTexto(periodoCobroInicial)}</strong>
            </small>
          )}
        </div>

        <div className={styles.formRow}>
          <label>Archivo Excel</label>
          <input
            ref={inputFileRef}
            type="file"
            accept=".xlsx,.xls,.csv"
            onChange={procesarArchivo}
            className={styles.fileInput}
            disabled={loading}
          />

          {archivoNombre && <small>Archivo: {archivoNombre}</small>}
        </div>

        <div className={styles.importActions}>
          <Button
            label="Importar afiliados"
            icon="pi pi-upload"
            className="p-button-success"
            onClick={handleImportar}
            loading={loading}
            disabled={!periodoHaberExcel || filasExcel.length === 0 || loading}
          />

          <Button
            label="Limpiar"
            icon="pi pi-times"
            className="p-button-secondary"
            onClick={limpiarImportacion}
            disabled={loading}
          />
        </div>
      </div>

      {filasExcel.length > 0 && (
        <div className={styles.previewBox}>
          <h4>Afiliados detectados: {filasExcel.length}</h4>

          <DataTable
            value={filasExcel}
            paginator
            rows={5}
            responsiveLayout="scroll"
            emptyMessage="No hay filas válidas."
            className={styles.previewTable}
          >
            <Column field="fila" header="Fila" />
            <Column field="dni" header="DNI" />
            <Column field="apellidoNombre" header="Apellido y nombre" />
            <Column field="observacion" header="Observación" />
          </DataTable>
        </div>
      )}

      {filasInvalidas.length > 0 && (
        <div className={styles.errorBox}>
          <h4>Filas no válidas: {filasInvalidas.length}</h4>

          <DataTable
            value={filasInvalidas}
            paginator
            rows={5}
            responsiveLayout="scroll"
            emptyMessage="No hay errores."
            className={styles.previewTable}
          >
            <Column field="fila" header="Fila" />
            <Column field="dni" header="DNI" />
            <Column field="motivo" header="Motivo" />
          </DataTable>
        </div>
      )}
    </section>
  );
};

export default ImportarAfiliadosServicio;