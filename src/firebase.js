import { initializeApp, getApps } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';

// Firebase web config. These values are NOT secret — they ship in every
// client bundle and only identify the project; access is controlled by the
// deployed Firestore security rules. Baked in directly (with optional env
// override) so a mistyped/garbled .env can't break the live app.
const firebaseConfig = {
  apiKey:            import.meta.env.VITE_FIREBASE_API_KEY            || 'AIzaSyDOoqrkTftkGyV3tDotnqpd82s4GGNg8UQ',
  // Same origin as where the app is hosted, so the redirect sign-in
  // handshake stays first-party (firebaseapp.com would be cross-domain and
  // the result gets dropped on the way back on mobile browsers).
  authDomain:        import.meta.env.VITE_FIREBASE_AUTH_DOMAIN        || 'baloot-almamlaka.web.app',
  projectId:         import.meta.env.VITE_FIREBASE_PROJECT_ID         || 'baloot-almamlaka',
  storageBucket:     import.meta.env.VITE_FIREBASE_STORAGE_BUCKET     || 'baloot-almamlaka.firebasestorage.app',
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '941544975543',
  appId:             import.meta.env.VITE_FIREBASE_APP_ID             || '1:941544975543:web:640ec1e4a29191cfd37132',
};

const app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
export const db = getFirestore(app);
