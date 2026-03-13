import { initializeApp } from "firebase/app";
import { getDatabase } from "firebase/database";
// Measurement Id optional, importing analytics is fine but we'll focus on database first
// import { getAnalytics } from "firebase/analytics";

const firebaseConfig = {
    apiKey: "AIzaSyAdH35e6NKROMzvirirjuOa-b67ePaKFCU",
    authDomain: "minbra-6e548.firebaseapp.com",
    databaseURL: "https://minbra-6e548-default-rtdb.firebaseio.com",
    projectId: "minbra-6e548",
    storageBucket: "minbra-6e548.firebasestorage.app",
    messagingSenderId: "183707728936",
    appId: "1:183707728936:web:283048416c129ee405891d",
    measurementId: "G-3QSYBQGSP1"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

export { app, db };
