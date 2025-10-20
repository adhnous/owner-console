"use client";

import { app, db } from './firebase';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';

export async function getServiceWorkerRegistration(): Promise<ServiceWorkerRegistration | null> {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return null;
  try {
    // Wait for the registration created in SwRegister
    const reg = await navigator.serviceWorker.ready;
    return reg ?? null;
  } catch {
    return null;
  }
}

export async function requestPermission(): Promise<NotificationPermission> {
  if (typeof window === 'undefined' || !('Notification' in window)) return 'denied';
  if (Notification.permission === 'granted') return 'granted';
  try {
    return await Notification.requestPermission();
  } catch {
    return 'denied';
  }
}

export async function getFcmToken(): Promise<string | null> {
  if (typeof window === 'undefined') return null;
  const raw = process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY;
  const vapidKey = (raw || '').trim().replace(/^['"]|['"]$/g, '');
  const looksInvalid = !vapidKey || vapidKey.length < 70 || /[^A-Za-z0-9_\-]/.test(vapidKey);
  if (!vapidKey || looksInvalid) {
    // eslint-disable-next-line no-console
    console.warn('[fcm] Missing or invalid NEXT_PUBLIC_FIREBASE_VAPID_KEY. Use the PUBLIC key from Firebase → Project settings → Cloud Messaging → Web Push certificates (long key, usually starts with B...)');
    return null;
  }

  const perm = await requestPermission();
  if (perm !== 'granted') return null;

  const reg = await getServiceWorkerRegistration();
  if (!reg) return null;

  const { getMessaging, getToken, isSupported } = await import('firebase/messaging');
  const supported = await isSupported();
  if (!supported) return null;

  const messaging = getMessaging(app);
  try {
    const token = await getToken(messaging, {
      vapidKey,
      serviceWorkerRegistration: reg,
    });
    return token || null;
  } catch (err: any) {
    // eslint-disable-next-line no-console
    const msg = String(err?.message || err || 'error');
    if (msg.includes('applicationServerKey')) {
      console.warn('[fcm] VAPID key rejected by PushManager. Ensure you used the PUBLIC Web Push key (not the private key).');
      return null;
    }
    console.error('[fcm] getToken failed', err);
    return null;
  }
}

export async function saveFcmToken(uid: string, token: string): Promise<void> {
  const userRef = doc(db, 'users', uid);
  await setDoc(
    userRef,
    {
      fcmTokens: { [token]: true },
      fcmTokenUpdatedAt: serverTimestamp(),
    },
    { merge: true }
  );
}
