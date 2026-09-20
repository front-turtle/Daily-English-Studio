import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';

const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();

export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
// Request standard profile & email
googleProvider.setCustomParameters({
  prompt: 'select_account'
});

// Configure firestore database using the databaseId from config if provided
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId || undefined);
export default app;
