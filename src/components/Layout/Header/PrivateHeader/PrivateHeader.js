import React, { useEffect, useRef, useState } from "react";
import { useHistory } from "react-router";
import { useSelector } from "react-redux";
import { Button } from "primereact/button";
import { confirmDialog } from "primereact/confirmdialog";
import { doc, getDoc } from "firebase/firestore";
import NavUser from "./nav/NavUser";
import { db } from "../../../../firebase/firebase-config";
import styles from "./privateHeader.module.scss";
import logo from "../../../../assets/img/logo-01.png";
import DelegadoPantallaQR from "../../../HabilitarBotones/qr/DelegadoPantallaQR";

const normalizarDni = (valor) => String(valor || "").replace(/\D/g, "");

const leerUsuarioSession = () => {
  try {
    return JSON.parse(sessionStorage.getItem("user") || "null");
  } catch {
    return null;
  }
};

const obtenerDniUsuario = (userRedux) => {
  const userSession = leerUsuarioSession();
  return normalizarDni(
    userRedux?.dni ||
      userRedux?.profile?.dni ||
      userRedux?.user?.dni ||
      userRedux?.documento ||
      userSession?.dni ||
      userSession?.documento ||
      localStorage.getItem("sidca_user_dni")
  );
};

const tienePermisoGestionDelegados = (delegado) =>
  delegado?.habilitado === true &&
  delegado?.herramientas?.expedienteSueldo?.habilitado === true &&
  delegado?.herramientas?.expedienteSueldo?.permisos?.ver === true;

const tienePermisoPantallaQR = (delegado) =>
  delegado?.habilitado === true &&
  delegado?.herramientas?.pantallaQr?.habilitado === true;

const PrivateHeader = () => {
  const history = useHistory();
  const user = useSelector((state) => state.user);
  const pantallaQrRef = useRef(null);

  const [active, setActive] = useState(false);
  const [mostrarGestionDelegados, setMostrarGestionDelegados] =
    useState(false);
  const [mostrarPantallaQR, setMostrarPantallaQR] = useState(false);

  useEffect(() => {
    let mounted = true;

    const validarDelegado = async () => {
      const dni = obtenerDniUsuario(user);

      if (!dni) {
        if (mounted) {
          setMostrarGestionDelegados(false);
          setMostrarPantallaQR(false);
        }
        return;
      }

      try {
        const snap = await getDoc(doc(db, "delegadosAutorizados", dni));
        if (mounted) {
          const delegado = snap.exists() ? snap.data() : null;
          setMostrarGestionDelegados(tienePermisoGestionDelegados(delegado));
          setMostrarPantallaQR(tienePermisoPantallaQR(delegado));
        }
      } catch (err) {
        console.error("[PrivateHeader] Gestion Delegados:", err);
        if (mounted) setMostrarGestionDelegados(false);
        if (mounted) setMostrarPantallaQR(false);
      }
    };

    validarDelegado();

    return () => {
      mounted = false;
    };
  }, [user]);

  const confirm = () => {
    confirmDialog({
      message: "¿Está seguro de que quiere cerrar sesión?",
      header: "Cerrar Sesión",
      icon: "pi pi-exclamation-triangle",
      accept: () => history.push("/logout"),
      acceptLabel: "Si",
      rejectLabel: "No",
    });
  };

  return (
    <>
      <a
        href="/home"
        onClick={(e) => {
          e.preventDefault();
          history.push("/home");
        }}
      >
        <img className={styles.headerLogo} src={logo} alt="SiDCa logo" />
      </a>

      <ul className={styles.headerNav}>
        <li onClick={() => history.push("/home")}>Inicio</li>

        <li onClick={() => history.push("/credencial")}>Credencial</li>

        <li onClick={() => history.push("/capacitaciones")}>
          Capacitaciones
        </li>

        <li onClick={() => history.push("/oficina-gestion")}>
          Oficina de Gestión
        </li>

        {mostrarGestionDelegados && (
          <li onClick={() => history.push("/delegado/gestion-delegados")}>
            Gestión Delegados
          </li>
        )}

        {mostrarPantallaQR && (
          <li onClick={() => pantallaQrRef.current?.abrirRegistro()}>
            Pantalla QR
          </li>
        )}

        {/* {user.profue.cotizante && } */}

        <li onClick={() => history.push("/nosotros")}>Nosotros</li>

        <li onClick={() => history.push("/convenios")}>Convenios</li>

        <li onClick={() => history.push("/contacto")}>Contacto</li>
      </ul>

      <div className={styles.btnExit}>
        <Button
          icon="pi pi-sign-out"
          className="p-button-rounded p-button-danger mr-2 mb-2"
          onClick={confirm}
        />
      </div>

      <div className={styles.hamburger}>
        <Button
          icon="pi pi-bars"
          className="p-button-rounded p-button-warning p-button-text"
          onClick={() => setActive(!active)}
        />
      </div>

      {active && (
        <NavUser
          active={active}
          setActive={setActive}
          mostrarGestionDelegados={mostrarGestionDelegados}
          mostrarPantallaQR={mostrarPantallaQR}
          onRegistrarPantallaQR={() => pantallaQrRef.current?.abrirRegistro()}
        />
      )}

      {mostrarPantallaQR && <DelegadoPantallaQR ref={pantallaQrRef} />}
    </>
  );
};

export default PrivateHeader;
