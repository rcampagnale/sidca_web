// src/pages/Admin/Usuarios/Usuarios.js
import React, { useEffect, useState } from "react";
import { useHistory } from "react-router";
import styles from "./styles.module.css";
import { Button } from "primereact/button";
import { InputText } from "primereact/inputtext";
import { useDispatch, useSelector } from "react-redux";
import { useForm } from "../../../hooks/useForm";
import {
  getUser,
  setUserEdit,
  clearStatus,
  deleteUser,
} from "../../../redux/reducers/afiliados/actions";
import { Spinner } from "../../../components/Spinner/Spinner";
import Swal from "sweetalert2";
import { confirmDialog, ConfirmDialog } from "primereact/confirmdialog";

const Usuarios = () => {
  const afiliado = useSelector((state) => state.afiliado);
  const history = useHistory();
  const dispatch = useDispatch();

  // flag admin guardado al iniciar sesión
  const esAdmin = sessionStorage.getItem("es_admin") === "true";

  // formulario
  const [formValues, handleInputChange, reset] = useForm({ dni: "" });
  const { dni } = formValues;

  // para saber si ya se hizo una búsqueda
  const [hasSearch, setHasSearch] = useState(false);

  // ⛲ Al entrar a la página, dejar todo limpio
  useEffect(() => {
    dispatch(clearStatus());
    reset();
    setHasSearch(false);
    window.scrollTo(0, 0);
    // importante: NO ponemos "reset" en el array de deps,
    // así no se ejecuta este efecto cada vez que tipeás.
  }, [dispatch]);

  // Mensajes de éxito / error que vienen del reducer de afiliados
  useEffect(() => {
    if (
      afiliado.status === "SUCCESS" ||
      afiliado.status === "SUCCESS_DELETE"
    ) {
      Swal.fire({
        title: "Solicitud Exitosa",
        text: afiliado.msg,
        icon: "success",
        confirmButtonText: "Continuar",
      });
      dispatch(clearStatus());
    } else if (
      afiliado.status === "FAILURE" ||
      afiliado.status === "FAILURE_DELETE"
    ) {
      Swal.fire({
        title: "Error",
        text: afiliado.msg,
        icon: "error",
        confirmButtonText: "Continuar",
      });
      dispatch(clearStatus());
    }
  }, [afiliado.status, afiliado.msg, dispatch]);

  // Buscar usuario por DNI
  const handleSubmit = (e) => {
    e.preventDefault();
    if (!dni) {
      Swal.fire("Atención", "Ingresá un DNI para buscar.", "warning");
      return;
    }

    dispatch(getUser({ dni }));
    setHasSearch(true);
  };

  // Cancelar: dejar todo como recién cargado
  const handleCancelarBusqueda = () => {
    reset();                // limpia input
    dispatch(clearStatus()); // limpia estado de búsqueda
    setHasSearch(false);    // no mostrar resultados
    window.scrollTo(0, 0);
  };

  const handleNuevoUsuario = () => {
    history.push("/admin/nuevo-usuario");
  };

  const handleEdit = (id) => {
    dispatch(setUserEdit(id));
    history.push(`/admin/nuevo-usuario/${id}`);
  };

  const handleDelete = (id) => {
    dispatch(deleteUser(id)); // la lógica de baja se maneja en el action
  };

  const confirmDelete = (id) => {
    confirmDialog({
      message: "¿Está seguro que desea eliminar este usuario?",
      header: "Atención",
      icon: "pi pi-exclamation-triangle",
      acceptLabel: "Sí, eliminar",
      rejectLabel: "Cancelar",
      acceptClassName: "p-button-danger",
      accept: () => handleDelete(id),
    });
  };

  const results = Array.isArray(afiliado.user) ? afiliado.user : [];
  const showNoResults =
    hasSearch && !afiliado.processing && results.length === 0;
  const showCards =
    hasSearch && !afiliado.processing && results.length > 0;

  return (
    <div className={styles.visibleContent}>
      {/* Requerido para el confirmDialog */}
      <ConfirmDialog />

      {/* Tarjeta principal con título + botón "Nuevo usuario" */}
      <div className={styles.container}>
        <div className={styles.headerRow}>
          <h1 className={styles.title}>Usuarios</h1>

          <Button
            label="Nuevo usuario"
            icon="pi pi-user-plus"
            className={`p-button-success ${styles.newUserButton}`}
            onClick={handleNuevoUsuario}
            disabled={afiliado.processing}
          />
        </div>

        {/* Formulario de búsqueda */}
        <form className={styles.inputSection} onSubmit={handleSubmit}>
          <div className={styles.searchRow}>
            <span className={`p-float-label ${styles.searchRowInput}`}>
              <InputText
                id="dni"
                name="dni"
                value={dni}
                onChange={handleInputChange}
                disabled={afiliado.processing}
              />
              <label htmlFor="dni">DNI</label>
            </span>

            <div className={styles.actions}>
              <Button
                label="Buscar"
                icon="pi pi-search"
                type="submit"
                className={styles.submitButton}
                disabled={afiliado.processing}
              />
              <Button
                label="Cancelar"
                type="button"
                className="p-button-secondary p-button-outlined"
                onClick={handleCancelarBusqueda}
                disabled={afiliado.processing}
              />
            </div>
          </div>
        </form>
      </div>

      {/* Resultados */}
      <div className={styles.cardsContainer}>
        {afiliado.processing && <Spinner />}

        {showNoResults && <p>No se encontraron resultados.</p>}

        {showCards &&
          results.map((item) => (
            <div className={styles.searchContainer} key={item.id}>
              <h2 className={styles.title}>
                {`${item.apellido}, ${item.nombre}`}
              </h2>
              <h2 className={styles.title}>{item.dni}</h2>
              <div className={styles.actions}>
                <Button
                  label="Editar"
                  className="p-button-raised"
                  onClick={() => handleEdit(item.id)}
                  disabled={afiliado.processing}
                />
                {esAdmin && (
                  <Button
                    label="Eliminar"
                    icon="pi pi-trash"
                    className="p-button-raised p-button-danger"
                    onClick={() => confirmDelete(item.id)}
                    disabled={afiliado.processing}
                  />
                )}
              </div>
            </div>
          ))}
      </div>
    </div>
  );
};

export default Usuarios;

