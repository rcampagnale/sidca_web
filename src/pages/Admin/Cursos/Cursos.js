// src/pages/Admin/Cursos/Cursos.js
import React, { useState, useEffect, useCallback, useMemo } from "react";
import { useDispatch, useSelector } from "react-redux";
import { useHistory } from "react-router-dom";

import { DataTable } from "primereact/datatable";
import { Column } from "primereact/column";
import { Button } from "primereact/button";
import { Paginator } from "primereact/paginator";
import { Ripple } from "primereact/ripple";
import { ProgressSpinner } from "primereact/progressspinner";
import { confirmDialog } from "primereact/confirmdialog";
import Swal from "sweetalert2";

import styles from "./styles.module.css";
import {
  clearStatus,
  deleteCursos,
  getCurso,
  getCursos,
} from "../../../redux/reducers/cursos/actions";
import SubirCursosUsuarios from "./SubirCursosUsuarios";

/** Config básica de columnas (sin JSX) */
const COLUMNS = [
  { field: "titulo", header: "Titulo" },
  { field: "descripcion", header: "Descripcion" },
  { field: "estado", header: "Estado" },
  { field: "categoria", header: "Categoria" },
  { field: "link", header: "Link" },
  { field: "id", header: "Acciones" },
];

/** Valida si un link es “usable” */
const isValidLink = (val) => {
  if (!val) return false;
  const s = String(val).trim().toLowerCase();
  if (s === "undefined" || s === "false" || s === "-") return false;
  return /^https?:\/\//.test(s);
};

const Cursos = () => {
  const dispatch = useDispatch();
  const history = useHistory();

  const cursosState = useSelector((state) => state.cursos);
  const { cursos, noSubidos, page, firstCurso, lastCurso, processing } =
    cursosState;

  const [cursoSelect, setCursoSelect] = useState(undefined);
  const [subirCursosActive, setSubirCursosActive] = useState(false);

  // 👉 Cargar primera página de cursos al montar
  useEffect(() => {
    dispatch(getCursos());
  }, [dispatch]);

  // 🔹 Editar curso: trae el curso y navega
  const handleEdit = useCallback(
    async (id) => {
      await dispatch(getCurso(id));
      history.push(`/admin/nuevo-curso/${id}`);
    },
    [dispatch, history]
  );

  // 🔹 Paginación: prev / next usando firstCurso / lastCurso
  const handlePagination = useCallback(
    (direction) => {
      if (direction === "prev") {
        if (page <= 1 || !firstCurso) return;
      } else if (direction === "next") {
        if (!lastCurso) return;
      }

      dispatch(
        getCursos(
          direction,
          direction === "next" ? lastCurso : firstCurso
        )
      );
    },
    [dispatch, page, firstCurso, lastCurso]
  );

  // 🔹 Eliminar curso (queda disponible, aunque hoy no tengas botón en la tabla)
  const acceptDelete = useCallback(
    (id) => {
      dispatch(deleteCursos(id));
    },
    [dispatch]
  );

  const confirmDelete = useCallback(
    (id) => {
      confirmDialog({
        message: "¿Está seguro que desea eliminar este curso?",
        header: "Atención",
        icon: "pi pi-exclamation-triangle",
        accept: () => acceptDelete(id),
      });
    },
    [acceptDelete]
  );

  // 🔹 Cargar usuarios para un curso
  const acceptUpload = useCallback((curso) => {
    setCursoSelect(curso);
    setSubirCursosActive(true);
  }, []);

  const confirmUpload = useCallback(
    (curso) => {
      confirmDialog({
        message: "¿Está seguro que desea cargar usuarios para este curso?",
        header: "Atención",
        icon: "pi pi-exclamation-triangle",
        accept: () => acceptUpload(curso),
      });
    },
    [acceptUpload]
  );

  // 🔹 Renderizado de link como ícono
  const linkBody = useCallback(
    (row) => {
      const val = row.link;
      if (!isValidLink(val)) {
        return <span className={styles.emptyField}>—</span>;
      }
      return (
        <a
          href={val}
          target="_blank"
          rel="noopener noreferrer"
          title="Abrir enlace"
          className={styles.linkIconWrapper}
        >
          <i className={`pi pi-external-link ${styles.linkIcon}`} />
        </a>
      );
    },
    []
  );

  // 🔹 Columnas de DataTable, memoizadas
  const dynamicColumns = useMemo(
    () =>
      COLUMNS.map((col) => {
        if (col.field === "id") {
          return (
            <Column
              key={col.field}
              header={col.header}
              body={(curso) => (
                <div className={styles.actionsCol}>
                  <Button
                    label="Editar"
                    icon="pi pi-pencil"
                    className="p-button-sm p-button-warning"
                    onClick={() => handleEdit(curso.id)}
                  />
                  <Button
                    label="Cargar usuarios"
                    icon="pi pi-file"
                    className="p-button-sm p-button-help"
                    onClick={() => confirmUpload(curso)}
                  />
                  {/* Si quisieras activar eliminar, podés mostrar este botón:
                  <Button
                    label="Eliminar"
                    icon="pi pi-trash"
                    className="p-button-sm p-button-danger"
                    onClick={() => confirmDelete(curso.id)}
                  />
                  */}
                </div>
              )}
              headerStyle={{ textAlign: "center", minWidth: "200px" }}
              style={{ textAlign: "center", minWidth: "200px" }}
            />
          );
        }

        if (col.field === "link") {
          return (
            <Column
              key={col.field}
              header={col.header}
              body={linkBody}
              headerStyle={{ textAlign: "center", width: "72px" }}
              style={{ textAlign: "center", width: "72px" }}
            />
          );
        }

        if (col.field === "estado") {
          return (
            <Column
              key={col.field}
              field={col.field}
              header={col.header}
              headerStyle={{ textAlign: "center", width: "104px" }}
              style={{ textAlign: "center", width: "104px" }}
            />
          );
        }

        if (col.field === "categoria") {
          return (
            <Column
              key={col.field}
              field={col.field}
              header={col.header}
              headerStyle={{ textAlign: "center", width: "112px" }}
              style={{ textAlign: "center", width: "112px" }}
            />
          );
        }

        if (col.field === "titulo") {
          return (
            <Column
              key={col.field}
              field={col.field}
              header={col.header}
              bodyStyle={{ whiteSpace: "normal", overflowWrap: "break-word" }}
              headerStyle={{ minWidth: "150px", maxWidth: "180px" }}
              style={{ minWidth: "150px", maxWidth: "180px" }}
            />
          );
        }

        if (col.field === "descripcion") {
          return (
            <Column
              key={col.field}
              field={col.field}
              header={col.header}
              bodyStyle={{ whiteSpace: "normal", overflowWrap: "break-word" }}
              headerStyle={{ minWidth: "220px", maxWidth: "260px" }}
              style={{ minWidth: "220px", maxWidth: "260px" }}
            />
          );
        }

        // fallback
        return (
          <Column key={col.field} field={col.field} header={col.header} />
        );
      }),
    [handleEdit, confirmUpload, confirmDelete, linkBody]
  );

  // 🔹 Mensajes (Swal) según estado
  useEffect(() => {
    const { status, msg, noSubidos: ns } = cursosState;
    if (!status) return;

    if (status === "SUCCESS_ADD" || status === "SUCCESS_UPLOAD") {
      Swal.fire({
        title: "Solicitud Exitosa",
        text: msg,
        icon: "success",
        confirmButtonText: "Continuar",
      }).then(() => {
        dispatch(clearStatus());
      });
    } else if (
      status === "FAILURE_ADD" ||
      status === "FAILURE_UPLOAD" ||
      status === "FAILURE_USER_INFO"
    ) {
      Swal.fire({
        title: "Error",
        text: msg,
        icon: "error",
        confirmButtonText: "Continuar",
      }).then(() => {
        dispatch(clearStatus());
      });
    } else if (status === "SUCCESS_USER_INFO") {
      Swal.fire({
        title:
          ns && ns.length > 0
            ? "Algunos usuarios no fueron cargados con sus cursos"
            : "Se actualizaron los datos correctamente",
        text:
          ns && ns.length > 0
            ? "Los siguientes DNI no fueron subidos:\n" +
              ns.join(" - \n")
            : "",
        icon: "success",
        confirmButtonText: "Continuar",
      }).then(() => {
        // Cerramos el modo "Subir cursos" y limpiamos estado
        setSubirCursosActive(false);
        setCursoSelect(undefined);
        dispatch(clearStatus());
      });
    }
  }, [cursosState, dispatch]);

  // 🔹 Template del Paginator, memoizado
  const template2 = useMemo(
    () => ({
      layout: "PrevPageLink CurrentPageReport NextPageLink",
      PrevPageLink: (options) => (
        <button
          type="button"
          className={options.className}
          onClick={() => handlePagination("prev")}
          disabled={page <= 1 || processing}
        >
          <span className="p-3">Anterior</span>
        </button>
      ),
      NextPageLink: (options) => (
        <button
          type="button"
          className={options.className}
          onClick={() => handlePagination("next")}
          disabled={processing}
        >
          <span className="p-3">Siguiente</span>
        </button>
      ),
      CurrentPageReport: (options) => (
        <button
          type="button"
          className={options.className}
          onClick={options.onClick}
        >
          {page}
          <Ripple />
        </button>
      ),
    }),
    [handlePagination, page, processing]
  );

  return (
    <div className={styles.container}>
      <div className={styles.title_and_button}>
        <h3 className={styles.title}>Cursos</h3>
        <div>
          <Button
            label="Nuevo curso"
            icon="pi pi-plus"
            onClick={() => history.push("/admin/nuevo-curso")}
            style={{ marginRight: 3 }}
          />
          {subirCursosActive && (
            <Button
              label="Ver Cursos"
              icon="pi pi-search"
              onClick={() => {
                setSubirCursosActive(false);
                setCursoSelect(undefined);
              }}
            />
          )}
        </div>
      </div>

      <div className={styles.table_upload}>
        {subirCursosActive ? (
          <SubirCursosUsuarios curso={cursoSelect} noSubidos={noSubidos} />
        ) : cursos && cursos.length > 0 ? (
          <>
            <DataTable
              value={cursos}
              responsiveLayout="scroll"
              loading={processing}
              dataKey="id"
              tableStyle={{ tableLayout: "fixed" }}
              className={`p-datatable-sm ${styles.prettyTable}`}
            >
              {dynamicColumns}
            </DataTable>

            <Paginator template={template2} />
          </>
        ) : processing ? (
          <ProgressSpinner className="loader" />
        ) : (
          <Button
            label="No hay cursos"
            className={`p-button-outlined p-button-danger ${styles.errorBtn}`}
          />
        )}
      </div>
    </div>
  );
};

export default Cursos;

