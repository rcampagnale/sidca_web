// src/pages/Capacitaciones/RegistroAsistencia/MiRegistro.jsx
import React, { useEffect, useMemo, useState } from "react";
import { useSelector } from "react-redux";
import { useHistory } from "react-router-dom";
import {
  getFirestore,
  getDoc,
  doc,
  serverTimestamp,
  collection,
  query,
  where,
  limit,
  getDocs,
  addDoc,
} from "firebase/firestore";
import { InputText } from "primereact/inputtext";
import { Dropdown } from "primereact/dropdown";
import { Button } from "primereact/button";
import { Card } from "primereact/card";
import { Message } from "primereact/message";
import styles from "./miRegistro.module.css";

// Helpers fecha
const pad2 = (n) => String(n).padStart(2, "0");
const toDisplay = (d) =>
  `${pad2(d.getDate())}/${pad2(d.getMonth() + 1)}/${d.getFullYear()}`;
const parseDisplay = (s) => {
  if (!s) return null;
  const [dd, mm, yyyy] = s.split("/").map((n) => parseInt(n, 10));
  if (!Number.isFinite(dd) || !Number.isFinite(mm) || !Number.isFinite(yyyy))
    return null;
  return new Date(yyyy, mm - 1, dd);
};

// Normaliza “Afiliado”
const nombreAfiliado = (apellido, nombre) => {
  const ap = (apellido || "").trim();
  const no = (nombre || "").trim();
  const combinado = ap && no ? `${ap}, ${no}` : ap || no;
  return combinado
    .replace(/\s*,\s*/g, ", ")
    .replace(/\s+/g, " ")
    .trim();
};

// Toma el primer valor disponible entre varias claves posibles
const pick = (obj, keys) => {
  for (const k of keys) {
    const v = obj?.[k];
    if (v !== undefined && v !== null && String(v).trim() !== "")
      return String(v).trim();
  }
  return "";
};

const NIVELES = [
  { label: "Nivel Inicial", value: "Nivel Inicial" },
  { label: "Nivel Primario", value: "Nivel Primario" },
  { label: "Nivel Secundario", value: "Nivel Secundario" },
  { label: "Nivel Superior", value: "Nivel Superior" },
];

export default function MiRegistro() {
  const db = getFirestore();
  const history = useHistory();

  const user = useSelector((s) => s.user);
  const docId = user?.docId || localStorage.getItem("sidca_user_docId") || "";
  const dni = user?.dni || localStorage.getItem("sidca_user_dni") || "";

  // Perfil
  const [perfil, setPerfil] = useState({
    apellido: "",
    nombre: "",
    dni: "",
    departamento: "",
  });
  const [cargandoPerfil, setCargandoPerfil] = useState(true);
  const [perfilNoEncontrado, setPerfilNoEncontrado] = useState(false);

  // Cursos (títulos)
  const [cursos, setCursos] = useState([]);
  const [cargandoCursos, setCargandoCursos] = useState(true);
  const [cursosError, setCursosError] = useState("");
  const [cursoNombre, setCursoNombre] = useState("");

  // Selecciones
  const [nivel, setNivel] = useState("");

  // Guardado / botón global
  const [guardando, setGuardando] = useState(false);
  const [botonHabilitado, setBotonHabilitado] = useState(false);
  const [cargandoBoton, setCargandoBoton] = useState(true);

  // Asistencias
  const [asistencias, setAsistencias] = useState([]);
  const [cargandoAsistencias, setCargandoAsistencias] = useState(false);
  const [asisError, setAsisError] = useState("");

  const hoy = useMemo(() => new Date(), []);
  const fechaDisplay = toDisplay(hoy);

  // ---- PERFIL: usuarios + fallback a nuevoAfiliado para departamento ----
  useEffect(() => {
    (async () => {
      try {
        setCargandoPerfil(true);
        setPerfilNoEncontrado(false);

        let data = null;

        // a) por docId
        if (docId) {
          const ref = doc(db, "usuarios", docId);
          const snap = await getDoc(ref);
          if (snap.exists()) data = snap.data();
        }

        // b) por DNI
        if (!data && dni) {
          const qUsr = query(
            collection(db, "usuarios"),
            where("dni", "==", dni),
            limit(1)
          );
          const snap = await getDocs(qUsr);
          if (!snap.empty) data = snap.docs[0].data();
        }

        if (!data) {
          setPerfilNoEncontrado(true);
          setPerfil({
            apellido: "",
            nombre: "",
            dni: dni || "",
            departamento: "",
          });
          return;
        }

        // Perfil base desde usuarios
        let basePerfil = {
          apellido: data.apellido || "",
          nombre: data.nombre || "",
          dni: data.dni || dni || "",
          departamento: pick(data, [
            "departamento",
            "depto",
            "departamentoNombre",
          ]),
        };

        // Fallback: si departamento vacío, buscar en nuevoAfiliado por DNI
        if (!basePerfil.departamento && basePerfil.dni) {
          const qNA = query(
            collection(db, "nuevoAfiliado"),
            where("dni", "==", basePerfil.dni),
            limit(1)
          );
          const sNA = await getDocs(qNA);
          if (!sNA.empty) {
            const dNA = sNA.docs[0].data();
            const depFallback = pick(dNA, [
              "departamento",
              "depto",
              "departamentoNombre",
            ]);
            if (depFallback) {
              basePerfil.departamento = depFallback;
            }
          }
        }

        setPerfil(basePerfil);
      } catch (e) {
        console.error("Error cargando perfil:", e);
        setPerfilNoEncontrado(true);
      } finally {
        setCargandoPerfil(false);
      }
    })();
  }, [db, docId, dni]);

  // ---- Cursos (solo nombres) ----
  useEffect(() => {
    (async () => {
      try {
        setCargandoCursos(true);
        setCursosError("");
        const s = await getDocs(collection(db, "cursos"));
        const nombres = s.docs
          .map((d) => (d.data()?.titulo || "").trim())
          .filter(Boolean)
          .sort((a, b) => a.localeCompare(b));
        setCursos(nombres);
      } catch (err) {
        console.error("Error cargando cursos:", err);
        setCursos([]);
        setCursosError(
          "No se pudieron cargar los cursos. Verifique la conexión o permisos."
        );
      } finally {
        setCargandoCursos(false);
      }
    })();
  }, [db]);

  // ---- Botón global (cod/boton.cargar) ----
  useEffect(() => {
    (async () => {
      try {
        setCargandoBoton(true);
        const ref = doc(db, "cod", "boton");
        const snap = await getDoc(ref);
        setBotonHabilitado(
          snap.exists() &&
            String(snap.data()?.cargar).trim().toLowerCase() === "si"
        );
      } catch (e) {
        console.error("Error consultando 'cod/boton.cargar':", e);
        setBotonHabilitado(false);
      } finally {
        setCargandoBoton(false);
      }
    })();
  }, [db]);

  // ---- Asistencias por DNI ----
  const fetchAsistencias = async (dniValue) => {
    if (!dniValue) return;
    try {
      setCargandoAsistencias(true);
      setAsisError("");
      const qA = query(
        collection(db, "asistencia"),
        where("dni", "==", dniValue)
      );
      const snap = await getDocs(qA);
      const items = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      items.sort((a, b) => {
        const da =
          a?.createdAt?.seconds != null
            ? new Date(a.createdAt.seconds * 1000)
            : parseDisplay(a.fecha);
        const dbb =
          b?.createdAt?.seconds != null
            ? new Date(b.createdAt.seconds * 1000)
            : parseDisplay(b.fecha);
        return (dbb?.getTime() || 0) - (da?.getTime() || 0);
      });
      setAsistencias(items);
    } catch (e) {
      console.error("Error cargando asistencias:", e);
      setAsisError("No se pudieron cargar tus asistencias.");
      setAsistencias([]);
    } finally {
      setCargandoAsistencias(false);
    }
  };
  useEffect(() => {
    if (perfil?.dni) fetchAsistencias(perfil.dni);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [perfil?.dni]);

  // ---- Registrar (colección raíz 'asistencia') ----
  const registrar = async () => {
    if (!perfil?.dni) return alert("No se encontró el DNI del usuario.");
    if (perfilNoEncontrado)
      return alert("No se encontró el usuario en 'usuarios'.");
    if (!nivel) return alert("Seleccione un nivel educativo.");
    if (!cursoNombre) return alert("Seleccione un curso.");
    if (!botonHabilitado)
      return alert("El registro de asistencia está deshabilitado.");

    try {
      setGuardando(true);

      const qDup = query(
        collection(db, "asistencia"),
        where("dni", "==", perfil.dni)
      );
      const sDup = await getDocs(qDup);
      const yaExiste = sDup.docs.some((d) => {
        const x = d.data();
        return x?.fecha === fechaDisplay && x?.curso === cursoNombre;
        // Si quieres, agrega también un match por nivelEducativo
      });
      if (yaExiste)
        return alert(
          "Ya registraste asistencia para este curso en esta fecha."
        );

      await addDoc(collection(db, "asistencia"), {
        apellido: perfil.apellido || "Sin apellido",
        nombre: perfil.nombre || "Sin nombre",
        dni: perfil.dni || "Sin DNI",
        departamento: perfil.departamento || "Sin departamento",
        nivelEducativo: nivel,
        curso: cursoNombre,
        fecha: fechaDisplay,
        createdAt: serverTimestamp(),
      });

      alert("Asistencia registrada con éxito.");
      setNivel("");
      setCursoNombre("");
      fetchAsistencias(perfil.dni);
    } catch (e) {
      console.error(e);
      alert("No se pudo registrar. Intente nuevamente.");
    } finally {
      setGuardando(false);
    }
  };

  const botonDeshabilitado =
    cargandoPerfil ||
    perfilNoEncontrado ||
    cargandoCursos ||
    cursos.length === 0 ||
    !nivel ||
    !cursoNombre ||
    cargandoBoton ||
    !botonHabilitado;

  const goBackToCaps = () => history.push("/capacitaciones");

  const afiliadoLabel = useMemo(
    () => nombreAfiliado(perfil.apellido, perfil.nombre),
    [perfil.apellido, perfil.nombre]
  );

  return (
    <div className={styles.page}>
      <h2 className={styles.title}>Mi registro de asistencia</h2>

      {/* Perfil */}
      <Card className={styles.card}>
        <div className={`${styles.formGrid} ${styles.readonly}`}>
          <div className={`${styles.field} ${styles.colSpan2}`}>
            <label className={styles.label} htmlFor="afiliado">
              Afiliado
            </label>
            <InputText id="afiliado" value={afiliadoLabel} disabled />
          </div>
          <div className={styles.field}>
            <label className={styles.label} htmlFor="dni">
              DNI
            </label>
            <InputText id="dni" value={perfil.dni} disabled />
          </div>
          <div className={styles.field}>
            <label className={styles.label} htmlFor="depto">
              Departamento
            </label>
            <InputText id="depto" value={perfil.departamento} disabled />
          </div>
        </div>

        {cargandoPerfil && (
          <Message severity="info" text="Cargando perfil..." />
        )}
        {!cargandoPerfil && perfilNoEncontrado && (
          <Message
            severity="warn"
            text="No se encontró el usuario con el DNI provisto."
          />
        )}
      </Card>

      {/* Selección y acción */}
      <Card className={styles.card}>
        <div className={styles.formGrid}>
          <div className={styles.field}>
            <label className={styles.label} htmlFor="nivel">
              Nivel Educativo
            </label>
            <Dropdown
              id="nivel"
              value={nivel}
              onChange={(e) => setNivel(e.value)}
              options={NIVELES}
              optionLabel="label"
              optionValue="value"
              placeholder="Seleccione un nivel educativo"
              className="w-full"
              disabled={perfilNoEncontrado}
            />
          </div>

          <div className={styles.field}>
            <label className={styles.label} htmlFor="curso">
              Curso
            </label>
            <Dropdown
              id="curso"
              value={cursoNombre}
              onChange={(e) => setCursoNombre(e.value)}
              options={cursos.map((titulo) => ({
                label: titulo,
                value: titulo,
              }))}
              optionLabel="label"
              optionValue="value"
              placeholder={
                cargandoCursos ? "Cargando cursos..." : "Seleccione un curso"
              }
              className="w-full"
              disabled={
                perfilNoEncontrado || cargandoCursos || cursos.length === 0
              }
              filter
              filterBy="label"
              showClear
            />
          </div>

          <div className={styles.date}>
            <small>Fecha: {fechaDisplay}</small>
          </div>
        </div>

        <div className={styles.actions}>
          <Button
            type="button"
            label="Regresar a capacitaciones"
            icon="pi pi-arrow-left"
            className={`p-button-outlined p-button-secondary ${styles.btnBack}`}
            onClick={goBackToCaps}
          />
          <Button
            label={cargandoBoton ? "Verificando..." : "Registrar asistencia"}
            onClick={registrar}
            loading={guardando || cargandoBoton}
            disabled={botonDeshabilitado}
            className={styles.btnPrimary}
          />
        </div>

        {cursosError && <Message severity="error" text={cursosError} />}
        {!cargandoCursos && cursos.length === 0 && !cursosError && (
          <Message severity="warn" text="No hay cursos disponibles." />
        )}
      </Card>

      {/* Asistencias cargadas */}
      {/* Asistencias cargadas */}
      <Card className={styles.card}>
        <h3 className={styles.sectionTitle}>Asistencias cargadas</h3>

        {cargandoAsistencias && (
          <Message severity="info" text="Cargando asistencias..." />
        )}
        {asisError && <Message severity="error" text={asisError} />}

        {!cargandoAsistencias && !asisError && asistencias.length === 0 && (
          <Message severity="warn" text="Aún no registraste asistencias." />
        )}

        {!cargandoAsistencias && asistencias.length > 0 && (
          <div className={styles.asisList}>
            {Object.entries(
              asistencias.reduce((acc, a) => {
                const curso = a.curso || "(Sin curso)";
                if (!acc[curso]) acc[curso] = [];
                acc[curso].push(a.fecha || "-");
                return acc;
              }, {})
            ).map(([curso, fechas]) => (
              <div key={curso} className={styles.asisItem}>
                <div className={styles.asisItemTitle}>
                  Curso: <span className={styles.asisValue}>{curso}</span>
                </div>
                <div className={styles.asisItemMeta}>
                  Fechas:
                  <ul>
                    {fechas.map((f, i) => (
                      <li key={i}>{f}</li>
                    ))}
                  </ul>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
