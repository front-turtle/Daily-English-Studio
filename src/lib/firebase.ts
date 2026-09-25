import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { initializeAppCheck, ReCaptchaEnterpriseProvider } from 'firebase/app-check';
import firebaseConfig from '../../firebase-applet-config.json';

const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();

if (typeof window !== 'undefined') {
  initializeAppCheck(app, {
    provider: new ReCaptchaEnterpriseProvider('6LdPNM4tAAAAAB1CMlex5zZ5ffJcrwap3ITcT30o'),
    isTokenAutoRefreshEnabled: true,
  });
}

export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
// Request standard profile & email
googleProvider.setCustomParameters({
  prompt: 'select_account'
});

// Use the default Firestore database in the new project.
export const db = getFirestore(app);
export default app;
