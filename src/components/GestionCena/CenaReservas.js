import React, { useMemo, useState } from "react";
import { estadoAcreditacionReservaCena, formatearDniCena, normalizarBusquedaCena, reservaCoincideBusquedaCena, resumirTarjetasVigentesCena } from "../../services/gestionCenaService";
import styles from "../../pages/Admin/GestionCena/GestionCenaAdmin.module.css";

export const estadoReservaDesdeTarjetas = (reserva, tarjetas = []) => {
  return estadoAcreditacionReservaCena(reserva, tarjetas);
};

const CenaReservas = ({ reservas, tarjetas, onNueva, onEditar, onAnular, onEliminar, onTarjetas, onPdf, onImportar, onExcelSorteo, titularesElegiblesSorteo, eliminandoReservaId }) => {
  const [busqueda, setBusqueda] = useState("");

  const reservasFiltradas = useMemo(() => {
    const termino = normalizarBusquedaCena(busqueda);
    return reservas.filter((reserva) => reservaCoincideBusquedaCena(reserva, termino));
  }, [reservas, busqueda]);

  const agrupadas = useMemo(() => {
    const mapa = new Map();
    tarjetas.forEach((tarjeta) => {
      const lista = mapa.get(tarjeta.reservaId) || [];
      lista.push(tarjeta);
      mapa.set(tarjeta.reservaId, lista);
    });
    return mapa;
  }, [tarjetas]);

  return (
    <section className={styles.gcPanel}>
      <div className={styles.gcPanelHeader}>
        <h2>Reservas</h2>
        <div className={`${styles.actions} ${styles.reservasActions}`}>
          <button type="button" className={styles.primaryButton} onClick={onNueva}>Nueva reserva</button>
          <button type="button" className={styles.secondaryButton} onClick={onImportar}>Importar Excel</button>
          <button type="button" className={styles.secondaryButton} onClick={onExcelSorteo}>Excel sorteo{titularesElegiblesSorteo ? ` (${titularesElegiblesSorteo})` : ""}</button>
        </div>
      </div>

      <label className={styles.reservasSearch}>
        Buscar reserva
        <input
          type="search"
          value={busqueda}
          onChange={(event) => setBusqueda(event.target.value)}
          placeholder="Buscar por DNI, apellido o nombre..."
          aria-label="Buscar reservas por DNI, apellido o nombre"
        />
      </label>

      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>DNI</th>
              <th>Apellido y Nombre</th>
              <th>Total tarjetas</th>
              <th>Titular</th>
              <th>Acompañantes</th>
              <th>Acreditadas</th>
              <th>Pendientes</th>
              <th>Estado</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {reservasFiltradas.map((reserva) => {
              const lista = agrupadas.get(reserva.id) || [];
              const resumen = resumirTarjetasVigentesCena(lista);
              const titulares = resumen.vigentes.filter((tarjeta) => tarjeta.tipo === "titular").length;
              const acompanantes = resumen.vigentes.filter((tarjeta) => tarjeta.tipo === "acompanante").length;
              const estado = estadoReservaDesdeTarjetas(reserva, lista);
              return (
                <tr key={reserva.id}>
                  <td data-label="DNI">{formatearDniCena(reserva.afiliado?.dni)}</td>
                  <td data-label="Apellido y Nombre">{reserva.afiliado?.apellido} {reserva.afiliado?.nombre}</td>
                  <td data-label="Total tarjetas">{resumen.total}</td>
                  <td data-label="Titular">{titulares}</td>
                  <td data-label="Acompañantes">{acompanantes}</td>
                  <td data-label="Acreditadas">{resumen.acreditadas}</td>
                  <td data-label="Pendientes">{resumen.pendientes}</td>
                  <td data-label="Estado"><span className={`${styles.status} ${styles[`estado${estado.replace(/\s/g, "")}`]}`}>{estado}</span></td>
                  <td data-label="Acciones">
                    <div className={styles.rowActions}>
                      <button type="button" onClick={() => onTarjetas(reserva)}>Ver tarjetas</button>
                      <button type="button" onClick={() => onEditar(reserva)}>Editar</button>
                      <button type="button" onClick={() => onPdf(reserva)}>PDF</button>
                      <button type="button" onClick={() => onAnular(reserva)}>Anular</button>
                      <button type="button" onClick={() => onEliminar(reserva)} disabled={eliminandoReservaId === reserva.id}>
                        {eliminandoReservaId === reserva.id ? "Eliminando..." : "Eliminar"}
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className={styles.reservationCards}>
        {reservasFiltradas.map((reserva) => {
          const lista = agrupadas.get(reserva.id) || [];
          const resumen = resumirTarjetasVigentesCena(lista);
          const titulares = resumen.vigentes.filter((tarjeta) => tarjeta.tipo === "titular").length;
          const acompanantes = resumen.vigentes.filter((tarjeta) => tarjeta.tipo === "acompanante").length;
          const estado = estadoReservaDesdeTarjetas(reserva, lista);
          return (
            <article key={reserva.id} className={styles.reservationCard}>
              <div className={styles.reservationIdentity}>
                <h3>{reserva.afiliado?.apellido} {reserva.afiliado?.nombre}</h3>
                <p>DNI {formatearDniCena(reserva.afiliado?.dni)}</p>
              </div>
              <div className={styles.reservationStats}>
                <span>Tarjetas <strong>{resumen.total}</strong></span>
                <span>Titular <strong>{titulares}</strong></span>
                <span>Acompañantes <strong>{acompanantes}</strong></span>
                <span>Acreditadas <strong>{resumen.acreditadas}</strong></span>
                <span>Pendientes <strong>{resumen.pendientes}</strong></span>
              </div>
              <span className={`${styles.status} ${styles[`estado${estado.replace(/\s/g, "")}`]}`}>{estado}</span>
              <div className={`${styles.rowActions} ${styles.reservationCardActions}`}>
                <button type="button" onClick={() => onTarjetas(reserva)}>Ver tarjetas</button>
                <button type="button" onClick={() => onEditar(reserva)}>Editar</button>
                <button type="button" onClick={() => onPdf(reserva)}>PDF</button>
                <button type="button" onClick={() => onAnular(reserva)}>Anular</button>
                <button type="button" onClick={() => onEliminar(reserva)} disabled={eliminandoReservaId === reserva.id}>
                  {eliminandoReservaId === reserva.id ? "Eliminando..." : "Eliminar"}
                </button>
              </div>
            </article>
          );
        })}
      </div>
      {!reservas.length && <p className={styles.empty}>Todavía no hay reservas para este año.</p>}
      {reservas.length > 0 && !reservasFiltradas.length && <p className={styles.empty}>No se encontraron reservas con esa búsqueda.</p>}
    </section>
  );
};

export default CenaReservas;
