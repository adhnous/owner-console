import { NextResponse } from 'next/server';
import { requireOwnerOrAdmin } from '@/lib/admin-auth';
import { getAdmin } from '@/lib/firebase-admin';

export const runtime = 'nodejs';

export async function POST(req: Request) {
  const authz = await requireOwnerOrAdmin(req);
  if (!authz.ok) return NextResponse.json({ error: authz.error }, { status: authz.code });

  const body = await req.json().catch(() => ({}));
  const id = (body?.id || '').trim();
  if (!id) return NextResponse.json({ error: 'bad_request' }, { status: 400 });

  const allowedString = ['title','category','city','area','contactPhone','contactWhatsapp','videoUrl'];
  const allowedNumber = ['price','priority','lat','lng'];
  const allowedBoolean = ['featured'];

  const updates: Record<string, any> = {};
  for (const k of allowedString) if (typeof body[k] === 'string') updates[k] = String(body[k]);
  for (const k of allowedNumber) if (typeof body[k] === 'number' && Number.isFinite(body[k])) updates[k] = Number(body[k]);
  for (const k of allowedBoolean) if (typeof body[k] === 'boolean') updates[k] = !!body[k];

  // optional status
  if (typeof body.status === 'string' && ['pending','approved','rejected'].includes(body.status)) {
    updates.status = body.status;
    updates.approvedAt = body.status === 'approved' ? new Date() : null;
    updates.approvedBy = body.status === 'approved' ? authz.uid : null;
  }

  if (!Object.keys(updates).length) {
    return NextResponse.json({ error: 'no_updates' }, { status: 400 });
  }

  const { db } = await getAdmin();
  await db.collection('services').doc(id).set(updates, { merge: true });
  return NextResponse.json({ ok: true, id, updates });
}
