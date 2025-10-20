import { NextResponse } from 'next/server';
import { getAdmin } from '@/lib/firebase-admin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function verifyBearer(req: Request) {
  const authHeader = req.headers.get('authorization') || req.headers.get('Authorization');
  if (!authHeader || !authHeader.toLowerCase().startsWith('bearer ')) return { ok: false as const, code: 401, error: 'missing_token' } as const;
  const token = authHeader.slice(7);
  try {
    const { auth, db } = await getAdmin();
    const decoded = await auth.verifyIdToken(token);
    const uid = decoded.uid as string;
    const userSnap = await db.collection('users').doc(uid).get();
    const role = (userSnap.exists ? (userSnap.get('role') as string) : null) || null;
    return { ok: true as const, uid, role, db };
  } catch (e) {
    return { ok: false as const, code: 401, error: 'invalid_token' } as const;
  }
}

export async function POST(req: Request) {
  const authz = await verifyBearer(req);
  if (!authz.ok) return NextResponse.json({ error: authz.error }, { status: authz.code });
  const { uid, role, db } = authz;

  // Providers and seekers can request, but we'll mainly expect providers
  const body = await req.json().catch(() => ({}));
  const notes = (body?.notes || '').toString().slice(0, 1000);

  const userSnap = await db.collection('users').doc(uid).get();
  const email = userSnap.exists ? (userSnap.get('email') as string) : null;
  const displayName = userSnap.exists ? (userSnap.get('displayName') as string) : null;

  const ref = await db.collection('service_slot_requests').add({
    uid,
    role,
    email: email || null,
    displayName: displayName || null,
    status: 'pending', // 'pending' | 'approved' | 'rejected'
    notes: notes || null,
    createdAt: new Date(),
  });

  return NextResponse.json({ ok: true, id: ref.id });
}
