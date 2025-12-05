// src/firebase/firebaseReservas.js
import { initializeApp, getApps, getApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

// 💡 Config de tu proyecto SidcaReservas (la que acabás de pegar)
const firebaseConfig = {
  apiKey: "AIzaSyA1VHYtdTimOgLyAzq0sCJTj8ibr23xSdc",
  authDomain: "sidcareservas.firebaseapp.com",
  projectId: "sidcareservas",
  storageBucket: "sidcareservas.appspot.com",
  messagingSenderId: "1075341448921",
  appId: "1:1075341448921:web:9b3644ecfd4d8dee9810c8",
};

// Usamos un app con nombre "SidcaReservas" para no pisar otros Firebase
const APP_NAME = "SidcaReservas";

let reservasApp;

// Si ya existe (hot reload), lo reutilizamos
const apps = getApps();
const existente = apps.find((app) => app.name === APP_NAME);

if (existente) {
  reservasApp = existente;
} else {
  reservasApp = initializeApp(firebaseConfig, APP_NAME);
}

// Exportamos Firestore y Storage de ESTE proyecto
export const dbReservas = getFirestore(reservasApp);
export const storageReservas = getStorage(reservasApp);
