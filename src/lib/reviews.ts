import { db } from './firebase';
import {
  collection,
  doc,
  getDoc,
  getDocs,
  orderBy,
  query,
  setDoc,
  deleteDoc,
  serverTimestamp,
  limit as fsLimit,
} from 'firebase/firestore';

export type Review = {
  id?: string; // authorId (doc id)
  serviceId: string;
  authorId: string;
  rating: number; // 1..5
  text: string;
  createdAt?: unknown;
};

export async function listReviewsByService(serviceId: string, take = 20): Promise<Review[]> {
  const col = collection(db, 'services', serviceId, 'reviews');
  const q = query(col, orderBy('createdAt', 'desc'), fsLimit(take));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as Review) }));
}

export async function getUserReviewForService(serviceId: string, authorId: string): Promise<Review | null> {
  const ref = doc(db, 'services', serviceId, 'reviews', authorId);
  const snap = await getDoc(ref);
  if (!snap.exists()) return null;
  return { id: snap.id, ...(snap.data() as Review) };
}

export async function upsertReview(args: { serviceId: string; authorId: string; rating: number; text: string }) {
  const { serviceId, authorId, rating, text } = args;
  const ref = doc(db, 'services', serviceId, 'reviews', authorId);
  await setDoc(
    ref,
    {
      serviceId,
      authorId,
      rating,
      text,
      createdAt: serverTimestamp(),
    },
    { merge: true }
  );
}

export async function deleteMyReview(serviceId: string, authorId: string) {
  const ref = doc(db, 'services', serviceId, 'reviews', authorId);
  await deleteDoc(ref);
}
