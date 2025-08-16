import React, { useEffect, useMemo, useState, useCallback } from "react";
import { useDispatch, useSelector } from "react-redux";
import { useHistory } from "react-router";
import { DataTable } from "primereact/datatable";
import { Column } from "primereact/column";
import { Button } from "primereact/button";
import { Paginator } from "primereact/paginator";
import { Ripple } from "primereact/ripple";
import { ProgressSpinner } from "primereact/progressspinner";
import Swal from "sweetalert2";

import styles from "./styles.module.css";

import {
  clearStatus,
  deleteAsesoramientos,
  getAsesoramiento,
  getAsesoramientos,
} from "../../../redux/reducers/asesoramiento/actions";

const Asesoramiento = () => {
  const dispatch = useDispatch();
  const history = useHistory();

  // ---- Redux state
  const asesoramiento = useSelector((state) => state.asesoramiento);
  const page = useSelector((state) => state.asesoramiento.page);
  const user = useSelector((state) => state.user.profile);

  // ---- Local state
  const [prevDisable, setPrevDisable] = useState(false);
  const [nextDisable, setNextDisable] = useState(false);
  const [subirAsesoramientosActive] = useState(false);
  const [deletingId, setDeletingId] = useState(null);

  // ---- Permisos
  const isAdmin = user?.role === "admin";

  // ---- Columnas (definidas una sola vez)
  const columns = useMemo(
    () => [
      { field: "titulo", header: "Titulo" },
      { field: "descripcion", header: "Descripcion" },
      { field: "estado", header: "Estado" },
      { field: "categoria", header: "Categoria" },
      { field: "link", header: "PDF" },
      { field: "id", header: "Acciones" },
    ],
    []
  );

  // ---- Efectos (siempre al mismo nivel, nunca condicionales)
  useEffect(() => {
    dispatch(getAsesoramientos());
  }, [dispatch]);

  useEffect(() => {
    if (
      asesoramiento.status === "SUCCESS_ADD" ||
      asesoramiento.status === "SUCCESS_UPLOAD" ||
      asesoramiento.status === "SUCCESS_DELETE"
    ) {
      Swal.fire({
        title: "Solicitud Exitosa",
        text: asesoramiento.msg,
        icon: "success",
        confirmButtonText: "Continuar",
      });
      dispatch(clearStatus());
    }
    if (
      asesoramiento.status === "FAILURE_ADD" ||
      asesoramiento.status === "FAILURE_UPLOAD" ||
      asesoramiento.status === "FAILURE_DELETE"
    ) {
      Swal.fire({
        title: "Error",
        text: asesoramiento.msg,
        icon: "error",
        confirmButtonText: "Continuar",
      });
      dispatch(clearStatus());
    }
  }, [asesoramiento.status, asesoramiento.msg, dispatch]);

  // ---- Handlers (no hooks condicionales)
  const handleEdit = useCallback(
    async (id) => {
      await dispatch(getAsesoramiento(id));
      history.push(`/admin/nuevo-asesoramiento/${id}`);
    },
    [dispatch, history]
  );

  const handlePagination = useCallback(
    async (pagination) => {
      if (pagination === "prev" && page === 1) {
        setPrevDisable(true);
        return;
      } else {
        setPrevDisable(false);
      }
      dispatch(
        getAsesoramientos(
          pagination,
          pagination === "next"
            ? asesoramiento.lastAsesoramiento
            : asesoramiento.firstAsesoramiento
        )
      );
    },
    [dispatch, page, asesoramiento.firstAsesoramiento, asesoramiento.lastAsesoramiento]
  );

  const confirmDelete = useCallback(
    async (id) => {
      const result = await Swal.fire({
        title: "Eliminar asesoramiento",
        text: "Esta acción es irreversible. ¿Desea continuar?",
        icon: "warning",
        showCancelButton: true,
        confirmButtonText: "Sí, eliminar",
        cancelButtonText: "Cancelar",
        reverseButtons: true,
        confirmButtonColor: "#d33",
        cancelButtonColor: "#6c757d",
        focusCancel: true,
      });

      if (result.isConfirmed) {
        try {
          setDeletingId(id);
          await dispatch(deleteAsesoramientos(id));
        } finally {
          setDeletingId(null);
        }
      }
    },
    [dispatch]
  );

  // ---- Template PDF seguro
  const pdfBodyTemplate = (rowData) => {
  const url = (typeof rowData.pdf === 'string' && rowData.pdf.trim()) ||
              (typeof rowData.link === 'string' && rowData.link.trim()) ||
              '';
  const hasLink = url.length > 0;

  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center" }}>
      <Button
        icon="pi pi-file-pdf"
        className="p-button-rounded p-button-text p-button-danger"
        aria-label={hasLink ? "Abrir PDF" : "Sin PDF"}
        onClick={() => hasLink && window.open(url, "_blank", "noopener,noreferrer")}
        disabled={!hasLink}
      />
    </div>
  );
};


  // ---- Columnas dinámicas (useMemo NO condicional)
  const dynamicColumns = useMemo(() => {
    return columns.map((c) => {
      if (c.field === "id") {
        return (
          <Column
            key={c.field}
            header={c.header}
            body={(rowData) => (
              <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
                <Button
                  label="Editar"
                  icon="pi pi-pencil"
                  className="p-button-raised p-button-primary"
                  onClick={() => handleEdit(rowData.id)}
                />
                
                  <Button
                    label="Eliminar"
                    icon="pi pi-trash"
                    className="p-button-raised p-button-danger"
                    onClick={() => confirmDelete(rowData.id)}
                    disabled={deletingId === rowData.id || asesoramiento.processing}
                  />
                
              </div>
            )}
          />
        );
      }

      if (c.field === "link") {
        return (
          <Column
            key={c.field}
            header={c.header}
            body={pdfBodyTemplate}
            style={{ width: "90px", textAlign: "center" }}
          />
        );
      }

      return (
        <Column
          key={c.field}
          field={c.field}
          header={c.header}
          bodyStyle={{ overflowWrap: "break-word" }}
        />
      );
    });
  }, [columns, handleEdit, isAdmin, confirmDelete, deletingId, asesoramiento.processing, pdfBodyTemplate]);

  // ---- Template Paginator
  const template2 = {
    layout: "PrevPageLink CurrentPageReport NextPageLink",
    PrevPageLink: (options) => {
      return (
        <button
          type="button"
          className={options.className}
          onClick={() => handlePagination("prev")}
          disabled={prevDisable}
        >
          <span className="p-3">Anterior</span>
        </button>
      );
    },
    NextPageLink: (options) => {
      return (
        <button
          type="button"
          className={options.className}
          onClick={() => handlePagination("next")}
          disabled={nextDisable}
        >
          <span className="p-3">Siguiente</span>
        </button>
      );
    },
    CurrentPageReport: (options) => {
      return (
        <button type="button" className={options.className} onClick={options.onClick}>
          {page}
          <Ripple />
        </button>
      );
    },
  };

  return (
    <div className={styles.container}>
      <div className={styles.title_and_button}>
        <h3 className={styles.title}>Asesoramientos</h3>
        <div>
          <Button
            label="Nuevo asesoramiento"
            icon="pi pi-plus"
            onClick={() => history.push("/admin/nuevo-asesoramiento")}
            style={{ marginRight: 3 }}
          />
        </div>
      </div>

      <div className={styles.table_upload}>
        {subirAsesoramientosActive ? (
          <></>
        ) : asesoramiento.asesoramientos.length > 0 ? (
          <>
            <DataTable
              value={asesoramiento.asesoramientos}
              responsiveLayout="scroll"
              loading={asesoramiento.processing}
              tableStyle={{ minWidth: "800px" }}
            >
              {dynamicColumns}
            </DataTable>
            <Paginator template={template2} />
          </>
        ) : asesoramiento.processing ? (
          <ProgressSpinner className="loader" />
        ) : (
          <Button
            label="No hay asesoramientos"
            className={`p-button-outlined p-button-danger ${styles.errorBtn}`}
          />
        )}
      </div>
    </div>
  );
};

export default Asesoramiento;
