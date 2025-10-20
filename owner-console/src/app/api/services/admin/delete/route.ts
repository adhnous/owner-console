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

  const { db } = await getAdmin();
  await db.collection('services').doc(id).delete();

  return NextResponse.json({ ok: true });
}
