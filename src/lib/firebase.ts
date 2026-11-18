import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';

// Fallbacks keep initializeApp from throwing (white screen) when env vars are
// absent — e.g. demo/preview mode or a misconfigured local build. Auth/Firestore
// simply won't work in that case, which is expected.
const firebaseConfig = {
  apiKey:     import.meta.env.VITE_FIREBASE_API_KEY     || 'demo-api-key',
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || 'demo.firebaseapp.com',
  projectId:  import.meta.env.VITE_FIREBASE_PROJECT_ID  || 'demo',
  appId:      import.meta.env.VITE_FIREBASE_APP_ID      || 'demo',
};

export const app  = initializeApp(firebaseConfig);
export const db   = getFirestore(app);
export const auth = getAuth(app);
