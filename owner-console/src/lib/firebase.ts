import { initializeApp, getApps, getApp, type FirebaseOptions } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

// Prefer env; fallback to project defaults for dev parity with marketplace app
const fallback: FirebaseOptions = {
  apiKey: 'AIzaSyDr43GAZFdLh674vZOzlXR_OawyFP0arRY',
  authDomain: 'khidmaty-connect-2d512.firebaseapp.com',
  projectId: 'khidmaty-connect-2d512',
  storageBucket: 'khidmaty-connect-2d512.appspot.com',
  messagingSenderId: '587434148277',
  appId: '1:587434148277:web:1a1aeec6f34435023fd9fc',
};

const config: FirebaseOptions = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || fallback.apiKey,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || fallback.authDomain,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || fallback.projectId,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || fallback.storageBucket,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || fallback.messagingSenderId,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID || fallback.appId,
};

const app = !getApps().length ? initializeApp(config) : getApp();

export const auth = getAuth(app);
export const db = getFirestore(app);
