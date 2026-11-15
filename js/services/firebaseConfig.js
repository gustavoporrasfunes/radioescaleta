// js/services/firebaseConfig.js
// Importaciones modulares de Firebase SDK 10
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.4.0/firebase-app.js";
import { getAuth, GoogleAuthProvider } from "https://www.gstatic.com/firebasejs/10.4.0/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.4.0/firebase-firestore.js";

// TODO: REEMPLAZA ESTO CON LA CONFIGURACIÓN DE TU PROYECTO DE FIREBASE
const firebaseConfig = {
  apiKey: "AIzaSyBu7pGwujvM6NvRvTP1kTX6NdEFwj6iAk0",
  authDomain: "radioescaleta-app.firebaseapp.com",
  projectId: "radioescaleta-app",
  storageBucket: "radioescaleta-app.firebasestorage.app",
  messagingSenderId: "492512427957",
  appId: "1:492512427957:web:640b63487edcf5120223fc",
  measurementId: "G-CX7FGF6JVQ"
};

// Si los valores no se han modificado, no intentamos inicializar para evitar errores en la demostración
let app, auth, db, provider;

if (firebaseConfig.apiKey !== "API_KEY") {
    app = initializeApp(firebaseConfig);
    auth = getAuth(app);
    db = getFirestore(app);
    provider = new GoogleAuthProvider();
} else {
    console.warn("⚠️ Firebase no está configurado. La app funcionará en modo de demostración (local).");
}

export { app, auth, db, provider };
