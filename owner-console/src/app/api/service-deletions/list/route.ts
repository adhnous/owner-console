import { NextResponse } from 'next/server';
import { requireOwnerOrAdmin } from '@/lib/admin-auth';
import { getAdmin } from '@/lib/firebase-admin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// GET /api/service-deletions/list?status=&uid=&serviceId=&limit=
export async function GET(req: Request) {
  const authz = await requireOwnerOrAdmin(req);
  if (!authz.ok) return NextResponse.json({ error: authz.error }, { status: authz.code });

  const url = new URL(req.url);
  const status = (url.searchParams.get('status') || '').trim();
  const uid = (url.searchParams.get('uid') || '').trim();
  const serviceId = (url.searchParams.get('serviceId') || '').trim();
  const limit = Math.min(Math.max(parseInt(url.searchParams.get('limit') || '300', 10) || 300, 1), 1000);

  const { db } = await getAdmin();
  let q: any = db.collection('service_deletion_requests');
  if (status) q = q.where('status', '==', status);
  if (uid) q = q.where('uid', '==', uid);
  if (serviceId) q = q.where('serviceId', '==', serviceId);
  q = q.limit(limit);

  const snap = await q.get();
  const rows = snap.docs.map((d: any) => {
    const data = d.data() || {};
    const ts = (v: any) => (v?._seconds ? new Date(v._seconds * 1000).toISOString() : null);
    return {
      id: d.id,
      serviceId: data.serviceId || null,
      uid: data.uid || null,
      email: data.email || null,
      displayName: data.displayName || null,
      status: data.status || 'pending',
      priorStatus: data.priorStatus || null,
      reason: data.reason || null,
      createdAt: ts(data.createdAt),
      approvedAt: ts(data.approvedAt),
      approvedBy: data.approvedBy || null,
      serviceTitle: data.serviceTitle || null,
      serviceCategory: data.serviceCategory || null,
    };
  });

  rows.sort((a: any, b: any) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')));

  return NextResponse.json({ rows });
}
