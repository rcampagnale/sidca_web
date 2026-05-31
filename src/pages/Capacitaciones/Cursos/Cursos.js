import React, { useEffect, useMemo, useState } from "react";
import styles from "./styles.module.css";
import { useHistory, useParams } from "react-router-dom";
import { useDispatch, useSelector, shallowEqual } from "react-redux";
import CursosSkeleton from "../../../components/Cursos/CursosSkeleton";
import CursosCard from "../../../components/Cards/CursosCard";
import {
  clearCursos,
  getCursosCategory,
  getMisCursos,
  getCursosDisponibles,
} from "../../../redux/reducers/cursos/actions";
import { Button } from "primereact/button";

import {
  collection,
  getDocs,
  limit,
  query,
  where,
} from "firebase/firestore";
import { db } from "../../../firebase/firebase-config";

const normalizarTexto = (valor) => {
  return String(valor ?? "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
};

const normalizarDni = (valor) => {
  return String(valor ?? "").replace(/\D/g, "").trim();
};

const esValorAprobado = (valor) => {
  if (valor === true) return true;
  if (valor === 1) return true;

  const texto = normalizarTexto(valor);

  return [
    "true",
    "si",
    "sí",
    "aprobado",
    "aprobada",
    "aprobo",
    "aprobó",
    "aprobado/a",
    "terminado",
    "terminada",
    "finalizado",
    "finalizada",
  ].includes(texto);
};

const esCursoAprobado = (curso = {}) => {
  return [
    curso.aprobo,
    curso.aprobado,
    curso.aprobada,
    curso.aprobacion,
    curso.estadoAprobacion,
    curso.estado,
    curso.condicion,
    curso.resultado,
    curso.status,
    curso.finalizado,
    curso.finalizada,
  ].some(esValorAprobado);
};

const buscarClaveProfunda = (obj, clavesPermitidas, profundidad = 0) => {
  if (!obj || typeof obj !== "object" || profundidad > 5) return "";

  for (const clave of Object.keys(obj)) {
    const claveNormalizada = normalizarTexto(clave);

    if (clavesPermitidas.includes(claveNormalizada)) {
      const valor = obj[clave];

      if (
        valor !== null &&
        valor !== undefined &&
        typeof valor !== "object" &&
        String(valor).trim() !== ""
      ) {
        return valor;
      }
    }
  }

  for (const clave of Object.keys(obj)) {
    const valor = obj[clave];

    if (valor && typeof valor === "object") {
      const encontrado = buscarClaveProfunda(
        valor,
        clavesPermitidas,
        profundidad + 1
      );

      if (encontrado) return encontrado;
    }
  }

  return "";
};

const obtenerIdentidadDesdeLocalStorage = () => {
  try {
    const posiblesKeys = [
      "user",
      "usuario",
      "currentUser",
      "authUser",
      "afiliado",
      "datosUsuario",
    ];

    for (const key of posiblesKeys) {
      const raw = localStorage.getItem(key);
      if (!raw) continue;

      try {
        const data = JSON.parse(raw);

        const dni = buscarClaveProfunda(data, [
          "dni",
          "documento",
          "nrodocumento",
          "numerodocumento",
        ]);

        const email = buscarClaveProfunda(data, [
          "email",
          "correo",
          "mail",
        ]);

        if (dni || email) {
          return {
            dni: normalizarDni(dni),
            email: String(email || "").trim().toLowerCase(),
            origen: `localStorage:${key}`,
          };
        }
      } catch {
        // Continúa con la siguiente key.
      }
    }
  } catch {
    // Evita cortar la pantalla si localStorage no está disponible.
  }

  return {
    dni: "",
    email: "",
    origen: "localStorage:no-encontrado",
  };
};

const obtenerIdentidadDesdeRedux = (state) => {
  const dni = buscarClaveProfunda(state, [
    "dni",
    "documento",
    "nrodocumento",
    "numerodocumento",
  ]);

  const email = buscarClaveProfunda(state, [
    "email",
    "correo",
    "mail",
  ]);

  return {
    dni: normalizarDni(dni),
    email: String(email || "").trim().toLowerCase(),
    origen: "redux",
  };
};

const buscarDocumentoUsuario = async ({ dni, email }) => {
  const usuariosRef = collection(db, "usuarios");

  const consultas = [];
  const dniLimpio = normalizarDni(dni);

  if (dniLimpio) {
    consultas.push(
      query(usuariosRef, where("dni", "==", dniLimpio), limit(1))
    );

    consultas.push(
      query(usuariosRef, where("dni", "==", Number(dniLimpio)), limit(1))
    );
  }

  if (email) {
    consultas.push(
      query(usuariosRef, where("correo", "==", email), limit(1))
    );

    consultas.push(
      query(usuariosRef, where("email", "==", email), limit(1))
    );
  }

  for (const consulta of consultas) {
    const snap = await getDocs(consulta);

    if (!snap.empty) {
      const docUsuario = snap.docs[0];

      return {
        id: docUsuario.id,
        ...docUsuario.data(),
      };
    }
  }

  return null;
};

const cargarCursosDelUsuarioDesdeFirestore = async ({ dni, email }) => {
  const usuarioEncontrado = await buscarDocumentoUsuario({ dni, email });

  if (!usuarioEncontrado?.id) {
    return [];
  }

  const cursosRef = collection(db, "usuarios", usuarioEncontrado.id, "cursos");
  const cursosSnap = await getDocs(cursosRef);

  return cursosSnap.docs.map((docCurso) => ({
    id: docCurso.id,
    ...docCurso.data(),
    usuarioDocId: usuarioEncontrado.id,
  }));
};

const CursosUser = () => {
  const history = useHistory();
  const dispatch = useDispatch();
  const { type } = useParams();

  const cursos = useSelector((state) => state.cursos);

  const identidadRedux = useSelector(
    (state) => obtenerIdentidadDesdeRedux(state),
    shallowEqual
  );

  const identidadLocalStorage = useMemo(
    () => obtenerIdentidadDesdeLocalStorage(),
    []
  );

  const identidadUsuario = useMemo(() => {
    return {
      dni: identidadRedux?.dni || identidadLocalStorage?.dni || "",
      email: identidadRedux?.email || identidadLocalStorage?.email || "",
      origen:
        identidadRedux?.dni || identidadRedux?.email
          ? identidadRedux?.origen
          : identidadLocalStorage?.origen,
    };
  }, [identidadRedux, identidadLocalStorage]);

  const [misCursosFirestore, setMisCursosFirestore] = useState([]);
  const [loadingFirestore, setLoadingFirestore] = useState(false);

  const esMisCursos = type === "mis-cursos";

  const esCursosDisponibles =
    type === "cursos-disponibles" || type === "disponibles";

  const esCursosAprobados =
    type === "cursos-aprobados" ||
    type === "aprobados" ||
    type === "mis-cursos-aprobados";

  useEffect(() => {
    if (!type) {
      history.push("/capacitaciones");
      return undefined;
    }

    if (esMisCursos || esCursosAprobados) {
      dispatch(getMisCursos());
    } else if (esCursosDisponibles) {
      dispatch(getCursosDisponibles());
    } else {
      dispatch(getCursosCategory(type));
    }

    return () => {
      dispatch(clearCursos());
    };
  }, [
    type,
    dispatch,
    history,
    esMisCursos,
    esCursosAprobados,
    esCursosDisponibles,
  ]);

  useEffect(() => {
    const cargarDesdeFirestore = async () => {
      if (!esMisCursos && !esCursosAprobados) return;

      setLoadingFirestore(true);

      try {
        const cursosDirectos = await cargarCursosDelUsuarioDesdeFirestore({
          dni: identidadUsuario.dni,
          email: identidadUsuario.email,
        });

        setMisCursosFirestore(cursosDirectos);
      } catch {
        setMisCursosFirestore([]);
      } finally {
        setLoadingFirestore(false);
      }
    };

    cargarDesdeFirestore();
  }, [
    esMisCursos,
    esCursosAprobados,
    identidadUsuario.dni,
    identidadUsuario.email,
  ]);

  const titulo = useMemo(() => {
    if (esMisCursos) return "Mis Cursos";
    if (esCursosDisponibles) return "Cursos Disponibles";
    if (esCursosAprobados) return "Cursos Aprobados";
    return `Cursos ${type}`;
  }, [type, esMisCursos, esCursosDisponibles, esCursosAprobados]);

  const misCursosRedux = Array.isArray(cursos?.misCursos)
    ? cursos.misCursos
    : [];

  const cursosGenerales = Array.isArray(cursos?.cursos)
    ? cursos.cursos
    : [];

  const misCursosFinales =
    misCursosRedux.length > 0 ? misCursosRedux : misCursosFirestore;

  const misCursosAprobados = misCursosFinales.filter(esCursoAprobado);

  const EmptyBox = ({ text }) => (
    <div className={styles.boxContainer}>
      <h1 className={styles.title}>{text}</h1>

      <Button
        label="Volver"
        icon="pi pi-arrow-left"
        onClick={() => history.push("/capacitaciones")}
      />
    </div>
  );

  const loadingPantalla = cursos?.processing || loadingFirestore;

  return (
    <div className={styles.mainContainer}>
      <h1 className={styles.title}>{titulo}</h1>

      <div style={{ marginBottom: "1.5rem" }}>
        <Button
          label="Regresar a Capacitaciones"
          icon="pi pi-arrow-left"
          className="p-button-secondary"
          onClick={() => history.push("/capacitaciones")}
        />
      </div>

      {loadingPantalla ? (
        <CursosSkeleton />
      ) : esMisCursos ? (
        misCursosFinales.length === 0 ? (
          <EmptyBox text="No tienes Cursos" />
        ) : (
          <div className={styles.container}>
            {misCursosFinales.map((curso, index) => (
              <CursosCard
                key={curso.id || curso.cursoId || index}
                curso={curso}
                miCurso={true}
              />
            ))}
          </div>
        )
      ) : esCursosAprobados ? (
        misCursosAprobados.length === 0 ? (
          <EmptyBox text="No tienes Cursos Aprobados" />
        ) : (
          <div className={styles.container}>
            {misCursosAprobados.map((curso, index) => (
              <CursosCard
                key={curso.id || curso.cursoId || index}
                curso={curso}
                miCurso={true}
              />
            ))}
          </div>
        )
      ) : cursosGenerales.length === 0 ? (
        <EmptyBox
          text={
            esCursosDisponibles
              ? "No hay cursos disponibles"
              : "No hay cursos en esta categoría"
          }
        />
      ) : (
        <div className={styles.container}>
          {(esCursosDisponibles
            ? cursosGenerales
            : [...cursosGenerales].reverse()
          ).map((curso, index) => (
            <CursosCard
              key={curso.id || curso.cursoId || index}
              curso={curso}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export default CursosUser;