import { NextResponse } from 'next/server';
import { requireOwnerOrAdmin } from '@/lib/admin-auth';
import { getAdmin } from '@/lib/firebase-admin';

export const runtime = 'nodejs';

// POST /api/service-slots/update { id, status?, paid?, notes? }
export async function POST(req: Request) {
  const authz = await requireOwnerOrAdmin(req);
  if (!authz.ok) return NextResponse.json({ error: authz.error }, { status: authz.code });

  const body = await req.json().catch(() => ({}));
  const id = (body?.id || '').trim();
  if (!id) return NextResponse.json({ error: 'bad_request' }, { status: 400 });

  const updates: Record<string, any> = {};
  if (typeof body.status === 'string' && ['pending','approved','rejected'].includes(body.status)) {
    updates.status = body.status;
    updates.approvedAt = body.status === 'approved' ? new Date() : null;
    updates.approvedBy = body.status === 'approved' ? authz.uid : null;
  }
  if (typeof body.paid === 'boolean') updates.paid = !!body.paid;
  if (typeof body.notes === 'string') updates.adminNotes = body.notes.slice(0, 1000);

  if (!Object.keys(updates).length) return NextResponse.json({ error: 'no_updates' }, { status: 400 });

  const { db } = await getAdmin();
  await db.collection('service_slot_requests').doc(id).set(updates, { merge: true });
  return NextResponse.json({ ok: true, id, updates });
}
