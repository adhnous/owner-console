import { NextResponse } from 'next/server';
import { requireOwnerOrAdmin } from '@/lib/admin-auth';
import { getAdmin } from '@/lib/firebase-admin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const authz = await requireOwnerOrAdmin(req);
  if (!authz.ok) return NextResponse.json({ error: authz.error }, { status: authz.code });

  const url = new URL(req.url);
  const status = (url.searchParams.get('status') || 'pending') as 'pending' | 'success' | 'failed' | 'cancelled';
  const limit = Math.max(1, Math.min(200, Number(url.searchParams.get('limit') || 100)));

  const { db } = await getAdmin();
  let q = db.collection('transactions').where('status', '==', status).limit(limit);
  const snap = await q.get();
  const rows = snap.docs.map((d: any) => ({ id: d.id, ...(d.data() || {}) }));

  // Resolve basic user info
  const uids = Array.from(new Set(rows.map((r: any) => String(r.uid)).filter(Boolean)));
  const nameByUid: Record<string, string> = {};
  if (uids.length) {
    const usnaps = await Promise.all(uids.map(uid => db.collection('users').doc(uid).get()));
    for (const s of usnaps) {
      if (s.exists) {
        const u = s.data() || {};
        const name = u.displayName || u.name || (typeof u.email === 'string' ? u.email : null);
        if (name) nameByUid[s.id] = String(name);
      }
    }
  }

  const out = rows.map((r: any) => ({
    id: r.id,
    uid: r.uid,
    userName: nameByUid[r.uid] || null,
    planId: r.planId,
    amount: r.amount,
    currency: r.currency || 'LYD',
    provider: r.provider,
    status: r.status,
    createdAt: r.createdAt?._seconds ? new Date(r.createdAt._seconds * 1000).toISOString() : null,
    paidAt: r.paidAt?._seconds ? new Date(r.paidAt._seconds * 1000).toISOString() : null,
  }));

  // Newest first
  out.sort((a: any, b: any) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')));

  return NextResponse.json({ rows: out });
}
