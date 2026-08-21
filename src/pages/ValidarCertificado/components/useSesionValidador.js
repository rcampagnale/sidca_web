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

import { useEffect, useState } from "react";

import { auth } from "../../../firebase/firebase-config";
import { validatorAuth } from "../../../firebase/firebaseCertificadosValidator";

const useSesionValidador = () => {
  // undefined = todavía restaurando. null = no hay sesión. Distinguirlos evita
  // mostrar el login durante los milisegundos en que Firebase aún no respondió.
  const [validador, setValidador] = useState(undefined);
  const [principal, setPrincipal] = useState(undefined);

  useEffect(() => {
    const desuscribirValidador = validatorAuth.onAuthStateChanged(setValidador);
    const desuscribirPrincipal = auth.onAuthStateChanged(setPrincipal);

    return () => {
      desuscribirValidador();
      desuscribirPrincipal();
    };
  }, []);

  const cargando = validador === undefined || principal === undefined;

  // El validador tiene prioridad: si alguien ingresó explícitamente acá, esa
  // es su identidad aunque además tenga abierto el panel.
  const sesion = validador || principal || null;

  let origenSesion = "";
  if (validador) origenSesion = "validador";
  else if (principal) origenSesion = "principal";

  return { cargando, validador, principal, sesion, origenSesion };
};

export default useSesionValidador;
