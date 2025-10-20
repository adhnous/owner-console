import { NextResponse } from 'next/server';
import { requireOwnerOrAdmin } from '@/lib/admin-auth';
import { getAdmin } from '@/lib/firebase-admin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// GET /api/services/admin/list?providerUid=&email=&status=&q=&limit=
export async function GET(req: Request) {
  const authz = await requireOwnerOrAdmin(req);
  if (!authz.ok) return NextResponse.json({ error: authz.error }, { status: authz.code });

  const url = new URL(req.url);
  const status = (url.searchParams.get('status') || '').trim();
  const providerUidRaw = (url.searchParams.get('providerUid') || '').trim();
  const emailRaw = (url.searchParams.get('email') || '').trim();
  const q = (url.searchParams.get('q') || '').trim().toLowerCase();
  const limit = Math.min(Math.max(parseInt(url.searchParams.get('limit') || '200', 10) || 200, 1), 1000);

  const { db } = await getAdmin();

  let providerUid = providerUidRaw;
  if (!providerUid && emailRaw) {
    const uq = await db.collection('users').where('email', '==', emailRaw).limit(1).get();
    const doc = uq.docs[0];
    if (doc && doc.exists) providerUid = doc.id;
  }

  let queryRef: any = db.collection('services');
  if (providerUid) queryRef = queryRef.where('providerId', '==', providerUid);
  if (status) queryRef = queryRef.where('status', '==', status);
  queryRef = queryRef.limit(limit);

  const snap = await queryRef.get();
  let rows = snap.docs.map((d: any) => {
    const data = d.data() || {};
    const images = Array.isArray(data.images) ? data.images : [];
    const createdAtISO = data.createdAt?._seconds ? new Date(data.createdAt._seconds * 1000).toISOString() : null;
    return {
      id: d.id,
      title: data.title || '',
      providerId: data.providerId || '',
      status: data.status || null,
      createdAt: createdAtISO,
      imageUrl: images[0]?.url || null,
      price: typeof data.price === 'number' ? data.price : null,
      category: data.category || null,
      city: data.city || null,
      area: data.area || null,
    } as const;
  });

  // Filter by q (title substring) client-side
  if (q) rows = rows.filter((r: any) => (r.title || '').toLowerCase().includes(q));

  // Provider names
  const providerIds = Array.from(new Set(rows.map((r: any) => r.providerId).filter(Boolean)));
  const namesById: Record<string, string> = {};
  if (providerIds.length) {
    const snaps = await Promise.all(providerIds.map((id) => db.collection('users').doc(id).get()));
    for (const s of snaps) {
      if (s.exists) {
        const d = s.data() || {};
        const name = d.displayName || d.name || (typeof d.email === 'string' ? d.email.split('@')[0] : null);
        if (name) namesById[s.id] = String(name);
      }
    }
  }

  const rowsWithNames = rows.map((r: any) => ({ ...r, providerName: namesById[r.providerId] || null }));
  rowsWithNames.sort((a: any, b: any) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')));

  return NextResponse.json({ rows: rowsWithNames });
}
