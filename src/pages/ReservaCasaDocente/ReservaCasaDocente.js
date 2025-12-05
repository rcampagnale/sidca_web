import React, { useState, useEffect } from "react";
import styles from "./ReservaCasaDocente.module.css";

// Firebase reservas (sidcareservas)
import { dbReservas } from "../../firebase/firebaseReservas";

import {
  collection,
  getDocs,
  query,
  orderBy,
} from "firebase/firestore";

// Imagen de portada (hero)
import banner from "../../assets/reserva-casa-docente/banner.jpg";

// Imágenes del carrusel general
import casa01 from "../../assets/reserva-casa-docente/casa01.jpg";
import casa02 from "../../assets/reserva-casa-docente/casa02.jpg";
import casa03 from "../../assets/reserva-casa-docente/casa03.jpg";
import casa04 from "../../assets/reserva-casa-docente/casa04.jpg";
import casa05 from "../../assets/reserva-casa-docente/casa05.jpg";
import casa06 from "../../assets/reserva-casa-docente/casa06.jpg";
import casa07 from "../../assets/reserva-casa-docente/casa07.jpg";
import casa08 from "../../assets/reserva-casa-docente/casa08.jpg";
import casa09 from "../../assets/reserva-casa-docente/casa09.jpg";

// Componente nuevo con los modales
import ReservaCasaDocenteModales from "./ReservaCasaDocenteModales";

// Imágenes del carrusel hero
const IMAGENES_CASA = [
  casa01,
  casa02,
  casa03,
  casa04,
  casa05,
  casa06,
  casa07,
  casa08,
  casa09,
];

// Texto fijo del carrusel hero
const DESCRIPCION_CARRUSEL =
  "La Casa del Docente es el anexo de servicios que ofrece SIDCA. Hospedaje, bar y cocina compartida, Salón de Conferencias y Sala de Computación. Más servicios para la docencia. ¡Sumate vos también a sus beneficios!";

// Tipos de habitación (IDs usados en administración)
const TIPOS_HABITACION = [
  { id: "simple", nombre: "Habitación simple", descripcion: "Hasta 1 persona" },
  { id: "doble", nombre: "Habitación doble", descripcion: "Hasta 2 personas" },
  { id: "triple", nombre: "Habitación triple", descripcion: "Hasta 3 personas" },
  {
    id: "cuadruple",
    nombre: "Habitación cuádruple",
    descripcion: "Hasta 4 personas",
  },
  {
    id: "departamento",
    nombre: "Departamento",
    descripcion: "Ideal para grupo familiar",
  },
];

const ReservaCasaDocente = () => {
  const [activeSlide, setActiveSlide] = useState(0);

  // Habitaciones públicas (sidcareservas)
  const [habitaciones, setHabitaciones] = useState([]);
  const [loadingHabitaciones, setLoadingHabitaciones] = useState(true);
  const [errorHabitaciones, setErrorHabitaciones] = useState(null);

  // Índice de foto por tipo de habitación (mini–carrusel por tarjeta)
  const [photoIndexByType, setPhotoIndexByType] = useState({});

  // Estado de los modales
  const [isReservaModalOpen, setIsReservaModalOpen] = useState(false);
  const [tipoSeleccionado, setTipoSeleccionado] = useState(null);
  const [isConsultaModalOpen, setIsConsultaModalOpen] = useState(false);

  /* ======================
   * Efectos
   * ====================== */

  // Carrusel automático hero
  useEffect(() => {
    if (IMAGENES_CASA.length === 0) return;

    const intervalId = setInterval(
      () => setActiveSlide((prev) => (prev + 1) % IMAGENES_CASA.length),
      5000
    );

    return () => clearInterval(intervalId);
  }, []);

  // Cargar habitaciones desde Firestore (sidcareservas)
  useEffect(() => {
    const cargarHabitaciones = async () => {
      try {
        setLoadingHabitaciones(true);
        setErrorHabitaciones(null);

        const colRef = collection(dbReservas, "habitacionesCasaDocente");
        const qHab = query(colRef, orderBy("tipo", "asc"));
        const snapshot = await getDocs(qHab);

        const data = snapshot.docs.map((docSnap) => ({
          id: docSnap.id,
          ...docSnap.data(),
        }));

        setHabitaciones(data);
      } catch (error) {
        console.error(
          "[ReservaCasaDocente] Error al cargar habitaciones públicas:",
          error
        );
        setErrorHabitaciones(
          "Ocurrió un problema al cargar las habitaciones. Intentalo nuevamente más tarde."
        );
      } finally {
        setLoadingHabitaciones(false);
      }
    };

    cargarHabitaciones();
  }, []);

  /* ======================
   * Helpers
   * ====================== */

  const goToSlide = (index) => setActiveSlide(index);
  const currentImage = IMAGENES_CASA[activeSlide];

  const getHabitacionesPorTipo = (tipoId) =>
    habitaciones.filter((h) => h.tipo === tipoId);

  const handleChangePhoto = (tipoId, direction, totalImages) => {
    if (totalImages <= 1) return;
    setPhotoIndexByType((prev) => {
      const current = prev[tipoId] ?? 0;
      let next = current + direction;
      if (next < 0) next = totalImages - 1;
      if (next >= totalImages) next = 0;
      return { ...prev, [tipoId]: next };
    });
  };

 // Abrir / cerrar modal de reserva
const handleReservarHabitacion = (tipoId) => {
  setTipoSeleccionado(tipoId);
  setIsReservaModalOpen(true);
};

const cerrarModalReserva = () => {
  setIsReservaModalOpen(false);
};

// Abrir / cerrar modal de consulta
const abrirConsultaModal = () => {
  setIsConsultaModalOpen(true);
};

const cerrarConsultaModal = () => {
  setIsConsultaModalOpen(false);
};


  /* ======================
   * Render
   * ====================== */

  return (
    <div className={styles.page}>
      {/* TÍTULO + BANNER */}
      <section className={styles.heroSection}>
        <h1 className={styles.heroTitle}>BIENVENIDOS A CASA DEL DOCENTE</h1>

        <div className={styles.hero}>
          <img
            src={banner}
            alt="Portada Casa del Docente"
            className={styles.heroImage}
          />
          <div className={styles.heroOverlay} />
        </div>
      </section>

      {/* CARROUSEL: texto fijo + imagen que cambia */}
      <section className={styles.carouselSection}>
        <div className={styles.carouselInner}>
          <div className={styles.carouselText}>
            <h2 className={styles.carouselTitle}>Casa del Docente</h2>
            <p className={styles.carouselDescription}>
              {DESCRIPCION_CARRUSEL}
            </p>
          </div>

          <div className={styles.carouselImageWrapper}>
            <img
              src={currentImage}
              alt="Vista de la Casa del Docente"
              className={styles.carouselImage}
            />
          </div>
        </div>

        <div className={styles.carouselControls}>
          <div className={styles.carouselDots}>
            {IMAGENES_CASA.map((_, index) => (
              <button
                key={index}
                type="button"
                onClick={() => goToSlide(index)}
                className={`${styles.carouselDot} ${
                  index === activeSlide ? styles.carouselDotActive : ""
                }`}
                aria-label={`Ver imagen ${index + 1}`}
              />
            ))}
          </div>
        </div>
      </section>

      {/* SECCIÓN: Tipos de habitación con datos desde Firebase */}
      <section className={styles.roomStylesSection}>
        <div className={styles.roomStylesInner}>
          <h2 className={styles.roomStylesTitle}>ELEGÍ TU ESTILO DE HABITACIÓN</h2>
          <p className={styles.roomStylesSubtitle}>
            Las siguientes opciones se encuentran disponibles en la Casa del
            Docente. Los valores son orientativos y pueden actualizarse.
          </p>

          {/* GRID de habitaciones */}
          <div className={styles.roomStylesGrid}>
            {loadingHabitaciones && (
              <p className={styles.roomStatusText}>
                Cargando habitaciones disponibles...
              </p>
            )}

            {!loadingHabitaciones && errorHabitaciones && (
              <p className={styles.roomStatusTextError}>
                {errorHabitaciones}
              </p>
            )}

            {!loadingHabitaciones &&
              !errorHabitaciones &&
              habitaciones.length === 0 && (
                <p className={styles.roomStatusText}>
                  Próximamente publicaremos las habitaciones disponibles.
                </p>
              )}

            {!loadingHabitaciones &&
              !errorHabitaciones &&
              habitaciones.length > 0 &&
              TIPOS_HABITACION.map((tipo) => {
                const items = getHabitacionesPorTipo(tipo.id);
                if (items.length === 0) return null;

                const images = items
                  .flatMap((h) =>
                    Array.isArray(h.imagenes) ? h.imagenes : []
                  )
                  .filter(Boolean);

                const totalImages = images.length;
                const activeIndex =
                  photoIndexByType[tipo.id] && totalImages > 0
                    ? photoIndexByType[tipo.id] % totalImages
                    : 0;

                const coverImage =
                  totalImages > 0 ? images[activeIndex] : null;

                const precios = items
                  .map((h) => Number(h.precio) || 0)
                  .filter((v) => v > 0);
                const camasMax = Math.max(
                  ...items.map((h) => Number(h.camas) || 0),
                  0
                );
                const banosMax = Math.max(
                  ...items.map((h) => Number(h.banos) || 0),
                  0
                );
                const tieneEstacionamiento = items.some(
                  (h) => h.estacionamiento
                );

                const precioDesde =
                  precios.length > 0 ? Math.min(...precios) : null;

                return (
                  <article key={tipo.id} className={styles.roomCard}>
                    {/* Foto + flechas izquierda / derecha */}
                    {coverImage && (
                      <div className={styles.roomCardImageWrapper}>
                        <img
                          src={coverImage}
                          alt={`Imagen de ${tipo.nombre}`}
                          className={styles.roomCardImage}
                        />

                        {totalImages > 1 && (
                          <div className={styles.roomCardImageControls}>
                            <button
                              type="button"
                              className={styles.roomCardArrow}
                              onClick={() =>
                                handleChangePhoto(
                                  tipo.id,
                                  -1,
                                  totalImages
                                )
                              }
                              aria-label="Foto anterior"
                            >
                              ‹
                            </button>
                            <button
                              type="button"
                              className={styles.roomCardArrow}
                              onClick={() =>
                                handleChangePhoto(
                                  tipo.id,
                                  1,
                                  totalImages
                                )
                              }
                              aria-label="Foto siguiente"
                            >
                              ›
                            </button>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Título */}
                    <h3 className={styles.roomCardTitle}>{tipo.nombre}</h3>

                    {/* Línea separadora + subtítulo */}
                    <div className={styles.roomCardDivider} />
                    <p className={styles.roomCardSubtitle}>Servicios incluidos</p>

                    {/* Servicios con íconos */}
                    <div className={styles.roomCardServices}>
                      <div className={styles.serviceItem}>
                        <span className={styles.serviceIcon}>📶</span>
                        <span className={styles.serviceLabel}>WiFi</span>
                      </div>
                      <div className={styles.serviceItem}>
                        <span className={styles.serviceIcon}>📺</span>
                        <span className={styles.serviceLabel}>TV</span>
                      </div>
                      <div className={styles.serviceItem}>
                        <span className={styles.serviceIcon}>🚿</span>
                        <span className={styles.serviceLabel}>
                          {banosMax > 0 ? `${banosMax} baño(s)` : "Baño privado"}
                        </span>
                      </div>
                      <div className={styles.serviceItem}>
                        <span className={styles.serviceIcon}>🚗</span>
                        <span className={styles.serviceLabel}>
                          {tieneEstacionamiento ? "Cochera" : "Cochera opcional"}
                        </span>
                      </div>
                      <div className={styles.serviceItem}>
                        <span className={styles.serviceIcon}>🛏️</span>
                        <span className={styles.serviceLabel}>
                          {camasMax > 0
                            ? `${camasMax} cama(s)`
                            : "Camas confortables"}
                        </span>
                      </div>
                      <div className={styles.serviceItem}>
                        <span className={styles.serviceIcon}>📍</span>
                        <span className={styles.serviceLabel}>
                          SFVC, Catamarca
                        </span>
                      </div>
                    </div>

                    {precioDesde !== null && (
                      <p className={styles.roomCardPrice}>
                        Desde <span>${precioDesde}</span> por noche
                      </p>
                    )}

                    {/* Botón para abrir el almanaque */}
                    <button
                      type="button"
                      className={styles.roomCardReserveButton}
                      onClick={() => handleReservarHabitacion(tipo.id)}
                    >
                      Reservar una habitación
                    </button>
                  </article>
                );
              })}
          </div>

          {/* 🔽 Bloque de consulta de reserva, debajo del grid */}
          <div className={styles.consultaReservaSection}>
            <p className={styles.consultaReservaText}>
              ¿Ya hiciste una reserva? Podés consultar el estado ingresando tu DNI.
            </p>
            <button
              type="button"
              className={`${styles.roomCardReserveButton} ${styles.consultaReservaButton}`}
              onClick={abrirConsultaModal}
            >
              Consultar mi reserva
            </button>
          </div>
        </div>
      </section>

      {/* 🔹 Modales separados en otro archivo */}
      <ReservaCasaDocenteModales
        isReservaModalOpen={isReservaModalOpen}
  onCloseReserva={cerrarModalReserva}
  tipoSeleccionado={tipoSeleccionado}
  habitaciones={habitaciones}
  isConsultaModalOpen={isConsultaModalOpen}
  onCloseConsulta={cerrarConsultaModal}
  TIPOS_HABITACION={TIPOS_HABITACION}
      />
    </div>
  );
};

export default ReservaCasaDocente;
