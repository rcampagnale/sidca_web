import React, { useEffect, useMemo, useRef, useState } from "react";
import { collection, getDocs } from "firebase/firestore";

import { db } from "../../firebase/firebase-config";
import styles from "./DetalleServicioDialog.module.css";

const ESTADO_CUOTA_COBRADO = "cobrado";
const ESTADO_CUOTA_NO_COBRADO = "no_cobrado";
const ESTADO_CUOTA_DESCUENTO_PARCIAL = "descuento_parcial";
const ESTADO_CUOTA_CANCELADA = "cancelada";

const MESES = [
  "ene",
  "feb",
  "mar",
  "abr",
  "may",
  "jun",
  "jul",
  "ago",
  "sep",
  "oct",
  "nov",
  "dic",
];

export const normalizarContratacionKey = (contratacion) =>
  `${contratacion?.dni || ""}-${
    contratacion?.subcontratacionId || contratacion?.id || "principal"
  }`;

const periodoCorto = (periodo) => {
  const [anio, mes] = String(periodo || "").split("-").map(Number);
  if (!anio || !mes) return periodo || "-";
  return `${MESES[mes - 1]} ${String(anio).slice(-2)}`;
};

const escaparRegExp = (valor) =>
  String(valor || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const dividirNombre = (contratacion) => {
  const apellidoCampo = String(contratacion?.apellido || "").trim();
  const nombreCampo = String(contratacion?.nombre || "").trim();
  const completo = String(contratacion?.apellidoNombre || "").trim();

  const partirTextoCompleto = (texto) => {
    const valor = String(texto || "").trim();
    if (!valor) return { apellido: "", nombre: "" };

    if (valor.includes(",")) {
      const [ap, ...resto] = valor.split(",");
      return {
        apellido: ap.trim(),
        nombre: resto.join(",").trim(),
      };
    }

    const partes = valor.split(/\s+/).filter(Boolean);
    return {
      apellido: partes[0] || "",
      nombre: partes.slice(1).join(" "),
    };
  };

  if (apellidoCampo && nombreCampo) {
    const nombreNormalizado = nombreCampo.includes(",")
      ? partirTextoCompleto(nombreCampo).nombre
      : nombreCampo
          .replace(new RegExp(`^${escaparRegExp(apellidoCampo)}\\s*,?\\s*`, "i"), "")
          .trim();

    return {
      apellido: apellidoCampo,
      nombre: nombreNormalizado || "-",
    };
  }

  if (apellidoCampo || nombreCampo) {
    const desdeCampoDisponible = partirTextoCompleto(
      nombreCampo || apellidoCampo
    );
    return {
      apellido: apellidoCampo || desdeCampoDisponible.apellido || "Sin apellido",
      nombre: apellidoCampo
        ? desdeCampoDisponible.nombre || "-"
        : desdeCampoDisponible.nombre || nombreCampo || "-",
    };
  }

  const desdeCompleto = partirTextoCompleto(completo);
  return {
    apellido: desdeCompleto.apellido || "Sin apellido",
    nombre: desdeCompleto.nombre || "-",
  };
};

const estadoChip = (cuota, contratacion) => {
  if (cuota?.estado === ESTADO_CUOTA_CANCELADA) {
    return { texto: "VC", clase: styles.mesChipCancelado };
  }

  if (
    contratacion?.esPagoContado === true ||
    contratacion?.tipoPago === "contado"
  ) {
    return { texto: "CONT", clase: styles.mesChipCobrado };
  }

  if (cuota?.estado === ESTADO_CUOTA_COBRADO) {
    return { texto: "C", clase: styles.mesChipCobrado };
  }

  if (cuota?.estado === ESTADO_CUOTA_DESCUENTO_PARCIAL) {
    return { texto: "P", clase: styles.mesChipParcial };
  }

  if (cuota?.estado === ESTADO_CUOTA_NO_COBRADO) {
    return { texto: "NC", clase: styles.mesChipNoCobrado };
  }

  return null;
};

const getCuotasRef = (contratacion) => {
  if (contratacion?.esSubcontratacion && contratacion?.subcontratacionId) {
    return collection(
      db,
      "servicios",
      contratacion.servicioId,
      "contrataciones",
      contratacion.dni,
      "subcontrataciones",
      contratacion.subcontratacionId,
      "cuotas"
    );
  }

  return collection(
    db,
    "servicios",
    contratacion.servicioId,
    "contrataciones",
    contratacion.dni,
    "cuotas"
  );
};

const AfiliadosContratadosTabla = ({
  servicioId = "",
  contrataciones = [],
  seleccionadoKey = "",
  onSeleccionar,
  renderDetalle,
  periodoColumna = "periodoCobro",
}) => {
  const [cuotasPorContrato, setCuotasPorContrato] = useState({});
  const [cargandoCuotas, setCargandoCuotas] = useState(false);
  const cacheCuotasRef = useRef({});
  const servicioCacheRef = useRef("");

  const servicioActualKey = servicioId || contrataciones[0]?.servicioId || "";
  const clavesContrataciones = useMemo(
    () => contrataciones.map(normalizarContratacionKey).join("|"),
    [contrataciones]
  );

  useEffect(() => {
    let cancelado = false;

    const cargarCuotas = async () => {
      if (servicioCacheRef.current !== servicioActualKey) {
        servicioCacheRef.current = servicioActualKey;
        cacheCuotasRef.current = {};
        setCuotasPorContrato({});
      }

      if (!contrataciones.length) {
        cacheCuotasRef.current = {};
        setCuotasPorContrato({});
        return;
      }

      const clavesActuales = new Set(
        contrataciones.map(normalizarContratacionKey)
      );
      const cuotasVisibles = Object.fromEntries(
        Object.entries(cacheCuotasRef.current).filter(([key]) =>
          clavesActuales.has(key)
        )
      );
      setCuotasPorContrato(cuotasVisibles);

      const contratacionesPendientes = contrataciones.filter(
        (contratacion) =>
          !Object.prototype.hasOwnProperty.call(
            cacheCuotasRef.current,
            normalizarContratacionKey(contratacion)
          )
      );

      if (!contratacionesPendientes.length) return;

      setCargandoCuotas(true);

      try {
        const pares = await Promise.all(
          contratacionesPendientes.map(async (contratacion) => {
            const key = normalizarContratacionKey(contratacion);
            try {
              const snap = await getDocs(getCuotasRef(contratacion));
              const cuotas = snap.docs
                .map((docSnap) => ({
                  id: docSnap.id,
                  ...docSnap.data(),
                }))
                .sort(
                  (a, b) =>
                    Number(a.numeroCuota || 0) - Number(b.numeroCuota || 0)
                );
              return [key, cuotas];
            } catch {
              return [key, []];
            }
          })
        );

        if (!cancelado) {
          pares.forEach(([key, cuotas]) => {
            cacheCuotasRef.current[key] = cuotas;
          });

          setCuotasPorContrato(
            Object.fromEntries(
              Object.entries(cacheCuotasRef.current).filter(([key]) =>
                clavesActuales.has(key)
              )
            )
          );
        }
      } finally {
        if (!cancelado) setCargandoCuotas(false);
      }
    };

    cargarCuotas();

    return () => {
      cancelado = true;
    };
  }, [clavesContrataciones, contrataciones, servicioActualKey]);

  const meses = useMemo(() => {
    const periodos = new Set();
    Object.values(cuotasPorContrato).forEach((cuotas) => {
      cuotas.forEach((cuota) => {
        if (
            [
            ESTADO_CUOTA_COBRADO,
            ESTADO_CUOTA_DESCUENTO_PARCIAL,
            ESTADO_CUOTA_NO_COBRADO,
            ESTADO_CUOTA_CANCELADA,
          ].includes(cuota?.estado) &&
          cuota?.[periodoColumna]
        ) {
          periodos.add(cuota[periodoColumna]);
        }
      });
    });

    return Array.from(periodos).sort();
  }, [cuotasPorContrato, periodoColumna]);

  return (
    <div className={styles.tablaContratadosWrap}>
      <table className={styles.tablaContratados}>
        <thead>
          <tr>
            <th>Apellido</th>
            <th>Nombre</th>
            <th>DNI</th>
            {meses.map((periodo) => (
              <th key={periodo}>{periodoCorto(periodo)}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {contrataciones.map((contratacion) => {
            const key = normalizarContratacionKey(contratacion);
            const { apellido, nombre } = dividirNombre(contratacion);
            const cuotas = cuotasPorContrato[key] || [];
            const seleccionado = seleccionadoKey === key;

            return (
              <React.Fragment key={key}>
              <tr
                className={
                  `${seleccionado ? styles.filaContratadoActiva : ""} ${
                    contratacion?.cancelado ? styles.filaContratadoCancelado : ""
                  }`
                }
                onClick={() => onSeleccionar?.(contratacion)}
              >
                <td>
                  <strong>{apellido}</strong>
                  {contratacion?.esSubcontratacion && (
                    <span className={styles.tablaSubBadge}>Adicional</span>
                  )}
                  {contratacion?.cancelado && (
                    <span className={styles.tablaCanceladoBadge}>
                      Viaje cancelado
                    </span>
                  )}
                </td>
                <td>{nombre}</td>
                <td>{contratacion?.dni || "-"}</td>
                {meses.map((periodo) => {
                  const cuotasPeriodo = cuotas.filter(
                    (cuota) => cuota?.[periodoColumna] === periodo
                  );
                  const chips = cuotasPeriodo
                    .map((cuota) => estadoChip(cuota, contratacion))
                    .filter(Boolean);

                  return (
                    <td key={periodo}>
                      <div className={styles.mesChips}>
                        {chips.length > 0
                          ? chips.map((chip, index) => (
                              <span
                                key={`${chip.texto}-${index}`}
                                className={chip.clase}
                              >
                                {chip.texto}
                              </span>
                            ))
                          : "—"}
                      </div>
                    </td>
                  );
                })}
              </tr>
              {seleccionado && renderDetalle && (
                <tr className={styles.filaDetalleContratado}>
                  <td colSpan={3 + meses.length}>
                    {renderDetalle(contratacion)}
                  </td>
                </tr>
              )}
              </React.Fragment>
            );
          })}
        </tbody>
      </table>

      {cargandoCuotas && (
        <div className={styles.tablaContratadosLoading}>
          Cargando meses descontados...
        </div>
      )}
    </div>
  );
};

export default AfiliadosContratadosTabla;
