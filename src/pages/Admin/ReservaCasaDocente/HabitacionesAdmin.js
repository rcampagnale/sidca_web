// src/pages/Admin/ReservaCasaDocente/HabitacionesAdmin.js
import React, { useState, useEffect } from "react";
import styles from "./HabitacionesAdmin.module.css";

import { dbReservas, storageReservas } from "../../../firebase/firebaseReservas";
import {
  collection,
  addDoc,
  onSnapshot,
  query,
  orderBy,
  serverTimestamp,
  updateDoc,
  doc,
  deleteDoc,
} from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";

const TIPOS_HABITACION = [
  { id: "simple", nombre: "Habitación simple" },
  { id: "doble", nombre: "Habitación doble" },
  { id: "triple", nombre: "Habitación triple" },
  { id: "cuadruple", nombre: "Habitación cuádruple" },
  { id: "departamento", nombre: "Departamento" },
];

// 🔹 Calcula el precio final por noche
const calcularPrecioFinal = (habitacion) => {
  if (!habitacion) return 0;

  const tipo = habitacion.tipo;
  const precioAfiliado = Number(habitacion.precio) || 0;
  const precioNoAfiliado = Number(habitacion.precioNoAfiliado) || 0;
  const camas = Number(habitacion.camas) || 1;

  if (!precioAfiliado) return 0;

  if (tipo === "simple") {
    return precioAfiliado;
  }

  const cantidadNoAfiliados = Math.max(camas - 1, 0);
  if (!precioNoAfiliado || cantidadNoAfiliados === 0) {
    return precioAfiliado;
  }

  return precioAfiliado + cantidadNoAfiliados * precioNoAfiliado;
};

const HabitacionesAdmin = ({ reservas = [] }) => {
  const [habitaciones, setHabitaciones] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);

  // Modal crear/editar
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [habitacionEditando, setHabitacionEditando] = useState(null);

  // Modal ver
  const [isViewOpen, setIsViewOpen] = useState(false);
  const [habitacionVer, setHabitacionVer] = useState(null);

  const [form, setForm] = useState({
    nombre: "",
    tipo: TIPOS_HABITACION[0].id,
    banos: 0,
    pequenaDescripcion: "",
    camas: "",
    descripcion: "",
    precio: "",
    precioNoAfiliado: "",
    ubicacion: "",
    estacionamiento: "si",
    imagenes: [],
  });

  const [errors, setErrors] = useState({});

  // 🔹 Cargar habitaciones desde Firestore en tiempo real
  useEffect(() => {
    const colRef = collection(dbReservas, "habitacionesCasaDocente");
    const q = query(colRef, orderBy("createdAt", "desc"));

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const data = snapshot.docs.map((docSnap) => ({
          id: docSnap.id,
          ...docSnap.data(),
        }));
        setHabitaciones(data);
        setCargando(false);
      },
      (error) => {
        console.error(
          "[HabitacionesAdmin] Error al cargar habitaciones:",
          error
        );
        setCargando(false);
      }
    );

    return () => unsubscribe();
  }, []);

  // ============= MODAL CREAR =============
  const abrirModalNueva = () => {
    setErrors({});
    setIsEditMode(false);
    setHabitacionEditando(null);
    setForm({
      nombre: "",
      tipo: TIPOS_HABITACION[0].id,
      banos: 0,
      pequenaDescripcion: "",
      camas: "",
      descripcion: "",
      precio: "",
      precioNoAfiliado: "",
      ubicacion: "",
      estacionamiento: "si",
      imagenes: [],
    });
    setIsModalOpen(true);
  };

  // ============= MODAL EDITAR =============
  const abrirModalEditar = (habitacion) => {
    setErrors({});
    setIsEditMode(true);
    setHabitacionEditando(habitacion);
    setForm({
      nombre: habitacion.nombre || "",
      tipo: habitacion.tipo || TIPOS_HABITACION[0].id,
      banos: habitacion.banos ?? 0,
      pequenaDescripcion: habitacion.pequenaDescripcion || "",
      camas: habitacion.camas ?? "",
      descripcion: habitacion.descripcion || "",
      precio: habitacion.precio ?? "",
      precioNoAfiliado: habitacion.precioNoAfiliado ?? "",
      ubicacion: habitacion.ubicacion || "",
      estacionamiento: habitacion.estacionamiento ? "si" : "no",
      imagenes: [],
    });
    setIsModalOpen(true);
  };

  const cerrarModal = () => {
    setIsModalOpen(false);
    setHabitacionEditando(null);
    setIsEditMode(false);
  };

  // ============= MODAL VER =============
  const abrirModalVer = (habitacion) => {
    setHabitacionVer(habitacion);
    setIsViewOpen(true);
  };

  const cerrarModalVer = () => {
    setIsViewOpen(false);
    setHabitacionVer(null);
  };

  // ============= FORM / VALIDACIÓN =============
  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleFileChange = (e) => {
    const files = Array.from(e.target.files || []).slice(0, 5);
    setForm((prev) => ({
      ...prev,
      imagenes: files,
    }));
  };

  const validar = () => {
    const newErrors = {};
    if (!form.camas) newErrors.camas = "La cantidad de camas es obligatoria.";
    if (!form.descripcion.trim())
      newErrors.descripcion = "La descripción es obligatoria.";
    if (!form.precio) newErrors.precio = "El precio es obligatorio.";
    if (!form.ubicacion.trim())
      newErrors.ubicacion = "La ubicación es obligatoria.";

    const yaTieneImagenes =
      isEditMode &&
      habitacionEditando &&
      Array.isArray(habitacionEditando.imagenes) &&
      habitacionEditando.imagenes.length > 0;

    if (!yaTieneImagenes && form.imagenes.length === 0) {
      newErrors.imagenes = "Subí al menos una imagen.";
    }

    return newErrors;
  };

  // ============= SUBMIT (CREAR / EDITAR) =============
  const handleSubmit = async (e) => {
    e.preventDefault();
    const newErrors = validar();
    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    try {
      setGuardando(true);

      if (isEditMode && habitacionEditando) {
        // ----- EDITAR -----
        const habitacionRef = doc(
          dbReservas,
          "habitacionesCasaDocente",
          habitacionEditando.id
        );

        const baseUpdate = {
          nombre: form.nombre || null,
          tipo: form.tipo,
          banos: Number(form.banos) || 0,
          pequenaDescripcion: form.pequenaDescripcion || "",
          camas: Number(form.camas) || 0,
          descripcion: form.descripcion.trim(),
          precio: Number(form.precio) || 0,
          precioNoAfiliado: Number(form.precioNoAfiliado) || 0,
          ubicacion: form.ubicacion.trim(),
          estacionamiento: form.estacionamiento === "si",
          updatedAt: serverTimestamp(),
        };

        await updateDoc(habitacionRef, baseUpdate);

        if (form.imagenes.length > 0) {
          const urlsNuevas = [];

          for (const file of form.imagenes) {
            const storageRef = ref(
              storageReservas,
              `habitaciones/${habitacionEditando.id}/${Date.now()}-${file.name}`
            );
            await uploadBytes(storageRef, file);
            const url = await getDownloadURL(storageRef);
            urlsNuevas.push(url);
          }

          const imagenesActuales = Array.isArray(habitacionEditando.imagenes)
            ? habitacionEditando.imagenes
            : [];

          await updateDoc(habitacionRef, {
            imagenes: [...imagenesActuales, ...urlsNuevas],
            updatedAt: serverTimestamp(),
          });
        }
      } else {
        // ----- CREAR -----
        const baseData = {
          nombre: form.nombre || null,
          tipo: form.tipo,
          banos: Number(form.banos) || 0,
          pequenaDescripcion: form.pequenaDescripcion || "",
          camas: Number(form.camas) || 0,
          descripcion: form.descripcion.trim(),
          precio: Number(form.precio) || 0,
          precioNoAfiliado: Number(form.precioNoAfiliado) || 0,
          ubicacion: form.ubicacion.trim(),
          estacionamiento: form.estacionamiento === "si",
          imagenes: [],
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        };

        const colRef = collection(dbReservas, "habitacionesCasaDocente");
        const docRef = await addDoc(colRef, baseData);

        const urls = [];

        for (const file of form.imagenes) {
          const storageRef = ref(
            storageReservas,
            `habitaciones/${docRef.id}/${Date.now()}-${file.name}`
          );
          await uploadBytes(storageRef, file);
          const url = await getDownloadURL(storageRef);
          urls.push(url);
        }

        if (urls.length > 0) {
          await updateDoc(docRef, {
            imagenes: urls,
            updatedAt: serverTimestamp(),
          });
        }
      }

      cerrarModal();
    } catch (error) {
      console.error("[HabitacionesAdmin] Error al guardar habitación:", error);
      alert(
        "Ocurrió un error al guardar la habitación. Revisá la consola para más detalles."
      );
    } finally {
      setGuardando(false);
    }
  };

  // ============= ELIMINAR =============
  const handleEliminar = async (habitacion) => {
    const confirmar = window.confirm(
      `¿Eliminar la habitación "${
        habitacion.nombre ||
        TIPOS_HABITACION.find((t) => t.id === habitacion.tipo)?.nombre ||
        habitacion.id
      }"? Esta acción no se puede deshacer.`
    );
    if (!confirmar) return;

    try {
      const habitacionRef = doc(
        dbReservas,
        "habitacionesCasaDocente",
        habitacion.id
      );
      await deleteDoc(habitacionRef);
    } catch (error) {
      console.error("[HabitacionesAdmin] Error al eliminar habitación:", error);
      alert(
        "Ocurrió un error al eliminar la habitación. Revisá la consola para más detalles."
      );
    }
  };

  // ============= DUPLICAR =============
  const handleDuplicar = async (habitacion) => {
    const tipoNombre =
      habitacion.nombre ||
      TIPOS_HABITACION.find((t) => t.id === habitacion.tipo)?.nombre ||
      habitacion.id;

    const confirmar = window.confirm(
      `¿Deseás duplicar la habitación "${tipoNombre}"? Esto creará una nueva habitación con los mismos datos e imágenes.`
    );
    if (!confirmar) return;

    try {
      const colRef = collection(dbReservas, "habitacionesCasaDocente");

      const baseData = {
        nombre: habitacion.nombre || null,
        tipo: habitacion.tipo,
        banos: habitacion.banos ?? 0,
        pequenaDescripcion: habitacion.pequenaDescripcion || "",
        camas: habitacion.camas ?? 0,
        descripcion: habitacion.descripcion || "",
        precio: habitacion.precio ?? 0,
        precioNoAfiliado: habitacion.precioNoAfiliado ?? 0,
        ubicacion: habitacion.ubicacion || "",
        estacionamiento: !!habitacion.estacionamiento,
        imagenes: Array.isArray(habitacion.imagenes)
          ? habitacion.imagenes
          : [],
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };

      await addDoc(colRef, baseData);
    } catch (error) {
      console.error("[HabitacionesAdmin] Error al duplicar habitación:", error);
      alert(
        "Ocurrió un error al duplicar la habitación. Revisá la consola para más detalles."
      );
    }
  };

  const getTipoNombre = (tipoId) =>
    TIPOS_HABITACION.find((t) => t.id === tipoId)?.nombre || tipoId;

  return (
    <div className={styles.wrapper}>
      {/* Header título + botón Agregar */}
      <div className={styles.headerRow}>
        <div>
          <h3 className={styles.title}>Habitaciones</h3>
          <p className={styles.subtitle}>
            Gestioná las habitaciones de la Casa del Docente.
          </p>
        </div>
        <button
          type="button"
          className={styles.primaryButton}
          onClick={abrirModalNueva}
        >
          + Agregar habitación
        </button>
      </div>

      {/* Listado de habitaciones cargadas */}
      <section className={styles.listadoSection}>
        <div className={styles.listadoHeader}>
          <h4 className={styles.listadoTitle}>Habitaciones cargadas</h4>
        </div>

        <div className={styles.tableWrapper}>
          {cargando ? (
            <p className={styles.emptyText}>Cargando habitaciones...</p>
          ) : habitaciones.length === 0 ? (
            <p className={styles.emptyText}>
              Todavía no cargaste habitaciones.
            </p>
          ) : (
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Tipo</th>
                  <th>Camas</th>
                  <th>Baños</th>
                  <th>Precio afiliado</th>
                  <th>Precio no afiliado</th>
                  <th>Precio final</th>
                  <th>Ubicación</th>
                  <th>Estac.</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {habitaciones.map((h) => {
                  const precioFinal = calcularPrecioFinal(h);
                  return (
                    <tr key={h.id}>
                      <td>{getTipoNombre(h.tipo)}</td>
                      <td>{h.camas}</td>
                      <td>{h.banos}</td>
                      <td>${h.precio}</td>
                      <td>
                        {h.precioNoAfiliado ? `$${h.precioNoAfiliado}` : "-"}
                      </td>
                      <td>{precioFinal ? `$${precioFinal}` : "-"}</td>
                      <td>{h.ubicacion}</td>
                      <td>{h.estacionamiento ? "Sí" : "No"}</td>
                      <td className={styles.actionCell}>
                        <div className={styles.actionButtons}>
                          <button
                            type="button"
                            className={styles.smallButton}
                            onClick={() => abrirModalVer(h)}
                          >
                            Ver
                          </button>
                          <button
                            type="button"
                            className={styles.smallButton}
                            onClick={() => abrirModalEditar(h)}
                          >
                            Editar
                          </button>
                          <button
                            type="button"
                            className={styles.smallButton}
                            onClick={() => handleDuplicar(h)}
                          >
                            Duplicar
                          </button>
                          <button
                            type="button"
                            className={`${styles.smallButton} ${styles.smallDangerButton}`}
                            onClick={() => handleEliminar(h)}
                          >
                            Eliminar
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </section>

      {/* Modal Crear/Editar habitación */}
      {isModalOpen && (
        <div className={styles.modalOverlay}>
          <div className={styles.modal}>
            <div className={styles.modalHeader}>
              <h3 className={styles.modalTitle}>
                {isEditMode ? "Editar habitación" : "Agregar habitación"}
              </h3>
            </div>

            <form className={styles.modalBody} onSubmit={handleSubmit}>
              <div className={styles.modalGrid}>
                <div className={styles.fieldGroup}>
                  <label className={styles.label} htmlFor="tipo">
                    Tipo de habitación
                  </label>
                  <select
                    id="tipo"
                    name="tipo"
                    className={styles.input}
                    value={form.tipo}
                    onChange={handleChange}
                  >
                    {TIPOS_HABITACION.map((tipo) => (
                      <option key={tipo.id} value={tipo.id}>
                        {tipo.nombre}
                      </option>
                    ))}
                  </select>
                </div>

                <div className={styles.fieldGroup}>
                  <label className={styles.label} htmlFor="nombre">
                    Nombre / código interno (opcional)
                  </label>
                  <input
                    id="nombre"
                    name="nombre"
                    type="text"
                    className={styles.input}
                    value={form.nombre}
                    onChange={handleChange}
                    placeholder="Ej: Hab. 101, Dpto 2B"
                  />
                </div>

                <div className={styles.fieldGroup}>
                  <label className={styles.label} htmlFor="banos">
                    Cantidad de baños
                  </label>
                  <input
                    id="banos"
                    name="banos"
                    type="number"
                    min="0"
                    className={styles.input}
                    value={form.banos}
                    onChange={handleChange}
                  />
                </div>

                <div className={styles.fieldGroup}>
                  <label
                    className={styles.label}
                    htmlFor="pequenaDescripcion"
                  >
                    Pequeña descripción (opcional)
                  </label>
                  <input
                    id="pequenaDescripcion"
                    name="pequenaDescripcion"
                    type="text"
                    className={styles.input}
                    value={form.pequenaDescripcion}
                    onChange={handleChange}
                    placeholder="Ej: Vista a la ciudad, primer piso"
                  />
                </div>

                <div className={styles.fieldGroup}>
                  <label className={styles.label} htmlFor="camas">
                    Cantidad de camas<span className={styles.required}> *</span>
                  </label>
                  <input
                    id="camas"
                    name="camas"
                    type="number"
                    min="1"
                    className={styles.input}
                    value={form.camas}
                    onChange={handleChange}
                  />
                  {errors.camas && (
                    <p className={styles.errorText}>{errors.camas}</p>
                  )}
                </div>

                <div className={styles.fieldGroup}>
                  <label className={styles.label} htmlFor="descripcion">
                    Descripción<span className={styles.required}> *</span>
                  </label>
                  <textarea
                    id="descripcion"
                    name="descripcion"
                    className={`${styles.input} ${styles.textarea}`}
                    value={form.descripcion}
                    onChange={handleChange}
                    placeholder="Descripción completa de la habitación..."
                  />
                  {errors.descripcion && (
                    <p className={styles.errorText}>{errors.descripcion}</p>
                  )}
                </div>

                {/* Precio afiliado */}
                <div className={styles.fieldGroup}>
                  <label className={styles.label} htmlFor="precio">
                    Precio por noche (Afiliado) (ARS)
                    <span className={styles.required}> *</span>
                  </label>
                  <input
                    id="precio"
                    name="precio"
                    type="number"
                    min="0"
                    className={styles.input}
                    value={form.precio}
                    onChange={handleChange}
                  />
                  {errors.precio && (
                    <p className={styles.errorText}>{errors.precio}</p>
                  )}
                </div>

                {/* Precio no afiliado */}
                <div className={styles.fieldGroup}>
                  <label
                    className={styles.label}
                    htmlFor="precioNoAfiliado"
                  >
                    Precio por noche (No afiliado) (ARS)
                  </label>
                  <input
                    id="precioNoAfiliado"
                    name="precioNoAfiliado"
                    type="number"
                    min="0"
                    className={styles.input}
                    value={form.precioNoAfiliado}
                    onChange={handleChange}
                    placeholder="Ej: 12000"
                  />
                </div>

                <div className={styles.fieldGroup}>
                  <label className={styles.label} htmlFor="ubicacion">
                    Ubicación<span className={styles.required}> *</span>
                  </label>
                  <input
                    id="ubicacion"
                    name="ubicacion"
                    type="text"
                    className={styles.input}
                    value={form.ubicacion}
                    onChange={handleChange}
                    placeholder="Ej: Planta baja, ala norte"
                  />
                  {errors.ubicacion && (
                    <p className={styles.errorText}>{errors.ubicacion}</p>
                  )}
                </div>

                <div className={styles.fieldGroup}>
                  <label className={styles.label} htmlFor="estacionamiento">
                    ¿Tiene estacionamiento?
                  </label>
                  <select
                    id="estacionamiento"
                    name="estacionamiento"
                    className={styles.input}
                    value={form.estacionamiento}
                    onChange={handleChange}
                  >
                    <option value="si">Sí</option>
                    <option value="no">No</option>
                  </select>
                </div>

                <div className={styles.fieldGroup}>
                  <label className={styles.label} htmlFor="imagenes">
                    Subir imágenes (máximo 5)
                    <span className={styles.required}> *</span>
                  </label>
                  <input
                    id="imagenes"
                    name="imagenes"
                    type="file"
                    accept="image/*"
                    multiple
                    className={styles.inputFile}
                    onChange={handleFileChange}
                  />
                  {habitacionEditando &&
                    Array.isArray(habitacionEditando.imagenes) &&
                    habitacionEditando.imagenes.length > 0 && (
                      <p className={styles.imagesInfo}>
                        Imágenes actuales: {habitacionEditando.imagenes.length}.
                        Si cargás nuevas imágenes, se sumarán a las existentes.
                      </p>
                    )}
                  {errors.imagenes && (
                    <p className={styles.errorText}>{errors.imagenes}</p>
                  )}
                  {form.imagenes.length > 0 && (
                    <ul className={styles.filesList}>
                      {form.imagenes.map((file, index) => (
                        <li key={index}>{file.name}</li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>

              <div className={styles.modalFooter}>
                <button
                  type="button"
                  className={styles.secondaryButton}
                  onClick={cerrarModal}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className={styles.primaryButton}
                  disabled={guardando}
                >
                  {guardando
                    ? "Guardando..."
                    : isEditMode
                    ? "Guardar cambios"
                    : "Guardar habitación"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal VER habitación */}
      {isViewOpen && habitacionVer && (
        <div className={styles.modalOverlay}>
          <div className={styles.modal}>
            <div className={styles.modalHeader}>
              <h3 className={styles.modalTitle}>Detalle de habitación</h3>
            </div>

            <div className={styles.modalBody}>
              <div className={styles.modalGrid}>
                <div className={styles.fieldGroup}>
                  <span className={styles.label}>Tipo</span>
                  <p className={styles.valueText}>
                    {getTipoNombre(habitacionVer.tipo)}
                  </p>
                </div>
                {habitacionVer.nombre && (
                  <div className={styles.fieldGroup}>
                    <span className={styles.label}>Nombre / código</span>
                    <p className={styles.valueText}>{habitacionVer.nombre}</p>
                  </div>
                )}
                <div className={styles.fieldGroup}>
                  <span className={styles.label}>Camas</span>
                  <p className={styles.valueText}>{habitacionVer.camas}</p>
                </div>
                <div className={styles.fieldGroup}>
                  <span className={styles.label}>Baños</span>
                  <p className={styles.valueText}>{habitacionVer.banos}</p>
                </div>
                <div className={styles.fieldGroup}>
                  <span className={styles.label}>Precio afiliado</span>
                  <p className={styles.valueText}>${habitacionVer.precio}</p>
                </div>
                <div className={styles.fieldGroup}>
                  <span className={styles.label}>Precio no afiliado</span>
                  <p className={styles.valueText}>
                    {habitacionVer.precioNoAfiliado
                      ? `$${habitacionVer.precioNoAfiliado}`
                      : "-"}
                  </p>
                </div>
                <div className={styles.fieldGroup}>
                  <span className={styles.label}>Precio final</span>
                  <p className={styles.valueText}>
                    {calcularPrecioFinal(habitacionVer)
                      ? `$${calcularPrecioFinal(habitacionVer)}`
                      : "-"}
                  </p>
                </div>
                <div className={styles.fieldGroup}>
                  <span className={styles.label}>Ubicación</span>
                  <p className={styles.valueText}>{habitacionVer.ubicacion}</p>
                </div>
                <div className={styles.fieldGroup}>
                  <span className={styles.label}>Estacionamiento</span>
                  <p className={styles.valueText}>
                    {habitacionVer.estacionamiento ? "Sí" : "No"}
                  </p>
                </div>
                {habitacionVer.pequenaDescripcion && (
                  <div className={styles.fieldGroup}>
                    <span className={styles.label}>Descripción corta</span>
                    <p className={styles.valueText}>
                      {habitacionVer.pequenaDescripcion}
                    </p>
                  </div>
                )}
                <div className={styles.fieldGroup}>
                  <span className={styles.label}>Descripción</span>
                  <p className={styles.valueText}>
                    {habitacionVer.descripcion}
                  </p>
                </div>
              </div>

              {Array.isArray(habitacionVer.imagenes) &&
                habitacionVer.imagenes.length > 0 && (
                  <div className={styles.viewImagesWrapper}>
                    <span className={styles.label}>Imágenes</span>
                    <div className={styles.viewImagesGrid}>
                      {habitacionVer.imagenes.map((url, idx) => (
                        <img
                          key={idx}
                          src={url}
                          alt={`Imagen ${idx + 1}`}
                          className={styles.viewImageThumb}
                        />
                      ))}
                    </div>
                  </div>
                )}
            </div>

            <div className={styles.modalFooter}>
              <button
                type="button"
                className={styles.secondaryButton}
                onClick={cerrarModalVer}
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default HabitacionesAdmin;
