import React, { useCallback, useState } from "react";

// PrimeReact
import { Button } from "primereact/button";
import { Dialog } from "primereact/dialog";
import { Card } from "primereact/card";
import { ProgressSpinner } from "primereact/progressspinner";
import { Tag } from "primereact/tag";

import styles from "./convenios.module.css";

/* ✅ IMPORTA TUS IMÁGENES DESDE src/assests/convenio */
import convenio1 from "../../assets/convenio/convenio1.jpg";
import convenio2 from "../../assets/convenio/convenio2.jpg";
import convenio3 from "../../assets/convenio/convenio3.jpg";
import convenio4 from "../../assets/convenio/convenio4.jpg";

/* Mock local (seguirá funcionando sin Firebase) */
const MOCK_COMERCIOS = [
  {
    categoria: "predio",
    nombre: "Librería San Martín",
    rubro: "Librería",
    descuento: "15% presentando credencial",
    telefono: "3834-123456",
    direccion: "San Martín 123, SFVC",
    link: "https://maps.google.com/?q=San+Mart%C3%ADn+123+Catamarca",
    img: "",
  },
  {
    categoria: "predio",
    nombre: "Indumentaria Centro",
    rubro: "Ropa",
    descuento: "10% en efectivo",
    telefono: "3834-987654",
    direccion: "Rivadavia 456, SFVC",
    link: "",
    img: "",
  },
];

const MOCK_HOTELES = [
  {
    categoria: "casa",
    nombre: "Hotel Norte",
    rubro: "Hotel",
    descuento: "20% temporada baja",
    telefono: "011-5555-5555",
    direccion: "Av. Siempre Viva 742, Salta",
    link: "https://sitio-hotel-norte.example.com",
    img: "",
  },
];

export default function Convenio() {
  const [openComercios, setOpenComercios] = useState(false);
  const [openHoteles, setOpenHoteles] = useState(false);

  const [loadingComercios, setLoadingComercios] = useState(false);
  const [loadingHoteles, setLoadingHoteles] = useState(false);
  const [comercios, setComercios] = useState([]);
  const [hoteles, setHoteles] = useState([]);

  const handleOpenComercios = useCallback(() => {
    setLoadingComercios(true);
    setOpenComercios(true);
    setTimeout(() => {
      setComercios(MOCK_COMERCIOS);
      setLoadingComercios(false);
    }, 400);
  }, []);

  const handleOpenHoteles = useCallback(() => {
    setLoadingHoteles(true);
    setOpenHoteles(true);
    setTimeout(() => {
      setHoteles(MOCK_HOTELES);
      setLoadingHoteles(false);
    }, 400);
  }, []);

  const safeOpen = useCallback((url) => {
    if (!url) return;
    window.open(url, "_blank", "noopener,noreferrer");
  }, []);

  const CardItem = ({ item }) => {
    const { nombre, rubro, descuento, telefono, direccion, link, img } = item || {};

    const header = (
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span className={styles.cardTitle}>{nombre || "Sin nombre"}</span>
        {rubro ? <Tag value={rubro} severity="info" rounded /> : null}
      </div>
    );

    const footer = (
      <div>
        {link ? (
          <Button
            label="Abrir enlace"
            icon="pi pi-external-link"
            className="p-button-sm p-button-info"
            onClick={() => safeOpen(link)}
          />
        ) : null}
      </div>
    );

    return (
      <Card header={header} footer={footer}>
        <div className={styles.cardRow}>
          <div>
            {img ? (
              <img src={img} alt={nombre || "imagen"} className={styles.imgThumb} />
            ) : (
              <div className={styles.imgThumb} style={{ display: "grid", placeItems: "center", color: "#888", fontSize: 12 }}>
                sin img
              </div>
            )}
          </div>
          <div>
            {descuento && <div className={styles.info}><strong>Descuento:</strong> {descuento}</div>}
            {direccion && <div className={styles.info}><strong>Dirección:</strong> {direccion}</div>}
            {telefono && <div className={styles.info}><strong>Teléfono:</strong> {telefono}</div>}
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
          El Sindicato de Docentes de Catamarca ha firmado convenios con diversas empresas de la ciudad y
          hoteles en distintas provincias del país, ofreciendo a sus afiliados descuentos especiales y condiciones
          preferenciales. Presentando la credencial digital a través de la aplicación, los afiliados podrán acceder
          fácilmente a estos beneficios. ¡Disfrutá de ventajas exclusivas para afiliados!
        </div>

        {/* Carrusel con TUS imágenes locales */}
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

        {/* Modal Comercios */}
        <Dialog
          header="Lista de Comercios Adheridos"
          visible={openComercios}
          style={{ width: "95%", maxWidth: 800 }}
          modal
          onHide={() => setOpenComercios(false)}
          dismissableMask
        >
          <div className={styles.dialogBody}>
            {loadingComercios ? (
              <div className={styles.spinnerBox}>
                <ProgressSpinner />
                <span>Cargando…</span>
              </div>
            ) : comercios?.length ? (
              <div className={styles.list}>
                {comercios.map((item, idx) => (
                  <CardItem key={idx} item={item} />
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

        {/* Modal Hoteles */}
        <Dialog
          header="Convenio Interprovincial Hoteleros"
          visible={openHoteles}
          style={{ width: "95%", maxWidth: 800 }}
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
            ) : hoteles?.length ? (
              <div className={styles.list}>
                {hoteles.map((item, idx) => (
                  <CardItem key={idx} item={item} />
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
