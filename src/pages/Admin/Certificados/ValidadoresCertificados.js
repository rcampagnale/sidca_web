import React, { useCallback, useEffect, useState } from "react";
import { ConfirmDialog, confirmDialog } from "primereact/confirmdialog";
import { Dialog } from "primereact/dialog";
import {
  obtenerValidadoresCertificados,
  buscarUsuariosValidadores,
  autorizarValidadorCertificados,
  quitarValidadorCertificados,
  obtenerAccesoValidadorCertificados,
} from "../../../services/certificadosService";
import styles from "./ValidadoresCertificados.module.css";

const dni = (v) => String(v || "").replace(/\D/g, "").replace(/\B(?=(\d{3})+(?!\d))/g, ".");
const nombre = (u) => u.apellidoNombre || [u.apellido, u.nombre].filter(Boolean).join(", ") || "Sin nombre";

const ValidadoresCertificados = ({ notificar }) => {
  const [validadores, setValidadores] = useState([]);
  const [resultados, setResultados] = useState([]);
  const [q, setQ] = useState("");
  const [cargando, setCargando] = useState(true);
  const [buscando, setBuscando] = useState(false);
  const [actualizando, setActualizando] = useState("");
  const [modal, setModal] = useState(null);
  const [acceso, setAcceso] = useState(null);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [consultando, setConsultando] = useState(false);

  const cargar = useCallback(async () => {
    setCargando(true);
    try { setValidadores(await obtenerValidadoresCertificados()); }
    catch (e) { notificar?.("error", "No se pudieron cargar los validadores", e.message); }
    finally { setCargando(false); }
  }, [notificar]);

  useEffect(() => { cargar(); }, [cargar]);

  const buscar = async (e) => {
    e?.preventDefault();
    if (!q.trim()) return setResultados([]);
    setBuscando(true);
    try { setResultados(await buscarUsuariosValidadores(q.trim())); }
    catch (err) { notificar?.("error", "No se pudo buscar el usuario", err.message); }
    finally { setBuscando(false); }
  };

  const consultarAcceso = async (u) => {
    setConsultando(true);
    try {
      const estado = await obtenerAccesoValidadorCertificados(u.usuarioDocId);
      setAcceso({ ...estado, estado: estado.existe ? "existente" : "inexistente" });
    } catch (e) {
      setAcceso({ estado: "error", error: e.message, status: e.status });
    } finally { setConsultando(false); }
  };

  const abrirAutorizar = async (u) => {
    setModal(u);
    setAcceso({ estado: "cargando" });
    setPassword("");
    setConfirmPassword("");
    await consultarAcceso(u);
  };

  const quitar = (u) => confirmDialog({
    message: `¿Quitar el permiso de validación de ${nombre(u)}?`,
    header: "Quitar acceso",
    acceptLabel: "Quitar acceso",
    rejectLabel: "Cancelar",
    accept: async () => {
      setActualizando(u.usuarioDocId);
      try {
        await quitarValidadorCertificados(u.usuarioDocId);
        setValidadores((xs) => xs.filter((x) => x.usuarioDocId !== u.usuarioDocId));
        notificar?.("success", "Acceso retirado", `${nombre(u)} ya no puede validar certificados.`);
      } catch (e) { notificar?.("error", "No se pudo actualizar el acceso", e.message); }
      finally { setActualizando(""); }
    },
  });

  const autorizar = async () => {
    if (!modal || !acceso || acceso.estado === "error" || acceso.estado === "cargando") return;
    if (acceso.estado === "inexistente" && (password.length < 8 || password !== confirmPassword)) {
      return notificar?.("error", "Contraseña inválida", "Debe tener al menos 8 caracteres y coincidir.");
    }
    setActualizando(modal.usuarioDocId);
    try {
      await autorizarValidadorCertificados(modal.usuarioDocId, {
        email: modal.email || modal.correo || "",
        ...(acceso.estado === "inexistente" ? { passwordInicial: password } : {}),
      });
      const actualizado = { ...modal, validarCertificados: true };
      setResultados((xs) => xs.map((x) => x.usuarioDocId === modal.usuarioDocId ? actualizado : x));
      setValidadores((xs) => [...xs.filter((x) => x.usuarioDocId !== modal.usuarioDocId), actualizado]);
      setModal(null);
      notificar?.("success", "Validador autorizado", `${nombre(modal)} ya puede validar certificados.`);
    } catch (e) { notificar?.("error", "No se pudo autorizar", e.message); }
    finally { setActualizando(""); }
  };

  const contenidoAcceso = () => {
    if (consultando || acceso?.estado === "cargando") return <p>Comprobando cuenta de acceso…</p>;
    if (acceso?.estado === "error") return <div className={styles.errorAcceso}>
      <p>No se pudo consultar el estado de la cuenta de acceso.</p>
      <small>Reintentá en unos instantes o revisá la configuración del servicio.</small>
      <button type="button" className={styles.accionSecundaria} disabled={consultando} onClick={() => consultarAcceso(modal)}>Reintentar</button>
    </div>;
    if (acceso?.estado === "existente") return <p>Esta persona ya posee una cuenta de acceso.{acceso.habilitada ? "" : acceso.gestionadaPorModulo ? " Se habilitará nuevamente." : " La cuenta está deshabilitada y no fue gestionada por este módulo."}</p>;
    return <>
      <p>No tiene una cuenta de acceso para validación.</p>
      <label>Contraseña inicial<input type="password" value={password} minLength={8} maxLength={128} onChange={(e) => setPassword(e.target.value)} /></label>
      <label>Confirmar contraseña<input type="password" value={confirmPassword} minLength={8} maxLength={128} onChange={(e) => setConfirmPassword(e.target.value)} /></label>
    </>;
  };

  return <section className={styles.contenedor}>
    <ConfirmDialog />
    <h2>Usuarios autorizados para validar certificados</h2>
    <p>Administrá las personas que pueden comprobar la autenticidad y vigencia de los certificados SIDCA.</p>
    <form className={styles.busqueda} onSubmit={buscar}><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar por DNI, apellido, nombre o correo" /><button disabled={buscando}>{buscando ? "Buscando…" : "Buscar"}</button></form>
    <section className={styles.panel}><h3>Resultado</h3>{resultados.map((u) => <article className={styles.tarjeta} key={u.usuarioDocId}><strong>{nombre(u)}</strong><span>DNI: {dni(u.dni)}</span><span>{u.email || u.correo || "Sin correo registrado"}</span>{u.validarCertificados ? <b className={styles.ok}>✓ Ya autorizado</b> : <button disabled={!u.email && !u.correo} onClick={() => abrirAutorizar(u)}>{u.email || u.correo ? "Autorizar" : "Falta correo"}</button>}</article>)}</section>
    <section className={styles.panel}><h3>Validadores autorizados: {validadores.length}</h3>{cargando ? <p>Cargando…</p> : validadores.map((u) => <article className={styles.tarjeta} key={u.usuarioDocId}><strong>{nombre(u)}</strong><span>DNI: {dni(u.dni)}</span><span>{u.email || u.correo || "Sin correo registrado"}</span><b className={styles.ok}>AUTORIZADO</b><button className={styles.quitar} disabled={actualizando === u.usuarioDocId} onClick={() => quitar(u)}>Quitar acceso</button></article>)}</section>
    <Dialog header="Autorizar validador" visible={Boolean(modal)} modal onHide={() => setModal(null)}>{modal && <div className={styles.modalContenido}><strong>{nombre(modal)}</strong><span>DNI: {dni(modal.dni)}</span><span>Correo: {modal.email || modal.correo || "Sin correo registrado"}</span>{contenidoAcceso()}<div className={styles.modalAcciones}><button type="button" className={styles.accionSecundaria} onClick={() => setModal(null)}>Cancelar</button><button type="button" className={styles.accionPrimaria} disabled={consultando || !acceso || acceso.estado === "error" || acceso.estado === "cargando" || (acceso.estado === "inexistente" && !password)} onClick={autorizar}>{acceso?.estado === "existente" ? (acceso.habilitada ? "Autorizar" : "Habilitar y autorizar") : "Crear acceso y autorizar"}</button></div></div>}</Dialog>
  </section>;
};

export default ValidadoresCertificados;
