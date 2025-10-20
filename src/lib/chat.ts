import { db } from './firebase';
import { getAuth } from 'firebase/auth';
import {
  addDoc,
  collection,
  doc,
  getDoc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  Timestamp,
} from 'firebase/firestore';

export type Conversation = {
  id?: string;
  serviceId: string;
  providerId: string;
  seekerId: string;
  participants: Record<string, boolean>; // { [uid]: true }
  lastMessage?: string;
  lastMessageAt?: Timestamp | unknown;
};

export type Message = {
  id?: string;
  senderId: string;
  text: string;
  createdAt?: Timestamp | unknown;
};

export function conversationIdFor(serviceId: string, uidA: string, uidB: string): string {
  const [a, b] = [uidA, uidB].sort();
  return `conv_${serviceId}_${a}_${b}`;
}

export async function findOrCreateConversation(
  serviceId: string,
  providerId: string,
  seekerId: string
): Promise<string> {
  const convId = conversationIdFor(serviceId, providerId, seekerId);
  const ref = doc(db, 'conversations', convId);
  // Important: do not read before write. Reads to a non-existent doc are denied by rules
  // because you're not yet listed in participants. Instead, write with merge unconditionally.
  await setDoc(
    ref,
    {
      serviceId,
      providerId,
      seekerId,
      participants: { [providerId]: true, [seekerId]: true },
      lastMessageAt: serverTimestamp(),
    } as Conversation,
    { merge: true }
  );
  return convId;
}

export async function sendMessage(conversationId: string, senderId: string, text: string): Promise<void> {
  const trimmed = text.trim();
  if (!trimmed) return;
  const msgCol = collection(db, 'conversations', conversationId, 'messages');
  await addDoc(msgCol, {
    senderId,
    text: trimmed.slice(0, 2000),
    createdAt: serverTimestamp(),
  } as Message);
  const convRef = doc(db, 'conversations', conversationId);
  await setDoc(
    convRef,
    {
      lastMessage: trimmed.slice(0, 140),
      lastMessageAt: serverTimestamp(),
    },
    { merge: true }
  );
  // Fire-and-forget server-side push notification to other participant(s)
  try {
    const auth = getAuth();
    const idToken = await auth.currentUser?.getIdToken();
    if (idToken) {
      await fetch('/api/notify/message', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify({ conversationId, text: trimmed.slice(0, 140) }),
      });
    }
  } catch {}
}

export function subscribeMessages(
  conversationId: string,
  cb: (messages: Message[]) => void,
  take = 100
) {
  const msgCol = collection(db, 'conversations', conversationId, 'messages');
  const q = query(msgCol, orderBy('createdAt', 'asc'));
  // Note: we can add a limit(take) once there is a createdAt index
  return onSnapshot(q, (snap) => {
    const rows = snap.docs.map((d) => ({ id: d.id, ...(d.data() as Message) }));
    cb(rows);
  });
}
