import React, { useEffect } from "react";
import styles from "./home.module.scss";
import logo from "../../assets/img/somos3.jpg";
import { useDispatch, useSelector } from "react-redux";
import { setUserCuotas } from "../../redux/reducers/cuotas/actions";
import { getNovedades } from "../../redux/reducers/novedades/actions";
import { useLocation } from "react-router-dom";
import Swal from "sweetalert2";
import "./CarouselDemo.scss";
import { Carousel } from "primereact/carousel";
import { Button } from "primereact/button";

const Home = () => {
  const dispatch = useDispatch();
  const cuotas = useSelector((state) => state.cuotas);
  const novedades = useSelector((state) => state.novedades);
  const location = useLocation();

  useEffect(() => {
    dispatch(getNovedades());
  }, [dispatch]);

  useEffect(() => {
    if (location.search) {
      const search = {};

      location.search
        .slice(1)
        .split("&")
        .forEach((param) => {
          const data = param.split("=");
          search[data[0]] = data[1];
        });

      dispatch(setUserCuotas(search));
    }
  }, [location, dispatch]);

  useEffect(() => {
    if (cuotas.setTransaccion === "SUCCESS_SET") {
      Swal.fire({
        title: "Transferencia recibida",
        text: "Se han cargado los datos de su pago.",
        icon: "success",
        confirmButtonText: "Ok",
      });
    } else if (cuotas.setTransaccion === "FAILURE_SET") {
      Swal.fire({
        title: "No se ha guardado la transferencia",
        text: "Si no intentaste hacer un pago de cuota ignora este mensaje.",
        icon: "error",
        confirmButtonText: "Ok",
      });
    }
  }, [cuotas.setTransaccion]);

  const responsiveOptions = [
    {
      breakpoint: "1199px",
      numVisible: 2,
      numScroll: 1,
    },
    {
      breakpoint: "767px",
      numVisible: 1,
      numScroll: 1,
    },
  ];

  const getCat = (novedad) =>
    Array.isArray(novedad?.categoria)
      ? novedad.categoria[0] ?? ""
      : novedad?.categoria ?? "";

  const sortByDateDesc = (arr) =>
    [...arr].sort(
      (a, b) => new Date(b?.fecha || 0) - new Date(a?.fecha || 0)
    );

  const all = (novedades?.novedades || []).filter(Boolean);

  const comercioList = sortByDateDesc(
    all.filter((novedad) => getCat(novedad) === "convenio_comercio")
  );

  const hotelesList = sortByDateDesc(
    all.filter((novedad) => getCat(novedad) === "convenio_hoteles")
  );

  const productTemplate = (item) => {
    if (!item) return null;

    const hasImg = Boolean(item.imagen);

    return (
      <article className="nov-card">
        <header className="nov-card__header">
          <h4 className="nov-card__title">{item.titulo}</h4>
        </header>

        <div className="nov-card__media">
          {hasImg ? (
            <img
              src={item.imagen}
              alt={item.titulo || "Convenio SIDCA"}
              className="nov-card__image"
              loading="lazy"
              onError={(e) => {
                e.currentTarget.style.display = "none";
              }}
            />
          ) : (
            <div className="nov-card__imageFallback">Sin imagen</div>
          )}
        </div>

        {item.descripcion && (
          <p className="nov-card__excerpt">{item.descripcion}</p>
        )}

        <footer className="nov-card__footer">
          <a href="/convenios" className="nov-card__link">
            <Button
              label="Leer más"
              icon="pi pi-arrow-right"
              iconPos="right"
              className="p-button-rounded p-button-sm"
            />
          </a>
        </footer>
      </article>
    );
  };

  const renderCarouselSection = (title, data) => {
    if (!data || data.length === 0) return null;

    return (
      <section className="nov-wrapper">
        <div className="nov-wrapper__header">
          <h1 className={styles.h1}>{title}</h1>
        </div>

        <div className="carousel-demo">
          <div className="carousel-card">
            <Carousel
              value={data}
              itemTemplate={productTemplate}
              numVisible={3}
              numScroll={1}
              responsiveOptions={responsiveOptions}
              circular
              autoplayInterval={0}
              showIndicators
              showNavigators
            />
          </div>
        </div>
      </section>
    );
  };

  return (
    <div className={styles.componentContainer}>
      {/* Portada */}
      <div className={styles.container}>
        <div className={styles.container__imgContainer}>
          <img
            className={styles.container__imgContainer__img}
            src={logo}
            alt="Logo de SiDCa"
          />
        </div>
      </div>

      {renderCarouselSection("Convenios Comercio", comercioList)}
      {renderCarouselSection("Convenios Hoteles", hotelesList)}
    </div>
  );
};

export default Home;