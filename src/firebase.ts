import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import firebaseConfigRaw from '../firebase-applet-config.json';
const firebaseConfig = firebaseConfigRaw as any;

const app = initializeApp(firebaseConfig);
const databaseId = firebaseConfig.firestoreDatabaseId || "(default)";
export const db = getFirestore(app, databaseId); /* CRITICAL: The app will break without this line */
export const auth = getAuth();
export const googleProvider = new GoogleAuthProvider();

export { signInWithPopup, signOut, GoogleAuthProvider };
