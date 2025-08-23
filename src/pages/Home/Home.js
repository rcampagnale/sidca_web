import React, { useEffect } from 'react';
import styles from './home.module.scss';
import logo from '../../assets/img/somos3.jpg';
import { useDispatch, useSelector } from 'react-redux';
import { setUserCuotas } from '../../redux/reducers/cuotas/actions';
import { getNovedades } from '../../redux/reducers/novedades/actions';
import { useLocation } from 'react-router-dom';
import Swal from 'sweetalert2';
import './CarouselDemo.scss';
import { Carousel } from 'primereact/carousel';
import { Button } from 'primereact/button';

const Home = () => {
  const dispatch = useDispatch();
  const cuotas = useSelector(state => state.cuotas);
  const novedades = useSelector(state => state.novedades);
  const location = useLocation();

  useEffect(() => {
    dispatch(getNovedades());
  }, [dispatch]);

  useEffect(() => {
    if (location.search) {
      const search = {};
      location.search
        .slice(1)
        .split('&')
        .forEach(param => {
          const data = param.split('=');
          search[data[0]] = data[1];
        });
      dispatch(setUserCuotas(search));
    }
  }, [location, dispatch]);

  useEffect(() => {
    if (cuotas.setTransaccion === 'SUCCESS_SET') {
      Swal.fire({
        title: 'Transferencia recibida',
        text: 'Se han cargado los datos de su pago.',
        icon: 'success',
        confirmButtonText: 'Ok'
      });
    } else if (cuotas.setTransaccion === 'FAILURE_SET') {
      Swal.fire({
        title: 'No se ha guardado la transferencia',
        text: 'Si no intentaste hacer un pago de cuota ignora este mensaje.',
        icon: 'error',
        confirmButtonText: 'Ok'
      });
    }
  }, [cuotas.setTransaccion]);

  const responsiveOptions = [
    { breakpoint: '2000px', numVisible: 3, numScroll: 3 },
    { breakpoint: '1400px', numVisible: 2, numScroll: 2 },
    { breakpoint: '767px',  numVisible: 1, numScroll: 1 }
  ];

  const getCat = (n) =>
    Array.isArray(n?.categoria) ? (n.categoria[0] ?? '') : (n?.categoria ?? '');

  const sortByDateDesc = (arr) =>
    [...arr].sort((a, b) => new Date(b?.fecha || 0) - new Date(a?.fecha || 0));

  const all = (novedades?.novedades || []).filter(Boolean);

  const comercioList = sortByDateDesc(all.filter(n => getCat(n) === 'convenio_comercio'));
  const hotelesList  = sortByDateDesc(all.filter(n => getCat(n) === 'convenio_hoteles'));

  function productTemplate(item) {
    if (!item) return null;

    const hasImg = Boolean(item.imagen);

    return (
      <article className="nov-card">
        <header className="nov-card__header">
          <h4 className="nov-card__title">{item.titulo}</h4>
          {/* 🔴 Se quitó el Chip de categoría */}
        </header>

        <div className="nov-card__media">
          {hasImg ? (
            <img
              src={item.imagen}
              alt={item.titulo}
              className="nov-card__image"
              loading="lazy"
              onError={e => (e.currentTarget.style.visibility = 'hidden')}
            />
          ) : (
            <div className="nov-card__imageFallback">Sin imagen</div>
          )}
        </div>

        {item.descripcion && (
          <p className="nov-card__excerpt">{item.descripcion}</p>
        )}

        <footer className="nov-card__footer">
          <a href="/convenios">
            <Button label="Leer más" className="p-button-rounded p-button-sm" />
          </a>
        </footer>
      </article>
    );
  }

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

      {/* Sección: Convenios Comercio */}
      {comercioList.length > 0 && (
        <section className="nov-wrapper">
          <div className="nov-wrapper__header">
            <h1 className={styles.h1}>Convenios Comercio</h1>
          </div>
          <div className="carousel-demo">
            <div className="card">
              <Carousel
                value={comercioList}
                responsiveOptions={responsiveOptions}
                itemTemplate={productTemplate}
                circular
                autoplayInterval={0}
                showIndicators
                showNavigators
              />
            </div>
          </div>
        </section>
      )}

      {/* Sección: Convenios Hoteles */}
      {hotelesList.length > 0 && (
        <section className="nov-wrapper">
          <div className="nov-wrapper__header">
            <h1 className={styles.h1}>Convenios Hoteles</h1>
          </div>
          <div className="carousel-demo">
            <div className="card">
              <Carousel
                value={hotelesList}
                responsiveOptions={responsiveOptions}
                itemTemplate={productTemplate}
                circular
                autoplayInterval={0}
                showIndicators
                showNavigators
              />
            </div>
          </div>
        </section>
      )}
    </div>
  );
};

export default Home;


