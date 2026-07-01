import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut } from 'firebase/auth';
import { initializeFirestore } from 'firebase/firestore';
import firebaseConfigRaw from '../firebase-applet-config.json';

const firebaseConfig = {
  projectId: firebaseConfigRaw?.projectId || import.meta.env.VITE_FIREBASE_PROJECT_ID || "",
  appId: firebaseConfigRaw?.appId || import.meta.env.VITE_FIREBASE_APP_ID || "",
  apiKey: firebaseConfigRaw?.apiKey || import.meta.env.VITE_FIREBASE_API_KEY || "",
  authDomain: firebaseConfigRaw?.authDomain || import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "",
  firestoreDatabaseId: (firebaseConfigRaw as any)?.firestoreDatabaseId || import.meta.env.VITE_FIREBASE_DATABASE_ID || "",
  storageBucket: firebaseConfigRaw?.storageBucket || import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "",
  messagingSenderId: firebaseConfigRaw?.messagingSenderId || import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || ""
};

let app;
if (firebaseConfig.apiKey) {
  try {
    app = initializeApp(firebaseConfig);
  } catch (e) {
    console.error("Firebase initialization failed:", e);
  }
}

const databaseId = firebaseConfig?.firestoreDatabaseId || "(default)";
export const db = app ? initializeFirestore(app, {
  experimentalForceLongPolling: true
}, databaseId) : (null as any);
export const auth = app ? getAuth(app) : (null as any);
export const googleProvider = new GoogleAuthProvider();

export { signInWithPopup, signOut, GoogleAuthProvider };
