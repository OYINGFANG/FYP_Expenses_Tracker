// firebase.js
import { getApps, initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

// Your Firebase config
const firebaseConfig = {
  apiKey: "AIzaSyBiaW0ZL1Rfu0QdF-OyW65fMlC8LmAvOn0",
  authDomain: "auri-76581.firebaseapp.com",
  databaseURL: "https://auri-76581-default-rtdb.firebaseio.com",
  projectId: "auri-76581",
  storageBucket: "auri-76581.firebasestorage.app",
  messagingSenderId: "195907875417",
  appId: "1:195907875417:web:3bf315e5bed253303cf748"
};

// Initialize app
const app = !getApps().length ? initializeApp(firebaseConfig) : getApps()[0];

// ✅ Use Firestore as `db`
export const db = getFirestore(app);
export const auth = getAuth(app);