import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import firebaseConfigRaw from '../firebase-applet-config.json';
const firebaseConfig = (firebaseConfigRaw && Object.keys(firebaseConfigRaw).length > 0) ? (firebaseConfigRaw as any) : null;

let app;
if (firebaseConfig) {
  try {
    app = initializeApp(firebaseConfig);
  } catch (e) {
    console.error("Firebase initialization failed:", e);
  }
}

const databaseId = firebaseConfig?.firestoreDatabaseId || "(default)";
export const db = app ? getFirestore(app, databaseId) : (null as any);
export const auth = app ? getAuth(app) : (null as any);
export const googleProvider = new GoogleAuthProvider();

export { signInWithPopup, signOut, GoogleAuthProvider };
