// src/pages/ValidarCertificado/components/useSesionValidador.js
//
// Sesión utilizable para validar certificados.
//
// Hay dos identidades posibles y NO son intercambiables:
//
//   validatorAuth  — la sesión propia del validador, creada en esta pantalla.
//   auth principal — la del panel administrativo. Un administrador que ya
//                    entró no tiene por qué volver a autenticarse acá.
//
// El origen importa sobre todo al cerrar sesión: cerrar la del validador es
// correcto, cerrar la del panel sacaría al administrador de su trabajo. Por eso
// el hook no devuelve sólo "hay sesión", sino de dónde viene.
//
// Esto es AUTENTICACIÓN, no autorización. Que exista una sesión sólo habilita
// la pantalla; quién puede validar de verdad lo sigue decidiendo el backend con
// validarCertificados === true.

import { useCallback, useEffect, useState } from "react";
import { useLocation } from "react-router-dom";

import { auth } from "../../../firebase/firebase-config";
import { validatorAuth } from "../../../firebase/firebaseCertificadosValidator";
import { obtenerPermisosValidador } from "../../../services/certificadosValidacionService";

const permisosEnMemoria = new Map();
const permisosEnCurso = new Map();
let sesionEnMemoria = { validador: undefined, principal: undefined };

const claveUsuario = (usuario) => String(usuario?.uid || usuario?.email || "").trim();
const permisosIniciales = (usuario) => {
  const cache = permisosEnMemoria.get(claveUsuario(usuario));
  return cache ? cache.permisos : null;
};

const useSesionValidador = () => {
  // undefined = todavía restaurando. null = no hay sesión. Distinguirlos evita
  // mostrar el login durante los milisegundos en que Firebase aún no respondió.
  const [validador, setValidador] = useState(() => sesionEnMemoria.validador ?? validatorAuth.currentUser ?? undefined);
  const [principal, setPrincipal] = useState(() => sesionEnMemoria.principal ?? auth.currentUser ?? undefined);
  const usuarioInicial = validador || principal;
  const [permisos, setPermisos] = useState(() => permisosIniciales(usuarioInicial) || { certificados: false, cena: false });
  const [permisosCargando, setPermisosCargando] = useState(() => !permisosIniciales(usuarioInicial));
  const location = useLocation();
  const moduloActual = location.pathname.startsWith("/validar-cena") ? "cena" : "certificados";

  useEffect(() => {
    const desuscribirValidador = validatorAuth.onAuthStateChanged((usuario) => {
      sesionEnMemoria = { ...sesionEnMemoria, validador: usuario };
      setValidador(usuario);
    });
    const desuscribirPrincipal = auth.onAuthStateChanged((usuario) => {
      sesionEnMemoria = { ...sesionEnMemoria, principal: usuario };
      setPrincipal(usuario);
    });

    return () => {
      desuscribirValidador();
      desuscribirPrincipal();
    };
  }, []);

  const cargando = validador === undefined || principal === undefined;

  // El validador tiene prioridad: si alguien ingresó explícitamente acá, esa
  // es su identidad aunque además tenga abierto el panel.
  const sesion = validador || principal || null;

  const refrescarPermisos = useCallback(async ({ silencioso = false } = {}) => {
    const usuario = validador || principal;
    if (!usuario) {
      setPermisos({ certificados: false, cena: false });
      setPermisosCargando(false);
      return { certificados: false, cena: false };
    }
    const clave = claveUsuario(usuario);
    const cache = permisosEnMemoria.get(clave);
    if (!cache && !silencioso) setPermisosCargando(true);
    if (cache) setPermisos(cache.permisos);
    const solicitudExistente = permisosEnCurso.get(clave);
    if (solicitudExistente) {
      const resultado = await solicitudExistente;
      setPermisos(resultado);
      setPermisosCargando(false);
      return resultado;
    }
    const solicitud = obtenerPermisosValidador(usuario)
      .then((resultado) => {
        const normalizados = { certificados: resultado.certificados === true, cena: resultado.cena === true };
        permisosEnMemoria.set(clave, { permisos: normalizados });
        return normalizados;
      })
      .finally(() => permisosEnCurso.delete(clave));
    permisosEnCurso.set(clave, solicitud);
    try {
      const resultado = await solicitud;
      setPermisos(resultado);
      return resultado;
    } catch (error) {
      if (!cache) setPermisos({ certificados: false, cena: false });
      throw error;
    } finally {
      setPermisosCargando(false);
    }
  }, [validador, principal]);

  useEffect(() => {
    if (validador === undefined || principal === undefined) return undefined;
    let activo = true;
    refrescarPermisos({ silencioso: Boolean(permisosEnMemoria.get(claveUsuario(validador || principal))) }).catch(() => undefined).finally(() => { if (!activo) return; });
    return () => { activo = false; };
  }, [validador, principal, moduloActual, refrescarPermisos]);

  let origenSesion = "";
  if (validador) origenSesion = "validador";
  else if (principal) origenSesion = "principal";

  return { cargando, validador, principal, sesion, origenSesion, permisos, permisosCargando, refrescarPermisos };
};

export default useSesionValidador;
