import { NextResponse } from 'next/server';
import { requireOwnerOrAdmin } from '@/lib/admin-auth';
import { getAdmin } from '@/lib/firebase-admin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// GET /api/service-slots/list?status=&uid=&email=&paid=&limit=
export async function GET(req: Request) {
  const authz = await requireOwnerOrAdmin(req);
  if (!authz.ok) return NextResponse.json({ error: authz.error }, { status: authz.code });

  const url = new URL(req.url);
  const status = (url.searchParams.get('status') || '').trim();
  const uid = (url.searchParams.get('uid') || '').trim();
  const email = (url.searchParams.get('email') || '').trim();
  const paidStr = (url.searchParams.get('paid') || '').trim();
  const limit = Math.min(Math.max(parseInt(url.searchParams.get('limit') || '300', 10) || 300, 1), 1000);

  const { db } = await getAdmin();
  let q: any = db.collection('service_slot_requests');
  if (status) q = q.where('status', '==', status);
  if (uid) q = q.where('uid', '==', uid);
  if (email) q = q.where('email', '==', email);
  if (paidStr === 'true') q = q.where('paid', '==', true);
  if (paidStr === 'false') q = q.where('paid', '==', false);
  q = q.limit(limit);

  const snap = await q.get();
  const rows = snap.docs.map((d: any) => {
    const data = d.data() || {};
    const createdAt = data.createdAt?._seconds ? new Date(data.createdAt._seconds * 1000).toISOString() : null;
    const approvedAt = data.approvedAt?._seconds ? new Date(data.approvedAt._seconds * 1000).toISOString() : null;
    return {
      id: d.id,
      uid: data.uid || null,
      email: data.email || null,
      displayName: data.displayName || null,
      role: data.role || null,
      status: data.status || 'pending',
      notes: data.notes || null,
      paid: !!data.paid,
      consumed: !!data.consumed,
      consumedServiceId: data.consumedServiceId || null,
      createdAt,
      approvedAt,
      approvedBy: data.approvedBy || null,
    };
  });

  rows.sort((a: any, b: any) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')));

  return NextResponse.json({ rows });
}
