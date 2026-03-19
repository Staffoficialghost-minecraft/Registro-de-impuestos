import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

// Configuración de tu proyecto Firebase web
const firebaseConfig = {
  apiKey: "AIzaSyAepHgklQpdti_LjOOVEAJ2nEt6BvgTs_M",
  authDomain: "ghost-136da.firebaseapp.com",
  projectId: "ghost-136da",
  storageBucket: "ghost-136da.firebasestorage.app",
  messagingSenderId: "950902137760",
  appId: "1:950902137760:web:8534ed0e8ec7fabb597ac5",
  measurementId: "G-93ZSR3TXYJ"
};

// Inicializa Firebase
const app = initializeApp(firebaseConfig);

// Exporta auth y db para usar en tu app.js
export const auth = getAuth(app);
export const db = getFirestore(app);
