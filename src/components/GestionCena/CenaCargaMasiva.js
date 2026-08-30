import React, { useEffect, useMemo, useState } from "react";
import * as XLSX from "xlsx";
import { buscarAfiliadoCenaPorDni, normalizarDniCena } from "../../services/gestionCenaService";
import styles from "../../pages/Admin/GestionCena/GestionCenaAdmin.module.css";

const normalizarEncabezado = (valor) =>
  String(valor || "")
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/\s+/g, " ");

const normalizarComparacion = (valor) =>
  String(valor || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .replace(/\s+/g, " ")
    .toUpperCase();

const campos = {
  apellido: ["APELLIDO", "APELLIDOS"],
  nombre: ["NOMBRE", "NOMBRES"],
  dni: ["DNI", "DOCUMENTO"],
  cantidad: ["CANTIDAD DE PERSONAS", "CANTIDAD PERSONAS", "CANTIDAD", "CANTIDAD DE TARJETAS", "TARJETAS"],
};

const mapaFilaNormalizada = (row) =>
  Object.entries(row).reduce((mapa, [clave, valor]) => {
    mapa[normalizarEncabezado(clave)] = valor;
    return mapa;
  }, {});

const valorDe = (filaNormalizada, opciones) => {
  const clave = opciones.find((opcion) => filaNormalizada[normalizarEncabezado(opcion)] !== undefined);
  return clave ? filaNormalizada[normalizarEncabezado(clave)] : "";
};

const normalizarDniExcel = (valor) => {
  if (typeof valor === "number" && Number.isFinite(valor)) return String(Math.trunc(valor));
  const texto = String(valor || "").trim().replace(/\.0+$/, "");
  return normalizarDniCena(texto);
};

const cantidadPersonas = (valor) => {
  const numero = typeof valor === "number" ? valor : Number(String(valor || "").trim().replace(",", "."));
  if (!Number.isFinite(numero) || !Number.isInteger(numero) || numero < 1) return null;
  return numero;
};

const cederPintado = () => new Promise((resolve) => {
  if (typeof window !== "undefined" && window.requestAnimationFrame) {
    window.requestAnimationFrame(resolve);
    return;
  }
  resolve();
});

const validarIdentidad = async (fila) => {
  try {
    const padron = await buscarAfiliadoCenaPorDni(fila.afiliado.dni);
    if (!padron) return { estadoPadron: "NO ENCONTRADO EN PADRÓN" };

    const coincide =
      normalizarComparacion(fila.afiliado.apellido) === normalizarComparacion(padron.apellido) &&
      normalizarComparacion(fila.afiliado.nombre) === normalizarComparacion(padron.nombre);

    return {
      estadoPadron: coincide ? "IDENTIDAD VALIDADA" : "DIFERENCIA CON PADRÓN",
      padron,
    };
  } catch (error) {
    return { estadoPadron: "PADRÓN NO DISPONIBLE" };
  }
};

const CenaCargaMasiva = ({ visible, reservas, onClose, onConfirmar }) => {
  const [filas, setFilas] = useState([]);
  const [errorArchivo, setErrorArchivo] = useState("");
  const [leyendo, setLeyendo] = useState(false);
  const [confirmando, setConfirmando] = useState(false);
  const [nombreArchivo, setNombreArchivo] = useState("");
  const [estadoProceso, setEstadoProceso] = useState("idle");
  const [progreso, setProgreso] = useState({ procesadas: 0, total: 0, tarjetasGeneradas: 0 });

  useEffect(() => {
    if (visible) return;
    setFilas([]);
    setErrorArchivo("");
    setNombreArchivo("");
    setEstadoProceso("idle");
    setProgreso({ procesadas: 0, total: 0, tarjetasGeneradas: 0 });
  }, [visible]);

  const existentes = useMemo(
    () => new Set(
      reservas
        .map((reserva) => normalizarDniCena(reserva.afiliado?.dni))
        .filter(Boolean)
    ),
    [reservas]
  );

  const duplicados = useMemo(() => {
    const vistos = new Set();
    const encontrados = new Set();
    filas.forEach((fila) => {
      if (fila.afiliado.dni && vistos.has(fila.afiliado.dni)) encontrados.add(fila.afiliado.dni);
      vistos.add(fila.afiliado.dni);
    });
    return encontrados;
  }, [filas]);

  const filasConEstado = useMemo(
    () => filas.map((fila) => {
      const problemas = [...fila.problemas];
      if (fila.afiliado.dni && duplicados.has(fila.afiliado.dni)) problemas.push("DNI DUPLICADO EN ARCHIVO");
      if (fila.afiliado.dni && existentes.has(fila.afiliado.dni)) problemas.push("RESERVA YA EXISTENTE");
      return { ...fila, problemas };
    }),
    [duplicados, existentes, filas]
  );

  const validas = filasConEstado.filter((fila) => !fila.problemas.length);
  const conError = filasConEstado.filter((fila) => fila.problemas.length);
  const totalTarjetas = validas.reduce((total, fila) => total + fila.cantidadTarjetas, 0);
  const titulares = validas.length;
  const acompanantes = totalTarjetas - titulares;
  const existentesArchivo = filasConEstado.filter((fila) => existentes.has(fila.afiliado.dni)).length;
  const procesando = leyendo || confirmando;
  const porcentaje = progreso.total ? Math.round((progreso.procesadas / progreso.total) * 100) : 0;
  const mensajeProceso = {
    leyendo: "Leyendo archivo...",
    validando: "Validando filas contra el padrón...",
    listo: "Validación completada.",
    importando: "Importando reservas y generando tarjetas...",
    completado: "Importación completada.",
    error: "Error durante la importación.",
  }[estadoProceso];

  if (!visible) return null;

  const leerArchivo = async (event) => {
    const archivo = event.target.files?.[0];
    setFilas([]);
    setErrorArchivo("");
    setNombreArchivo(archivo?.name || "");
    setProgreso({ procesadas: 0, total: 0, tarjetasGeneradas: 0 });
    if (!archivo) return;

    setLeyendo(true);
    setEstadoProceso("leyendo");
    try {
      const data = await archivo.arrayBuffer();
      const workbook = XLSX.read(data);
      const worksheet = workbook.Sheets[workbook.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json(worksheet, { defval: "" });
      const encabezados = rows.length ? Object.keys(rows[0]).map(normalizarEncabezado) : [];
      const faltantes = Object.entries(campos)
        .filter(([, opciones]) => !opciones.some((opcion) => encabezados.includes(normalizarEncabezado(opcion))))
        .map(([nombre]) => nombre);

      if (faltantes.length) {
        setErrorArchivo(`No se reconocieron los encabezados requeridos: ${faltantes.join(", ")}.`);
        setEstadoProceso("error");
        return;
      }

      const nuevas = rows.map((row, index) => {
        const filaNormalizada = mapaFilaNormalizada(row);
        const apellido = String(valorDe(filaNormalizada, campos.apellido) || "").trim().toUpperCase();
        const nombre = String(valorDe(filaNormalizada, campos.nombre) || "").trim().toUpperCase();
        const dni = normalizarDniExcel(valorDe(filaNormalizada, campos.dni));
        const cantidad = cantidadPersonas(valorDe(filaNormalizada, campos.cantidad));
        const problemas = [];

        if (!apellido) problemas.push("APELLIDO REQUERIDO");
        if (!nombre) problemas.push("NOMBRE REQUERIDO");
        if (!dni) problemas.push("DNI REQUERIDO");
        if (!cantidad) problemas.push("CANTIDAD DE PERSONAS DEBE SER UN ENTERO MAYOR O IGUAL A 1");

        return {
          linea: index + 2,
          afiliado: { apellido, nombre, dni },
          cantidadTarjetas: cantidad || 0,
          problemas,
          estadoPadron: dni ? "VERIFICANDO PADRÓN" : "SIN DNI",
        };
      });

      const verificadas = [];
      setEstadoProceso("validando");
      setProgreso({ procesadas: 0, total: nuevas.length, tarjetasGeneradas: 0 });
      for (let indice = 0; indice < nuevas.length; indice += 1) {
        const fila = nuevas[indice];
        verificadas.push(fila.afiliado.dni ? { ...fila, ...(await validarIdentidad(fila)) } : fila);
        setProgreso({ procesadas: indice + 1, total: nuevas.length, tarjetasGeneradas: 0 });
        await cederPintado();
      }
      setFilas(verificadas);
      setEstadoProceso("listo");
    } catch (error) {
      setErrorArchivo("No se pudo leer el archivo Excel.");
      setEstadoProceso("error");
    } finally {
      setLeyendo(false);
    }
  };

  const confirmar = async () => {
    setConfirmando(true);
    setErrorArchivo("");
    setEstadoProceso("importando");
    setProgreso({ procesadas: 0, total: validas.length, tarjetasGeneradas: 0 });
    try {
      const resultado = await onConfirmar(validas, {
        omitidas: conError.length,
        onProgress: ({ procesadas, total, tarjetasGeneradas }) => {
          setProgreso({ procesadas, total, tarjetasGeneradas });
        },
      });
      setProgreso({
        procesadas: validas.length,
        total: validas.length,
        tarjetasGeneradas: resultado.tarjetasGeneradas || 0,
      });
      setEstadoProceso("completado");
    } catch (error) {
      setErrorArchivo(error.message || "No se pudo completar la importación.");
      setEstadoProceso("error");
    } finally {
      setConfirmando(false);
    }
  };

  return (
    <div className={styles.modalOverlay} role="dialog" aria-modal="true">
      <div className={styles.modal}>
        <div className={styles.modalHeader}>
          <h2>Importar Excel</h2>
          <button type="button" className={styles.iconButton} onClick={onClose} disabled={procesando}>×</button>
        </div>
        <p className={styles.helpText}>Columnas requeridas: APELLIDO, NOMBRE, DNI y CANTIDAD DE PERSONAS.</p>
        <input type="file" accept=".xlsx,.xls,.csv" onChange={leerArchivo} disabled={procesando} />
        {nombreArchivo && <p className={styles.gcImportFileName}>{nombreArchivo}</p>}
        {errorArchivo && <p className={styles.error}>{errorArchivo}</p>}
        {mensajeProceso && (
          <section className={styles.gcImportProgress} aria-live="polite">
            <div>
              <strong>{mensajeProceso}</strong>
              {estadoProceso === "importando" && <small>No cierre esta ventana.</small>}
            </div>
            {!!progreso.total && (
              <>
                <div className={styles.gcImportProgressMeta}>
                  <span>{estadoProceso === "importando" ? "Reservas" : "Filas"}: {progreso.procesadas} de {progreso.total}</span>
                  <b>{porcentaje}%</b>
                </div>
                <div className={styles.gcImportProgressTrack} aria-label={`${porcentaje}% procesado`}>
                  <span style={{ width: `${porcentaje}%` }} />
                </div>
                {estadoProceso === "importando" && <p>Tarjetas generadas: {progreso.tarjetasGeneradas}</p>}
              </>
            )}
            {estadoProceso === "listo" && <p>{validas.length} válidas · {conError.length} con errores</p>}
            {estadoProceso === "error" && progreso.total > 0 && <p>Procesadas: {progreso.procesadas} de {progreso.total}</p>}
          </section>
        )}

        {!!filas.length && (
          <>
            <div className={styles.gcImportSummary}>
              <span>Total filas <b>{filasConEstado.length}</b></span>
              <span>Válidas <b>{validas.length}</b></span>
              <span>Con error <b>{conError.length}</b></span>
              <span>DNI duplicados <b>{duplicados.size}</b></span>
              <span>Reservas existentes <b>{existentesArchivo}</b></span>
              <span>Total tarjetas <b>{totalTarjetas}</b></span>
              <span>Total titulares <b>{titulares}</b></span>
              <span>Total acompañantes <b>{acompanantes}</b></span>
            </div>
            <div className={styles.gcImportRows}>
              {filasConEstado.map((fila) => (
                <article key={fila.linea} className={styles.gcImportRow}>
                  <div>
                    <strong>{fila.afiliado.apellido}, {fila.afiliado.nombre}</strong>
                    <span>DNI {fila.afiliado.dni || "sin dato"}</span>
                  </div>
                  <div className={styles.gcImportDetails}>
                    <span>Personas <b>{fila.cantidadTarjetas || "-"}</b></span>
                    <span>Titular <b>{fila.cantidadTarjetas ? 1 : "-"}</b></span>
                    <span>Acompañantes <b>{fila.cantidadTarjetas ? fila.cantidadTarjetas - 1 : "-"}</b></span>
                  </div>
                  <div className={styles.gcImportStatus}>
                    <span>{fila.problemas.length ? fila.problemas.join(" · ") : "VÁLIDA"}</span>
                    <small>{fila.estadoPadron}</small>
                  </div>
                </article>
              ))}
            </div>
          </>
        )}
        <div className={styles.modalActions}>
          <button type="button" className={styles.secondaryButton} onClick={onClose} disabled={procesando}>Cancelar</button>
          <button type="button" className={styles.primaryButton} disabled={!validas.length || procesando} onClick={confirmar}>
            {confirmando ? "Importando..." : "Confirmar importación"}
          </button>
        </div>
      </div>
    </div>
  );
};

export default CenaCargaMasiva;
