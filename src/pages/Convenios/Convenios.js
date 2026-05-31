// src/pages/Convenios/Convenios.js
import React, { useCallback, useMemo, useState } from "react";

// PrimeReact
import { Button } from "primereact/button";
import { Dialog } from "primereact/dialog";
import { Card } from "primereact/card";
import { ProgressSpinner } from "primereact/progressspinner";
import { Tag } from "primereact/tag";
import { Dropdown } from "primereact/dropdown";

import styles from "./convenios.module.css";

// Imágenes locales del carrusel
import convenio1 from "../../assets/convenio/convenio1.jpg";
import convenio2 from "../../assets/convenio/convenio2.jpg";
import convenio3 from "../../assets/convenio/convenio3.jpg";
import convenio4 from "../../assets/convenio/convenio4.jpg";

// Firebase
import {
  getFirestore,
  collection,
  getDocs,
  query,
  where,
  orderBy,
} from "firebase/firestore";

// Departamentos para filtro de comercios
export const departamentos = {
  AMBATO: "Ambato",
  ANCASTI: "Ancasti",
  ANDALGALA: "Andalgalá",
  ANFOGASTA: "Antofagasta de la Sierra",
  BELEN: "Belén",
  CAPAYAN: "Capayán",
  CAPITAL: "Capital",
  EL_ALTO: "El Alto",
  FRAY: "Fray Mamerto Esquiú",
  LA_PAZ: "La Paz",
  PACLIN: "Paclín",
  POMAN: "Pomán",
  SANTA_MARIA: "Santa María",
  SANTA_ROSA: "Santa Rosa",
  TINOGASTA: "Tinogasta",
  VALLE_VIEJO: "Valle Viejo",
};

const esSoloIcono = (linea = "") => {
  const texto = linea.replace(/\s/g, "");
  return [
    "💵",
    "⚠️",
    "⚠",
    "🏪",
    "📌",
    "⏰",
    "🚚",
    "🌐",
    "📍",
    "📞",
    "📖",
    "📋",
    "📅",
    "➡️",
    "⏳",
    "📲",
    "📝",
    "🧾",
    "🧳",
    "✳️",
    "💰",
    "🔍",
    "🚨",
    "1️⃣",
    "2️⃣",
    "3️⃣",
  ].includes(texto);
};

const limpiarLineas = (texto) => {
  return texto
    .split("\n")
    .map((linea) => linea.replace(/\s+/g, " ").trim())
    .filter(Boolean)
    .filter((linea) => !esSoloIcono(linea));
};

/**
 * COMERCIOS
 * Los deja en bloques lógicos, pero para mostrarlos dentro de UN SOLO CUADRO.
 */
const prepararDescripcionComercio = (descripcion) => {
  if (!descripcion) return [];

  const textoOriginal = String(descripcion)
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .replace(/\s+/g, " ")
    .trim();

  if (!textoOriginal) return [];

  const textoOrdenado = textoOriginal
    .replace(/\s+(💵\s*Efectivo)/gi, "\n$1")
    .replace(/\s+(Efectivo\s*\/\s*QR)/gi, "\n💵 $1")
    .replace(/\s+(⚠️\s*Este beneficio)/gi, "\n$1")
    .replace(/\s+(Este beneficio)/gi, "\n⚠️ $1")
    .replace(/\s+(🏪\s*Sucursales)/gi, "\n$1")
    .replace(/\s+(Sucursales\s+[^:]+:)/gi, "\n🏪 $1")
    .replace(/\s+(📌\s*24\s*hs)/gi, "\n$1")
    .replace(/\s+(24\s*hs\s*\+\s*Env[ií]os)/gi, "\n📌 $1")
    .replace(/\s+(⏰\s*Con horarios)/gi, "\n$1")
    .replace(/\s+(Con horarios extendidos:)/gi, "\n⏰ $1")
    .replace(/\s+(🚚\s*¡?Consult[aá])/gi, "\n$1")
    .replace(/\s+(¡?Consult[aá])/gi, "\n🚚 $1")
    .replace(/\s+(🌐\s*M[aá]s info:)/gi, "\n$1")
    .replace(/\s+(M[aá]s info:)/gi, "\n🌐 $1")
    .replace(/\s+[–-]\s+(?=[A-ZÁÉÍÓÚÑ ]{3,35}:)/g, "\n");

  return limpiarLineas(textoOrdenado);
};

/**
 * HOTELES
 * Separa por secciones importantes para que quede prolijo,
 * pero también dentro de UN SOLO CUADRO.
 */
const prepararDescripcionHotel = (descripcion) => {
  if (!descripcion) return [];

  const textoOriginal = String(descripcion)
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .replace(/\s+/g, " ")
    .trim();

  if (!textoOriginal) return [];

  const textoOrdenado = textoOriginal
    .replace(/\s+(📌\s*INSTRUCTIVO)/gi, "\n$1")
    .replace(/\s+(INSTRUCTIVO\s+PARA)/gi, "\n$1")
    .replace(/\s+(📖\s*Este instructivo)/gi, "\n$1")
    .replace(/\s+(Este instructivo)/gi, "\n📖 $1")
    .replace(/\s+(📋\s*REQUISITOS)/gi, "\n$1")
    .replace(/\s+(REQUISITOS\s+Y\s+CONDICIONES)/gi, "\n📋 $1")
    .replace(/\s+(📅\s*Plazo)/gi, "\n$1")
    .replace(/\s+(Plazo\s+de\s+Anticipaci[oó]n)/gi, "\n📅 $1")
    .replace(/\s+(➡️\s*Las reservas)/gi, "\n$1")
    .replace(/\s+(Las reservas)/gi, "\n➡️ $1")
    .replace(/\s+(📌\s*De lunes)/gi, "\n$1")
    .replace(/\s+(De lunes a viernes)/gi, "\n📌 $1")
    .replace(/\s+(Mañana:)/gi, "\n$1")
    .replace(/\s+(Tarde:)/gi, "\n$1")
    .replace(/\s+(➡️\s*Confirmaci[oó]n)/gi, "\n$1")
    .replace(/\s+(Confirmaci[oó]n\s+de\s+reserva)/gi, "\n➡️ $1")
    .replace(/\s+(⏳\s*Las solicitudes)/gi, "\n$1")
    .replace(/\s+(Las solicitudes)/gi, "\n⏳ $1")
    .replace(/\s+(📲\s*Medio)/gi, "\n$1")
    .replace(/\s+(Medio\s+de\s+Reserva)/gi, "\n📲 $1")
    .replace(/\s+(📝\s*Reserva)/gi, "\n$1")
    .replace(/\s+(Reserva:\s*)/gi, "\n📝 $1")
    .replace(/\s+(🧾\s*DATOS)/gi, "\n$1")
    .replace(/\s+(DATOS\s+SOLICITADOS)/gi, "\n🧾 $1")
    .replace(/\s+(1️⃣\s*Afiliado)/gi, "\n$1")
    .replace(/\s+(2️⃣\s*Acompañantes)/gi, "\n$1")
    .replace(/\s+(3️⃣\s*Fechas)/gi, "\n$1")
    .replace(/\s+(🧳\s*PROCEDIMIENTO)/gi, "\n$1")
    .replace(/\s+(PROCEDIMIENTO\s+POSTERIOR)/gi, "\n🧳 $1")
    .replace(/\s+(✳️\s*Pago)/gi, "\n$1")
    .replace(/\s+(Pago\s+anticipado)/gi, "\n✳️ $1")
    .replace(/\s+(💰\s*Información)/gi, "\n$1")
    .replace(/\s+(Información\s+adicional)/gi, "\n💰 $1")
    .replace(/\s+(🔍\s*Fines)/gi, "\n$1")
    .replace(/\s+(Fines\s+de\s+Semana)/gi, "\n🔍 $1")
    .replace(/\s+(🚨\s*IMPORTANTE)/gi, "\n$1")
    .replace(/\s+(IMPORTANTE)/gi, "\n🚨 $1")
    .replace(/\s+(📌\s*Recuerde)/gi, "\n$1")
    .replace(/\s+(Recuerde:)/gi, "\n📌 $1");

  return limpiarLineas(textoOrdenado);
};

const esLineaComercioDestacada = (linea) => {
  const texto = (linea || "").toUpperCase();

  return (
    texto.includes("SUCURSALES") ||
    texto.startsWith("COLÓN:") ||
    texto.startsWith("COLON:") ||
    texto.startsWith("VALLE VIEJO:") ||
    texto.startsWith("NORTE:") ||
    texto.startsWith("DEL PARQUE:") ||
    texto.startsWith("RIVADAVIA:") ||
    texto.startsWith("SALTA:") ||
    texto.startsWith("ESQUINA EXPRESS:") ||
    texto.startsWith("CATEDRAL:") ||
    texto.startsWith("MISIONES:") ||
    texto.startsWith("UNIVERSITARIA:") ||
    texto.startsWith("MATERNIDAD:") ||
    texto.startsWith("CHOYA:") ||
    texto.startsWith("ILIA:") ||
    texto.startsWith("LAS MIL:")
  );
};

const esLineaHotelDestacada = (linea) => {
  const texto = (linea || "").toUpperCase();

  return (
    texto.includes("INSTRUCTIVO") ||
    texto.includes("REQUISITOS") ||
    texto.includes("DATOS SOLICITADOS") ||
    texto.includes("PROCEDIMIENTO") ||
    texto.includes("IMPORTANTE") ||
    texto.includes("RECUERDE")
  );
};

const renderizarLineaConEtiqueta = (linea) => {
  const indiceDosPuntos = linea.indexOf(":");

  if (indiceDosPuntos > 0 && indiceDosPuntos <= 60) {
    const etiqueta = linea.slice(0, indiceDosPuntos + 1);
    const contenido = linea.slice(indiceDosPuntos + 1).trim();

    return (
      <>
        <strong>{etiqueta}</strong>
        {contenido ? ` ${contenido}` : ""}
      </>
    );
  }

  return linea;
};

export default function Convenio() {
  const [openComercios, setOpenComercios] = useState(false);
  const [openHoteles, setOpenHoteles] = useState(false);

  const [loadingComercios, setLoadingComercios] = useState(false);
  const [loadingHoteles, setLoadingHoteles] = useState(false);
  const [comercios, setComercios] = useState([]);
  const [hoteles, setHoteles] = useState([]);

  const [depSeleccionado, setDepSeleccionado] = useState(null);

  const db = useMemo(() => getFirestore(), []);
  const novedadesCol = useMemo(() => collection(db, "novedades"), [db]);

  const safeOpen = useCallback((url) => {
    if (!url || url === "false") return;
    window.open(url, "_blank", "noopener,noreferrer");
  }, []);

  const fetchByCategoria = useCallback(
    async (categoria) => {
      const q = query(
        novedadesCol,
        where("categoria", "==", categoria),
        orderBy("prioridad", "asc")
      );

      const snap = await getDocs(q);
      return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    },
    [novedadesCol]
  );

  const handleOpenComercios = useCallback(async () => {
    setLoadingComercios(true);
    setOpenComercios(true);

    try {
      const rows = await fetchByCategoria("convenio_comercio");
      setComercios(rows);
    } catch (error) {
      console.error(error);
      setComercios([]);
    } finally {
      setLoadingComercios(false);
    }
  }, [fetchByCategoria]);

  const handleOpenHoteles = useCallback(async () => {
    setLoadingHoteles(true);
    setOpenHoteles(true);

    try {
      const rows = await fetchByCategoria("convenio_hoteles");
      setHoteles(rows);
    } catch (error) {
      console.error(error);
      setHoteles([]);
    } finally {
      setLoadingHoteles(false);
    }
  }, [fetchByCategoria]);

  const deptOptions = useMemo(
    () =>
      Object.values(departamentos).map((label) => ({
        label,
        value: label,
      })),
    []
  );

  const comerciosFiltrados = useMemo(() => {
    if (!depSeleccionado) return comercios;

    return comercios.filter(
      (c) =>
        (c.departamento || "").toString().toLowerCase() ===
        depSeleccionado.toString().toLowerCase()
    );
  }, [comercios, depSeleccionado]);

  const CardItem = ({ item, tipo = "hotel" }) => {
    const { titulo, descripcion, imagen, link, departamento, estado } =
      item || {};

    const esComercio = tipo === "comercio";

    const descripcionLineas = esComercio
      ? prepararDescripcionComercio(descripcion)
      : prepararDescripcionHotel(descripcion);

    const header = (
      <div className={styles.cardHeader}>
        <span className={styles.cardTitle}>{titulo || "Sin título"}</span>

        {estado && estado !== "undefined" ? (
          <Tag value={estado} severity="info" rounded />
        ) : null}
      </div>
    );

    const footer =
      link && link !== "false" ? (
        <div className={styles.cardFooter}>
          <Button
            label="Abrir enlace"
            icon="pi pi-external-link"
            className="p-button-sm p-button-info"
            onClick={() => safeOpen(link)}
          />
        </div>
      ) : null;

    return (
      <Card header={header} footer={footer} className={styles.itemCard}>
        <div className={styles.cardRow}>
          <div className={styles.imageBox}>
            {imagen ? (
              <img
                src={imagen}
                alt={titulo || "imagen"}
                className={styles.imgThumb}
              />
            ) : (
              <div className={styles.imgThumbEmpty}>sin imagen</div>
            )}
          </div>

          <div className={styles.cardContent}>
            {descripcionLineas.length > 0 && (
              <div
                className={`${styles.unifiedInfoBox} ${
                  esComercio ? styles.comercioUnifiedBox : styles.hotelUnifiedBox
                }`}
              >
                {descripcionLineas.map((linea, index) => {
                  const destacada = esComercio
                    ? esLineaComercioDestacada(linea)
                    : esLineaHotelDestacada(linea);

                  return (
                    <div
                      key={`${linea}-${index}`}
                      className={`${styles.infoRow} ${
                        index === 0 ? styles.infoRowPrimary : ""
                      } ${destacada ? styles.infoRowHighlight : ""}`}
                    >
                      <p className={styles.infoText}>
                        {renderizarLineaConEtiqueta(linea)}
                      </p>
                    </div>
                  );
                })}
              </div>
            )}

            <div className={styles.metaBox}>
              {departamento && (
                <div className={styles.metaItem}>
                  <i className="pi pi-map-marker" />
                  <span>
                    <strong>Departamento:</strong> {departamento}
                  </span>
                </div>
              )}

              {estado && estado !== "undefined" && !esComercio && (
                <div className={styles.metaItem}>
                  <i className="pi pi-info-circle" />
                  <span>
                    <strong>Estado:</strong> {estado}
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>
      </Card>
    );
  };

  return (
    <div className={styles.page}>
      <div className={styles.container}>
        <div className={styles.titleBox}>
          <h1 className={styles.title}>Red de Convenios</h1>
        </div>

        <div className={styles.intro}>
          El Sindicato de Docentes de Catamarca ha firmado convenios con
          diversas empresas de la ciudad y hoteles en distintas provincias del
          país, ofreciendo a sus afiliados descuentos especiales y condiciones
          preferenciales. Presentando la credencial digital a través de la
          aplicación, los afiliados podrán acceder fácilmente a estos beneficios.
          ¡Disfrutá de ventajas exclusivas para afiliados!
        </div>

        <div className={styles.carouselWrap}>
          <div className={styles.carousel}>
            <img src={convenio1} className={styles.img} alt="Convenio 1" />
            <img src={convenio2} className={styles.img} alt="Convenio 2" />
            <img src={convenio3} className={styles.img} alt="Convenio 3" />
            <img src={convenio4} className={styles.img} alt="Convenio 4" />
          </div>
        </div>

        <div className={styles.buttons}>
          <Button
            label="Lista de Comercios Adheridos"
            icon="pi pi-shopping-bag"
            className="p-button-warning p-button-lg"
            onClick={handleOpenComercios}
          />

          <Button
            label="Convenio Interprovincial Hoteleros"
            icon="pi pi-building"
            className="p-button-info p-button-lg"
            onClick={handleOpenHoteles}
          />
        </div>

        <Dialog
          header="Lista de Comercios Adheridos"
          visible={openComercios}
          style={{ width: "95%", maxWidth: 1100 }}
          className={styles.dialog}
          modal
          onHide={() => setOpenComercios(false)}
          dismissableMask
        >
          <div className={styles.dialogBody}>
            <div className={styles.filterBox}>
              <span className={styles.filterLabel}>Departamento:</span>

              <Dropdown
                value={depSeleccionado}
                options={deptOptions}
                onChange={(e) => setDepSeleccionado(e.value)}
                placeholder="Todos"
                showClear
                filter
                className={styles.departmentDropdown}
              />

              {depSeleccionado && (
                <Button
                  label="Limpiar"
                  icon="pi pi-times"
                  className="p-button-text"
                  onClick={() => setDepSeleccionado(null)}
                />
              )}
            </div>

            {loadingComercios ? (
              <div className={styles.spinnerBox}>
                <ProgressSpinner />
                <span>Cargando…</span>
              </div>
            ) : comerciosFiltrados.length ? (
              <div className={styles.list}>
                {comerciosFiltrados.map((item) => (
                  <CardItem key={item.id} item={item} tipo="comercio" />
                ))}
              </div>
            ) : (
              <div className={styles.emptyBox}>
                <i className="pi pi-info-circle" />
                <span>No se encontraron resultados.</span>
              </div>
            )}
          </div>
        </Dialog>

        <Dialog
          header="Convenio Interprovincial Hoteleros"
          visible={openHoteles}
          style={{ width: "95%", maxWidth: 980 }}
          className={styles.dialog}
          modal
          onHide={() => setOpenHoteles(false)}
          dismissableMask
        >
          <div className={styles.dialogBody}>
            {loadingHoteles ? (
              <div className={styles.spinnerBox}>
                <ProgressSpinner />
                <span>Cargando…</span>
              </div>
            ) : hoteles.length ? (
              <div className={styles.list}>
                {hoteles.map((item) => (
                  <CardItem key={item.id} item={item} tipo="hotel" />
                ))}
              </div>
            ) : (
              <div className={styles.emptyBox}>
                <i className="pi pi-info-circle" />
                <span>No se encontraron resultados.</span>
              </div>
            )}
          </div>
        </Dialog>
      </div>
    </div>
  );
}