import React, { useRef, useState } from "react";
import { Button } from "primereact/button";
import { Dialog } from "primereact/dialog";
import { InputText } from "primereact/inputtext";
import { Message } from "primereact/message";
import { ProgressSpinner } from "primereact/progressspinner";
import { Toast } from "primereact/toast";
import { doc, getDoc } from "firebase/firestore";
import { useHistory } from "react-router-dom";
import { db } from "../../firebase/firebase-config";
import {
  crearIdRespuestaAgrupada,
  normalizarIdentificador,
} from "../../services/excelFormularioService";
import {
  COLOR_TARJETA,
  obtenerConfiguracionTarjeta,
  obtenerIndicadorSemaforo,
  obtenerSelloPorColor,
  resolverColorRegistro,
} from "../../services/configuracionVisualService";
import styles from "./ConsultaExcelAgrupada.module.css";

const esCampoDni = (campo) =>
  String(campo?.label || "").trim().toLowerCase() === "dni";

/**
 * Clase CSS de la tarjeta seg\u00fan el color resuelto.
 *
 * "sin color" y null no figuran ac\u00e1 a prop\u00f3sito: no tienen clase, la tarjeta
 * queda con su aspecto neutro.
 */
const CLASE_POR_COLOR = {
  [COLOR_TARJETA.VERDE]: "cardVerde",
  [COLOR_TARJETA.AMARILLO]: "cardAmarilla",
  [COLOR_TARJETA.ROJO]: "cardRoja",
};

const CLASE_SELLO_POR_COLOR = {
  [COLOR_TARJETA.VERDE]: "selloVerde",
  [COLOR_TARJETA.AMARILLO]: "selloAmarillo",
  [COLOR_TARJETA.ROJO]: "selloRojo",
};

const ICONO_SELLO_POR_COLOR = {
  [COLOR_TARJETA.VERDE]: "pi pi-check-circle",
  [COLOR_TARJETA.AMARILLO]: "pi pi-clock",
  [COLOR_TARJETA.ROJO]: "pi pi-times-circle",
};

/** Clases de un elemento coloreado, sin dejar "undefined" en el className. */
const clasesConColor = (claseBase, color) =>
  [claseBase, CLASE_POR_COLOR[color] ? styles[CLASE_POR_COLOR[color]] : null]
    .filter(Boolean)
    .join(" ");

const clasesSello = (color) =>
  [styles.selloEstado, CLASE_SELLO_POR_COLOR[color] ? styles[CLASE_SELLO_POR_COLOR[color]] : null]
    .filter(Boolean)
    .join(" ");

const formatearDniVisual = (valor) => {
  const valorOriginal = String(valor ?? "");
  const soloDigitos = valorOriginal.replace(/\D/g, "");

  return soloDigitos
    ? soloDigitos.replace(/\B(?=(\d{3})+(?!\d))/g, ".")
    : valorOriginal;
};

const ConsultaExcelAgrupada = ({ formulario, formularioId }) => {
  const history = useHistory();
  const toast = useRef(null);
  const [identificador, setIdentificador] = useState("");
  const [respuesta, setRespuesta] = useState(null);
  const [detalle, setDetalle] = useState(null);
  const [buscando, setBuscando] = useState(false);

  const configuracion = formulario.configuracionExcel || {};
  const columnaAgrupacion = configuracion.columnaAgrupacion || {
    key: "dni",
    label: "DNI",
  };
  const campos = [...(configuracion.camposSeleccionados || [])].sort(
    (a, b) => Number(a.orden || 0) - Number(b.orden || 0)
  );
  const camposDetalle = campos.filter((campo) => campo.tipo === "DETALLE");
  // Configuración de color del FORMULARIO. Si no tiene, es null y las
  // tarjetas quedan como siempre.
  const configuracionTarjeta = obtenerConfiguracionTarjeta(formulario);

  const consultar = async () => {
    const valor = normalizarIdentificador(identificador, columnaAgrupacion);

    if (!valor) {
      toast.current?.show({
        severity: "warn",
        summary: "Identificador requerido",
        detail: `Ingrese ${columnaAgrupacion.label || "el identificador"}.`,
        life: 3500,
      });
      return;
    }

    setBuscando(true);
    setRespuesta(null);

    try {
      const snap = await getDoc(
        doc(
          db,
          "oficina_gestion_respuestas",
          crearIdRespuestaAgrupada(formularioId, valor)
        )
      );

      if (!snap.exists()) {
        toast.current?.show({
          severity: "info",
          summary: "Sin resultados",
          detail: "No se encontraron registros para el identificador ingresado.",
          life: 4000,
        });
        return;
      }

      setRespuesta({ id: snap.id, ...snap.data() });
    } catch (error) {
      console.error("Error al consultar información agrupada:", error);
      toast.current?.show({
        severity: "error",
        summary: "No se pudo consultar",
        detail: "Intente nuevamente más tarde.",
        life: 4500,
      });
    } finally {
      setBuscando(false);
    }
  };

  const persona = respuesta?.datosPersona || {};
  const obtenerValorPersona = (campo) =>
    persona[campo.key] ?? respuesta?.identificador ?? "";
  const obtenerValorDetalle = (registro, campo) => registro?.[campo.key] ?? "";
  const cantidadRegistros = respuesta?.cantidadRegistros || respuesta?.registros?.length || 0;

  return (
    <main className={styles.page}>
      <Toast ref={toast} />

      <section className={styles.card}>
        <span className={styles.badge}>Oficina de Gestión</span>
        <h1>{formulario.titulo || "Consulta de información"}</h1>
        <p className={styles.intro}>
          {formulario.descripcion ||
            `Ingresá ${columnaAgrupacion.label || "tu identificador"} para consultar tus registros.`}
        </p>

        <div className={styles.searchBox}>
          <label htmlFor="identificadorExcel">
            {columnaAgrupacion.label || "Identificador"}
          </label>
          <div className={styles.searchRow}>
            <InputText
              id="identificadorExcel"
              value={identificador}
              onChange={(event) => setIdentificador(event.target.value)}
              onKeyDown={(event) => event.key === "Enter" && consultar()}
              placeholder={`Ingrese ${columnaAgrupacion.label || "el identificador"}`}
              inputMode={esCampoDni(columnaAgrupacion) ? "numeric" : undefined}
              pattern={esCampoDni(columnaAgrupacion) ? "[0-9]*" : undefined}
              autoComplete="off"
              disabled={buscando}
            />
            <Button
              label="Consultar"
              icon="pi pi-search"
              severity="success"
              className={styles.consultarButton}
              onClick={consultar}
              loading={buscando}
            />
          </div>
        </div>

        {buscando && (
          <div className={styles.loading} aria-live="polite">
            <ProgressSpinner />
          </div>
        )}

        {respuesta && (
          <section className={styles.resultado} aria-live="polite">
            <div className={styles.personaHeader}>
              <div className={styles.personaDatos}>
                <h2>
                  {persona.apellido || persona.Apellido || "Persona consultada"}
                  {persona.nombre || persona.Nombre
                    ? `, ${persona.nombre || persona.Nombre}`
                    : ""}
                </h2>
                <p>
                  {columnaAgrupacion.label}: {esCampoDni(columnaAgrupacion)
                    ? formatearDniVisual(respuesta.identificador)
                    : respuesta.identificador}
                </p>
              </div>
              <strong className={styles.registrosBadge}>
                {cantidadRegistros} registros encontrados
              </strong>
            </div>

            <div className={styles.registrosGrid}>
              {(respuesta.registros || []).map((registro, index) => {
                // El color se calcula acá, al renderizar: no está guardado en
                // la respuesta. Cambiar la configuración del formulario
                // recolorea todo sin reimportar nada.
                const color = resolverColorRegistro(registro, configuracionTarjeta);

                return (
                <article
                  className={clasesConColor(styles.registroCard, color)}
                  key={`${respuesta.id}-${index}`}
                >
                  <div className={styles.registroEncabezado}>
                    <span className={styles.registroNumero}>Registro {index + 1}</span>
                    {/* Muestra el valor tal como vino del Excel; no se traduce
                        a un vocabulario propio para que sirva en cualquier
                        formulario. */}
                  </div>
                  <div className={styles.resumenDetalle}>
                    {camposDetalle.slice(0, 4).map((campo) => (
                      <div key={campo.key}>
                        <span>{campo.label}</span>
                        <strong>{obtenerValorDetalle(registro, campo) || "—"}</strong>
                      </div>
                    ))}
                  </div>
                  <Button
                    label="Ver detalle"
                    icon="pi pi-eye"
                    severity="warning"
                    outlined
                    className={styles.detalleButton}
                    onClick={() => setDetalle({ registro, index })}
                  />
                </article>
                );
              })}
            </div>
          </section>
        )}

        {!respuesta && !buscando && (
          <div className={styles.infoMessage}>
            <Message
              severity="info"
              text="Ingresá el identificador para consultar la información disponible."
            />
          </div>
        )}

        <div className={styles.volverArea}>
          <Button
            label="Volver a Oficina de Gestión"
            icon="pi pi-arrow-left"
            severity="secondary"
            outlined
            className={styles.volverButton}
            onClick={() => history.push("/oficina-gestion")}
          />
        </div>
      </section>

      <Dialog
        header={`Detalle del registro ${detalle ? detalle.index + 1 : ""}`}
        visible={Boolean(detalle)}
        onHide={() => setDetalle(null)}
        className={styles.detalleDialog}
        modal
        draggable={false}
        resizable={false}
      >
        {detalle && (() => {
          const colorRegistro = resolverColorRegistro(
            detalle.registro,
            formulario?.configuracionVisual
          );
          const sello = obtenerSelloPorColor(
            colorRegistro,
            formulario?.configuracionVisual
          );

          return (
            <>
              {sello && (
                <div className={clasesSello(sello.color)}>
                  <i className={ICONO_SELLO_POR_COLOR[sello.color]} aria-hidden="true" />
                  <span>{sello.texto}</span>
                </div>
              )}
              <div className={styles.detalleGrid}>
            {campos.map((campo) => {
              const valor =
                campo.tipo === "IDENTIFICADOR"
                  ? respuesta.identificador
                  : campo.tipo === "DATO_PERSONA"
                    ? obtenerValorPersona(campo)
                    : obtenerValorDetalle(detalle.registro, campo);
              const valorVisual = esCampoDni(campo)
                ? formatearDniVisual(valor)
                : valor;

              // Mismo helper que pinta la tarjeta: el badge del detalle y el
              // color del registro no pueden discrepar porque salen del mismo
              // cálculo. Antes esto dependía de un nombre de columna fijo
              // ("cargo apto para titularizar"); ahora sale de la
              // configuración y sirve para cualquier campo.
              const indicadorSemaforo = obtenerIndicadorSemaforo(
                detalle.registro,
                campo,
                configuracionTarjeta
              );

              return (
                <div key={campo.key} className={styles.detalleCampo}>
                  <span>{campo.label}</span>
                  {indicadorSemaforo ? (
                    <strong>
                      <span className={clasesConColor(styles.estadoBadge, indicadorSemaforo.color)}>
                        {valorVisual}
                      </span>
                    </strong>
                  ) : (
                    <strong>{valorVisual || "—"}</strong>
                  )}
                </div>
              );
                })}
              </div>
            </>
          );
        })()}
      </Dialog>
    </main>
  );
};

export default ConsultaExcelAgrupada;
