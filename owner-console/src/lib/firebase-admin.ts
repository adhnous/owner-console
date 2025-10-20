export async function getAdmin() {
  const appMod = await import('firebase-admin/app');
  const fsMod = await import('firebase-admin/firestore');
  const authMod = await import('firebase-admin/auth');
  const storageMod = await import('firebase-admin/storage');

  const { getApps, initializeApp, cert, applicationDefault } = appMod as any;
  const { getFirestore, FieldValue } = fsMod as any;
  const { getAuth } = authMod as any;
  const { getStorage } = storageMod as any;

  if (!getApps().length) {
    const projectId = process.env.FIREBASE_PROJECT_ID || process.env.FIREBASE_ADMIN_PROJECT_ID;
    const clientEmail = process.env.FIREBASE_CLIENT_EMAIL || process.env.FIREBASE_ADMIN_CLIENT_EMAIL;
    const privateKeyRaw = process.env.FIREBASE_PRIVATE_KEY || process.env.FIREBASE_ADMIN_PRIVATE_KEY;
    const envBucket = process.env.FIREBASE_STORAGE_BUCKET || process.env.FIREBASE_ADMIN_STORAGE_BUCKET;
    const inferredBucket = envBucket || (projectId ? `${projectId}.appspot.com` : undefined);
    if (projectId && clientEmail && privateKeyRaw) {
      const privateKey = privateKeyRaw.replace(/\\n/g, '\n');
      initializeApp({ credential: cert({ projectId, clientEmail, privateKey }), storageBucket: inferredBucket });
    } else {
      // applicationDefault may still work if GOOGLE_APPLICATION_CREDENTIALS is set
      initializeApp({ credential: applicationDefault(), storageBucket: inferredBucket });
    }
  }

  const db = getFirestore();
  const auth = getAuth();
  // Bucket is optional; avoid throwing when not configured
  let bucket: any = null;
  try {
    const apps = (await import('firebase-admin/app') as any).getApps?.() || [];
    const app = apps[0];
    const optBucket =
      process.env.FIREBASE_STORAGE_BUCKET ||
      process.env.FIREBASE_ADMIN_STORAGE_BUCKET ||
      app?.options?.storageBucket ||
      ((process.env.FIREBASE_PROJECT_ID || process.env.FIREBASE_ADMIN_PROJECT_ID)
        ? `${process.env.FIREBASE_PROJECT_ID || process.env.FIREBASE_ADMIN_PROJECT_ID}.appspot.com`
        : undefined);
    if (optBucket) {
      bucket = getStorage().bucket(optBucket);
    }
  } catch {
    bucket = null;
  }
  return { db, auth, FieldValue, bucket } as { db: any; auth: any; FieldValue: any; bucket: any };
}
