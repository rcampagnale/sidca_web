// src/firebase/firebaseCertificadosValidator.js
//
// Instancia de Firebase Auth AISLADA para la validación de certificados.
//
// El problema que resuelve: Firebase Auth guarda un solo usuario por instancia
// de app. Si el validador iniciara sesión con el `auth` principal, reemplazaría
// la sesión del administrador que pudiera estar trabajando en el panel — y al
// cerrar sesión el validador, cerraría también la del admin.
//
// La solución es una SEGUNDA app JS sobre el MISMO proyecto Firebase. No es
// otro proyecto, ni otra configuración: se reutiliza firebaseApp.options tal
// cual. Lo único que cambia es que tiene su propio estado de autenticación.
//
// Consecuencia práctica: validatorAuth.currentUser y auth.currentUser son
// independientes. Iniciar o cerrar sesión en uno no afecta al otro.

import { getApps, initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";

import { firebaseApp } from "./firebase-config";

const NOMBRE_APP = "sidca-certificados-validator";

/**
 * Se reutiliza la app si ya existe: initializeApp con un nombre repetido
 * lanza error, y en desarrollo el hot reload vuelve a ejecutar este módulo.
 */
const appExistente = getApps().find((app) => app.name === NOMBRE_APP);

const validatorApp =
  appExistente || initializeApp(firebaseApp.options, NOMBRE_APP);

export const validatorAuth = getAuth(validatorApp);

export default validatorApp;
