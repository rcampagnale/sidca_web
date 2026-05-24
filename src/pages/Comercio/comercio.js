// src/pages/Comercio/comercio.js

import React, { useEffect, useRef, useState } from "react";
import { useHistory, useLocation } from "react-router-dom";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  query,
  where,
} from "firebase/firestore";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { auth, db } from "../../firebase/firebase-config";
import styles from "./comercio.module.css";
import portada from "../../assets/img/somos3.jpg";
import credencialFondo from "../../assets/credencial/credencial.jpg";

const COLECCIONES_BUSQUEDA = ["usuarios", "nuevoAfiliado"];

const STORAGE_KEY_COMERCIO = "sidca_comercio_auth";
const COMERCIO_EMAIL = "comercio@sidca.com";

const limpiarDni = (value) => {
  return String(value || "").replace(/\D/g, "").trim();
};

const generarVariantesDni = (dniLimpio) => {
  const variantes = new Set();

  if (dniLimpio) {
    variantes.add(dniLimpio);

    const dniNumero = Number(dniLimpio);

    if (!Number.isNaN(dniNumero)) {
      variantes.add(dniNumero);
    }
  }

  return Array.from(variantes).filter(
    (valor) => valor !== "" && valor !== null && valor !== undefined
  );
};

const obtenerValor = (data, rutas = []) => {
  for (const ruta of rutas) {
    const partes = ruta.split(".");
    let valor = data;

    for (const parte of partes) {
      valor = valor?.[parte];
    }

    if (valor !== undefined && valor !== null && String(valor).trim() !== "") {
      return String(valor).trim();
    }
  }

  return "";
};

/**
 * Corrige casos donde en usuarios viene:
 * nombre: "Endrizzi, Sergio Adrián Nicolás"
 *
 * Resultado:
 * apellido: "Endrizzi"
 * nombre: "Sergio Adrián Nicolás"
 */
const separarApellidoNombre = ({ apellidoOriginal, nombreOriginal }) => {
  let apellido = String(apellidoOriginal || "").trim();
  let nombre = String(nombreOriginal || "").trim();

  if (!apellido && nombre.includes(",")) {
    const partes = nombre.split(",");

    apellido = partes[0]?.trim() || "";
    nombre = partes.slice(1).join(",").trim() || "";
  }

  return {
    apellido: apellido || "Sin registrar",
    nombre: nombre || "Sin registrar",
  };
};

const normalizarAfiliado = (docSnap, coleccionOrigen) => {
  const data = docSnap.data() || {};

  const apellidoOriginal = obtenerValor(data, [
    "apellido",
    "apellidos",
    "Apellido",
    "APELLIDO",
    "apellidoAfiliado",
    "profile.apellido",
    "profue.apellido",
    "datos.apellido",
    "usuario.apellido",
  ]);

  const nombreOriginal = obtenerValor(data, [
    "nombre",
    "nombres",
    "Nombre",
    "NOMBRE",
    "nombreAfiliado",
    "nombreCompleto",
    "apellidoNombre",
    "apellido_nombre",
    "apellidoyNombre",
    "displayName",
    "profile.nombre",
    "profile.nombres",
    "profile.nombreCompleto",
    "profue.nombre",
    "profue.nombres",
    "profue.nombreCompleto",
    "datos.nombre",
    "usuario.nombre",
  ]);

  const datosNombre = separarApellidoNombre({
    apellidoOriginal,
    nombreOriginal,
  });

  return {
    id: docSnap.id,
    origen: coleccionOrigen,

    apellido: datosNombre.apellido,
    nombre: datosNombre.nombre,

    dni:
      obtenerValor(data, [
        "dni",
        "DNI",
        "documento",
        "Documento",
        "numeroDocumento",
        "dniAfiliado",
        "profile.dni",
        "profile.DNI",
        "profue.dni",
        "profue.DNI",
        "datos.dni",
        "usuario.dni",
      ]) ||
      docSnap.id ||
      "Sin registrar",

    departamento:
      obtenerValor(data, [
        "departamento",
        "Departamento",
        "depto",
        "Depto",
        "localidad",
        "Localidad",
        "profile.departamento",
        "profile.localidad",
        "profue.departamento",
        "profue.localidad",
        "datos.departamento",
        "usuario.departamento",
      ]) || "Sin registrar",
  };
};

const buscarEnColeccion = async (nombreColeccion, dniLimpio) => {
  /*
    1. Buscar por ID del documento.
    Sirve si algún documento tiene como ID el DNI.
  */
  try {
    const docRef = doc(db, nombreColeccion, dniLimpio);
    const docSnap = await getDoc(docRef);

    if (docSnap.exists()) {
      return normalizarAfiliado(docSnap, nombreColeccion);
    }
  } catch (error) {
    console.warn(`No se pudo buscar por ID en ${nombreColeccion}:`, error);
  }

  /*
    2. Buscar por campos posibles de DNI.
    En nuevoAfiliado normalmente el campo es: dni.
    En usuarios puede variar según cómo esté armado el documento.
  */
  const camposDni = [
    "dni",
    "DNI",
    "documento",
    "Documento",
    "numeroDocumento",
    "dniAfiliado",
    "profile.dni",
    "profile.DNI",
    "profue.dni",
    "profue.DNI",
    "datos.dni",
    "usuario.dni",
  ];

  const variantesDni = generarVariantesDni(dniLimpio);

  for (const campo of camposDni) {
    for (const valor of variantesDni) {
      try {
        const q = query(
          collection(db, nombreColeccion),
          where(campo, "==", valor),
          limit(1)
        );

        const snap = await getDocs(q);

        if (!snap.empty) {
          return normalizarAfiliado(snap.docs[0], nombreColeccion);
        }
      } catch (error) {
        console.warn(
          `No se pudo buscar en ${nombreColeccion} por el campo ${campo}:`,
          error
        );
      }
    }
  }

  return null;
};

const buscarAfiliadoPorDni = async (dniLimpio) => {
  for (const nombreColeccion of COLECCIONES_BUSQUEDA) {
    const resultado = await buscarEnColeccion(nombreColeccion, dniLimpio);

    if (resultado) {
      return resultado;
    }
  }

  return null;
};

const guardarMarcaSesionComercio = (user) => {
  localStorage.setItem(
    STORAGE_KEY_COMERCIO,
    JSON.stringify({
      logged: true,
      uid: user.uid,
      email: user.email,
      fecha: new Date().toISOString(),
    })
  );
};

const cerrarSesionComercio = async () => {
  try {
    await signOut(auth);
  } catch (error) {
    console.warn("No se pudo cerrar sesión de comercio:", error);
  } finally {
    localStorage.removeItem(STORAGE_KEY_COMERCIO);
  }
};

const Comercio = () => {
  const history = useHistory();
  const location = useLocation();
  const consultaRef = useRef(null);

  const [dni, setDni] = useState("");
  const [loading, setLoading] = useState(false);
  const [credencial, setCredencial] = useState(null);
  const [mensaje, setMensaje] = useState("");
  const [mostrarConsulta, setMostrarConsulta] = useState(false);
  const [verificandoSesion, setVerificandoSesion] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const consultaActiva = params.get("consulta") === "1";

    /*
      Si está en /comercio sin consulta, se considera fuera del sector privado.
      Esto fuerza a que, si vuelve con flecha adelante a /comercio?consulta=1,
      tenga que loguearse nuevamente.
    */
    if (!consultaActiva) {
      cerrarSesionComercio();

      setMostrarConsulta(false);
      setDni("");
      setCredencial(null);
      setMensaje("");
      setVerificandoSesion(false);
      return;
    }

    setVerificandoSesion(true);

    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (!user || user.email !== COMERCIO_EMAIL) {
        localStorage.removeItem(STORAGE_KEY_COMERCIO);

        const redirect = encodeURIComponent(
          `${location.pathname}${location.search}`
        );

        history.replace(`/comercio-login?redirect=${redirect}`);
        return;
      }

      guardarMarcaSesionComercio(user);

      setMostrarConsulta(true);
      setVerificandoSesion(false);

      setTimeout(() => {
        consultaRef.current?.scrollIntoView({
          behavior: "smooth",
          block: "start",
        });
      }, 100);
    });

    return () => {
      unsubscribe();
    };
  }, [location.pathname, location.search, history]);

  /*
    Si el componente Comercio se desmonta porque el usuario sale hacia otra ruta,
    se cierra la sesión de comercio. Esto cubre navegación interna, logo,
    botón salir y flechas del navegador.
  */
  useEffect(() => {
    return () => {
      cerrarSesionComercio();
    };
  }, []);

  const buscarAfiliado = async (e) => {
    e.preventDefault();

    const dniLimpio = limpiarDni(dni);

    setMensaje("");
    setCredencial(null);

    if (!dniLimpio) {
      setMensaje("Ingrese un DNI para realizar la consulta.");
      return;
    }

    if (dniLimpio.length < 6) {
      setMensaje("El DNI ingresado parece incompleto.");
      return;
    }

    setLoading(true);

    try {
      const resultado = await buscarAfiliadoPorDni(dniLimpio);

      if (!resultado) {
        setMensaje("No se encontró un afiliado registrado con el DNI ingresado.");
        return;
      }

      setCredencial(resultado);
    } catch (error) {
      console.error("Error al buscar afiliado:", error);
      setMensaje("Ocurrió un error al realizar la búsqueda. Intente nuevamente.");
    } finally {
      setLoading(false);
    }
  };

  const limpiarBusqueda = () => {
    setDni("");
    setCredencial(null);
    setMensaje("");
  };

  return (
    <div className={styles.componentContainer}>
      <section className={styles.comercioHeaderTop}>
        <h1 className={styles.h1}>Validación de Credencial para Comercios</h1>
      </section>

      <div className={styles.container}>
        <div className={styles.container__imgContainer}>
          <img
            className={styles.container__imgContainer__img}
            src={portada}
            alt="Convenios Comercio SiDCa"
          />
        </div>
      </div>

      <section className={styles.comercioWrapper}>
        <div className={styles.comercioHeader}>
          <p>
            Espacio destinado a comercios adheridos para verificar la credencial
            sindical del afiliado mediante búsqueda por DNI.
          </p>
        </div>

        {verificandoSesion && (
          <div className={styles.message}>Verificando acceso de comercio...</div>
        )}

        {mostrarConsulta && (
          <div ref={consultaRef} className={styles.consultaGrid}>
            <section className={styles.searchCard}>
              <div className={styles.cardHeader}>
                <span className={styles.cardBadge}>Consulta comercio</span>

                <h2>Buscar afiliado</h2>

                <p>
                  Ingrese el DNI del afiliado. El sistema mostrará únicamente
                  los datos necesarios para validar la credencial: apellido,
                  nombre, DNI y departamento.
                </p>
              </div>

              <form className={styles.form} onSubmit={buscarAfiliado}>
                <label htmlFor="dni" className={styles.label}>
                  DNI del afiliado
                </label>

                <div className={styles.inputGroup}>
                  <input
                    id="dni"
                    type="text"
                    inputMode="numeric"
                    value={dni}
                    onChange={(e) => setDni(e.target.value)}
                    placeholder="Ejemplo: 30123456"
                    className={styles.input}
                    disabled={loading}
                  />

                  <button
                    type="submit"
                    className={styles.searchButton}
                    disabled={loading}
                  >
                    {loading ? "Buscando..." : "Buscar"}
                  </button>
                </div>

                {dni && (
                  <button
                    type="button"
                    className={styles.clearButton}
                    onClick={limpiarBusqueda}
                    disabled={loading}
                  >
                    Limpiar búsqueda
                  </button>
                )}
              </form>

              {mensaje && <div className={styles.message}>{mensaje}</div>}

              <div className={styles.securityNote}>
                <strong>Importante:</strong> este sector es exclusivo para
                comercios autorizados.
              </div>
            </section>

            <section className={styles.credentialArea}>
              {!credencial && (
                <div className={styles.emptyState}>
                  <div className={styles.emptyIcon}>🪪</div>

                  <h2>Credencial del afiliado</h2>

                  <p>
                    La credencial aparecerá aquí luego de realizar una búsqueda
                    por DNI.
                  </p>
                </div>
              )}

              {credencial && (
                <article className={styles.credentialRealCard}>
                  <div className={styles.credentialRealImage}>
                    <img
                      src={credencialFondo}
                      alt="Credencial del afiliado"
                      className={styles.credentialBackgroundImg}
                    />

                    <h2 className={styles.credentialRealTitle}>
                      Credencial de Afiliado
                    </h2>

                    <div className={styles.credentialRealData}>
                      <p>
                        <strong>Afiliado:</strong> {credencial.apellido},{" "}
                        {credencial.nombre}
                      </p>

                      <p>
                        <strong>DNI:</strong> {credencial.dni}
                      </p>

                      <p>
                        <strong>Departamento:</strong>{" "}
                        {credencial.departamento}
                      </p>
                    </div>
                  </div>

                  <div className={styles.validBox}>
                    <span className={styles.validDot}></span>
                    Afiliado verificado
                  </div>

                  <div className={styles.credentialAffiliateFooter}>
                    Consulta habilitada para comercios adheridos
                  </div>
                </article>
              )}
            </section>
          </div>
        )}
      </section>
    </div>
  );
};

export default Comercio;