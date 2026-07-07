import React, { useState, useEffect } from "react";
import styles from "./ReservaCasaDocente.module.css";

import { dbReservas } from "../../firebase/firebaseReservas";
import { collection, getDocs, query, orderBy } from "firebase/firestore";

import banner from "../../assets/reserva-casa-docente/banner.jpg";
import casa01 from "../../assets/reserva-casa-docente/casa01.jpg";
import casa02 from "../../assets/reserva-casa-docente/casa02.jpg";
import casa03 from "../../assets/reserva-casa-docente/casa03.jpg";
import casa04 from "../../assets/reserva-casa-docente/casa04.jpg";
import casa05 from "../../assets/reserva-casa-docente/casa05.jpg";
import casa06 from "../../assets/reserva-casa-docente/casa06.jpg";
import casa07 from "../../assets/reserva-casa-docente/casa07.jpg";
import casa08 from "../../assets/reserva-casa-docente/casa08.jpg";
import casa09 from "../../assets/reserva-casa-docente/casa09.jpg";

import ReservaCasaDocenteModales from "./ReservaCasaDocenteModales";

const IMAGENES_CASA = [
  casa01, casa02, casa03, casa04, casa05,
  casa06, casa07, casa08, casa09,
];

const DESCRIPCION =
  "La Casa del Docente es el anexo de servicios que ofrece SIDCA. Hospedaje, bar y cocina compartida, Salón de Conferencias y Sala de Computación. Más servicios para la docencia. ¡Sumate vos también a sus beneficios!";

const TIPOS_HABITACION = [
  { id: "simple",       nombre: "Habitación simple",    descripcion: "Hasta 1 persona",       icono: "🛏️", color: "#065f46" },
  { id: "doble",        nombre: "Habitación doble",     descripcion: "Hasta 2 personas",      icono: "🛏️", color: "#1d4ed8" },
  { id: "triple",       nombre: "Habitación triple",    descripcion: "Hasta 3 personas",      icono: "🛏️", color: "#92400e" },
  { id: "cuadruple",    nombre: "Habitación cuádruple", descripcion: "Hasta 4 personas",      icono: "🛏️", color: "#6d28d9" },
  { id: "departamento", nombre: "Departamento",         descripcion: "Ideal para grupo familiar", icono: "🏠", color: "#0e7490" },
];

const ReservaCasaDocente = () => {
  const [habitaciones, setHabitaciones]     = useState([]);
  const [loadingHabitaciones, setLoading]   = useState(true);
  const [errorHabitaciones, setError]       = useState(null);
  const [photoIndexByType, setPhotoIndex]   = useState({});

  const [isReservaModalOpen, setReservaOpen]    = useState(false);
  const [tipoSeleccionado, setTipoSeleccionado] = useState(null);
  const [isConsultaModalOpen, setConsultaOpen]  = useState(false);

  const [galeriaOpen, setGaleriaOpen]   = useState(false);
  const [galeriaIndex, setGaleriaIndex] = useState(0);
  const [galleryOffset, setGalleryOffset] = useState(0);

  useEffect(() => {
    const cargar = async () => {
      try {
        setLoading(true);
        setError(null);
        const colRef = collection(dbReservas, "habitacionesCasaDocente");
        const snap   = await getDocs(query(colRef, orderBy("tipo", "asc")));
        setHabitaciones(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
      } catch (err) {
        console.error("[ReservaCasaDocente]", err);
        setError("No se pudieron cargar las habitaciones. Intentalo nuevamente.");
      } finally {
        setLoading(false);
      }
    };
    cargar();
  }, []);

  const getItemsPorTipo = (tipoId) => habitaciones.filter((h) => h.tipo === tipoId);

  const handleChangePhoto = (tipoId, dir, total) => {
    if (total <= 1) return;
    setPhotoIndex((prev) => {
      const cur  = prev[tipoId] ?? 0;
      let   next = cur + dir;
      if (next < 0)     next = total - 1;
      if (next >= total) next = 0;
      return { ...prev, [tipoId]: next };
    });
  };

  const handleReservar    = (tipoId) => { setTipoSeleccionado(tipoId); setReservaOpen(true); };
  const cerrarReserva     = () => setReservaOpen(false);
  const abrirConsulta     = () => setConsultaOpen(true);
  const cerrarConsulta    = () => setConsultaOpen(false);

  useEffect(() => {
    const timer = setInterval(() => {
      setGalleryOffset((prev) => (prev + 1) % IMAGENES_CASA.length);
    }, 3500);
    return () => clearInterval(timer);
  }, []);

  const abrirGaleria      = (i = 0) => { setGaleriaIndex(i); setGaleriaOpen(true); };
  const cerrarGaleria     = ()      => setGaleriaOpen(false);
  const galeriaAnterior   = ()      => setGaleriaIndex((i) => (i - 1 + IMAGENES_CASA.length) % IMAGENES_CASA.length);
  const galeriaSiguiente  = ()      => setGaleriaIndex((i) => (i + 1) % IMAGENES_CASA.length);

  return (
    <div className={styles.page}>

      {/* ══ HERO split ══ */}
      <section className={styles.heroSection} style={{ backgroundImage: `url(${banner})` }}>

        <div className={styles.heroLeft}>
          <span className={styles.heroBadge}>SiDCa · Servicios para el docente</span>
          <h1 className={styles.heroTitle}>Casa del Docente</h1>
          <p className={styles.heroDesc}>{DESCRIPCION}</p>
          <div className={styles.heroButtons}>
            <button
              type="button"
              className={styles.heroBtnPrimary}
              onClick={() =>
                document.getElementById("habitaciones-section")
                  ?.scrollIntoView({ behavior: "smooth" })
              }
            >
              Hacer una reserva
            </button>
          </div>
        </div>

        {/* Galería 2×2 auto-rotante */}
        <div className={styles.heroGallery}>
          {[0, 1, 2, 3].map((i) => {
            const imgIdx = (i + galleryOffset) % IMAGENES_CASA.length;
            return (
              <div
                key={i}
                className={styles.heroGalleryCell}
                onClick={() => abrirGaleria(imgIdx)}
              >
                <img src={IMAGENES_CASA[imgIdx]} alt={`Casa del Docente ${imgIdx + 1}`} />
                {i === 3 && (
                  <div className={styles.heroGalleryMore}>
                    +{IMAGENES_CASA.length - 4} fotos
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </section>

      {/* ══ BANDA AMARILLA ══ */}
      <div className={styles.bandaAmarilla}>
        <p className={styles.bandaTitle}>Elegí tu habitación</p>
        <p className={styles.bandaSubtitle}>
          {TIPOS_HABITACION.length} tipos disponibles · valores orientativos
        </p>
      </div>

      {/* ══ CARDS HORIZONTALES ══ */}
      <section className={styles.roomSection} id="habitaciones-section">

        {loadingHabitaciones && (
          <p className={styles.roomStatusText}>Cargando habitaciones...</p>
        )}

        {!loadingHabitaciones && errorHabitaciones && (
          <p className={styles.roomStatusTextError}>{errorHabitaciones}</p>
        )}

        {!loadingHabitaciones && !errorHabitaciones && habitaciones.length === 0 && (
          <p className={styles.roomStatusText}>
            Próximamente publicaremos las habitaciones disponibles.
          </p>
        )}

        {!loadingHabitaciones &&
          !errorHabitaciones &&
          habitaciones.length > 0 &&
          TIPOS_HABITACION.map((tipo) => {
            const items = getItemsPorTipo(tipo.id);
            if (items.length === 0) return null;

            const images      = items.flatMap((h) => Array.isArray(h.imagenes) ? h.imagenes : []).filter(Boolean);
            const totalImages = images.length;
            const activeIdx   = (photoIndexByType[tipo.id] ?? 0) % Math.max(totalImages, 1);
            const coverImage  = totalImages > 0 ? images[activeIdx] : null;

            const precios     = items.map((h) => Number(h.precio) || 0).filter((v) => v > 0);
            const precioDesde = precios.length > 0 ? Math.min(...precios) : null;
            const camasMax    = Math.max(...items.map((h) => Number(h.camas)  || 0), 0);
            const banosMax    = Math.max(...items.map((h) => Number(h.banos)  || 0), 0);
            const cochera     = items.some((h) => h.estacionamiento);
            const ubicacion   = items.find((h) => h.ubicacion)?.ubicacion || null;

            return (
              <article key={tipo.id} className={styles.roomCard}>

                {/* Barra de color izquierda */}
                <div
                  className={styles.roomCardBar}
                  style={{ background: tipo.color }}
                />

                {/* Foto / fallback */}
                {coverImage ? (
                  <div className={styles.roomCardImageWrapper}>
                    <img
                      src={coverImage}
                      alt={tipo.nombre}
                      className={styles.roomCardImage}
                      onError={(e) => {
                        e.currentTarget.style.display = "none";
                        const fb = e.currentTarget.parentElement?.querySelector(`.${styles.roomCardFallback}`);
                        if (fb) fb.style.display = "flex";
                      }}
                    />
                    <div
                      className={`${styles.roomCardFallback} ${styles[tipo.id]}`}
                      style={{ display: "none", position: "absolute", inset: 0 }}
                    >
                      <span className={styles.roomCardFallbackIcon}>{tipo.icono}</span>
                      <span className={styles.roomCardFallbackLabel}>{tipo.nombre}</span>
                    </div>
                    {totalImages > 1 && (
                      <div className={styles.roomCardImageControls}>
                        <button
                          type="button"
                          className={styles.roomCardArrow}
                          onClick={() => handleChangePhoto(tipo.id, -1, totalImages)}
                          aria-label="Foto anterior"
                        >‹</button>
                        <button
                          type="button"
                          className={styles.roomCardArrow}
                          onClick={() => handleChangePhoto(tipo.id,  1, totalImages)}
                          aria-label="Foto siguiente"
                        >›</button>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className={`${styles.roomCardFallback} ${styles[tipo.id]}`}>
                    <span className={styles.roomCardFallbackIcon}>{tipo.icono}</span>
                    <span className={styles.roomCardFallbackLabel}>{tipo.nombre}</span>
                  </div>
                )}

                {/* Info + precio + botón */}
                <div className={styles.roomCardBody}>
                  <div className={styles.roomCardInfo}>
                    <h3 className={styles.roomCardTitle}>{tipo.nombre}</h3>
                    <p className={styles.roomCardCapacity}>{tipo.descripcion}</p>
                    <div className={styles.roomCardServices}>
                      <div className={styles.serviceItem}>
                        <span className={styles.serviceIcon}>📶</span>
                        <span className={styles.serviceLabel}>WiFi</span>
                      </div>
                      <div className={styles.serviceItem}>
                        <span className={styles.serviceIcon}>📺</span>
                        <span className={styles.serviceLabel}>TV</span>
                      </div>
                      {banosMax > 0 && (
                        <div className={styles.serviceItem}>
                          <span className={styles.serviceIcon}>🚿</span>
                          <span className={styles.serviceLabel}>{banosMax} baño(s)</span>
                        </div>
                      )}
                      {camasMax > 0 && (
                        <div className={styles.serviceItem}>
                          <span className={styles.serviceIcon}>🛏️</span>
                          <span className={styles.serviceLabel}>{camasMax} cama(s)</span>
                        </div>
                      )}
                      <div className={styles.serviceItem}>
                        <span className={styles.serviceIcon}>🚗</span>
                        <span className={styles.serviceLabel}>
                          {cochera ? "Cochera incluida" : "Sin cochera"}
                        </span>
                      </div>
                      <div className={styles.serviceItem}>
                        <span className={styles.serviceIcon}>📍</span>
                        {ubicacion ? (
                          <a
                            href={ubicacion}
                            target="_blank"
                            rel="noopener noreferrer"
                            className={styles.serviceLink}
                          >
                            Ver en mapa
                          </a>
                        ) : (
                          <span className={styles.serviceLabel}>SFVC, Catamarca</span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className={styles.roomCardRight}>
                    {precioDesde !== null ? (
                      <>
                        <p className={styles.roomCardPriceLabel}>Desde</p>
                        <p className={styles.roomCardPrice}>
                          ${precioDesde.toLocaleString("es-AR")}
                        </p>
                        <p className={styles.roomCardPriceNight}>por noche</p>
                      </>
                    ) : (
                      <p className={styles.roomCardPriceLabel}>Consultar precio</p>
                    )}
                    <button
                      type="button"
                      className={styles.roomCardReserveButton}
                      onClick={() => handleReservar(tipo.id)}
                    >
                      Reservar
                    </button>
                  </div>
                </div>
              </article>
            );
          })}
      </section>

      {/* ══ BLOQUE CONSULTAR ══ */}
      <div className={styles.consultaSection}>
        <p className={styles.consultaText}>
          ¿Ya hiciste una reserva? Podés consultar el estado ingresando tu DNI.
        </p>
        <button
          type="button"
          className={styles.consultaBtn}
          onClick={abrirConsulta}
        >
          Consultar mi reserva
        </button>
      </div>

      {/* ══ GALERÍA OVERLAY ══ */}
      {galeriaOpen && (
        <div className={styles.galleryOverlay} onClick={cerrarGaleria}>
          <button className={styles.galleryOverlayClose} onClick={cerrarGaleria} aria-label="Cerrar">×</button>
          <img
            src={IMAGENES_CASA[galeriaIndex]}
            alt={`Casa del Docente ${galeriaIndex + 1}`}
            className={styles.galleryOverlayImg}
            onClick={(e) => e.stopPropagation()}
          />
          <div className={styles.galleryOverlayControls} onClick={(e) => e.stopPropagation()}>
            <button className={styles.galleryOverlayArrow} onClick={galeriaAnterior}>‹</button>
            <span className={styles.galleryOverlayCounter}>
              {galeriaIndex + 1} / {IMAGENES_CASA.length}
            </span>
            <button className={styles.galleryOverlayArrow} onClick={galeriaSiguiente}>›</button>
          </div>
        </div>
      )}

      {/* ══ MODALES ══ */}
      <ReservaCasaDocenteModales
        isReservaModalOpen={isReservaModalOpen}
        onCloseReserva={cerrarReserva}
        tipoSeleccionado={tipoSeleccionado}
        habitaciones={habitaciones}
        isConsultaModalOpen={isConsultaModalOpen}
        onCloseConsulta={cerrarConsulta}
        TIPOS_HABITACION={TIPOS_HABITACION}
      />
    </div>
  );
};

export default ReservaCasaDocente;
