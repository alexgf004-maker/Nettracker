// Conexión a Firebase Realtime Database y referencias a los nodos
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getDatabase, ref, onValue, push, update, remove, get, set } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-database.js";

export const firebaseConfig = {
  apiKey: "AIzaSyDmwLWle24Nldh-Y6YBmYLaaDA6ZTpuKuc",
  authDomain: "pqfind.firebaseapp.com",
  databaseURL: "https://pqfind-default-rtdb.firebaseio.com",
  projectId: "pqfind",
  storageBucket: "pqfind.firebasestorage.app",
  messagingSenderId: "666556457981",
  appId: "1:666556457981:web:2d3dfbecfd3e515387ef94"
};

export const fbApp = initializeApp(firebaseConfig);
export const db = getDatabase(fbApp);
export const installsRef = ref(db, 'analizadores');
export const equiposRef = ref(db, 'equipos');
export const historialCargasRef = ref(db, 'historialCargas');
export const historialAccesoriosRef = ref(db, 'historialAccesorios');
export const validacionesRef = ref(db, 'validaciones');
export const mantenimientoRef = ref(db, 'config/mantenimiento');
export { ref, onValue, push, update, remove, get, set };
