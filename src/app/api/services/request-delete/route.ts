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
    return { ok: true as const, uid, db };
  } catch (e) {
    return { ok: false as const, code: 401, error: 'invalid_token' } as const;
  }
}

// Provider requests deletion: creates a request and marks service as pending
export async function POST(req: Request) {
  const authz = await verifyBearer(req);
  if (!authz.ok) return NextResponse.json({ error: authz.error }, { status: authz.code });
  const { uid, db } = authz;

  const body = await req.json().catch(() => ({}));
  const id = (body?.id || body?.serviceId || '').trim();
  const reason = typeof body?.reason === 'string' ? String(body.reason).slice(0, 1000) : null;
  if (!id) return NextResponse.json({ error: 'bad_request' }, { status: 400 });

  const ref = db.collection('services').doc(id);
  const snap = await ref.get();
  if (!snap.exists) return NextResponse.json({ error: 'not_found' }, { status: 404 });
  const data = snap.data() || {};
  if ((data.providerId || '') !== uid) return NextResponse.json({ error: 'forbidden' }, { status: 403 });

  // Ensure there isn't already a pending request for this service
  const existing = await db.collection('service_deletion_requests').where('serviceId', '==', id).where('status', '==', 'pending').limit(1).get();
  if (!existing.empty) return NextResponse.json({ error: 'already_requested' }, { status: 409 });

  const payload = {
    serviceId: id,
    uid,
    email: data.providerEmail || null,
    displayName: data.providerName || null,
    status: 'pending' as const,
    reason,
    createdAt: new Date(),
    serviceTitle: data.title || null,
    serviceCategory: data.category || null,
    priorStatus: data.status || 'approved',
  };

  await db.collection('service_deletion_requests').add(payload);

  // Mark service as pending and flag as pendingDelete
  await ref.set({ status: 'pending', pendingDelete: true }, { merge: true });

  return NextResponse.json({ ok: true });
}
