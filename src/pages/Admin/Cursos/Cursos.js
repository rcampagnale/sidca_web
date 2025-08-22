import React, { useState, useEffect } from "react";
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

const Cursos = () => {
  const dispatch = useDispatch();
  const history = useHistory();

  const columns = [
    { field: "titulo", header: "Titulo" },
    { field: "descripcion", header: "Descripcion" },
    { field: "estado", header: "Estado" },
    { field: "categoria", header: "Categoria" },
    { field: "link", header: "Link" },
    { field: "id", header: "Acciones" },
  ];

  const cursos = useSelector((state) => state.cursos);
  const noSubidos = useSelector((state) => state.cursos.noSubidos);
  const page = useSelector((state) => state.cursos.page);

  const [prevDisable, setPrevDisable] = useState(false);
  const [nextDisable, setNextDisable] = useState(false);
  const [cursoSelect, setCursoSelect] = useState(undefined);
  const [subirCursosActive, setSubirCursosActive] = useState(false);

  const handleEdit = async (id) => {
    await dispatch(getCurso(id));
    history.push(`/admin/nuevo-curso/${id}`);
  };

  const handlePagination = async (pagination) => {
    if (pagination === "prev" && page === 1) {
      return setPrevDisable(true);
    } else {
      setPrevDisable(false);
    }
    dispatch(
      getCursos(
        pagination,
        pagination === "next" ? cursos.lastCurso : cursos.firstCurso
      )
    );
  };

  useEffect(() => {
    dispatch(getCursos());
  }, [dispatch]);

  const acceptDelete = (id) => {
    dispatch(deleteCursos(id));
  };

  const confirmDelete = (id) => {
    confirmDialog({
      message: "Esta seguro que desea Eliminar?",
      header: "Atención",
      icon: "pi pi-exclamation-triangle",
      accept: () => acceptDelete(id),
      reject: () => {},
    });
  };

  const acceptUpload = (curso) => {
    setCursoSelect(curso);
    setSubirCursosActive(true);
  };

  const confirmUpload = (id) => {
    confirmDialog({
      message: "Esta seguro que desea Eliminar?",
      header: "Atención",
      icon: "pi pi-exclamation-triangle",
      accept: () => acceptUpload(id),
      reject: () => {},
    });
  };

  // --- Link como ícono ---
  const isValidLink = (val) => {
    if (!val) return false;
    const s = String(val).trim().toLowerCase();
    if (s === "undefined" || s === "false" || s === "-") return false;
    return /^https?:\/\//.test(s);
  };

  const linkBody = (row) => {
    const val = row.link;
    if (!isValidLink(val)) return <span className={styles.emptyField}>—</span>;
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
  };

  // --- Columnas dinámicas con widths más compactos y mejor estética ---
  const dynamicColumns = columns.map((col) => {
 if (col.field === 'id') {
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
            onClick={() => acceptUpload(curso)}
          />
        </div>
      )}
      headerStyle={{ textAlign: 'center', minWidth: '160px' }}   // más ancho
      style={{ textAlign: 'center', minWidth: '160px' }}
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
    return <Column key={col.field} field={col.field} header={col.header} />;
  });

  // Mensajes
  useEffect(() => {
    if (cursos.status === "SUCCESS_ADD" || cursos.status === "SUCCESS_UPLOAD") {
      Swal.fire({
        title: "Solicitud Exitosa",
        text: cursos.msg,
        icon: "success",
        confirmButtonText: "Continuar",
      });
      dispatch(clearStatus());
    }
    if (
      cursos.status === "FAILURE_ADD" ||
      cursos.status === "FAILURE_UPLOAD" ||
      cursos.status === "FAILURE_USER_INFO"
    ) {
      Swal.fire({
        title: "Error!",
        text: cursos.msg,
        icon: "error",
        confirmButtonText: "Continuar",
      });
      dispatch(clearStatus());
    }
    if (cursos.status === "SUCCESS_USER_INFO") {
      Swal.fire({
        title:
          noSubidos.length > 0
            ? "Algunos usuarios no fueron cargados con sus cursos!"
            : "Se actualizaron los datos correctamente",
        text:
          noSubidos.length > 0
            ? "Los siguientes dni no fueron subidos: \n" +
              noSubidos.join(" - \n")
            : "",
        icon: "success",
        confirmButtonText: "Continuar",
      });
    }
  }, [cursos.status, cursos.msg, noSubidos, dispatch]);

  const template2 = {
    layout: "PrevPageLink CurrentPageReport NextPageLink",
    PrevPageLink: (options) => (
      <button
        type="button"
        className={options.className}
        onClick={() => handlePagination("prev")}
        disabled={prevDisable}
      >
        <span className="p-3">Anterior</span>
      </button>
    ),
    NextPageLink: (options) => (
      <button
        type="button"
        className={options.className}
        onClick={() => handlePagination("next")}
        disabled={nextDisable}
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
  };

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
              icon={"pi pi-search"}
              onClick={() => {
                setSubirCursosActive(!subirCursosActive);
                setCursoSelect(undefined);
              }}
            />
          )}
        </div>
      </div>

      <div className={styles.table_upload}>
        {subirCursosActive ? (
          <SubirCursosUsuarios curso={cursoSelect} noSubidos={noSubidos} />
        ) : cursos.cursos.length > 0 ? (
          <>
            <DataTable
              value={cursos.cursos}
              responsiveLayout="scroll"
              loading={cursos.processing}
              tableStyle={{ tableLayout: "fixed" }} // respeta los widths
              className={`p-datatable-sm ${styles.prettyTable}`}
            >
              {dynamicColumns}
            </DataTable>
            <Paginator template={template2} />
          </>
        ) : cursos.processing ? (
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
