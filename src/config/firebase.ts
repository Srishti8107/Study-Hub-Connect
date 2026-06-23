import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyBa_uHaAzxouT1DQnrHJQWWltEsY5wh5iA",
  authDomain: "study-hub-connect-86750.firebaseapp.com",
  projectId: "study-hub-connect-86750",
  storageBucket: "study-hub-connect-86750.firebasestorage.app",
  messagingSenderId: "779847912241",
  appId: "1:779847912241:web:bccf5b15f5cea72e5bbe10"
};

// Primary app instance
const app = initializeApp(firebaseConfig);

// Secondary app instance for creating users without affecting admin session
const secondaryApp = initializeApp(firebaseConfig, "Secondary");

export const auth = getAuth(app);
export const secondaryAuth = getAuth(secondaryApp);
export const db = getFirestore(app);
