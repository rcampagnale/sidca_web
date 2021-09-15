import {initializeApp} from "firebase/app";
import { getFirestore } from "firebase/firestore"
//import 'firebase/auth';

const firebaseConfig = {
  apiKey: "AIzaSyCKVN2aRi6Vr-J3zAkRu77eKMMk45GpFkg",
  authDomain: "sidca-a33f0.firebaseapp.com",
  projectId: "sidca-a33f0",
  storageBucket: "sidca-a33f0.appspot.com",
  messagingSenderId: "994896485736",
  appId: "1:994896485736:web:2fc72eeba21554f1e3cadd"
};

initializeApp(firebaseConfig);
// admin.initializeApp();

const db = getFirestore();
// const googleAuthProvider = firebase.auth.GoogleAuthProvider();

export {
    db,
    // googleAuthProvider,
}