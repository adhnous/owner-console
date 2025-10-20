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

// Enforced create: providers can create only one service unless they have an approved extra slot request
export async function POST(req: Request) {
  const authz = await verifyBearer(req);
  if (!authz.ok) return NextResponse.json({ error: authz.error }, { status: authz.code });

  const { uid, role, db } = authz;
  const body = await req.json().catch(() => ({}));

  // Only providers can use this endpoint (admins should use the owner-console)
  if (role !== 'provider') return NextResponse.json({ error: 'forbidden' }, { status: 403 });

  // Count existing services by this provider
  const existingSnap = await db.collection('services').where('providerId', '==', uid).limit(1).get();
  const alreadyHasService = existingSnap.docs.length > 0;

  let usingRequestId: string | null = null;
  if (alreadyHasService) {
    // See if there is an approved, not-consumed request for extra slot
    const rq = await db
      .collection('service_slot_requests')
      .where('uid', '==', uid)
      .where('status', '==', 'approved')
      .limit(1)
      .get();
    const doc = rq.docs[0];
    if (!doc) return NextResponse.json({ error: 'limit_exceeded' }, { status: 403 });
    usingRequestId = doc.id;
  }

  // Build payload (strict allowlist)
  const payload: any = {
    title: typeof body.title === 'string' ? body.title : '',
    description: typeof body.description === 'string' ? body.description : '',
    price: Number.isFinite(body.price) ? Number(body.price) : 0,
    category: typeof body.category === 'string' ? body.category : '',
    city: typeof body.city === 'string' ? body.city : 'Tripoli',
    area: typeof body.area === 'string' ? body.area : '',
    availabilityNote: typeof body.availabilityNote === 'string' ? body.availabilityNote : '',
    images: Array.isArray(body.images) ? body.images.filter((i: any) => i && typeof i.url === 'string') : [],
    contactPhone: typeof body.contactPhone === 'string' ? body.contactPhone : undefined,
    contactWhatsapp: typeof body.contactWhatsapp === 'string' ? body.contactWhatsapp : undefined,
    videoUrl: typeof body.videoUrl === 'string' ? body.videoUrl : undefined,
    videoUrls: Array.isArray(body.videoUrls) ? body.videoUrls.filter((v: any) => typeof v === 'string' && v) : undefined,
    facebookUrl: typeof body.facebookUrl === 'string' ? body.facebookUrl : undefined,
    telegramUrl: typeof body.telegramUrl === 'string' ? body.telegramUrl : undefined,
    subservices: Array.isArray(body.subservices) ? body.subservices : [],
    providerId: uid,
    providerName: (body.providerName && typeof body.providerName === 'string') ? body.providerName : null,
    providerEmail: (body.providerEmail && typeof body.providerEmail === 'string') ? body.providerEmail : null,
    status: 'pending',
    createdAt: new Date(),
  };

  if (!payload.title) return NextResponse.json({ error: 'title_required' }, { status: 400 });

  const ref = await db.collection('services').add(payload);

  if (usingRequestId) {
    await db.collection('service_slot_requests').doc(usingRequestId).set({ consumed: true, consumedAt: new Date(), consumedServiceId: ref.id }, { merge: true });
  }

  return NextResponse.json({ ok: true, id: ref.id });
}
