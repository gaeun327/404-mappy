import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth"; 

const firebaseConfig = {
  apiKey: "AIzaSyDAv4idaQ6PXEB3T6ZgwuTDDMtNbnRS9HU",
  authDomain: "mappy-app-f22cd.firebaseapp.com",
  projectId: "mappy-app-f22cd",
  storageBucket: "mappy-app-f22cd.firebasestorage.app",
  messagingSenderId: "491685807818",
  appId: "1:491685807818:web:fd848cd449f19fdc9fd633"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const auth = getAuth(app);