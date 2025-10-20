<<<<<<< HEAD
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
=======
import { initializeApp, getApps, getApp, type FirebaseOptions } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

  // Client config must come from NEXT_PUBLIC_* env vars (no hardcoded keys)
  // IMPORTANT: Use literal reads so Next.js can inline these on the client
  const apiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY;
  const authDomain = process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN;
  const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
  const storageBucket = process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET;
  const messagingSenderId = process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID;
  const appId = process.env.NEXT_PUBLIC_FIREBASE_APP_ID;

  const missing = (
    [
      ['NEXT_PUBLIC_FIREBASE_API_KEY', apiKey],
      ['NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN', authDomain],
      ['NEXT_PUBLIC_FIREBASE_PROJECT_ID', projectId],
      ['NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET', storageBucket],
      ['NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID', messagingSenderId],
      ['NEXT_PUBLIC_FIREBASE_APP_ID', appId],
    ] as const
  )
    .filter(([, v]) => !v)
    .map(([k]) => k);

  if (missing.length) {
    throw new Error(
      `[firebase] Missing env vars: ${missing.join(', ')}. Set these NEXT_PUBLIC_* variables in your environment (e.g., .env.local).`
    );
  }

  const firebaseConfig: FirebaseOptions = {
    apiKey: apiKey!,
    authDomain: authDomain!,
    projectId: projectId!,
    storageBucket: storageBucket!,
    messagingSenderId: messagingSenderId!,
    appId: appId!,
  };

// Initialize Firebase
const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();

const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app);

export { app, auth, db, storage };
>>>>>>> origin/main
