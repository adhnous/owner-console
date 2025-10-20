import { NextResponse } from 'next/server';
import { requireOwnerOrAdmin } from '@/lib/admin-auth';
import { getAdmin } from '@/lib/firebase-admin';

export const runtime = 'nodejs';

// POST /api/services/admin/create
// body: { providerUid?: string, email?: string, title: string, price?: number, category?: string, city?: string, area?: string, status?: 'pending'|'approved'|'rejected', contactPhone?: string, contactWhatsapp?: string, imageUrl?: string }
export async function POST(req: Request) {
  const authz = await requireOwnerOrAdmin(req);
  if (!authz.ok) return NextResponse.json({ error: authz.error }, { status: authz.code });

  const body = await req.json().catch(() => ({}));
  let providerUid = (body?.providerUid || '').trim();
  const email = (body?.email || '').trim();
  const title = (body?.title || '').trim();
  const status = (body?.status || 'pending').trim();
  const price = Number.isFinite(body?.price) ? Number(body.price) : undefined;
  const category = typeof body?.category === 'string' ? String(body.category) : undefined;
  const city = typeof body?.city === 'string' ? String(body.city) : undefined;
  const area = typeof body?.area === 'string' ? String(body.area) : undefined;
  const contactPhone = typeof body?.contactPhone === 'string' ? String(body.contactPhone) : undefined;
  const contactWhatsapp = typeof body?.contactWhatsapp === 'string' ? String(body.contactWhatsapp) : undefined;
  const imageUrl = typeof body?.imageUrl === 'string' ? String(body.imageUrl) : undefined;

  if (!providerUid && !email) return NextResponse.json({ error: 'provider_required' }, { status: 400 });
  if (!title) return NextResponse.json({ error: 'title_required' }, { status: 400 });
  if (!['pending','approved','rejected'].includes(status)) return NextResponse.json({ error: 'bad_status' }, { status: 400 });

  const { db } = await getAdmin();
  if (!providerUid && email) {
    const uq = await db.collection('users').where('email', '==', email).limit(1).get();
    const doc = uq.docs[0];
    if (doc && doc.exists) providerUid = doc.id;
  }
  if (!providerUid) return NextResponse.json({ error: 'provider_not_found' }, { status: 404 });

  const payload: any = {
    title,
    providerId: providerUid,
    status,
    createdAt: new Date(),
  };
  if (typeof price === 'number') payload.price = price;
  if (category) payload.category = category;
  if (city) payload.city = city;
  if (area) payload.area = area;
  if (contactPhone) payload.contactPhone = contactPhone;
  if (contactWhatsapp) payload.contactWhatsapp = contactWhatsapp;
  if (imageUrl) payload.images = [{ url: imageUrl }];

  const ref = await db.collection('services').add(payload);
  return NextResponse.json({ ok: true, id: ref.id });
}
