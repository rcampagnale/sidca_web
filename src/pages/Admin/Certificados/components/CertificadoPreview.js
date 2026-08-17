// src/pages/Admin/Certificados/components/CertificadoPreview.js
//
// Vista previa del certificado sobre la PLANTILLA REAL del proyecto.
// Es EXCLUSIVAMENTE visual: no genera QR, ni token, ni código, ni PDF, ni
// documento emitido, y no escribe absolutamente nada en Firestore.
//
// La plantilla (certificadocursosidca.png) ya trae todos los elementos fijos:
// logos, marcos, encabezados institucionales y las leyendas impresas
// ("Que el/la Profesor/a", "D.N.I Nº", "Participó y aprobó el curso
// denominado", "Modalidad", ", desarrollada durante los días,", "con una
// carga Horaria de", "Resolución S.P.E. Nº", "El presente certificado se
// expide … a los"). Acá NO se reconstruye nada de eso: cada dato variable se
// coloca en una CAJA con posición, ancho y alto propios, encajada en el hueco
// que la plantilla deja libre.
//
// Cajas, no textos sueltos: cada campo tiene su caja independiente, así el
// largo de uno nunca desplaza a otro. El nombre puede ocupar dos líneas sin
// mover el DNI, y el título puede crecer sin invadir la línea de modalidad.
//
// El archivo PNG está guardado en vertical (1414×2000) con el contenido
// apaisado rotado. No se modifica: se lo rota por CSS. La rotación se aplica
// SÓLO a la imagen; la capa de cajas vive en el sistema de coordenadas
// apaisado normal (2000×1414), de modo que los porcentajes se leen como uno
// espera al mirar el certificado derecho.

import React from "react";
import { Dialog } from "primereact/dialog";

import plantillaCertificado from "../../../../assets/constancia/certificadocursosidca.png";
import styles from "./CertificadoPreview.module.css";

/** Formatea el DNI sólo para mostrarlo. El valor original no se toca. */
const formatearDni = (dni) => {
  const limpio = String(dni || "").replace(/\D/g, "");
  if (!limpio) return "—";
  return limpio.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
};

/**
 * Escala tipográfica por longitud del texto.
 *
 * Devuelve un tamaño en cqw (relativo al ancho del certificado), no en px,
 * para que el texto escale junto con el lienzo en cualquier pantalla.
 *
 * `cortes` son los límites de caracteres: [hastaGrande, hastaMedio].
 * Más largo que el segundo corte usa el tamaño chico.
 */
/**
 * Cuerpo para los campos que DEBEN entrar en una sola línea.
 *
 * Los escalones por tramos no sirven acá: entre "30 Hs cátedras" y
 * "25/05/2026 al 15/05/2026" hay pocos caracteres de diferencia, pero uno
 * entra cómodo y el otro desborda. Se calcula el cuerpo que hace que el
 * texto quepa en el ancho de su caja.
 *
 *   anchoCaja : ancho de la caja en % del ancho del certificado
 *   ANCHO_CAR : ancho medio de carácter, en múltiplos del cuerpo
 *
 * El resultado se acota entre un mínimo legible y un máximo estético.
 */
/** Ancho medio de carácter en negrita, en múltiplos del cuerpo. */
const ANCHO_CAR_NEGRITA = 0.58;

const ANCHO_CAR = ANCHO_CAR_NEGRITA;

/** Ancho de .nombreBox en el CSS. Debe coincidir con el de la hoja de estilos. */
const ANCHO_CAJA_NOMBRE = 36.5;

/**
 * El diálogo NO fija tamaño: se adapta al certificado.
 *
 * El certificado se dimensiona contra el viewport (ver .certificado en el
 * CSS) y el diálogo simplemente lo envuelve, con topes para no salirse de la
 * pantalla. Así no queda aire alrededor cuando el certificado es más chico
 * que la ventana.
 *
 * Va inline porque PrimeReact aplica `style` directamente sobre .p-dialog y
 * ahí le gana a cualquier clase.
 */
const ESTILO_DIALOGO = {
  width: "auto",
  maxWidth: "96vw",
  maxHeight: "96vh",
};

const cuerpoUnaLinea = (texto, anchoCaja, maximo, minimo) => {
  const largo = String(texto ?? "").trim().length || 1;
  // Todos los datos variables van en negrita, igual que nombre y título.
  const necesario = anchoCaja / (largo * ANCHO_CAR_NEGRITA);
  return Math.min(maximo, Math.max(minimo, necesario));
};

const escalarUnaLinea = (texto, anchoCaja, maximo, minimo) =>
  `${cuerpoUnaLinea(texto, anchoCaja, maximo, minimo).toFixed(2)}cqw`;

/**
 * Cuerpo y cantidad de líneas para NOMBRE y TÍTULO.
 *
 * Prioridad: que entre en UNA línea. Se calcula el cuerpo necesario y, si
 * queda por encima del piso de legibilidad, se usa así. Recién cuando el
 * texto es tan largo que una línea obligaría a un cuerpo ilegible se pasa a
 * dos, recalculando con la mitad de caracteres por línea.
 *
 * El máximo de dos líneas es más bajo que el de una a propósito: el alto
 * disponible entre las leyendas de la plantilla es de ~9%, y dos líneas
 * grandes lo desbordan pisando el renglón siguiente.
 */
const escalarTexto = (
  texto,
  anchoCaja,
  { maximoUna, pisoUna, maximoDos, minimo, anchoCar = ANCHO_CAR }
) => {
  const largo = String(texto ?? "").trim().length || 1;

  const unaLinea = anchoCaja / (largo * anchoCar);

  if (unaLinea >= pisoUna) {
    return {
      fontSize: `${Math.min(maximoUna, unaLinea).toFixed(2)}cqw`,
      lineas: 1,
    };
  }

  const dosLineas = anchoCaja / ((largo / 2) * anchoCar);

  return {
    fontSize: `${Math.min(maximoDos, Math.max(minimo, dosLineas)).toFixed(2)}cqw`,
    lineas: 2,
  };
};

const CertificadoPreview = ({
  abierto,
  participante,
  configuracion,
  plantilla = null,
  onCerrar,
  onEmitir,
  emitiendo = false,
  emitido = false,
  puedeEmitir = true,
  motivoNoEmitir = "",
}) => {
  if (!participante || !configuracion) return null;

  // Mientras se está emitiendo se evita el cierre accidental: ni Escape ni
  // click en el fondo ni el botón Cerrar. No bloquea el resto de la app,
  // sólo impide perder de vista el resultado de una operación en curso.
  const manejarCierre = () => {
    if (emitiendo) return;
    onCerrar?.();
  };

  const botonEmitirDeshabilitado = emitiendo || emitido || !puedeEmitir;

  let textoBotonEmitir = "Emitir certificado";
  if (emitiendo) textoBotonEmitir = "Emitiendo…";
  else if (emitido) textoBotonEmitir = "Certificado emitido";

  const fuentePlantilla = plantilla?.url || plantillaCertificado;

  const nombre = participante.apellidoNombre || "—";
  const titulo = configuracion.titulo || "—";
  const cargaHoraria = configuracion.cargaHoraria || "—";
  const dias = configuracion.dias || "—";
  const fecha = configuracion.fecha || "—";
  const modalidad = configuracion.modalidad || "—";
  const resolucion = configuracion.resolucion || "—";

  // Primero se reduce el cuerpo; recién si aún no entra, el texto pasa a una
  // segunda línea. Nunca hay tercera línea: el hueco de la plantilla no la
  // admite sin pisar la leyenda siguiente.
  // Nombre y título: una línea siempre que sea legible; dos sólo si no hay
  // alternativa. Ambos van en negrita, de ahí el ancho de carácter mayor.
  const tituloAjuste = escalarTexto(titulo, 66, {
    maximoUna: 2.6,
    pisoUna: 1.5,
    maximoDos: 2.2,
    minimo: 1.35,
    anchoCar: ANCHO_CAR_NEGRITA,
  });

  // El resto va SIEMPRE en una línea: los huecos de la plantilla no admiten
  // una segunda sin pisar la leyenda de al lado o la de abajo. Los anchos
  // coinciden con los del CSS.
  // Modalidad, días, carga horaria y fecha son datos del mismo rango visual y
  // se leen como un bloque, así que comparten UN solo cuerpo: el mayor que
  // entre en las cuatro cajas. Si cada uno usara el suyo, "Presencial" (10
  // caracteres) se vería casi al doble que un rango de fechas (24), y el
  // certificado se leería desparejo.
  //
  // Quien manda es siempre el más apretado: hoy, el rango de fechas.
 // DNI: se calcula primero porque vamos a reutilizar exactamente
// el mismo tamaño de fuente para el rango de días.
const fsDni = escalarUnaLinea(
  formatearDni(participante.dni),
  15,
  2.2,
  1.4
);

// Modalidad, carga horaria y fecha siguen compartiendo un tamaño
// equilibrado según el espacio disponible.
// DÍAS ya no participa de este cálculo porque tendrá el mismo tamaño que DNI.
const cuerpoDatos = Math.min(
  cuerpoUnaLinea(modalidad, 12.5, 2.1, 1.3),
  cuerpoUnaLinea(cargaHoraria, 23.5, 2.1, 1.3),
  cuerpoUnaLinea(fecha, 21, 2.1, 1.3)
);

const fsDatos = `${cuerpoDatos.toFixed(2)}cqw`;

const fsModalidad = fsDatos;

// El rango de días usa exactamente el mismo tamaño que el DNI.
const fsDias = fsDni;

// El NOMBRE también usa exactamente el mismo cuerpo que el DNI: comparten
// renglón y deben verse del mismo tamaño.
//
// Como el nombre es mucho más largo, a ese cuerpo puede no entrar en su caja.
// En vez de bajarle el cuerpo (rompería la igualdad) o recortarlo con elipsis,
// se lo comprime horizontalmente, igual que el rango de días: la ALTURA de
// letra queda idéntica a la del DNI y sólo se angostan los caracteres.
//
// Cuando entra sin problema la escala es 1 y no se deforma nada.
const cuerpoDni = cuerpoUnaLinea(
  formatearDni(participante.dni),
  15,
  2.2,
  1.4
);

const anchoNombreNecesario =
  (String(nombre).trim().length || 1) * ANCHO_CAR_NEGRITA * cuerpoDni;

const escalaNombre = Math.min(1, ANCHO_CAJA_NOMBRE / anchoNombreNecesario);

const fsCarga = fsDatos;
const fsFecha = fsDatos;

// Resolución mantiene su cálculo independiente.
const fsResolucion = escalarUnaLinea(
  resolucion,
  15,
  2.2,
  1.4
);

  return (
    <Dialog
      visible={Boolean(abierto)}
      onHide={manejarCierre}
      modal
      blockScroll
      draggable={false}
      dismissableMask={!emitiendo}
      closeOnEscape={!emitiendo}
      className={styles.dialogo}
      style={ESTILO_DIALOGO}
      contentClassName={styles.contenido}
      header={
        <div className={styles.encabezado}>
          <span className={styles.eyebrow}>Vista previa</span>
          <span className={styles.tituloDialogo}>{nombre}</span>
        </div>
      }
      footer={
        <div className={styles.pie}>
          <p className={styles.notaPie}>
            {emitido
              ? "Emisión registrada correctamente. El QR y la descarga se incorporarán en la siguiente etapa."
              : "Revisá los datos antes de emitir el certificado."}
          </p>

          <div className={styles.pieBotones}>
            <button
              type="button"
              className={styles.botonEmitir}
              onClick={onEmitir}
              disabled={botonEmitirDeshabilitado}
              title={!puedeEmitir && motivoNoEmitir ? motivoNoEmitir : undefined}
            >
              {textoBotonEmitir}
            </button>

            <button
              type="button"
              className={styles.botonPie}
              onClick={manejarCierre}
              disabled={emitiendo}
            >
              Cerrar
            </button>
          </div>
        </div>
      }
    >
      {/* Wrapper exclusivamente de layout: mide el espacio libre que queda
          entre el encabezado y el pie, y el certificado se dimensiona contra
          él. No afecta nada del diseño interno. */}
      <div className={styles.previewViewport}>
      <div className={styles.certificado}>
        <img
          src={fuentePlantilla}
          alt=""
          aria-hidden="true"
          className={styles.plantilla}
        />

        <div className={styles.overlay}>
          {/* Línea "Que el/la Profesor/a … , D.N.I Nº …" */}
          <div
            className={`${styles.caja} ${styles.nombreBox}`}
            style={{ fontSize: fsDni }}
          >
            {/* Mismo cuerpo que el DNI; si hace falta se comprime en
                horizontal para entrar, sin perder altura de letra. */}
            <span
              className={styles.nombreTexto}
              style={{ transform: `scaleX(${escalaNombre.toFixed(3)})` }}
            >
              {nombre}
            </span>
          </div>

          <div
            className={`${styles.caja} ${styles.dniBox}`}
            style={{ fontSize: fsDni }}
          >
            {formatearDni(participante.dni)}
          </div>

          {/* Debajo de "Participó y aprobó el curso denominado" */}
          <div
            className={`${styles.caja} ${styles.tituloBox} ${
              tituloAjuste.lineas === 1 ? styles.unaLinea : styles.dosLineas
            }`}
            style={{ fontSize: tituloAjuste.fontSize }}
          >
            {titulo}
          </div>

          {/* Línea "Modalidad … , desarrollada durante los días, …" */}
          <div
            className={`${styles.caja} ${styles.modalidadBox}`}
            style={{ fontSize: fsModalidad }}
          >
            {modalidad}
          </div>

          <div
            className={`${styles.caja} ${styles.diasBox}`}
            style={{ fontSize: fsDias }}
          >
            {/* El span se comprime horizontalmente con scaleX: así el rango
                conserva la MISMA altura de letra que el DNI y aun así entra
                completo en el hueco de la plantilla, sin truncar ni bajar el
                cuerpo. */}
            <span className={styles.diasTexto}>{dias}</span>
          </div>

          {/* Línea "… con una carga Horaria de …" */}
          <div
            className={`${styles.caja} ${styles.cargaHorariaBox}`}
            style={{ fontSize: fsCarga }}
          >
            {cargaHoraria}
          </div>

          {/* Inmediatamente después de "Resolución S.P.E. Nº" */}
          <div
            className={`${styles.caja} ${styles.resolucionBox}`}
            style={{ fontSize: fsResolucion }}
          >
            {resolucion}
          </div>

          {/* Continuación de "… se expide en San Fernando … a los" */}
          <div
            className={`${styles.caja} ${styles.fechaBox}`}
            style={{ fontSize: fsFecha }}
          >
            {fecha}
          </div>

          {/* Zona reservada del QR: margen derecho, por debajo de la fecha y
              a la altura del bloque de firma, que está a la izquierda. */}
          <div className={styles.qrBox} aria-hidden="true">
            <span className={styles.qrTexto}>QR</span>
          </div>
        </div>
      </div>
      </div>

      <p className={styles.avisoPosiciones}>
        Las posiciones son provisorias y se ajustan en la etapa de emisión,
        junto con las firmas y el QR real.
      </p>
    </Dialog>
  );
};

export default CertificadoPreview;
