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

// Firebase (solo lectura igual que MiRegistro.jsx)
import { getFirestore, collection, getDocs, query, where, orderBy } from "firebase/firestore";

// 🔹 Departamentos para filtro de comercios
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

export default function Convenio() {
  // Modales
  const [openComercios, setOpenComercios] = useState(false);
  const [openHoteles, setOpenHoteles] = useState(false);

  // Loading + data
  const [loadingComercios, setLoadingComercios] = useState(false);
  const [loadingHoteles, setLoadingHoteles] = useState(false);
  const [comercios, setComercios] = useState([]);
  const [hoteles, setHoteles] = useState([]);

  // Filtro por departamento (solo comercios)
  const [depSeleccionado, setDepSeleccionado] = useState(null);

  // Firestore
  const db = useMemo(() => getFirestore(), []);
  const novedadesCol = useMemo(() => collection(db, "novedades"), [db]);

  const safeOpen = useCallback((url) => {
    if (!url || url === "false") return;
    window.open(url, "_blank", "noopener,noreferrer");
  }, []);

  // Lectura por categoría (usa índice compuesto categoria+prioridad)
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

  // Abrir Comercios
  const handleOpenComercios = useCallback(async () => {
    setLoadingComercios(true);
    setOpenComercios(true);
    try {
      const rows = await fetchByCategoria("convenio_comercio");
      setComercios(rows);
    } catch (e) {
      console.error(e);
      setComercios([]);
    } finally {
      setLoadingComercios(false);
    }
  }, [fetchByCategoria]);

  // Abrir Hoteles
  const handleOpenHoteles = useCallback(async () => {
    setLoadingHoteles(true);
    setOpenHoteles(true);
    try {
      const rows = await fetchByCategoria("convenio_hoteles");
      setHoteles(rows);
    } catch (e) {
      console.error(e);
      setHoteles([]);
    } finally {
      setLoadingHoteles(false);
    }
  }, [fetchByCategoria]);

  // Opciones de dropdown para departamentos
  const deptOptions = useMemo(
    () => Object.values(departamentos).map((label) => ({ label, value: label })),
    []
  );

  // Aplicar filtro de departamento sobre comercios
  const comerciosFiltrados = useMemo(() => {
    if (!depSeleccionado) return comercios;
    return comercios.filter(
      (c) =>
        (c.departamento || "").toString().toLowerCase() ===
        depSeleccionado.toString().toLowerCase()
    );
  }, [comercios, depSeleccionado]);

  // Card de ítem (válido para ambas categorías)
  const CardItem = ({ item }) => {
    const { titulo, descripcion, imagen, link, departamento, estado } = item || {};

    const header = (
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span className={styles.cardTitle}>{titulo || "Sin título"}</span>
        {estado && estado !== "undefined" ? <Tag value={estado} severity="info" rounded /> : null}
      </div>
    );

    const footer = (
      <div>
        {link && link !== "false" && (
          <Button
            label="Abrir enlace"
            icon="pi pi-external-link"
            className="p-button-sm p-button-info"
            onClick={() => safeOpen(link)}
          />
        )}
        {/* ✅ Se eliminó el botón Descargar en ambas categorías */}
      </div>
    );

    return (
      <Card header={header} footer={footer}>
        <div className={styles.cardRow}>
          <div>
            {imagen ? (
              <img src={imagen} alt={titulo || "imagen"} className={styles.imgThumb} />
            ) : (
              <div
                className={styles.imgThumb}
                style={{ display: "grid", placeItems: "center", color: "#888", fontSize: 12 }}
              >
                sin imagen
              </div>
            )}
          </div>
          <div>
            {descripcion && (
              <div className={styles.info}>
                <strong>Descripción:</strong> {descripcion}
              </div>
            )}
            {departamento && (
              <div className={styles.info}>
                <strong>Departamento:</strong> {departamento}
              </div>
            )}
            {estado && estado !== "undefined" && (
              <div className={styles.info}>
                <strong>Estado:</strong> {estado}
              </div>
            )}
          </div>
        </div>
      </Card>
    );
  };

  return (
    <div className={styles.page}>
      <div className={styles.container}>
        {/* Título */}
        <div className={styles.titleBox}>
          <h1 className={styles.title}>Red de Convenios</h1>
        </div>

        {/* Intro */}
        <div className={styles.intro}>
          El Sindicato de Docentes de Catamarca ha firmado convenios con diversas empresas de la ciudad y
          hoteles en distintas provincias del país, ofreciendo a sus afiliados descuentos especiales y condiciones
          preferenciales. Presentando la credencial digital a través de la aplicación, los afiliados podrán acceder
          fácilmente a estos beneficios. ¡Disfrutá de ventajas exclusivas para afiliados!
        </div>

        {/* Carrusel */}
        <div className={styles.carouselWrap}>
          <div className={styles.carousel}>
            <img src={convenio1} className={styles.img} alt="Convenio 1" />
            <img src={convenio2} className={styles.img} alt="Convenio 2" />
            <img src={convenio3} className={styles.img} alt="Convenio 3" />
            <img src={convenio4} className={styles.img} alt="Convenio 4" />
          </div>
        </div>

        {/* Botones */}
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

        {/* Modal Comercios (con filtro por departamento) */}
        <Dialog
          header="Lista de Comercios Adheridos"
          visible={openComercios}
          style={{ width: "95%", maxWidth: 900 }}
          modal
          onHide={() => setOpenComercios(false)}
          dismissableMask
        >
          <div className={styles.dialogBody}>
            {/* Filtro por Departamento */}
            <div style={{ display: "flex", gap: 12, alignItems: "center", marginBottom: 12 }}>
              <span><strong>Departamento:</strong></span>
              <Dropdown
                value={depSeleccionado}
                options={deptOptions}
                onChange={(e) => setDepSeleccionado(e.value)}
                placeholder="Todos"
                showClear
                filter
                style={{ minWidth: 260 }}
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
            ) : (comerciosFiltrados.length ? (
              <div className={styles.list}>
                {comerciosFiltrados.map((item) => (
                  <CardItem key={item.id} item={item} />
                ))}
              </div>
            ) : (
              <div className={styles.emptyBox}>
                <i className="pi pi-info-circle" />
                <span>No se encontraron resultados.</span>
              </div>
            ))}
          </div>
        </Dialog>

        {/* Modal Hoteles (sin botón descargar) */}
        <Dialog
          header="Convenio Interprovincial Hoteleros"
          visible={openHoteles}
          style={{ width: "95%", maxWidth: 900 }}
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
                  <CardItem key={item.id} item={item} />
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

