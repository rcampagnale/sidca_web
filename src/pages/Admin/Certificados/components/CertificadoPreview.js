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

import React, { useLayoutEffect, useRef, useState } from "react";
import { Dialog } from "primereact/dialog";
import QRCode from "react-qr-code";

import plantillaSidca from "../../../../assets/constancia/certificadocursosidca.png";
import plantillaITM from "../../../../assets/constancia/certificadoITM.png";
import styles from "./CertificadoPreview.module.css";

/**
 * Plantilla según la institución. Ambas son 1414×2000 con el contenido
 * apaisado rotado, así que comparten el mismo sistema de coordenadas.
 */
const PLANTILLAS = {
  sidca: plantillaSidca,
  itm: plantillaITM,
};

/** Toda configuración sin institución explícita es SIDCA. */
const normalizarInstitucion = (valor) => (valor === "itm" ? "itm" : "sidca");

/**
 * Autoridades a imprimir, con compatibilidad hacia el modelo anterior.
 *
 * Prioridad:
 *   1. snapshot del emitido  — manda siempre que exista.
 *   2. configuración actual  — para el preview previo a emitir.
 *   3. firmas legacy         — sólo nombre y cargo; las imágenes se ignoran.
 *
 * Devuelve siempre dos posiciones para que el layout no se descoloque cuando
 * falta una.
 *
 * Los cuatro textos se leen con `|| ""`: las autoridades emitidas o guardadas
 * antes de que existieran organismo y referencia no traen esos campos, y las
 * firmas legacy nunca los tuvieron. Quedan vacíos y el renglón no se dibuja.
 */
const resolverAutoridades = (emision, configuracion) => {
  const desdeEmision = emision?.certificado?.autoridades;
  const desdeConfig = configuracion?.autoridades;
  const legacy =
    emision?.certificado?.firmas || configuracion?.firmas || null;

  const origen =
    (Array.isArray(desdeEmision) && desdeEmision.length ? desdeEmision : null) ||
    (Array.isArray(desdeConfig) && desdeConfig.length ? desdeConfig : null) ||
    (Array.isArray(legacy) ? legacy : []);

  return [0, 1].map((indice) => ({
    nombre: String(origen[indice]?.nombre || "").trim(),
    cargo: String(origen[indice]?.cargo || "").trim(),
    organismo: String(origen[indice]?.organismo || "").trim(),
    referencia: String(origen[indice]?.referencia || "").trim(),
  }));
};

/**
 * Reglas de cada renglón de autoridad.
 *
 * `cuerpo` es un tamaño FIJO por tipo de línea, no derivado del largo del
 * texto. Ese es el punto: el criterio anterior calculaba el cuerpo dividiendo
 * el ancho de la caja por los caracteres, así que la línea más larga —el
 * nombre— terminaba siendo la más chica y la jerarquía quedaba al revés.
 * Ahora un organismo largo se resuelve envolviéndolo, sin arrastrar al resto
 * del bloque.
 *
 * `lineas` es cuántos renglones puede ocupar: nombre y cargo van en uno,
 * organismo y referencia admiten dos. Quien lo hace cumplir es el CSS, al
 * envolver el texto dentro del ancho de la caja.
 */
const RENGLONES_AUTORIDAD = [
  {
    campo: "nombre",
    clase: "autoridadNombre",
    cuerpo: 1.55,
    lineas: 1,
  },
  {
    campo: "cargo",
    clase: "autoridadCargo",
    cuerpo: 1.25,
    lineas: 1,
  },
  { campo: "organismo", clase: "autoridadOrganismo", cuerpo: 1.1, lineas: 2 },
  { campo: "referencia", clase: "autoridadReferencia", cuerpo: 1.0, lineas: 2 },
];

/**
 * Renglones a imprimir de una autoridad: en orden y sin vacíos.
 *
 * Filtrar los vacíos acá es lo que evita el hueco vertical cuando falta, por
 * ejemplo, la referencia.
 *
 * El cuerpo sale tal cual de RENGLONES_AUTORIDAD, sin recalcularse por largo
 * de texto: cada tipo de línea conserva su jerarquía y un organismo largo se
 * resuelve envolviéndolo. Ningún renglón lleva elipsis.
 */
const lineasAutoridad = (autoridad, estilos) =>
  RENGLONES_AUTORIDAD.map((renglon) => {
    const texto = String(autoridad[renglon.campo] || "").trim();
    if (!texto) return null;

    return {
      clase: estilos[renglon.clase],
      texto,
      fontSize: `${renglon.cuerpo.toFixed(2)}cqw`,
    };
  }).filter(Boolean);

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

/** Ancho de .nombreBox en el CSS. Debe coincidir con el de la hoja de estilos. */
const ANCHO_CAJA_NOMBRE = 36.5;

/** Ancho de .resolucionBox en el CSS. Su geometría no cambia. */
const ANCHO_CAJA_RESOLUCION = 15;

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
/**
 * Banda reservada para el TÍTULO del curso.
 *
 * Medida sobre las dos plantillas: la leyenda "Participó y aprobó el curso
 * denominado" termina en 42,57% del alto (SIDCA) / 41,80% (ITM) y la línea
 * "Modalidad…" empieza en 49,08% / 48,94%. La intersección que sirve para
 * ambas va de 42,6% a 48,9%; descontando un resguardo quedan 84 px de 1414,
 * centrados en 45,76% —de ahí el `top` de .tituloBox—.
 *
 * El bloque crece simétrico desde ese centro (la caja lleva
 * translateY(-50%)), así que con una, dos o tres líneas queda siempre
 * equilibrado dentro de la banda y nunca toca las leyendas.
 *
 * Son las MISMAS constantes que usa certificadoPdfRenderer.ts en el backend:
 * si se cambian acá hay que cambiarlas allá, o el PDF dejará de reproducir lo
 * que se ve en pantalla.
 */
const TITULO_CUERPO_MAX = 2.3; // cqw
const TITULO_CUERPO_MIN = 1.05; // cqw: piso legible para títulos largos
// Sólo aplica al preview móvil; la captura PDF conserva la escala de escritorio.
const TITULO_MOVIL_CUERPO_MAX = 1.55; // cqw
const TITULO_MOVIL_CUERPO_MIN = 0.82; // cqw
const TITULO_INTERLINEA = 1.1;
const TITULO_LINEAS_MAX = 3;
const TITULO_ALTO_MAX = 8.2; // % de alto disponible para el bloque dinámico
const TITULO_ALTO_MIN = 5.2; // conserva el diseño compacto para una línea
const TITULO_DESPLAZAMIENTO_POR_LINEA = 1.8; // % de alto del certificado

/**
 * Ajusta el cuerpo del título midiendo el elemento REAL.
 *
 * Contar caracteres no alcanza: una "M" y una "i" no ocupan lo mismo, y el
 * punto donde el navegador corta por palabras depende del texto concreto. Acá
 * se prueba un cuerpo, se lee el alto que efectivamente ocupó y se baja hasta
 * que entra en la banda sin pasar de tres líneas.
 *
 * Todo se calcula contra el ancho del contenedor, así que el resultado es el
 * mismo en cualquier pantalla: no hay valores atados a una resolución. Un
 * ResizeObserver lo recalcula cuando el preview cambia de tamaño.
 */
const useAjusteTitulo = (titulo, abierto) => {
  const boxRef = useRef(null);
  const textRef = useRef(null);
  const [layout, setLayout] = useState({
    lineas: 1,
    altura: TITULO_ALTO_MIN,
    desplazamiento: 0,
  });

  useLayoutEffect(() => {
    const box = boxRef.current;
    const elemento = textRef.current;
    if (!box || !elemento || !abierto) return undefined;

    // Cada certificado parte de la banda compacta. Así un título de dos o
    // tres líneas del certificado anterior nunca se reutiliza durante la
    // medición del siguiente.
    setLayout({ lineas: 1, altura: TITULO_ALTO_MIN, desplazamiento: 0 });

    const ajustar = () => {
      // offsetParent es el lienzo del certificado: la caja es absoluta y él es
      // el ancestro posicionado.
      const contenedor = box.offsetParent;
      const anchoContenedor = contenedor?.clientWidth || 0;
      if (!anchoContenedor) return;

      // Cada apertura puede reutilizar el mismo nodo del diálogo. Limpiamos
      // el cuerpo anterior antes de medir para que un título largo no deje su
      // tamaño aplicado al siguiente curso.
      elemento.style.fontSize = "";
      elemento.style.lineHeight = String(TITULO_INTERLINEA);

      const unidad = anchoContenedor / 100; // 1cqw en píxeles
      // La altura disponible no depende de la altura anterior de la caja: si
      // la usamos como límite, un título largo queda atrapado en el tamaño
      // aplicado al curso anterior. La banda admite hasta tres renglones y el
      // contenido que sigue se desplaza con la cantidad real de líneas.
      const altoMaximo = contenedor.clientHeight * (TITULO_ALTO_MAX / 100);

      // Los títulos largos necesitan comenzar con un cuerpo más prudente;
      // los cortos conservan el aumento visual. Después la medición real
      // sigue ajustando dentro de la banda disponible.
      const esCapturaPdf = Boolean(elemento.closest("[data-pdf-capture]"));
      const esPreviewMovil =
        !esCapturaPdf &&
        typeof window !== "undefined" &&
        window.matchMedia("(max-width: 767px)").matches;
      const cuerpoMaximo = esPreviewMovil
        ? TITULO_MOVIL_CUERPO_MAX
        : TITULO_CUERPO_MAX;
      const cuerpoMinimo = esPreviewMovil
        ? TITULO_MOVIL_CUERPO_MIN
        : TITULO_CUERPO_MIN;

      let cuerpo = cuerpoMaximo;
      let ultimaMedida = { alto: 0, lineas: 1 };

      // Se mide en píxeles reales para que el resultado sea exacto; el
      // ResizeObserver mantiene la proporción al cambiar el tamaño.
      for (;;) {
        elemento.style.setProperty("font-size", `${cuerpo * unidad}px`, "important");

        elemento.style.lineHeight = String(TITULO_INTERLINEA);
        const alto = elemento.scrollHeight;
        const lineas = Math.max(
          1,
          Math.round(alto / (cuerpo * unidad * TITULO_INTERLINEA))
        );
        ultimaMedida = { alto, lineas };

        if (
          alto <= altoMaximo + 1 &&
          elemento.scrollWidth <= box.clientWidth + 1 &&
          lineas <= TITULO_LINEAS_MAX
        ) {
          break;
        }
        if (cuerpo <= cuerpoMinimo) break;

        cuerpo = Math.max(cuerpoMinimo, cuerpo - 0.05);
      }

      const altura = Math.min(
        TITULO_ALTO_MAX,
        Math.max(
          TITULO_ALTO_MIN,
          ultimaMedida.lineas * 2.1 + 1.4,
          (ultimaMedida.alto / contenedor.clientHeight) * 100 + 1.2
        )
      );
      const desplazamiento = Math.min(
        3.8,
        Math.max(0, (ultimaMedida.lineas - 1) * TITULO_DESPLAZAMIENTO_POR_LINEA)
      );
      setLayout((anterior) =>
        anterior.lineas === ultimaMedida.lineas &&
        anterior.altura === altura &&
        anterior.desplazamiento === desplazamiento
          ? anterior
          : { lineas: ultimaMedida.lineas, altura, desplazamiento }
      );
    };

    const frame = requestAnimationFrame(ajustar);

    const contenedor = box.offsetParent;
    if (!contenedor || typeof ResizeObserver === "undefined") return undefined;

    const observador = new ResizeObserver(ajustar);
    observador.observe(box);

    return () => {
      cancelAnimationFrame(frame);
      observador.disconnect();
    };
  }, [titulo, abierto]);

  return { boxRef, textRef, layout };
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
  consultandoEmision = false,
  emision = null,
  puedeEmitir = true,
  motivoNoEmitir = "",
}) => {
  // El título NO se estima por cantidad de caracteres: se mide el elemento
  // real y se baja el cuerpo hasta que entra en la banda que le deja la
  // plantilla. Ver useAjusteTitulo.
  //
  // Va ANTES del return temprano de abajo: los hooks tienen que ejecutarse en
  // el mismo orden en cada render, así que no pueden quedar detrás de una
  // salida condicional.
  const {
    boxRef: tituloBoxRef,
    textRef: tituloTextoRef,
    layout: tituloLayout,
  } = useAjusteTitulo(configuracion?.titulo || "—", abierto);

  if (!participante || !configuracion) return null;

  // Mientras se está emitiendo se evita el cierre accidental: ni Escape ni
  // click en el fondo ni el botón Cerrar. No bloquea el resto de la app,
  // sólo impide perder de vista el resultado de una operación en curso.
  const manejarCierre = () => {
    if (emitiendo) return;
    onCerrar?.();
  };

  // URL que codifica el QR. Sale TAL CUAL del backend: no se reconstruye ni se
  // concatena nada acá. Sin emisión no hay URL y la caja queda con su
  // placeholder.
  const urlValidacion = String(emision?.urlValidacion || "").trim();

  const botonEmitirDeshabilitado =
    emitiendo || emitido || consultandoEmision || !puedeEmitir;

  let textoBotonEmitir = "Emitir certificado";
  if (emitiendo) textoBotonEmitir = "Emitiendo…";
  else if (emitido) textoBotonEmitir = "Certificado emitido";
  else if (consultandoEmision) textoBotonEmitir = "Verificando emisión…";

  // La plantilla la decide la INSTITUCIÓN, nunca el título, la categoría ni
  // ningún texto del curso.
  //
  // El snapshot del emitido tiene prioridad sobre la configuración actual: un
  // certificado emitido como ITM debe seguir viéndose como ITM aunque después
  // se cambie la institución del curso. El certificado es un documento
  // histórico, no un reflejo de la configuración de hoy.
  const institucionCertificado = normalizarInstitucion(
    emision?.certificado?.institucionCertificado ||
      configuracion?.institucionCertificado
  );

  const fuentePlantilla =
    plantilla?.url || PLANTILLAS[institucionCertificado] || plantillaSidca;

  const autoridades = resolverAutoridades(emision, configuracion);

  const nombre = participante.apellidoNombre || "—";
  const titulo = configuracion.titulo || "—";
  const cargaHoraria = configuracion.cargaHoraria || "—";
  const dias = configuracion.dias || "—";
  const fecha = configuracion.fecha || "—";
  const modalidad = configuracion.modalidad || "—";
  const resolucion = configuracion.resolucion || "—";

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
const cuerpoModalidad = cuerpoUnaLinea(modalidad, 19, 2.35, 1.5);
const cuerpoCarga = cuerpoUnaLinea(cargaHoraria, 23.5, 2.35, 1.5);
const cuerpoFecha = cuerpoUnaLinea(fecha, 21, 2.1, 1.3);

const fsModalidad = `${cuerpoModalidad.toFixed(2)}cqw`;

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

const fsCarga = `${cuerpoCarga.toFixed(2)}cqw`;
const fsFecha = `${cuerpoFecha.toFixed(2)}cqw`;

// Resolución: mismo principio que nombre y días. Conserva un cuerpo legible y,
// si el texto no entra en su caja, se comprime en horizontal en lugar de
// recortarse con elipsis. Una resolución cortada —"RESO-2025-01-CAT-…"— es
// inservible para validar, así que tiene que verse completa.
const fsResolucion = escalarUnaLinea(
  resolucion,
  15,
  2.2,
  1.4
);

const cuerpoResolucion = cuerpoUnaLinea(resolucion, 15, 2.2, 1.4);

const anchoResolucionNecesario =
  (String(resolucion).trim().length || 1) * ANCHO_CAR_NEGRITA * cuerpoResolucion;

// 1 cuando entra cómoda: la mayoría de las resoluciones cortas no se deforman.
const escalaResolucion = Math.min(
  1,
  ANCHO_CAJA_RESOLUCION / anchoResolucionNecesario
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
              ? "Emisión registrada correctamente. El código QR de validación ya está incorporado. La descarga en PDF se incorporará en la siguiente etapa."
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
      <div
        className={`${styles.certificado} ${styles.previewOnly} ${
          institucionCertificado === "itm" ? styles.certificadoItm : ""
        }`}
      >
        <img
          src={fuentePlantilla}
          alt=""
          aria-hidden="true"
          className={styles.plantilla}
        />

        <div
          className={styles.overlay}
          style={{
            "--titulo-desplazamiento": `${tituloLayout.desplazamiento}%`,
          }}
        >
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

          {/* Debajo de "Participó y aprobó el curso denominado".
              Sin .unaLinea ni .dosLineas: envuelve libremente hasta tres
              renglones y el cuerpo lo fija useAjusteTitulo tras medirlo, así
              que no lleva fontSize inline. */}
          <div
            key={`${participante?.usuarioDocId || "participante"}-${titulo}`}
            ref={tituloBoxRef}
            className={styles.tituloBox}
            style={{
              "--titulo-alto": `${tituloLayout.altura}%`,
            }}
          >
            <div ref={tituloTextoRef} className={styles.tituloTexto}>{titulo}</div>
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
            {/* Se comprime en horizontal si hace falta, para mostrarse
                COMPLETA sin recorte y sin mover la caja. */}
            <span
              className={styles.resolucionTexto}
              style={{ transform: `scaleX(${escalaResolucion.toFixed(3)})` }}
            >
              {resolucion}
            </span>
          </div>

          {/* Continuación de "… se expide en San Fernando … a los" */}
          <div
            className={`${styles.caja} ${styles.fechaBox}`}
            style={{ fontSize: fsFecha }}
          >
            {fecha}
          </div>

          {/* Zona inferior: AUTORIDAD 1 (izquierda) · AUTORIDAD 2 (centro) ·
              QR (derecha). Las tres comparten renglón y no se solapan.

              Las cajas arrancan en 20% —y no pegadas al margen— porque la
              plantilla ITM tiene un sello impreso abajo a la izquierda que
              llega hasta el 17% del ancho. Con las mismas coordenadas las dos
              plantillas quedan limpias, sin CSS por institución. */}
          {autoridades.map((autoridad, indice) => {
            // Hasta cuatro renglones, pero sólo los que tienen contenido: una
            // autoridad sin referencia no debe dejar un espacio en blanco
            // debajo del organismo.
            const lineas = lineasAutoridad(autoridad, styles);

            if (!lineas.length) return null;

            return (
              <div
                key={indice}
                className={`${styles.autoridadBox} ${
                  indice === 0 ? styles.autoridad1Box : styles.autoridad2Box
                }`}
              >
                {lineas.map((linea) => (
                  <span
                    key={linea.clase}
                    className={linea.clase}
                    style={{ fontSize: linea.fontSize }}
                  >
                    {linea.texto}
                  </span>
                ))}
              </div>
            );
          })}

          {/* Zona del QR: margen derecho, por debajo de la fecha y a la altura
              del bloque de firma, que está a la izquierda.
              La CAJA no cambia — misma posición y tamaño de siempre. Lo único
              que cambia es su contenido: placeholder mientras no hay emisión,
              QR real en cuanto existe. */}
          <div
            className={`${styles.qrBox} ${
              urlValidacion ? styles.qrBoxEmitido : ""
            }`}
          >
            {urlValidacion ? (
              <span className={styles.qrReal}>
                <QRCode
                  value={urlValidacion}
                  size={256}
                  level="M"
                  bgColor="#FFFFFF"
                  fgColor="#000000"
                  title="Código QR de validación del certificado"
                />
              </span>
            ) : (
              <span className={styles.qrTexto} aria-hidden="true">
                QR
              </span>
            )}
          </div>
        </div>
      </div>
      </div>
    </Dialog>
  );
};

export default CertificadoPreview;
