// src/components/HabilitarBotones/modales/ModalConstanciasCertificados.js

import React, { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "primereact/button";
import { Dialog } from "primereact/dialog";
import { Toast } from "primereact/toast";
import { Dropdown } from "primereact/dropdown";
import { InputText } from "primereact/inputtext";
import { InputSwitch } from "primereact/inputswitch";
import { DataTable } from "primereact/datatable";
import { Column } from "primereact/column";
import {
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  serverTimestamp,
  setDoc,
} from "firebase/firestore";

import { db } from "../../../firebase/firebase-config";
import styles from "./ModalConstanciasCertificados.module.css";

const COLECCION_CURSOS = "cursos";

const SUBCOLECCION_CURSOS_CONSTANCIA = [
  "cod",
  "constancia_certificado",
  "cursos",
];

const TEXTO_BOTON_DEFAULT = "Ver constancia";

const FORM_INICIAL = {
  cursoId: "",
  cursoNombre: "",
  resolucion: "",
  diasCurso: "",
  fechaEmision: "",
  lugarEmision: "San Fernando del Valle de Catamarca",
  habilitado: true,
  fechaTemporal: "",
  fechasConstancia: [],
};

const limpiarTexto = (value) => String(value ?? "").trim();

const obtenerTituloCurso = (data = {}, id = "") => {
  return limpiarTexto(
    data.titulo ||
      data.nombre ||
      data.name ||
      data.curso ||
      data.cursoTitulo ||
      data.cursoNombre ||
      data.tituloCurso ||
      data.nombreCurso ||
      id
  );
};

const normalizarArrayFechas = (value) => {
  if (!Array.isArray(value)) return [];

  return [...new Set(value.filter(Boolean).map(String))]
    .filter((fecha) => /^\d{4}-\d{2}-\d{2}$/.test(fecha))
    .sort();
};

const formatearFechaVisual = (fechaISO) => {
  if (!fechaISO || !/^\d{4}-\d{2}-\d{2}$/.test(fechaISO)) {
    return fechaISO || "—";
  }

  const [yyyy, mm, dd] = fechaISO.split("-");
  return `${dd}/${mm}/${yyyy}`;
};

const ModalConstanciasCertificados = ({ visible, onHide }) => {
  const toast = useRef(null);

  const [loadingCursos, setLoadingCursos] = useState(false);
  const [loadingRegistros, setLoadingRegistros] = useState(false);
  const [saving, setSaving] = useState(false);

  const [cursos, setCursos] = useState([]);
  const [registros, setRegistros] = useState([]);

  const [modoFormulario, setModoFormulario] = useState(null);
  const [editandoId, setEditandoId] = useState(null);
  const [form, setForm] = useState(FORM_INICIAL);

  const cursosMap = useMemo(() => {
    const map = new Map();

    cursos.forEach((curso) => {
      map.set(curso.id, curso);
      map.set(curso.value, curso);
    });

    return map;
  }, [cursos]);

  const cursosOptions = useMemo(() => {
    return cursos.map((curso) => ({
      label: curso.label,
      value: curso.value,
      id: curso.id,
      titulo: curso.titulo,
    }));
  }, [cursos]);

  const registrosConCurso = useMemo(() => {
    return registros.map((item) => {
      const curso = cursosMap.get(item.cursoId);

      return {
        ...item,
        cursoNombreFinal:
          item.cursoNombre ||
          item.cursoTitulo ||
          item.curso ||
          item.nombreCurso ||
          curso?.titulo ||
          "Curso sin nombre",
      };
    });
  }, [registros, cursosMap]);

  useEffect(() => {
    if (!visible) return undefined;

    setLoadingCursos(true);

    const unsub = onSnapshot(
      collection(db, COLECCION_CURSOS),
      (snap) => {
        const items = [];

        snap.forEach((d) => {
          const data = d.data() || {};
          const titulo = obtenerTituloCurso(data, d.id);

          if (!titulo) return;

          items.push({
            id: d.id,
            value: d.id,
            titulo,
            label: titulo,
            raw: data,
          });
        });

        items.sort((a, b) =>
          a.titulo.localeCompare(b.titulo, "es", {
            sensitivity: "base",
          })
        );

        setCursos(items);
        setLoadingCursos(false);
      },
      (err) => {
        console.error("Error al leer cursos:", err);

        setCursos([]);
        setLoadingCursos(false);

        toast.current?.show({
          severity: "error",
          summary: "Error al leer cursos",
          detail:
            err?.message ||
            `No se pudo leer la colección raíz ${COLECCION_CURSOS}.`,
          life: 7000,
        });
      }
    );

    return () => unsub();
  }, [visible]);

  useEffect(() => {
    if (!visible) return undefined;

    setLoadingRegistros(true);

    const unsub = onSnapshot(
      collection(db, ...SUBCOLECCION_CURSOS_CONSTANCIA),
      (snap) => {
        const items = [];

        snap.forEach((d) => {
          const data = d.data() || {};

          const fechas =
            normalizarArrayFechas(data.fechasConstancia).length > 0
              ? normalizarArrayFechas(data.fechasConstancia)
              : normalizarArrayFechas(
                  data.fechasHabilitadasConstancia ||
                    data.fechasMostrarConstancia
                );

          items.push({
            id: d.id,
            cursoId: data.cursoId || d.id,
            cursoNombre:
              data.cursoNombre ||
              data.cursoTitulo ||
              data.curso ||
              data.nombreCurso ||
              "",
            resolucion: data.resolucion || "",
            diasCurso: data.diasCurso || "",
            fechaEmision: data.fechaEmision || "",
            lugarEmision: data.lugarEmision || "",
            habilitado: data.habilitado !== false,
            fechasConstancia: fechas,
            actualizadoEn: data.actualizadoEn || null,
            raw: data,
          });
        });

        items.sort((a, b) =>
          String(a.cursoNombre || "").localeCompare(
            String(b.cursoNombre || ""),
            "es",
            { sensitivity: "base" }
          )
        );

        setRegistros(items);
        setLoadingRegistros(false);
      },
      (err) => {
        console.error("Error al leer cursos habilitados:", err);

        setRegistros([]);
        setLoadingRegistros(false);

        toast.current?.show({
          severity: "error",
          summary: "Error al leer constancias",
          detail:
            err?.message ||
            "No se pudo leer cod/constancia_certificado/cursos.",
          life: 7000,
        });
      }
    );

    return () => unsub();
  }, [visible]);

  const cerrarFormulario = () => {
    setModoFormulario(null);
    setEditandoId(null);
    setForm(FORM_INICIAL);
  };

  const abrirNuevo = () => {
    setModoFormulario("nuevo");
    setEditandoId(null);
    setForm(FORM_INICIAL);
  };

  const onSeleccionarCurso = (cursoId) => {
    const curso = cursosMap.get(cursoId);

    setForm((prev) => ({
      ...prev,
      cursoId: curso?.id || cursoId || "",
      cursoNombre: curso?.titulo || "",
    }));
  };

  const editarRegistro = (row) => {
    setModoFormulario("editar");
    setEditandoId(row.id);

    setForm({
      cursoId: row.cursoId || row.id || "",
      cursoNombre: row.cursoNombreFinal || row.cursoNombre || "",
      resolucion: row.resolucion || "",
      diasCurso: row.diasCurso || "",
      fechaEmision: row.fechaEmision || "",
      lugarEmision:
        row.lugarEmision || "San Fernando del Valle de Catamarca",
      habilitado: row.habilitado !== false,
      fechaTemporal: "",
      fechasConstancia: normalizarArrayFechas(row.fechasConstancia),
    });
  };

  const agregarFechaConstancia = () => {
    const fecha = limpiarTexto(form.fechaTemporal);

    if (!fecha) {
      toast.current?.show({
        severity: "warn",
        summary: "Falta fecha",
        detail: "Seleccioná una fecha de la capacitación.",
      });
      return;
    }

    if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha)) {
      toast.current?.show({
        severity: "warn",
        summary: "Fecha inválida",
        detail: "La fecha debe tener formato válido.",
      });
      return;
    }

    setForm((prev) => {
      const fechas = normalizarArrayFechas([
        ...prev.fechasConstancia,
        fecha,
      ]);

      return {
        ...prev,
        fechasConstancia: fechas,
        fechaTemporal: "",
      };
    });
  };

  const quitarFechaConstancia = (fecha) => {
    setForm((prev) => ({
      ...prev,
      fechasConstancia: prev.fechasConstancia.filter((f) => f !== fecha),
    }));
  };

  const validarFormulario = () => {
    if (!form.cursoId) {
      toast.current?.show({
        severity: "warn",
        summary: "Falta curso",
        detail: "Seleccioná un curso desde la lista.",
      });

      return false;
    }

    if (!limpiarTexto(form.cursoNombre)) {
      toast.current?.show({
        severity: "warn",
        summary: "Falta nombre",
        detail: "No se pudo obtener el nombre del curso.",
      });

      return false;
    }

    if (!limpiarTexto(form.resolucion)) {
      toast.current?.show({
        severity: "warn",
        summary: "Falta resolución",
        detail: "Ingresá la resolución.",
      });

      return false;
    }

    if (!limpiarTexto(form.diasCurso)) {
      toast.current?.show({
        severity: "warn",
        summary: "Faltan días",
        detail: "Ingresá los días del curso.",
      });

      return false;
    }

    if (!limpiarTexto(form.fechaEmision)) {
      toast.current?.show({
        severity: "warn",
        summary: "Falta fecha",
        detail: "Ingresá la fecha de emisión.",
      });

      return false;
    }

    if (!limpiarTexto(form.lugarEmision)) {
      toast.current?.show({
        severity: "warn",
        summary: "Falta lugar",
        detail: "Ingresá el lugar de emisión.",
      });

      return false;
    }

    if (normalizarArrayFechas(form.fechasConstancia).length === 0) {
      toast.current?.show({
        severity: "warn",
        summary: "Falta fecha de constancia",
        detail:
          "Agregá al menos una fecha en la que se mostrará el botón de constancia.",
      });

      return false;
    }

    return true;
  };

  const guardarCurso = async () => {
    if (!validarFormulario()) return;

    const fechasConstancia = normalizarArrayFechas(form.fechasConstancia);

    const payload = {
      cursoId: form.cursoId,
      cursoNombre: limpiarTexto(form.cursoNombre),
      resolucion: limpiarTexto(form.resolucion),
      diasCurso: limpiarTexto(form.diasCurso),
      fechaEmision: limpiarTexto(form.fechaEmision),
      lugarEmision: limpiarTexto(form.lugarEmision),

      textoBoton: TEXTO_BOTON_DEFAULT,

      habilitado: !!form.habilitado,

      fechasConstancia,
      fechasHabilitadasConstancia: fechasConstancia,
      fechasMostrarConstancia: fechasConstancia,
      fechaConstanciaPrincipal: fechasConstancia[0] || "",

      actualizadoEn: serverTimestamp(),
    };

    if (!editandoId) {
      payload.creadoEn = serverTimestamp();
    }

    setSaving(true);

    try {
      await setDoc(
        doc(db, ...SUBCOLECCION_CURSOS_CONSTANCIA, form.cursoId),
        payload,
        { merge: true }
      );

      toast.current?.show({
        severity: "success",
        summary: "Guardado",
        detail:
          "El curso quedó guardado en cod/constancia_certificado/cursos.",
      });

      cerrarFormulario();
    } catch (err) {
      console.error("Guardar curso constancia:", err);

      toast.current?.show({
        severity: "error",
        summary: "Error al guardar",
        detail:
          err?.message ||
          "No se pudo guardar el curso en cod/constancia_certificado/cursos.",
        life: 8000,
      });
    } finally {
      setSaving(false);
    }
  };

  const eliminarRegistro = async (row) => {
    const ok = window.confirm(
      `¿Seguro que querés eliminar la habilitación de "${row.cursoNombreFinal}"?`
    );

    if (!ok) return;

    setSaving(true);

    try {
      await deleteDoc(doc(db, ...SUBCOLECCION_CURSOS_CONSTANCIA, row.id));

      if (editandoId === row.id) {
        cerrarFormulario();
      }

      toast.current?.show({
        severity: "success",
        summary: "Eliminado",
        detail: "El curso fue eliminado de la configuración de constancias.",
      });
    } catch (err) {
      console.error("Eliminar curso constancia:", err);

      toast.current?.show({
        severity: "error",
        summary: "Error al eliminar",
        detail: err?.message || "No se pudo eliminar el curso.",
        life: 8000,
      });
    } finally {
      setSaving(false);
    }
  };

  const estadoBody = (row) => {
    return row.habilitado ? (
      <span className={styles.badgeSi}>Habilitado</span>
    ) : (
      <span className={styles.badgeNo}>Deshabilitado</span>
    );
  };

  const fechasBody = (row) => {
    const fechas = normalizarArrayFechas(row.fechasConstancia);

    return (
      <div className={styles.fechaTableCell}>
        {fechas.length === 0 ? (
          <span className={styles.fechaVacia}>Sin fechas</span>
        ) : (
          fechas.map((fecha) => (
            <span key={fecha} className={styles.fechaMiniChip}>
              {formatearFechaVisual(fecha)}
            </span>
          ))
        )}
      </div>
    );
  };

  const accionesBody = (row) => {
    return (
      <div className={styles.tableActions}>
        <Button
          label="Editar"
          icon="pi pi-pencil"
          severity="warning"
          size="small"
          onClick={() => editarRegistro(row)}
          disabled={saving}
        />

        <Button
          label="Eliminar"
          icon="pi pi-trash"
          severity="danger"
          size="small"
          onClick={() => eliminarRegistro(row)}
          disabled={saving}
        />
      </div>
    );
  };

  return (
    <Dialog
      header="Constancias / Certificados"
      visible={visible}
      style={{ width: 1220, maxWidth: "96vw" }}
      modal
      onHide={onHide}
      className={styles.dialog}
      contentClassName={styles.dialogContent}
    >
      <Toast ref={toast} />

      <div className={styles.container}>
        <section className={styles.headerPanel}>
          <div>
            <h2>Gestión de constancias y certificados</h2>
            <p>
              Esta ventana trabaja directamente sobre{" "}
              <b>cod/constancia_certificado/cursos</b>.
            </p>
          </div>

          <Button
            label="Nuevo curso"
            icon="pi pi-plus"
            severity="warning"
            onClick={abrirNuevo}
            disabled={saving}
          />
        </section>

        <section className={styles.card}>
          <div className={styles.cardHeader}>
            <div>
              <h3>Cursos habilitados</h3>
              <p>
                Total: <b>{registrosConCurso.length}</b> · Cursos disponibles
                para seleccionar: <b>{cursosOptions.length}</b>
              </p>
            </div>
          </div>

          <div className={styles.mobileCursosList}>
            {loadingRegistros && (
              <p className={styles.mobileEmpty}>Cargando cursos habilitados...</p>
            )}
            {!loadingRegistros && registrosConCurso.length === 0 && (
              <p className={styles.mobileEmpty}>No hay cursos habilitados.</p>
            )}
            {!loadingRegistros &&
              registrosConCurso.map((row) => (
                <article key={row.id || row.cursoId} className={styles.mobileCursoCard}>
                  <div className={styles.mobileCursoHeader}>
                    <div>
                      <h4>{row.cursoNombreFinal || "Curso sin nombre"}</h4>
                      <p>{row.resolucion || "Sin resolución cargada"}</p>
                    </div>
                    {estadoBody(row)}
                  </div>

                  <div className={styles.mobileCursoMeta}>
                    <span>
                      <b>Días</b>
                      {row.diasCurso || "-"}
                    </span>
                    <span>
                      <b>Fecha emisión</b>
                      {row.fechaEmision || "-"}
                    </span>
                  </div>

                  <div className={styles.mobileCursoFechas}>
                    <b>Fechas constancia</b>
                    {fechasBody(row)}
                  </div>

                  <div className={styles.mobileCursoActions}>
                    <Button
                      label="Editar"
                      icon="pi pi-pencil"
                      severity="warning"
                      size="small"
                      onClick={() => editarRegistro(row)}
                      disabled={saving}
                    />
                    <Button
                      label="Eliminar"
                      icon="pi pi-trash"
                      severity="danger"
                      size="small"
                      onClick={() => eliminarRegistro(row)}
                      disabled={saving}
                    />
                  </div>
                </article>
              ))}
          </div>

          <DataTable
            value={registrosConCurso}
            loading={loadingRegistros}
            emptyMessage="No hay cursos habilitados."
            responsiveLayout="scroll"
            className={styles.table}
            paginator
            rows={5}
            rowsPerPageOptions={[5, 10, 20]}
          >
            <Column
              field="cursoNombreFinal"
              header="Curso"
              style={{ minWidth: 280 }}
            />

            <Column
              field="resolucion"
              header="Resolución"
              style={{ minWidth: 190 }}
            />

            <Column
              field="diasCurso"
              header="Días"
              style={{ minWidth: 180 }}
            />

            <Column
              field="fechaEmision"
              header="Fecha emisión"
              style={{ minWidth: 220 }}
            />

            <Column
              header="Fechas constancia"
              body={fechasBody}
              style={{ minWidth: 230 }}
            />

            <Column
              header="Estado"
              body={estadoBody}
              style={{ width: 140 }}
            />

            <Column
              header="Acciones"
              body={accionesBody}
              style={{ width: 230 }}
            />
          </DataTable>
        </section>

        {modoFormulario && (
          <section className={styles.formCard}>
            <div className={styles.formHeader}>
              <div>
                <h3>
                  {modoFormulario === "editar"
                    ? "Editar curso habilitado"
                    : "Nuevo curso habilitado"}
                </h3>
                <p>
                  Indicá los datos de emisión y seleccioná en qué fecha de
                  asistencia se mostrará la constancia.
                </p>
              </div>

              <Button
                label="Cerrar formulario"
                icon="pi pi-times"
                severity="secondary"
                outlined
                onClick={cerrarFormulario}
                disabled={saving}
              />
            </div>

            <div className={styles.formGrid}>
              <div className={styles.formRowFull}>
                <label>Curso</label>

                <Dropdown
                  value={form.cursoId}
                  onChange={(e) => onSeleccionarCurso(e.value)}
                  options={cursosOptions}
                  optionLabel="label"
                  optionValue="value"
                  placeholder={
                    loadingCursos
                      ? "Cargando cursos..."
                      : "Seleccioná un curso"
                  }
                  loading={loadingCursos}
                  filter
                  showClear
                  emptyMessage="No se encontraron cursos"
                  emptyFilterMessage="No se encontraron cursos"
                  className="w-full"
                  disabled={
                    loadingCursos || saving || modoFormulario === "editar"
                  }
                />

                {cursosOptions.length === 0 && !loadingCursos && (
                  <small className={styles.errorText}>
                    No se encontraron cursos en la colección raíz{" "}
                    <b>{COLECCION_CURSOS}</b>.
                  </small>
                )}
              </div>

              <div className={styles.formRow}>
                <label>Resolución</label>
                <InputText
                  value={form.resolucion}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, resolucion: e.target.value }))
                  }
                  placeholder="Ej: RESOLUCIÓN 05/2026"
                  disabled={saving}
                />
              </div>

              <div className={styles.formRow}>
                <label>Días del curso</label>
                <InputText
                  value={form.diasCurso}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, diasCurso: e.target.value }))
                  }
                  placeholder="Ej: 28 Y 29 DE MAYO DE 2026"
                  disabled={saving}
                />
              </div>

              <div className={styles.formRow}>
                <label>Fecha de emisión</label>
                <InputText
                  value={form.fechaEmision}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, fechaEmision: e.target.value }))
                  }
                  placeholder="Ej: 29 DÍAS DE MAYO DEL 2026"
                  disabled={saving}
                />
              </div>

              <div className={styles.formRow}>
                <label>Lugar de emisión</label>
                <InputText
                  value={form.lugarEmision}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, lugarEmision: e.target.value }))
                  }
                  placeholder="San Fernando del Valle de Catamarca"
                  disabled={saving}
                />
              </div>

              <div className={styles.formRowSwitch}>
                <label>Habilitado</label>
                <InputSwitch
                  checked={form.habilitado}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, habilitado: e.value }))
                  }
                  disabled={saving}
                />
              </div>

              <div className={styles.formRowFull}>
                <label>Fechas en las que se mostrará la constancia</label>

                <div className={styles.fechaBox}>
                  <div className={styles.fechaSelector}>
                    <input
                      type="date"
                      value={form.fechaTemporal}
                      onChange={(e) =>
                        setForm((f) => ({
                          ...f,
                          fechaTemporal: e.target.value,
                        }))
                      }
                      className={styles.dateInput}
                      disabled={saving}
                    />

                    <Button
                      label="Agregar fecha"
                      icon="pi pi-plus"
                      severity="success"
                      onClick={agregarFechaConstancia}
                      disabled={saving || !form.fechaTemporal}
                    />
                  </div>

                  <small className={styles.fechasHelp}>
                    Ejemplo: si el curso fue el 28 y 29 de mayo, podés marcar
                    solo el 29/05/2026 para que la constancia aparezca
                    únicamente en esa asistencia.
                  </small>

                  <div className={styles.fechasList}>
                    {form.fechasConstancia.length === 0 ? (
                      <span className={styles.fechaVacia}>
                        Todavía no agregaste fechas.
                      </span>
                    ) : (
                      form.fechasConstancia.map((fecha) => (
                        <span key={fecha} className={styles.fechaChip}>
                          {formatearFechaVisual(fecha)}

                          <button
                            type="button"
                            onClick={() => quitarFechaConstancia(fecha)}
                            disabled={saving}
                            aria-label={`Quitar ${fecha}`}
                          >
                            ×
                          </button>
                        </span>
                      ))
                    )}
                  </div>
                </div>
              </div>
            </div>

            <div className={styles.dialogActions}>
              <Button
                label={
                  modoFormulario === "editar"
                    ? "Guardar cambios"
                    : "Guardar curso"
                }
                icon="pi pi-save"
                severity="success"
                onClick={guardarCurso}
                loading={saving}
                disabled={saving}
              />

              <Button
                label="Cancelar"
                icon="pi pi-times"
                severity="danger"
                outlined
                onClick={cerrarFormulario}
                disabled={saving}
              />
            </div>
          </section>
        )}
      </div>
    </Dialog>
  );
};

export default ModalConstanciasCertificados;
