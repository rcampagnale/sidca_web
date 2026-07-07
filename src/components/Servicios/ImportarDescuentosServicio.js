// src/components/Servicios/ImportarDescuentosServicio.js

import React, { useMemo, useRef, useState } from "react";
import * as XLSX from "xlsx";
import { Button } from "primereact/button";
import { DataTable } from "primereact/datatable";
import { Column } from "primereact/column";
import styles from "./ImportarDescuentosServicio.module.css";

const ESTADO_CUOTA_COBRADO = "cobrado";
const ESTADO_CUOTA_DESCUENTO_PARCIAL = "descuento_parcial";
const ESTADO_CUOTA_NO_COBRADO = "no_cobrado";
const ESTADO_NO_CONTRATADO = "no_contratado";
const ESTADO_SIN_PERIODO = "sin_periodo";
const ESTADO_PAGO_CONTADO = "pago_contado";

const MESES = [
  { numero: 1, nombre: "enero", corto: "ene" },
  { numero: 2, nombre: "febrero", corto: "feb" },
  { numero: 3, nombre: "marzo", corto: "mar" },
  { numero: 4, nombre: "abril", corto: "abr" },
  { numero: 5, nombre: "mayo", corto: "may" },
  { numero: 6, nombre: "junio", corto: "jun" },
  { numero: 7, nombre: "julio", corto: "jul" },
  { numero: 8, nombre: "agosto", corto: "ago" },
  { numero: 9, nombre: "septiembre", corto: "sep" },
  { numero: 9, nombre: "setiembre", corto: "set" },
  { numero: 10, nombre: "octubre", corto: "oct" },
  { numero: 11, nombre: "noviembre", corto: "nov" },
  { numero: 12, nombre: "diciembre", corto: "dic" },
];

const limpiarTexto = (valor) => {
  return String(valor || "").trim().replace(/\s+/g, " ");
};

const normalizarDni = (valor) => {
  return String(valor || "").replace(/\D/g, "");
};

const normalizarClave = (valor) => {
  return limpiarTexto(valor)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]/g, "");
};

const pad2 = (valor) => String(valor).padStart(2, "0");

const sumarMesesPeriodo = (periodo, cantidadMeses) => {
  if (!periodo) return "";

  const [anio, mes] = String(periodo).split("-").map(Number);

  if (!anio || !mes) return "";

  const fecha = new Date(anio, mes - 1 + cantidadMeses, 1);

  return `${fecha.getFullYear()}-${pad2(fecha.getMonth() + 1)}`;
};

const periodoTexto = (periodo) => {
  if (!periodo) return "Sin período";

  const [anio, mes] = String(periodo).split("-").map(Number);
  const mesInfo = MESES.find((item) => item.numero === mes);

  if (!anio || !mesInfo) return periodo;

  return `${mesInfo.nombre} ${anio}`;
};

const parseImporte = (valor) => {
  if (valor === null || valor === undefined) return 0;

  if (typeof valor === "number") {
    return Number.isFinite(valor) ? valor : 0;
  }

  const limpio = String(valor)
    .trim()
    .replace(/\$/g, "")
    .replace(/\s/g, "")
    .replace(/\./g, "")
    .replace(",", ".");

  const numero = parseFloat(limpio);
  return Number.isNaN(numero) ? 0 : numero;
};

const formatearMoneda = (valor) => {
  const numero = Number(valor || 0);

  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(numero);
};

const buscarIndiceColumna = (encabezados, claves) => {
  const encabezadosNormalizados = encabezados.map((item) => normalizarClave(item));

  for (const clave of claves) {
    const claveNormalizada = normalizarClave(clave);

    const indiceExacto = encabezadosNormalizados.findIndex(
      (encabezado) => encabezado === claveNormalizada
    );

    if (indiceExacto >= 0) return indiceExacto;

    const indiceIncluido = encabezadosNormalizados.findIndex((encabezado) =>
      encabezado.includes(claveNormalizada)
    );

    if (indiceIncluido >= 0) return indiceIncluido;
  }

  return -1;
};

const detectarMesNumero = (valor, { flexible = true } = {}) => {
  const clave = normalizarClave(valor);

  if (!clave) return null;

  const mes = MESES.find((item) => {
    const nombre = normalizarClave(item.nombre);
    const corto = normalizarClave(item.corto);

    if (clave === nombre || clave === corto) return true;

    // Modo flexible: sirve para encabezados como "ABRIL IMPORTE DESCONTADO".
    // No debe usarse para columnas administrativas como "Cuotas a descontar desde Marzo".
    return flexible && (clave.includes(nombre) || clave.includes(corto));
  });

  return mes?.numero || null;
};

const esColumnaDetalleCuotas = (valor) => {
  const clave = normalizarClave(valor);

  if (!clave) return false;

  return (
    clave.includes("cuota") ||
    clave.includes("cuotas") ||
    clave.includes("descontardesde") ||
    clave.includes("cantidaddecuotas")
  );
};

const esColumnaImporte = (valor) => {
  const clave = normalizarClave(valor);

  if (!clave) return false;

  return (
    clave.includes("importedescontado") ||
    clave.includes("montodescontado") ||
    clave.includes("valordescontado") ||
    clave.includes("descuento") ||
    clave.includes("importe") ||
    clave.includes("monto")
  );
};

const detectarEstado = (importeDescontado, valorCuota) => {
  const importe = Number(importeDescontado || 0);
  const valor = Number(valorCuota || 0);

  if (importe <= 0) return ESTADO_CUOTA_NO_COBRADO;
  if (valor > 0 && importe >= valor) return ESTADO_CUOTA_COBRADO;

  return ESTADO_CUOTA_DESCUENTO_PARCIAL;
};

const textoEstado = (estado) => {
  if (estado === ESTADO_CUOTA_COBRADO) return "Cobrado";
  if (estado === ESTADO_CUOTA_DESCUENTO_PARCIAL) return "Descuento parcial";
  if (estado === ESTADO_NO_CONTRATADO) return "No contratado";
  if (estado === ESTADO_SIN_PERIODO) return "Sin cuota del mes";
  if (estado === ESTADO_PAGO_CONTADO) return "Pago contado";
  return "No cobrado";
};

const obtenerValorCuotaContratacion = (contratacion) => {
  return Number(contratacion?.valorCuota || 0);
};

const generarPeriodosDisponibles = (contrataciones) => {
  const periodos = new Set();

  (contrataciones || []).forEach((contratacion) => {
    if (
      contratacion?.cancelado === true ||
      contratacion?.estadoContratacion === "cancelada" ||
      contratacion?.esPagoContado === true ||
      contratacion?.tipoPago === "contado"
    ) return;

    const periodoInicial = contratacion?.periodoCobroInicial;
    const cantidadCuotas = Number(contratacion?.cantidadCuotas || 0);

    if (!periodoInicial || cantidadCuotas <= 0) return;

    for (let i = 0; i < cantidadCuotas; i++) {
      const periodo = sumarMesesPeriodo(periodoInicial, i);
      if (periodo) periodos.add(periodo);
    }
  });

  return Array.from(periodos).sort((a, b) => String(a).localeCompare(String(b)));
};

// ─── ÚNICA FUNCIÓN MODIFICADA ───────────────────────────────────────────────
// Antes: devolvía "" si había más de una coincidencia, lo que bloqueaba
// la resolución de ABRIL/MAYO/JUNIO cuando el servicio tenía contrataciones
// de años anteriores con el mismo número de mes.
// Ahora: cuando hay varias coincidencias toma la más reciente (mayor año),
// que es siempre la correcta para un Excel del ciclo en curso.
// periodosDisponibles ya viene ordenado ASC por sort(), por eso el último
// elemento es el más reciente.
const resolverPeriodoDesdeMes = (mesNumero, periodosDisponibles) => {
  const coincidencias = (periodosDisponibles || []).filter((periodo) => {
    const [, mes] = String(periodo).split("-").map(Number);
    return mes === mesNumero;
  });

  if (coincidencias.length === 0) return "";

  // Una sola coincidencia: caso normal.
  // Varias: tomar la más reciente (último elemento del array ya ordenado).
  return coincidencias[coincidencias.length - 1];
};
// ────────────────────────────────────────────────────────────────────────────

const detectarColumnasMensuales = ({
  encabezadosMeses,
  encabezadosDetalle,
  periodosDisponibles,
  usaFilaDetalle = false,
}) => {
  const columnas = [];

  const totalColumnas = Math.max(
    encabezadosMeses?.length || 0,
    encabezadosDetalle?.length || 0
  );

  for (let indice = 0; indice < totalColumnas; indice++) {
    const encabezadoMes = limpiarTexto(encabezadosMeses?.[indice]);
    const encabezadoDetalle = limpiarTexto(encabezadosDetalle?.[indice]);
    const textoCombinado = limpiarTexto(`${encabezadoMes} ${encabezadoDetalle}`);
    const claveMes = normalizarClave(encabezadoMes);

    // Evita tomar como mes la columna administrativa
    // "Cuotas a descontar desde Marzo".
    const esDetalleCuotas = esColumnaDetalleCuotas(encabezadoMes);
    const encabezadoTieneImporte = esColumnaImporte(encabezadoMes);
    const detalleTieneImporte = esColumnaImporte(encabezadoDetalle);
    const combinadoTieneImporte = esColumnaImporte(textoCombinado);

    let mesNumero = null;

    if (usaFilaDetalle) {
      // Formato de dos filas:
      // fila 1: ABRIL | MAYO
      // fila 2: IMPORTE DESCONTADO | IMPORTE DESCONTADO
      mesNumero = detectarMesNumero(encabezadoMes, { flexible: false });

      if (!mesNumero && combinadoTieneImporte) {
        mesNumero = detectarMesNumero(textoCombinado, { flexible: true });
      }

      if (!mesNumero || !detalleTieneImporte) continue;
    } else {
      // Formato simple recomendado:
      // ABRIL | MAYO | JUNIO
      // debajo de cada mes, solo importes numéricos.
      mesNumero = detectarMesNumero(encabezadoMes, { flexible: false });

      // También acepta una sola columna tipo "ABRIL IMPORTE DESCONTADO".
      if (!mesNumero && encabezadoTieneImporte) {
        mesNumero = detectarMesNumero(encabezadoMes, { flexible: true });
      }

      // No tomar columnas como "Cuotas a descontar desde Marzo".
      if (esDetalleCuotas && !encabezadoTieneImporte) continue;
      if (!mesNumero) continue;
    }

    // La columna del Excel representa el HABER (el mes que se devenga), no el mes
    // en que se descuenta. En Argentina el haber de un mes se descuenta al mes
    // siguiente (ej: el haber de ABRIL se descuenta en MAYO). Por eso resolvemos
    // el período contra la lista de cobro desplazada un mes hacia atrás, y luego
    // recuperamos el período de cobro real sumando 1 mes al haber encontrado.
    const periodosHaberDisponibles = (periodosDisponibles || [])
      .map((periodo) => sumarMesesPeriodo(periodo, -1))
      .filter(Boolean);
    const periodoHaber = resolverPeriodoDesdeMes(mesNumero, periodosHaberDisponibles);
    const periodoCobro = periodoHaber ? sumarMesesPeriodo(periodoHaber, 1) : "";
    const mesInfo = MESES.find((item) => item.numero === mesNumero);

    columnas.push({
      indice,
      mesNumero,
      mesNombre: mesInfo?.nombre || encabezadoMes,
      periodoHaber,
      periodoCobro,
      encabezado: textoCombinado || encabezadoMes,
    });
  }

  return columnas;
};

const ImportarDescuentosServicio = ({
  servicio,
  contrataciones = [],
  loading = false,
  procesando = false,
  onProcesar,
}) => {
  const inputFileRef = useRef(null);

  const [archivoNombre, setArchivoNombre] = useState("");
  const [filasExcel, setFilasExcel] = useState([]);
  const [filasInvalidas, setFilasInvalidas] = useState([]);
  const [columnasDetectadas, setColumnasDetectadas] = useState([]);
  const [marcarAusentes, setMarcarAusentes] = useState(true);

  const mapaContrataciones = useMemo(() => {
    const mapa = new Map();

    (contrataciones || []).forEach((contratacion) => {
      const dni = normalizarDni(contratacion?.dni);
      if (dni) mapa.set(dni, contratacion);
    });

    return mapa;
  }, [contrataciones]);

  const periodosDisponibles = useMemo(() => {
    return generarPeriodosDisponibles(contrataciones);
  }, [contrataciones]);

  const periodosDetectados = useMemo(() => {
    return Array.from(
      new Set(
        columnasDetectadas
          .map((columna) => columna.periodoCobro)
          .filter(Boolean)
      )
    ).sort((a, b) => String(a).localeCompare(String(b)));
  }, [columnasDetectadas]);

  const limpiarImportacion = () => {
    setArchivoNombre("");
    setFilasExcel([]);
    setFilasInvalidas([]);
    setColumnasDetectadas([]);

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
    setColumnasDetectadas([]);

    try {
      const data = await archivo.arrayBuffer();
      const workbook = XLSX.read(data, { type: "array" });
      const primeraHoja = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[primeraHoja];

      const matriz = XLSX.utils.sheet_to_json(worksheet, {
        header: 1,
        defval: "",
        blankrows: false,
      });

      const indiceEncabezado = matriz.findIndex((fila) => {
        const normalizados = fila.map((celda) => normalizarClave(celda));
        return normalizados.some((celda) =>
          ["dni", "documento", "cuil", "cuit"].includes(celda)
        );
      });

      if (indiceEncabezado < 0) {
        setFilasInvalidas([
          {
            fila: "-",
            dni: "-",
            motivo: "No se encontró una columna DNI / Documento / CUIL.",
          },
        ]);
        return;
      }

      const encabezadosMeses = matriz[indiceEncabezado] || [];
      const filaPosterior = matriz[indiceEncabezado + 1] || [];
      const usaFilaDetalle = filaPosterior.some((celda) => esColumnaImporte(celda));
      const encabezadosDetalle = usaFilaDetalle ? filaPosterior : [];
      const indiceInicioDatos = indiceEncabezado + (usaFilaDetalle ? 2 : 1);

      const indiceDni = buscarIndiceColumna(encabezadosMeses, [
        "DNI",
        "Documento",
        "CUIL",
        "CUIT",
      ]);
      const indiceApellido = buscarIndiceColumna(encabezadosMeses, ["Apellido"]);
      const indiceNombre = buscarIndiceColumna(encabezadosMeses, [
        "Nombre",
        "Nombre completo",
      ]);
      const indiceObservacion = buscarIndiceColumna(encabezadosMeses, [
        "Observacion",
        "Observación",
        "Detalle",
        "Concepto",
      ]);

      if (indiceDni < 0) {
        setFilasInvalidas([
          {
            fila: "-",
            dni: "-",
            motivo: "El Excel debe tener una columna DNI.",
          },
        ]);
        return;
      }

      const columnasImporte = detectarColumnasMensuales({
        encabezadosMeses,
        encabezadosDetalle,
        periodosDisponibles,
        usaFilaDetalle,
      });

      if (columnasImporte.length === 0) {
        setFilasInvalidas([
          {
            fila: "-",
            dni: "-",
            motivo:
              "No se detectaron columnas mensuales. Usá columnas simples como MARZO, ABRIL, MAYO; o el formato de dos filas ABRIL / IMPORTE DESCONTADO.",
          },
        ]);
        return;
      }

      const columnasSinPeriodo = columnasImporte.filter(
        (columna) => !columna.periodoCobro
      );

      const columnasConPeriodo = columnasImporte.filter(
        (columna) => columna.periodoCobro
      );

      if (columnasConPeriodo.length === 0) {
        setColumnasDetectadas(columnasImporte);
        setFilasInvalidas([
          {
            fila: "-",
            dni: "-",
            motivo:
              "Se detectaron meses en el Excel, pero no coinciden con las cuotas generadas del servicio.",
          },
        ]);
        return;
      }

      const validas = [];
      const invalidas = [];

      if (columnasSinPeriodo.length > 0) {
        columnasSinPeriodo.forEach((columna) => {
          invalidas.push({
            fila: "Encabezado",
            dni: "-",
            motivo: `La columna ${columna.mesNombre?.toUpperCase?.() || columna.encabezado} (haber) no coincide con ningún período de cobro generado en este servicio. Recordá: el haber de un mes se descuenta al mes siguiente.`,
          });
        });
      }

      matriz.slice(indiceInicioDatos).forEach((fila, index) => {
        const numeroFila = indiceInicioDatos + index + 1;
        const dni = normalizarDni(fila[indiceDni]);
        const apellido = indiceApellido >= 0 ? limpiarTexto(fila[indiceApellido]) : "";
        const nombre = indiceNombre >= 0 ? limpiarTexto(fila[indiceNombre]) : "";
        const observacion =
          indiceObservacion >= 0 ? limpiarTexto(fila[indiceObservacion]) : "";

        const tieneDatos = fila.some((celda) => limpiarTexto(celda));
        if (!tieneDatos) return;

        if (!dni) {
          invalidas.push({
            fila: numeroFila,
            dni: "-",
            motivo: "Fila sin DNI.",
          });
          return;
        }

        const contratacion = mapaContrataciones.get(dni);
        const valorCuota = obtenerValorCuotaContratacion(contratacion);
        const esPagoContado =
          contratacion?.esPagoContado === true || contratacion?.tipoPago === "contado";

        columnasConPeriodo.forEach((columna) => {
          const importeDescontado = parseImporte(fila[columna.indice]);
          const estadoDetectado = !contratacion
            ? ESTADO_NO_CONTRATADO
            : esPagoContado
            ? ESTADO_PAGO_CONTADO
            : detectarEstado(importeDescontado, valorCuota);

          validas.push({
            fila: numeroFila,
            dni,
            apellido,
            nombre,
            periodoCobro: columna.periodoCobro,
            periodoCobroTexto: periodoTexto(columna.periodoCobro),
            periodoHaber: columna.periodoHaber,
            periodoHaberTexto: periodoTexto(columna.periodoHaber),
            mesExcel: columna.mesNombre,
            importeDescontado,
            importeDescontadoTexto: formatearMoneda(importeDescontado),
            valorCuota,
            valorCuotaTexto: valorCuota > 0 ? formatearMoneda(valorCuota) : "-",
            contratado: !!contratacion,
            esPagoContado,
            estadoDetectado,
            estadoDetectadoTexto: textoEstado(estadoDetectado),
            observacion,
          });
        });
      });

      setColumnasDetectadas(columnasImporte);
      setFilasExcel(validas);
      setFilasInvalidas(invalidas);
    } catch (error) {
      console.error("Error al leer Excel de descuentos:", error);
      setFilasExcel([]);
      setColumnasDetectadas([]);
      setFilasInvalidas([
        {
          fila: "-",
          dni: "-",
          motivo: "No se pudo leer el archivo Excel.",
        },
      ]);
    }
  };

  const limpiarSoloArchivo = () => {
    setArchivoNombre("");
    setFilasExcel([]);
    setFilasInvalidas([]);
    setColumnasDetectadas([]);
    if (inputFileRef.current) {
      inputFileRef.current.value = "";
    }
  };

  const handleProcesar = async () => {
    if (!onProcesar) return;

    await onProcesar({
      servicio,
      periodosCobro: periodosDetectados,
      filas: filasExcel,
      marcarAusentesComoNoCobrados: marcarAusentes,
    });

    limpiarSoloArchivo();
  };

  const estadoTemplate = (rowData) => {
    const estado = rowData?.estadoDetectado;

    if (estado === ESTADO_PAGO_CONTADO) {
      return <span className={styles.estadoContado}>Pago contado</span>;
    }

    if (estado === ESTADO_NO_CONTRATADO) {
      return <span className={styles.estadoNoContratado}>No contratado</span>;
    }

    if (estado === ESTADO_SIN_PERIODO) {
      return <span className={styles.estadoNoContratado}>Sin cuota del mes</span>;
    }

    if (estado === ESTADO_CUOTA_COBRADO) {
      return <span className={styles.estadoCobrado}>Cobrado</span>;
    }

    if (estado === ESTADO_CUOTA_DESCUENTO_PARCIAL) {
      return <span className={styles.estadoParcial}>Descuento parcial</span>;
    }

    return <span className={styles.estadoNoCobrado}>No cobrado</span>;
  };

  const contratadoTemplate = (rowData) => {
    if (rowData.contratado) {
      return <span className={styles.contratadoOk}>Sí</span>;
    }

    return <span className={styles.contratadoNo}>No</span>;
  };

  const importeTemplate = (rowData) => {
    return <strong>{rowData?.importeDescontadoTexto}</strong>;
  };

  const resumen = useMemo(() => {
    return filasExcel.reduce(
      (acc, fila) => {
        if (!fila.contratado || fila.estadoDetectado === ESTADO_NO_CONTRATADO) {
          acc.noContratados += 1;
          return acc;
        }

        if (fila.estadoDetectado === ESTADO_PAGO_CONTADO) acc.contados += 1;
        else if (fila.estadoDetectado === ESTADO_CUOTA_COBRADO) acc.cobrados += 1;
        else if (fila.estadoDetectado === ESTADO_CUOTA_DESCUENTO_PARCIAL)
          acc.parciales += 1;
        else acc.noCobrados += 1;

        return acc;
      },
      { cobrados: 0, parciales: 0, noCobrados: 0, noContratados: 0, contados: 0 }
    );
  }, [filasExcel]);

  const contratadosAusentes = useMemo(() => {
    if (!marcarAusentes || periodosDetectados.length === 0) return 0;

    const clavesExcel = new Set(
      filasExcel.map(
        (fila) => `${normalizarDni(fila.dni)}__${fila.periodoCobro}`
      )
    );

    let totalAusentes = 0;

    periodosDetectados.forEach((periodo) => {
      (contrataciones || []).forEach((contratacion) => {
        if (
          contratacion?.cancelado === true ||
          contratacion?.estadoContratacion === "cancelada" ||
          contratacion?.esPagoContado === true ||
          contratacion?.tipoPago === "contado"
        ) return;
        const clave = `${normalizarDni(contratacion?.dni)}__${periodo}`;
        if (!clavesExcel.has(clave)) totalAusentes += 1;
      });
    });

    return totalAusentes;
  }, [contrataciones, filasExcel, marcarAusentes, periodosDetectados]);

  const [expandido, setExpandido] = useState(false);

  return (
    <section className={styles.importBox}>
      <div
        className={`${styles.importHeader} ${styles.importHeaderClickable}`}
        onClick={() => setExpandido((v) => !v)}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => e.key === "Enter" && setExpandido((v) => !v)}
      >
        <div className={styles.importHeaderIcon}>
          <i className="pi pi-percentage" />
        </div>
        <div style={{ flex: 1 }}>
          <h3>Importar descuentos mensuales</h3>
          <p>
            Usá este bloque para actualizar las cuotas ya generadas. El Excel debe
            tener columnas por <strong>mes de haber</strong> (el mes que se devenga), por ejemplo{" "}
            <strong>MARZO</strong>, <strong>ABRIL</strong>, <strong>MAYO</strong>. El sistema descuenta
            automáticamente al mes siguiente (el haber de <strong>ABRIL</strong> se descuenta en{" "}
            <strong>MAYO</strong>). Debajo de cada mes cargá solo el importe descontado. También
            acepta el formato de dos filas: <strong>ABRIL</strong> / <strong>IMPORTE DESCONTADO</strong>.
          </p>
        </div>
        <i className={`pi ${expandido ? "pi-chevron-up" : "pi-chevron-down"} ${styles.importChevron}`} />
      </div>

      {expandido && (<>

      <div className={styles.wizardBar}>
        <div className={`${styles.wizardStep} ${styles.wizardStepActive}`}>
          <span className={styles.wizardCircle}>1</span>
          <span className={styles.wizardLabel}>Cargar</span>
        </div>
        <div className={`${styles.wizardLine} ${filasExcel.length > 0 ? styles.wizardLineActive : ""}`} />
        <div className={`${styles.wizardStep} ${filasExcel.length > 0 ? styles.wizardStepActive : ""}`}>
          <span className={styles.wizardCircle}>2</span>
          <span className={styles.wizardLabel}>Revisar</span>
        </div>
        <div className={`${styles.wizardLine} ${filasExcel.length > 0 && periodosDetectados.length > 0 ? styles.wizardLineActive : ""}`} />
        <div className={`${styles.wizardStep} ${filasExcel.length > 0 && periodosDetectados.length > 0 ? styles.wizardStepActive : ""}`}>
          <span className={styles.wizardCircle}>3</span>
          <span className={styles.wizardLabel}>Procesar</span>
        </div>
      </div>

      <div className={styles.stepPanel}>
        <p className={styles.stepTitle}>
          <span className={styles.stepNum}>1</span>
          Cargá el archivo Excel de descuentos
        </p>

        <div className={styles.contextBox}>
          <span>Servicio: <strong>{servicio?.nombre || "-"}</strong></span>
          <span>Afiliados contratados: <strong>{contrataciones?.length || 0}</strong></span>
        </div>

        <div className={styles.importGridAuto}>
          <div className={styles.formRow}>
            <label>Archivo Excel de descuentos</label>
            <input
              ref={inputFileRef}
              type="file"
              accept=".xlsx,.xls,.csv"
              onChange={procesarArchivo}
              className={styles.fileInput}
              disabled={loading || procesando}
            />
            {archivoNombre && <small>Archivo: {archivoNombre}</small>}
          </div>
          <div className={styles.importActions}>
            <Button
              label="Limpiar"
              icon="pi pi-times"
              className="p-button-secondary"
              onClick={limpiarImportacion}
              disabled={loading || procesando}
            />
          </div>
        </div>

        {columnasDetectadas.length > 0 && (
          <div className={styles.periodosDetectadosBox}>
            <strong>Meses detectados en el Excel:</strong>
            <div className={styles.periodosDetectadosLista}>
              {columnasDetectadas.map((columna) => (
                <span
                  key={`${columna.indice}-${columna.mesNombre}`}
                  className={
                    columna.periodoCobro
                      ? styles.periodoDetectadoOk
                      : styles.periodoDetectadoError
                  }
                >
                  {String(columna.mesNombre || "Mes").toUpperCase()} {columna.periodoCobro ? `→ ${columna.periodoCobro}` : "→ sin cuota generada"}
                </span>
              ))}
            </div>
            {periodosDetectados.length > 0 && (
              <small>
                Se actualizarán solo las cuotas con período de cobro{" "}
                <strong>{periodosDetectados.join(", ")}</strong>.
              </small>
            )}
          </div>
        )}
      </div>

      {(filasExcel.length > 0 || filasInvalidas.length > 0) && (
        <div className={styles.stepPanel}>
          <p className={styles.stepTitle}>
            <span className={`${styles.stepNum} ${styles.stepNumActive}`}>2</span>
            Revisá las filas detectadas y configurá opciones
          </p>

          <label className={styles.checkboxRow}>
            <input
              type="checkbox"
              checked={marcarAusentes}
              onChange={(e) => setMarcarAusentes(e.target.checked)}
              disabled={loading || procesando}
            />
            <span>
              Marcar como <strong>no cobrado</strong> a los afiliados contratados que
              no figuren en el Excel para los meses detectados.
            </span>
          </label>

          {filasExcel.length > 0 && (
            <div className={styles.previewBox}>
              <div className={styles.previewHeader}>
                <h4>Filas válidas detectadas: {filasExcel.length}</h4>
                <div className={styles.resumenBadges}>
                  <span className={styles.resumenCobrado}>Cobrados: {resumen.cobrados}</span>
                  <span className={styles.resumenParcial}>Parciales: {resumen.parciales}</span>
                  <span className={styles.resumenNoCobrado}>No cobrados: {resumen.noCobrados}</span>
                  <span className={styles.resumenContado}>Contado: {resumen.contados}</span>
                  <span className={styles.resumenNeutro}>No contratados: {resumen.noContratados}</span>
                  {marcarAusentes && (
                    <span className={styles.resumenNoCobrado}>Ausentes: {contratadosAusentes}</span>
                  )}
                </div>
              </div>
              <DataTable
                value={filasExcel}
                paginator
                rows={8}
                rowsPerPageOptions={[8, 15, 30]}
                responsiveLayout="scroll"
                emptyMessage="No hay filas válidas."
                className={styles.previewTable}
              >
                <Column field="fila" header="Fila" />
                <Column field="periodoHaberTexto" header="Haber (mes devengado)" />
                <Column field="periodoCobroTexto" header="Se descuenta en" />
                <Column field="dni" header="DNI" />
                <Column field="apellido" header="Apellido" />
                <Column field="nombre" header="Nombre" />
                <Column header="Contratado" body={contratadoTemplate} />
                <Column field="valorCuotaTexto" header="Valor cuota" />
                <Column header="Importe descontado" body={importeTemplate} />
                <Column header="Estado detectado" body={estadoTemplate} />
                <Column field="observacion" header="Observación" />
              </DataTable>
            </div>
          )}

          {filasInvalidas.length > 0 && (
            <div className={styles.errorBox}>
              <h4>Filas / columnas no válidas: {filasInvalidas.length}</h4>
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
        </div>
      )}

      {filasExcel.length > 0 && (
        <div className={styles.stepPanel}>
          <p className={styles.stepTitle}>
            <span className={`${styles.stepNum} ${periodosDetectados.length > 0 ? styles.stepNumReady : ""}`}>3</span>
            Confirmá y procesá los descuentos
          </p>
          <div className={styles.importActions}>
            <Button
              label="Procesar descuentos"
              icon="pi pi-upload"
              className="p-button-success"
              onClick={handleProcesar}
              loading={procesando}
              disabled={
                loading ||
                procesando ||
                periodosDetectados.length === 0 ||
                filasExcel.length === 0
              }
              />
          </div>
          {periodosDetectados.length === 0 && filasExcel.length > 0 && (
            <small className={styles.warningHint}>
              <i className="pi pi-exclamation-triangle" /> No se detectaron meses válidos. Revisá que el Excel tenga columnas con nombres de meses.
            </small>
          )}
        </div>
      )}
      </>)}
    </section>
  );
};

export default ImportarDescuentosServicio;

